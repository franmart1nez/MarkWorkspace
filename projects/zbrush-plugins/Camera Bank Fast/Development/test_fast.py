"""Execute Fast's real source in the existing ZScript host; no native claims."""
from pathlib import Path
import copy
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
from fast_test_host import Host, Exit, parse, parts, get
from build_fast import compose, BASE, OUTPUT


class Fast(unittest.TestCase):
    def host(self, count=5, duplicates=False):
        h = Host()
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'fast.txt'; path.write_text(compose(False), encoding='ascii')
            h.load(path)
        parts(h, [f'Part{i}' for i in range(count)], [1] * count)
        h.ids = [4294967295 if duplicates else 16777219 + i for i in range(count)]
        return h

    def counts(self, h):
        return {k: sum(c == k and (k != 'IPress' or a[0] == '"Tool:SubTool:Rename"')
                       for c, a in h.calls) for k in ('SubToolSelect', 'IGetTitle', 'IPress')}

    def test_100_and_300_parts_save_without_selecting_or_renaming_every_mesh(self):
        for count in (100, 300):
            with self.subTest(count=count):
                h = self.host(count); h.call('CB29_SaveSlot', 0)
                self.assertEqual(get(h,25745), count)
                original_names = h.names[:]; nonce = get(h,8), get(h,9)
                h.status = [int(i % 3 == 0) for i in range(count)]; h.st = 0
                second = h.status[:]; h.calls.clear(); h.call('CB29_SaveSlot', 1)
                self.assertEqual(self.counts(h)['SubToolSelect'], 0)
                self.assertEqual(self.counts(h)['IPress'], 0)
                self.assertEqual(h.names, original_names)
                self.assertEqual((get(h,8),get(h,9)), nonce)
                for slot, visibility in ((0,[1]*count), (1,second)):
                    h.calls.clear(); h.call('CB29_LoadSlot', slot)
                    self.assertEqual([s&1 for s in h.status], visibility)
                    self.assertEqual(self.counts(h)['SubToolSelect'], 1)
                self.assertFalse(any(k in h.mem for k in ('CBFTxn','CBFOriginal','CB32RenameState')))

    def test_same_id_same_visibility_recalls_fast_but_different_visibility_checks_names(self):
        h = self.host(10, True); h.call('CB29_SaveSlot',0)
        h.calls.clear(); h.call('CB29_LoadSlot',0)
        self.assertEqual(self.counts(h)['SubToolSelect'],1)
        h.status = [1]*5 + [0]*5; h.st = 0
        h.calls.clear(); h.call('CB29_SaveSlot',1)
        self.assertEqual(self.counts(h)['IPress'],0)
        self.assertGreaterEqual(self.counts(h)['SubToolSelect'],10)
        h.names = h.names[::-1]; h.status = h.status[::-1]
        h.call('CB29_LoadSlot',1)
        self.assertEqual([s&1 for s in h.status],[0]*5+[1]*5)

    def test_reorder_and_compatible_merge_rebind_then_keep_both_views(self):
        h = self.host(4); h.status=[1,1,0,0]; h.call('CB29_SaveSlot',0)
        h.status=[0,0,1,1]; h.st=2; h.call('CB29_SaveSlot',1)
        names=h.names[:]; ids=h.ids[:]
        parts(h,['Merged_'+names[3], names[0]]); h.ids=[ids[3],ids[0]]
        for slot, visibility in ((0,[0,1]),(1,[1,0])):
            h.call('CB29_LoadSlot',slot); self.assertEqual([s&1 for s in h.status], visibility)
        nonce = get(h,8),get(h,9)
        h.status=[1,1]; h.call('CB29_SaveSlot',2)
        self.assertNotEqual((get(h,8),get(h,9)), nonce)
        h.status=[1,0]; h.st=0; h.calls.clear(); h.call('CB29_SaveSlot',3)
        self.assertEqual(self.counts(h)['SubToolSelect'],0)
        for slot, visibility in ((0,[0,1]),(1,[1,0]),(2,[1,1]),(3,[1,0])):
            h.call('CB29_LoadSlot',slot); self.assertEqual([s&1 for s in h.status], visibility)

    def test_incompatible_merge_or_unknown_part_is_rejected_before_view_changes(self):
        for mode in ('merge','new'):
            with self.subTest(mode=mode):
                h=self.host(3);h.status=[1,0,0];h.call('CB29_SaveSlot',0)
                h.status=[0,1,0];h.st=1;h.call('CB29_SaveSlot',1)
                if mode=='merge': parts(h,['Merged_'+h.names[0],h.names[2]])
                else: parts(h,h.names+['New part'])
                state=h.status[:],h.st,h.transform[:],bytes(h.mem['CB25Data'])
                with self.assertRaises(Exit):h.call('CB29_LoadSlot',0)
                self.assertEqual((h.status,h.st,h.transform,bytes(h.mem['CB25Data'])),state)

    def test_interrupted_fast_save_restores_bank_and_view_without_touching_names(self):
        for step in ('rebase','masks','publish'):
            with self.subTest(step=step):
                h=self.host();h.call('CB29_SaveSlot',0)
                h.status=[1,0,1,0,1];h.st=2
                state=bytes(h.mem['CB25Data']),h.status[:],h.names[:],h.st,h.transform[:]
                original=h.cmd; stopped=False
                def interrupt(n):
                    nonlocal stopped
                    result=original(n)
                    fire=(step=='rebase' and n[0]=='MVarSet' and n[1]=='CB25Data' and h.e(n[2])==7 and h.e(n[3])==0 or
                          step=='masks' and n[0]=='MVarSet' and n[1]=='CB25Data' and h.e(n[2])==25746 or
                          step=='publish' and n[0]=='MVarDef' and n[1]=='CBFCache')
                    if fire and not stopped: stopped=True;raise Exit()
                    return result
                h.cmd=interrupt
                with self.assertRaises(Exit):h.call('CB29_SaveSlot',1)
                h.cmd=original;h.call('CB32_Recover')
                self.assertEqual(h.names,state[2]);self.assertNotIn('CBFTxn',h.mem)
                if step!='publish':
                    self.assertEqual((bytes(h.mem['CB25Data']),h.status,h.names,h.st,h.transform),state)
                else:
                    self.assertEqual(get(h,40),1)  # save was committed before cache publication
                    h.call('CB29_LoadSlot',1);self.assertEqual([s&1 for s in h.status],state[1])

    def test_same_bank_reimport_and_tool_switch_invalidate_cache(self):
        h=self.host();h.call('CB29_SaveSlot',0)
        before=bytes(h.mem['CB25Data']);h.mem['CB29ImportTemp']=bytearray(before)
        h.call('CB30_AcceptImport',len(before));self.assertNotIn('CBFCache',h.mem)
        h.call('CB29_LoadSlot',0);h.tool_index+=1;h.calls.clear();h.call('CB29_LoadSlot',0)
        self.assertGreaterEqual(self.counts(h)['SubToolSelect'],len(h.names))

    def test_filename_alias_survives_cold_and_cached_binding_with_duplicate_ids(self):
        for duplicates in (False,True):
            with self.subTest(duplicates=duplicates):
                h=self.host(3,duplicates);h.call('CB29_SaveSlot',0)
                h.status=[0,1,0];h.st=1;h.call('CB29_SaveSlot',1)
                h.names[0]='client.model';h.tool_path='models/client.model'
                h.call('CBF_Invalidate');h.st=0
                for slot,expected in ((1,[0,1,0]),(0,[1,1,1]),(1,[0,1,0])):
                    h.call('CB29_LoadSlot',slot);self.assertEqual([s&1 for s in h.status],expected)

    def test_rescan_detects_identifier_removed_from_an_unselected_unique_mesh(self):
        h=self.host();h.call('CB29_SaveSlot',0);h.names[3]='lost marker'
        with self.assertRaises(Exit):h.call('CBF_Rescan')
        self.assertEqual(h.v['cbTrackValid'],0)

    def test_interrupted_initial_marker_write_recovers_large_native_ids_exactly(self):
        h=self.host();state=h.names[:],h.status[:],bytes(h.mem['CB25Data'])
        original=h.cmd;stopped=False
        def interrupt(n):
            nonlocal stopped
            result=original(n)
            if n[0]=='IPress' and h.e(n[1])=='Tool:SubTool:Rename' and not stopped:
                stopped=True;raise Exit()
            return result
        h.cmd=interrupt
        with self.assertRaises(Exit):h.call('CB29_SaveSlot',0)
        h.cmd=original;h.call('CB32_Recover')
        self.assertEqual((h.names,h.status,bytes(h.mem['CB25Data'])),state)
        self.assertNotIn('CBFFullIDs',h.mem)

    def test_standard_and_fast_have_independent_banks_and_controls(self):
        h=Host();h.load(BASE);h.call('CB29_SaveSlot',0);bank=bytes(h.mem['CB25Data'])
        h.load(OUTPUT);h.call('FB29_SaveSlot',1)
        self.assertEqual(bytes(h.mem['CB25Data']),bank)
        self.assertIn('FB25Data',h.mem)
        text=OUTPUT.read_text(encoding='ascii')
        self.assertIn('ZPlugin:Camera Bank Fast:RESCAN MODEL',text)
        self.assertNotIn('ZPlugin:Camera Bank 25:',text)
        self.assertEqual(text,compose())

    def test_export_replaces_selected_bank_without_an_extra_overwrite_message(self):
        h=self.host();h.call('CB29_SaveSlot',0)
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'bank.zcv';p.write_bytes(b'old bank');h.ask=str(p);h.answer=0
            h.calls.clear();h.call('CB29_ExportBank')
            self.assertEqual(len(p.read_bytes()),123088)
            self.assertFalse(any(c=='MessageYesNo' for c,a in h.calls))

    def test_public_slot_recall_and_render_toggle_keep_behavior_without_timed_notices(self):
        h=self.host();h.call('CB29_SaveSlot',0)
        h.status=[0,1,0,1,0];h.st=1;h.call('CB29_SaveSlot',1)
        h.calls.clear();h.call('CB29_SlotClick',0)
        self.assertEqual([s&1 for s in h.status],[1]*5)
        self.assertEqual(get(h,5),1);self.assertEqual(get(h,36),1)
        h.call('CB29_SlotClick',0)
        self.assertEqual(get(h,36),0)
        h.call('CB29_SlotClick',0)
        self.assertEqual(get(h,36),1)
        self.assertFalse(any(c=='Note' for c,a in h.calls))
        self.assertTrue(any(c=='NoteBar' for c,a in h.calls))

    def test_all_25_cameras_gray_flags_folders_lens_and_roundtrip(self):
        h=self.host(4);h.folders=[-1,1,1,-1]
        expected=[]
        for slot in range(25):
            h.status=[1,0x403,int(slot%2),int(slot%3==0)];h.st=0
            h.ui.update({'Document:Width':800+slot,'Document:Height':600+slot,
                         'Draw:Field Of View(deg)':30+slot})
            h.call('CB29_SaveSlot',slot);expected.append([1,1,int(slot%2),int(slot%3==0)])
            h.cmd(['MVarSet','CB25Data',str(36+slot*20),str(slot%2)])
        with tempfile.TemporaryDirectory() as d:
            h.ask=str(Path(d)/'bank.zcv');h.call('CB29_ExportBank')
            r=self.host(4);r.names=h.names[:];r.ids=h.ids[:];r.ask=h.ask;r.call('CB29_ImportBank')
            for slot in range(25):
                r.call('CB29_LoadSlot',slot)
                self.assertEqual([s&1 for s in r.status],expected[slot])
                self.assertEqual(r.dims,[800+slot,600+slot])
                self.assertEqual(r.ui['Draw:Field Of View(deg)'],30+slot)
                self.assertEqual(get(r,36+slot*20),slot%2)


if __name__=='__main__':unittest.main(verbosity=2)
