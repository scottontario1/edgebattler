"""Builds the castle and village cottages as GLB.

Run headless from the project root:
    blender -b --factory-startup -P tools/blender/build_buildings.py

Outputs (public/models/env/):
  castle.glb     curtain walls, four round towers, gatehouse with arched gate, keep, banners.
                 Footprint ~1.1 x 1.1 tiles; origin at ground centre; gate faces the camera.
                 Flagpole top is at KEEP_POLE_TOP (src/map.js places the animated flag there).
  cottage_a.glb  timber-framed cottage with a clay shingle roof (~0.4 x 0.3)
  cottage_b.glb  longer stone cottage with a thatched roof (~0.48 x 0.3)
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    arch_cutter, cone, cube, cut, cylinder, export, finish, material, mesh_from, reset,
)

KEEP_POLE_TOP = 1.16  # keep in sync with src/map.js


def merlons_line(parts, mat, x0, x1, y, z, along='x', size=0.045, gap=0.035, depth=0.05):
    """Row of crenellation blocks from x0 to x1 (or y0..y1 when along='y')."""
    n = max(2, int(round((x1 - x0) / (size + gap))))
    step = (x1 - x0) / n
    for i in range(n + 1):
        t = x0 + i * step
        loc = (t, y, z) if along == 'x' else (y, t, z)
        dims = (size, depth, 0.05) if along == 'x' else (depth, size, 0.05)
        parts.append(cube('merlon', dims, loc, mat))


def merlons_ring(parts, mat, cx, cy, r, z, n=8):
    for i in range(n):
        a = 2 * math.pi * i / n
        m = cube('merlon', (0.04, 0.035, 0.05), (cx + math.cos(a) * r, cy + math.sin(a) * r, z), mat)
        m.rotation_euler = (0, 0, a)
        parts.append(m)


def banner(parts, x, y, z, w=0.075, h=0.2, facing=-1):
    """Hanging banner on a wall face (facing -1 = front). Swallow-tail bottom and a gold emblem."""
    ban = material('banner', (0.2, 0.3, 0.7), 0.7)
    gold = material('gold', (0.85, 0.65, 0.2), 0.35)
    yy = y + facing * 0.004
    verts = [(x - w / 2, yy, z), (x + w / 2, yy, z), (x + w / 2, yy, z - h), (x, yy, z - h + 0.035), (x - w / 2, yy, z - h)]
    parts.append(mesh_from('banner', verts, [(0, 1, 2, 3, 4)], ban))
    parts.append(cube('banner_rod', (w + 0.02, 0.012, 0.012), (x, yy, z + 0.004), material('wood')))
    em = cube('emblem', (0.028, 0.006, 0.028), (x, yy + facing * 0.003, z - h * 0.4), gold)
    em.rotation_euler = (0, math.pi / 4, 0)
    parts.append(em)


# ---------------------------------------------------------------- castle
def build_castle():
    reset()
    stone = material('stone', (0.78, 0.75, 0.68))
    roof = material('roof_faction', (0.2, 0.3, 0.7), 0.6)
    wood = material('wood', (0.45, 0.3, 0.18))
    window = material('window', (1.0, 0.75, 0.35), 0.5)
    parts = []

    s, t, wall_h = 0.42, 0.07, 0.26
    parts.append(cube('plinth', (0.94, 0.94, 0.04), (0, 0, 0.02), stone))

    # Curtain walls; the front one (-Y) gets the gate arch cut through it.
    walls = {
        'front': cube('wall_front', (2 * s, t, wall_h), (0, -s, wall_h / 2), stone),
        'back': cube('wall_back', (2 * s, t, wall_h), (0, s, wall_h / 2), stone),
        'left': cube('wall_left', (t, 2 * s, wall_h), (-s, 0, wall_h / 2), stone),
        'right': cube('wall_right', (t, 2 * s, wall_h), (s, 0, wall_h / 2), stone),
    }
    parts += walls.values()
    top = wall_h + 0.025
    merlons_line(parts, stone, -s + 0.1, s - 0.1, -s - t / 2 + 0.02, top)
    merlons_line(parts, stone, -s + 0.1, s - 0.1, s + t / 2 - 0.02, top)
    merlons_line(parts, stone, -s + 0.1, s - 0.1, -s - t / 2 + 0.02, top, along='y')
    merlons_line(parts, stone, -s + 0.1, s - 0.1, s + t / 2 - 0.02, top, along='y')

    # Gatehouse: a taller block over the gate, crenellated, with the arch cut through both.
    gh = cube('gatehouse', (0.3, 0.14, 0.4), (0, -s, 0.2), stone)
    parts.append(gh)
    merlons_line(parts, stone, -0.13, 0.13, -s - 0.05, 0.425)
    cut(gh, arch_cutter(0.13, 0.19, 0.3, (0, -s, 0.0)))
    cut(walls['front'], arch_cutter(0.13, 0.19, 0.3, (0, -s, 0.0)))
    parts.append(cube('gate', (0.12, 0.02, 0.17), (0, -s + 0.02, 0.085), wood))
    for i in range(4):  # iron bands on the gate
        parts.append(cube('band', (0.125, 0.024, 0.008), (0, -s + 0.02, 0.03 + i * 0.04), material('gold')))
    parts.append(cube('gh_window', (0.03, 0.01, 0.05), (0, -s - 0.072, 0.31), window))
    banner(parts, -0.1, -s - 0.07, 0.36)
    banner(parts, 0.1, -s - 0.07, 0.36)

    # Corner towers with conical roofs.
    for cx, cy in ((-s, -s), (s, -s), (-s, s), (s, s)):
        parts.append(cylinder('tower', 0.1, 0.46, (cx, cy, 0.23), stone, verts=20))
        parts.append(cylinder('tower_lip', 0.118, 0.03, (cx, cy, 0.46), stone, verts=20))
        parts.append(cone('tower_roof', 0.132, 0.0, 0.28, (cx, cy, 0.615), roof, verts=20))
        slit = cube('slit', (0.018, 0.01, 0.06), (cx, cy - 0.1, 0.3), window)
        parts.append(slit)

    # Keep: tall block with a hipped roof, windows and a flagpole.
    kw, kd, kh, ky = 0.38, 0.32, 0.64, 0.08
    parts.append(cube('keep', (kw, kd, kh), (0, ky, kh / 2), stone))
    parts.append(cube('keep_band', (kw + 0.02, kd + 0.02, 0.03), (0, ky, kh - 0.015), stone))
    roof_k = cone('keep_roof', 0.33, 0.0, 0.32, (0, ky, kh + 0.16), roof, verts=4)
    roof_k.rotation_euler = (0, 0, math.pi / 4)
    roof_k.scale = (1.0, kd / kw, 1.0)
    parts.append(roof_k)
    for wx in (-0.1, 0.1):
        for wz in (0.36, 0.5):
            parts.append(cube('keep_window', (0.035, 0.01, 0.06), (wx, ky - kd / 2 - 0.004, wz), window))
    banner(parts, 0, ky - kd / 2, 0.3, w=0.1, h=0.24)
    parts.append(cylinder('pole', 0.008, KEEP_POLE_TOP - kh - 0.1, (0, ky, (KEEP_POLE_TOP + kh + 0.1) / 2), wood, verts=6))

    finish(parts, uv_scale=3.0)
    export('castle.glb', parts)


# ---------------------------------------------------------------- cottages
def gable_roof(parts, length, half_w, wall_top, pitch, mat, rng, rows=5, overhang=0.035):
    """Two roof slopes built from overlapping shingle strips, each strip slightly skewed."""
    rise = math.tan(pitch) * half_w
    slope_len = math.hypot(half_w + overhang, rise + overhang * math.tan(pitch))
    # Solid roof body under the shingles so no gaps show between strips.
    ex, ey, ez = length / 2 + overhang, half_w + overhang, wall_top - overhang * math.tan(pitch)
    rz = wall_top + rise
    body = mesh_from('roof_body', [
        (-ex, -ey, ez), (ex, -ey, ez), (ex, 0, rz), (-ex, 0, rz), (-ex, ey, ez), (ex, ey, ez),
    ], [(0, 1, 2, 3), (5, 4, 3, 2), (0, 4, 5, 1), (0, 3, 4), (1, 5, 2)], mat)
    parts.append(body)
    for side in (-1, 1):
        for k in range(rows):
            f = (k + 0.5) / rows
            # Lower rows sit further out; each strip overlaps the one below.
            y = side * (half_w + overhang) * (1 - f)
            z = wall_top + (rise + overhang * math.tan(pitch)) * f - overhang * math.tan(pitch)
            strip = cube('shingle', (length + 2 * overhang, slope_len / rows * 1.25, 0.018), (0, y, z + 0.01), mat)
            strip.rotation_euler = (side * pitch + rng.uniform(-0.03, 0.03), 0, rng.uniform(-0.015, 0.015))
            parts.append(strip)
    parts.append(cube('ridge', (length + 2 * overhang + 0.01, 0.03, 0.03), (0, 0, wall_top + rise + 0.012), mat))
    return rise


def gable_ends(parts, length, half_w, wall_top, rise, mat):
    for sx in (-1, 1):
        x = sx * length / 2
        verts = [(x, -half_w, wall_top), (x, half_w, wall_top), (x, 0, wall_top + rise)]
        parts.append(mesh_from('gable', verts, [(0, 1, 2) if sx > 0 else (2, 1, 0)], mat))


def build_cottage_a():
    reset()
    rng = random.Random(4)
    stone, beam = material('stone'), material('beam', (0.24, 0.15, 0.09))
    plaster, roof = material('plaster', (0.93, 0.88, 0.76)), material('roof', (0.55, 0.25, 0.15), 0.8)
    window, wood = material('window', (1.0, 0.75, 0.35)), material('wood')
    parts = []
    L, W2, H = 0.34, 0.13, 0.2
    parts.append(cube('base', (L + 0.03, 2 * W2 + 0.03, 0.05), (0, 0, 0.025), stone))
    parts.append(cube('walls', (L, 2 * W2, H), (0, 0, 0.05 + H / 2), plaster))
    top = 0.05 + H
    # Timber frame on the front and back faces, plus corner posts.
    for fy in (-W2 - 0.004, W2 + 0.004):
        for bx in (-L / 2 + 0.01, 0, L / 2 - 0.01):
            parts.append(cube('post', (0.018, 0.01, H), (bx, fy, 0.05 + H / 2), beam))
        parts.append(cube('rail', (L, 0.01, 0.016), (0, fy, 0.05 + H * 0.55), beam))
        parts.append(cube('sill', (L, 0.01, 0.016), (0, fy, top - 0.008), beam))
        brace = cube('brace', (0.012, 0.01, H * 0.6), (-L / 4 - 0.02, fy, 0.05 + H * 0.28), beam)
        brace.rotation_euler = (0, 0.7, 0)
        parts.append(brace)
    rise = gable_roof(parts, L, W2, top, math.radians(42), roof, rng)
    gable_ends(parts, L, W2, top, rise, plaster)
    parts.append(cube('chimney', (0.05, 0.05, 0.2), (L / 2 - 0.07, 0.05, top + rise * 0.6), stone))
    parts.append(cube('door', (0.06, 0.012, 0.11), (L / 4 + 0.02, -W2 - 0.006, 0.05 + 0.055), wood))
    parts.append(cube('window', (0.05, 0.012, 0.045), (-L / 4 + 0.02, -W2 - 0.006, 0.05 + H * 0.72), window))
    parts.append(cube('window_side', (0.012, 0.045, 0.04), (-L / 2 - 0.006, 0, 0.05 + H * 0.6), window))
    parts.append(cube('step', (0.08, 0.03, 0.02), (L / 4 + 0.02, -W2 - 0.03, 0.01), stone))
    finish(parts, uv_scale=4.0, bevel_width=0.004)
    export('cottage_a.glb', parts)


def build_cottage_b():
    reset()
    rng = random.Random(9)
    stone, thatch = material('stone'), material('thatch', (0.72, 0.58, 0.3), 1.0)
    window, wood = material('window', (1.0, 0.75, 0.35)), material('wood')
    beam = material('beam', (0.24, 0.15, 0.09))
    parts = []
    L, W2, H = 0.44, 0.13, 0.17
    parts.append(cube('walls', (L, 2 * W2, H + 0.04), (0, 0, (H + 0.04) / 2), stone))
    top = H + 0.04
    rise = gable_roof(parts, L, W2, top, math.radians(48), thatch, rng, rows=4, overhang=0.045)
    gable_ends(parts, L, W2, top, rise, stone)
    parts.append(cube('chimney', (0.06, 0.06, 0.22), (-L / 2 + 0.07, 0.02, top + rise * 0.55), stone))
    parts.append(cube('door', (0.065, 0.012, 0.12), (-0.06, -W2 - 0.006, 0.06), wood))
    parts.append(cube('lintel', (0.09, 0.016, 0.016), (-0.06, -W2 - 0.008, 0.128), beam))
    for wx in (0.07, 0.16):
        parts.append(cube('window', (0.045, 0.012, 0.045), (wx, -W2 - 0.006, 0.12), window))
        parts.append(cube('shutter', (0.018, 0.01, 0.05), (wx - 0.034, -W2 - 0.008, 0.12), wood))
    # Lean-to woodpile against the side wall.
    for i in range(3):
        parts.append(cylinder('log', 0.012, 0.12, (L / 2 + 0.02, -0.04 + i * 0.026, 0.012), wood, verts=6,
                              rot=(0, math.pi / 2, math.pi / 2)))
    finish(parts, uv_scale=4.0, bevel_width=0.004)
    export('cottage_b.glb', parts)


build_castle()
build_cottage_a()
build_cottage_b()
