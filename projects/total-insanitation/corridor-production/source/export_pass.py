"""Addon batch export with library-layout offsets removed, then restored."""
import bpy
import os
import json


def export_targets(out_dir, report_path):
    targets = [o for o in bpy.data.objects if o.name.startswith('SM_Corridor_')]
    assert targets, 'no production objects found'
    before = {o.name: (o.hide_get(), o.hide_render, o.hide_viewport) for o in bpy.data.objects}
    transforms = {o.name: (tuple(o.location), tuple(o.rotation_euler), tuple(o.scale)) for o in targets}

    for o in bpy.data.objects:
        o.hide_set(True)
        o.hide_render = True
    for o in targets:
        o.hide_set(False)
        o.hide_render = False
        o.location = (0.0, 0.0, 0.0)

    settings = bpy.context.scene.batch_export
    settings.use_project_dir = False
    settings.directory = out_dir + os.sep
    settings.filename = '$OBJ'
    settings.file_format = 'FBX'
    settings.mode = 'PARENT_OBJECTS'
    settings.limit = 'VISIBLE'
    settings.fbx_preset = 'Unreal_Only_FBX'
    settings.apply_mods = True
    settings.object_types = {'MESH'}
    settings.set_location = False
    settings.set_rotation = False
    settings.set_scale = False
    settings.create_lod = False

    result = {'directory': out_dir, 'targets': [o.name for o in targets]}
    try:
        bpy.ops.export_mesh.batch('EXEC_DEFAULT')
        result['operator'] = 'ok'
    except Exception as exc:
        result['operator'] = 'ERROR: %s' % exc
    finally:
        for name, (loc, rot, scale) in transforms.items():
            o = bpy.data.objects.get(name)
            if o is None:
                continue
            o.location = loc
            o.rotation_euler = rot
            o.scale = scale
        for name, (h, hr, hv) in before.items():
            o = bpy.data.objects.get(name)
            if o is None:
                continue
            o.hide_set(h)
            o.hide_render = hr
            o.hide_viewport = hv

    result['files'] = [{'name': f, 'size': os.path.getsize(os.path.join(out_dir, f))}
                       for f in sorted(os.listdir(out_dir)) if f.lower().endswith('.fbx')]
    result['settings'] = {
        'filename': settings.filename, 'mode': settings.mode, 'limit': settings.limit,
        'preset': settings.fbx_preset, 'apply_mods': settings.apply_mods,
        'object_types': sorted(settings.object_types),
        'set_location': settings.set_location, 'set_rotation': settings.set_rotation,
        'set_scale': settings.set_scale, 'create_lod': settings.create_lod,
    }
    result['restored_transforms'] = {n: [list(t[0])] for n, t in transforms.items()}
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=1)
    return result
