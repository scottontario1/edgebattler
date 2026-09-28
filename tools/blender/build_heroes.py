"""Builds Brenna (paladin) and Dreg (berserker) on the universal humanoid (humanoid.py).

Run headless from the project root:
    blender -b --factory-startup -P tools/blender/build_heroes.py
It also runs inside a live Blender over Blender MCP (see common.reset()).

Output: public/models/env/brenna.glb, public/models/env/dreg.glb
Design sheets: design_assets/brenna paladin.png, design_assets/dreg barbarian.png.

Direction: illustrated 2.5D tactics (Fire Emblem / Unicorn Overlord / Triangle Strategy),
heroic ~3.75 heads, NOT chibi toys. Rules applied here:
  * face = one smooth head with flat anime decal polygons (humanoid.face_decals), no eye spheres;
  * hair = layered anime locks with sharp tapered tips over a solid cap, vertex-colour
    gradients (dark roots -> light tips); beards integrate into the jaw and cover the mouth;
  * silhouette first: oversized winged pauldrons, gothic collar and cape (Brenna); jagged
    layered fur mantle and double-bitted axe (Dreg); weapons at ~1.25x;
  * matte cloth/fur/skin, cel-shaded metals (materials are assigned in src/models.js), and an
    inverted-hull ink outline added at load.
Material names are contracts with src/models.js: face, skin, hair, cloth (faction colour),
clothdark, white, steel, gold, iron, brass, leather, fur, furdark, bone, gem, darkwood.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    activate, apply_modifiers, auto_smooth, cone, cube, export, hard, lin, material, mesh_from, paint, reset, rod, sphere, wedge,
)
from humanoid import (  # noqa: E402
    CHEST_Z, HEAD_C, HIERARCHY, HIP_Z, NECK_Z, SHOULDER_Z, WAIST_Z, add_ink, all_nodes, assemble, ball, boot, build_head,
    face_decals, hair_cap, head_pt, limb, loft, make_joints, orient_z, tube, xform,
)

FRONT = Vector((0, -1, 0))
D = math.radians


# --------------------------------------------------------------------------- shared bits

def _shade(hexstr, k):
    v = int(hexstr.lstrip('#'), 16)
    return '#%02x%02x%02x' % tuple(int(((v >> sh) & 255) * k) for sh in (16, 8, 0))


def mats(skin='#f0cdb4', hair='#6b4226', eyes='#4a6a9a', cloth='#1A4FA0'):
    """Shared palette in sRGB hex (rich, saturated). The game re-tints by material name: cloth /
    clothdark by faction, skin / hair / iris / brow per unit look (src/models.js); the values here are
    the defaults, so the GLB looks right in any viewer."""
    def m(n, h, r=0.9):
        return material(n, lin(h), r)
    ink = m('ink', '#050508', 1.0)
    ink.use_backface_culling = True  # inverted hull: the flipped shell must be single-sided to show only its rim
    return {
        'skin': m('skin', skin), 'hair': m('hair', hair), 'fur': m('fur', '#ffffff'),
        'cloth': m('cloth', cloth), 'clothdark': m('clothdark', _shade(cloth, 0.5)), 'white': m('white', '#f2ede0'),
        'steel': m('steel', '#b8c4d6', 0.35), 'gold': m('gold', '#f0b830', 0.35), 'iron': m('iron', '#4a4852', 0.5),
        'brass': m('brass', '#d9a441', 0.4), 'leather': m('leather', '#5C381E'), 'furdark': m('furdark', '#5a3820'),
        'bone': m('bone', '#efe4c8'), 'gem': m('gem', '#3aa8ff', 0.3), 'darkwood': m('darkwood', '#4a2c18'),
        'sclera': m('sclera', '#f7f1ea'), 'iris': m('iris', eyes, 0.5), 'pupil': m('pupil', '#120b16', 0.5),
        'shine': m('shine', '#ffffff', 0.4), 'lash': m('lash', '#1c1218', 0.6), 'brow': m('brow', _shade(hair, 0.6)),
        'lip': m('lip', '#c86a6a'), 'blush': m('blush', '#f09a96'), 'nose': m('nose', _shade(skin, 0.78)),
        'ink': ink,
    }


def snap_n(targets, origin, direction, reach=1.0):
    """Surface point and normal on `targets`, looking along -direction from outside."""
    o, d = Vector(origin), Vector(direction).normalized()
    start = o + d * reach
    dg = bpy.context.evaluated_depsgraph_get()
    best = None
    for t in (targets if isinstance(targets, (list, tuple)) else [targets]):
        inv = t.matrix_world.inverted()
        hit, loc, nrm, _ = t.ray_cast(inv @ start, (inv.to_3x3() @ -d).normalized(), depsgraph=dg)
        if hit:
            w = t.matrix_world @ loc
            n = (inv.transposed().to_3x3() @ nrm).normalized()
            if best is None or (w - start).length < best[0]:
                best = ((w - start).length, w, n)
    return (best[1], best[2]) if best else (o, d)


def front_y(targets, x, z):
    return snap_n(targets, (x, 0, z), FRONT, reach=2.0)[0].y


def panel(name, targets, xs, top, hem, rows, gap, mat_list, zone, flare=0.0, thick=0.012):
    """Cloth/plate panel draped over the front of `targets`; drapes straight below the widest
    point. zone(i, j, cols, rows) -> material index per face."""
    verts, faces, zones = [], [], []
    for x in xs:
        y_prev = None
        for j in range(rows + 1):
            t = j / rows
            z = top(x) + (hem(x) - top(x)) * t
            y = front_y(targets, x, z) - gap
            y = y if y_prev is None else min(y, y_prev)
            y_prev = y
            verts.append((x, y - flare * t * t, z))
    cols = len(xs) - 1
    for i in range(cols):
        for j in range(rows):
            a = i * (rows + 1) + j
            faces.append((a, a + 1, a + rows + 2, a + rows + 1))
            zones.append(zone(i, j, cols, rows))
    o = mesh_from(name, verts, faces, mat_list[0])
    for mm in mat_list[1:]:
        o.data.materials.append(mm)
    for k, z in enumerate(zones):
        o.data.polygons[k].material_index = z
    sol = o.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = thick
    sol.offset = 1
    apply_modifiers(o)
    return auto_smooth(o, 30)


def dome(name, centre, radius, squash, mat, tilt_y, segs=8, rings=3, tilt_x=0.0):
    """Faceted half-shell (pauldron / cop), tilted outward about Y."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings * 2, radius=radius, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context='VERTS')
    bm.to_mesh(o.data)
    bm.free()
    o.scale = (1.1, 1.0, squash)
    o.rotation_euler = (tilt_x, tilt_y, 0)
    o.location = centre
    activate(o)
    bpy.ops.object.transform_apply(scale=True, rotation=True, location=True)
    sol = o.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = 0.014
    apply_modifiers(o)
    o.data.materials.append(mat)
    return auto_smooth(o, 30)


def ring(name, centre, major, minor, mat, rot=(0, 0, 0), segs=16, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=segs, minor_segments=6,
                                     location=(0, 0, 0), rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    o.location = centre
    activate(o)
    bpy.ops.object.transform_apply(scale=True, location=True)
    o.data.materials.append(mat)
    return auto_smooth(o, 30)


def facet(name, radii, loc, mat, segs=10, rings=6):
    o = ball(name, loc, 1.0, mat, scale=radii, segs=segs, rings=rings, smooth=False)
    return auto_smooth(o, 30)


def plate(name, profile, centre, u, v, thick, mat, bevel=0.004):
    """Flat extruded plate from a 2D profile laid out in the plane spanned by u and v."""
    c, u, v = Vector(centre), Vector(u).normalized(), Vector(v).normalized()
    o = mesh_from(name, [tuple(c + u * a + v * b) for a, b in profile], [tuple(range(len(profile)))], mat)
    sol = o.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = thick
    sol.offset = 0
    apply_modifiers(o)
    return auto_smooth(hard(o, bevel), 30)


def blade_plate(name, profile, edge_idx, centre, u, v, thick, base_mat, edge_mat):
    """Beveled blade: a dark body plate plus a slightly thicker steel strip along the cutting
    edge (profile indices edge_idx) so the edge reads as a distinct bright bevel."""
    c, u, v = Vector(centre), Vector(u).normalized(), Vector(v).normalized()
    pts = [c + u * a + v * b for a, b in profile]
    body = mesh_from(name, [tuple(p) for p in pts], [tuple(range(len(pts)))], base_mat)
    sol = body.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = thick
    sol.offset = 0
    apply_modifiers(body)
    ctr = sum(pts, Vector()) / len(pts)
    inner = [p + (ctr - p) * 0.13 for p in pts]
    verts = [tuple(pts[i]) for i in edge_idx] + [tuple(inner[i]) for i in edge_idx]
    n = len(edge_idx)
    faces = [(k, k + 1, n + k + 1, n + k) for k in range(n - 1)]
    strip = mesh_from(name + '_edge', verts, faces, edge_mat)
    s2 = strip.modifiers.new('solid', 'SOLIDIFY')
    s2.thickness = thick * 1.5
    s2.offset = 0
    apply_modifiers(strip)
    return [auto_smooth(hard(body, 0.004), 30), auto_smooth(strip, 30)]


def fist(pos, direction, ls, mat):
    o = ball('fist', pos, 1.0, mat, scale=(0.037 * ls, 0.034 * ls, 0.048 * ls), segs=12, rings=8)
    return orient_z(o, direction)


def cape_sheet(name, top_z, bot_z, top_w, bot_w, y0, y1, mat_list, folds=3, rows=14, cols=16):
    """Cape hanging behind the shoulders: wraps forward at the top corners, flares and folds
    toward a wavy hem. mat_list = [cloth, trim]."""
    verts, faces, zones = [], [], []
    for i in range(cols + 1):
        u = -1 + 2 * i / cols
        for j in range(rows + 1):
            v = j / rows
            w = top_w + (bot_w - top_w) * v ** 0.8
            z = top_z + (bot_z - top_z) * v + (0.03 * math.sin(u * math.pi * 4) * v if j == rows else 0)
            y = y0 - 0.1 * u * u * (1 - v) ** 2 + (y1 - y0) * v ** 1.3 + 0.035 * math.sin(u * math.pi * folds) * v
            verts.append((u * w, y, z))
    for i in range(cols):
        for j in range(rows):
            a = i * (rows + 1) + j
            faces.append((a, a + rows + 1, a + rows + 2, a + 1))
            zones.append(1 if i == 0 or i == cols - 1 or j == rows - 1 else 0)
    o = mesh_from(name, verts, faces, mat_list[0])
    o.data.materials.append(mat_list[1])
    for k, z in enumerate(zones):
        o.data.polygons[k].material_index = z
    sol = o.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = 0.014
    apply_modifiers(o)
    return auto_smooth(o, 30)


def gradient_wedge(name, pts, widths, thick, mat, grad, centre=None, facing=None):
    return wedge(name, pts, widths, thick, mat, centre=centre, facing=facing, grad=grad)


HAIR_GRAD = ((0.45, 0.45, 0.45), (1.0, 1.0, 1.0))  # multiplies the unit's hair colour
FUR_GRAD = ((0.07, 0.04, 0.025), (0.62, 0.43, 0.24))  # dark roots -> warm tan tips


# --------------------------------------------------------------------------- base body

def base_parts(J, S):
    """Skin-level anatomy on the universal humanoid: torso, hips, legs with heeled boots, arms
    with fists, neck, head and ears. S picks materials and body proportions."""
    M = S['M']
    ws, ls, dep = S['ws'], S['ls'], S['depth']
    parts = {n: [] for n, _ in HIERARCHY}
    objs = {}

    ts = [(0.545, 0.085 * ws, 0.06 * dep), (WAIST_Z, 0.076 * ws, 0.055 * dep), (0.64, 0.098 * ws, 0.068 * dep),
          (CHEST_Z, 0.128 * ws, 0.08 * dep), (0.755, 0.14 * ws, 0.076 * dep), (SHOULDER_Z + 0.02, 0.114 * ws, 0.064 * dep),
          (NECK_Z + 0.01, 0.052, 0.046)]
    torso = loft('torso_shell', [((0, -0.004 if z >= 0.65 else 0, z), ru, rv) for z, ru, rv in ts], M[S['torso']], sides=16)
    xform([torso], J['Mt'])
    parts['torso'].append(torso)
    objs['torso'] = torso

    pelvis = loft('pelvis', [((0, 0.004, 0.44), 0.07 * ls, 0.058), ((0, 0.004, HIP_Z), 0.098 * ls * S['hipw'], 0.068),
                             ((0, 0.002, WAIST_Z - 0.008), 0.08 * ls, 0.057)], M[S['pelvis']], sides=16)
    parts['hips'].append(pelvis)
    objs['pelvis'] = pelvis

    for side in ('l', 'r'):
        hip, kn, an, toe = J['hip_' + side], J['knee_' + side], J['ankle_' + side], J['toe_' + side]
        th = limb('thigh', hip, kn, 0.056 * ls, 0.043 * ls, M[S['thigh']])
        parts['thigh_' + side] += th
        objs['thigh_' + side] = th[0]
        dt = (kn - hip).normalized()
        # the shin garment starts above the knee, so trousers / greaves bridge the joint continuously
        parts['shin_' + side] += limb('shin', kn - dt * 0.035, an, 0.045 * ls, 0.029 * ls, M[S['shin']])
        shaft_to = an + (kn - an) * 0.66
        parts['shin_' + side] += boot(side, an, toe, {'boot': M[S['boot']], 'trim': M[S['boot_trim']], 'sole': M['leather']},
                                      pointed=S['pointed'], cuff_r=0.052 * ls, shaft_to=shaft_to)
        sh, el, wr = J['sh_' + side], J['el_' + side], J['wr_' + side]
        du = (el - sh).normalized()
        parts['arm_' + side] += limb('upper', sh, el, 0.042 * ls, 0.036 * ls, M[S['upper']])
        # the forearm garment starts above the elbow: sleeves / vambraces cover it continuously
        parts['fore_' + side] += limb('fore', el - du * 0.032, wr, 0.037 * ls, 0.029 * ls, M[S['fore']])
        df = (wr - el).normalized()
        hand = wr + df * 0.038
        parts['fore_' + side].append(fist(hand, df, ls, M[S['hand']]))
        lat = df.cross(Vector((0, 0, 1))).normalized() * (1 if side == 'l' else -1)
        parts['fore_' + side].append(ball('thumb', hand + lat * 0.03 + FRONT * 0.012 + df * 0.006, 0.014, M[S['hand']], scale=(1, 1, 1.5)))

    neck = tube('neck', J['Mt'] @ Vector((0, 0, 0.72)), Vector((0, -0.004, 0.89)), 0.036 * (ws ** 0.4), 0.033, M['skin'])
    head = build_head(M['skin'], S['jaw'], S['chin'])
    parts['head'] += [head, neck] + face_decals(head, M, S['gaze'])
    for s in (-1, 1):
        parts['head'].append(ball('ear', (s * 0.127, 0.012, 1.02), 0.02, M['skin'], scale=(0.6, 0.8, 1.5), segs=8, rings=6))
    objs['head'] = head
    return parts, objs


def pauldron_set(J, side, s, M, big, shell, rim, wing=True, rows=2, tilt=0.55):
    """Oversized angular shoulder armour on the arm node: dome, layered lames, rim rings, wing."""
    c = J['sh_' + side] + Vector((s * 0.03, 0.0, 0.035))
    out = [dome('pauldron', c, big, 0.55, M[shell], s * tilt),
           ring('pauldron_rim', c + Vector((s * 0.004, 0, -0.002)), big * 1.04, 0.012, M[rim], (0, s * tilt, 0), segs=8, scale=(1.1, 1, 1))]
    for k in range(1, rows + 1):
        ck = c + Vector((s * 0.05 * k, 0, -0.068 * k))
        r = big * (1 - 0.2 * k)
        out.append(dome('lame', ck, r, 0.5, M[shell], s * (tilt + 0.3 * k)))
        out.append(ring('lame_rim', ck, r * 1.04, 0.01, M[rim], (0, s * (tilt + 0.3 * k), 0), segs=8, scale=(1.1, 1, 1)))
    if wing:
        out.append(plate('wing', [(0, 0), (0.05, 0.02), (0.12, 0.14), (0.065, 0.075), (0.035, 0.11), (0.0, 0.045)],
                         c + Vector((s * 0.07, 0.015, 0.045)), (s, 0, 0), (0, 0, 1), 0.02, M[rim]))
    return out


# --------------------------------------------------------------------------- weapons

def sword(G, bd, M, ls=1.0):
    """Elegant longsword at ~1.25x: thin ridged blade, gold crossguard, wrapped grip."""
    bd = Vector(bd).normalized()
    side = bd.cross(FRONT).normalized()
    parts = [ball('pommel', G - bd * 0.085, 0.024, M['gold'], segs=10, rings=6),
             rod('grip', G - bd * 0.07, G + bd * 0.05, 0.016, M['leather'], 8),
             rod('guard', G + bd * 0.055 - side * 0.085, G + bd * 0.055 + side * 0.085, 0.014, M['gold'], 8),
             ball('guard_l', G + bd * 0.055 - side * 0.09, 0.02, M['gold'], segs=8, rings=5),
             ball('guard_r', G + bd * 0.055 + side * 0.09, 0.02, M['gold'], segs=8, rings=5),
             facet('guard_gem', (0.017, 0.012, 0.017), tuple(G + bd * 0.06 + FRONT * 0.012), M['gem'], 8, 5)]
    base = G + bd * 0.075
    path = [base + bd * s for s in (0.0, 0.07, 0.25, 0.41, 0.53)]
    parts.append(wedge('blade', path, [0.054, 0.056, 0.05, 0.038, 0.0], [0.016, 0.022, 0.02, 0.014, 0.0],
                       M['steel'], facing=FRONT))
    parts.append(wedge('fuller', [base + bd * 0.02, base + bd * 0.36], [0.014, 0.008], [0.026, 0.02], M['iron'], facing=FRONT))
    return parts


def scepter(G, sd, M):
    """Ornate blue-gem scepter: dark shaft, gold bands, caged gem and a cross finial."""
    sd = Vector(sd).normalized()
    parts = [rod('shaft', G - sd * 0.22, G + sd * 0.5, 0.016, M['darkwood'], 8)]
    for t in (-0.14, 0.05, 0.22, 0.36):
        parts.append(rod('band', G + sd * (t - 0.012), G + sd * (t + 0.012), 0.022, M['gold'], 8))
    top = G + sd * 0.58
    parts.append(facet('gem', (0.052, 0.052, 0.06), tuple(top), M['gem'], 8, 6))
    for k in range(4):
        off = Vector((math.cos(k * math.pi / 2), math.sin(k * math.pi / 2), 0)) * 0.05
        parts.append(rod('cage', top - sd * 0.07 + off, top + sd * 0.07 + off, 0.008, M['gold'], 6))
    parts.append(ring('cage_lo', tuple(top - sd * 0.065), 0.048, 0.01, M['gold'], segs=10))
    parts.append(rod('cross_v', top + sd * 0.06, top + sd * 0.19, 0.012, M['gold'], 6))
    parts.append(rod('cross_h', top + sd * 0.14 + Vector((-0.045, 0, 0)), top + sd * 0.14 + Vector((0.045, 0, 0)), 0.011, M['gold'], 6))
    return parts


def battleaxe(G, ad, M):
    """Double-bitted battleaxe at ~1.25x: long wrapped haft, iron socket, two crescent bits with
    bright beveled cutting edges, a spike on top."""
    ad = Vector(ad).normalized()
    side = ad.cross(FRONT).normalized()
    parts = [rod('haft', G - ad * 0.24, G + ad * 0.66, 0.025, M['darkwood'], 8)]
    for t in (-0.14, 0.09):
        parts.append(rod('wrap', G + ad * (t - 0.03), G + ad * (t + 0.03), 0.03, M['cloth'], 8))
    hc = G + ad * 0.56
    parts.append(rod('socket', hc - ad * 0.075, hc + ad * 0.075, 0.042, M['iron'], 8))
    sp = cone('spike', 0.028, 0.0, 0.12, tuple(hc + ad * 0.135), M['iron'], verts=6)
    parts.append(orient_z(sp, ad))
    bit = [(0.04, 0.045), (0.11, 0.085), (0.19, 0.17), (0.245, 0.2), (0.262, 0.11), (0.268, 0.0),
           (0.262, -0.11), (0.245, -0.2), (0.19, -0.17), (0.11, -0.085), (0.04, -0.045)]
    for bs in (1, -1):
        prof = [(bs * a, b) for a, b in bit]
        if bs < 0:
            prof.reverse()
        idx = list(range(3, 8)) if bs > 0 else list(range(3, 8))
        parts += blade_plate('bit', prof, idx, hc, side, ad, 0.034, M['iron'], M['steel'])
    return parts


# --------------------------------------------------------------------------- Brenna

def build_brenna():
    reset()
    M = mats('#f0cdb4', '#c9b6e6', '#5a64c8')
    hand_r = Vector((-0.2, -0.2, 0.6))
    hand_l = Vector((0.225, -0.1, 0.55))
    J = make_joints(hand_r, hand_l, ws=1.0)
    S = dict(M=M, gaze='noble', ws=1.0, ls=1.0, depth=1.0, hipw=1.0, jaw=0.94, chin=1.0, pointed=1.0, torso='steel', pelvis='steel',
             thigh='white', shin='white', boot='steel', boot_trim='gold', upper='cloth', fore='steel', hand='steel')
    P, O = base_parts(J, S)
    head, torso, pelvis = O['head'], O['torso'], O['pelvis']
    legs = [O['thigh_l'], O['thigh_r']]

    # belt with a gold buckle, hip tassets
    yb = front_y([torso, pelvis], 0, WAIST_Z + 0.012)
    P['torso'].append(ring('belt', (0, 0.003, WAIST_Z + 0.012), 0.092, 0.017, M['leather'], scale=(1, 0.74, 1)))
    P['torso'].append(hard(cube('buckle', (0.06, 0.02, 0.05), (0, yb - 0.012, WAIST_Z + 0.012), M['gold']), 0.005))
    for s in (-1, 1):
        P['hips'].append(dome('tasset', Vector((s * 0.115, -0.005, HIP_Z - 0.03)), 0.085, 0.8, M['steel'], s * 1.3, segs=8, rings=3))
        P['hips'].append(ring('tasset_rim', Vector((s * 0.115, -0.005, HIP_Z - 0.03)), 0.089, 0.009, M['gold'], (0, s * 1.3, 0), segs=8, scale=(1.1, 1, 1)))

    # white tabard with gold border, sun crest and a blue gothic arch; blue side skirts
    W = 0.105
    targets = [torso, pelvis] + legs
    tab = panel('tabard', targets, [-W + 2 * W * i / 8 for i in range(9)], top=lambda x: 0.735,
                hem=lambda x: 0.235 + 0.09 * abs(x) / W, rows=18, gap=0.014, mat_list=[M['white'], M['gold']], flare=0.04,
                zone=lambda i, j, n, m: 1 if i == 0 or i == n - 1 or j >= m - 1 else 0)
    P['torso'].append(tab)
    arch = panel('arch', [tab], [-0.055 + 0.11 * i / 6 for i in range(7)], top=lambda x: 0.44 - 0.07 * abs(x) / 0.055,
                 hem=lambda x: 0.30, rows=8, gap=0.004, mat_list=[M['cloth'], M['gold']], thick=0.006,
                 zone=lambda i, j, n, m: 1 if i == 0 or i == n - 1 or j == 0 else 0)
    P['torso'].append(arch)
    yc = front_y([tab], 0, 0.62)
    star_pts = [(0, 0, 0)]
    for k in range(16):
        a = math.pi * k / 8
        r = 0.085 if k % 2 == 0 else 0.033
        star_pts.append((math.sin(a) * r, yc - 0.012, 0.62 + math.cos(a) * r))
    sun = mesh_from('sun', [(0, yc - 0.012, 0.62)] + star_pts[1:], [(0, 1 + k, 1 + (k + 1) % 16) for k in range(16)], M['gold'])
    s_sol = sun.modifiers.new('solid', 'SOLIDIFY')
    s_sol.thickness = 0.012
    apply_modifiers(sun)
    P['torso'].append(auto_smooth(sun, 30))
    P['torso'].append(facet('sun_gem', (0.024, 0.014, 0.024), (0, yc - 0.028, 0.62), M['gem'], 8, 5))
    for s in (-1, 1):
        side_skirt = panel('skirt', targets, [s * 0.115 + s * 0.05 * i / 4 for i in range(5)] if s > 0 else [s * 0.115 + s * 0.05 * i / 4 for i in range(5)][::-1],
                           top=lambda x: 0.56, hem=lambda x: 0.27, rows=8, gap=0.022, mat_list=[M['cloth']], zone=lambda *a: 0, flare=0.05)
        P['hips'].append(side_skirt)

    # high gothic collar: an open-front flared band with crenellated gold tips
    verts, faces = [], []
    n_a, n_z = 12, 4
    nk = J['neck']
    for i in range(n_a + 1):
        a = math.radians(-125 + 250 * i / n_a)
        for j in range(n_z + 1):
            t = j / n_z
            r = 0.078 + 0.09 * t ** 1.4
            z = nk.z - 0.01 + 0.16 * t + (0.035 if (i % 2 and j == n_z) else 0)
            verts.append((math.sin(a) * r, nk.y + 0.03 + math.cos(a) * r * 0.9, z))
    for i in range(n_a):
        for j in range(n_z):
            a = i * (n_z + 1) + j
            faces.append((a, a + 1, a + n_z + 2, a + n_z + 1))
    collar = mesh_from('collar', verts, faces, M['steel'])
    collar.data.materials.append(M['gold'])
    for k, f in enumerate(collar.data.polygons):
        if (k % n_z) == n_z - 1:
            f.material_index = 1
    c_sol = collar.modifiers.new('solid', 'SOLIDIFY')
    c_sol.thickness = 0.013
    apply_modifiers(collar)
    P['torso'].append(auto_smooth(collar, 30))
    for s in (-1, 1):  # cape clasps at the collar
        p = J['neck'] + Vector((s * 0.1, -0.05, -0.03))
        P['torso'].append(ball('clasp', p, 0.026, M['gold'], segs=8, rings=5))
        P['torso'].append(facet('clasp_gem', (0.014, 0.01, 0.014), tuple(p + FRONT * 0.02), M['gem'], 8, 5))

    # oversized winged pauldrons
    for s, side in ((1, 'l'), (-1, 'r')):
        P['arm_' + side] += pauldron_set(J, side, s, M, 0.17, 'steel', 'gold', wing=True, rows=2, tilt=0.5)
        # vambrace with gold cuffs and a couter at the elbow
        wr, el = J['wr_' + side], J['el_' + side]
        P['fore_' + side].append(ring('cuff', wr - (wr - el).normalized() * 0.008, 0.036, 0.013, M['gold'], segs=10))
        P['fore_' + side].append(dome('couter', el + FRONT * 0.0, 0.05, 0.6, M['steel'], s * 0.3))

    # long lavender hair: solid cap, centre-parted layered bangs, locks over the pauldrons
    hair = [hair_cap(head, M['hair'], 1.055, lambda x: 1.105 - 0.13 * (abs(x) / 0.12) ** 2, 0.985)]
    hair[0].location = Vector((0, 0, 0))
    paint(hair[0], (0.7, 0.7, 0.7))
    for s in (-1, 1):
        for k, (a0, e0, a1, e1, a2, e2, a3, e3) in enumerate((
                (6, 66, 22, 46, 36, 27, 50, 9),
                (3, 70, 12, 52, 21, 35, 27, 19),
                (26, 62, 46, 42, 68, 20, 88, -6))):
            pts = [head_pt(head, D(s * a0), D(e0), 0.02), head_pt(head, D(s * a1), D(e1), 0.034),
                   head_pt(head, D(s * a2), D(e2), 0.036), head_pt(head, D(s * a3), D(e3), 0.028)]
            w = (0.07, 0.078, 0.07, 0.0) if k < 2 else (0.06, 0.07, 0.066, 0.0)
            hair.append(gradient_wedge('bang', pts, list(w), 0.032, M['hair'], HAIR_GRAD, centre=(0, 0.01, 1.03)))
        # flowing lock from the temple, over the pauldron
        sh = J['sh_l' if s > 0 else 'sh_r']
        pts = [head_pt(head, D(s * 75), D(38), 0.02), head_pt(head, D(s * 100), D(0), 0.045),
               Vector((s * 0.155, 0.03, 0.93)), Vector((s * 0.215, 0.015, 0.905)), Vector((s * 0.29, -0.01, 0.84)),
               Vector((s * 0.335, -0.03, 0.75))]
        hair.append(gradient_wedge('lock', pts, [0.085, 0.095, 0.09, 0.09, 0.08, 0.0], 0.04, M['hair'], HAIR_GRAD, centre=(0, 0.02, 0.9)))
        pts = [head_pt(head, D(s * 60), D(46), 0.02), head_pt(head, D(s * 90), D(10), 0.05),
               Vector((s * 0.15, -0.045, 0.9)), Vector((s * 0.165, -0.085, 0.8)), Vector((s * 0.17, -0.1, 0.7))]
        hair.append(gradient_wedge('lock_front', pts, [0.07, 0.078, 0.07, 0.06, 0.0], 0.034, M['hair'], HAIR_GRAD, centre=(0, 0.0, 0.9)))
    for x, y_out, tip in ((0.0, 0.2, 0.34), (-0.075, 0.185, 0.4), (0.075, 0.185, 0.4), (-0.135, 0.15, 0.5), (0.135, 0.15, 0.5)):
        az = D(180 - math.copysign(1, x if x else 1) * abs(x) * 260)
        pts = [head_pt(head, az, D(40), 0.02), Vector((x * 1.15, 0.14, 0.9)), Vector((x * 1.5, y_out - 0.02, 0.68)),
               Vector((x * 1.7, y_out, 0.5)), Vector((x * 1.7, y_out + 0.01, tip))]
        hair.append(gradient_wedge('back', pts, [0.13, 0.15, 0.15, 0.12, 0.0], 0.05, M['hair'], HAIR_GRAD, centre=(0, 0.02, 0.8)))
    P['head'] += hair

    # royal-blue cape with gold trim
    nk = J['neck']
    P['cape'].append(cape_sheet('cape_mesh', nk.z + 0.005, 0.1, 0.17, 0.37, nk.y + 0.105, nk.y + 0.3, [M['cloth'], M['gold']]))

    # longsword (ready, blade up and out) and the jewelled scepter
    P['fore_r'] += sword(J['wr_r'] + (J['wr_r'] - J['el_r']).normalized() * 0.036, (-0.5, -0.22, 0.83), M)
    P['fore_l'] += scepter(J['wr_l'] + (J['wr_l'] - J['el_l']).normalized() * 0.036, (0.16, -0.04, 1.0), M)

    root = assemble(P, J)
    add_ink(root, M['ink'])
    export('brenna.glb', all_nodes(root), texcoords=False, vcolor=True)
    return root


# --------------------------------------------------------------------------- Dreg

def build_dreg():
    reset()
    M = mats('#d8a98a', '#9c4722', '#5b7088', cloth='#A8231C')
    hand_r = Vector((-0.235, -0.15, 0.65))
    hand_l = Vector((0.235, -0.09, 0.5))
    J = make_joints(hand_r, hand_l, ws=1.3, stance={'twist': 10.0, 'lean': 8.0})
    S = dict(M=M, gaze='fierce', ws=1.3, ls=1.28, depth=1.25, hipw=1.1, jaw=1.14, chin=0.85, pointed=0.0, torso='iron', pelvis='leather',
             thigh='leather', shin='leather', boot='leather', boot_trim='fur', upper='skin', fore='leather', hand='leather')
    P, O = base_parts(J, S)
    head, torso, pelvis = O['head'], O['torso'], O['pelvis']
    legs = [O['thigh_l'], O['thigh_r']]

    # crimson sash-belt with a wolf-head buckle; layered iron breastplate rim
    P['torso'].append(ring('belt', (0, 0.003, WAIST_Z + 0.012), 0.105, 0.022, M['cloth'], scale=(1, 0.78, 1)))
    yb = front_y([torso, pelvis], 0, WAIST_Z + 0.012)
    P['torso'].append(ball('buckle', (0, yb - 0.018, WAIST_Z + 0.012), 0.036, M['brass'], scale=(1, 0.5, 1), segs=10, rings=6))
    for s in (-1, 1):
        P['torso'].append(orient_z(cone('wolf_ear', 0.016, 0.0, 0.04, (s * 0.024, yb - 0.02, WAIST_Z + 0.048), M['brass'], verts=4), (s * 0.3, -0.1, 1)))
    P['torso'].append(ring('plate_rim', (0, 0, 0.745), 0.118 * 1.3, 0.014, M['brass'], scale=(1, 0.66, 1)))
    # crimson baldric across the plate and a fang necklace
    pts = []
    for k in range(9):
        t = k / 8
        x, z = -0.17 + 0.34 * t, 0.755 - 0.27 * t
        pts.append(Vector((x, front_y([torso], x, z) - 0.012, z)))
    P['torso'].append(wedge('baldric', pts, [0.07] * 9, 0.016, M['cloth'], facing=FRONT))
    for k in range(9):
        t = (k - 4) / 4
        x, z = t * 0.12, 0.775 - (1 - t * t) * 0.05
        p = Vector((x, front_y([torso], x, z) - 0.02, z))
        if k % 2 == 0:
            f = cone('fang', 0.014, 0.0, 0.06, tuple(p + Vector((0, -0.004, -0.032))), M['bone'], verts=5)
            f.rotation_euler = (math.pi, 0, 0)
            activate(f)
            bpy.ops.object.transform_apply(rotation=True)
            P['torso'].append(f)
        else:
            P['torso'].append(ball('bead', p, 0.012, M['brass'], segs=6, rings=4))

    # crimson loincloth between leather flaps, dagged hems
    targets = [torso, pelvis] + legs
    for x0, x1, mm, g in ((-0.065, 0.065, 'cloth', 0.034), (-0.17, -0.065, 'leather', 0.022), (0.065, 0.17, 'leather', 0.022)):
        xs = [x0 + (x1 - x0) * i / 4 for i in range(5)]
        P['hips'].append(panel('flap', targets, xs, top=lambda x: 0.53,
                               hem=lambda x, x0=x0, x1=x1: 0.2 + 0.05 * (round((x - x0) / (x1 - x0) * 4) % 2),
                               rows=6, gap=g, mat_list=[M[mm]], zone=lambda *a: 0, flare=0.05, thick=0.012))

    # jagged layered fur mantle (overlapping angular planes, dark roots -> light tips)
    fur = []
    # rows ride above the pauldron domes (tops ~z 0.89) so the fur reads over the armour, and
    # tips drape down over their rims; (z, rx, ry, length, width, count, front gap deg, drop)
    rows = [(0.935, 0.15, 0.115, 0.13, 0.10, 16, 50, 0.55), (0.915, 0.235, 0.14, 0.19, 0.125, 18, 58, 0.75),
            (0.87, 0.31, 0.16, 0.22, 0.13, 16, 72, 0.9), (0.77, 0.25, 0.19, 0.26, 0.13, 11, 118, 1.0)]
    for ri, (z, rx, ry, length, width, n, gap_deg, drop) in enumerate(rows):
        for k in range(n):
            a = 2 * math.pi * (k + 0.5 * (ri % 2)) / n
            if abs(math.atan2(math.sin(a), -math.cos(a))) < D(gap_deg):
                continue
            base = Vector((math.sin(a) * rx * 1.05, 0.02 + math.cos(a) * ry, z + 0.004 * (k % 3)))
            out = Vector((math.sin(a), math.cos(a) * 0.8, 0))
            tip = base + out * length * 0.7 + Vector((0, 0, -length * drop))
            mid = base + out * length * 0.4 + Vector((0, 0, -length * drop * 0.2 + 0.012))
            fur.append(wedge('fur', [base - out * 0.03, mid, tip], [width, width * 1.05, 0.0], width * 0.4, M['fur'],
                             centre=(0, 0.02, z), grad=FUR_GRAD))
    P['torso'] += fur

    for s, side in ((1, 'l'), (-1, 'r')):
        P['arm_' + side] += pauldron_set(J, side, s, M, 0.135, 'iron', 'brass', wing=False, rows=2, tilt=0.6)
        wr, el = J['wr_' + side], J['el_' + side]
        df = (wr - el).normalized()
        P['fore_' + side].append(tube('bracer', el + df * 0.045, wr, 0.043, 0.037, M['iron'], sides=10))
        P['fore_' + side].append(ring('bracer_fur', wr - df * 0.004, 0.04, 0.018, M['fur'], segs=10))
        paint(P['fore_' + side][-1], (0.45, 0.31, 0.18))
    for side in ('l', 'r'):  # knee guards over the leather, fur tops on the boots
        kn = J['knee_' + side]
        P['shin_' + side].append(dome('kneeguard', kn + FRONT * 0.03, 0.058, 0.55, M['iron'], 0, tilt_x=-1.2))

    # wild ginger mane swept back over a solid cap, jaw-integrated beard with braids
    hair = [hair_cap(head, M['hair'], 1.06, lambda x: 1.1 - 0.1 * (abs(x) / 0.12) ** 2, 0.97)]
    paint(hair[0], (0.7, 0.7, 0.7))
    for layer, (n, el0, drop, spread, w) in enumerate(((7, 70, 0.0, 0.05, 0.10), (7, 48, 0.16, 0.1, 0.13), (5, 22, 0.3, 0.14, 0.15))):
        for k in range(n):
            f = -1 + 2 * k / (n - 1)
            az = D(180 + f * 74)
            root = head_pt(head, az, D(el0), 0.02)
            back = Vector((math.sin(az), -math.cos(az), 0))  # outward horizontal
            end_z = 0.98 - drop - 0.12 * (1 - abs(f))
            pts = [root, head_pt(head, az, D(el0 - 25), 0.05),
                   Vector((f * 0.13 * (1 + spread * 3), 0.145 + 0.02 * layer, 0.93 - drop * 0.5)),
                   Vector((f * 0.17 * (1 + spread * 3), 0.17 + 0.03 * layer, end_z - 0.08)),
                   Vector((f * 0.2 * (1 + spread * 3), 0.19 + 0.03 * layer, end_z - 0.2 - 0.05 * layer))]
            hair.append(gradient_wedge('mane', pts, [w, w * 1.1, w * 1.05, w * 0.7, 0.0], 0.05, M['hair'], HAIR_GRAD, centre=(0, 0.03, 0.9)))
    for s in (-1, 1):  # front locks swept back over the temples; sideburn into the beard
        pts = [head_pt(head, D(s * 12), D(66), 0.02), head_pt(head, D(s * 42), D(52), 0.03),
               head_pt(head, D(s * 78), D(30), 0.04), head_pt(head, D(s * 112), D(8), 0.05)]
        hair.append(gradient_wedge('sweep', pts, [0.08, 0.09, 0.085, 0.0], 0.034, M['hair'], HAIR_GRAD, centre=(0, 0.01, 1.03)))
        pts = [head_pt(head, D(s * 88), D(20), 0.02), head_pt(head, D(s * 84), D(-8), 0.05), head_pt(head, D(s * 62), D(-30), 0.05)]
        hair.append(gradient_wedge('sideburn', pts, [0.06, 0.075, 0.0], 0.04, M['hair'], HAIR_GRAD, centre=(0, 0.01, 1.03)))
    P['head'] += hair

    bst = [((0, -0.045, 0.99), 0.108, 0.07), ((0, -0.056, 0.93), 0.12, 0.078), ((0, -0.068, 0.87), 0.118, 0.085),
           ((0, -0.085, 0.80), 0.104, 0.09), ((0, -0.09, 0.73), 0.078, 0.078), ((0, -0.09, 0.68), 0.032, 0.04)]
    beard = loft('beard', bst, M['hair'], sides=16, subsurf=1)
    paint(beard, (0.8, 0.8, 0.8))
    P['head'].append(beard)
    # layered strands over the beard front (tapered, dark roots -> light tips)
    for x, z0, z1 in ((-0.075, 0.95, 0.74), (-0.04, 0.93, 0.7), (0.0, 0.93, 0.68), (0.04, 0.93, 0.7), (0.075, 0.95, 0.74)):
        pts = []
        for f in (0.0, 0.35, 0.7, 1.0):
            z = z0 + (z1 - z0) * f
            xx = x * (1.0 - 0.45 * f)
            pts.append(Vector((xx, snap_n([beard], (xx, 0, z), FRONT, reach=2.0)[0].y - 0.006, z)))
        P['head'].append(gradient_wedge('strand', pts, [0.05, 0.056, 0.046, 0.0], 0.022, M['hair'], HAIR_GRAD, facing=FRONT))
    for s in (-1, 1):
        a = head_pt(head, D(s * 12), D(-22), 0.01)
        mus = gradient_wedge('mustache', [a, a + Vector((s * 0.06, -0.012, -0.03)), a + Vector((s * 0.115, 0.005, -0.09))],
                             [0.065, 0.06, 0.0], 0.04, M['hair'], HAIR_GRAD, facing=FRONT)
        P['head'].append(mus)
    # three chunky braids hanging from the beard: interlocked slanted links, tapering, bone/brass ties
    for x, links, tie in ((-0.058, 4, 'bone'), (0.0, 5, 'brass'), (0.058, 4, 'bone')):
        p = Vector((x, -0.152, 0.715))
        for b in range(links):
            k = 1.0 - 0.09 * b
            p = p + Vector((0.0, -0.002, -0.036 * k))
            link = sphere('braid', (0.026 * k, 0.02 * k, 0.034 * k), tuple(p), M['hair'], segs=8, rings=5, rot=(0, 0.5 * (-1) ** b, 0))
            paint(link, (0.8, 0.8, 0.8))
            P['head'].append(link)
        P['head'].append(ring('tie', p + Vector((0, 0, -0.024)), 0.022, 0.012, M[tie], segs=8))
        P['head'].append(gradient_wedge('braid_tip', [p + Vector((0, 0, -0.03)), p + Vector((0, -0.002, -0.06)), p + Vector((0, 0, -0.1))],
                                        [0.045, 0.04, 0.0], 0.026, M['hair'], HAIR_GRAD, facing=FRONT))

    P['fore_r'] += battleaxe(J['wr_r'] + (J['wr_r'] - J['el_r']).normalized() * 0.04, (-0.3, -0.16, 0.94), M)

    root = assemble(P, J)
    add_ink(root, M['ink'])
    export('dreg.glb', all_nodes(root), texcoords=False, vcolor=True)
    return root


if __name__ == '__main__':
    build_brenna()
    build_dreg()
