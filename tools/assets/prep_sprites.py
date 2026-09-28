"""Prepare runtime sprite textures from the supplied source art in design_assets/.

Trims the transparent margin (recorded in the manifest), premultiplies-safe downscales with a
Lanczos filter, and records the foot anchor so the renderer can plant the sprite on its tile.
The source PNGs are never modified. Run: python tools/assets/prep_sprites.py
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'design_assets'
OUT = ROOT / 'public' / 'sprites'
HEIGHT = 384          # runtime frame height in pixels (trimmed height + padding)
PAD = 6               # transparent padding in runtime pixels
CHARS = {'brenna': 'brenna_sprite.png', 'dreg': 'dreg_sprite.png'}


def foot_anchor(alpha, box):
    """Ground contact = centroid of the lowest opaque rows (both boots), source coordinates."""
    x0, y0, x1, y1 = box
    ys = np.where(alpha[:, x0:x1 + 1].max(axis=1) > 128)[0]
    bottom = ys.max()
    # Wide band so both boots contribute: the anchor sits between the feet, not under one of them.
    band = alpha[bottom - int((y1 - y0) * 0.16):bottom + 1, :] > 128
    cols = np.where(band.any(axis=0))[0]
    return float(cols.mean()), float(bottom)


manifest = {}
OUT.mkdir(parents=True, exist_ok=True)
for name, fname in CHARS.items():
    im = Image.open(SRC / fname).convert('RGBA')
    a = np.array(im)
    alpha = a[..., 3]
    ys, xs = np.where(alpha > 8)
    box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
    ax, ay = foot_anchor(alpha, box)
    crop = im.crop((box[0], box[1], box[2] + 1, box[3] + 1))
    th = HEIGHT - 2 * PAD
    scale = th / crop.height
    tw = round(crop.width * scale)
    # bleed edge colour into transparent pixels so filtering never fringes dark
    small = crop.resize((tw, th), Image.LANCZOS)
    canvas = Image.new('RGBA', (tw + 2 * PAD, HEIGHT), (0, 0, 0, 0))
    canvas.paste(small, (PAD, PAD))
    canvas.save(OUT / f'{name}.png', optimize=True)
    manifest[name] = {
        'file': f'sprites/{name}.png',
        'source': fname,
        'sourceSize': list(im.size),
        'cropBox': list(box),
        'scale': scale,
        'size': list(canvas.size),
        # anchor as fraction of the runtime image: x from left, y from top
        'anchor': [(PAD + (ax - box[0]) * scale) / canvas.width, (PAD + (ay - box[1]) * scale) / canvas.height],
        'visibleHeight': th,
    }
    print(name, canvas.size, manifest[name]['anchor'])
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2))
