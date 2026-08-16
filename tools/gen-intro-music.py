"""Intro music demo — the proud opening and the villain turn.

    ~/tools/ACE-Step/.venv/bin/python tools/gen-intro-music.py

Two short cues that together demonstrate the shape the film's intro needs:
a proud orchestral fanfare, and the moment it goes dark when the wolf appears.
That turn is the whole point of the reference the director gave — the Arabic
Smurfs opening, which is bright and prideful until شرشبيل walks in.

Two cues rather than one continuous piece, for the same reason the teaser used
three: a diffusion model cannot be told to change mood at a given second. It
can be told to be proud, or to be menacing. Cutting between two reliable cues
beats gambling on one that has to turn in the right place.

The turn cue uses audio2audio with the film's existing B-tension as reference,
at low strength. Low strength picks up the palette — same instruments, same
recorded character — without producing a variation on that cue. It is also why
the reference is OUR music and not the Smurfs recording: high strength against
a copyrighted track produces something derived from it.
"""

import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out" / "music"
OUT.mkdir(parents=True, exist_ok=True)

BPM = 100
STEPS = int(os.environ.get("STEPS", 10))     # demo quality; raise for the final
SEED = int(os.environ.get("SEED", 8123))

CUES = [
    dict(
        name="intro-fanfare",
        duration=11.0,
        prompt=(
            "grand orchestral fanfare opening for a classic animated children's film, "
            "bright triumphant brass, French horns, sweeping strings, timpani rolls, "
            "cymbal swell, proud and warm and noble, 1980s Saturday-morning cartoon "
            f"main title, major key, {BPM} bpm, instrumental, no vocals, cinematic"
        ),
        ref=None,
    ),
    dict(
        name="intro-turn",
        duration=11.0,
        prompt=(
            "the villain's theme entering, orchestral mood turn from bright to dark, "
            "low brass and contrabassoon, ominous staccato strings, timpani heartbeat, "
            "sinister but playful pantomime villain, fairytale wolf, minor key, "
            f"{BPM} bpm, instrumental, no vocals, cinematic"
        ),
        # Our own cue as the style reference, at low strength: palette, not content.
        ref=OUT / "B-tension.wav",
        ref_strength=0.28,
    ),
]

sys.path.insert(0, str(Path.home() / "tools" / "ACE-Step"))

# torchaudio routes load() and save() through TorchCodec, which is not
# installed here. tools/_torchaudio_shim.py patches both onto soundfile.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import _torchaudio_shim  # noqa: F401,E402

from acestep.pipeline_ace_step import ACEStepPipeline  # noqa: E402

SNAPSHOT = next(
    (Path.home() / ".cache/huggingface/hub/models--ACE-Step--ACE-Step-v1-3.5B/snapshots").glob("*")
)
print("loading ACE-Step", flush=True)
t0 = time.time()
pipe = ACEStepPipeline(checkpoint_dir=str(SNAPSHOT), dtype="bfloat16",
                       torch_compile=False, cpu_offload=False)
print(f"  {time.time() - t0:.0f}s", flush=True)

for cue in CUES:
    dst = OUT / f"{cue['name']}.wav"
    if dst.exists() and dst.stat().st_size > 1000:
        print(f"= {cue['name']} already written, skipping", flush=True)
        continue

    ref = cue.get("ref")
    use_ref = bool(ref and Path(ref).exists())
    tag = f"  ref={Path(ref).name} @ {cue['ref_strength']}" if use_ref else ""
    print(f"\n▶ {cue['name']}  {cue['duration']}s  steps={STEPS}{tag}", flush=True)
    t1 = time.time()
    kw = dict(
        format="wav",
        audio_duration=cue["duration"],
        prompt=cue["prompt"],
        lyrics="[inst]",
        infer_step=STEPS,
        guidance_scale=15.0,
        scheduler_type="euler",
        cfg_type="apg",
        omega_scale=10.0,
        manual_seeds=[SEED],
        save_path=str(dst),
    )
    if use_ref:
        kw.update(audio2audio_enable=True, ref_audio_input=str(ref),
                  ref_audio_strength=cue["ref_strength"])
    pipe(**kw)
    print(f"  wrote {dst.name} in {time.time() - t1:.0f}s", flush=True)

print("\nDONE", flush=True)
