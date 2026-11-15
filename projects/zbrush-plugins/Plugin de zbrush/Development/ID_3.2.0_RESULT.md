# Generate and Export ID 3.2.0 worker result

The third plugin is implemented as editable generated ZScript with one public
action, plus an executable mock-host test suite. It prepares each mesh needed
by enabled cameras once, then exports `<session>/<camera>/ID.png`. This is a
source delivery; native compilation, backup reopening and visual acceptance
remain pending. Nothing was installed, compiled or run in the live ZBrush.

Source baseline: `4694ac3b7ac199e18177dad7a877ccd7b0d2e942`, containing the
controller's handoff and video analysis. Assigned branch:
`mrmak/zbrush-generate-export-id-3-2-2ad7f9`. The reviewed video evidence is
[VIDEO_ANALYSIS_3.2.0.md](../../VIDEO_ANALYSIS_3.2.0.md). Export policy remains the
handoff's provisional enabled-camera batch assumption; no owner correction was
received by this worker.

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
shared reader, render source or binary was changed. Their ownership remains
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
   `Recovery/Before_ID_N.ztl`. Never save over the current project or another
   Tool file. Verify existence, nonzero size and a readable 64-byte prefix;
   restore the Tool's original save path with `ToolSetPath`. Reserve a uniquely
   named sibling `.txt` recovery record. Report the backup path separately so
   a long summary cannot hide it.
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

The [ZScript command reference](https://help.maxon.net/zbr/en-us/Content/html/user-guide/customizing-zbrush/zscripting/command-reference/command-reference.html)
was checked for `ToolGetPath`/`ToolSetPath`, `SubToolGetID`, status bits,
`MemCreateFromFile` partial reads, raw integer memory access, file size and
`FileNameSetNext` clearing. New DLL calls use only the existing reviewed
`Version`, `FolderExists`, `MakeFolder` and `ChooseFolder` routes. No additional
binary or new DLL export contract was introduced.

## Verification

Run from the repository root:

```powershell
python "projects/zbrush-plugins/Plugin de zbrush/Development/build_id.py"
python "projects/zbrush-plugins/Plugin de zbrush/Development/test_id_export.py"
python -m py_compile "projects/zbrush-plugins/Plugin de zbrush/Development/build_id.py" "projects/zbrush-plugins/Plugin de zbrush/Development/test_id_export.py"
git diff --check
```

The generated source matches `compose()` exactly and embeds the shared reader's
SHA256 for traceability. The suite executes delivered routines with modeled
material/RGB/group mutations and actual temporary file IO; it does not merely
assert source strings. It covers 18 tests with additional subcases:

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
  wrong-Tool recovery guards and unavailable-Edit recovery guards.

Final results: 18 tests passed; Python compilation passed. The mock records a
fake ZTL and signature-bearing fake image payload, explicitly labeled as mocks.
These results **do not** establish native ZScript compilation, valid native ZTL
structure/reopening, decoded PNG dimensions or the appearance of any render.

## Integration required from the orchestrator

- Merge/review this owned scope, then rebuild after integrating the camera
  worker's new reader. This worktree's baseline is Camera Bank 3.1 / data v8.
  `build_id.py` derives the allocation/version from that camera source and fails
  on ambiguous allocation/version declarations or missing reader entry points.
  It does not carry a private name parser/schema. Slot occupancy/render flags,
  dimensions and active-slot header are the existing stable layout; review them
  if the new camera schema changes those fields. Re-run and adapt the tests to
  the integrated camera writer if its fixture setup API changes. Do not ship
  this baseline's old prepared-bank workflow as the final 3.2 camera behavior.
- Add `build_id.py` to the orchestrator-owned build pipeline. Stage the source
  under folder `Generate and Export ID`, basename `GenerateExportID`; compiled
  basename must also be `GenerateExportID`. Add the owned launcher/manifest/
  install/uninstall/README/Workspace integration there. Loader name is
  `Load Generate and Export ID`.
- Supply `GenerateExportIDData/ZFileUtils64.dll` from the existing reviewed
  installation source. Adjacent `ZFileUtils64.dll` and stock
  `ZBRUSH_ZSTARTUP/ZPlugs64/MacroData/ZFileUtils64.dll` are fallbacks. This commit
  includes no DLL or compiled ZSC.
- Confirm or correct the enabled-camera export assumption before release. The
  worker did not receive a correction and did not contact the owner separately.
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
2. Run the single button into a session containing another pass and an older
   recovery file. Check that both survive, only 01/10 get `ID.png`, decoded sizes
   match the stored cameras, all required parts show flat colored regions,
   textures/wire/floor do not obscure the pass and colors match across views.
   Check successful Colorize, original eyes/folder/Solo/view/lens/selection,
   global channel settings and Tool save path.
3. Open the pre-ID ZTL as separate recoverable test data, without replacing an
   unsaved owner Tool. Verify original groups, RGB, materials, masks, names,
   visibility and selection. **This native reopen check is required:** the
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
limited to 180 characters (chosen parent 160) for safe string/suffix storage;
there are at most 1000 SubTools and 9999 session/recovery candidates. The Tool
identity guard deliberately rejects changed names/order during an interrupted
action rather than writing old settings into a changed list. Per-polygon hiding,
layers, dynamic subdivision and unusual mesh types follow native operation
semantics and still need native QA. Document resizing inherits the shared
reader's existing canvas redraw behavior and does not snapshot arbitrary 2.5D
document content. No owner visual acceptance, live installation, release package
or compiled plugin is claimed by this worker.
