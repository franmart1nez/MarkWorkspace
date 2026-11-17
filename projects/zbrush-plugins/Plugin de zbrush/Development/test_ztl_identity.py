"""v9 ZTL filename regression coverage; native round trips are tested separately."""
from pathlib import Path
import struct
import tempfile
import unittest

from verify import Host, Exit, ROOT
from verify_merge import parts, get


class ZtlIdentity(unittest.TestCase):
    def host(self):
        h=Host();h.load(ROOT/'Development/tests/fixtures/legacy_camera_321.txt');return h

    def bank(self, duplicate_ids=False):
        h=self.host();parts(h,['Shirt','Body','Pack'],[1,1,1])
        if duplicate_ids:h.ids=[121,121,122]
        h.call('CB29_SaveSlot',0)
        h.status=[0,1,0];h.st=1;h.call('CB29_SaveSlot',1)
        return h

    def alias(self,h,name='arbitrary.name'):
        h.tool_path='D:/models/'+name;h.names[0]=name

    def assert_unchanged_failure(self,h,action='CB29_LoadSlot'):
        before=(bytes(h.mem['CB25Data']),h.names[:],h.status[:],h.st,h.transform[:])
        with self.assertRaises(Exit):h.call(action,0)
        self.assertEqual(before,(bytes(h.mem['CB25Data']),h.names,h.status,h.st,h.transform))

    def test_arbitrary_filename_survives_bank_export_import_and_both_views(self):
        h=self.bank();self.alias(h)
        with tempfile.TemporaryDirectory() as d:
            h.ask=str(Path(d)/'bank.zcv');h.call('CB29_ExportBank')
            r=self.host();parts(r,h.names);r.ids=h.ids[:];r.tool_path=h.tool_path
            r.ask=h.ask;r.call('CB29_ImportBank')
            self.assertEqual(get(r,1),9);self.assertEqual(len(r.mem['CB25Data']),123088)
            for slot,visible in [(0,[1,1,1]),(1,[0,1,0])]:
                r.call('CB29_LoadSlot',slot);self.assertEqual([s&1 for s in r.status],visible)
            self.assertEqual(r.names,h.names)  # Recall does not rename the Tool.

    def test_reordered_first_mesh_resolves_by_id_instead_of_old_position(self):
        h=self.bank();names=h.names[:];ids=h.ids[:]
        parts(h,[names[1],names[2],names[0]]);h.ids=[ids[1],ids[2],ids[0]];self.alias(h)
        h.call('CB29_LoadSlot',1)
        self.assertEqual([s&1 for s in h.status],[1,0,0])

    def test_duplicate_ids_with_different_visibility_use_marked_peer_evidence(self):
        h=self.bank(True);self.alias(h)
        h.call('CB29_LoadSlot',1);self.assertEqual([s&1 for s in h.status],[0,1,0])
        self.assertEqual(get(h,27771),3)

    def test_duplicate_ids_in_same_group_are_safe(self):
        h=self.host();parts(h,['A','B'],[1,1]);h.ids=[123,123]
        h.call('CB29_SaveSlot',0);self.alias(h);h.call('CB29_LoadSlot',0)
        self.assertEqual([s&1 for s in h.status],[1,1])

    def test_ids_above_float_precision_are_preserved_without_aliasing(self):
        h=self.host();parts(h,['A','B','C'],[1,1,0]);h.ids=[16777219,16777218,4294967295]
        h.call('CB29_SaveSlot',0)
        self.assertEqual((get(h,27772),get(h,27773)),(3,256))
        self.assertEqual((get(h,27778),get(h,27779)),(65535,65535))
        self.alias(h);h.call('CB29_LoadSlot',0)
        h.ids[0]=16777220
        self.assert_unchanged_failure(h)

    def test_deleted_duplicate_leaves_ambiguous_identity_and_is_rejected(self):
        h=self.bank(True);names=h.names[:];ids=h.ids[:]
        parts(h,[names[0],names[2]]);h.ids=[ids[0],ids[2]];self.alias(h)
        self.assert_unchanged_failure(h)
        self.assertIn('unambiguous',h.messages[-1])

    def test_unknown_id_foreign_or_malformed_marker_and_nonfirst_loss_are_rejected(self):
        for mode in ['unknown_id','foreign','malformed','other_part','different_alias','extra_peer']:
            with self.subTest(mode=mode):
                h=self.bank();self.alias(h)
                if mode=='unknown_id':h.ids[0]=777
                if mode=='foreign':h.names[0]='CB100000100000G0001_foreign';h.tool_path=h.names[0]
                if mode=='malformed':h.names[0]='CB620092277855Gxxxx_bad';h.tool_path=h.names[0]
                if mode=='other_part':h.names[1]='lost'
                if mode=='different_alias':h.tool_path='D:/models/something_else'
                if mode=='extra_peer':h.ids[1]=h.ids[0]
                self.assert_unchanged_failure(h)

    def test_store_after_filename_change_rebuilds_ids_and_preserves_prior_views(self):
        h=self.bank();self.alias(h);h.call('CB29_LoadSlot',1)
        h.status=[1,1,0];h.call('CB29_SaveSlot',2)
        self.assertTrue(h.names[0].endswith('arbitrary.name'))
        self.alias(h,'second.filename')
        for slot,expected in [(0,[1,1,1]),(1,[0,1,0]),(2,[1,1,0])]:
            h.call('CB29_LoadSlot',slot);self.assertEqual([s&1 for s in h.status],expected)

    def test_v8_import_on_matching_marked_tool_attaches_native_ids(self):
        h=self.bank();old=bytearray(h.mem['CB25Data'][:111084]);struct.pack_into('<f',old,4,8)
        h.mem['CB29ImportTemp']=old;h.call('CB30_AcceptImport',len(old))
        self.assertEqual(get(h,27771),3);self.assertEqual(get(h,1),9)
        self.alias(h);h.call('CB29_LoadSlot',1)
        self.assertEqual([s&1 for s in h.status],[0,1,0])

    def test_v8_unmarked_first_does_not_invent_ancestry(self):
        h=self.bank();old=bytearray(h.mem['CB25Data'][:111084]);struct.pack_into('<f',old,4,8)
        self.alias(h);h.mem['CB29ImportTemp']=old;h.call('CB30_AcceptImport',len(old))
        self.assertEqual(h.v['cbImportValid'],1);self.assertEqual(get(h,27771),0)
        self.assert_unchanged_failure(h)

    def test_invalid_id_table_does_not_replace_live_bank(self):
        h=self.bank();before=bytes(h.mem['CB25Data'])
        for cell,value in [(27771,-1),(27771,1001),(27771,1.5),(27772,-1),(27772,65536),
                           (27772,1.5),(27773,65536),(27773,-1),(27773,1.5),(27774,0),(27774,1001),(27774,1.5)]:
            with self.subTest(cell=cell,value=value):
                invalid=bytearray(before);struct.pack_into('<f',invalid,cell*4,value)
                h.mem['CB29ImportTemp']=invalid;h.call('CB30_AcceptImport',len(invalid))
                self.assertEqual(h.v['cbImportValid'],0);self.assertEqual(bytes(h.mem['CB25Data']),before)

    def test_shared_render_and_id_readers_recall_filename_alias(self):
        for source,routine in [('Render Capture/RenderCapture.txt','RC_CB29_LoadSlot'),
                               ('Generate and Export ID/GenerateExportID.txt','ID_CB29_LoadSlot')]:
            with self.subTest(source=source):
                h=Host();h.load(ROOT.parent/'Camera Bank Fast/CameraBankFast25.txt')
                parts(h,['A','B','C']);h.ids=[16777219,16777218,4294967295]
                h.call('FB29_SaveSlot',0);h.status=[0,1,0];h.st=1;h.call('FB29_SaveSlot',1)
                self.alias(h);h.load(ROOT/source)
                h.call(routine,1);self.assertEqual([s&1 for s in h.status],[0,1,0])


if __name__=='__main__':unittest.main(verbosity=2)
