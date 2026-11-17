"""Run the delivered render routines against verify.Host and temporary files.

These are offline control/file-flow checks, not native ZScript compilation or
PNG/PSD decoding. No live application, installation or owner files are touched.
"""
from pathlib import Path
import tempfile
import unittest

from verify import Exit, Host, ROOT, parse


PNG_NAMES = ('Z document.png', 'Normal.png', 'Double.png', 'Metal.png')
PSD_NAMES = ('_AO.psd', '_Composite.psd', '_Depth.psd', '_Mask.psd',
             '_Render.psd', '_Shadow.psd', '_SSS.psd')
PHASES = {'RC_NonBPR': PNG_NAMES, 'RC_BPR': PSD_NAMES}
ORDERS = (('RC_NonBPR', 'RC_BPR'), ('RC_BPR', 'RC_NonBPR'))
CAMERAS = {'01': (1920, 1080), '10': (800, 600), '25': (1200, 1600)}


def files(root):
    return {p.relative_to(root).as_posix(): p.read_bytes()
            for p in root.rglob('*') if p.is_file()}


def display(host):
    keys = ('Material:ItemInfo', 'Color:R', 'Color:G', 'Color:B',
            'Render:Render Properties:Shadows', 'Render:Render Properties:AOcclusion',
            'Render:Render Properties:Sss', 'Render:BPR RenderPass:Reuse Existing Maps',
            'Transform:Solo')
    return ([host.ui[k] for k in keys], host.pp[:], host.tx[:], host.st,
            host.light_on.copy(), host.light_sss.copy())


class LayoutHost(Host):
    def cmd(self, node):
        # The base mock writes placeholder bytes. Vary them per export/camera
        # and include binary values to catch wrong-source/text-mode copies.
        exporting = (node[0] == 'IPress' and
                     (self.e(node[1]) == 'Document:Export' or
                      isinstance(self.e(node[1]), int) and
                      not 10000 <= self.e(node[1]) < 10000 + len(self.mats)))
        if exporting:
            assert not Path(self.nextfile).exists(), 'Attempted overwrite: ' + self.nextfile
        result = super().cmd(node)
        if exporting:
            Path(self.nextfile).write_bytes(b'\x00\xffmock export\r\n' + self.nextfile.encode())
        return result


class RenderLayout(unittest.TestCase):
    def host(self):
        h = LayoutHost()
        h.load(ROOT.parent / 'Camera Bank Fast/CameraBankFast25.txt')
        # Sparse labels catch camera renumbering and wrong-camera copies.
        for slot, dims, visibility in ((0, (1920, 1080), [1, 0]),
                                       (2, (640, 480), [1, 1]),
                                       (9, (800, 600), [0, 1]),
                                       (24, (1200, 1600), [1, 1])):
            h.ui.update({'Document:Width': dims[0], 'Document:Height': dims[1]})
            h.status = visibility[:]
            h.st = visibility.index(1)
            h.call('FB29_SaveSlot', slot)
        h.cmd(['MVarSet', 'FB25Data', str(20 + (2 * 20) + 16), '0'])
        h.load(ROOT / 'Render Capture/RenderCapture.txt')
        return h

    def session(self, h, parent):
        h.chosen = parent
        h.call('RC_CreateFolders')
        root = Path(h.v['rcRoot'])
        self.assertEqual(files(root), {})
        self.assertEqual({p.relative_to(root).as_posix() for p in root.rglob('*')},
                         {'Screenshots', *CAMERAS})
        return root

    def assert_complete(self, h, root):
        expected = {f'{label}/{name}' for label in CAMERAS for name in (*PNG_NAMES, *PSD_NAMES)}
        expected.update(f'Screenshots/{label}.png' for label in CAMERAS)
        self.assertEqual(set(files(root)), expected)
        self.assertEqual({p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_dir()},
                         {'Screenshots', *CAMERAS})
        for label in CAMERAS:
            self.assertEqual((root / 'Screenshots' / (label + '.png')).read_bytes(),
                             (root / label / 'Z document.png').read_bytes())
        self.assertNotIn('RC31CopyPath', h.mem)
        self.assertEqual(h.cmd(['MVarGet', 'RC30Recovery', '0']), 0)

    def test_generated_source_and_all_displayed_camera_labels(self):
        body = (ROOT / 'Development/render_body.txt').read_text(encoding='ascii')
        reader = (ROOT / 'Development/camera_reader.inc').read_text(encoding='ascii')
        self.assertEqual((ROOT / 'Render Capture/RenderCapture.txt').read_text(encoding='ascii'),
                         reader + '\n\n' + body)
        self.assertTrue(body.startswith('// Render Capture 3.2.5'))
        switches = [n[1].strip('"').removeprefix('ZPlugin:Camera Bank Fast:')
                    for n in parse((ROOT.parent / 'Camera Bank Fast/CameraBankFast25.txt').read_text(encoding='ascii'))
                    if n[0] == 'ISwitch' and n[1].startswith('"ZPlugin:Camera Bank Fast:')]
        labels = [f'{camera:02d}' for camera in range(1, 26)]
        self.assertEqual([label for label in switches if label in labels], labels)
        h = self.host()
        for camera, label in enumerate(labels, 1):
            h.call('RC_Label', camera)
            self.assertEqual(h.v['rcLabel'], label)

    def test_both_phase_orders_share_camera_folders_and_preserve_settings(self):
        for order in ORDERS:
            with self.subTest(order=order), tempfile.TemporaryDirectory() as parent:
                h = self.host()
                root = self.session(h, parent)
                before = display(h)
                for phase in order:
                    previous = files(root)
                    h.call(phase)
                    self.assertEqual(display(h), before)
                    self.assertEqual({name: files(root)[name] for name in previous}, previous)
                self.assert_complete(h, root)
                self.assertEqual(len(h.exports), 33)  # Copies are not extra exports.
                for export in h.exports:
                    camera, name = Path(export['path']).relative_to(root).parts
                    self.assertEqual(export['dims'], list(CAMERAS[camera]))
                    self.assertEqual(export['visibility'], {'01': [1, 0], '10': [0, 1], '25': [1, 1]}[camera])
                    if name in PNG_NAMES:
                        self.assertEqual(export['color'], [255, 255, 255])
                        self.assertEqual(export['shadow'], 0)
                        self.assertEqual(export['pp'], before[1] if name == PNG_NAMES[0] else [0, 0])
                        self.assertEqual(export['material'], dict(zip(PNG_NAMES, (
                            'Basic Thor (1)', 'NormalRGBMat', 'DoubleShade1', 'Metal 11')))[name])
                    else:
                        self.assertIn(name, PSD_NAMES)
                        self.assertEqual((export['shadow'], export['ao'], export['sss']), (1, 1, 1))
                for key, value in (('Render:BPR Shadow:Rays', 30), ('Render:BPR Shadow:Angle', 15),
                                   ('Render:BPR AO:Rays', 30), ('Render:BPR RenderPass:SPix', 2)):
                    self.assertEqual(h.ui[key], value)







    def test_disabled_and_empty_camera_collisions_are_ignored(self):
        with tempfile.TemporaryDirectory() as parent:
            h = self.host()
            root = self.session(h, parent)
            # 03 is stored but disabled; 02 has never been stored.
            for label in ('02', '03'):
                (root / label).mkdir()
                for name in (*PNG_NAMES, *PSD_NAMES):
                    (root / label / name).write_bytes(b'preserve unrelated camera')
                (root / 'Screenshots' / (label + '.png')).write_bytes(b'preserve unrelated shot')
            before = files(root)
            h.call('RC_NonBPR')
            h.call('RC_BPR')
            self.assertEqual({name: files(root)[name] for name in before}, before)
            self.assertEqual(len(h.exports), 33)
            self.assertTrue(all(Path(e['path']).parent.name in CAMERAS for e in h.exports))



    def test_source_reload_keeps_session_and_allows_other_phase(self):
        for order in ORDERS:
            with self.subTest(order=order), tempfile.TemporaryDirectory() as parent:
                h = self.host()
                root = self.session(h, parent)
                h.call(order[0])
                before = files(root)
                h.load(ROOT / 'Render Capture/RenderCapture.txt')
                h.call(order[1])
                self.assertEqual(Path(h.v['rcRoot']), root)
                self.assertEqual({name: files(root)[name] for name in before}, before)
                self.assert_complete(h, root)

    def test_interrupted_phase_recovers_before_next_phase_and_preserves_partial_output(self):
        for order in ORDERS:
            with self.subTest(order=order), tempfile.TemporaryDirectory() as parent:
                h = self.host()
                root = self.session(h, parent)
                settings = display(h)
                original = h.cmd

                def interrupt_after_first_export(node):
                    result = original(node)
                    if node[0] == 'IPress' and len(h.exports) == 1:
                        raise Exit()  # Escape bypasses RC_Fail / immediate restore.
                    return result

                h.cmd = interrupt_after_first_export
                with self.assertRaises(Exit):
                    h.call(order[0])
                h.cmd = original
                partial = files(root)
                self.assertEqual(len(partial), 1)
                self.assertEqual(h.cmd(['MVarGet', 'RC30Recovery', '0']), 1)
                h.call(order[1])
                self.assertEqual(display(h), settings)
                self.assertEqual(h.cmd(['MVarGet', 'RC30Recovery', '0']), 0)
                self.assertEqual({name: files(root)[name] for name in partial}, partial)
                before, count = files(root), len(h.exports)
                h.call(order[0])
                self.assertGreater(len(h.exports), count)
                self.assertEqual(display(h), settings)

    def test_reuse_silently_overwrites_both_phases(self):
        for phase, names in PHASES.items():
            with self.subTest(phase=phase), tempfile.TemporaryDirectory() as parent:
                h = self.host()
                root = self.session(h, parent)
                h.call(phase)
                old = files(root)
                (root / '25/keep.txt').write_bytes(b'untouched')
                h.messages.clear()
                original = h.cmd
                def inspect(n):
                    if n[0] == 'IPress' and h.e(n[1]) in ['Render:Preview', 'Render:BPR RenderPass:Render Best Preview']:
                        self.assertFalse(any('overwrite' in m.lower() for m in h.messages))
                    return original(n)
                h.cmd = inspect
                before = display(h)
                h.call(phase)
                self.assertFalse(any('overwrite' in m.lower() for m in h.messages))
                self.assertEqual(display(h), before)
                self.assertEqual((root/'25/keep.txt').read_bytes(), b'untouched')
                self.assertEqual({k: files(root)[k] for k in old}, old)
                for chosen in (parent, str(root), str(root)+'/'):
                    h.chosen = chosen
                    h.call('RC_CreateFolders')
                    self.assertEqual(Path(h.v['rcRoot']), root)
                self.assertFalse((Path(parent)/'ZPass_2').exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
