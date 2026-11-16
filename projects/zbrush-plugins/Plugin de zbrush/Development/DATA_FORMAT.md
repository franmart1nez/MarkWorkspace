# Camera Bank 3.2.1 / data v9

The bank is **30,772 single-precision float cells / 123,088 bytes**. Version 9
preserves the complete v8 prefix and appends a native SubTool ID table. All three
3.2.1 components share this reader. Older plugin binaries do not read v9 banks.

## Layout

| Cells | Contents |
| --- | --- |
| 0–2 | Magic 252523, version 9, camera count 25 |
| 3–6 | Clear mode, UI guard, active one-based camera, store mode |
| 7 | Identity mode: 0 untracked legacy, 1 visibility groups |
| 8–9 | Two six-digit bank/revision components |
| 10–19 | Reserved |
| 20 + slot × 20 | Camera record, for zero-based slots 0–24 |
| 520 + slot × 1001 | Original positional visibility count + up to 1000 statuses |
| 25545 + slot × 8 | Lens extension |
| 25745 | Visibility-group count |
| 25746 + (group−1) × 2 | Group visibility mask: low 13 bits, high 12 bits |
| 27746 + slot | Effective-visibility snapshot count |
| 27771 | Native-ID record count: 0–1000 |
| 27772 + record × 3 | Native ID low 16 bits, high 16 bits, one-based group |

Every ID half is an integer 0–65535. The all-zero ID is invalid. Splitting IDs
preserves unsigned 32-bit values without float rounding. Repeated IDs are
retained as separate records; they are not assumed unique. A zero record count
is allowed for a migrated old bank that has not yet been matched to its Tool.

Camera offsets are: 0 occupied; 1–9 MTransform; 10 perspective; 11 focal length;
12–14 zoom/pan; 15 focal UI type; 16 render flag; 17 click state; 18–19 canvas
width/height. Lens extensions store FOV, validity, universal camera, align,
automatic distance, crop factor and horizontal/vertical modes. Missing legacy
values stay unknown. Visibility bit 4 is the internal effective-visibility bit,
including eyes, folders, Solo and the active SubTool; it is not a native status.

## Names and the filename exception

Markers remain `CBaaaaaabbbbbbGgggg_`. Groups represent equal visibility in every
occupied camera, including gray cameras. Valid markers are authoritative after
reordering and compatible merges. Unknown parts, malformed or foreign markers,
and ambiguous ancestry are rejected. No list-position fallback is used.

ZBrush 2023.2.1 can replace the first SubTool name with the ZTL filename stem.
Version 9 accepts this one unmarked first SubTool only when its displayed name
matches the current Tool basename and its native ID has exactly one supported
visibility group. The resolver subtracts current, explicitly marked peers with
the same native ID from the saved ID/group inventory. Multiple residual groups,
excess peers or an unknown ID are rejected. It never guesses which duplicate
was renamed. Dots and spaces in the filename stem are preserved.

Recall, rendering and ID capture use this identity without renaming the first
SubTool. Store/update refreshes names and the ID table transactionally. A normal
new v9 bank/model pair can therefore use an arbitrary ZTL filename. Markers on
other SubTools must remain intact. Compatible merges still require equal
visibility and a retained marker; a result whose native ID is new must have its
ID inventory refreshed by store/update while the marker is intact before a
filename alias can be resolved.

## Older banks

The importer accepts 2080-byte v1–6, 102180-byte v3–6, 102980-byte v7 and
111084-byte v8 files, validates them before replacement, and allocates v9 data.
Tracked v8 names and visibility groups remain usable. When a tracked old bank
is imported on its matching, marked Tool in Edit mode, the new native-ID table
is attached automatically; export a new bank afterward. Import on an unrelated
Tool still succeeds without fabricating identity. If the first marker was
already lost and the old bank contains no IDs, use the matching marked ZTL/ZPR
once before migrating. The supplied case was migrated and tested on its original
arbitrarily named ZTL.

Untracked v1–8 banks still require reviewing/updating each occupied camera on
the original unmerged Tool/order. Counts alone do not establish ancestry. Partial
review is bound to the in-session Tool/list; import resets unbound ready bits.

## Transactions and export

Name edits snapshot names, IDs, statuses, selection, view and the complete bank.
Rename failures roll back. Old pending snapshots copy their actual byte length
before startup migration, rather than reading beyond a v8 snapshot. Escape
recovery remains session-bound and does not survive an application termination.

Export remains independent of Edit mode and the current Tool. It writes a copy,
normalizes UI modes/click states in that copy and verifies all 30,772 cells after
read-back. Cancel/declined overwrite preserves in-memory data. A failed confirmed
replacement may leave a partial destination; keep original bank files separately.

Native checks cover ZBrush 2023.2.1. Larger IDs and repeated-ID ambiguity are
covered offline; the native Duplicate fixture produced distinct IDs. Other host
versions and every possible merge/history combination are not certified.
