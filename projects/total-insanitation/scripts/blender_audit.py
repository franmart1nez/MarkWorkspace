"""Run with Blender --background <source.blend> --python this.py -- <output.json>.

Read-only source audit. Writes only the requested report, never the blend file.
"""
import json
from pathlib import Path
import sys

import bpy

def plain(value):
    if hasattr(value, 'to_dict'):
        return plain(value.to_dict())
    if hasattr(value, 'to_list'):
        return plain(value.to_list())
    if isinstance(value, dict):
        return {k: plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [plain(v) for v in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)

def image_nodes(tree, seen=None):
    seen = set() if seen is None else seen
    if not tree or tree.as_pointer() in seen:
        return []
    seen.add(tree.as_pointer())
    records = []
    for node in tree.nodes:
        if getattr(node, 'image', None):
            records.append({'tree': tree.name, 'node': node.name,
                            'image': node.image.name,
                            'linked_outputs': any(s.is_linked for s in node.outputs)})
        records.extend(image_nodes(getattr(node, 'node_tree', None), seen))
    return records

output = Path(sys.argv[sys.argv.index('--') + 1])
objects = []
for obj in bpy.data.objects:
    record = {
        'name': obj.name, 'type': obj.type,
        'collections': [c.name for c in obj.users_collection],
        'location': list(obj.location), 'dimensions': list(obj.dimensions),
        'scale': list(obj.scale),
        'parent': obj.parent.name if obj.parent else None,
        'children': [o.name for o in obj.children],
        'hide_viewport': obj.hide_viewport, 'hide_render': obj.hide_render,
        'visible': obj.visible_get(),
        'custom_properties': {k: plain(v) for k, v in obj.items()},
    }
    if obj.type == 'MESH':
        record.update(vertices=len(obj.data.vertices), polygons=len(obj.data.polygons),
                      uv_maps=[uv.name for uv in obj.data.uv_layers],
                      color_attributes=[a.name for a in obj.data.color_attributes],
                      modifiers=[{'name': m.name, 'type': m.type} for m in obj.modifiers],
                      materials=[m.name if m else None for m in obj.data.materials])
    objects.append(record)
images = []
for img in bpy.data.images:
    if img.source != 'FILE':
        continue
    resolved = Path(bpy.path.abspath(img.filepath, library=img.library))
    images.append({'name': img.name, 'path': str(resolved),
                   'exists': resolved.is_file(), 'packed': bool(img.packed_file),
                   'raw_path': img.filepath, 'users': img.users,
                   'color_space': img.colorspace_settings.name})
    images[-1]['datablock_users'] = [
        {'type': type(owner).__name__, 'name': owner.name}
        for owner in bpy.data.user_map(subset={img}).get(img, set())]

material_usage = []
for mat in bpy.data.materials:
    material_usage.append({'name': mat.name, 'users': mat.users,
        'fake_user': mat.use_fake_user,
        'objects': [o.name for o in bpy.data.objects
                    if any(s.material == mat for s in o.material_slots)],
        'image_nodes': image_nodes(mat.node_tree)})
for img in images:
    img['material_nodes'] = [{'material': m['name'], 'objects': m['objects'], **node}
                             for m in material_usage for node in m['image_nodes']
                             if node['image'] == img['name']]
    img['image_objects'] = [o.name for o in bpy.data.objects
                            if o.type == 'EMPTY' and o.data and o.data.name == img['name']]

data = {
    'source': bpy.data.filepath, 'blender': bpy.app.version_string,
    'scene': bpy.context.scene.name,
    'unit_system': bpy.context.scene.unit_settings.system,
    'scale_length': bpy.context.scene.unit_settings.scale_length,
    'collections': [{'name': c.name, 'objects': len(c.objects),
                     'object_names': [o.name for o in c.objects],
                     'hide_viewport': c.hide_viewport, 'hide_render': c.hide_render,
                     'children': [child.name for child in c.children]} for c in bpy.data.collections],
    'root_collections': [c.name for c in bpy.context.scene.collection.children],
    'scene_properties': {k: plain(v) for k, v in bpy.context.scene.items()},
    'objects': objects, 'materials': [m.name for m in bpy.data.materials],
    'material_usage': material_usage, 'images': images,
    'libraries': [{'path': l.filepath, 'exists': Path(bpy.path.abspath(l.filepath)).is_file()}
                  for l in bpy.data.libraries],
    'source_modified': False,
}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(data, indent=2), encoding='utf-8')
print('AUDIT_OK', len(objects), 'objects;', len(images), 'image references;', output)
