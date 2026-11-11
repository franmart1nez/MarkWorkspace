"""Meaningful intake/coordinate safeguards; no Photoshop launch or image generation."""
import importlib.util
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image

SCRIPTS = Path(__file__).resolve().parents[1] / 'scripts'
sys.path.insert(0,str(SCRIPTS))
import new_sculpture as intake
import prepare_crops as crops


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        intake.initialize_root(self.root)
        (self.root/'project.json').write_text('{"activeSculpture":null}')
        self.folder = intake.create_sculpture(self.root,'Test Statue')

    def source(self,width=900,height=1200):
        source = self.folder/'inputs/composites-psd/02/Composite.psd'
        source.parent.mkdir(parents=True,exist_ok=True)
        # A PSD header is sufficient for coordinate validation; this is no artwork.
        source.write_bytes(struct.pack('>4sH6sHIIHH',b'8BPS',1,bytes(6),3,height,width,8,3))
        preview = self.folder/'work/psd-previews/02.png'
        Image.new('RGB',(width,height),(80,90,100)).save(preview)
        return source,preview

    def test_new_intake_and_duplicate_creation_preserve_existing(self):
        self.assertTrue((self.folder/'inputs/reference-composite-01').is_dir())
        self.assertTrue((self.folder/'outputs/photoshop').is_dir())
        self.assertFalse((self.folder/'work/batch.json').read_text() == '')
        sentinel = self.folder/'work/keep.txt'
        sentinel.write_text('keep')
        with self.assertRaises(FileExistsError):
            intake.create_sculpture(self.root,'Test Statue')
        self.assertEqual(sentinel.read_text(),'keep')

    def test_input_roles_exclude_01_and_id_passes(self):
        self.source()
        inputs = self.folder/'inputs/composites-psd'
        (inputs/'02/Mask.psd').write_bytes(b'pass')
        (inputs/'01').mkdir()
        (inputs/'01/Composite.psd').write_bytes(b'source')
        Image.new('RGB',(2,2)).save(self.folder/'inputs/reference-composite-01/final.png')
        Image.new('RGB',(2,2)).save(self.root/'shared/approved-client-work/quality.png')
        inventory = intake.inspect_sculpture(self.root,'Test Statue')
        self.assertEqual(list(inventory['targetComposites']),['02'])
        self.assertEqual(inventory['counts']['sourcePsds'],3)
        self.assertEqual(inventory['readiness'],'files-present-needs-visual-intake')
        self.assertFalse(inventory['masterIntakeVerified'])
        self.assertEqual(len(inventory['excludedComposite01Sources']),1)

    def test_ambiguous_master_and_duplicate_target_block_readiness(self):
        self.source()
        master_dir = self.folder/'inputs/reference-composite-01'
        for name in ['one.png','two.png']:
            Image.new('RGB',(2,2)).save(master_dir/name)
        inventory = intake.inspect_sculpture(self.root,'Test Statue')
        self.assertEqual(inventory['readiness'],'missing-or-ambiguous-inputs')
        (self.folder/'inputs/composites-psd/Composite-02.psd').write_bytes(b'duplicate')
        self.assertEqual(len(intake.inspect_sculpture(self.root,'Test Statue')['targetComposites']['02']),2)

    def test_crop_sizes_scale_with_view_and_cover_original_canvas(self):
        self.assertEqual(len(crops.rectangles(900,1200)),1)
        large = crops.rectangles(3240,4050)
        self.assertEqual(len(large),4)
        self.assertEqual(sum(r['coreRect']['width']*r['coreRect']['height'] for r in large),3240*4050)
        left,right = large[0]['sourceRect'],large[1]['sourceRect']
        self.assertEqual(left['x']+left['width']-right['x'],128)
        for region in large:
            r,c = region['sourceRect'],region['coreRect']
            self.assertEqual(r,region['pasteRect'])
            self.assertLessEqual(r['x'],c['x'])
            self.assertLessEqual(r['y'],c['y'])
            self.assertGreaterEqual(r['x']+r['width'],c['x']+c['width'])
            self.assertGreaterEqual(r['y']+r['height'],c['y']+c['height'])

    def test_source_extraction_preserves_pixels_and_stays_pending(self):
        source,preview = self.source()
        original_hash = crops.sha256(source)
        result = crops.prepare(self.folder,'02',preview,source)
        plan = json.loads(Path(result['plan']).read_text())
        self.assertFalse(result['generationSubmitted'])
        self.assertFalse(plan['allRequiredCropsReviewed'])
        crop = self.folder/plan['regions'][0]['sourceCrop']
        with Image.open(preview) as a, Image.open(crop) as b:
            self.assertEqual(a.tobytes(),b.tobytes())
        self.assertEqual(crops.sha256(source),original_hash)
        with self.assertRaises(FileExistsError):
            crops.prepare(self.folder,'02',preview,source)
        self.assertEqual(crops.sha256(source),original_hash)

    def test_resized_preview_and_master_production_are_rejected(self):
        source,preview = self.source()
        Image.new('RGB',(450,600)).save(preview)
        with self.assertRaisesRegex(ValueError,'native target dimensions'):
            crops.prepare(self.folder,'02',preview,source)
        with self.assertRaisesRegex(ValueError,'supplied finished reference'):
            crops.prepare(self.folder,'01',preview,source)
        self.assertFalse((self.folder/'work/crops/source/02-v001').exists())

    def test_paths_and_windows_reserved_names_are_rejected(self):
        with self.assertRaises(ValueError):
            intake.slug_for('../outside')
        with self.assertRaises(ValueError):
            intake.slug_for('CON')
        with self.assertRaises(ValueError):
            intake.inside(self.folder,'../outside')

    def test_native_script_error_has_one_submission_and_no_retry(self):
        import photoshop_server
        calls = []
        class FailingApplication:
            def DoJavaScript(self,*args):
                calls.append(args)
                raise RuntimeError('Failed after a possible partial edit')
        with patch.object(photoshop_server,'with_application',lambda action:action(FailingApplication())):
            with self.assertRaises(RuntimeError):
                photoshop_server.ExistingPhotoshop().execute_javascript('app.activeDocument.name;')
        self.assertEqual(len(calls),1)

    def test_native_tool_failure_is_detected_inside_json_result(self):
        import photoshop_mcp
        self.assertTrue(photoshop_mcp.tool_failed({'isError':False,'content':[{'type':'text','text':'{"success":false,"error":"COM failed"}'}]}))
        self.assertFalse(photoshop_mcp.tool_failed({'content':[{'type':'text','text':'{"success":true,"result":"ok"}'}]}))


if __name__ == '__main__':
    unittest.main()
