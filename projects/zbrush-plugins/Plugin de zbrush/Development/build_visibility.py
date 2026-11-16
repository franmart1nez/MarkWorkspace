"""Camera Bank 3.2.1: v9 adds native-ID recovery for ZTL filename aliases."""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def upgrade(camera, routine):
    def put(name, body):
        nonlocal camera
        camera=camera.replace(routine(camera,name),body)

    old=routine(camera,'CB29_CreateEmptyBank')
    put('CB29_CreateEmptyBank',old.replace('25745','30772').replace('[MVarSet,CB25Data,1,7]','[MVarSet,CB25Data,1,9]').replace(
        '[RoutineDef,CB29_CreateEmptyBank,', '[RoutineDef,CB29_CreateEmptyBank,\n    [RoutineCall,CB32_ClearLegacyBinding]'))

    put('CB30_AcceptImport',r'''[RoutineDef,CB30_AcceptImport,
    [VarSet,cbImportValid,0]
    [If,(cbImportSize==2080)||(cbImportSize==102180)||(cbImportSize==102980)||(cbImportSize==111084)||(cbImportSize==123088),
        [If,([MVarGet,CB29ImportTemp,0]==252523)&&([MVarGet,CB29ImportTemp,2]==25),
            [VarSet,cbImportVersion,[MVarGet,CB29ImportTemp,1]]
            [If,(cbImportSize==111084)&&(cbImportVersion==8),[VarSet,cbImportValid,1]]
            [If,(cbImportSize==123088)&&(cbImportVersion==9),[VarSet,cbImportValid,1]]
            [If,(cbImportSize==102980)&&(cbImportVersion==7),[VarSet,cbImportValid,1]]
            [If,(cbImportSize==102180)&&((cbImportVersion>=3)&&(cbImportVersion<=6)),[VarSet,cbImportValid,1]]
            [If,(cbImportSize==2080)&&((cbImportVersion>=1)&&(cbImportVersion<=6)),[VarSet,cbImportValid,1]]
            [If,(cbImportValid==1)&&(cbImportVersion>=8),
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
                [If,(cbImportValid==1)&&(cbImportVersion==9),
                    [VarSet,cbIdCount,[MVarGet,CB29ImportTemp,27771]]
                    [If,((cbIdCount<0)||(cbIdCount>1000))||(cbIdCount!=INT(cbIdCount)),[VarSet,cbImportValid,0]]
                    [If,(cbTracked==0)&&(cbIdCount!=0),[VarSet,cbImportValid,0]]
                    [If,cbImportValid==1,
                        [Loop,cbIdCount,
                            [VarSet,cbImportId,[MVarGet,CB29ImportTemp,27772+(cbIdI*3)]]
                            [VarSet,cbImportHi,[MVarGet,CB29ImportTemp,27773+(cbIdI*3)]]
                            [VarSet,cbImportGroup,[MVarGet,CB29ImportTemp,27774+(cbIdI*3)]]
                            [If,((cbImportId<0)||(cbImportId>65535))||(cbImportId!=INT(cbImportId)),[VarSet,cbImportValid,0]]
                            [If,((cbImportHi<0)||(cbImportHi>65535))||(cbImportHi!=INT(cbImportHi)),[VarSet,cbImportValid,0]]
                            [If,(cbImportHi==0)&&(cbImportId==0),[VarSet,cbImportValid,0]]
                            [If,((cbImportGroup<1)||(cbImportGroup>cbGroups))||(cbImportGroup!=INT(cbImportGroup)),[VarSet,cbImportValid,0]]
                        ,cbIdI]
                    ]
                ]
            ]
        ]
    ]
    [If,cbImportValid==1,
        [RoutineCall,CB29_CreateEmptyBank]
        [MemCopy,CB29ImportTemp,0,CB25Data,0,cbImportSize]
        [If,cbImportVersion<8,
            [MVarSet,CB25Data,7,0][MVarSet,CB25Data,8,0][MVarSet,CB25Data,9,0]
        ]
        // Untracked data has no persistent name/order evidence. Reviewed bits
        // cannot be trusted after a file transfer, even in old unprepared v8.
        [If,[MVarGet,CB25Data,7]==0,
            [Loop,25,[MVarSet,CB25Data,27746+cbS,0],cbS]
        ]
        [If,cbImportVersion<7,
            [Loop,25,
                [MVarSet,CB25Data,20+(cbS*20)+18,0][MVarSet,CB25Data,20+(cbS*20)+19,0]
                [Loop,6,[MVarSet,CB25Data,25547+(cbS*8)+cbUnknown,-1],cbUnknown]
            ,cbS]
        ]
        [MVarSet,CB25Data,1,9]
        [MVarSet,CB25Data,3,0][MVarSet,CB25Data,4,0][MVarSet,CB25Data,5,0][MVarSet,CB25Data,6,0]
        [If,cbImportVersion>=6,[RoutineCall,CB29_NormalizeRenderFlags,0],[RoutineCall,CB29_NormalizeRenderFlags,1]]
        [If,cbImportVersion<9,[RoutineCall,CB321_RecordNativeIDs]]
    ]
,cbImportSize]''')

    # Existing startup migration already validates old file sizes before replacement.
    a=camera.index('[If,[MemGetSize,CB25Data]>0,')
    b=camera.index('[RoutineDef,CB29_SaveVisualState,',a)
    startup=camera[a:b].replace('102980','123088').replace('cbAlreadyV7','cbAlreadyV9').replace('CB25Data,1]==7','CB25Data,1]==9')
    camera=camera[:a]+'[RoutineCall,CB32_Recover]\n'+startup+'\n[RoutineCall,CB32_ResetUnboundLegacy]\n'+camera[b:]

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
'''
    old=routine(camera,'CB29_LoadSlot')
    put('CB29_LoadSlot',old.replace('[RoutineCall,CB31_Require3D]','[RoutineCall,CB31_Require3D]\n    [RoutineCall,CB32_RequireVisibility,slot]',1))

    old=routine(camera,'CB29_SaveSlot')
    new=old.replace('    [MTransformGet,',r'''    [VarSet,cbKeepRender,1]
    [If,[MVarGet,CB25Data,base]==1,[VarSet,cbKeepRender,[MVarGet,CB25Data,base+16]]]
    [If,[MVarGet,CB25Data,7]==1,
        [RoutineCall,CB32_RebaseForEdit]
    ,
        [RoutineCall,CB32_CheckLegacyEdit]
        [RoutineCall,CB32_BeginTransaction]
    ]
    [MTransformGet,''',1)
    pattern=r'\[RoutineCall,\s*CB29_SaveVisualState,\s*slot\s*\]'
    new,n=re.subn(pattern,lambda m:m[0]+'\n    [RoutineCall,CB32_RecordEffective,slot]',new,count=1)
    assert n==1
    # Render OFF is part of the same transaction, including interruption recovery.
    new=re.sub(r'\[MVarSet,\s*CB25Data,\s*base\s*\+\s*16,\s*1\s*\]',
               '[MVarSet,CB25Data,base+16,cbKeepRender]',new)
    note=new.index('    [Note,')
    new=new[:note]+r'''    [RoutineCall,CB32_FinishStore]
    [If,[MVarGet,CB25Data,7]==1,
        [Note,[StrMerge,"Camera ",displaySlot," stored | Render ",cbKeepRender,". Save the matching ZTL/ZPR and bank."],,2]
    ,
        [Note,"View stored. Review/UPDATE ACTIVE for the remaining legacy cameras; tracking completes automatically.",,2]
    ]
,slot]'''
    put('CB29_SaveSlot',new)
    camera=camera.replace('    [VarSet,cbActive,[MVarGet,CB25Data,5]-1]',
                          '    [RoutineCall,CB32_Recover]\n    [VarSet,cbActive,[MVarGet,CB25Data,5]-1]')
    camera=camera.replace('    [VarSet,cbRenderFlag,[MVarGet,CB25Data,20+(cbActive*20)+16]]\n','')
    camera=camera.replace('    [MVarSet,CB25Data,20+(cbActive*20)+16,cbRenderFlag]\n','')
    old=routine(camera,'CB29_ClearSlot')
    put('CB29_ClearSlot',old.replace('[Loop,8,','[MVarSet,CB25Data,27746+slot,0]\n    [Loop,8,',1))

    put('CB29_ExportBank',r'''[RoutineDef,CB29_ExportBank,
    [VarSet,saveFile,[FileNameAsk,"Camera Bank (*.zcv)|*.zcv||","CameraBank25_v3_2.zcv","Export Camera Bank 25 v3.2.1"]]
    // Cancel is strictly read-only, including pending recovery and UI modes.
    [If,[StrLength,saveFile]==0,[Exit]]
    [If,[FileExists,saveFile]==1,
        [If,[MessageYesNo,"Replace the selected bank file? Keep a separate copy if this is an original bank.","Camera Bank 25"]!=1,[Exit]]
    ]
    [RoutineCall,CB32_Recover]
    [If,[MemGetSize,CB32Export]>0,[MemDelete,CB32Export]]
    [If,[MemGetSize,CB32ExportCheck]>0,[MemDelete,CB32ExportCheck]]
    [MemCreate,CB32Export,123088,0]
    [MemCopy,CB25Data,0,CB32Export,0,123088]
    [MVarSet,CB32Export,1,9]
    [MVarSet,CB32Export,3,0][MVarSet,CB32Export,4,0][MVarSet,CB32Export,6,0]
    [Loop,25,[MVarSet,CB32Export,20+(cbS*20)+17,0],cbS]
    [VarSet,saveResult,[MemSaveToFile,CB32Export,saveFile,1]]
    [VarSet,cbExportOK,0]
    [If,saveResult==123088,
        [If,[MemCreateFromFile,CB32ExportCheck,saveFile]==123088,
            [VarSet,cbExportOK,1]
            [Loop,30772,
                [If,[MVarGet,CB32Export,cbCell]!=[MVarGet,CB32ExportCheck,cbCell],
                    [VarSet,cbExportOK,0][LoopExit]
                ]
            ,cbCell]
        ]
    ]
    [MemDelete,CB32Export]
    [If,[MemGetSize,CB32ExportCheck]>0,[MemDelete,CB32ExportCheck]]
    [If,cbExportOK==1,
        [If,[MVarGet,CB25Data,7]==1,
            [MessageOK,"Camera bank exported and read-back verified. Send it with the matching ZTL/ZPR saved AFTER the latest store/update. Keep CB name markers and merge only equal-visibility parts across ALL occupied cameras.","Camera Bank 25"]
        ,
            [MessageOK,"Camera bank exported and read-back verified. This bank is still UNTRACKED: it contains no reliable name ancestry. Review and UPDATE ACTIVE for every camera on the ORIGINAL unmerged Tool; tracking completes automatically after the last update.","Camera Bank 25"]
        ]
    ,
        [MessageOK,[StrMerge,"Export could not be verified (write result ",saveResult,"). Cameras were kept in memory. The selected destination may be incomplete; retry to a writable path."],"Camera Bank 25"]
    ]
]''')
    old=routine(camera,'CB29_ImportBank')
    put('CB29_ImportBank',old.replace('[If,[StrLength,cbFile]>0,','[If,[StrLength,cbFile]>0,\n        [RoutineCall,CB32_Recover]',1).replace('cbImportVersion<7','[MVarGet,CB25Data,7]==0').replace('Legacy bank imported. Old files contain no canvas size or explicit FOV. Recall each camera, set its canvas/lens, then UPDATE ACTIVE and export a new bank.',
        'Untracked bank: ancestry is unknown. On the ORIGINAL unmerged Tool, review and UPDATE ACTIVE for every camera. Tracking then completes automatically. Save the matching ZTL/ZPR and bank. Older banks may need canvas/lens corrections.'))

    # Editing/recall operations recover first. Import/export place recovery AFTER
    # file selection (and export overwrite approval), so cancel remains read-only.
    for name in ['CB29_SaveSlot','CB29_LoadSlot','CB29_ClearSlot','CB29_ClearAll','CB29_SlotClick','CB29_EnterStoreMode','CB29_EnterClearMode']:
        if '[RoutineDef,'+name+',' in camera:
            old=routine(camera,name)
            put(name,old.replace('[RoutineDef,'+name+',','[RoutineDef,'+name+',\n    [RoutineCall,CB32_Recover]',1))

    read=(ROOT/'Development/merge_visibility.inc').read_text(encoding='ascii')
    writer=(ROOT/'Development/merge_visibility_writer.inc').read_text(encoding='ascii')
    camera=read+'\n'+writer+'\n'+camera
    shared_globals=read[:read.index('[RoutineDef,')]
    shared_names=re.findall(r'\[RoutineDef,(\w+),',read)+['CB32_RestoreLegacyVisualState']
    return camera,shared_globals,shared_names
