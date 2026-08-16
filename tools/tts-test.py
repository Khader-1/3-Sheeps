"""Arabic TTS bake-off: run one narration line through several engines.

    ~/tools/tts-venv/bin/python tools/tts-test.py

Writes out/tts/*.wav plus a single side-by-side comparison file.

The question is not "which model is best" in the abstract — it is whether any
of them can read THIS script in THIS narrator's voice without sounding wrong.
So the test uses a real line from the film and, for the cloning engine, a real
take by the film's own narrator as the reference.

Two versions of the same line are generated deliberately: one bare, one fully
diacritized. Undiacritized Arabic is ambiguous — علم is ʿilm, ʿalam or ʿallama
— and the synthesiser has to guess. Those wrong guesses, not synthetic timbre,
are what usually makes Arabic TTS sound broken.
"""

import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out" / "tts"
OUT.mkdir(parents=True, exist_ok=True)
VOICES = ROOT / "assets/audio/صوتيات"

# The opening narration, as the film has it.
BARE = "فوق أحد التلال البعيدة، يعيش ثلاثة خراف صغيرة في كوخ قديم مهترئ."
HARAKAT = "فَوْقَ أَحَدِ التِّلالِ البَعيدَةِ، يَعيشُ ثَلاثَةُ خِرافٍ صَغيرَةٍ في كوخٍ قَديمٍ مُهْتَرِئ."

# A clean, single-speaker take by the project's own narrator, used as the
# cloning reference. 6.5s is comfortably above XTTS's ~6s minimum.
REF_SRC = VOICES / "المشهد التاسع/الرواي.mp3"
REF_WAV = OUT / "_ref-narrator.wav"

results = []


def sh(cmd, **kw):
    return subprocess.run(cmd, shell=isinstance(cmd, str), capture_output=True, text=True, **kw)


def note(name, path, took, detail=""):
    ok = path.exists() and path.stat().st_size > 2000
    results.append((name, path.name if ok else "FAILED", took, detail))
    print(f"  {'ok ' if ok else 'FAIL'} {name:28s} {took:5.1f}s  {detail}", flush=True)


# --- 0. reference clip ------------------------------------------------------
print("reference clip", flush=True)
sh(["ffmpeg", "-y", "-loglevel", "error", "-i", str(REF_SRC),
    "-ac", "1", "-ar", "22050", "-af", "silenceremove=1:0:-45dB,loudnorm=I=-18",
    str(REF_WAV)])
print(f"  {REF_WAV.name}  ({REF_SRC.parent.name}/{REF_SRC.name})", flush=True)


# --- 1. macOS `say` — the robotic baseline ----------------------------------
# Not a candidate. It is here so there is a floor to compare against: this is
# what "robotic" actually sounds like in Arabic.
print("\nmacOS say (Majed) — baseline", flush=True)
for tag, text in (("bare", BARE), ("harakat", HARAKAT)):
    dst = OUT / f"say-{tag}.wav"
    t0 = time.time()
    aiff = dst.with_suffix(".aiff")
    sh(["say", "-v", "Majed", "-o", str(aiff), text])
    sh(["ffmpeg", "-y", "-loglevel", "error", "-i", str(aiff), "-ar", "24000", "-ac", "1", str(dst)])
    aiff.unlink(missing_ok=True)
    note(f"say / {tag}", dst, time.time() - t0, "system voice, no cloning")


# --- 2. XTTS-v2 — multilingual, clones from the reference -------------------
print("\nXTTS-v2 (cloning the film's narrator)", flush=True)
try:
    os.environ["COQUI_TOS_AGREED"] = "1"
    import torch
    from TTS.api import TTS as CoquiTTS

    # MPS is not reliable for XTTS; CPU is fast enough for a 12-word line and
    # avoids fighting the music job for GPU memory.
    t0 = time.time()
    tts = CoquiTTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cpu")
    print(f"  loaded in {time.time() - t0:.0f}s", flush=True)

    for tag, text in (("bare", BARE), ("harakat", HARAKAT)):
        dst = OUT / f"xtts-{tag}.wav"
        t0 = time.time()
        tts.tts_to_file(text=text, speaker_wav=str(REF_WAV), language="ar", file_path=str(dst))
        note(f"xtts / {tag}", dst, time.time() - t0, "cloned narrator")
except Exception as e:                                    # noqa: BLE001
    print(f"  xtts unavailable: {type(e).__name__}: {e}", flush=True)
    results.append(("xtts", "FAILED", 0.0, str(e)[:80]))


# --- report -----------------------------------------------------------------
print("\n" + "-" * 64)
for name, f, took, detail in results:
    print(f"{name:28s} {f:26s} {took:5.1f}s  {detail}")
print(f"\nfiles in {OUT.relative_to(ROOT)}/")
