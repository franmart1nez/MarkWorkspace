# File placement and export rules

Stage 2 audit · 2026-11-17 UTC. Keep the existing source hierarchy and Unreal package names. Set the export directory for each family, and check the selected asset's import record before reimporting. Native sources and packages were inspected without saving, moving or deleting them.

The [export map](FILE_MAP.csv) lists 107 nodes from 94 existing FBXs, their source-name/collection matches, current Unreal import records and file-hash comparisons. The [audit evidence](FILE_AUDIT.json) records source hashes and findings. An unmatched row is an explicit gap; matching a name alone does not prove geometry equivalence. Full local receipts are under ignored `.mrmak/total-insanitation/stage-2/`.

## Roots and naming

- Editable root: `D:/GameJam/Total (in)Sanitation/`. All source/export paths below are relative to it.
- Unreal project: `D:/GItHub/BoomeRacist/BoomeRacist.uproject`. `Content/Art` maps to `/Game/Art`; `Content/Levels` maps to `/Game/Levels`.
- Preserve `Enviroment_Assets`, `Enormes`, `Janitor_Satirs` and `Inteior_Lobby`. Map differences explicitly; avoid parallel renamed folders.
- `Resources` contains inputs and construction references. `Delivery` contains exports where already established. Backups, importer collections, cutters and bake/high-poly resources are excluded from normal delivery batches.

## Source → export → Unreal

In this table, **Building** means `Assets/Building/Interior_Building.blend`; **Props** means `Assets/Enviroment_Assets/Enviroment_Assets.blend`.

| Family / source collections | Export directory | Unreal destination / rule |
| --- | --- | --- |
| Building: `Modular_Blocks/Modular_Walls`, `Floor`, `Roof`, `Stairs`, `Lights` and decoration collections | `Assets/Building/Delivery/Modular_Blocks/` | Import static meshes into matching branches under `/Game/Art/Assets/Building/Modular_Blocks/`. Find and place assembled variants in the `BP` hierarchy below. |
| Building: `Floors/Basement/Shop` (16 meshes) | `Assets/Building/Delivery/Basement/Shop/` | `/Game/Art/Assets/Building/Floors/Basement/Shop/`; `Cube.003` → existing `Cube_003.fbx` → `Cube_003` is a verified naming example |
| Building: `Janitor` and `Janitor_Elevator.002/Janitor_Elevator` | `Assets/Building/Delivery/Janitor/` | `/Game/Art/Assets/Building/Janitor/`; elevator meshes belong in its `Elevator/` branch. Keep collider/bake/backup collections distinct |
| Building: existing Lobby / other floor geometry | Recorded legacy exports: `Assets/Building/Delivery/Floors/Lobby.fbx`, `Day_1.fbx`; `Assets/Building_Delivery/Day_2.fbx`, `Day_3.fbx` | Existing `/Game/Art/Assets/Building/Floors/Lobby`, `Day_1`, `Day_2`, `Day_3` packages remain. These old-root FBXs are absent from the current source root; do not create those legacy directories or claim a new delivery. Resolve the particular floor before revising it |
| Props: `Lab/Big`, `Enormes`, `Medium`, `Small` | `Assets/Enviroment_Assets/Delivery/Lab/<size>/` | `/Game/Art/Assets/Enviroment_Assets/Lab/<size>/` |
| Props: `Concrete`, `Glass`, `Pipes and Cigar` | Sibling `Delivery/Concrete_Pieces/`, `Glass_Pieces/`, `Pipes_And_Cigarette/` | Matching branches under `/Game/Art/Assets/Enviroment_Assets/` |
| Cleaning: `Assets/Cleaning_Tools/Cleaning_Tools/Cleaning_Tools.blend` | Its `Box/`, `Bucket/`, `Triangle/`, `Janitor_Cart/` subfolders | `/Game/Art/Assets/Clean_Tools/`; cart meshes use `Janitor_Cart/`. Preserve the intentional `Cleaning_Tools` → `Clean_Tools` spelling difference |
| Cleaning: `Chicken/Chicken.blend`, `Tongue_Mop/Tongue_Mop.blend`, `Water_Gem/Water_Gem.blend` under `Assets/Cleaning_Tools/` | Existing FBX beside each blend | Corresponding `/Game/Art/Assets/Clean_Tools/<tool>/` branch. Chicken and Tongue Mop are skeletal exceptions; see below |
| Cleaning: `Assets/Cleaning_Tools/Snake_Sucker/Snake_Sucker.blend` | No existing delivery FBX | Future tool delivery stays with this source, under its existing tool folder, then `/Game/Art/Assets/Clean_Tools/`. No same-name engine asset was found; this stage does not declare it delivered |
| Shared surfaces: `Utility_Materials/<family>/<material>/*.sbs` | Existing texture outputs in that material's folder | Existing `/Game/Art/MI/Utility_Materials/<family>/` material and texture packages. Follow actual dependencies; source and engine folder names can differ |
| Atlas: `Utility_Materials/TrimSheet&Atlas/General_Atlas/General_Atlas.sbs` | Existing graph `Text_Atlas`; its normal/reference PNGs are currently missing | Preserve the source and Blender consumers. No matching current Unreal atlas package was found; exact future texture/material packages are to be specified with the stage-5 atlas approval under the confirmed art/material roots |
| UI: `UI/Stop_Sign/Stop_Sign.sbs`, `UI/Screen_Cover_Blood/Screen_Cover_Blood.sbs` | Existing Stop PNG/GIF files beside its source; blood PNG sequence in `UI/Screen_Cover_Blood/Delivery/` | **New UI:** owner-confirmed `/Game/Art/UI/`, not created yet. Current Stop examples and blood flipbook remain under `/Game/Programming`; preserve their consumers |
| Characters: nine `Characters/<species>/<variant>/Blender/*.blend` sources | Existing FBX beside each blend | Current provisional NPC textures, sprites and flipbooks live under `/Game/Programming/Enemies/FlipBooks`. Future character art goes under the confirmed `/Game/Art/Characters/` path. [NPC sources and runtime folders](NPC_REFERENCE.md) |
| Retained trash: `Assets/Trash/Black_Hole/Black_Hole.blend`, `Delivery` collection | `Portal.fbx`, `Trash_Hole.fbx` beside the blend | Existing `/Game/Art/Assets/Trash/Black_Hole/` |
| Letter geometry: `Utility_Materials/01_Letters/Untitled.blend` | Existing `Text*.fbx` beside the blend | Existing `/Game/Art/MI/Utility_Materials/01_Letters/Text*` mesh packages are an observed legacy exception. Preserve them; do not treat this as a destination for new arbitrary meshes |
| Office Level Builder | Workspace `projects/total-insanitation/scripts/olb_build.py` → installed Unreal `Content/Art/Tools/OfficeLevelBuilder/Python/olb_build.py`. No FBX. | Retain `/Game/Art/Tools/OfficeLevelBuilder/BP_OLB_Builder`, `BP_OLB_Room`, `BP_OLB_Stair`. [Builder guide](OFFICE_LEVEL_BUILDER.md) |
| Levels | Native Unreal maps | `/Game/Levels`; existing review scope includes `Inteior_Lobby`, `LaCarlota`, `Streaming_Levels/Main_Lights`, `Streaming_Levels/Basement` and `Streaming_Levels/Level_01`. Keep art packages outside level folders |

Building has 282 objects and Props 191, both Metric at scale length 1. Neither main source has object parenting: the static Parent Objects mode therefore produces one file per eligible mesh. Preserve the collection hierarchy and explicitly isolate each visible export batch. Props' `Not_For_Now/Medianos.001`, `SM_TestTubeHolder`, backup and importer objects are not automatically new deliveries just because they exist.

The read-only catalog also inspected the existing Crossbow blend (95 objects). Weapons remain outside this plan's production scope; no new destination or export recipe is assigned here.

## Modular Blueprints

Find and save production modular Blueprints under `/Game/Art/Assets/Building/Modular_Blocks/BP/<Area>/<PieceType>/`, choosing the area first and then the piece type. Each area has `Door`, `Floor`, `Roof`, `Stairs` and `Wall` folders. Use `Roof` for ceiling assemblies, including variants with lights.

| Area | Verified example relative to `Modular_Blocks/` |
| --- | --- |
| `Basement` | `BP/Basement/Roof/BP_Roof_Concrete_Lights_01` |
| `Lab` | `BP/Lab/Stairs/BP_Stair_Concrete_01` |
| `Lobby` | `BP/Lobby/` has all five folders and currently contains no Blueprint assets. |
| `Office` | `BP/Office/Wall/BP_Wall_Wood_01` |

Find and import the source meshes directly under `Modular_Blocks/` in `Modular_Walls`, `Floor`, `Roof`, `Stairs`, `Lights`, `Wall_Decorations`, `Floor_Decorations` or `Roof_Decorations`, according to the mesh family. Validation assets have their own `Validation/Basement_20261112/` branch.

The live Unreal Asset Registry confirmed 28 Blueprints under `BP/` on 2026-11-20. It also returned 36 redirectors directly under `Modular_Blocks/`. For new references, use the actual package under `BP/` and leave existing redirectors in place.

## Static FBX recipe

Use the installed **Super Duper Batch Exporter** and the owner's `Unreal_Only_FBX` preset:

| Setting | Required value |
| --- | --- |
| Directory | The family destination above; verify any Project Directory override |
| Filename / Format | `$OBJ` / FBX |
| Mode / Limit | Parent Objects / Visible |
| Modifiers / Types | Apply Modifiers on / Mesh only |
| Transform on export / LOD creation | Off / Off |
| Preset values inspected | Scale 1; apply units; `FBX_SCALE_NONE`; forward `-Z`, up `Y`; face smoothing; tangent space; SRGB vertex colors; animation off; embedded textures off |

The installed preset still contains an obsolete absolute `D:/GameJam/BoomeRacist/.../Cube.002.fbx` filepath. The installed add-on overwrites filepath and selection for each generated job; do not execute the preset as a standalone exporter or reuse that stale path. Neither main blend stores `scene.batch_export` settings. Props also retains an old `export_folder` property pointing to `BoomeRacist/.../Delivery/Medium/`; it is not an approved current destination.

Mesh-only Parent Objects does not automatically bundle unparented UCX colliders with their render mesh. Existing Box/Bucket/Triangle/cart FBXs contain both mesh and UCX nodes; reproduce that exact bundle through a checked per-tool export. Do not turn their collider objects into separate production meshes. Chicken and Tongue Mop FBXs contain armatures and correspond to Unreal SkeletalMesh assets; the static preset would omit required data. Preserve their existing rig/animation exports until a specific tool revision is authorized.

Keep 256/512 px/m as the owner's density references, with authored floor/ceiling tileable exceptions. Saved UV-tool density settings are not proof of mesh density. Preserve UVs, color attributes, pivots, slots and offsets. The modular grid remains 400 cm; [the module contract](../../projects/total-insanitation/MODULE_CONTRACT.md) records the 385 + 15 cm corner rule.

## Resource classifications

| Finding | Actual usage | Disposition |
| --- | --- | --- |
| Building's missing `Utility_Materials/TrimSheet/Trimsheet_Structure_01/Trimsheet_Wall_01_basecolor.png` | `TrimSheet_01` / `.001` on seven objects | **Moved resource.** Existing replacement is `Utility_Materials/TrimSheet&Atlas/Trimsheet_Structure_01/Trimsheet_Wall_01_basecolor.png`. A future targeted relink must preserve UVs and tiling |
| Building's six `Corridor_*` materials | All zero material users; T01 image is referenced only by the unused `Corridor_Atlas_T01` material | **Retired data.** Eligible for a precise future removal; not a reason to restore the missing image or purge unrelated data |
| Props' `T01_Corridor_Graphics` | Zero users | **Retired unused link.** Leave out of new production; do not regenerate it |
| Props' missing `//Unreal_Textures/Text_Atlas_normal.png` and `Text_Atlas_reference.png` | `Atlas` material on Ashtray, five Cigarettes, three Pipes and `SM_Centrifuge` | **Active Blender source links with missing exports.** Neither PNG exists in the current source inventory. Preserve; no verified replacement or safe repack is established |
| `General_Atlas.sbs` | Existing `Text_Atlas` graph with basecolor, normal, roughness and reference outputs; embedded goblin resource path retained | **Existing authored graph.** It is not empty. Filename/graph-name similarity does not establish unchanged UV layout or exported pixel identity |
| Other missing images in catalogued sources | Tongue Mop: four zero-user images; Demon Female: 20 zero-user images; Orc Femboy: five zero-user images; Elf Male: one missing `hair.png` with one reported user but no material/object datablock consumer found | **Owner source/reference data, not confirmed retired AI work.** Preserve. Character/tool repair is deferred until that source is revised; no blanket orphan purge |

In Unreal, a project-wide asset-name search for `Atlas` returned only the existing Elevator atlas packages. The ten Blender atlas objects' engine meshes use WorldGrid/utility material assignments rather than a detected Text/General atlas texture dependency. `SM_Centrifuge`'s `Atlas` slot currently uses utility plastic. This establishes the inspected dependency state, not a license to remove Blender data or proof that arbitrary renamed assets elsewhere never used an older atlas.

The moved source trim does **not** require moving Unreal materials: their current branch remains `/Game/Art/MI/Utility_Materials/TrimSheet/Trimsheet_Wall_01/`, including basecolor, normal and occlusionRoughnessMetallic dependencies.

## Reimport exceptions and delivery gate

- The 557-package native audit includes 70 redirectors. Preserve them and follow real target packages. Folder/file presence alone does not identify the correct reimport target.
- Of 189 FBX import records, 96 resolve to existing current files after explicit root/layout mapping; 67 of those have matching recorded/current file MD5. These counts include legacy floor packages outside the current production batch. A hash match establishes the FBX bytes, not current blend/FBX equivalence.
- Only two modular FBXs currently remain in `Delivery/Modular_Blocks/`. Many existing engine pieces point to absent old exports. Record the intended source object and exact target package before making its next export; do not rebuild the whole kit during this audit.
- Both `Delivery/Janitor/Elevator.fbx` and `Janitor_Building.fbx` contain `Janitor_Elevator_01` and `Janitor_Elevator_Doors_01`. Treat the latter filename as misleading; it is not a verified building batch.
- The validation Blueprint at `/Game/Art/Assets/Building/Modular_Blocks/Validation/Basement_20261112/BP_Basement_Kit_Validation` still references its four trial meshes and is referenced by `/Game/Levels/LaCarlota`. Preserve this dependency chain. Retired Workspace records do not authorize deleting these packages.
- Existing UI consumers include `/Game/Programming/DialogueSystem/Example/Stop_Sign/` and `/Game/Programming/Cleaning/FlipBooks/Screen_Cover_Blood/`; the blood flipbook is referenced by `BP_FirstPersonCharacter`. `TX_Stop_Sign` is referenced by `/Game/Art/MM/Utility_Materials/MM_Panner_Image` and records the old source `UI/Substance_graph_stop_1.png`; the current PNG is in `UI/Stop_Sign/`. A future UI migration requires its own dependency-aware change.

Before the **first new delivery** in a family: isolate the intended objects and colliders, set Directory, check the export preview and name, then inspect the actual target package's import source. Export only the authorized asset, verify units/orientation/pivot, UVs/color attributes/material slots/collision and reimport into that exact package. Preserve material assignments in the existing Blueprints. Confirm the result in Unreal before calling the asset delivered. A future native relink/removal must rerun the missing-file/consumer audit after saving.

## Verification boundary

Nineteen saved blends were audited in isolated Blender 5.2.4 LTS processes with factory startup and auto-execution disabled; 94 FBXs imported successfully into disposable background scenes. Unreal 5.8.4 native MCP supplied package classes, import tags, dependencies, referencers and dirty state. During that stage-2 audit its startup map stayed `/Game/Levels/Test`, clean with PIE off; no map was switched or edited. The subsequently completed [stage-3 reference library](REFERENCE_LIBRARY.md) records native captures and the isolated material showcase. This contract validates placement rules and records repair gaps; it does not claim a new export round trip, artistic asset acceptance or completed native repairs.
