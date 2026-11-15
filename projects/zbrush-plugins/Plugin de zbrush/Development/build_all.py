from pathlib import Path
import runpy
ROOT=Path(__file__).resolve().parents[1]
runpy.run_path(str(ROOT/'Development/build_camera.py'))
reader=(ROOT/'Development/camera_reader.inc').read_text(encoding='ascii')
body=(ROOT/'Development/render_body.txt').read_text(encoding='ascii')
(ROOT/'Render Capture/RenderCapture.txt').write_text(reader+'\n\n'+body,encoding='ascii')
print('Render Capture source built.')
runpy.run_path(str(ROOT/'Development/build_id.py'))
