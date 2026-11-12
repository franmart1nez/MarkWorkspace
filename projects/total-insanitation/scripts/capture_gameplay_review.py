"""Capture actual PIE, using an ignored local JSON request, with camera provenance."""
import json
from pathlib import Path
import unreal

OUT=Path('D:/AI/MarkWorkspace/.mrmak/total-insanitation/basement-review')
request=json.loads((OUT/'gameplay-capture-request.json').read_text(encoding='utf-8'))
name=request['name']
assert name.replace('-','').replace('_','').isalnum()
world=unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_game_world()
assert world and 'Basement' in world.get_path_name()
camera=unreal.GameplayStatics.get_player_camera_manager(world,0)
stream=unreal.GameplayStatics.get_streaming_level(world,'/Game/Levels/Streaming_Levels/Main_Lights')
data={'type':'native PIE gameplay','world':world.get_path_name(),
      'camera_location_cm':str(camera.get_camera_location()),'camera_rotation':str(camera.get_camera_rotation()),
      'fov':camera.get_fov_angle(),'main_lights_loaded':bool(stream and stream.get_loaded_level()),
      'performance_benchmark':False,'output':name+'.png'}
(OUT/(name+'.metadata.json')).write_text(json.dumps(data,indent=2),encoding='utf-8')
unreal.SystemLibrary.execute_console_command(world,'HighResShot 1 filename="'+str(OUT/(name+'.png')).replace('\\','/')+'"')
unreal.log('GAMEPLAY_REVIEW_CAPTURE_REQUESTED '+name)
