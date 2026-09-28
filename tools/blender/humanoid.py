"""Universal humanoid standard for the cast (heroic tactics miniature, ~3.75 heads tall).

Every character in the illustrated 2.5D direction is built on this: same proportions, same
joint hierarchy, same head/face convention, so Mages, Cavaliers, Archers and Wyvern Riders
can be dressed on it systematically (see build_heroes.py for two complete examples).

PROPORTIONS (game units: 1 = one tile; feet on Z=0, facing -Y, which is +Z in three.js)
  head 0.32 (chin z=0.86, crown z=1.18)  ->  ~3.75 heads, ~1.18 tall
  shoulders z=0.775, waist z=0.585 (narrowest), crotch z~0.48, knee ~0.27, ankle 0.075
  slender limbs with real joints (elbow, knee), defined chest -> narrow waist -> hips,
  heeled fitted boots (never flat boards), mitten/gauntlet hands.
STANCE  a dynamic ready stance, not an A-pose: knees bent, weight on the back (left) leg,
  right foot forward and turned out, torso leaning 6 degrees and twisted 12 degrees so the
  right (weapon) shoulder leads. Joints come from make_joints() with two-bone IK.
NODES  (animated as rigid parts in src/models.js, rest pose = this pose)
  hero > hips > torso > head, arm_l > fore_l, arm_r > fore_r, cape
         hips > thigh_l > shin_l, thigh_r > shin_r
  Each node's origin is its joint, so rotating a node bends the limb there.
FACE  The head is one smooth loft (no eye/pupil meshes). Its UVs are a planar front
  projection over FACE_UV, and it carries the material `face`; src/faces.js paints the
  anime face (lashes, iris, specular dot, brows) as a flat texture per unit.
MATERIALS  see src/models.js: cloth/fur/skin are matte (roughness 0.9+), metals are cel
  shaded, and an inverted-hull outline is added at load.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    activate, apply_modifiers, auto_smooth, cone, cube, hard, join, mesh_from, paint, rod, sphere,
)

# ---- the standard -----------------------------------------------------------------
HEAD_H = 0.32
CHIN = 0.86
CROWN = CHIN + HEAD_H
HEAD_C = Vector((0.0, 0.008, 1.03))  # centre used for "surface point on the head" rays
FACE_UV = (-0.13, 0.13, 0.85, 1.19)  # x0, x1, z0, z1 of the front-projected face texture
HIP_Z, WAIST_Z, CHEST_Z, SHOULDER_Z, NECK_Z = 0.505, 0.585, 0.70, 0.775, 0.79
THIGH_LEN, SHIN_LEN, UPPER_LEN, FORE_LEN = 0.245, 0.235, 0.185, 0.17
ANKLE_Z = 0.075

STANCE = {
    'hip_x': 0.072,
    'ankle_r': (-0.105, -0.075), 'ankle_l': (0.115, 0.055),   # x, y (right foot forward)
    'toe_r': (-0.25, -1.0), 'toe_l': (0.75, -0.65),           # horizontal toe directions
    'twist': 12.0, 'lean': 6.0,                               # degrees
}


def V(*a):
    return Vector(a[0] if len(a) == 1 else a)


# ---- geometry helpers -------------------------------------------------------------

def orient_z(o, direction):
    """Rotate an object built along +Z so it points along `direction`. Rotates about the part's
    own centre (some helpers bake their location into the mesh, leaving the origin at 0)."""
    c = sum((o.matrix_world @ Vector(v) for v in o.bound_box), Vector()) / 8
    q = Vector(direction).normalized().to_track_quat('Z', 'Y')
    xform([o], Matrix.Translation(c) @ q.to_matrix().to_4x4() @ Matrix.Translation(-c))
    return o


def tube(name, a, b, r0, r1, mat, sides=12, smooth=True):
    """Tapered cylinder from a (radius r0) to b (radius r1)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=sides, radius1=r0, radius2=r1, depth=d.length, location=(a + b) / 2)
    o = bpy.context.active_object
    o.name = name
    orient_z(o, d)
    if smooth:
        bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o


def ball(name, p, r, mat, scale=(1, 1, 1), segs=14, rings=9, smooth=True):
    return sphere(name, (r * scale[0], r * scale[1], r * scale[2]), tuple(p), mat, segs=segs, rings=rings, smooth=smooth)


def recalc(o):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data)
    bm.free()


def loft(name, stations, mat, sides=16, caps=(True, True), smooth=True, subsurf=0):
    """Smooth solid through cross-section stations (c, ru, rv, u, v): ring = c + u cos ru + v sin rv.
    Angle 0 is +u; with u=+X, v=+Y the front (-Y) is at 3/4 of the ring."""
    verts, faces = [], []
    for st in stations:
        c, ru, rv = Vector(st[0]), st[1], st[2]
        u = Vector(st[3]) if len(st) > 3 else Vector((1, 0, 0))
        v = Vector(st[4]) if len(st) > 4 else Vector((0, 1, 0))
        for k in range(sides):
            a = 2 * math.pi * k / sides
            verts.append(tuple(c + u * (math.cos(a) * ru) + v * (math.sin(a) * rv)))
    n = len(stations)
    for i in range(n - 1):
        for k in range(sides):
            a, b = i * sides + k, i * sides + (k + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    if caps[0]:
        faces.append(tuple(reversed(range(sides))))
    if caps[1]:
        faces.append(tuple(range((n - 1) * sides, n * sides)))
    o = mesh_from(name, verts, faces, mat)
    recalc(o)
    if subsurf:
        m = o.modifiers.new('sub', 'SUBSURF')
        m.levels = m.render_levels = subsurf
        apply_modifiers(o)
    activate(o)
    if smooth:
        bpy.ops.object.shade_smooth()
    return o


def xform(objs, M):
    """Bake matrix M into the objects' geometry (objects end with identity transforms)."""
    for o in objs:
        o.data.transform(M @ o.matrix_world)
        o.matrix_world = Matrix.Identity(4)
    return objs


def ik2(a, b, l1, l2, pole):
    """Two-bone IK: joint between a and b (lengths l1, l2), bending toward `pole`. -> (mid, end)."""
    a, b, pole = Vector(a), Vector(b), Vector(pole)
    d = b - a
    dist = min(d.length, (l1 + l2) * 0.999)
    dn = d.normalized()
    x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
    h = math.sqrt(max(l1 * l1 - x * x, 0.0))
    pp = pole - dn * pole.dot(dn)
    pp = pp.normalized() if pp.length > 1e-6 else Vector((0, -1, 0))
    return a + dn * x + pp * h, a + dn * dist


def torso_matrix(twist, lean):
    piv = Vector((0, 0, WAIST_Z))
    return (Matrix.Translation(piv) @ Matrix.Rotation(math.radians(twist), 4, 'Z')
            @ Matrix.Rotation(math.radians(lean), 4, 'X') @ Matrix.Translation(-piv))


def make_joints(hand_r, hand_l, ws=1.0, stance=None):
    """All joint positions for the ready stance. hand_r / hand_l are world targets for the wrists."""
    st = dict(STANCE, **(stance or {}))
    Mt = torso_matrix(st['twist'], st['lean'])
    J = {'Mt': Mt, 'pelvis': V(0, 0.005, HIP_Z), 'waist': V(0, 0, WAIST_Z)}
    J['neck'] = Mt @ V(0, 0, NECK_Z)
    for side, s in (('l', 1), ('r', -1)):
        hip = V(s * st['hip_x'], 0.0, HIP_Z - 0.01)
        ankle = V(*st['ankle_' + side], st.get('ankle_z', ANKLE_Z))
        pole = V(s * st.get('knee_out', 0.12), -1.0, 0.0)
        knee, ankle = ik2(hip, ankle, THIGH_LEN, SHIN_LEN, pole)
        toe = V(*st['toe_' + side], 0.0).normalized()
        sh = Mt @ V(s * 0.155 * ws, 0, SHOULDER_Z)
        hand = hand_l if side == 'l' else hand_r
        elbow, wrist = ik2(sh, hand, UPPER_LEN, FORE_LEN, V(s * 0.6, 0.55, -0.6))
        J.update({'hip_' + side: hip, 'knee_' + side: knee, 'ankle_' + side: ankle, 'toe_' + side: toe,
                  'sh_' + side: sh, 'el_' + side: elbow, 'wr_' + side: wrist})
    return J


# ---- head -------------------------------------------------------------------------

def head_stations(jaw=1.0, chin=1.0, scale=1.0):
    """Anime head: tall oval cranium, tapering to a clean chin. jaw widens the lower face."""
    def st(z, cy, ru, rv, lower=0.0):
        k = 1 + (jaw - 1) * lower
        return ((0, cy, z), ru * k * scale, rv * (1 + (jaw - 1) * 0.5 * lower) * scale)
    return [
        st(CHIN, -0.045 * chin, 0.024, 0.024, 1),
        st(0.885, -0.032, 0.056, 0.05, 1),
        st(0.93, -0.014, 0.093, 0.084, 1),
        st(0.98, -0.001, 0.117, 0.108, 0.6),
        st(1.04, 0.006, 0.127, 0.118),
        st(1.10, 0.009, 0.124, 0.118),
        st(1.145, 0.011, 0.104, 0.106),
        st(1.172, 0.012, 0.062, 0.066),
        st(CROWN, 0.012, 0.014, 0.016),
    ]


def build_head(mat, jaw=1.0, chin=1.0):
    o = loft('head', head_stations(jaw, chin), mat, sides=16, subsurf=1)
    # planar front projection for the painted face; the back of the head samples a plain corner
    x0, x1, z0, z1 = FACE_UV
    bm = bmesh.new()
    bm.from_mesh(o.data)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        back = f.normal.y > 0.25
        for lp in f.loops:
            co = lp.vert.co
            lp[uv].uv = (0.01, 0.01) if back else ((co.x - x0) / (x1 - x0), (co.z - z0) / (z1 - z0))
    bm.to_mesh(o.data)
    bm.free()
    return o


def head_pt(head, az, el, out=0.0):
    """Point on the head surface at azimuth az (0 = front, + toward +X) and elevation el, radians."""
    d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    o = HEAD_C + d * 0.5
    hit, loc, nrm, _ = head.ray_cast(o, -d)
    if not hit:
        return HEAD_C + d * 0.13
    return Vector(loc) + Vector(nrm) * out


def hair_cap(head, mat, scale, hairline, nape_z, thick=0.012, from_idx=3):
    """Solid skull cap in the hair colour over the crown and back. hairline(x) is the lowest
    z kept at the front (y<0); nape_z the lowest z kept at the back."""
    o = loft('cap', head_stations(1.0, 1.0, scale)[from_idx:], mat, sides=24, caps=(False, True))
    o.data.transform(Matrix.Translation(HEAD_C - HEAD_C))
    bm = bmesh.new()
    bm.from_mesh(o.data)
    kill = [v for v in bm.verts if (v.co.y < -0.02 and v.co.z < hairline(v.co.x)) or v.co.z < nape_z]
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(o.data)
    bm.free()
    sol = o.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = thick
    sol.offset = 1
    apply_modifiers(o)
    return auto_smooth(o, 40)


# ---- fitted boots -----------------------------------------------------------------

def boot(prefix, ankle, toe, mats, pointed=0.0, heel_h=0.026, cuff_r=0.05, shaft_to=None, scale=1.0):
    """Form-fitting boot: shaft from ankle up `shaft_to`, instep/toe loft along `toe`, a raised
    heel block and a bevelled cuff. mats: dict(boot, trim, sole)."""
    ankle = Vector(ankle)
    t = Vector((toe.x, toe.y, 0)).normalized()
    lat = Vector((-t.y, t.x, 0))  # left of the toe direction, horizontal
    up = Vector((0, 0, 1))
    parts = []
    k = scale
    # foot loft: (distance along toe, centre height, half width, half height)
    prof = [(-0.062, 0.05, 0.03, 0.034), (-0.03, 0.07, 0.036, 0.05), (0.02, 0.062, 0.041, 0.048),
            (0.075, 0.042, 0.043, 0.034), (0.125 + 0.02 * pointed, 0.03, 0.03, 0.024),
            (0.16 + 0.05 * pointed, 0.026, 0.012 + 0.006 * (1 - pointed), 0.018)]
    sts = []
    base = Vector((ankle.x, ankle.y, ankle.z - ANKLE_Z))  # foot sole plane (0 when standing, higher in stirrups)
    for s, z, w, h in prof:
        sts.append((base + t * (s * k) + up * (z * k), w * k, h * k, lat, up))
    foot = loft(prefix + '_foot', sts, mats['boot'], sides=12)
    parts.append(foot)
    # heel block and thin sole (dark)
    heel = cube(prefix + '_heel', (0.055 * k, 0.05 * k, heel_h * k), tuple(base + t * (-0.04 * k) + up * (heel_h / 2 * k)), mats['sole'])
    orient_flat(heel, t)
    parts.append(hard(heel, 0.005))
    sole = cube(prefix + '_sole', (0.075 * k, (0.2 + 0.05 * pointed) * k, 0.014 * k),
                tuple(base + t * (0.055 * k) + up * (0.007 * k)), mats['sole'])
    orient_flat(sole, t)
    parts.append(hard(sole, 0.004))
    # shaft and bevelled cuff
    top = Vector(shaft_to) if shaft_to is not None else ankle + up * 0.14
    parts.append(tube(prefix + '_shaft', ankle + up * 0.0, top, 0.037 * k, cuff_r * 0.86 * k, mats['boot'], sides=12))
    cuff = tube(prefix + '_cuff', top - (top - ankle).normalized() * 0.035, top + (top - ankle).normalized() * 0.01,
                cuff_r * 0.9 * k, cuff_r * k, mats['trim'], sides=12)
    parts.append(hard(cuff, 0.004))
    return parts


def orient_flat(o, t):
    """Rotate a box built with its long side along Y so that side points along horizontal t."""
    ang = math.atan2(t.y, t.x) - math.pi / 2  # +Y -> t
    # cube() bakes its location into the mesh (object origin at 0), so rotate about the part's own centre
    c = sum((o.matrix_world @ Vector(v) for v in o.bound_box), Vector()) / 8
    xform([o], Matrix.Translation(c) @ Matrix.Rotation(ang, 4, 'Z') @ Matrix.Translation(-c))
    return o


# ---- assembling the rig -----------------------------------------------------------

HIERARCHY = [
    ('hips', None), ('torso', 'hips'), ('head', 'torso'), ('arm_l', 'torso'), ('fore_l', 'arm_l'),
    ('arm_r', 'torso'), ('fore_r', 'arm_r'), ('cape', 'torso'), ('thigh_l', 'hips'), ('shin_l', 'thigh_l'),
    ('thigh_r', 'hips'), ('shin_r', 'thigh_r'),
]


def pivots(J):
    return {
        'hips': J['pelvis'], 'torso': J['waist'], 'head': J['neck'], 'cape': J['neck'] + V(0, 0.09, 0),
        'arm_l': J['sh_l'], 'fore_l': J['el_l'], 'arm_r': J['sh_r'], 'fore_r': J['el_r'],
        'thigh_l': J['hip_l'], 'shin_l': J['knee_l'], 'thigh_r': J['hip_r'], 'shin_r': J['knee_r'],
    }


def assemble(parts, J):
    """Join each node's parts, set its origin to its joint and parent the chain under `hero`.
    parts: dict node name -> list of objects. Returns the hero root (an empty)."""
    root = bpy.data.objects.new('hero', None)
    bpy.context.collection.objects.link(root)
    piv = pivots(J)
    made = {}
    for name, parent in HIERARCHY:
        objs = parts.get(name) or []
        for o in objs:
            if 'Col' not in o.data.color_attributes:
                paint(o)  # white, so vertex-coloured materials (hair, fur) never go black
        if not objs:
            continue
        o = join(name, objs, tuple(piv[name]))
        made[name] = o
    bpy.context.view_layer.update()
    for name, parent in HIERARCHY:
        if name not in made:
            continue
        p = made.get(parent) if parent else root
        if parent and p is None:  # missing intermediate: climb up
            q = dict(HIERARCHY)[parent]
            p = made.get(q) or root
        made[name].parent = p
        made[name].matrix_parent_inverse = p.matrix_world.inverted()
        bpy.context.view_layer.update()
    return root


def all_nodes(root):
    return [root] + list(root.children_recursive)
