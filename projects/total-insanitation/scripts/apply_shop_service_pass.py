"""Apply the small authorized service-area pass; keep an exact local change receipt."""
import json
from pathlib import Path
import unreal
from editor_toolset.toolsets.actor import ActorTools

OUT=Path('D:/AI/MarkWorkspace/.mrmak/total-insanitation/basement-review')
assert Path(unreal.Paths.get_project_file_path()).stem=='BoomeRacist'
assert unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).get_current_level().get_outermost().get_name()=='/Game/Levels/Streaming_Levels/Basement'
BP_PATH='/Game/Art/Assets/Building/Floors/Shop/Basement_Shop'
BASE='/Game/Art/Assets/Building/Floors/Shop/Signage'
receipt_path=OUT/'service-pass-receipt.json'
receipt=json.loads(receipt_path.read_text(encoding='utf-8')) if receipt_path.exists() else {
    'components':{}, 'new_assets':[], 'modified_assets':[],
    'authorization':'Owner requested the Overview steps and explicitly permitted overwriting existing assets if changes are marked.',
    'design':'1970s institutional equipment sign and one warm interior task light; existing bars remain the fantasy accent.',
    'owner_visual_acceptance':'pending',
}

def record():
    receipt_path.write_text(json.dumps(receipt,indent=2),encoding='utf-8')

def component(name,cls):
    saved=receipt['components'].get(name)
    obj=unreal.load_object(None,saved) if saved else None
    if obj and not isinstance(obj,cls):
        ActorTools.remove_component(obj)
        obj=None
    if not obj:
        obj=ActorTools.add_component(bp,cls.static_class(),name)
        receipt['components'][name]=obj.get_path_name()
        record()
    return obj

bp=unreal.load_asset(BP_PATH)
assert bp
assert all(p.get_name() in {'/Game/Levels/LaCarlota','/Game/Levels/Streaming_Levels/Basement'}
           for p in unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages())
sign=unreal.load_asset(BASE+'/SM_Shop_Equipment_Sign')
assert sign
unreal.EditorAssetLibrary.save_loaded_asset(sign,only_if_is_dirty=False)
size=sign.get_bounding_box().max-sign.get_bounding_box().min
assert abs(size.x-160)<.1 and abs(size.z-38)<.1,str(size)
parent=unreal.load_asset('/Game/Art/MM/Basic_Materials/MM_BasicColor')
material_definitions=[('Enamel',(.055,.075,.052,1),.72),
                      ('Lettering',(.76,.69,.48,1),.75),
                      ('Fasteners',(.13,.14,.12,1),.5)]
mats={}
for suffix,color,roughness in material_definitions:
    path=BASE+'/MI_ShopSign_'+suffix
    mat=unreal.load_asset(path)
    if not mat:
        mat=unreal.AssetToolsHelpers.get_asset_tools().create_asset('MI_ShopSign_'+suffix,BASE,unreal.MaterialInstanceConstant,unreal.MaterialInstanceConstantFactoryNew())
    unreal.MaterialEditingLibrary.set_material_instance_parent(mat,parent)
    unreal.MaterialEditingLibrary.set_material_instance_vector_parameter_value(mat,'Color',unreal.LinearColor(*color))
    unreal.MaterialEditingLibrary.set_material_instance_scalar_parameter_value(mat,'Roughness',roughness)
    unreal.MaterialEditingLibrary.update_material_instance(mat)
    unreal.EditorAssetLibrary.save_loaded_asset(mat)
    mats['Sign_'+suffix]=mat
    if path not in receipt['new_assets']:
        receipt['new_assets'].append(path)
    record()

sign_comp=component('ArtPass_EquipmentSign',unreal.StaticMeshComponent)
sign_comp.set_editor_property('static_mesh',sign)
sign_comp.set_editor_property('relative_location',unreal.Vector(-382,6,293))
sign_comp.set_editor_property('relative_rotation',unreal.Rotator(0,0,0))
sign_comp.set_collision_profile_name('NoCollision')
sign_comp.set_editor_property('override_materials',[mats[str(slot.material_slot_name)] for slot in sign.static_materials])

fixture_mesh=unreal.load_asset('/Game/Art/Assets/Building/Modular_Blocks/Lights/Fluorescent_Light_Basement_01')
fixture=component('ArtPass_ServiceFluorescent',unreal.StaticMeshComponent)
fixture.set_editor_property('static_mesh',fixture_mesh)
fixture.set_editor_property('relative_location',unreal.Vector(-382,90,390))
fixture.set_editor_property('relative_scale3d',unreal.Vector(.65,.65,.65))
fixture.set_collision_profile_name('NoCollision')
reference=None
for actor in unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors():
    for comp in actor.get_components_by_class(unreal.StaticMeshComponent):
        if comp.static_mesh==fixture_mesh and not comp.get_name().startswith('ArtPass_'):
            reference=comp
            break
    if reference:
        break
assert reference
fixture.set_editor_property('override_materials',list(reference.get_materials()))

light=component('ArtPass_ServiceTaskLight',unreal.RectLightComponent)
light.set_editor_property('relative_location',unreal.Vector(-382,90,375))
light.set_editor_property('relative_rotation',unreal.Rotator(pitch=-45,yaw=-90,roll=0))
light.set_editor_property('intensity_units',unreal.LightUnits.LUMENS)
light.set_editor_property('intensity',80.0)
light.set_editor_property('attenuation_radius',550.0)
light.set_editor_property('source_width',120.0)
light.set_editor_property('source_height',16.0)
light.set_editor_property('use_temperature',True)
light.set_editor_property('temperature',3900.0)
light.set_editor_property('cast_shadows',True)
light.set_editor_property('mobility',unreal.ComponentMobility.MOVABLE)
unreal.BlueprintEditorLibrary.compile_blueprint(bp)
# Component creation compiles/reinstances the class. Reacquire its final templates
# and explicitly persist their material arrays on the Blueprint.
bp.modify()
final_sign=unreal.load_object(None,receipt['components']['ArtPass_EquipmentSign'])
final_fixture=unreal.load_object(None,receipt['components']['ArtPass_ServiceFluorescent'])
final_sign.set_editor_property('override_materials',[mats[str(slot.material_slot_name)] for slot in sign.static_materials])
final_fixture.set_editor_property('override_materials',list(reference.get_materials()))

texture_path='/Game/Art/MI/Utility_Materials/Concrete/CobbleStone_02/CobbleStone_02_occlusionRoughnessMetallic'
texture=unreal.load_asset(texture_path)
receipt.setdefault('texture_before',{'srgb':texture.get_editor_property('srgb'),'compression':str(texture.get_editor_property('compression_settings'))})
registry=unreal.AssetRegistryHelpers.get_asset_registry()
queue=[texture_path]
visited=set()
maps=set()
while queue and len(visited)<2000:
    path=queue.pop()
    if path in visited:
        continue
    visited.add(path)
    for ref in registry.get_referencers(path,unreal.AssetRegistryDependencyOptions()):
        ref=str(ref)
        if ref.startswith('/Game/'):
            if '/Levels/' in ref:
                maps.add(ref)
            elif ref not in visited:
                queue.append(ref)
receipt['texture_referencing_maps']=sorted(maps)
record()
texture.set_editor_property('srgb',False)
texture.set_editor_property('compression_settings',unreal.TextureCompressionSettings.TC_MASKS)
unreal.EditorAssetLibrary.save_loaded_asset(texture)
unreal.EditorAssetLibrary.save_loaded_asset(bp,only_if_is_dirty=False)
for path in [BP_PATH,texture_path]:
    if path not in receipt['modified_assets']:
        receipt['modified_assets'].append(path)
if BASE+'/SM_Shop_Equipment_Sign' not in receipt['new_assets']:
    receipt['new_assets'].append(BASE+'/SM_Shop_Equipment_Sign')
receipt['texture_after']={'srgb':texture.get_editor_property('srgb'),'compression':str(texture.get_editor_property('compression_settings'))}
receipt['native_visual_review']='pending'
receipt['light_settings']={'class':'RectLightComponent','lumens':80,'kelvin':3900,
                           'radius_cm':550,'source_size_cm':[120,16],
                           'relative_location_cm':[-382,90,375],'rotation':[-45,-90,0]}
record()
unreal.log('SHOP_SERVICE_PASS_APPLIED')
