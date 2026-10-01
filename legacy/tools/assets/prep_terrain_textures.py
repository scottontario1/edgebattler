"""Turn the watercolor terrain pack (art/textures/watercolor/, CC0) into runtime detail maps.

The source washes are dark and low contrast, so they cannot replace our ground colours. Instead each
one becomes a *neutral detail map*: the per-channel mean is subtracted and the contrast is normalised,
leaving mid-grey (0.5) plus only the brush/wash variation and its hue drift. Blended with `soft-light`
or `overlay` over the painted ground atlas (src/paint.js, src/textures.js) it adds painterly mottling
without darkening or recolouring anything.

Output: public/textures/painted/<set>_<n>.jpg at 512 px (small on disk; the sources stay in art/).
Run: python tools/assets/prep_terrain_textures.py
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'art' / 'textures' / 'watercolor'
OUT = ROOT / 'public' / 'textures' / 'painted'
SIZE = 512
TARGET_STD = 0.085      # luminance std of the finished detail map (0.5 = neutral)
MAX_GAIN = 5.0

OUT.mkdir(parents=True, exist_ok=True)
for src in sorted(SRC.glob('*.png')):
    name, num = src.stem.lower().split('_')
    a = np.asarray(Image.open(src).convert('RGB').resize((SIZE, SIZE), Image.LANCZOS)).astype(np.float32) / 255
    a -= a.reshape(-1, 3).mean(0)
    lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
    gain = min(MAX_GAIN, TARGET_STD / max(float(lum.std()), 1e-4))
    out = np.clip(0.5 + a * gain, 0, 1)
    Image.fromarray((out * 255 + 0.5).astype(np.uint8)).save(OUT / f'{name}_{int(num)}.jpg', quality=90)
    print(f'{name}_{int(num)}: gain {gain:.2f}')
