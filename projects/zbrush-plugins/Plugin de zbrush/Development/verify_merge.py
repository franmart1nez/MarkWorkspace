"""Exercise delivered v8 ZScript through the mock host; never controls ZBrush."""
from pathlib import Path
import re, struct, tempfile, unittest
from verify import Host, Exit, ROOT

def parts(h,names,status=None,selected=0):
    h.names=list(names);h.status=list(status or [1]*len(names));h.st=selected
    h.folders=[-1]*len(names);h.ids=[9000+i for i in range(len(names))]
    h.pp=[0]*len(names);h.tx=[1]*len(names)

def get(h,index):return struct.unpack_from('<f',h.mem['CB25Data'],index*4)[0]

class MergeVisibility(unittest.TestCase):
    def host(self):
        h=Host();h.load(ROOT/'Camera Bank/CameraBank25.txt');return h
    def prepared(self):
        h=self.host();parts(h,['A','B','C','D'],[1,1,0,0],0)
        h.call('CB29_SaveSlot',0)
        h.status=[0,0,1,1];h.st=2
        h.ui.update({'Document:Width':800,'Document:Height':600})
        h.call('CB29_SaveSlot',1);h.call('CB32_PrepareTransfer')
        return h
    def merged_recipient(self,h):
        receiver=self.host()
        # ZTL/ZPR name preservation and native merge naming are simulated here.
        parts(receiver,['Merged_'+h.names[3],h.names[0]])
        with tempfile.TemporaryDirectory() as d:
            bank=Path(d)/'handoff.zcv';h.ask=str(bank);h.call('CB29_ExportBank')
            receiver.ask=str(bank);receiver.call('CB29_ImportBank')
        return receiver

    def test_ztl_bank_transfer_reorder_compatible_merges_and_both_renderers(self):
        h=self.prepared();self.assertEqual(h.names[0][:20],h.names[1][:20])
        self.assertEqual(h.names[2][:20],h.names[3][:20]);self.assertNotEqual(h.names[0][:20],h.names[2][:20])
        r=self.merged_recipient(h)
        r.call('CB29_LoadSlot',0);self.assertEqual([x&1 for x in r.status],[0,1]);self.assertEqual(r.st,1)
        self.assertEqual(r.dims,[1920,1080])
        r.call('CB29_LoadSlot',1);self.assertEqual([x&1 for x in r.status],[1,0]);self.assertEqual(r.st,0)
        self.assertEqual(r.dims,[800,600])
        r.load(ROOT/'Render Capture/RenderCapture.txt')
        with tempfile.TemporaryDirectory() as d:
            r.chosen=d;r.call('RC_CreateFolders');r.call('RC_NonBPR');r.call('RC_BPR')
            self.assertEqual(len(r.exports),22)
            for e in r.exports:
                self.assertEqual(e['visibility'],[0,1] if '/01/' in e['path'] else [1,0])
                self.assertEqual(e['visibility'][e['selected']],1)
            self.assertTrue((Path(r.v['rcRoot'])/'Screenshots/01.png').is_file())
            self.assertTrue((Path(r.v['rcRoot'])/'Screenshots/02.png').is_file())

    def test_all_25_bits_survive_float_serialization(self):
        h=self.host();parts(h,['Always','Varies','Never'])
        on={0,12,13,24}
        for slot in range(25):
            h.status=[1,int(slot in on),0];h.call('CB29_SaveSlot',slot)
        h.call('CB32_PrepareTransfer')
        self.assertEqual(get(h,25745),3)
        self.assertEqual((get(h,25746),get(h,25747)),(8191,4095))
        self.assertEqual((get(h,25748),get(h,25749)),(4097,2049))
        for slot in range(25):
            h.call('CB29_LoadSlot',slot)
            self.assertEqual([s&1 for s in h.status],[1,int(slot in on),0])

    def test_render_uses_camera_visibility_then_restores_original_solo(self):
        h=self.merged_recipient(self.prepared());h.st=1;h.ui['Transform:Solo']=1
        h.load(ROOT/'Render Capture/RenderCapture.txt')
        with tempfile.TemporaryDirectory() as d:
            h.chosen=d;h.call('RC_CreateFolders');h.call('RC_NonBPR');h.call('RC_BPR')
            for export in h.exports:self.assertEqual(export['solo'],0)
            self.assertEqual(h.ui['Transform:Solo'],1);self.assertEqual(h.st,1)

    def test_name_selection_preserves_view_even_when_host_selection_changes_it(self):
        h=self.host();h.call('CB29_SaveSlot',0)
        transform=h.transform[:];zoom=h.zoom;pan=h.pan[:];original=h.cmd
        def cmd(n):
            result=original(n)
            if n[0]=='SubToolSelect':
                h.transform[0]+=5;h.zoom+=0.5;h.pan[0]+=7
            return result
        h.cmd=cmd;h.call('CB32_PrepareTransfer')
        self.assertEqual(h.transform,transform);self.assertEqual(h.zoom,zoom);self.assertEqual(h.pan,pan)
        h.call('CB32_CheckTracked');self.assertEqual(h.transform,transform);self.assertEqual(h.zoom,zoom);self.assertEqual(h.pan,pan)
        h.call('CB29_SaveSlot',1)
        self.assertEqual(h.transform,transform);self.assertEqual(h.zoom,zoom);self.assertEqual(h.pan,pan)

    def test_foreign_removed_and_malformed_identifiers_do_not_fall_back_to_positions(self):
        for mode in ['removed','foreign','bad_group','ambiguous']:
            with self.subTest(mode=mode):
                h=self.prepared();name=h.names[1]
                if mode=='removed':h.names[1]='B'
                if mode=='foreign':h.names[1]='CB000000000000'+name[14:]
                if mode=='bad_group':h.names[1]=name[:15]+'9999'+name[19:]
                if mode=='ambiguous':h.names[1]=name+h.names[2]
                h.ui['Document:Width']=321
                status=h.status[:];selected=h.st;transform=h.transform[:]
                with self.assertRaises(Exit):h.call('CB29_LoadSlot',0)
                self.assertEqual(h.ui['Document:Width'],321);self.assertEqual(h.transform,transform)
                self.assertEqual(h.status,status);self.assertEqual(h.st,selected)
                self.assertIn('identifier',h.messages[-1])

    def test_missing_visible_group_is_rejected(self):
        h=self.prepared();parts(h,[h.names[0]])
        with self.assertRaises(Exit):h.call('CB29_LoadSlot',1)
        self.assertIn('visibility group',h.messages[-1])

    def test_cleared_camera_bits_do_not_prevent_now_compatible_merge(self):
        h=self.prepared()
        # Add a common camera so both classes remain equivalent and visible later.
        h.status=[1,1,1,1];h.st=0;h.call('CB29_SaveSlot',2)
        h.call('CB29_ClearSlot',0);h.call('CB29_ClearSlot',1)
        parts(h,[h.names[0]])
        h.call('CB29_LoadSlot',2);self.assertEqual(h.status[0]&1,1)

    def test_editing_after_merge_rebases_all_views_and_rotates_bank_identity(self):
        source=self.prepared();r=self.merged_recipient(source)
        old_nonce=(get(r,8),get(r,9));r.status=[1,1];r.call('CB29_SaveSlot',2)
        self.assertNotEqual((get(r,8),get(r,9)),old_nonce)
        self.assertTrue(all(len(re.findall(r'CB\d{12}G\d{4}_',n))==1 for n in r.names))
        for slot,expected in [(0,[0,1]),(1,[1,0]),(2,[1,1])]:
            r.call('CB29_LoadSlot',slot);self.assertEqual([x&1 for x in r.status],expected)
            self.assertEqual(get(r,520+(slot*1001)),2)
        self.assertFalse(any(k.startswith('CB32') for k in r.mem))

    def test_folder_hidden_selected_and_solo_are_effective_visibility(self):
        h=self.host();parts(h,['Outside','Head','Child','Active'],[1,0x401,1,0],3)
        h.folders=[-1,1,1,-1];h.call('CB29_SaveSlot',0)
        h.ui['Transform:Solo']=1;h.st=2;h.call('CB29_SaveSlot',1)
        h.call('CB32_PrepareTransfer')
        h.call('CB29_LoadSlot',0)
        self.assertEqual([s&1 for s in h.status],[1,0,0,1]);self.assertEqual(h.ui['Transform:Solo'],0)
        self.assertEqual(h.status[1]&0x400,0x400)
        h.call('CB29_LoadSlot',1);self.assertEqual([s&1 for s in h.status],[0,0,1,0]);self.assertEqual(h.st,2)

    def test_duplicate_native_mesh_ids_do_not_alias_visibility(self):
        h=self.prepared();h.ids=[123]*4
        h.call('CB29_LoadSlot',0);self.assertEqual([s&1 for s in h.status],[1,1,0,0])
        h.call('CB29_LoadSlot',1);self.assertEqual([s&1 for s in h.status],[0,0,1,1])

    def test_legacy_v7_needs_effective_updates_before_preparing(self):
        h=self.host();h.call('CB29_SaveSlot',0)
        legacy=bytearray(h.mem['CB25Data'][:102980]);struct.pack_into('<f',legacy,4,7)
        h.mem['CB29ImportTemp']=legacy;h.call('CB30_AcceptImport',len(legacy))
        before=bytes(h.mem['CB25Data']);names=h.names[:]
        with self.assertRaises(Exit):h.call('CB32_PrepareTransfer')
        self.assertEqual(bytes(h.mem['CB25Data']),before);self.assertEqual(h.names,names)
        h.call('CB29_LoadSlot',0);h.call('CB29_SaveSlot',0);h.call('CB32_PrepareTransfer')
        self.assertEqual(get(h,7),1)

    def test_corrupt_v8_metadata_is_rejected_before_replacing_live_bank(self):
        h=self.prepared();before=bytes(h.mem['CB25Data'])
        for cell,bad in [(7,2),(8,12),(9,100000.5),(25745,1001),(25746,8192),(25747,4096),(27746,1001)]:
            with self.subTest(cell=cell):
                invalid=bytearray(before);struct.pack_into('<f',invalid,cell*4,bad)
                h.mem['CB29ImportTemp']=invalid;h.call('CB30_AcceptImport',len(invalid))
                self.assertEqual(h.v['cbImportValid'],0);self.assertEqual(bytes(h.mem['CB25Data']),before)

    def test_rename_failure_rolls_back_names_bank_and_statuses(self):
        h=self.host();parts(h,['A','B'],[1,0]);h.call('CB29_SaveSlot',0)
        before=bytes(h.mem['CB25Data']);names=h.names[:];status=h.status[:]
        original=h.cmd;failed=False
        def cmd(n):
            nonlocal failed
            result=original(n)
            if n[0]=='IPress' and n[1]=='"Tool:SubTool:Rename"' and h.st==1 and not failed:
                failed=True;h.names[h.st]='truncated'
            return result
        h.cmd=cmd
        with self.assertRaises(Exit):h.call('CB32_PrepareTransfer')
        self.assertTrue(failed);self.assertEqual(h.names,names);self.assertEqual(h.status,status)
        self.assertEqual(bytes(h.mem['CB25Data']),before)
        self.assertFalse(any(k.startswith('CB32') for k in h.mem))

    def test_escape_recovery_is_tool_guarded_and_renderer_blocks_until_recovered(self):
        h=self.host();h.call('CB29_SaveSlot',0);before=bytes(h.mem['CB25Data']);names=h.names[:]
        original=h.cmd;interrupted=False
        def cmd(n):
            nonlocal interrupted
            result=original(n)
            if n[0]=='IPress' and n[1]=='"Tool:SubTool:Rename"' and not interrupted:
                interrupted=True;raise Exit()
            return result
        h.cmd=cmd
        with self.assertRaises(Exit):h.call('CB32_PrepareTransfer')
        h.cmd=original;self.assertIn('CB32RenameState',h.mem)
        h.load(ROOT/'Render Capture/RenderCapture.txt')
        with self.assertRaises(Exit):h.call('RC_Preflight')
        h.tool_index=2
        with self.assertRaises(Exit):h.call('CB29_LoadSlot',0)
        h.tool_index=1;h.call('CB29_LoadSlot',0)
        self.assertEqual(h.names,names);self.assertEqual(bytes(h.mem['CB25Data']),before)
        self.assertNotIn('CB32RenameState',h.mem)

    def test_escape_during_partial_snapshot_does_not_use_unrecorded_names(self):
        cases=[('MemCreate','CB32OriginalBank'),('MemCreate','CB32OldNames'),
               ('MVarDef','CB32RenameState'),('MemWriteString','CB32OldNames')]
        for command,block in cases:
            with self.subTest(command=command,block=block):
                h=self.host();h.call('CB29_SaveSlot',0)
                bank=bytes(h.mem['CB25Data']);names=h.names[:];original=h.cmd;stopped=False
                def cmd(n):
                    nonlocal stopped
                    result=original(n)
                    if n[0]==command and n[1]==block and not stopped:
                        stopped=True;raise Exit()
                    return result
                h.cmd=cmd
                with self.assertRaises(Exit):h.call('CB32_PrepareTransfer')
                h.cmd=original;h.call('CB32_Recover')
                self.assertEqual(h.names,names);self.assertEqual(bytes(h.mem['CB25Data']),bank)
                self.assertFalse(any(k.startswith('CB32') for k in h.mem))

    def test_escape_during_committed_cleanup_retains_new_bank_and_names(self):
        h=self.host();h.call('CB29_SaveSlot',0);original=h.cmd;stopped=False
        def cmd(n):
            nonlocal stopped
            result=original(n)
            if n[0]=='MemDelete' and n[1]=='CB32OriginalBank' and not stopped:
                stopped=True;raise Exit()
            return result
        h.cmd=cmd
        with self.assertRaises(Exit):h.call('CB32_PrepareTransfer')
        h.cmd=original;names=h.names[:];bank=bytes(h.mem['CB25Data'])
        h.call('CB32_Recover')
        self.assertEqual(get(h,7),1);self.assertEqual(h.names,names);self.assertEqual(bytes(h.mem['CB25Data']),bank)
        h.call('CB29_LoadSlot',0)
        self.assertFalse(any(k.startswith('CB32') for k in h.mem))

if __name__=='__main__':unittest.main(verbosity=2)
