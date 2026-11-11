"""Create, select and inspect sculptures using a supplied finished Composite 01."""
import argparse
from datetime import date
import json
from pathlib import Path
import re
import unicodedata

REPO = Path(__file__).resolve().parents[3]
PROJECT = Path(__file__).resolve().parents[1]
SETTINGS = REPO / '.mrmak/sculpture-colorization/settings.json'
INDEX = REPO / 'workspace/2026-11-05_sculpture-colorization/SCULPTURES.md'
FOLDERS = ('inputs/reference-composite-01', 'inputs/composites-psd',
    'work/psd-previews', 'work/crop-plans', 'work/crops/source',
    'work/crops/colorized', 'work/crops/masks', 'work/qa',
    'outputs/photoshop', 'outputs/review', 'outputs/approved', 'outputs/exports')
IMAGE_SUFFIXES = {'.png', '.jpg', '.jpeg', '.webp', '.avif', '.tif', '.tiff', '.bmp'}

def write_new(path, content):
    with path.open('x', encoding='utf-8', newline='\n') as stream:
        stream.write(content)

def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)

def slug_for(name):
    if not name.strip() or any(c in name for c in '/\\\x00\r\n'):
        raise ValueError('Enter a sculpture name without directory separators.')
    ascii_name = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode()
    slug = re.sub(r'[^a-z0-9]+', '-', ascii_name.lower()).strip('-')
    reserved = {'con','prn','aux','nul',*(f'com{i}' for i in range(1,10)),*(f'lpt{i}' for i in range(1,10))}
    if not slug or len(slug) > 64 or slug in reserved:
        raise ValueError('Choose a short sculpture name valid on Windows.')
    return slug

def inside(parent, relative):
    candidate = (parent / relative).resolve()
    if not candidate.is_relative_to(parent.resolve()):
        raise ValueError('Input path must stay inside its configured parent.')
    return candidate

def initialize_root(root):
    (root / 'shared/approved-client-work').mkdir(parents=True, exist_ok=True)
    (root / 'sculptures').mkdir(exist_ok=True)

def create_sculpture(root, name):
    parent = (root / 'sculptures').resolve(strict=True)
    target = parent / slug_for(name)
    if target.resolve().parent != parent:
        raise ValueError('Sculpture folder must stay inside the project.')
    target.mkdir()  # Duplicate names fail before changing existing work.
    for folder in FOLDERS:
        (target / folder).mkdir(parents=True, exist_ok=True)
    manifest = json.loads((PROJECT / 'templates/sculpture-project.json').read_text('utf-8'))
    manifest.update(id=target.name, title=name.strip(), created=date.today().isoformat())
    write_new(target / 'project.json', json.dumps(manifest, indent=2)+'\n')
    for template, output in [('asset-brief.md','BRIEF.md'),('sculpture-start.md','START_HERE.md')]:
        text = (PROJECT / 'templates' / template).read_text('utf-8').replace('[Sculpture name]', name.strip())
        write_new(target / output, text)
    batch = json.loads((PROJECT / 'templates/batch-record.json').read_text('utf-8'))
    batch['sculptureId'] = target.name
    write_new(target / 'work/batch.json', json.dumps(batch, indent=2)+'\n')
    write_new(target / 'README.md', f'''# {name.strip()}

1. Put supplied finished Composite 01 in `inputs/reference-composite-01/`.
2. Put all remaining original view folders/passes in `inputs/composites-psd/`.
3. Shared quality examples live at `../../shared/approved-client-work/`.

Read `START_HERE.md`, `BRIEF.md` and the parent project directives. Record the
exact final master file and hash in `project.json`. Prepare low-count crops
directly from each target according to size. Generate/review all target crops
before asking the user to open Photoshop. Assemble, save and reopen-verify one
view at a time. Preserve originals. Creation does not authorize generation.
''')
    return target

def select_sculpture(root, target):
    if target.resolve().parent != (root / 'sculptures').resolve(strict=True):
        raise ValueError('Select a sculpture inside this project.')
    sculpture = json.loads((target / 'project.json').read_text('utf-8'))
    if sculpture['id'] != target.name:
        raise ValueError('Manifest ID does not match its folder.')
    path = root / 'project.json'
    project = json.loads(path.read_text('utf-8'))
    project.update(activeSculpture=target.name, status='intake-selected',
        nextAction='inspect-finished-01-and-remaining-target-sources', updated=date.today().isoformat())
    atomic_json(path, project)

def composite_id(path, input_root):
    """Recognize composite renders, never Mask/ID passes."""
    if path.suffix.lower() not in {'.psd','.psb'}:
        return None
    if path.stem.casefold() == 'composite' and path.parent != input_root:
        match = re.fullmatch(r'(?:composite[ _-]*)?(\d+)', path.parent.name, re.IGNORECASE)
    else:
        match = re.fullmatch(r'composite[ _-]*(\d+)', path.stem, re.IGNORECASE)
    return str(int(match.group(1))).zfill(2) if match else None

def inspect_sculpture(root, name):
    folder = inside(root / 'sculptures', slug_for(name))
    sculpture = json.loads((folder / 'project.json').read_text('utf-8'))
    if sculpture['id'] != folder.name:
        raise ValueError('Manifest ID does not match its folder.')
    psds = inside(folder, sculpture['inputs']['compositePsds'])
    masters = inside(folder, sculpture['inputs']['finishedComposite01'])
    shared = inside(root, (folder / sculpture['sharedQualityReferences']).resolve())
    sources = sorted(p for p in psds.rglob('*') if p.is_file() and p.suffix.lower() in {'.psd','.psb'})
    master_files = sorted(p for p in masters.rglob('*') if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES | {'.psd','.psb'})
    quality = [p for p in shared.rglob('*') if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES]
    views, excluded = {}, []
    for source in sources:
        view = composite_id(source, psds)
        if view == '01':
            excluded.append(source.relative_to(folder).as_posix())
        elif view:
            views.setdefault(view, []).append(source.relative_to(folder).as_posix())
    chosen = sculpture['appearanceMaster'].get('file')
    master_ok = inside(folder, chosen) in master_files if chosen else len(master_files) == 1
    unique = bool(views) and all(len(paths) == 1 for paths in views.values())
    return {'id':sculpture['id'], 'title':sculpture['title'], 'folder':str(folder), 'status':sculpture['status'],
        'counts':{'sourcePsds':len(sources),'targetViews':len(views),'finishedMasterFiles':len(master_files),'sharedQualityFiles':len(quality)},
        'readiness':'files-present-needs-visual-intake' if master_ok and unique and quality else 'missing-or-ambiguous-inputs',
        'targetComposites':dict(sorted(views.items())), 'excludedComposite01Sources':excluded,
        'finishedMasterCandidates':[p.relative_to(folder).as_posix() for p in master_files],
        'selectedMaster':chosen, 'masterIntakeVerified':sculpture['appearanceMaster'].get('intakeVerified',False),
        'sharedQualityFolder':str(shared)}

def refresh_index(root):
    active = json.loads((root / 'project.json').read_text('utf-8')).get('activeSculpture')
    registry = [inspect_sculpture(root,p.parent.name) for p in sorted((root / 'sculptures').glob('*/project.json'))]
    rows = []
    for entry in registry:
        c = entry['counts']
        title = entry['title'].replace('|','\\|') + (' (active)' if entry['id'] == active else '')
        rows.append(f"| {title} | `{entry['id']}` | {c['targetViews']} / {c['finishedMasterFiles']} / {c['sharedQualityFiles']} | {entry['status']} |")
    content = ('# Sculpture subprojects\n\n'
        f"Active sculpture: **{active or 'not selected'}**.\n\n"
        'Each sculpture receives finished Composite 01 in `inputs/reference-composite-01/` '
        'and remaining source views in `inputs/composites-psd/`. Shared quality '
        'examples stay in `shared/approved-client-work/`.\n\n'
        '| Sculpture | Folder | Files: target views / master candidates / shared | Stage |\n'
        '| --- | --- | --- | --- |\n' + '\n'.join(rows) + '\n\n'
        + ('No sculpture intake has been created for the current workflow.\n\n' if not rows else '')
        + 'Counts are recursive. File presence is separate from visual intake, crop review and final acceptance.\n\n'
        'Use **Create New Sculpture.cmd** or `scripts/new_sculpture.py create "Name"` '
        'to create/select an independent intake. `select "Name"` selects an existing '
        'one; `inspect "Name"` reports inputs; `refresh` updates this tab.\n\n'
        'Produce low-count crops directly from all remaining source views according '
        'to size. Finish/review every view\'s generated crops before asking the user '
        'to open Photoshop. Assemble, save and reopen-verify one view at a time.\n\n'
        'Read the [workflow](WORKFLOW.md) and '
        '[next-session handoff](../../projects/sculpture-colorization/NEXT_SESSION.md).\n')
    INDEX.write_text(content, encoding='utf-8')
    atomic_json(SETTINGS, {'version':3,'productionRoot':str(root),'rootStrategy':'project-directory'})
    atomic_json(SETTINGS.parent / 'sculptures.json', {'productionRoot':str(root),'activeSculpture':active,'sculptures':registry})
    path = REPO / 'workspace/workspace.json'
    workspace = json.loads(path.read_text('utf-8'))
    next(e for e in workspace['entities'] if e['id']=='sculpture-colorization')['updated'] = date.today().isoformat()
    atomic_json(path, workspace)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['init','create','select','refresh','inspect'])
    parser.add_argument('name', nargs='?')
    args = parser.parse_args()
    initialize_root(PROJECT)
    if args.command == 'inspect':
        if not args.name:
            parser.error('Specify the sculpture name.')
        print(json.dumps(inspect_sculpture(PROJECT,args.name),indent=2))
        return
    if args.command == 'create':
        target = create_sculpture(PROJECT,args.name if args.name is not None else input('Sculpture name: ').strip())
        select_sculpture(PROJECT,target)
        print(f'Created sculpture: {target}')
    elif args.command == 'select':
        if not args.name:
            parser.error('Specify an existing sculpture name.')
        target = inside(PROJECT / 'sculptures',slug_for(args.name))
        select_sculpture(PROJECT,target)
        print(f'Selected sculpture: {target}')
    refresh_index(PROJECT)
    print('Workspace sculpture listing updated.')

if __name__ == '__main__':
    try:
        main()
    except (OSError,ValueError,KeyError,EOFError) as error:
        raise SystemExit(str(error)) from None
