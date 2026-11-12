"""Run with Blender --background <source.blend> --python this.py -- <output.json>.

Read-only source audit. Writes only the requested report, never the blend file.
"""
import json
from pathlib import Path
import sys

import bpy

output = Path(sys.argv[sys.argv.index('--') + 1])
objects = []
for obj in bpy.data.objects:
    record = {
        'name': obj.name, 'type': obj.type,
        'collections': [c.name for c in obj.users_collection],
        'location': list(obj.location), 'dimensions': list(obj.dimensions),
        'scale': list(obj.scale),
    }
    if obj.type == 'MESH':
        record.update(vertices=len(obj.data.vertices), polygons=len(obj.data.polygons),
                      uv_maps=[uv.name for uv in obj.data.uv_layers],
                      materials=[m.name if m else None for m in obj.data.materials])
    objects.append(record)
images = []
for img in bpy.data.images:
    if img.source != 'FILE':
        continue
    resolved = Path(bpy.path.abspath(img.filepath, library=img.library))
    images.append({'name': img.name, 'path': str(resolved),
                   'exists': resolved.is_file(), 'packed': bool(img.packed_file),
                   'color_space': img.colorspace_settings.name})
data = {
    'source': bpy.data.filepath, 'blender': bpy.app.version_string,
    'scene': bpy.context.scene.name,
    'unit_system': bpy.context.scene.unit_settings.system,
    'scale_length': bpy.context.scene.unit_settings.scale_length,
    'collections': [{'name': c.name, 'objects': len(c.objects),
                     'children': [child.name for child in c.children]} for c in bpy.data.collections],
    'objects': objects, 'materials': [m.name for m in bpy.data.materials], 'images': images,
}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(data, indent=2), encoding='utf-8')
print('AUDIT_OK', len(objects), 'objects;', len(images), 'image references;', output)
