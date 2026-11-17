from pathlib import Path
import json, os, subprocess, tempfile, unittest, shutil
ROOT=Path(__file__).resolve().parents[1]
class StandaloneInstaller(unittest.TestCase):
 def test_install_repeat_and_uninstall_touch_only_fast_files(self):
  with tempfile.TemporaryDirectory(dir=ROOT/'Development',prefix='fast-install-') as d:
   tmp=Path(d);zb=tmp/'ZBrush';zb.mkdir();(zb/'ZBrush.exe').write_bytes(b'fixture only')
   plugs=zb/'ZStartup/ZPlugs64';plugs.mkdir(parents=True)
   for n in ('CameraBank25.zsc','RenderCapture.zsc','GenerateExportID.zsc','Other.zsc'):(plugs/n).write_bytes(n.encode())
   env=os.environ.copy();env['LOCALAPPDATA']=str(tmp/'LocalAppData')
   def run(script,*args):
    r=subprocess.run(['powershell.exe','-NoProfile','-File',str(script),'-ZBrushPath',str(zb),*args],env=env,text=True,capture_output=True)
    self.assertEqual(r.returncode,0,r.stdout+r.stderr);return r.stdout
   plan=json.loads(run(ROOT/'Install.ps1','-PlanOnly'))
   for action in plan['Actions']:self.assertTrue('CameraBankFast' in action['Target'] or 'Camera Bank Fast' in action['Target'])
   run(ROOT/'Install.ps1');data=plugs/'MakCameraBankFastData';source=data/'CameraBankFast25.txt'
   self.assertEqual(source.read_bytes(),(ROOT/source.name).read_bytes());stamp=source.stat().st_mtime_ns
   run(ROOT/'Install.ps1');self.assertEqual(source.stat().st_mtime_ns,stamp)
   macro=zb/'ZStartup/Macros/Mak Plugins/Load Camera Bank Fast.txt'
   self.assertIn('RESCAN MODEL',macro.read_text());self.assertIn('IMPORT VWS',macro.read_text());self.assertNotIn('ZPlugin:Camera Bank 25:',macro.read_text())
   self.assertEqual((plugs/'CameraBankFast25.zsc').read_bytes(),(data/'CameraBankFast25.zsc').read_bytes())
   (data/'client-bank.zcv').write_bytes(b'client bank')
   uninstall=tmp/'Uninstall.ps1';shutil.copy2(ROOT/'Uninstall.ps1',uninstall)
   run(uninstall)
   self.assertFalse(source.exists());self.assertEqual((data/'client-bank.zcv').read_bytes(),b'client bank')
   for n in ('CameraBank25.zsc','RenderCapture.zsc','GenerateExportID.zsc','Other.zsc'):self.assertEqual((plugs/n).read_bytes(),n.encode())
   self.assertTrue(list((tmp/'Recovery').rglob('CameraBankFast25.txt')))
if __name__=='__main__':unittest.main(verbosity=2)
