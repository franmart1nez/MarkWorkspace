import json
import os
import datetime

WS = r'D:/AI/MarkWorkspace'
RT = WS + r'/.mrmak/total-insanitation/corridor-production'
b = json.load(open(RT + '/building-build.json', encoding='utf-8'))
p = json.load(open(RT + '/props-build.json', encoding='utf-8'))
eb = json.load(open(RT + '/export-building.json', encoding='utf-8'))
ep = json.load(open(RT + '/export-props.json', encoding='utf-8'))
pe = json.load(open(RT + '/preservation-env.json', encoding='utf-8'))
import re
reimport = json.load(open(RT + '/reimport-check.json', encoding='utf-8'))

FAMILY = {
    'SM_Corridor_Pipe_Pair_400': ('N01', 'Straight pipe pair assembly, 400 cm endpoints'),
    'SM_Corridor_Pipe_Pair_Corner_385': ('N01', 'Corner pipe pair assembly on the 385 cm shortened wall'),
    'SM_Corridor_Pipe_Pair_Infill_100': ('N01', '100 cm pipe pair infill'),
    'SM_Corridor_Pipe_Elbow_90': ('N01', '90 degree elbow, large pipe'),
    'SM_Corridor_Pipe_Coupler_Big': ('N01', 'Coupler/flange, large diameter'),
    'SM_Corridor_Pipe_Coupler_Small': ('N01', 'Coupler/flange, small diameter'),
    'SM_Corridor_Pipe_Bracket_Triangular': ('N01', 'Triangular support bracket'),
    'SM_Corridor_Pipe_ValveBranch': ('N01', 'Short valve branch with red handwheel'),
    'SM_Corridor_Conduit_Straight_400': ('N02', 'Straight conduit with saddle clamps, 400 cm'),
    'SM_Corridor_Conduit_Corner_385': ('N02', 'Corner conduit on the 385 cm wall'),
    'SM_Corridor_Conduit_Infill_100': ('N02', '100 cm conduit infill'),
    'SM_Corridor_Conduit_Elbow_90': ('N02', '90 degree conduit elbow'),
    'SM_Corridor_Conduit_Clamp': ('N02', 'Saddle clamp'),
    'SM_Corridor_Conduit_JunctionBox': ('N02', 'Shallow junction box with lid screws'),
    'SM_Corridor_Sign_Equipment': ('N04', 'EQUIPMENT route plaque with arrow'),
    'SM_Corridor_Sign_Service': ('N04', 'SERVICE plaque'),
    'SM_Corridor_Sign_Collection': ('N04', 'COLLECTION plaque'),
    'SM_Corridor_Sign_Caution': ('N04', 'DANGER HIGH VOLTAGE caution plate'),
    'SM_Corridor_ElectricalCabinet': ('N03', 'Two-door analog electrical cabinet with meter'),
    'SM_Corridor_WorkOrder_Panel': ('N05', 'Steel work-order panel with clips and two papers'),
    'SM_Corridor_Paper_Sheet_C': ('N05', 'Standalone service-log sheet variant'),
    'SM_Corridor_HoseReel': ('N06', 'Manual hose reel with coiled hose and clipped nozzle'),
    'SM_Corridor_Supply_Container': ('N07', 'Cream handled supply container'),
    'SM_Corridor_Lidded_Case': ('N07', 'Olive lidded case'),
    'SM_Corridor_Open_Bin': ('N07', 'Low gray open bin'),
}

family_sources = {
    'N01': ('building', 'Interior_Building.blend'),
    'N02': ('building', 'Interior_Building.blend'),
    'N03': ('props', 'Enviroment_Assets.blend'),
    'N04': ('building', 'Interior_Building.blend'),
    'N05': ('props', 'Enviroment_Assets.blend'),
    'N06': ('props', 'Enviroment_Assets.blend'),
    'N07': ('props', 'Enviroment_Assets.blend'),
}

assets = []
for src, report, collection in (('building', b, 'N01_Pipe_Kit / N02_Conduit_Kit / N04_Sign_Variants'),
                                ('props', p, 'N03_Electrical_Cabinet / N05_WorkOrder_Panel / N06_Hose_Reel / N07_Supply_Containers')):
    for a in report['assets']:
        fam, desc = FAMILY[a['name']]
        uv = report['uv'][a['name']]['UVMap']
        assets.append({
            'id': fam,
            'name': a['name'],
            'mesh': a['mesh'],
            'source': 'Assets/Building/Interior_Building.blend' if src == 'building' else 'Assets/Enviroment_Assets/Enviroment_Assets.blend',
            'collection': collection,
            'description': desc,
            'dimensions_cm': a['dims_cm'],
            'bounds_cm': a['bounds_cm'],
            'pivot': a['pivot'],
            'rotation': a['rotation'],
            'scale': a['scale'],
            'triangles': a['tris'],
            'material_slots': a['slots'],
            'uv_layers': a['uv_layers'],
            'uv_checks': {k: uv[k] for k in ('collapsed_uv_faces', 'min_uv_area', 'zero_uv_area_fraction')},
        })

manifest = {
    'pass': 'basement-corridor-2026-11-12',
    'generated': datetime.datetime.now().astimezone().isoformat(),
    'status': 'accepted',
    'acceptance': {
        'review_revision': 6,
        'action': 'accepted',
        'scope': 'N01-N07 model set and FBX exports after independent saved-source, FBX and native Unreal checks',
        'orchestrator_checks': {'meshes': 25, 'triangles': 13694, 'old_objects_preserved': 473,
                               'collapsed_uv_triangles': 0, 'missing_images': 0,
                               'fbx_layout_offsets': 0, 'unreal_imported_meshes': 25},
        'still_pending': ['owner aesthetic acceptance', 'final Basement placement',
                          'orchestrator-owned Unreal review assets and Workspace registry tabs'],
    },
    'model_set': 'N01-N07',
    'units': 'metres in Blender (Metric, scale 1); dimensions reported in cm',
    'texel_density': {
        'structures': '0.5 UV units/m (256 px/m at 512 px textures)',
        'props': '1.0 UV units/m (512 px/m at 512 px textures)',
        'atlas_faces': 'T01 cells authored at ~1000 px/m for legible lettering (graphics atlas exception)',
    },
    'sources': {
        'building': {
            'path': 'Assets/Building/Interior_Building.blend',
            'collection_root': 'Corridor_Production_20261112',
            'objects_before': 282,
            'objects_after': b['preservation']['current_objects'],
            'pre_existing_geometry_changed': b['preservation']['pre_existing_geometry_changed'],
            'pre_existing_missing': b['preservation']['pre_existing_missing'],
            'saved': b['saved'],
        },
        'props': {
            'path': 'Assets/Enviroment_Assets/Enviroment_Assets.blend',
            'collection_root': 'Corridor_Production_20261112',
            'objects_before': pe['baseline_objects'],
            'objects_after': pe['current_objects'],
            'pre_existing_geometry_changed': pe['geometry_changed'],
            'pre_existing_uv_changed': pe['uv_changed'],
            'pre_existing_material_changed': pe['material_changed'],
            'missing_images': pe['missing_images'],
            'saved': p['saved'],
        },
    },
    'recovery': {
        'directory': '.mrmak/total-insanitation/corridor-production/recovery/',
        'building_snapshot': 'Interior_Building.pre-corridor-20261112.blend',
        'building_disk_copy': 'Interior_Building.disk-copy-20261112.blend',
        'props_snapshot': 'Enviroment_Assets.pre-corridor-20261112.blend',
    },
    'exports': {
        'addon': 'Super Duper Batch Exporter 2.9.3',
        'preset': 'Unreal_Only_FBX (Forward -Z, Up Y, scale 1, apply unit scale, mesh only, modifiers on)',
        'mode': 'Parent Objects', 'limit': 'Visible', 'filename': '$OBJ',
        'origin_policy': 'targets temporarily moved to local origin for export, exact source transforms restored',
        'building': {'directory': eb['directory'], 'files': eb['files']},
        'props': {'directory': ep['directory'], 'files': ep['files']},
        'reimport_check': reimport,
    },
    'textures': [
        {'name': 'T01_Corridor_Graphics', 'file': 'Delivery/Basement/Corridor/Textures/T01_Corridor_Graphics.png',
         'size': '1024x1024', 'editable_source': 'T01_Graphics_Source collection (font objects) in Enviroment_Assets.blend',
         'generator': 'projects/total-insanitation/corridor-production/source/t01_atlas.py'},
    ],
    'reused_materials': ['Metal_01', 'Plastic_01', 'Rubber_01'],
    'new_materials': ['Corridor_Enamel_Cream', 'Corridor_Enamel_Olive', 'Corridor_Iron_Dark',
                      'Corridor_Steel_Galvanized', 'Corridor_Valve_Red', 'Corridor_Brass',
                      'Corridor_Rubber_Charcoal', 'Corridor_Plastic_Gray', 'Corridor_Atlas_T01'],
    'assets': assets,
    'family_rollup': {},
    'checks': {
        'uv_collapsed_faces_total': sum(a['uv_checks']['collapsed_uv_faces'] for a in assets),
        'triangles_total': sum(a['triangles'] for a in assets),
        'cabinet_projection_cm': 17.6,
        'hose_reel_projection_cm': 24.5,
        'module_spans_cm': {'straight': 400.0, 'corner_wall_length': 385.0, 'infill': 100.0},
        'previews': 'Workbench geometry diagnostics plus EEVEE material previews (AgX)',
    },
    'deliverable_images': sorted(os.listdir(WS + r'/projects/total-insanitation/renders/corridor')),
}

for fam in ('N01', 'N02', 'N03', 'N04', 'N05', 'N06', 'N07'):
    members = [a for a in assets if a['id'] == fam]
    manifest['family_rollup'][fam] = {
        'assets': len(members),
        'triangles': sum(a['triangles'] for a in members),
        'source': family_sources[fam][1],
        'status': 'modeled, UV-checked, exported',
    }

out = WS + r'/projects/total-insanitation/corridor-assets.json'
json.dump(manifest, open(out, 'w', encoding='utf-8'), indent=1)
print('MANIFEST', out, len(assets), manifest['checks']['triangles_total'])

