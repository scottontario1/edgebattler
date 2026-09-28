"""Builds character kits (armour, hair, cloth and weapons layered over KayKit bodies) as GLB.

Run headless from the project root:
    blender -b --factory-startup -P tools/blender/build_gear.py
It also runs inside a live Blender over Blender MCP (see common.reset()).

Output: public/models/env/gear.glb
  Each kit is fitted around the KayKit body it dresses, imported from public/models/kaykit/
  in its default (glTF node) pose, which is the pose three.js loads before animating. Every
  exported piece is a root object with custom properties (exported as glTF extras):
    kit  - which MODEL_SPECS kit uses it (src/models.js)
    bone - the KayKit bone it follows, as three.js names it (GLTFLoader drops the '.')
  src/models.js adds each piece to the character at its exported position, then re-parents
  it to that bone with Object3D.attach(), so it follows the idle animations.
  Material names map to game materials in gearMaterial(): steel, gold, gem, white, cloth
  (faction colour), hair (the unit's look.hair), fur, furdark, rust, brass, bone, leather,
  darkwood.

Kits (design references in design_assets/):
  paladin   - Brenna: long lavender hair, white tabard with gold border, sun emblem and a
              blue gothic arch, gold-rimmed pauldrons, cape brooches, jewelled mace.
  barbarian - Dreg: wild ginger mane with bone-beaded braids, shaggy fur mantle, rusted
              breastplate and pauldrons with brass rims, fang necklace, dagged loincloth,
              bearded war axe carried head-down.
"""
import math
import os
import random
import sys

import bpy
from mathutils import Euler, Matrix, Vector

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    ROOT, activate, apply_modifiers, cone, cylinder, export, hard, join, material, mesh_from, reset, rod,
    skin_chain, snap, sphere,
)

KAYKIT = os.path.join(ROOT, 'public', 'models', 'kaykit')
FRONT = (0, -1, 0)  # characters face -Y in Blender (+Z, toward the camera, in three.js)


# --------------------------------------------------------------------------- helpers

def import_character(name):
    """Import a KayKit character at the origin; returns {mesh name: object} for its body."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(KAYKIT, f'{name}.glb'))
    new = [o for o in bpy.data.objects if o not in before]
    body = {o.name.split('.')[0]: o for o in new if o.type == 'MESH'}
    for o in new:
        o['reference'] = True
    bpy.context.view_layer.update()
    return body


def tag(o, kit, bone):
    o['kit'] = kit
    o['bone'] = bone
    return o


def piece(name, parts, kit, bone):
    """Join parts into one exported piece with its origin at the parts' centre."""
    o = join(name, parts, (0, 0, 0))
    activate(o)
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    return tag(o, kit, bone)


def front_y(targets, x, z):
    """Y of the first surface hit looking at the body from the front."""
    p = snap(targets, (x, 0, z), FRONT, 0.0, reach=3.0)
    return p[1] if p else None


def conform_panel(name, targets, xs, top, hem, rows, gap, mats, zone, flare=0.0, thick=0.018):
    """Cloth/plate panel following the body's front. For each column x the panel runs from
    top(x) down to hem(x), sitting `gap` in front of the surface; below the widest point it
    hangs straight (drapes) instead of tucking back in. zone(col, row, ncols, nrows) picks
    the material index per face."""
    verts, faces, zones = [], [], []
    cols = len(xs)
    for x in xs:
        zt, zb = top(x), hem(x)
        y_prev = None
        for j in range(rows + 1):
            t = j / rows
            z = zt + (zb - zt) * t
            y = front_y(targets, x, z)
            y = (y - gap) if y is not None else (y_prev if y_prev is not None else -0.4)
            if y_prev is not None and y is not None:
                y = min(y, y_prev)  # drape: never tuck back behind the cloth above
            y_prev = y
            verts.append((x, y - flare * t * t, z))
    for i in range(cols - 1):
        for j in range(rows):
            a = i * (rows + 1) + j
            faces.append((a, a + 1, a + rows + 2, a + rows + 1))
            zones.append(zone(i, j, cols - 1, rows))
    o = mesh_from(name, verts, faces, mats[0])
    for m in mats[1:]:
        o.data.materials.append(m)
    for k, z in enumerate(zones):
        o.data.polygons[k].material_index = z
    sol = o.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = thick
    sol.offset = 1
    apply_modifiers(o)
    activate(o)
    bpy.ops.object.shade_smooth()
    return o


def star(name, center, r_out, r_in, points, mat, thick=0.014, rot=0.0):
    """Flat star in the XZ plane (facing -Y), extruded toward the viewer."""
    cx, cy, cz = center
    verts = [(cx, cy, cz)]
    for k in range(points * 2):
        a = rot + math.pi * k / points
        r = r_out if k % 2 == 0 else r_in
        verts.append((cx + math.sin(a) * r, cy, cz + math.cos(a) * r))
    n = points * 2
    faces = [(0, 1 + k, 1 + (k + 1) % n) for k in range(n)]
    o = mesh_from(name, verts, faces, mat)
    sol = o.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = thick
    apply_modifiers(o)
    return o


def disc(name, center, r, depth, mat, facing=FRONT, verts=20):
    """Cylinder whose flat face points along `facing`."""
    o = cylinder(name, r, depth, center, mat, verts=verts)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector(facing).to_track_quat('Z', 'Y')
    activate(o)
    bpy.ops.object.transform_apply(rotation=True)
    return o


def aim(o, direction, up='Y'):
    """Rotate an object (built along +Z) to point along `direction`, applying the rotation."""
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector(direction).normalized().to_track_quat('Z', up)
    activate(o)
    bpy.ops.object.transform_apply(rotation=True)
    return o


def dome(name, center, radius, squash, mat, tilt, segs=20):
    """Half-sphere shell (pauldron), axis tilted `tilt` = (rx, ry) radians from +Z."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=10, radius=radius, location=center)
    o = bpy.context.active_object
    o.name = name
    activate(o)
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context='VERTS')
    bm.to_mesh(o.data)
    bm.free()
    o.scale = (1, 1, squash)
    o.rotation_euler = (tilt[0], tilt[1], 0)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    sol = o.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = 0.025
    apply_modifiers(o)
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o


def ring(name, center, major, minor, mat, tilt=(0, 0), segs=24):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=segs, minor_segments=6,
                                     location=center, rotation=(tilt[0], tilt[1], 0))
    o = bpy.context.active_object
    o.name = name
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o


def tuft(name, base, direction, length, width, mat, rnd):
    """One shaggy fur/hair tuft: a flattened cone from `base` pointing along `direction`."""
    o = cone(name, width, 0.0, length, (0, 0, 0), mat, verts=6)
    o.scale = (1.0, 0.45, 1.0)
    activate(o)
    bpy.ops.object.transform_apply(scale=True)
    o.data.transform(Matrix.Translation((0, 0, length / 2)))
    o.rotation_mode = 'QUATERNION'
    d = Vector(direction).normalized()
    q = d.to_track_quat('Z', 'Y')
    o.rotation_quaternion = q @ Euler((0, 0, rnd.uniform(-0.6, 0.6))).to_quaternion()
    o.location = base
    bpy.ops.object.transform_apply(location=True, rotation=True)
    return o


def lock(name, root, path, radii, mat):
    """Hair lock from `root` through offsets in `path` (cumulative)."""
    pts = [Vector(root)]
    for step in path:
        pts.append(pts[-1] + Vector(step))
    return skin_chain(name, [tuple(p) for p in pts], radii, mat)


def pauldron(parts, side, targets, shell, rim, rows=2, radius=0.2):
    """Layered shoulder plate: dome over the shoulder plus a smaller lame below it, each with
    a rim band. `side` is +1 for the character's left (+X)."""
    out = snap(targets, (side * 0.3, 0.0, 1.1), (side, 0, 0), 0.0, reach=1.5)
    x = out[0] - side * 0.1 if out else side * 0.34
    tilt_y = side * 0.85
    c0 = (x, 0.0, 1.14)
    parts.append(dome('pauldron', c0, radius, 0.7, shell, (0, tilt_y)))
    parts.append(ring('pauldron_rim', c0, radius * 0.98, 0.022, rim, (0, tilt_y)))
    for k in range(1, rows):
        c = (x + side * 0.05 * k, 0.0, 1.14 - 0.1 * k)
        r = radius * (0.9 - 0.08 * k)
        parts.append(dome('lame', c, r, 0.6, shell, (0, side * 1.05)))
        parts.append(ring('lame_rim', c, r * 0.98, 0.016, rim, (0, side * 1.05)))
    return c0


# --------------------------------------------------------------------------- paladin

def build_paladin(M):
    body = import_character('Knight')
    torso = [body['Knight_Body'], body['Knight_LegLeft'], body['Knight_LegRight']]
    head = body['Knight_Head']
    out = []
    kit = 'paladin'

    # Tabard: white, gold border, pointed (gothic) hem; blue arch panel and sun emblem.
    W = 0.27
    xs = [-W + 2 * W * i / 12 for i in range(13)]
    tabard = conform_panel(
        'tabard', torso, xs,
        top=lambda x: 1.13 - 0.05 * (abs(x) / W) ** 2,
        hem=lambda x: 0.16 + 0.16 * (abs(x) / W),
        rows=22, gap=0.035, mats=[M['white'], M['gold']], flare=0.05,
        zone=lambda i, j, n, m: 1 if i == 0 or i == n - 1 or j >= m - 1 else 0,
    )
    arch = conform_panel(
        'arch', [tabard], [-0.1 + 0.2 * i / 6 for i in range(7)],
        top=lambda x: 0.6 - 0.09 * (abs(x) / 0.1),
        hem=lambda x: 0.3 + 0.03 * (abs(x) / 0.1),
        rows=8, gap=0.004, mats=[M['cloth'], M['gold']], thick=0.006,
        zone=lambda i, j, n, m: 1 if i == 0 or i == n - 1 or j == 0 else 0,
    )
    y_chest = front_y(torso, 0, 0.93)
    sun = star('sun', (0, y_chest - 0.065, 0.93), 0.12, 0.045, 8, M['gold'], thick=0.012)
    sun_small = star('sun_rays', (0, y_chest - 0.066, 0.93), 0.085, 0.03, 8, M['gold'], thick=0.014, rot=math.pi / 8)
    gem = sphere('sun_gem', (0.032, 0.02, 0.032), (0, y_chest - 0.08, 0.93), M['gem'])
    brooches = []
    for s in (-1, 1):
        yb = front_y(torso, s * 0.22, 1.1)
        c = (s * 0.22, yb - 0.05, 1.1)
        brooches += [disc('brooch', c, 0.055, 0.02, M['gold']),
                     sphere('brooch_gem', (0.026, 0.018, 0.026), (c[0], c[1] - 0.02, c[2]), M['gem'])]
    out.append(piece('paladin_tabard', [tabard, arch, sun, sun_small, gem] + brooches, kit, 'chest'))

    # Gold-rimmed pauldrons, one piece per arm so they follow the arm bones.
    for side, bone in ((1, 'upperarml'), (-1, 'upperarmr')):
        parts = []
        pauldron(parts, side, [body['Knight_ArmLeft' if side > 0 else 'Knight_ArmRight'], body['Knight_Body']],
                 M['steel'], M['gold'], rows=2, radius=0.19)
        out.append(piece(f'paladin_pauldron_{"l" if side > 0 else "r"}', parts, kit, bone))

    # Long wavy lavender hair: locks from the crown falling past the shoulders, plus two
    # face-framing locks. Locks keep their width and end blunt so they read as hair, not spikes.
    rnd = random.Random(3)
    hair = []
    centre = (0, 0.02, 1.72)
    n = 17
    for k in range(n):
        a = math.radians(-116 + 232 * k / (n - 1))  # 0 = straight back (+Y); the front stays clear
        side = math.sin(a)
        root = snap(head, centre, (side, math.cos(a), 0.55), -0.05, reach=1.2)
        if not root:
            continue
        o = Vector((side, math.cos(a), 0))
        drop = 1.05 - abs(side) ** 2 * 0.35 + rnd.uniform(-0.06, 0.06)
        wave = rnd.uniform(0.04, 0.07) * (1 if k % 2 else -1)
        hair.append(lock('lock', root, [
            tuple(o * 0.16 + Vector((0, 0, -0.18))),
            tuple(o * 0.1 + Vector((wave, 0, -drop * 0.3))),
            tuple(o * 0.04 + Vector((-wave, 0, -drop * 0.35))),
            tuple(o * 0.05 + Vector((wave * 0.6, 0, -drop * 0.2))),
        ], [(0.15, 0.09), (0.17, 0.1), (0.16, 0.09), (0.13, 0.08), (0.08, 0.05)], M['hair']))
    for s_ in (-1, 1):  # face-framing locks from the temples to the collarbone
        root = snap(head, centre, (s_, 0.12, 0.3), -0.04, reach=1.2)
        if root:
            hair.append(lock('side_lock', root, [(s_ * 0.16, -0.08, -0.22), (s_ * 0.04, -0.08, -0.3), (s_ * 0.02, -0.02, -0.25)],
                             [(0.12, 0.07), (0.12, 0.07), (0.1, 0.06), (0.06, 0.04)], M['hair']))
    out.append(piece('paladin_hair', hair, kit, 'head'))

    # Jewelled mace, upright in the left hand (where the shield used to be).
    hand = Vector((0.508, 0.018, 0.639))
    up = Vector((0.42, -0.12, 1)).normalized()  # leans out past the hair
    parts = [rod('haft', hand - up * 0.28, hand + up * 0.72, 0.028, M['darkwood'], verts=10)]
    for t in (-0.2, 0.0, 0.18):
        parts.append(rod('grip_ring', hand + up * (t - 0.015), hand + up * (t + 0.015), 0.036, M['gold'], verts=12))
    parts.append(sphere('pommel', (0.045, 0.045, 0.045), tuple(hand - up * 0.3), M['gold']))
    head_c = hand + up * 0.86
    parts.append(sphere('mace_gem', (0.075, 0.075, 0.075), tuple(head_c), M['gem'], segs=12, rings=8, smooth=False))
    for k in range(4):  # gold cage flanges around the gem
        a = k * math.pi / 2
        r = rod('flange', head_c - up * 0.12, head_c + up * 0.12, 0.012, M['gold'], verts=6)
        r.location += Vector((math.cos(a), math.sin(a), 0)) * 0.07
        parts.append(r)
    parts.append(ring('cage_lo', tuple(head_c - up * 0.1), 0.06, 0.014, M['gold']))
    parts.append(ring('cage_hi', tuple(head_c + up * 0.1), 0.06, 0.014, M['gold']))
    top = head_c + up * 0.12
    parts.append(rod('cross_v', top, top + up * 0.17, 0.016, M['gold'], verts=6))
    parts.append(rod('cross_h', top + up * 0.11 + Vector((-0.06, 0, 0)), top + up * 0.11 + Vector((0.06, 0, 0)), 0.014, M['gold'], verts=6))
    out.append(piece('paladin_mace', parts, kit, 'handslotl'))

    return out, body


# --------------------------------------------------------------------------- barbarian

def build_barbarian(M):
    body = import_character('Barbarian')
    torso = [body['Barbarian_Body'], body['Barbarian_LegLeft'], body['Barbarian_LegRight']]
    head = body['Barbarian_Head']
    out = []
    kit = 'barbarian'
    rnd = random.Random(11)

    # Rusted breastplate with a brass rim, rivets and a wolf-head boss.
    W = 0.26
    xs = [-W + 2 * W * i / 10 for i in range(11)]
    plate = conform_panel(
        'breastplate', torso, xs,
        top=lambda x: 1.12 - 0.04 * (abs(x) / W),
        hem=lambda x: 0.72 + 0.05 * (abs(x) / W),
        rows=10, gap=0.03, mats=[M['rust'], M['brass']],
        zone=lambda i, j, n, m: 1 if i == 0 or i == n - 1 or j == 0 or j == m - 1 else 0, thick=0.03,
    )
    parts = [plate]
    for x in (-0.2, -0.1, 0.1, 0.2):
        for z in (1.07, 0.77):
            y = front_y(torso, x, z)
            if y is not None:
                parts.append(sphere('rivet', (0.016, 0.012, 0.016), (x, y - 0.065, z), M['brass'], segs=8, rings=5))
    yb = front_y(torso, 0, 0.9)
    parts.append(disc('boss', (0, yb - 0.07, 0.9), 0.075, 0.03, M['brass']))
    parts.append(disc('boss_inner', (0, yb - 0.09, 0.9), 0.045, 0.02, M['rust']))
    for s in (-1, 1):  # wolf ears on the boss
        parts.append(aim(cone('boss_ear', 0.022, 0.0, 0.05, (s * 0.035, yb - 0.09, 0.96), M['brass'], verts=4),
                         (s * 0.4, -0.2, 1)))
    # Fang necklace hanging over the plate.
    for k in range(9):
        t = (k - 4) / 4
        x, z = t * 0.2, 1.08 - (1 - t * t) * 0.1
        y = front_y(torso, x, z)
        if y is None:
            continue
        p = Vector((x, y - 0.08, z))
        parts.append(sphere('bead', (0.018, 0.018, 0.018), tuple(p), M['brass'] if k % 2 else M['bone'], segs=8, rings=5))
        if k % 2 == 0:
            f = cone('fang', 0.022, 0.0, 0.1, tuple(p + Vector((0, -0.005, -0.06))), M['bone'], verts=6)
            f.rotation_euler = (math.pi, 0, 0)
            parts.append(f)
    out.append(piece('barbarian_plate', parts, kit, 'chest'))

    # Shaggy fur mantle around the shoulders and down the upper back, open at the front.
    fur = []
    rows = [(1.22, 0.4, 0.34, 0.3, 26), (1.12, 0.47, 0.4, 0.34, 26), (0.98, 0.48, 0.44, 0.34, 18)]
    for ri, (z, rx, ry, length, n) in enumerate(rows):
        for k in range(n):
            a = 2 * math.pi * k / n + rnd.uniform(-0.08, 0.08)  # 0 = back
            front_gap = math.radians(62 if ri < 2 else 110)
            if abs(math.atan2(math.sin(a), -math.cos(a))) < front_gap:
                continue
            base = Vector((math.sin(a) * rx, math.cos(a) * ry + 0.02, z + rnd.uniform(-0.02, 0.02)))
            d = Vector((math.sin(a) * 0.9, math.cos(a) * 0.9, -0.55 - 0.25 * ri))
            mat = M['fur'] if rnd.random() < 0.65 else M['furdark']
            fur.append(tuft('fur', base, d, length * rnd.uniform(0.85, 1.2), 0.1, mat, rnd))
    out.append(piece('barbarian_mantle', fur, kit, 'chest'))

    # Rusted pauldrons trimmed with fur.
    for side, bone in ((1, 'upperarml'), (-1, 'upperarmr')):
        parts = []
        c = pauldron(parts, side, [body['Barbarian_ArmLeft' if side > 0 else 'Barbarian_ArmRight'], body['Barbarian_Body']],
                     M['rust'], M['brass'], rows=2, radius=0.21)
        for k in range(9):
            a = math.pi * (0.1 + 0.8 * k / 8)
            base = Vector(c) + Vector((side * math.sin(a) * 0.2, math.cos(a) * 0.2, -0.02))
            fur_mat = M['fur'] if k % 3 else M['furdark']
            parts.append(tuft('trim', base, (side * 0.6, math.cos(a) * 0.5, -0.8), 0.16, 0.06, fur_mat, rnd))
        out.append(piece(f'barbarian_pauldron_{"l" if side > 0 else "r"}', parts, kit, bone))

    # Wild ginger mane: a cap over the bald crown, locks down to the shoulders, two braids.
    hair = []
    centre = (0, 0.02, 1.7)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=14, radius=0.62, location=centre)
    cap = bpy.context.active_object
    cap.name = 'cap'
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(cap.data)
    # keep the crown and back; open the face (front below the hairline) and the neck
    bmesh.ops.delete(bm, geom=[v for v in bm.verts
                               if v.co.z < (0.02 if v.co.y < -0.1 else -0.3) or (v.co.y < -0.35 and v.co.z < 0.18)],
                     context='VERTS')
    bm.to_mesh(cap.data)
    bm.free()
    sw = cap.modifiers.new('wrap', 'SHRINKWRAP')
    sw.target = head
    sw.offset = 0.035
    apply_modifiers(cap)
    bpy.ops.object.shade_smooth()
    cap.data.materials.append(M['hair'])
    hair.append(cap)
    # Back and sides only (behind the ears): the game camera looks down on the head, so any
    # lock rooted further forward hangs over the face.
    n = 19
    for k in range(n):
        a = math.radians(-112 + 224 * k / (n - 1)) + rnd.uniform(-0.04, 0.04)
        root = snap(head, centre, (math.sin(a), math.cos(a), rnd.uniform(0.35, 0.7)), -0.04, reach=1.2)
        if not root:
            continue
        o = Vector((math.sin(a), math.cos(a), 0))
        length = rnd.uniform(0.4, 0.6) * (1.0 - 0.3 * abs(math.sin(a)) * (math.cos(a) < 0))
        hair.append(lock('mane', root, [
            tuple(o * 0.18 + Vector((0, 0, -0.1))),
            tuple(o * 0.12 + Vector((rnd.uniform(-0.07, 0.07), 0, -length * 0.45))),
            tuple(o * 0.1 + Vector((rnd.uniform(-0.08, 0.08), 0, -length * 0.55))),
        ], [(0.15, 0.09), (0.16, 0.1), (0.13, 0.08), (0.07, 0.05)], M['hair']))
    for s in (-1, 1):  # braids from the temples down over the chest, bone beads and a fang
        root = snap(head, centre, (s, -0.45, -0.15), -0.02, reach=1.2)
        if not root:
            continue
        p = Vector(root)
        for b in range(6):
            p = p + Vector((s * 0.01, -0.012, -0.075))
            hair.append(sphere('braid', (0.045, 0.04, 0.05), tuple(p + Vector((s * 0.012 * (b % 2), 0, 0))), M['hair'], segs=10, rings=6))
        hair.append(ring('braid_ring', tuple(p + Vector((0, 0, -0.04))), 0.04, 0.014, M['bone']))
        f = cone('braid_fang', 0.025, 0.0, 0.1, tuple(p + Vector((0, 0, -0.11))), M['bone'], verts=6)
        f.rotation_euler = (math.pi, 0, 0)
        hair.append(f)
    out.append(piece('barbarian_hair', hair, kit, 'head'))

    # Dagged loincloth: faction-red centre panel between leather flaps, hanging from the belt.
    def dag(i, j, n, m):
        return 0

    for x0, x1, mat, g in ((-0.12, 0.12, M['cloth'], 0.05), (-0.27, -0.12, M['leather'], 0.04), (0.12, 0.27, M['leather'], 0.04)):
        cols = 6
        xs = [x0 + (x1 - x0) * i / cols for i in range(cols + 1)]
        panel = conform_panel('flap', torso, xs, top=lambda x: 0.5,
                              hem=lambda x, x0=x0, x1=x1: 0.06 + 0.07 * (round((x - x0) / (x1 - x0) * 6) % 2),
                              rows=8, gap=g, mats=[mat], zone=dag, flare=0.06, thick=0.012)
        out.append(tag(panel, kit, 'hips'))
    out[-3:] = [piece('barbarian_loincloth', out[-3:], kit, 'hips')]

    # Bearded war axe carried head-down in the right hand, blade facing out (-X).
    hand = Vector((-0.49, -0.123, 0.654))
    down = Vector((-0.06, -0.02, -1)).normalized()
    parts = [rod('haft', hand - down * 0.28, hand + down * 0.62, 0.032, M['darkwood'], verts=10)]
    for t in (-0.22, 0.12, 0.3, 0.46):
        parts.append(rod('wrap', hand + down * (t - 0.02), hand + down * (t + 0.02), 0.038, M['leather'], verts=10))
    hc = hand + down * 0.5
    # blade profile in the XZ plane: narrow at the haft, sweeping into a long lower beard
    prof = [(0.0, 0.1), (-0.12, 0.13), (-0.26, 0.2), (-0.3, 0.05), (-0.3, -0.12), (-0.24, -0.26), (-0.14, -0.3),
            (-0.1, -0.16), (-0.04, -0.08), (0.0, -0.06)]
    verts = [(hc.x + px, hc.y, hc.z + pz) for px, pz in prof]
    blade = mesh_from('blade', verts, [tuple(range(len(verts)))], M['rust'])
    sol = blade.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = 0.045
    sol.offset = 0
    apply_modifiers(blade)
    parts.append(hard(blade, 0.008))
    edge = [(-0.26, 0.2), (-0.3, 0.05), (-0.3, -0.12), (-0.24, -0.26), (-0.14, -0.3)]
    for (ax, az), (bx, bz) in zip(edge, edge[1:]):
        parts.append(rod('edge', (hc.x + ax, hc.y, hc.z + az), (hc.x + bx, hc.y, hc.z + bz), 0.012, M['steel'], verts=6))
    parts.append(rod('collar', hc + Vector((0, 0, 0.12)), hc + Vector((0, 0, -0.08)), 0.05, M['brass'], verts=10))
    spike = cone('back_spike', 0.04, 0.0, 0.14, tuple(hc + Vector((0.08, 0, 0.02))), M['rust'], verts=6)
    aim(spike, (1, 0, 0))
    parts.append(spike)
    out.append(piece('barbarian_axe', parts, kit, 'handslotr'))

    return out, body


# --------------------------------------------------------------------------- build

def build():
    reset()
    M = {
        'steel': material('steel', (0.8, 0.82, 0.86), 0.3),
        'gold': material('gold', (0.85, 0.66, 0.24), 0.3),
        'gem': material('gem', (0.2, 0.55, 1.0), 0.15),
        'white': material('white', (0.93, 0.91, 0.86), 0.7),
        'cloth': material('cloth', (0.18, 0.37, 0.72), 0.7),
        'hair': material('hair', (0.78, 0.7, 0.9), 0.6),
        'fur': material('fur', (0.82, 0.74, 0.6), 0.9),
        'furdark': material('furdark', (0.5, 0.38, 0.26), 0.9),
        'rust': material('rust', (0.42, 0.4, 0.4), 0.55),
        'brass': material('brass', (0.7, 0.54, 0.26), 0.4),
        'bone': material('bone', (0.9, 0.85, 0.74), 0.6),
        'leather': material('leather', (0.35, 0.22, 0.13), 0.7),
        'darkwood': material('darkwood', (0.24, 0.15, 0.09), 0.7),
    }
    pieces = []
    for build_kit in (build_paladin, build_barbarian):
        kit_pieces, ref = build_kit(M)
        pieces += kit_pieces
        # remove the reference body before fitting the next kit (both sit at the origin)
        for o in list(bpy.data.objects):
            if o.get('reference'):
                bpy.data.objects.remove(o)
    export('gear.glb', pieces, texcoords=False, extras=True)
    return pieces


if __name__ == '__main__':
    build()
