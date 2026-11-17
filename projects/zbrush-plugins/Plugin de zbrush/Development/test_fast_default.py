"""Integration regressions for consumers of the isolated Fast bank."""
from pathlib import Path
import copy
import json
import os
import struct
import subprocess
import tempfile
import unittest

from verify import Host, Exit, ROOT
from verify_merge import parts
import test_id_export as id_cases
import test_render_layout as render_cases
from build_fast_reader import FAST_SOURCE, compose


class FastDefault(unittest.TestCase):
    def test_imported_native_views_are_regular_fast_cameras_for_both_consumers(self):
        for consumer,check,recall in [('Render Capture/RenderCapture.txt','RC_CheckBank','RC_CB29_LoadSlot'),
                                     ('Generate and Export ID/GenerateExportID.txt','ID_CheckBank','ID_CB29_LoadSlot')]:
            with self.subTest(consumer=consumer):
                h=Host();h.load(FAST_SOURCE);parts(h,['Body','Hat'],[1,0]);h.st=0
                h.mem['FBVInput']=bytearray(320)
                struct.pack_into('<10f',h.mem['FBVInput'],0,.25,.5,0,.1,.1,.1,10,20,30,1)
                h.call('FBV_AcceptVWS');h.load(ROOT/consumer)
                if 'FBF_SetAllRender' in h.routines:
                    h.call(check)  # Fast 0.3 imports with Render ON.
                    h.call('FBF_SetAllRender',0)
                    with self.assertRaises(Exit):h.call(check)
                    h.call('FBF_SetAllRender',1)
                else:
                    # Extracted 3.2.6 releases also run against their 0.2 reference.
                    with self.assertRaises(Exit):h.call(check)
                    struct.pack_into('<f',h.mem['FB25Data'],36*4,1)
                h.call(check);h.call(recall,0)
                self.assertAlmostEqual(h.transform[0],480)
                self.assertAlmostEqual(h.transform[1],540)
                self.assertEqual([x&1 for x in h.status],[1,0])

    def legacy_decoy(self,h):
        h.mem['CB25Data']=bytearray(h.mem['FB25Data'])
        for slot in range(25):
            struct.pack_into('<f',h.mem['CB25Data'],(20+slot*20)*4,0)
        struct.pack_into('<f',h.mem['CB25Data'],(20+24*20)*4,1)
        struct.pack_into('<f',h.mem['CB25Data'],(36+24*20)*4,1)
        return bytes(h.mem['CB25Data'])

    def test_render_and_both_id_modes_use_fast_when_legacy_bank_also_exists(self):
        with tempfile.TemporaryDirectory() as parent:
            h=render_cases.RenderLayout().host();legacy=self.legacy_decoy(h);h.chosen=parent
            h.call('RC_CreateFolders');h.call('RC_NonBPR');h.call('RC_BPR')
            self.assertEqual({Path(e['path']).parent.name for e in h.exports},{'01','10','25'})
            self.assertEqual(bytes(h.mem['CB25Data']),legacy)
        for generate in (False,True):
            with self.subTest(generate=generate),tempfile.TemporaryDirectory() as parent:
                case=id_cases.IDExport();h=case.host();h.chosen=parent;legacy=self.legacy_decoy(h)
                (case.click if generate else case.export_only)(h)
                self.assertEqual([Path(e['path']).parent.name for e in h.exports],['01','10'])
                self.assertEqual(bytes(h.mem['CB25Data']),legacy)

    def test_a_valid_legacy_bank_never_substitutes_for_missing_or_empty_fast(self):
        for consumer in ('render','id'):
            for mode in ('missing','empty','wrong_version'):
                with self.subTest(consumer=consumer,mode=mode):
                    h=render_cases.RenderLayout().host() if consumer=='render' else id_cases.IDExport().host()
                    legacy=self.legacy_decoy(h)
                    if mode=='missing':del h.mem['FB25Data']
                    elif mode=='wrong_version':struct.pack_into('<f',h.mem['FB25Data'],4,8)
                    else:
                        for slot in range(25):struct.pack_into('<f',h.mem['FB25Data'],(20+slot*20)*4,0)
                    with self.assertRaises(Exit):h.call('RC_CheckBank' if consumer=='render' else 'ID_CheckBank')
                    self.assertEqual(bytes(h.mem['CB25Data']),legacy)
                    self.assertTrue(any('Fast' in m for m in h.messages))

    def test_both_consumers_block_all_fast_pending_writer_markers_before_snapshots(self):
        for consumer in ('render','id'):
            for marker in ('FBFTxn','FBFOriginal','FB32RenameState','FB32OriginalBank'):
                with self.subTest(consumer=consumer,marker=marker):
                    h=render_cases.RenderLayout().host() if consumer=='render' else id_cases.IDExport().host()
                    h.mem[marker]=bytearray(struct.pack('<f',1))
                    before=bytes(h.mem['FB25Data']),h.names[:],h.status[:],h.st
                    with self.assertRaises(Exit):h.call('RC_CheckBank' if consumer=='render' else 'ID_CheckBank')
                    self.assertEqual((bytes(h.mem['FB25Data']),h.names,h.status,h.st),before)
                    self.assertNotIn('ID32Recovery',h.mem);self.assertNotIn('RC30Recovery',h.mem)
                    self.assertTrue(any('pending' in m for m in h.messages))

    def test_warm_300_part_fast_binding_is_reused_by_each_private_reader(self):
        for filename,routine in [('Render Capture/RenderCapture.txt','RC_CB29_LoadSlot'),
                                 ('Generate and Export ID/GenerateExportID.txt','ID_CB29_LoadSlot')]:
            with self.subTest(consumer=filename):
                h=Host();h.record_calls=False;h.load(FAST_SOURCE)
                parts(h,[f'Part{i}' for i in range(300)]);h.ids=[16777219+i for i in range(300)]
                h.call('FB29_SaveSlot',0);binding=bytes(h.mem['FBFCache'])
                h.load(ROOT/filename);h.record_calls=True;h.calls.clear();h.call(routine,0)
                self.assertEqual(sum(c=='SubToolSelect' for c,a in h.calls),1)
                self.assertEqual(bytes(h.mem['FBFCache']),binding)
                self.assertNotIn('CB25Data',h.mem)

    def test_id_recovery_does_not_rewrite_a_replacement_fast_bank_or_legacy_bank(self):
        h=id_cases.IDExport().host();h.call('ID_Snapshot');legacy=self.legacy_decoy(h)
        struct.pack_into('<f',h.mem['FB25Data'],8*4,777777)
        struct.pack_into('<f',h.mem['FB25Data'],5*4,22)
        h.call('ID_Restore',1)
        self.assertEqual(struct.unpack_from('<f',h.mem['FB25Data'],5*4)[0],22)
        self.assertEqual(bytes(h.mem['CB25Data']),legacy)
        h.call('ID_Snapshot');struct.pack_into('<f',h.mem['ID32Recovery'],26*4,0)
        before=bytes(h.mem['FB25Data'])
        with self.assertRaises(Exit):h.call('ID_Restore',1)
        self.assertEqual(bytes(h.mem['FB25Data']),before)
        self.assertGreater(struct.unpack_from('<f',h.mem['ID32Recovery'],0)[0],0)

    def test_generated_reader_has_no_camera_ui_or_writer_dependency(self):
        reader=(ROOT/'Development/camera_reader.inc').read_text(encoding='ascii')
        # A writer-only update changes the source hash, not the adapter body.
        self.assertEqual(reader.split('\n',3)[3],compose().split('\n',3)[3])
        for forbidden in ('[IButton,','[ISwitch,','[RoutineDef,RC_CB32_Rename,','[MemCopy,FB25Data','[MVarDef,FB25Data'):
            self.assertNotIn(forbidden,reader)
        self.assertIn('[MVarGet,FB25Data',reader)
        self.assertNotIn('[MVarGet,CB25Data',reader)

    def test_default_installer_targets_only_render_and_id(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'Development') as d:
            base=Path(d);zb=base/'ZBrush';zb.mkdir();(zb/'ZBrush.exe').write_bytes(b'fixture')
            (zb/'ZStartup/ZPlugs64').mkdir(parents=True)
            result=subprocess.run(['powershell.exe','-NoProfile','-File',str(ROOT/'Install.ps1'),
                                   '-ZBrushPath',str(zb),'-PlanOnly'],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            plan=json.loads(result.stdout);self.assertEqual(plan['Component'],'RenderID')
            self.assertTrue(all('RenderCapture' in x['Target'] or 'Render Capture' in x['Target'] or
                                'GenerateExportID' in x['Target'] or 'Generate and Export ID' in x['Target']
                                for x in plan['Actions']))
            install=subprocess.run(['powershell.exe','-NoProfile','-File',str(ROOT/'Install.ps1'),
                                    '-ZBrushPath',str(zb)],capture_output=True,text=True)
            self.assertEqual(install.returncode,0,install.stdout+install.stderr)
            plugs=zb/'ZStartup/ZPlugs64'
            for data,name in [('RenderCaptureData','RenderCapture'),('GenerateExportIDData','GenerateExportID')]:
                self.assertEqual((plugs/(name+'.zsc')).read_bytes(),
                                 (plugs/data/(name+'.zsc')).read_bytes())


if __name__=='__main__':unittest.main(verbosity=2)
