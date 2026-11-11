#!/usr/bin/env python3
"""Checks the parts of the video renderer that can be checked without rendering
a whole video: reading years aloud, splitting captions, and the ElevenLabs
switch, which is tested against a stand-in for ElevenLabs' service because the
real one needs Carl's key.

    python scripts/video/selftest.py
"""
import base64
import json
import os
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render
import voices

failed = 0


def ok(name, cond, detail=""):
    global failed
    print(f"  {'✓' if cond else '✗'} {name}" + (f"\n      {detail}" if detail and not cond else ""))
    failed += 0 if cond else 1


print("Reading years aloud")
for year, words in [(1902, "nineteen oh two"), (1930, "nineteen thirty"), (1862, "eighteen sixty-two"), (1900, "nineteen hundred"),
                    (2000, "two thousand"), (2005, "two thousand and five"), (2026, "twenty twenty-six"), (1066, "ten sixty-six"), (1499, "fourteen ninety-nine")]:
    ok(f"{year} → {words}", voices.year_words(year) == words, voices.year_words(year))
ok("a year inside a sentence", voices.speakable("In 1902, Hanoi had rats.") == "In nineteen oh two, Hanoi had rats.")
ok("money, percentages and long numbers are left alone", voices.speakable("£1500, 1200% and 1,902,000") == "£1500, 1200% and 1,902,000")

print("Captions")
chunks = render.split_caption("The pattern was never out there in the bamboo. It was in his own mind.")
ok("a caption never ends on 'the'", not any(c.split()[-1].lower() in ("the", "a", "of", "in") for c in chunks), str(chunks))
ok("sentences are kept apart", any(c.endswith("bamboo.") for c in chunks), str(chunks))
ok("no caption is longer than two short lines", all(len(c) <= 36 for c in chunks), str(chunks))
ok("nothing is lost", " ".join(chunks) == "The pattern was never out there in the bamboo. It was in his own mind.")
quoted = render.split_caption('"No one has ever known but failed to act." That was his reply.')
ok("a closing quotation mark stays with its sentence", quoted[-2].endswith('act."'), str(quoted))

print("The ElevenLabs switch (against a stand-in service)")
calls = []


class Stub(BaseHTTPRequestHandler):
    voices = [{"voice_id": "designed-2", "name": "Newest designed", "category": "generated"}, {"voice_id": "designed-1", "name": "Older", "category": "generated"}]

    def log_message(self, *a):
        pass

    def _send(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        calls.append(("GET", self.path, self.headers.get("xi-api-key")))
        if self.headers.get("xi-api-key") != "good-key":
            return self._send(401, {"detail": "invalid key"})
        self._send(200, {"voices": Stub.voices, "has_more": False})

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["content-length"])))
        calls.append(("POST", self.path, body))
        if self.headers.get("xi-api-key") != "good-key":
            return self._send(401, {"detail": "invalid key"})
        text = body["text"]
        seconds = 0.06 * len(text)
        mp3 = subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", f"sine=frequency=220:duration={seconds}", "-f", "mp3", "pipe:1"], capture_output=True, check=True).stdout
        self._send(200, {
            "audio_base64": base64.b64encode(mp3).decode(),
            "alignment": {"characters": list(text), "character_start_times_seconds": [0.06 * i for i in range(len(text))], "character_end_times_seconds": [0.06 * (i + 1) for i in range(len(text))]},
        })


server = HTTPServer(("127.0.0.1", 0), Stub)
threading.Thread(target=server.serve_forever, daemon=True).start()
os.environ["ELEVENLABS_API_BASE"] = f"http://127.0.0.1:{server.server_port}"

os.environ["ELEVENLABS_API_KEY"] = "good-key"
os.environ.pop("ELEVENLABS_VOICE_ID", None)
order = voices.choose({"provider": "kokoro"}, "/nonexistent")
ok("with the key set, ElevenLabs is tried first, then the free voice, then captions only", [n for n, _ in order] == ["elevenlabs", "kokoro", "none"])
v = order[0][1]()
ok("with no voice named, it picks the newest Voice Design voice in the account", v.voice_id == "designed-2", v.voice_id)
samples, alignment = v.say("A man once stared at bamboo.", before="Earlier text.", after="Later text.")
post = [c for c in calls if c[0] == "POST"][-1]
ok("it asks for speech with timings from that voice", post[1].startswith("/v1/text-to-speech/designed-2/with-timestamps"), post[1])
ok("it passes the lines before and after, so the voice flows", post[2].get("previous_text") == "Earlier text." and post[2].get("next_text") == "Later text.")
ok("it leaves the voice's own settings alone at normal speed", "voice_settings" not in post[2])
ok("the audio comes back at the right length", abs(len(samples) / voices.RATE - 0.06 * 28) < 0.15, f"{len(samples) / voices.RATE:.2f}s")
ok("exact timings come back for each character", alignment and len(alignment) == 28 and abs(alignment[6][1] - 0.36) < 1e-6)

os.environ["ELEVENLABS_VOICE_ID"] = "chosen-by-carl"
ok("ELEVENLABS_VOICE_ID overrides the automatic choice", voices.choose({}, "/nonexistent")[0][1]().voice_id == "chosen-by-carl")
os.environ.pop("ELEVENLABS_VOICE_ID")
ok("so does voiceId in videos/voice.json", voices.choose({"elevenlabs": {"voiceId": "from-file"}}, "/nonexistent")[0][1]().voice_id == "from-file")

Stub.voices = []
try:
    voices.choose({}, "/nonexistent")[0][1]()
    ok("an account with no designed voice is reported, not guessed at", False)
except voices.VoiceUnavailable as e:
    ok("an account with no designed voice is reported, not guessed at", "Voice Design" in str(e), str(e))

os.environ["ELEVENLABS_API_KEY"] = "bad-key"
try:
    voices.choose({}, "/nonexistent")[0][1]()
    ok("a wrong key is reported", False)
except voices.VoiceUnavailable as e:
    ok("a wrong key is reported, so the renderer can fall back", "401" in str(e), str(e))

os.environ.pop("ELEVENLABS_API_KEY")
ok("with no key, the free voice is first", [n for n, _ in voices.choose({"provider": "kokoro"}, "/nonexistent")] == ["kokoro", "none"])
ok('"provider": "none" means captions only, even with a key', [n for n, _ in voices.choose({"provider": "none"}, "/nonexistent")] == ["none"])
server.shutdown()
print("\n✗ %d test(s) failed" % failed if failed else "\n✓ All video tests passed")
sys.exit(1 if failed else 0)
