from pathlib import Path
import tempfile, subprocess, json, unittest
ROOT=Path(__file__).resolve().parents[1]

class UninstallerTests(unittest.TestCase):
    def test_backups_preserve_other_plugins_and_banks(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'Development',prefix='uninstall-test-') as tmp:
            fixture=Path(tmp).resolve()
            # Put the script in the fixture so all backup writes remain isolated.
            script=fixture/'Uninstall.ps1';script.write_bytes((ROOT/'Uninstall.ps1').read_bytes())
            zb=fixture/'ZBrush';zb.mkdir();(zb/'ZBrush.exe').write_bytes(b'fixture - never executed')
            plugs=zb/'ZStartup/ZPlugs64';plugs.mkdir(parents=True)
            (plugs/'CameraBank25.zsc').write_bytes(b'compiled fixture')
            (plugs/'MaxonPlugin.zsc').write_bytes(b'untouched')
            data=plugs/'MakCameraBankData';data.mkdir()
            (data/'CameraBank25.txt').write_bytes(b'source fixture')
            (data/'ZFileUtils64.dll').write_bytes(b'camera dependency fixture')
            (data/'owner-bank.zcv').write_bytes(b'user bank')
            def run(*args):
                r=subprocess.run(['powershell.exe','-NoProfile','-File',str(script),'-ZBrushPath',str(zb),*args],capture_output=True,text=True)
                self.assertEqual(r.returncode,0,r.stdout+r.stderr);return r.stdout
            plan=json.loads(run('-PlanOnly'));self.assertEqual(len(plan),3)
            self.assertTrue((plugs/'CameraBank25.zsc').exists())
            run()
            self.assertFalse((plugs/'CameraBank25.zsc').exists())
            self.assertFalse((data/'CameraBank25.txt').exists())
            self.assertFalse((data/'ZFileUtils64.dll').exists())
            self.assertEqual((data/'owner-bank.zcv').read_bytes(),b'user bank')
            self.assertEqual((plugs/'MaxonPlugin.zsc').read_bytes(),b'untouched')
            backup=list((fixture/'Recovery').glob('*/ZStartup/ZPlugs64/CameraBank25.zsc'))
            self.assertEqual(len(backup),1);self.assertEqual(backup[0].read_bytes(),b'compiled fixture')
            run() # repeated uninstall is harmless

if __name__=='__main__':unittest.main(verbosity=2)
