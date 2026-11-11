"""Integrity checks and source-pass preparation; no color edits or montage."""
from pathlib import Path
from PIL import Image,ImageChops,ImageDraw,ImageOps
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1];PROJECT=ROOT.parents[1];REPO=ROOT.parents[3]
sys.path.insert(0,str(PROJECT/'scripts'))
from psd_preview import export_preview
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def read(p):return json.loads(p.read_text('utf-8'))
b=read(ROOT/'work/batch.json');inventory=read(ROOT/'work/source-inventory-v001.json');assert b['allViewsGeneratedCropsReviewed']
assert len(b['views'])==14 and b['selectedReviewedCropCount']==35
checked=0;pixels=0;attempts=0;rejected=0;selected=[];views=[]
for v in b['views']:
 p=read(ROOT/v['cropPlan']);assert p['allRequiredCropsReviewed'];mask=Image.open(ROOT/f"work/psd-previews/{v['id']}-Mask.png").convert('L');cover=Image.new('L',mask.size);d=ImageDraw.Draw(cover)
 for original in next(x for x in inventory['views'] if x['id']==v['id'])['passes']:
  path=ROOT/original['file'];assert sha(path)==original['sha256'];checked+=1
  # Faithful PNG source passes are embedded as hidden smart objects, including
  # grayscale/multichannel PSDs that cannot always be placed directly in RGB.
  preview=ROOT/f"work/psd-previews/{v['id']}-{path.stem}.png"
  if not preview.exists():export_preview(path,preview)
 for r in p['regions']:
  assert r['review']=='agent-pass' and r['selectedOutput'];assert sha(ROOT/r['sourceCrop'])==r['sourceSha256'];assert sha(ROOT/r['mask'])==r['maskSha256']
  c=next(c for c in r['candidates'] if c['file']==r['selectedOutput']);assert c['review']=='agent-pass' and sha(ROOT/c['file'])==c['sha256']
  with Image.open(ROOT/c['file']) as im:im.load();assert list(im.size)==c['nativeDimensions'];pixels+=im.width*im.height
  attempts+=len(r['candidates']);rejected+=sum(c.get('review')=='rejected' for c in r['candidates'])
  a=r['sourceRect'];d.rectangle((a['x'],a['y'],a['x']+a['width']-1,a['y']+a['height']-1),fill=255)
  selected.append((v['id'],r['id'],ROOT/c['file']))
 assert ImageChops.subtract(mask,cover).getbbox() is None
 views.append({'id':v['id'],'selectedCropCount':len(p['regions']),'sourceMaskUncoveredPixels':0})
assert sha(ROOT/b['appearanceMaster']['file'])==b['appearanceMaster']['sha256']
for ref in read(ROOT/'project.json')['qualityReferences']:assert sha(ROOT/ref['file'])==ref['sha256']
jobs=[read(p) for p in (REPO/'.mrmak/sculpture-colorization/jobs').glob('mother-talzin-pass002-*.json')]
assert len(jobs)==attempts and all(j['status']=='completed' for j in jobs)
sheet=Image.new('RGB',(320*7,320*5),'#24242a')
for i,(view,cid,path) in enumerate(selected):
 with Image.open(path) as im:thumb=ImageOps.contain(im.convert('RGB'),(308,284))
 x=(i%7)*320;y=(i//7)*320;sheet.paste(thumb,(x+(320-thumb.width)//2,y+8));ImageDraw.Draw(sheet).text((x+8,y+300),f'{view} {cid} / {path.stem.split("-")[-1]}',fill='white')
sheet.save(ROOT/'work/qa/selected-crops-pass002-overview.jpg',quality=96)
old=read(ROOT/'work/crop-plans/02-v001.json')['regions'][0];new=read(ROOT/'work/crop-plans/02-v002.json')['regions'][0]
old_width=old['candidates'][0]['nativeDimensions'][0]/old['sourceRect']['width'];new_width=new['candidates'][0]['nativeDimensions'][0]/new['sourceRect']['width']
result={'sourcePassesRehashedUnchanged':checked,'masterAndQualityReferencesUnchanged':True,'requiredSelectedReviewedCrops':35,'currentPassGenerationAttempts':attempts,'rejectedTakesRetained':rejected,'selectedNativePixels':pixels,
 'unresolvedNativeGenerationReceipts':0,'views':views,'view02UpperCropNativePixelsPerSourcePixel':{'previous':old_width,'current':new_width,'linearRatio':new_width/old_width},'assemblyVerified':False,'userAcceptance':'pending'}
(ROOT/'work/qa/pass002-integrity.json').write_text(json.dumps(result,indent=2)+'\n')
b.update(currentPassGenerationAttempts=attempts,rejectedTakesRetained=rejected,cropReadinessNotified=True,photoshopReadiness='connected-27.11.0-no-documents',status='ready-for-native-assembly')
(ROOT/'work/batch.json').write_text(json.dumps(b,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['sourcePassesRehashedUnchanged','requiredSelectedReviewedCrops','currentPassGenerationAttempts','rejectedTakesRetained','unresolvedNativeGenerationReceipts','view02UpperCropNativePixelsPerSourcePixel']}))
