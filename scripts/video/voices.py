"""The narrator. One small class per voice provider, so the voice can be swapped
without touching the rest of the renderer.

    kokoro      Free and open (Apache-2.0), runs on the build machine. The default.
    elevenlabs  Used automatically when the ELEVENLABS_API_KEY secret is set.
    none        No voice: a captions-only video.

Every provider's say() returns (samples, alignment):
    samples    mono float32 audio at RATE
    alignment  None, or a list of (character, start_seconds, end_seconds) for the
               text that was spoken, when the provider reports exact timings

See DECISIONS.md, D-013, for why these voices and what their licences allow.
"""
import base64
import hashlib
import json
import os
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np

RATE = 24000

# Kokoro v1.0 model files, as published with kokoro-onnx. Checked by hash so a
# changed or half-downloaded file is never used.
KOKORO_FILES = {
    "kokoro-v1.0.onnx": (
        "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx",
        "7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5",
    ),
    "voices-v1.0.bin": (
        "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin",
        "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d",
    ),
}


class VoiceUnavailable(Exception):
    """This provider can't be used right now; the renderer falls back to the next one."""


def _sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def _download(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    req = urllib.request.Request(url, headers={"user-agent": "curiouser-video"})
    with urllib.request.urlopen(req, timeout=300) as r, open(tmp, "wb") as f:
        while True:
            block = r.read(1 << 20)
            if not block:
                break
            f.write(block)
    tmp.replace(dest)


# ---------- Reading years aloud ----------
# The free voice reads "1902" as "nineteen hundred and two". These turn a year
# into the words a person would say. Only used when a line has no "say" of its own.
_ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
_TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def _two(n):
    if n < 20:
        return _ONES[n]
    return _TENS[n // 10] + ("" if n % 10 == 0 else "-" + _ONES[n % 10])


def year_words(y):
    hi, lo = divmod(y, 100)
    if y % 1000 == 0:
        return f"{_ONES[y // 1000]} thousand"
    if 2000 < y < 2010:
        return f"two thousand and {_ONES[lo]}"
    if lo == 0:
        return f"{_two(hi)} hundred"
    if lo < 10:
        return f"{_two(hi)} oh {_ONES[lo]}"
    return f"{_two(hi)} {_two(lo)}"


def speakable(text):
    """Four-digit numbers from 1000 to 2099 read as years ("nineteen oh two"),
    unless they are plainly money, a percentage or part of a longer number."""
    return re.sub(
        r"(?<![\d.,£$€])\b(1\d{3}|20\d{2})\b(?![\d%]|[.,]\d)",
        lambda m: year_words(int(m.group(0))),
        text,
    )


# ---------- Providers ----------
class Silent:
    """Captions only. Lines are timed at a comfortable reading pace."""
    name = "none"
    credit = None

    def say(self, text, speed=1.0, before=None, after=None):
        words = max(1, len(text.split()))
        seconds = max(1.2, words / (2.7 * speed))
        return np.zeros(int(seconds * RATE), dtype=np.float32), None


class Kokoro:
    name = "kokoro"

    def __init__(self, cfg, models_dir):
        self.voice = cfg.get("voice", "bf_emma")
        self.speed = float(cfg.get("speed", 1.0))
        self.lang = cfg.get("lang", "en-gb")
        self.credit = f"Kokoro v1.0 ({self.voice}), Apache-2.0"
        models_dir = Path(models_dir)
        try:
            for fname, (url, digest) in KOKORO_FILES.items():
                path = models_dir / fname
                if not path.exists() or _sha256(path) != digest:
                    print(f"downloading {fname}…", flush=True)
                    _download(url, path)
                    if _sha256(path) != digest:
                        path.unlink()
                        raise VoiceUnavailable(f"{fname} did not match its expected hash")
            from kokoro_onnx import Kokoro as Engine
            self.engine = Engine(str(models_dir / "kokoro-v1.0.onnx"), str(models_dir / "voices-v1.0.bin"))
            if self.voice not in self.engine.get_voices():
                raise VoiceUnavailable(f'Kokoro has no voice called "{self.voice}"')
        except VoiceUnavailable:
            raise
        except Exception as e:  # missing package, no network, corrupt file
            raise VoiceUnavailable(f"Kokoro could not start: {e}") from e

    def say(self, text, speed=1.0, before=None, after=None):
        samples, rate = self.engine.create(text, voice=self.voice, speed=self.speed * speed, lang=self.lang)
        assert rate == RATE, f"unexpected sample rate {rate}"
        return np.asarray(samples, dtype=np.float32), None


class ElevenLabs:
    """Carl's own ElevenLabs voice. Needs the ELEVENLABS_API_KEY secret. The voice
    is ELEVENLABS_VOICE_ID if set, then voice.json's elevenlabs.voiceId, and
    otherwise the newest voice in the account made with Voice Design."""
    name = "elevenlabs"

    def __init__(self, cfg, key, voice_id=None):
        self.base = os.environ.get("ELEVENLABS_API_BASE", "https://api.elevenlabs.io").rstrip("/")
        self.key = key
        self.model = cfg.get("model") or "eleven_multilingual_v2"
        self.voice_id = voice_id or cfg.get("voiceId") or self._newest_designed_voice()
        self.credit = f"ElevenLabs ({self.model}), voice {self.voice_id}"

    def _call(self, method, path, body=None):
        req = urllib.request.Request(
            self.base + path,
            method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"xi-api-key": self.key, "content-type": "application/json", "accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:300]
            raise VoiceUnavailable(f"ElevenLabs answered {e.code}: {detail}") from e
        except Exception as e:
            raise VoiceUnavailable(f"ElevenLabs could not be reached: {e}") from e

    def _newest_designed_voice(self):
        q = urllib.parse.urlencode({"category": "generated", "sort": "created_at_unix", "sort_direction": "desc", "page_size": 20})
        voices = self._call("GET", f"/v2/voices?{q}").get("voices") or []
        voices = [v for v in voices if v.get("category") == "generated"]
        if not voices:
            raise VoiceUnavailable(
                "the ElevenLabs account has no voice made with Voice Design. Design one and save it, "
                "or set ELEVENLABS_VOICE_ID to the voice to use"
            )
        print(f'ElevenLabs: using the newest designed voice, "{voices[0].get("name")}"')
        return voices[0]["voice_id"]

    def say(self, text, speed=1.0, before=None, after=None):
        body = {"text": text, "model_id": self.model}
        if before:
            body["previous_text"] = before
        if after:
            body["next_text"] = after
        if abs(speed - 1.0) > 0.01:
            body["voice_settings"] = {"speed": round(min(1.2, max(0.7, speed)), 2)}
        out = self._call("POST", f"/v1/text-to-speech/{self.voice_id}/with-timestamps?output_format=mp3_44100_128", body)
        if not out.get("audio_base64"):
            raise VoiceUnavailable("ElevenLabs returned no audio")
        pcm = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", "pipe:0", "-f", "f32le", "-ac", "1", "-ar", str(RATE), "pipe:1"],
            input=base64.b64decode(out["audio_base64"]), capture_output=True, check=True,
        ).stdout
        samples = np.frombuffer(pcm, dtype=np.float32).copy()
        a = out.get("alignment") or {}
        chars, starts, ends = a.get("characters"), a.get("character_start_times_seconds"), a.get("character_end_times_seconds")
        alignment = None
        if chars and starts and ends and len(chars) == len(starts) == len(ends) and "".join(chars) == text:
            alignment = list(zip(chars, starts, ends))
        return samples, alignment


def choose(config, models_dir, want_voice=True):
    """The providers to try, best first. The last one never fails."""
    cfg = config or {}
    order = []
    key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not want_voice or cfg.get("provider") == "none":
        return [("none", lambda: Silent())]
    if key:
        order.append(("elevenlabs", lambda: ElevenLabs(cfg.get("elevenlabs") or {}, key, os.environ.get("ELEVENLABS_VOICE_ID", "").strip() or None)))
    order.append(("kokoro", lambda: Kokoro(cfg.get("kokoro") or {}, models_dir)))
    order.append(("none", lambda: Silent()))
    return order
