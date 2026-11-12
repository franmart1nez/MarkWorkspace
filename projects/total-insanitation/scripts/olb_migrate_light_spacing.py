"""One-off migration: LightSpacing -> LightSpacingX + LightSpacingY on BP_OLB_Builder / BP_OLB_Room.

Run inside the Unreal Editor. Copies each loaded instance's LightSpacing value to both
new variables before removing the old one. Saves only the two Blueprints, never a level.
Receipt: .mrmak/total-insanitation/office-level-builder/migrate-light-spacing.json
"""
import json
import unreal
from editor_toolset.toolsets.blueprint import BlueprintTools

OUT = 'D:/AI/MarkWorkspace/.mrmak/total-insanitation/office-level-builder/migrate-light-spacing.json'
ROOT = '/Game/Art/Tools/OfficeLevelBuilder/'
BEL = unreal.BlueprintEditorLibrary
T_INT = BEL.get_basic_type_by_name('int')
world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
log = {'instances': [], 'removed': []}

plan = {'BP_OLB_Builder': 2, 'BP_OLB_Room': -1}
old_values = {}
for name in plan:
    bp = unreal.load_asset(ROOT + name)
    cls = bp.generated_class()
    for a in unreal.GameplayStatics.get_all_actors_of_class(world, cls):
        try:
            old_values[a.get_path_name()] = a.get_editor_property('LightSpacing')
        except Exception:
            pass
    names = [str(n) for n in BEL.list_member_variable_names(bp)]
    cat = 'Office Builder|Pieces' + (' (empty = use Builder)' if name == 'BP_OLB_Room' else '')
    for v in ('LightSpacingX', 'LightSpacingY'):
        if v not in names:
            BEL.add_member_variable(bp, v, T_INT)
        BEL.set_blueprint_variable_instance_editable(bp, v, True)
        BEL.set_blueprint_variable_category(bp, v, cat)
    BEL.compile_blueprint(bp)
    cdo = unreal.get_default_object(bp.generated_class())
    cdo.set_editor_property('LightSpacingX', plan[name])
    cdo.set_editor_property('LightSpacingY', plan[name])
    BEL.compile_blueprint(bp)

for name in plan:
    cls = unreal.load_asset(ROOT + name).generated_class()
    for a in unreal.GameplayStatics.get_all_actors_of_class(world, cls):
        old = old_values.get(a.get_path_name())
        if old is not None:
            a.set_editor_property('LightSpacingX', old)
            a.set_editor_property('LightSpacingY', old)
            log['instances'].append([a.get_actor_label(), old])

for name in plan:
    bp = unreal.load_asset(ROOT + name)
    if 'LightSpacing' in [str(n) for n in BEL.list_member_variable_names(bp)]:
        BlueprintTools.remove_variable(bp, 'LightSpacing')
        log['removed'].append(name)
    BEL.compile_blueprint(bp)
    unreal.EditorAssetLibrary.save_loaded_asset(bp, only_if_is_dirty=False)

# verify instances kept their values after the final recompile
log['after'] = []
for name in plan:
    cls = unreal.load_asset(ROOT + name).generated_class()
    for a in unreal.GameplayStatics.get_all_actors_of_class(world, cls):
        log['after'].append([a.get_actor_label(), a.get_editor_property('LightSpacingX'), a.get_editor_property('LightSpacingY')])
log['dirty_maps'] = [p.get_name() for p in unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages()]
log['dirty_content'] = [p.get_name() for p in unreal.EditorLoadingAndSavingUtils.get_dirty_content_packages()]
open(OUT, 'w').write(json.dumps(log, indent=1))
unreal.log('OLB_MIGRATE_OK')
