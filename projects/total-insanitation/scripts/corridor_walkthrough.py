"""Transient PIE walking/captures; never saves an Unreal package.

Run through the editor Python console. Request/receipts live outside Git in
.mrmak/total-insanitation/corridor-concepts/. Normal CharacterMovement handles
walking, gravity and collision; no teleportation after the PIE spawn override.
"""
import json
import math
import time
from pathlib import Path

import unreal

OUT = Path('D:/AI/MarkWorkspace/.mrmak/total-insanitation/corridor-concepts')
OUT.mkdir(parents=True, exist_ok=True)
REQUEST = json.loads((OUT / 'request.json').read_text(encoding='utf-8'))
assert Path(unreal.Paths.get_project_file_path()).stem == 'BoomeRacist'
WORLD = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_game_world()
assert WORLD and 'UEDPIE_' in WORLD.get_path_name() and 'Basement' in WORLD.get_path_name()
PC = unreal.GameplayStatics.get_player_controller(WORLD, 0)
PAWN = PC.get_controlled_pawn()
assert PAWN


def vector(v):
    return [round(float(v.x), 3), round(float(v.y), 3), round(float(v.z), 3)]


def state():
    cam = unreal.GameplayStatics.get_player_camera_manager(WORLD, 0)
    rot = cam.get_camera_rotation()
    stream = unreal.GameplayStatics.get_streaming_level(WORLD, '/Game/Levels/Streaming_Levels/Main_Lights')
    return {'type': 'native PIE gameplay', 'project': unreal.Paths.get_project_file_path(),
            'world': WORLD.get_path_name(), 'pawn': PAWN.get_path_name(),
            'pawn_location_cm': vector(PAWN.get_actor_location()),
            'camera_location_cm': vector(cam.get_camera_location()),
            'rotation_degrees': {'pitch': rot.pitch, 'yaw': rot.yaw, 'roll': rot.roll},
            'fov_degrees': cam.get_fov_angle(),
            'main_lights_loaded': bool(stream and stream.get_loaded_level()),
            'movement_mode': str(PAWN.get_component_by_class(unreal.CharacterMovementComponent).movement_mode),
            'performance_benchmark': False}


def save_status(extra=None):
    data = state()
    data.update(extra or {})
    (OUT / 'status.json').write_text(json.dumps(data, indent=2), encoding='utf-8')


action = REQUEST['action']
if action == 'look':
    PC.set_control_rotation(unreal.Rotator(pitch=REQUEST.get('pitch', -2), yaw=REQUEST['yaw'], roll=0))
    save_status({'action': action})
elif action == 'capture':
    name = REQUEST['name']
    assert name.replace('-', '').replace('_', '').isalnum()
    data = state()
    data['output'] = name + '.png'
    data['note'] = REQUEST.get('note', '')
    (OUT / (name + '.metadata.json')).write_text(json.dumps(data, indent=2), encoding='utf-8')
    unreal.SystemLibrary.execute_console_command(WORLD, 'HighResShot 1 filename="' + str(OUT / (name + '.png')).replace('\\', '/') + '"')
    save_status({'action': action, 'capture': name})
elif action == 'walk':
    assert not getattr(unreal, '_corridor_walk_handle', None), 'Prior walk still running'
    target = REQUEST['target_xy_cm']
    start = state()
    began = time.monotonic()
    samples = []
    last_sample = [-1.0]
    name = REQUEST['name']

    def tick(dt, request=dict(REQUEST), target=target, start=start,
             began=began, samples=samples, last_sample=last_sample, name=name):
        elapsed = time.monotonic() - began
        p = PAWN.get_actor_location()
        dx, dy = target[0] - p.x, target[1] - p.y
        distance = math.hypot(dx, dy)
        if elapsed - last_sample[0] >= .2:
            samples.append({'elapsed_s': round(elapsed, 3), 'position_cm': vector(p)})
            last_sample[0] = elapsed
        tolerance = request.get('arrival_tolerance_cm', 180)
        if distance < tolerance or elapsed > request.get('timeout_seconds', 15):
            unreal.unregister_slate_post_tick_callback(unreal._corridor_walk_handle)
            unreal._corridor_walk_handle = None
            movement = PAWN.get_component_by_class(unreal.CharacterMovementComponent)
            movement.stop_movement_immediately()
            result = {'action': 'walk', 'method': 'Pawn.add_movement_input via real CharacterMovement; no teleport',
                      'start': start, 'end': state(), 'target_xy_cm': target,
                      'reached': distance < tolerance, 'arrival_tolerance_cm': tolerance,
                      'elapsed_s': elapsed, 'samples': samples}
            (OUT / (name + '.walk.json')).write_text(json.dumps(result, indent=2), encoding='utf-8')
            save_status({'walk': name, 'reached': distance < tolerance})
        else:
            if request.get('face_walk', True):
                PC.set_control_rotation(unreal.Rotator(pitch=request.get('pitch', -2), yaw=math.degrees(math.atan2(dy, dx)), roll=0))
            PAWN.add_movement_input(unreal.Vector(dx / distance, dy / distance, 0), 1.0, True)

    unreal._corridor_walk_handle = unreal.register_slate_post_tick_callback(tick)
    save_status({'action': action, 'walk': name, 'started': True})
else:
    assert action == 'status'
    save_status({'action': action})
unreal.log('CORRIDOR_WALKTHROUGH_' + action.upper())
