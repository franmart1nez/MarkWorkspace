"""Reproducible, read-only source intake and direct crop extraction for this batch."""
from pathlib import Path
import hashlib
import json
import sys
from io import BytesIO
from PIL import Image, ImageCms, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT.parents[1]
sys.path.insert(0, str(PROJECT / 'scripts'))
from psd_preview import export_preview, psd_header

def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)

def relative(path):
    return path.relative_to(ROOT).as_posix()

manifest = json.loads((ROOT / 'project.json').read_text('utf-8'))
if (ROOT / 'work/crop-plans/02-v001.json').exists():
    raise SystemExit('Intake v001 already exists; do not overwrite production records.')
master = next((ROOT / 'inputs/reference-composite-01').glob('*.jpg'))
with Image.open(master) as im:
    profile = ImageCms.getProfileDescription(ImageCms.ImageCmsProfile(BytesIO(im.info['icc_profile']))).strip()
    master_record = dict(manifest['appearanceMaster'], file=relative(master), sha256=digest(master),
        preview='work/qa/master-preview.jpg', canvas={'width':im.width,'height':im.height,'bitDepth':8,'colorProfile':profile},
        intakeVerified=True)
quality = []
for name in ['Phantom of the Opera (3).png', 'Exogorth Diorama (13).png']:
    path = PROJECT / 'shared/approved-client-work' / name
    quality.append({'file':'../../shared/approved-client-work/' + name,'sha256':digest(path),
        'role':'quality-only; surface detail and material separation; never geometry or palette'})

# Horizontal boundaries keep whole faces intact. Narrow full views remove only
# empty side margins. All rectangles use original, unscaled source coordinates.
breaks = {'02':[0,2200,4050], '03':[0,2200,4050], '04':[0,2200,4050],
    '05':[0,1700,3100,4050], '06':[0,1700,3100,4050],
    '07':[0,4050], '08':[0,4050], '09':[0,4050],
    '10':[0,1500,2900,4050], '11':[0,1500,3100,4050],
    '12':[0,1500,3100,4050], '13':[0,2850,4050],
    '14':[0,1700,3100,4050], '15':[0,1700,3100,4050]}
batch = json.loads((ROOT / 'work/batch.json').read_text('utf-8'))
batch.update(appearanceMaster=master_record, views=[], assemblyQueue=list(breaks), currentView=None,
    status='source-crops-prepared', generationAuthorization='User: Comienza con la escultura de mother-talzin en sculpture-colorization',
    provider='native-chatgpt-imagegen', requestedModel='gpt-image-2.6-sunburst', requestedQuality='max',
    actualModel='not exposed', actualQuality='not exposed', separatelyBilledApi=False)
inventory = []
for view, boundaries in breaks.items():
    passes = ROOT / 'inputs/composites-psd' / view
    source = passes / 'Composite.psd'
    records = []
    for path in sorted(passes.glob('*.psd')):
        records.append({'file':relative(path),'sha256':digest(path),'bytes':path.stat().st_size,
            'header':psd_header(path),'colorProfile':'untagged; no embedded ICC'})
    preview = ROOT / 'work/psd-previews' / f'{view}-source.png'
    if not preview.exists(): export_preview(source, preview)
    for name in ['Mask','ID']:
        out = ROOT / 'work/psd-previews' / f'{view}-{name}.png'
        if not out.exists(): export_preview(passes / f'{name}.psd', out)
    with Image.open(preview) as original:
        original.load()
        left, right = 0, original.width
        if view in ['02','03','04']:
            box = original.getbbox()
            left, right = max(0,box[0]-96), min(original.width,box[2]+96)
        count = len(boundaries)-1
        rationale = (f'Native 3240 x 4050 canvas; {count} direct production crops. ' +
            ('Narrow full-view subject: remove only empty side margins, split below the robe with 192 px overlap.' if view in ['02','03','04'] else
             'One close portrait keeps the entire face and hood uninterrupted; no preliminary generation.' if count == 1 else
             'Full-width horizontal regions retain focal faces and adjacent context; 192 px overlap.'))
        regions = []
        crop_dir = ROOT / 'work/crops/source' / f'{view}-v001'
        mask_dir = ROOT / 'work/crops/masks' / f'{view}-v001'
        crop_dir.mkdir(parents=True,exist_ok=True); mask_dir.mkdir(parents=True,exist_ok=True)
        with Image.open(ROOT / 'work/psd-previews' / f'{view}-Mask.png') as mask:
            for index,(top,bottom) in enumerate(zip(boundaries,boundaries[1:]),1):
                y0,y1=max(0,top-96),min(original.height,bottom+96)
                rect={'x':left,'y':y0,'width':right-left,'height':y1-y0}
                box=(left,y0,right,y1)
                output=crop_dir / f'C{index:02}.png'
                crop=original.crop(box); crop.save(output)
                with Image.open(output) as check:
                    check.load()
                    assert check.size==crop.size and check.tobytes()==crop.tobytes()
                mask_path=mask_dir / f'C{index:02}.png'
                mask.crop(box).convert('L').save(mask_path)
                regions.append({'id':f'C{index:02}', 'coreRect':{'x':left,'y':top,'width':right-left,'height':bottom-top},
                    'sourceRect':rect,'pasteRect':dict(rect),'overlapPixels':192 if count>1 else 0,
                    'sourceCrop':relative(output),'sourceSha256':digest(output),
                    'mask':relative(mask_path),'maskSha256':digest(mask_path),'sourceMask':relative(passes/'Mask.psd'),
                    'selectedOutput':None,'review':'pending','stage':'source-prepared'})
    source_record=next(r for r in records if r['file'].endswith('/Composite.psd'))
    plan=json.loads((PROJECT/'templates/crop-plan.json').read_text('utf-8'))
    plan.update(sculptureId='mother-talzin',compositeId=view,sourcePsd=relative(source),sourceSha256=source_record['sha256'],
        sourcePreview=relative(preview),previewSha256=digest(preview),appearanceMaster=master_record,
        qualityReferences=quality,cropCountRationale=rationale,regions=regions,
        requiredCropIds=[r['id'] for r in regions],coverageReviewed=False,
        backgroundHandling='Original pure-black background preserved; omitted side margins contain no source foreground.')
    plan['canvas'].update(width=3240,height=4050,bitDepth=8,colorProfile='untagged; no embedded ICC',psdColorMode=3)
    plan['assembly']['sourceMasks']=[relative(passes/'Mask.psd'),relative(passes/'ID.psd')]
    plan_path=ROOT/'work/crop-plans'/f'{view}-v001.json'; save_json(plan_path,plan)
    batch['views'].append({'id':view,'sourcePsd':relative(source),'sourceSha256':source_record['sha256'],
        'cropPlan':relative(plan_path),'requiredCropIds':plan['requiredCropIds'],
        'crops':[{'id':r['id'],'selectedOutput':None,'review':'pending','stage':'source-prepared'} for r in regions],
        'allRequiredCropsReviewed':False,'assemblyState':'waiting-for-entire-generated-batch',
        'editableDocument':None,'diskReopenReview':'pending','userAcceptance':'pending'})
    inventory.append({'id':view,'passes':records,'preview':relative(preview),'cropCount':count})
    print(view,count,flush=True)
manifest.update(title='Mother Talzin', status='source-crops-prepared', updated='2026-11-08',appearanceMaster=master_record,
    qualityReferences=quality,composites=[{'id':v['id'],'sourcePsd':v['sourcePsd'],'cropPlan':v['cropPlan']} for v in batch['views']],
    generationAuthorization=batch['generationAuthorization'])
save_json(ROOT/'work/source-inventory-v001.json',{'sculptureId':'mother-talzin','master':master_record,'views':inventory})
save_json(ROOT/'project.json',manifest)
save_json(ROOT/'work/batch.json',batch)
print('Total crops:',sum(len(v['requiredCropIds']) for v in batch['views']),flush=True)
