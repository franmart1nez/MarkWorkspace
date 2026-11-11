"""Extract size-based source crops directly, without generation or Photoshop access."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import struct
from PIL import Image

PROJECT = Path(__file__).resolve().parents[1]

def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda:stream.read(1024*1024),b''):
            digest.update(chunk)
    return digest.hexdigest()

def rectangles(width, height, core_edge=2048, overlap=128):
    if min(width,height,core_edge) <= 0 or overlap < 0 or overlap >= core_edge:
        raise ValueError('Dimensions/core edge must be positive; overlap must be smaller than core edge.')
    columns, rows = math.ceil(width/core_edge), math.ceil(height/core_edge)
    before, after = overlap//2, overlap-overlap//2
    regions = []
    for row in range(rows):
        top, bottom = row*height//rows, (row+1)*height//rows
        for column in range(columns):
            left, right = column*width//columns, (column+1)*width//columns
            x, y = max(0,left-before), max(0,top-before)
            end_x, end_y = min(width,right+after), min(height,bottom+after)
            rect = {'x':x,'y':y,'width':end_x-x,'height':end_y-y}
            regions.append({'id':f'C{len(regions)+1:02}',
                'coreRect':{'x':left,'y':top,'width':right-left,'height':bottom-top},
                'sourceRect':rect,'pasteRect':dict(rect),'overlapPixels':overlap if columns*rows>1 else 0})
    return regions

def prepare(folder, view, preview, source_psd, revision='v001', core_edge=2048, overlap=128, max_crops=6, rationale=None):
    folder, preview, source_psd = folder.resolve(), preview.resolve(strict=True), source_psd.resolve(strict=True)
    if not str(view).isdigit() or int(view) <= 1:
        raise ValueError('Only remaining views are produced; Composite 01 is a supplied finished reference.')
    view = str(int(view)).zfill(2)
    if not re.fullmatch(r'v\d{3,}',revision):
        raise ValueError('Use a version such as v001.')
    manifest = json.loads((folder / 'project.json').read_text('utf-8'))
    if not preview.is_relative_to(folder) or not source_psd.is_relative_to((folder / manifest['inputs']['compositePsds']).resolve()):
        raise ValueError('Keep preview and source inside the selected sculpture inputs/work.')
    with source_psd.open('rb') as source:
        header = source.read(26)
    if len(header) != 26:
        raise ValueError('Truncated target PSD/PSB header.')
    signature, version, reserved, channels, source_height, source_width, depth, mode = struct.unpack('>4sH6sHIIHH',header)
    if signature != b'8BPS' or version not in (1,2) or reserved != bytes(6) or not channels:
        raise ValueError('Expected a real target PSD/PSB header.')
    original_hash = sha256(source_psd)
    with Image.open(preview) as image:
        image.load()
        width, height = image.size
        if (width,height) != (source_width,source_height):
            raise ValueError('Preview must match native target dimensions; resized previews cannot define paste coordinates.')
        regions = rectangles(width,height,core_edge,overlap)
        if len(regions) > max_crops:
            raise ValueError(f'Plan needs {len(regions)} crops. Increase --core-edge to reduce count, or justify higher --max-crops with --rationale.')
        if max_crops > 6 and not rationale:
            raise ValueError('A higher crop allowance needs an explicit size/detail rationale.')
        output_folder = folder / 'work/crops/source' / f'{view}-{revision}'
        plan_path = folder / 'work/crop-plans' / f'{view}-{revision}.json'
        if plan_path.exists() or output_folder.exists():
            raise FileExistsError('This plan/crop version exists; choose a new revision.')
        output_folder.mkdir(parents=True)
        profile = image.info.get('icc_profile')
        for region in regions:
            r = region['sourceRect']
            output = output_folder / f"{region['id']}.png"
            crop = image.crop((r['x'],r['y'],r['x']+r['width'],r['y']+r['height']))
            crop.save(output, **({'icc_profile':profile} if profile else {}))
            with Image.open(output) as reopened:
                reopened.load()
                if crop.mode != reopened.mode or crop.size != reopened.size or crop.tobytes() != reopened.tobytes():
                    raise ValueError('Source crop changed during PNG round trip.')
            region.update(sourceCrop=output.relative_to(folder).as_posix(),sourceSha256=sha256(output),
                mask=None,selectedOutput=None,review='pending',stage='source-prepared')
    plan = json.loads((PROJECT / 'templates/crop-plan.json').read_text('utf-8'))
    plan.update(sculptureId=manifest['id'],compositeId=view,
        sourcePsd=source_psd.relative_to(folder).as_posix(),sourceSha256=original_hash,
        sourcePreview=preview.relative_to(folder).as_posix(),previewSha256=sha256(preview),
        appearanceMaster=manifest['appearanceMaster'],regions=regions,requiredCropIds=[r['id'] for r in regions],
        cropCountRationale=rationale or f'{width} x {height}; {len(regions)} crops, maximum {core_edge}px core edge and {overlap}px context. Inspect/merge/reposition seams before generation.')
    if sha256(source_psd) != original_hash:
        raise ValueError('Source changed during preparation; inspect before proceeding.')
    # Profile is recorded during intake, never inferred from an untagged display PNG.
    plan['canvas'].update(width=width,height=height,bitDepth=depth,psdColorMode=mode)
    plan_path.parent.mkdir(parents=True,exist_ok=True)
    with plan_path.open('x',encoding='utf-8') as stream:
        json.dump(plan,stream,indent=2)
        stream.write('\n')
    return {'plan':str(plan_path),'sourceCropCount':len(regions),'generationSubmitted':False,
        'coverageReviewed':False,'nextAction':'Inspect source fidelity, coverage and seams; then generate/review the entire target batch.'}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sculpture',type=Path,required=True)
    parser.add_argument('--view',required=True)
    parser.add_argument('--preview',type=Path,required=True,help='Source-size faithful preview, never a generated draft.')
    parser.add_argument('--source-psd',type=Path,required=True)
    parser.add_argument('--revision',default='v001')
    parser.add_argument('--core-edge',type=int,default=2048)
    parser.add_argument('--overlap',type=int,default=128)
    parser.add_argument('--max-crops',type=int,default=6)
    parser.add_argument('--rationale')
    args = parser.parse_args()
    print(json.dumps(prepare(args.sculpture,args.view,args.preview,args.source_psd,args.revision,
        args.core_edge,args.overlap,args.max_crops,args.rationale),indent=2))

if __name__ == '__main__':
    try:
        main()
    except (OSError,ValueError,KeyError) as error:
        raise SystemExit(str(error)) from None
