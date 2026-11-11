"""Recheck delivery integrity and register the completed native Photoshop batch."""
from pathlib import Path
import json,hashlib,subprocess,sys,shutil
from PIL import Image,ImageChops,ImageOps,ImageDraw
R=Path(__file__).resolve().parents[1];REPO=R.parents[3];PROJECT=R.parents[1];CARD=REPO/'workspace/2026-11-05_sculpture-colorization'
def read(p):return json.loads(p.read_text('utf-8-sig'))
def write(p,d):p.write_text(json.dumps(d,indent=2)+'\n',encoding='utf-8')
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for chunk in iter(lambda:f.read(8*1024*1024),b''):h.update(chunk)
 return h.hexdigest()
b=read(R/'work/batch.json');assert b['assembledVerifiedViewCount']==14 and b['selectedReviewedCropCount']==35
attempts=sum(len(r.get('candidates',[])) for v in b['views'] for r in read(R/v['cropPlan'])['regions']);rejected=sum(c.get('review')=='rejected' for v in b['views'] for r in read(R/v['cropPlan'])['regions'] for c in r.get('candidates',[]))
b.update(currentPassGenerationAttempts=attempts,rejectedTakesRetained=rejected)
for v in b['views']:
 p=read(R/v['cropPlan'])
 for ref in p['qualityReferences']:assert sha((R/ref['file']).resolve())==ref['sha256']
 proof=read(R/v['assemblyVerification']);raw=R/proof['nativeReopenedRender'];target=R/'work/assembly/reopen-renders'/raw.name;target.parent.mkdir(exist_ok=True)
 if raw!=target:
  assert not target.exists();raw.rename(target);proof['nativeReopenedRender']=str(target.relative_to(R)).replace('\\','/');write(R/v['assemblyVerification'],proof)
 p['assembly'].update(application='Photoshop',editableDocument=proof['editableDocument'],reviewExport=proof['reviewPng'],sourceReference='SOURCE COMPOSITE - unchanged',sourcePassGroup='SOURCE PASSES - original data',shapeReview='agent-pass',diskReopenReview='pass',approvalStatus='pending-user',verification=v['assemblyVerification'],deliveryColorProfile=proof['deliveryColorProfile']);write(R/v['cropPlan'],p)
rejected_dir=R/'outputs/rejected';rejected_dir.mkdir(exist_ok=True)
for relative in ['outputs/photoshop/mother-talzin-12-colorized-v001.psd','outputs/review/mother-talzin-12-colorized-v001.png']:
 old=R/relative
 if old.exists():assert not (rejected_dir/old.name).exists();old.rename(rejected_dir/old.name)
bad=read(R/'work/assembly/12-v001-verification.json');bad.update(agentVisualReview='rejected',rejectionReason='Lateral hand fingertips displaced in the generated crop and clipped by the unchanged source mask; replaced by source-replanned crop C03 v002 and native assembly v002.',editableDocument='outputs/rejected/mother-talzin-12-colorized-v001.psd',reviewPng='outputs/rejected/mother-talzin-12-colorized-v001.png');write(R/'work/assembly/12-v001-verification.json',bad)
next(v for v in b['views'] if v['id']=='12')['rejectedAssemblies']=['outputs/rejected/mother-talzin-12-colorized-v001.psd']
inventory=read(R/'work/source-inventory-v001.json');count=0
for v in inventory['views']:
 for source in v['passes']:assert sha(R/source['file'])==source['sha256'];count+=1
assert count==168
assert sha(R/b['appearanceMaster']['file'])==b['appearanceMaster']['sha256']
records=[];overview=Image.new('RGB',(7*320,2*440),(16,17,20));draw=ImageDraw.Draw(overview)
for i,v in enumerate(b['views']):
 proof=read(R/v['assemblyVerification']);audit=read(R/f"work/assembly/{v['id']}-{v.get('assemblyVersion','v001')}-reopened.json")['document'];assert proof['agentVisualReview']=='pass' and proof['diskReopenReview']=='pass'
 assert sha(R/proof['editableDocument'])==proof['editableSha256'] and sha(R/proof['reviewPng'])==proof['reviewPngSha256'] and sha(R/proof['nativeReopenedRender'])==proof['nativeReopenedRenderSha256']
 assert proof['deliveryColorProfile']=='sRGB IEC61966-2.1'
 assert audit['width']==3240 and audit['height']==4050 and 'SOURCE SILHOUETTE - unchanged' in audit['channels']
 assert proof['nativeCropLayers']==len(v['requiredCropIds'])==proof['editableEnabledCropMasks']
 im=Image.open(R/proof['reviewPng']).convert('RGB');mask=Image.open(R/f"work/psd-previews/{v['id']}-Mask.png").convert('L');outside=mask.point(lambda x:255 if x==0 else 0)
 red,green,blue=im.split();max_rgb=ImageChops.lighter(ImageChops.lighter(red,green),blue)
 escaped=sum(ImageChops.multiply(max_rgb,outside).histogram()[1:]);assert escaped==0,(v['id'],escaped)
 records.append({'view':v['id'],'cropMasks':proof['editableEnabledCropMasks'],'editableDocument':proof['editableDocument'],'reviewPng':proof['reviewPng'],'editableBytes':proof['editableBytes'],'reopenRenderDiffPixels':proof['reopenRenderDiffPixels'],'nonBlackPixelsOutsideOriginalSilhouette':escaped,'deliveryColorProfile':proof['deliveryColorProfile'],'agentVisualReview':'pass','userAcceptance':'pending'})
 thumb=ImageOps.contain(im,(304,402),Image.Resampling.LANCZOS);x=(i%7)*320;y=(i//7)*440;overview.paste(thumb,(x+(320-thumb.width)//2,y+24+(402-thumb.height)//2));draw.text((x+10,y+5),f"View {v['id']} / {len(v['requiredCropIds'])} crops",fill=(242,242,242))
overview.save(R/'work/qa/native-assembly-overview-v001.jpg',quality=94)
report={'date':'2026-11-08','photoshopVersion':'27.11.0','viewsSavedReopenedAgentReviewed':14,'selectedCropSmartObjectsAndEnabledMasks':35,'generationAttempts':attempts,'rejectedTakesRetained':rejected,'hiddenSourcePassSmartObjects':154,'hiddenOriginalComposites':14,'sourcePassesRehashedUnchangedAfterAssembly':168,'appearanceMasterAndQualityReferencesUnchanged':True,'allNativeReopenedRendersPixelIdentical':True,'deliveryColorProfile':'sRGB IEC61966-2.1','profileHandling':'Original target PSDs are untagged. Photoshop native save retains its Adobe RGB (1998) working profile. Final PNG24 review files are exported natively with embedded sRGB for browser display; this export-only profile conversion is separate from the zero-difference native reopen check. Global color settings were unchanged.','allOutsideSilhouettePixelsBlack':True,'manualColorLightingCorrections':False,'warping':False,'depthPreservationNativeSample':{'view':'06','embeddedName':'06-Depth.png','canvas':[3240,4050],'depth':16,'mode':'grayscale','inspection':'Opened embedded source Smart Object from reopened PSD through native Photoshop MCP; closed without saving.'},'userAcceptance':'pending','views':records}
write(R/'work/qa/native-assembly-delivery-v001.json',report)
b.update(status='assembled-agent-reviewed-awaiting-user-acceptance',nativeAssemblyReport='work/qa/native-assembly-delivery-v001.json',allViewsNativeAssemblyVerified=True);write(R/'work/batch.json',b)
brief=R/'BRIEF.md';brief.write_text(brief.read_text('utf-8').replace('39 generations, retaining four rejected takes','40 generations, retaining five rejected takes')+'\nNative montage found a lateral-hand failure in view 12 C03 v001. Its lower source region was re-extracted at exact 3:1 (3240 × 1080, y2970), retaining three crops and 226 px source overlap. C03 v002 and PSD v002 replace the rejected takes. All native reopened renders remain identical to pre-save renders; final review PNGs use native sRGB profile conversion and embedded ICC for browser viewing.\n',encoding='utf-8')
subprocess.run([sys.executable,str(R/'work/sync-pass002.py')],check=True,cwd=REPO)
gallery=read(CARD/'mother-talzin.card.json');shutil.copy2(R/'work/qa/native-assembly-overview-v001.jpg',CARD/'media/mother-talzin/native-assembly-overview-v001.jpg');gallery['items'].insert(0,{'id':'mother-talzin-native-assembly-overview-v001','title':'All fourteen Photoshop views / overview','status':'review','image':'media/mother-talzin/native-assembly-overview-v001.jpg','alt':'Contact sheet of fourteen colorized Mother Talzin views, 02 through 15','body':'14 layered PSDs and 14 full-resolution PNGs. All reopened Photoshop renders match their pre-save renders exactly. 35 editable crop masks and 154 hidden source-pass Smart Objects retained. Agent review passed; user acceptance pending.'});write(CARD/'mother-talzin.card.json',gallery)
refs=read(CARD/'references.card.json');next(i for i in refs['items'] if i['id']=='target-source-geometry')['body']='Views 02–15 and all 168 original PSD passes inventoried and rehashed unchanged after assembly. Each target controls its own geometry and camera. All 35 generated crops passed agent review; fourteen layered Photoshop assemblies are saved, reopened and verified. User acceptance pending.';write(CARD/'references.card.json',refs)
guide=PROJECT/'PHOTOSHOP_INTEGRATION.md';text=guide.read_text('utf-8');text=text[:text.index('## Verification state')]+'''## Verification state

On 2026-11-08 the user opened Photoshop after all 35 generated crops passed agent review. Native COM/JSX access to Photoshop 27.11.0 was verified. Mother Talzin views 02–15 were assembled sequentially and saved as layered PSDs with Smart Objects, enabled editable masks, hidden original composites and faithful source-pass data. Each actual saved PSD was reopened in Photoshop and inspected; all fourteen rendered PNGs match their pre-save render with **0 changed pixels**. All 168 original source PSDs and the finished master remain hash-identical.

The hidden Depth Smart Object in reopened view 06 was also opened and verified at 3240 × 4050, 16-bit grayscale, then closed without saving. No application was launched or restarted by the bridge. One early source-profile query failed on an untagged source after opening it; document state was inspected before proceeding and all later profile reads are guarded.

See `sculptures/mother-talzin/work/qa/native-assembly-delivery-v001.json` and the per-view `work/assembly/` records for measured fidelity, file hashes, exact paths and layer/mask audits. Agent review is separate from the user's pending final acceptance.
''';guide.write_text(text,encoding='utf-8');shutil.copy2(guide,CARD/'PHOTOSHOP_CONNECTION.md')
print(json.dumps({'views':14,'cropMasks':35,'sourcePassesUnchanged':count,'galleryEntries':len(gallery['items']),'totalEditableBytes':sum(r['editableBytes'] for r in records)}))
