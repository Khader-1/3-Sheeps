"""Generate the teaser's narration in the film's own narrator voice.

    ~/tools/tts-venv/bin/python tools/tts-narration.py

Five lines, cloned from assets/audio/صوتيات via out/tts/bank/narrator.wav, and
written to out/tts/narration/. tools/mixaudio.mjs --narrated places them.

Every line is fully diacritized. Undiacritized Arabic makes the model guess the
vowels, and a wrong guess is far more noticeable than any synthetic timbre.

The lines are written to the teaser's silent gaps — the picture is already cut
to the character dialogue, so narration has to live between those lines, not
over them. Target lengths are in the comments; the script reports what it
actually produced so the mix can be checked against the gaps.
"""

import os
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "out/tts/bank/narrator.wav"
# --plain writes a second set with the tanween removed. Full nunation is
# correct Classical Arabic and the model reads it accurately, but it also makes
# the delivery formal — closer to a news bulletin than to a storyteller. The
# plain set keeps every other harakah, so the vowels are still unambiguous.
PLAIN = "--plain" in __import__("sys").argv
OUT = ROOT / ("out/tts/narration-plain" if PLAIN else "out/tts/narration")
OUT.mkdir(parents=True, exist_ok=True)

if not REF.exists():
    raise SystemExit("missing out/tts/bank/narrator.wav — run tools/tts-voices.py first")

# id, text, the gap it has to fit (seconds), optional tempo
#
# `tempo` nudges a line that will not fit its gap however it is worded. Up to
# about 1.15 is inaudible on speech and keeps the cloned timbre intact —
# atempo is time-stretching, not resampling, so the pitch does not rise.
# It is a last resort: shortening the sentence always reads better.
LINES = [
    # The ellipsis was costing ~0.6s: XTTS reads it as a real pause, which is
    # a luxury the 2.6s before the eldest speaks cannot afford.
    # Pushed a second later at the director's request, which leaves only ~1.75s
    # before the eldest speaks — so the line is shorter as well as quicker.
    # The comma cost as much as the ellipsis did — XTTS pauses on both. With
    # only ~1.75s before the eldest speaks, the village is left to the picture
    # (which is showing it) and the line keeps just the brothers.
    ("open",  "ثَلاثَةُ إِخوَة.", 1.75, 1.08),
    ("build", "كُلٌّ مِنهُم بَنى بَيتَهُ كَما شاء.", 3.3),
    # Split in two so the pause between them is set by the mix, not by however
    # long XTTS decides an ellipsis is worth. It also lets «ذئب جائع» be placed
    # on the frame the wolf is actually revealed, instead of near it.
    ("wolf-a", "لَكِنَّ شَيئاً ما يَتَرَبَّصُ في الغابَة.", 3.4),
    ("wolf-b", "ذِئبٌ جائِع.", 1.6),
    ("ask",   "فَمَنْ يَصمُدُ حينَ يُطرَقُ البَاب؟", 2.5),
    ("title", "الخِرافُ الثَّلاثَةُ وَالذِّئبُ المَاكِر… قَريباً.", 4.2),
]

# ً ٌ ٍ  — the three tanween marks, and nothing else.
TANWEEN = str.maketrans("", "", "\u064B\u064C\u064D")


def strip_tanween(text: str) -> str:
    return text.translate(TANWEEN)


os.environ["COQUI_TOS_AGREED"] = "1"
from TTS.api import TTS as CoquiTTS  # noqa: E402

print("loading XTTS-v2", flush=True)
t0 = time.time()
tts = CoquiTTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cpu")
print(f"  {time.time() - t0:.0f}s\n", flush=True)

only = next((a.split("=", 1)[1] for a in __import__("sys").argv[1:]
             if a.startswith("--only=")), None)

rows = []
for entry in LINES:
    key, text, budget = entry[0], entry[1], entry[2]
    tempo = entry[3] if len(entry) > 3 else 1.0
    if only and key != only:
        continue
    if PLAIN:
        text = strip_tanween(text)
    raw = OUT / f"_{key}-raw.wav"
    dst = OUT / f"{key}.wav"
    t0 = time.time()
    tts.tts_to_file(text=text, speaker_wav=str(REF), language="ar", file_path=str(raw))

    # Strip the lead-in/out silence XTTS leaves, and match the voice recordings'
    # level so the mix does not have to compensate per line.
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(raw),
        "-ac", "1", "-ar", "48000",
        "-af", "silenceremove=start_periods=1:start_threshold=-40dB:"
               "stop_periods=-1:stop_threshold=-40dB:stop_duration=0.35,"
               + (f"atempo={tempo}," if abs(tempo - 1.0) > 0.001 else "")
               + "loudnorm=I=-17,afade=t=in:st=0:d=0.04",
        str(dst),
    ], check=True)
    raw.unlink(missing_ok=True)

    dur = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(dst)],
        capture_output=True, text=True).stdout.strip() or 0)
    fits = "ok" if dur <= budget else f"OVER by {dur - budget:.2f}s"
    rows.append((key, dur, budget, fits))
    if tempo != 1.0:
        print(f"         (tempo {tempo}x)", flush=True)
    print(f"  {key:6s} {dur:5.2f}s / {budget:4.1f}s budget  {fits}   ({time.time() - t0:.0f}s)", flush=True)

print(f"\n{OUT.relative_to(ROOT)}/")
over = [r for r in rows if r[3] != "ok"]
if over:
    print("\nlines longer than their gap — shorten the text or widen the gap:")
    for k, d, b, _ in over:
        print(f"  {k}: {d:.2f}s vs {b:.1f}s")
