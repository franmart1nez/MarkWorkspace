"""Shared geometry helpers for the Basement corridor production pass (2026-11-12).

All units are metres (the source blends are Metric, scale 1).  Every asset is a
single mesh object with real material slots, a real UV layer at the pass texel
density and applied unit scale, matching the project's existing prop/kit
conventions.
"""
import bpy
import bmesh
import math
from mathutils import Vector, Matrix

TAU = math.pi * 2.0


# --------------------------------------------------------------------------- #
# scene / data helpers
# --------------------------------------------------------------------------- #
def collection(name, parent=None):
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
    if parent is not None and coll.name not in [c.name for c in parent.children]:
        parent.children.link(coll)
    return coll


def wipe_collection(name):
    coll = bpy.data.collections.get(name)
    if coll is None:
        return
    for obj in list(coll.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for child in list(coll.children):
        if child.name in bpy.data.collections:
            wipe_collection(child.name)
    if coll.name in bpy.data.collections:
        bpy.data.collections.remove(coll)


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def material(name, color, metallic=0.0, roughness=0.5, reuse_existing=False):
    existing = bpy.data.materials.get(name)
    if existing is not None and reuse_existing:
        return existing
    if existing is not None:
        return existing
    lin = tuple(srgb_to_linear(c) for c in color)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf is not None:
        bsdf.inputs['Base Color'].default_value = (lin[0], lin[1], lin[2], 1.0)
        bsdf.inputs['Metallic'].default_value = metallic
        bsdf.inputs['Roughness'].default_value = roughness
    mat.diffuse_color = (lin[0], lin[1], lin[2], 1.0)
    mat.metallic = metallic
    mat.roughness = roughness
    return mat


def atlas_material(name, image):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    for node in list(nt.nodes):
        if node.type not in {'BSDF_PRINCIPLED', 'OUTPUT_MATERIAL'}:
            nt.nodes.remove(node)
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = image
    tex.interpolation = 'Linear'
    tex.location = (-500, 200)
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = 0.62
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    mat.diffuse_color = (0.75, 0.72, 0.62, 1.0)
    return mat


# --------------------------------------------------------------------------- #
# builder
# --------------------------------------------------------------------------- #
class Build:
    """Accumulates primitives in one bmesh and finishes as one mesh object."""

    def __init__(self, name, uv_scale, uv_name='UVMap'):
        self.name = name
        self.uv_scale = uv_scale
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new(uv_name)
        self.mats = []
        self._atlas_faces = []

    # -- internals ---------------------------------------------------------- #
    def _mi(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def _tag(self, faces, mat, smooth, uv_mode='box', uv_rect=None, atlas=False):
        idx = self._mi(mat)
        for f in faces:
            f.material_index = idx
            f.smooth = smooth
            if uv_mode == 'box':
                self._box_uv(f)
            elif uv_mode == 'none':
                pass
            elif uv_mode == 'rect':
                f.normal_update()
                u0, v0, u1, v1 = uv_rect
                # corners are given in loop order: p0..p3
                coords = [(0, 0), (1, 0), (1, 1), (0, 1)]
                for i, loop in enumerate(f.loops):
                    cu, cv = coords[i % 4]
                    loop[self.uv].uv = (u0 + (u1 - u0) * cu, v0 + (v1 - v0) * cv)
            if atlas:
                self._atlas_faces.append(f)

    def _box_uv(self, f):
        f.normal_update()
        n = f.normal
        ax = 0 if abs(n.x) >= abs(n.y) and abs(n.x) >= abs(n.z) else (1 if abs(n.y) >= abs(n.z) else 2)
        if n.length < 1e-9:
            ax = 2
        s = self.uv_scale
        for loop in f.loops:
            co = loop.vert.co
            if ax == 0:
                u, v = co.y, co.z
            elif ax == 1:
                u, v = co.x, co.z
            else:
                u, v = co.x, co.y
            loop[self.uv].uv = (u * s, v * s)

    def _new_faces(self, before):
        return [f for f in self.bm.faces if f not in before]

    # -- primitives --------------------------------------------------------- #
    def box(self, center, size, mat, bevel=0.003, smooth=False, rot_z=0.0):
        before = set(self.bm.faces)
        ret = bmesh.ops.create_cube(self.bm, size=1.0)
        verts = ret['verts']
        sx, sy, sz = size
        for v in verts:
            v.co.x *= sx
            v.co.y *= sy
            v.co.z *= sz
        if rot_z:
            m = Matrix.Rotation(rot_z, 3, 'Z')
            for v in verts:
                v.co = m @ v.co
        c = Vector(center)
        for v in verts:
            v.co += c
        faces = self._new_faces(before)
        if bevel and bevel > 0:
            edges = list({e for v in verts for e in v.link_edges})
            bmesh.ops.bevel(self.bm, geom=edges, offset=bevel, segments=1,
                            affect='EDGES', clamp_overlap=True)
            faces = self._new_faces(before)
        self._tag(faces, mat, smooth)
        return faces

    def cyl(self, center, radius, length, axis='Z', mat=None, segments=16,
            smooth=True, cap_mat=None, radius2=None):
        """Closed cylinder. axis is X/Y/Z. radius2 gives a cone."""
        a = {'X': Vector((1, 0, 0)), 'Y': Vector((0, 1, 0)), 'Z': Vector((0, 0, 1))}[axis]
        up = Vector((0, 0, 1)) if axis != 'Z' else Vector((0, 1, 0))
        u = a.cross(up).normalized()
        v = a.cross(u).normalized()
        c = Vector(center)
        r2 = radius if radius2 is None else radius2
        rings = []
        for side, rad in ((-0.5, radius), (0.5, r2)):
            ring = []
            for i in range(segments):
                ang = TAU * i / segments
                p = c + a * (length * side) + u * (math.cos(ang) * rad) + v * (math.sin(ang) * rad)
                ring.append(self.bm.verts.new(p))
            rings.append(ring)
        side_faces = []
        for i in range(segments):
            j = (i + 1) % segments
            f = self.bm.faces.new((rings[0][i], rings[0][j], rings[1][j], rings[1][i]))
            side_faces.append(f)
        caps = []
        f0 = self.bm.faces.new(tuple(reversed(rings[0])))
        f1 = self.bm.faces.new(tuple(rings[1]))
        caps = [f0, f1]
        self._tag(side_faces, mat, smooth)
        self._tag(caps, cap_mat or mat, False)
        # cylindrical UVs for the sides
        for f in side_faces:
            coords = [(0.0, 0.0), (0.0, 0.0), (0.0, 0.0), (0.0, 0.0)]
            for i, loop in enumerate(f.loops):
                local = loop.vert.co - c
                along = local.dot(a)
                radial = local - a * along
                ang = math.atan2(radial.dot(v), radial.dot(u))
                coords[i] = (ang * radius * self.uv_scale, (along + length * 0.5) * self.uv_scale)
            # unwrap the seam
            if max(u0 for u0, _ in coords) - min(u0 for u0, _ in coords) > math.pi * radius * self.uv_scale:
                for i, (uu, vv) in enumerate(coords):
                    if uu < 0:
                        coords[i] = (uu + TAU * radius * self.uv_scale, vv)
            for i, loop in enumerate(f.loops):
                loop[self.uv].uv = coords[i]
        return side_faces + caps

    def tube(self, points, radius, mat, segments=12, caps=True, smooth=True):
        pts = [Vector(p) for p in points]
        tangents = []
        for i, p in enumerate(pts):
            if i == 0:
                t = pts[1] - pts[0]
            elif i == len(pts) - 1:
                t = pts[-1] - pts[-2]
            else:
                t = pts[i + 1] - pts[i - 1]
            tangents.append(t.normalized())
        ref = Vector((0, 0, 1))
        if abs(tangents[0].dot(ref)) > 0.9:
            ref = Vector((0, 1, 0))
        rings = []
        prev_u = (ref - tangents[0] * ref.dot(tangents[0])).normalized()
        for i, p in enumerate(pts):
            t = tangents[i]
            if i > 0:
                prev_u = (prev_u - t * prev_u.dot(t))
                if prev_u.length < 1e-6:
                    prev_u = Vector((0, 0, 1))
                prev_u.normalize()
            u = prev_u
            v = t.cross(u).normalized()
            ring = []
            for s in range(segments):
                ang = TAU * s / segments
                ring.append(self.bm.verts.new(p + u * (math.cos(ang) * radius) + v * (math.sin(ang) * radius)))
            rings.append(ring)
        faces = []
        lengths = [0.0]
        for i in range(1, len(pts)):
            lengths.append(lengths[-1] + (pts[i] - pts[i - 1]).length)
        circ = TAU * radius
        for i in range(len(rings) - 1):
            for s in range(segments):
                s2 = (s + 1) % segments
                f = self.bm.faces.new((rings[i][s], rings[i][s2], rings[i + 1][s2], rings[i + 1][s]))
                faces.append((f, lengths[i], lengths[i + 1], s))
        for f, l0, l1, s in faces:
            idx = self._mi(mat)
            f.material_index = idx
            f.smooth = smooth
            v0 = circ * s / segments * self.uv_scale
            v1 = circ * (s + 1) / segments * self.uv_scale
            uvco = [(l0 * self.uv_scale, v0), (l0 * self.uv_scale, v1),
                    (l1 * self.uv_scale, v1), (l1 * self.uv_scale, v0)]
            for i, loop in enumerate(f.loops):
                loop[self.uv].uv = uvco[i]
        result = [f for f, *_ in faces]
        if caps:
            self._tag([self.bm.faces.new(tuple(reversed(rings[0])))], mat, False)
            self._tag([self.bm.faces.new(tuple(rings[-1]))], mat, False)
            result += list(self.bm.faces)[-2:]
        return result

    def ring(self, center, r_in, r_out, thickness, axis='Y', mat=None, segments=24, smooth=True):
        a = {'X': Vector((1, 0, 0)), 'Y': Vector((0, 1, 0)), 'Z': Vector((0, 0, 1))}[axis]
        ref = Vector((0, 0, 1)) if axis != 'Z' else Vector((0, 1, 0))
        u = a.cross(ref).normalized()
        v = a.cross(u).normalized()
        c = Vector(center)
        loops = {}
        for side in (-0.5, 0.5):
            for tag, rad in (('in', r_in), ('out', r_out)):
                ring = []
                for i in range(segments):
                    ang = TAU * i / segments
                    p = c + a * (thickness * side) + u * (math.cos(ang) * rad) + v * (math.sin(ang) * rad)
                    ring.append(self.bm.verts.new(p))
                loops[(side, tag)] = ring
        faces = []
        for i in range(segments):
            j = (i + 1) % segments
            faces.append(self.bm.faces.new((loops[(-0.5, 'in')][i], loops[(-0.5, 'in')][j],
                                            loops[(-0.5, 'out')][j], loops[(-0.5, 'out')][i])))
            faces.append(self.bm.faces.new((loops[(0.5, 'in')][i], loops[(0.5, 'in')][j],
                                            loops[(0.5, 'out')][j], loops[(0.5, 'out')][i])))
            faces.append(self.bm.faces.new((loops[(-0.5, 'out')][i], loops[(-0.5, 'out')][j],
                                            loops[(0.5, 'out')][j], loops[(0.5, 'out')][i])))
            faces.append(self.bm.faces.new((loops[(-0.5, 'in')][i], loops[(-0.5, 'in')][j],
                                            loops[(0.5, 'in')][j], loops[(0.5, 'in')][i])))
        self._tag(faces, mat, smooth)
        return faces

    def disc(self, center, radius, thickness, axis='Y', mat=None, segments=24, smooth=True, cap_mat=None):
        return self.cyl(center, radius, thickness, axis=axis, mat=mat, segments=segments,
                        smooth=False, cap_mat=cap_mat or mat)

    def frustum(self, cx, cy, z0, z1, bottom, top, mat, uv_scale=None):
        """Tapered rectangular body (bottom size, top size) centred on cx, cy."""
        bw, bd = bottom
        tw, td = top
        verts = [
            self.bm.verts.new((cx - bw / 2, cy - bd / 2, z0)),
            self.bm.verts.new((cx + bw / 2, cy - bd / 2, z0)),
            self.bm.verts.new((cx + bw / 2, cy + bd / 2, z0)),
            self.bm.verts.new((cx - bw / 2, cy + bd / 2, z0)),
            self.bm.verts.new((cx - tw / 2, cy - td / 2, z1)),
            self.bm.verts.new((cx + tw / 2, cy - td / 2, z1)),
            self.bm.verts.new((cx + tw / 2, cy + td / 2, z1)),
            self.bm.verts.new((cx - tw / 2, cy + td / 2, z1)),
        ]
        faces = [
            self.bm.faces.new((verts[0], verts[1], verts[2], verts[3])),
            self.bm.faces.new((verts[7], verts[6], verts[5], verts[4])),
            self.bm.faces.new((verts[0], verts[1], verts[5], verts[4])),
            self.bm.faces.new((verts[1], verts[2], verts[6], verts[5])),
            self.bm.faces.new((verts[2], verts[3], verts[7], verts[6])),
            self.bm.faces.new((verts[3], verts[0], verts[4], verts[7])),
        ]
        self._tag(faces, mat, False)
        return faces

    def tri_prism(self, x_center, width, points_yz, mat, smooth=False):
        """Extrude a triangle (three (y, z) points) along X."""
        x0 = x_center - width * 0.5
        x1 = x_center + width * 0.5
        a = [self.bm.verts.new((x0, p[0], p[1])) for p in points_yz]
        b = [self.bm.verts.new((x1, p[0], p[1])) for p in points_yz]
        faces = [self.bm.faces.new(tuple(reversed(a))), self.bm.faces.new(tuple(b))]
        for i in range(3):
            j = (i + 1) % 3
            faces.append(self.bm.faces.new((a[i], a[j], b[j], b[i])))
        self._tag(faces, mat, smooth)
        return faces

    def sheet(self, x0, y0, z0, w, h, mat, uv_rect, nx=6, nz=8, bow=0.006, curl=0.0, thickness=0.0015):
        """Thin paper sheet standing in the XZ plane with a gentle bow and curl."""
        front = []
        back = []
        for iz in range(nz + 1):
            row_f = []
            row_b = []
            v = iz / nz
            for ix in range(nx + 1):
                u = ix / nx
                x = x0 + u * w
                z = z0 + v * h
                dy = bow * math.sin(math.pi * u) * math.sin(math.pi * v)
                dy += curl * (max(0.0, u - 0.8) / 0.2) ** 2 * (1.0 - v) * 0.5
                row_f.append(self.bm.verts.new((x, y0 + dy, z)))
                row_b.append(self.bm.verts.new((x, y0 + dy - thickness, z)))
            front.append(row_f)
            back.append(row_b)
        faces_front = []
        faces_back = []
        for iz in range(nz):
            for ix in range(nx):
                a, b = front[iz][ix], front[iz][ix + 1]
                c, d = front[iz + 1][ix + 1], front[iz + 1][ix]
                faces_front.append(self.bm.faces.new((a, b, c, d)))
                a, b = back[iz][ix], back[iz][ix + 1]
                c, d = back[iz + 1][ix + 1], back[iz + 1][ix]
                faces_back.append(self.bm.faces.new((d, c, b, a)))
        rim = []
        for ix in range(nx):
            rim.append(self.bm.faces.new((front[0][ix], front[0][ix + 1], back[0][ix + 1], back[0][ix])))
            rim.append(self.bm.faces.new((back[nz][ix], back[nz][ix + 1], front[nz][ix + 1], front[nz][ix])))
        for iz in range(nz):
            rim.append(self.bm.faces.new((back[iz][0], back[iz + 1][0], front[iz + 1][0], front[iz][0])))
            rim.append(self.bm.faces.new((front[iz][nx], front[iz + 1][nx], back[iz + 1][nx], back[iz][nx])))
        self._tag(faces_front + faces_back + rim, mat, True)
        # planar atlas projection of the front grid (viewed from +Y: U runs -X)
        u0, v0, u1, v1 = uv_rect
        for row in range(nz):
            for col in range(nx):
                f = faces_front[row * nx + col]
                for loop in f.loops:
                    u = 1.0 - (loop.vert.co.x - x0) / w
                    vv = (loop.vert.co.z - z0) / h
                    loop[self.uv].uv = (u0 + (u1 - u0) * u, v0 + (v1 - v0) * vv)
        self._atlas_faces.append((faces_front[0], Vector((0, 1, 0))))
        return faces_front

    def map_faces_rect(self, faces, uv_rect, axis='Y', flip_u=False):
        """Map the given faces' 2D extent onto a UV rectangle (atlas cells)."""
        pairs = {'X': (1, 2), 'Y': (0, 2), 'Z': (0, 1)}
        ui, vi = pairs[axis]
        coords = []
        for f in faces:
            for loop in f.loops:
                co = loop.vert.co
                coords.append((co[ui], co[vi]))
        us = [c[0] for c in coords]
        vs = [c[1] for c in coords]
        umin, umax = min(us), max(us)
        vmin, vmax = min(vs), max(vs)
        u0, v0, u1, v1 = uv_rect
        for f in faces:
            for loop in f.loops:
                co = loop.vert.co
                cu = (co[ui] - umin) / (umax - umin + 1e-9)
                cv = (co[vi] - vmin) / (vmax - vmin + 1e-9)
                if flip_u:
                    cu = 1.0 - cu
                loop[self.uv].uv = (u0 + (u1 - u0) * cu, v0 + (v1 - v0) * cv)

    def quad(self, corners, mat, uv_rect, normal_dir, flip_u=False):
        """Single atlas-mapped quad. corners: bottom-left, bottom-right, top-right, top-left."""
        verts = [self.bm.verts.new(Vector(c)) for c in corners]
        f = self.bm.faces.new(verts)
        idx = self._mi(mat)
        f.material_index = idx
        f.smooth = False
        f.normal_update()
        if f.normal.dot(Vector(normal_dir)) < 0:
            f.normal_flip()
        ax = max(range(3), key=lambda i: abs(f.normal[i]))
        front = abs(f.normal.y) > 0.5 and f.normal.y > 0
        self.map_faces_rect([f], uv_rect, axis='XYZ'[ax], flip_u=front)
        self._atlas_faces.append((f, Vector(normal_dir)))
        return f

    # -- finish ------------------------------------------------------------- #
    def finish(self, collection_obj, location=(0, 0, 0), rotation=(0, 0, 0), validate=True):
        ngons = [f for f in self.bm.faces if len(f.verts) > 4]
        if ngons:
            bmesh.ops.triangulate(self.bm, faces=ngons)
        bmesh.ops.recalc_face_normals(self.bm, faces=list(self.bm.faces))
        for item in self._atlas_faces:
            if isinstance(item, tuple):
                f, want = item
                if f.normal.dot(want) < 0:
                    f.normal_flip()
        mesh = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        for m in self.mats:
            mesh.materials.append(m)
        obj = bpy.data.objects.new(self.name, mesh)
        collection_obj.objects.link(obj)
        obj.location = location
        obj.rotation_euler = rotation
        obj.scale = (1.0, 1.0, 1.0)
        if validate:
            mesh.validate(verbose=False)
            mesh.update()
        return obj


# --------------------------------------------------------------------------- #
# path helpers
# --------------------------------------------------------------------------- #
def arc(center, bend_r, a0, a1, plane='XZ', steps=8, axis='Y'):
    """Return points on a circular arc in a plane, angles in radians."""
    pts = []
    c = Vector(center)
    for i in range(steps + 1):
        t = a0 + (a1 - a0) * i / steps
        if plane == 'XZ':
            pts.append(c + Vector((math.cos(t) * bend_r, 0, math.sin(t) * bend_r)))
        elif plane == 'XY':
            pts.append(c + Vector((math.cos(t) * bend_r, math.sin(t) * bend_r, 0)))
        else:
            pts.append(c + Vector((0, math.cos(t) * bend_r, math.sin(t) * bend_r)))
    return pts


def polyline(segments):
    """Flatten a list of point lists into one polyline."""
    out = []
    for seg in segments:
        out.extend(seg if not out else seg[1:])
    return out


# --------------------------------------------------------------------------- #
# object / report helpers
# --------------------------------------------------------------------------- #
def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def world_bounds(obj):
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return ([round(min(p[i] for p in pts), 4) for i in range(3)],
            [round(max(p[i] for p in pts), 4) for i in range(3)])


def describe(obj):
    mn, mx = world_bounds(obj)
    return {
        'name': obj.name,
        'mesh': obj.data.name,
        'verts': len(obj.data.vertices),
        'tris': tri_count(obj),
        'dims_cm': [round((mx[i] - mn[i]) * 100, 1) for i in range(3)],
        'bounds_cm': [[round(v * 100, 1) for v in mn], [round(v * 100, 1) for v in mx]],
        'pivot': [round(v, 4) for v in obj.location],
        'rotation': [round(v, 4) for v in obj.rotation_euler],
        'scale': [round(v, 4) for v in obj.scale],
        'slots': [s.material.name if s.material else None for s in obj.material_slots],
        'uv_layers': [u.name for u in obj.data.uv_layers],
    }


def uv_report(obj):
    out = {}
    for layer in obj.data.uv_layers:
        us = [d.uv[0] for d in layer.data]
        vs = [d.uv[1] for d in layer.data]
        degenerates = []
        min_area = 1e9
        for p in obj.data.polygons:
            if p.area < 1e-8:
                continue
            pts = [layer.data[li].uv for li in p.loop_indices]
            a = 0.0
            for i in range(len(pts)):
                x1, y1 = pts[i]
                x2, y2 = pts[(i + 1) % len(pts)]
                a += x1 * y2 - x2 * y1
            uv_area = abs(a) * 0.5
            if uv_area < min_area:
                min_area = uv_area
            if uv_area < 1e-9:
                degenerates.append(p.index)
        out[layer.name] = {
            'min': [round(min(us), 4), round(min(vs), 4)],
            'max': [round(max(us), 4), round(max(vs), 4)],
            'collapsed_uv_faces': len(degenerates),
            'collapsed_examples': degenerates[:12],
            'min_uv_area': round(min_area, 10) if min_area < 1e9 else None,
            'zero_uv_area_fraction': round(len(degenerates) / max(1, len(obj.data.polygons)), 4),
        }
    return out
