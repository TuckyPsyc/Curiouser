#!/usr/bin/env python3
"""Renders one Curiouser video: a 1080x1920 MP4 of up to 60 seconds, with a
narrator, captions burned into the picture, and Tenniel's engravings moving
gently behind them. Run by .github/workflows/video.yml.

    python scripts/video/render.py videos/0008.json --out out

Writes, into --out:
    curiouser-0008.mp4           the video
    curiouser-0008.srt           the captions, as a file TikTok and Instagram accept
    curiouser-0008-caption.txt   the post caption, ready to paste
    curiouser-0008.json          what was used: voice, length, pictures, warnings

The script file (videos/NNNN.json) is written by the Producer agent; see
agents/producer.md. The voice is chosen by videos/voice.json and scripts/video/voices.py.
Nothing here posts anything anywhere.
"""
import argparse
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFont

import voices
from voices import RATE, VoiceUnavailable

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent

# ---------- The look: "The Page" (DECISIONS.md, D-010) ----------
W, H, FPS = 1080, 1920, 30
PAPER, INK, RED, MUTED = (251, 250, 247), (20, 18, 16), (179, 18, 46), (92, 88, 82)
MARGIN = 80
FELL = ROOT / "src/fonts/IMFellEnglish_400Regular.ttf"
FELL_ITALIC = ROOT / "src/fonts/IMFellEnglish_400Regular_Italic.ttf"
FELL_SC = ROOT / "src/fonts/IMFellEnglishSC_400Regular.ttf"
LITERATA = HERE / "fonts/Literata_600SemiBold.ttf"

# Where things sit. TikTok and Instagram cover the top ~150px and the bottom
# ~380px with their own buttons, so everything that matters stays between.
PIC_BOX = (MARGIN, 520, W - MARGIN, 1180)
CAP_TOP, CAP_BOTTOM = 1215, 1520
CAP_WIDTH = 880

# Timing, in seconds.
LEAD, GAP, SIGNOFF_GAP, TAIL = 0.20, 0.32, 0.50, 1.10
MAX_SECONDS = 60.0
CROSSFADE = 0.5
SIGN_OFF = "Curiouser: get curiouser before breakfast."


def font(path, size):
    return ImageFont.truetype(str(path), size)


def curly(s):
    s = re.sub(r"(^|[\s(\[{—–/-])'", r"\1‘", s)
    s = s.replace("'", "’")
    s = re.sub(r'(^|[\s(\[{—–/-])"', r"\1“", s)
    return s.replace('"', "”")


# ---------- Pictures ----------
def prepare(img):
    """A scan as clean line art: white paper, trimmed, no bigger than needed."""
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        flat = Image.new("RGBA", img.size, "white")
        flat.alpha_composite(img)
        img = flat
    img = img.convert("L")
    # Paper to pure white, so the picture has no visible edge on the page.
    img = img.point(lambda v: 255 if v >= 228 else int(v * 255 / 228))
    box = ImageChops.invert(img).getbbox()
    if box:
        pad = int(0.012 * max(img.size))
        img = img.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(img.width, box[2] + pad), min(img.height, box[3] + pad)))
    img.thumbnail((1700, 1700), Image.LANCZOS)
    return img


def load_picture(name, art, cache, warnings):
    ready = cache / "art" / f"{name}.png"
    if ready.exists():
        return Image.open(ready).convert("L")
    spec = art["pictures"][name]
    commit = art["books"][spec["book"]]["commit"]
    url = f"https://raw.githubusercontent.com/standardebooks/{spec['book']}/{commit}/images/illustration-{spec['illustration']}.png"
    try:
        raw = cache / "art" / f"{name}.source.png"
        raw.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(urllib.request.Request(url, headers={"user-agent": "curiouser-video"}), timeout=120) as r:
            raw.write_bytes(r.read())
        img = prepare(Image.open(raw))
        img.save(ready, optimize=True)
        raw.unlink()
        return img
    except Exception as e:
        # The app's own copy of the picture, or failing that the White Rabbit.
        for fallback in (name, "white-rabbit-watch"):
            local = ROOT / "src/art" / f"{fallback}.png"
            if local.exists():
                warnings.append(f'Could not download the picture "{name}" ({e}); used the app\'s {fallback} instead.')
                ink = Image.open(local).convert("RGBA").getchannel("A")  # the app stores ink as transparency
                return prepare(ImageChops.invert(ink))
        raise


class Shot:
    """One picture on screen for a while, drifting slowly."""

    def __init__(self, img, start, end, index):
        bw, bh = PIC_BOX[2] - PIC_BOX[0], PIC_BOX[3] - PIC_BOX[1]
        scale = min(bw / img.width, bh / img.height)
        self.img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
        self.start, self.end = start, end
        # Alternate: ease in on one picture, ease out on the next, drifting a little.
        small, big = 0.925, 1.0
        self.z0, self.z1 = (small, big) if index % 2 == 0 else (big, small)
        self.dx = (-14, 14)[index % 2] * (1 if index % 4 < 2 else -1)
        self.dy = 8 if index % 2 == 0 else -8
        self.size = (bw, bh)

    def frame(self, t):
        span = max(0.001, (self.end + CROSSFADE / 2) - (self.start - CROSSFADE / 2))
        p = min(1.0, max(0.0, (t - (self.start - CROSSFADE / 2)) / span))
        z = self.z0 + (self.z1 - self.z0) * p
        bw, bh = self.size
        cx = bw / 2 + self.dx * (p - 0.5)
        cy = bh / 2 + self.dy * (p - 0.5)
        # For each output pixel, where to look in the picture. Exact fractions, so the movement never jitters.
        coeffs = (1 / z, 0, self.img.width / 2 - cx / z, 0, 1 / z, self.img.height / 2 - cy / z)
        return self.img.transform(self.size, Image.AFFINE, coeffs, resample=Image.BICUBIC, fillcolor=255)


# ---------- Captions ----------
# Words a caption shouldn't end on: they belong with what follows.
_LEANS_FORWARD = set(
    "a an the of in on at to for with by from into and or but nor so yet as than that which who whose "
    "his her its their my your our this these those he she it we they you i is are was were be been am "
    "had has have do does did will would can could should may might must not no never don't didn't doesn't "
    "wasn't isn't won't can't if when while because every each some any more most very".split()
)


def _sentences(text):
    """A line as sentences, keeping closing quotation marks with the sentence they end."""
    return [s for s in re.findall(r"[^.!?]+(?:[.!?]+[\"”’)]*|$)", text) if s.strip()]


def _break_cost(words, i):
    """How bad it is to end a caption after words[i-1]. Lower is better."""
    last = words[i - 1]
    if re.search(r"[,;:—–][\"”’)]*$", last):
        return -6
    if last.lower().strip("\"“”‘’'(") in _LEANS_FORWARD:
        return 9
    return 0


def split_caption(text, limit=30):
    """A line of the script as short captions of a few words each, split where a
    reader would pause: at the end of a sentence, at a comma, never after "the"."""
    out = []
    for sentence in _sentences(text):
        words = sentence.split()
        if len(sentence.strip()) <= limit or len(words) < 2:
            out.append(" ".join(words))
            continue
        n = -(-len(" ".join(words)) // limit)  # how many captions this sentence needs
        best = None
        for count in (n, n + 1):
            if count > len(words):
                continue
            target = len(" ".join(words)) / count

            def search(start, left, cost, cuts):
                nonlocal best
                if left == 1:
                    length = len(" ".join(words[start:]))
                    total = cost + abs(length - target) + (60 if length > limit + 6 else 0) + (12 if length < 8 else 0)
                    if best is None or total < best[0]:
                        best = (total, cuts)
                    return
                for i in range(start + 1, len(words) - left + 2):
                    length = len(" ".join(words[start:i]))
                    if length > limit + 6:
                        break
                    # Each extra caption costs a little, so a short sentence isn't chopped finer than it needs.
                    search(i, left - 1, cost + 5 + abs(length - target) + _break_cost(words, i) + (12 if length < 8 else 0), cuts + [i])

            search(0, count, 0, [])
        cuts = [0] + (best[1] if best else []) + [len(words)]
        out += [" ".join(words[a:b]) for a, b in zip(cuts, cuts[1:])]
    return out


def weight(chunk):
    """Roughly how long a caption takes to say, relative to the others in its line."""
    return len(re.findall(r"[A-Za-z0-9]", chunk)) + 3 * len(re.findall(r"[,;:—–]", chunk)) + 5 * len(re.findall(r"[.!?]", chunk)) + 1


def wrap(draw, text, fnt, width):
    """Text as the fewest lines that fit the width, with the lines as even in
    length as they can be, so no word is left on a line of its own."""
    words = text.split()
    size = lambda ws: draw.textlength(" ".join(ws), font=fnt)
    # The fewest lines a simple fill needs.
    count, cur = 1, []
    for word in words:
        if cur and size(cur + [word]) > width:
            count, cur = count + 1, []
        cur.append(word)
    if count == 1:
        return [text]
    # Of every way to break into that many lines, the most even one.
    best = None

    def search(start, left, worst, lines):
        nonlocal best
        if left == 1:
            w = size(words[start:])
            if w <= width and (best is None or max(worst, w) < best[0]):
                best = (max(worst, w), lines + [" ".join(words[start:])])
            return
        for i in range(start + 1, len(words) - left + 2):
            w = size(words[start:i])
            if w > width:
                break
            search(i, left - 1, max(worst, w), lines + [" ".join(words[start:i])])

    search(0, count, 0, [])
    if best:
        return best[1]
    lines, cur = [], []  # a single word wider than the page: fill simply
    for word in words:
        if cur and size(cur + [word]) > width:
            lines.append(" ".join(cur))
            cur = []
        cur.append(word)
    return lines + [" ".join(cur)]


def caption_image(text, sign_off=False):
    """A caption as a transparent picture, sized to fit its space."""
    scratch = ImageDraw.Draw(Image.new("L", (8, 8)))
    path, colour, size = (FELL, RED, 96) if sign_off else (LITERATA, INK, 80)
    text = curly(text)
    while True:
        fnt = font(path, size)
        lines = wrap(scratch, text, fnt, CAP_WIDTH)
        line_h = round(size * 1.24)
        if (len(lines) <= 3 and len(lines) * line_h <= CAP_BOTTOM - CAP_TOP) or size <= 44:
            break
        size -= 4
    img = Image.new("RGBA", (W, len(lines) * line_h + 12), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, line in enumerate(lines):
        d.text((W / 2, i * line_h), line, font=fnt, fill=colour + (255,), anchor="ma")
    return img


# ---------- The page behind everything ----------
def page(number, topic, label):
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    d.text((MARGIN - 4, 150), "Curiouser", font=font(FELL, 124), fill=INK)
    d.text((MARGIN, 292), "Get curiouser before breakfast", font=font(FELL_ITALIC, 42), fill=MUTED)
    d.text((W - MARGIN, 196), f"No. {number}", font=font(FELL_SC, 44), fill=MUTED, anchor="ra")
    if topic:
        d.text((W - MARGIN, 250), topic, font=font(FELL_SC, 38), fill=RED, anchor="ra")
    # The chessboard strip under the masthead, as in the app.
    top, sq = 372, 20
    d.rectangle((MARGIN, top, W - MARGIN, top + 2), fill=INK)
    for row in range(2):
        for col in range((W - 2 * MARGIN) // sq):
            if (row + col) % 2 == 0:
                x, y = MARGIN + col * sq, top + 8 + row * sq
                d.rectangle((x, y, x + sq - 1, y + sq - 1), fill=INK)
    d.text((MARGIN, 440), "Before Breakfast", font=font(FELL_SC, 34), fill=MUTED)
    if label:
        d.text((W - MARGIN, 440), label, font=font(FELL_ITALIC, 34), fill=MUTED, anchor="ra")
    return img


# ---------- Putting it together ----------
def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def narrate(lines, order, models_dir, warnings):
    """Speak every line with the first provider that works. Returns the voice used and the audio per line."""
    for name, make in order:
        try:
            voice = make()
            speed = 1.0
            for attempt in range(2):
                spoken = []
                for i, line in enumerate(lines):
                    text = line["say"]
                    if voice.name == "kokoro" and not line["custom_say"]:
                        text = voices.speakable(text)
                    before = " ".join(l["say"] for l in lines[max(0, i - 2):i]) or None
                    after = lines[i + 1]["say"] if i + 1 < len(lines) else None
                    samples, alignment = voice.say(text, speed=speed, before=before, after=after)
                    spoken.append((samples, alignment if text == line["text"] else None))
                silence = LEAD + TAIL + GAP * (len(lines) - 2) + SIGNOFF_GAP
                speech = sum(len(s) for s, _ in spoken) / RATE
                if speech + silence <= MAX_SECONDS - 0.5 or attempt == 1 or voice.name == "none":
                    break
                # A little over: speak slightly faster rather than cut anything.
                speed = min(1.15, speech / (MAX_SECONDS - 1.0 - silence) * 1.01)
                print(f"{speech + silence:.1f}s is too long; trying again at {speed:.2f}x speed")
            return voice, spoken, speed
        except VoiceUnavailable as e:
            warnings.append(f"The {name} voice could not be used ({e}); fell back to the next option.")
            print(f"! {warnings[-1]}", flush=True)
    raise SystemExit("No voice provider worked, not even captions-only.")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("script", type=Path)
    ap.add_argument("--out", type=Path, default=Path("out"))
    ap.add_argument("--cache", type=Path, default=ROOT / ".cache/video")
    ap.add_argument("--voice-config", type=Path, default=ROOT / "videos/voice.json")
    ap.add_argument("--no-voice", action="store_true", help="captions only")
    ap.add_argument("--stills", type=int, default=0, help="also save this many still frames, to look at")
    ap.add_argument("--stills-only", action="store_true", help="don't encode the video, just save the stills")
    args = ap.parse_args()

    script = json.loads(args.script.read_text())
    art = json.loads((HERE / "art.json").read_text())
    config = json.loads(args.voice_config.read_text()) if args.voice_config.exists() else {}
    number = int(script["issue"])
    tag = f"curiouser-{number:04d}"
    warnings = []

    story = None
    for folder in ("content/published", "content/issues"):
        p = ROOT / folder / f"{number:04d}.json"
        if p.exists():
            story = json.loads(p.read_text())
            break
    topic = (story or {}).get("topic", "")

    # The lines to say and show.
    lines = []
    for raw in script["lines"]:
        text = " ".join(raw["text"].split())
        lines.append({"text": text, "say": " ".join(raw.get("say", text).split()), "custom_say": "say" in raw, "art": raw.get("art")})
    if lines[-1]["text"] != SIGN_OFF:
        raise SystemExit(f'The last line must be exactly: "{SIGN_OFF}"')
    lines[-1]["art"] = lines[-1]["art"] or "white-rabbit-watch"

    # 1. The voice.
    voice, spoken, speed = narrate(lines, voices.choose(config, args.cache / "models", want_voice=not args.no_voice), args.cache / "models", warnings)
    has_voice = voice.name != "none"
    label = (config.get("label") or "Narrated by an AI voice") if has_voice else ""

    # 2. The timeline: when each line, caption and picture starts.
    t = LEAD
    captions, shots_at, audio_parts = [], [], []
    for i, (line, (samples, alignment)) in enumerate(zip(lines, spoken)):
        if i == len(lines) - 1:
            t += SIGNOFF_GAP - GAP
        duration = len(samples) / RATE
        # The hook and the sign-off each stay whole, so they can be read at a glance.
        whole = i == len(lines) - 1 or (i == 0 and len(line["text"]) <= 64)
        chunks = [line["text"]] if whole else split_caption(line["text"])
        if alignment:
            # Exact: each caption starts when its first character is spoken.
            offsets, pos = [], 0
            for c in chunks:
                offsets.append(pos)
                pos += len(c) + 1
            starts = [t + alignment[min(o, len(alignment) - 1)][1] for o in offsets]
        else:
            total = sum(weight(c) for c in chunks)
            starts, acc = [], 0
            for c in chunks:
                starts.append(t + duration * acc / total)
                acc += weight(c)
        for c, s in zip(chunks, starts):
            captions.append({"start": s, "text": c, "sign_off": i == len(lines) - 1})
        if line["art"]:
            shots_at.append((t if i else 0.0, line["art"]))
        audio_parts.append((t, samples))
        t += duration + GAP
    total = t - GAP + TAIL
    if total > MAX_SECONDS:
        words = sum(len(l["text"].split()) for l in lines)
        raise SystemExit(
            f"Too long: {total:.1f} seconds for {words} words, even at {speed:.2f}x speed. "
            f"The limit is {MAX_SECONDS:.0f}. Cut about {int((total - MAX_SECONDS + 1) * 2.6) + 1} words from videos/{number:04d}.json."
        )
    captions[0]["start"] = 0.0  # the hook is on screen from the first frame
    for a, b in zip(captions, captions[1:] + [{"start": total}]):
        a["end"] = b["start"]
    if not shots_at or shots_at[0][0] > 0.01:
        shots_at.insert(0, (0.0, "white-rabbit-watch"))

    # 3. Pictures.
    shots = []
    for i, (start, name) in enumerate(shots_at):
        end = shots_at[i + 1][0] if i + 1 < len(shots_at) else total
        shots.append(Shot(load_picture(name, art, args.cache, warnings), start, end, i))

    # 4. Sound.
    audio = np.zeros(int(total * RATE) + 1, dtype=np.float32)
    for start, samples in audio_parts:
        at = int(start * RATE)
        audio[at:at + len(samples)] += samples[: len(audio) - at]
    peak = float(np.abs(audio).max())
    if peak > 0:
        audio *= 0.89 / peak

    args.out.mkdir(parents=True, exist_ok=True)
    frames = int(round(total * FPS))
    base = page(number, topic, label)
    ink = Image.new("RGB", (PIC_BOX[2] - PIC_BOX[0], PIC_BOX[3] - PIC_BOX[1]), INK)
    white = Image.new("L", ink.size, 255)
    for c in captions:
        c["img"] = caption_image(c["text"], c["sign_off"])
        c["y"] = CAP_TOP + max(0, (CAP_BOTTOM - CAP_TOP - c["img"].height) // 2)

    def draw(f):
        t = f / FPS
        frame = base.copy()
        # The picture, or two blended while one gives way to the next.
        k = max(i for i, s in enumerate(shots) if s.start - CROSSFADE / 2 <= t or i == 0)
        pic = shots[k].frame(t)
        if k > 0 and t < shots[k].start + CROSSFADE / 2:
            mix = (t - (shots[k].start - CROSSFADE / 2)) / CROSSFADE
            pic = Image.blend(shots[k - 1].frame(t), pic, min(1.0, max(0.0, mix)))
        if t < 0.35:
            pic = Image.blend(white, pic, t / 0.35)
        frame.paste(ink, PIC_BOX[:2], ImageChops.invert(pic))
        # The caption being spoken.
        for c in captions:
            if c["start"] <= t < c["end"]:
                fade = min(1.0, (t - c["start"]) / 0.10) if c["start"] > 0 else 1.0
                mask = c["img"].getchannel("A")
                if fade < 1.0:
                    mask = mask.point(lambda v: int(v * fade))
                frame.paste(c["img"], (0, c["y"]), mask)
                break
        return frame

    if args.stills:
        for n in range(args.stills):
            f = min(frames - 1, int(frames * (n + 0.5) / args.stills))
            draw(f).save(args.out / f"{tag}-still-{n + 1}.png")
        if args.stills_only:
            print(f"✓ {args.stills} still(s) in {args.out}")
            return

    # 5. Encode. Frames go straight into ffmpeg; nothing large is written to disk.
    wav = args.out / f"{tag}.wav"
    import soundfile
    soundfile.write(wav, audio, RATE)
    mp4 = args.out / f"{tag}.mp4"
    cmd = [
        "ffmpeg", "-y", "-v", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0",
        "-i", str(wav),
        # Fine engraving lines are costly to compress; this keeps a minute under about 20 MB.
        "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-maxrate", "3500k", "-bufsize", "7000k",
        "-pix_fmt", "yuv420p", "-profile:v", "high",
        "-c:a", "aac", "-b:a", "160k", "-ar", "44100",
        *(["-af", "loudnorm=I=-16:TP=-1.5:LRA=11"] if has_voice else []),
        "-movflags", "+faststart", "-t", f"{total:.3f}", str(mp4),
    ]
    enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f in range(frames):
        enc.stdin.write(draw(f).tobytes())
        if f % 300 == 0:
            print(f"frame {f}/{frames}", flush=True)
    enc.stdin.close()
    if enc.wait() != 0:
        raise SystemExit("ffmpeg failed")
    wav.unlink()

    # 6. The captions file and the post caption.
    (args.out / f"{tag}.srt").write_text(
        "".join(f"{i}\n{srt_time(c['start'])} --> {srt_time(c['end'])}\n{curly(c['text'])}\n\n" for i, c in enumerate(captions, 1))
    )
    tags = " ".join(script.get("hashtags", []))
    post = script["caption"].strip() + ("\n\n" + tags if tags else "") + ("\n\n" + label + "." if label else "")
    (args.out / f"{tag}-caption.txt").write_text(post + "\n")
    meta = {
        "issue": number,
        "seconds": round(total, 1),
        "words": sum(len(l["text"].split()) for l in lines),
        "voice": voice.name,
        "voiceCredit": voice.credit,
        "speed": round(speed, 2),
        "label": label,
        "pictures": [name for _, name in shots_at],
        "warnings": warnings,
    }
    (args.out / f"{tag}.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"✓ {mp4.name}: {total:.1f}s, {meta['words']} words, voice: {voice.credit or 'none (captions only)'}")
    for w in warnings:
        print(f"! {w}")


if __name__ == "__main__":
    sys.exit(main())
