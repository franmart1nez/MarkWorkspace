"""Prepare one-ink SVGs from Adobe's traces of the approved raster actions.

Consumes the returned vector paths; never reconstructs mascot anatomy. Boolean
path operations remove the white matte and retain its negative spaces as holes.
Use a new version directory for later edits. Raw Adobe SVGs remain preserved.
"""
import copy
import hashlib
import json
import re
from pathlib import Path
import xml.etree.ElementTree as ET

import pathops
from fontTools.svgLib.path import parse_path
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parents[3]
RUN = ROOT / '.mrmak/total-insanitation/stage-4/svg-trace-v02'
CARD = ROOT / 'workspace/2026-11-12_total-insanitation'
COPIES = CARD / 'sources/mascot-trace-v02'
SOURCE = Path('D:/GameJam/Total (in)Sanitation/Utility_Materials/TrimSheet&Atlas/General_Atlas/Resources/Pet/Development/Stage4_Trace_v02')
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)

for folder in [SOURCE, COPIES]:
    folder.mkdir(parents=True, exist_ok=True)
    previous = folder / 'manifest.json'
    if previous.exists():
        manifest = json.loads(previous.read_text(encoding='utf-8'))
        for name, sha in manifest.get('svg_hashes', {}).items():
            target = folder / name
            if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != sha:
                raise RuntimeError('Preserve hand-edited source; create a new revision: ' + str(target))


def prepared_path(svg_root):
    ink = pathops.Path()
    count = 0
    for e in svg_root.iter():
        if e.tag != '{' + NS + '}path':
            continue
        assert not e.get('transform'), 'Inspect transformed paths explicitly'
        rgb = [int(x) for x in re.findall(r'\d+', e.get('fill', ''))]
        assert len(rgb) == 3, e.attrib
        luminance = sum(rgb) / 3
        shape = pathops.Path()
        parse_path(e.attrib['d'], shape.getPen())
        if e.get('fill-rule') == 'evenodd':
            shape.fillType = pathops.FillType.EVEN_ODD
        operation = pathops.PathOp.UNION if luminance < 128 else pathops.PathOp.DIFFERENCE
        ink = pathops.op(ink, shape, operation)
        count += 1
    pen = SVGPathPen(None)
    ink.draw(pen)
    return pen.getCommands(), count


manifest = {
    'version': 'trace-v02', 'status': 'approved-raster-derived-vector',
    'approval': 'Owner accepted both generated action images before tracing',
    'method': 'Adobe image_vectorize; existing vector paths consolidated with winding-aware union/difference',
    'geometry_policy': 'No anatomy reconstruction, pose normalization, path smoothing or baseline removal',
    'viewbox_policy': 'Preserve approved 1254-square raster coordinates and framing',
    'ink_policy': 'One solid ink; source white/light regions become transparent negative spaces',
    'new_generation_calls': 0, 'native_imported': False, 'items': [], 'svg_hashes': {},
}
for pose, raster_id in [('point-left', 'point-left-01'), ('mopping', 'mopping-01')]:
    raw = RUN / (pose + '-adobe.svg')
    source_root = ET.parse(raw).getroot()
    assert source_root.get('width') == '1254' and source_root.get('height') == '1254'
    pathdata, adobe_paths = prepared_path(source_root)
    raster = CARD / 'media/mascot-chatgpt-round-01' / (raster_id + '.png')
    source_hash = hashlib.sha256(raster.read_bytes()).hexdigest()
    for folder in [SOURCE, COPIES]:
        archival = folder / 'adobe-originals'
        archival.mkdir(exist_ok=True)
        (archival / raw.name).write_bytes(raw.read_bytes())
    for color, suffix in [('#000000', ''), ('#ffffff', '-white')]:
        root = ET.Element('{' + NS + '}svg', {
            'width': '1254', 'height': '1254', 'viewBox': '0 0 1254 1254',
            'data-approved-raster-sha256': source_hash,
        })
        ET.SubElement(root, '{' + NS + '}title').text = 'Wizard / ' + pose + ' / approved raster trace v02'
        ET.SubElement(root, '{' + NS + '}desc').text = 'Editable filled Bezier contours traced from the owner-selected ChatGPT image. Transparent holes, unchanged framing and ground line. No embedded bitmap.'
        # Preserve the vectorizer's provenance metadata in the derived master.
        for e in source_root:
            if e.tag == '{' + NS + '}metadata':
                root.append(copy.deepcopy(e))
        group = ET.SubElement(root, '{' + NS + '}g', {'id': 'approved-traced-silhouette'})
        ET.SubElement(group, '{' + NS + '}path', {'id': 'ink-compound-path', 'd': pathdata, 'fill': color, 'fill-rule': 'nonzero'})
        data = ET.tostring(root, encoding='utf-8', xml_declaration=True) + b'\n'
        name = 'wizard-' + pose + '-v02' + suffix + '.svg'
        for folder in [SOURCE, COPIES]:
            (folder / name).write_bytes(data)
        manifest['svg_hashes'][name] = hashlib.sha256(data).hexdigest()
    manifest['items'].append({'pose': pose, 'approved_raster': str(raster.relative_to(CARD)).replace('\\', '/'),
        'approved_raster_sha256': source_hash, 'raw_adobe_svg_sha256': hashlib.sha256(raw.read_bytes()).hexdigest(),
        'adobe_path_count': adobe_paths, 'compound_contours': len(re.findall('[Mm]', pathdata)),
        'svg': 'wizard-' + pose + '-v02.svg', 'white_svg': 'wizard-' + pose + '-v02-white.svg'})

for folder in [SOURCE, COPIES]:
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
(RUN / 'prepared.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(json.dumps({'prepared': len(manifest['items']), 'svg_variants': len(manifest['svg_hashes']), 'source': str(SOURCE)}))
