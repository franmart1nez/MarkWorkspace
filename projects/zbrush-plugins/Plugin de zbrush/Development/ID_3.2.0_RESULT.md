# Generate and Export ID 3.2.0 worker result

The third plugin is implemented as editable generated ZScript with one public
action, plus an executable mock-host test suite. It prepares each mesh needed
by enabled cameras once, then exports `<session>/<camera>/ID.png`. This is a
source delivery; native compilation, backup reopening and visual acceptance
remain pending. Nothing was installed, compiled or run in the live ZBrush.

Source baseline: `4694ac3b7ac199e18177dad7a877ccd7b0d2e942`, containing the
controller's handoff and video analysis. Assigned branch:
`mrmak/zbrush-generate-export-id-3-2-2ad7f9`. The reviewed video evidence is
[VIDEO_ANALYSIS_3.2.0.md](../../VIDEO_ANALYSIS_3.2.0.md). The follow-up confirms
the owner's policy: **export every enabled Camera Bank view**.

Current integration inputs were copied read-only from controller commit
`0fb29356730755725a66132ba1e9ea6303e46da3`, incorporating the native camera
compatibility fixes from `afeb8a1`. Schema remains v8; store/update tracks
automatically and there is no `CB32_PrepareTransfer` routine. The generated ID
source includes this final reader. The worker's unowned camera files remain
unchanged; the selected inputs are pinned only in ignored local cache.
Normalized ASCII/LF input hashes:

- Camera source: `9beaf99488728a5c887cbefe569302c9a90b85d8cd3bf7c97826607a03e4e5c5`.
- Shared reader: `405f7b0af830fd0f100b027a70789dab3ee22004dbce3d77b0b54f79307dc877`.

## Delivered files and ownership

All paths below are relative to `projects/zbrush-plugins/Plugin de zbrush/`.

| Path | Purpose |
| --- | --- |
| `Generate and Export ID/GenerateExportID.txt` | Generated source; sole button `ZPlugin:Generar y exportar ID:Generar y exportar ID`. |
| `Development/id_body.txt` | Owned action, preflight, union, material preparation, backup, capture and recovery routines. |
| `Development/build_id.py` | Composes the current shared `camera_reader.inc` with the owned body; namespaces reader routines, variables and its scratch view block. |
| `Development/test_id_export.py` | Executes the actual generated routines and public button body through an extended mock of the existing ZScript host. |
| `Development/ID_3.2.0_RESULT.md` | This verification and integration handoff. |

No installer, uninstaller, launcher, manifest, README, Workspace, camera writer,
shared reader, render source or binary change is included. Their ownership remains
with the orchestrator and the other workers. No merge, rebase or push is part of
this delivery.

## Implemented behavior

1. Validate live Edit mode, mesh count, required UI items, exact Flat Color
   material, Camera Bank identity/dimensions and the reviewed ZFileUtils route.
   The current v8 source requires tracked names and rejects positional-only
   banks. Empty banks and gray-only selections stop clearly.
2. Reuse an existing `RC30Root` directory; otherwise choose a parent and create
   the first unused `ZPass_N`. Check every enabled camera's `ID.png` for collisions
   and write/read/delete a temporary probe in each camera and Recovery folder.
   Other pass files and prior recovery files are preserved. Output cancellation
   happens before mesh processing.
3. Snapshot original Tool identity, names/order, eyes/folder bits, selection,
   Colorize, texture toggles, material, color/channel mode/intensity, document
   size, view/lens, Solo, PolyFrame, render mode and relevant overlays. Recall
   enabled cameras through the shared reader and collect their effective visible
   mesh union, including folder/Solo/active-selection behavior. Validate required
   operations on each needed mesh. Camera identity/visibility follows the shared
   name-aware reader; it does not click camera buttons or use live mesh list
   positions as stored visibility identity.
4. Restore the original view/eyes/selection before saving a new
   `Recovery/Before_ID_N/<exact-first-SubTool-name>.ztl`. Save from SubTool 0,
   retaining its full original marked name as the filename stem. The unique
   recovery directory supplies the backup's identity; the filename does not
   replace mesh identity. Never save over the current project or another
   Tool file. Check all names before and after Save As, then restore the Tool's
   original save path and active selection and check identity again. Verify
   existence, nonzero size and a readable 64-byte prefix. A sibling
   `Recovery.txt` records the stage and complete ZTL path. Backup confirmation uses non-blocking
   NoteBar progress; no acknowledgement interrupts the action before exports.
   The final result and backup path are separate, bounded messages.
5. Set the mutation marker before the first destructive operation. On each union
   mesh exactly once: clear its mask, assign Flat Color using M-only FillObject,
   run Auto Groups, run Polypaint From Polygroups, enable Colorize and disable
   texture display. **Mask clearing is intentional preparation**, required to
   keep masked regions from retaining the previous fill/paint. Masks, original
   RGB, PolyGroups and assigned materials are recoverable from the pre-ID ZTL;
   display recovery does not undo them. Irrelevant hidden meshes are excluded
   from this processing, including meshes used only by gray views.
6. Recall each enabled camera, disable PolyFrame/floor overlays, select Flat
   Color, use Preview and export directly to its `ID.png`. Check nonzero size
   and the eight-byte PNG signature. No BPR pass, BPR requirement, solid RGB
   FillObject, per-camera Auto Groups or per-camera recoloring is used.
7. Restore original view/display/selection and Tool save path. A successful
   action leaves every processed mesh's Colorize enabled. Original texture
   toggles return after capture. A newly created root is published to `RC30Root`
   only after success, for the other passes to share.

`ID32Recovery`, `ID32Names`, `ID32ToolPath`, `ID32BackupPath` and
`ID32RecordPath` are ID-owned session memory. Native mesh IDs are stored as
uint32 rather than rounded float cells; names/order supplement them because
duplicated native meshes can share IDs. Recovery rejects another Tool or a
changed recorded list. A partial snapshot restores selection/view only. Later
interruption restores display and reports that mesh data and any written images
remain. The next action first recovers and exits; it does not silently rerun.
If Edit mode is unavailable, the marker is retained until the same Tool is
returned to Edit mode. A disk record survives an application exit; automatic
display recovery itself is session-only.

Constructed messages stay within native ZScript's 255-character limit at the
supported maximum session path (180 characters), backup folder suffix (`9999`)
and counts (25 cameras / 1000 meshes). The full backup path must be at most 240
characters, checked before it is constructed. Long first names require a shorter
session path; names are never truncated or sanitized. The longest evaluated
progress message is 254 characters; the backup result message is at most 251
and the output summary at most 239. Errors keep
their path separate from mutation/recovery status. Interrupted recovery uses
concise fixed text plus a separate backup path. The recovery record is written
as separate bounded lines, with newline bytes between them, rather than merging
the status, path and explanation into one overflowing string. Final records are
plain text without null padding. All 29 generated StrMerge commands have two
to six inputs, within the supported two-to-twelve-input range.

## Backup name preservation correction

The controller's native integration found that `Tool:Save As` to a different
basename changed the first SubTool title and erased its camera marker. The old
`Before_ID_N.ztl` basename was therefore unsafe even though the identity guard
correctly rejected the renamed Tool. Read-only evidence was inspected in
`.cache/zbrush-320/native/camera-result.txt`, `probe-save-name.txt` and the four
slots of `save-name-probe.bin`; runtime evidence was not copied into Git.

The correction saves from the top SubTool using its **exact existing name**
inside a fresh numbered directory. Only the single trailing `IGetTitle` UI
period is removed. Existing numbered directories, files occupying those paths
and the former flat `Before_ID_N.ztl`/`.txt` names are skipped. The new directory
is created and write-checked before saving. Unsafe Windows characters, control
characters, reserved device names and trailing spaces/periods are rejected
before Save As. A backup path over 240 characters is rejected before StrMerge
or file saving; the user can choose a shorter session path. No fallback name,
truncation, camera-identity guessing or weakening of the snapshot/reader checks
was introduced.

The mock now reproduces Save As renaming the first/selected mesh even on a
cancelled or failed attempt, and ToolSetPath deliberately does not repair that
name. It reproduces the old marker-loss failure and proves that the exact-name
contract avoids it. Names and live selection are checked after successful and
failed backup attempts and after interruption. A separately reopened mock
backup passes the actual strict camera reader with its matching bank; it
contains pre-ID mesh data. This is still not a native ZTL reopen verification.

The controller's narrow exact-name probe preserved the title before/after Save
As and after ToolSetPath; its original path already had the same marked stem.
That probe is **not** evidence that ToolSetPath can restore a title after saving
under a different basename. This implementation does not depend on it doing so.

## Native PolyFrame control correction

The controller compiled the exact integrated source, then its public action
stopped safely before backup/mutation because both old PolyFrame paths were
absent. Its read-only `id-control-probe.txt` now confirms
`Transform:Draw Polyframe` and the capitalization variant both exist in
2023.2.1; `Transform:PolyFrame` and `Transform:PolyF` do not. The worker read that
probe without controlling ZBrush. The installed English AutoNotes also labels
the control Draw Polyframe under its older `Transform:pf` key.

Resolution now prefers `Transform:Draw Polyframe`, then tries the capitalization
variant, `Transform:pf` and the two former aliases. No alias is used to bypass
a present but disabled canonical control. The existing required/enabled
preflight remains in place, as do snapshot, overlay disabling before every PNG,
and restoration afterward. Tests run with the actual canonical path as the
default UI; they verify initially on/off states, each fallback and failure
before backup when all aliases are missing or the canonical item is disabled.
Export records prove the resolved overlay is off during both camera captures.
Maxon's [Projection Master documentation](https://help.maxon.net/zbr/en-us/Content/html/user-guide/3d-modeling/sculpting/projection-master/projection-master.html)
also discusses the Draw Polyframe setting; the native probe is the authority
for this machine's exact path.

## SubTool Master decision and API evidence

Read-only installed inspection found `SubToolMaster_2023.zsc`, its DLL and the
UI-left configuration file, with no editable Fill implementation or published
non-dialog option contract. Maxon's [SubTool Master documentation](https://help.maxon.net/zbr/en-us/Content/html/user-guide/zbrush-plugins/subtool-master/subtool-master.html)
states that Fill opens an options dialog. A reliable supported way to choose its
Material-only option without that dialog was not established. This is not a
claim that every possible ZBrush version forbids it.

The equivalent uses the native [Color FillObject contract](https://help.maxon.net/zbr/en-us/Content/html/reference-guide/color/color.html):
M-only assigns material while preserving RGB. The same explanation was checked
in the installed English `AutoNotes.txt` under `Color:FillObject`, `Draw:M`,
`Draw:RGB` and `Draw:MRGB`; `Tool:Polygroups:AutoGroups` and the masking-clear
control are also present there. [Polypaint From Polygroups](https://help.maxon.net/zbr/en-us/Content/html/reference-guide/tool/polymesh/polypaint/polypaint.html)
then converts group colors into mesh paint, and Colorize enables its display.
There is no SubTool Master panel/dialog coordinate automation. The generated
reader retains its previously reviewed canvas redraw stroke when resizing a
document; that existing reader code is not owned by this worker.
The same [SubTool Master documentation](https://help.maxon.net/zbr/en-us/Content/html/user-guide/zbrush-plugins/subtool-master/subtool-master.html)
describes its Save ZTool convention: save from the top SubTool, then return to
the previous selection. The backup follows that convention. Its filename checks
use Microsoft's [Windows naming rules](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file),
including reserved device names even before extensions.

The [ZScript command reference](https://help.maxon.net/zbr/en-us/Content/html/user-guide/customizing-zbrush/zscripting/command-reference/command-reference.html)
was checked for `ToolGetPath`/`ToolSetPath`, `SubToolGetID`, status bits,
`MemCreateFromFile` partial reads, raw integer memory access, file size and
`FileNameSetNext` clearing. The recovery-record revision also uses its documented
`MemWriteString` byte count (including the terminating zero) and `MemResize`
to retain full separate lines while trimming the final null. New DLL calls use only the existing reviewed
`Version`, `FolderExists`, `MakeFolder` and `ChooseFolder` routes. No additional
binary or new DLL export contract was introduced.

## Verification

In the integrated controller package, run from the repository root:

```powershell
python "projects/zbrush-plugins/Plugin de zbrush/Development/build_id.py"
python "projects/zbrush-plugins/Plugin de zbrush/Development/test_id_export.py"
python -m py_compile "projects/zbrush-plugins/Plugin de zbrush/Development/build_id.py" "projects/zbrush-plugins/Plugin de zbrush/Development/test_id_export.py"
git diff --check
```

This worker's unowned local camera sources remain at the original baseline.
Do not rebuild the integrated deliverable against those older files. The worker
ran the final checks using the pinned controller inputs and the explicit
alternate-source test route (from this repository root):

```powershell
$env:ZBRUSH_ID_CAMERA_ROOT = Join-Path (Get-Location) '.cache/zbrush-id-polyframe/integrated-package'
Push-Location 'projects/zbrush-plugins/Plugin de zbrush/Development'
python -c "import os, build_id; build_id.main(camera_root=os.environ['ZBRUSH_ID_CAMERA_ROOT'])"
python test_id_export.py
python -m py_compile build_id.py test_id_export.py
Pop-Location
git diff --check
git diff --exit-code -- 'projects/zbrush-plugins/Plugin de zbrush/Camera Bank/CameraBank25.txt' 'projects/zbrush-plugins/Plugin de zbrush/Development/camera_reader.inc'
```

`camera_root` changes only source inputs, not the owned body/output destination.
The environment selector is test-only; default builds still read the current
package's camera sources. The cache is ignored runtime evidence, not a new
distributable or private schema. The orchestrator should use the default route
after integration and regenerate with its current reader.

The generated source matches `compose(camera_root=selected_inputs)` exactly and
embeds the shared reader's SHA256 for traceability. The suite executes delivered
routines with modeled
material/RGB/group mutations and actual temporary file IO; it does not merely
assert source strings. It covers 30 tests with additional subcases:

- the sole button's complete successful sequence, union preparation exactly
  once, same IDs between views, M-only preserving RGB before conversion and
  successful Colorize retention;
- reordered name tracking, duplicate native mesh IDs, an ID above float integer
  precision, distinct camera dimensions, folder eyes, Solo and active selection;
- hidden and gray-only meshes unchanged; existing/new/invalid cached sessions;
  direct camera paths, other pass preservation and unique recovery filenames;
- collisions in a later camera before backup/mutation; missing controls,
  per-mesh unavailable controls, missing/near-match materials, DLL/version,
  invalid Edit/bank/dimensions, selection cancellation and write failure;
- backup cancellation, empty/unreadable backups, failed export, corrupt PNG,
  bad tracking names, snapshot/preflight/mutation interruption, script reload,
  wrong-Tool recovery guards and unavailable-Edit recovery guards;
- every ID StrMerge/message expression evaluated at maximum supported path and
  count values; all generated StrMerge arities; runtime overflow guards for
  merges, notices and memory strings throughout the suite;
- a complete real-temporary-file run at a 180-character session path and the
  longest backup folder suffix and admitted filename (240-character ZTL path),
  full backup path in the readable disk record, no blocking MessageOK before
  exports, and maximum-path failure/recovery cases;
- modeled Save As marker loss without ToolSetPath repairing it; exact-name
  backups from the top mesh with original live selection restored; reopening
  the modeled backup against the matching bank's strict reader;
- unsafe filename rejection, a 241-character path rejected before saving,
  original names unchanged on cancellation/empty/unreadable backups/path-restore
  failure and interruption, and preservation of existing numbered recovery paths;
- the native Draw Polyframe path with original states 0/1, all aliases, canonical
  preference, overlay-off exports and original-state restoration, plus missing/
  disabled-control failures before any backup or mesh mutation.

Final results: 30 tests passed against the pinned final controller camera inputs;
Python compilation passed. The mock records a
fake ZTL and signature-bearing fake image payload, explicitly labeled as mocks.
These results **do not** establish native ZScript compilation, valid native ZTL
structure/reopening, decoded PNG dimensions or the appearance of any render.
The orchestrator separately reports native existence probes for Auto Groups,
Polypaint From Polygroups, Colorize, Flat Color and Color:FillObject in 2023.2.1;
that is not a native execution/visual verification of this ID action.

## Integration required from the orchestrator

- Review this owned scope, then rebuild with the controller's current camera
  reader. This follow-up was tested with Camera Bank 3.2 / data v8; the tests
  no longer invoke the removed prepare routine and assert automatic tracking.
  `build_id.py` derives the allocation/version from that camera source and fails
  on ambiguous allocation/version declarations or missing reader entry points.
  It does not carry a private name parser/schema. Slot occupancy/render flags,
  dimensions and active-slot header are the existing stable layout; review them
  if the new camera schema changes those fields. Re-run the tests if the reader
  changes after these pinned inputs.
- The generated source now uses the controller's final native-compatible reader.
  Regenerate again if the controller changes it; no unowned camera source change
  is included in this patch. The controller must retest the public ID action
  after this path correction; its earlier successful compilation reached only
  the missing-control preflight guard, with no backup/mutation.
- The controller reports that its build_all now invokes build_id with
  `run_name='__main__'`; the guarded main remains compatible. Stage the source
  under folder `Generate and Export ID`, basename `GenerateExportID`; compiled
  basename must also be `GenerateExportID`. Add the owned launcher/manifest/
  install/uninstall/README/Workspace integration there. Loader name is
  `Load Generate and Export ID`.
- Supply `GenerateExportIDData/ZFileUtils64.dll` from the existing reviewed
  installation source. Adjacent `ZFileUtils64.dll` and stock
  `ZBRUSH_ZSTARTUP/ZPlugs64/MacroData/ZFileUtils64.dll` are fallbacks. This commit
  includes no DLL or compiled ZSC.
- The enabled-camera export policy is owner-confirmed. Keep it in the release
  documentation; no further policy confirmation is needed.
- Preserve the exclusive native lease. The worker did not load scripts, use
  the UI, install files, close/restart apps, launch workers or modify other
  workers' sources.

## Native checks and remaining limits

1. Under the orchestrator's explicit ZBrush lease, protect the open owner project
   and compile/load the integrated sources. Use a disposable multi-SubTool Tool
   with disconnected islands, existing paint/materials, masks and textures,
   duplicate IDs, reordered names, a hidden folder and Solo. Enable cameras 01
   and 10 with different sizes; keep 25 gray. Verify required control paths and
   actual M-only FillObject/Auto Groups/Polypaint behavior on this ZBrush version.
   Specifically verify Draw Polyframe resolves, starts in each 0/1 state, stays
   off during all ID captures and returns to its starting state afterward.
2. Run the single button into a session containing another pass and an older
   recovery file. Check that both survive, only 01/10 get `ID.png`, decoded sizes
   match the stored cameras, all required parts show flat colored regions,
   textures/wire/floor do not obscure the pass and colors match across views.
   Check successful Colorize, original eyes/folder/Solo/view/lens/selection,
   global channel settings and Tool save path.
3. Save from a nonzero starting selection and verify the backup is under its
   fresh numbered directory with the exact marked top-SubTool filename. Check
   every live name before/after both Save As and ToolSetPath, on success and
   cancelled/failed backup. Open the pre-ID ZTL as separate recoverable test
   data, without replacing an unsaved owner Tool. Verify original groups, RGB,
   materials, masks, all names and visibility, then recall enabled views with
   the matching bank. Backup selection is the top mesh; the live starting
   selection must be restored. **This native reopen check is required:** the
   implemented existence/size/64-byte read gate proves a saved readable file,
   not structural ZTL validity or full recoverability by itself.
4. Verify missing/empty bank, unavailable materials/controls, cancelled folder
   choice and output collision all precede mesh mutation. Test with and without
   `RC30Root`, and review partial output/recovery messages on export failure.
5. Interrupt during snapshot/preflight, then during mesh processing/export.
   Press the same button on another Tool and with Edit off to verify guards;
   return to the same Tool and verify display recovery does not rerun generation
   or falsely claim RGB/PolyGroups/masks were undone. Load the backup separately
   for original mesh data.

Current limits: native compiler and application behavior are unverified; name
lengths and non-ASCII Tool names need native coverage. Session output paths are
limited to 180 characters (chosen parent 160) for safe string/suffix storage.
The exact-name recovery ZTL path is limited to 240, so long first SubTool names
require a shorter session path. Invalid filenames are rejected without renaming.
There are at most 1000 SubTools and 9999 session/recovery candidates. The Tool
identity guard deliberately rejects changed names/order during an interrupted
action rather than writing old settings into a changed list. Per-polygon hiding,
layers, dynamic subdivision and unusual mesh types follow native operation
semantics and still need native QA. Document resizing inherits the shared
reader's existing canvas redraw behavior and does not snapshot arbitrary 2.5D
document content. No owner visual acceptance, live installation, release package
or compiled plugin is claimed by this worker.
