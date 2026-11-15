"""Upgrade the existing camera UI/generator with merge-aware v8 visibility."""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def upgrade(camera, routine):
    def put(name, body):
        nonlocal camera
        camera=camera.replace(routine(camera,name),body)

    old=routine(camera,'CB29_CreateEmptyBank')
    put('CB29_CreateEmptyBank',old.replace('25745','27771').replace('[MVarSet,CB25Data,1,7]','[MVarSet,CB25Data,1,8]'))

    put('CB30_AcceptImport',r'''[RoutineDef,CB30_AcceptImport,
    [VarSet,cbImportValid,0]
    [If,(cbImportSize==2080)||(cbImportSize==102180)||(cbImportSize==102980)||(cbImportSize==111084),
        [If,([MVarGet,CB29ImportTemp,0]==252523)&&([MVarGet,CB29ImportTemp,2]==25),
            [VarSet,cbImportVersion,[MVarGet,CB29ImportTemp,1]]
            [If,(cbImportSize==111084)&&(cbImportVersion==8),[VarSet,cbImportValid,1]]
            [If,(cbImportSize==102980)&&(cbImportVersion==7),[VarSet,cbImportValid,1]]
            [If,(cbImportSize==102180)&&((cbImportVersion>=3)&&(cbImportVersion<=6)),[VarSet,cbImportValid,1]]
            [If,(cbImportSize==2080)&&((cbImportVersion>=1)&&(cbImportVersion<=6)),[VarSet,cbImportValid,1]]
            [If,(cbImportValid==1)&&(cbImportVersion==8),
                [VarSet,cbTracked,[MVarGet,CB29ImportTemp,7]]
                [If,(cbTracked!=0)&&(cbTracked!=1),[VarSet,cbImportValid,0]]
                [If,cbTracked==1,
                    [Loop,2,
                        [VarSet,cbNonce,[MVarGet,CB29ImportTemp,8+cbN]]
                        [If,((cbNonce<100000)||(cbNonce>999999))||(cbNonce!=INT(cbNonce)),[VarSet,cbImportValid,0]]
                    ,cbN]
                    [VarSet,cbGroups,[MVarGet,CB29ImportTemp,25745]]
                    [If,((cbGroups<1)||(cbGroups>1000))||(cbGroups!=INT(cbGroups)),[VarSet,cbImportValid,0]]
                    [If,cbImportValid==1,
                        [Loop,cbGroups,
                            [VarSet,cbLo,[MVarGet,CB29ImportTemp,25746+(cbG*2)]]
                            [VarSet,cbHi,[MVarGet,CB29ImportTemp,25747+(cbG*2)]]
                            [If,((cbLo<0)||(cbLo>8191))||(cbLo!=INT(cbLo)),[VarSet,cbImportValid,0]]
                            [If,((cbHi<0)||(cbHi>4095))||(cbHi!=INT(cbHi)),[VarSet,cbImportValid,0]]
                        ,cbG]
                    ]
                ]
                [Loop,25,
                    [VarSet,cbReady,[MVarGet,CB29ImportTemp,27746+cbS]]
                    [If,((cbReady<0)||(cbReady>1000))||(cbReady!=INT(cbReady)),[VarSet,cbImportValid,0]]
                ,cbS]
            ]
        ]
    ]
    [If,cbImportValid==1,
        [RoutineCall,CB29_CreateEmptyBank]
        [MemCopy,CB29ImportTemp,0,CB25Data,0,cbImportSize]
        [If,cbImportVersion<8,
            [MVarSet,CB25Data,7,0][MVarSet,CB25Data,8,0][MVarSet,CB25Data,9,0]
        ]
        [If,cbImportVersion<7,
            [Loop,25,
                [MVarSet,CB25Data,20+(cbS*20)+18,0][MVarSet,CB25Data,20+(cbS*20)+19,0]
                [Loop,6,[MVarSet,CB25Data,25547+(cbS*8)+cbUnknown,-1],cbUnknown]
            ,cbS]
        ]
        [MVarSet,CB25Data,1,8]
        [MVarSet,CB25Data,3,0][MVarSet,CB25Data,4,0][MVarSet,CB25Data,5,0][MVarSet,CB25Data,6,0]
        [If,cbImportVersion>=6,[RoutineCall,CB29_NormalizeRenderFlags,0],[RoutineCall,CB29_NormalizeRenderFlags,1]]
    ]
,cbImportSize]''')

    # Existing startup migration already validates old file sizes before replacement.
    a=camera.index('[If,[MemGetSize,CB25Data]>0,')
    b=camera.index('[RoutineDef,CB29_SaveVisualState,',a)
    startup=camera[a:b].replace('102980','111084').replace('cbAlreadyV7','cbAlreadyV8').replace('CB25Data,1]==7','CB25Data,1]==8')
    camera=camera[:a]+'[RoutineCall,CB32_Recover]\n'+startup+camera[b:]

    old=routine(camera,'CB29_RestoreVisualState')
    put('CB29_RestoreVisualState',old.replace('CB29_RestoreVisualState','CB32_RestoreLegacyVisualState',1))
    camera+=r'''
[RoutineDef,CB29_RestoreVisualState,
    [If,([MVarGet,CB25Data,7]==1)||([MVarGet,CB25Data,27746+slot]>0),
        [RoutineCall,CB32_RestoreEffective,slot]
    ,
        [RoutineCall,CB32_RestoreLegacyVisualState,slot]
    ]
,slot]
[IButton,"ZPlugin:Camera Bank 25:PREPARE TRANSFER","Add visibility identifiers for ZTL/ZPR transfer and compatible native merges. Save the ZTL/ZPR AFTER preparation and send it with the exported bank.",
    [RoutineCall,CB32_Recover][RoutineCall,CB31_Require3D]
    [If,[MVarGet,CB25Data,7]==1,
        [RoutineCall,CB32_CheckTracked]
        [If,cbTrackValid==0,[MessageOK,cbTrackError,"Camera Bank 25"][Exit]]
    ,
        [RoutineCall,CB32_PrepareTransfer]
    ]
    [MessageOK,"Transfer prepared. Save this ZTL/ZPR NOW and export the matching camera bank. Preserve CB...G..._ markers. Merge only parts with identical visibility in ALL stored cameras.","Camera Bank 25"]
,,1]
'''
    old=routine(camera,'CB29_LoadSlot')
    put('CB29_LoadSlot',old.replace('[RoutineCall,CB31_Require3D]','[RoutineCall,CB31_Require3D]\n    [RoutineCall,CB32_RequireVisibility,slot]',1))

    old=routine(camera,'CB29_SaveSlot')
    new=old.replace('    [MTransformGet,','    [If,[MVarGet,CB25Data,7]==1,[RoutineCall,CB32_RebaseForEdit]]\n    [MTransformGet,',1)
    pattern=r'\[RoutineCall,\s*CB29_SaveVisualState,\s*slot\s*\]'
    new,n=re.subn(pattern,lambda m:m[0]+'\n    [RoutineCall,CB32_RecordEffective,slot]',new,count=1)
    assert n==1
    new=new.rsplit(',slot]',1)[0]+'    [If,[MemGetSize,CB32RenameState]>0,[RoutineCall,CB32_PrepareTransfer]]\n,slot]'
    put('CB29_SaveSlot',new)
    old=routine(camera,'CB29_ClearSlot')
    put('CB29_ClearSlot',old.replace('[Loop,8,','[MVarSet,CB25Data,27746+slot,0]\n    [Loop,8,',1))

    old=routine(camera,'CB29_ExportBank')
    new=old.replace('[MVarSet,CB25Data,1,7]','[MVarSet,CB25Data,1,8]')
    new=new.replace('    [If,[StrLength,saveFile] > 0,','''    [If,[StrLength,saveFile] > 0,
        [RoutineCall,CB31_Require3D]
        [If,[MVarGet,CB25Data,7]==0,
            [RoutineCall,CB32_PrepareTransfer]
        ,
            [RoutineCall,CB32_CheckTracked]
            [If,cbTrackValid==0,[MessageOK,cbTrackError,"Camera Bank 25"][Exit]]
        ]''',1)
    new=new.replace('CameraBank25_v3_0.zcv','CameraBank25_v3_1.zcv').replace('Export Camera Bank 25 v3.0','Export Camera Bank 25 v3.1')
    new=new.replace('Camera Bank v3.0 exported successfully.','Camera bank exported. Save the prepared ZTL/ZPR and send BOTH files together. Keep name identifiers and merge only equal-visibility parts across ALL cameras.')
    put('CB29_ExportBank',new)
    old=routine(camera,'CB29_ImportBank')
    put('CB29_ImportBank',old.replace('cbImportVersion<7','cbImportVersion<8').replace('Legacy bank imported. Old files contain no canvas size or explicit FOV. Recall each camera, set its canvas/lens, then UPDATE ACTIVE and export a new bank.',
        'Legacy bank imported without merge identifiers. Use the ORIGINAL unmerged Tool, recall and UPDATE ACTIVE for every occupied camera, then PREPARE TRANSFER and save matching ZTL/ZPR + bank. Older banks may also need canvas/lens corrections.'))

    # Every operation that edits/recalls bank state first recovers interrupted name edits.
    for name in ['CB29_SaveSlot','CB29_LoadSlot','CB29_ClearSlot','CB29_ClearAll','CB29_ExportBank','CB29_ImportBank','CB29_SlotClick','CB29_EnterStoreMode','CB29_EnterClearMode']:
        if '[RoutineDef,'+name+',' in camera:
            old=routine(camera,name)
            put(name,old.replace('[RoutineDef,'+name+',','[RoutineDef,'+name+',\n    [RoutineCall,CB32_Recover]',1))

    read=(ROOT/'Development/merge_visibility.inc').read_text(encoding='ascii')
    writer=(ROOT/'Development/merge_visibility_writer.inc').read_text(encoding='ascii')
    camera=read+'\n'+writer+'\n'+camera
    shared_globals=read[:read.index('[RoutineDef,')]
    shared_names=re.findall(r'\[RoutineDef,(\w+),',read)+['CB32_RestoreLegacyVisualState']
    return camera,shared_globals,shared_names
