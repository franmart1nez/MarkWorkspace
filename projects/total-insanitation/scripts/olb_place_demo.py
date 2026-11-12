"""Place the Office Level Builder demo layout in LaCarlota's art-review area and build it.

Run inside the Unreal Editor with LaCarlota open. Refuses to duplicate the demo.
"""
import runpy
import unreal

assert unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).get_current_level().get_outermost().get_name() == '/Game/Levels/LaCarlota'
TOOL = '/Game/Art/Tools/OfficeLevelBuilder/'
KIT = '/Game/Art/Assets/Building/Modular_Blocks/'
FOLDER = 'Art Review/Office Level Builder 2026-11-12'
GROUP = 'OfficeDemo'
O = unreal.Vector(14000, 2000, 0)
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
assert not [a for a in unreal.GameplayStatics.get_all_actors_of_class(world, unreal.Actor)
            if a.get_actor_label().startswith('ART_REVIEW_OLB_')], 'demo already placed'


def cls(path):
    return unreal.load_class(None, path + '.' + path.split('/')[-1] + '_C')


def place(name, label, cell, size=(1, 1), level=0, yaw=0.0, **values):
    loc = O + unreal.Vector(cell[0] * 400, cell[1] * 400, level * 400)
    a = eas.spawn_actor_from_class(cls(TOOL + name), loc, unreal.Rotator(pitch=0, yaw=yaw, roll=0))
    a.set_actor_scale3d(unreal.Vector(size[0], size[1], 1))
    a.set_actor_label('ART_REVIEW_OLB_' + label)
    a.set_folder_path(FOLDER)
    a.set_editor_property('Group', GROUP)
    for k, v in values.items():
        a.set_editor_property(k, v)
    return a


with unreal.ScopedEditorTransaction('Office Level Builder demo'):
    place('BP_OLB_Builder', 'Builder', (0, 0))
    place('BP_OLB_Room', 'Room_A_Office', (0, 0), (4, 3))
    place('BP_OLB_Room', 'Room_A_Rug', (1, 1), (2, 1), Priority=1,
          FloorClasses=[cls(KIT + 'BP_Floor/BP_Floor_Rug_01')])
    place('BP_OLB_Room', 'Corridor_B', (4, 1), (4, 1), FloorClasses=[cls(KIT + 'BP_Floor/BP_Floor_Mosaic_01')])
    place('BP_OLB_Room', 'Room_C_Lab', (8, 0), (3, 3),
          WallClasses=[cls(KIT + 'BP_Modular_Walls/BP_Wall_LabConcrete_01')],
          FloorClasses=[cls(KIT + 'BP_Floor/BP_Floor_Mosaic_01')])
    place('BP_OLB_Room', 'Corridor_D', (1, 3), (1, 3))
    # stair on the upper floor (cells 1,7 -> 1,6), arrow/downhill toward corridor D
    place('BP_OLB_Stair', 'Stair_D', (2, 8), level=1, yaw=180.0)
    place('BP_OLB_Room', 'Room_E_Upper', (0, 8), (3, 2), level=1)

runpy.run_path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_content_dir())
               + 'Art/Tools/OfficeLevelBuilder/Python/olb_build.py',
               init_globals={'OLB_ACTION': 'build', 'OLB_GROUPS': [GROUP]})
unreal.log('OLB_DEMO_OK')
