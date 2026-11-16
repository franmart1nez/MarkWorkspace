from pathlib import Path
import re, runpy

ROOT = Path(__file__).resolve().parents[1]
ORIGINAL = ROOT / 'Development' / 'original_integrated.txt'
source = ORIGINAL.read_text(encoding='utf-8-sig')
camera = source[:source.index('// ZPASS CAPTURE JPG FAST')]

def routine(text, name):
    start = text.index('[RoutineDef,' + name + ',')
    pos, depth, quote, comment = start, 0, False, False
    while pos < len(text):
        c = text[pos]
        if comment:
            if c == '\n': comment = False
        elif quote:
            if c == '"': quote = False
        elif text[pos:pos+2] == '//': comment = True
        elif c == '"': quote = True
        elif c == '[': depth += 1
        elif c == ']':
            depth -= 1
            if depth == 0: return text[start:pos+1]
        pos += 1
    raise ValueError(name)

def replace_routine(name, new):
    global camera
    camera = camera.replace(routine(camera, name), new)

# Maxon's ISwitch documentation requires explicit IEnable calls for plugin
# switches: otherwise loading another plugin can leave them disabled.
# Slot switches already do this in ApplyVisual; the two mode switches did not.
old_sync = routine(camera, 'CB29_SyncVisuals')
camera = camera.replace(old_sync, old_sync.replace(
    '[RoutineDef,CB29_SyncVisuals,',
    '[RoutineDef,CB29_SyncVisuals,\n'
    '    [IEnable,"ZPlugin:Camera Bank 25:STORE NEW"]\n'
    '    [IEnable,"ZPlugin:Camera Bank 25:CLEAR"]\n'
))

# Keep the original 25-slot UI, visibility, click and selection behavior.
# v7 extends the bank without moving any v6 camera or visibility offset.
camera = camera.replace('25545,', '25745,').replace('102180', '102980')
camera = re.sub(r'\[MVarSet,CB25Data,1,6\]', '[MVarSet,CB25Data,1,7]', camera)
camera = camera.replace('CameraBank25_v2_9.zcv','CameraBank25_v3_0.zcv').replace('v2.9','v3.0')

extra = r'''
[RoutineDef,CB31_Require3D,
    [If,([IsEnabled,"Transform:Edit"]==0)||([IGet,"Transform:Edit"]==0),
        [MessageOK,"No live 3D model is in Edit mode. Select your Tool, draw it on the canvas and press T (Edit), then try again. The camera has not been changed.","Camera Bank 25"]
        [Exit]
    ]
    [If,[SubToolGetCount]<1,
        [MessageOK,"No editable mesh was found. If this is a primitive or ZSphere, make a PolyMesh3D/adaptive skin first, then store the camera. Automatic conversion is avoided to preserve your Tool.","Camera Bank 25"]
        [Exit]
    ]
]
// v7: +18 width, +19 height; extension at 25545 + (slot*8).
// Extension: angle, valid, universal, align, auto-distance, reserved(3).
// A zero dimension in a legacy camera means unknown: never invent a size.
[RoutineDef,CB30_LensPaths,
    [VarSet,cbFovPath,""]
    [VarSet,cbUniversalPath,""]
    [If,[IExists,"Draw:Angle Of View"],[VarSet,cbFovPath,"Draw:Angle Of View"]]
    [If,[IExists,"Draw:Field of View"],[VarSet,cbFovPath,"Draw:Field of View"]]
    [If,[IExists,"Draw:Field Of View(deg)"],[VarSet,cbFovPath,"Draw:Field Of View(deg)"]]
    [If,[IExists,"Draw:Universal Camera"],[VarSet,cbUniversalPath,"Draw:Universal Camera"]]
    [If,[IExists,"Draw:UniversalCamera"],[VarSet,cbUniversalPath,"Draw:UniversalCamera"]]
    [If,[IExists,"Draw:Camera Mode"],[VarSet,cbUniversalPath,"Draw:Camera Mode"]]
    [If,[IExists,"Draw:Camera"],[VarSet,cbUniversalPath,"Draw:Camera"]]
    [If,[StrLength,cbUniversalPath]>0,
        [If,[IGet,[Var,cbUniversalPath]]==0,
            [If,[IExists,"Draw:Angle Of View"],[VarSet,cbFovPath,"Draw:Angle Of View"]]
        ]
    ]
]
[RoutineDef,CB30_SaveExtra,
    [VarSet,cbBase,20 + (cbSlot*20)]
    [VarSet,cbExtra,25545 + (cbSlot*8)]
    [MVarSet,CB25Data,cbBase+18,[IGet,"Document:Width"]]
    [MVarSet,CB25Data,cbBase+19,[IGet,"Document:Height"]]
    [Loop,8,[MVarSet,CB25Data,cbExtra+cbIndex,0],cbIndex]
    [RoutineCall,CB30_LensPaths]
    [If,[StrLength,cbFovPath]>0,
        [MVarSet,CB25Data,cbExtra,[IGet,[Var,cbFovPath]]]
        [MVarSet,CB25Data,cbExtra+1,1]
    ]
    [MVarSet,CB25Data,cbExtra+2,-1]
    [If,[StrLength,cbUniversalPath]>0,[MVarSet,CB25Data,cbExtra+2,[IGet,[Var,cbUniversalPath]]]]
    [MVarSet,CB25Data,cbExtra+3,-1]
    [If,[IExists,"Draw:Align To Object"],[MVarSet,CB25Data,cbExtra+3,[IGet,"Draw:Align To Object"]]]
    [MVarSet,CB25Data,cbExtra+4,-1]
    [If,[IExists,"Draw:Auto Adjust Distance"],[MVarSet,CB25Data,cbExtra+4,[IGet,"Draw:Auto Adjust Distance"]]]
    [MVarSet,CB25Data,cbExtra+5,-1]
    [If,[IExists,"Draw:Crop Factor"],[MVarSet,CB25Data,cbExtra+5,[IGet,"Draw:Crop Factor"]]]
    [MVarSet,CB25Data,cbExtra+6,-1]
    [If,[IExists,"Draw:Horizontal"],[MVarSet,CB25Data,cbExtra+6,[IGet,"Draw:Horizontal"]]]
    [MVarSet,CB25Data,cbExtra+7,-1]
    [If,[IExists,"Draw:Vertical"],[MVarSet,CB25Data,cbExtra+7,[IGet,"Draw:Vertical"]]]
,cbSlot]
[RoutineDef,CB30_Resize,
    [If,(cbW>0)&&(cbH>0),
        [If,(cbW>[IGetMax,"Document:Width"])||(cbH>[IGetMax,"Document:Height"]),
            [MessageOK,"Saved canvas size exceeds this ZBrush version's limits.","Camera Bank 25"]
            [Exit]
        ]
        [If,(cbW!=[IGet,"Document:Width"])||(cbH!=[IGet,"Document:Height"]),
            [RoutineCall,CB31_Require3D]
            [VarSet,cbPro,[IGet,"Document:Pro"]]
            [If,[IExists,"Preferences:LightBox:LightBox"],
                [ISet,"Preferences:LightBox:LightBox",0]
            ]
            [VarSet,cbThumbnail,0]
            [If,[IExists,"Preferences:Thumbnail:T.Thumbnail"],
                [VarSet,cbThumbnail,[IGet,"Preferences:Thumbnail:T.Thumbnail"]]
                [IUnPress,"Preferences:Thumbnail:T.Thumbnail"]
            ]
            // This is a 3D camera bank. Rebuild the canvas after Resize,
            // which drops the live Tool into 2.5D. Geometry is not changed.
            [IUnPress,"Transform:Edit"]
            [IPress,"Layer:Clear"]
            [IUnPress,"Document:Pro"]
            [ISet,"Document:Width",cbW]
            [ISet,"Document:Height",cbH]
            [IKeyPress,13,[IPress,"Document:Resize"]]
            [ISet,"Document:Pro",cbPro]
            [IPress,"Transform:Draw Pointer"]
            [CanvasClick,10,10,20,20]
            [IPress,"Transform:Edit"]
            [IUpdate,1,1]
            [If,[IExists,"Preferences:Thumbnail:T.Thumbnail"],
                [ISet,"Preferences:Thumbnail:T.Thumbnail",cbThumbnail]
            ]
            [RoutineCall,CB31_Require3D]
        ]
    ]
,cbW,cbH]
[RoutineDef,CB30_RestoreLens,
    [VarSet,cbBase,20 + (cbSlot*20)]
    [VarSet,cbExtra,25545 + (cbSlot*8)]
    [RoutineCall,CB30_LensPaths]
    [If,[StrLength,cbUniversalPath]>0,
        [If,[MVarGet,CB25Data,cbExtra+2]>=0,[ISet,[Var,cbUniversalPath],[MVarGet,CB25Data,cbExtra+2]]]
    ]
    [RoutineCall,CB30_LensPaths]
    [If,[IExists,"Draw:Perspective"],[IPress,"Draw:Perspective"]]
    [If,[IsEnabled,"Draw:Crop Factor"],
        [If,[MVarGet,CB25Data,cbExtra+5]>0,[ISet,"Draw:Crop Factor",[MVarGet,CB25Data,cbExtra+5]]]
    ]
    [If,[IsEnabled,"Draw:Horizontal"],
        [If,[MVarGet,CB25Data,cbExtra+6]==1,[IPress,"Draw:Horizontal"]]
    ]
    [If,[IsEnabled,"Draw:Vertical"],
        [If,[MVarGet,CB25Data,cbExtra+7]==1,[IPress,"Draw:Vertical"]]
    ]
    [If,[MVarGet,CB25Data,cbBase+15]==1,
        [If,[IsEnabled,"Draw:Focal Length(mm)"],[ISet,"Draw:Focal Length(mm)",[MVarGet,CB25Data,cbBase+11]]]
    ]
    [If,[MVarGet,CB25Data,cbBase+15]==2,
        [If,[IExists,"Draw:Focal Length"],
            [If,[IsEnabled,"Draw:Focal Length"],[ISet,"Draw:Focal Length",[MVarGet,CB25Data,cbBase+11]]]
        ]
    ]
    [If,([MVarGet,CB25Data,cbExtra+1]==1)&&([StrLength,cbFovPath]>0),
        [ISet,[Var,cbFovPath],[MVarGet,CB25Data,cbExtra]]
    ]
    [If,[IExists,"Draw:Align To Object"],
        [If,[MVarGet,CB25Data,cbExtra+3]>=0,[ISet,"Draw:Align To Object",[MVarGet,CB25Data,cbExtra+3]]]
    ]
    [If,[IExists,"Draw:Auto Adjust Distance"],
        [If,[MVarGet,CB25Data,cbExtra+4]>=0,[ISet,"Draw:Auto Adjust Distance",[MVarGet,CB25Data,cbExtra+4]]]
    ]
    [If,[IExists,"Draw:Perspective"],
        [If,[MVarGet,CB25Data,cbBase+10]>=0,[ISet,"Draw:Perspective",[MVarGet,CB25Data,cbBase+10]]]
    ]
,cbSlot]
'''
pos = camera.index('[RoutineDef,CB29_SaveSlot,')
camera = camera[:pos] + extra + '\n' + camera[pos:]
old = routine(camera,'CB29_SaveSlot')
old_guard = old[old.index('    [If,[IExists,"Transform:Edit"]'):old.index('    [VarSet,currentSubCount')]
camera = camera.replace(old,old.replace(old_guard,'    [RoutineCall,CB31_Require3D]\n'))
old = routine(camera,'CB29_SaveSlot')
camera = camera.replace(old,old.replace('    // VISIBILITY','    [RoutineCall,CB30_SaveExtra,slot]\n\n    // VISIBILITY'))
# Commit a newly occupied slot only after all camera/visibility data is written.
old = routine(camera,'CB29_SaveSlot')
new = re.sub(r'\[MVarSet,\s*CB25Data,\s*base,\s*1\s*\]', '', old, count=1)
new = new.replace('    // NEW CAMERA = RENDER ON','    [MVarSet,CB25Data,base,1]\n\n    // NEW CAMERA = RENDER ON')
camera = camera.replace(old,new)
# Current view and Render selection are independent; allow UPDATE ACTIVE on gray views.
old = routine(camera,'CB29_SlotClick')
new = re.sub(r'\[MVarSet,\s*CB25Data,\s*5,\s*0\s*\]', '[MVarSet,CB25Data,5,displaySlot]',old)
camera = camera.replace(old,new)
replace_routine('CB29_LoadSlot',r'''[RoutineDef,CB29_LoadSlot,
    [VarSet,base,20+(slot*20)]
    [If,[MVarGet,CB25Data,base]!=1,[Exit]]
    [RoutineCall,CB31_Require3D]
    // Recover the known transform/focal data of partial early-v3.0 saves.
    // Missing lens-extension fields are unknown, not a request to disable the camera.
    [If,([MVarGet,CB25Data,base+18]==0)&&([MVarGet,CB25Data,25546+(slot*8)]==0),
        [Loop,6,[MVarSet,CB25Data,25547+(slot*8)+cbUnknown,-1],cbUnknown]
    ]
    [VarSet,cbLock,0]
    [If,[IExists,"Draw:Lock Camera"],
        [VarSet,cbLock,[IGet,"Draw:Lock Camera"]]
        [IUnPress,"Draw:Lock Camera"]
    ]
    [RoutineCall,CB30_Resize,[MVarGet,CB25Data,base+18],[MVarGet,CB25Data,base+19]]
    [RoutineCall,CB30_RestoreLens,slot]
    [RoutineCall,CB29_RestoreVisualState,slot]
    // Apply transform AFTER resize and lens changes; they can alter framing.
    [MTransformSet,CB25Data,base+1]
    [CanvasZoomSet,[MVarGet,CB25Data,base+12]]
    [CanvasPanSet,[MVarGet,CB25Data,base+13],[MVarGet,CB25Data,base+14]]
    [If,[IExists,"Draw:Lock Camera"],[ISet,"Draw:Lock Camera",cbLock]]
    [MVarSet,CB25Data,5,slot+1]
    [IUpdate,2,1]
,slot]''')
old=routine(camera,'CB29_ClearSlot')
camera=camera.replace(old,old.replace('    [Note,','    [Loop,8,[MVarSet,CB25Data,25545+(slot*8)+cbClearIndex,0],cbClearIndex]\n    [Note,'))

migration=r'''
// Input is validated before the live bank is touched.
[RoutineDef,CB30_AcceptImport,
    [VarSet,cbImportValid,0]
    [If,(cbImportSize==2080)||(cbImportSize==102180)||(cbImportSize==102980),
        [If,([MVarGet,CB29ImportTemp,0]==252523)&&([MVarGet,CB29ImportTemp,2]==25),
            [VarSet,cbImportVersion,[MVarGet,CB29ImportTemp,1]]
            [If,cbImportSize==102980,
                [If,cbImportVersion==7,[VarSet,cbImportValid,1]]
            ,
                [If,cbImportSize==2080,
                    [If,(cbImportVersion>=1)&&(cbImportVersion<=6),[VarSet,cbImportValid,1]]
                ,
                    [If,(cbImportVersion>=3)&&(cbImportVersion<=6),[VarSet,cbImportValid,1]]
                ]
            ]
        ]
    ]
    [If,cbImportValid==1,
        [RoutineCall,CB29_CreateEmptyBank]
        [MemCopy,CB29ImportTemp,0,CB25Data,0,cbImportSize]
        [If,cbImportVersion<7,
            [Loop,25,
                [MVarSet,CB25Data,20+(cbMigrationSlot*20)+18,0]
                [MVarSet,CB25Data,20+(cbMigrationSlot*20)+19,0]
                [MVarSet,CB25Data,25545+(cbMigrationSlot*8)+2,-1]
                [MVarSet,CB25Data,25545+(cbMigrationSlot*8)+3,-1]
                [MVarSet,CB25Data,25545+(cbMigrationSlot*8)+4,-1]
                [MVarSet,CB25Data,25545+(cbMigrationSlot*8)+5,-1]
                [MVarSet,CB25Data,25545+(cbMigrationSlot*8)+6,-1]
                [MVarSet,CB25Data,25545+(cbMigrationSlot*8)+7,-1]
            ,cbMigrationSlot]
        ]
        [MVarSet,CB25Data,1,7]
        [MVarSet,CB25Data,3,0][MVarSet,CB25Data,4,0]
        [MVarSet,CB25Data,5,0][MVarSet,CB25Data,6,0]
        [If,cbImportVersion>=6,
            [RoutineCall,CB29_NormalizeRenderFlags,0]
        ,
            [RoutineCall,CB29_NormalizeRenderFlags,1]
        ]
    ]
,cbImportSize]
'''
# Replace the whole startup upgrade with a size-checked import/migration.
a=camera.index('[If,[MemGetSize,CB25Data] == 2080,')
b=camera.index('// SAVE VISIBILITY',a)
startup=r'''
[If,[MemGetSize,CB25Data]>0,
    [VarSet,cbStartupSize,[MemGetSize,CB25Data]]
    [VarSet,cbAlreadyV7,0]
    [If,cbStartupSize==102980,
        [If,([MVarGet,CB25Data,0]==252523)&&([MVarGet,CB25Data,1]==7)&&([MVarGet,CB25Data,2]==25),
            [VarSet,cbAlreadyV7,1]
        ]
    ]
    [If,cbAlreadyV7==1,
        [MVarSet,CB25Data,3,0][MVarSet,CB25Data,4,0][MVarSet,CB25Data,6,0]
        [RoutineCall,CB29_NormalizeRenderFlags,0]
    ,
        [If,[MemGetSize,CB29ImportTemp]>0,[MemDelete,CB29ImportTemp]]
        [MemCreate,CB29ImportTemp,cbStartupSize,0]
        [MemCopy,CB25Data,0,CB29ImportTemp,0,cbStartupSize]
        [RoutineCall,CB30_AcceptImport,cbStartupSize]
        [MemDelete,CB29ImportTemp]
        [If,cbImportValid==0,
            [MessageOK,"Unsupported in-memory bank. Export it with its original plugin before loading this version.","Camera Bank 25"]
            [Exit]
        ]
    ]
,
    [RoutineCall,CB29_CreateEmptyBank]
]
'''
camera=camera[:a]+migration+startup+'\n'+camera[b:]
replace_routine('CB29_ImportBank',r'''[RoutineDef,CB29_ImportBank,
    [VarSet,cbFile,[FileNameAsk,"Camera Bank (*.zcv)|*.zcv||",,"Import Camera Bank"]]
    [If,[StrLength,cbFile]>0,
        [If,[MemGetSize,CB29ImportTemp]>0,[MemDelete,CB29ImportTemp]]
        [VarSet,cbSize,[MemCreateFromFile,CB29ImportTemp,cbFile]]
        [RoutineCall,CB30_AcceptImport,cbSize]
        [If,[MemGetSize,CB29ImportTemp]>0,[MemDelete,CB29ImportTemp]]
        [If,cbImportValid==1,
            [RoutineCall,CB29_SyncVisuals]
            [If,cbImportVersion<7,
                [MessageOK,"Legacy bank imported. Old files contain no canvas size or explicit FOV. Recall each camera, set its canvas/lens, then UPDATE ACTIVE and export a new bank.","Camera Bank 25"]
            ,
                [MessageOK,"Camera Bank imported.","Camera Bank 25"]
            ]
        ,
            [MessageOK,"Invalid or unsupported bank. Current cameras were kept.","Camera Bank 25"]
        ]
    ]
]''')
camera += r'''
[IButton,"ZPlugin:Camera Bank 25:UPDATE ACTIVE","Replace the active camera with the current view, canvas size, lens and visibility. Keeps its Render flag.",
    [VarSet,cbActive,[MVarGet,CB25Data,5]-1]
    [If,cbActive<0,[MessageOK,"Recall a stored camera first.","Camera Bank 25"][Exit]]
    [VarSet,cbRenderFlag,[MVarGet,CB25Data,20+(cbActive*20)+16]]
    [RoutineCall,CB29_SaveSlot,cbActive]
    [MVarSet,CB25Data,20+(cbActive*20)+16,cbRenderFlag]
    [RoutineCall,CB29_SyncVisuals]
,,1]
[IEnable,"ZPlugin:Camera Bank 25:STORE NEW"]
[IEnable,"ZPlugin:Camera Bank 25:CLEAR"]
'''
# Add merge-aware visibility without rewriting the supplied slot interface.
camera,merge_globals,merge_names=runpy.run_path(str(ROOT/'Development/build_visibility.py'))['upgrade'](camera,routine)
# Compact inherited whitespace/comments; retain original behavior and editable source.
camera=re.sub(r'(?m)^\s*//.*\n','',camera)
camera=re.sub(r'\n\s*\n','\n',camera)
header='''// Camera Bank 25 v3.2.1 - Windows / ZBrush 2023.2.1 target.
// v3.2.1: native-ID fallback for the first SubTool filename alias.
// Derived from the supplied CameraBank25_v2_9, retaining its slot UI.
// Data v9: 30772 floats / 123088 bytes. See Development/DATA_FORMAT.md.
// Automatic identifier updates use the bundled ZFileUtils library.
// Native acceptance and limitations: Development/VERIFICATION_3.2.1.md.
[VarDef,cbFovPath,""]
[VarDef,cbUniversalPath,""]
[VarDef,cbImportValid,0]
[VarDef,cbImportVersion,0]
'''
(ROOT/'Camera Bank'/'CameraBank25.txt').write_text(header+camera,encoding='ascii')
# Build renderer's private camera reader; it never defines or toggles camera UI.
names=['CB31_Require3D','CB30_LensPaths','CB30_Resize','CB30_RestoreLens']+merge_names+['CB29_RestoreVisualState','CB29_LoadSlot']
shared='[VarDef,cbFovPath,""]\n[VarDef,cbUniversalPath,""]\n'+merge_globals+'\n\n'.join(routine(camera,n) for n in names)
shared=shared.replace('[RoutineCall,CB32_Recover]','')
for n in names: shared=shared.replace(n,'RC_'+n)
(ROOT/'Development'/'camera_reader.inc').write_text(shared,encoding='ascii')
print('Camera Bank source and private renderer reader built.')
