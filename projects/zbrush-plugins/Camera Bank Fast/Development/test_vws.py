"""Execute the shipped importer and writer against synthetic native VWS data.

Client files stay private and are used only by the separate native QA.
"""
import copy
import re
from pathlib import Path
import struct
import tempfile
import unittest

import test_fast as fast_cases
from fast_test_host import Exit, get, parse


def views(indices=range(8)):
    data = bytearray(320)
    for i in indices:
        struct.pack_into('<10f', data, i * 40,
                         .25+i*.03, .4+i*.02, .125, .08, .08, .08,
                         -15+i*2, 30+i*10, -.25+i, 1)
    return data


class VWS(unittest.TestCase):
    def test_importer_text_fits_native_zscript_strings(self):
        source=(Path(__file__).parent/'vws.inc').read_text(encoding='ascii')
        for literal in re.findall(r'"([^"\n]*)"',source):
            self.assertLessEqual(len(literal),245)

    def host(self):
        return fast_cases.Fast().host(4)

    def import_views(self, h, data=None):
        h.mem['CBVInput'] = bytearray(views() if data is None else data)
        h.call('CBV_AcceptVWS')

    def test_eight_views_convert_normalized_coordinates_and_capture_defaults(self):
        h = self.host(); h.status = [1, 0, 1, 0]; h.st = 2
        before = h.transform[:], h.status[:], h.st, h.zoom, h.pan[:], copy.deepcopy(h.ui)
        self.import_views(h)
        self.assertEqual(h.v['vwsImported'], 8)
        self.assertEqual(h.transform, before[0]); self.assertEqual(h.status, before[1])
        self.assertEqual((h.st, h.zoom, h.pan), before[2:5])
        settings = {key: value for key, value in h.ui.items() if not key.startswith('ZPlugin:')}
        self.assertEqual(settings,{key: value for key, value in before[5].items() if not key.startswith('ZPlugin:')})
        self.assertEqual(get(h, 7), 1); self.assertEqual(get(h, 5), 0)
        for i in range(8):
            base = 20+i*20
            raw = struct.unpack_from('<10f', views(), i*40)
            expected = [raw[0]*1920, raw[1]*1080, raw[2]]
            expected += [value*1920 for value in raw[3:6]]
            expected += list(raw[6:9])
            self.assertEqual(get(h, base), 1); self.assertEqual(get(h, base+16), 1)
            for j, value in enumerate(expected):
                self.assertAlmostEqual(get(h, base+1+j), value, delta=.0001)
            self.assertEqual([get(h, base+j) for j in (18,19)], [1920,1080])
            self.assertEqual(get(h, base+11), 50)
            h.call('CB29_LoadSlot', i)
            self.assertEqual([s & 1 for s in h.status], [1,0,1,0])
        self.assertNotIn('CBVInput', h.mem)

    def test_partial_file_appends_into_holes_preserving_existing_cameras(self):
        h = self.host(); h.call('CB29_SaveSlot',0); h.call('CB29_SaveSlot',2)
        h.mem['CB25Data'][36*4:37*4] = struct.pack('<f',0)
        old = {i:bytes(h.mem['CB25Data'][(20+i*20)*4:(40+i*20)*4]) for i in (0,2)}
        active = get(h,5); names = h.names[:]
        self.import_views(h, views((1,4,7)))
        self.assertEqual([h.v['vwsSlots'][i] for i in range(3)], [1,3,4])
        self.assertEqual(get(h,5), active); self.assertEqual(h.names, names)
        for i, record in old.items():
            self.assertEqual(bytes(h.mem['CB25Data'][(20+i*20)*4:(40+i*20)*4]),record)
        self.assertEqual(get(h,20+1*20+8), 40)
        self.assertEqual(get(h,20+4*20+8), 100)

    def test_public_bulk_buttons_change_only_occupied_render_flags(self):
        h = self.host()
        h.call('CB29_SaveSlot', 10)
        self.import_views(h, views((1, 7)))
        data = h.mem['CB25Data']
        off = 'ZPlugin:Camera Bank 25:Desactivar todas las camaras'
        on = 'ZPlugin:Camera Bank 25:Activar todas las camaras'
        controls = [node for node in parse(fast_cases.compose(False)) if node[0] in ('IButton','ISwitch')]
        slot_one = next(i for i, node in enumerate(controls) if node[1] == '"ZPlugin:Camera Bank 25:01"')
        self.assertEqual([node[1].strip('"') for node in controls[slot_one-2:slot_one]], [off,on])
        view = h.transform[:], h.status[:], h.names[:]
        for button, enabled in zip(controls[slot_one-2:slot_one], (0,1)):
            expected = bytearray(data)
            for slot in (0,1,10):
                struct.pack_into('<f',expected,(36+slot*20)*4,enabled)
            h.run(button[3])
            self.assertEqual(data, expected)
            self.assertEqual((h.transform, h.status, h.names), view)
            for slot in (0,1,10):
                self.assertEqual(h.ui[f'ZPlugin:Camera Bank 25:{slot+1:02}'],enabled)
            self.assertEqual(h.ui['ZPlugin:Camera Bank 25:03'],0)

    def test_invalid_empty_and_nonfinite_files_do_not_modify_bank_or_model(self):
        invalid = [b'bad', bytes(319), bytes(324), bytes(320)]
        for index, value in ((9,2),(0,float('nan')),(3,0),(4,-1),(8,float('inf'))):
            data = views(); struct.pack_into('<f',data,index*4,value); invalid.append(data)
        for data in invalid:
            with self.subTest(size=len(data)):
                h=self.host();h.call('CB29_SaveSlot',0)
                before=bytes(h.mem['CB25Data']),h.names[:],h.status[:],h.transform[:]
                with self.assertRaises(Exit):self.import_views(h,data)
                self.assertEqual((bytes(h.mem['CB25Data']),h.names,h.status,h.transform),before)
                self.assertNotIn('CBVInput',h.mem)

    def test_capacity_is_checked_for_entire_set_and_legacy_is_rejected(self):
        for legacy in (False,True):
            h=self.host();h.call('CB29_SaveSlot',0)
            if legacy:struct.pack_into('<f',h.mem['CB25Data'],7*4,0)
            else:
                for i in range(20):struct.pack_into('<f',h.mem['CB25Data'],(20+i*20)*4,1)
            before=bytes(h.mem['CB25Data']),h.names[:]
            with self.assertRaises(Exit):self.import_views(h)
            self.assertEqual((bytes(h.mem['CB25Data']),h.names),before)
            self.assertNotIn('CB32RenameState',h.mem);self.assertNotIn('CBFTxn',h.mem)

    def test_cancel_and_missing_edit_mode_do_not_create_cameras(self):
        h=self.host();before=bytes(h.mem['CB25Data']);h.ask=''
        with self.assertRaises(Exit):h.call('CBV_ImportVWS')
        self.assertEqual(bytes(h.mem['CB25Data']),before)
        h.ui['Transform:Edit']=0
        with self.assertRaises(Exit):self.import_views(h)
        self.assertEqual(bytes(h.mem['CB25Data']),before)

    def test_interrupted_batch_recovers_all_cameras_and_initial_names(self):
        for existing in (False,True):
            h=self.host()
            if existing:h.call('CB29_SaveSlot',10)
            before=bytes(h.mem['CB25Data']),h.names[:],h.status[:],h.st,h.transform[:]
            original=h.cmd;copied=0
            def interrupt(n):
                nonlocal copied
                result=original(n)
                if n[0]=='MemCopy' and n[1]=='CBVInput':
                    copied+=1
                    if copied==2:raise RuntimeError('simulated interruption')
                return result
            h.cmd=interrupt
            with self.assertRaises(RuntimeError):self.import_views(h)
            h.cmd=original;h.call('CB32_Recover')
            self.assertEqual((bytes(h.mem['CB25Data']),h.names,h.status,h.st,h.transform),before)

    def test_imported_views_update_and_export_as_regular_v9_bank(self):
        h=self.host();self.import_views(h,views((0,7)))
        h.call('CB29_LoadSlot',0);h.status=[0,1,0,1];h.st=1
        h.call('CB29_SaveSlot',0)
        self.assertEqual(get(h,36),1)
        with tempfile.TemporaryDirectory() as folder:
            h.ask=str(Path(folder)/'imported.zcv');h.call('CB29_ExportBank')
            payload=Path(h.ask).read_bytes();self.assertEqual(len(payload),123088)
            h.call('CB29_CreateEmptyBank');h.call('CB29_ImportBank')
            h.call('CB29_LoadSlot',0)
            self.assertEqual([s&1 for s in h.status],[0,1,0,1])
            self.assertEqual(get(h,20+20),1)


if __name__ == '__main__': unittest.main(verbosity=2)
