ZBRUSH RENDER / ID PLUGINS 3.2.6
Windows / ZBrush 2023.2.1 native compilation

Camera Bank Fast is the ONLY camera writer. This package contains Render
Capture and Generate and Export ID. The old Camera Bank folder, compiled
writer and camera installation option have been removed.

INSTALL / LOAD
Install Camera Bank Fast 0.3 separately using INSTALAR FAST.cmd. It can import
client-native ZAppLink .vws files with IMPORT VWS. See its README.txt.
Run INSTALAR.cmd here for Render and ID. All/Both are aliases for both consumers;
Render/ID individual selections are also available. No Camera option remains.
The installer backs up and retires only explicit old Camera Bank installed
files, preserving saved banks, Fast and unrelated plugins. It never restarts
ZBrush. Controls from an old loaded writer may persist until a normal launch.

In an open ZBrush: Macro > Reload All Macros > Mak Plugins > Load Camera Bank
Fast / Load Render Capture / Load Generate and Export ID. Orange Fast cameras
export. Fast 0.3 VWS imports start orange with Render ON. The two bulk
controls above the numbered slots set Render OFF or ON for all stored cameras.

New camera imports use current canvas, lens and visibility as editable defaults.
Recall and configure a camera as needed, then press UPDATE ACTIVE. Save the
matching ZTL/ZPR after identifier updates and EXPORT BANK. Fast banks remain
v9, 123,088 bytes. Matching .zcv import and legacy migration remain in Fast.

The included ZSC binaries are genuinely compiled. Editing TXT requires native
recompilation and reinstalling. The installer targets the Windows 2023-2026.0
layout; only 2023.2.1 is validated here. Renaming TXT to ZSC is not compilation.

RENDER CAPTURE
1 - CREATE FOLDERS creates/reuses ZPass_1 inside the chosen parent.
Selecting ZPass_1 directly also works; no numbered sessions are created.
2 - RENDER NON BPR exports four PNGs for each enabled camera.
3 - RENDER BPR exports seven native PSD maps for each enabled camera.
Both phases share the SAME camera folder, and either phase can run first.

NON BPR: Z document.png uses Basic Thor with each original Polypaint flag; Normal.png,
Double.png and Metal.png use NormalRGBMat, DoubleShade and exactly Metal 11
with Polypaint/texture display off. Required custom materials are not bundled.
Each Z document is copied byte-for-byte to Screenshots/01.png, 02.png, etc.

BPR: Shadow Rays 30, Shadow Angle 15, AO Rays 30, SPix 2. Shadows, AO and SSS
are enabled for capture; all seven maps are checked. Native Depth stays 16-bit.
There is no Light:Save/Load. The existing display/light recovery is retained.
Existing matching files are replaced automatically without overwrite prompts. Other filenames and disabled cameras are left alone.

GENERAR Y EXPORTAR ID
Two actions export ID.png for EVERY enabled Camera Bank Fast camera. Each reuses
the active ZPass_1 folder or chooses/creates ZPass_1 itself. No separate
Render Capture folder-preparation step is required.

Generar y exportar ID generates the IDs and exports them.
Exportar ID exports existing manually prepared colors/textures using Render Flat.
It enables and verifies Colorize on every required SubTool before each camera.
It does not fill materials, regenerate RGB/PolyGroups, or clear masks. Texture
toggles remain as prepared. Both actions restore original display/view state.
Prepare the existing Polypaint colors and mask display before capture. Matching
ID.png files are replaced automatically without overwrite prompts.

The generating action prepares the union of required visible meshes once, preserving ID
colors across cameras: Flat Color material-only fill, Auto Groups, Polypaint
From Polygroups, Colorize ON, texture/PolyFrame/floor display off for capture.
The material-only fill is the native equivalent of SubTool Master's Fill >
Material option, avoiding its manual options dialog. Gray cameras are omitted.

No automatic ZTL backup or Recovery copy is created before ID processing.

The generating action intentionally changes PolyGroups, RGB, assigned materials and masks of the
required meshes. Masks are cleared so old masking cannot suppress ID painting.
Display recovery restores each original Colorize toggle, including on success;
it does not undo mesh data. Run ID after beauty/material passes.

OUTPUT EXAMPLE
ZPass_1/
  Screenshots/01.png, 02.png, ...
  01/Z document.png, Normal.png, Double.png, Metal.png
  01/_AO.psd, _Composite.psd, _Depth.psd, _Mask.psd,
     _Render.psd, _Shadow.psd, _SSS.psd, ID.png
  02/...
No BPR or NonBPR child folders are created. Existing folders are not migrated.
The shown camera names are the bank's displayed labels 01 through 25.

VERIFICATION / DEVELOPMENT
See Development/VERIFICATION_3.2.6.md for this cleanup and Fast 0.2 import.
Historical identity and full-render evidence stays in the 3.2.1/3.2.0 records.
Build sources with python Development/build_all.py, then compile in ZBrush.
Development/tests/fixtures/legacy_camera_321.txt is a historical compatibility
test input, not an installable camera plugin. The old camera builder is retired.
Run python -m unittest discover -s Development -p "test_*.py" for consumers.

UNINSTALL
DESINSTALAR.cmd backs up and removes only this package's explicit installed
files, including historical owned files. Fast, saved banks and unrelated
plugins are preserved. Recovery folders are excluded from the ZIP.
