"""Validate copied FBX imports, then reimport from a second directory in Unreal."""
import json
import shutil
from pathlib import Path
import unreal

OUT=Path('D:/AI/MarkWorkspace/.mrmak/total-insanitation/basement-review/module-trial')
ROOT='/Game/Art/Assets/Building/Modular_Blocks/Validation/Basement_20261112'
assert Path(unreal.Paths.get_project_file_path()).stem=='BoomeRacist'
assert unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).get_current_level().get_outermost().get_name() in {
 '/Game/Levels/LaCarlota','/Game/Levels/Streaming_Levels/Basement'}
smes=unreal.get_editor_subsystem(unreal.StaticMeshEditorSubsystem)

def vector(v):
 return [round(v.x,5),round(v.y,5),round(v.z,5)]

def inspect(mesh):
 b=mesh.get_bounding_box()
 return {'min_cm':vector(b.min),'max_cm':vector(b.max),'triangles':mesh.get_num_triangles(0),
         'uv_channels':smes.get_num_uv_channels(mesh,0),'slots':[str(m.material_slot_name) for m in mesh.static_materials],
         'vertices':smes.get_number_verts(mesh,0),'simple_collision_count':smes.get_simple_collision_count(mesh),
         'collision_trace':str(mesh.get_editor_property('body_setup').get_editor_property('collision_trace_flag'))}

def import_copy(source,name):
 asset_name='Trial_VertexPaint_Verified' if name=='Wall_VertexColor_01' else 'Trial_'+name
 existing=unreal.load_asset(ROOT+'/'+asset_name)
 if existing:
  # Reimport uses the asset's stored settings ahead of the task's new defaults.
  stored=existing.get_editor_property('asset_import_data')
  if isinstance(stored,unreal.FbxStaticMeshImportData):
   stored.set_editor_property('vertex_color_import_option',unreal.VertexColorImportOption.REPLACE)
   stored.set_editor_property('generate_lightmap_u_vs',False)
 options=unreal.FbxImportUI()
 options.automated_import_should_detect_type=False
 options.import_mesh=True
 options.import_as_skeletal=False
 options.mesh_type_to_import=unreal.FBXImportType.FBXIT_STATIC_MESH
 options.original_import_type=unreal.FBXImportType.FBXIT_STATIC_MESH
 options.import_materials=False
 options.import_textures=False
 options.import_animations=False
 options.static_mesh_import_data.combine_meshes=True
 options.static_mesh_import_data.vertex_color_import_option=unreal.VertexColorImportOption.REPLACE
 options.static_mesh_import_data.generate_lightmap_u_vs=False
 task=unreal.AssetImportTask()
 task.filename=str(source)
 task.destination_path=ROOT
 task.destination_name=asset_name
 task.automated=True
 task.replace_existing=True
 task.replace_existing_settings=True
 task.save=True
 task.factory=unreal.FbxFactory()
 task.options=options
 # UE 5.8 can route replacement tasks through Interchange despite FbxFactory.
 # Isolate this copied legacy FBX check, and restore the session flag immediately.
 flag='Interchange.FeatureFlags.Import.FBX'
 prior=unreal.SystemLibrary.get_console_variable_int_value(flag)
 world=unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
 try:
  unreal.SystemLibrary.execute_console_command(world,flag+' 0')
  unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
 finally:
  unreal.SystemLibrary.execute_console_command(world,flag+' '+str(prior))

names=['Wall_01','Wall_Corner_01','Floor_01','Wall_VertexColor_01']
report={'copies_only':True,'objects':[],
        'import_method':'Explicit FbxFactory; fresh vertex-painted copy imported with Replace. Atomic reimport may preserve existing colors. FBX Interchange flag restored after each copied task.'}
(OUT/'reimport').mkdir(exist_ok=True)
for name in names:
 path=ROOT+'/'+('Trial_VertexPaint_Verified' if name=='Wall_VertexColor_01' else 'Trial_'+name)
 import_copy(OUT/('Trial_'+name+'.fbx'),name)
 mesh=unreal.load_asset(path)
 before=inspect(mesh)
 original=unreal.load_asset('/Game/Art/Assets/Building/Modular_Blocks/'+('Floor/' if name=='Floor_01' else 'Modular_Walls/')+name)
 reference=inspect(original)
 assert max(abs(a-b) for key in ['min_cm','max_cm'] for a,b in zip(before[key],reference[key]))<0.02,(name,before,reference)
 assert before['uv_channels']>=reference['uv_channels']
 # Match the existing structural collision convention on the validation copy.
 body=mesh.get_editor_property('body_setup')
 body.set_editor_property('collision_trace_flag',unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE)
 source=OUT/'reimport'/('Trial_'+name+'.fbx')
 shutil.copy2(OUT/source.name,source)
 import_copy(source,name)
 mesh=unreal.load_asset(path)
 after=inspect(mesh)
 assert before['min_cm']==after['min_cm'] and before['max_cm']==after['max_cm']
 assert before['triangles']==after['triangles'] and before['uv_channels']==after['uv_channels']
 report['objects'].append({'name':name,'path':path,'production_reference':reference,'initial_import':before,'reimport':after,'passed':True})
(OUT/'unreal-roundtrip.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
unreal.log('MODULE_ROUNDTRIP_OK')
