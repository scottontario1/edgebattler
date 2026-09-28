"""Builds unit props (currently the cavalry horse) as GLB.

Run headless from the project root:
    blender -b --factory-startup -P tools/blender/build_units.py
It also runs inside a live Blender over Blender MCP (common.reset() keeps the add-on loaded).

Output: public/models/env/horse.glb
  Barded war horse sized for the chibi KayKit riders: ~0.8 long, saddle top at SADDLE_Y.
  Faces -Y (toward the camera once exported), origin on the ground under the saddle.
  The body, neck/head and tail are organic skin-modifier meshes (smooth shaded); tack is
  bevelled hard-surface. Nodes `neck` (pivot at the withers) and `tail` (pivot at the croup)
  are separate so src/models.js can animate them. Material names map to colours in
  models.js: coat, mane, blaze, hoof, leather, caparison (faction colour), trim, steel.
"""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(__file__))
from common import bevel, cone, cube, cylinder, export, material, mesh_from, reset  # noqa: E402

SADDLE_Y = 0.4  # keep in sync with HORSE_SADDLE_Y in src/models.js


def activate(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


def apply_modifiers(o):
    activate(o)
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def skin_chain(name, pts, radii, mat, levels=1):
    """Organic limb: a vertex chain wrapped by the Skin modifier, then subdivided.
    `radii` are (across, up) per point; single floats mean round."""
    me = bpy.data.meshes.new(name)
    me.from_pydata(pts, [(i, i + 1) for i in range(len(pts) - 1)], [])
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    skin = o.modifiers.new('skin', 'SKIN')
    skin.use_smooth_shade = True
    data = o.data.skin_vertices[0].data
    for i, r in enumerate(radii):
        data[i].radius = r if isinstance(r, tuple) else (r, r)
    data[0].use_root = True
    sub = o.modifiers.new('sub', 'SUBSURF')
    sub.levels = sub.render_levels = levels
    apply_modifiers(o)
    o.data.materials.append(mat)
    return o


def sphere(name, radii, loc, mat, segs=16, rings=10, rot=(0, 0, 0), smooth=True):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, radius=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = radii
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    if smooth:
        bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o


def hard(o, width=0.004):
    """Bevel a hard-surface tack piece so its edges catch the light."""
    bevel(o, width, 2)
    apply_modifiers(o)
    return o


def rod(name, a, b, r, mat, verts=6):
    """Cylinder from point a to point b (straps, reins)."""
    from mathutils import Vector
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(a + b) / 2)
    o = bpy.context.active_object
    o.name = name
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.to_track_quat('Z', 'Y')
    bpy.ops.object.transform_apply(rotation=True)
    o.data.materials.append(mat)
    return o


def snap(target, origin, direction, offset=0.0):
    """Point on target's surface seen from outside along direction (through origin), pushed
    offset out along the surface normal. Keeps face details on the subdivided skin surface."""
    from mathutils import Vector
    o, d = Vector(origin), Vector(direction).normalized()
    hit, loc, nrm, _ = target.ray_cast(o + d * 0.5, -d)
    if not hit:
        print('snap missed', target.name, origin)
        return tuple(o)
    return tuple(loc + nrm * offset)


def join(name, objects, pivot):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    bpy.context.scene.cursor.location = pivot
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    return o


def leg(parts, x, y, coat, points, hoof_mat, front):
    """Upper leg in the coat colour, dark 'stocking' below the knee/hock, flared hoof."""
    if front:  # shoulder -> elbow -> knee -> fetlock
        upper = [(x, y + 0.01, 0.32), (x, y, 0.22), (x, y - 0.005, 0.13)]
        lower = [(x, y - 0.005, 0.14), (x, y - 0.005, 0.075), (x, y - 0.012, 0.035)]
        ur = [0.05, 0.036, 0.022]
    else:  # hip -> stifle -> hock (angled back) -> fetlock
        upper = [(x, y - 0.03, 0.32), (x, y - 0.035, 0.22), (x, y + 0.03, 0.135)]
        lower = [(x, y + 0.03, 0.145), (x, y + 0.01, 0.075), (x, y - 0.002, 0.035)]
        ur = [0.062, 0.045, 0.024]
    parts.append(skin_chain('leg_upper', upper, ur, coat))
    parts.append(skin_chain('leg_lower', lower, [0.022, 0.017, 0.021], points))
    hoof = cone('hoof', 0.03, 0.022, 0.03, (x, lower[-1][1] - 0.004, 0.015), hoof_mat, verts=12)
    parts.append(hard(hoof, 0.003))


def caparison(capa, trim):
    """Dagged cloth barding draped over the barrel: a half-oval profile over the back that
    drops to a scalloped hem, extruded nose to tail, with a gold band along the hem."""
    rx, rz, cz = 0.121, 0.114, 0.29  # just outside the body skin
    hem = 0.165
    y0, y1, ny = -0.2, 0.22, 22
    arc = [math.radians(a) for a in range(-100, 101, 10)]  # 0 = straight up
    profile = []
    for side in (-1, 1):
        drop = [(side * rx * 1.02, cz + math.cos(math.radians(100)) * rz - k * 0.02) for k in range(1, 7)]
        if side < 0:
            profile += list(reversed(drop))
    profile += [(math.sin(a) * rx, cz + math.cos(a) * rz) for a in arc]
    profile += [(rx * 1.02, cz + math.cos(math.radians(100)) * rz - k * 0.02) for k in range(1, 7)]
    n = len(profile)
    verts, faces, trim_faces = [], [], set()
    for j in range(ny + 1):
        t = j / ny
        y = y0 + (y1 - y0) * t
        flare = 1 + 0.06 * abs(t - 0.5)  # a little wider at the chest and rump
        dag = 0.022 if j % 2 else 0.0  # alternating points form the dagged hem
        for i, (px, pz) in enumerate(profile):
            edge = i == 0 or i == n - 1
            z = max(pz, hem - dag) if not edge else hem - dag
            verts.append((px * flare, y, z))
    for j in range(ny):
        for i in range(n - 1):
            a = j * n + i
            f = (a, a + 1, a + n + 1, a + n)
            faces.append(f)
            if i < 2 or i >= n - 3:
                trim_faces.add(len(faces) - 1)
    o = mesh_from('caparison', verts, faces, capa)
    o.data.materials.append(trim)
    for k in trim_faces:
        o.data.polygons[k].material_index = 1
    sol = o.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = 0.006
    sol.offset = 1
    apply_modifiers(o)
    activate(o)
    bpy.ops.object.shade_smooth()
    return o


def build_horse():
    reset()
    coat, mane = material('coat', (0.47, 0.27, 0.15), 0.7), material('mane', (0.1, 0.07, 0.05), 0.8)
    blaze, hoof = material('blaze', (0.93, 0.9, 0.84), 0.7), material('hoof', (0.17, 0.15, 0.13), 0.6)
    leather, steel = material('leather', (0.35, 0.2, 0.11), 0.6), material('steel', (0.75, 0.78, 0.82), 0.3)
    capa, trim = material('caparison', (0.18, 0.37, 0.72), 0.75), material('trim', (0.83, 0.66, 0.24), 0.35)
    parts = []

    # Barrel: deep chest, dipped back, rounded rump.
    parts.append(skin_chain('body', [
        (0, 0.28, 0.305), (0, 0.2, 0.31), (0, 0.08, 0.29), (0, -0.06, 0.29), (0, -0.18, 0.305), (0, -0.24, 0.31),
    ], [(0.07, 0.06), (0.1, 0.095), (0.1, 0.1), (0.104, 0.105), (0.1, 0.11), (0.07, 0.08)], coat, levels=2))
    for x in (-0.058, 0.058):
        leg(parts, x, -0.18, coat, mane, hoof, True)
        leg(parts, x, 0.2, coat, mane, hoof, False)

    # Barding, saddle and stirrups.
    parts.append(caparison(capa, trim))
    for x in (-0.136, 0.136):
        crest = cube('crest', (0.006, 0.05, 0.05), (x, 0.06, 0.25), trim, rot=(math.pi / 4, 0, 0))
        parts.append(hard(crest, 0.002))
    parts.append(hard(cube('saddle', (0.13, 0.17, 0.035), (0, 0.0, SADDLE_Y + 0.005), leather), 0.01))
    parts.append(hard(cube('pommel', (0.05, 0.03, 0.03), (0, -0.08, SADDLE_Y + 0.025), leather), 0.012))
    parts.append(hard(cube('cantle', (0.1, 0.022, 0.035), (0, 0.08, SADDLE_Y + 0.028), leather), 0.009))
    parts.append(hard(cube('saddle_trim', (0.134, 0.174, 0.008), (0, 0.0, SADDLE_Y - 0.01), trim), 0.003))
    for x in (-0.13, 0.13):
        parts.append(cube('strap', (0.006, 0.018, 0.17), (x, 0.0, 0.29), leather))
        ring = bpy.ops.mesh.primitive_torus_add(major_radius=0.018, minor_radius=0.005, major_segments=12, minor_segments=5, location=(x * 1.03, 0.0, 0.2),
                                                rotation=(0, math.pi / 2, 0))
        s = bpy.context.active_object
        s.name = 'stirrup'
        s.data.materials.append(steel)
        parts.append(s)

    # Neck + head: one node pivoting at the withers.
    head = skin_chain('head', [(0, -0.33, 0.585), (0, -0.375, 0.55), (0, -0.43, 0.49), (0, -0.46, 0.455)],
                      [(0.04, 0.045), (0.045, 0.048), (0.032, 0.036), (0.03, 0.03)], coat, levels=2)
    neck_parts = [
        head,
        skin_chain('neck', [(0, -0.16, 0.34), (0, -0.25, 0.43), (0, -0.31, 0.53), (0, -0.33, 0.575)],
                   [(0.07, 0.095), (0.055, 0.075), (0.042, 0.055), (0.036, 0.042)], coat, levels=2),
        skin_chain('mane', [(0, -0.15, 0.4), (0, -0.23, 0.48), (0, -0.29, 0.57), (0, -0.325, 0.615)],
                   [(0.014, 0.035), (0.016, 0.04), (0.014, 0.035), (0.012, 0.02)], mane),
        skin_chain('forelock', [(0, -0.345, 0.615), (0, -0.37, 0.585)], [(0.014, 0.012), (0.008, 0.006)], mane),
    ]
    # The head runs from the poll down to the muzzle at 45 degrees. FACE is the rotation about
    # X that lays a plate along its front; details are snapped onto the real skin surface.
    FACE = -math.pi / 4
    front = (0, -0.707, 0.707)
    neck_parts.append(hard(cube('chanfron', (0.042, 0.007, 0.07), snap(head, (0, -0.385, 0.545), front, 0.004),
                                steel, rot=(FACE, 0, 0)), 0.003))
    neck_parts.append(cone('chanfron_spike', 0.008, 0.0, 0.026, snap(head, (0, -0.37, 0.56), front, 0.018),
                           steel, verts=8, rot=(FACE + math.pi / 2, 0, 0)))
    neck_parts.append(hard(cube('blaze', (0.014, 0.003, 0.04), snap(head, (0, -0.44, 0.49), front, 0.0),
                                blaze, rot=(FACE, 0, 0)), 0.0015))
    for side in (-1, 1):
        x = side * 0.02
        neck_parts.append(cone('ear', 0.011, 0.0, 0.032, (x, -0.33, 0.625), coat, verts=8, rot=(-0.25, side * 0.2, 0)))
        neck_parts.append(sphere('eye', (0.008, 0.008, 0.008), snap(head, (0, -0.37, 0.56), (side, -0.15, 0.2)),
                                 mane, segs=10, rings=6))
        neck_parts.append(sphere('nostril', (0.006, 0.005, 0.005), snap(head, (x * 0.7, -0.455, 0.46), (0, -0.8, -0.3)),
                                 mane, segs=8, rings=4))
    # Bridle: noseband around the muzzle, cheekpieces up the face, reins back over the withers.
    bpy.ops.mesh.primitive_torus_add(major_radius=0.031, minor_radius=0.005, major_segments=16, minor_segments=5, location=(0, -0.435, 0.485),
                                     rotation=(FACE, 0, 0))
    noseband = bpy.context.active_object
    noseband.data.materials.append(leather)
    neck_parts.append(noseband)
    for side in (-1, 1):
        cheek_lo = snap(head, (0, -0.435, 0.485), (side, 0, 0), 0.004)
        cheek_hi = snap(head, (0, -0.345, 0.575), (side, 0, 0), 0.004)
        neck_parts.append(rod('cheekpiece', cheek_lo, cheek_hi, 0.005, leather))
        neck_parts.append(rod('rein', cheek_lo, (side * 0.05, -0.14, 0.43), 0.004, leather))
    neck_node = join('neck', neck_parts, (0, -0.2, 0.34))

    # Tail: thick flowing tuft from the croup.
    tail_node = skin_chain('tail', [(0, 0.27, 0.34), (0, 0.33, 0.32), (0, 0.36, 0.24), (0, 0.355, 0.14)],
                           [(0.025, 0.03), (0.032, 0.036), (0.038, 0.03), (0.018, 0.012)], mane)
    activate(tail_node)
    bpy.context.scene.cursor.location = (0, 0.29, 0.34)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

    body = join('horse', parts, (0, 0, 0))
    for child in (neck_node, tail_node):
        child.parent = body
        child.matrix_parent_inverse = body.matrix_world.inverted()
    export('horse.glb', [body, neck_node, tail_node], texcoords=False)  # colour-only materials
    return body


build_horse()
