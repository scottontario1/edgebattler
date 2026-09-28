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
    if bpy.app.background:
        bpy.ops.wm.read_factory_settings(use_empty=True)
    else:
        # Live session (driven over Blender MCP): factory settings would unload the MCP
        # add-on, so just empty the scene and purge orphaned data.
        for o in list(bpy.data.objects):
            bpy.data.objects.remove(o)
        for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
            for block in list(coll):
                if block.users == 0:
                    coll.remove(block)
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


def export(name, objects, texcoords=True, extras=False):
    path = os.path.join(OUT, name)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
        export_texcoords=texcoords, export_extras=extras,
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


# ---- modelling helpers shared by build_units.py and build_heroes.py ----

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


def snap(target, origin, direction, offset=0.0, reach=0.5):
    """Point on target's surface seen from outside along direction (through origin), pushed
    offset out along the surface normal. Casts from `reach` outside the origin against the
    evaluated mesh, so it follows armature-posed KayKit bodies and subdivided skins alike.
    `target` may be a list of objects; the first surface hit wins."""
    from mathutils import Vector
    o, d = Vector(origin), Vector(direction).normalized()
    start = o + d * reach
    dg = bpy.context.evaluated_depsgraph_get()
    best = None
    for t in (target if isinstance(target, (list, tuple)) else [target]):
        inv = t.matrix_world.inverted()
        hit, loc, nrm, _ = t.ray_cast(inv @ start, (inv.to_3x3() @ -d).normalized(), depsgraph=dg)
        if hit:
            w = t.matrix_world @ loc
            n = (t.matrix_world.inverted().transposed().to_3x3() @ nrm).normalized()
            dist = (w - start).length
            if best is None or dist < best[0]:
                best = (dist, w, n)
    if best is None:
        print('snap missed', origin)
        return None
    return tuple(best[1] + best[2] * offset)


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


def auto_smooth(o, degrees=30):
    """Smooth shading with hard edges above `degrees` (faceted creases stay crisp)."""
    activate(o)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(degrees))
    except (AttributeError, RuntimeError):
        bpy.ops.object.shade_smooth()
    return o


def wedge(name, pts, widths, thick, mat, centre=None, facing=None):
    """Chunky stylised lock/ribbon: a diamond cross-section swept along `pts`, `widths` wide
    and `thick` deep (scalar or per point), ending in a point when the last width is 0.
    The flat side faces away from `centre` (hair around a head) or along `facing`
    (a beard facing the viewer). Sharp creases down the middle read as anime hair clumps."""
    from mathutils import Vector
    P = [Vector(p) for p in pts]
    T = thick if isinstance(thick, (list, tuple)) else [thick] * len(P)
    verts, faces = [], []
    n_prev = None
    for i, p in enumerate(P):
        t = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        if facing is not None:
            n = Vector(facing).normalized()
        else:
            n = p - Vector(centre)
            n.z = 0 if abs(t.z) > 0.5 else n.z
            n = n.normalized() if n.length > 1e-6 else (n_prev or Vector((0, 1, 0)))
        s = t.cross(n)
        s = s.normalized() if s.length > 1e-6 else Vector((1, 0, 0))
        n = s.cross(t).normalized()
        n_prev = n
        w, th = widths[i] / 2, T[i] / 2
        if widths[i] <= 0:
            verts.append(tuple(p))
        else:
            verts += [tuple(p + s * w), tuple(p + n * th), tuple(p - s * w), tuple(p - n * th)]
    rings = [4 if widths[i] > 0 else 1 for i in range(len(P))]
    starts = [sum(rings[:i]) for i in range(len(P))]
    faces.append(tuple(reversed(range(4))))  # root cap
    for i in range(len(P) - 1):
        a, b = starts[i], starts[i + 1]
        if rings[i + 1] == 1:
            for k in range(4):
                faces.append((a + k, a + (k + 1) % 4, b))
        else:
            for k in range(4):
                faces.append((a + k, a + (k + 1) % 4, b + (k + 1) % 4, b + k))
    if rings[-1] == 4:
        faces.append(tuple(range(starts[-1], starts[-1] + 4)))
    o = mesh_from(name, verts, faces, mat)
    activate(o)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return auto_smooth(o, 30)
