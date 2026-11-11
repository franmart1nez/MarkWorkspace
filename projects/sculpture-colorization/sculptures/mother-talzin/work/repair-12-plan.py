"""Keep view 12's three crops; re-extract its lower crop at the native 3:1 ratio."""
from pathlib import Path
from PIL import Image
import json,hashlib,shutil
R=Path(__file__).resolve().parents[1];REPO=R.parents[3]
def read(p):return json.loads(p.read_text('utf-8'))
def write(p,d):p.write_text(json.dumps(d,indent=2)+'\n',encoding='utf-8')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
b=read(R/'work/batch.json');v=next(v for v in b['views'] if v['id']=='12');assert v['cropPlan']=='work/crop-plans/12-v001.json'
p=read(R/v['cropPlan']);r=p['regions'][2]
r['candidates'][0].update(review='rejected',reviewNotes='Native source-silhouette montage exposed displaced/shortened lateral hand fingertips. Actual native aspect differed by 3.203% from the source crop. Retained with rejected PSD v001 and native hand detail evidence; do not use.')
for folder in ['source','masks']:(R/f'work/crops/{folder}/12-v002').mkdir(parents=True,exist_ok=True)
source=R/'work/crops/source/12-v002/C03.png';mask=R/'work/crops/masks/12-v002/C03.png';assert not source.exists()
Image.open(R/'work/psd-previews/12-source.png').crop((0,2970,3240,4050)).save(source)
Image.open(R/'work/psd-previews/12-Mask.png').crop((0,2970,3240,4050)).save(mask)
r.update(sourceRect={'x':0,'y':2970,'width':3240,'height':1080},pasteRect={'x':0,'y':2970,'width':3240,'height':1080},overlapPixels=226,sourceCrop=str(source.relative_to(R)).replace('\\','/'),sourceSha256=sha(source),mask=str(mask.relative_to(R)).replace('\\','/'),maskSha256=sha(mask),selectedOutput=None,review='pending',stage='source-prepared')
p.update(allRequiredCropsReviewed=False,supersedes='work/crop-plans/12-v001.json',cropCountRationale='Retain three regions. Lower crop extended 34 px upward to 3240x1080, exactly 3:1, after native output aspect and lateral hand failure; now 226 px overlap. Complete center hand remains from C02 through y3100.');write(R/'work/crop-plans/12-v002.json',p)
v.update(cropPlan='work/crop-plans/12-v002.json',previousCropPlans=['work/crop-plans/12-v001.json'],allRequiredCropsReviewed=False,assemblyVersion='v002',assemblyState='regenerating-failed-lower-crop',rejectedAssemblies=['outputs/photoshop/mother-talzin-12-colorized-v001.psd'])
v['crops'][2].update(selectedOutput=None,review='pending',stage='source-prepared')
b.update(allViewsGeneratedCropsReviewed=False,selectedReviewedCropCount=34,status='repairing-native-geometry-failure');write(R/'work/batch.json',b)
m=read(R/'project.json');next(x for x in m['composites'] if x['id']=='12')['cropPlan']=v['cropPlan'];write(R/'project.json',m)
receipt=REPO/'.mrmak/sculpture-colorization/jobs/mother-talzin-pass002-12-C03-v002.json';drafts=receipt.parent/'drafts';drafts.mkdir(exist_ok=True)
d=read(receipt);d.update(status='cancelled-before-submission',reason='Crop source replanned to exact 3:1 before any image tool call.');write(receipt,d);shutil.move(str(receipt),str(drafts/receipt.name))
print('View 12 replanned; unsubmitted draft retained; no new generation submitted.')
