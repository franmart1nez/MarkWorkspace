"""Export only the validation copies for an independent Blender UV/color read."""
from pathlib import Path
import unreal
OUT=Path('D:/AI/MarkWorkspace/.mrmak/total-insanitation/basement-review/module-trial/unreal-export')
OUT.mkdir(parents=True,exist_ok=True)
for name in ['Wall_01','Wall_Corner_01','Floor_01','Wall_VertexColor_01']:
    mesh=unreal.load_asset('/Game/Art/Assets/Building/Modular_Blocks/Validation/Basement_20261112/'+('Trial_VertexPaint_Verified' if name=='Wall_VertexColor_01' else 'Trial_'+name))
    options=unreal.FbxExportOption()
    options.set_editor_property('vertex_color',True)
    options.set_editor_property('collision',False)
    task=unreal.AssetExportTask()
    task.object=mesh
    task.filename=str(OUT/('Roundtrip_'+name+'.fbx'))
    task.automated=True
    task.prompt=False
    task.replace_identical=True
    task.options=options
    task.exporter=unreal.StaticMeshExporterFBX()
    assert unreal.Exporter.run_asset_export_task(task),name
unreal.log('VALIDATION_MESH_EXPORT_OK')
