"""Generate the film's kids' song — Arabic lyrics, sung.

    ~/tools/ACE-Step/.venv/bin/python tools/gen-song.py
    STEPS=20 DURATION=45 ~/tools/ACE-Step/.venv/bin/python tools/gen-song.py

ACE-Step is a song model; the three teaser cues only came out instrumental
because they were generated with lyrics="[inst]". It segments lyrics by
language and tokenizes each with a per-language phonemizer — Arabic is in that
map ("ar": 5022) — and it understands [verse] / [chorus] structure markers.

The lyrics are deliberately plain, with no harakat. That is the opposite of the
narration, where full diacritics are essential: TTS has to resolve every vowel
to speak a word correctly, whereas song lyrics in the training data are written
the way people write lyrics online, and matching that is more likely to be read
the way it was learned. If the phrasing comes out wrong, adding harakat is the
first thing to try.
"""

import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out" / "music"
OUT.mkdir(parents=True, exist_ok=True)

DURATION = float(os.environ.get("DURATION", 32))
STEPS = int(os.environ.get("STEPS", 14))
SEED = int(os.environ.get("SEED", 3311))
NAME = os.environ.get("NAME", "song-sheep")

# Short lines, one image each, and a chorus a child can shout back. The moral
# is the last line of the chorus, so it lands every repeat.
LYRICS = os.environ.get("LYRICS") or """[verse]
فوق التلة ثلاثة خراف
كل واحد بنى بيته
قش وخشب وحجارة
والريح تعرف من أتقن

[chorus]
انفخ يا ذئب انفخ وانفخ
البيت المتين لا يسقط
أتقن عملك تنم بأمان
"""

PROMPT = os.environ.get("PROMPT") or (
    "cheerful arabic children's song, simple singable melody, warm male and "
    "children's chorus vocals, acoustic guitar, hand claps, light percussion, "
    "marimba, playful and bright, nursery rhyme feel, major key, 104 bpm, "
    "clean production, catchy chorus"
)

sys.path.insert(0, str(Path.home() / "tools" / "ACE-Step"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import _torchaudio_shim  # noqa: F401,E402

from acestep.pipeline_ace_step import ACEStepPipeline  # noqa: E402

SNAPSHOT = next(
    (Path.home() / ".cache/huggingface/hub/models--ACE-Step--ACE-Step-v1-3.5B/snapshots").glob("*")
)
print(f"loading ACE-Step  ({DURATION}s, {STEPS} steps)", flush=True)
t0 = time.time()
pipe = ACEStepPipeline(checkpoint_dir=str(SNAPSHOT), dtype="bfloat16",
                       torch_compile=False, cpu_offload=False)
print(f"  {time.time() - t0:.0f}s\n", flush=True)

# Force Arabic on every Arabic-script line.
#
# ACE-Step detects the language of each lyric line separately and prefixes a
# language tag token — [ar] or [en] — which is what conditions the singing.
# Detection is per line and short lines are ambiguous: «انفخ يا ذئب انفخ وانفخ»
# was detected as Urdu, which shares the script. Urdu is not in the model's
# SUPPORT_LANGUAGES, so the code silently fell back to English and that line —
# the chorus — was sung with English phonemes.
#
# Any line containing Arabic-script characters is Arabic here. Structure tags
# ([verse], [chorus]) are ASCII and fall through to the original detector,
# which the pipeline already forces to English on purpose.
import re  # noqa: E402

ARABIC_SCRIPT = re.compile(r"[\u0600-\u06FF\u0750-\u077F]")
_detect = pipe.get_lang


def _forced_lang(text):
    return "ar" if ARABIC_SCRIPT.search(text or "") else _detect(text)


pipe.get_lang = _forced_lang

for _l in [x.strip() for x in LYRICS.split("\n") if x.strip()]:
    print(f"  [{pipe.get_lang(_l)}] {_l}", flush=True)
print(flush=True)
dst = OUT / f"{NAME}.wav"
t1 = time.time()
pipe(
    format="wav",
    audio_duration=DURATION,
    prompt=PROMPT,
    lyrics=LYRICS,
    infer_step=STEPS,
    guidance_scale=15.0,
    scheduler_type="euler",
    cfg_type="apg",
    omega_scale=10.0,
    manual_seeds=[SEED],
    save_path=str(dst),
)
print(f"\nwrote {dst.relative_to(ROOT)} in {time.time() - t1:.0f}s", flush=True)
print("DONE", flush=True)
