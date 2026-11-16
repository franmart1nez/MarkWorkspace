ZBRUSH PLUGINS 3.2.3
Camera Bank 25 + Render Capture + Generar y exportar ID
Windows / native compilation and selected validation: ZBrush 2023.2.1

STATUS AND SOURCE
All three components are integrated, compiled and installed on the target
machine. Editable TXT sources, generators, tests and genuine native ZSC files
are included. Development/VERIFICATION_3.2.3.md records the actual checks and
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
also placed in ZStartup/ZPlugs64. All three controls loaded automatically on
the independent recovery launch; see the verification record for session handling.

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
New exports use data v9: 123,088 bytes. Cancellation preserves the in-memory cameras.

ZTL FILENAMES AND OLDER BANKS
New 3.2.1 banks store native mesh IDs as well as name markers. You can save and
reopen a matching ZTL with an arbitrary filename: the first SubTool filename
alias is resolved automatically when its identity is unambiguous. Names on
other SubTools must retain their markers. Ambiguous or unknown identity is
rejected instead of guessed. The reader is shared by Camera, Render and ID.

Data is now v9: 123,088 bytes. Install/update all three components together;
older binaries cannot read v9. Old v1-v8 banks still import. For a tracked v8
bank, open the matching marked Tool in Edit mode, import the bank and export
it again to attach native IDs. If the first marker was already lost, use its
matching marked ZTL/ZPR for this one migration. Untracked banks retain their
review/update workflow. ZPR filenames can also be chosen freely.

The source of this correction and its checks are in
Development/VERIFICATION_3.2.1.md and Development/DATA_FORMAT.md.

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
Existing matching files are listed by camera before any render starts, then
replaced. Other filenames and disabled cameras are left alone.

GENERAR Y EXPORTAR ID
Two actions export ID.png for EVERY enabled Camera Bank camera. Each reuses
the active ZPass_1 folder or chooses/creates ZPass_1 itself. No separate
Render Capture folder-preparation step is required.

Generar y exportar ID generates the IDs and exports them.
Exportar ID exports existing manually prepared colors/textures using Render Flat.
It does not fill materials, regenerate RGB/PolyGroups, or clear masks. Colorize
and texture toggles remain as prepared. Both actions restore display/view state.
For manual export, prepare the visible colors and mask display before capture.

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
52 focused automated tests passed for 3.2.3. See Development/VERIFICATION_3.2.3.md.
The 104-test 3.2.2 acceptance is retained in its historical record.
Historical identity and full render evidence remains in the 3.2.1/3.2.0 records.

From Development, use:
  python build_all.py
  python -m unittest -v verify verify_merge verify_camera_320 test_render_layout test_id_export test_installer test_uninstaller test_ztl_identity
Regenerate before native compilation. Camera and ID logic live in their build
inputs/includes; the generated reader is shared by the two capture plugins.

UNINSTALL
DESINSTALAR.cmd backs up and removes only this package's explicit files. It
preserves unrelated plugins, saved banks and other user files. Loaded controls
can remain until a later normal launch. Recovery folders are not part of the ZIP.
