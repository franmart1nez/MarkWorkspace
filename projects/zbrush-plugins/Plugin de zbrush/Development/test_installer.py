from pathlib import Path
import tempfile, subprocess, os, json, unittest

ROOT=Path(__file__).resolve().parents[1]

class InstallerTests(unittest.TestCase):
    def test_install_repeat_and_component_selection(self):
        # The fixture is inside this deliverable, never an actual ZBrush install.
        with tempfile.TemporaryDirectory(prefix='installer-test-',dir=ROOT/'Development') as tmp:
            fixture=Path(tmp).resolve()
            assert fixture.is_relative_to((ROOT/'Development').resolve())
            zb=fixture/'ZBrush test';zb.mkdir()
            (zb/'ZBrush.exe').write_bytes(b'fixture only - never execute')
            plugs=zb/'ZStartup/ZPlugs64';plugs.mkdir(parents=True)
            (plugs/'unrelated.txt').write_text('keep')
            env=os.environ.copy();env['LOCALAPPDATA']=str(fixture/'LocalAppData')
            def run(*args):
                r=subprocess.run(['powershell.exe','-NoProfile','-File',str(ROOT/'Install.ps1'),
                    '-ZBrushPath',str(zb),*args],env=env,capture_output=True,text=True)
                self.assertEqual(r.returncode,0,r.stdout+r.stderr)
                return r.stdout
            plan=json.loads(run('-PlanOnly','-Component','Camera'))
            compiled=ROOT/'Camera Bank/CameraBank25.zsc'
            source=compiled.with_suffix('.txt')
            has_compiled=compiled.exists() and compiled.stat().st_mtime_ns >= source.stat().st_mtime_ns
            self.assertEqual(len(plan['Actions']),4 if has_compiled else 3)
            self.assertFalse((plugs/'MakCameraBankData').exists())
            if not has_compiled:
                (plugs/'CameraBank25.zsc').write_bytes(b'stale older-format plugin')
            run()
            self.assertEqual((plugs/'MakCameraBankData/CameraBank25.txt').read_bytes(),
                             (ROOT/'Camera Bank/CameraBank25.txt').read_bytes())
            self.assertEqual((plugs/'RenderCaptureData/RenderCapture.txt').read_bytes(),
                             (ROOT/'Render Capture/RenderCapture.txt').read_bytes())
            self.assertTrue((plugs/'RenderCaptureData/ZFileUtils64.dll').exists())
            self.assertTrue((plugs/'MakCameraBankData/ZFileUtils64.dll').exists())
            self.assertIn('PREPARE TRANSFER',(zb/'ZStartup/Macros/Mak Plugins/Load Camera Bank.txt').read_text())
            self.assertIn('ZScript:Load',(zb/'ZStartup/Macros/Mak Plugins/Load Camera Bank.txt').read_text())
            self.assertEqual((plugs/'CameraBank25.zsc').exists(),has_compiled)
            if not has_compiled:
                retired=list((fixture/'LocalAppData/MakZBrushPlugins/InstallBackups').glob('*/ZStartup/ZPlugs64/CameraBank25.zsc'))
                self.assertEqual(len(retired),1)
                self.assertEqual(retired[0].read_bytes(),b'stale older-format plugin')
            if has_compiled:
                self.assertEqual((plugs/'CameraBank25.zsc').read_bytes(),(ROOT/'Camera Bank/CameraBank25.zsc').read_bytes())
            run()
            self.assertTrue(list((fixture/'LocalAppData/MakZBrushPlugins/InstallBackups').glob('*/ZStartup/ZPlugs64/MakCameraBankData/CameraBank25.txt')))
            self.assertEqual((plugs/'unrelated.txt').read_text(),'keep')

if __name__=='__main__':unittest.main(verbosity=2)
