"""Voice treatment variants for the narrator.

    ~/tools/tts-venv/bin/python tools/tts-style.py

The classic Arabic-dub narrator sound is mostly production, not a different
voice: chest weight around 140Hz, the 400Hz mud pulled out, presence added
around 4kHz, hard compression so the level never drops, and a short room so it
sounds like a booth rather than a phone.

This generates one line in the cloned narrator's voice and renders it four
ways so the register can be chosen by ear.

Pitch shifting uses asetrate + atempo, which moves the formants along with the
pitch — this ffmpeg has no rubberband. That is not strictly "correct", but for
a narrator it works in our favour: it makes the speaker sound physically
larger, not just lower. Past about two semitones it stops sounding like a
person, so the variants stop there.
"""

import os
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "out/tts/bank/narrator.wav"
OUT = ROOT / "out/tts/style"
OUT.mkdir(parents=True, exist_ok=True)

LINE = "فَوقَ تَلٍّ بَعيدٍ، في قَريَةٍ هادِئَة، عاشَ ثَلاثَةُ إِخوَة."

# Shared "dub booth" chain: high-pass the rumble, add chest, clear the mud,
# add presence, compress hard, then a short double tap that reads as a room.
BOOTH = (
    "highpass=f=70,"
    "equalizer=f=140:t=q:w=0.9:g=3.5,"
    "equalizer=f=420:t=q:w=1.1:g=-2.5,"
    "equalizer=f=4200:t=q:w=1.2:g=2.5,"
    "acompressor=threshold=-20dB:ratio=4:attack=8:release=180:makeup=2,"
    "aecho=0.85:0.55:38|72:0.16|0.09"
)


def semitones(n):
    """asetrate/atempo pair for an n-semitone shift (negative = down).

    The leading aresample is load-bearing. asetrate reinterprets the stream at
    a new rate, so the shift is only correct if the stream already IS at the
    rate the arithmetic assumes. XTTS writes 24kHz, and hardcoding 48000 here
    made every shifted variant play at nearly double speed.
    """
    f = 2 ** (n / 12)
    return (f"aresample=48000,asetrate=48000*{f:.5f},"
            f"aresample=48000,atempo={1 / f:.5f}")


VARIANTS = [
    ("0-raw",     "", "الاستنساخ كما هو"),
    ("1-booth",   BOOTH, "معالجة استوديو"),
    ("2-deep1",   f"{semitones(-1)},{BOOTH}", "معالجة + أخفض بنصف درجة"),
    ("3-deep2",   f"{semitones(-2)},{BOOTH}", "معالجة + أخفض بدرجة كاملة"),
]

os.environ["COQUI_TOS_AGREED"] = "1"
from TTS.api import TTS as CoquiTTS  # noqa: E402

print("loading XTTS-v2", flush=True)
t0 = time.time()
tts = CoquiTTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cpu")
print(f"  {time.time() - t0:.0f}s", flush=True)

raw = OUT / "_raw.wav"
print(f"\n«{LINE}»", flush=True)
tts.tts_to_file(text=LINE, speaker_wav=str(REF), language="ar", file_path=str(raw))

made = []
for key, chain, label in VARIANTS:
    dst = OUT / f"{key}.wav"
    af = "silenceremove=start_periods=1:start_threshold=-40dB:stop_periods=-1:" \
         "stop_threshold=-40dB:stop_duration=0.4,"
    af += (chain + ",") if chain else ""
    af += "loudnorm=I=-17"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw),
                    "-ac", "1", "-ar", "48000", "-af", af, str(dst)], check=True)
    dur = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(dst)],
        capture_output=True, text=True).stdout.strip() or 0)
    made.append((key, dst, label))
    print(f"  {key:9s} {dur:5.2f}s  {label}", flush=True)

# One file, all four in order, with a gap between.
args = ["ffmpeg", "-y", "-loglevel", "error"]
parts = []
for i, (_k, dst, _l) in enumerate(made):
    args += ["-i", str(dst)]
    parts.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=mono,apad=pad_dur=1.0[a{i}]")
parts.append("".join(f"[a{i}]" for i in range(len(made))) + f"concat=n={len(made)}:v=0:a=1[out]")
args += ["-filter_complex", ";".join(parts), "-map", "[out]",
         "-c:a", "aac", "-b:a", "192k", str(OUT / "compare.m4a")]
subprocess.run(args, check=True)
print("\nout/tts/style/compare.m4a — in order:")
for i, (_k, _d, label) in enumerate(made, 1):
    print(f"  {i}. {label}")
