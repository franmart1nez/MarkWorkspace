"""Resume-safe records for the user-requested three-crop full-sculpture pass."""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageOps
import argparse
import hashlib
import json
import shutil

ROOT=Path(__file__).resolve().parents[1]
PROJECT=ROOT.parents[1]
REPO=ROOT.parents[3]
PRIVATE=REPO/'.mrmak/sculpture-colorization/jobs'
def read(p):return json.loads(p.read_text('utf-8'))
def write(p,v):
    p.parent.mkdir(parents=True,exist_ok=True)
    t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(v,indent=2)+'\n',encoding='utf-8');t.replace(p)
def sha(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def rel(p):return p.relative_to(ROOT).as_posix()
def plan_for(view):return ROOT/next(v['cropPlan'] for v in read(ROOT/'work/batch.json')['views'] if v['id']==view)

def revise():
    batch=read(ROOT/'work/batch.json')
    if batch.get('productionPass')=='v002':raise SystemExit('v002 already prepared; resume it.')
    write(ROOT/'work/batch-v001-snapshot.json',batch)
    for view in batch['views']:
        if view['id'] not in ['02','03','04']:continue
        old_path=ROOT/view['cropPlan'];old=read(old_path);plan=json.loads(json.dumps(old))
        source=Image.open(ROOT/old['sourcePreview']).convert('RGB')
        mask=Image.open(ROOT/f"work/psd-previews/{view['id']}-Mask.png").convert('L')
        assert sha(ROOT/old['sourcePsd'])==old['sourceSha256']
        boundaries=[0,1450,2450,4050];regions=[]
        for i,(top,bottom) in enumerate(zip(boundaries,boundaries[1:]),1):
            y0=max(0,top-96);y1=min(4050,bottom+96)
            bbox=mask.crop((0,y0,3240,y1)).getbbox()
            left=max(0,bbox[0]-96);right=min(3240,bbox[2]+96)
            box=(left,y0,right,y1);cid=f'C{i:02}'
            crop=ROOT/f"work/crops/source/{view['id']}-v002/{cid}.png"
            crop_mask=ROOT/f"work/crops/masks/{view['id']}-v002/{cid}.png"
            crop.parent.mkdir(parents=True,exist_ok=True);crop_mask.parent.mkdir(parents=True,exist_ok=True)
            if crop.exists() or crop_mask.exists():raise FileExistsError(crop)
            extracted=source.crop(box);extracted.save(crop);mask.crop(box).save(crop_mask)
            with Image.open(crop) as check:assert check.size==extracted.size and check.tobytes()==extracted.tobytes()
            rect={'x':left,'y':y0,'width':right-left,'height':y1-y0}
            regions.append({'id':cid,'coreRect':{'x':left,'y':top,'width':right-left,'height':bottom-top},
                'sourceRect':rect,'pasteRect':dict(rect),'overlapPixels':192,'sourceCrop':rel(crop),'sourceSha256':sha(crop),
                'mask':rel(crop_mask),'maskSha256':sha(crop_mask),'sourceMask':f"inputs/composites-psd/{view['id']}/Mask.psd",
                'selectedOutput':None,'review':'pending','stage':'source-prepared','candidates':[]})
        coverage=Image.new('L',(3240,4050));draw=ImageDraw.Draw(coverage)
        for r in regions:
            a=r['sourceRect'];draw.rectangle((a['x'],a['y'],a['x']+a['width']-1,a['y']+a['height']-1),fill=255)
        assert ImageChops.subtract(mask,coverage).getbbox() is None
        plan.update(regions=regions,requiredCropIds=[r['id'] for r in regions],coverageReviewed=True,
            allRequiredCropsReviewed=False,productionPass='v002',supersedes=rel(old_path),
            cropCountRationale='User requested about three crops for complete sculptures to improve detail. Three source regions at y1450/y2650, 192 px overlap; per-region empty side margins excluded. Focal faces remain whole.',
            coverageEvidence={'uncoveredSourceMaskPixels':0,'sourcePsdRehashedUnchanged':True})
        new=ROOT/f"work/crop-plans/{view['id']}-v002.json";write(new,plan)
        view.update(cropPlan=rel(new),previousCropPlans=[rel(old_path)],requiredCropIds=plan['requiredCropIds'],
            crops=[{'id':r['id'],'selectedOutput':None,'review':'pending','stage':'source-prepared'} for r in regions],
            allRequiredCropsReviewed=False)
    batch.update(productionPass='v002',status='generating-three-crop-pass',currentView='02',
        requiredCropCount=sum(len(v['crops']) for v in batch['views']),generatedCandidateCount=0,selectedReviewedCropCount=0,
        allViewsGeneratedCropsReviewed=False,
        generationAuthorization='User requested regeneration with about three crops for full sculptures such as 02, then continuation through following views.',
        historicalCandidates=['work/crops/colorized/02-C01-v001.png','work/crops/colorized/02-C02-v001.png'],
        nextAction='Generate/review 02 with three crops, then continue 03-15 in order.')
    write(ROOT/'work/batch.json',batch)
    m=read(ROOT/'project.json');m.update(status=batch['status'],productionPass='v002',cropCountPreference='about 3 crops for complete sculpture views; source-size/detail dependent elsewhere',nextAction=batch['nextAction'],generationAuthorization=batch['generationAuthorization'])
    for c in m['composites']:c['cropPlan']=next(v['cropPlan'] for v in batch['views'] if v['id']==c['id'])
    write(ROOT/'project.json',m)
    overview()
    print(json.dumps({'requiredCrops':batch['requiredCropCount'],'revisedViews':['02','03','04']}))

def overview():
    batch=read(ROOT/'work/batch.json');sheet=Image.new('RGB',(440*7,600*2),'#24242a')
    for i,v in enumerate(batch['views']):
        p=read(ROOT/v['cropPlan']);im=Image.open(ROOT/p['sourcePreview']).convert('RGB');d=ImageDraw.Draw(im)
        for r in p['regions']:
            a=r['sourceRect'];d.rectangle((a['x'],a['y'],a['x']+a['width']-1,a['y']+a['height']-1),outline='#ffbd40',width=8)
        thumb=ImageOps.contain(im,(430,540));x=(i%7)*440;y=(i//7)*600
        sheet.paste(thumb,(x+(440-thumb.width)//2,y+25));ImageDraw.Draw(sheet).text((x+10,y+575),f"{v['id']}: {len(p['regions'])} crops",fill='white')
    sheet.save(ROOT/'work/qa/crop-plan-v002-overview.jpg',quality=96)

def request(view,cid,revision=None,extra=None):
    p=read(plan_for(view));r=next(r for r in p['regions'] if r['id']==cid);a=r['sourceRect'];revision=revision or ('v002' if p.get('productionPass')=='v002' else 'v001')
    receipt=PRIVATE/f'mother-talzin-pass002-{view}-{cid}-{revision}.json'
    if receipt.exists():raise SystemExit(f'Existing receipt: {receipt}; inspect and resume rather than duplicate.')
    prompt=f'''Use case: precise-object-edit. High-fidelity sculpture colorization, production view {view}, crop {cid}.
Image 1 is the ONLY edit target and geometry authority: an original grayscale render crop at x{a['x']} y{a['y']} width{a['width']} height{a['height']} on a 3240x4050 canvas. Keep EXACTLY its camera, framing, shapes, facial identity, expression, fingers, anatomy, part positions, sculpted folds, embossed patterns, edges, smoke lobes, lightning branches, architectural panels and symbols. Apply color/material appearance to those exact existing surfaces, without re-sculpting, adding pattern relief, smoothing or replacing fine detail.
Image 2 is the supplied FINISHED Composite 01 of THIS SAME sculpture. It is the highest authority for palette, material finish, lighting character and contrast: vivid crimson robe/hood/armor and red leather wraps, deep burgundy recesses, pale ivory/gray face and hands with dark eye/lip makeup, lime-green and cyan luminous translucent magic with bright lime cores, pale decayed undead flesh with faded red cloth and dark straps, weathered dark teal temple stone/metal with restrained aged bronze trim. Match these materials wherever the matching existing source parts occur. Preserve the source's own light direction and relief. Keep the magic's sculpted volumes legible instead of replacing them with diffuse fog. Source side/back panels retain their own ornaments; never invent the master's front doorway, frontal mask or red beam on another side.
Images 3 and 4 are client-approved QUALITY references only: fine skin/fabric/material detail and material separation, with no palette, object, camera or geometry authority.
Return exactly one full-bleed colorized version of IMAGE 1 ALONE, with its precise {a['width']}:{a['height']} aspect ratio, no zoom or framing change. Request maximum available native resolution, quality and source-detail fidelity; make all existing small details crisp, without inventing new ones. Retain the PURE BLACK source background and every original negative space. Do not copy the master's frontal composition, teal backdrop, logo, typography or labels. Do not invent additional smoke, lightning, limbs, fabric, props or ornament. No comparison collage, border, text or watermark. Keep boundary landmarks and the 192-pixel source overlap context stable for joining adjacent crops. No later manual color or lighting correction is planned.'''
    if extra:prompt+='\nCritical crop-specific requirement: '+extra
    prompt_path=ROOT/f'work/prompts/{view}-{cid}-{revision}.txt';prompt_path.write_text(prompt+'\n',encoding='utf-8')
    args={'prompt':prompt,'referenced_image_paths':[str((ROOT/r['sourceCrop']).resolve()),str((ROOT/p['appearanceMaster']['file']).resolve()),
        str((PROJECT/'shared/approved-client-work/Phantom of the Opera (3).png').resolve()),str((PROJECT/'shared/approved-client-work/Exogorth Diorama (13).png').resolve())],
        'transparent_background':False}
    write(receipt,{'status':'prepared-for-submission','view':view,'crop':cid,'plan':rel(plan_for(view)),'revision':revision,
        'arguments':args,'prompt':rel(prompt_path),'sourceSha256':r['sourceSha256'],'referenceHashes':[p['appearanceMaster']['sha256'],*[x['sha256'] for x in p['qualityReferences']]],
        'requestedModel':'gpt-image-2.6-sunburst','requestedQuality':'max','actualModel':'not exposed','actualQuality':'not exposed'})
    print(json.dumps({'arguments':args,'receipt':str(receipt),'view':view,'crop':cid,'revision':revision,'source':str(ROOT/r['sourceCrop'])}))

def record(view,cid,native):
    pending=[p for p in PRIVATE.glob(f'mother-talzin-pass002-{view}-{cid}-*.json') if read(p)['status']!='completed']
    if len(pending)!=1:raise ValueError('Expected exactly one unresolved receipt; inspect before recording.')
    receipt=pending[0];job=read(receipt)
    if job['status']=='completed':raise SystemExit('Already recorded; do not duplicate.')
    native=Path(native).resolve(strict=True)
    assert native.is_relative_to(Path('C:/Users/franc/.codex/generated_images').resolve())
    destination=ROOT/f"work/crops/colorized/{view}-{cid}-{job['revision']}.png"
    if destination.exists():raise FileExistsError(destination)
    shutil.copy2(native,destination)
    with Image.open(destination) as im:dimensions=list(im.size)
    candidate={'file':rel(destination),'sha256':sha(destination),'nativeDimensions':dimensions,'tool':'image_gen.imagegen',
        'prompt':job['prompt'],'requestedModel':job['requestedModel'],'requestedQuality':'max','actualModel':'not exposed','actualQuality':'not exposed','review':'pending'}
    job.update(status='completed',nativePath=str(native),savedPath=str(destination),nativeDimensions=dimensions);write(receipt,job)
    path=plan_for(view);p=read(path);r=next(x for x in p['regions'] if x['id']==cid)
    r.setdefault('candidates',[]).append(candidate);r.update(stage='generated-candidate',review='pending');write(path,p)
    b=read(ROOT/'work/batch.json');v=next(v for v in b['views'] if v['id']==view);c=next(c for c in v['crops'] if c['id']==cid)
    c.update(stage='generated-candidate',review='pending',candidates=[candidate['file']]);b['currentView']=view
    b['generatedCandidateCount']=sum(bool(c.get('candidates')) for v in b['views'] for c in v['crops']);write(ROOT/'work/batch.json',b)
    print(json.dumps({'saved':str(destination),'nativeDimensions':dimensions,'generated':b['generatedCandidateCount'],'required':b['requiredCropCount']}))

def evidence(view):
    p=read(plan_for(view));regions=p['regions'];sheet=Image.new('RGB',(1200,700*len(regions)),'#24242a');normalized=[]
    for i,r in enumerate(regions):
        source=Image.open(ROOT/r['sourceCrop']).convert('RGB');candidate=r['candidates'][-1];output=Image.open(ROOT/candidate['file']).convert('RGB')
        # Review mapping only: original native output is retained, no montage is written.
        mapped=output.resize(source.size,Image.Resampling.LANCZOS);normalized.append(mapped)
        for col,im in enumerate([source,output]):
            thumb=ImageOps.contain(im,(584,650));sheet.paste(thumb,(col*600+(600-thumb.width)//2,i*700+30))
        d=ImageDraw.Draw(sheet);d.text((12,i*700+8),f"{view} {r['id']} source",fill='white');d.text((612,i*700+8),f"generated {candidate['nativeDimensions']}",fill='white')
    qa=ROOT/f'work/qa/{view}-pass002-comparison.jpg';sheet.save(qa,quality=97)
    overlaps=[]
    for i in range(len(regions)-1):
        a,b=regions[i]['sourceRect'],regions[i+1]['sourceRect'];x=max(a['x'],b['x']);y=max(a['y'],b['y']);ex=min(a['x']+a['width'],b['x']+b['width']);ey=min(a['y']+a['height'],b['y']+b['height'])
        for j,r0 in [(i,a),(i+1,b)]:overlaps.append(normalized[j].crop((x-r0['x'],y-r0['y'],ex-r0['x'],ey-r0['y'])))
    overlap_path=None
    if overlaps:
        strip=Image.new('RGB',(1400,210*len(overlaps)),'#24242a')
        for i,im in enumerate(overlaps):
            thumb=ImageOps.contain(im,(1380,180));strip.paste(thumb,(10,210*i+25));ImageDraw.Draw(strip).text((10,210*i+5),f'Overlap {i//2+1}, candidate {i%2+1}; separate review strip',fill='white')
        overlap_path=ROOT/f'work/qa/{view}-pass002-overlaps.jpg';strip.save(overlap_path,quality=97)
    print(json.dumps({'comparison':str(qa),'overlaps':str(overlap_path) if overlap_path else None}))

def review(view,decision,notes):
    path=plan_for(view);p=read(path)
    for r in p['regions']:
        candidate=r['candidates'][-1];candidate.update(review=decision,reviewNotes=notes,reviewEvidence=f'work/qa/{view}-pass002-comparison.jpg')
        r.update(selectedOutput=candidate['file'] if decision=='agent-pass' else None,review=decision,stage='reviewed' if decision=='agent-pass' else 'needs-revision')
    p['allRequiredCropsReviewed']=decision=='agent-pass';p['adjacentCropReview']=notes;write(path,p)
    b=read(ROOT/'work/batch.json');v=next(v for v in b['views'] if v['id']==view)
    for c,r in zip(v['crops'],p['regions']):c.update(selectedOutput=r['selectedOutput'],review=decision,stage=r['stage'])
    v['allRequiredCropsReviewed']=p['allRequiredCropsReviewed'];b['selectedReviewedCropCount']=sum(c['review']=='agent-pass' for v in b['views'] for c in v['crops'])
    b['allViewsGeneratedCropsReviewed']=all(v['allRequiredCropsReviewed'] for v in b['views']);write(ROOT/'work/batch.json',b)
    print(json.dumps({'view':view,'decision':decision,'selected':b['selectedReviewedCropCount'],'required':b['requiredCropCount'],'batchReady':b['allViewsGeneratedCropsReviewed']}))

parser=argparse.ArgumentParser();parser.add_argument('command',choices=['revise','request','record','evidence','review','status','overview']);parser.add_argument('--view');parser.add_argument('--crop');parser.add_argument('--native');parser.add_argument('--decision');parser.add_argument('--notes');parser.add_argument('--revision');parser.add_argument('--extra')
a=parser.parse_args()
if a.command=='revise':revise()
elif a.command=='request':request(a.view,a.crop,a.revision,a.extra)
elif a.command=='record':record(a.view,a.crop,a.native)
elif a.command=='evidence':evidence(a.view)
elif a.command=='review':review(a.view,a.decision,a.notes)
elif a.command=='overview':overview()
else:
    b=read(ROOT/'work/batch.json');print(json.dumps({'required':b['requiredCropCount'],'generated':b['generatedCandidateCount'],'selected':b['selectedReviewedCropCount'],'views':[{k:v[k] for k in ['id','cropPlan','allRequiredCropsReviewed']} for v in b['views']]}))
