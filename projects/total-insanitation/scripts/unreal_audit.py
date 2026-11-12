"""Read-only baseline, run using Unreal Editor's Execute Python Script.

No level/asset changes or saves. The current map must be inside the owner's scope.
"""
import json
from pathlib import Path
import unreal

ALLOWED = {
    '/Game/Levels/Inteior_Lobby', '/Game/Levels/LaCarlota',
    '/Game/Levels/Streaming_Levels/Basement',
    '/Game/Levels/Streaming_Levels/Main_Lights',
}
level_system = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
level = level_system.get_current_level()
package = level.get_outermost().get_name()
if package not in ALLOWED:
    raise RuntimeError('Current map is outside the art scope: ' + package)
actors = []
for actor in unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors():
    actor_level = actor.get_level().get_outermost().get_name()
    if actor_level not in ALLOWED:
        continue
    record = {'label': actor.get_actor_label(), 'class': actor.get_class().get_name(),
              'level': actor_level, 'location': str(actor.get_actor_location())}
    if isinstance(actor, unreal.StaticMeshActor):
        component = actor.static_mesh_component
        mesh = component.static_mesh
        record['mesh'] = mesh.get_path_name() if mesh else None
        record['materials'] = [m.get_path_name() if m else None for m in component.get_materials()]
    actors.append(record)
data = {'engine': unreal.SystemLibrary.get_engine_version(),
        'project': unreal.Paths.get_project_file_path(), 'current_level': package,
        'actors': actors, 'source_modified': False}
target = Path('D:/AI/MarkWorkspace/.mrmak/total-insanitation/unreal-live-audit.json')
target.write_text(json.dumps(data, indent=2), encoding='utf-8')
unreal.log('TOTAL_INSANITATION_AUDIT_OK: ' + str(len(actors)) + ' actors; ' + package)
