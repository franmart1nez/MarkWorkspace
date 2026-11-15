ZBRUSH PLUGINS 3.2.0
Camera Bank 25 + Render Capture + Generar y exportar ID
Windows / native compilation and selected validation: ZBrush 2023.2.1

STATUS AND SOURCE
All three components are integrated, compiled and installed on the target
machine. Editable TXT sources, generators, tests and genuine native ZSC files
are included. Development/VERIFICATION_3.2.0.md records the actual checks and
limits. Sources are maintained in projects/zbrush-plugins/Plugin de zbrush.

INSTALL / LOAD
Run INSTALAR.cmd for all three components. Individual component folders contain
launchers for Camera, Render and ID. -Component Both retains the former two-plugin
selection; All is the new default. Sources, loaders and ZFileUtils64.dll are
installed with backups of replaced files. Identical files are not rewritten,
so an already loaded identical DLL does not require an application restart.
An incompatible old compiled plugin/loader is backed up and retired.

In an already open ZBrush, use Macro > Reload All Macros > Mak Plugins, then
Load Camera Bank, Load Render Capture and Load Generate and Export ID.
No application is closed or restarted by the installer. The three ZSC files are
also placed in ZStartup/ZPlugs64 for the next normal startup. Automatic startup
was not tested by restarting the owner's running session.

The included ZSC files were compiled in 2023.2.1. If rebuilding/editing TXT,
load the updated source through ZScript > Load and reinstall its new native
ZSC. Renaming a TXT extension to ZSC is not compilation. The installer uses
Windows 2023-2026.0 installation layout; other versions are not validated.

CAMERA BANK
STORE NEW, then an empty 01-25 slot, stores the current view. Orange cameras
render; gray occupied cameras do not. A first click recalls a stored view;
clicking the active view again toggles its render flag. UPDATE ACTIVE captures
the current view while retaining the render flag, including gray cameras.

Store/update automatically captures effective visibility (eyes, folders, Solo
and active SubTool), dimensions, lens and transform. PREPARE TRANSFER is gone.
Name markers are maintained automatically. Recall resolves those names after
reordering and compatible native merges, without a positional guess. All
occupied cameras participate in compatibility, including gray ones.

Save the matching model after the latest store/update, then EXPORT BANK.
Export works independently of Edit mode and read-back verifies all bank cells.
Data remains v8: 111,084 bytes. Cancellation preserves the in-memory cameras.

IMPORTANT ZTL NAME RULE
ZBrush Save As can rename the first SubTool to the ZTL basename. Keep its marked
default filename (the CB...G..._ prefix) and choose any folder. An arbitrary
project filename is supported with ZPR. Merge only parts whose visibility is
identical across every occupied camera and preserve one compatible marker.
Unknown, missing or ambiguous names stop recall rather than guessing ancestry.
Untracked old banks need reviewed UPDATE ACTIVE operations on their original
unmerged Tool. See Development/DATA_FORMAT.md and MERGE_HANDOFF.md.

RENDER CAPTURE
1 - CREATE FOLDERS chooses a parent and creates a new ZPass_1, ZPass_2, ...
2 - RENDER NON BPR exports four PNGs for each enabled camera.
3 - RENDER BPR exports seven native PSD maps for each enabled camera.
Both phases share the SAME camera folder, and either phase can run first.

NON BPR: Z document.png uses Basic Thor with Polypaint ON; Normal.png,
Double.png and Metal.png use NormalRGBMat, DoubleShade and exactly Metal 11
with Polypaint/texture display off. Required custom materials are not bundled.
Each Z document is copied byte-for-byte to Screenshots/01.png, 02.png, etc.

BPR: Shadow Rays 30, Shadow Angle 15, AO Rays 30, SPix 2. Shadows, AO and SSS
are enabled for capture; all seven maps are checked. Native Depth stays 16-bit.
There is no Light:Save/Load. The existing display/light recovery is retained.
Existing pass files are never overwritten; create a new session to repeat.

GENERAR Y EXPORTAR ID
One public action exports ID.png for EVERY enabled Camera Bank camera. It reuses
the active output session or chooses/creates a new ZPass_N itself. No separate
prepare/export buttons or Render Capture folder-preparation step are required.

The action prepares the union of required visible meshes once, preserving ID
colors across cameras: Flat Color material-only fill, Auto Groups, Polypaint
From Polygroups, Colorize ON, texture/PolyFrame/floor display off for capture.
The material-only fill is the native equivalent of SubTool Master's Fill >
Material option, avoiding its manual options dialog. Gray cameras are omitted.

Before mesh edits it saves:
  Recovery/Before_ID_N/<exact-first-SubTool-name>.ztl
with a Recovery.txt record. The unique folder avoids overwrites and the exact
filename preserves the camera marker. Invalid filenames and backup paths over
240 characters are rejected before saving. Choose a shorter output path if needed.

ID intentionally changes PolyGroups, RGB, assigned materials and masks of the
required meshes. Masks are cleared so old masking cannot suppress ID painting.
The backup recovers original mesh data; display recovery is not a mesh undo.
Run ID after beauty/material passes, or load the backup before returning to the
original surface treatment. Colorize remains ON after successful ID generation.

OUTPUT EXAMPLE
ZPass_1/
  Screenshots/01.png, 02.png, ...
  01/Z document.png, Normal.png, Double.png, Metal.png
  01/_AO.psd, _Composite.psd, _Depth.psd, _Mask.psd,
     _Render.psd, _Shadow.psd, _SSS.psd, ID.png
  02/...
  Recovery/Before_ID_1/<marked-first-SubTool-name>.ztl, Recovery.txt
No BPR or NonBPR child folders are created. Existing folders are not migrated.
The shown camera names are the bank's displayed labels 01 through 25.

VERIFICATION / DEVELOPMENT
100 integrated automated tests passed. The installer/uninstaller then passed
six checks, including two added locked-file/rollback regressions (102 distinct
scenarios in total). Native public export/import, actual reorder and compatible
MergeDown, both render phase orders, flat ID color consistency, Colorize,
collision protection, exact-name backup reopening and installed loaders passed.
The owner's original document and settings were restored; no push/restart/close.
See Development/VERIFICATION_3.2.0.md and Verification/v3.2.0/.

From Development, use:
  python build_all.py
  python -m unittest -v verify verify_merge verify_camera_320 test_render_layout test_id_export test_installer test_uninstaller
Regenerate before native compilation. Camera and ID logic live in their build
inputs/includes; the generated reader is shared by the two capture plugins.

UNINSTALL
DESINSTALAR.cmd backs up and removes only this package's explicit files. It
preserves unrelated plugins, saved banks and other user files. Loaded controls
can remain until a later normal launch. Recovery folders are not part of the ZIP.
