"""Builds N01 pipe kit, N02 conduit kit and N04 sign variants into the building source."""
import bpy
import math
import os
import sys

AUTH = r'D:/AI/MarkWorkspace/.mrmak/total-insanitation/corridor-production/authoring'
if AUTH not in sys.path:
    sys.path.insert(0, AUTH)
from corridor_lib import Build, collection, wipe_collection, material, atlas_material, describe, uv_report, TAU
from corridor_lib import polyline
import t01_atlas

ROOT = r'D:/GameJam/Total (in)Sanitation'
ATLAS_PNG = os.path.join(ROOT, 'Delivery/Basement/Corridor/Textures/T01_Corridor_Graphics.png')
COLL_NAME = 'Corridor_Production_20261112'
UV_SCALE = 0.5          # 256 px/m on 512 px textures for modular structures
BASE_Y = -200.0

BIG = {'r': 0.110, 'y': 0.135, 'z': 2.720}
SMALL = {'r': 0.070, 'y': 0.105, 'z': 3.000}
CONDUIT = {'r': 0.013, 'y': 0.035, 'z': 3.350}


def build_materials():
    m = {}
    m['cream'] = material('Corridor_Enamel_Cream', (0.800, 0.755, 0.610), 0.0, 0.66)
    m['olive'] = material('Corridor_Enamel_Olive', (0.255, 0.280, 0.180), 0.0, 0.68)
    m['iron'] = material('Corridor_Iron_Dark', (0.085, 0.080, 0.072), 0.75, 0.52)
    m['steel'] = material('Corridor_Steel_Galvanized', (0.520, 0.535, 0.545), 0.65, 0.55)
    m['red'] = material('Corridor_Valve_Red', (0.420, 0.095, 0.060), 0.25, 0.55)
    m['brass'] = material('Corridor_Brass', (0.520, 0.400, 0.160), 0.85, 0.42)
    m['reuse_metal'] = bpy.data.materials.get('Metal_01')
    img = bpy.data.images.get('T01_Corridor_Graphics')
    if img is None:
        img = bpy.data.images.load(ATLAS_PNG, check_existing=False)
        img.name = 'T01_Corridor_Graphics'
        img.filepath = bpy.path.relpath(ATLAS_PNG)
    m['atlas'] = atlas_material('Corridor_Atlas_T01', img)
    return m


# --------------------------------------------------------------------------- #
# pipe helpers
# --------------------------------------------------------------------------- #
def straight_path(spec, length):
    return [(0.0, spec['y'], spec['z']), (length, spec['y'], spec['z'])]


def corner_path(spec, wall=3.85, bend_r=0.28, return_len=0.18):
    y, z = spec['y'], spec['z']
    px = wall - y
    bx = px - bend_r
    center = (bx, y + bend_r, z)
    pts = [(0.0, y, z), (bx, y, z)]
    for i in range(1, 9):
        t = -math.pi / 2 + (math.pi / 2) * i / 8
        pts.append((center[0] + math.cos(t) * bend_r, center[1] + math.sin(t) * bend_r, z))
    pts.append((px, y + bend_r + return_len, z))
    return pts


def coupler(b, spec, x, mat, big=True):
    r = spec['r']
    b.cyl((x, spec['y'], spec['z']), r + 0.020, 0.130, axis='X', mat=mat, segments=16)
    for dx in (-0.070, 0.070):
        b.cyl((x + dx, spec['y'], spec['z']), r + 0.034, 0.022, axis='X', mat=mat, segments=16)


def bracket(b, x, mats, support_small=True):
    iron = mats['iron']
    # wall plate
    b.box((x, 0.012, 2.880), (0.150, 0.024, 0.720), iron, bevel=0.004)
    # triangular forged bracket plate (vertical edge on the wall, arm under the pipe)
    b.tri_prism(x, 0.022, [(0.024, 2.500), (0.024, 2.660), (0.235, 2.612)], iron)
    # horizontal saddle arm under the big pipe
    b.box((x, 0.120, 2.606), (0.070, 0.230, 0.020), iron, bevel=0.003)
    # strap over the big pipe
    strap = []
    for i in range(9):
        t = math.radians(-200) + math.radians(220) * i / 8
        strap.append((x, BIG['y'] + math.cos(t) * (BIG['r'] + 0.008), BIG['z'] + math.sin(t) * (BIG['r'] + 0.008)))
    b.tube(strap, 0.009, iron, segments=6)
    if support_small:
        b.box((x, 0.022, 2.930), (0.045, 0.040, 0.150), iron, bevel=0.002)
        b.cyl((x, SMALL['y'], SMALL['z']), SMALL['r'] + 0.016, 0.030, axis='X', mat=iron, segments=12)


def conduit_clamp(b, x, mat):
    b.box((x, 0.010, CONDUIT['z']), (0.055, 0.020, 0.090), mat, bevel=0.003)
    b.cyl((x, CONDUIT['y'], CONDUIT['z']), CONDUIT['r'] + 0.007, 0.028, axis='X', mat=mat, segments=10)


# --------------------------------------------------------------------------- #
# N01
# --------------------------------------------------------------------------- #
def build_pipe_pair_400(m, coll):
    b = Build('SM_Corridor_Pipe_Pair_400', UV_SCALE)
    skin = m['cream']
    b.cyl((2.0, BIG['y'], BIG['z']), BIG['r'], 4.0, axis='X', mat=skin, segments=20)
    b.cyl((2.0, SMALL['y'], SMALL['z']), SMALL['r'], 4.0, axis='X', mat=m['iron'], segments=16)
    for x in (0.420, 2.000, 3.580):
        coupler(b, BIG, x, m['iron'])
    for x in (0.420, 2.000, 3.580):
        coupler(b, SMALL, x, m['iron'])
    bracket(b, 0.700, m)
    bracket(b, 3.300, m)
    return b.finish(coll)


def build_pipe_pair_corner(m, coll):
    b = Build('SM_Corridor_Pipe_Pair_Corner_385', UV_SCALE)
    b.tube(corner_path(BIG), BIG['r'], m['cream'], segments=20)
    b.tube(corner_path(SMALL, bend_r=0.28), SMALL['r'], m['iron'], segments=16)
    for x in (0.300, 2.900):
        coupler(b, BIG, x, m['iron'])
    coupler(b, SMALL, 0.300, m['iron'])
    bracket(b, 1.600, m)
    return b.finish(coll)


def build_pipe_pair_infill(m, coll):
    b = Build('SM_Corridor_Pipe_Pair_Infill_100', UV_SCALE)
    b.cyl((0.5, BIG['y'], BIG['z']), BIG['r'], 1.0, axis='X', mat=m['cream'], segments=20)
    b.cyl((0.5, SMALL['y'], SMALL['z']), SMALL['r'], 1.0, axis='X', mat=m['iron'], segments=16)
    bracket(b, 0.500, m, support_small=False)
    return b.finish(coll)


def build_pipe_elbow(m, coll):
    b = Build('SM_Corridor_Pipe_Elbow_90', UV_SCALE)
    r = 0.24
    center = (0.24, BIG['y'] + r, BIG['z'])
    pts = [(0.0, BIG['y'], BIG['z'])]
    for i in range(1, 9):
        t = -math.pi / 2 + (math.pi / 2) * i / 8
        pts.append((center[0] + math.cos(t) * r, center[1] + math.sin(t) * r, BIG['z']))
    pts.append((0.24, BIG['y'] + r + 0.14, BIG['z']))
    b.tube(pts, BIG['r'], m['cream'], segments=20)
    b.cyl((0.115, BIG['y'], BIG['z']), BIG['r'] + 0.020, 0.120, axis='X', mat=m['iron'], segments=16)
    return b.finish(coll)


def build_pipe_couplers(m, coll):
    big = Build('SM_Corridor_Pipe_Coupler_Big', UV_SCALE)
    coupler(big, BIG, 0.0, m['iron'])
    obig = big.finish(coll, location=(-0.0, 0, 0))
    small = Build('SM_Corridor_Pipe_Coupler_Small', UV_SCALE)
    coupler(small, SMALL, 0.0, m['iron'])
    osmall = small.finish(coll)
    return [obig, osmall]


def build_pipe_bracket(m, coll):
    b = Build('SM_Corridor_Pipe_Bracket_Triangular', UV_SCALE)
    bracket(b, 0.0, m)
    return b.finish(coll)


def build_valve_branch(m, coll):
    b = Build('SM_Corridor_Pipe_ValveBranch', UV_SCALE)
    x = 0.0
    # sleeve on the small pipe
    b.cyl((x, SMALL['y'], SMALL['z']), SMALL['r'] + 0.018, 0.150, axis='X', mat=m['iron'], segments=16)
    drop = 0.230
    z0 = SMALL['z']
    b.cyl((x, SMALL['y'], z0 - drop * 0.5), 0.042, drop, axis='Z', mat=m['cream'], segments=14)
    # valve body
    b.cyl((x, SMALL['y'], z0 - drop - 0.050), 0.070, 0.100, axis='Z', mat=m['red'], segments=16)
    b.cyl((x, SMALL['y'], z0 - drop - 0.112), 0.050, 0.024, axis='Z', mat=m['red'], segments=14)
    # stem towards the room and the red handwheel
    b.cyl((x, SMALL['y'] + 0.055, z0 - drop - 0.050), 0.016, 0.110, axis='Y', mat=m['brass'], segments=10)
    b.ring((x, SMALL['y'] + 0.112, z0 - drop - 0.050), 0.055, 0.092, 0.020, axis='Y', mat=m['red'], segments=24)
    for i in range(4):
        ang = TAU * i / 4 + math.pi / 8
        b.box((x + math.cos(ang) * 0.056, SMALL['y'] + 0.112, z0 - drop - 0.050 + math.sin(ang) * 0.056),
              (0.018, 0.016, 0.115), m['red'], bevel=0.001, rot_z=0.0)
    b.cyl((x, SMALL['y'] + 0.122, z0 - drop - 0.050), 0.022, 0.026, axis='Y', mat=m['brass'], segments=10)
    return b.finish(coll)


# --------------------------------------------------------------------------- #
# N02
# --------------------------------------------------------------------------- #
def build_conduit_400(m, coll):
    b = Build('SM_Corridor_Conduit_Straight_400', UV_SCALE)
    b.cyl((2.0, CONDUIT['y'], CONDUIT['z']), CONDUIT['r'], 4.0, axis='X', mat=m['steel'], segments=12)
    for x in (0.500, 1.500, 2.500, 3.500):
        conduit_clamp(b, x, m['reuse_metal'])
    return b.finish(coll)


def build_conduit_corner(m, coll):
    b = Build('SM_Corridor_Conduit_Corner_385', UV_SCALE)
    b.tube(corner_path(CONDUIT, bend_r=0.10, return_len=0.10), CONDUIT['r'], m['steel'], segments=12)
    for x in (0.500, 1.500, 2.500):
        conduit_clamp(b, x, m['reuse_metal'])
    return b.finish(coll)


def build_conduit_infill(m, coll):
    b = Build('SM_Corridor_Conduit_Infill_100', UV_SCALE)
    b.cyl((0.5, CONDUIT['y'], CONDUIT['z']), CONDUIT['r'], 1.0, axis='X', mat=m['steel'], segments=12)
    conduit_clamp(b, 0.5, m['reuse_metal'])
    return b.finish(coll)


def build_conduit_elbow(m, coll):
    b = Build('SM_Corridor_Conduit_Elbow_90', UV_SCALE)
    r = 0.10
    center = (r, CONDUIT['y'] + r, CONDUIT['z'])
    pts = [(0.0, CONDUIT['y'], CONDUIT['z'])]
    for i in range(1, 9):
        t = -math.pi / 2 + (math.pi / 2) * i / 8
        pts.append((center[0] + math.cos(t) * r, center[1] + math.sin(t) * r, CONDUIT['z']))
    pts.append((r, CONDUIT['y'] + r + 0.10, CONDUIT['z']))
    b.tube(pts, CONDUIT['r'], m['steel'], segments=12)
    return b.finish(coll)


def build_conduit_clamp(m, coll):
    b = Build('SM_Corridor_Conduit_Clamp', UV_SCALE)
    conduit_clamp(b, 0.0, m['reuse_metal'])
    return b.finish(coll)


def build_junction_box(m, coll):
    b = Build('SM_Corridor_Conduit_JunctionBox', UV_SCALE)
    z = CONDUIT['z']
    b.box((0, 0.036, z), (0.150, 0.072, 0.150), m['steel'], bevel=0.004)
    b.box((0, 0.076, z), (0.132, 0.010, 0.132), m['steel'], bevel=0.003)
    for sx in (-0.050, 0.050):
        b.cyl((sx, 0.083, z + 0.048), 0.006, 0.006, axis='Y', mat=m['iron'], segments=6)
        b.cyl((sx, 0.083, z - 0.048), 0.006, 0.006, axis='Y', mat=m['iron'], segments=6)
    b.cyl((0.0, CONDUIT['y'], z + 0.075), CONDUIT['r'], 0.070, axis='Z', mat=m['steel'], segments=12)
    b.cyl((0.0, CONDUIT['y'], z - 0.075), CONDUIT['r'], 0.060, axis='Z', mat=m['steel'], segments=12)
    return b.finish(coll)


# --------------------------------------------------------------------------- #
# N04
# --------------------------------------------------------------------------- #
def sign_plate(name, coll, m, cell, w, h, uv):
    b = Build(name, UV_SCALE)
    b.box((0, 0.006, h * 0.5), (w, 0.012, h), m['cream'], bevel=0.004)
    b.quad([(-w * 0.5 + 0.02, 0.0122, 0.02), (w * 0.5 - 0.02, 0.0122, 0.02),
            (w * 0.5 - 0.02, 0.0122, h - 0.02), (-w * 0.5 + 0.02, 0.0122, h - 0.02)],
           m['atlas'], uv[cell], (0, 1, 0))
    for sx in (-1, 1):
        for sz in (0.0, 1.0):
            b.cyl((sx * (w * 0.5 - 0.035), 0.0135, h * 0.5 + (sz - 0.5) * (h - 0.07)),
                  0.008, 0.008, axis='Y', mat=m['iron'], segments=8)
    obj = b.finish(coll)
    obj['corridor_sign_cell'] = cell
    return obj


# --------------------------------------------------------------------------- #
# assembly
# --------------------------------------------------------------------------- #
def build_all():
    wipe_collection(COLL_NAME)
    m = build_materials()
    scene_coll = bpy.context.scene.collection
    root = collection(COLL_NAME, scene_coll)
    sub = {
        'n01': collection('N01_Pipe_Kit', root),
        'n02': collection('N02_Conduit_Kit', root),
        'n04': collection('N04_Sign_Variants', root),
    }
    uv = {k: t01_atlas.uv_rect(k) for k in t01_atlas.CELLS}

    objs = []
    def place(obj, coll, x, y=BASE_Y, z=0.0, family=''):
        obj.location = (x, y, z)
        obj['corridor_family'] = family
        obj['corridor_pass'] = '2026-11-12'
        objs.append(obj)
        return obj

    place(build_pipe_pair_400(m, sub['n01']), sub['n01'], 0.0, family='N01')
    place(build_pipe_pair_corner(m, sub['n01']), sub['n01'], 5.0, family='N01')
    place(build_pipe_pair_infill(m, sub['n01']), sub['n01'], 10.0, family='N01')
    place(build_pipe_elbow(m, sub['n01']), sub['n01'], 12.0, family='N01')
    couplers = build_pipe_couplers(m, sub['n01'])
    place(couplers[0], sub['n01'], 14.0, family='N01')
    place(couplers[1], sub['n01'], 14.8, family='N01')
    place(build_pipe_bracket(m, sub['n01']), sub['n01'], 16.0, family='N01')
    place(build_valve_branch(m, sub['n01']), sub['n01'], 17.2, family='N01')

    place(build_conduit_400(m, sub['n02']), sub['n02'], 21.0, family='N02')
    place(build_conduit_corner(m, sub['n02']), sub['n02'], 26.0, family='N02')
    place(build_conduit_infill(m, sub['n02']), sub['n02'], 31.0, family='N02')
    place(build_conduit_elbow(m, sub['n02']), sub['n02'], 32.8, family='N02')
    place(build_conduit_clamp(m, sub['n02']), sub['n02'], 34.0, family='N02')
    place(build_junction_box(m, sub['n02']), sub['n02'], 35.2, family='N02')

    place(sign_plate('SM_Corridor_Sign_Equipment', sub['n04'], m, 'equipment', 0.50, 0.25, uv),
          sub['n04'], 37.0, z=1.55, family='N04')
    place(sign_plate('SM_Corridor_Sign_Service', sub['n04'], m, 'service', 0.44, 0.22, uv),
          sub['n04'], 38.2, z=1.65, family='N04')
    place(sign_plate('SM_Corridor_Sign_Collection', sub['n04'], m, 'collection', 0.46, 0.23, uv),
          sub['n04'], 39.4, z=1.55, family='N04')
    place(sign_plate('SM_Corridor_Sign_Caution', sub['n04'], m, 'caution', 0.28, 0.14, uv),
          sub['n04'], 40.4, z=1.62, family='N04')
    return objs, m
