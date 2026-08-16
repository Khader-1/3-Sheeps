"""Generate the teaser's music cues locally with ACE-Step (Apache-2.0).

    ~/tools/ACE-Step/.venv/bin/python tools/gen-music.py

Three short cues rather than one long one: diffusion music models are poor at
placing a commanded mood change at a specific timestamp, so a 27s "starts
playful, turns ominous, ends triumphant" prompt lands maybe one generation in
six. Three focused cues at a shared tempo hit reliably and cut together
cleanly.

Writes WAVs to out/music/. Runs on Apple Silicon via MPS.
"""

import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out" / "music"
OUT.mkdir(parents=True, exist_ok=True)

BPM = 104

CUES = [
    dict(
        name="A-warm",
        duration=12.0,
        prompt=(
            "children's storybook orchestral miniature, playful pizzicato strings, "
            "marimba, soft clarinet, light triangle, innocent, curious, gentle bounce, "
            f"major key, {BPM} bpm, instrumental, no drums, sparse, cinematic"
        ),
    ),
    dict(
        name="B-tension",
        duration=16.0,
        prompt=(
            "cinematic tension build for a children's adventure film, low sustained cellos, "
            "soft timpani heartbeat, staccato strings, rising woodwinds, builds to an "
            "orchestral hit, menacing but playful, fairytale wolf, minor key, "
            f"{BPM} bpm, instrumental, no vocals"
        ),
    ),
    dict(
        name="C-title",
        duration=10.0,
        prompt=(
            "short triumphant orchestral finale sting for a children's animated film title, "
            "warm brass and full strings swell, timpani roll, resolves bright and hopeful, "
            f"rings out into silence, major key, {BPM} bpm, instrumental, no vocals"
        ),
    ),
]

# Steps trade quality for time. The model card's 2.27x realtime at 27 steps is
# an M2 Max figure and did not transfer: this machine measured ~175 s/step, so
# the first 12-second cue took 78 minutes. 14 steps still gives usable cues for
# short instrumental stings and roughly halves that.
INFER_STEPS = int(os.environ.get("STEPS", 14))
SEED = int(os.environ.get("SEED", 4242))

sys.path.insert(0, str(Path.home() / "tools" / "ACE-Step"))

# torchaudio routes load() and save() through TorchCodec, which is not
# installed here. tools/_torchaudio_shim.py patches both onto soundfile.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import _torchaudio_shim  # noqa: F401,E402

from acestep.pipeline_ace_step import ACEStepPipeline  # noqa: E402

print(f"loading ACE-Step (bfloat16, mps) — first load reads ~8 GB from disk", flush=True)
t0 = time.time()
# Point at the snapshot already in the HF cache. Passing None makes ACE-Step
# download its own second copy into ~/.cache/ace-step/checkpoints — another
# 8 GB for files that are already on disk.
SNAPSHOT = next(
    (Path.home() / ".cache/huggingface/hub/models--ACE-Step--ACE-Step-v1-3.5B/snapshots").glob("*")
)
pipe = ACEStepPipeline(
    checkpoint_dir=str(SNAPSHOT),
    dtype="bfloat16",
    torch_compile=False,
    cpu_offload=False,
)
print(f"  loaded in {time.time() - t0:.0f}s", flush=True)

for cue in CUES:
    dst = OUT / f"{cue['name']}.wav"
    # Resume: an interrupted run should not redo an hour of finished work.
    if dst.exists() and dst.stat().st_size > 1000:
        print(f"\n= {cue['name']}  already written, skipping", flush=True)
        continue
    print(f"\n▶ {cue['name']}  {cue['duration']}s  steps={INFER_STEPS}", flush=True)
    t1 = time.time()
    pipe(
        format="wav",
        audio_duration=cue["duration"],
        prompt=cue["prompt"],
        lyrics="[inst]",
        infer_step=INFER_STEPS,
        guidance_scale=15.0,
        scheduler_type="euler",
        cfg_type="apg",
        omega_scale=10.0,
        manual_seeds=[SEED],
        save_path=str(dst),
    )
    took = time.time() - t1
    print(f"  wrote {dst.name} in {took:.0f}s ({cue['duration'] / max(took, 0.01):.2f}x realtime)", flush=True)

print("\nDONE", flush=True)
