"""Audit and export copied modules with factory-startup Blender; never save source."""
import hashlib
import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

OUT = Path('D:/AI/MarkWorkspace/.mrmak/total-insanitation/basement-review/module-trial')
OUT.mkdir(parents=True, exist_ok=True)
source = Path(bpy.data.filepath)
assert source.as_posix().endswith('/Assets/Building/Interior_Building.blend')
names = ['Wall_01', 'Wall_Corner_01', 'Floor_01', 'Wall_VertexColor_01']
report = {'source': str(source), 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
          'blender': bpy.app.version_string, 'units': bpy.context.scene.unit_settings.scale_length,
          'objects': [], 'source_saved': False}
for name in names:
    obj = bpy.data.objects[name]
    mesh = obj.data
    mesh.calc_loop_triangles()
    uv_layers = []
    for uv in mesh.uv_layers:
        samples = []
        for tri in mesh.loop_triangles:
            a, b, c = [Vector(uv.data[i].uv) for i in tri.loops]
            uv_area = abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/2
            p, q, r = [obj.matrix_world @ mesh.vertices[i].co for i in tri.vertices]
            area = (q-p).cross(r-p).length/2
            if area > 0.01 and uv_area > 0:
                samples.append(math.sqrt(uv_area/area))
        uv_layers.append({'name': uv.name, 'uv_units_per_meter_min': min(samples, default=0),
                          'uv_units_per_meter_max': max(samples, default=0)})
    report['objects'].append({
        'name': name, 'dimensions_m': list(obj.dimensions), 'location': list(obj.location),
        'rotation': list(obj.rotation_euler), 'scale': list(obj.scale),
        'bounds_local_m': [list(v) for v in obj.bound_box], 'triangles': len(mesh.loop_triangles),
        'uv_layers': uv_layers, 'color_attributes': [a.name for a in mesh.color_attributes],
        'materials': [m.name if m else None for m in mesh.materials],
        'modifiers': [{'name': m.name, 'type': m.type, 'render': m.show_render,
                       'viewport': m.show_viewport} for m in obj.modifiers],
    })

# Each clone keeps its authored local pivot, rotation and scale. Reset only the
# source-sheet translation so each FBX is an individual reusable game module.
trial_scene = bpy.data.scenes.new('Basement_Module_Trial')
trial_scene.unit_settings.system = 'METRIC'
trial_scene.unit_settings.scale_length = 1
bpy.context.window.scene = trial_scene
clones = []
for name in names:
    original = bpy.data.objects[name]
    clone = original.copy()
    clone.data = original.data.copy()
    clone.name = 'Trial_' + name
    clone.parent = None
    clone.matrix_world = original.matrix_world.copy()
    clone.location = (0, 0, 0)
    trial_scene.collection.objects.link(clone)
    clone.hide_set(False)
    clone.hide_viewport = False
    clone.hide_render = False
    clones.append(clone)
    for item in trial_scene.objects:
        item.select_set(False)
    clone.select_set(True)
    bpy.context.view_layer.objects.active = clone
    bpy.ops.export_scene.fbx(
        filepath=str(OUT / (clone.name + '.fbx')), use_selection=True,
        object_types={'MESH'}, global_scale=1, apply_unit_scale=True,
        apply_scale_options='FBX_SCALE_NONE', axis_forward='-Y', axis_up='Z',
        use_space_transform=True, bake_space_transform=False,
        use_mesh_modifiers=True, mesh_smooth_type='OFF', use_tspace=False,
        path_mode='AUTO', embed_textures=False, bake_anim=False,
    )
report['export_options'] = {'axis_forward': '-Y', 'axis_up': 'Z', 'global_scale': 1,
                            'apply_unit_scale': True, 'apply_scale_options': 'FBX_SCALE_NONE',
                            'bake_space_transform': False, 'materials_and_textures_import': False}
report['fbx'] = [str(OUT / (o.name + '.fbx')) for o in clones]
# A source copy provides editable evidence of exactly what was exported.
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'Basement_Module_Trial.blend'), copy=True)
assert hashlib.sha256(source.read_bytes()).hexdigest() == report['source_sha256']
(OUT / 'blender-trial.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print('MODULE_TRIAL_EXPORT_OK', str(OUT))
