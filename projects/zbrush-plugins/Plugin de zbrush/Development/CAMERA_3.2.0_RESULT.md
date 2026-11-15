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

From the package's `Development` directory:

```powershell
python build_all.py
python -m unittest -v verify verify_merge verify_camera_320
```

Final result: **47 tests passed in 53.288 seconds** (Python 3.14, Windows):
16 existing camera/renderer regressions, 16 adapted merge/recovery regressions,
and 15 new camera 3.2 regressions. Temporary bank files are actual binary files
written/read by the mock host; image exports and native operations are mocked.

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
  ZTL/ZPR after the latest store/update and export its bank. The plugin never
  saves or overwrites original model files. Long/truncated names fail with
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
