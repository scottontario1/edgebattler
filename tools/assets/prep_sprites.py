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
# name -> (source file, world height of the trimmed drawing in tile units, faction variants).
# Heroes keep their fixed palette; recruit classes are drawn in blue and get a crimson variant for
# the red army by rotating only saturated blue pixels to red (steel, leather and skin are untouched).
# Heights give recruits a ~1.0 body height against Brenna's 1.3; keep in sync with nothing else -
# the renderer reads `height` from the manifest.
CHARS = {
    'brenna': ('brenna_sprite.png', 1.3, False),
    'dreg': ('dreg_sprite.png', 1.34, False),
    'pikeman': ('pikeman_sprite.png', 1.55, True),
    'archer': ('archer_sprite.png', 1.35, True),
    'cavalier': ('cavalier_sprite.png', 1.35, True),
}


# Source-pixel foot centre where the automatic band picks up something else (the pikeman's pole butt).
ANCHOR_X = {'pikeman': 600}


def to_red(im):
    """Blue cloth -> crimson (#1A4FA0 -> ~#A8231C); low-saturation and non-blue pixels are kept."""
    a = np.array(im).astype(np.float32) / 255
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    mx, mn = a[..., :3].max(-1), a[..., :3].min(-1)
    d = mx - mn
    sat = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    hue = np.zeros_like(mx)
    m = d > 1e-6
    rc = np.where(m & (mx == r), ((g - b) / np.maximum(d, 1e-6)) % 6, 0)
    gc = np.where(m & (mx == g) & (mx != r), (b - r) / np.maximum(d, 1e-6) + 2, 0)
    bc = np.where(m & (mx == b) & (mx != r) & (mx != g), (r - g) / np.maximum(d, 1e-6) + 4, 0)
    hue = (rc + gc + bc) / 6
    blue = (hue > 0.52) & (hue < 0.74) & (sat > 0.35) & (al > 0)
    nh = np.where(blue, 0.008, hue)
    ns = np.where(blue, np.minimum(1, sat * 0.95), sat)
    nv = np.where(blue, mx * 0.96, mx)
    # hsv -> rgb
    h6 = nh * 6
    i = np.floor(h6).astype(int) % 6
    f = h6 - np.floor(h6)
    p, q, t = nv * (1 - ns), nv * (1 - ns * f), nv * (1 - ns * (1 - f))
    rgb = np.select([(i == k)[..., None] for k in range(6)],
                    [np.stack(c, -1) for c in ((nv, t, p), (q, nv, p), (p, nv, t), (p, q, nv), (t, p, nv), (nv, p, q))])
    out = np.concatenate([rgb, al[..., None]], -1)
    return Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')


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
for name, (fname, height, variants) in CHARS.items():
    im = Image.open(SRC / fname).convert('RGBA')
    a = np.array(im)
    alpha = a[..., 3]
    ys, xs = np.where(alpha > 8)
    box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
    ax, ay = foot_anchor(alpha, box)
    ax = ANCHOR_X.get(name, ax)
    th = HEIGHT - 2 * PAD
    scale = th / (box[3] - box[1] + 1)

    def save(img, out_name):
        crop = img.crop((box[0], box[1], box[2] + 1, box[3] + 1))
        tw = round(crop.width * scale)
        small = crop.resize((tw, th), Image.LANCZOS)
        canvas = Image.new('RGBA', (tw + 2 * PAD, HEIGHT), (0, 0, 0, 0))
        canvas.paste(small, (PAD, PAD))
        canvas.save(OUT / f'{out_name}.png', optimize=True)
        return canvas.size

    size = save(im, name)
    files = {'blue': f'sprites/{name}.png'}
    if variants:
        save(to_red(im), f'{name}_red')
        files['red'] = f'sprites/{name}_red.png'
    manifest[name] = {
        'files': files,
        'source': fname,
        'sourceSize': list(im.size),
        'cropBox': list(box),
        'scale': scale,
        'size': list(size),
        # anchor as fraction of the runtime image: x from left, y from top
        'anchor': [(PAD + (ax - box[0]) * scale) / size[0], (PAD + (ay - box[1]) * scale) / size[1]],
        'visibleHeight': th,
        'height': height,
    }
    print(name, size, manifest[name]['anchor'])
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2))
