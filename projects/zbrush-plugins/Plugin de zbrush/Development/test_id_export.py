"""Execute actual delivered ID ZScript routines in a mock host.

The interpreter is shared with the reviewed Camera Bank tests. These tests do
not compile ZScript, load ZBrush, or prove actual ZTL/PNG visual correctness.
Requires Camera Bank 3.2 automatic tracking. ZBRUSH_ID_CAMERA_ROOT can select
pinned integration inputs without replacing the worktree's camera files.
"""
from pathlib import Path
import copy
import os
import struct
import tempfile
import unittest

from build_id import compose, OUTPUT
from verify import Host, Exit, parse, node, clean, ROOT

CAMERA_ROOT = Path(os.environ.get('ZBRUSH_ID_CAMERA_ROOT', ROOT))


def commands(source):
    """Walk commands inside bodies and expression arguments, skipping strings."""
    source = clean(source)
    i = 0
    quoted = False
    while i < len(source):
        if source[i] == '"':
            quoted = not quoted
        if source[i] == '[' and not quoted:
            item, i = node(source, i)
            yield item
            for argument in item[1:]:
                yield from commands(argument)
        else:
            i += 1


class IDHost(Host):
    def __init__(self):
        super().__init__()
        self.ui.update({
            'Tool:Save As': 0, 'Color:FillObject': 0, 'Draw:M': 0,
            'Draw:Rgb': 1, 'Draw:Mrgb': 0, 'Draw:RGB Intensity': 42,
            'Tool:Polygroups:Auto Groups': 0,
            'Tool:Polypaint:Polypaint From Polygroups': 0,
            'Tool:Masking:Clear': 0, 'Transform:Draw Polyframe': 1,
            'Document:Resize': 0, 'Transform:Draw Pointer': 0,
            'Layer:Clear': 0, 'Draw:Floor': 1,
            'Preferences:LightBox:LightBox': 0,
            'Preferences:Thumbnail:T.Thumbnail': 1,
        })
        self.mats += ['Flat Color', 'Flat Color altered']
        self.events = []
        self.meshes = []
        self.tool_path = 'owner/Original'
        self.choose_calls = 0
        self.save_failure = None
        self.write_failure = None
        self.export_failure = False
        self.dll_available = True
        self.dll_version = 8
        self.mesh_disabled = {}
        self.interrupt_on = None
        self.selection_moves_camera = False
        self.corrupt_png = False
        self.string_merges = []
        self.notices = []
        self.backup_number = None
        self.backup_states = {}
        self.save_rename_target = 'first'
        self.path_failure_once = False
        self.memory_reads = []
        self.path_updates = []

    def cmd(self, n):
        c, *a = n
        E = lambda i: self.e(a[i])
        variable_names = []
        if c in ['VarDef', 'VarSet', 'VarInc', 'VarDec']:
            variable_names.append(a[0].split('(', 1)[0])
        if c == 'RoutineDef':
            variable_names += a[2:]  # Routine name itself may contain underscores.
        if c == 'Loop' and len(a) > 2:
            variable_names.append(a[2])
        for name in variable_names:
            assert '_' not in name, ('Native variable identifier', name)
        if c == 'If':
            assert '[ToolSetPath' not in a[0], 'Pre-evaluate native ToolSetPath result'
        if c == 'StrFind':
            assert all('[IGetTitle' not in value for value in a), 'Pre-evaluate native material title lookup'
        if c == 'StrMerge':
            assert len(a) <= 12, ('Native StrMerge input limit', len(a))
            result = ''.join(str(self.e(value)) for value in a)
            assert len(result) <= 255, ('Native string limit', len(result), a)
            self.string_merges.append((tuple(a), result))
            return result
        if c in ['MessageOK', 'NoteBar', 'Note', 'MemWriteString']:
            value = E(1) if c == 'MemWriteString' else E(0)
            assert len(str(value)) <= 255, ('Native string limit', c, len(str(value)))
            if c != 'MemWriteString':
                self.notices.append((c, str(value), len(self.events)))
                if c == 'NoteBar' and str(value).startswith('Backup saved:') and self.interrupt_on == 'backup_notice':
                    raise Exit()
        if c == 'VarSet' and a[0] == 'idBackupNumber' and self.backup_number is not None:
            # Exercise the maximum allowed suffix without creating 9998 files.
            self.set(a[0], self.backup_number)
            return
        if c == 'MemResize':
            size = int(E(1))
            self.mem[a[0]] = self.mem[a[0]][:size]
            return size
        if c == 'FileGetInfo':
            p = Path(E(0))
            return p.stat().st_size / (1024 * 1024) if p.is_file() else 0
        if c == 'ToolGetPath':
            return self.tool_path
        if c == 'ToolSetPath':
            assert '[ToolGetActiveIndex' not in a[0], 'Pre-evaluate native ToolGetActiveIndex'
            index, path = E(0), E(1)
            if self.path_failure_once:
                self.path_failure_once = False
                self.path_updates.append((index, path, -1))
                return -1
            # Deliberately does NOT repair SubTool names changed by Save As.
            self.tool_path = path
            self.path_updates.append((index, path, 0))
            return 0
        if c == 'MemWrite':
            fmt = {2: 'B', 6: 'I'}[int(E(2))]
            struct.pack_into('<'+fmt, self.mem[a[0]], int(E(3)), int(E(1)))
            return struct.calcsize(fmt)
        if c == 'MemRead':
            assert a[1] in self.v and isinstance(self.v[a[1]], (int, float)), (
                'Native MemRead output must be initialized numerically', a[1])
            fmt = {2: 'B', 6: 'I'}[int(E(2))]
            before = self.v[a[1]]
            value = struct.unpack_from('<'+fmt, self.mem[a[0]], int(E(3)))[0]
            self.set(a[1], value)
            self.memory_reads.append((a[1], before, value))
            return struct.calcsize(fmt)
        if c == 'FileNameSetNext' and not a:
            self.nextfile = ''
            return
        if c == 'MemCreateFromFile':
            p = Path(E(1))
            if not p.is_file():
                return -3
            data = p.read_bytes()
            if len(a) > 2:
                start = int(E(2))
                data = data[start:start+int(E(3))] if len(a) > 3 else data[start:]
            self.mem[a[0]] = bytearray(data)
            return len(data)
        if c == 'MemSaveToFile' and self.write_failure and self.write_failure in E(1):
            return -3
        if c == 'FileExists' and E(0).endswith('.dll'):
            return int(self.dll_available)
        if c == 'FileExecute':
            if E(1) == 'Version':
                return self.dll_version
            if E(1) == 'ChooseFolder':
                self.choose_calls += 1
        if c == 'IsEnabled':
            k = E(0)
            if k in self.mesh_disabled.get(self.st, set()):
                return 0
        if c == 'SubToolSelect':
            r = super().cmd(n)
            if self.selection_moves_camera:
                self.transform[0] += 17
                self.zoom += .5
                self.pan[0] += 11
            return r
        if c == 'IPress':
            k = E(0)
            if k in ['Draw:M', 'Draw:Rgb', 'Draw:Mrgb']:
                for mode in ['Draw:M', 'Draw:Rgb', 'Draw:Mrgb']:
                    self.ui[mode] = int(mode == k)
                return
            if k in ['Render:Preview', 'Render:Best', 'Render:Fast', 'Render:Flat']:
                for mode in ['Render:Preview', 'Render:Best', 'Render:Fast', 'Render:Flat']:
                    self.ui[mode] = int(mode == k)
                return
            if k == 'Tool:Save As':
                self.events.append(('backup', self.nextfile, copy.deepcopy(self.meshes), self.status[:], self.st))
                self.tool_path = str(Path(self.nextfile).with_suffix(''))
                rename_index = 0 if self.save_rename_target == 'first' else self.st
                # Native finding: Save As replaces a SubTool title with the
                # filename stem. Model even a cancelled/failed attempt this way.
                self.names[rename_index] = Path(self.nextfile).stem
                if self.save_failure == 'cancel':
                    return
                Path(self.nextfile).write_bytes(b'' if self.save_failure == 'empty' else
                                               b'NOT A NATIVE ZTL - MOCK ONLY' + bytes(100))
                self.backup_states[self.nextfile] = {
                    key: copy.deepcopy(getattr(self, key))
                    for key in ['names', 'ids', 'status', 'pp', 'tx', 'folders', 'meshes', 'st']}
                if self.interrupt_on == 'save':
                    raise Exit()
                return
            actions = {'Color:FillObject': 'fill',
                       'Tool:Polygroups:Auto Groups': 'groups',
                       'Tool:Polypaint:Polypaint From Polygroups': 'polypaint',
                       'Tool:Masking:Clear': 'unmask'}
            if k in actions:
                event = actions[k]
                mesh = self.meshes[self.st]
                if event == 'fill':
                    before = copy.deepcopy(mesh['rgb'])
                    if self.ui['Draw:Mrgb'] or self.ui['Draw:Rgb']:
                        mesh['rgb'] = [(self.ui['Color:R'], self.ui['Color:G'], self.ui['Color:B'])] * 2
                    if self.ui['Draw:Mrgb'] or self.ui['Draw:M']:
                        mesh['material'] = self.mats[int(self.ui['Material:ItemInfo'])]
                    self.events.append((event, self.names[self.st], before, copy.deepcopy(mesh)))
                elif event == 'groups':
                    mesh['generation'] += 1
                    mesh['groups'] = (self.st * 2 + 1, self.st * 2 + 2)
                    self.events.append((event, self.names[self.st]))
                elif event == 'polypaint':
                    mesh['rgb'] = [(g * 29, g * 17, g * 7) for g in mesh['groups']]
                    self.events.append((event, self.names[self.st]))
                else:
                    mesh['masked'] = False
                    self.events.append((event, self.names[self.st]))
                if self.interrupt_on == event:
                    raise Exit()
                return
            if k == 'Document:Export':
                self.events.append(('export', self.nextfile, copy.deepcopy(self.meshes)))
                if self.export_failure:
                    return
                old_button = self.ui[k]
                super().cmd(n)
                self.ui[k] = old_button
                Path(self.nextfile).write_bytes(b'corrupt!' if self.corrupt_png else b'\x89PNG\r\n\x1a\nMOCK IMAGE ONLY')
                self.exports[-1]['mesh_rgb'] = [copy.deepcopy(m['rgb']) for m in self.meshes]
                self.exports[-1]['mesh_materials'] = [m['material'] for m in self.meshes]
                self.exports[-1]['polyframe'] = self.ui_get(self.v['idPolyPath'])
                return
            if k in ['Document:Resize', 'Layer:Clear', 'Transform:Draw Pointer']:
                old_button = self.ui[k]
                result = super().cmd(n)
                self.ui[k] = old_button
                return result
        return super().cmd(n)


def cell(h, index, value=None):
    if value is None:
        return struct.unpack_from('<f', h.mem['CB25Data'], index * 4)[0]
    struct.pack_into('<f', h.mem['CB25Data'], index * 4, value)


class IDExport(unittest.TestCase):
    def host(self, reorder=False):
        h = IDHost()
        h.load(CAMERA_ROOT / 'Camera Bank/CameraBank25.txt')
        h.names = ['A', 'B', 'C', 'Never', 'GrayOnly']
        h.ids = [123, 123, 16777219, 10004, 10005]  # Duplicates and IDs > float precision.
        h.status = [1, 1, 0, 0, 0]
        h.pp = [0, 1, 0, 0, 1]
        h.tx = [1, 1, 1, 1, 0]
        h.folders = [-1] * 5
        h.st = 0
        h.call('CB29_SaveSlot', 0)
        h.status = [0, 1, 1, 0, 0]
        h.st = 1
        h.ui.update({'Document:Width': 800, 'Document:Height': 600})
        h.dims = [800, 600]
        h.call('CB29_SaveSlot', 9)
        h.status = [0, 0, 0, 0, 1]
        h.st = 4
        h.call('CB29_SaveSlot', 24)
        cell(h, 20+24*20+16, 0)
        self.assertEqual(cell(h, 7), 1)  # Store/update tracks automatically.
        if reorder:
            order = [4, 2, 0, 3, 1]
            for attr in ['names', 'ids', 'status', 'pp', 'tx', 'folders']:
                setattr(h, attr, [getattr(h, attr)[i] for i in order])
        h.meshes = [dict(rgb=[(20+i, 40+i, 60+i), (80+i, 90+i, 100+i)],
                         material='Original', groups=(88, 99), generation=0, masked=True)
                    for i in range(5)]
        h.status = [0x401, 0, 1, 0x21, 0]
        h.st = 3
        h.ui['Transform:Solo'] = 1
        h.ui['Draw:Perspective'] = 0
        h.ui['Render:Preview'] = 0
        h.ui['Render:Fast'] = 1
        h.transform = [7.0] * 9
        h.zoom = 1.75
        h.pan = [-12, 38]
        h.load(OUTPUT)
        h.events.clear()
        h.notices.clear()
        h.string_merges.clear()
        h.messages.clear()
        return h

    def click(self, h):
        buttons = [n for n in parse(OUTPUT.read_text('ascii')) if n[0] == 'IButton']
        self.assertEqual(len(buttons), 1)
        self.assertEqual(buttons[0][1], '"ZPlugin:Generar y exportar ID:Generar y exportar ID"')
        h.run(buttons[0][3])

    def unchanged_meshes(self, h, before):
        self.assertEqual(h.meshes, before)
        self.assertFalse(any(e[0] in {'fill', 'groups', 'polypaint', 'unmask'} for e in h.events))
        self.assertEqual(h.exports, [])

    def test_generated_source_matches_current_inputs(self):
        self.assertEqual(OUTPUT.read_text('ascii'), compose(camera_root=CAMERA_ROOT))
        h = IDHost()
        h.load(OUTPUT)
        self.assertFalse(any(k.startswith(('cb', 'rc')) for k in h.globals))
        self.assertFalse(any(k.startswith('RC_') for k in h.routines))

    def test_one_button_new_session_material_only_union_consistent_views_and_restore(self):
        for reorder in [False, True]:
            with self.subTest(reorder=reorder), tempfile.TemporaryDirectory() as d:
                h = self.host(reorder)
                before = copy.deepcopy(h.meshes)
                before_names = h.names[:]
                before_pp = h.pp[:]
                state = (h.status[:], h.st, h.tx[:], h.transform[:], h.zoom, h.pan[:],
                         copy.deepcopy(h.ui), h.tool_path, cell(h, 5))
                h.selection_moves_camera = True
                h.chosen = d
                self.click(h)
                self.assertEqual(h.choose_calls, 1)
                self.assertEqual([Path(e['path']).parts[-2:] for e in h.exports],
                                 [('01', 'ID.png'), ('10', 'ID.png')])
                self.assertEqual([e['dims'] for e in h.exports], [[1920, 1080], [800, 600]])
                self.assertEqual([m['generation'] for m in h.meshes],
                                 [0, 1, 1, 0, 1] if reorder else [1, 1, 1, 0, 0])
                needed = [i for i, n in enumerate(h.names) if n.endswith(('_A', '_B', '_C'))]
                hidden = set(range(5)) - set(needed)
                self.assertEqual(len(needed), 3)
                for i in hidden:
                    self.assertEqual(h.meshes[i], before[i])
                    self.assertEqual(h.pp[i], before_pp[i])
                fills = [e for e in h.events if e[0] == 'fill']
                self.assertEqual(len(fills), 3)
                for e in fills:
                    self.assertEqual(e[2], e[3]['rgb'])
                    self.assertEqual(e[3]['material'], 'Flat Color')
                self.assertEqual(h.events[0][0], 'backup')
                self.assertEqual(h.events[0][2], before)
                self.assertEqual(h.events[0][3:], (state[0], 0))  # Save from the top mesh.
                self.assertEqual(Path(h.events[0][1]).stem, before_names[0])
                self.assertEqual(h.names, before_names)
                self.assertEqual(h.exports[0]['mesh_rgb'], h.exports[1]['mesh_rgb'])
                for export in h.exports:
                    self.assertEqual(export['solo'], 0)
                    self.assertEqual(export['polyframe'], 0)
                    for i in needed:
                        self.assertEqual(export['pp'][i], 1)
                        self.assertEqual(export['tx'][i], 0)
                        self.assertEqual(export['mesh_materials'][i], 'Flat Color')
                self.assertEqual(h.status, state[0])
                self.assertEqual(h.st, state[1])
                self.assertEqual(h.tx, state[2])
                self.assertEqual((h.transform, h.zoom, h.pan), state[3:6])
                self.assertEqual(h.ui, state[6])
                self.assertEqual(h.tool_path, state[7])
                self.assertEqual(cell(h, 5), state[8])
                self.assertTrue(all(h.pp[i] == 1 for i in needed))
                self.assertEqual(struct.unpack_from('<f', h.mem['ID32Recovery'])[0], 0)
                self.assertTrue(Path(h.v['idBackup']).is_file())
                self.assertIn('complete', Path(h.v['idRecord']).read_text().lower())
                self.assertFalse((Path(h.v['idRoot']) / '25').exists())
                self.assertFalse(list(Path(d).rglob('*.tmp')))
                self.assertFalse(any('BPR' in str(e) for e in h.events))

    def test_existing_root_other_passes_and_unique_recovery(self):
        h = self.host()
        with tempfile.TemporaryDirectory() as d:
            session = Path(d) / 'ZPass_3'
            (session / '01').mkdir(parents=True)
            other = session / '01/_Depth.psd'
            other.write_bytes(b'keep')
            (session / 'Recovery').mkdir()
            old = session / 'Recovery/Before_ID_1.ztl'
            old.write_bytes(b'old backup')
            h.mem['RC30Root'] = bytearray(str(session).encode()+b'\0')
            self.click(h)
            self.assertEqual(h.choose_calls, 0)
            self.assertEqual(Path(h.v['idRoot']), session)
            self.assertEqual(other.read_bytes(), b'keep')
            self.assertEqual(old.read_bytes(), b'old backup')
            self.assertEqual(Path(h.v['idBackup']).parent.name, 'Before_ID_2')
            self.assertEqual(Path(h.v['idBackup']).stem, h.names[0])

    def test_resize_items_can_be_disabled_until_shared_reader_leaves_edit(self):
        h = self.host()
        for item in ['Document:Width', 'Document:Height', 'Document:Pro',
                     'Document:Resize', 'Transform:Draw Pointer', 'Layer:Clear']:
            h.enabled[item] = False
        with tempfile.TemporaryDirectory() as d:
            h.chosen = d
            self.click(h)
            self.assertEqual(len(h.exports), 2)

    def test_fov_restores_before_perspective_off_and_camera_lock(self):
        h = self.host()
        h.ui['Draw:Lock Camera'] = 1
        h.ui['Draw:Field Of View(deg)'] = 72
        original = h.cmd
        def cmd(n):
            if n[0] == 'IsEnabled' and h.e(n[1]) in ['Draw:Focal Length(mm)', 'Draw:Field Of View(deg)']:
                return int(h.ui['Draw:Perspective'] == 1)
            if n[0] in ['MTransformSet', 'CanvasZoomSet', 'CanvasPanSet']:
                # Direct view restoration must happen while the camera is free.
                if h.ui['Draw:Lock Camera']:
                    return
            return original(n)
        h.cmd = cmd
        state = h.transform[:], h.zoom, h.pan[:]
        with tempfile.TemporaryDirectory() as d:
            h.chosen = d
            self.click(h)
            self.assertEqual(h.ui['Draw:Field Of View(deg)'], 72)
            self.assertEqual(h.ui['Draw:Perspective'], 0)
            self.assertEqual(h.ui['Draw:Lock Camera'], 1)
            self.assertEqual((h.transform, h.zoom, h.pan), state)

    def test_new_root_skips_existing_session_and_invalid_cached_root(self):
        h = self.host()
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / 'ZPass_1').mkdir()
            h.mem['RC30Root'] = bytearray(str(Path(d)/'missing').encode()+b'\0')
            h.chosen = d
            self.click(h)
            self.assertEqual(Path(h.v['idRoot']).name, 'ZPass_2')

    def test_collision_in_later_camera_is_before_backup_and_mutation(self):
        h = self.host()
        with tempfile.TemporaryDirectory() as d:
            (Path(d)/'10').mkdir()
            target = Path(d)/'10/ID.png'
            target.write_bytes(b'keep')
            h.mem['RC30Root'] = bytearray(d.encode()+b'\0')
            before = copy.deepcopy(h.meshes)
            with self.assertRaises(Exit):
                self.click(h)
            self.unchanged_meshes(h, before)
            self.assertFalse(h.events)
            self.assertEqual(target.read_bytes(), b'keep')

    def test_cancel_choose_has_no_mesh_changes(self):
        h = self.host()
        before = copy.deepcopy(h.meshes)
        with self.assertRaises(Exit):
            self.click(h)
        self.unchanged_meshes(h, before)
        self.assertTrue(any('cancelled' in message for message in h.messages))

    def test_missing_controls_material_dll_edit_or_bank_abort_before_mutation(self):
        cases = ['control', 'material', 'dll', 'dll_version', 'edit', 'no_bank',
                 'empty_bank', 'positional', 'dimensions', 'mesh_control']
        for case in cases:
            with self.subTest(case=case), tempfile.TemporaryDirectory() as d:
                h = self.host()
                h.chosen = d
                if case == 'control':
                    del h.ui['Color:FillObject']
                if case == 'material':
                    h.mats.remove('Flat Color')
                if case == 'dll':
                    h.dll_available = False
                if case == 'dll_version':
                    h.dll_version = 7
                if case == 'edit':
                    h.ui['Transform:Edit'] = 0
                if case == 'no_bank':
                    del h.mem['CB25Data']
                if case == 'empty_bank':
                    for s in range(25):
                        cell(h, 20+s*20+16, 0)
                if case == 'positional':
                    cell(h, 7, 0)
                if case == 'dimensions':
                    cell(h, 20+18, 0)
                if case == 'mesh_control':
                    h.mesh_disabled[2] = {'Tool:Polypaint:Polypaint From Polygroups'}
                before = copy.deepcopy(h.meshes)
                with self.assertRaises(Exit):
                    self.click(h)
                self.unchanged_meshes(h, before)

    def test_output_write_and_backup_failures_precede_mutation(self):
        for case in ['write', 'record', 'backup_cancel', 'backup_empty', 'backup_short', 'path_restore']:
            with self.subTest(case=case), tempfile.TemporaryDirectory() as d:
                h = self.host()
                h.chosen = d
                h.write_failure = 'ID_write_test_' if case == 'write' else None
                if case == 'record':
                    h.write_failure = 'Before_ID_'
                if case.startswith('backup_'):
                    h.save_failure = case[7:]
                if case == 'backup_short':
                    original = h.cmd
                    def short(n):
                        if n[0] == 'MemCreateFromFile' and 'idBackup' == n[2]:
                            return 12
                        return original(n)
                    h.cmd = short
                if case == 'path_restore':
                    original = h.cmd
                    def path_failure(n):
                        if n[0] == 'IPress' and h.e(n[1]) == 'Tool:Save As':
                            result = original(n)
                            h.path_failure_once = True
                            return result
                        return original(n)
                    h.cmd = path_failure
                before = copy.deepcopy(h.meshes)
                before_names = h.names[:]
                before_selected = h.st
                with self.assertRaises(Exit):
                    self.click(h)
                self.unchanged_meshes(h, before)
                self.assertEqual(h.tool_path, 'owner/Original')
                self.assertEqual(h.names, before_names)
                self.assertEqual(h.st, before_selected)

    def test_export_failure_reports_mesh_changes_and_restores_display(self):
        h = self.host()
        h.export_failure = True
        with tempfile.TemporaryDirectory() as d:
            h.chosen = d
            state = h.status[:], h.st, h.pp[:], h.tx[:], h.transform[:]
            with self.assertRaises(Exit):
                self.click(h)
            self.assertEqual((h.status, h.st, h.pp, h.tx, h.transform), state)
            self.assertEqual([m['generation'] for m in h.meshes], [1, 1, 1, 0, 0])
            self.assertTrue(Path(h.v['idBackup']).is_file())
            self.assertTrue(any('Mesh data may have changed' in m for m in h.messages))

    def test_escape_then_same_button_recovers_without_rerunning_and_guards_other_tool(self):
        h = self.host()
        h.interrupt_on = 'groups'
        with tempfile.TemporaryDirectory() as d:
            h.chosen = d
            state = h.status[:], h.st, h.pp[:], h.tx[:], h.transform[:]
            with self.assertRaises(Exit):
                self.click(h)
            events = copy.deepcopy(h.events)
            h.interrupt_on = None
            h.tool_index += 1
            with self.assertRaises(Exit):
                self.click(h)
            self.assertTrue(any('same Tool' in message for message in h.messages))
            h.tool_index -= 1
            # Source reloading preserves the session recovery blocks.
            h.load(OUTPUT)
            with self.assertRaises(Exit):
                self.click(h)
            self.assertEqual(h.events, events)
            self.assertEqual((h.status, h.st, h.pp, h.tx, h.transform), state)
            self.assertTrue(any('Nothing was rerun' in message for message in h.messages))
            self.assertTrue(Path(h.v['idBackup']).is_file())

    def test_corrupt_png_is_reported_after_mutation_without_overwriting(self):
        h = self.host()
        h.corrupt_png = True
        with tempfile.TemporaryDirectory() as d:
            h.chosen = d
            with self.assertRaises(Exit):
                self.click(h)
            self.assertEqual(len(h.exports), 1)
            self.assertTrue(any('not a readable PNG' in m for m in h.messages))
            self.assertEqual(Path(h.exports[0]['path']).read_bytes(), b'corrupt!')

    def test_folder_and_solo_effective_visibility_define_the_union(self):
        h = IDHost()
        h.load(CAMERA_ROOT / 'Camera Bank/CameraBank25.txt')
        h.names = ['Outside', 'FolderHead', 'Child', 'Active']
        h.status = [1, 0x401, 1, 0]
        h.ids = [501, 502, 503, 504]
        h.pp = [0] * 4
        h.tx = [1] * 4
        h.folders = [-1, 1, 1, -1]
        h.st = 3
        h.call('CB29_SaveSlot', 0)
        h.ui['Transform:Solo'] = 1
        h.st = 2
        h.call('CB29_SaveSlot', 9)
        self.assertEqual(cell(h, 7), 1)  # No public prepare step.
        h.meshes = [dict(rgb=[(20, 40, 60)] * 2, material='Original',
                         groups=(88, 99), generation=0, masked=False) for _ in range(4)]
        original_status = h.status[:]
        h.load(OUTPUT)
        with tempfile.TemporaryDirectory() as d:
            h.chosen = d
            self.click(h)
            self.assertEqual([m['generation'] for m in h.meshes], [1, 0, 1, 1])
            self.assertEqual([e['visibility'] for e in h.exports], [[1, 0, 0, 1], [0, 0, 1, 0]])
            self.assertEqual(h.status, original_status)
            self.assertEqual(h.ui['Transform:Solo'], 1)

    def test_preflight_escape_restores_without_mesh_processing(self):
        h = self.host()
        original = h.cmd
        interrupted = False
        def cmd(n):
            nonlocal interrupted
            result = original(n)
            if n[0] == 'RoutineCall' and n[1] == 'ID_CB29_LoadSlot' and not interrupted:
                interrupted = True
                raise Exit()
            return result
        h.cmd = cmd
        state = h.status[:], h.st, h.pp[:], h.tx[:], h.transform[:], copy.deepcopy(h.ui)
        with tempfile.TemporaryDirectory() as d:
            h.chosen = d
            with self.assertRaises(Exit):
                self.click(h)
            h.cmd = original
            h.load(OUTPUT)
            with self.assertRaises(Exit):
                self.click(h)
            self.assertEqual((h.status, h.st, h.pp, h.tx, h.transform, h.ui), state)
            self.assertFalse(h.events)
            self.assertIn('No ID mesh processing started', h.messages[-1])

    def test_foreign_name_is_rejected_before_backup_then_pending_view_can_recover(self):
        h = self.host()
        h.names[0] = 'Unmatched name'
        before = copy.deepcopy(h.meshes)
        state = h.status[:], h.st, h.transform[:]
        with tempfile.TemporaryDirectory() as d:
            h.chosen = d
            with self.assertRaises(Exit):
                self.click(h)
            self.unchanged_meshes(h, before)
            self.assertFalse(h.events)
            self.assertTrue(any('identifier' in m for m in h.messages))
            with self.assertRaises(Exit):
                self.click(h)
            self.assertEqual((h.status, h.st, h.transform), state)

    def test_recovery_waits_for_edit_and_preserves_marker(self):
        h = self.host()
        h.interrupt_on = 'groups'
        with tempfile.TemporaryDirectory() as d:
            h.chosen = d
            with self.assertRaises(Exit):
                self.click(h)
            h.interrupt_on = None
            h.ui['Transform:Edit'] = 0
            events = copy.deepcopy(h.events)
            with self.assertRaises(Exit):
                self.click(h)
            self.assertGreater(struct.unpack_from('<f', h.mem['ID32Recovery'])[0], 0)
            self.assertIn('3D Edit', h.messages[-1])
            self.assertEqual(h.events, events)
            h.ui['Transform:Edit'] = 1
            with self.assertRaises(Exit):
                self.click(h)
            self.assertEqual(h.events, events)
            self.assertEqual(struct.unpack_from('<f', h.mem['ID32Recovery'])[0], 0)

    def test_escape_mid_snapshot_restores_only_captured_selection_and_view(self):
        h = self.host()
        state = h.status[:], h.st, h.pp[:], h.tx[:], h.transform[:], h.zoom, h.pan[:]
        h.selection_moves_camera = True
        original = h.cmd
        interrupted = False
        def cmd(n):
            nonlocal interrupted
            result = original(n)
            if n[0] == 'SubToolSelect' and n[1] == 'idSnapshotIndex' and h.st == 2 and not interrupted:
                interrupted = True
                raise Exit()
            return result
        h.cmd = cmd
        with tempfile.TemporaryDirectory() as d:
            h.chosen = d
            with self.assertRaises(Exit):
                self.click(h)
            self.assertEqual(struct.unpack_from('<f', h.mem['ID32Recovery'])[0], .5)
            h.cmd = original
            h.load(OUTPUT)
            with self.assertRaises(Exit):
                self.click(h)
            self.assertEqual((h.status, h.st, h.pp, h.tx, h.transform, h.zoom, h.pan), state)
            self.assertFalse(h.events)

    def test_all_constructed_messages_at_maximum_supported_paths_and_counts(self):
        h = IDHost()
        h.load(OUTPUT)
        root = 'R' * 180
        backup_dir = root + '/Recovery/Before_ID_9999'
        backup_stem = 'B'*31
        backup = backup_dir + '/' + backup_stem + '.ztl'
        output = root + '/25/ID.png'
        h.v.update(idRoot=root, idParent='P'*160, idBackup=backup,
                   idBackupDir=backup_dir, idBackupStem=backup_stem,
                   idRecord=backup_dir+'/Recovery.txt',
                   idFolderPath=backup_dir, idProbeFolder=backup_dir,
                   idCameraFolder=root+'/25', idOutput=output,
                   idRequiredPath='Tool:Polypaint:Polypaint From Polygroups',
                   idControlIndex=7,
                   idSession=9999, idProbeNumber=9999, idBackupNumber=9999,
                   idNumber=25, idLabel='25', idExportedCount=25,
                   idProcessedCount=1000,
                   idFailureMessage='ID export failed or was cancelled: '+output)
        # Check every merge in the generated plugin, including the new reader.
        for item in commands(OUTPUT.read_text('ascii')):
            if item[0] == 'StrMerge':
                self.assertLessEqual(len(item)-1, 12)
        # Evaluate actual ID expressions with their maximum supported inputs.
        # The mock rejects overflow before returning a string, as native does.
        for item in commands((ROOT/'Development/id_body.txt').read_text('ascii')):
            if item[0] in ['StrMerge', 'MessageOK', 'NoteBar']:
                h.cmd(item)
        self.assertGreater(len(h.string_merges), 20)
        self.assertTrue(any(backup in value for _, value in h.string_merges))
        self.assertTrue(any('25 cameras, 1000 meshes.' in value for _, value in h.string_merges))
        self.assertLessEqual(max(len(value) for _, value in h.string_merges), 255)
        self.assertEqual(max(len(value) for _, value in h.string_merges), 254)

    def max_session(self, directory):
        base = str(Path(directory).resolve())
        session = Path(base) / ('s' * (180-len(base)-1))
        session.mkdir()
        self.assertEqual(len(str(session)), 180)
        return session

    def test_max_path_action_is_unblocked_and_record_contains_complete_backup_path(self):
        with tempfile.TemporaryDirectory() as d:
            h = self.host()
            session = self.max_session(d)
            h.mem['RC30Root'] = bytearray(str(session).encode()+b'\0')
            h.backup_number = 9999
            h.names[0] = h.names[0][:20] + 'A'*11  # 31 chars: path reaches 240.
            before_names = h.names[:]
            self.click(h)
            self.assertEqual(Path(h.v['idBackup']).parent.name, 'Before_ID_9999')
            self.assertEqual(Path(h.v['idBackup']).stem, before_names[0])
            self.assertEqual(h.names, before_names)
            self.assertEqual(len(h.v['idBackup']), 240)
            first_export = next(i for i, event in enumerate(h.events) if event[0] == 'export')
            self.assertFalse([notice for notice in h.notices
                              if notice[0] == 'MessageOK' and notice[2] <= first_export])
            self.assertTrue(any(kind == 'NoteBar' and 'Backup saved:' in value
                                for kind, value, _ in h.notices))
            record = Path(h.v['idRecord']).read_text('ascii')
            self.assertIn(h.v['idBackup'], record)
            self.assertNotIn('\0', record)
            self.assertEqual(record.count('\n'), 2)
            self.assertTrue(any(h.v['idBackup'] in message for message in h.messages))
            h.v['idExportedCount'] = 25
            h.v['idProcessedCount'] = 1000
            h.call('ID_ShowResult')
            self.assertEqual(max(len(value) for _, value in h.string_merges), 254)

    def test_max_path_failure_and_interrupted_recovery_messages(self):
        for case in ['export', 'backup_cancel', 'write', 'groups', 'backup_notice']:
            with self.subTest(case=case), tempfile.TemporaryDirectory() as d:
                h = self.host()
                session = self.max_session(d)
                h.mem['RC30Root'] = bytearray(str(session).encode()+b'\0')
                h.backup_number = 9999
                if case == 'export':
                    h.export_failure = True
                if case == 'backup_cancel':
                    h.save_failure = 'cancel'
                if case == 'write':
                    h.write_failure = 'ID_write_test_'
                if case in ['groups', 'backup_notice']:
                    h.interrupt_on = case
                with self.assertRaises(Exit):
                    self.click(h)
                if case in ['groups', 'backup_notice']:
                    h.interrupt_on = None
                    h.tool_index += 1
                    with self.assertRaises(Exit):
                        self.click(h)
                    self.assertTrue(any('same Tool' in message for message in h.messages))
                    h.tool_index -= 1
                    h.load(OUTPUT)
                    with self.assertRaises(Exit):
                        self.click(h)
                    expected = 'Nothing was rerun' if case == 'groups' else 'No ID mesh processing started'
                    self.assertTrue(any(expected in message for message in h.messages))
                self.assertLessEqual(max(len(value) for _, value in h.string_merges), 255)
                self.assertLessEqual(max(len(value) for value in h.messages), 255)

    def test_mock_reproduces_save_as_marker_loss_without_toolsetpath_repair(self):
        h = self.host()
        first_name = h.names[0]
        with tempfile.TemporaryDirectory() as d:
            h.st = 0
            h.nextfile = str(Path(d)/'Before_ID_1.ztl')
            h.cmd(['IPress', '"Tool:Save As"'])
            self.assertEqual(h.names[0], 'Before_ID_1')
            self.assertNotEqual(h.names[0], first_name)
            h.cmd(['ToolSetPath', '1', '"owner/Original"'])
            self.assertEqual(h.names[0], 'Before_ID_1')
            h.call('ID_CB32_CheckTracked')
            self.assertEqual(h.v['idCamTrackValid'], 0)

    def test_exact_name_backup_model_reopens_with_matching_bank(self):
        for target in ['first', 'selected']:
            with self.subTest(rename_target=target), tempfile.TemporaryDirectory() as d:
                h = self.host(reorder=True)
                h.save_rename_target = target
                h.chosen = d
                names = h.names[:]
                selected = h.st
                self.click(h)
                self.assertEqual(h.names, names)
                self.assertEqual(h.st, selected)
                saved = h.backup_states[h.v['idBackup']]
                self.assertEqual(saved['names'], names)
                self.assertEqual(saved['st'], 0)
                self.assertTrue(all(mesh['generation'] == 0 for mesh in saved['meshes']))
                # Reopen the modeled pre-ID mesh data into a new mock host and
                # execute the actual strict reader against the matching bank.
                receiver = IDHost()
                receiver.load(OUTPUT)
                receiver.mem['CB25Data'] = bytearray(h.mem['CB25Data'])
                for key, value in saved.items():
                    setattr(receiver, key, copy.deepcopy(value))
                receiver.call('ID_CB32_CheckTracked')
                self.assertEqual(receiver.v['idCamTrackValid'], 1)
                for index, slot in enumerate([0, 9]):
                    receiver.call('ID_CB29_LoadSlot', slot)
                    self.assertEqual([status & 1 for status in receiver.status], h.exports[index]['visibility'])

    def test_filename_validator_uses_actual_routine_for_windows_rules(self):
        h = IDHost()
        h.load(OUTPUT)
        rejected = ['', '.', '..', 'end.', 'end ', 'CON', 'prn.dat', 'aux.a',
                    'NUL.tar.gz', 'COM1', 'lpt9.abc', 'com'+chr(185), 'lpt'+chr(178)]
        rejected += ['a'+character+'b' for character in '<>:"/\\|?*'+chr(0)+chr(1)+chr(31)+chr(127)]
        for stem in rejected:
            with self.subTest(stem=repr(stem)):
                h.v['idBackupStem'] = stem
                h.call('ID_ValidateBackupStem')
                self.assertTrue(h.v['idFilenameError'])
                self.assertEqual(h.v['idBackupStem'], stem)
        for stem in ['CB123456654321G0001_mesh', '.CB123456654321G0001_mesh',
                     'Merged_CB123456654321G0001_Part 1 (A).rev2', 'COM0', 'console']:
            with self.subTest(stem=stem):
                h.v['idBackupStem'] = stem
                h.call('ID_ValidateBackupStem')
                self.assertEqual(h.v['idFilenameError'], '')
                self.assertEqual(h.v['idBackupStem'], stem)
        for item in commands((ROOT/'Development/id_body.txt').read_text('ascii')):
            if item[0] == 'If':
                self.assertNotIn('[StrToAsc', item[1])

    def test_unsafe_first_names_abort_before_save_without_changing_names(self):
        names = ['tail'+character+'name' for character in '<>:"/\\|?*'+chr(1)+chr(127)]
        names += ['trailing.', 'trailing ', 'CON.prefix', 'LPT1.prefix']
        with tempfile.TemporaryDirectory() as d:
            for unsafe in names:
                with self.subTest(name=repr(unsafe)):
                    h = self.host()
                    if unsafe in ['CON.prefix', 'LPT1.prefix']:
                        h.names[0] = unsafe.split('.')[0]+'.'+h.names[0]
                    else:
                        h.names[0] += unsafe
                    original_names = h.names[:]
                    selected = h.st
                    before = copy.deepcopy(h.meshes)
                    h.chosen = d
                    with self.assertRaises(Exit):
                        self.click(h)
                    self.assertTrue(h.v['idFilenameError'])
                    self.assertEqual(h.names, original_names)
                    self.assertEqual(h.st, selected)
                    self.unchanged_meshes(h, before)
                    self.assertFalse(h.events)

    def test_backup_path_over_limit_aborts_without_truncation_or_save(self):
        h = self.host()
        with tempfile.TemporaryDirectory() as d:
            session = self.max_session(d)
            h.mem['RC30Root'] = bytearray(str(session).encode()+b'\0')
            h.backup_number = 9999
            h.names[0] = h.names[0][:20]+'A'*12  # Would create a 241-character path.
            names = h.names[:]
            before = copy.deepcopy(h.meshes)
            with self.assertRaises(Exit):
                self.click(h)
            self.assertEqual(h.names, names)
            self.unchanged_meshes(h, before)
            self.assertFalse(h.events)
            self.assertTrue(any('backup path too long' in message for message in h.messages))
            self.assertFalse(list((session/'Recovery').iterdir()))

    def test_fresh_backup_folder_and_save_interruption_preserve_names(self):
        h = self.host()
        with tempfile.TemporaryDirectory() as d:
            session = Path(d)
            recovery = session/'Recovery'
            recovery.mkdir()
            (recovery/'Before_ID_1').mkdir()  # Empty folders are still occupied.
            old = recovery/'Before_ID_2.ztl'
            old.write_bytes(b'legacy recovery')
            occupied = recovery/'Before_ID_3'
            occupied.write_bytes(b'occupied path')
            h.mem['RC30Root'] = bytearray(str(session).encode()+b'\0')
            h.interrupt_on = 'save'
            names, selected = h.names[:], h.st
            with self.assertRaises(Exit):
                self.click(h)
            self.assertEqual(Path(h.v['idBackup']).parent.name, 'Before_ID_4')
            self.assertEqual(Path(h.v['idBackup']).stem, names[0])
            self.assertEqual(h.names, names)
            h.interrupt_on = None
            h.load(OUTPUT)
            with self.assertRaises(Exit):
                self.click(h)
            self.assertEqual(h.names, names)
            self.assertEqual(h.st, selected)
            self.assertEqual(h.tool_path, 'owner/Original')
            self.assertEqual(old.read_bytes(), b'legacy recovery')
            self.assertEqual(occupied.read_bytes(), b'occupied path')
            self.assertFalse(any(event[0] == 'groups' for event in h.events))

    def test_native_draw_polyframe_path_is_disabled_for_export_then_restored(self):
        for original in [0, 1]:
            with self.subTest(original=original), tempfile.TemporaryDirectory() as d:
                h = self.host()
                h.ui['Transform:Draw Polyframe'] = original
                self.assertNotIn('Transform:Polyframe', h.ui)
                self.assertNotIn('Transform:PolyF', h.ui)
                h.chosen = d
                self.click(h)
                self.assertEqual(h.v['idPolyPath'], 'Transform:Draw Polyframe')
                self.assertEqual([export['polyframe'] for export in h.exports], [0, 0])
                self.assertEqual(h.ui['Transform:Draw Polyframe'], original)

    def test_polyframe_aliases_resolve_and_preserve_overlay_behavior(self):
        for alias in ['Transform:Draw PolyFrame', 'Transform:pf',
                      'Transform:Polyframe', 'Transform:PolyF']:
            with self.subTest(alias=alias), tempfile.TemporaryDirectory() as d:
                h = self.host()
                del h.ui['Transform:Draw Polyframe']
                h.ui[alias] = 1
                h.chosen = d
                self.click(h)
                self.assertEqual(h.v['idPolyPath'], alias)
                self.assertEqual([export['polyframe'] for export in h.exports], [0, 0])
                self.assertEqual(h.ui[alias], 1)
        h = self.host()
        h.ui['Transform:PolyF'] = 1
        h.call('ID_ResolveControls')
        self.assertEqual(h.v['idPolyPath'], 'Transform:Draw Polyframe')

    def test_missing_or_disabled_polyframe_still_aborts_before_backup(self):
        for case in ['missing', 'disabled']:
            with self.subTest(case=case):
                h = self.host()
                if case == 'missing':
                    del h.ui['Transform:Draw Polyframe']
                else:
                    h.enabled['Transform:Draw Polyframe'] = False
                    h.ui['Transform:PolyF'] = 1  # Must not bypass a disabled canonical item.
                before = copy.deepcopy(h.meshes)
                with self.assertRaises(Exit):
                    self.click(h)
                self.unchanged_meshes(h, before)
                self.assertFalse(h.events)
                word = 'Missing' if case == 'missing' else 'Unavailable'
                self.assertTrue(any(word+' control: Transform:Draw Polyframe' in message
                                    for message in h.messages))

    def test_native_material_probe_uses_scalar_path_and_dynamic_id(self):
        for path, title, accepted in [('Material:Flat Color', 'Flat Color', True),
                                      ('Texture:Flat Color', 'Flat Color', False),
                                      ('Material:Flat Color altered', 'Flat Color altered', False)]:
            with self.subTest(path=path):
                h = IDHost()
                h.load(OUTPUT)
                original = h.cmd
                native_id = 10243  # Read-only controller probe; no fixed ID in the plugin.
                def cmd(n):
                    c, *args = n
                    if c == 'IExists' and h.e(args[0]) == native_id:
                        return 1
                    if c == 'IGetID' and h.e(args[0]) == 'Material:Flat Color':
                        return native_id
                    if c == 'IGetTitle' and h.e(args[0]) == native_id:
                        return path if len(args) > 1 and h.e(args[1]) else title
                    return original(n)
                h.cmd = cmd
                starting_material = h.ui['Material:ItemInfo']
                h.call('ID_MaterialCandidate', native_id)
                self.assertEqual(h.v['idFlat'], native_id if accepted else -1)
                if accepted:
                    h.call('ID_FindFlat')
                    self.assertEqual(h.v['idFlat'], native_id)
                self.assertEqual(h.ui['Material:ItemInfo'], starting_material)
                self.assertFalse(any(c == 'IPress' for c, _ in h.calls))
                self.assertEqual(h.events, [])

    def test_generated_native_variables_are_alphanumeric_and_reader_executes(self):
        variables = set()
        for item in commands(OUTPUT.read_text('ascii')):
            c, *args = item
            if c in ['VarDef', 'VarSet', 'VarInc', 'VarDec']:
                variables.add(args[0].split('(', 1)[0])
            if c == 'RoutineDef':
                variables.update(args[2:])
            if c == 'Loop' and len(args) > 2:
                variables.add(args[2])
        self.assertTrue({'idReaderBase', 'idReaderSlot', 'idReaderVisBase',
                         'idCamBase', 'idCamSlot'}.issubset(variables))
        for name in variables:
            self.assertRegex(name, r'^[A-Za-z][A-Za-z0-9]*$')
        h = self.host()
        self.assertIn('ID_CB29_LoadSlot', h.routines)
        h.call('ID_CB29_LoadSlot', 0)
        self.assertEqual([status & 1 for status in h.status], [1, 1, 0, 0, 0])
        self.assertEqual(h.dims, [1920, 1080])

    def test_memread_mock_rejects_uninitialized_outputs_then_reads_uint_and_byte(self):
        h = IDHost()
        h.mem['NumericProbe'] = bytearray(struct.pack('<I', 16777219))
        for value in ['absent', None, '']:
            with self.subTest(initial=value):
                h.v.pop('nativeReadOutput', None)
                if value != 'absent':
                    h.v['nativeReadOutput'] = value
                with self.assertRaisesRegex(AssertionError, 'initialized numerically'):
                    h.cmd(['MemRead', 'NumericProbe', 'nativeReadOutput', '6', '0'])
        h.cmd(['VarSet', 'nativeReadOutput', '0'])
        self.assertEqual(h.cmd(['MemRead', 'NumericProbe', 'nativeReadOutput', '6', '0']), 4)
        self.assertEqual(h.v['nativeReadOutput'], 16777219)
        h.mem['ByteProbe'] = bytearray(b'\x89PNG\r\n\x1a\n')
        h.cmd(['VarSet', 'nativeByteOutput', '0'])
        self.assertEqual(h.cmd(['MemRead', 'ByteProbe', 'nativeByteOutput', '2', '0']), 1)
        self.assertEqual(h.v['nativeByteOutput'], 137)

    def test_fresh_recovery_and_png_output_locals_are_initialized_before_read(self):
        h = self.host()
        h.call('ID_ResolveControls')
        h.call('ID_Snapshot')
        self.assertNotIn('idSavedID', h.v)
        h.load(OUTPUT)  # Model switching to corrected source with phase 1 pending.
        with self.assertRaises(Exit):
            self.click(h)
        self.assertEqual(struct.unpack_from('<f', h.mem['ID32Recovery'])[0], 0)
        self.assertEqual(h.events, [])
        self.assertTrue(any(value == 16777219 for name, _, value in h.memory_reads
                            if name == 'idSavedID'))
        self.assertTrue(all(before == 0 for name, before, _ in h.memory_reads
                            if name == 'idSavedID'))
        self.assertNotIn('idSavedID', h.v)
        with tempfile.TemporaryDirectory() as d:
            h = self.host()
            h.chosen = d
            self.click(h)
            png_reads = [read for read in h.memory_reads if read[0] == 'idPNGByte']
            self.assertEqual(len(png_reads), 16)
            self.assertTrue(all(before == 0 for _, before, _ in png_reads))
            self.assertEqual([value for _, _, value in png_reads], list(b'\x89PNG\r\n\x1a\n')*2)
            self.assertNotIn('idPNGByte', h.v)

    def test_native_toolsetpath_uses_scalar_index_and_result_at_both_sites(self):
        h = self.host()
        for routine in ['ID_Restore', 'ID_BackupTool']:
            nodes = list(commands(h.routines[routine][0]))
            setters = [item for item in nodes if item[0] == 'ToolSetPath']
            self.assertEqual(len(setters), 1)
            self.assertNotIn('[', setters[0][1])
            self.assertFalse(any('[ToolSetPath' in item[1] for item in nodes if item[0] == 'If'))
        h.tool_index = 7
        h.call('ID_ResolveControls')
        h.call('ID_Snapshot')
        h.load(OUTPUT)
        with self.assertRaises(Exit):
            self.click(h)
        self.assertEqual(h.path_updates, [(7, 'owner/Original', 0)])
        self.assertEqual(h.events, [])
        with tempfile.TemporaryDirectory() as d:
            h = self.host()
            h.tool_index = 9
            h.chosen = d
            self.click(h)
            # Display recovery before backup, backup path restoration, final
            # display recovery: both actual sites execute with the dynamic ID.
            self.assertEqual(h.path_updates, [(9, 'owner/Original', 0)]*3)
            self.assertEqual(h.tool_path, 'owner/Original')
            self.assertEqual(len(h.exports), 2)

    def test_toolsetpath_failure_keeps_recovery_until_numeric_result_succeeds(self):
        h = self.host()
        h.tool_index = 7
        h.call('ID_ResolveControls')
        h.call('ID_Snapshot')
        names = h.names[:]
        h.path_failure_once = True
        with self.assertRaises(Exit):
            self.click(h)
        self.assertEqual(h.path_updates, [(7, 'owner/Original', -1)])
        self.assertGreater(struct.unpack_from('<f', h.mem['ID32Recovery'])[0], 0)
        self.assertTrue(any('session marker was kept' in message for message in h.messages))
        self.assertEqual(h.names, names)
        self.assertEqual(h.events, [])
        with self.assertRaises(Exit):
            self.click(h)
        self.assertEqual(h.path_updates[-1], (7, 'owner/Original', 0))
        self.assertEqual(struct.unpack_from('<f', h.mem['ID32Recovery'])[0], 0)
        self.assertEqual(h.names, names)
        self.assertEqual(h.events, [])


if __name__ == '__main__':
    unittest.main(verbosity=2)
