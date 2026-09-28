"""Shared helpers for the headless Blender build scripts.

Conventions: 1 Blender unit = 1 tile. Blender is Z-up; the glTF exporter converts to Y-up,
so Blender -Y (the 'front') becomes world +Z, which faces the game camera.
Material names are contracts: src/map.js swaps each named material for a game material
(stone, wood, beam, plaster, roof, roof_faction, banner, gold, window, thatch).
"""
import math
import os

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'models', 'env')
os.makedirs(OUT, exist_ok=True)

_materials = {}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _materials.clear()


def material(name, color=(0.8, 0.8, 0.8), rough=0.9, vertex_colors=False):
    if name in _materials:
        return _materials[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    if vertex_colors:
        attr = m.node_tree.nodes.new('ShaderNodeVertexColor')
        attr.layer_name = 'Col'
        m.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    _materials[name] = m
    return m


def export(name, objects):
    path = os.path.join(OUT, name)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
    )
    print('wrote', path, os.path.getsize(path), 'bytes')


def cube(name, size, loc, mat=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if mat:
        o.data.materials.append(mat)
    return o


def cylinder(name, r, depth, loc, mat=None, verts=16, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    if mat:
        o.data.materials.append(mat)
    return o


def cone(name, r1, r2, depth, loc, mat=None, verts=16, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    if mat:
        o.data.materials.append(mat)
    return o


def mesh_from(name, verts, faces, mat=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    if mat:
        o.data.materials.append(mat)
    return o


def cut(target, cutter):
    """Boolean-subtract `cutter` from `target`, then delete the cutter."""
    mod = target.modifiers.new('cut', 'BOOLEAN')
    mod.object = cutter
    mod.operation = 'DIFFERENCE'
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier='cut')
    bpy.data.objects.remove(cutter)


def arch_cutter(width, height, depth, loc, axis='y'):
    """Box + half-cylinder, the shape of a round-topped doorway. `loc` is the bottom centre."""
    x, y, z = loc
    rect_h = height - width / 2
    box = cube('archbox', (width, depth, rect_h) if axis == 'y' else (depth, width, rect_h), (x, y, z + rect_h / 2))
    rot = (math.pi / 2, 0, 0) if axis == 'y' else (0, math.pi / 2, 0)
    top = cylinder('archtop', width / 2, depth, (x, y, z + rect_h), verts=24, rot=rot)
    bpy.ops.object.select_all(action='DESELECT')
    box.select_set(True)
    top.select_set(True)
    bpy.context.view_layer.objects.active = box
    bpy.ops.object.join()
    return box


def bevel(o, width=0.008, segments=2):
    m = o.modifiers.new('bevel', 'BEVEL')
    m.width = width
    m.segments = segments
    m.limit_method = 'ANGLE'


def box_uv(o, scale=1.0):
    """Cube-project UVs in world space so textures tile `scale` times per unit on every face
    and line up across neighbouring parts. Done with bmesh, so it needs no edit-mode context."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uv = bm.loops.layers.uv.verify()
    mw = o.matrix_world
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        u_i, v_i = [(1, 2), (0, 2), (0, 1)][ax]
        for loop in f.loops:
            p = mw @ loop.vert.co
            loop[uv].uv = (p[u_i] * scale, p[v_i] * scale)
    bm.to_mesh(o.data)
    bm.free()


def finish(objects, uv_scale=2.0, bevel_width=0.006):
    """Bevel and UV every mesh so hard edges catch light and textures tile evenly."""
    for o in objects:
        if o.type != 'MESH':
            continue
        if bevel_width:
            bevel(o, bevel_width)
        box_uv(o, uv_scale)
