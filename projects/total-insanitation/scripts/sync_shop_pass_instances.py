"""Refresh only the three newly authored components to their Blueprint defaults."""
import json
from pathlib import Path
import unreal

OUT=Path('D:/AI/MarkWorkspace/.mrmak/total-insanitation/basement-review')
receipt=json.loads((OUT/'service-pass-receipt.json').read_text(encoding='utf-8'))
level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).get_current_level().get_outermost().get_name()
assert level in {'/Game/Levels/LaCarlota','/Game/Levels/Streaming_Levels/Basement'}
bp=unreal.load_asset('/Game/Art/Assets/Building/Floors/Shop/Basement_Shop')
updated=[]
for actor in unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors():
    if actor.get_class()!=bp.generated_class():
        continue
    for comp in actor.get_components_by_class(unreal.SceneComponent):
        path=receipt['components'].get(comp.get_name())
        if not path:
            continue
        template=unreal.load_object(None,path)
        assert template
        props=['relative_location','relative_rotation','relative_scale3d']
        if isinstance(comp,unreal.StaticMeshComponent):
            props+=['override_materials']
        elif isinstance(comp,unreal.RectLightComponent):
            props+=['intensity','intensity_units','attenuation_radius','source_width','source_height','use_temperature','temperature','cast_shadows']
        comp.modify()
        for prop in props:
            comp.set_editor_property(prop,template.get_editor_property(prop))
        updated.append({'actor':actor.get_path_name(),'component':comp.get_name(),'properties':props})
receipt.setdefault('synchronized_instances',{})[level]=updated
(OUT/'service-pass-receipt.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
unreal.log('SHOP_NEW_COMPONENT_DEFAULTS_SYNCHRONIZED '+level)
