"""Builds environment models for the battlefield and exports them as GLB.

Run headless from the project root:
    blender -b --factory-startup -P tools/blender/build_env.py

Outputs (public/models/env/):
  stone_bridge.glb   arched stone bridge over the 1-tile river gorge (spans X, deck top at local y=0)
  cliff_backdrop.glb cliffs, plateau and peaks behind the north map edge, with a notch for the waterfall

Blender is Z-up; the glTF exporter converts to Y-up, so Blender +Y becomes world -Z (north).
Scale: 1 Blender unit = 1 tile.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))

import bmesh
import bpy
from mathutils import Vector, noise

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'models', 'env')
os.makedirs(OUT, exist_ok=True)

# Must match src/map.js: land top sits at LAND_TOP, water surface at WATER_Y.
LAND_TOP = 0.52
WATER_Y = 0.16
RIVER_X = -0.5  # world x of the river's column where it leaves the north edge (column 7)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, rough=0.9, vertex_colors=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    if vertex_colors:
        attr = m.node_tree.nodes.new('ShaderNodeVertexColor')
        attr.layer_name = 'Col'
        m.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    return m


def export(path, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
    )
    print('wrote', path, os.path.getsize(path), 'bytes')


def cube(name, size, loc):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return o


def bevel(o, width=0.012, segments=2):
    m = o.modifiers.new('bevel', 'BEVEL')
    m.width = width
    m.segments = segments
    m.limit_method = 'ANGLE'


from common import box_uv  # noqa: E402


# ---------------------------------------------------------------- stone bridge
def build_bridge():
    reset()
    stone = material('stone', (0.78, 0.75, 0.68))
    parts = []

    length, width, depth = 1.5, 0.62, LAND_TOP - WATER_Y + 0.12
    # Solid body from deck down into the water, then cut the arch out of it.
    body = cube('body', (length, width - 0.08, depth), (0, 0, -depth / 2 - 0.05))
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.4, depth=width + 0.2,
                                        location=(0, 0, -depth - 0.05), rotation=(math.pi / 2, 0, 0))
    arch = bpy.context.active_object
    arch.scale = (1.0, 1.0, 1.0)
    cut = body.modifiers.new('arch', 'BOOLEAN')
    cut.object = arch
    cut.operation = 'DIFFERENCE'
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier='arch')
    bpy.data.objects.remove(arch)
    parts.append(body)

    # Voussoir ring: wedge stones around the arch opening, slightly proud of the wall.
    n = 13
    for i in range(n):
        a = math.pi * (i + 0.5) / n
        r = 0.45
        x, z = math.cos(a) * r, math.sin(a) * r - depth - 0.05
        for side in (-1, 1):
            # Width = arc length per stone minus a 6 mm mortar gap, so the ring reads as continuous.
            s = cube(f'vous{i}{side}', (math.pi * r / n - 0.006, 0.03, 0.1), (x, side * (width - 0.08) / 2, z))
            s.rotation_euler = (0, -(a - math.pi / 2), 0)
            parts.append(s)

    deck = cube('deck', (length + 0.04, width, 0.06), (0, 0, -0.03))
    parts.append(deck)

    # Parapets with a cap course, broken into blocks so the silhouette reads as masonry.
    rng = random.Random(3)
    for side in (-1, 1):
        y = side * (width / 2 - 0.035)
        x = -length / 2
        while x < length / 2 - 0.01:
            w = min(rng.uniform(0.12, 0.2), length / 2 - x)
            parts.append(cube('wall', (w - 0.006, 0.07, 0.09), (x + w / 2, y, 0.045)))
            x += w
        parts.append(cube('cap', (length + 0.02, 0.09, 0.025), (0, y, 0.1)))
        for px in (-length / 2, length / 2):
            parts.append(cube('post', (0.1, 0.1, 0.17), (px, y, 0.085)))
            parts.append(cube('postcap', (0.12, 0.12, 0.03), (px, y, 0.185)))

    # Abutments: stepped wing walls laid against the gorge faces on both banks (the gorge walls
    # sit at x = +-0.5, the tile edges), so the bridge is anchored into the banks rather than
    # resting on them, plus a few riprap boulders where the walls meet the water.
    bed = -(LAND_TOP - 0.05)
    for sx in (-1, 1):
        for sy in (-1, 1):
            steps = 4
            for k in range(steps):
                y0 = (width / 2 - 0.05) + k * 0.1
                top = -0.02 - k * 0.07
                h = top - bed
                parts.append(cube(f'wing{sx}{sy}{k}', (0.08 - k * 0.008, 0.1 - 0.004, h),
                                  (sx * (0.5 - 0.035 + k * 0.004), sy * (y0 + 0.05), bed + h / 2)))
                parts.append(cube(f'wingcap{sx}{sy}{k}', (0.1 - k * 0.008, 0.1, 0.025),
                                  (sx * (0.5 - 0.035 + k * 0.004), sy * (y0 + 0.05), top + 0.012)))
        for i in range(3):
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=rng.uniform(0.04, 0.07),
                                                  location=(sx * rng.uniform(0.36, 0.44), rng.uniform(-0.4, 0.4),
                                                            -(LAND_TOP - WATER_Y) - 0.01))
            b = bpy.context.active_object
            b.name = 'riprap'
            b.scale = (1.0, rng.uniform(0.8, 1.3), 0.7)
            bpy.ops.object.transform_apply(scale=True)
            parts.append(b)

    for o in parts:
        o.data.materials.append(stone)
        bevel(o, 0.01 if o.name != 'body' else 0.02)
        box_uv(o, scale=2.0)
    export(os.path.join(OUT, 'stone_bridge.glb'), parts)


# ---------------------------------------------------------------- cliff backdrop
def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def backdrop_height(x, y):
    """y = distance north of the map edge (tiles). Returns height above the floor (world y)."""
    n = noise.fractal(Vector((x * 0.55, y * 0.55, 1.7)), 0.55, 2.1, 5)
    cliff_top = 1.45 + n * 0.18
    # Sheer cliff right behind the map, then a plateau, then a range of peaks.
    h = cliff_top * smoothstep(0.05, 0.55, y)
    ridge = max(0.0, noise.fractal(Vector((x * 0.28, y * 0.3, 5.3)), 0.6, 2.0, 4) + 0.35)
    h += smoothstep(2.2, 5.0, y) * (0.8 + ridge * 2.6)
    # River channel cut into the plateau, feeding the waterfall.
    channel = math.exp(-((x - RIVER_X) / 0.32) ** 2) * (1 - smoothstep(2.4, 3.6, y))
    h -= channel * 0.2 * smoothstep(0.3, 0.7, y)
    # Cliff face: buttresses (low-frequency bulges along x), terraced ledges, and fine rock noise.
    face = 1 - smoothstep(0.7, 1.2, y)
    h += noise.noise(Vector((x * 1.3, 0.0, 2.2))) * 0.25 * face * smoothstep(0.0, 0.3, y)
    h = h - (h % 0.18) * 0.35 * face  # terracing: flatten each 18 cm band slightly into a ledge
    h += noise.noise(Vector((x * 4.0, y * 4.0, h * 3.0))) * 0.07 * face
    return max(0.0, h)


def backdrop_color(p, slope):
    """Smoothly varying colour: grass on flats, banded rock on steep faces, snow on high peaks."""
    x, y, z = p
    n = noise.noise(Vector((x * 0.9, y * 0.9, 0.5))) * 0.5 + 0.5
    if z > 3.3 and slope < 0.7:
        return (0.9, 0.91, 0.94)
    if slope > 0.5:
        band = 0.85 + 0.15 * math.sin(z * 22 + noise.noise(Vector((x * 2, y, 0))) * 2)
        k = (0.8 + n * 0.35) * band
        return (0.46 * k, 0.4 * k, 0.33 * k)
    k = 0.85 + n * 0.3
    dry = smoothstep(2.0, 3.2, z)  # higher meadows fade toward olive
    return ((0.23 + dry * 0.12) * k, (0.42 - dry * 0.04) * k, (0.15 + dry * 0.03) * k)


def build_backdrop():
    reset()
    x0, x1, y0, y1 = -11.0, 11.0, -0.2, 7.0
    nx, ny = 220, 72
    bm = bmesh.new()
    verts = []
    for j in range(ny + 1):
        for i in range(nx + 1):
            x = x0 + (x1 - x0) * i / nx
            y = y0 + (y1 - y0) * j / ny
            # Pack rows tighter near the cliff so the vertical face gets enough geometry.
            y = y0 + (y1 - y0) * (j / ny) ** 1.6
            verts.append(bm.verts.new((x, y, backdrop_height(x, y))))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            bm.faces.new((verts[a], verts[a + 1], verts[a + nx + 2], verts[a + nx + 1]))
    bm.normal_update()

    # Colour by slope and height: grass on flats, rock on steep faces, snow on peaks.
    col = bm.loops.layers.color.new('Col')
    for f in bm.faces:
        c = backdrop_color(f.calc_center_median(), 1 - abs(f.normal.z))
        for loop in f.loops:
            loop[col] = (*c, 1.0)

    me = bpy.data.meshes.new('backdrop')
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('backdrop', me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(material('backdrop', (1, 1, 1), 0.95, vertex_colors=True))
    export(os.path.join(OUT, 'cliff_backdrop.glb'), [o])


build_bridge()
build_backdrop()
