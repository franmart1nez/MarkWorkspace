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
                component_args=() if '-Component' in args else ('-Component','All')
                r=subprocess.run(['powershell.exe','-NoProfile','-File',str(ROOT/'Install.ps1'),
                    '-ZBrushPath',str(zb),*component_args,*args],env=env,capture_output=True,text=True)
                self.assertEqual(r.returncode,0,r.stdout+r.stderr)
                return r.stdout
            plan=json.loads(run('-PlanOnly','-Component','All'))
            self.assertFalse(any('CameraBank' in x['Target'] for x in plan['Actions']))
            legacy=plugs/'MakCameraBankData';legacy.mkdir()
            (legacy/'CameraBank25.txt').write_bytes(b'legacy source')
            (legacy/'keep.zcv').write_bytes(b'owner bank')
            (plugs/'CameraBank25.zsc').write_bytes(b'legacy bytecode')
            fast=plugs/'MakCameraBankFastData';fast.mkdir()
            (fast/'CameraBankFast25.txt').write_bytes(b'keep Fast')
            run()
            for folder,name,data in [('Render Capture','RenderCapture','RenderCaptureData'),
                                     ('Generate and Export ID','GenerateExportID','GenerateExportIDData')]:
                installed=plugs/data/(name+'.txt')
                self.assertEqual(installed.read_bytes(),(ROOT/folder/(name+'.txt')).read_bytes())
                self.assertTrue((plugs/data/'ZFileUtils64.dll').exists())
            self.assertFalse((plugs/'CameraBank25.zsc').exists())
            self.assertFalse((legacy/'CameraBank25.txt').exists())
            self.assertEqual((legacy/'keep.zcv').read_bytes(),b'owner bank')
            self.assertEqual((fast/'CameraBankFast25.txt').read_bytes(),b'keep Fast')
            backups=fixture/'LocalAppData/MakZBrushPlugins/InstallBackups'
            self.assertTrue(list(backups.glob('*/ZStartup/ZPlugs64/CameraBank25.zsc')))
            self.assertTrue(list(backups.glob('*/ZStartup/ZPlugs64/MakCameraBankData/CameraBank25.txt')))
            source=plugs/'RenderCaptureData/RenderCapture.txt';mtime=source.stat().st_mtime_ns
            run();self.assertEqual(source.stat().st_mtime_ns,mtime)
            source.write_bytes(b'old Render');run()
            self.assertTrue(list(backups.glob('*/ZStartup/ZPlugs64/RenderCaptureData/RenderCapture.txt')))
            self.assertEqual((plugs/'unrelated.txt').read_text(),'keep')

    def test_id_only_and_legacy_both_selection(self):
        with tempfile.TemporaryDirectory(prefix='installer-test-',dir=ROOT/'Development') as tmp:
            fixture=Path(tmp).resolve()
            zb=fixture/'ZBrush';zb.mkdir();(zb/'ZBrush.exe').write_bytes(b'fixture only')
            plugs=zb/'ZStartup/ZPlugs64';plugs.mkdir(parents=True)
            env=os.environ.copy();env['LOCALAPPDATA']=str(fixture/'LocalAppData')
            def run(component,plan=False):
                args=['powershell.exe','-NoProfile','-File',str(ROOT/'Install.ps1'),
                      '-ZBrushPath',str(zb),'-Component',component]
                if plan:args.append('-PlanOnly')
                r=subprocess.run(args,env=env,capture_output=True,text=True)
                self.assertEqual(r.returncode,0,r.stdout+r.stderr)
                return r.stdout
            plan=json.loads(run('ID',True))
            self.assertTrue(all('GenerateExportID' in a['Target'] or 'Generate and Export ID' in a['Target'] for a in plan['Actions']))
            run('ID')
            self.assertTrue((plugs/'GenerateExportIDData/GenerateExportID.txt').exists())
            self.assertFalse((plugs/'MakCameraBankData').exists())
            self.assertFalse((plugs/'RenderCaptureData').exists())
            both=json.loads(run('Both',True))
            self.assertTrue(any('GenerateExportID' in a['Target'] for a in both['Actions']))
            self.assertFalse(any('CameraBank25' in a['Target'] for a in both['Actions']))

    def test_newer_installed_binary_with_different_source_is_retired(self):
        # A newly compiled old source is not a compiled copy of this release.
        with tempfile.TemporaryDirectory(prefix='installer-test-',dir=ROOT/'Development') as tmp:
            fixture=Path(tmp).resolve()
            package=fixture/'Package';package.mkdir()
            (package/'Install.ps1').write_bytes((ROOT/'Install.ps1').read_bytes())
            src=package/'Render Capture/RenderCapture.txt';src.parent.mkdir();src.write_text('// new release')
            dll=package/'Render Capture/RenderCaptureData/ZFileUtils64.dll';dll.parent.mkdir(parents=True,exist_ok=True);dll.write_bytes(b'fixture dll')
            zb=fixture/'ZBrush';zb.mkdir();(zb/'ZBrush.exe').write_bytes(b'fixture only')
            plugs=zb/'ZStartup/ZPlugs64';plugs.mkdir(parents=True)
            data=plugs/'RenderCaptureData';data.mkdir()
            (data/'RenderCapture.txt').write_text('// different release')
            old=data/'RenderCapture.zsc';old.write_bytes(b'old compiled source')
            os.utime(old,(src.stat().st_mtime+60,src.stat().st_mtime+60))
            (plugs/'RenderCapture.zsc').write_bytes(b'old startup')
            macros=zb/'ZStartup/Macros/Mak Plugins';macros.mkdir(parents=True)
            (macros/'Load Render Capture.txt').write_text('// old loader')
            (macros/'Load Render Capture.zsc').write_bytes(b'old loader binary')
            env=os.environ.copy();env['LOCALAPPDATA']=str(fixture/'LocalAppData')
            r=subprocess.run(['powershell.exe','-NoProfile','-File',str(package/'Install.ps1'),
                              '-ZBrushPath',str(zb),'-Component','Render'],env=env,capture_output=True,text=True)
            self.assertEqual(r.returncode,0,r.stdout+r.stderr)
            self.assertFalse(old.exists())
            self.assertFalse((plugs/'RenderCapture.zsc').exists())
            self.assertFalse((macros/'Load Render Capture.zsc').exists())
            self.assertIn('ZScript:Load',(macros/'Load Render Capture.txt').read_text())
            self.assertEqual((data/'RenderCapture.txt').read_bytes(),src.read_bytes())
            self.assertTrue(list((fixture/'LocalAppData').rglob('RenderCapture.zsc')))

    def locked_fixture(self, fixture):
        self.assertTrue(fixture.is_relative_to((ROOT/'Development').resolve()))
        package=fixture/'Package';package.mkdir()
        (package/'Install.ps1').write_bytes((ROOT/'Install.ps1').read_bytes())
        for folder,name in [('Render Capture','RenderCapture'),('Generate and Export ID','GenerateExportID')]:
            p=package/folder/(name+'.txt');p.parent.mkdir();p.write_text('// fixture source v1')
        dll=package/'Render Capture/RenderCaptureData/ZFileUtils64.dll';dll.parent.mkdir();dll.write_bytes(b'dll fixture v1')
        zb=fixture/'ZBrush';zb.mkdir();(zb/'ZBrush.exe').write_bytes(b'fixture only - never execute')
        plugs=zb/'ZStartup/ZPlugs64';plugs.mkdir(parents=True)
        env=os.environ.copy();env['LOCALAPPDATA']=str(fixture/'LocalAppData')
        def run(component,locked=None):
            args=['powershell.exe','-NoProfile','-File',str(package/'Install.ps1'),'-ZBrushPath',str(zb),'-Component',component]
            if locked:
                quote=lambda p:"'"+str(p).replace("'","''")+"'"
                script=fixture/'with-lock.ps1'
                script.write_text("$ErrorActionPreference='Stop'\n"+
                    '$held=[IO.File]::Open('+quote(locked)+',[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)\n'+
                    '$fixtureExit=0\ntry { & '+quote(package/'Install.ps1')+' -ZBrushPath '+quote(zb)+' -Component '+quote(component)+
                    '\n if($LASTEXITCODE){$fixtureExit=$LASTEXITCODE}\n} finally {$held.Dispose()}\nexit $fixtureExit\n',encoding='utf-8')
                args=['powershell.exe','-NoProfile','-File',str(script)]
            return subprocess.run(args,env=env,capture_output=True,text=True)
        return package,plugs,run

    def test_identical_loaded_dll_is_not_rewritten(self):
        with tempfile.TemporaryDirectory(prefix='installer-test-',dir=ROOT/'Development') as tmp:
            package,plugs,run=self.locked_fixture(Path(tmp).resolve())
            first=run('ID');self.assertEqual(first.returncode,0,first.stdout+first.stderr)
            dll=plugs/'GenerateExportIDData/ZFileUtils64.dll';before=dll.stat().st_mtime_ns
            repeated=run('ID',dll)
            self.assertEqual(repeated.returncode,0,repeated.stdout+repeated.stderr)
            self.assertEqual(dll.read_bytes(),b'dll fixture v1')
            self.assertEqual(dll.stat().st_mtime_ns,before)

    def test_changed_locked_dll_rolls_back_other_component_changes(self):
        with tempfile.TemporaryDirectory(prefix='installer-test-',dir=ROOT/'Development') as tmp:
            package,plugs,run=self.locked_fixture(Path(tmp).resolve())
            first=run('Both');self.assertEqual(first.returncode,0,first.stdout+first.stderr)
            (plugs/'CameraBank25.zsc').write_bytes(b'legacy writer restored on rollback')
            before={p.relative_to(plugs).as_posix():p.read_bytes() for p in plugs.rglob('*') if p.is_file()}
            (package/'Generate and Export ID/GenerateExportID.txt').write_text('// fixture source v2')
            (package/'Render Capture/RenderCapture.txt').write_text('// fixture source v2')
            (package/'Render Capture/RenderCaptureData/ZFileUtils64.dll').write_bytes(b'dll fixture v2')
            failed=run('Both',plugs/'RenderCaptureData/ZFileUtils64.dll')
            self.assertNotEqual(failed.returncode,0)
            after={p.relative_to(plugs).as_posix():p.read_bytes() for p in plugs.rglob('*') if p.is_file()}
            self.assertEqual(after,before)
            self.assertNotIn('Some files need recovery',failed.stdout)

if __name__=='__main__':unittest.main(verbosity=2)
