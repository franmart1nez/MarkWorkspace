"""Historical Pass 01 report builder; inspect before reuse.

Cards are now maintained in place. Preserve later owner decisions in
BLENDER_WORKFLOW.md and never rerun this builder over those decisions blindly.
"""
import hashlib
import json
import re
import shutil
from collections import Counter
from datetime import datetime
from pathlib import Path

ROOT=Path('D:/AI/MarkWorkspace')
PROJECT=ROOT/'projects/total-insanitation'
CARD=ROOT/'workspace/2026-11-12_total-insanitation'
RUN=ROOT/'.mrmak/total-insanitation/basement-review'

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(path,text):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix(path.suffix+'.tmp')
    temp.write_text(text,encoding='utf-8',newline='\n')
    temp.replace(path)

def save(path,value):
    write(path,json.dumps(value,ensure_ascii=False,indent=2)+'\n')

def edit_card(filename,updates,additions=(),**fields):
    path=CARD/filename
    card=read(path)
    card.update(fields)
    for item in card['items']:
        if item['id'] in updates:
            item.update(updates[item['id']])
    known={item['id'] for item in card['items']}
    card['items'].extend(item for item in additions if item['id'] not in known)
    save(path,card)

before={r['Path'].replace('\\','/'):r['Hash'] for r in read(RUN/'content-hashes-before.json')}
after={r['Path'].replace('\\','/'):r['Hash'] for r in read(RUN/'content-hashes-after.json')}
changed=sorted(path for path in before.keys()&after.keys() if before[path]!=after[path])
added=sorted(after.keys()-before.keys())
deleted=sorted(before.keys()-after.keys())
assert not deleted,deleted
assert len(changed)==4,changed
assert len(added)==9,added
blend=read(RUN/'blend-hash-before.json')
assert hashlib.sha256(Path(blend['Path']).read_bytes()).hexdigest().lower()==blend['Hash'].lower()
basename='D:/GItHub/BoomeRacist/Content/'
package=lambda path:'/Game/'+path.removeprefix(basename).rsplit('.',1)[0]
receipt=read(RUN/'service-pass-receipt.json')
receipt['native_visual_review']='Agent checked three matched PIE stations, sign legibility and saved/reloaded component materials.'
receipt['modified_packages']=list(map(package,changed))
receipt['added_packages']=list(map(package,added))
receipt['source_blend_unchanged']=True
save(RUN/'service-pass-receipt.json',receipt)

media=CARD/'media/pass-01'
media.mkdir(parents=True,exist_ok=True)
for station in ['shop','junction','crossing']:
    for state in ['before','after']:
        name=f'basement-{station}-{state}-gameplay.png'
        shutil.copy2(RUN/name,media/name)
shutil.copy2(RUN/'module-assembly-0.png',media/'module-assembly.png')
shutil.copy2(RUN/'lacarlota-gameplay.png',media/'lacarlota-play.png')
reference_dir=CARD/'media/owner-references'
reference_dir.mkdir(parents=True,exist_ok=True)
references=[]
reference_notes={
    'Basement_01.png':('Basement / approach','Owner-supplied gameplay view with Main_Lights included. Repeated fluorescent pools and exposed masonry establish the neglected service route.'),
    'Basement_02.png':('Basement / stairs','Owner-supplied descent. The low ceiling and dark stair transition frame the view toward the final hall.'),
    'Basement_03.png':('Basement / junction','Owner-supplied junction. The central route reads through the light rhythm; side bays remain dark.'),
    'Basement_04.png':('Basement / shop before pass 01','Owner-supplied endpoint. Service is through the open counter; equipment is delivered through the separate spikes/bars opening. The future NPC remains undecided.'),
    'Basement_Blocks.png':('Basement / existing kit','Owner-supplied modular Blueprint lineup. Regular modules are 4 m; shortened corners prevent intersecting surfaces. Materials are applied in Blueprints.'),
    'Office_Lab Blocks.png':('Office and lab / existing kit','Owner-supplied public-area kit: wood, wallpaper, light concrete and warm trim; floor-covering variants and suspended ceilings.'),
    'Office_Lab_01.png':('Office / wood and ceiling grid','Owner-supplied gameplay work. Wood paneling and the regular luminous ceiling grid are concrete 1970s references for this project.'),
    'Office_Lab_02.png':('Office / doorway proportion','Owner-supplied gameplay work. A wood-lined doorway frames a wallpaper room. A modular doorway mesh exists; its reusable Blueprint still needs a production pass.'),
    'Office_Lab_03.png':('Office / wallpaper and carpet','Owner-supplied gameplay work. Pattern scale, carpet and ceiling repetition show the existing institutional vocabulary.'),
    'Office_Lab_04.png':('Office / material variant','Owner-supplied gameplay work. Red carpet contrasts with wood walls; it is an office reference, not a Basement floor prescription.'),
    'Office_Lab_05.png':('Lab / light concrete and band','Owner-supplied early lab shell. The owner intends a lab on most office floors, especially the first level; layout and furnishing are still developing.'),
    'Materials.png':('LaCarlota / material variants','Owner-supplied native material board. Metallic, concrete, glass, plastic, wood, leather, magic, trim sheet, rugs, ceiling and wallpaper families are already available.'),
}
for source in sorted((PROJECT/'Temp').rglob('*.png')):
    title,note=reference_notes[source.name]
    filename=source.name.replace(' ','-').lower()
    shutil.copy2(source,reference_dir/filename)
    references.append({'id':'owner-'+re.sub('[^a-z0-9]+','-',source.stem.lower()).strip('-'),
                       'title':title,'image':'media/owner-references/'+filename,'alt':title+' supplied by the owner',
                       'status':'done','body':note+'\n\nReceived in `projects/total-insanitation/Temp` on 12 November 2026. Original image retained without visual edits; original notes remain in Temp.'})
assert len(references)==12
save(CARD/'references.card.json',{'format':'mrmak-card','version':1,'template':'gallery',
     'title':'Owner references / November 2026','summary':'Twelve supplied native views and translated production notes from Temp. These establish current project context; pass 01 verification is recorded separately in Basement → Pass 01.',
     'items':references})

edit_card('basement.card.json',{
 'corridor-baseline':{'title':'01 / Historical standalone baseline','body':'**Historical setup capture, 12 November 2026.** Existing standalone Basement corridor, before the owner supplied the assembled views in Temp. Camera approximately `(5005, 3371, -957)` cm; FOV 90°.\n\nSuperseded for production review by the three matched PIE pairs in **Pass 01**. Those use Main_Lights and the actual game camera at FOV 95°.'},
 'shop-focus':{'title':'02 / Shop: first service-area pass implemented','image':'media/pass-01/basement-shop-after-gameplay.png','alt':'Actual Basement gameplay after the equipment sign and warm local task light were added','status':'review','body':'**Implemented and agent-verified, 12 November 2026.** A restrained equipment sign, a reused fluorescent fixture and one warm local rectangular light establish the service counter. The existing barred delivery opening remains the fantasy accent.\n\nThe owner explained that the NPC serves through the open window and releases equipment through the separate bars/spikes. NPC choice and interaction behavior remain deferred.\n\nThe **Pass 01** subtab has the matching before image, camera provenance and exact changed files. Owner aesthetic acceptance is pending.'},
 'modular-source':{'title':'03 / Existing kit: copied round trip passed','image':'media/pass-01/module-assembly.png','alt':'Four copied module types assembled on a four-meter grid in LaCarlota','status':'done','body':'**Measured in Blender and Unreal.** Wall: 400 × 400 × 15 cm. Corner: 385 × 400 × 15 cm. Floor: 400 × 400 × 15 cm. Unit object scale and edge pivots agree between source and import.\n\nFour types passed copied import/reimport; an independent Unreal → FBX → Blender check retained UV scale and the painted wall’s alpha channel. Floor, wall, corner and straight-wall seam collision probes hit at the expected distances.\n\nThe isolated review actor is `ART_REVIEW_Basement_Kit_Validation` in LaCarlota, at `(12000, -2400, 0)` cm. The original building blend is unchanged.'},
 'pass-one':{'title':'04 / Pass 01 completed; review the result','status':'review','body':'The Overview’s initial sequence has been executed: assembled route/shop review, representative module verification and a compact 1970s service-area treatment.\n\nThree matched before/after PIE pairs cover the approach/crossing, stair descent and shop front. The shop Blueprint, one packed data texture and two allowed maps were saved. Exact changes, new assets and recovery copies are documented in **Pass 01**.\n\nNext artistic choices: review the sign wording/light balance, then prioritize the doorway Blueprint, deliberate wear variation and service props.'},
},title='Basement / pass 01 and native evidence',summary='First service-area pass implemented. Review matched gameplay views, the verified modular kit and the precise change list. Implementation and agent checks are separate from owner acceptance.',additions=[{
 'id':'assembled-route','title':'05 / The route now points toward the counter','image':'media/pass-01/basement-junction-after-gameplay.png',
 'alt':'Actual gameplay looking down the dark basement stairs toward the lit equipment counter','status':'done',
 'body':'**Native PIE with Main_Lights.** The warm counter remains visible through the stair opening while the approach stays dark. Camera and FOV match the before capture in Pass 01. These stationary review views establish sightlines, not a full traversal or performance benchmark.'}])

edit_card('art-bible.card.json',{
 'style':{'body':'**Confirmed by the owner.** Semi-realism and stylization, with 1970s corporate interiors as the dominant language and medieval fantasy as an accent.\n\n**New owner evidence:** the References subtab now contains the supplied office/lab shells, modular kits and assembled Basement. Wood paneling, wallpaper, carpet, regular luminous ceiling grids and a light concrete lab band give concrete project examples. No numeric style ratio has been chosen.\n\n**Pass 01 application:** a simple olive/cream service sign and warm fluorescent task area; the existing spikes/bars carry the fantasy accent.'},
 'basement-role':{'image':'media/pass-01/basement-shop-after-gameplay.png','alt':'Verified gameplay view of the equipment service counter after pass 01','status':'review','body':'**Confirmed.** The player prepares for a cleaning assignment here. The NPC serves through the open counter; the separate spikes/bars opening releases equipment. NPC identity and gameplay are still undecided.\n\n**Implemented, 12 November 2026.** Pass 01 makes the counter a visible destination using a sign and one warm local light. Existing geometry and the rest of the corridor layout were retained. The owner has not yet reviewed this new treatment.'},
 'modularity':{'body':'**Confirmed in Temp and measured natively.** Walls, floor and roof modules use a 4 m grid. Regular walls are 4 m high, 4 m long and 15 cm thick; corners shorten to 3.85 m. Decorations follow the module length, with corresponding corner trims. Materials are assigned in modular Blueprints after Blender import.\n\nThe shop remains floor-specific. Existing building sources were preserved. The copied trial is in LaCarlota; see Basement → Pass 01. Doorway meshes need a reusable Blueprint. Window migration remains a future library decision.'},
 'surfaces':{'body':'**Confirmed.** Reuse tileables, the structural trim sheet and the elevator atlas. The Materials tab now also shows the owner’s LaCarlota variant board and the actual Basement material families.\n\n**Technical correction in pass 01:** CobbleStone_02’s ORM texture was changed from sRGB/default compression to linear/masks after tracing its references to Basement and LaCarlota. RGB channels remain AO / roughness / metallic. No Designer graph or original texture pixels were changed.\n\nMeasured wall UV scale supports about 256 px/m with 512 px textures. The sampled floor has about 128 px/m with its current 512 px concrete; this intentional exception matches its tileable. Preserve floor and ceiling UV/tiling exceptions.'},
},title='Art bible / v0.2',additions=[{
 'id':'owner-office-context','title':'Office and laboratory context from Temp','image':'media/owner-references/office_lab_01.png','alt':'Owner-supplied office gameplay with wood walls and a luminous ceiling grid','status':'done',
 'body':'**Owner-supplied current work.** These are early shells, mostly walls, floor, ceiling and lights. Most office floors are intended to include a laboratory, particularly the first level. Furnishing and layouts are still developing.\n\nKeep the public/private contrast: warmer, orderly offices above; worn concrete, masonry and utility lights below. All twelve images are in References.'}])

la=read(RUN/'LaCarlota-audit.json')
assets={(a['path'],a['class']) for a in la['assets']}
families=Counter(path.split('/')[5] for path,cls in assets if cls=='MaterialInstanceConstant' and path.startswith('/Game/Art/MI/Utility_Materials/'))
edit_card('materials.card.json',{},additions=[
 {'id':'lacarlota-board','title':'LaCarlota / existing material variants','image':'media/owner-references/materials.png','alt':'Owner-supplied Unreal material board with labeled surface families','status':'done','body':'**Owner-supplied native board from Temp.** Existing variants are organized under `/Game/Art/MI/Utility_Materials`, alongside vertex-paint blends under `/Game/Art/MI/Vertex_Paint_Blend`. Use the library before authoring another material.\n\nThe current registry contains '+str(sum(families.values()))+' distinct material-instance assets under Utility_Materials. This is an asset inventory, not a count of finished surfaces or a runtime budget.'},
 {'id':'orm-correction','title':'Corrected / CobbleStone_02 packed data','status':'done','body':'**Saved in pass 01.** `/Game/Art/MI/Utility_Materials/Concrete/CobbleStone_02/CobbleStone_02_occlusionRoughnessMetallic`: sRGB **off**, compression **Masks**. Previously sRGB on with default color compression.\n\nR = AO; G = roughness; B = metallic. Traced material/Blueprint references reach only Basement and LaCarlota. The texture is shared by the cobblestone preview and two painted blends; those material assets were not overwritten.'},
 {'id':'density-observation','title':'Confirmed / intentional floor and ceiling UV exceptions','status':'done','body':'The sampled wall UVs use about 0.5 UV units/m: 512 px × 0.5 ≈ **256 px/m**. The floor UVs use about 0.24975 units/m with a current 512 px concrete and 1× material tiling: approximately **128 px/m**.\n\nThe owner confirmed that some floors and ceilings intentionally use other densities to match their tileables. Preserve those UVs and material tiling; this floor is not a pending density correction.'},
])
edit_card('decisions.card.json',{
 'scope':{'body':'12 November 2026 — Owner: environment first, currently Basement. Work in the four allowed maps. New and modified art assets stay under `/Game/Art`. The owner explicitly permits overwriting existing art assets when the completed change list identifies them. Characters, weapons and UI stay deferred.'},
 'first-pass':{'title':'Implemented / first Basement service-area pass','body':'**Owner authorization, 12 November 2026:** execute the Overview sequence; existing assets may be overwritten if marked afterward.\n\n**Agent-selected implementation:** an olive/cream equipment sign, reused fluorescent fixture and one 3900 K rectangular task light at the counter. Preserve the original barred delivery mechanism and neglected corridor.\n\n**Verified:** three matched actual gameplay pairs; saved/reloaded materials; original geometry and source blend retained.\n\n**Owner aesthetic acceptance:** pending review of Pass 01. Sign wording and exact light balance remain editable.'},
 'modular-standard':{'title':'Verified / representative modular contract','status':'done','body':'Wall 400 × 400 × 15 cm; corner 385 × 400 × 15 cm; floor 400 × 400 × 15 cm. Unit scales and common edge pivots verified. A corner’s 385 cm length plus the adjoining wall’s 15 cm thickness completes the 400 cm grid.\n\nCopied Blender → FBX → Unreal import/reimport passed for four types. Corrected the trial export from a 100× unit mismatch and verified UVs and vertex-paint alpha by exporting the native copy back to Blender. Initial imports need explicit vertex-color Replace; reimport may preserve existing paint.\n\nSource contract and exact test paths are in Pass 01 and the project MODULE_CONTRACT.md.'},
},additions=[{'id':'main-lights-assembly','title':'Verified / lighting is assembled in both review maps','status':'done','body':'Main_Lights is Always Loaded and visible in saved Basement and LaCarlota. It was already present in the live LaCarlota session when work began; the level was saved without adding a duplicate. A real LaCarlota PIE audit confirmed the streamed directional light and the player pawn. Global Main_Lights content was not changed.'}])

modified_table='\n'.join('| `'+package(path)+'` | '+description+' |' for path,description in [
 (next(p for p in changed if p.endswith('Basement_Shop.uasset')),'Added only ArtPass_EquipmentSign, ArtPass_ServiceFluorescent and ArtPass_ServiceTaskLight; original mesh components retained.'),
 (next(p for p in changed if p.endswith('CobbleStone_02_occlusionRoughnessMetallic.uasset')),'sRGB off; Masks compression for packed AO/roughness/metallic data.'),
 (next(p for p in changed if p.endswith('LaCarlota.umap')),'Saved the existing Main_Lights inclusion, refreshed new shop components and added the isolated kit review actor.'),
 (next(p for p in changed if p.endswith('Basement.umap')),'Saved/refreshed only the shop’s new component defaults; existing actor layout retained.'),
])
added_list='\n'.join('- `'+package(p)+'`' for p in added)
family_table='\n'.join(f'| {name} | {count} |' for name,count in sorted(families.items()))
report=f'''# Basement / pass 01

**12 November 2026 · Implemented and agent-verified · Owner visual review pending.**

The Overview sequence is complete: review the assembled route, verify a representative modular group, and apply a compact 1970s service-area treatment. The counter now has an equipment sign and a warm local task light. The existing bars/spikes remain the fantasy accent. One packed material texture was corrected.

## Matched actual gameplay

These are native Unreal PIE captures with Main_Lights loaded and the actual game camera at **95° FOV**. Each pair uses the same spawn pose and camera; source captures are **2013 × 1040**. Images retain their original pixels and are clickable/downloadable. They are stationary appearance checks, not a continuous traversal.

### Shop / before

![Shop before pass 01](media/pass-01/basement-shop-before-gameplay.png)

### Shop / after

![Shop after pass 01: readable equipment sign and a restrained warm counter light](media/pass-01/basement-shop-after-gameplay.png)

The cold corridor remains dominant. The sign and counter create a specific destination without changing the existing shop mesh, moving the bars or filling the future NPC area. The sign reads **EQUIPMENT / JANITOR SERVICE**; it is editable environmental lettering. The owner described separate service and equipment-release openings, which this pass preserves.

### Stair descent / before

![Stair descent before](media/pass-01/basement-junction-before-gameplay.png)

### Stair descent / after

![Stair descent after, with the counter visible through the low opening](media/pass-01/basement-junction-after-gameplay.png)

### Crossing and approach / before

![Crossing and approach before](media/pass-01/basement-crossing-before-gameplay.png)

### Crossing and approach / after

![Crossing and approach after, with the existing fluorescent rhythm and distant shop cue](media/pass-01/basement-crossing-after-gameplay.png)

| Review station | Spawn position, cm | Pitch / yaw | Observed camera position, cm |
| --- | --- | --- | --- |
| Shop | 4988, 6900, -1504 | -1.875 / 84.475 | 4987.037, 6890.046, -1422.850 |
| Stair descent | 5000, 5400, -1104 | -4 / 90 | 5000, 5390, -1022.850 |
| Crossing | 5000, 3371, -1104 | -1 / 90 | 5000, 3361, -1022.850 |

## Kit verification

![Native copied kit assembly in LaCarlota](media/pass-01/module-assembly.png)

**Review actor:** `ART_REVIEW_Basement_Kit_Validation`, in LaCarlota at `(12000, -2400, 0)` cm, folder `Art Review/Basement 2026-11-12`. It uses four copied types and a checker material for geometry/UV inspection, independently of the finished environment.

| Type | Measured dimensions | Pivot / placement |
| --- | --- | --- |
| Wall_01 | 400 × 15 × 400 cm | Edge pivot; local X 0–400, Y -15–0, Z 0–400 |
| Wall_Corner_01 | 385 × 15 × 400 cm | Same edge convention; shortened by the 15 cm wall thickness |
| Floor_01 | 400 × 400 × 15 cm | Top surface at local Z 0; thickness below the walking surface |
| Wall_VertexColor_01 | 400 × 15 × 400 cm | Same wall convention; painted alpha retained in the verified copy |

Unit object scale, dimensions, pivots, triangle count and UV channels survived copied import/reimport. Exporting the native meshes back to Blender independently confirmed the UV scale. The vertex-painted wall retained its varying alpha, approximately 0.63–1 after 8-bit conversion. No original modular mesh was overwritten.

**Historical copied-export trial:** the trial first exposed a **100× unit mismatch** and an import default that ignored vertex colors. The validated Blender export uses `global_scale=1`, `apply_unit_scale=True`, `FBX_SCALE_NONE`, forward `-Y`, up `Z`. The isolated legacy FBX trial explicitly imports vertex colors with Replace on the fresh copy; reimports may preserve existing paint. The session’s Interchange FBX flag was restored after the trial. Future production delivery uses Super Duper Batch Exporter with Unreal_Only_FBX (-Z / Y); read BLENDER_WORKFLOW.md.

Four native collision probes hit at expected distances: floor **100 cm**, wall **185 cm**, corner **85 cm** and the straight-wall seam **185 cm**. Copies use the existing Complex As Simple structural convention. The L-corner joins at local Y 385 where the wall placed at Y 400 begins; no overlapping wall surfaces were needed.

The sampled wall is approximately **256 px/m** with a 512 px texture. The current concrete floor is approximately **128 px/m** (0.24975 UV units/m × 512 px, 1× tiling). The owner confirmed that floor and ceiling exceptions intentionally match their specific tileables. Preserve those UVs and material tiling. Original modules have one authored UV channel; no baked-lightmap pass was performed.

## Exact changes to existing Unreal packages

The owner explicitly allowed overwriting existing art assets provided the changes were marked. File hashes before and after identify **four changed existing packages**:

| Package | Change |
| --- | --- |
{modified_table}

The shop adds **one movable rectangular light**, 80 lumens, 3900 K, 550 cm radius, 120 × 16 cm source, shadows enabled. The fixture reuses the existing mesh and materials. No shared light Blueprint or Main_Lights asset was changed. Original shop mesh components and existing actor placements remain intact.

The ORM correction affects the existing material references in Basement and LaCarlota. Texture pixels, parent materials and Designer sources were preserved. R = AO, G = roughness, B = metallic.

## New Unreal packages

All nine additions are under `/Game/Art`:

{added_list}

Materials remain assigned in the shop Blueprint, following the owner’s workflow. The copied validation assets are separate from production meshes. The failed superseded vertex-color probe was removed after its references were cleared.

## Sources and recovery

- Editable new sign: `projects/total-insanitation/sources/shop-service-pass/Shop_Equipment_Sign.blend`; matching FBX alongside it. Text, panel bevel and fixings remain editable.
- The original `Interior_Building.blend` matches its before-work SHA-256. Existing source blends, SBS graphs and texture exports were not overwritten.
- Temp’s original 12 PNGs and notes are retained. Art bible → References contains image copies and English production notes.
- Local recovery copies, native receipts, camera metadata, failed probes and the copied module source are under `.mrmak/total-insanitation/basement-review/`, outside Git. Backups contain the original shop Blueprint, ORM texture and both map versions before the relevant saves.
- Both review maps were saved and reloaded. The final Basement audit reports no dirty content packages or maps.

## What remains

**Owner review:** sign wording, warm/cold light balance and whether the next art pass should prioritize service props or the doorway Blueprint. The doorway mesh exists but its modular Blueprint is still a kit gap. Wear repetition remains a candidate for a deliberate second pass.

**Next delivery check:** use the owner’s Super Duper Batch Exporter preset and verify its first asset delivery in Unreal. New structural/shop assets belong in Interior_Building.blend; individual props in Enviroment_Assets.blend. Read BLENDER_WORKFLOW.md.

**Deferred:** NPC selection, shop interactions, the bars’ behavior, characters, weapons, UI and unrelated maps. No paid generation or application restart was used.
'''
write(CARD/'BASEMENT_PASS_01.md',report)

assets_doc=CARD/'ASSETS.md'
old=assets_doc.read_text(encoding='utf-8')
old=old.split('\n## Pass 01 / measured additions')[0]
write(assets_doc,old+f'''\n## Pass 01 / measured additions

The owner supplied Temp and confirmed the **4 m** modular standard, shortened corners and Blueprint material assignment. The representative copied group passed import/reimport and native collision checks; full evidence is in **Basement → Pass 01**.

- Regular wall: 400 × 15 × 400 cm; corner: 385 × 15 × 400 cm; floor: 400 × 400 × 15 cm.
- Copy test: `/Game/Art/Assets/Building/Modular_Blocks/Validation/Basement_20261112`.
- New sign source: `projects/total-insanitation/sources/shop-service-pass/Shop_Equipment_Sign.blend`.
- Doorway meshes still need a modular Blueprint. No doorway or window asset migration was made.
- Basement retained its 186 original actors; LaCarlota gained one isolated review actor (442 → 443), plus the existing five Main_Lights actors in each map.

### Existing material-instance families

Distinct registry assets under `/Game/Art/MI/Utility_Materials`, excluding redirectors. These are library entries, not runtime counts or budgets.

| Family | Material instances |
| --- | --- |
{family_table}

The supplied native variant board is in Art bible → Materials; all twelve supplied images are in References. The corrected CobbleStone_02 ORM and the 128 px/m sampled floor exception are documented there.
''')

registry_path=ROOT/'workspace/workspace.json'
registry=read(registry_path)
entity=next(e for e in registry['entities'] if e['id']=='total-insanitation')
entity['updated']=datetime.now().astimezone().isoformat(timespec='seconds')
entity['description']='Basement pass 01: assembled gameplay review, verified four-meter modular kit, equipment-counter sign and task light, material correction, owner references and exact change list. Owner Blender source/export rules and tileable exceptions are recorded.'
for step in [dict(name='Pass 01',path='BASEMENT_PASS_01.md',parent='basement.card.json'),
             dict(name='References',path='references.card.json',viewer='card',parent='art-bible.card.json')]:
    if not any(s['path']==step['path'] for s in entity['steps']):
        entity['steps'].append(step)
save(registry_path,registry)
save(RUN/'delivery-summary.json',{'modified':list(map(package,changed)),'added':list(map(package,added)),
     'original_blend_unchanged':True,'references':len(references),'material_instance_families':dict(families),'ui_verification':'pending'})
print(json.dumps({'changed_existing':len(changed),'new_packages':len(added),'owner_images':len(references),'material_instances':sum(families.values()),'steps':len(entity['steps'])}))
