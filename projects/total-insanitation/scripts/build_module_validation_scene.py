"""Assemble copies in LaCarlota and export native meshes for UV/color verification."""
import json
from pathlib import Path
import unreal
from editor_toolset.toolsets.actor import ActorTools
from editor_toolset.toolsets.blueprint import BlueprintTools

OUT=Path('D:/AI/MarkWorkspace/.mrmak/total-insanitation/basement-review/module-trial')
ROOT='/Game/Art/Assets/Building/Modular_Blocks/Validation/Basement_20261112'
assert unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).get_current_level().get_outermost().get_name()=='/Game/Levels/LaCarlota'
bp=unreal.load_asset(ROOT+'/BP_Basement_Kit_Validation')
assert not bp,'The validation Blueprint already exists; inspect before replacing.'
bp=BlueprintTools.create(ROOT,'BP_Basement_Kit_Validation',unreal.Actor.static_class())
definitions=[('Floor_A','Floor_01',(0,0,0),0),('Floor_B','Floor_01',(400,0,0),0),
             ('Wall_A','Wall_01',(0,400,0),0),('Wall_B','Wall_VertexColor_01',(400,400,0),0),
             ('Corner','Wall_Corner_01',(0,0,0),90)]
for label,name,location,yaw in definitions:
    mesh=unreal.load_asset(ROOT+'/'+('Trial_VertexPaint_Verified' if name=='Wall_VertexColor_01' else 'Trial_'+name))
    comp=ActorTools.add_component(bp,unreal.StaticMeshComponent.static_class(),label)
    comp.set_editor_property('static_mesh',mesh)
    comp.set_editor_property('relative_location',unreal.Vector(*location))
    comp.set_editor_property('relative_rotation',unreal.Rotator(pitch=0,yaw=yaw,roll=0))
    comp.set_collision_profile_name('BlockAll')
unreal.BlueprintEditorLibrary.compile_blueprint(bp)
unreal.EditorAssetLibrary.save_loaded_asset(bp,only_if_is_dirty=False)
actor=unreal.get_editor_subsystem(unreal.EditorActorSubsystem).spawn_actor_from_class(bp.generated_class(),unreal.Vector(12000,-2400,0))
actor.set_actor_label('ART_REVIEW_Basement_Kit_Validation')
actor.set_folder_path('Art Review/Basement 2026-11-12')
(OUT/'unreal-export').mkdir(exist_ok=True)
exports=[]
for name in ['Wall_01','Wall_Corner_01','Floor_01','Wall_VertexColor_01']:
    mesh=unreal.load_asset(ROOT+'/'+('Trial_VertexPaint_Verified' if name=='Wall_VertexColor_01' else 'Trial_'+name))
    options=unreal.FbxExportOption()
    options.set_editor_property('vertex_color',True)
    options.set_editor_property('collision',False)
    task=unreal.AssetExportTask()
    task.object=mesh
    task.filename=str(OUT/'unreal-export'/('Roundtrip_'+name+'.fbx'))
    task.automated=True
    task.prompt=False
    task.replace_identical=True
    task.options=options
    task.exporter=unreal.StaticMeshExporterFBX()
    assert unreal.Exporter.run_asset_export_task(task),name
    exports.append(task.filename)
(OUT/'validation-assembly.json').write_text(json.dumps({
    'blueprint':ROOT+'/BP_Basement_Kit_Validation','actor':actor.get_path_name(),
    'location_cm':[12000,-2400,0],'components':definitions,
    'joint_contract':'385 cm corner ends at Y=385; a wall at Y=400 starts at Y=385 due to 15 cm thickness.',
    'exports':exports,'type':'native isolated validation assembly; not a new environment design',
},indent=2),encoding='utf-8')
unreal.log('MODULE_VALIDATION_ASSEMBLY_OK')
