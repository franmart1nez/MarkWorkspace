ZBRUSH PLUGINS - CAMERA BANK 25 + RENDER CAPTURE
Version 3.1.0 SOURCE UPDATE | 2026-11-14 | Windows / ZBrush 2023.2.1 target

STATUS
Camera Bank can prepare effective-visibility groups for ZTL/ZPR transfer and
compatible native merges. Both plugins now use data v8. Render Capture retains
numbered Screenshots copies and the requested pre-BPR quality values.
32 offline logic scenarios, installer/uninstaller fixtures and a 1000-SubTool
mock smoke test pass. No native app launch, control, compilation or render was
performed for this revision. Actual native behavior/visual acceptance is pending.
No current CameraBank25.zsc or RenderCapture.zsc is included.

INSTALL / LOAD
Run INSTALAR.cmd when ready to install the sources, loader macros and Maxon's
existing ZFileUtils64.dll dependency for both components. Previous files are
backed up. An older compiled plugin is backed up/retired when no fresh compiled
replacement exists, so old-format callbacks are not silently auto-loaded later.
No application is closed or restarted.
In ZBrush: Macro > Reload All Macros > Mak Plugins > Load Camera Bank, then
Load Render Capture. The loaders replace only their own previous controls.
Alternatively, load BOTH updated package TXT sources via ZScript > Load.
Keep the complete source package together for Camera Bank's preparation DLL.
ZBrush generates genuine ZSCs when loading the TXT files. Run the installer again
after compilation to promote those new files for normal automatic startup.
If Windows denies Program Files access, run the installer as administrator.
The installer targets Windows ZBrush 2023-2026.0; newer user-content layouts
require manual placement in their configured plugin directory.

CAMERA BANK
25 slots; STORE NEW then an empty slot stores the current view. Orange means
stored and selected for rendering; gray means stored but not rendered. First
click recalls a stored view; later clicks on the active view toggle rendering.
UPDATE ACTIVE replaces the view/lens/size/visibility while preserving its Render
flag, including gray cameras. CLEAR and CLEAR ALL retain their original purpose.
Canvas dimensions, transform, zoom/pan, perspective and supported lens controls
are saved. Recall resizes/redraws before restoring lens and transform. It requires
a live 3D Tool in Edit mode and supports up to 1000 SubTools. No auto conversion.

MERGE-COMPATIBLE HANDOFF
1. On the ORIGINAL unmerged Tool, store and inspect every intended camera.
2. PREPARE TRANSFER adds a 20-character CB...G..._ name marker. Parts with the
   same marker share visibility in ALL occupied cameras, including gray cameras.
3. Save the prepared ZTL/ZPR, EXPORT BANK, and send BOTH matching files.
   Export also prepares an unprepared bank automatically after choosing a file.
4. The recipient opens the model, imports the bank, and can reorder/merge
   compatible parts with native commands while preserving a source marker.
   Native Merged_ prefixes are accepted. If an operation replaces the entire
   name, retain a compatible source marker in the result before recalling.
Effective capture accounts for folder eyes, Solo and the active SubTool. Recall
opens folder eyes and applies per-part visibility; the visible geometry is the
contract. It may select a visible SubTool to avoid a hidden active part showing.
After storing/updating a prepared bank, save a NEW matching model + bank pair:
the plugin rebases the views and refreshes the identifiers.
Only merge parts whose visibility matches in every stored camera. Name markers
do not encode geometric ancestry or detect every violation of that rule after
native merges discard other source names. Missing/foreign/ambiguous markers and
missing visible groups stop recall/render instead of using positional guesses.
See Development/MERGE_HANDOFF.md for the complete workflow and limits.

OLD BANKS / INTERRUPTIONS
Versions 1-7 import into v8 without invented identifiers. On the ORIGINAL Tool,
recall and visually inspect EACH occupied camera, then UPDATE ACTIVE before
preparing transfer. Older banks may also need correct canvas/lens settings.
Already merged unmarked models cannot recover that missing correspondence.
During a name update, handled failures restore previous names/bank/view. After
Escape, use a Camera Bank button on the same unchanged Tool to recover. Pending
name recovery blocks rendering. Recovery is session-memory only, not crash-proof.

RENDER CAPTURE
1 - CREATE FOLDERS chooses a parent and creates a new ZPass_1, ZPass_2, ...
session, numbered camera folders with NonBPR/BPR, and shared Screenshots.
2 - RENDER NON BPR runs all orange cameras with Shadows OFF, white active RGB,
and Preview rendering. Four lossless PNG passes per view:
  Z document.png : loaded Basic Thor material, Polypaint ON
  Normal.png     : NormalRGBMat
  Double.png     : loaded DoubleShade material
  Metal.png      : exactly Metal 11 (Metal 111 is not accepted)
Exact Basic Thor / DoubleShade are preferred, then loaded matching variants.
Missing materials stop before rendering. The original .zmt files are not bundled.
Normal/Double/Metal use Polypaint and texture display OFF. Existing paint is not
erased. Each Z document is copied byte-for-byte to Screenshots/01.png, 02.png,
etc., retaining the original. Disabled cameras produce no files.
3 - RENDER BPR enables Shadows/AOcclusion/Sss, disables Reuse Existing Maps,
then immediately before EACH BPR sets Shadow Rays=30, Shadow Angle=15,
AO Rays=30 and SPix=2 (SubPixel Anti-aliasing Render Quality).
It saves seven native PSD maps: _AO, _Composite, _Depth, _Mask, _Render (Shaded),
_Shadow and _SSS. All seven must exist before exporting a view. Light 2's SSS
flag is enabled from a session snapshot; no Light:Save/Load is used.
The current material/lighting and Polypaint are used. No Photoshop is opened.

OUTPUT EXAMPLE
ZPass_1/
  Screenshots/01.png, 02.png, ...
  01/NonBPR/Z document.png, Normal.png, Double.png, Metal.png
  01/BPR/_AO.psd, _Composite.psd, _Depth.psd, _Mask.psd,
         _Render.psd, _Shadow.psd, _SSS.psd
  02/NonBPR/...
  02/BPR/...
Existing outputs are preserved; start a new session to repeat a phase. The root
lasts for the current session. RGB, material, render flags/mode, map reuse, Solo
and per-SubTool paint/texture display recover after a batch/handled interruption.
The four BPR quality values remain set. The last camera transform stays active.

UNINSTALL / SOURCES
DESINSTALAR.cmd removes only this package's explicit plugin/source/dependency
files and loaders, backing up each first. It preserves unrelated plugins and
saved banks, and does not close/restart the app. Loaded controls may remain until
the next normal launch. No installation/uninstallation was run on the real app
for 3.1.0; only isolated fixtures were used.
Editable sources are Camera Bank/CameraBank25.txt and Render Capture/RenderCapture.txt.
Development contains build inputs, regression checks, data format and native
acceptance checklist. Run build_all.py, verify.py, verify_merge.py and the two
installer tests there. Compile/verify in ZBrush before claiming native release QA.
Previous sources/binary/ZIP are backed up in workspace .cache/zbrush-306, outside
Git and this package. Historical native 3.0.3 results are in VERIFICATION.md and
the Workspace card; native exports/Recovery folders are not bundled here.
