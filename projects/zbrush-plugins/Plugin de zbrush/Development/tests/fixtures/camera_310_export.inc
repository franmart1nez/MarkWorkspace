// Frozen verbatim routines from source baseline 1d3ebe2 (Camera Bank 3.1.0).
// Used ONLY by offline regressions; never loaded into ZBrush.
[RoutineDef,CB29_ExportBank,
    [RoutineCall,CB32_Recover]
    [MVarSet,CB25Data,1,8]
    [MVarSet,CB25Data,3,0]
    [MVarSet,CB25Data,4,0]
    [MVarSet,CB25Data,6,0]
    [VarSet,exSlot,0]
    [Loop,25,
        [VarSet,exBase,
            20 + (exSlot * 20)
        ]
        [MVarSet,
            CB25Data,
            exBase + 17,
            0
        ]
        [VarInc,exSlot]
    ]
    [VarSet,saveFile,
        [FileNameAsk,
            "Camera Bank (*.zcv)|*.zcv||",
            "CameraBank25_v3_1.zcv",
            "Export Camera Bank 25 v3.1"
        ]
    ]
    [If,[StrLength,saveFile] > 0,
        [RoutineCall,CB31_Require3D]
        [If,[MVarGet,CB25Data,7]==0,
            [RoutineCall,CB32_PrepareTransfer]
        ,
            [RoutineCall,CB32_CheckTracked]
            [If,cbTrackValid==0,[MessageOK,cbTrackError,"Camera Bank 25"][Exit]]
        ]
        [VarSet,saveResult,
            [MemSaveToFile,
                CB25Data,
                saveFile,
                1
            ]
        ]
        [If,saveResult > 0,
            [MessageOK,
                "Camera bank exported. Save the prepared ZTL/ZPR and send BOTH files together. Keep name identifiers and merge only equal-visibility parts across ALL cameras.",
                "Camera Bank 25"
            ]
        ,
            [MessageOK,
                "Could not export Camera Bank.",
                "Camera Bank 25"
            ]
        ]
    ]
]
[RoutineDef,CB32_PrepareTransfer,
    [VarSet,cbCameraCount,0]
    [Loop,25,
        [If,[MVarGet,CB25Data,20+(cbSlot*20)]==1,
            [VarInc,cbCameraCount]
            [If,[MVarGet,CB25Data,27746+cbSlot]!=[SubToolGetCount],
                [RoutineCall,CB32_Fail,"A camera has no current effective-visibility snapshot. Recall and UPDATE ACTIVE on the ORIGINAL unmerged Tool before preparing this bank."]
            ]
        ]
    ,cbSlot]
    [If,cbCameraCount==0,[RoutineCall,CB32_Fail,"Store at least one camera before preparing a transfer."]]
    [If,[MemGetSize,CB32RenameState]==0,[RoutineCall,CB32_BeginTransaction]]
    [MemCreate,CB32Stage,111084,0][MemCopy,CB25Data,0,CB32Stage,0,111084]
    [MVarDef,CB32NewGroups,[SubToolGetCount],0]
    [VarSet,cbGroups,0]
    [Loop,[SubToolGetCount],
        [VarSet,cbLow,0][VarSet,cbHigh,0]
        [Loop,25,
            [If,[MVarGet,CB25Data,20+(cbSlot*20)]==1,
                [If,([MVarGet,CB25Data,521+(cbSlot*1001)+cbIndex]&4)!=0,
                    [RoutineCall,CB32_Bit,cbSlot]
                    [If,cbTrackHalf==0,[VarSet,cbLow,cbLow+cbTrackBit],[VarSet,cbHigh,cbHigh+cbTrackBit]]
                ]
            ]
        ,cbSlot]
        [VarSet,cbMatch,0]
        [Loop,cbGroups,
            [If,([MVarGet,CB32Stage,25746+(cbGroup*2)]==cbLow)&&([MVarGet,CB32Stage,25747+(cbGroup*2)]==cbHigh),
                [VarSet,cbMatch,cbGroup+1][LoopExit]
            ]
        ,cbGroup]
        [If,cbMatch==0,
            [MVarSet,CB32Stage,25746+(cbGroups*2),cbLow]
            [MVarSet,CB32Stage,25747+(cbGroups*2),cbHigh]
            [VarInc,cbGroups][VarSet,cbMatch,cbGroups]
        ]
        [MVarSet,CB32NewGroups,cbIndex,cbMatch]
    ,cbIndex]
    [VarSet,cbBankA,100000+IRAND(899999)][VarSet,cbBankB,100000+IRAND(899999)]
    [If,(cbBankA==[MVarGet,CB25Data,8])&&(cbBankB==[MVarGet,CB25Data,9]),
        [If,cbBankB<999999,[VarInc,cbBankB],[VarSet,cbBankB,100000]]
    ]
    [MVarSet,CB32Stage,7,1][MVarSet,CB32Stage,8,cbBankA][MVarSet,CB32Stage,9,cbBankB]
    [MVarSet,CB32Stage,25745,cbGroups]
    [Loop,[SubToolGetCount],
        [NoteBar,"Preparing camera visibility identifiers",cbIndex/[SubToolGetCount]]
        [SubToolSelect,cbIndex][RoutineCall,CB32_ReadName][RoutineCall,CB32_StripTag]
        [If,([StrLength,cbBaseName]<1)||([StrLength,cbBaseName]>235),
            [RoutineCall,CB32_Fail,"A SubTool name cannot accommodate its 20-character identifier without truncation. Shorten its human-readable name and retry."]
        ]
        [VarSet,cbGroupText,[StrMerge,10000+[MVarGet,CB32NewGroups,cbIndex]]]
        [VarSet,cbGroupText,[StrExtract,cbGroupText,1,4]]
        [VarSet,cbWriteName,[StrMerge,"CB",cbBankA,cbBankB,"G",cbGroupText,"_",cbBaseName]]
        [RoutineCall,CB32_Rename]
        [If,cbRenameOK==0,[RoutineCall,CB32_Fail,"Could not verify a SubTool identifier. Previous names and camera bank were restored."]]
    ,cbIndex]
    [Loop,[SubToolGetCount],[SubToolSetStatus,cbIndex,[MVarGet,CB32RenameState,5+(cbIndex*2)]],cbIndex]
    [SubToolSelect,[MVarGet,CB32RenameState,1]]
    [RoutineCall,CB32_RestoreEditingView]
    [MemCopy,CB32Stage,0,CB25Data,0,111084]
    [MVarSet,CB32RenameState,3,2]
    [RoutineCall,CB32_Cleanup]
]
