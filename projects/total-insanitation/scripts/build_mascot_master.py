"""Author the proposed stage-4 wizard SVG master and review sheets.

Manual vector construction, not generative output or an automatic raster trace.
Preserves owner prototypes. The SVGs remain editable; raster previews are made
separately with the existing local browser. Nothing is imported into Unreal.
"""
import base64
import hashlib
import json
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[3]
CARD = ROOT / 'workspace/2026-11-12_total-insanitation'
SOURCE = Path('D:/GameJam/Total (in)Sanitation/Utility_Materials/TrimSheet&Atlas/General_Atlas/Resources/Pet/Development/Stage4_Master_v01')
PREVIEW = CARD / 'media/mascot-v01'
COPIES = CARD / 'sources/mascot-v01'
for folder in (SOURCE, PREVIEW, COPIES):
    folder.mkdir(parents=True, exist_ok=True)
for folder in (SOURCE, COPIES):
    saved = folder / 'manifest.json'
    if saved.exists():
        baseline = json.loads(saved.read_text(encoding='utf-8')).get('source_hashes', {})
        for name, expected in baseline.items():
            current = folder / name
            if not current.is_file() or hashlib.sha256(current.read_bytes()).hexdigest() != expected:
                raise RuntimeError('Preserve hand-edited source; prepare a new revision instead: ' + str(current))

INK = '#171713'
PAPER = '#f3efdf'
YELLOW = '#f4cb3d'
MUTED = '#676457'


def star(cx, cy, r=12):
    return f'M{cx},{cy-r} Q{cx+2},{cy-2} {cx+r},{cy} Q{cx+2},{cy+2} {cx},{cy+r} Q{cx-2},{cy+2} {cx-r},{cy} Q{cx-2},{cy-2} {cx},{cy-r}Z'


def defs(compact=False):
    fingers = '' if compact else '''<g id="greeting-fingers" fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round">
      <path d="M142 250 L128 232 M150 247 L143 221 M160 249 L161 221 M166 261 L179 245"/>
    </g>'''
    band = '' if compact else '<path d="M246 179 Q267 175 290 177" fill="none" stroke="black" stroke-width="8" stroke-linecap="round"/>'
    orb_cut = '' if compact else f'<path d="{star(483,312)}" fill="black"/>'
    grip = '' if compact else '<ellipse cx="470" cy="448" rx="23" ry="27" fill="black"/><ellipse cx="470" cy="448" rx="16" ry="20" fill="white"/>'
    grip_left = '' if compact else '<ellipse cx="113" cy="448" rx="23" ry="27" fill="black"/><ellipse cx="113" cy="448" rx="16" ry="20" fill="white"/>'
    mop_grips = '' if compact else '<circle cx="334" cy="426" r="21" fill="black"/><circle cx="334" cy="426" r="14" fill="white"/><circle cx="390" cy="504" r="21" fill="black"/><circle cx="390" cy="504" r="14" fill="white"/>'
    return f'''<defs>
    <mask id="hat-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="800"><rect width="600" height="800" fill="white"/>{band}</mask>
    <mask id="orb-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="800"><rect width="600" height="800" fill="white"/>{orb_cut}</mask>
    <mask id="greeting-cut" maskUnits="userSpaceOnUse" x="-100" y="0" width="800" height="800"><rect x="-100" width="800" height="800" fill="white"/>{grip}</mask>
    <mask id="point-cut" maskUnits="userSpaceOnUse" x="-100" y="0" width="800" height="800"><rect x="-100" width="800" height="800" fill="white"/>{grip_left}</mask>
    <mask id="mop-cut" maskUnits="userSpaceOnUse" x="-100" y="0" width="800" height="800"><rect x="-100" width="800" height="800" fill="white"/>{mop_grips}</mask>
    <g id="head-standard" fill="currentColor">
      <circle id="face-no-features" cx="300" cy="238" r="55"/>
      <g id="hat" mask="url(#hat-cut)"><path id="bent-crown" d="M235 181 L275 71 Q280 61 289 68 L356 112 Q365 120 357 122 L315 112 L333 181Z"/><ellipse id="hat-brim" cx="294" cy="187" rx="89" ry="18"/></g>
    </g>
    <g id="torso-standard" fill="currentColor"><path d="M269 325 Q272 315 285 315 L315 315 Q328 315 335 326 L333 493 L266 493Z"/></g>
    <g id="legs-standard" fill="none" stroke="currentColor" stroke-width="41" stroke-linecap="round" stroke-linejoin="round"><path d="M283 485 L242 706 M315 485 L354 706"/></g>
    <g id="feet-standard" fill="currentColor"><ellipse cx="228" cy="716" rx="34" ry="16"/><ellipse cx="374" cy="716" rx="34" ry="16"/></g>
    <g id="staff-standard" fill="currentColor"><path id="shaft" d="M481 337 L460 725" fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="round"/><circle id="staff-collar" cx="480" cy="337" r="11"/><circle id="orb" cx="483" cy="312" r="24" mask="url(#orb-cut)"/></g>
    <g id="pose-greeting" mask="url(#greeting-cut)">
      <use href="#head-standard"/><use href="#torso-standard"/><use href="#legs-standard"/><use href="#feet-standard"/>
      <g id="greeting-arms" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"><path d="M277 338 L204 361 L162 281 M327 339 L384 427 L457 448"/></g>
      <circle id="greeting-palm" cx="151" cy="263" r="20" fill="currentColor"/>{fingers}
      <use href="#staff-standard"/><ellipse id="gripping-hand" cx="470" cy="448" rx="16" ry="20" fill="currentColor"/>
    </g>
    <g id="pose-point-right" mask="url(#point-cut)">
      <use href="#head-standard"/><use href="#torso-standard"/><use href="#legs-standard"/><use href="#feet-standard"/>
      <g fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"><path d="M277 338 L204 425 L130 448 M327 339 L415 339 L482 339"/></g>
      <use href="#staff-standard" transform="translate(-357 0)"/><ellipse cx="113" cy="448" rx="16" ry="20" fill="currentColor"/>
      <path id="pointing-hand" d="M476 339 L527 339" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round"/><ellipse cx="481" cy="349" rx="19" ry="15" fill="currentColor"/>
    </g>
    <g id="pose-mopping" mask="url(#mop-cut)">
      <use href="#head-standard" transform="rotate(-10 300 238)"/>
      <path id="mopping-torso" d="M282 326 Q306 311 336 326 L370 494 L295 494Z" fill="currentColor"/>
      <g fill="none" stroke="currentColor" stroke-width="41" stroke-linecap="round" stroke-linejoin="round"><path d="M312 485 L218 706 M347 485 L382 706"/></g><ellipse cx="203" cy="716" rx="34" ry="16" fill="currentColor"/><ellipse cx="401" cy="716" rx="34" ry="16" fill="currentColor"/>
      <path id="mop-shaft" d="M257 320 L507 670" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>
      <g fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"><path d="M283 341 L247 381 L334 426 M335 341 L404 414 L390 504"/></g><circle cx="334" cy="426" r="14" fill="currentColor"/><circle cx="390" cy="504" r="14" fill="currentColor"/>
      <path id="mop-pad" d="M458 678 Q504 656 550 678 L558 704 Q508 719 450 704Z" fill="currentColor"/>
    </g>
    <g id="pose-slipping"><g id="falling-body" transform="rotate(-25 335 485)">
      <use href="#head-standard" transform="translate(-30 15)"/>
      <path id="slipping-torso" d="M276 338 Q301 324 320 345 L368 468 L307 501Z" fill="currentColor"/>
      <g fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"><path d="M290 353 L385 312 L418 260 M281 366 L198 398 L153 360"/></g><circle cx="418" cy="260" r="18" fill="currentColor"/><circle cx="153" cy="360" r="18" fill="currentColor"/>
      <g fill="none" stroke="currentColor" stroke-width="41" stroke-linecap="round" stroke-linejoin="round"><path d="M333 473 L393 530 L476 490 M340 490 L329 581 L403 635"/></g><ellipse cx="489" cy="487" rx="33" ry="16" fill="currentColor" transform="rotate(-20 489 487)"/><ellipse cx="415" cy="640" rx="33" ry="16" fill="currentColor" transform="rotate(25 415 640)"/>
      </g><path id="wet-floor-cue" d="M270 700 Q361 676 470 700 M309 719 Q367 707 426 719" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>
    </g>
    </defs>'''


def asset(pose='greeting', compact=False, ink='#000000'):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="-100 0 800 800" style="color:{ink}">
    <title>Proposed company wizard v01 / {pose} / {'compact' if compact else 'full'}</title><desc>Editable manually authored vector proposal. Owner approval pending. Source greeting prototype preserved.</desc>{defs(compact)}<g id="wizard-artwork"><use href="#pose-{pose}"/></g></svg>'''


def root_svg(width, height, content, compact=False):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" style="color:{INK};font-family:Arial,Helvetica,sans-serif">{defs(compact)}{content}</svg>'''


def text(x, y, value, size=22, weight='400', fill=INK, **attrs):
    rest=' '.join(f'{k.replace("_", "-")}="{v}"' for k,v in attrs.items())
    return f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" fill="{fill}" {rest}>{escape(value)}</text>'


def lines(x,y,values,size=22,leading=32,**kwargs):
    return ''.join(text(x,y+i*leading,v,size,**kwargs) for i,v in enumerate(values))


def picture(pose,x,y,w,h,ink=INK):
    return f'<svg x="{x}" y="{y}" width="{w}" height="{h}" viewBox="-100 0 800 800" style="color:{ink}"><use href="#pose-{pose}"/></svg>'


def embed(file,x,y,w,h):
    file=Path(file);mime='image/jpeg' if file.suffix.lower() in ['.jpg','.jpeg'] else 'image/webp'
    b64=base64.b64encode(file.read_bytes()).decode()
    return f'<image x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="xMidYMid meet" href="data:{mime};base64,{b64}"/>'


def header(kicker,title,subtitle,width=1400):
    return f'<rect width="{width}" height="1200" fill="{PAPER}"/>'+text(48,48,kicker,15,'700',letter_spacing='2')+text(48,105,title,44,'700')+text(48,144,subtitle,20,fill=MUTED)


def sign(kind,x,y,w=410,h=650):
    yellow=kind=='hazard';bg=YELLOW if yellow else '#fbf8ec';head='CAUTION' if yellow else 'STAFF ACCESS' if kind=='direction' else 'STAFF NOTICE'
    contents=f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="20" fill="{bg}" stroke="{INK}" stroke-width="9"/>'
    contents+=text(x+w/2,y+62,head,36 if yellow else 24,'700',text_anchor='middle',letter_spacing='2')
    contents+=f'<path d="M{x+25} {y+86}H{x+w-25}" stroke="{INK}" stroke-width="3"/>'
    pose={'direction':'point-right','cleaning':'mopping','hazard':'slipping'}[kind]
    contents+=picture(pose,x+20,y+96,w-40,350)
    label=['JANITOR','SERVICES'] if kind=='direction' else ['KEEP FLOORS','CLEAN'] if kind=='cleaning' else ['WET','FLOOR']
    contents+=lines(x+w/2,y+490,label,37,48,weight='700',text_anchor='middle')
    if kind=='direction':
        contents+=f'<path d="M{x+105} {y+594}H{x+305} M{x+271} {y+564}L{x+307} {y+594}L{x+271} {y+624}" fill="none" stroke="{INK}" stroke-width="15" stroke-linecap="square" stroke-linejoin="miter"/>'
    else:contents+=text(x+w/2,y+605,'CLEANING INSTRUCTION' if kind=='cleaning' else 'SLIP HAZARD',15,'700',text_anchor='middle',letter_spacing='1.5')
    return contents


ref=CARD/'media/development/Stick_figure_mascot_waving_33412cac_2K.jpg'
master=header('STAGE 4 / MASTER PROPOSAL V01','The company wizard','Existing identity, one construction system. Owner review required.')
master+=f'<rect x="48" y="190" width="300" height="610" rx="14" fill="#fff"/>'
master+=text(68,226,'PRIMARY REFERENCE',16,'700')+embed(ref,62,246,272,474)
master+=lines(68,754,['Preserved owner prototype','No source pixels changed'],17,26,fill=MUTED)
master+=picture('greeting',356,174,560,620)
master+=text(428,824,'PROPOSED EDITABLE MASTER',17,'700')
master+=f'<rect x="936" y="190" width="416" height="610" rx="14" fill="#e6e0ce"/>'
master+=text(962,232,'KEEP THE IDENTITY',18,'700')
master+=lines(962,272,['Faceless round head','Bent pointed hat and broad brim','Simple figure; rounded limbs','Orb staff with four-point cutout'],20,34)
master+=text(962,440,'PROPOSED CONSTRUCTION',18,'700')
master+=lines(962,480,['Head diameter H = 110 units','Brim width = 1.62 H','Torso width = 0.64 H','Arm weight = 0.29 H','Staff shaft = 0.13 H','Clear space: at least 0.5 H'],20,34)
master+=text(962,742,'Full ≥96 px / compact ≥64 px',20,'700')
master+=lines(48,886,['Proposed normalization: one hat, one staff, consistent limb weights; no face, beard or costume added.','Remove the permanent ground line. Separate scene cues from the reusable character.','The electrical skeleton and acid illustration remain action references, not alternate master identities.'],21,32)
master+=text(48,1015,'MANUAL VECTOR STUDY  •  NO GENERATIVE SUBMISSIONS  •  NOT IMPLEMENTED IN UNREAL',15,'700',letter_spacing='1')

apps=header('STAGE 4 / SHARED FIRST REVIEW','One wizard, three applications','Action studies support the master review. The sign system remains provisional.')
for i,(kind,title) in enumerate([('direction','01 / Direction'),('cleaning','02 / Cleaning instruction'),('hazard','03 / Hazard')]):
    x=50+i*450;apps+=text(x,199,title,20,'700')+sign(kind,x,230)
apps+=lines(48,944,['Direction: staff switches to the support hand. Cleaning and falling: staff omitted for action clarity.','The same head/hat geometry and limb weights carry through all studies. Copy, color and type are proposals.','English text stays editable. No atlas, localization binding or Unreal asset has been changed.'],21,32)

readability=header('STAGE 4 / DISPLAY-SIZE CHECK','Readability and clear space','Open this sheet at 100% for the labeled pixel sizes. Engine review still follows implementation.',1600)
for i,size in enumerate([32,48,64,96,128]):
    x=65+i*300;readability+=text(x,225,f'{size} px canvas',22,'700')
    for j,compact_label in enumerate(['FULL','COMPACT']):
        y=275+j*225
        readability+=text(x,y-20,compact_label,15,'700',fill=MUTED)
        readability+=f'<rect x="{x}" y="{y}" width="230" height="160" rx="8" fill="#fff" stroke="#c4bca4"/>'
        # Compact comes from its own file so the two recipes remain distinct.
        payload=base64.b64encode(asset(compact=bool(j)).encode()).decode()
        readability+=f'<image x="{x+16}" y="{y+16}" width="{size}" height="{size}" href="data:image/svg+xml;base64,{payload}"/>'
for i,(bg,ink) in enumerate([('#ffffff',INK),(INK,'#ffffff'),(YELLOW,INK)]):
    x=65+i*300;readability+=f'<rect x="{x}" y="770" width="230" height="230" rx="12" fill="{bg}"/>'+picture('greeting',x+10,780,210,210,ink)
readability+=text(1000,790,'PROPOSED MINIMUMS',20,'700')
readability+=lines(1000,832,['Full: 96 px canvas height','Compact: 64 px canvas height','32 / 48 px: diagnostic only','Compact drops fingers, band,','orb sparkle and grip cutout.','No outline stroke around figure.'],20,32)
readability+=lines(48,1070,['All cutouts are transparent, including the orb and grip gap. White is an ink variant, not a background box.','These browser checks do not establish world-sign distance, engine mip behavior or accessibility compliance.'],21,32)

context=header('STAGE 4 / NATIVE CONTEXT REFERENCES','Existing service spaces','Unchanged stage-3 captures shown beside design studies. No in-scene placement is claimed.')
for i,(file,title) in enumerate([('janitor-service.webp','Existing janitor service room'),('basement-shop.webp','Existing Basement shop')]):
    x=48+i*680;context+=embed(CARD/'media/unreal-2026-11-17'/file,x,190,624,369)+text(x,597,title,22,'700')
context+=picture('greeting',48,650,280,280)
context+=lines(365,700,['Use the real materials as context,','without changing the master silhouette.','Keep the graphic readable before adding wear.','A later stage-5 scene mockup will test placement,','contrast and the complete signage/UI system.'],26,45)
context+=text(48,1030,'NATIVE IMAGES REMAIN PRODUCTION EVIDENCE. THE VECTOR MASTER IS A DEVELOPMENT PROPOSAL.',16,'700')

files={
    'wizard-mascot-v01.svg': asset(),
    'wizard-mascot-v01-compact.svg': asset(compact=True),
    'wizard-mascot-v01-white.svg': asset(ink='#ffffff'),
    'wizard-mascot-v01-compact-white.svg': asset(compact=True,ink='#ffffff'),
    'master-sheet-v01.svg':root_svg(1400,1060,master),
    'applications-v01.svg':root_svg(1400,1080,apps),
    'readability-v01.svg':root_svg(1600,1170,readability),
    'context-v01.svg':root_svg(1400,1080,context),
}
for pose in ['point-right','mopping','slipping']:
    files[f'study-{pose}-v01.svg']=asset(pose)
for name,body in files.items():
    # These are task-owned versioned drafts; never replace a prototype.
    (SOURCE/name).write_text(body+'\n',encoding='utf-8')
    (COPIES/name).write_text(body+'\n',encoding='utf-8')
manifest={
    'version':'v01','status':'proposed-owner-review','date':'2026-11-17',
    'method':'Manually authored SVG paths; deterministic local browser raster exports',
    'generator':{'provider':None,'model':None,'submissions':0,'external_cost':0},
    'source_root':str(SOURCE).replace('\\','/'),
    'primary_reference':str(ref.relative_to(CARD)).replace('\\','/'),
    'construction':{'viewbox':[-100,0,800,800],'head_diameter':110,'hat_brim_width':178,'torso_width':70,'arm_weight':32,'leg_weight':41,'staff_shaft':14,'clear_space':55,'full_min_canvas_px':96,'compact_min_canvas_px':64},
    'invariants':['round faceless head','same bent hat and brim','same orb staff','rounded limbs','one-color fill','transparent cutouts'],
    'staff_policy':{'greeting':'held in screen-right hand','point-right':'same staff in support hand, screen-left','mopping':'omitted for two-hand tool use','slipping':'omitted for action clarity'},
    'review_only_action_studies':['point-right','mopping','slipping'],
    'remaining_pose_batch':'Not started; master/style approval required',
    'implementation':'No Unreal import, atlas edit or UI replacement',
    'files':sorted(files),
}
for folder in [SOURCE,COPIES]:
    (folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'source':str(SOURCE),'workspace_sources':str(COPIES),'svg_files':len(files)}))
