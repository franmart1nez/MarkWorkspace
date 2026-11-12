"""T01 corridor graphics atlas: editable Blender text source + numpy-drawn graphics.

Run inside Blender (background or live).  Produces a 1024x1024 sRGB PNG used by
the sign faces, work-order papers and the analog meter.
"""
import bpy
import math
import os
import struct
import zlib
import numpy as np
from mathutils import Vector

ATLAS = 1024
SUPERSAMPLE = 2
CANVAS_CENTER = Vector((0.512, -300.0, 0.0))   # metres, far from production layout
TEXT_Z = 0.002

CREAM = (0.855, 0.815, 0.690)
CREAM_WORN = (0.800, 0.755, 0.620)
PAPER = (0.910, 0.880, 0.780)
DARK = (0.115, 0.105, 0.090)
INK = (0.145, 0.130, 0.100)
OLIVE = (0.255, 0.275, 0.185)
YELLOW = (0.860, 0.720, 0.180)
RED = (0.560, 0.110, 0.080)
WHITE = (0.930, 0.915, 0.860)
BLACK = (0.055, 0.052, 0.048)

# --------------------------------------------------------------------------- #
# cells: name -> (x0, y0, w, h, kind)
# --------------------------------------------------------------------------- #
CELLS = {
    'equipment':  (0, 768, 512, 256),
    'service':    (512, 768, 512, 256),
    'collection': (0, 512, 512, 256),
    'caution':    (512, 512, 512, 256),
    'meter':      (0, 256, 256, 256),
    'water':      (256, 256, 256, 256),
    'paper_a':    (512, 256, 256, 256),
    'paper_b':    (768, 256, 256, 256),
    'paper_c':    (0, 0, 256, 256),
    'supplies':   (256, 0, 256, 256),
    'blank':      (512, 0, 256, 256),
    'utility':    (768, 0, 256, 256),
}


def uv_rect(cell):
    x, y, w, h = CELLS[cell]
    return (x / ATLAS, y / ATLAS, (x + w) / ATLAS, (y + h) / ATLAS)


# --------------------------------------------------------------------------- #
# source objects (editable)
# --------------------------------------------------------------------------- #
def build_source(source_coll):
    for obj in list(source_coll.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    font = None
    for f in bpy.data.fonts:
        if f.name.startswith('Bfont'):
            font = f
            break

    def add_text(name, body, px, py, size_px, color, align='CENTER', spacing=1.0):
        cu = bpy.data.curves.new(name, type='FONT')
        cu.body = body
        cu.align_x = align
        cu.align_y = 'CENTER'
        cu.size = size_px * 0.001
        cu.offset = size_px * 0.001 * 0.022
        cu.space_character = spacing
        if font:
            cu.font = font
        ob = bpy.data.objects.new(name, cu)
        source_coll.objects.link(ob)
        ob.location = (CANVAS_CENTER.x - 0.512 + px / 1000.0,
                       CANVAS_CENTER.y - 0.512 + py / 1000.0,
                       TEXT_Z)
        ob.color = (srgb_to_linear(color[0]), srgb_to_linear(color[1]), srgb_to_linear(color[2]), 1.0)
        return ob

    # --- plaque faces ------------------------------------------------------ #
    add_text('T01_TXT_Equipment', 'EQUIPMENT', 188, 896, 60, INK)
    add_text('T01_TXT_Service', 'SERVICE', 768, 892, 85, INK)
    add_text('T01_TXT_Collection', 'COLLECTION', 238, 640, 55, INK)
    add_text('T01_TXT_Danger', 'DANGER', 772, 706, 58, BLACK)
    add_text('T01_TXT_HighVoltage', 'HIGH VOLTAGE', 772, 638, 34, BLACK)

    # --- meter ------------------------------------------------------------- #
    add_text('T01_TXT_MeterUnit', 'VOLTS', 128, 300, 12, INK)
    meter_labels = [('0', -160), ('20', -123), ('40', -86), ('60', -49), ('80', -12), ('100', 25)]
    for text, deg in meter_labels:
        ang = math.radians(deg)
        add_text('T01_TXT_Meter_' + text, text, 128 + math.cos(ang) * 66,
                 384 + math.sin(ang) * 66, 12, INK)

    # --- papers ------------------------------------------------------------ #
    add_text('T01_TXT_WorkOrder', 'WORK ORDER', 640, 470, 20, INK, align='CENTER', spacing=1.08)
    add_text('T01_TXT_FormNo', 'FORM 27-B', 640, 444, 11, INK)
    add_text('T01_TXT_Maintenance', 'MAINTENANCE', 896, 470, 17, INK, spacing=1.05)
    add_text('T01_TXT_Checklist', 'DAILY CHECK', 896, 446, 11, INK)
    add_text('T01_TXT_Log', 'SERVICE LOG', 128, 214, 16, INK, spacing=1.05)

    # --- utility / supplies ------------------------------------------------ #
    add_text('T01_TXT_Utility', 'UTILITY', 896, 150, 46, INK)
    add_text('T01_TXT_Water', 'UTILITY', 384, 300, 17, BLACK)
    add_text('T01_TXT_Water2', 'WATER', 384, 276, 17, BLACK)
    add_text('T01_TXT_Supplies', 'SUPPLIES', 384, 116, 40, CREAM)

    # keep the camera out of the source collection
    return source_coll


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


# --------------------------------------------------------------------------- #
# render the text layer
# --------------------------------------------------------------------------- #
def render_text_layer(path):
    scene = bpy.context.scene
    settings = {
        'engine': scene.render.engine,
        'res_x': scene.render.resolution_x,
        'res_y': scene.render.resolution_y,
        'pct': scene.render.resolution_percentage,
        'film_transparent': scene.render.film_transparent,
        'filepath': scene.render.filepath,
        'camera': scene.camera,
        'view_transform': scene.view_settings.view_transform,
        'look': scene.view_settings.look,
        'light': scene.display.shading.light,
        'color_type': scene.display.shading.color_type,
        'show_shadows': scene.display.shading.show_shadows,
        'show_cavity': scene.display.shading.show_cavity,
        'show_specular': scene.display.shading.show_specular_highlight,
        'aa': scene.display.render_aa,
        'image_settings': scene.render.image_settings.file_format,
        'color_mode': scene.render.image_settings.color_mode,
        'color_depth': scene.render.image_settings.color_depth,
    }
    cam_data = bpy.data.cameras.new('T01_Cam_TMP')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = 1.024
    cam = bpy.data.objects.new('T01_Cam_TMP', cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = (CANVAS_CENTER.x, CANVAS_CENTER.y, 1.0)
    cam.rotation_euler = (0.0, 0.0, 0.0)
    try:
        scene.render.engine = 'BLENDER_WORKBENCH'
        scene.render.resolution_x = ATLAS
        scene.render.resolution_y = ATLAS
        scene.render.resolution_percentage = 100
        scene.render.film_transparent = True
        scene.render.filepath = path
        scene.camera = cam
        scene.view_settings.view_transform = 'Standard'
        scene.view_settings.look = 'None'
        scene.display.shading.light = 'FLAT'
        scene.display.shading.color_type = 'OBJECT'
        scene.display.shading.show_shadows = False
        scene.display.shading.show_cavity = False
        scene.display.shading.show_specular_highlight = False
        scene.display.render_aa = '8'
        scene.render.image_settings.file_format = 'PNG'
        scene.render.image_settings.color_mode = 'RGBA'
        scene.render.image_settings.color_depth = '8'
        bpy.ops.render.render(write_still=True)
    finally:
        scene.render.engine = settings['engine']
        scene.render.resolution_x = settings['res_x']
        scene.render.resolution_y = settings['res_y']
        scene.render.resolution_percentage = settings['pct']
        scene.render.film_transparent = settings['film_transparent']
        scene.render.filepath = settings['filepath']
        scene.camera = settings['camera']
        scene.view_settings.view_transform = settings['view_transform']
        scene.view_settings.look = settings['look']
        scene.display.shading.light = settings['light']
        scene.display.shading.color_type = settings['color_type']
        scene.display.shading.show_shadows = settings['show_shadows']
        scene.display.shading.show_cavity = settings['show_cavity']
        scene.display.shading.show_specular_highlight = settings['show_specular']
        scene.display.render_aa = settings['aa']
        scene.render.image_settings.file_format = settings['image_settings']
        scene.render.image_settings.color_mode = settings['color_mode']
        scene.render.image_settings.color_depth = settings['color_depth']
        bpy.data.objects.remove(cam, do_unlink=True)
        bpy.data.cameras.remove(cam_data)


# --------------------------------------------------------------------------- #
# numpy drawing
# --------------------------------------------------------------------------- #
def new_base():
    n = ATLAS * SUPERSAMPLE
    img = np.zeros((n, n, 4), dtype=np.float32)
    img[:, :, 3] = 1.0
    return img


def paint_rect(img, x0, y0, w, h, color):
    s = SUPERSAMPLE
    img[y0 * s:(y0 + h) * s, x0 * s:(x0 + w) * s, :3] = color


def paint_poly(img, pts, color, cell=None):
    """Fill a polygon given in atlas pixels using a supersampled mask."""
    s = SUPERSAMPLE
    n = img.shape[0]
    yy, xx = np.mgrid[0:n, 0:n]
    px = xx / s + 0.5 / s
    py = yy / s + 0.5 / s
    inside = np.zeros((n, n), dtype=bool)
    count = len(pts)
    j = count - 1
    for i in range(count):
        xi, yi = pts[i]
        xj, yj = pts[j]
        cond = ((yi > py) != (yj > py)) & (px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi)
        inside ^= cond
        j = i
    img[inside, :3] = color


def paint_disc(img, cx, cy, r, color, inner=0.0):
    s = SUPERSAMPLE
    n = img.shape[0]
    yy, xx = np.mgrid[0:n, 0:n]
    px = xx / s + 0.5 / s
    py = yy / s + 0.5 / s
    d = np.hypot(px - cx, py - cy)
    mask = d <= r
    if inner > 0:
        mask &= d >= inner
    img[mask, :3] = color


def paint_line(img, p0, p1, thickness, color):
    s = SUPERSAMPLE
    n = img.shape[0]
    yy, xx = np.mgrid[0:n, 0:n]
    px = xx / s + 0.5 / s
    py = yy / s + 0.5 / s
    x0, y0 = p0
    x1, y1 = p1
    dx, dy = x1 - x0, y1 - y0
    L2 = dx * dx + dy * dy + 1e-12
    t = ((px - x0) * dx + (py - y0) * dy) / L2
    t = np.clip(t, 0, 1)
    d = np.hypot(px - (x0 + t * dx), py - (y0 + t * dy))
    img[d <= thickness * 0.5, :3] = color


def paper_lines(img, x0, y0, w, h, color, top_pad=34, bottom_pad=14, spacing=13, thickness=1.0):
    y = y0 + h - top_pad
    while y > y0 + bottom_pad:
        paint_rect(img, x0 + 14, int(y), w - 28, int(max(1, thickness)), color)
        y -= spacing


# --------------------------------------------------------------------------- #
# compose
# --------------------------------------------------------------------------- #
def compose(text_rgba):
    img = new_base()
    s = SUPERSAMPLE

    # plaque cells ---------------------------------------------------------- #
    for cell in ('equipment', 'service', 'collection'):
        x, y, w, h = CELLS[cell]
        paint_rect(img, x, y, w, h, CREAM)
        # inset painted border
        for inset, col in ((10, DARK),):
            paint_rect(img, x + inset, y + inset, w - 2 * inset, 2, col)
            paint_rect(img, x + inset, y + h - inset - 2, w - 2 * inset, 2, col)
            paint_rect(img, x + inset, y + inset, 2, h - 2 * inset, col)
            paint_rect(img, x + w - inset - 2, y + inset, 2, h - 2 * inset, col)
        # sparse wear/chips in the enamel edge
        rng = np.random.default_rng(7 + x)
        for _ in range(26):
            cx = x + int(rng.integers(4, w - 4))
            cy = y + int(rng.integers(4, h - 4))
            if min(cx - x, x + w - cx, cy - y, y + h - cy) < 22:
                r = int(rng.integers(1, 3))
                paint_disc(img, cx, cy, r, CREAM_WORN)

    # equipment arrow ------------------------------------------------------- #
    x, y, w, h = CELLS['equipment']
    ax, ay = x + 388, y + h // 2
    paint_rect(img, ax, ay - 4, 74, 8, INK)
    paint_poly(img, [(ax + 74, ay + 24), (ax + 74, ay - 24), (ax + 116, ay)], INK)

    # caution plate --------------------------------------------------------- #
    x, y, w, h = CELLS['caution']
    paint_rect(img, x, y, w, h, YELLOW)
    paint_rect(img, x + 8, y + 8, w - 16, 4, BLACK)
    paint_rect(img, x + 8, y + h - 12, w - 16, 4, BLACK)
    paint_rect(img, x + 8, y + 8, 4, h - 16, BLACK)
    paint_rect(img, x + w - 12, y + 8, 4, h - 16, BLACK)
    # lightning bolt icon
    bolt = [(x + 74, y + 206), (x + 120, y + 206), (x + 96, y + 150), (x + 132, y + 150),
            (x + 76, y + 60), (x + 86, y + 122), (x + 56, y + 122)]
    paint_poly(img, bolt, BLACK)
    paint_poly(img, [(px + 2, py + 2) for px, py in bolt], BLACK)

    # meter face ------------------------------------------------------------ #
    x, y, w, h = CELLS['meter']
    paint_rect(img, x, y, w, h, WHITE)
    cx, cy = x + 128, y + 128
    paint_disc(img, cx, cy, 104, BLACK, inner=98)
    paint_disc(img, cx, cy, 96, WHITE)
    for i in range(41):
        ang = math.radians(-160 + i * (175 - (-160)) / 40)
        r0 = 78 if i % 5 else 70
        p0 = (cx + math.cos(ang) * r0, cy + math.sin(ang) * r0)
        p1 = (cx + math.cos(ang) * 88, cy + math.sin(ang) * 88)
        paint_line(img, p0, p1, 2.2 if i % 5 else 3.4, BLACK)
    # needle at ~62 %
    ang = math.radians(-160 + 0.62 * 335)
    paint_line(img, (cx, cy), (cx + math.cos(ang) * 74, cy + math.sin(ang) * 74), 3.2, RED)
    paint_disc(img, cx, cy, 7, BLACK)

    # water caution plate ---------------------------------------------------- #
    x, y, w, h = CELLS['water']
    paint_rect(img, x, y, w, h, CREAM)
    paint_rect(img, x + 6, y + 6, w - 12, 3, DARK)
    paint_rect(img, x + 6, y + h - 9, w - 12, 3, DARK)
    paint_poly(img, [(x + 128, y + 226), (x + 38, y + 160), (x + 128, y + 94), (x + 218, y + 160)], YELLOW)
    # triangle outline
    for a, b in (((x + 128, y + 216), (x + 48, y + 158)),
                 ((x + 128, y + 216), (x + 208, y + 158)),
                 ((x + 48, y + 158), (x + 208, y + 158))):
        paint_line(img, a, b, 3.0, BLACK)
    # exclamation mark
    paint_rect(img, x + 125, y + 140, 7, 34, BLACK)
    paint_rect(img, x + 125, y + 128, 7, 7, BLACK)

    # papers ---------------------------------------------------------------- #
    for cell in ('paper_a', 'paper_b', 'paper_c'):
        x, y, w, h = CELLS[cell]
        paint_rect(img, x, y, w, h, PAPER)
        rng = np.random.default_rng(11 + x)
        for _ in range(30):
            px = x + int(rng.integers(0, w))
            py = y + int(rng.integers(0, h))
            paint_disc(img, px, py, float(rng.uniform(0.6, 1.6)), CREAM_WORN)

    x, y, w, h = CELLS['paper_a']
    paint_rect(img, x + 18, y + 236, w - 36, 2, INK)
    paint_rect(img, x + 18, y + 226, w - 36, 1, INK)
    paper_lines(img, x, y, w, h, (0.62, 0.58, 0.48), top_pad=70, bottom_pad=96, spacing=12, thickness=1)
    paint_rect(img, x + 18, y + 26, w - 36, 1, INK)
    paint_rect(img, x + 18, y + 26, 1, 46, INK)
    paint_rect(img, x + w - 19, y + 26, 1, 46, INK)
    paint_rect(img, x + 18, y + 71, w - 36, 1, INK)

    x, y, w, h = CELLS['paper_b']
    paint_rect(img, x + 16, y + 232, w - 32, 2, INK)
    for row in range(7):
        yy = y + 190 - row * 24
        paint_rect(img, x + 16, yy, 11, 11, PAPER)
        paint_rect(img, x + 16, yy, 11, 1, INK)
        paint_rect(img, x + 16, yy + 10, 11, 1, INK)
        paint_rect(img, x + 16, yy, 1, 11, INK)
        paint_rect(img, x + 26, yy, 1, 11, INK)
        paint_rect(img, x + 36, yy + 5, w - 54, 1, (0.55, 0.51, 0.42))

    x, y, w, h = CELLS['paper_c']
    paint_rect(img, x + 14, y + 238, w - 28, 2, INK)
    for row in range(9):
        yy = y + 202 - row * 20
        paint_rect(img, x + 14, yy, w - 28, 1, (0.58, 0.54, 0.44))
    paint_rect(img, x + 14, y + 36, 1, 170, INK)
    paint_rect(img, x + 92, y + 36, 1, 170, INK)

    # supplies / utility / blank -------------------------------------------- #
    x, y, w, h = CELLS['supplies']
    paint_rect(img, x, y, w, h, OLIVE)
    paint_rect(img, x + 7, y + 7, w - 14, 2, (0.72, 0.68, 0.55))
    paint_rect(img, x + 7, y + h - 9, w - 14, 2, (0.72, 0.68, 0.55))

    x, y, w, h = CELLS['utility']
    paint_rect(img, x, y, w, h, CREAM)
    paint_rect(img, x + 9, y + 9, w - 18, 2, DARK)
    paint_rect(img, x + 9, y + h - 11, w - 18, 2, DARK)

    x, y, w, h = CELLS['blank']
    paint_rect(img, x, y, w, h, CREAM)
    rng = np.random.default_rng(23)
    for _ in range(90):
        px = x + int(rng.integers(0, w))
        py = y + int(rng.integers(0, h))
        paint_disc(img, px, py, float(rng.uniform(0.7, 2.2)), CREAM_WORN)

    # composite text -------------------------------------------------------- #
    n = ATLAS
    txt = text_rgba.reshape(n, n, 4)   # row 0 = bottom
    base = img.reshape(ATLAS, SUPERSAMPLE, ATLAS, SUPERSAMPLE, 4).mean(axis=(1, 3))
    a = np.clip(txt[:, :, 3:4], 0, 1)
    rgb = base[:, :, :3] * (1 - a) + txt[:, :, :3] * a
    out = np.concatenate([rgb, np.ones((n, n, 1), dtype=np.float32)], axis=2)
    return np.clip(out, 0, 1)


def write_png(path, rgba):
    h, w, _ = rgba.shape
    data = (rgba * 255.0 + 0.5).astype(np.uint8)
    rows = data[::-1]  # PNG is top-first
    raw = b''.join(b'\x00' + rows[y].tobytes() for y in range(h))
    def chunk(tag, payload):
        return (struct.pack('>I', len(payload)) + tag + payload +
                struct.pack('>I', zlib.crc32(tag + payload) & 0xffffffff))
    png = (b'\x89PNG\r\n\x1a\n' +
           chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) +
           chunk(b'IDAT', zlib.compress(raw, 9)) +
           chunk(b'IEND', b''))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(png)


def load_text_render(path):
    img = bpy.data.images.load(path, check_existing=False)
    img.colorspace_settings.name = 'Non-Color'
    w, h = img.size
    buf = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    bpy.data.images.remove(img)
    return buf


def build_atlas(source_coll, out_png, text_render_path):
    build_source(source_coll)
    render_text_layer(text_render_path)
    buf = load_text_render(text_render_path)
    rgba = compose(buf)
    write_png(out_png, rgba)
    return out_png
