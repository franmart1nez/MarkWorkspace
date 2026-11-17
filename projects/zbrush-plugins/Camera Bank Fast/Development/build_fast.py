"""Build an isolated Camera Bank Fast from the reviewed Camera Bank source.

The standard plugin and its shared render/ID reader are never rewritten.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'Development/standard_camera_baseline.txt'
OUTPUT = ROOT / 'CameraBankFast25.txt'


def routine(text, name):
    start = text.index('[RoutineDef,' + name + ',')
    depth = 0
    quoted = False
    for end in range(start, len(text)):
        char = text[end]
        if char == '"': quoted = not quoted
        if not quoted:
            if char == '[': depth += 1
            if char == ']':
                depth -= 1
                if depth == 0: return text[start:end + 1]
    raise ValueError(name)


def compose(isolate=True):
    source = BASE.read_text(encoding='ascii')
    def put(name, text):
        nonlocal source
        source = source.replace(routine(source, name), text)

    # Keep full validation/recovery for cold binding and structural changes.
    for old, new in [('CB32_CheckTracked', 'CBF_FullCheck'),
                     ('CB32_BeginTransaction', 'CBF_FullBegin'),
                     ('CB32_Recover', 'CBF_FullRecover')]:
        text = routine(source, old)
        put(old, text.replace('[RoutineDef,' + old + ',', '[RoutineDef,' + new + ',', 1))

    # Full initialization also needs exact uint32 recovery IDs; native mesh
    # IDs cannot safely be stored as one single-precision float.
    text = routine(source, 'CBF_FullBegin')
    text = text.replace('    [Loop,[SubToolGetCount],',
                        '    [If,[MemGetSize,CBFFullIDs]>0,[MemDelete,CBFFullIDs]]\n'
                        '    [MVarDef,CBFFullIDs,[SubToolGetCount]*2,0]\n'
                        '    [Loop,[SubToolGetCount],', 1)
    text = text.replace('        [MVarSet,CB32RenameState,4+(cbIndex*2),[SubToolGetID,cbIndex]]',
                        '        [VarSet,fxID,[SubToolGetID,cbIndex]][VarSet,fxHi,INT(fxID/65536)]\n'
                        '        [MVarSet,CBFFullIDs,cbIndex*2,fxID-(fxHi*65536)]\n'
                        '        [MVarSet,CBFFullIDs,(cbIndex*2)+1,fxHi]')
    put('CBF_FullBegin', text)
    text = routine(source, 'CBF_FullRecover')
    text = text.replace('            [If,[SubToolGetID,cbIndex]!=[MVarGet,CB32RenameState,4+(cbIndex*2)],',
                        '            [VarSet,fxID,[SubToolGetID,cbIndex]][VarSet,fxHi,INT(fxID/65536)]\n'
                        '            [If,((fxID-(fxHi*65536))!=[MVarGet,CBFFullIDs,cbIndex*2])||(fxHi!=[MVarGet,CBFFullIDs,(cbIndex*2)+1]),')
    put('CBF_FullRecover', text)
    text = routine(source, 'CB32_Cleanup')
    put('CB32_Cleanup', text.replace('[RoutineDef,CB32_Cleanup,',
                                    '[RoutineDef,CB32_Cleanup,\n    [If,[MemGetSize,CBFFullIDs]>0,[MemDelete,CBFFullIDs]]', 1))

    text = routine(source, 'CB32_RefreshIdentifiers')
    a = text.index('        [VarSet,cbMatch,0]')
    b = text.index('        [MVarSet,CB32NewGroups,cbIndex,cbMatch]', a)
    text = text[:a] + '''        [VarSet,cbMatch,cbIndex+1]
        [VarSet,cbGroups,[SubToolGetCount]]
        [MVarSet,CB32Stage,25746+(cbIndex*2),cbLow]
        [MVarSet,CB32Stage,25747+(cbIndex*2),cbHigh]
''' + text[b:]
    text = text.replace('[RoutineDef,CB32_RefreshIdentifiers,', '[RoutineDef,CBF_FullRefresh,', 1)
    text = text.replace('    [MVarSet,CB32RenameState,3,2]',
                        '    [Loop,[SubToolGetCount],[VarSet,cbTrackGroups(cbIndex),[MVarGet,CB32NewGroups,cbIndex]],cbIndex]\n'
                        '    [RoutineCall,CBF_Publish]\n    [MVarSet,CB32RenameState,3,2]')
    put('CB32_RefreshIdentifiers', text)

    text = routine(source, 'CB32_RebaseForEdit')
    text = text.replace('    [RoutineCall,CB32_BeginTransaction]',
                        '    [RoutineCall,CBF_CanFastWrite]\n    [RoutineCall,CB32_BeginTransaction]')
    put('CB32_RebaseForEdit', text)
    for name, prefix in [('CB29_SaveSlot', '[VarSet,fxStoreCheck,1][VarSet,fxWriteFast,0]'),
                         ('CB29_LoadSlot', '[VarSet,fxStoreCheck,0]')]:
        text = routine(source, name)
        text = text.replace('[RoutineDef,' + name + ',', '[RoutineDef,' + name + ',\n    ' + prefix, 1)
        if name == 'CB29_SaveSlot':
            text = text.replace('[RoutineCall,CB32_FinishStore]', '[RoutineCall,CB32_FinishStore]\n    [VarSet,fxStoreCheck,0]')
            text = text.replace('[Note,[StrMerge,"Camera ",displaySlot," stored | Render ",cbKeepRender,". Save the matching ZTL/ZPR and bank."],,2]',
                                '[NoteBar,[StrMerge,"Camera ",displaySlot," stored | Render ",cbKeepRender,". Save the matching ZTL/ZPR and bank."],1]')
        put(name, text)
    # The inherited slot callbacks wait two seconds to show every recall /
    # render-flag notice. Keep the same text as a nonblocking status message.
    text = routine(source, 'CB29_SlotClick')
    text, notices = re.subn(r'\[Note,\s*(\[StrMerge,.*?\]),\s*,\s*2\s*\]',
                            r'[NoteBar,\1,1]', text, flags=re.S)
    if notices != 4:
        raise ValueError('Review the inherited slot notice contract before building Fast.')
    put('CB29_SlotClick', text)
    text = routine(source, 'CB29_CreateEmptyBank')
    put('CB29_CreateEmptyBank', text.replace('[RoutineDef,CB29_CreateEmptyBank,',
                                           '[RoutineDef,CB29_CreateEmptyBank,\n    [RoutineCall,CBF_Invalidate]', 1))
    # A cold import (including the same bank nonce) must never reuse a binding.
    text = routine(source, 'CB29_ClearSlot')
    put('CB29_ClearSlot', text.replace('[RoutineDef,CB29_ClearSlot,',
                                     '[RoutineDef,CB29_ClearSlot,\n    [RoutineCall,CBF_Invalidate]', 1))
    # Keep the owner's silent-replacement preference: the native file chooser
    # already selects the destination, and the verified write uses overwrite=1.
    text = routine(source, 'CB29_ExportBank')
    a = text.index('    [If,[FileExists,saveFile]==1,')
    b = text.index('    [RoutineCall,CB32_Recover]', a)
    put('CB29_ExportBank', text[:a] + text[b:])
    # Share the normal camera capture with the batch VWS transaction. Capturing
    # does not move the view; the importer replaces only its nine transform cells.
    text = routine(source, 'CB29_SaveSlot')
    a = text.index('    [MTransformGet,')
    b = text.index('    [RoutineCall,CB32_FinishStore]', a)
    capture = ('[RoutineDef,CBV_CaptureSlot,\n'
               '    [VarSet,base,20+(slot*20)][VarSet,displaySlot,slot+1]\n'
               + text[a:b] + '\n,slot,cbKeepRender]\n')
    put('CB29_SaveSlot', text[:a] + '    [RoutineCall,CBV_CaptureSlot,slot,cbKeepRender]\n' + text[b:])
    source = ((ROOT / 'Development/fast.inc').read_text(encoding='ascii') + '\n'
              + capture + '\n' + (ROOT / 'Development/vws.inc').read_text(encoding='ascii')
              + '\n' + source)
    source += '\n[IButton,"ZPlugin:Camera Bank 25:RESCAN MODEL","Revalidate every name after external identifier edits. Structural changes are detected automatically.",[RoutineCall,CBF_Rescan],,1]\n'
    source += '\n[IButton,"ZPlugin:Camera Bank 25:IMPORT VWS","Append native ZAppLink views to free slots with Render ON. Uses current canvas, lens and visibility.",[RoutineCall,CBV_ImportVWS],,1]\n'
    # ZBrush orders palette controls by declaration. Insert these before slot 01.
    first_slot = '[ISwitch,"ZPlugin:Camera Bank 25:01"'
    controls = '''[RoutineDef,CBF_SetAllRender,
    [RoutineCall,CB32_Recover]
    [Loop,25,
        [VarSet,bulkBase,20+(bulkSlot*20)]
        [If,[MVarGet,CB25Data,bulkBase]==1,
            [MVarSet,CB25Data,bulkBase+16,bulkRender]
        ]
    ,bulkSlot]
    [RoutineCall,CB29_SyncVisuals]
,bulkRender]
[IButton,"ZPlugin:Camera Bank 25:Desactivar todas las camaras","Set Render OFF for every stored camera.",[RoutineCall,CBF_SetAllRender,0],,1]
[IButton,"ZPlugin:Camera Bank 25:Activar todas las camaras","Set Render ON for every stored camera.",[RoutineCall,CBF_SetAllRender,1],,1]
'''
    if source.count(first_slot) != 1:
        raise ValueError('Expected exactly one first camera switch.')
    source = source.replace(first_slot, controls + first_slot, 1)
    if isolate:
        # Keep file-format magic/name markers compatible, but isolate every
        # code identifier, session block, palette and installed dependency.
        def token(match):
            word = match[0]
            if word.startswith(('"', '//')): return word
            if word.startswith('CB'): return 'FB' + word[2:]
            if word.startswith('cb'): return 'fb' + word[2:]
            return word
        source = re.sub(r'"[^"\n]*"|//[^\n]*|\b[A-Za-z_]\w*\b', token, source)
        source = source.replace('ZPlugin:Camera Bank 25', 'ZPlugin:Camera Bank Fast')
        source = source.replace('"Camera Bank 25"', '"Camera Bank Fast"')
        source = source.replace('MakCameraBankData/', 'MakCameraBankFastData/')
        source = source.replace('CameraBank25_v3_2.zcv', 'CameraBankFast25_v0_3.zcv')
        source = source.replace('Export Camera Bank 25 v3.2.1', 'Export Camera Bank Fast 0.3')
    return ('// Camera Bank Fast 0.3 - active VWS imports and bulk render flags. Data v9.\n'
            '// First binding / structural edits may inspect all SubTools.\n'
            '// Routine saves use stable per-mesh markers; see README.txt.\n' + source)


if __name__ == '__main__':
    OUTPUT.write_text(compose(), encoding='ascii', newline='\n')
    print(f'Built {OUTPUT.name}: {OUTPUT.stat().st_size} bytes.')
