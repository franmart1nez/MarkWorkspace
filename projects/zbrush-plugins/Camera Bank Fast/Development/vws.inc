// Native ZAppLink .vws: eight records of ten float32 cells, little endian.
// Order: Front, Back, Rght, Left, Top, Botm, Cust1, Cust2. Cell 9 is occupied.
// No external executable, native ZAppLink replacement or filename lens guessing.
[VarDef,vwsSources(8),0]
[VarDef,vwsSlots(8),0]
[VarDef,vwsImported,0]
[RoutineDef,CBV_Reject,
    [If,[MemGetSize,CBVInput]>0,[MemDelete,CBVInput]]
    [MessageOK,vwsError,"Camera Bank Fast"][Exit]
,vwsError]
[RoutineDef,CBV_AcceptVWS,
    [VarSet,vwsImported,0]
    [If,[MemGetSize,CBVInput]!=320,
        [RoutineCall,CBV_Reject,"Unsupported VWS layout. Expected the native 320-byte ZAppLink views file. Current cameras were kept."]
    ]
    [VarSet,vwsCount,0]
    [Loop,8,
        [VarSet,vwsFlag,[MVarGet,CBVInput,(vwsI*10)+9]]
        [If,(vwsFlag!=0)&&(vwsFlag!=1),
            [RoutineCall,CBV_Reject,"Invalid VWS view flag. Current cameras were kept."]
        ]
        [If,vwsFlag==1,
            [Loop,9,
                [VarSet,vwsValue,[MVarGet,CBVInput,(vwsI*10)+vwsJ]]
                [If,(vwsValue>=-100000000)&&(vwsValue<=100000000),,
                    [RoutineCall,CBV_Reject,"Invalid VWS transform (non-finite or out of range). Current cameras were kept."]
                ]
                [If,(vwsJ>=3)&&(vwsJ<=5),
                    [If,vwsValue<=0,[RoutineCall,CBV_Reject,"Invalid VWS view scale. Current cameras were kept."]]
                ]
            ,vwsJ]
            [VarSet,vwsSources(vwsCount),vwsI][VarInc,vwsCount]
        ]
    ,vwsI]
    [If,vwsCount==0,[RoutineCall,CBV_Reject,"This VWS file contains no stored views. Current cameras were kept."]]
    [RoutineCall,CB31_Require3D]
    [If,[SubToolGetCount]>1000,[RoutineCall,CBV_Reject,"Camera Bank Fast supports up to 1000 SubTools."]]
    [RoutineCall,CB32_Recover]
    [VarSet,vwsFree,0][VarSet,vwsOccupied,0]
    [Loop,25,
        [If,[MVarGet,CB25Data,20+(vwsI*20)]==1,
            [VarInc,vwsOccupied]
        ,
            [If,vwsFree<vwsCount,[VarSet,vwsSlots(vwsFree),vwsI][VarInc,vwsFree]]
        ]
    ,vwsI]
    [If,vwsFree<vwsCount,[RoutineCall,CBV_Reject,"Not enough free camera slots for this entire VWS set. Export your bank or free slots, then retry. No cameras were replaced."]]
    [If,(vwsOccupied>0)&&([MVarGet,CB25Data,7]!=1),
        [RoutineCall,CBV_Reject,"Review and UPDATE ACTIVE for every untracked legacy camera before adding VWS views, or start an empty bank."]
    ]
    [VarSet,vwsActive,[MVarGet,CB25Data,5]]
    [VarSet,currentSubCount,[SubToolGetCount]]
    [VarSet,fxStoreCheck,1][VarSet,fxWriteFast,0]
    [If,[MVarGet,CB25Data,7]==1,
        [RoutineCall,CB32_RebaseForEdit]
    ,
        [RoutineCall,CB32_BeginTransaction]
    ]
    // One existing recoverable writer transaction covers the complete batch,
    // including initial model binding. No native view or document is changed.
    [Loop,vwsCount,
        [RoutineCall,CBV_CaptureSlot,vwsSlots(vwsI),1]
        [VarSet,base,20+(vwsSlots(vwsI)*20)]
        [MemCopy,CBVInput,vwsSources(vwsI)*40,CB25Data,(base+1)*4,36]
        [MVarSet,CB25Data,base+1,[MVarGet,CB25Data,base+1]*[IGet,"Document:Width"]]
        [MVarSet,CB25Data,base+2,[MVarGet,CB25Data,base+2]*[IGet,"Document:Height"]]
        [Loop,3,
            [MVarSet,CB25Data,base+4+vwsJ,[MVarGet,CB25Data,base+4+vwsJ]*[IGet,"Document:Width"]]
        ,vwsJ]
    ,vwsI]
    [MVarSet,CB25Data,5,vwsActive]
    [RoutineCall,CB32_FinishStore]
    [VarSet,fxStoreCheck,0]
    [VarSet,vwsImported,vwsCount]
    [MemDelete,CBVInput]
    [RoutineCall,CB29_SyncVisuals]
]
[RoutineDef,CBV_ImportVWS,
    [VarSet,vwsImported,0]
    [VarSet,vwsFile,[FileNameAsk,"ZAppLink Views (*.vws)|*.vws||",,"Import native ZBrush views"]]
    [If,[StrLength,vwsFile]==0,[Exit]]
    [If,[MemGetSize,CBVInput]>0,[MemDelete,CBVInput]]
    [MemCreateFromFile,CBVInput,vwsFile]
    [RoutineCall,CBV_AcceptVWS]
    [MessageOK,[StrMerge,vwsImported," VWS views added to free slots with Render ON. Current canvas, lens and visibility were used. To adjust a view, recall it and press UPDATE ACTIVE after editing. Save the matching ZTL/ZPR and EXPORT BANK."],"Camera Bank Fast"]
]
