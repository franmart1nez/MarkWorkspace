"""Inspect Unreal-exported FBXs in factory Blender; do not save a source."""
import json
import math
from pathlib import Path
import bpy
from mathutils import Vector

OUT=Path('D:/AI/MarkWorkspace/.mrmak/total-insanitation/basement-review/module-trial')
report=[]
for source in sorted((OUT/'unreal-export').glob('*.fbx'))+[OUT/'Trial_Wall_VertexColor_01.fbx']:
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj,do_unlink=True)
    bpy.ops.import_scene.fbx(filepath=str(source))
    for obj in bpy.context.scene.objects:
        if obj.type!='MESH':
            continue
        mesh=obj.data
        mesh.calc_loop_triangles()
        uvs=[]
        for layer in mesh.uv_layers:
            ratios=[]
            for tri in mesh.loop_triangles:
                a,b,c=[Vector(layer.data[i].uv) for i in tri.loops]
                uv_area=abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/2
                p,q,r=[obj.matrix_world@mesh.vertices[i].co for i in tri.vertices]
                area=(q-p).cross(r-p).length/2
                if area>.01 and uv_area>0:
                    ratios.append(math.sqrt(uv_area/area))
            uvs.append({'name':layer.name,'units_per_meter_min':min(ratios,default=0),'units_per_meter_max':max(ratios,default=0)})
        colors=[]
        for layer in mesh.color_attributes:
            samples=[list(v.color) for v in layer.data]
            colors.append({'name':layer.name,'count':len(samples),'min_rgba':[min(c[i] for c in samples) for i in range(4)],'max_rgba':[max(c[i] for c in samples) for i in range(4)]})
        report.append({'source':source.name,'object':obj.name,'dimensions_m':list(obj.dimensions),'uvs':uvs,'colors':colors})
assert len(report)==5
assert all(item['uvs'] for item in report)
(OUT/'exported-uv-color-check.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
assert next(item for item in report if 'Roundtrip_Wall_VertexColor' in item['source'])['colors']
native=next(item for item in report if 'Roundtrip_Wall_VertexColor' in item['source'])['colors'][0]
source=next(item for item in report if item['source']=='Trial_Wall_VertexColor_01.fbx')['colors'][0]
assert native['count']==source['count']
assert abs(native['min_rgba'][3]-source['min_rgba'][3])<.01
assert native['max_rgba'][3]-native['min_rgba'][3]>.3
for item in report:
    if not item['source'].startswith('Roundtrip_'):
        continue
    expected=.24975 if 'Floor' in item['source'] else .5
    assert abs(item['uvs'][0]['units_per_meter_min']-expected)<.01
    assert abs(item['uvs'][0]['units_per_meter_max']-expected)<.01
print('EXPORTED_UV_COLOR_CHECK_OK')
