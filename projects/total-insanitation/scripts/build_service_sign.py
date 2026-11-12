"""Historical Pass 01 sign builder; not the workflow for new assets.

This creates a separate source and clears its working scene. Do not run against
the existing building source. Future signs belong inside Interior_Building.blend
and use Super Duper Batch Exporter; read BLENDER_WORKFLOW.md.
"""
import math
from pathlib import Path
import bpy

OUT=Path('D:/AI/MarkWorkspace/projects/total-insanitation/sources/shop-service-pass')
OUT.mkdir(parents=True,exist_ok=True)
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj,do_unlink=True)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
scene.unit_settings.scale_length=1

def material(name,color,metal=0,roughness=.65):
    mat=bpy.data.materials.new(name)
    mat.diffuse_color=(*color,1)
    mat.use_nodes=True
    node=mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value=(*color,1)
    node.inputs['Roughness'].default_value=roughness
    node.inputs['Metallic'].default_value=metal
    return mat

paint=material('Sign_Enamel',(.055,.075,.052))
letters=material('Sign_Lettering',(.76,.69,.48))
screws=material('Sign_Fasteners',(.13,.14,.12),.6,.5)
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,0))
panel=bpy.context.object
panel.name='SM_Shop_Equipment_Sign'
panel.dimensions=(1.6,.025,.38)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
panel.data.materials.append(paint)
bevel=panel.modifiers.new('Folded rounded edges','BEVEL')
bevel.width=.012
bevel.segments=3
panel.modifiers.new('Weighted panel normals','WEIGHTED_NORMAL')

font=Path('C:/Windows/Fonts/arialbd.ttf')
font_data=bpy.data.fonts.load(str(font)) if font.exists() else None
for label,size,z in [('EQUIPMENT',.18,.015),('JANITOR SERVICE',.052,-.115)]:
    curve=bpy.data.curves.new(label,'FONT')
    curve.body=label
    curve.align_x='CENTER'
    curve.size=size
    curve.extrude=.0005
    curve.resolution_u=4
    if font_data:
        curve.font=font_data
    text=bpy.data.objects.new(label,curve)
    scene.collection.objects.link(text)
    text.location=(0,-.0135,z)
    text.rotation_euler=(math.pi/2,0,0)
    text.data.materials.append(letters)
for x in [-.735,.735]:
    for z in [-.137,.137]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.010,depth=.004,
                                          location=(x,-.015,z),rotation=(math.pi/2,0,0))
        bpy.context.object.name='Slotted fixing'
        bpy.context.object.data.materials.append(screws)
        # A dark slot supplies a restrained readable fastener detail.
        bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-.0175,z))
        slot=bpy.context.object
        slot.name='Fixing slot'
        slot.dimensions=(.012,.0005,.0018)
        slot.data.materials.append(paint)
scene['purpose']='Basement service pass; English provisional environmental lettering; editable source.'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Shop_Equipment_Sign.blend'))
# Convert only this export copy; the saved source keeps editable text and bevels.
for item in list(scene.objects):
    bpy.ops.object.select_all(action='DESELECT')
    item.select_set(True)
    bpy.context.view_layer.objects.active=item
    bpy.ops.object.convert(target='MESH')
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active=panel
bpy.ops.object.join()
panel.name='SM_Shop_Equipment_Sign'
bpy.ops.export_scene.fbx(filepath=str(OUT/'SM_Shop_Equipment_Sign.fbx'),use_selection=True,
    object_types={'MESH'},apply_unit_scale=True,apply_scale_options='FBX_SCALE_NONE',global_scale=1,
    axis_forward='-Y',axis_up='Z',use_mesh_modifiers=True,bake_anim=False,path_mode='AUTO')
print('SERVICE_SIGN_SOURCE_READY',OUT)
