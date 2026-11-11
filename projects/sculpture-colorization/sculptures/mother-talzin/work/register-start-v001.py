"""Register the completed intake and initial generated candidates without claiming batch approval."""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw
import hashlib
import json
import shutil

ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parents[3]
PROJECT=ROOT.parents[1]
CARD=REPO/'workspace/2026-11-05_sculpture-colorization'
def read(p): return json.loads(p.read_text('utf-8'))
def write(p,d):
    t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(d,indent=2)+'\n',encoding='utf-8');t.replace(p)
def digest(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()

inventory=read(ROOT/'work/source-inventory-v001.json')
checked=0
for view in inventory['views']:
    for source in view['passes']:
        assert digest(ROOT/source['file'])==source['sha256'],source['file']
        checked+=1
assert digest(ROOT/inventory['master']['file'])==inventory['master']['sha256']
coverage=[]
for p in sorted((ROOT/'work/crop-plans').glob('*-v001.json')):
    plan=read(p);view=plan['compositeId']
    source_mask=Image.open(ROOT/f'work/psd-previews/{view}-Mask.png').convert('L')
    covered=Image.new('L',source_mask.size);draw=ImageDraw.Draw(covered)
    for reg in plan['regions']:
        r=reg['sourceRect'];draw.rectangle((r['x'],r['y'],r['x']+r['width']-1,r['y']+r['height']-1),fill=255)
        assert digest(ROOT/reg['sourceCrop'])==reg['sourceSha256']
        assert digest(ROOT/reg['mask'])==reg['maskSha256']
    uncovered=ImageChops.subtract(source_mask,covered)
    assert uncovered.getbbox() is None,view
    plan['coverageReviewed']=True
    plan['coverageEvidence']={'overview':'work/qa/crop-plan-overview.jpg','uncoveredSourceMaskPixels':0,
        'checks':'Source-mask coverage and crop/mask hashes verified; seams reviewed on overview.'}
    if view=='02':
        for region in plan['regions']:
            output=ROOT/f"work/crops/colorized/02-{region['id']}-v001.png"
            with Image.open(output) as image:size=list(image.size)
            region.update(stage='generated-candidate',review='initial-visual-review; final-selection-pending',
                candidates=[{'file':output.relative_to(ROOT).as_posix(),'sha256':digest(output),'nativeDimensions':size,
                    'prompt':f"work/prompts/02-{region['id']}-v001.txt",'requestedModel':'gpt-image-2.6-sunburst',
                    'requestedQuality':'max','actualModel':'not exposed','actualQuality':'not exposed',
                    'tool':'image_gen.imagegen','reviewEvidence':f"work/qa/02-{region['id']}-comparison.jpg"}])
    write(p,plan);coverage.append({'view':view,'uncoveredSourceMaskPixels':0,'cropCount':len(plan['regions'])})
batch=read(ROOT/'work/batch.json');batch['status']='crop-generation-started';batch['currentView']='02'
batch['generatedCandidateCount']=2;batch['selectedReviewedCropCount']=0;batch['requiredCropCount']=32
batch['nextAction']='Complete fine-detail and overlap review of 02 C01/C02; select or revise candidates, then continue direct crop generation for 03-15.'
for view in batch['views']:
    view['coverageReviewed']=True
    if view['id']=='02':
        for crop in view['crops']:
            crop.update(stage='generated-candidate',review='initial-visual-review; final-selection-pending',
                candidates=[f"work/crops/colorized/02-{crop['id']}-v001.png"])
write(ROOT/'work/batch.json',batch)
manifest=read(ROOT/'project.json');manifest['status']='crop-generation-started';manifest['nextAction']=batch['nextAction'];write(ROOT/'project.json',manifest)
parent=read(PROJECT/'project.json');parent.update(status='crop-generation-started',nextAction='review-mother-talzin-02-candidates-and-continue-crop-batch',updated='2026-11-08');write(PROJECT/'project.json',parent)
write(ROOT/'work/qa/intake-verification-v001.json',{'originalSourcePassesRehashedUnchanged':checked,
    'masterRehashedUnchanged':True,'coverage':coverage,'generatedCandidates':2,'selectedReviewedCrops':0,
    'allViewsGeneratedCropsReviewed':False,'photoshopUsed':False})

media=CARD/'media/mother-talzin';media.mkdir(parents=True,exist_ok=True)
files={
 'master.jpg':'work/qa/master-preview.jpg',
 'sources.jpg':'work/qa/target-overview.jpg',
 'crop-plan.jpg':'work/qa/crop-plan-overview.jpg',
 '02-C01-v001.png':'work/crops/colorized/02-C01-v001.png',
 '02-C02-v001.png':'work/crops/colorized/02-C02-v001.png',
 '02-C01-comparison.jpg':'work/qa/02-C01-comparison.jpg',
 '02-C02-comparison.jpg':'work/qa/02-C02-comparison.jpg',
 '02-overlap.jpg':'work/qa/02-overlap-comparison.jpg'}
for destination,source in files.items():shutil.copy2(ROOT/source,media/destination)
items=[
 {'id':'mother-talzin-master','title':'Supplied finished Composite 01','status':'done','image':'media/mother-talzin/master.jpg',
  'alt':'Finished Mother Talzin reference with red robe, pale skin, green energy and teal temple base',
  'body':'Read-only appearance master, visually inspected and SHA-256 recorded. Original: 3240 × 4050, RGB 8-bit, embedded sRGB IEC61966-2.1. This gallery image is a display preview.'},
 {'id':'mother-talzin-sources','title':'14 original target views: 02–15','status':'done','image':'media/mother-talzin/sources.jpg',
  'alt':'Contact sheet of the fourteen original grayscale sculpture views',
  'body':'Each view is 3240 × 4050, RGB 8-bit without embedded ICC. All 168 supplied PSD passes were inventoried and rehashed unchanged. Original geometry, camera and part placement remain authoritative.'},
 {'id':'mother-talzin-crop-plan','title':'32 direct source crops','status':'done','image':'media/mother-talzin/crop-plan.jpg',
  'alt':'Crop boundaries on each original view, with uninterrupted close portraits',
  'body':'Exact source/paste coordinates, 192 px overlaps where applicable and source-derived masks are saved. All source-mask foreground is covered. Source extraction is complete; generated batch review is pending.'}]
for cid in ['C01','C02']:
    items.append({'id':f'mother-talzin-02-{cid.lower()}-v001','title':f'View 02 / {cid} / candidate v001','status':'review',
      'image':f'media/mother-talzin/02-{cid}-v001.png','alt':f'First colorized candidate for view 02 crop {cid}',
      'body':'Native ChatGPT generation. Initial visual review: crimson cloth, pale skin, green/cyan magic and teal/bronze base follow the master. Final selection awaits overlap and fine sculpted-detail review. No Photoshop montage or user acceptance is recorded.',
      'prompt':(ROOT/f'work/prompts/02-{cid}-v001.txt').read_text('utf-8')})
    items.append({'id':f'mother-talzin-02-{cid.lower()}-comparison','title':f'View 02 / {cid} / source comparison','status':'review',
      'image':f'media/mother-talzin/02-{cid}-comparison.jpg','alt':f'Original source and generated {cid} candidate side by side',
      'body':'Review evidence only. Sources and candidates remain separately editable; this comparison is not an assembled deliverable.'})
items.append({'id':'mother-talzin-02-overlap','title':'View 02 / 192 px overlap review','status':'review',
    'image':'media/mother-talzin/02-overlap.jpg','alt':'Separate strips showing the shared source region in both generated candidates',
    'body':'Compare the boot and smoke landmarks and local texture continuity before selecting a take. These are separate review strips, not a stitched composite. Manual color/lighting correction is excluded from montage.'})
write(CARD/'mother-talzin.card.json',{'format':'mrmak-card','version':1,'template':'gallery','title':'Mother Talzin — production start',
    'summary':'14 target views inventoried; 32 source crops and masks prepared. The first 2 generated candidates are saved for review. 30 crops remain ungenerated; none is marked finally selected. Photoshop assembly waits for the entire reviewed batch.',
    'items':items})
references=read(CARD/'references.card.json')
references['summary']='Mother Talzin is active. Its supplied finished Composite 01 is the highest appearance reference; shared approved examples guide material and detail quality.'
for item in references['items']:
    if item['id']=='composite01-approved-master':item.update(status='done',image='media/mother-talzin/master.jpg',alt='Supplied finished Mother Talzin Composite 01',body='Selected and visually inspected for Mother Talzin; original hash, canvas and sRGB profile recorded in its manifest. The original remains read-only.')
    if item['id']=='target-source-geometry':item.update(status='done',image='media/mother-talzin/sources.jpg',alt='Fourteen original Mother Talzin target views',body='Views 02–15 and all 168 PSD passes inventoried. Each target controls its own geometry and camera. 32 direct source crops are prepared; generation and selection are separate stages.')
write(CARD/'references.card.json',references)
registry=read(REPO/'workspace/workspace.json');entity=next(e for e in registry['entities'] if e['id']=='sculpture-colorization')
for step in [{'name':'Mother Talzin','path':'mother-talzin.card.json','viewer':'card'}, {'name':'Production notes','path':'MOTHER_TALZIN.md'}]:
    if not any(s['path']==step['path'] for s in entity['steps']):entity['steps'].append(step)
entity.update(updated='2026-11-08',description='Mother Talzin: 14 target views, 32 direct crop plans and the first 2 generated candidates under review; sequential Photoshop montage follows batch approval.')
write(REPO/'workspace/workspace.json',registry)
print(json.dumps({'sourcePassesUnchanged':checked,'targetViews':14,'sourceCrops':32,'generatedCandidates':2,'selectedCrops':0,'workspaceGallery':str(CARD/'mother-talzin.card.json')}))
