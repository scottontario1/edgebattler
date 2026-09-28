"""Builds unit props (currently the cavalry horse) as GLB.

Run headless from the project root:
    blender -b --factory-startup -P tools/blender/build_units.py

Output: public/models/env/horse.glb
  Low-poly war horse sized for the chibi KayKit riders: ~0.75 long, saddle top at SADDLE_Y.
  Faces -Y (toward the camera once exported), origin on the ground under the saddle.
  Nodes `neck` (pivot at the withers) and `tail` (pivot at the croup) are separate so
  src/models.js can animate them. Material names map to colours in models.js:
  coat, mane, hoof, leather, caparison (faction colour), trim, steel.
"""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(__file__))
from common import cone, cube, cylinder, export, material, reset  # noqa: E402

SADDLE_Y = 0.4  # keep in sync with HORSE_SADDLE_Y in src/models.js


def sphere(name, radii, loc, mat, segs=12, rings=8, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, radius=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = radii
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    o.data.materials.append(mat)
    return o


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


def limb(parts, x, y, coat, hoof, front):
    """Tapered leg with a knee bulge and a dark hoof; hind legs angle back slightly."""
    tilt = 0.0 if front else 0.12
    upper = cone('thigh', 0.05, 0.034, 0.12, (x, y + tilt * 0.3, 0.17), coat, verts=8, rot=(tilt, 0, 0))
    lower = cylinder('shin', 0.026, 0.12, (x, y, 0.08), coat, verts=8)
    knee = sphere('knee', (0.032, 0.032, 0.03), (x, y, 0.115), coat, segs=8, rings=6)
    h = cylinder('hoof', 0.034, 0.035, (x, y - 0.004, 0.0175), hoof, verts=8)
    parts += [upper, lower, knee, h]


def build_horse():
    reset()
    coat, mane = material('coat', (0.54, 0.35, 0.21)), material('mane', (0.16, 0.11, 0.08))
    hoof, leather = material('hoof', (0.17, 0.15, 0.13)), material('leather', (0.35, 0.23, 0.13))
    capa, trim = material('caparison', (0.18, 0.37, 0.72)), material('trim', (0.83, 0.66, 0.24))
    steel = material('steel', (0.72, 0.75, 0.78))
    parts = []

    # Barrel-shaped body with rounded chest and rump.
    parts.append(sphere('body', (0.105, 0.24, 0.1), (0, 0.0, 0.29), coat))
    parts.append(sphere('chest', (0.1, 0.1, 0.1), (0, -0.19, 0.3), coat))
    parts.append(sphere('rump', (0.11, 0.11, 0.1), (0, 0.19, 0.3), coat))
    for x in (-0.055, 0.055):
        limb(parts, x, -0.19, coat, hoof, True)
        limb(parts, x, 0.2, coat, hoof, False)

    # Caparison: faction cloth over the back with a gold hem, saddle and stirrups on top.
    capa_o = cylinder('caparison', 0.12, 0.38, (0, 0.01, 0.29), capa, verts=14, rot=(math.pi / 2, 0, 0))
    capa_o.scale = (1.0, 0.92, 1.0)
    parts.append(capa_o)
    for x in (-0.119, 0.119):
        parts.append(cube('trim', (0.006, 0.36, 0.018), (x, 0.01, 0.255), trim))
        parts.append(cube('crest', (0.004, 0.06, 0.06), (x * 1.02, 0.1, 0.3), trim, rot=(0.785, 0, 0)))
    parts.append(cube('saddle', (0.13, 0.17, 0.035), (0, 0.0, SADDLE_Y + 0.005), leather))
    parts.append(cube('pommel', (0.06, 0.03, 0.05), (0, -0.08, SADDLE_Y + 0.03), leather))
    parts.append(cube('cantle', (0.1, 0.025, 0.05), (0, 0.085, SADDLE_Y + 0.03), leather))
    for x in (-0.125, 0.125):
        parts.append(cube('strap', (0.008, 0.02, 0.16), (x, 0.0, 0.29), leather))
        parts.append(cube('stirrup', (0.02, 0.03, 0.012), (x, 0.0, 0.2), steel))

    # Neck + head as one node pivoting at the withers.
    neck_parts = []
    neck = cone('neck', 0.075, 0.05, 0.24, (0, -0.28, 0.42), coat, verts=10, rot=(0.65, 0, 0))
    head = sphere('head', (0.05, 0.1, 0.05), (0, -0.4, 0.51), coat, rot=(0.55, 0, 0))
    muzzle = sphere('muzzle', (0.042, 0.05, 0.04), (0, -0.465, 0.46), coat)
    neck_parts += [neck, head, muzzle]
    for x in (-0.025, 0.025):
        neck_parts.append(cone('ear', 0.015, 0.0, 0.05, (x, -0.35, 0.585), coat, verts=5, rot=(0.2, 0, 0)))
        neck_parts.append(sphere('eye', (0.009, 0.009, 0.009), (x * 1.75, -0.41, 0.53), hoof, segs=6, rings=4))
    for k in range(6):  # mane tufts along the crest
        f = k / 5
        neck_parts.append(cube('mane', (0.022, 0.05, 0.05),
                               (0, -0.22 - f * 0.12, 0.42 + f * 0.12), mane, rot=(0.65, 0, 0)))
    neck_parts.append(cube('chanfron', (0.045, 0.08, 0.02), (0, -0.44, 0.515), steel, rot=(0.9, 0, 0)))
    neck_parts.append(cube('bridle', (0.1, 0.012, 0.012), (0, -0.44, 0.475), leather))
    neck_parts.append(cube('rein', (0.006, 0.26, 0.006), (0.04, -0.3, 0.44), leather, rot=(0.35, 0, 0)))
    neck_parts.append(cube('rein', (0.006, 0.26, 0.006), (-0.04, -0.3, 0.44), leather, rot=(0.35, 0, 0)))
    neck_node = join('neck', neck_parts, (0, -0.2, 0.34))

    # Tail: long tapered tuft hanging from the croup.
    tail_parts = [
        cone('tail', 0.035, 0.012, 0.22, (0, 0.33, 0.24), mane, verts=8, rot=(-0.35, 0, 0)),
        sphere('tail_root', (0.03, 0.03, 0.03), (0, 0.29, 0.34), mane, segs=8, rings=6),
    ]
    tail_node = join('tail', tail_parts, (0, 0.29, 0.34))

    body = join('horse', parts, (0, 0, 0))
    neck_node.parent = body
    tail_node.parent = body
    neck_node.matrix_parent_inverse = body.matrix_world.inverted()
    tail_node.matrix_parent_inverse = body.matrix_world.inverted()
    for o in (body, neck_node, tail_node):
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.shade_flat()
    export('horse.glb', [body, neck_node, tail_node])


build_horse()
