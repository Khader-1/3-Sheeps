"""Generate one line in one of the film's cloned voices.

    ~/tools/tts-venv/bin/python tools/tts-line.py \
        --voice=big --out=out/tts/lines/big-plan.wav \
        --text="أَنا عِندي خُطَّة."

    --voice   narrator | wolf | big | mid | small   (out/tts/bank/*.wav)
    --tempo   optional speed nudge, 1.0 = as spoken
    --gain    loudnorm target in LUFS, default -17 to match the recordings

For lines the actors never recorded, or recorded inside a longer sentence that
will not cut cleanly. Trimming a phrase out of a take only works when the
words happen to sit between two silences; when they do not, synthesising the
line in the same voice is cleaner than a bad edit.
"""

import argparse
import os
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BANK = ROOT / "out/tts/bank"

ap = argparse.ArgumentParser()
ap.add_argument("--voice", required=True)
ap.add_argument("--text", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--tempo", type=float, default=1.0)
ap.add_argument("--gain", type=float, default=-17.0)
a = ap.parse_args()

ref = BANK / f"{a.voice}.wav"
if not ref.exists():
    raise SystemExit(f"no voice '{a.voice}' in {BANK.relative_to(ROOT)}/ "
                     f"— run tools/tts-voices.py first")

dst = ROOT / a.out
dst.parent.mkdir(parents=True, exist_ok=True)
raw = dst.with_name("_" + dst.name)

os.environ["COQUI_TOS_AGREED"] = "1"
from TTS.api import TTS as CoquiTTS  # noqa: E402

print(f"voice {a.voice}  «{a.text}»", flush=True)
t0 = time.time()
tts = CoquiTTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cpu")
tts.tts_to_file(text=a.text, speaker_wav=str(ref), language="ar", file_path=str(raw))

af = ("silenceremove=start_periods=1:start_threshold=-40dB:stop_periods=-1:"
      "stop_threshold=-40dB:stop_duration=0.3,")
if abs(a.tempo - 1.0) > 0.001:
    af += f"aresample=48000,atempo={a.tempo},"
af += f"loudnorm=I={a.gain},afade=t=in:st=0:d=0.03"

subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw),
                "-ac", "1", "-ar", "48000", "-af", af, str(dst)], check=True)
raw.unlink(missing_ok=True)

dur = float(subprocess.run(
    ["ffprobe", "-v", "error", "-show_entries", "format=duration",
     "-of", "default=nw=1:nk=1", str(dst)],
    capture_output=True, text=True).stdout.strip() or 0)
print(f"  {a.out}  {dur:.2f}s  ({time.time() - t0:.0f}s)")
