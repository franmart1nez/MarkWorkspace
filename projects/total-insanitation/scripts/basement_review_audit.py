"""Read-only art/level audit. Run inside the owner's Unreal Editor."""
import json
from collections import Counter
from pathlib import Path

import unreal

OUT = Path('D:/AI/MarkWorkspace/.mrmak/total-insanitation/basement-review')
OUT.mkdir(parents=True, exist_ok=True)
ALLOWED = {
    '/Game/Levels/Inteior_Lobby', '/Game/Levels/LaCarlota',
    '/Game/Levels/Streaming_Levels/Basement',
    '/Game/Levels/Streaming_Levels/Main_Lights',
}
assert Path(unreal.Paths.get_project_file_path()).stem == 'BoomeRacist'
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
level = les.get_current_level()
assert level.get_outermost().get_name() in ALLOWED
world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()


def vec(value):
    return [round(float(value.x), 5), round(float(value.y), 5), round(float(value.z), 5)]


def prop(obj, name):
    try:
        value = obj.get_editor_property(name)
        if isinstance(value, unreal.Object):
            return value.get_path_name()
        return str(value)
    except Exception as error:
        return {'unavailable': str(error)}


assets = unreal.AssetRegistryHelpers.get_asset_registry().get_assets_by_path('/Game/Art', recursive=True)
inventory = [{'path': str(a.package_name), 'class': str(a.asset_class_path.asset_name)} for a in assets]
streaming = []
for streaming_path in sorted(ALLOWED):
    streaming_level = unreal.GameplayStatics.get_streaming_level(world, streaming_path)
    if not streaming_level:
        continue
    streaming.append({
        'path': streaming_path,
        'class': streaming_level.get_class().get_name(),
        'loaded': bool(streaming_level.get_loaded_level()),
        'visible': prop(streaming_level, 'should_be_visible'),
    })
actors = []
meshes = {}
material_paths = set()
for actor in unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors():
    actor_level = actor.get_level().get_outermost().get_name()
    if actor_level not in ALLOWED:
        continue
    record = {
        'name': actor.get_name(), 'label': actor.get_actor_label(),
        'class': actor.get_class().get_path_name(), 'level': actor_level,
        'location_cm': vec(actor.get_actor_location()),
        'rotation': str(actor.get_actor_rotation()), 'scale': vec(actor.get_actor_scale3d()),
        'components': [],
    }
    for component in actor.get_components_by_class(unreal.StaticMeshComponent):
        mesh = component.static_mesh
        if not mesh:
            continue
        mats = [m.get_path_name() if m else None for m in component.get_materials()]
        material_paths.update(m for m in mats if m and m.startswith('/Game/Art/'))
        record['components'].append({
            'name': component.get_name(), 'mesh': mesh.get_path_name(), 'materials': mats,
            'relative_location': vec(component.relative_location),
            'relative_rotation': str(component.relative_rotation),
            'relative_scale': vec(component.relative_scale3d),
            'collision_profile': str(component.get_collision_profile_name()),
            'collision_enabled': str(component.get_collision_enabled()),
            'world_transform': str(component.get_world_transform()),
        })
        mesh_path = mesh.get_path_name()
        if mesh_path not in meshes:
            bounds = mesh.get_bounding_box()
            smes = unreal.get_editor_subsystem(unreal.StaticMeshEditorSubsystem)
            build = smes.get_lod_build_settings(mesh, 0)
            import_data = mesh.get_editor_property('asset_import_data')
            meshes[mesh_path] = {
                'bounds_min_cm': vec(bounds.min), 'bounds_max_cm': vec(bounds.max),
                'lods': smes.get_lod_count(mesh),
                'uv_channels': smes.get_num_uv_channels(mesh, 0),
                'collision_count': smes.get_simple_collision_count(mesh),
                'collision_trace': prop(mesh.get_editor_property('body_setup'), 'collision_trace_flag'),
                'slots': [str(m.material_slot_name) for m in mesh.static_materials],
                'default_materials': [m.material_interface.get_path_name() if m.material_interface else None for m in mesh.static_materials],
                'lightmap_coordinate': prop(mesh, 'light_map_coordinate_index'),
                'lightmap_resolution': prop(mesh, 'light_map_resolution'),
                'generate_lightmap_uvs': build.generate_lightmap_u_vs,
                'source_lightmap_uv': build.src_lightmap_index, 'destination_lightmap_uv': build.dst_lightmap_index,
                'build_scale': vec(build.build_scale3d),
                'import_files': list(import_data.extract_filenames()) if import_data else [],
                'import_options': {k: prop(import_data, k) for k in ['import_translation', 'import_rotation', 'import_uniform_scale', 'convert_scene', 'convert_scene_unit', 'force_front_x_axis', 'transform_vertex_to_absolute', 'bake_pivot_in_vertex']} if import_data else {},
            }
    actors.append(record)
materials = {}
for path in sorted(material_paths):
    mat = unreal.load_asset(path)
    materials[path] = {'class': mat.get_class().get_name()}
    if isinstance(mat, unreal.MaterialInstanceConstant):
        materials[path].update(
            parent=prop(mat, 'parent'),
            scalar_parameters=prop(mat, 'scalar_parameter_values'),
            texture_parameters=prop(mat, 'texture_parameter_values'),
            vector_parameters=prop(mat, 'vector_parameter_values'),
        )
result = {
    'project': unreal.Paths.get_project_file_path(), 'engine': unreal.SystemLibrary.get_engine_version(),
    'current_level': level.get_outermost().get_name(), 'world': world.get_path_name(),
    'streaming': streaming, 'actor_counts': dict(Counter(a['level'] for a in actors)),
    'assets': inventory, 'actors': actors, 'meshes': meshes, 'materials': materials,
    'dirty_content': [p.get_name() for p in unreal.EditorLoadingAndSavingUtils.get_dirty_content_packages()],
    'dirty_maps': [p.get_name() for p in unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages()],
    'modified_by_audit': False,
}
target = OUT / (level.get_outermost().get_name().rsplit('/', 1)[-1] + '-audit.json')
target.write_text(json.dumps(result, indent=2), encoding='utf-8')
unreal.log('BASEMENT_REVIEW_AUDIT_OK: ' + str(target))
