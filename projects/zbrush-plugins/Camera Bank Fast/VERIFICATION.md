# Camera Bank Fast 0.3 - VWS activation and bulk controls

New VWS cameras import with Render ON. The two full-width controls above the numbered slots set Render OFF or ON for every stored camera. The release compiled and installed in ZBrush 2023.2.1.

The public IMPORT VWS button added all eight client views as orange slots 09–16. The earlier eight camera records and render flags were preserved. The public Spanish buttons changed the bank from eight enabled cameras to zero and then to sixteen. All nine empty slots stayed disabled. Bank samples show that both buttons changed only the stored Render flags. The viewport transform matched across both clicks and the pretest bank was restored byte for byte.

The standalone suite covers button order, bulk activation, empty slots and VWS defaults. The consumer suite verifies that Render and ID can process newly imported views and honor both bulk actions through the existing reader. The shipped reader body matches the adapter built from Fast 0.3.

## Fast 0.2 native VWS import baseline

Fast 0.2 adds **IMPORT VWS**. It reads the native 320-byte ZAppLink layout, validates all occupied records and appends the complete set to free slots. Native order is Front, Back, Rght, Left, Top, Botm, Cust1, Cust2. Empty views are skipped. Insufficient capacity rejects the entire set. Positions and all scale components are converted from the native normalized representation; rotations are retained. The current document, lens, zoom/pan and effective visibility supply the missing defaults. Imported cameras start gray (Render OFF). They are regular editable/exportable v9 Fast cameras.

One existing recoverable writer transaction covers all imported cameras and initial name binding. The importer does not call ZAppLink, modify its views or infer a focal length from a filename. The Fast schema and consumer recall routines are unchanged. Render/ID sources were rebuilt against the current Fast reference and independently compiled; their changed provenance comment does not introduce a new render pipeline.



See the consumer package `Development/VERIFICATION_3.2.6.md` for the complete cross-package acceptance.

## Current acceptance

90 automated tests passed across both packages (22 standalone Fast, 68 consumer/installer/identity). Native ZBrush 2023.2.1 compiled the exact final Fast source; the public IMPORT VWS action imported all eight supplied views and appended a repeated set without replacing existing cameras. Stored normalized coordinates/scales agree within float32 rounding. Public 01/08 recall passed. Native ZAppLink save fixtures independently verified coordinate/scale normalization. Imported cameras start gray and use current lens/canvas/visibility defaults. No client model or VWS data is included. The original Fast bank was restored byte for byte; recorded canvas/lens/zoom/pan were restored. Native MTransform recall has the small rotation-Z quantization described in the cross-package record.

## Historical Fast 0.1 baseline

# Camera Bank Fast 0.1 verification

This is a separate experimental variant requested for a Camera Bank-only client with 100-300 SubTools. The standard Camera Bank and the 3.2.4 Render/ID sources and binaries are unchanged by this variant.

## Design and compatibility

Initial registration assigns one stable marker per mesh. Ordinary saves update group masks in the existing v9 data block without renaming meshes. A cached binding checks the Tool index, count, bank identity and exact ordered native IDs, stored as two 16-bit halves. It reads names again after structural changes, imports and explicit rescans. Duplicated native IDs receive additional name checks when their visibility/membership could be confused.

The same 25 slots, lens/canvas/transform data, camera flags, effective eyes, import/export and compatible-merge rules remain. Removing all iteration is impossible: capturing visibility requires reading the relevant eyes, and applying it requires updating them. The optimization avoids activating every mesh for ordinary identity checks and saves.

The name-validation timing differs: a name-only change to an unselected uniquely identified mesh can remain cached. RESCAN MODEL performs a complete name validation. This is explicitly disclosed in README.txt and is why the standard plugin was preserved. Unknown ancestry and non-equivalent missing visible groups remain errors after rebinding. Use one writer per Tool because both variants use CB markers on the model.

## Automated execution

14 standalone tests passed in 20.405 seconds. They execute the generated Fast routines in the existing ZScript host and cover 100/300 parts, all 25 views, gray flags, folders, canvas/lens state, native-ID duplicates and same-ID reorder, compatible/incompatible merges, large native IDs, interrupted initial/ordinary saves and interrupted cache publication, same-bank import, arbitrary-filename alias recovery (including duplicated IDs), Tool switching and standard/Fast isolation. The public slot callback test also preserves recall and repeated-click render toggles while removing timed notices. A fixture installer/uninstaller test checks repeat installation, backup/removal and preservation of unrelated plugins/banks.

For distinct IDs after initial setup, measured command counts were:

| Parts | Standard save selections / renames | Fast save selections / renames | Standard recall selections | Fast recall selections |
|---|---:|---:|---:|---:|
| 100 | 303 / 100 | 0 / 0 | 102 | 1 |
| 300 | 903 / 300 | 0 / 0 | 302 | 1 |

These counts are mock-host instrumentation of real source, not native timings.

## Native ZBrush 2023.2.1

The release source compiled natively. Separate private Tools with 100 and 300 independently imported tetrahedra were created without replacing the active owner Tool/project. Their native IDs were verified distinct. A test callback appended to an exact release-source copy ran initial registration, a second camera save, ten alternating recalls and eye checks. Native runtime-clock measurements were:

| Parts | Initial registration, once | Routine second save | Mean recall routine, ten switches |
|---|---:|---:|---:|
| 100 | 10.927 s | 0.025 s | 0.731 s |
| 300 | 33.405 s | 0.113 s | 2.057 s |

Both fixtures returned zero visibility mismatches. A real compatible MergeDown reduced the 300-part Tool to 299 parts; both existing cameras still matched their expected eyes before and after storing a new post-merge camera. The first post-merge save rebuilt markers once, as designed. Timings apply to these lightweight fixtures and this machine; production geometry and redraw costs can increase them. Ordinary save and public recall/render-flag notices are nonblocking. The public 01/02 controls were also clicked on the 299-part fixture and their resulting active-camera/eye records were verified. No full native timing comparison against the original plugin is claimed; the selection/rename comparison is instrumented source execution.

Runtime scripts, fixture OBJ files, owner/session metadata and raw timings stay ignored under .cache/zbrush-fast/. No owner model, camera bank or private path is bundled. No application restart or paid generation was used.

The final native binary was installed and hot-loaded without restarting ZBrush. Installation hashes match the compiled release receipt, and the standard Camera/Render/ID installation hashes are unchanged. The original Tool, selected SubTool, canvas, transform, zoom/pan and recorded LightBox/thumbnail/Solo/camera-lock settings were restored and verified. The standard camera bank before/after files are byte-identical. Fast's temporary test bank was reset to empty.
