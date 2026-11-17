"""Lay out the actual approved-raster SVG traces for fidelity/background/size review.

The character paths are read from prepared SVGs, never rebuilt from primitives.
Only the presentation panels and labels are newly drawn.
"""
import base64
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[3]
CARD = ROOT / 'workspace/2026-11-12_total-insanitation'
RUN = ROOT / '.mrmak/total-insanitation/stage-4/svg-trace-v02'
SRC = CARD / 'sources/mascot-trace-v02'
NS = '{http://www.w3.org/2000/svg}'
INK, PAPER, MUTED, YELLOW = '#171713', '#f3efdf', '#676457', '#f4cb3d'


def text(x, y, label, size=22, bold=False, fill=INK, **attrs):
    extra = ' '.join(f'{k.replace("_", "-")}="{v}"' for k, v in attrs.items())
    return f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{700 if bold else 400}" fill="{fill}" {extra}>{escape(label)}</text>'


def lines(x, y, rows, size=22, leading=32, **kwargs):
    return ''.join(text(x, y + leading * i, value, size, **kwargs) for i, value in enumerate(rows))


def defs():
    out = '<defs>'
    for pose in ['point-left', 'mopping']:
        root = ET.parse(SRC / f'wizard-{pose}-v02.svg').getroot()
        d = next(e.get('d') for e in root.iter() if e.tag == NS + 'path')
        out += f'<symbol id="{pose}" viewBox="0 0 1254 1254"><path d="{d}" fill="currentColor" fill-rule="nonzero"/></symbol>'
    return out + '</defs>'


def svg(width, height, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" style="font-family:Arial,Helvetica,sans-serif;color:{INK}">{defs()}<rect width="{width}" height="{height}" fill="{PAPER}"/>{body}</svg>\n'


def header(kicker, title, subtitle):
    return text(48, 48, kicker, 15, True, letter_spacing='2') + text(48, 108, title, 44, True) + text(48, 148, subtitle, 21, fill=MUTED)


def vector(pose, x, y, size, color='#000000', viewbox='0 0 1254 1254'):
    return f'<svg x="{x}" y="{y}" width="{size}" height="{size}" viewBox="{viewbox}" style="color:{color}"><use href="#{pose}" width="1254" height="1254"/></svg>'


def image(pose, x, y, size, viewbox='0 0 1254 1254'):
    filename = 'point-left-01.png' if pose == 'point-left' else 'mopping-01.png'
    data = base64.b64encode((CARD / 'media/mascot-chatgpt-round-01' / filename).read_bytes()).decode()
    return f'<svg x="{x}" y="{y}" width="{size}" height="{size}" viewBox="{viewbox}"><image width="1254" height="1254" href="data:image/png;base64,{data}"/></svg>'


def panel(x, y, width, height, fill='#ffffff'):
    return f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="12" fill="{fill}"/>'


metrics = {m['pose']: m for m in json.loads((RUN / 'fidelity.json').read_text())}
comparison = header('STAGE 4 / APPROVED RASTER TO SVG / V02', 'Approved images, faithful vector contours', 'Original framing, poses and ground lines preserved. The vector artwork contains editable paths, not embedded images.')
for i, pose in enumerate(['point-left', 'mopping']):
    x = 48 + i * 780
    title = '01 / Pointing left' if pose == 'point-left' else '02 / Mopping'
    comparison += text(x, 210, title, 24, True)
    for j, label in enumerate(['APPROVED CHATGPT IMAGE', 'TRACED SVG']):
        xx = x + j * 370
        comparison += text(xx, 250, label, 16, True) + panel(xx, 275, 350, 350)
        comparison += image(pose, xx, 275, 350) if j == 0 else vector(pose, xx, 275, 350)
    comparison += text(x, 675, 'HAND / GRIP DETAIL', 17, True)
    view = '240 470 190 190' if pose == 'point-left' else '415 550 170 170'
    for j, label in enumerate(['Raster', 'SVG']):
        xx = x + j * 370
        comparison += panel(xx, 695, 350, 260)
        comparison += image(pose, xx + 45, 695, 260, view) if j == 0 else vector(pose, xx + 45, 695, 260, viewbox=view)
        comparison += text(xx + 15, 985, label, 18, True)
    comparison += text(x, 1040, f"Foreground silhouette overlap: {metrics[pose]['foreground_iou_percent']:.2f}%", 22, True)
comparison += lines(48, 1110, ['Measured at 1254 × 1254 with a 50% binary threshold. All binary differences stay within a 1-pixel boundary band.', 'White paper and light regions became transparency. Fine grey edge pixels were normalized to one ink; no anatomy was reconstructed.'], 21, 32)

backgrounds = header('STAGE 4 / TRACED SVG CONTRAST REVIEW', 'Same contours, different backgrounds', 'Only ink and presentation background change. No compact redesign, new pose or sign-system approval is implied.')
for row, pose in enumerate(['point-left', 'mopping']):
    y = 220 + row * 435
    backgrounds += text(48, y - 18, 'POINTING LEFT' if row == 0 else 'MOPPING', 19, True)
    for col, (label, bg, color) in enumerate([('Black / light', '#ffffff', '#000000'), ('White / dark', '#171713', '#ffffff'), ('Black / yellow', YELLOW, '#000000')]):
        x = 48 + col * 500
        backgrounds += panel(x, y, 470, 350, bg) + vector(pose, x + 60, y + 7, 335, color)
        backgrounds += text(x, y + 388, label, 20, True)
backgrounds += lines(48, 1120, ['The SVG background is transparent, including the orb sparkle, hand separations and spaces between limbs.', 'These are review backgrounds. World-sign lighting, texture mips and gameplay scale still need a later native check.'], 21, 32)

sizes = header('STAGE 4 / ACTUAL DISPLAY-SIZE STUDY', 'Read the traced shape at its display size', 'Open this sheet at 100% for the labeled pixel sizes. Every sample uses the same unchanged vector path.')
for row, pose in enumerate(['point-left', 'mopping']):
    y = 250 + row * 440
    sizes += text(48, y - 48, 'POINTING LEFT' if row == 0 else 'MOPPING', 20, True)
    for col, size in enumerate([32, 48, 64, 96, 128, 256]):
        x = 48 + col * 292
        sizes += text(x, y - 10, f'{size} px canvas', 20, True) + panel(x, y + 18, 270, 300)
        sizes += vector(pose, x + 7, y + 33, size)
sizes += lines(48, 1130, ['32 / 48 px expose detail loss; they are diagnostic examples. At 64 px, inspect the silhouette before relying on small grip or sparkle details.', 'Use the larger examples to judge the selected contours. No world-sign minimum size or engine mip performance is established here.'], 22, 34)

for name, width, height, body in [
    ('trace-comparison-v02.svg', 1600, 1205, comparison),
    ('backgrounds-v02.svg', 1600, 1220, backgrounds),
    ('sizes-v02.svg', 1850, 1230, sizes),
]:
    (SRC / name).write_text(svg(width, height, body), encoding='utf-8')
print('Prepared 3 editable review sheets using the actual trace paths.')
