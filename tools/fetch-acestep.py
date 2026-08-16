"""Resilient fetch for the ACE-Step weights.

The 6.6 GB transformer reliably outlives a flaky connection, so this retries
around ChunkedEncodingError / IncompleteRead. huggingface_hub resumes from the
existing .incomplete file, so no progress is lost between attempts.
"""
import time, sys
from huggingface_hub import snapshot_download

REPO = "ACE-Step/ACE-Step-v1-3.5B"

for attempt in range(1, 41):
    try:
        p = snapshot_download(REPO, max_workers=2)
        print("DONE", p, flush=True)
        break
    except Exception as e:
        print(f"[attempt {attempt}] {type(e).__name__}: {str(e)[:120]}", flush=True)
        time.sleep(min(5 * attempt, 30))
else:
    print("GAVE UP", file=sys.stderr)
    sys.exit(1)
