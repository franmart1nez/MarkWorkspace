# Camera Bank 3.2.0 worker result

Automatic effective-visibility tracking and independent, read-back-verified bank
export are implemented in editable source. PREPARE TRANSFER is removed. The first
successful store creates name identifiers, and store/update refreshes them while
remapping every occupied camera, including gray cameras. Data stays **v8 /
27,771 floats / 111,084 bytes**. No ZSC, installation or native validation is
included in this delivery.

Source baseline: `1d3ebe2`; worktree branch:
`mrmak/zbrush-camera-bank-3-2-6447df`. Coordination-only commits were already on
the assigned branch. No merge, rebase, push, worker launch or application control
was performed. The orchestrator retains exclusive ZBrush ownership.

## Delivered paths

All paths below are relative to `projects/zbrush-plugins/Plugin de zbrush/`:

- `Camera Bank/CameraBank25.txt`
- `Development/build_camera.py`
- `Development/build_visibility.py`
- `Development/camera_reader.inc`
- `Development/merge_visibility.inc`
- `Development/merge_visibility_writer.inc`
- `Development/verify.py`
- `Development/verify_merge.py`
- `Development/verify_camera_320.py`
- `Development/tests/fixtures/camera_310_export.inc`
- `Development/DATA_FORMAT.md`
- `Development/MERGE_HANDOFF.md`
- `Development/CAMERA_3.2.0_RESULT.md`

The frozen fixture contains verbatim baseline export/preparation routines only
for offline regression. It is not a plugin entry point. Generated
`Render Capture/RenderCapture.txt` was used locally for tests and excluded from
the commit. README files, render_body, build_all, installers, launchers, manifest
and Workspace files remain outside this worker's changes.

## Actual verification

After integrating the reviewed Render Capture 3.2.0 body, run from the package's
`Development` directory:

```powershell
python build_all.py
python -m unittest -v verify verify_merge verify_camera_320
```

Current worker result: **51 tests passed in 55.151 seconds** (Python 3.14,
Windows): 16 existing camera/renderer regressions, 16 adapted merge/recovery
regressions and 19 camera 3.2 regressions. Earlier deliveries passed 47 tests,
then 49 after adding literal-limit and generated-routine ordering checks. Temporary
bank files are actual binary files written/read by the mock host; image exports
and native operations are mocked.

This isolated worktree does not merge/rebase the render branch. For the actual
follow-up run, only the locally generated RenderCapture.txt combined this
worktree's shared reader with `Development/render_body.txt` from reviewed render
commit `f7c0702`. The render body SHA256 was
`4389542f17abd8a4a91d0f6a305cc1633251c20b68e590b8173d4e528408e08e`.
To reproduce that source-only integration without changing render_body.txt, use
these commands from `Development` instead of `build_all.py`, then run the same
unittest command above:

```powershell
python build_camera.py
@'
from pathlib import Path
import subprocess
body = subprocess.check_output([
    'git', 'show',
    'f7c0702:projects/zbrush-plugins/Plugin de zbrush/Development/render_body.txt'
])
root = Path('..')
reader = Path('camera_reader.inc').read_bytes()
(root/'Render Capture/RenderCapture.txt').write_bytes(reader + b'\n\n' + body)
'@ | python -
```

The legacy render body still on this isolated branch uses the former NonBPR
subfolder. The updated screenshot regression intentionally requires the unified
3.2.0 location `<camera>/Z document.png`, so use the integrated render body for
the full suite. RenderCapture.txt remains excluded from this worker's commit.

Coverage includes first-store automatic identifiers, same/different-visibility
duplicate names, reorder, native duplicate IDs, human rename versus missing or
mixed/foreign/malformed markers, added/deleted parts, compatible merge transfer,
all 25 mask bits and occupied-camera file round trips including gray cameras,
canvas/lens/transforms, gray UPDATE ACTIVE, folders/Solo/active hidden parts,
1,000 duplicate-named SubTools and the 1,001 capacity rejection, v1-7 sizes and
known-field migration, partial review order guards, malformed v8 metadata,
rename failure, Escape during snapshot/edit/commit/legacy binding, pending
recovery cancellation, real export bytes, declined/accepted replacement, short
writes, missing files, read errors and corrupt read-back. The generated reader's
routines are compared with Camera Bank's corresponding routines.

A frozen 3.1.0 source regression reproduces three export blockers: unreviewed
legacy snapshots, Edit mode off, and a missing rename DLL on an unprepared bank.
The 3.2 exporter writes those same stored banks without those dependencies.
The exact failure in the owner's native session remains unobserved; these source
reproductions do not establish its sole cause.

## Follow-up source review corrections

The untracked-import message was shortened from 279 to **231 characters**.
A complete scan of 1,400 quoted literals across 10 current text/include inputs,
generated sources and test-fixture files found a maximum of **242 characters**.
Archived installed Recovery copies are excluded. The new regression enforces
[Maxon's documented 255-character string limit](https://help.maxon.net/zbr/en-us/Content/html/user-guide/customizing-zbrush/zscripting/technical/technical.html).
No other oversized literal was found.

The recovery-injection loop already excluded import/export in delivered commit
`531b5fe`. The follow-up documents that exception and adds a final generated-source
ordering assertion: FileNameAsk, cancellation and overwrite approval precede
CB32_Recover. The interrupted-rename test now checks declined replacement as well
as cancelled export/import, preserving every session-memory block, names and the
existing bank file. All checks pass against the regenerated final source.

This correction changes only CameraBank25.txt, build_visibility.py, verify.py,
verify_camera_320.py and this result document. No native lease was granted or
used; native acceptance constraints and schema remain unchanged.

## Native-blocker source correction

The controller supplied native diagnostic evidence; this worker only read the
scratch scripts, trace and memory dumps. No native lease or UI control was used.
The first-store transaction had a valid empty bank, complete transform/status
snapshot and phase 0, but both name slots were empty. A minimal nested name-loop
probe then stopped immediately before the If condition containing StrToAsc.
Assigning the same ASCII result with VarSet before comparing its numeric local
completed the controller's two-SubTool probe. This rules out MTransformSet as the
cause of that original stop: view restoration had not been reached.

The correction precomputes ASCII scalars at all five direct StrToAsc condition
sites in CB32_ReadName, CB32_ParseTag and CB32_StripTag. The shared reader and
Camera Bank were regenerated. Name extraction, tag matching, data schema,
transactions and geometry behavior are otherwise unchanged. Native scopes remain
routine-local for these temporary numbers; persistent outputs still use the
existing explicitly declared globals or memory blocks.

The controller's next candidate reached identifier formatting and reported
Insufficient inputs for the historical one-input StrMerge used to format the
group number. The writer now adds 10000 in a numeric local, then uses
`[StrMerge,"",cbGroupValue]` to convert it. A direct compound arithmetic input
had produced G0000 in the native candidate; the numeric scalar candidate produced
valid groups. The mock now rejects StrMerge calls outside the documented 2..12
input range. The scan checked 142 calls total, including 140 production/input
calls with valid arity. The frozen 3.1 fixture retains its original invalid call
as historical source; it is never loaded natively.

New offline regressions explicitly inject the observed direct-ASCII-condition
stop and G0000 conversion symptom, rather than pretending that the mock is a
native interpreter. They verify incomplete-snapshot recovery, first store,
identifier refresh, recall, valid zero-padded groups, arity limits, empty names
and trailing-period handling. A scan of generated If conditions prevents direct
StrToAsc expressions from returning in either reader. The complete 51-test suite
passed with the same reviewed render body and reproduction commands above.

This correction changes these owned paths only:

- `Camera Bank/CameraBank25.txt`
- `Development/camera_reader.inc`
- `Development/merge_visibility.inc`
- `Development/merge_visibility_writer.inc`
- `Development/verify.py`
- `Development/verify_camera_320.py`
- `Development/CAMERA_3.2.0_RESULT.md`

Controller evidence confirms its equivalent scratch candidate completed three
stores and two pre-reorder PNG captures at 640x480 and 480x640. That is controller
probe evidence, not full native acceptance of this worker source. The controller
reviewed and merged `afeb8a1` and rebuilt all three sources. Its subsequent
safe-name native Save As probe resolved the name-preservation route described
below; actual reorder, merge and render testing remains under the controller's
exclusive lease.

## Native ZTL save-name clarification

In ZBrush 2023.2.1, ZTL Save As uses the filename stem as the first SubTool's
name. Saving to an unrelated basename removes that SubTool's marker and recall
correctly refuses the unknown identity. Keep the default marked ZTL basename and
choose any folder. A changed ZTL basename counts as renaming the first SubTool
and must retain its complete current `CB...G..._` marker. Use ZPR for an arbitrary
project filename.

The controller's safe-name native probe confirmed the marker was retained before
and after saving with the marked ZTL stem, and after ToolSetPath restoration.
This establishes the supported save-name route; it does not establish completion
of all save/reopen, reorder, compatible merge or rendering acceptance checks.
This worker only read the controller's probe evidence and did not control UI.

The clarification changes only `Development/DATA_FORMAT.md`,
`Development/MERGE_HANDOFF.md` and this report. No runtime code, data schema,
identity matching or positional fallback was changed. Documentation diff and
scope checks were performed; the prior 51-test source result remains the latest
worker test run, without a redundant rerun for this documentation-only edit.

## Limits and integration requirements

- Identity is a surviving name marker for a visibility class, not arbitrary
  geometric ancestry. Merge only equal-visibility parts across ALL occupied
  cameras. Keep one compatible marker in native results. Missing members of a
  surviving group or an incompatible merge that discarded names cannot always
  be detected. Unknown additions/marker removal block recall/update; no position
  fallback or automatic visibility assignment is used.
- V1-7 and untracked v8 cannot acquire missing ancestry automatically. Review
  each camera on the original unmerged Tool/order and UPDATE ACTIVE. The last
  reviewed update enables tracking automatically. Incomplete review is session
  bound; importing it resets reviewed counts. Indistinguishable old names/IDs
  cannot prove a historic order.
- The 20-character markers rename in-memory SubTools. Save a new matching
  ZTL/ZPR after the latest store/update and export its bank. Keep the marked ZTL
  basename (any folder), preserve its marker if renaming, or use an arbitrary ZPR
  project filename. The plugin never saves or overwrites original model files. Long/truncated names fail with
  rollback; real 2023.2.1 name limits, encoding and large-scene latency need probes.
- Export cancellation and declined replacement preserve memory and names.
  Confirmed replacement is a direct native file write. If writing/verification
  fails, the destination can be incomplete; the in-memory cameras remain for
  retry. Session recovery cannot survive application termination.
- The orchestrator must regenerate RenderCapture.txt with the shared reader
  after integrating source, reconcile its render worker changes, update package
  metadata/README/Workspace as appropriate, and perform native acceptance before
  claiming a compiled or installed 3.2.0 release. No active app was restarted.

## Short native acceptance sequence

After independent source review, under the orchestrator's exclusive lease:

1. Compile/load both integrated TXT sources on a saved disposable Tool; check
   DLL resolution, automatic markers and absence of the preparation button.
2. Store three differently framed/lensed views, one gray, with duplicate names,
   hidden folders, Solo and a hidden active part. Update gray; save/reopen the
   matching model/bank and compare framing and visible geometry in all views.
3. Reorder and perform compatible MergeDown/MergeVisible; inspect real name
   retention/truncation, update again and verify a new saved pair. Reject unknown,
   foreign/multiple/missing markers before recall/render side effects.
4. Export on a new path with Edit off; test cancellation, replacement and a
   failing path. Probe Escape/recovery and real legacy review on copies. Run
   integrated NON BPR/BPR and compare images plus final Solo/display recovery.

Full contracts and the longer acceptance sequence are in
[DATA_FORMAT.md](DATA_FORMAT.md) and [MERGE_HANDOFF.md](MERGE_HANDOFF.md).
Worker source delivery, orchestrator review, native verification and owner
acceptance remain separate milestones.
