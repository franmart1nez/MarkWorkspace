# Camera Bank data v8

`CB25Data` contains 27,771 single-precision float cells (111,084 bytes), exported
as a native memory block by MemSaveToFile. Versions 1-7 remain importable through
explicit migration. Version 8 is not readable by earlier plugin releases.

## Header

| Cell | Value |
|---|---|
| 0 | Magic 252523 |
| 1 | Data version 8 |
| 2 | Camera count 25 |
| 3-6 | Existing clear mode, UI guard, active one-based camera, store mode |
| 7 | Prepared/identifier mode: 0 positional, 1 visibility groups |
| 8-9 | Two six-digit bank/revision nonce components, 100000-999999 |
| 10-19 | Reserved |

## Existing camera and lens data

Camera s (0-24) begins at `20+s*20`. Offsets 0 occupied; 1-9 MTransform;
10 perspective; 11 focal length; 12-14 zoom/pan; 15 focal UI type;
16 render-enabled; 17 click state; 18-19 document width/height.
The v7 lens extension remains at `25545+s*8`: explicit FOV, validity, universal
camera, align, automatic distance, crop factor, horizontal and vertical modes.

The positional visibility slice remains at `520+s*1001`: original count followed
by up to 1000 status values. Bits 0/1 retain the old SubTool/folder eye snapshot.
Newly captured v8 values also use bit 2 (4) for effective visibility, accounting
for folder eyes, Solo and the active SubTool. This internal bit is never passed
as a new native SubTool status flag. Cell `27746+s` records the snapshot's count;
0 means unknown legacy effective visibility. Prepared recall ignores positional
counts/order, using the surviving names and group masks instead.

## Groups and name markers

Cell 25745 is the group count (1-1000 when prepared). Group g (one-based) has
two masks at `25746+(g-1)*2`: low 13 camera bits (0-8191) and high 12 bits
(0-4095). Split masks stay exactly representable in single-precision storage.
An occupied camera is visible for a group when its bit is set. Render selection
does not affect grouping: gray occupied cameras also participate.

The 20-character name marker is `CBaaaaaabbbbbbGgggg_`, containing the two bank
components and the zero-padded group number. The remaining human name is retained.
All parts with a group have identical visibility across all occupied cameras.
Markers can occur after native naming prefixes such as `Merged_`. Unknown,
malformed, ambiguous and foreign markers are rejected; index fallback is disabled
for prepared banks. A group visible in any occupied view must be represented,
or have a represented group equivalent after cleared-camera bits are ignored.

Preparation commits bank/group data only after verified renaming. Editing an
already prepared bank first rebases every occupied view to the current list,
then records the edit and prepares new groups/nonce values. The user must save
both the matching model and bank again after such edits.

## Migration and recovery

Legacy sizes 2080 (v1-6), 102180 (v3-6) and 102980 (v7) are validated before
replacing live data. Known v7 dimensions/lens fields are retained. Earlier missing
dimensions/FOV remain unknown. All imported legacy effective-ready values and
prepared fields start at 0; every occupied view needs a reviewed UPDATE ACTIVE
on the original unmerged Tool before preparation. V8 import validates prepared
flags, bank components, group count, mask ranges and ready counts.

The renderer contains a generated private read-only copy of the camera/visibility
routines, so it does not click camera buttons or toggle their render flags.
Name editing is confined to Camera Bank. Its recovery blocks are session-only:
CB32OriginalBank, CB32OldNames, CB32RenameState, CB32Stage and CB32NewGroups.
The recovery phase distinguishes incomplete capture, rollback-capable edits and
committed cleanup. Names, statuses, selection and view are restored when possible
on the unchanged Tool; other Tools/changed lists are rejected. Read validation
also preserves the current view while iterating names.

Render output roots and display recovery remain in RC30Root / RC30Recovery.
The latter now also stores starting Solo in cell 16. No runtime state is written
to installation folders. See MERGE_HANDOFF.md for the actual verification limits.
