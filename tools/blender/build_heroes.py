"""Builds Brenna (paladin) and Dreg (berserker) from scratch as stylised chibi miniatures.

Run headless from the project root:
    blender -b --factory-startup -P tools/blender/build_heroes.py
It also runs inside a live Blender over Blender MCP (see common.reset()).

Output: public/models/env/brenna.glb, public/models/env/dreg.glb
Design sheets: design_assets/brenna paladin.png, design_assets/dreg barbarian.png.

Style rules (tactics miniature, read from a ~40 degree overhead camera):
  * Built in game units, feet on Z=0, facing -Y (+Z toward the camera in three.js).
    ~1.15 tall: head 35%, torso 25%, legs 40%; chunky limbs, mitten hands, big boots.
  * Hair = a solid cap in the hair colour plus a few large faceted wedge clumps and bangs
    framing the face (common.wedge), never thin strands; beards are one solid mass with
    chunky braids.
  * Macro silhouette over micro detail: oversized shoulders, collar/cape or fur mantle and
    weapons at ~1.4x scale; colour-blocked materials, gold/brass only on rims.
  * Shading: smooth with 30 degree auto-smooth so faceted edges stay crisp.

Node hierarchy (animated procedurally in src/models.js):
  hero -> torso (pivot at the waist) -> head (neck), arm_l / arm_r (shoulders), cape (collar)
Material names map to game materials in src/models.js: skin, hair, eye (iris, from
look.eyes), pupil, shine, blush and the gear set (steel, gold, gem, white, cloth = faction
colour, leather, iron, fur, furdark, brass, bone, darkwood).
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    activate, apply_modifiers, auto_smooth, cone, cube, cylinder, export, hard, join, material, mesh_from, reset,
    rod, skin_chain, sphere, wedge,
)

FRONT = Vector((0, -1, 0))


# --------------------------------------------------------------------------- helpers

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


def orient(o, normal, base=FRONT):
    """Rotate object so its local `base` axis points along `normal`, and apply."""
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector(base).rotation_difference(Vector(normal).normalized())
    activate(o)
    bpy.ops.object.transform_apply(rotation=True)
    return o


def facet_sphere(name, radii, loc, mat, segs=10, rings=6):
    o = sphere(name, radii, loc, mat, segs=segs, rings=rings, smooth=False)
    return auto_smooth(o, 30)


def head_mesh(name, centre, radii, jaw, mat):
    """Chibi head: a sphere whose lower half tapers into a jaw (`jaw` = taper amount)."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=18, radius=1, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    for v in o.data.vertices:
        if v.co.z < 0:
            f = 1 + v.co.z * jaw  # z in [-1, 0]
            v.co.x *= f
            v.co.y *= 1 + v.co.z * jaw * 0.5
    o.scale = radii
    o.location = centre
    activate(o)
    bpy.ops.object.transform_apply(scale=True, location=True)
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o


def face_part(head, name, x, z, radii, mat, centre, out=0.002):
    """Flat decal-like feature (eye, pupil, brow, blush) laid onto the face."""
    p, n = snap_n(head, (x, centre[1], z), (x * 1.6, -1, (z - centre[2]) * 0.8), reach=1.0)
    o = sphere(name, radii, (0, 0, 0), mat, segs=16, rings=10)
    orient(o, n)
    o.location = p + n * out
    activate(o)
    bpy.ops.object.transform_apply(location=True)
    return o


def bar(name, a, b, width, depth, mat, head=None, out=0.004):
    """Flat bar from a to b (brows, lash lines), optionally snapped onto the head surface."""
    a, b = Vector(a), Vector(b)
    if head is not None:
        a = snap_n(head, a, (a.x * 1.4, -1, 0.1), 1.0)[0] + FRONT * out
        b = snap_n(head, b, (b.x * 1.4, -1, 0.1), 1.0)[0] + FRONT * out
    d = b - a
    o = cube(name, (width, depth, d.length), (0, 0, 0), mat)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.to_track_quat('Z', 'Y')
    o.location = (a + b) / 2
    activate(o)
    bpy.ops.object.transform_apply(location=True, rotation=True)
    return hard(o, min(width, depth) * 0.3)


def front_y(targets, x, z):
    p, _ = snap_n(targets, (x, 0, z), FRONT, reach=2.0)
    return p.y


def panel(name, targets, xs, top, hem, rows, gap, mats, zone, flare=0.0, thick=0.012):
    """Cloth/plate panel draped over the front of `targets` (drapes straight below the widest
    point). zone(i, j, cols, rows) -> material index per face."""
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
    o = mesh_from(name, verts, faces, mats[0])
    for m in mats[1:]:
        o.data.materials.append(m)
    for k, z in enumerate(zones):
        o.data.polygons[k].material_index = z
    sol = o.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = thick
    sol.offset = 1
    apply_modifiers(o)
    return auto_smooth(o, 30)


def dome(name, centre, radius, squash, mat, tilt_y, segs=8, rings=4):
    """Faceted half-shell (pauldron), tilted outward about Y."""
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
    o.rotation_euler = (0, tilt_y, 0)
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


def star(name, centre, r_out, r_in, points, mat, facing, thick=0.01):
    verts = [(0, 0, 0)]
    for k in range(points * 2):
        a = math.pi * k / points
        r = r_out if k % 2 == 0 else r_in
        verts.append((math.sin(a) * r, 0, math.cos(a) * r))
    n = points * 2
    o = mesh_from(name, verts, [(0, 1 + k, 1 + (k + 1) % n) for k in range(n)], mat)
    sol = o.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = thick
    apply_modifiers(o)
    orient(o, facing)
    o.location = centre
    activate(o)
    bpy.ops.object.transform_apply(location=True)
    return auto_smooth(o, 30)


def plate(name, profile, centre, u, v, thick, mat, bevel=0.004):
    """Flat extruded plate from a 2D profile laid out in the plane spanned by u and v."""
    c, u, v = Vector(centre), Vector(u).normalized(), Vector(v).normalized()
    verts = [tuple(c + u * a + v * b) for a, b in profile]
    o = mesh_from(name, verts, [tuple(range(len(verts)))], mat)
    sol = o.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = thick
    sol.offset = 0
    apply_modifiers(o)
    return auto_smooth(hard(o, bevel), 30)


def node(name, parts, pivot, parent=None):
    o = join(name, parts, pivot)
    if parent is not None:
        o.parent = parent
        o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o


def cape_sheet(name, top_z, bot_z, top_w, bot_w, y0, y1, mats, folds=3, rows=14, cols=16):
    """Voluminous cape hanging behind the shoulders: wraps forward at the top corners,
    flares and folds toward a wavy hem. mats = [cloth, trim]."""
    verts, faces, zones = [], [], []
    for i in range(cols + 1):
        u = -1 + 2 * i / cols
        for j in range(rows + 1):
            v = j / rows
            w = top_w + (bot_w - top_w) * v ** 0.8
            x = u * w
            z = top_z + (bot_z - top_z) * v + (0.025 * math.sin(u * math.pi * 4) * v if j == rows else 0)
            y = y0 - 0.1 * u * u * (1 - v) ** 2 + (y1 - y0) * v ** 1.3 + 0.03 * math.sin(u * math.pi * folds) * v
            verts.append((x, y, z))
    for i in range(cols):
        for j in range(rows):
            a = i * (rows + 1) + j
            faces.append((a, a + rows + 1, a + rows + 2, a + 1))
            zones.append(1 if i == 0 or i == cols - 1 or j == rows - 1 else 0)
    o = mesh_from(name, verts, faces, mats[0])
    o.data.materials.append(mats[1])
    for k, z in enumerate(zones):
        o.data.polygons[k].material_index = z
    sol = o.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = 0.014
    apply_modifiers(o)
    return auto_smooth(o, 30)


def mats():
    return {
        'skin': material('skin', (0.95, 0.8, 0.7), 0.6),
        'hair': material('hair', (0.8, 0.72, 0.92), 0.55),
        'eye': material('eye', (0.3, 0.35, 0.8), 0.3),
        'pupil': material('pupil', (0.05, 0.03, 0.06), 0.4),
        'shine': material('shine', (1, 1, 1), 0.2),
        'blush': material('blush', (0.95, 0.55, 0.55), 0.8),
        'steel': material('steel', (0.82, 0.84, 0.88), 0.3),
        'gold': material('gold', (0.86, 0.66, 0.24), 0.3),
        'gem': material('gem', (0.2, 0.55, 1.0), 0.15),
        'white': material('white', (0.94, 0.92, 0.87), 0.7),
        'cloth': material('cloth', (0.18, 0.37, 0.72), 0.7),
        'leather': material('leather', (0.36, 0.22, 0.13), 0.7),
        'iron': material('iron', (0.3, 0.29, 0.3), 0.5),
        'fur': material('fur', (0.6, 0.42, 0.26), 0.9),
        'furdark': material('furdark', (0.36, 0.24, 0.14), 0.9),
        'brass': material('brass', (0.72, 0.54, 0.26), 0.4),
        'bone': material('bone', (0.9, 0.85, 0.74), 0.6),
        'darkwood': material('darkwood', (0.24, 0.15, 0.09), 0.7),
    }


def face(head, centre, M, fem, eye_h, brow_angle, brow_z=0.06, brow_w=0.016, iris_w=0.036):
    """Anime face: tall iris ovals with pupils, highlights and lash lines, brows, mouth."""
    parts = []
    cx, cy, cz = centre
    ez = cz - 0.005
    for s in (-1, 1):
        x = s * 0.078
        parts.append(face_part(head, 'iris', x, ez, (iris_w, 0.008, eye_h), M['eye'], centre, 0.001))
        parts.append(face_part(head, 'pupil', x, ez - eye_h * 0.15, (0.018, 0.008, eye_h * 0.5), M['pupil'], centre, 0.004))
        parts.append(face_part(head, 'shine', x - s * 0.012, ez + eye_h * 0.4, (0.011, 0.006, 0.013), M['shine'], centre, 0.007))
        top = ez + eye_h * 0.95
        parts.append(bar('lash', (x - 0.045, cy, top - (0.012 if s > 0 else 0.0)), (x + 0.045, cy, top - (0.0 if s > 0 else 0.012)),
                         0.014 if fem else 0.011, 0.008, M['pupil'], head))
        by = cz + brow_z
        inner, outer = (x - s * 0.035, cy, by - brow_angle), (x + s * 0.04, cy, by + brow_angle * 0.6)
        parts.append(bar('brow', inner, outer, brow_w, 0.012, M['hair'], head))
        if fem:
            parts.append(face_part(head, 'blush', s * 0.11, cz - 0.085, (0.03, 0.004, 0.014), M['blush'], centre, 0.001))
    parts.append(bar('mouth', (-0.022, cy, cz - 0.12), (0.022, cy, cz - 0.12), 0.008, 0.006, M['pupil'], head, 0.002))
    return parts


def hair_cap(name, centre, radii, hairline, nape, mat):
    """Solid skull cap in the hair colour: covers top and back, opens for the face below
    `hairline` (relative z) and ends at `nape` at the back."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=14, radius=1, location=(0, 0, 0))
    cap = bpy.context.active_object
    cap.name = name
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(cap.data)
    kill = [v for v in bm.verts if (v.co.y < -0.25 and v.co.z < hairline + 0.35 * max(0, abs(v.co.x) - 0.5))
            or v.co.z < nape]
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(cap.data)
    bm.free()
    cap.scale = radii
    cap.location = centre
    activate(cap)
    bpy.ops.object.transform_apply(scale=True, location=True)
    sol = cap.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = 0.02
    sol.offset = -1
    apply_modifiers(cap)
    cap.data.materials.append(mat)
    return auto_smooth(cap, 40)


def on_head(head, centre, direction, out):
    p, n = snap_n(head, centre, direction, reach=1.0)
    return p + n * out


# --------------------------------------------------------------------------- Brenna

def build_brenna():
    reset()
    M = mats()
    HC = (0, 0, 0.94)

    # ---- legs, boots, hips (root node)
    legs = []
    for s in (-1, 1):
        x = s * 0.075
        legs.append(skin_chain('thigh', [(x, 0, 0.46), (x * 1.05, -0.005, 0.28)], [0.068, 0.058], M['steel']))
        legs.append(skin_chain('greave', [(x * 1.05, -0.005, 0.29), (x * 1.1, 0, 0.1)], [0.058, 0.05], M['steel']))
        legs.append(facet_sphere('knee', (0.05, 0.04, 0.045), (x * 1.05, -0.05, 0.28), M['gold'], 8, 5))
        legs.append(skin_chain('boot', [(x * 1.1, 0.02, 0.055), (x * 1.1, -0.1, 0.04)], [(0.065, 0.05), (0.06, 0.04)], M['steel']))
        legs.append(hard(cube('sole', (0.12, 0.2, 0.02), (x * 1.1, -0.04, 0.01), M['leather']), 0.006))
    legs.append(ring('belt', (0, 0, 0.47), 0.15, 0.022, M['leather'], scale=(1, 0.75, 1)))
    legs.append(hard(cube('buckle', (0.06, 0.02, 0.045), (0, -0.125, 0.47), M['gold']), 0.005))
    for s in (-1, 1):  # hip tassets
        legs.append(dome('tasset', (s * 0.13, -0.01, 0.42), 0.09, 0.9, M['steel'], s * 1.4, segs=8, rings=3))
    root = node('hero', legs, (0, 0, 0))

    # ---- torso: breastplate, tabard, sun crest, collar, pauldrons
    chest = skin_chain('chest', [(0, 0, 0.45), (0, 0, 0.6), (0, 0, 0.72)], [(0.14, 0.1), (0.155, 0.11), (0.17, 0.11)],
                       M['steel'], levels=2)
    torso = [chest]
    W = 0.12
    tab = panel('tabard', [chest] + [o for o in bpy.data.objects if o.name.startswith('hero')],
                [-W + 2 * W * i / 8 for i in range(9)],
                top=lambda x: 0.7, hem=lambda x: 0.18 + 0.1 * abs(x) / W, rows=16, gap=0.012,
                mats=[M['white'], M['gold']], flare=0.03,
                zone=lambda i, j, n, m: 1 if i == 0 or i == n - 1 or j >= m - 1 else 0)
    torso.append(tab)
    yc = front_y([tab], 0, 0.6) - 0.012
    torso.append(star('sun', (0, yc, 0.6), 0.075, 0.03, 8, M['gold'], FRONT, 0.01))
    torso.append(facet_sphere('sun_gem', (0.022, 0.012, 0.022), (0, yc - 0.012, 0.6), M['gem'], 8, 5))
    # high gothic collar: flared open-front band behind the neck, gold rim
    verts, faces = [], []
    n_a, n_z = 12, 4
    for i in range(n_a + 1):
        a = math.radians(-125 + 250 * i / n_a)  # 0 = back
        for j in range(n_z + 1):
            t = j / n_z
            r = 0.12 + 0.1 * t ** 1.4
            z = 0.7 + 0.16 * t + (0.035 if (i % 2 and j == n_z) else 0)  # crenellated gothic tips
            verts.append((math.sin(a) * r, 0.02 + math.cos(a) * r * 0.9, z))
    for i in range(n_a):
        for j in range(n_z):
            a = i * (n_z + 1) + j
            faces.append((a, a + 1, a + n_z + 2, a + n_z + 1))
    collar = mesh_from('collar', verts, faces, M['steel'])
    collar.data.materials.append(M['gold'])
    for k, f in enumerate(collar.data.polygons):
        if (k % n_z) == n_z - 1:
            f.material_index = 1
    sol = collar.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = 0.014
    apply_modifiers(collar)
    torso.append(auto_smooth(collar, 30))
    # 2x angular winged pauldrons
    for s in (-1, 1):
        c = Vector((s * 0.2, 0.0, 0.73))
        torso.append(dome('pauldron', c, 0.13, 0.62, M['steel'], s * 0.55))
        torso.append(ring('pauldron_rim', c + Vector((s * 0.005, 0, -0.005)), 0.137, 0.012, M['gold'], (0, s * 0.55, 0), segs=8, scale=(1.1, 1, 1)))
        torso.append(dome('lame', c + Vector((s * 0.06, 0, -0.075)), 0.1, 0.55, M['steel'], s * 0.95))
        # wing: a pointed plate flaring up and out from the pauldron's outer top edge
        torso.append(plate('wing', [(0, 0), (0.06, 0.02), (0.13, 0.13), (0.07, 0.07), (0.04, 0.1), (0.0, 0.04)],
                           c + Vector((s * 0.06, 0.02, 0.04)), (s, 0, 0), (0, 0, 1), 0.022, M['gold']))
    torso_node = node('torso', torso, (0, 0, 0.46), root)

    # ---- head: skull, neck, face, hair
    neck = cylinder('neck', 0.045, 0.1, (0, 0, 0.76), M['skin'], verts=12)
    head = head_mesh('head', HC, (0.205, 0.19, 0.2), 0.3, M['skin'])
    parts = [head, neck] + face(head, HC, M, fem=True, eye_h=0.05, brow_angle=0.004, brow_z=0.058, brow_w=0.012)
    parts.append(hair_cap('cap', (HC[0], HC[1] + 0.005, HC[2] + 0.005), (0.218, 0.205, 0.212), 0.42, -0.62, M['hair']))
    # front bangs: three wide clumps per side from a centre part, tips at the brow line
    for s in (-1, 1):
        for k, (spread, z_tip, w) in enumerate(((0.03, 1.015, 0.11), (0.1, 1.005, 0.11), (0.17, 1.02, 0.09))):
            root_p = on_head(head, HC, (s * 0.05, -0.35, 1), 0.02)
            mid = on_head(head, HC, (s * (spread + 0.04) * 3.2, -1, 0.7), 0.025)
            tip = on_head(head, (HC[0], HC[1], z_tip), (s * (spread + 0.02) * 4.5, -1, 0.0), 0.018)
            parts.append(wedge('bang', [root_p, mid, tip], [w, w * 1.1, 0.0], 0.04, M['hair'], centre=HC))
    # long side bangs framing the face, down to the jaw
    for s in (-1, 1):
        # rooted at the temples and hanging just outside the cheeks so the eyes stay clear
        a = on_head(head, HC, (s * 1.0, -0.45, 0.55), 0.015)
        b = on_head(head, HC, (s * 1.0, -0.25, -0.1), 0.03)
        pts = [a, b, b + Vector((s * 0.025, 0.0, -0.12)), b + Vector((s * 0.02, 0.02, -0.22))]
        parts.append(wedge('sidebang', pts, [0.07, 0.075, 0.06, 0.0], 0.035, M['hair'], centre=HC))
    # big back/side clumps falling past the shoulders over the cape
    for s, dx, back, tip_z in ((0, 0, 1, 0.36), (-1, 0.09, 1, 0.4), (1, 0.09, 1, 0.4), (-1, 0.17, 0.4, 0.5), (1, 0.17, 0.4, 0.5)):
        x0 = s * dx
        a = on_head(head, HC, (x0 * 4, back, 0.9), 0.015)
        b = on_head(head, HC, (x0 * 5.5, back, -0.1), 0.03)
        pts = [a, b, Vector((x0 * 1.5 + s * 0.04, b.y + 0.07, 0.66)), Vector((x0 * 1.6 + s * 0.05, b.y + 0.1, tip_z + 0.1)),
               Vector((x0 * 1.5 + s * 0.04, b.y + 0.1, tip_z))]
        parts.append(wedge('clump', pts, [0.15, 0.17, 0.16, 0.12, 0.0], 0.05, M['hair'], centre=(0, 0, pts[2].z)))
    head_node = node('head', parts, (0, 0, 0.74), torso_node)

    # ---- arms with mitten gauntlets; longsword (right) and scepter (left), both ~1.4x
    for s, name in ((1, 'arm_l'), (-1, 'arm_r')):
        sh = Vector((s * 0.19, 0, 0.7))
        hand = Vector((s * 0.27, -0.03, 0.43))
        arm = [skin_chain('arm', [tuple(sh), (s * 0.24, -0.01, 0.56), tuple(hand + Vector((0, 0, 0.04)))], [0.055, 0.05, 0.05], M['steel']),
               facet_sphere('cuff', (0.058, 0.058, 0.03), tuple(hand + Vector((0, 0, 0.055))), M['gold'], 10, 4),
               facet_sphere('gauntlet', (0.06, 0.055, 0.065), tuple(hand), M['steel'], 10, 6),
               facet_sphere('thumb', (0.022, 0.022, 0.03), tuple(hand + Vector((-s * 0.04, -0.035, 0.01))), M['steel'], 6, 4)]
        if s < 0:  # longsword angled down and forward
            d = Vector((-0.25, -0.55, -1)).normalized()
            g = hand + Vector((0, -0.02, 0))
            arm.append(rod('grip', g - d * 0.06, g + d * 0.05, 0.016, M['leather'], 8))
            arm.append(facet_sphere('pommel', (0.026, 0.026, 0.026), tuple(g - d * 0.075), M['gold'], 8, 5))
            side = d.cross(Vector((0, 0, 1))).normalized()
            guard = g + d * 0.065
            arm.append(rod('guard', guard - side * 0.08, guard + side * 0.08, 0.016, M['gold'], 8))
            arm.append(facet_sphere('guard_gem', (0.018, 0.018, 0.018), tuple(guard - side.cross(d) * 0.01), M['gem'], 8, 5))
            base = guard + d * 0.02
            blade = [(-0.028, 0), (0.028, 0), (0.024, 0.5), (0.0, 0.58), (-0.024, 0.5)]
            arm.append(plate('blade', blade, base, side, d, 0.018, M['steel'], 0.006))
        else:  # ornate scepter held upright
            up = Vector((0.25, -0.1, 1)).normalized()
            g = hand + Vector((0, -0.02, 0))
            arm.append(rod('shaft', g - up * 0.14, g + up * 0.4, 0.016, M['darkwood'], 8))
            for t in (-0.1, 0.1, 0.3):
                arm.append(rod('band', g + up * (t - 0.01), g + up * (t + 0.01), 0.021, M['gold'], 8))
            top = g + up * 0.47
            arm.append(facet_sphere('scepter_gem', (0.05, 0.05, 0.055), tuple(top), M['gem'], 8, 6))
            for k in range(4):
                off = Vector((math.cos(k * math.pi / 2), math.sin(k * math.pi / 2), 0)) * 0.048
                arm.append(rod('cage', top - up * 0.06 + off, top + up * 0.06 + off, 0.008, M['gold'], 6))
            arm.append(ring('cage_lo', tuple(top - up * 0.055), 0.045, 0.01, M['gold'], segs=10))
            arm.append(rod('cross_v', top + up * 0.05, top + up * 0.16, 0.011, M['gold'], 6))
            arm.append(rod('cross_h', top + up * 0.12 + Vector((-0.04, 0, 0)), top + up * 0.12 + Vector((0.04, 0, 0)), 0.01, M['gold'], 6))
        node(name, arm, tuple(sh), torso_node)

    # ---- voluminous royal-blue cape with gold trim
    cape = cape_sheet('cape_mesh', 0.74, 0.03, 0.2, 0.38, 0.13, 0.32, [M['cloth'], M['gold']])
    node('cape', [cape], (0, 0.13, 0.74), torso_node)

    export('brenna.glb', all_nodes(root), texcoords=False)


# --------------------------------------------------------------------------- Dreg

def build_dreg():
    reset()
    M = mats()
    HC = (0, 0, 0.98)

    legs = []
    for s in (-1, 1):
        x = s * 0.09
        legs.append(skin_chain('thigh', [(x, 0, 0.46), (x * 1.05, 0, 0.27)], [0.085, 0.07], M['leather']))
        legs.append(skin_chain('greave', [(x * 1.05, 0, 0.28), (x * 1.1, 0, 0.1)], [0.068, 0.06], M['iron']))
        legs.append(facet_sphere('knee', (0.06, 0.045, 0.055), (x * 1.05, -0.055, 0.27), M['iron'], 8, 5))
        legs.append(skin_chain('boot', [(x * 1.1, 0.02, 0.06), (x * 1.1, -0.1, 0.045)], [(0.075, 0.06), (0.07, 0.05)], M['leather']))
        legs.append(ring('boot_fur', (x * 1.1, 0.0, 0.12), 0.075, 0.03, M['fur'], segs=10))
        legs.append(hard(cube('sole', (0.14, 0.22, 0.025), (x * 1.1, -0.04, 0.012), M['furdark']), 0.006))
    legs.append(ring('belt', (0, 0, 0.47), 0.19, 0.03, M['cloth'], scale=(1, 0.75, 1)))  # crimson sash-belt
    legs.append(facet_sphere('buckle', (0.05, 0.02, 0.05), (0, -0.155, 0.47), M['brass'], 10, 6))
    root = node('hero', legs, (0, 0, 0))

    chest = skin_chain('chest', [(0, 0, 0.44), (0, 0, 0.6), (0, 0, 0.75)], [(0.19, 0.13), (0.205, 0.14), (0.215, 0.14)],
                       M['iron'], levels=2)
    torso = [chest]
    # crimson loincloth + leather flaps, dagged hems
    for x0, x1, mat, g in ((-0.08, 0.08, M['cloth'], 0.03), (-0.19, -0.08, M['leather'], 0.02), (0.08, 0.19, M['leather'], 0.02)):
        xs = [x0 + (x1 - x0) * i / 4 for i in range(5)]
        torso.append(panel('flap', [chest] + [o for o in bpy.data.objects if o.name.startswith('hero')], xs,
                           top=lambda x: 0.46, hem=lambda x, x0=x0, x1=x1: 0.14 + 0.05 * (round((x - x0) / (x1 - x0) * 4) % 2),
                           rows=6, gap=g, mats=[mat], zone=lambda *a: 0, flare=0.05, thick=0.012))
    # crimson baldric across the iron breastplate
    pts = []
    for k in range(9):
        t = k / 8
        x, z = -0.17 + 0.34 * t, 0.74 - 0.26 * t
        pts.append(Vector((x, front_y([chest], x, z) - 0.012, z)))
    torso.append(wedge('baldric', pts, [0.075] * 9, 0.018, M['cloth'], facing=FRONT))
    torso.append(ring('plate_rim', (0, 0, 0.745), 0.2, 0.018, M['brass'], scale=(1.05, 0.72, 1)))
    # massive jagged fur mantle broadening the shoulders
    torso.append(ring('mantle_base', (0, 0.02, 0.78), 0.2, 0.075, M['furdark'], segs=10, scale=(1.15, 0.95, 0.9)))
    rows = [(0.82, 0.2, 0.17, 0.22, 0.12, 16, 60), (0.74, 0.26, 0.21, 0.27, 0.14, 14, 55), (0.62, 0.25, 0.22, 0.24, 0.13, 10, 100)]
    for ri, (z, rx, ry, length, width, n, gap_deg) in enumerate(rows):
        for k in range(n):
            a = 2 * math.pi * (k + 0.5 * (ri % 2)) / n  # 0 = back
            if abs(math.atan2(math.sin(a), -math.cos(a))) < math.radians(gap_deg):
                continue
            base = Vector((math.sin(a) * rx, math.cos(a) * ry + 0.02, z))
            out = Vector((math.sin(a), math.cos(a), 0))
            tip = base + out * length * 0.85 + Vector((0, 0, -length * (0.35 + 0.2 * ri)))
            mid = base.lerp(tip, 0.45) + Vector((0, 0, 0.03))
            mat = M['fur'] if (k + ri) % 3 else M['furdark']
            torso.append(wedge('fur', [base - out * 0.04, mid, tip], [width, width * 0.8, 0.0], width * 0.5, mat,
                               centre=(0, 0, z)))
    for s in (-1, 1):  # iron pauldrons sitting in the fur
        c = Vector((s * 0.25, 0.0, 0.76))
        torso.append(dome('pauldron', c, 0.12, 0.6, M['iron'], s * 0.6))
        torso.append(ring('pauldron_rim', c, 0.128, 0.014, M['brass'], (0, s * 0.6, 0), segs=8, scale=(1.1, 1, 1)))
    torso_node = node('torso', torso, (0, 0, 0.46), root)

    # head: wild tawny mane over a solid cap, solid braided beard, angry brow
    neck = cylinder('neck', 0.06, 0.1, (0, 0, 0.79), M['skin'], verts=12)
    head = head_mesh('head', HC, (0.21, 0.195, 0.2), 0.18, M['skin'])
    parts = [head, neck] + face(head, HC, M, fem=False, eye_h=0.026, brow_angle=-0.022, brow_z=0.032, brow_w=0.028, iris_w=0.03)
    parts.append(hair_cap('cap', (HC[0], HC[1] + 0.008, HC[2] + 0.01), (0.225, 0.212, 0.215), 0.45, -0.55, M['hair']))
    # wild clumps: back/sides sweeping out and down, two spiky crown chunks, forelocks
    for s, dx, zb, spread in ((0, 0, 0.72, 0.0), (-1, 0.1, 0.74, 0.06), (1, 0.1, 0.74, 0.06), (-1, 0.19, 0.8, 0.1), (1, 0.19, 0.8, 0.1)):
        x0 = s * dx
        a = on_head(head, HC, (x0 * 4, 1, 0.9), 0.015)
        b = on_head(head, HC, (x0 * 5, 1, -0.05), 0.04)
        pts = [a, b, Vector((x0 * 1.4 + s * spread, b.y + 0.08, 0.85)), Vector((x0 * 1.5 + s * spread * 1.4, b.y + 0.1, zb))]
        parts.append(wedge('mane', pts, [0.17, 0.19, 0.15, 0.0], 0.06, M['hair'], centre=(0, 0, 0.9)))
    for s in (-1, 1):
        a = on_head(head, HC, (s * 0.3, -0.3, 1), 0.015)
        b = on_head(head, HC, (s * 0.55, 0.5, 0.8), 0.045)
        parts.append(wedge('crown', [a, b, b + Vector((s * 0.06, 0.1, -0.06))], [0.14, 0.15, 0.0], 0.06, M['hair'], centre=HC))
        a = on_head(head, HC, (s * 0.25, -0.6, 1), 0.015)
        b = on_head(head, HC, (s * 0.9, -0.7, 0.35), 0.02)
        parts.append(wedge('forelock', [a, b, b + Vector((s * 0.05, 0.0, -0.08))], [0.1, 0.09, 0.0], 0.04, M['hair'], centre=HC))
        a = on_head(head, HC, (s * 1, -0.2, 0.2), 0.02)  # sideburn into the beard
        parts.append(wedge('sideburn', [a, a + Vector((0, -0.02, -0.1)), a + Vector((-s * 0.02, -0.05, -0.18))],
                           [0.07, 0.08, 0.06], 0.04, M['hair'], centre=HC))
    # beard: one solid mass from the jaw down over the chest, mustache, three chunky braids
    top = on_head(head, HC, (0, -1, -0.55), 0.0)
    beard = [top + Vector((0, -0.005, 0.02)), Vector((0, top.y - 0.03, 0.8)), Vector((0, top.y - 0.03, 0.68)), Vector((0, top.y - 0.02, 0.6))]
    parts.append(auto_smooth(skin_chain('beard', [tuple(p) for p in beard],
                                        [(0.16, 0.08), (0.155, 0.085), (0.12, 0.07), (0.06, 0.04)], M['hair'], levels=1), 35))
    for s in (-1, 1):  # jaw-line fullness joining the sideburns
        a = on_head(head, HC, (s * 0.8, -0.7, -0.35), 0.01)
        parts.append(auto_smooth(skin_chain('jaw', [tuple(a), tuple(a + Vector((-s * 0.05, -0.04, -0.1)))],
                                            [(0.06, 0.05), (0.05, 0.04)], M['hair'], levels=1), 35))
    for s in (-1, 1):
        a = on_head(head, HC, (s * 0.05, -1, -0.28), 0.012)
        parts.append(wedge('mustache', [a, a + Vector((s * 0.07, -0.01, -0.03)), a + Vector((s * 0.1, 0.0, -0.09))],
                           [0.05, 0.045, 0.0], 0.03, M['hair'], facing=FRONT))
    for x, n_beads in ((-0.07, 3), (0.0, 4), (0.07, 3)):
        p = Vector((x, beard[-1].y, 0.62))
        for b in range(n_beads):
            p = p + Vector((0, 0, -0.045))
            parts.append(facet_sphere('braid', (0.03, 0.027, 0.03), tuple(p + Vector((0.006 * (b % 2), 0, 0))), M['hair'], 8, 5))
        parts.append(ring('braid_ring', tuple(p + Vector((0, 0, -0.03))), 0.024, 0.01, M['bone'], segs=8))
        parts.append(facet_sphere('braid_tip', (0.02, 0.02, 0.02), tuple(p + Vector((0, 0, -0.055))), M['hair'], 6, 4))
    head_node = node('head', parts, (0, 0, 0.78), torso_node)

    # arms: thick, leather bracers with fur cuffs, big mitts; double-bitted axe (right hand)
    for s, name in ((1, 'arm_l'), (-1, 'arm_r')):
        sh = Vector((s * 0.24, 0, 0.72))
        hand = Vector((s * 0.33, -0.03, 0.44))
        arm = [skin_chain('arm', [tuple(sh), (s * 0.3, -0.01, 0.58), tuple(hand + Vector((0, 0, 0.05)))], [0.07, 0.065, 0.06], M['skin']),
               ring('bracer_fur', tuple(hand + Vector((0, 0, 0.1))), 0.06, 0.026, M['fur'], segs=10),
               skin_chain('bracer', [tuple(hand + Vector((0, 0, 0.1))), tuple(hand + Vector((0, 0, 0.04)))], [0.064, 0.06], M['leather']),
               facet_sphere('mitt', (0.072, 0.065, 0.072), tuple(hand), M['leather'], 10, 6),
               facet_sphere('thumb', (0.026, 0.026, 0.034), tuple(hand + Vector((-s * 0.05, -0.04, 0.01))), M['leather'], 6, 4)]
        if s < 0:
            d = Vector((-0.45, -0.25, 1)).normalized()  # held outward, head above the shoulder
            g = hand + Vector((0, -0.02, 0))
            arm.append(rod('haft', g - d * 0.2, g + d * 0.72, 0.024, M['darkwood'], 8))
            for t in (-0.12, 0.08):
                arm.append(rod('wrap', g + d * (t - 0.03), g + d * (t + 0.03), 0.029, M['cloth'], 8))
            hc = g + d * 0.62
            side = d.cross(Vector((0, -1, 0))).normalized()  # blade plane faces the camera
            arm.append(rod('socket', hc - d * 0.07, hc + d * 0.07, 0.04, M['iron'], 8))
            arm.append(cone('spike', 0.03, 0.0, 0.1, tuple(hc + d * 0.12), M['iron'], verts=6))
            arm[-1] = orient(arm[-1], d, base=Vector((0, 0, 1)))
            crescent = [(0.03, 0.08), (0.12, 0.13), (0.22, 0.17), (0.27, 0.06), (0.28, -0.06), (0.22, -0.17), (0.12, -0.13), (0.03, -0.08)]
            for bs in (-1, 1):
                prof = [(bs * a, b) for a, b in crescent]
                if bs < 0:
                    prof.reverse()
                arm.append(plate('blade', prof, hc, side, d, 0.04, M['iron'], 0.012))
                edge = [(bs * a, b) for a, b in crescent[2:6]]
                for (ax, az), (bx, bz) in zip(edge, edge[1:]):
                    arm.append(rod('edge', hc + side * ax + d * az, hc + side * bx + d * bz, 0.012, M['steel'], 6))
        node(name, arm, tuple(sh), torso_node)

    export('dreg.glb', all_nodes(root), texcoords=False)


def all_nodes(root):
    out = [root]
    for c in root.children_recursive:
        out.append(c)
    return out


if __name__ == '__main__':
    build_brenna()
    build_dreg()
