CAMERA BANK FAST 0.3
Windows / ZBrush 2023.2.1 target

Fast is the active Camera Bank for this project and the camera provider for
Render Capture and both ID actions. The old Camera Bank is retired.
25 cameras; data v9 (123,088 bytes); no new bank format or consumer API.

IMPORT NATIVE ZBRUSH VIEWS
1. Open the matching model in Edit mode. Choose your starting document size
   and lens. Native ZAppLink VWS files do not store those settings, SubTool
   visibility, Solo, or Fast render flags. A filename such as "85mm" does not
   set the lens; choose the client's lens yourself before importing.
2. Click IMPORT VWS and choose the client's .vws file. There is no need to
   load the views into Document > ZAppLink Properties first.
3. Stored views are appended to the first free Fast slots in native order:
   Front, Back, Rght, Left, Top, Botm, Cust1, Cust2. Empty views are skipped.
   Existing cameras are preserved. The whole set must fit in the 25 slots.
4. Imported cameras start orange (Render ON). Current document dimensions,
   lens, zoom/pan and effective SubTool visibility are captured as defaults.
   Recall a camera, adjust these settings and press UPDATE ACTIVE. Use
   Desactivar todas las camaras or Activar todas las camaras above the slots
   to set Render OFF or ON for every stored camera in one step.
5. Save the matching ZTL/ZPR after the marker updates and EXPORT BANK. These
   cameras are now regular Fast cameras and work with Render Capture and ID.

The importer reads the native 320-byte, eight-view ZAppLink layout. Position
X uses document width, Y uses document height, and all three scale components
use document width, matching native ZAppLink normalization. Rotation is kept.
VWS does not include the model: use the matching unchanged Tool/geometry.
Unsupported, malformed, empty or oversized sets leave existing cameras alone.
One recoverable writer transaction covers the entire import and initial model
binding. An occupied untracked legacy bank must be reviewed/updated first.
The importer never invokes or replaces ZAppLink and does not change its views.

FAST BEHAVIOR
The first binding reads names and registers stable CB markers. Ordinary saves
update visibility without selecting and renaming every mesh. Recall checks
native IDs by index and applies the eyes. A changed Tool, count, ordered ID list
or bank triggers full validation; structural changes rebuild markers once.
Compatible merges need equal visibility across ALL occupied cameras, including
gray ones, and a retained marker. Unknown ancestry remains an error.

Duplicated native IDs need extra name checks. A name-only edit to an unselected
uniquely identified mesh can stay cached: use RESCAN MODEL after editing CB
identifiers externally. Effective visibility includes folders, Solo and the
active SubTool. Data/lens/canvas storage and .zcv compatibility are unchanged.

INSTALLATION
Run INSTALAR FAST.cmd. In an open ZBrush: Macro > Reload All Macros >
Mak Plugins > Load Camera Bank Fast. Controls: ZPlugin > Camera Bank Fast.
The installer backs up replacements and never restarts ZBrush. The Render/ID
installer retires old Camera Bank installed files with verified backups.
DESINSTALAR FAST.cmd removes only Fast-owned files. The bundled native Maxon
ZFileUtils64.dll is unchanged. Sources, generator and tests rebuild standalone.

VALIDATION
See VERIFICATION.md for native sample import, public controls and limits.
Sources: CameraBankFast25.txt, Development/build_fast.py, fast.inc and vws.inc.
