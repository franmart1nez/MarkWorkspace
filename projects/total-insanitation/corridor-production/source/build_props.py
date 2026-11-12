"""Builds N03 / N05 / N06 / N07 into the environment-assets source blend."""
import bpy
import math
import os
import sys

AUTH = r'D:/AI/MarkWorkspace/.mrmak/total-insanitation/corridor-production/authoring'
if AUTH not in sys.path:
    sys.path.insert(0, AUTH)
from corridor_lib import (Build, collection, wipe_collection, material, atlas_material,
                          describe, uv_report, TAU)
import t01_atlas

ROOT = r'D:/GameJam/Total (in)Sanitation'
REAL = os.path.join(ROOT, 'Assets/Enviroment_Assets/Enviroment_Assets.blend')
ATLAS_PNG = os.path.join(ROOT, 'Delivery/Basement/Corridor/Textures/T01_Corridor_Graphics.png')
COLL_NAME = 'Corridor_Production_20261112'
UV_SCALE = 1.0  # 512 px/m simple props


def build_materials():
    m = {}
    m['olive'] = material('Corridor_Enamel_Olive', (0.255, 0.280, 0.180), 0.0, 0.68)
    m['cream'] = material('Corridor_Enamel_Cream', (0.800, 0.755, 0.610), 0.0, 0.65)
    m['iron'] = material('Corridor_Iron_Dark', (0.085, 0.080, 0.072), 0.75, 0.52)
    m['steel'] = material('Corridor_Steel_Galvanized', (0.520, 0.535, 0.545), 0.65, 0.55)
    m['brass'] = material('Corridor_Brass', (0.520, 0.400, 0.160), 0.85, 0.42)
    m['red'] = material('Corridor_Valve_Red', (0.420, 0.095, 0.060), 0.25, 0.55)
    m['rubber'] = material('Corridor_Rubber_Charcoal', (0.055, 0.055, 0.052), 0.0, 0.88)
    m['gray'] = material('Corridor_Plastic_Gray', (0.315, 0.320, 0.310), 0.0, 0.72)
    m['reuse_metal'] = bpy.data.materials.get('Metal_01')
    m['reuse_plastic'] = bpy.data.materials.get('Plastic_01')
    m['reuse_rubber'] = bpy.data.materials.get('Rubber_01')

    img = bpy.data.images.get('T01_Corridor_Graphics')
    if img is None:
        img = bpy.data.images.load(ATLAS_PNG, check_existing=False)
        img.name = 'T01_Corridor_Graphics'
    img.filepath = '//' + os.path.relpath(ATLAS_PNG, os.path.dirname(REAL)).replace('\\', '/')
    m['atlas'] = atlas_material('Corridor_Atlas_T01', img)

    # restore the two existing source-relative texture references (never regenerated)
    for name in ('Text_Atlas_reference.png', 'Text_Atlas_normal.png'):
        existing = bpy.data.images.get(name)
        if existing is not None:
            existing.filepath = '//Unreal_Textures/' + name
    return m


# --------------------------------------------------------------------------- #
# N03 analog electrical cabinet 80 x 100 x 18 cm
# --------------------------------------------------------------------------- #
def build_cabinet(m, coll, uv):
    b = Build('SM_Corridor_ElectricalCabinet', UV_SCALE)
    olive, iron, steel = m['olive'], m['iron'], m['steel']
    # carcass (16 cm body + 2 cm doors = 18 cm total wall projection)
    b.box((0, 0.010, 0.500), (0.800, 0.020, 1.000), olive, bevel=0.002)
    b.box((-0.385, 0.080, 0.500), (0.030, 0.120, 1.000), olive, bevel=0.002)
    b.box((0.385, 0.080, 0.500), (0.030, 0.120, 1.000), olive, bevel=0.002)
    b.box((0, 0.080, 0.985), (0.800, 0.120, 0.030), olive, bevel=0.002)
    b.box((0, 0.080, 0.015), (0.800, 0.120, 0.030), olive, bevel=0.002)
    # crown lip
    b.box((0, 0.078, 1.004), (0.820, 0.132, 0.012), olive, bevel=0.002)
    # doors
    for side in (-1, 1):
        cx = 0.198 * side
        b.box((cx, 0.151, 0.500), (0.377, 0.018, 0.952), olive, bevel=0.002)
        # raised border frame (economical panel language)
        for (oz, sx, sz) in ((0.451, 0.377, 0.026), (-0.451, 0.377, 0.026)):
            b.box((cx, 0.164, 0.500 + oz), (sx, 0.008, sz), olive, bevel=0.001)
        for ox in (-0.174, 0.174):
            b.box((cx + ox, 0.164, 0.500), (0.026, 0.008, 0.900), olive, bevel=0.001)
    # dark seam between the doors
    b.box((0, 0.152, 0.500), (0.014, 0.022, 0.952), iron, bevel=0.001)
    for side in (-1, 1):
        cx = 0.198 * side
        # hinges on the outer edge
        for hz in (0.150, 0.500, 0.850):
            b.cyl((0.386 * side, 0.168, hz), 0.008, 0.055, axis='Z', mat=iron, segments=8)
        # latch levers on the inner edge
        for lz in (0.560, 0.880):
            b.box((0.042 * side, 0.170, lz), (0.030, 0.012, 0.070), iron, bevel=0.001)
            b.box((0.042 * side, 0.172, lz - 0.024), (0.044, 0.008, 0.016), iron, bevel=0.001)
    # analog meter on the viewer's left door
    mx, mz = 0.140, 0.790
    b.cyl((mx, 0.158, mz), 0.066, 0.006, axis='Y', mat=steel, segments=24)
    b.ring((mx, 0.164, mz), 0.061, 0.079, 0.020, axis='Y', mat=iron, segments=24)
    b.quad([(mx - 0.055, 0.1612, mz - 0.055), (mx + 0.055, 0.1612, mz - 0.055),
            (mx + 0.055, 0.1612, mz + 0.055), (mx - 0.055, 0.1612, mz + 0.055)],
           m['atlas'], uv['meter'], (0, 1, 0))
    b.box((mx, 0.164, mz - 0.086), (0.120, 0.006, 0.018), iron, bevel=0.001)
    # caution label below the meter on the same door
    b.quad([(0.056, 0.1612, 0.560), (0.244, 0.1612, 0.560), (0.244, 0.1612, 0.654), (0.056, 0.1612, 0.654)],
           m['atlas'], uv['caution'], (0, 1, 0))
    # small data plate on the right door
    b.quad([(-0.260, 0.1612, 0.330), (-0.140, 0.1612, 0.330), (-0.140, 0.1612, 0.420), (-0.260, 0.1612, 0.420)],
           m['atlas'], uv['utility'], (0, 1, 0))
    obj = b.finish(coll, location=(0, 0, 0))
    return obj


# --------------------------------------------------------------------------- #
# N05 steel work-order panel + papers
# --------------------------------------------------------------------------- #
def build_panel(m, coll, uv):
    b = Build('SM_Corridor_WorkOrder_Panel', UV_SCALE)
    iron, steel = m['iron'], m['steel']
    b.box((0, 0.006, 0.000), (0.620, 0.012, 0.440), iron, bevel=0.002)
    for (ox, oz, sx, sz) in ((0, 0.212, 0.620, 0.032), (0, -0.212, 0.620, 0.032),
                             (-0.294, 0, 0.032, 0.440), (0.294, 0, 0.032, 0.440)):
        b.box((ox, 0.018, oz), (sx, 0.012, sz), steel, bevel=0.001)
    for cx in (-0.150, 0.120):
        b.box((cx, 0.020, 0.176), (0.040, 0.010, 0.026), steel, bevel=0.001)
        pts = t01_atlas_arc((cx, 0.026, 0.176), 0.020, math.radians(195), math.radians(-15), 10)
        b.tube(pts, 0.0035, steel, segments=6)
    # clipped papers
    b.sheet(-0.255, 0.012, -0.135, 0.210, 0.300, m['atlas'], uv['paper_a'], nx=5, nz=7, bow=0.006, curl=0.010)
    b.sheet(0.048, 0.012, -0.135, 0.150, 0.210, m['atlas'], uv['paper_b'], nx=4, nz=5, bow=0.005, curl=0.008)
    obj = b.finish(coll, location=(0, 0, 0))
    return obj


def t01_atlas_arc(center, r, a0, a1, steps):
    pts = []
    cx, cy, cz = center
    for i in range(steps + 1):
        t = a0 + (a1 - a0) * i / steps
        pts.append((cx + math.cos(t) * r, cy, cz + math.sin(t) * r))
    return pts


def build_paper_sheet(m, coll, uv):
    b = Build('SM_Corridor_Paper_Sheet_C', UV_SCALE)
    b.sheet(-0.105, 0.0, 0.0, 0.210, 0.297, m['atlas'], uv['paper_c'], nx=5, nz=7, bow=0.004, curl=0.008)
    return b.finish(coll, location=(0, 0, 0))


# --------------------------------------------------------------------------- #
# N06 manual hose reel (55 cm drum, <=25 cm projection)
# --------------------------------------------------------------------------- #
def build_reel(m, coll, uv):
    b = Build('SM_Corridor_HoseReel', UV_SCALE)
    olive, iron, brass, rubber = m['olive'], m['iron'], m['brass'], m['rubber']
    # wall bracket
    b.box((0, 0.010, 0.000), (0.260, 0.020, 0.420), iron, bevel=0.003)
    for sz in (1, -1):
        b.box((0, 0.070, 0.135 * sz), (0.070, 0.110, 0.036), iron, bevel=0.003)
    # vertical arm carrying the axle
    b.box((0, 0.120, 0.000), (0.070, 0.030, 0.300), iron, bevel=0.003)
    # drum axle
    b.cyl((0, 0.130, 0.0), 0.026, 0.190, axis='Y', mat=iron, segments=14)
    # back guide cheek (full) and open front guide (small hub disc)
    b.cyl((0, 0.052, 0.0), 0.274, 0.024, axis='Y', mat=olive, segments=32)
    b.cyl((0, 0.202, 0.0), 0.132, 0.022, axis='Y', mat=olive, segments=28)
    b.cyl((0, 0.216, 0.0), 0.048, 0.030, axis='Y', mat=iron, segments=16)
    for i in range(4):
        ang = TAU * i / 4 + 0.4
        b.cyl((math.cos(ang) * 0.100, 0.215, math.sin(ang) * 0.100), 0.007, 0.010,
              axis='Y', mat=iron, segments=6)
    # coiled hose: 6 turns, economical 8-sided section
    pts = []
    turns = 6
    per_turn = 16
    for i in range(turns * per_turn + 1):
        t = i / per_turn * TAU
        y = 0.070 + (0.190 - 0.070) * (i / (turns * per_turn))
        r = 0.208 - 0.004 * (i / (turns * per_turn))
        pts.append((math.cos(t) * r, y, math.sin(t) * r))
    b.tube(pts, 0.021, rubber, segments=8)
    # crank handle on the front hub
    b.box((0, 0.222, 0.060), (0.026, 0.024, 0.120), iron, bevel=0.002)
    b.cyl((0, 0.232, 0.112), 0.013, 0.052, axis='X', mat=brass, segments=10)
    # clipped nozzle at the front bottom
    b.box((0.170, 0.200, -0.245), (0.070, 0.040, 0.030), iron, bevel=0.002)
    b.cyl((0.170, 0.208, -0.290), 0.021, 0.090, axis='Z', mat=brass, segments=10)
    b.cyl((0.170, 0.208, -0.348), 0.013, 0.032, axis='Z', mat=brass, segments=10)
    # short free hose end connecting the coil to the nozzle
    b.tube([(0.088, 0.172, -0.188), (0.112, 0.190, -0.212), (0.143, 0.198, -0.238),
            (0.164, 0.204, -0.258)], 0.018, rubber, segments=8)
    obj = b.finish(coll, location=(0, 0, 0))
    return obj


# --------------------------------------------------------------------------- #
# N07 supply containers
# --------------------------------------------------------------------------- #
def build_supply_container(m, coll, uv):
    b = Build('SM_Corridor_Supply_Container', UV_SCALE)
    cream, olive, iron = m['cream'], m['olive'], m['iron']
    b.frustum(0, 0.0, 0.0, 0.150, (0.285, 0.195), (0.310, 0.213), cream)
    # lid and lip
    b.frustum(0, 0.0, 0.150, 0.168, (0.322, 0.224), (0.316, 0.220), cream)
    b.box((0, 0.0, 0.174), (0.300, 0.206, 0.012), cream, bevel=0.002)
    # flat bar handle over the lid
    b.box((0, 0.0, 0.200), (0.150, 0.026, 0.014), iron, bevel=0.002)
    for sx in (-0.062, 0.062):
        b.box((sx, 0.0, 0.188), (0.024, 0.024, 0.026), iron, bevel=0.001)
    # side latches
    for sx in (-0.158, 0.158):
        b.box((sx, 0.0, 0.150), (0.014, 0.050, 0.030), iron, bevel=0.001)
    # front sticker
    b.quad([(-0.060, 0.100, 0.050), (0.060, 0.100, 0.050), (0.060, 0.100, 0.110), (-0.060, 0.100, 0.110)],
           m['atlas'], uv['supplies'], (0, 1, 0))
    return b.finish(coll, location=(0, 0, 0))


def build_lidded_case(m, coll, uv):
    b = Build('SM_Corridor_Lidded_Case', UV_SCALE)
    olive, brass, iron = m['olive'], m['brass'], m['iron']
    b.frustum(0, 0.0, 0.0, 0.108, (0.270, 0.180), (0.292, 0.198), olive)
    b.frustum(0, 0.0, 0.108, 0.136, (0.300, 0.206), (0.296, 0.202), olive)
    # lid lip and handle
    b.box((0, 0.0, 0.140), (0.140, 0.024, 0.012), iron, bevel=0.002)
    for sx in (-0.148, 0.148):
        pts = []
        for i in range(7):
            t = math.pi * i / 6
            pts.append((sx + math.cos(t) * 0.018, math.cos(t) * 0.026, 0.086 + math.sin(t) * 0.038))
        b.tube(pts, 0.007, iron, segments=6)
    # front latch
    b.box((0, 0.104, 0.112), (0.052, 0.014, 0.040), brass, bevel=0.002)
    b.box((0, 0.112, 0.096), (0.030, 0.010, 0.030), brass, bevel=0.001)
    # corner straps
    for sx in (-0.135, 0.135):
        b.box((sx, 0.100, 0.060), (0.018, 0.012, 0.100), iron, bevel=0.001)
    # label
    b.quad([(-0.045, 0.101, 0.052), (0.045, 0.101, 0.052), (0.045, 0.101, 0.088), (-0.045, 0.101, 0.088)],
           m['atlas'], uv['utility'], (0, 1, 0))
    return b.finish(coll, location=(0, 0, 0))


def build_open_bin(m, coll, uv):
    b = Build('SM_Corridor_Open_Bin', UV_SCALE)
    gray, iron, rubber = m['gray'], m['iron'], m['rubber']
    b.frustum(0, 0.0, 0.0, 0.278, (0.280, 0.220), (0.330, 0.270), gray)
    # dark open top under the rim
    b.quad([(-0.145, -0.117, 0.281), (0.145, -0.117, 0.281), (0.145, 0.117, 0.281), (-0.145, 0.117, 0.281)],
           rubber, (0.001, 0.001, 0.002, 0.002), (0, 0, 1))
    # rim ring: four bars leaving the top open
    b.box((0, -0.128, 0.284), (0.340, 0.032, 0.018), gray, bevel=0.002)
    b.box((0, 0.128, 0.284), (0.340, 0.032, 0.018), gray, bevel=0.002)
    b.box((-0.158, 0.0, 0.284), (0.032, 0.290, 0.018), gray, bevel=0.002)
    b.box((0.158, 0.0, 0.284), (0.032, 0.290, 0.018), gray, bevel=0.002)
    # front label plate
    b.box((0, 0.134, 0.210), (0.120, 0.010, 0.060), iron, bevel=0.001)
    b.quad([(-0.054, 0.140, 0.216), (0.054, 0.140, 0.216), (0.054, 0.140, 0.264), (-0.054, 0.140, 0.264)],
           m['atlas'], uv['supplies'], (0, 1, 0))
    return b.finish(coll, location=(0, 0, 0))


def bmesh_flip(b, faces):
    bm = b.bm
    for f in faces:
        f.normal_flip()


# --------------------------------------------------------------------------- #
# assembly
# --------------------------------------------------------------------------- #
def build_all():
    bpy.context.view_layer.update()
    wipe_collection(COLL_NAME)
    m = build_materials()
    scene_coll = bpy.context.scene.collection
    root = collection(COLL_NAME, scene_coll)
    sub = {
        'n03': collection('N03_Electrical_Cabinet', root),
        'n05': collection('N05_WorkOrder_Panel', root),
        'n06': collection('N06_Hose_Reel', root),
        'n07': collection('N07_Supply_Containers', root),
        't01': collection('T01_Graphics_Source', root),
    }
    uv = {k: t01_atlas.uv_rect(k) for k in t01_atlas.CELLS}
    if not os.path.isfile(ATLAS_PNG) or os.path.getsize(ATLAS_PNG) < 1000:
        t01_atlas.build_atlas(sub['t01'], ATLAS_PNG,
                              r'D:/AI/MarkWorkspace/.mrmak/total-insanitation/corridor-production/tools/t01-text-layer.png')
    t01_atlas.build_source(sub['t01'])

    objs = []
    cabinet = build_cabinet(m, sub['n03'], uv)
    panel = build_panel(m, sub['n05'], uv)
    paper = build_paper_sheet(m, sub['n05'], uv)
    reel = build_reel(m, sub['n06'], uv)
    container = build_supply_container(m, sub['n07'], uv)
    case = build_lidded_case(m, sub['n07'], uv)
    bin_obj = build_open_bin(m, sub['n07'], uv)

    layout = [(cabinet, 'N03', 0.0), (panel, 'N05', 0.22), (paper, 'N05', 0.0),
              (reel, 'N06', 0.36), (container, 'N07', 0.0), (case, 'N07', 0.0), (bin_obj, 'N07', 0.0)]
    x = 0.0
    for obj, family, zoff in layout:
        obj['corridor_family'] = family
        obj['corridor_pass'] = '2026-11-12'
        obj.location = (x, -20.0, zoff)
        objs.append(obj)
        x += 1.5
    return objs, m


if __name__ == '__main__' or True:
    pass
