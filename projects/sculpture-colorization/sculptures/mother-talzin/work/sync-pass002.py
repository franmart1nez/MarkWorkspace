"""Refresh the existing Workspace card from the production manifest, preserving historical takes."""
from pathlib import Path
from PIL import Image,ImageOps
import json,shutil
ROOT=Path(__file__).resolve().parents[1];REPO=ROOT.parents[3];PROJECT=ROOT.parents[1];CARD=REPO/'workspace/2026-11-05_sculpture-colorization'
def read(p):return json.loads(p.read_text('utf-8'))
def write(p,d):
 t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(d,indent=2)+'\n',encoding='utf-8');t.replace(p)
b=read(ROOT/'work/batch.json');existing=read(CARD/'mother-talzin.card.json');media=CARD/'media/mother-talzin';media.mkdir(exist_ok=True)
assembled=[v for v in b['views'] if v['assemblyState']=='saved-reopened-agent-reviewed']
assembly_count=len(assembled);assembly_complete=assembly_count==len(b['views'])
items=[];rejected_items=[]
for item in existing['items']:
 if item['id'] in ['mother-talzin-master','mother-talzin-sources']:items.append(item)
for v in assembled:
 proof=read(ROOT/v['assemblyVerification']);source=ROOT/v['reviewPng'];shutil.copy2(source,media/source.name)
 items.append({'id':f"mother-talzin-{v['id']}-assembled-v001",'title':f"View {v['id']} / Photoshop assembly",'status':'review','image':'media/mother-talzin/'+source.name,'alt':f"Complete colorized Mother Talzin view {v['id']} rendered from the reopened layered Photoshop document",'body':f"3240 × 4050. {proof['nativeCropLayers']} crop Smart Objects and enabled editable masks; 11 hidden source-pass Smart Objects plus the unchanged original composite. Saved PSD reopened in Photoshop; 0 changed pixels against the pre-save render. Agent visual review passed. User acceptance pending. Editable source: {v['editableDocument']}."})
overview=ROOT/'work/qa/crop-plan-v002-overview.jpg';shutil.copy2(overview,media/'crop-plan-v002.jpg')
items.append({'id':'mother-talzin-crop-plan-v002','title':'35 source crops — three per complete sculpture','status':'done','image':'media/mother-talzin/crop-plan-v002.jpg','alt':'Revised source crop boundaries for all fourteen views','body':'User-requested revision: views 02–04 now use three regions, 192 px overlaps and per-region empty-margin reduction. All source-mask foreground is covered. Other views retain size/detail-dependent plans.'})
rows=[]
for v in b['views']:
 p=read(ROOT/v['cropPlan']);generated=0;selected=0
 for r in p['regions']:
  candidates=r.get('candidates',[])
  if not candidates:continue
  for rejected in candidates:
   if rejected.get('review')!='rejected':continue
   rp=ROOT/rejected['file'];destination=media/rp.name
   if not destination.exists():shutil.copy2(rp,destination)
   revision=rp.stem.split('-')[-1]
   rejected_items.append({'id':f"mother-talzin-{v['id']}-{r['id'].lower()}-{revision}",'title':f"Rejected / View {v['id']} / {r['id']} / {revision}",'status':'idea','image':'media/mother-talzin/'+rp.name,'alt':f"Rejected colorization take for view {v['id']} crop {r['id']}",'body':rejected.get('reviewNotes','Rejected during agent review; retained for comparison.'),'prompt':(ROOT/rejected['prompt']).read_text('utf-8')})
  c=candidates[-1];generated+=1;selected+=r['review']=='agent-pass'
  source=ROOT/c['file'];destination=media/source.name
  if not destination.exists():shutil.copy2(source,destination)
  revision=source.stem.split('-')[-1]
  items.append({'id':f"mother-talzin-{v['id']}-{r['id'].lower()}-{revision}",'title':f"View {v['id']} / {r['id']} / {revision}",'status':'review',
   'image':'media/mother-talzin/'+source.name,'alt':f"Colorized production crop {r['id']} of Mother Talzin view {v['id']}",
   'body':f"Native output {c['nativeDimensions'][0]} × {c['nativeDimensions'][1]}. Agent review: {r['review']}. Source plan: {v['cropPlan']}. Assembly: {v['assemblyState']}. User acceptance pending. Actual native model/quality are not exposed.",
   'prompt':(ROOT/c['prompt']).read_text('utf-8')})
 if generated==len(p['regions']):
  for suffix,title in [('comparison','Source comparison'),('overlaps','Separate overlap strips')]:
   source=ROOT/f"work/qa/{v['id']}-pass002-{suffix}.jpg"
   if source.exists():
    shutil.copy2(source,media/source.name)
    items.append({'id':f"mother-talzin-{v['id']}-pass002-{suffix}",'title':f"View {v['id']} / {title}",'status':'review','image':'media/mother-talzin/'+source.name,
     'alt':f"{title} for Mother Talzin view {v['id']}",'body':'Agent review evidence only. This is not an assembled full view. Native Photoshop joins, saved-file verification and user acceptance remain separate.'})
 assembly_label='Saved, reopened, agent reviewed / pending user' if v in assembled else 'Pending'
 rows.append(f"| {v['id']} | {len(p['regions'])} | {generated} | {selected} | {assembly_label} |")
items.extend(rejected_items)
for item in existing['items']:
 if item['id'] in ['mother-talzin-02-c01-v001','mother-talzin-02-c02-v001','mother-talzin-02-c01-comparison','mother-talzin-02-c02-comparison','mother-talzin-02-overlap']:
  item['title']=item['title'].removeprefix('Historical / ');item['title']='Historical / '+item['title'];item['status']='idea'
  item['body']='Superseded by the user-requested three-crop pass. Retained for comparison; excluded from current batch readiness.';items.append(item)
total=b['requiredCropCount'];generated=b['generatedCandidateCount'];selected=b['selectedReviewedCropCount'];ready=b['allViewsGeneratedCropsReviewed']
summary=f'User-requested three-crop pass: {generated}/{total} crops generated and {selected}/{total} agent-selected. Views 02–04 use three crops each. {assembly_count}/14 views assembled in Photoshop, saved as editable PSDs, reopened and verified with 0 render differences. User acceptance remains pending.'
write(CARD/'mother-talzin.card.json',{'format':'mrmak-card','version':1,'template':'gallery','title':'Mother Talzin — finished views and production evidence','summary':summary,'items':items})
next_view=next((v['id'] for v in b['views'] if not v['allRequiredCropsReviewed']),None)
next_action=f'Continue generation/review at view {next_view}; finish the complete generated batch before Photoshop.' if next_view else 'Generated crop batch passed agent review. Announce readiness, inspect existing Photoshop instance, and ask user to open it only if closed.'
if ready:
 next_assembly=next((v['id'] for v in b['views'] if v not in assembled),None)
 next_action=f'Continue verified native Photoshop assembly at view {next_assembly}.' if next_assembly else 'Review all fourteen finished views with the user; user acceptance is pending. Preserve the editable PSDs, PNGs and source passes.'
b['nextAction']=next_action;b['status']='assembled-agent-reviewed-awaiting-user-acceptance' if assembly_complete else ('native-assembly-in-progress' if assembly_count else ('generated-batch-agent-reviewed' if ready else 'generating-three-crop-pass'));write(ROOT/'work/batch.json',b)
m=read(ROOT/'project.json');m.update(status=b['status'],nextAction=next_action);write(ROOT/'project.json',m)
parent=read(PROJECT/'project.json');parent.update(status=b['status'],nextAction=next_action,updated='2026-11-08');write(PROJECT/'project.json',parent)
handoff=f'''# Mother Talzin — production handoff

{summary}

Current action: **{next_action}**

Read `BRIEF.md`, `project.json`, `work/batch.json`, parent directives and generation policy before continuing. Finished Composite 01 remains the read-only appearance master. Original target PSDs control geometry and camera; all source and reference hashes are recorded.

The user requested about three crops for complete sculptures. Views 02–04 now have revised plans `work/crop-plans/<view>-v002.json`, with boundaries y1450/y2450, 192 px overlap and source-mask-based margin reduction. Earlier plans and outputs remain preserved. The remaining views keep size/detail-dependent plans, generally three crops, or one uninterrupted close portrait.

Native deliverables: `outputs/photoshop/mother-talzin-<view>-colorized-<version>.psd` and `outputs/review/mother-talzin-<view>-colorized-<version>-sRGB.png`. View 12 uses v002 after a lateral-hand geometry repair; other views use v001. Per-view native layer/mask audits, original hashes, file hashes, placement records and measured disk-reopen render differences are in `work/assembly/`. Final review PNGs are natively exported with embedded sRGB for browser display; this profile conversion is separate from the zero-difference native reopen check. The original source data is retained in hidden Smart Objects and an unchanged reference layer. Agent review does not imply user acceptance.

Actual model and quality are not exposed by native ChatGPT image generation. Private receipts are in ignored `.mrmak/sculpture-colorization/jobs/`, named `mother-talzin-pass002-*`. Inspect existing receipts before resubmitting. Resume completed generations; do not duplicate them.

Only agent-reviewed generated outputs count toward readiness. Source extraction is separate. Do not start Photoshop assembly before the entire batch passes. No application restart is authorized.
'''
(ROOT/'START_HERE.md').write_text(handoff,encoding='utf-8')
(PROJECT/'NEXT_SESSION.md').write_text('# Next session — Mother Talzin\n\n'+summary+'\n\n'+next_action+'\n\nRead the [sculpture handoff](sculptures/mother-talzin/START_HERE.md), its batch and the project directives before continuing. Preserve existing jobs, sources and all prior takes.\n',encoding='utf-8')
note=f'''# Mother Talzin — three-crop production pass

{summary}

{next_action}

The user requested regeneration with about three crops for complete sculptures to improve local detail, followed by continued production of the remaining views. Views 02–04 were replanned with three crops, per-region empty black margins excluded, and 192 source pixels of overlap. Source-mask coverage remains complete. Previous two-crop view 02 candidates and all original plans remain preserved as history.

| View | Required crops | Generated | Agent-selected | Photoshop / user acceptance |
| --- | ---: | ---: | ---: | --- |
'''+ '\n'.join(rows)+'''

Finished Composite 01 is the highest appearance master; shared approved examples guide detail quality. Original PSDs control exact geometry, camera and placement. Source previews and crops do not change those originals. Native image outputs retain their actual dimensions in each plan and gallery entry; paste dimensions are source coordinates. Requesting maximum detail does not establish a backend quality setting: the native tool exposes neither model nor quality selectors.

Full source comparisons and separate overlap strips are saved per completed view. Every completed native assembly has its own layer/mask audit and disk-reopen pixel comparison in `work/assembly/`. The PSDs retain hidden original references and eleven faithful source-pass Smart Objects, including the 16-bit depth data. Crops use uniform scale only and source-silhouette masks with editable overlap ramps. No full view was assembled outside Photoshop, and no manual color/lighting corrections were applied.

View 12 uses assembly v002. Native review exposed clipped lateral fingertips in the previous generated C03. Its source region was extended upward to exact 3:1 (3240 × 1080, y2970); regenerated C03 v002 preserves both full nails. The complete center hand remains from C02 before a 96 px architecture join. Rejected C03 and PSD v001 are retained. Final PNGs use native sRGB profile conversion with embedded ICC; native pre-save/reopened render comparisons remain separate and pixel-identical.

Native output files and exact prompts live in the sculpture's `work/crops/colorized/` and `work/prompts/`. See the [batch](../../projects/sculpture-colorization/sculptures/mother-talzin/work/batch.json) and [handoff](../../projects/sculpture-colorization/sculptures/mother-talzin/START_HERE.md). Private receipts are excluded from Git.
'''
(CARD/'MOTHER_TALZIN.md').write_text(note,encoding='utf-8')
if assembled:
 with (CARD/'MOTHER_TALZIN.md').open('a',encoding='utf-8') as f:
  f.write('\n## Native deliverables\n\nEach link opens the versioned editable source or its full-resolution review image. The original render sources remain unchanged.\n\n| View | Editable source | Review image | Reopened render |\n| --- | --- | --- | --- |\n')
  for v in assembled:
   prefix='../../projects/sculpture-colorization/sculptures/mother-talzin/'
   f.write(f"| {v['id']} | [Layered PSD]({prefix+v['editableDocument']}) | [3240 × 4050 PNG](media/mother-talzin/{Path(v['reviewPng']).name}) | 0 changed pixels |\n")
(CARD/'PROJECT.md').write_text('# Sculpture Colorization\n\n**Active: Mother Talzin.** '+summary+'\n\nOpen **Mother Talzin** for the current crops and comparisons, or [Production notes](MOTHER_TALZIN.md) for progress.\n\n'+next_action+'\n\n[Workflow](WORKFLOW.md) · [Sculptures](SCULPTURES.md) · [Photoshop connection](PHOTOSHOP_CONNECTION.md)\n',encoding='utf-8')
registry=read(REPO/'workspace/workspace.json');e=next(e for e in registry['entities'] if e['id']=='sculpture-colorization');e.update(updated='2026-11-08',description=f'Mother Talzin: {selected}/{total} agent-reviewed crops; {assembly_count}/14 layered Photoshop views saved, reopened and verified. User acceptance pending.');write(REPO/'workspace/workspace.json',registry)
print(json.dumps({'generated':generated,'selected':selected,'required':total,'galleryEntries':len(items),'nextView':next_view,'batchReady':ready}))
