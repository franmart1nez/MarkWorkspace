"""Versioned native Photoshop operations through the project MCP. Never retries."""
from pathlib import Path
import argparse,json,subprocess,sys,hashlib,io
from PIL import Image,ImageChops,ImageStat,ImageCms
ROOT=Path(__file__).resolve().parents[1];REPO=ROOT.parents[3]
PRIVATE=REPO/'.mrmak/sculpture-colorization/assembly';PRIVATE.mkdir(parents=True,exist_ok=True)
def read(p):return json.loads(p.read_text('utf-8-sig'))
def write(p,d):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,indent=2)+'\n',encoding='utf-8')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def config(view):
 b=read(ROOT/'work/batch.json');assert b['allViewsGeneratedCropsReviewed']
 v=next(v for v in b['views'] if v['id']==view);p=read(ROOT/v['cropPlan'])
 assert sha(ROOT/v['sourcePsd'])==v['sourceSha256']
 revision=v.get('assemblyVersion','v001');name=f'mother-talzin-{view}-colorized-{revision}'
 out=ROOT/'outputs/photoshop';out.mkdir(parents=True,exist_ok=True)
 review=ROOT/'outputs/review';review.mkdir(parents=True,exist_ok=True)
 qa=ROOT/'work/assembly';qa.mkdir(parents=True,exist_ok=True)
 return {'view':view,'name':name,'source':str(ROOT/v['sourcePsd']),'mask':str(ROOT/f'work/psd-previews/{view}-Mask.png'),
 'editable':str(out/f'{name}.psd'),'pre':str(qa/f'{name}-pre.png'),'post':str(review/f'{name}.png'),
 'audit':str(qa/f'{view}-{revision}-assembled.json'),'reopenAudit':str(qa/f'{view}-{revision}-reopened.json'),
 'passes':[{'name':n,'preview':str(ROOT/f'work/psd-previews/{view}-{n}.png')} for n in ['AO','Depth','Double','ID','Mask','Metal','Normal','Shade','Shadows','SSS','ZDocument']],
 'crops':[dict({'id':r['id'],'path':str(ROOT/r['selectedOutput']),'version':Path(r['selectedOutput']).stem.split('-')[-1],'rect':r['sourceRect']},**({'joinStart':3100} if view=='12' and r['id']=='C03' else {})) for r in p['regions']]}
def invoke(cfg):
 template=(ROOT/'work/native-assembly.jsx').read_text('utf-8');script=template.replace('ASSEMBLY_CONFIG',json.dumps(cfg))
 args=PRIVATE/f"{cfg['view']}-{cfg['operation']}.json";write(args,{'script':script})
 command=[str(REPO/'.mrmak/photoshop-mcp/venv/Scripts/python.exe'),str(REPO/'projects/sculpture-colorization/scripts/photoshop_mcp.py'),'call','photoshop_execute_jsx','--arguments-file',str(args)]
 completed=subprocess.run(command,cwd=REPO,capture_output=True,text=True)
 if not completed.stdout.strip():raise RuntimeError(completed.stderr[-3000:])
 receipt=read(Path(json.loads(completed.stdout.strip().splitlines()[-1])['receipt']))
 payload=json.loads(next(x['text'] for x in receipt['content'] if x['type']=='text'))
 if payload.get('success') and isinstance(payload.get('result'),str):payload=json.loads(payload['result'])
 write(PRIVATE/f"{cfg['view']}-{cfg['operation']}-result.json",payload)
 if not payload.get('success'):print(json.dumps(payload));raise SystemExit(1)
 print(json.dumps({'success':True,'view':cfg['view'],'stage':payload.get('stage'),'workId':payload.get('workId'),'reopenedId':payload.get('document',{}).get('id')}))
def verify(view):
 cfg=config(view);a=read(Path(cfg['audit']));r=read(Path(cfg['reopenAudit']));d=r['document']
 assert (d['width'],d['height'],d['depth'],d['mode'])==(3240,4050,'BitsPerChannelType.EIGHT','DocumentMode.RGB')
 groups={l['name']:l for l in d['layers']}
 crops=groups['COLORIZED CROPS - reviewed']['children'];passes=groups['SOURCE PASSES - original data']
 assert len(crops)==len(cfg['crops']) and all(l['userMask'] and l['userMaskEnabled'] and l['kind']=='LayerKind.SMARTOBJECT' for l in crops)
 assert not passes['visible'] and len(passes['children'])==11 and all(l['kind']=='LayerKind.SMARTOBJECT' for l in passes['children'])
 assert not groups['SOURCE COMPOSITE - unchanged']['visible']
 pre=Image.open(cfg['pre']).convert('RGB');post=Image.open(cfg['post']).convert('RGB');diff=ImageChops.difference(pre,post)
 assert diff.getbbox() is None,'Reopened render differs'
 record={'view':view,'editableDocument':str(Path(cfg['editable']).relative_to(ROOT)).replace('\\','/'),'reviewPng':str(Path(cfg['post']).relative_to(ROOT)).replace('\\','/'),
 'canvas':[3240,4050],'nativeCropLayers':len(crops),'editableEnabledCropMasks':len(crops),'hiddenSourcePassSmartObjects':11,'hiddenOriginalComposite':True,
 'sourceSilhouetteChannel':True,'diskReopenReview':'pass','reopenRenderDiffPixels':0,'reopenMaxChannelDifference':0,
 'editableBytes':Path(cfg['editable']).stat().st_size,'editableSha256':sha(Path(cfg['editable'])),'reviewPngSha256':sha(Path(cfg['post'])),
 'sourceSha256Rechecked':sha(Path(cfg['source'])),'agentVisualReview':'pending','userAcceptance':'pending','reopenedDocumentId':d['id'],
 'placementMethod':'Uniform cover fit, centered in original source rectangle; no warping or color/lighting adjustments.',
 'joinMethod':'Later crop overlays opaque earlier crop using a native linear source-overlap alpha mask intersected with unchanged source silhouette.'}
 write(Path(cfg['audit'].replace('-assembled.json','-verification.json')),record);print(json.dumps(record))
def accept(view,notes):
 cfg=config(view);p=Path(cfg['audit'].replace('-assembled.json','-verification.json'));r=read(p);assert r['diskReopenReview']=='pass';r.update(agentVisualReview='pass',visualReviewNotes=notes);write(p,r)
 b=read(ROOT/'work/batch.json');v=next(v for v in b['views'] if v['id']==view);v.update(assemblyState='saved-reopened-agent-reviewed',editableDocument=r['editableDocument'],reviewPng=r['reviewPng'],diskReopenReview='pass',assemblyVerification=str(p.relative_to(ROOT)).replace('\\','/'))
 b['assembledVerifiedViewCount']=sum(v['assemblyState']=='saved-reopened-agent-reviewed' for v in b['views']);b['status']='native-assembly-in-progress' if b['assembledVerifiedViewCount']<len(b['views']) else 'assembled-agent-reviewed-awaiting-user-acceptance';b['photoshopReadiness']='native-connected-and-verified';write(ROOT/'work/batch.json',b);print(json.dumps({'acceptedAgentReview':view,'assembledVerifiedViews':b['assembledVerifiedViewCount']}))
def delivery(view):
 cfg=config(view);cfg['operation']='delivery-export';cfg['delivery']=str(Path(cfg['post']).with_stem(Path(cfg['post']).stem+'-sRGB'));invoke(cfg)
 im=Image.open(cfg['delivery']);icc=im.info.get('icc_profile');assert icc and im.size==(3240,4050)
 profile=ImageCms.getProfileDescription(ImageCms.ImageCmsProfile(io.BytesIO(icc))).strip();assert profile=='sRGB IEC61966-2.1',profile
 proof_path=Path(cfg['audit'].replace('-assembled.json','-verification.json'));proof=read(proof_path)
 proof.update(nativeReopenedRender=proof['reviewPng'],nativeReopenedRenderSha256=proof['reviewPngSha256'],reviewPng=str(Path(cfg['delivery']).relative_to(ROOT)).replace('\\','/'),reviewPngSha256=sha(Path(cfg['delivery'])),deliveryColorProfile=profile,deliveryProfileBytes=len(icc),deliveryExport='Native Photoshop Save for Web, PNG24, embedded sRGB ICC. Export-only profile conversion from the native working profile; no document changes or grading.');write(proof_path,proof)
 b=read(ROOT/'work/batch.json');next(v for v in b['views'] if v['id']==view)['reviewPng']=proof['reviewPng'];write(ROOT/'work/batch.json',b)
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('operation',choices=['produce','assemble','save-reopen','verify','accept','close-owned','delivery']);parser.add_argument('view');parser.add_argument('--notes');a=parser.parse_args()
 if a.operation=='produce':
  cfg=config(a.view);cfg['operation']='assemble';invoke(cfg)
  cfg['operation']='save-reopen';cfg['workId']=read(Path(cfg['audit']))['workId'];invoke(cfg);verify(a.view)
 elif a.operation=='delivery':delivery(a.view)
 elif a.operation=='verify':verify(a.view)
 elif a.operation=='accept':assert a.notes;accept(a.view,a.notes)
 else:
  cfg=config(a.view);cfg['operation']=a.operation
  if a.operation=='save-reopen':cfg['workId']=read(Path(cfg['audit']))['workId']
  if a.operation=='close-owned':
   assert read(Path(cfg['audit'].replace('-assembled.json','-verification.json')))['agentVisualReview']=='pass'
   cfg['workId']=read(Path(cfg['reopenAudit']))['document']['id'];cfg['sourceId']=read(Path(cfg['audit']))['sourceId']
  invoke(cfg)
