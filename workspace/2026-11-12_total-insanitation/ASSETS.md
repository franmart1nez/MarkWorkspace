# Source inventory

**Latest delivery:** N01–N07 now adds 18 building meshes and seven prop meshes, with one T01 graphics atlas and editable authoring sources. See **Models / Model review** for the verified set, 25 FBXs and exact paths. The historical inventory below remains the pre-pass baseline. The final model/export set totals 13,694 triangles; independent checks preserved all 473 baseline objects. Final scene placement is separate.

**Read-only baseline, 12 November 2026.** Object totals include references, backups, cutters and source variants. They are not counts of finished game assets.

| Source | Observed | Purpose |
| --- | --- | --- |
| `Assets/Building/Interior_Building.blend` | 282 object datablocks; 25 materials (latest cleanup check); Metric, scale 1 | Modular structures, floor-specific geometry and shop |
| `Assets/Enviroment_Assets/Enviroment_Assets.blend` | 191 object datablocks; 18 materials; Metric, scale 1 | Props; 139 objects belong directly to `Importer assets (ignore)` |
| `Utility_Materials/` | 38 `.sbs` source files; 14 top-level categories | Existing material library; not all categories are materials |

All paths above are relative to `D:/GameJam/Total (in)Sanitation/`. Automated raw `.blend` audits are stored locally under `.mrmak/total-insanitation/`.

## Structure collections

The building source already has `Modular_Blocks`, `Modular_Walls`, `Floor`, `Roof`, `Stairs`, decoration collections and a separate `Floors` hierarchy. `Modular_Walls` contains seven direct objects:

- `Wall_01`, `Wall_02`, `Wall_Corner_01`.
- `Wall_Corner_VertexColor_01`, `Wall_VertexColor_01`, `Wall_VertexColor_02`, `Wall_VertexColor_03`.

`Shop` contains 16 direct objects. `Basement` contains 11 direct objects. These counts describe collection membership, not export readiness or complete level coverage. The lobby has several older/backed-up source collections. Preserve those placeholders until their modular conversion is specifically scheduled.

## Texture reference cleanup / resolved

The owner confirmed that old texture references in `Enviroment_Assets` were removed after an atlas replaced them. A fresh read-only check of both saved blends found **zero missing unpacked file images** in either source. The old Bars, Chains and Old_Elevator_Door warning is closed. Do not regenerate or relink those retired textures.

The current building source has 282 objects / 25 materials; the prop source has 191 objects / 18 materials. These are inventory counts, not a recount of finished assets. Neither source was saved by this check.

## Ownership and current focus

| Location | Owner's intent | Current priority |
| --- | --- | --- |
| `Assets/Building/Interior_Building.blend` | Structures; modular kit; unique shop under Floors | Now |
| `Assets/Enviroment_Assets/Enviroment_Assets.blend` | Props intended to use tileables; windows still here | Now; window migration remains a proposal |
| `Utility_Materials/TrimSheet/Trimsheet_Structure_01` | Existing structural trim sheet | Reuse and verify UV/channel conventions |
| `Assets/Cleaning_Tools` | Unique janitorial equipment | Context and scale references |
| `Assets/Trash` | Gameplay trash, liquid/soot decals, blackhole | Environment context; no gameplay edits |
| `Assets/Weapons`, `Characters` | Weapons and characters | Deferred |
| `UI` | Existing UI; unimplemented Stop_sign | Deferred |
| `Total (in)Sanitation_Pureref.pur` | Owner's older mixed reference board | Optional; not a style authority |

## Unreal map scope

Project root: `D:/GItHub/BoomeRacist/`.

| Asset path below `/Game/Levels/` | Role |
| --- | --- |
| `Inteior_Lobby` | Main assembly map; spelling retained exactly |
| `LaCarlota` | Asset/material test map |
| `Streaming_Levels/Main_Lights` | Global lighting and post-process |
| `Streaming_Levels/Basement` | Main environment production target |

`Test` and `MainMenu` also exist on disk and are outside this task's scope. The native baseline opened `Inteior_Lobby` and `Basement` for inspection without saving either. The assembly map's read-only audit reported 159 actors in its persistent level; this does not establish streaming coverage. A native search confirmed `Basement_Shop_C_1` in the Basement.

## Authoring and delivery rules

Create new structures and shop assets inside `Assets/Building/Interior_Building.blend`; create individual environment assets and props inside `Assets/Enviroment_Assets/Enviroment_Assets.blend`. Paths are relative to `D:/GameJam/Total (in)Sanitation/`. Use these existing files and their collections. Create a new `.blend` only when the task explicitly requires one. Historical Pass 01 sources are retained as editable evidence.

Use **Super Duper Batch Exporter** with the owner’s `Unreal_Only_FBX` preset and destination-specific Directory. Exact settings are in Tools and `projects/total-insanitation/BLENDER_WORKFLOW.md`. Check size, orientation, pivots, UVs, colors and collision on the first delivery. Preserve the intentional floor/ceiling tileable exceptions to 256/512 px/m. Capture the assembled lighting context before judging final color or exposure.

## Pass 01 / measured additions

The owner supplied Temp and confirmed the **4 m** modular standard, shortened corners and Blueprint material assignment. The representative copied group passed import/reimport and native collision checks; full evidence is in **Basement → Pass 01**.

- Regular wall: 400 × 15 × 400 cm; corner: 385 × 15 × 400 cm; floor: 400 × 400 × 15 cm.
- Copy test: `/Game/Art/Assets/Building/Modular_Blocks/Validation/Basement_20261112`.
- Historical Pass 01 sign source (predates the existing-source rule): `projects/total-insanitation/sources/shop-service-pass/Shop_Equipment_Sign.blend`.
- Doorway meshes still need a modular Blueprint. No doorway or window asset migration was made.
- Basement retained its 186 original actors; LaCarlota gained one isolated review actor (442 → 443), plus the existing five Main_Lights actors in each map.

### Existing material-instance families

Distinct registry assets under `/Game/Art/MI/Utility_Materials`, excluding redirectors. These are library entries, not runtime counts or budgets.

| Family | Material instances |
| --- | --- |
| Concrete | 15 |
| Durlock | 2 |
| Glass | 3 |
| LOD | 2 |
| Leather | 3 |
| Magic | 2 |
| Metallic | 14 |
| Mosaics | 1 |
| Plastic | 17 |
| Rug | 4 |
| Simple | 13 |
| TrimSheet | 2 |
| WallPaper | 1 |
| Wood | 9 |

The supplied native variant board is in Art bible → Materials; all twelve supplied images are in References. The corrected CobbleStone_02 ORM and the 128 px/m sampled floor exception are documented there.
