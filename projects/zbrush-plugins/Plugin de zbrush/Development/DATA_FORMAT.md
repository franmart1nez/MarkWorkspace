# Camera Bank 3.2.0 / data v8

The binary schema is unchanged: `CB25Data` has **27,771 single-precision float
cells / 111,084 bytes**, saved with native `MemSaveToFile`. No new ancestry field
is inferred. Existing tracked v8 pairs remain readable; v1-7 and untracked v8
banks follow the migration rules below. Pre-v8 readers cannot read this data.

## Header and camera records

| Cell | Value |
| --- | --- |
| 0 | Magic 252523 |
| 1 | Data version 8 |
| 2 | Camera count 25 |
| 3-6 | Clear mode, UI guard, active one-based camera, store mode |
| 7 | Identifier mode: 0 untracked positional legacy, 1 visibility groups |
| 8-9 | Two integer six-digit bank/revision nonce components, 100000-999999 |
| 10-19 | Reserved |

Camera s (0-24) begins at `20+s*20`: offset 0 occupied; 1-9 MTransform;
10 perspective; 11 focal length; 12-14 zoom/pan; 15 focal UI type; 16 render
flag; 17 click state; 18-19 document width/height. The lens extension remains
at `25545+s*8`: explicit FOV, validity, universal camera, align, automatic
distance, crop factor, horizontal and vertical modes. Unknown legacy dimensions
stay zero; unknown camera mode flags stay -1. Updating an occupied camera keeps
its render flag, including gray cameras.

The positional slice at `520+s*1001` contains the count followed by up to 1000
status values. Bits 0/1 preserve individual/folder eye snapshots; bit 2 (4)
records effective visibility, including folder eyes, Solo and the always-visible
active SubTool. This internal bit is never passed to native SubTool status.
`27746+s` contains the effective snapshot count; zero means unreviewed/unknown.
Tracked recall ignores positional count/order and uses the names/group masks.

## Persistent identity and compatible merges

Cell 25745 is the group count (1-1000 when tracked). One-based group g has two
masks at `25746+(g-1)*2`: low 13 camera bits (0-8191) and high 12 bits (0-4095).
These integer halves are exactly representable as single-precision floats.
Every **occupied** camera participates, regardless of its render flag.

The 20-character name marker is `CBaaaaaabbbbbbGgggg_`: two bank components and
a zero-padded group number. The remaining human name is retained. Parts in one
group have identical effective visibility across all occupied cameras.

- Duplicate human names are supported: differing visibility produces differing
  markers; identical visibility may share a marker. Mesh IDs are not persistent
  visibility identity and duplicated native IDs do not alias groups.
- Reordering is supported immediately after the first successful store. A human
  rename is supported if its complete marker survives. Removing the marker is an
  unknown identity, even if the human name still matches another part.
- Unmarked additions, foreign/stale markers, malformed markers and multiple
  marker candidates (including mixed-bank names) are rejected before recall or
  update. There is no position fallback or guessed visibility for an addition.
  Restore the matching Tool/marker, or start a fresh bank for a different model.
- Native merges require equal visibility in **all occupied cameras**, including
  gray ones, and a single compatible source marker in the resulting name.
  Prefixes such as `Merged_` are accepted. Folder-derived names that discard the
  marker require restoring that compatible source marker. Geometry is never
  merged or modified by Camera Bank.
- Missing groups visible in any remaining camera are rejected unless a surviving
  group is equivalent after cleared-camera bits are masked out. Entirely hidden
  groups may disappear. Deleting one part of a shared group cannot be detected
  while another member survives. A retained marker proves a visibility class,
  not geometric ancestry or completeness. Arbitrary incompatible native merges
  cannot be reconstructed after source names have been discarded.

## Automatic capture and atomic updates

There is no transfer-preparation button. Store/update records effective
visibility and refreshes markers automatically. On a tracked Tool, all existing
views are first remapped by surviving markers to the current SubTools. The edit
is then captured and all occupied views regrouped. A new nonce pair is generated
on every successful store/update. Save the matching **ZTL/ZPR after the latest
edit**, then export its bank; older saved model/bank pairs remain separate.

Names are verified after each rename before committing the staged bank. The
20-character marker plus human name is limited to 255 characters (235 for the
human name); native truncation is treated as failure with rollback. Native name
limits/encoding still need acceptance on ZBrush 2023.2.1.

## Import, legacy review and export

Legacy byte sizes 2080 (v1-6), 102180 (v3-6), 102980 (v7), and 111084 (v8)
are validated before replacing live data. V8 validates identifier mode, nonce
components, group count, mask ranges and effective-ready counts. Known v7
canvas/lens fields are retained; absent fields remain unknown.

V1-7 contain no persistent name ancestry. Untracked v8 contains effective bits
but no persistent name/order mapping. Import resets their effective-ready
counts to zero. Recall explicitly asks the user to confirm the ORIGINAL unmerged
Tool/order when there is no session binding; equal counts alone are not identity
proof. Review and UPDATE ACTIVE for every occupied view. Automatic tracking
finishes after the last review, without another button. A partial review is
bound in session memory to Tool index, ordered names and mesh IDs; observed
changes block further positional recall/update. Indistinguishable duplicate
names/IDs still cannot prove an old order. The original unchanged Tool remains
a migration precondition. Export/import or losing the session requires restarting
an incomplete review; unbound ready bits are also reset on source reload.

Export is independent of the currently selected Tool, Edit mode, name validity
and Rename DLL. It serializes a copy, normalizing UI modes/click states only in
that copy, and includes all occupied cameras and render flags. An untracked bank
can be exported as an honest backup, with an explicit untracked warning.
Cancellation (also during pending recovery) and declining overwrite leave memory
and names unchanged. Existing destinations require explicit confirmation.
Success requires the exact write length and a full float-cell read-back match.
Write/read/mismatch errors retain cameras in memory and report that the selected
destination may be incomplete. A confirmed replacement is a direct native write,
not an atomic filesystem rename; keep a separate original bank when needed.

## Session recovery and generated reader

`CB32OriginalBank`, `CB32OldNames`, `CB32RenameState`, `CB32Stage` and
`CB32NewGroups` hold the update transaction. Snapshot-incomplete, rollback and
committed-cleanup phases remain distinct. New transaction state has one extra
session-only cell for the previous legacy-binding flag; pending 3.1 snapshots
remain recoverable. `CB32LegacyNames` / `CB32LegacyState` hold partial review
identity, `CB32ReadView` preserves the view during name reads, and `CB32Export` /
`CB32ExportCheck` are disposable export buffers. None are written into the bank.

Handled failures restore names, statuses, selection, view and bank on the same
unchanged Tool. Interrupted edits block the renderer until a Camera Bank action
recovers them. Recovery does not survive process termination. The private shared
reader is generated from the same camera routines and does not rename SubTools
or toggle camera render flags. Render roots/recovery remain `RC30Root` and
`RC30Recovery` (starting Solo in cell 16). No runtime state is written into the
installation directory.
