"""Create the stage-3 isolated reference rig in the verified Unreal editor.

Run inside Unreal's Python console. Refuses dirty sessions and existing targets.
Existing production packages are never saved. Receipts stay in ignored .mrmak.
"""
import json
from pathlib import Path
import unreal

ROOT = Path('D:/AI/MarkWorkspace')
RUN = ROOT / '.mrmak/total-insanitation/stage-3'
MAP = '/Game/Levels/Art_Material_Reference'
NEUTRAL = '/Game/Art/Tools/MaterialReference/M_Reference_Neutral'
assert unreal.Paths.get_project_file_path().replace('\\', '/').lower() == 'd:/github/boomeracist/boomeracist.uproject'
assert not unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages(), 'Preserve unsaved maps'
assert not unreal.EditorLoadingAndSavingUtils.get_dirty_content_packages(), 'Preserve unsaved assets'
assert not unreal.EditorAssetLibrary.does_asset_exist(MAP), 'Review map already exists; inspect it instead'
assert not unreal.EditorAssetLibrary.does_asset_exist(NEUTRAL), 'Review material already exists'

registry = unreal.AssetRegistryHelpers.get_asset_registry()
paths = sorted(str(a.package_name) for a in registry.get_assets_by_path('/Game/Art/MI/Utility_Materials', recursive=True)
               if str(a.asset_class_path.asset_name) == 'MaterialInstanceConstant')
materials = []
for p in paths:
    m = unreal.load_asset(p)
    params = {}
    for key in ['scalar_parameter_values', 'vector_parameter_values', 'texture_parameter_values']:
        params[key] = [str(v) for v in m.get_editor_property(key)]
    deps = [str(v) for v in registry.get_dependencies(p, unreal.AssetRegistryDependencyOptions(include_soft_package_references=True, include_hard_package_references=True))]
    textures = []
    for t in unreal.MaterialEditingLibrary.get_material_used_textures(m):
        try:
            sources = list(t.get_editor_property('asset_import_data').extract_filenames())
        except Exception:
            sources = []
        textures.append({'path': t.get_path_name(), 'sources': sources})
    materials.append({'path': p, 'parent': m.get_editor_property('parent').get_path_name(), 'parameters': params,
                      'textures': textures, 'dependencies': deps})
(RUN / 'materials.json').write_text(json.dumps(materials, indent=2), encoding='utf-8')

levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert levels.new_level(MAP)
factory = unreal.MaterialFactoryNew()
neutral = unreal.AssetToolsHelpers.get_asset_tools().create_asset('M_Reference_Neutral', '/Game/Art/Tools/MaterialReference', unreal.Material, factory)
color = unreal.MaterialEditingLibrary.create_material_expression(neutral, unreal.MaterialExpressionConstant3Vector)
color.set_editor_property('constant', unreal.LinearColor(0.18, 0.18, 0.18, 1))
unreal.MaterialEditingLibrary.connect_material_property(color, '', unreal.MaterialProperty.MP_BASE_COLOR)
rough = unreal.MaterialEditingLibrary.create_material_expression(neutral, unreal.MaterialExpressionConstant)
rough.set_editor_property('r', 0.65)
unreal.MaterialEditingLibrary.connect_material_property(rough, '', unreal.MaterialProperty.MP_ROUGHNESS)
unreal.MaterialEditingLibrary.recompile_material(neutral)
assert unreal.EditorAssetLibrary.save_loaded_asset(neutral)

def mesh(label, path, loc, scale, material, rot=(0, 0, 0)):
    rotation = unreal.Rotator(pitch=rot[0], yaw=rot[1], roll=rot[2])
    a = actors.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(*loc), rotation)
    a.set_actor_label(label)
    a.set_folder_path('ReferenceStations')
    c = a.static_mesh_component
    c.set_static_mesh(unreal.load_asset(path))
    c.set_material(0, material)
    c.set_mobility(unreal.ComponentMobility.MOVABLE)
    a.set_actor_scale3d(unreal.Vector(*scale))
    a.set_actor_rotation(rotation, False)
    return a

for i, row in enumerate(materials):
    x, y = (i % 8) * 1200, (i // 8) * 1200
    row['station'] = i + 1
    row['origin_cm'] = [x, y, 0]
    row['camera'] = {'location': {'x': x, 'y': y - 700, 'z': 240},
                     'rotation': {'pitch': -12, 'yaw': 90, 'roll': 0},
                     'scale': {'x': 1, 'y': 1, 'z': 1}}
    mat = unreal.load_asset(row['path'])
    label = 'REF_%03d_' % (i + 1) + row['path'].rsplit('/', 1)[-1]
    mesh(label + '_Flat1m', '/Engine/BasicShapes/Plane', (x-240, y+30, 70), (1,1,1), mat, (0,0,-90))
    mesh(label + '_Sphere1m', '/Engine/BasicShapes/Sphere', (x-100, y, 50), (1,1,1), mat)
    mesh(label + '_Cube1m', '/Engine/BasicShapes/Cube', (x+40, y, 50), (1,1,1), mat)
    mesh(label + '_Flat2m', '/Engine/BasicShapes/Plane', (x+230, y+30, 100), (2,2,2), mat, (0,0,-90))
    mesh(label + '_Ground', '/Engine/BasicShapes/Cube', (x, y, -6), (10,9,0.1), neutral)
    mesh(label + '_Backdrop', '/Engine/BasicShapes/Cube', (x,y+220,300), (10,0.1,6), neutral)
    if '/Glass/' in row['path'] or '/LOD/' in row['path'] or row['path'].endswith(('MI_Simple_Glass_01', 'MI_Simple_Liquid_01')):
        for k in range(16):
            contrast = unreal.load_asset('/Engine/BasicShapes/BasicShapeMaterial' if k % 2 else '/Game/Art/MI/Utility_Materials/Simple/MI_Full_Black')
            mesh('REF_%03d_Contrast_%02d' % (i+1,k), '/Engine/BasicShapes/Cube', (x-300+k*40,y+190,115), (0.4,0.1,2.3), contrast)

sun = actors.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0,0,800), unreal.Rotator(pitch=-40,yaw=65,roll=0))
sun.set_actor_label('Reference_Key_White_3lux')
sun.light_component.set_intensity(3.0)
sun.light_component.set_light_color(unreal.LinearColor(1,1,1,1))
sun.light_component.set_mobility(unreal.ComponentMobility.MOVABLE)
sun.light_component.set_editor_property('light_source_angle', 3.5)
sky = actors.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0,0,600))
sky.set_actor_label('Reference_Fill_DaylightCubemap')
sc = sky.light_component
sc.set_mobility(unreal.ComponentMobility.MOVABLE)
sc.set_editor_property('source_type', unreal.SkyLightSourceType.SLS_SPECIFIED_CUBEMAP)
sc.set_editor_property('cubemap', unreal.load_asset('/Engine/MapTemplates/Sky/DaylightAmbientCubemap'))
sc.set_intensity(1.0)
sc.recapture_sky()
pp = actors.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0,0,0))
pp.set_actor_label('Reference_FixedExposure_EV0')
pp.set_editor_property('unbound', True)
s = pp.get_editor_property('settings')
for name,value in {'override_auto_exposure_min_brightness':True, 'override_auto_exposure_max_brightness':True,
                   'auto_exposure_min_brightness':0.0, 'auto_exposure_max_brightness':0.0,
                   'override_auto_exposure_bias':True, 'auto_exposure_bias':0.0,
                   'override_vignette_intensity':True, 'vignette_intensity':0.0,
                   'override_bloom_intensity':True, 'bloom_intensity':0.0}.items():
    s.set_editor_property(name,value)
pp.set_editor_property('settings',s)
levels.set_level_viewport_fov(55.0, levels.get_active_viewport_config_key())
unreal.EditorLevelLibrary.editor_set_game_view(True)
assert levels.save_current_level()
(RUN / 'materials.json').write_text(json.dumps(materials, indent=2), encoding='utf-8')
(RUN / 'showcase.json').write_text(json.dumps({'map':MAP,'neutral':NEUTRAL,'materials':len(materials),
    'scale':'1 m plane, 1 m diameter sphere, 1 m cube, 2 m plane; engine UV 0–1 per shape',
    'lighting':'White directional 3 lux; daylight ambient cubemap intensity 1; fixed EV100 0; bloom/vignette 0',
    'fov':55,'existing_materials_modified':False},indent=2), encoding='utf-8')
unreal.log('REFERENCE_SHOWCASE_OK ' + str(len(materials)))
