"""Builds the neutral, recruitable troop classes on the universal humanoid (humanoid.py).

Run headless from the project root:
    blender -b --factory-startup -P tools/blender/build_recruits.py
It also runs inside a live Blender over Blender MCP (see common.reset()).

Output (public/models/env): pikeman.glb, archer.glb, cavalier.glb
These are unnamed troops that either army fields or recruits: the faction colour comes from the
`cloth` / `clothdark` materials at load, skin / hair / iris from each unit's `look`, so the same
GLB serves both sides and any recruit. Generic on purpose: a little plainer than the named
heroes (build_heroes.py, whose helpers are reused here) but the same illustrated 2.5D style,
proportions, matte materials and cel-shaded metals.

The cavalier is exported as the seated rider only (legs astride, stirrup height 0.14). The game
sits it on public/models/env/horse.glb (see buildModel in src/models.js); the rider's crotch is
at z=0.44, and the horse saddle top is 0.4 * HORSE_SCALE.
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    activate, apply_modifiers, cone, cube, export, hard, mesh_from, paint, reset, rod, wedge,
)
from humanoid import add_ink, loft, xform  # noqa: E402
from humanoid import (  # noqa: E402
    HIP_Z, NECK_Z, SHOULDER_Z, WAIST_Z, all_nodes, assemble, ball, hair_cap, head_pt, make_joints, orient_z, tube,
)
from build_heroes import (  # noqa: E402
    D, FRONT, HAIR_GRAD, base_parts, cape_sheet, dome, facet, front_y, gradient_wedge, mats, panel, pauldron_set, plate,
    ring, snap_n,
)


def V(*a):
    return Vector(a)


def tuft(name, pts, widths, thick, M, centre=(0, 0.01, 1.03)):
    return gradient_wedge(name, pts, widths, thick, M['hair'], HAIR_GRAD, centre=centre)


def short_hair(head, M, fringe=False):
    """Hair that shows under a helm or hood: side tufts by the ears, a nape mass, optional fringe."""
    out = []
    for s in (-1, 1):
        pts = [head_pt(head, D(s * 92), D(20), 0.02), head_pt(head, D(s * 100), D(-4), 0.035), head_pt(head, D(s * 112), D(-26), 0.03)]
        out.append(tuft('tuft', pts, [0.075, 0.08, 0.0], 0.032, M))
        if fringe:
            for k, (a0, e0, a1, e1) in enumerate(((8, 62, 26, 30), (4, 66, 14, 34))):
                pts = [head_pt(head, D(s * a0), D(e0), 0.02), head_pt(head, D(s * (a0 + a1) / 2), D((e0 + e1) / 2 + 6), 0.035),
                       head_pt(head, D(s * a1), D(e1), 0.03)]
                out.append(tuft('fringe', pts, [0.07, 0.075, 0.0], 0.03, M))
    for x in (-0.06, 0.0, 0.06):
        pts = [head_pt(head, D(180 + x * 330), D(12), 0.02), Vector((x * 1.25, 0.125, 0.94)), Vector((x * 1.35, 0.135, 0.86))]
        out.append(tuft('nape', pts, [0.09, 0.09, 0.0], 0.04, M, centre=(0, 0.02, 0.95)))
    return out


def faction_ribbon(name, pts, widths, M, normal):
    return wedge(name, pts, widths, [w * 0.35 for w in widths], M['cloth'], facing=normal)


# --------------------------------------------------------------------------- weapons

def pike(Gr, Gl, M):
    """Long pike held in both hands: wrapped ash shaft, steel leaf head with langets, pennant."""
    d = (Gl - Gr).normalized()
    butt, neck = Gr - d * 0.42, Gr + d * 1.06
    parts = [rod('shaft', butt, neck, 0.017, M['darkwood'], 8), ball('butt', butt, 0.024, M['steel'], segs=8, rings=5)]
    for t in (-0.05, 0.05):
        parts.append(rod('grip', Gr + d * (t - 0.05), Gr + d * (t + 0.05), 0.022, M['leather'], 8))
    for off in (-0.02, 0.02):
        side = d.cross(FRONT).normalized()
        parts.append(rod('langet', neck - d * 0.18 + side * off, neck + d * 0.01 + side * off, 0.006, M['steel'], 6))
    parts.append(rod('socket', neck - d * 0.05, neck + d * 0.04, 0.026, M['steel'], 8))
    path = [neck + d * s for s in (0.03, 0.08, 0.17, 0.27)]
    parts.append(wedge('head', path, [0.03, 0.062, 0.056, 0.0], [0.022, 0.03, 0.024, 0.0], M['steel'], facing=FRONT))
    side = d.cross(FRONT).normalized()
    p0 = neck - d * 0.06
    parts.append(faction_ribbon('pennant', [p0, p0 + side * 0.11 - d * 0.03, p0 + side * 0.24 - d * 0.1, p0 + side * 0.35 - d * 0.2],
                                [0.09, 0.085, 0.06, 0.0], M, side.cross(d).normalized()))
    return parts


def longbow(G, up, fwd, M, length=1.12):
    """Recurve longbow: tapered wooden limbs bowed away from the archer, string on the near side."""
    up, fwd = Vector(up).normalized(), Vector(fwd).normalized()
    n = 12
    pts = [G + up * (length / 2 * (-1 + 2 * k / n)) + fwd * (0.12 * (1 - (-1 + 2 * k / n) ** 2)) for k in range(n + 1)]
    parts = []
    for k in range(n):
        t0, t1 = abs(-1 + 2 * k / n), abs(-1 + 2 * (k + 1) / n)
        parts.append(tube('limb', pts[k], pts[k + 1], 0.019 * (1 - 0.6 * t0), 0.019 * (1 - 0.6 * t1), M['darkwood'], sides=8))
    parts.append(rod('grip', G - up * 0.06, G + up * 0.06, 0.024, M['leather'], 8))
    parts.append(rod('string', pts[0], pts[-1], 0.0035, M['bone'], 4))
    for p in (pts[0], pts[-1]):
        parts.append(ball('nock', p, 0.014, M['brass'], segs=6, rings=4))
    return parts


def arrow(nock, direction, M, length=0.6):
    d = Vector(direction).normalized()
    tip = nock + d * length
    side = d.cross(FRONT).normalized()
    parts = [rod('arrow', nock, tip, 0.0055, M['darkwood'], 5), orient_z(cone('head', 0.014, 0.0, 0.04, tuple(tip + d * 0.02), M['steel'], verts=6), d)]
    for k in range(3):
        v = (side * math.cos(k * 2.09) + FRONT.cross(d).normalized() * math.sin(k * 2.09)) * 0.026
        parts.append(wedge('fletch', [nock + d * 0.02 + v * 0.3, nock + d * 0.06 + v, nock + d * 0.1 + v * 0.5],
                           [0.02, 0.022, 0.0], 0.006, M['white'], facing=side))
    return parts


def lance(G, d, M):
    """Cavalry lance: long shaft, vamplate hand guard, steel head, swallow-tail pennant."""
    d = Vector(d).normalized()
    butt, neck = G - d * 0.46, G + d * 0.98
    side = d.cross(FRONT).normalized()
    parts = [rod('shaft', butt, neck, 0.02, M['darkwood'], 8), ball('butt', butt, 0.028, M['gold'], segs=8, rings=5),
             orient_z(cone('vamplate', 0.075, 0.03, 0.06, tuple(G + d * 0.07), M['steel'], verts=12), d),
             rod('grip', G - d * 0.12, G + d * 0.02, 0.026, M['leather'], 8), rod('socket', neck - d * 0.05, neck + d * 0.04, 0.03, M['steel'], 8)]
    parts.append(wedge('head', [neck + d * s for s in (0.03, 0.09, 0.2, 0.32)], [0.034, 0.068, 0.06, 0.0], [0.024, 0.034, 0.026, 0.0], M['steel'], facing=FRONT))
    p0 = neck - d * 0.05
    n = side.cross(d).normalized()
    for k, dy in enumerate((0.0, -0.055)):
        parts.append(faction_ribbon('pennant', [p0 + d * dy, p0 + side * 0.12 + d * (dy - 0.03), p0 + side * 0.26 + d * (dy - 0.09), p0 + side * 0.36 + d * (dy - 0.14)],
                                    [0.085, 0.08, 0.055, 0.0], M, n))
    return parts


def heater_shield(c, n, M):
    """Heater shield facing along n: faction field, gold rim, steel boss and a white bar."""
    n = Vector(n).normalized()
    u = Vector((n.y, -n.x, 0)).normalized()
    v = Vector((0, 0, 1))
    prof = [(-0.115, 0.15), (0.115, 0.15), (0.125, 0.02), (0.075, -0.1), (0.0, -0.19), (-0.075, -0.1), (-0.125, 0.02)]
    rim = plate('rim', [(a * 1.1, b * 1.06 - 0.005) for a, b in prof], c - n * 0.006, u, v, 0.02, M['gold'], 0.004)
    field = plate('field', prof, c + n * 0.008, u, v, 0.022, M['cloth'], 0.004)
    bar = plate('bar', [(-0.115, 0.05), (0.115, 0.05), (0.118, 0.0), (-0.118, 0.0)], c + n * 0.021, u, v, 0.008, M['white'], 0.002)
    boss = facet('boss', (0.036, 0.02, 0.036), tuple(c + n * 0.032 + v * 0.02), M['steel'], 10, 6)
    return [rim, field, bar, boss]


# --------------------------------------------------------------------------- helmets

def kettle_helm(head, M, plume=True):
    """Sallet / kettle hat as ONE mesh: a lofted dome that flows straight into a swept brim (wider
    at the back as a neck shade), closed with a thick rim, plus a comb ridge, nasal bar and band."""
    prof = [(1.198, 0.02, 0.022, 0.012), (1.182, 0.078, 0.082, 0.012), (1.152, 0.128, 0.13, 0.011), (1.117, 0.149, 0.149, 0.01),
            (1.092, 0.154, 0.154, 0.01), (1.085, 0.163, 0.176, 0.014), (1.079, 0.176, 0.196, 0.018), (1.072, 0.179, 0.2, 0.019)]
    shell = loft('kettle', [((0, cy, z), ru, rv) for z, ru, rv, cy in prof], M['steel'], sides=28, caps=(True, False))
    sol = shell.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = 0.014
    sol.offset = -1
    apply_modifiers(shell)
    parts = [shell,
             wedge('comb', [V(0, -0.09, 1.16), V(0, -0.02, 1.207), V(0, 0.06, 1.2), V(0, 0.12, 1.16)], [0.016, 0.022, 0.02, 0.014], 0.026, M['steel'],
                   facing=V(1, 0, 0)),
             hard(cube('nasal', (0.016, 0.008, 0.115), (0, -0.128, 1.012), M['steel']), 0.003),
             ring('helm_band', (0, 0.013, 1.096), 0.15, 0.008, M['brass'], segs=24, scale=(1, 1.06, 1))]
    if plume:
        for k, w in enumerate((0.06, 0.05)):
            parts.append(wedge('plume', [V(0, 0.0, 1.205), V(0, 0.05 + 0.01 * k, 1.285), V(0, 0.14, 1.27 - 0.02 * k), V(0, 0.23, 1.15 - 0.05 * k)],
                               [w, w * 1.3, w, 0.0], w * 0.5, M['cloth'], facing=V(1, 0, 0)))
    return parts


def rein(a, b, M, sag=0.035):
    """Leather rein from a to b with a little droop (two rods through a sagging midpoint)."""
    a, b = Vector(a), Vector(b)
    mid = (a + b) / 2 + V(0, 0, -sag)
    return [rod('rein', a, mid, 0.0042, M['leather'], 5), rod('rein', mid, b, 0.0042, M['leather'], 5),
            ball('bit_ring', b, 0.011, M['brass'], segs=6, rings=4)]


# --------------------------------------------------------------------------- Pikeman

def build_pikeman():
    reset()
    M = mats('#e8b995', '#6b4226', '#4a6a9a')
    J = make_joints(V(-0.03, -0.16, 0.55), V(-0.08, -0.23, 0.78), ws=1.05, stance={'twist': 6.0, 'lean': 5.0})
    S = dict(M=M, gaze='steady', ws=1.05, ls=1.1, depth=1.1, hipw=1.0, jaw=1.0, chin=1.0, pointed=0.0, torso='steel', pelvis='leather',
             thigh='clothdark', shin='clothdark', boot='leather', boot_trim='steel', upper='iron', fore='steel', hand='leather')
    P, O = base_parts(J, S)
    head, torso, pelvis = O['head'], O['torso'], O['pelvis']
    targets = [torso, pelvis, O['thigh_l'], O['thigh_r']]

    yb = front_y([torso, pelvis], 0, WAIST_Z + 0.012)
    P['torso'].append(ring('belt', (0, 0.003, WAIST_Z + 0.012), 0.098, 0.018, M['leather'], scale=(1, 0.76, 1)))
    P['torso'].append(hard(cube('buckle', (0.05, 0.018, 0.045), (0, yb - 0.012, WAIST_Z + 0.012), M['brass']), 0.004))
    W = 0.125
    P['torso'].append(panel('surcoat', targets, [-W + 2 * W * i / 8 for i in range(9)], top=lambda x: 0.735,
                            hem=lambda x: 0.3 + 0.05 * abs(x) / W, rows=16, gap=0.016, mat_list=[M['cloth'], M['white']], flare=0.05,
                            zone=lambda i, j, n, m: 1 if i == 0 or i == n - 1 or j >= m - 1 else 0))
    for s in (-1, 1):
        xs = [s * 0.12 + s * 0.05 * i / 4 for i in range(5)]
        P['hips'].append(panel('skirt', targets, xs if s > 0 else xs[::-1], top=lambda x: 0.56, hem=lambda x: 0.33, rows=6, gap=0.022,
                               mat_list=[M['cloth']], zone=lambda *a: 0, flare=0.04))
    P['torso'].append(ring('gorget', J['neck'] + V(0, 0.0, -0.045), 0.075, 0.022, M['steel'], scale=(1, 0.86, 0.9)))
    for s, side in ((1, 'l'), (-1, 'r')):
        P['arm_' + side] += pauldron_set(J, side, s, M, 0.115, 'steel', 'brass', wing=False, rows=1, tilt=0.5)
        wr, el = J['wr_' + side], J['el_' + side]
        P['fore_' + side].append(ring('cuff', wr - (wr - el).normalized() * 0.01, 0.036, 0.012, M['brass'], segs=10))
    for side in ('l', 'r'):
        P['shin_' + side].append(dome('cop', J['knee_' + side] + FRONT * 0.03, 0.05, 0.55, M['steel'], 0, tilt_x=-1.2))
    P['head'] += kettle_helm(head, M) + short_hair(head, M)
    Gr = J['wr_r'] + (J['wr_r'] - J['el_r']).normalized() * 0.036
    Gl = J['wr_l'] + (J['wr_l'] - J['el_l']).normalized() * 0.036
    P['fore_r'] += pike(Gr, Gl, M)
    root = assemble(P, J)
    add_ink(root, M['ink'])
    export('pikeman.glb', all_nodes(root), texcoords=False, vcolor=True)
    return root


# --------------------------------------------------------------------------- Archer

def build_archer():
    reset()
    M = mats('#f0cdb4', '#b5462b', '#3f7a4a')
    J = make_joints(V(-0.03, -0.2, 0.67), V(0.2, -0.3, 0.7), ws=0.95,
                    stance={'twist': -18.0, 'lean': 3.0, 'ankle_l': (0.11, -0.085), 'ankle_r': (-0.115, 0.05),
                            'toe_l': (0.45, -0.9), 'toe_r': (-0.8, -0.6)})
    S = dict(M=M, gaze='keen', ws=0.95, ls=0.92, depth=0.95, hipw=0.95, jaw=0.94, chin=1.0, pointed=0.3, torso='white', pelvis='leather',
             thigh='clothdark', shin='leather', boot='leather', boot_trim='clothdark', upper='white', fore='leather', hand='leather')
    P, O = base_parts(J, S)
    head, torso, pelvis = O['head'], O['torso'], O['pelvis']

    P['torso'].append(ring('belt', (0, 0.003, WAIST_Z + 0.01), 0.088, 0.017, M['clothdark'], scale=(1, 0.75, 1)))
    P['torso'].append(ring('collar', J['neck'] + V(0, 0.0, -0.04), 0.072, 0.02, M['leather'], scale=(1, 0.86, 0.85)))
    Wj = 0.105
    P['torso'].append(panel('jerkin', [torso, pelvis], [-Wj + 2 * Wj * i / 8 for i in range(9)], top=lambda x: 0.74,
                            hem=lambda x: 0.5 + 0.05 * abs(x) / Wj, rows=8, gap=0.012, mat_list=[M['leather'], M['darkwood']], flare=0.03,
                            zone=lambda i, j, n, m: 1 if i == 0 or i == n - 1 or j >= m - 1 else 0))
    # jerkin lacing and a quiver strap across the chest
    pts = []
    for k in range(9):
        t = k / 8
        x, z = -0.13 + 0.26 * t, 0.755 - 0.2 * t
        pts.append(Vector((x, front_y([torso], x, z) - 0.012, z)))
    P['torso'].append(wedge('strap', pts, [0.036] * 9, 0.014, M['darkwood'], facing=FRONT))
    for z in (0.7, 0.66, 0.62):
        y = front_y([torso], 0, z)
        P['torso'].append(hard(cube('lace', (0.05, 0.006, 0.006), (0, y - 0.01, z), M['bone']), 0.001))
    for side in ('l', 'r'):
        wr, el = J['wr_' + side], J['el_' + side]
        P['fore_' + side].append(ring('cuff', wr - (wr - el).normalized() * 0.012, 0.031, 0.012, M['clothdark'], segs=10))
        d = (wr - el).normalized()
        for t in (0.3, 0.55, 0.8):  # leather vambrace: buckled straps down the forearm
            c = el + (wr - el) * t
            rr = 0.036 * 0.92 * (1 - 0.22 * t) + 0.007
            P['fore_' + side].append(tube('strap', c - d * 0.009, c + d * 0.009, rr, rr, M['darkwood'], sides=10))
            P['fore_' + side].append(hard(cube('buckle', (0.012, 0.008, 0.012), tuple(c + FRONT * (rr + 0.002)), M['brass']), 0.002))

    # hood, cowl and short cloak in the faction colour
    hood = hair_cap(head, M['cloth'], 1.065, lambda x: 1.085 - 0.16 * min(1.0, (abs(x) / 0.08) ** 2), 0.88, thick=0.018, from_idx=1)
    xform([hood], Matrix.Translation((0, 0.016, 0.004)))  # sit back so the brow stays clear
    paint(hood, (0.9, 0.9, 0.9))
    P['head'].append(hood)
    P['head'].append(wedge('hood_tail', [V(0, 0.12, 1.06), V(0, 0.17, 0.99), V(0, 0.19, 0.93), V(0, 0.19, 0.88)], [0.12, 0.1, 0.07, 0.0], 0.045,
                           M['cloth'], facing=V(1, 0, 0)))
    P['head'] += short_hair(head, M, fringe=True)
    nk = J['neck']
    P['cape'].append(cape_sheet('mantle', nk.z + 0.0, 0.5, 0.14, 0.22, nk.y + 0.095, nk.y + 0.16, [M['cloth'], M['clothdark']], folds=2))

    # quiver on the back with a bundle of fletched arrows (big faction / white feathers)
    qa, qb = V(-0.11, 0.152, 0.47), V(-0.02, 0.124, 0.8)
    P['torso'].append(tube('quiver', qa, qb, 0.036, 0.046, M['leather'], sides=12))
    P['torso'].append(ring('quiver_rim', tuple(qb), 0.047, 0.009, M['brass'], segs=12))
    P['torso'].append(ring('quiver_band', tuple(qa + (qb - qa) * 0.4), 0.043, 0.007, M['darkwood'], segs=12))
    d = (qb - qa).normalized()
    for k, (off, tilt) in enumerate(((-0.024, -0.05), (-0.008, 0.0), (0.01, 0.04), (0.026, 0.09), (0.0, 0.0))):
        base = qb + V(off, 0.006 * (k % 2), 0.0)
        tip = base + d * 0.19 + V(tilt, 0.0, 0.0)
        P['torso'].append(rod('q_arrow', base - d * 0.03, tip, 0.006, M['darkwood'], 5))
        for j, m in enumerate((M['cloth'], M['white'])):
            P['torso'].append(wedge('q_fletch', [tip - d * 0.06, tip + d * 0.02, tip + d * 0.11], [0.05, 0.058, 0.0], 0.008, m,
                                    facing=V(1 if j == 0 else 0, 0 if j == 0 else 1, 0)))

    # bow in the left hand, arrow nocked on the string hand
    Gl = J['wr_l'] + (J['wr_l'] - J['el_l']).normalized() * 0.036
    Gr = J['wr_r'] + (J['wr_r'] - J['el_r']).normalized() * 0.03
    P['fore_l'] += longbow(Gl, V(0.06, 0.0, 1.0), V(0.0, -1.0, 0.0), M)
    P['fore_r'] += arrow(Gr, (Gl - Gr) + V(0.0, -0.02, 0.0), M, 0.62)
    root = assemble(P, J)
    add_ink(root, M['ink'])
    export('archer.glb', all_nodes(root), texcoords=False, vcolor=True)
    return root


# --------------------------------------------------------------------------- Cavalier

# Seated astride: knees bent forward toward the stirrups, feet a touch behind the knees.
CAV_STANCE = {'twist': 3.0, 'lean': 2.0, 'hip_x': 0.08, 'ankle_r': (-0.235, 0.05), 'ankle_l': (0.235, 0.05),
              'toe_r': (0.0, -1.0), 'toe_l': (0.0, -1.0), 'ankle_z': 0.12, 'knee_out': 0.35}
# Mount layout, kept in sync with HORSE_SCALE / HERO_SCALE / HORSE_SADDLE_Y in src/models.js.
HORSE_SCALE, RIDER_SCALE, SADDLE_Y, RIDER_CROTCH = 1.7, 1.1, 0.4, 0.44
RIDER_DZ = SADDLE_Y * HORSE_SCALE - RIDER_CROTCH * RIDER_SCALE


def bit_point(side):
    """Horse bit ring (horse-local (+-0.045, -0.44, 0.47)) expressed in the rider's model space."""
    return V(side * 0.045 * HORSE_SCALE / RIDER_SCALE, -0.44 * HORSE_SCALE / RIDER_SCALE, (0.47 * HORSE_SCALE - RIDER_DZ) / RIDER_SCALE)


def build_cavalier():
    reset()
    M = mats('#d9a57c', '#3a2a1e', '#5a7a3a')
    J = make_joints(V(-0.18, -0.14, 0.6), V(0.1, -0.24, 0.58), ws=1.08, stance=CAV_STANCE)
    S = dict(M=M, gaze='steady', ws=1.08, ls=1.05, depth=1.05, hipw=1.0, jaw=1.0, chin=1.0, pointed=0.5, torso='steel', pelvis='steel',
             thigh='steel', shin='steel', boot='leather', boot_trim='gold', upper='iron', fore='steel', hand='steel')
    P, O = base_parts(J, S)
    head, torso, pelvis = O['head'], O['torso'], O['pelvis']
    targets = [torso, pelvis]

    P['torso'].append(ring('belt', (0, 0.003, WAIST_Z + 0.012), 0.096, 0.02, M['leather'], scale=(1, 0.76, 1)))
    W = 0.12
    P['torso'].append(panel('surcoat', targets, [-W + 2 * W * i / 8 for i in range(9)], top=lambda x: 0.74,
                            hem=lambda x: 0.47 + 0.04 * abs(x) / W, rows=10, gap=0.016, mat_list=[M['cloth'], M['gold']], flare=0.04,
                            zone=lambda i, j, n, m: 1 if i == 0 or i == n - 1 or j >= m - 1 else 0))
    yc = front_y([torso], 0, 0.66)
    P['torso'].append(facet('crest', (0.03, 0.012, 0.04), (0, yc - 0.024, 0.66), M['gold'], 8, 5))
    P['torso'].append(ring('gorget', J['neck'] + V(0, 0.0, -0.045), 0.076, 0.022, M['steel'], scale=(1, 0.86, 0.9)))
    for s, side in ((1, 'l'), (-1, 'r')):
        P['arm_' + side] += pauldron_set(J, side, s, M, 0.13, 'steel', 'gold', wing=False, rows=2, tilt=0.5)
        wr, el = J['wr_' + side], J['el_' + side]
        P['fore_' + side].append(ring('cuff', wr - (wr - el).normalized() * 0.01, 0.037, 0.012, M['gold'], segs=10))
    for side in ('l', 'r'):
        kn = J['knee_' + side]
        P['shin_' + side].append(dome('cop', kn + FRONT * 0.03, 0.05, 0.55, M['steel'], 0, tilt_x=-1.2))

    # open-faced sallet with a tall faction plume and a gold browband
    P['head'] += kettle_helm(head, M, plume=False)
    for s in (-1, 1):  # cheek plates
        P['head'].append(plate('cheek', [(0, 0.06), (0.05, 0.04), (0.06, -0.04), (0.02, -0.09), (-0.03, -0.03)],
                               head_pt(head, D(s * 78), D(-14), 0.012), V(0.0, 1.0, 0.0), V(0, 0, 1), 0.012, M['steel'], 0.003))
    for k, w in enumerate((0.075, 0.06)):
        P['head'].append(wedge('plume', [V(0, 0.0, 1.2), V(0, 0.06 + 0.01 * k, 1.3), V(0, 0.17, 1.3 - 0.02 * k), V(0, 0.29, 1.16 - 0.06 * k)],
                               [w, w * 1.3, w, 0.0], w * 0.5, M['cloth'], facing=V(1, 0, 0)))
    P['head'] += short_hair(head, M)
    nk = J['neck']
    P['cape'].append(cape_sheet('cape_mesh', nk.z + 0.005, 0.12, 0.16, 0.3, nk.y + 0.1, nk.y + 0.34, [M['cloth'], M['gold']], folds=3))

    Gr = J['wr_r'] + (J['wr_r'] - J['el_r']).normalized() * 0.036
    P['fore_r'] += lance(Gr, V(-0.1, -0.3, 0.95), M)
    el, wr = J['el_l'], J['wr_l']
    grip_l = wr + (wr - el) * 0.0
    P['fore_l'] += rein(grip_l, bit_point(1), M) + rein(grip_l, bit_point(-1), M, 0.05)
    P['fore_l'] += heater_shield(el + (wr - el) * 0.5 + V(0.1, -0.075, 0.03), V(0.6, -0.8, 0.0), M)
    root = assemble(P, J)
    add_ink(root, M['ink'])
    export('cavalier.glb', all_nodes(root), texcoords=False, vcolor=True)
    return root


if __name__ == '__main__':
    build_pikeman()
    build_archer()
    build_cavalier()
