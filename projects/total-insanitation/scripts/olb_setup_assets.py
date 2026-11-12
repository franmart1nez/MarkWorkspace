"""Create/refresh the Office Level Builder Blueprints in BoomeRacist.

Run inside the Unreal Editor (Cmd box: py "<this file>"). Idempotent: existing
Blueprints are reused; missing variables/components/events are added. Never
touches assets outside /Game/Art/Tools/OfficeLevelBuilder.
Receipt: D:/AI/MarkWorkspace/.mrmak/total-insanitation/office-level-builder/setup.json
"""
import json
from pathlib import Path
import unreal
from editor_toolset.toolsets.blueprint import BlueprintTools
from editor_toolset.toolsets.actor import ActorTools

ROOT = '/Game/Art/Tools/OfficeLevelBuilder'
KIT = '/Game/Art/Assets/Building/Modular_Blocks'
OUT = Path('D:/AI/MarkWorkspace/.mrmak/total-insanitation/office-level-builder')
OUT.mkdir(parents=True, exist_ok=True)
BEL = unreal.BlueprintEditorLibrary
assert Path(unreal.Paths.get_project_file_path()).stem == 'BoomeRacist'
log = {'created': [], 'variables': [], 'components': [], 'events': [], 'notes': []}

RUN_CMD = ("py import runpy,unreal; runpy.run_path(unreal.Paths.convert_relative_path_to_full("
           "unreal.Paths.project_content_dir())+'Art/Tools/OfficeLevelBuilder/Python/olb_build.py', "
           "init_globals={{'OLB_ACTION':'{0}'}})")


def kit_class(rel):
    name = rel.split('/')[-1]
    cls = unreal.load_class(None, f'{KIT}/{rel}.{name}_C')
    assert cls, rel
    return cls


def get_bp(name):
    path = f'{ROOT}/{name}'
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        return unreal.load_asset(path)
    bp = BlueprintTools.create(ROOT, name, unreal.Actor.static_class())
    log['created'].append(path)
    return bp


T_CLASS = BEL.get_class_reference_type(unreal.Actor.static_class())
T_CLASSES = BEL.get_array_type(T_CLASS)
T_INT = BEL.get_basic_type_by_name('int')
T_STR = BEL.get_basic_type_by_name('string')


def var(bp, name, ptype, category, tooltip=None):
    if name not in [str(n) for n in BEL.list_member_variable_names(bp)]:
        BEL.add_member_variable(bp, name, ptype)
        log['variables'].append(f'{bp.get_name()}.{name}')
    BEL.set_blueprint_variable_instance_editable(bp, name, True)
    BEL.set_blueprint_variable_category(bp, name, category)


def comp(bp, cls, name):
    sds = unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem)
    for h in sds.k2_gather_subobject_data_for_blueprint(bp):
        obj = unreal.SubobjectDataBlueprintFunctionLibrary.get_object(unreal.SubobjectDataBlueprintFunctionLibrary.get_data(h))
        if obj and obj.get_name().startswith(name) and isinstance(obj, cls):
            return obj
    c = ActorTools.add_component(bp, cls.static_class(), name)
    log['components'].append(f'{bp.get_name()}.{name}')
    return c


def piece_vars(bp, room):
    cat = 'Office Builder|Pieces' + (' (empty = use Builder)' if room else '')
    var(bp, 'WallClasses', T_CLASSES, cat)
    var(bp, 'CornerClass', T_CLASS, cat)
    var(bp, 'FloorClasses', T_CLASSES, cat)
    var(bp, 'CeilingClasses', T_CLASSES, cat)
    var(bp, 'CeilingLightClass', T_CLASS, cat)
    var(bp, 'LightSpacingX', T_INT, cat)  # every N cells along X (0 = none, room: -1 = Builder's)
    var(bp, 'LightSpacingY', T_INT, cat)  # every N cells along Y


def button_events(bp, actions):
    graph = BEL.find_event_graph(bp)
    for event, action in actions:
        existing = BlueprintTools.read_graph_dsl(graph) or ''
        BlueprintTools.add_event(bp, event)
        if f"'OLB_ACTION':'{action}'" not in existing:
            BlueprintTools.write_graph_dsl(graph, f'(event Custom|{event}\n  (Development|ExecuteConsoleCommand :Command "{RUN_CMD.format(action)}"))')
            log['events'].append(f'{bp.get_name()}.{event}')
        # 'Call In Editor' is not exposed to Python/ObjectTools in UE 5.8; it is
        # ticked once per event in the Blueprint editor UI (documented in the README).
    log['notes'].append({bp.get_name(): BlueprintTools.read_graph_dsl(graph)})


# ---------------------------------------------------------------- builder
builder = get_bp('BP_OLB_Builder')
comp(builder, unreal.BillboardComponent, 'Sprite')
var(builder, 'Group', T_STR, 'Office Builder')
var(builder, 'RandomSeed', T_INT, 'Office Builder')
piece_vars(builder, False)

# ---------------------------------------------------------------- room
room = get_bp('BP_OLB_Room')
box = comp(room, unreal.BoxComponent, 'Footprint')
box.set_editor_property('relative_location', unreal.Vector(200, 200, 200))
box.set_editor_property('box_extent', unreal.Vector(200, 200, 200))
box.set_editor_property('shape_color', unreal.Color(r=40, g=220, b=90, a=255))
box.set_editor_property('line_thickness', 3.0)
box.set_editor_property('hidden_in_game', True)
box.set_collision_profile_name('NoCollision')
var(room, 'Group', T_STR, 'Office Builder')
var(room, 'Priority', T_INT, 'Office Builder')
piece_vars(room, True)

# ---------------------------------------------------------------- stair
stair = get_bp('BP_OLB_Stair')
sbox = comp(stair, unreal.BoxComponent, 'Footprint')
sbox.set_editor_property('relative_location', unreal.Vector(200, 400, 0))
sbox.set_editor_property('box_extent', unreal.Vector(200, 400, 400))
sbox.set_editor_property('shape_color', unreal.Color(r=240, g=170, b=30, a=255))
sbox.set_editor_property('line_thickness', 3.0)
sbox.set_editor_property('hidden_in_game', True)
sbox.set_collision_profile_name('NoCollision')
arrow = comp(stair, unreal.ArrowComponent, 'Downhill')
arrow.set_editor_property('relative_location', unreal.Vector(200, 60, 30))
arrow.set_editor_property('relative_rotation', unreal.Rotator(pitch=-26.6, yaw=90, roll=0))
arrow.set_editor_property('arrow_size', 6.0)
arrow.set_editor_property('arrow_color', unreal.Color(r=255, g=150, b=0, a=255))
arrow.set_editor_property('hidden_in_game', True)
var(stair, 'Group', T_STR, 'Office Builder')
var(stair, 'StairClass', T_CLASS, 'Office Builder')

for bp, actions in [(builder, [('Build', 'build'), ('Clear', 'clear')]),
                    (room, [('Build', 'build')]), (stair, [('Build', 'build')])]:
    button_events(bp, actions)
    BEL.compile_blueprint(bp)

# ---------------------------------------------------------------- defaults
wood = [kit_class('BP_Modular_Walls/BP_Wall_Wood_01'), kit_class('BP_Modular_Walls/BP_Wall_Wood_02')]
defaults = {
    builder: {'Group': 'Office', 'RandomSeed': 1970, 'WallClasses': wood,
              'CornerClass': kit_class('BP_Modular_Walls/BP_Wall_Wood_Corner_01'),
              'FloorClasses': [kit_class('BP_Floor/BP_Floor_Wood_01')],
              'CeilingClasses': [kit_class('BP_Roof/BP_Roof_01')],
              'CeilingLightClass': kit_class('BP_Roof/BP_Roof_Lights_01'), 'LightSpacingX': 2, 'LightSpacingY': 2},
    room: {'Group': 'Office', 'Priority': 0, 'LightSpacingX': -1, 'LightSpacingY': -1},
    stair: {'Group': 'Office', 'StairClass': kit_class('BP_Stairs/BP_Stair_Concrete_01')},
}
for bp, values in defaults.items():
    cdo = unreal.get_default_object(bp.generated_class())
    for k, v in values.items():
        cdo.set_editor_property(k, v)
    try:
        cdo.set_editor_property('is_editor_only_actor', True)
    except Exception as exc:
        log['notes'].append(f'{bp.get_name()} editor-only flag: {exc}')
    BEL.compile_blueprint(bp)
    unreal.EditorAssetLibrary.save_loaded_asset(bp, only_if_is_dirty=False)

(OUT / 'setup.json').write_text(json.dumps(log, indent=2), encoding='utf-8')
unreal.log('OLB_SETUP_OK')
