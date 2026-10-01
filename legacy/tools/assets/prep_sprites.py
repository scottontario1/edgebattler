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
PX_PER_UNIT = 300     # runtime texture pixels per world unit (tile = 1 unit)
PAD = 6               # transparent padding in runtime pixels

# Scale is set by anatomy, never by the image bounds (a halberd or a bow must not shrink its owner).
# Every entry gives, in SOURCE pixels, where the head top is; the foot line is the lowest opaque row.
#   stand: world foot-to-head-top height for a standing human. Recruits share STAND_RECRUIT so a
#          pikeman and an archer are the same height; the heroes are taller (Brenna, Dreg).
#   head : for the mounted cavalier there is no visible foot line, so the rider's head (top -> chin,
#          source pixels) is matched to the infantry's head size instead, then the horse and lance
#          simply come out at the size they were drawn.
# Recruit classes are drawn in blue and get a crimson variant for the red army by rotating only
# saturated blue pixels to red (steel, leather and skin are untouched). `feet` = source x-range of the
# boots where the automatic foot band would catch a weapon butt. The renderer reads everything from
# the manifest.
STAND_RECRUIT = 1.05
CHARS = {
    'brenna': dict(file='brenna_sprite.png', head_top=135, stand=1.25),
    'dreg': dict(file='dreg_sprite.png', head_top=90, stand=1.3),
    'pikeman': dict(file='pikeman_sprite.png', head_top=495, chin=690, stand=STAND_RECRUIT, red=True, feet=(400, 850)),
    'archer': dict(file='archer_sprite.png', head_top=330, stand=STAND_RECRUIT, red=True),
    'cavalier': dict(file='cavalier_sprite.png', head_top=300, chin=480, like='pikeman', red=True),
}

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


ppu_of = {}   # source pixels per world unit, per character
manifest = {}
OUT.mkdir(parents=True, exist_ok=True)
for name, c in CHARS.items():
    im = Image.open(SRC / c['file']).convert('RGBA')
    alpha = np.array(im)[..., 3]
    ys, xs = np.where(alpha > 8)
    box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
    ax, ay = foot_anchor(alpha, box)
    # foot span (for the contact shadow) and anchor column
    if 'feet' in c:
        fx0, fx1 = c['feet']
    else:
        band = alpha[int(ay) - int((box[3] - box[1]) * 0.16):int(ay) + 1, :] > 128
        cols = np.where(band.any(axis=0))[0]
        fx0, fx1 = int(cols.min()), int(cols.max())
    ax = (fx0 + fx1) / 2 if 'feet' in c else ax
    if 'like' in c:
        ppu = ppu_of[c['like']] * (c['chin'] - c['head_top']) / (CHARS[c['like']]['chin'] - CHARS[c['like']]['head_top'])
    else:
        ppu = (ay - c['head_top']) / c['stand']
    ppu_of[name] = ppu
    world_h = (box[3] - box[1] + 1) / ppu
    th = round(world_h * PX_PER_UNIT)
    height = th + 2 * PAD
    scale = th / (box[3] - box[1] + 1)

    def save(img, out_name):
        crop = img.crop((box[0], box[1], box[2] + 1, box[3] + 1))
        tw = round(crop.width * scale)
        small = crop.resize((tw, th), Image.LANCZOS)
        canvas = Image.new('RGBA', (tw + 2 * PAD, height), (0, 0, 0, 0))
        canvas.paste(small, (PAD, PAD))
        canvas.save(OUT / f'{out_name}.png', optimize=True)
        return canvas.size

    size = save(im, name)
    files = {'blue': f'sprites/{name}.png'}
    if c.get('red'):
        save(to_red(im), f'{name}_red')
        files['red'] = f'sprites/{name}_red.png'
    manifest[name] = {
        'files': files,
        'source': c['file'],
        'sourceSize': list(im.size),
        'cropBox': list(box),
        'scale': scale,
        'size': list(size),
        # anchor as fraction of the runtime image: x from left, y from top
        'anchor': [(PAD + (ax - box[0]) * scale) / size[0], (PAD + (ay - box[1]) * scale) / size[1]],
        'visibleHeight': th,
        'height': world_h,
        'footWidth': (fx1 - fx0) / ppu,      # world width between the outer boots/hooves
        'headTop': (ay - c['head_top']) / ppu,  # world height of the head top above the feet
    }
    print(f"{name:9s} {size} world h={world_h:.2f} head-top={manifest[name]['headTop']:.2f} feet w={manifest[name]['footWidth']:.2f}")
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2))
