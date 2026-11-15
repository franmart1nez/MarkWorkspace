[VarDef,cbFovPath,""]
[VarDef,cbUniversalPath,""]
// Data v8: groups describe identical effective visibility across all 25 views.
// Names carry CB<6-digit bank A><6-digit bank B>G<4-digit group>_.
// Each mask half is <=13 bits, so single-precision cells stay exact.
[VarDef,cbTrackValid,0]
[VarDef,cbTrackError,""]
[VarDef,cbTrackPrefix,""]
[VarDef,cbTrackName,""]
[VarDef,cbParsedGroup,0]
[VarDef,cbTagStart,-1]
[VarDef,cbTrackVisible,0]
[VarDef,cbTrackBit,1]
[VarDef,cbTrackHalf,0]
[VarDef,cbTrackGroups(1000),0]
[VarDef,cbTrackSeen(1000),0]
[VarDef,cbTrackEye(1000),0]
[RoutineDef,RC_CB31_Require3D,
    [If,([IsEnabled,"Transform:Edit"]==0)||([IGet,"Transform:Edit"]==0),
        [MessageOK,"No live 3D model is in Edit mode. Select your Tool, draw it on the canvas and press T (Edit), then try again. The camera has not been changed.","Camera Bank 25"]
        [Exit]
    ]
    [If,[SubToolGetCount]<1,
        [MessageOK,"No editable mesh was found. If this is a primitive or ZSphere, make a PolyMesh3D/adaptive skin first, then store the camera. Automatic conversion is avoided to preserve your Tool.","Camera Bank 25"]
        [Exit]
    ]
]

[RoutineDef,RC_CB30_LensPaths,
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

[RoutineDef,RC_CB30_Resize,
    [If,(cbW>0)&&(cbH>0),
        [If,(cbW>[IGetMax,"Document:Width"])||(cbH>[IGetMax,"Document:Height"]),
            [MessageOK,"Saved canvas size exceeds this ZBrush version's limits.","Camera Bank 25"]
            [Exit]
        ]
        [If,(cbW!=[IGet,"Document:Width"])||(cbH!=[IGet,"Document:Height"]),
            [RoutineCall,RC_CB31_Require3D]
            [VarSet,cbPro,[IGet,"Document:Pro"]]
            [If,[IExists,"Preferences:LightBox:LightBox"],
                [ISet,"Preferences:LightBox:LightBox",0]
            ]
            [VarSet,cbThumbnail,0]
            [If,[IExists,"Preferences:Thumbnail:T.Thumbnail"],
                [VarSet,cbThumbnail,[IGet,"Preferences:Thumbnail:T.Thumbnail"]]
                [IUnPress,"Preferences:Thumbnail:T.Thumbnail"]
            ]
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
            [RoutineCall,RC_CB31_Require3D]
        ]
    ]
,cbW,cbH]

[RoutineDef,RC_CB30_RestoreLens,
    [VarSet,cbBase,20 + (cbSlot*20)]
    [VarSet,cbExtra,25545 + (cbSlot*8)]
    [RoutineCall,RC_CB30_LensPaths]
    [If,[StrLength,cbUniversalPath]>0,
        [If,[MVarGet,CB25Data,cbExtra+2]>=0,[ISet,[Var,cbUniversalPath],[MVarGet,CB25Data,cbExtra+2]]]
    ]
    [RoutineCall,RC_CB30_LensPaths]
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

[RoutineDef,RC_CB32_Bit,
    [VarSet,cbTrackHalf,0][VarSet,cbBitSlot,cbSlot]
    [If,cbSlot>=13,[VarSet,cbTrackHalf,1][VarSet,cbBitSlot,cbSlot-13]]
    [VarSet,cbTrackBit,1]
    [Loop,cbBitSlot,[VarSet,cbTrackBit,cbTrackBit*2]]
,cbSlot]

[RoutineDef,RC_CB32_GroupVisible,
    [RoutineCall,RC_CB32_Bit,cbSlot]
    [VarSet,cbTrackVisible,0]
    [If,([MVarGet,CB25Data,25746+((cbGroup-1)*2)+cbTrackHalf]&cbTrackBit)!=0,
        [VarSet,cbTrackVisible,1]
    ]
,cbGroup,cbSlot]

[RoutineDef,RC_CB32_ReadName,
    [VarSet,cbTrackName,[IGetTitle,"Tool:ItemInfo"]]
    [If,[StrLength,cbTrackName]>0,
        [If,[StrToAsc,cbTrackName,[StrLength,cbTrackName]-1]==46,
            [VarSet,cbTrackName,[StrExtract,cbTrackName,0,[StrLength,cbTrackName]-2]]
        ]
    ]
]

[RoutineDef,RC_CB32_ParseTag,
    [VarSet,cbParsedGroup,0]
    [VarSet,cbTagStart,[StrFind,cbTrackPrefix,cbTagName]]
    [If,cbTagStart>=0,
        [If,[StrLength,cbTagName]>=(cbTagStart+20),
            [If,[StrToAsc,cbTagName,cbTagStart+19]==95,
                [VarSet,cbDigitsOK,1][VarSet,cbParsedGroup,0]
                [Loop,4,
                    [VarSet,cbDigit,[StrToAsc,cbTagName,cbTagStart+15+cbDigitIndex]-48]
                    [If,(cbDigit<0)||(cbDigit>9),[VarSet,cbDigitsOK,0]]
                    [VarSet,cbParsedGroup,(cbParsedGroup*10)+cbDigit]
                ,cbDigitIndex]
                [If,cbDigitsOK==0,[VarSet,cbParsedGroup,0]]
                [If,[StrLength,cbTagName]>(cbTagStart+20),
                    [VarSet,cbTail,[StrExtract,cbTagName,cbTagStart+20,[StrLength,cbTagName]-1]]
                    [If,[StrFind,cbTrackPrefix,cbTail]>=0,[VarSet,cbParsedGroup,0]]
                ]
            ]
        ]
    ]
,cbTagName]

[RoutineDef,RC_CB32_CheckTracked,
    [VarSet,cbTrackValid,1][VarSet,cbTrackError,""]
    [VarSet,cbTrackPrefix,[StrMerge,"CB",[MVarGet,CB25Data,8],[MVarGet,CB25Data,9],"G"]]
    [VarSet,cbOldSelected,[SubToolGetActiveIndex]]
    [If,([SubToolGetCount]<1)||([SubToolGetCount]>1000),
        [VarSet,cbTrackValid,0][VarSet,cbTrackError,"A tracked model must have 1 to 1000 SubTools."]
    ]
    [Loop,1000,[VarSet,cbTrackSeen(cbIndex),0],cbIndex]
    [If,cbTrackValid==1,
        [If,[MemGetSize,CB32ReadView]>0,[MemDelete,CB32ReadView]]
        [MVarDef,CB32ReadView,12,0][MTransformGet,CB32ReadView,0]
        [MVarSet,CB32ReadView,9,[CanvasZoomGet]]
        [MVarSet,CB32ReadView,10,[CanvasPanGetH]][MVarSet,CB32ReadView,11,[CanvasPanGetV]]
        [Loop,[SubToolGetCount],
            [SubToolSelect,cbIndex][RoutineCall,RC_CB32_ReadName]
            [RoutineCall,RC_CB32_ParseTag,cbTrackName]
            [If,(cbParsedGroup<1)||(cbParsedGroup>[MVarGet,CB25Data,25745]),
                [VarSet,cbTrackValid,0]
                [VarSet,cbTrackError,"A SubTool has no valid identifier for this bank. Open the matching prepared ZTL/ZPR and preserve the CB...G..._ name markers."]
                [LoopExit]
            ]
            [VarSet,cbTrackGroups(cbIndex),cbParsedGroup]
            [VarSet,cbTrackSeen(cbParsedGroup-1),1]
        ,cbIndex]
        [SubToolSelect,cbOldSelected]
        [MTransformSet,CB32ReadView,0][CanvasZoomSet,[MVarGet,CB32ReadView,9]]
        [CanvasPanSet,[MVarGet,CB32ReadView,10],[MVarGet,CB32ReadView,11]]
        [MemDelete,CB32ReadView]
    ]
    [VarSet,cbUsedLow,0][VarSet,cbUsedHigh,0]
    [Loop,25,
        [If,[MVarGet,CB25Data,20+(cbSlot*20)]==1,
            [RoutineCall,RC_CB32_Bit,cbSlot]
            [If,cbTrackHalf==0,[VarSet,cbUsedLow,cbUsedLow+cbTrackBit],[VarSet,cbUsedHigh,cbUsedHigh+cbTrackBit]]
        ]
    ,cbSlot]
    [If,cbTrackValid==1,
        [Loop,[MVarGet,CB25Data,25745],
            [If,cbTrackSeen(cbGroupIndex)==0,
                [VarSet,cbMissingLow,([MVarGet,CB25Data,25746+(cbGroupIndex*2)]&cbUsedLow)]
                [VarSet,cbMissingHigh,([MVarGet,CB25Data,25747+(cbGroupIndex*2)]&cbUsedHigh)]
                [If,(cbMissingLow!=0)||(cbMissingHigh!=0),
                    [VarSet,cbEquivalent,0]
                    [Loop,[MVarGet,CB25Data,25745],
                        [If,cbTrackSeen(cbOtherGroup)==1,
                            [If,(([MVarGet,CB25Data,25746+(cbOtherGroup*2)]&cbUsedLow)==cbMissingLow)&&(([MVarGet,CB25Data,25747+(cbOtherGroup*2)]&cbUsedHigh)==cbMissingHigh),
                                [VarSet,cbEquivalent,1][LoopExit]
                            ]
                        ]
                    ,cbOtherGroup]
                    [If,cbEquivalent==0,
                        [VarSet,cbTrackValid,0]
                        [VarSet,cbTrackError,"A visibility group used by a stored camera is missing. Restore the complete model and merge only parts with identical visibility in ALL stored cameras."]
                    ]
                ]
            ]
        ,cbGroupIndex]
    ]
]

[RoutineDef,RC_CB32_RequireVisibility,
    [If,([MemGetSize,CB32RenameState]>0)||([MemGetSize,CB32OriginalBank]>0),
        [MessageOK,"An identifier update was interrupted. Use a Camera Bank button on the same Tool to recover it before recalling or rendering.","Camera Bank 25"][Exit]
    ]
    [If,[MVarGet,CB25Data,7]==1,
        [RoutineCall,RC_CB32_CheckTracked]
        [If,cbTrackValid==0,[MessageOK,cbTrackError,"Camera Bank 25"][Exit]]
    ,
        [VarSet,cbSavedCount,[MVarGet,CB25Data,520+(cbSlot*1001)]]
        [If,(cbSavedCount>0)&&(cbSavedCount!=[SubToolGetCount]),
            [MessageOK,"This camera has positional visibility only. Use its original unmerged Tool, update the cameras, then PREPARE TRANSFER before merging.","Camera Bank 25"][Exit]
        ]
    ]
,cbSlot]

[RoutineDef,RC_CB32_VisibleNow,
    [VarSet,cbTrackVisible,0]
    [If,([SubToolGetStatus,cbIndex]&1)!=0,[VarSet,cbTrackVisible,1]]
    [VarSet,cbFolder,[SubToolGetFolderIndex,cbIndex]]
    [If,cbFolder>=0,
        [If,([SubToolGetStatus,cbFolder]&2)==0,[VarSet,cbTrackVisible,0]]
    ]
    [If,[IExists,"Transform:Solo"],
        [If,[IGet,"Transform:Solo"]==1,[VarSet,cbTrackVisible,0]]
    ]
    [If,cbIndex==[SubToolGetActiveIndex],[VarSet,cbTrackVisible,1]]
,cbIndex]

[RoutineDef,RC_CB32_RestoreEffective,
    [VarSet,cbOldSelected,[SubToolGetActiveIndex]][VarSet,cbFirstVisible,-1]
    [Loop,[SubToolGetCount],
        [If,[MVarGet,CB25Data,7]==1,
            [RoutineCall,RC_CB32_GroupVisible,cbTrackGroups(cbIndex),cbSlot]
        ,
            [VarSet,cbTrackVisible,0]
            [If,([MVarGet,CB25Data,521+(cbSlot*1001)+cbIndex]&4)!=0,[VarSet,cbTrackVisible,1]]
        ]
        [VarSet,cbTrackEye(cbIndex),cbTrackVisible]
        [If,(cbTrackVisible==1)&&(cbFirstVisible<0),[VarSet,cbFirstVisible,cbIndex]]
    ,cbIndex]
    [If,cbFirstVisible<0,[MessageOK,"No visible part remains for this camera.","Camera Bank 25"][Exit]]
    [If,cbTrackEye(cbOldSelected)==1,[VarSet,cbFirstVisible,cbOldSelected]]
    [If,[IExists,"Transform:Solo"],[IUnPress,"Transform:Solo"]]
    [SubToolSelect,cbFirstVisible]
    [Loop,[SubToolGetCount],
        [VarSet,cbStatus,[SubToolGetStatus,cbIndex]]
        [SubToolSetStatus,cbIndex,(cbStatus-(cbStatus&3))+cbTrackEye(cbIndex)+2]
    ,cbIndex]
    [IUpdate,1,1]
,cbSlot]

[RoutineDef,RC_CB32_RestoreLegacyVisualState,
    [VarSet,visBase,
        520 + (slot * 1001)
    ]
    [VarSet,savedCount,
        [MVarGet,CB25Data,visBase]
    ]
    [VarSet,currentCount,
        [SubToolGetCount]
    ]
    [If,
        (savedCount > 0)
        &&
        (savedCount == currentCount),
        [VarSet,st,0]
        [Loop,savedCount,
            [VarSet,savedState,
                [MVarGet,
                    CB25Data,
                    visBase + 1 + st
                ]
            ]
            [VarSet,savedEye,
                (savedState & 0x01)
            ]
            [VarSet,currentStatus,
                [SubToolGetStatus,st]
            ]
            [VarSet,currentEye,
                (currentStatus & 0x01)
            ]
            [SubToolSetStatus,
                st,
                (currentStatus - currentEye) + savedEye
            ]
            [VarInc,st]
        ]
        [VarSet,st,0]
        [Loop,savedCount,
            [VarSet,savedState,
                [MVarGet,
                    CB25Data,
                    visBase + 1 + st
                ]
            ]
            [VarSet,savedFolderEye,
                (savedState & 0x02)
            ]
            [VarSet,currentStatus,
                [SubToolGetStatus,st]
            ]
            [VarSet,currentFolderEye,
                (currentStatus & 0x02)
            ]
            [SubToolSetStatus,
                st,
                (currentStatus - currentFolderEye) + savedFolderEye
            ]
            [VarInc,st]
        ]
        [IUpdate,1,1]
    ]
,slot]

[RoutineDef,RC_CB29_RestoreVisualState,
    [If,([MVarGet,CB25Data,7]==1)||([MVarGet,CB25Data,27746+slot]>0),
        [RoutineCall,RC_CB32_RestoreEffective,slot]
    ,
        [RoutineCall,RC_CB32_RestoreLegacyVisualState,slot]
    ]
,slot]

[RoutineDef,RC_CB29_LoadSlot,
    
    [VarSet,base,20+(slot*20)]
    [If,[MVarGet,CB25Data,base]!=1,[Exit]]
    [RoutineCall,RC_CB31_Require3D]
    [RoutineCall,RC_CB32_RequireVisibility,slot]
    [If,([MVarGet,CB25Data,base+18]==0)&&([MVarGet,CB25Data,25546+(slot*8)]==0),
        [Loop,6,[MVarSet,CB25Data,25547+(slot*8)+cbUnknown,-1],cbUnknown]
    ]
    [VarSet,cbLock,0]
    [If,[IExists,"Draw:Lock Camera"],
        [VarSet,cbLock,[IGet,"Draw:Lock Camera"]]
        [IUnPress,"Draw:Lock Camera"]
    ]
    [RoutineCall,RC_CB30_Resize,[MVarGet,CB25Data,base+18],[MVarGet,CB25Data,base+19]]
    [RoutineCall,RC_CB30_RestoreLens,slot]
    [RoutineCall,RC_CB29_RestoreVisualState,slot]
    [MTransformSet,CB25Data,base+1]
    [CanvasZoomSet,[MVarGet,CB25Data,base+12]]
    [CanvasPanSet,[MVarGet,CB25Data,base+13],[MVarGet,CB25Data,base+14]]
    [If,[IExists,"Draw:Lock Camera"],[ISet,"Draw:Lock Camera",cbLock]]
    [MVarSet,CB25Data,5,slot+1]
    [IUpdate,2,1]
,slot]