"""Make torchaudio work without TorchCodec.

    import _torchaudio_shim  # noqa: F401   (before importing acestep)

From PyTorch 2.9 torchaudio routes both load() and save() through TorchCodec,
which is not installed in the ACE-Step venv and pulls its own FFmpeg bindings
if you add it. soundfile is already present and does both jobs.

This has cost real time three times now, each in a different place and each
only at the moment of use:
  1. save()  — after 80 minutes of finished diffusion, writing the WAV
  2. load()  — at the start of an audio2audio run, reading the reference
  3. the TTS venv needed torchcodec pinned for an unrelated import

So both directions are patched here once, in a module both generators import.
"""

import numpy as np
import soundfile as sf
import torch
import torchaudio


def _load(uri, *args, **kwargs):
    """torchaudio.load -> (Tensor[channels, frames], sample_rate)."""
    data, sr = sf.read(str(uri), dtype="float32", always_2d=True)
    return torch.from_numpy(np.ascontiguousarray(data.T)), sr


def _save(uri, src, sample_rate, **kwargs):
    """torchaudio.save(path, Tensor[channels, frames], rate)."""
    wav = src.detach().to(torch.float32).cpu().numpy()
    if wav.ndim == 1:
        wav = wav[None, :]
    sf.write(str(uri), np.ascontiguousarray(wav.T), int(sample_rate))


torchaudio.load = _load
torchaudio.save = _save
