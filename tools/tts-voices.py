"""Build a voice bank from the film's own actors, and demo it.

    ~/tools/tts-venv/bin/python tools/tts-voices.py

XTTS-v2 is zero-shot: it clones any speaker from a few seconds of clean
reference audio. The project already has five distinct performances — the
narrator, the wolf and the three brothers — so each becomes a reusable voice.

Each reference is trimmed, made mono, silence-stripped and loudness-matched
before use. Reference quality is most of the result: room tone, music or a
second speaker in the clip all end up baked into the clone.

Longer references clone better. Where an actor had a short take and a long one,
the long one is used even if the short one is a nicer line — the reference is
for timbre, not for content.
"""

import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOICES = ROOT / "assets/audio/صوتيات"
BANK = ROOT / "out/tts/bank"
DEMO = ROOT / "out/tts/demo"
for d in (BANK, DEMO):
    d.mkdir(parents=True, exist_ok=True)

# One reference per character. Chosen for length and for being a clean solo
# take, not for what the line says.
CAST = [
    # Reverted to the short take by preference. The 28s reference from
    # المشهد السادس عشر is technically the stronger clone — longer references
    # hold speaker identity better — but this one is the performance that was
    # chosen, and that outranks the metric.
    ("narrator", "الراوي",        "المشهد التاسع/الرواي.mp3"),
    ("wolf",     "الذئب",         "الثاني والعشرون/الذئب.mp3"),
    ("big",      "الخروف الأكبر",  "الثامن عشر/الخروف الاكبر.mp3"),
    ("mid",      "الخروف الأوسط",  "المشهد الرابع/الخروف الاوسط 1.mp3"),
    ("small",    "الخروف الأصغر",  "المشهد العاشر/الخروف الاصغر-2.mp3"),
]

# One line, spoken by everyone, so the voices can be compared directly.
# Fully diacritized: without harakat the model guesses the vowels.
LINE = "سَنَبْني بَيْتاً قَوِيّاً مَتيناً، لا يَستَطيعُ أَحَدٌ أَنْ يَهْدِمَهُ."


def prep(src: Path, dst: Path, max_sec=28.0):
    """Trim, mono, strip silence, level-match — a clean cloning reference.

    28s is near the top of what XTTS conditions on. Short references are the
    single most common cause of a clone that has the right accent but the
    wrong person — including the wrong apparent gender.
    """
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-t", str(max_sec),
        "-ac", "1", "-ar", "22050",
        "-af", "silenceremove=start_periods=1:start_threshold=-45dB:"
               "stop_periods=-1:stop_threshold=-45dB:stop_duration=0.6,loudnorm=I=-18",
        str(dst),
    ], check=True)


print("voice bank", flush=True)
refs = {}
for key, label, rel in CAST:
    src = VOICES / rel
    if not src.exists():
        print(f"  MISSING {rel}")
        continue
    dst = BANK / f"{key}.wav"
    prep(src, dst)
    dur = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(dst)],
        capture_output=True, text=True).stdout.strip() or 0)
    refs[key] = (label, dst, dur)
    flag = "" if dur >= 5.5 else "  (short — clone may be weaker)"
    print(f"  {key:9s} {dur:5.1f}s  {label}{flag}", flush=True)

os.environ["COQUI_TOS_AGREED"] = "1"
from TTS.api import TTS as CoquiTTS  # noqa: E402

print("\nloading XTTS-v2", flush=True)
t0 = time.time()
tts = CoquiTTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cpu")
print(f"  {time.time() - t0:.0f}s", flush=True)

print(f"\nsame line in every voice:\n  «{LINE}»\n", flush=True)
made = []
for key, (label, ref, _dur) in refs.items():
    dst = DEMO / f"{key}.wav"
    t0 = time.time()
    try:
        tts.tts_to_file(text=LINE, speaker_wav=str(ref), language="ar", file_path=str(dst))
        print(f"  ok   {key:9s} {time.time() - t0:5.1f}s  {label}", flush=True)
        made.append((key, label, dst))
    except Exception as e:                                  # noqa: BLE001
        print(f"  FAIL {key:9s} {type(e).__name__}: {e}", flush=True)

# One file that plays every voice in turn, each preceded by the real actor, so
# clone and original can be judged against each other rather than in isolation.
if made:
    args = ["ffmpeg", "-y", "-loglevel", "error"]
    parts, n = [], 0
    for key, _label, dst in made:
        for src in (refs[key][1], dst):
            args += ["-i", str(src)]
            parts.append(f"[{n}:a]aresample=24000,aformat=channel_layouts=mono,"
                         f"loudnorm=I=-18,apad=pad_dur={'0.45' if n % 2 == 0 else '1.1'}[a{n}]")
            n += 1
    parts.append("".join(f"[a{i}]" for i in range(n)) + f"concat=n={n}:v=0:a=1[out]")
    out = ROOT / "out/tts/voices.m4a"
    args += ["-filter_complex", ";".join(parts), "-map", "[out]",
             "-c:a", "aac", "-b:a", "160k", str(out)]
    subprocess.run(args, check=True)
    print(f"\nvoices.m4a — real actor then clone, for each of {len(made)}:")
    for i, (_k, label, _d) in enumerate(made, 1):
        print(f"  {i}. {label}")
