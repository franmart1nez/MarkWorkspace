"""Camera 3.2 source regressions with real temporary bank files; no native app."""
from pathlib import Path
import re
import struct
import tempfile
import unittest

from verify import Host, Exit, ROOT, parse, clean, node
from verify_merge import parts, get


class Camera320(unittest.TestCase):
    def host(self):
        h=Host();h.load(ROOT/'Development/tests/fixtures/legacy_camera_321.txt');return h

    def legacy(self):
        h=self.host();h.call('CB29_SaveSlot',0);h.call('CB29_SaveSlot',1)
        data=bytearray(h.mem['CB25Data'][:102980]);struct.pack_into('<f',data,4,7)
        h.mem['CB29ImportTemp']=data;h.call('CB30_AcceptImport',len(data))
        return h

    def button(self,h,label):
        node=next(n for n in parse((ROOT/'Development/tests/fixtures/legacy_camera_321.txt').read_text())
                  if n[0]=='IButton' and n[1].strip('"').endswith(':'+label))
        h.run(node[3])

    def normalized(self,h):
        data=bytearray(h.mem['CB25Data'])
        struct.pack_into('<f',data,4,9)
        for index in [3,4,6]+[20+s*20+17 for s in range(25)]:
            struct.pack_into('<f',data,index*4,0)
        return bytes(data)

    def test_no_prepare_button_and_first_store_immediately_tracks_duplicate_names(self):
        h=self.host();parts(h,['Same','Same','Same'],[1,0,1])
        h.call('CB29_SaveSlot',0)
        self.assertEqual(get(h,7),1)
        self.assertEqual(h.names[0][:20],h.names[2][:20])
        self.assertNotEqual(h.names[0][:20],h.names[1][:20])
        self.assertTrue(all(n[20:]=='Same' for n in h.names))
        self.assertNotIn('PREPARE TRANSFER',(ROOT/'Development/tests/fixtures/legacy_camera_321.txt').read_text())
        parts(h,[h.names[1],h.names[2],h.names[0]])
        h.call('CB29_LoadSlot',0)
        self.assertEqual([s&1 for s in h.status],[0,1,1])

    def test_gray_camera_update_button_preserves_flag_and_other_camera_after_reorder(self):
        h=self.host();parts(h,['Body','Trim','Trim'],[1,0,0])
        h.call('CB29_SaveSlot',0)
        h.status=[0,1,1];h.st=1;h.call('CB29_SaveSlot',1)
        h.cmd(['MVarSet','CB25Data','56','0'])
        names=h.names[:];parts(h,[names[2],names[0],names[1]])
        h.call('CB29_LoadSlot',1)
        h.status=[1,1,0];h.st=0
        self.button(h,'UPDATE ACTIVE')
        self.assertEqual(get(h,56),0)
        h.call('CB29_LoadSlot',0);self.assertEqual([s&1 for s in h.status],[0,1,0])
        h.call('CB29_LoadSlot',1);self.assertEqual([s&1 for s in h.status],[1,1,0])
        self.assertEqual(get(h,27747),3)

    def test_human_rename_is_allowed_but_missing_added_and_mixed_markers_are_rejected(self):
        for mode in ['human','removed','added','foreign_plus_current','malformed_plus_current']:
            with self.subTest(mode=mode):
                h=self.host();h.call('CB29_SaveSlot',0)
                if mode=='human':h.names[1]=h.names[1][:20]+'Renamed decoration'
                if mode=='removed':h.names[1]='Renamed decoration'
                if mode=='added':parts(h,h.names+['New part'])
                if mode=='foreign_plus_current':h.names[1]='CB000000000000G0001_'+h.names[1]
                if mode=='malformed_plus_current':h.names[1]+='CB123456654321Gxxxx_'
                if mode=='human':
                    h.call('CB29_LoadSlot',0);h.call('CB29_SaveSlot',1)
                    self.assertTrue(h.names[1].endswith('Renamed decoration'));continue
                bank=bytes(h.mem['CB25Data']);status=h.status[:];names=h.names[:]
                for action in ['CB29_LoadSlot','CB29_SaveSlot']:
                    with self.assertRaises(Exit):h.call(action,0)
                    self.assertEqual(bytes(h.mem['CB25Data']),bank)
                    self.assertEqual(h.status,status);self.assertEqual(h.names,names)

    def test_deleted_hidden_group_is_allowed_visible_missing_group_is_rejected(self):
        h=self.host();parts(h,['Visible','Hidden'],[1,0]);h.call('CB29_SaveSlot',0)
        parts(h,[h.names[0]]);h.call('CB29_LoadSlot',0)
        self.assertEqual(h.status[0]&1,1)
        h=self.host();parts(h,['A','B'],[1,0]);h.call('CB29_SaveSlot',0)
        h.st=1;h.status=[0,1];h.call('CB29_SaveSlot',1)
        parts(h,[h.names[0]])
        with self.assertRaises(Exit):h.call('CB29_LoadSlot',1)

    def test_frozen_310_export_blockers_reproduce_and_320_exports_same_banks(self):
        fixture=ROOT/'Development/tests/fixtures/camera_310_export.inc'
        for mode in ['legacy_unreviewed','edit_off','rename_dll_missing']:
            with self.subTest(mode=mode),tempfile.TemporaryDirectory() as d:
                h=self.legacy() if mode!='edit_off' else self.host()
                if mode=='edit_off':h.call('CB29_SaveSlot',0);h.ui['Transform:Edit']=0
                if mode=='rename_dll_missing':
                    # 3.1 fresh/unprepared v8 captures had ready bits but no
                    # identifiers yet. Isolate the DLL dependency from legacy.
                    h.cmd(['MVarSet','CB25Data','27746','2'])
                    h.cmd(['MVarSet','CB25Data','27747','2'])
                    original=h.cmd
                    def cmd(n):
                        if n[0]=='FileExists' and h.e(n[1]).endswith('.dll'):return 0
                        return original(n)
                    h.cmd=cmd
                new_export=h.routines['CB29_ExportBank']
                h.load(fixture);h.ask=str(Path(d)/'bank.zcv')
                with self.assertRaises(Exit):h.call('CB29_ExportBank')
                self.assertFalse(Path(h.ask).exists())
                expected={'legacy_unreviewed':'snapshot','edit_off':'Edit mode',
                          'rename_dll_missing':'ZFileUtils64.dll'}[mode]
                self.assertIn(expected,h.messages[-1])
                h.routines['CB29_ExportBank']=new_export
                before=bytes(h.mem['CB25Data']);h.call('CB29_ExportBank')
                self.assertEqual(Path(h.ask).read_bytes(),self.normalized(h))
                self.assertEqual(bytes(h.mem['CB25Data']),before)
                self.assertIn('read-back verified',h.messages[-1])

    def test_real_export_roundtrip_all_25_occupied_including_gray_and_lens(self):
        h=self.host()
        for slot in range(25):
            h.status=[1,slot%2];h.st=0
            h.transform=[slot+i/4 for i in range(9)]
            h.ui.update({'Document:Width':1000+slot,'Document:Height':700+slot,
                         'Draw:Field Of View(deg)':30+slot,'Draw:Focal Length(mm)':40+slot})
            h.call('CB29_SaveSlot',slot)
            h.cmd(['MVarSet','CB25Data',str(36+slot*20),str(slot%2)])
        with tempfile.TemporaryDirectory() as d:
            h.ask=str(Path(d)/'all.zcv');before=bytes(h.mem['CB25Data'])
            self.button(h,'EXPORT BANK')
            self.assertEqual(Path(h.ask).read_bytes(),self.normalized(h))
            self.assertEqual(len(Path(h.ask).read_bytes()),123088)
            self.assertEqual(bytes(h.mem['CB25Data']),before)
            r=self.host();parts(r,h.names[::-1]);r.ask=h.ask;self.button(r,'IMPORT BANK')
            for slot in range(25):
                self.assertEqual(get(r,20+slot*20),1)
                self.assertEqual(get(r,36+slot*20),slot%2)
                r.call('CB29_LoadSlot',slot)
                self.assertEqual(r.dims,[1000+slot,700+slot])
                self.assertEqual(r.ui['Draw:Field Of View(deg)'],30+slot)
                self.assertEqual(r.ui['Draw:Focal Length(mm)'],40+slot)
                self.assertEqual(r.transform,[slot+i/4 for i in range(9)])
                self.assertEqual([s&1 for s in r.status],[slot%2,1])

    def test_cancel_export_import_and_declined_overwrite_preserve_exact_bank(self):
        h=self.host();h.call('CB29_SaveSlot',0)
        h.cmd(['MVarSet','CB25Data','3','1']);h.cmd(['MVarSet','CB25Data','6','1'])
        before=bytes(h.mem['CB25Data']);names=h.names[:]
        h.ask=''
        with self.assertRaises(Exit):self.button(h,'EXPORT BANK')
        self.button(h,'IMPORT BANK')
        self.assertEqual(bytes(h.mem['CB25Data']),before);self.assertEqual(h.names,names)
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'original.zcv';path.write_bytes(b'original user data')
            h.ask=str(path);h.answer=0
            with self.assertRaises(Exit):self.button(h,'EXPORT BANK')
            self.assertEqual(path.read_bytes(),b'original user data')
            self.assertEqual(bytes(h.mem['CB25Data']),before)
            h.answer=1;self.button(h,'EXPORT BANK')
            self.assertEqual(path.read_bytes(),self.normalized(h))

    def test_export_failures_never_report_success_or_mutate_live_cameras(self):
        for mode in ['unwritable','short_write','lying_write','read_error','read_corruption']:
            with self.subTest(mode=mode),tempfile.TemporaryDirectory() as d:
                h=self.host();h.call('CB29_SaveSlot',0)
                h.ask=str(Path(d)/('missing/bank.zcv' if mode=='unwritable' else 'bank.zcv'))
                original=h.cmd
                def cmd(n):
                    if n[0]=='MemSaveToFile' and n[1]=='CB32Export':
                        if mode=='short_write':Path(h.ask).write_bytes(b'partial');return 7
                        if mode=='lying_write':return 123088
                    if n[0]=='MemCreateFromFile' and n[1]=='CB32ExportCheck':
                        if mode=='read_error':return -3
                        if mode=='read_corruption':
                            result=original(n);h.mem['CB32ExportCheck'][100]^=1;return result
                    return original(n)
                h.cmd=cmd;bank=bytes(h.mem['CB25Data']);names=h.names[:]
                self.button(h,'EXPORT BANK')
                self.assertIn('could not be verified',h.messages[-1])
                self.assertEqual(bytes(h.mem['CB25Data']),bank);self.assertEqual(h.names,names)
                self.assertFalse(any(k.startswith('CB32Export') for k in h.mem))

    def test_cancel_does_not_run_pending_recovery(self):
        h=self.host();h.call('CB29_SaveSlot',0)
        original=h.cmd;stopped=False
        def cmd(n):
            nonlocal stopped
            result=original(n)
            if n[0]=='IPress' and n[1]=='"Tool:SubTool:Rename"' and not stopped:
                stopped=True;raise Exit()
            return result
        h.cmd=cmd
        with self.assertRaises(Exit):h.call('CB29_SaveSlot',1)
        h.cmd=original;before={k:bytes(v) for k,v in h.mem.items()};names=h.names[:]
        h.ask=''
        with self.assertRaises(Exit):self.button(h,'EXPORT BANK')
        self.button(h,'IMPORT BANK')
        self.assertEqual({k:bytes(v) for k,v in h.mem.items()},before)
        self.assertEqual(h.names,names)
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'original.zcv';path.write_bytes(b'original user bank')
            h.ask=str(path);h.answer=0
            with self.assertRaises(Exit):self.button(h,'EXPORT BANK')
            self.assertEqual(path.read_bytes(),b'original user bank')
            self.assertEqual({k:bytes(v) for k,v in h.mem.items()},before)
            self.assertEqual(h.names,names)
        h.call('CB32_Recover')

    def test_file_dialogs_precede_recovery_in_final_generated_routines(self):
        h=self.host()
        for name in ['CB29_ExportBank','CB29_ImportBank']:
            body=h.routines[name][0]
            self.assertLess(body.index('[FileNameAsk,'),body.index('[RoutineCall,CB32_Recover]'),name)
        body=h.routines['CB29_ExportBank'][0]
        self.assertLess(body.index('[MessageYesNo,'),body.index('[RoutineCall,CB32_Recover]'))

    def test_native_ascii_condition_stop_is_avoided_during_store_refresh_and_recall(self):
        h=self.host();new_reader=h.routines['CB32_ReadName']
        # Frozen pre-fix body. The controller's native probe stops at this If
        # condition after title/length checks, before the first name write.
        h.routines['CB32_ReadName']=('''
            [VarSet,cbTrackName,[IGetTitle,"Tool:ItemInfo"]]
            [If,[StrLength,cbTrackName]>0,
                [If,[StrToAsc,cbTrackName,[StrLength,cbTrackName]-1]==46,
                    [VarSet,cbTrackName,[StrExtract,cbTrackName,0,[StrLength,cbTrackName]-2]]
                ]
            ]''',[])
        original=h.cmd
        def native_observed_stop(n):
            # Fault injection for the observed 2023.2.1 condition, not a claim
            # that this mock can generally reproduce the native interpreter.
            if n[0]=='If' and '[StrToAsc,' in n[1]:raise Exit()
            return original(n)
        h.cmd=native_observed_stop
        with self.assertRaises(Exit):h.call('CB29_SaveSlot',0)
        self.assertEqual(get(h,20),0)
        self.assertEqual(h.mem['CB32OldNames'],bytes(2048))
        self.assertEqual(struct.unpack_from('<f',h.mem['CB32RenameState'],3*4)[0],0)
        h.cmd=original;h.call('CB32_Recover')
        h.routines['CB32_ReadName']=new_reader;h.cmd=native_observed_stop
        h.call('CB29_SaveSlot',0)
        self.assertEqual(get(h,20),1);self.assertEqual(get(h,7),1)
        self.assertTrue(all(re.match(r'CB\d{12}G\d{4}_Part [AB]$',n) for n in h.names))
        self.assertNotIn('CB32RenameState',h.mem)
        h.status=[1,0];h.call('CB29_SaveSlot',1)
        h.call('CB29_LoadSlot',0);self.assertEqual([s&1 for s in h.status],[1,1])
        h.call('CB29_LoadSlot',1);self.assertEqual([s&1 for s in h.status],[1,0])
        # Scan every If condition in both generated outputs, including branches
        # that this particular fixture may not execute.
        for path in [ROOT/'Development/tests/fixtures/legacy_camera_321.txt',ROOT/'Development/camera_reader.inc']:
            source=clean(path.read_text(encoding='ascii'))
            for match in re.finditer(r'\[If,',source):
                condition=node(source,match.start())[0][1]
                self.assertNotIn('[StrToAsc,',condition,path.name)
        # Shared-reader parity is checked separately; both name readers must
        # keep empty strings and a human trailing period safe as well.
        for title,expected in [('', ''),('Part.', 'Part'),('Part..','Part.'),('Part','Part')]:
            def title_cmd(n):
                if n[:2]==['IGetTitle','"Tool:ItemInfo"']:return title
                return native_observed_stop(n)
            h.cmd=title_cmd;h.call('CB32_ReadName')
            self.assertEqual(h.v['cbTrackName'],expected)

    def test_all_zscript_source_literals_fit_native_string_limit(self):
        # Include generated sources, generator inputs, the shared includes and
        # regression fixtures. Archived installed Recovery copies are excluded.
        checked=[]
        for path in sorted(ROOT.rglob('*')):
            if path.suffix not in {'.txt','.inc'} or 'Recovery' in path.relative_to(ROOT).parts:continue
            source=clean(path.read_text(encoding='utf-8-sig'))
            for literal in re.findall(r'"([^"\n]*)"',source):
                self.assertLessEqual(len(literal),255,f'{path.relative_to(ROOT)}: {len(literal)} characters')
            checked.append(path)
        self.assertIn(ROOT/'Development/tests/fixtures/legacy_camera_321.txt',checked)
        self.assertIn(ROOT/'Development/camera_reader.inc',checked)

    def test_native_strmerge_arity_and_group_identifier_format(self):
        h=self.host()
        for count in [0,1,13]:
            with self.assertRaisesRegex(ValueError,'StrMerge requires 2..12 inputs'):
                h.cmd(['StrMerge']+['"x"']*count)
        self.assertEqual(h.cmd(['StrMerge','""','10001']),'10001')
        self.assertEqual(h.cmd(['StrMerge']+['"x"']*12),'x'*12)
        original=h.cmd
        def native_group_conversion(n):
            # Native candidate wrote G0000 when compound group arithmetic was
            # passed directly as a StrMerge string input. Model that symptom
            # explicitly; the generic mock's e() otherwise evaluates arithmetic.
            if n[0]=='StrMerge' and any(a.startswith('10000+') for a in n[1:]):return '10000'
            return original(n)
        h.cmd=native_group_conversion
        h.call('CB29_SaveSlot',0)
        self.assertTrue(all(re.match(r'CB\d{12}G0001_Part [AB]$',name) for name in h.names))
        h.status=[1,0];h.call('CB29_SaveSlot',1);h.call('CB29_LoadSlot',1)
        self.assertEqual([s&1 for s in h.status],[1,0])
        # Preserve the old source fixture verbatim; it intentionally retains
        # the historical one-input call and is never a native plugin source.
        for path in sorted(ROOT.rglob('*')):
            if path.suffix not in {'.txt','.inc'} or 'Recovery' in path.relative_to(ROOT).parts:continue
            if path==ROOT/'Development/tests/fixtures/camera_310_export.inc':continue
            source=clean(path.read_text(encoding='utf-8-sig'))
            for match in re.finditer(r'\[StrMerge(?=,|\])',source):
                command=node(source,match.start())[0]
                self.assertTrue(2<=len(command)-1<=12,f'{path.relative_to(ROOT)}: {command}')

    def test_legacy_versions_and_sizes_keep_known_fields_without_inventing_names(self):
        for version,size in [(v,2080) for v in range(1,7)]+[(v,102180) for v in range(3,7)]+[(7,102980)]:
            with self.subTest(version=version,size=size):
                h=self.host();data=bytearray(size)
                struct.pack_into('<3f',data,0,252523,version,25)
                struct.pack_into('<f',data,20*4,1)
                struct.pack_into('<f',data,21*4,42.25)
                struct.pack_into('<f',data,36*4,0)
                if version==7:
                    struct.pack_into('<2f',data,38*4,1280,720)
                    struct.pack_into('<2f',data,25545*4,47,1)
                h.mem['CB29ImportTemp']=data;h.call('CB30_AcceptImport',size)
                self.assertEqual(h.v['cbImportValid'],1)
                self.assertEqual(get(h,1),9);self.assertEqual(get(h,7),0)
                self.assertEqual(get(h,8),0);self.assertEqual(get(h,25745),0)
                self.assertEqual(get(h,27746),0);self.assertEqual(get(h,21),42.25)
                self.assertEqual(get(h,36),0 if version>=6 else 1)
                self.assertEqual(get(h,38),1280 if version==7 else 0)
                self.assertEqual(get(h,25545),47 if version==7 else 0)

    def test_legacy_partial_review_blocks_reorder_and_import_drops_unproven_ready_bits(self):
        h=self.legacy();h.call('CB29_LoadSlot',0);h.call('CB29_SaveSlot',0)
        self.assertEqual(get(h,7),0);self.assertEqual(get(h,27746),2)
        h.names.reverse();h.ids.reverse();before=bytes(h.mem['CB25Data'])
        for action in ['CB29_LoadSlot','CB29_SaveSlot']:
            with self.assertRaises(Exit):h.call(action,1)
            self.assertEqual(bytes(h.mem['CB25Data']),before)
        with tempfile.TemporaryDirectory() as d:
            h.ask=str(Path(d)/'partial.zcv');h.call('CB29_ExportBank')
            r=self.host();r.ask=h.ask;r.call('CB29_ImportBank')
            self.assertEqual(get(r,7),0);self.assertEqual(get(r,27746),0)
            self.assertEqual(get(r,20),1);self.assertEqual(get(r,40),1)

    def test_legacy_review_interruption_restores_binding_and_committed_cleanup_keeps_it(self):
        for stage in ['binding_allocation','later_rename','committed_cleanup']:
            with self.subTest(stage=stage):
                h=self.legacy()
                if stage=='later_rename':h.call('CB29_SaveSlot',0)
                bank=bytes(h.mem['CB25Data']);names=h.names[:]
                original=h.cmd;stopped=False
                def cmd(n):
                    nonlocal stopped
                    result=original(n)
                    stop=(stage=='binding_allocation' and n[:2]==['MVarDef','CB32LegacyState'])
                    stop|=(stage=='later_rename' and n[:2]==['IPress','"Tool:SubTool:Rename"'])
                    stop|=(stage=='committed_cleanup' and n[:2]==['MemDelete','CB32OriginalBank'])
                    if stop and not stopped:stopped=True;raise Exit()
                    return result
                h.cmd=cmd
                with self.assertRaises(Exit):h.call('CB29_SaveSlot',1 if stage=='later_rename' else 0)
                h.cmd=original;h.call('CB32_Recover');self.assertTrue(stopped)
                if stage=='committed_cleanup':
                    self.assertIn('CB32LegacyState',h.mem);self.assertEqual(get(h,27746),2)
                else:
                    self.assertEqual(bytes(h.mem['CB25Data']),bank);self.assertEqual(h.names,names)
                    self.assertEqual('CB32LegacyState' in h.mem,stage=='later_rename')
                h.call('CB29_SaveSlot',1)
                if stage!='binding_allocation':self.assertEqual(get(h,7),1)

    def test_first_store_rename_failure_is_atomic_and_bad_initial_names_cannot_commit(self):
        for mode in ['truncate','long','ambiguous','malformed']:
            with self.subTest(mode=mode):
                h=self.host()
                if mode=='long':h.names[1]='L'*236
                if mode=='ambiguous':h.names[1]='CB123456123456G0001_CB654321654321G0002_Part'
                if mode=='malformed':h.names[1]='CB123456123456Gxxxx_Part'
                before=bytes(h.mem['CB25Data']);names=h.names[:];original=h.cmd;failed=False
                def cmd(n):
                    nonlocal failed
                    result=original(n)
                    if mode=='truncate' and n[0]=='IPress' and n[1]=='"Tool:SubTool:Rename"' and not failed:
                        failed=True;h.names[h.st]='truncated'
                    return result
                h.cmd=cmd
                with self.assertRaises(Exit):h.call('CB29_SaveSlot',0)
                self.assertEqual(bytes(h.mem['CB25Data']),before);self.assertEqual(h.names,names)
                self.assertNotIn('CB32RenameState',h.mem)

    def test_generated_shared_reader_matches_camera_routines(self):
        camera={n[1]:n[2:] for n in parse((ROOT/'Development/tests/fixtures/legacy_camera_321.txt').read_text()) if n[0]=='RoutineDef'}
        reader=parse((ROOT/'Development/camera_reader.inc').read_text())
        for n in reader:
            if n[0]!='RoutineDef':continue
            original=n[1].removeprefix('RC_')
            # Private reader omits writer recovery; its visibility guard blocks
            # pending transactions instead. No camera UI/render flag mutations.
            actual=[x.replace('RC_CB','CB') for x in n[2:]]
            expected=[x.replace('[RoutineCall,CB32_Recover]','') for x in camera[original]]
            self.assertEqual([x.strip() for x in actual],[x.strip() for x in expected],original)
        text=(ROOT/'Development/camera_reader.inc').read_text()
        self.assertNotIn('[IPress,"Tool:SubTool:Rename"]',text)
        self.assertNotIn('[IButton,',text)

    def test_1000_subtools_duplicate_names_reorder_and_capacity_guard(self):
        h=self.host();h.record_calls=False
        parts(h,['Duplicate']*1000,[1]+[i%2 for i in range(1,1000)])
        expected=[s&1 for s in h.status];h.call('CB29_SaveSlot',0)
        self.assertEqual(get(h,27746),1000);self.assertEqual(get(h,25745),2)
        names=h.names[:];parts(h,names[::-1]);h.call('CB29_LoadSlot',0)
        self.assertEqual([s&1 for s in h.status],expected[::-1])
        bank=bytes(h.mem['CB25Data']);parts(h,h.names+['Beyond limit'])
        with self.assertRaises(Exit):h.call('CB29_SaveSlot',1)
        self.assertEqual(bytes(h.mem['CB25Data']),bank)


if __name__=='__main__':unittest.main(verbosity=2)
