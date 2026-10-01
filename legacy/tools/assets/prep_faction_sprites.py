"""Prepare transparent faction and monster cutouts from design_assets/factions/.

Run from any directory with: python3 tools/assets/prep_faction_sprites.py
Sources are preserved. Human standing head-to-foot anatomy is normalized to 1.05 world units;
mounted art to 1.38. Larger monsters use documented whole-art heights in ENTRIES below.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'design_assets' / 'factions'
OUT = ROOT / 'public' / 'sprites' / 'factions'
MANIFEST = ROOT / 'public' / 'sprites' / 'factions-manifest.json'
PX_PER_UNIT, PAD = 300, 6
# key is the actual variant/class ID where available. Exact-source art is only mapped to the
# matching design; standalone source keys retain supplied art that has no matching roster ID.
ENTRIES = {
 'crownPike': ('argent_crown/pikeman_sprite.png', 'human', 190),
 'crownGuard': ('argent_crown/infantry.png', 'human', 205),
 'oathsworn': ('argent_crown/heavy infantry.png', 'human', 205),
 'crownArcher': ('argent_crown/archer_sprite.png', 'human', 190),
 'crownCavalier': ('argent_crown/cavalier_sprite.png', 'mounted', 225),
 'fangReaver': ('white_fang/reaver_sprite.png', 'human', 190),
 'fangAxeguard': ('white_fang/axeguard_sprite.png', 'human', 190),
 'fangBerserker': ('white_fang/berserker_sprite.png', 'human', 190),
 'fangHunter': ('white_fang/fang_hunter_sprite.png', 'human', 190),
 'pavise': ('iron_throne/Pavise Guard.png', 'human', 205),
 'coil': ('iron_throne/Coil Crossbow.png', 'human', 210),
 'sapper': ('iron_throne/Sapper.png', 'human', 210),
 'relicWalker': ('iron_throne/Relic Walker.png', 'large', 1.65),
 'feralGhoul': ('hollow_court/feral_ghoul_sprite.png', 'human', 190),
 'necromancer': ('hollow_court/necromancer_sprite.png', 'human', 200),
 'mourningKnight': ('hollow_court/mourning_knight_sprite.png', 'mounted', 225),
 'corpsehound': ('hollow_court/corpsehound.png', 'large', 1.12),
 'monsterRat': ('monsters/Rat.png', 'large', 0.42),
 'monsterSpider': ('monsters/Spider.png', 'large', 0.58),
 'monsterHyenaGoblin': ('monsters/Hyena Goblin.png', 'large', 1.05),
 'monsterBogGolem': ('monsters/Bog Golem.png', 'large', 1.75),
 'monsterOgre': ('monsters/Ogre.png', 'large', 1.65),
 'monsterWerewolf': ('monsters/werewolf.png', 'large', 1.22),
 'monsterMothBear': ('monsters/Moth Bear_Rare.png', 'large', 1.30),
}

def bounds(alpha):
    ys, xs = np.where(alpha > 8)
    return [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]

def anchor(alpha, box):
    x0, y0, x1, y1 = box
    # Ignore faint edge halos; ground is the lowest fully painted row.
    ys, xs = np.where(alpha[y0:y1+1, x0:x1+1] >= 128)
    bottom = int(ys.max() + y0)
    band = alpha[max(y0, bottom - max(3, int((y1-y0)*.025))):bottom+1] >= 128
    cols = np.where(band.any(axis=0))[0]
    return float(cols.mean()), float(bottom), (int(cols.min()), int(cols.max()))

OUT.mkdir(parents=True, exist_ok=True)
written = set()
manifest = {'schemaVersion': 1, 'units': {}, 'sourcesWithoutMatchingRosterIds': [],
            'scaling': {'humanHeadToFoot': 1.05, 'mountedHeadToHoof': 1.38, 'monsterHeights': 'whole opaque drawing; per-entry height in world units'}}
for key, (rel, kind, measure) in ENTRIES.items():
    im = Image.open(SRC / rel).convert('RGBA')
    a = np.asarray(im)[..., 3]
    box = bounds(a)
    ax, ay, feet = anchor(a, box)
    # Hand-centered contact points avoid weapon tips and transparent fringe being mistaken for boots.
    ax = (box[0] + box[2]) / 2
    feet = (max(box[0], int(ax - (box[2]-box[0])*.14)), min(box[2], int(ax + (box[2]-box[0])*.14)))
    if kind in ('human', 'mounted'):
        # Human head top is hand-marked per original sheet; ground is the opaque boot/hoof line.
        head_top = int(measure)
        anatomy = ay - head_top
        if anatomy <= 0: raise ValueError(f'{key}: invalid head marker')
        world_anatomy = 1.05 if kind == 'human' else 1.38
        ppu = anatomy / world_anatomy
        height = (box[3] - box[1] + 1) / ppu
        head_world = world_anatomy
    else:
        height = float(measure)
        ppu = (box[3] - box[1] + 1) / height
        head_world = None
    crop = im.crop((box[0], box[1], box[2]+1, box[3]+1))
    scale = PX_PER_UNIT / ppu
    tw, th = max(1, round(crop.width*scale)), max(1, round(crop.height*scale))
    small = crop.resize((tw, th), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (tw+2*PAD, th+2*PAD), (0,0,0,0))
    canvas.alpha_composite(small, (PAD,PAD))
    out = f'{key}.png'; canvas.save(OUT/out, optimize=True); written.add(out)
    size = list(canvas.size)
    # Square source-space portrait: face and shoulders for people, upper face/body for creatures.
    side = max(240, round((ay - (int(measure) if kind in ('human','mounted') else box[1])) * .62))
    portrait_center = {'monsterRat': (.82, .50), 'corpsehound': (.82, .50),
                       'monsterHyenaGoblin': (.80, .52), 'monsterMothBear': (.62, .62)}
    if key in portrait_center:
        nx, ny = portrait_center[key]
        cx, cy = box[0] + (box[2]-box[0])*nx, box[1] + (box[3]-box[1])*ny
    else:
        cx = (box[0] + box[2]) / 2
        cy = (int(measure) if kind in ('human','mounted') else box[1] + (box[3]-box[1])*.08) + side*.48
    px0, py0 = round(cx-side/2), round(cy-side/2)
    portrait = Image.new('RGBA', (side, side), (0,0,0,0))
    cut = im.crop((px0, py0, px0+side, py0+side))
    portrait.alpha_composite(cut)
    portrait_file = f'{key}-portrait.png'; portrait.save(OUT/portrait_file, optimize=True); written.add(portrait_file)
    # Normalized crop rectangle from original source, useful to reproduce or adjust the thumbnail.
    manifest['units'][key] = {
      'file': f'sprites/factions/{out}', 'portrait': f'sprites/factions/{portrait_file}',
      'portraitCrop': [px0/im.width, py0/im.height, (px0+side)/im.width, (py0+side)/im.height],
      'source': f'design_assets/factions/{rel}',
      'sourceSize': list(im.size), 'cropBox': box, 'size': size,
      'height': height, 'visibleHeight': th,
      'anchor': [(PAD+(ax-box[0])*scale)/size[0], (PAD+(ay-box[1])*scale)/size[1]],
      'footWidth': (feet[1]-feet[0])/ppu,
      'headTop': head_world, 'scaleClass': kind,
      'alpha': 'source cutout; preserved RGBA transparency; no hue shift'
    }
    print(f'{key:20s} {size!s:14s} artHeight={height:.2f} anchor={manifest["units"][key]["anchor"]}')
MANIFEST.write_text(json.dumps(manifest, indent=2)+'\n')

# Vite imports metadata from src; public holds the same metadata beside downloadable assets.
module_manifest = MANIFEST.parents[2] / 'src' / 'art' / 'factions-manifest.json'
module_manifest.parent.mkdir(parents=True, exist_ok=True)
module_manifest.write_text(json.dumps(manifest, indent=2)+'\n')
