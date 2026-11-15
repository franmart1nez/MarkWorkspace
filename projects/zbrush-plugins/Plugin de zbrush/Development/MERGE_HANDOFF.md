# Camera Bank 3.2.0 - automatic name visibility

Store/update now records effective visibility and updates SubTool name identifiers
without a PREPARE TRANSFER button. Export writes the stored bank without requiring
Edit mode, a selected matching Tool, or the renaming library. Data remains v8
(**111,084 bytes**); see [DATA_FORMAT.md](DATA_FORMAT.md) for the complete schema.

## Normal workflow

1. Load the reviewed 3.2.0 Camera Bank source and the regenerated Render Capture
   source together. The orchestrator owns regeneration/integration of the latter.
   Store cameras on the original editable Tool. Identifiers appear automatically
   on the first store, and refresh on each store/update. Gray occupied cameras
   participate equally; UPDATE ACTIVE keeps their render flags.
2. Inspect framing, canvas/lens and visible geometry. Save the **ZTL/ZPR after
   the latest store/update**, then EXPORT BANK. For ZTL, keep the marked default
   basename and choose any folder; a changed basename must retain the first
   SubTool's complete current marker. ZPR allows an arbitrary project filename.
   Send both matching files. The plugin does not save or overwrite the model
   file for you.
3. Open that pair, import the bank, then reorder or perform supported native
   merges. Merge only parts with identical visibility in every occupied camera,
   including gray ones. Preserve one complete compatible `CB...G..._` source
   marker in each result; `Merged_` prefixes are supported.
4. Editing a bank after reordering/compatible merging remaps every occupied
   view before recording the edit and refreshing the names. Save/export a new
   matching pair. An older saved model must use its older matching bank.

## Identity and visibility contract

Human names may be duplicated or renamed while the marker remains intact.
Equal-visibility duplicates share a group; unequal-visibility duplicates receive
separate groups. Unknown/added/unmarked parts, missing identifiers, foreign or
stale identifiers, malformed identifiers and multiple markers are rejected.
There is no positional guess or automatic adoption of unknown geometry.

Native ZBrush 2023.2.1 ZTL Save As makes the filename stem the first SubTool's
name. A plain new basename can erase its marker, so it counts as renaming that
SubTool and must preserve the marker. The controller's safe-name probe confirmed
the marker survived saving with the marked ZTL stem and ToolSetPath restoration.
Keep that marked default stem for ordinary ZTL transfer, changing only the
folder, or use ZPR when the project needs an arbitrary filename. This preserves
the existing strict name-identity contract without adding a fallback.

A missing group needed by any occupied view is rejected unless a surviving
group has the same visibility across the remaining occupied cameras. Entirely
hidden classes may be deleted. Missing members within a surviving class cannot
be detected. A native result named only after a folder loses its identity: keep
or restore the compatible source marker before recall/update/render. The method
tracks visibility classes, not arbitrary geometric ancestry; incompatible merges
that discard source names are outside the contract.

Effective visibility includes individual eyes, parent folder eyes, Solo and the
active part. Recall disables Solo, selects a visible part, opens folder eyes and
sets effective per-part eyes. Folder-eye UI need not reproduce the original
arrangement. Render Capture restores starting Solo after its batch. Existing
transforms, sizes, lens settings and render selection remain independent.

## Older banks and recovery

V1-7 and untracked v8 have no persistent name/order evidence. On the original
unmerged Tool/order, recall and review each occupied camera, then UPDATE ACTIVE.
The last update completes tracking automatically. No extra preparation action is
required. Partial reviews are bound to the unchanged Tool/list in session memory;
a changed list blocks continuation. Import/export of an incomplete review starts
review again, rather than treating count equality as ancestry. An already merged
unmarked model cannot supply the missing old history. Older files may also need
canvas/lens corrections. Tracked v8 pairs import directly without re-review.

Store/update snapshots the bank, names, status, selection and view before editing.
Rename/truncation failures roll back; after Escape use a Camera Bank action on
the same unchanged Tool to recover. Rendering blocks while recovery is pending.
This is session recovery, not protection against application termination. Keep
original saved files. Never restart an active app just to apply this revision.

## Export diagnosis and limits

Frozen routines from baseline `1d3ebe2` reproduce export aborts in the mock host
for an unreviewed legacy bank and for Edit mode off. 3.1.0 made file writing depend
on live-Tool/preparation checks. These concrete source blockers are removed;
the owner's exact native failure is not yet observed or proven to have one of
these causes. The revised exporter writes all stored cameras through a normalized
copy and verifies exact length plus all float cells after reopening the file.

Cancellation and declined overwrite preserve data, names and pending recovery.
File errors or mismatched read-back do not claim success. Explicitly confirmed
replacements use a direct native write; on error that destination may be partial.
The in-memory bank remains available for retry to a new path. An untracked bank
can always be exported as a backup, but the success message states its ancestry
limit. Export never renames parts or silently saves the ZTL/ZPR.

## Source validation and native acceptance

Run from the repository root:

```powershell
python 'projects/zbrush-plugins/Plugin de zbrush/Development/build_all.py'
python 'projects/zbrush-plugins/Plugin de zbrush/Development/verify.py'
python 'projects/zbrush-plugins/Plugin de zbrush/Development/verify_merge.py'
python 'projects/zbrush-plugins/Plugin de zbrush/Development/verify_camera_320.py'
```

The first command regenerates Camera Bank, its shared reader, and a **local**
RenderCapture.txt for regression testing. This worker does not commit that render
file; the orchestrator regenerates it after source integration. See
[CAMERA_3.2.0_RESULT.md](CAMERA_3.2.0_RESULT.md) for actual results and delivery.
These are mock/source tests, not native compilation or rendered-image review.

After independent source review, the orchestrator should use a disposable saved
Tool under its exclusive ZBrush lease:

1. Load both integrated TXT sources in ZBrush 2023.2.1. Verify native compilation,
   DLL resolution, no preparation button and automatic verified name changes.
2. Store three views with different dimensions/lenses; make one gray. Include
   duplicate human names, hidden folders, Solo and a hidden active part. Recall,
   UPDATE ACTIVE on the gray camera, and compare framing and effective geometry.
3. Save a new ZTL with its marked basename (or ZPR with any project filename)
   and bank; reopen/import and compare all occupied cameras.
   Test export cancellation, a new writable path, confirmed overwrite and a
   failing path. Export with Edit off must still produce a usable 111,084-byte bank.
4. Reorder, MergeDown compatible parts, and probe actual MergeVisible/folder name
   retention/truncation. Compare all views, then update and save/reopen a fresh
   pair. Reject missing/mixed/foreign markers before canvas changes.
5. Run integrated NON BPR and BPR and compare visibility/framing and final Solo
   recovery. Probe Escape during first store, gray update and legacy partial
   review on a disposable Tool; verify same-Tool recovery and other-Tool rejection.
6. Import a copy of a real legacy bank on its original unmerged Tool. Complete
   all reviewed updates; verify tracking finishes automatically and export works
   before and after completion. Probe large real lists/name encodings separately.

Official references checked for source design: [Maxon command reference](https://help.maxon.net/zbr/en-us/Content/html/user-guide/customizing-zbrush/zscripting/command-reference/command-reference.html)
(`FileNameAsk`, `MemSaveToFile`, `MemReadString`) and
[ZFileUtils RenameSetNext](https://help.maxon.net/zbr/en-us/Content/html/user-guide/customizing-zbrush/zscripting/zfileutils/zfileutils.html).
Documentation and the mock host do not replace native acceptance.
