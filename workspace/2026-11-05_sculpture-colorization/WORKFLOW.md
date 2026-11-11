# Production workflow

Revision: **2026-11-08**. This workflow applies to every new sculpture.

## Reference hierarchy and intake

The user supplies **Composite 01 already finished**. It is the highest authority
for colors, materials, finish, contrast, lighting and shadows for the same
sculpture. Record its exact file, SHA-256 and a viewable preview at intake. It is
a read-only reference; production begins with the remaining views.

The only appearance references are that finished Composite 01 and the shared
client-approved quality examples in `shared/approved-client-work/`. Shared
examples guide realism, texture fidelity and material separation. When their
appearance differs, Composite 01 takes priority. Separate palette images are
not inputs.

Each target view's own original PSD controls identity, anatomy, geometry,
silhouette, sculpted detail, pose, camera, framing, background and exact part
placement. These source PSDs and their Mask/ID passes are structural inputs,
not additional appearance references. Preserve original files and hashes.

Create/select a user-named sculpture with `scripts/new_sculpture.py`. Place the
finished master in `inputs/reference-composite-01/` and all remaining original
view folders in `inputs/composites-psd/`. An intake commonly has 10-15 remaining
views; inventory the actual supplied set rather than assuming its count or IDs.
Do not generate, recolor or assemble Composite 01, or wait for a newly generated
01 to be approved. Resolve missing or ambiguous master files before generation.

## Direct crop production for all remaining views

1. Inspect the finished master, shared quality examples and each target source.
   Read native canvas size, depth/profile, source hashes and available masks.
   Export faithful source previews without changing the original PSDs.
2. Plan crops **directly from each original target composite**, before any image
   generation. Use fewer crops for smaller/closer views and more for larger
   views. Keep the count as low as useful: one crop may cover a small view;
   start around 2-4 for medium views and 4-6 for large views, adjusting for actual
   dimensions and dense detail. These are guides, not quotas. Combine adjacent
   regions where detail remains readable; avoid cutting through faces or focal
   features when a small boundary change helps.
3. Cover every region needing colorization with the planned source crops.
   Retain enough context and overlap for joining, normally 96-192 source pixels.
   Record exact source/paste rectangles on the original canvas, overlap, hashes,
   masks, reference roles and the crop-count rationale. The helper
   `projects/sculpture-colorization/scripts/prepare_crops.py` creates a size-based starting plan and source PNGs;
   inspect its seams and merge/reposition regions before generation if useful.
4. Generate the planned crops from their own original source regions. Supply
   the finished Composite 01 as appearance master and relevant shared quality
   examples. Do not generate a preliminary full view to discover repair areas.
   A one-crop small view is a planned production crop, not a prerequisite draft.
5. Review every generated crop against its matching original for shape, exact
   landmarks, sculpted detail and missing/invented forms. Compare appearance
   against finished 01 and adjacent crops. Keep rejected takes and reasons;
   regenerate only failing crops. Record selected versions and review evidence.
6. Complete and review **all required generated crops for all supplied target
   views** before entering the Photoshop assembly stage. Extracted source crops
   alone do not satisfy this gate. Maintain one batch manifest with each view,
   required crop IDs, selected outputs, review state and assembly state.

## Photoshop montage, one view at a time

When the entire batch of generated crops passes review, tell the user the crops
for all target views are ready. Ask them to open **Photoshop**, preferably with
the intended first source composite, if it is closed. Wait for readiness. If
Photoshop is already open, inspect it read-only and continue; do not ask again.
Do not launch it automatically during crop preparation or MCP discovery.

Use **Photoshop only** for native assembly. Follow [Photoshop connection](PHOTOSHOP_CONNECTION.md).
Verify the live connection, document path/ID, dimensions, profile/depth and the
intended target before editing. Work on a versioned copy. Assemble each view's
reviewed crops on that view's original canvas with named layers and editable
source-derived masks; retain a hidden source reference layer and source passes.

Assembly covers placement, proportion-preserving size reconciliation, masks,
edge joins and shape verification. No manual color/lighting adjustments,
repainting, warping, relighting or grading are part of assembly. Return a failed
crop to generation rather than concealing geometry errors in the montage.

Finish, save and verify one view before moving to the next. Deliver a layered
PSD (PSB when size requires it) plus a review PNG. Reopen the actual saved file
in Photoshop and verify layers, masks, dimensions and its render. Record measured
differences; file existence alone does not prove fidelity. Distinguish agent
review from the user's final acceptance of each target view.

## Production records and scope

Use [generation policy](../../projects/sculpture-colorization/GENERATION_POLICY.md) for provider, highest available quality and budget.
Configuration work does not authorize generations. Keep prompts, source and
reference hashes, requested/actual settings, native output dimensions, versions,
crop plans, batch progress and QA with the selected sculpture. Keep private job
receipts, signed URLs and session state in ignored `.mrmak/` storage. Resolve
existing jobs after timeouts before replacement. Never restart an application
or interrupt an active agent session to apply configuration.
