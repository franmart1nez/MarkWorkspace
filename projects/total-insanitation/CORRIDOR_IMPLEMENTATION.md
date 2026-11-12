# Corridor asset implementation — N01–N07

**Worker delivery, 12 November 2026 · ACCEPTED by the orchestrator at review revision 6.**
Owner-accepted direction from `CORRIDOR_ASSET_HANDOFF.md`; this report covers mesh
production only. The orchestrator independently verified the saved meshes, the FBX set and
the native Unreal import. Owner aesthetic acceptance and final Basement placement remain
pending; Unreal review assets and Workspace registry tabs are orchestrator-owned. No
Unreal, registry, or unrelated project files were changed by this pass.

## Status by family

| ID | Status | Assets | Triangles | Notes |
| --- | --- | --- | --- | --- |
| N01 | **Done** | 8 | 5 508 | Two diameters (Ø22 cream, Ø14 dark iron), 400 straight, 385 corner, 100 infill, elbow, two couplers, triangular bracket, valve branch with red handwheel. |
| N02 | **Done** | 6 | 1 560 | Ø2.6 cm galvanized conduit, 400 straight, 385 corner, 100 infill, elbow, saddle clamp, shallow junction box. Run at Z 3.35 m, clear of the existing 4 m ceiling and light line. |
| N03 | **Done** | 1 | 1 602 | 82 × 17.6 × 101 cm cabinet, two doors, six hinges, four latches, analog meter, caution and data plates. |
| N04 | **Done** | 4 | 632 | EQUIPMENT (arrow), SERVICE, COLLECTION, DANGER HIGH VOLTAGE. New plates; the existing Pass 01 shop sign was not touched. |
| N05 | **Done** | 2 | 1 056 | Steel board, four-sided frame, two spring clips, two clipped papers, one standalone sheet variant. No cork or wood. |
| N06 | **Done** | 1 | 2 404 | Ø54.8 cm drum, 24.5 cm projection, six-turn coiled hose, free hose end into a clipped brass nozzle, crank and wall mount. |
| N07 | **Done** | 3 | 932 | Cream handled container, olive lidded case, gray open bin. |

Total 25 mesh objects, **13 694 triangles**. No LODs, no collision meshes, no lightmap
UV channel (consistent with the existing source assets).

Unresolved, stated plainly: reused slots `Metal_01`, `Plastic_01` and `Rubber_01` keep
their existing placeholder Principled values in the blend; final Unreal material
instances and any ORM authoring remain the orchestrator's import step. No new metal,
rust, concrete or rubber texture set was created (the proposal budgets none). The T01
atlas is the only new texture.

## Where the work lives

| Source | Collection | Contents |
| --- | --- | --- |
| `Assets/Building/Interior_Building.blend` | `Corridor_Production_20261112` → `N01_Pipe_Kit`, `N02_Conduit_Kit`, `N04_Sign_Variants` | 18 objects |
| `Assets/Enviroment_Assets/Enviroment_Assets.blend` | `Corridor_Production_20261112` → `N03_Electrical_Cabinet`, `N05_WorkOrder_Panel`, `N06_Hose_Reel`, `N07_Supply_Containers`, `T01_Graphics_Source` | 7 props + 21 font objects (atlas source) |

New assets are laid out on a review wall at Y = −200 m (building) and Y = −20 m (props),
clear of existing scene content. These library positions are **not** baked into the FBX
exports (see below). Each object keeps a unit scale, zero rotation and a documented
pivot.

Exact per-object dimensions, bounds, pivots, slots, UV layers and UV checks are in
**`corridor-assets.json`**. Highlights:

| Object | Dimensions (cm) | Pivot |
| --- | --- | --- |
| `SM_Corridor_Pipe_Pair_400` | 400.0 × 28.8 × 74.0 | module edge at wall base (0,0,0), Z from 2.50 |
| `SM_Corridor_Pipe_Pair_Corner_385` | 382.5 × 60.4 × 74.0 | module edge; 385 cm wall footprint, pipe surface stops 2.5 cm inside |
| `SM_Corridor_Pipe_Pair_Infill_100` | 100.0 × 26.1 × 74.0 | module edge |
| `SM_Corridor_Sign_Equipment` | 50.0 × 1.8 × 25.0 | back face, bottom edge centre |
| `SM_Corridor_ElectricalCabinet` | 82.0 × 17.6 × 101.0 | back face, bottom centre (hang at Z = 1.05) |
| `SM_Corridor_WorkOrder_Panel` | 62.0 × 2.9 × 45.6 | back face, mid-height centre |
| `SM_Corridor_HoseReel` | 54.8 × 24.5 × 63.8 | back face centre at drum axis (hang at Z = 1.42) |
| `SM_Corridor_Supply_Container` | 33.0 × 22.4 × 20.7 | bottom centre |

### Module and fitting allowances

- 400 cm assemblies span exactly 400 cm for straight runs; adjacent runs butt flush.
- 385 cm corner assemblies include the 90° bend inside the shortened wall footprint.
  Bend radius 28 cm (large pipe) keeps the outer surface at 382.5 cm, inside the 385 cm
  wall end and clear of the perpendicular wall face. The assembly returns 18 cm onto the
  perpendicular wall; the next straight module starts from that return, so no coupler
  duplicates at the corner.
- 100 cm infill carries one bracket and both pipes.
- 90° elbows are also delivered as standalone pieces; couplers are separate as well.
- Bottom clearance: big pipe underside 261 cm, small pipe 293 cm, conduit 334 cm — all
  above the 260 cm target and clear of the fluorescent light line.

## Materials, UVs and the T01 atlas

- New slots (both blends, same names): `Corridor_Enamel_Cream`, `Corridor_Enamel_Olive`,
  `Corridor_Iron_Dark`, `Corridor_Steel_Galvanized`, `Corridor_Valve_Red`,
  `Corridor_Brass`, `Corridor_Rubber_Charcoal`, `Corridor_Plastic_Gray`,
  `Corridor_Atlas_T01`. Base colours are authored in sRGB and converted to linear.
- Reused existing sources: `Metal_01` (conduit clamps and junction box), `Plastic_01`,
  `Rubber_01` where a neutral plastic/rubber family already existed.
- Texel density: structures 0.5 UV units/m (256 px/m at a 512 px texture); props
  1.0 UV units/m (512 px/m). Sign plaque faces and paper sheets map to fixed T01 cells
  at roughly 1 000 px/m so the lettering stays legible; this is a deliberate graphics-
  atlas exception, documented rather than applied to the tiling slots.
- **Zero collapsed UV faces** across all 25 objects, measured with a per-triangle signed
  UV-area test filtered by 3D area (threshold 1e-9). Smallest UV area is 1.25e-7. The
  earlier collapsed UVs came from reading a stale face normal before box projection;
  `_box_uv` now calls `f.normal_update()` first.
- `T01_Corridor_Graphics.png` is 1024×1024 sRGB, authored from the editable
  `T01_Graphics_Source` font objects plus numpy-drawn plates and shapes. Cells:
  EQUIPMENT, SERVICE, COLLECTION, DANGER HIGH VOLTAGE, meter dial, UTILITY WATER
  diamond, three paper forms, SUPPLIES, UTILITY and one blank enamel swatch.

## Delivery

Exports use **Super Duper Batch Exporter 2.9.3** with **`Unreal_Only_FBX`**, `$OBJ`,
Parent Objects, Visible, Apply Modifiers, Mesh only, Transform on Export off, Create LOD
off. No preset value was changed.

| Folder | Files |
| --- | --- |
| `Delivery/Basement/Corridor/Building/` | 18 FBX: 8 pipe kit, 6 conduit kit, 4 sign plaques |
| `Delivery/Basement/Corridor/Props/` | 7 FBX: cabinet, panel, sheet C, reel, container, case, bin |
| `Delivery/Basement/Corridor/Textures/` | `T01_Corridor_Graphics.png` (1024×1024) |

All exports place the asset at the **local origin**: only the new targets were moved to
(0,0,0) for the batch, then their exact library transforms were restored (receipts in
`.mrmak/total-insanitation/corridor-production/export-{building,props}.json`). Visibility
was isolated to the new meshes for the batch and restored afterwards; no unrelated
object was exported.

Reimport check (one real round trip, Blender 5.2 default FBX importer):

| File | Imported location | Dimensions (cm) |
| --- | --- | --- |
| `SM_Corridor_Pipe_Pair_400.fbx` | (0, 0, 0) | 400.0 × 28.8 × 74.0 |
| `SM_Corridor_ElectricalCabinet.fbx` | (0, 0, 0) | 82.0 × 17.6 × 101.0 |
| `SM_Corridor_Sign_Equipment.fbx` | (0, 0, 0) | 50.0 × 25.0 × 1.8 |

The `.001` suffixes seen on some imported material slots are an import-side name clash
with the already-open library materials, not an export defect.

## Preservation

- Live Blender held `Interior_Building.blend`; a save-copy snapshot of the in-memory
  state was taken before any edit, the active path stayed unchanged, and the file is
  saved at that path. Disk copy and snapshot are in
  `.mrmak/total-insanitation/corridor-production/recovery/`.
- Building baseline: 282 objects → 300 (18 new). **0 pre-existing objects changed,
  0 missing** (geometry hashes, UV hashes, material slots, transforms compared).
- Props baseline: 191 objects → 219 (7 new + 21 atlas font objects). **0 geometry, UV or
  material changes; 0 missing unpacked images.**
- `Text_Atlas_reference.png` and `Text_Atlas_normal.png` were restored to
  `//Unreal_Textures/...` and verified present; no texture pixels were regenerated and
  the retired Bars/Chains warning was not reopened.
- R01 `Janitor_Cart` and R02 `SM_LabShelf` were not remodeled or moved.
- Unreal project, registry, shared materials and addon configuration untouched.

Recovery paths: `recovery/Interior_Building.pre-corridor-20261112.blend`,
`recovery/Interior_Building.disk-copy-20261112.blend`,
`recovery/Enviroment_Assets.pre-corridor-20261112.blend`.
Baselines: `baseline-building.json`, `baseline-env.json`, `preservation-env.json`,
`building-build.json`, `props-build.json`.

## Checks performed and failures corrected

1. UV collapse: found by the independent audit (cabinet 212/1602 faces). Root cause was a
   stale face normal in box projection; fixed, rebuilt, and re-measured with a real
   signed-area test → 0 collapsed faces on all 25 objects.
2. Cabinet wall projection 20.1 cm → reduced body depth and hardware stack → **17.6 cm**.
3. Hose reel projection 27.6 cm → reworked hub/crank/nozzle → **24.5 cm**; free hose end
   now visibly joins the coil to the clipped nozzle.
4. FBX library offsets (Y = −200 / X up to 40.4 m) → export now zeroes only the new
   targets and restores transforms; reimport verifies origin and 400 cm span.
5. Preview isolation: per-family renders are selected by object name and hide every
   unrelated object; the row/assembly previews run in throw-away processes that delete
   unrelated objects in memory only and never save.
6. Mirrored atlas labels (text read backwards) and washed-out colours (sRGB values used
   as linear) were corrected; the material-aware previews show the intended palette.
7. Ngon caps blocked tangent export (FBX warning); caps are triangulated in the builder,
   the warning is gone.

Remaining limits: previews are Blender EEVEE, not in-engine captures; no collision or
lightmap UVs; the reused material slots carry no textures in the blend; corner assemblies
depend on the documented 18 cm return convention. Text is rasterised into T01 rather than
being a live text actor.

## Review images

`projects/total-insanitation/renders/corridor/` — all native Blender renders, no
generated concept images.

| Image | Content |
| --- | --- |
| `assembly_bay_eye.png`, `assembly_bay_wide.png` | Assembly preview: 4 m bay with pipe pair, conduit, EQUIPMENT plaque, panel, reel, cabinet and containers on the wall plane. |
| `n01_pipes_front/threequarter.png` | 400 straight, 385 corner, 100 infill. |
| `n01_fittings_front/threequarter.png` | Elbow, couplers, bracket, valve branch. |
| `n02_conduit_front/threequarter.png` | Conduit assemblies and fittings. |
| `n04_signs_front/threequarter.png` | Four plaques with readable atlas lettering. |
| `n03_cabinet_front/threequarter.png` | Cabinet, meter, plates, depth. |
| `n05_panel_front/threequarter.png`, `n05_paper_*` | Work-order panel, clips, papers. |
| `n06_reel_front/threequarter.png` | Coiled hose, free end, nozzle, crank. |
| `n07_containers_front/threequarter.png` | Three container silhouettes. |
| `props_row_overview.png` | Isolated overview containing only this pass. |

`n03_cabinet_detail/side.png`, `n05_panel_detail/side.png`, `n06_reel_detail/side.png`
and `n07_containers_detail/side.png` are earlier Workbench diagnostics retained for
geometry review; the EEVEE images are the material-aware views.

**ACCEPTED** — orchestrator review revision 6 accepted the N01–N07 model set and exports
after independent saved-source, FBX and native Unreal checks: 25 meshes, 13 694 triangles,
473 pre-existing objects preserved, 0 collapsed UV triangles, 0 missing images, 0 FBX
layout offsets, 25 meshes imported into Unreal. No further model changes were requested.
Owner aesthetic acceptance and final Basement placement remain pending; the orchestrator
owns the Unreal review assets and Workspace registry tabs.
