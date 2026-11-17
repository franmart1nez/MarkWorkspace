# Total (in)Sanitation — art reset and production plan

**Approved plan · Stages 1–2 complete.** Stage 2 continuation was requested from the New Setup handoff. See the [execution log](EXECUTION_LOG.md) for completion evidence and the [file contract](FILE_PLACEMENT.md) for its findings. Stages 3–7 remain pending.

Reset the project's old AI production records, document the owner's current file hierarchy, and rebuild the art reference library from Unreal before defining the mascot, signage, UI and a new Basement direction.

This plan follows the owner's reset brief. The old AI asset/Basement production is retired; earlier approvals do not authorize restoring it. The owner reported removing its base files and Unreal assets. Stage 1 removed the corresponding Workspace data while retaining the Office Level Builder. Stage 2 audits placement and dependencies without native production saves. Native production edits, generation and later stages are outside the current execution.

## Execution order

| Stage | Deliverable | Completion check |
| --- | --- | --- |
| 1. Reset | Minimal project hub, with obsolete AI asset/Basement records removed | No active links, instructions or deliverables refer to the retired work |
| 2. File contract | Verified source → FBX → Unreal destination rules | Each relevant file family has an existing or owner-confirmed destination |
| 3. Unreal reference library | Art bible organized by environments, materials, assets and characters | Every production reference has a current Unreal asset/map path and usable images |
| 4. Mascot | Approved master design and consistent pose library | The same character remains recognizable across poses and at sign/UI sizes |
| 5. Graphic system | Approved signage/UI rules and atlas specification | Direction, hazard, decoration and UI examples read as one game |
| 6. Basement concepts | Fresh native captures and proposals in a separate ChatGPT conversation | Owner selects a direction that fits the actual scene and approved graphics |
| 7. Asset production | Individual approved asset sheets, material assignments and creation methods | Each asset has a source, export destination, Unreal destination and native acceptance check |

The material showcase from the owner's point 7 moves into stage 3 so it can inform all later concepts. Stage 4's master and stage 5's first graphic examples should be reviewed together. Finish the pose batch only after that shared direction is accepted. Basement concepts follow graphic approval; asset production follows Basement concept approval. Atlas implementation remains a later step after its content/layout approval.

## Evidence already checked

- Source root: `D:/GameJam/Total (in)Sanitation/`. Top-level art folders are `Assets`, `Characters`, `UI` and `Utility_Materials`.
- Unreal root: `D:/GItHub/BoomeRacist/Content/Art/`, corresponding to `/Game/Art`. It contains `Assets`, `Clouds_and_Skies`, `EPMasterMaterials`, `MF`, `MI`, `MM` and `Tools`. No `UI` or `Characters` directory currently exists directly under `Art`.
- The two main saved Blender sources were opened in separate background processes with factory startup and automatic script execution disabled. Neither was saved. `Interior_Building.blend` contains **282 objects**; `Enviroment_Assets.blend` contains **191**. Both use Metric units with scale length 1.
- Building scene roots: `Reference`, `Floors`, `Janitor`, `Janitor_Elevator.002`, `Utility (ignore)` and `Modular_Blocks`. `Floors/Basement/Shop` exists. Props are grouped under `Lab` (size groups), `Glass`, `Concrete`, `Pipes and Cigar`, and reference/construction collections. Preserve these divisions.
- Six unused materials from the retired production remain in the building source with **zero users**. Both blends retain a legacy graphic-image reference. These need a stage-2 usage audit; they are not evidence that the retired meshes still exist and are outside the Workspace-only cleanup.
- Missing unpacked references: **2 in building**, **3 in props**. Building includes the retired T01 and a structural trim linked through old `Utility_Materials/TrimSheet/`; the actual hierarchy now uses `TrimSheet&Atlas`. Props include T01 and two `Unreal_Textures/Text_Atlas_*` links. Inspect usage before deciding whether a link is retired or needs relinking; do not regenerate deleted files automatically.
- `General_Atlas.sbs` exists, with one graph internally named `Text_Atlas` and `basecolor`, `normal`, `roughness` and `reference` outputs. It already references the goblin warning graphic. Its filename does not imply that it is an empty atlas or safe to repack.
- The mascot directory contains **six prototype JPGs**. The waving wizard, goblin warning PNG and wet-floor sign source were visually inspected. The wizard's simple black silhouette, hat and staff are a clear starting identity; the existing examples have differing graphic detail and need a shared treatment.
- Unreal still has `Art/Tools/OfficeLevelBuilder` and `Art/Assets/Building/Modular_Blocks/Validation/Basement_20261112`. Their presence on disk is observed; current in-engine references remain to be checked. The owner explicitly chose to retain the Office Level Builder as the essential tool during this planning session.

The Blender checks above cover the two production environment sources, not every character/tool blend. Filesystem checks do not establish current Unreal material classes, visual quality or map state. Old counts and connection receipts must be revalidated when execution begins.

## 1. Remove retired AI work and simplify the hub

Start with an exact project-scoped removal list. Delete the obsolete content rather than keeping it in a historical gallery or another project archive.

- Remove retired AI model/export and review records, concept images, prompts, manifests, renders, copied sources and implementation/handoff instructions, including their Workspace tabs and task-specific scripts.
- Inspect ignored `.mrmak/total-insanitation/` locations for matching generated outputs, recovery copies and task receipts. Remove scoped retired artifacts after checking that no job/session is still using them. Preserve working connectors, environments, configuration and unrelated runtime/session data.
- Rewrite project `README`, `NEXT_SESSION`, `AGENTS`, asset lists and the Total (in)Sanitation section of `context/goals.md` around the reset. Remove stale claims that deleted models are delivered or that UI design is deferred. Retain owner-confirmed art direction, export settings and intentional UV exceptions; remove obsolete production status and asset-specific examples.
- Remove project-specific references to the retired work from shared documentation while keeping reusable orchestration/tool workflows intact. Do not edit unrelated projects or rewrite Git history.
- Preserve owner-authored assets, supplied references, the selected mascot/sign prototypes and essential production rules. The explicitly requested mascot prototypes survive this reset even if their origin was generative.
- **Owner-confirmed exception:** preserve the Office Level Builder's three Blueprints, `Python/olb_build.py`, essential source/setup code and a concise usage guide. Remove obsolete Basement/corridor production records from its documentation without deleting the working tool. Audit demo/test content separately; it is not automatically essential.

Proposed minimal navigation: **Overview**, **Art bible**, **Plan**, **Rules & tools**. Category galleries sit under Art bible; the retained builder's guide sits under Rules & tools. Keep one project card. New production records grow from this clean baseline.

**Verification:** check registry targets and local links; search the project and shared context for obsolete continuation instructions; inspect the resulting file list. Fresh evidence replaces screenshots that still show removed AI additions.

**Boundary:** the requested deletion concerns Workspace project data. Do not repeat broad deletion in the owner's source or Unreal repositories. The surviving Blender data and Unreal validation packages listed above need a separate, precise usage/dependency check before any external cleanup. Retain the builder as instructed.

## 2. Document the actual file hierarchy

Produce one concise **File placement and export rules** document. Inspect each in-scope source's collections, parents, material/image links and exporter destination. Record the file-to-object-to-export relationship; audit character/tool blends read-only when cataloguing those families, without starting character or weapon production.

These are the existing locations to respect, not a proposal to rename the project:

| Family | Editable source / existing FBX location | Unreal destination |
| --- | --- | --- |
| Modular building | `Assets/Building/Interior_Building.blend` → `Assets/Building/Delivery/Modular_Blocks/` | `/Game/Art/Assets/Building/Modular_Blocks/`, using its existing mesh, decoration and `BP_*` subfolders |
| Basement shop | Same building blend, `Floors/Basement/Shop` → `Assets/Building/Delivery/Basement/Shop/` | `/Game/Art/Assets/Building/Floors/Basement/Shop/` |
| Janitor-specific building pieces | Same building blend → `Assets/Building/Delivery/Janitor/` | Existing `/Game/Art/Assets/Building/Janitor/` branches; confirm per object |
| Environment props | `Assets/Enviroment_Assets/Enviroment_Assets.blend` → sibling `Delivery/` category | `/Game/Art/Assets/Enviroment_Assets/`, respecting `Lab/Big`, `Enormes`, `Medium`, `Small`, `Concrete_Pieces`, `Glass_Pieces` and `Pipes_And_Cigarette` |
| Cleaning equipment | Existing sources under `Assets/Cleaning_Tools/` and their current per-tool export locations | `/Game/Art/Assets/Clean_Tools/` — record the intentional difference in spelling |
| Shared surfaces | `Utility_Materials/<family>/<material>/` | Existing `/Game/Art/MI/Utility_Materials/<family>/` packages and their actual texture dependencies |
| Mascot/sign atlas | `Utility_Materials/TrimSheet&Atlas/General_Atlas/General_Atlas.sbs`; references under `Resources/Pet` and `Resources/Warning_Sign_Goblin` | Trace the current atlas material/texture consumers before specifying destinations |
| UI | Existing `UI/Stop_Sign/` and other `UI/` source branches | `/Game/Art/UI/` — owner-confirmed new destination; directory not created yet |
| Characters | Existing `Characters/<species>/<variant>/Blender/` source branches | `/Game/Art/Characters/` — owner-confirmed new destination; directory not created yet |
| Levels | Existing maps; no art assets stored alongside maps | `/Game/Levels`, including `Streaming_Levels/Basement` and `Main_Lights` |

Rules to carry forward:

- Keep editable structure/shop work in the building blend and individual environment props in the prop blend. Reuse existing collections. A separate blend needs a concrete reason.
- `Resources` holds input references/construction resources; `Delivery` holds exports where that pattern already exists. Preserve the existing per-family exceptions. Never use `Backup`, `.autosave` or importer/reference collections as export batches.
- Preserve exact existing names, including `Enviroment`, `Inteior_Lobby` and `Enormes`. Record mappings rather than silently correcting names or making parallel folder systems.
- Use relative image links where practical. Relink moved resources to their verified current files; remove only confirmed retired AI data. Avoid blanket orphan purges that could remove owner construction data.
- Retain Super Duper Batch Exporter: `$OBJ`, FBX, Parent Objects, Visible, `Unreal_Only_FBX`, modifiers on, Mesh only, transform-on-export off, LOD creation off. Recheck the installed preset and current Directory after restructuring. Verify pivots, orientation, units, UVs, vertex colors, material slots and reimport paths on the first new delivery.
- Preserve 256/512 px/m as the owner's normal references and intentional floor/ceiling tileable exceptions. Do not normalize those UVs as part of cleanup.
- All newly authored/imported Unreal art stays under `/Game/Art`; level assets stay under `/Game/Levels`. Avoid unrelated gameplay folders and do not move existing packages through Explorer.

**Verification:** every proposed deliverable has one source, export path and Unreal package destination. Recheck missing-image reports after any approved relinking/cleanup. Create the confirmed UI/character destinations when needed; inspect existing consumers before moving any current Unreal packages.

## 3. Rebuild the art bible from Unreal

Use the existing editable `.card.json` system. Provide direct category tabs: **Environments**, **Materials**, **Assets**, **Characters**, **Mascot**, and **Signage & UI**, with a short direction/index page. Within each gallery, order entries by scenario or material/asset family; do not introduce unsupported filtering controls as a dependency.

Capture current Unreal views of the allowed maps: `Inteior_Lobby`, `LaCarlota`, `Streaming_Levels/Basement` and its `Main_Lights` setup. Inspect dirty state before switching maps; do not overwrite or discard unsaved work. Label editor and gameplay captures accurately.

Move the material study here: first inspect LaCarlota's existing showcase. Reuse it if sufficient; otherwise prepare an isolated showcase. The owner has allowed a separate material-review level in this brief; choose its exact name/location under `/Game/Levels` at execution. Show materials from `/Game/Art/MI/Utility_Materials` on consistent flat, curved and edged surfaces, with controlled lighting/scale plus contextual examples in the game. Capture color, roughness, metal, normal response and tiling; base-color thumbnails alone are insufficient.

Each entry records the exact Unreal asset/MI or map path, family/scenario, capture date, scale/tiling where relevant, source relationship, intended use and review status. All image previews enlarge and download. Capture existing characters from their real Unreal assets where available; mark missing coverage explicitly instead of inventing characters or importing them just for the bible.

**Reference policy:** the production library uses Unreal captures of final game assets/materials. The owner-selected mascot/sign prototypes and new generated proposals belong in clearly marked development entries. They become production examples only after approval, implementation and a native Unreal capture. They do not replace the real material library.

**Verification:** no old source-albedo gallery masquerades as final material evidence; no generated concept is labeled implemented. Check every changed tab at desktop, 768 px and 390 px, including full-size image and download controls.

## 4. Standardize and expand the mascot

Start from the six files in `Utility_Materials/TrimSheet&Atlas/General_Atlas/Resources/Pet`. Preserve the monigote identity: a simple figure with a wizard hat and staff, acting as the company's recurring spokesperson on instructions, warnings and decoration.

First produce a master sheet defining head/body proportions, hat silhouette, staff design, hands, feet, fill/outline treatment, clear space and minimum readable detail. Review one neutral/welcoming image alongside three representative applications: direction, cleaning instruction and hazard. Treat details beyond the owner's brief as proposals.

After master/style approval, complete a proposed **12-pose library**: neutral/welcome, greeting, point left, point right, mopping, pushing equipment, carrying supplies, explaining instructions, slipping/falling, electrical accident, chemical/acid accident, and fleeing fire/magic. Reconcile the first two if they read too similarly. Keep consistent proportions and recognizable accessories; define when a staff is held, stowed or omitted for task clarity. Review poses as a set at the intended on-screen/sign size.

Deliver approved transparent images plus an editable graphic master appropriate to the chosen treatment, a contact sheet and usage rules. Generated drafts alone are not the final reusable source. Keep them in the existing mascot branch, with final destinations specified by stage 2.

**Verification:** silhouettes stay consistent; actions read without captions; no unintended limbs, hat/staff changes or framing shifts. Owner accepts the master before the remaining generation batch. Exact generation model, batch size and cost limit are recorded before submission; no paid generations are included in this planning session.

## 5. Define signage, UI and the future atlas

Review `Resources/Warning_Sign_Goblin`, `UI/Stop_Sign` and the current UI in Unreal. Treat the black/yellow hazard graphics and wizard silhouette as existing experiments. Define a coherent 1970s corporate language with the game's fantasy accent using the actual environment/material references.

Present a compact proposal sheet covering directional arrows/room labels, hazard signs, staff instructions, decorative corporate posters, mascot applications and the currently visible HUD/menu elements. Specify typography roles, spacing, borders, pictogram weight, palette/contrast, icon-and-text hierarchy, tone and wear rules. Directional information, hazard warnings and decoration need distinct priority. UI shares the language while remaining readable over gameplay.

**Owner approval milestone:** approve the graphic rules using concrete sign examples and a HUD/menu mockup in the real scene before final sign production, UI replacement or atlas changes. **Confirmed game-text language: English, with future localization.** Keep wording editable and allow for later translated strings; a second language is not required for the initial batch.

Then prepare the **General Atlas specification**: inventory of approved graphics, identifiers, UV regions, padding/mipmap tests, required channels, resolution based on viewing size, reserved expansion area and affected material/UV consumers. Inspect the current `Text_Atlas` graph and consumers before choosing compatible additions versus a controlled repack. Keep variable/localized text editable where appropriate; do not bake all future UI wording into a texture.

Editing `General_Atlas.sbs`, exporting/importing the final texture set and replacing the present UI are later implementation tasks after approval. Verify the atlas on real meshes at distance and in mips, and verify UI at the intended gameplay resolutions. Propose a separate atlas/trim only when the approved inventory demonstrates a need.

## 6. Capture and generate a new Basement direction

After stage 5's direction is approved, capture a fresh Basement route in Unreal: entry/crossing, corridor, stairs, counter/shop and one reverse view. Record map, camera/FOV and important dimensions. Preserve the actual architecture, circulation, collision needs and lighting context in the brief.

Open a **separate ChatGPT conversation** for Basement image exploration, as requested. Attach the new native captures, the short art-direction brief, the approved mascot/sign examples and the Unreal material board. Check the available browser/session and selected generation model at that time; do not silently substitute another provider or an autonomous modeling worker. No chat has been created yet.

Begin with one representative view, compare the result to the original, and correct it before expanding to other angles. Request plausible dressing and graphic placement within the real scene. Generated lighting/material appearances are proposals to evaluate against Unreal, not new approved materials.

Deliver paired native/concept images and an annotated list of changes, reused assets and proposed additions in this project's single card. **Owner selects the Basement direction before individual asset sheets or modeling begin.**

## 7. Define individual assets, then produce a small verified set

For each asset selected from the approved Basement concept, create an isolated sheet showing useful views, scale, silhouette, construction and material zones. Resolve details that the environment image hides before choosing a creation method.

The asset record names: existing asset reuse or new work; editable source/collection; FBX path; Unreal destination; dimensions/pivot; material slots with **exact existing MI paths under `/Game/Art/MI/Utility_Materials`**; tileable/trim/atlas UV strategy; collision needs; and proposed method (manual modeling, procedural construction, or another specifically agreed workflow).

Reuse the Unreal material library first. Map each visible zone to a real MI and native screenshot. List gaps explicitly as either a missing tileable, graphic atlas region or trim requirement; obtain the owner's selection before creating that additional surface. New finishes must enter the same Utility_Materials system. Do not restore the retired AI graphics or finish set.

Produce one representative asset first and verify source editability, exported dimensions/orientation/pivot, UV/texel scale, material slots, collision, reimport and actual Unreal appearance. Review the first native result with the owner before a larger batch. Only then continue approved assets and final Basement placement. UI implementation can proceed as its own approved stage-5 deliverable; it does not need to wait for every prop.

**Verification:** a generated asset image is a concept; an FBX is an export; final acceptance requires the actual asset using the selected Unreal materials in the target scene. Keep owner approval distinct from agent technical verification.

## Confirmed decisions and next action

The owner answered all three planning questions:

1. **Retain the Office Level Builder** as the essential tool. Preserve its working assets/script and concise instructions.
2. **English game text, with future localization.** This applies to signage and UI.
3. **Use `/Game/Art/UI` and `/Game/Art/Characters`** for future work. These destinations are confirmed, not yet created.

No planning clarification remains open. Exact future generation settings, artistic choices, atlas changes and new asset designs will be resolved against concrete review material at their respective stages.

**Most recent execution:** stage 2's placement/export audit and contract is complete, following stage-1 cleanup. Completion evidence is in Progress. Native resource repair and a new export round trip are separate future work; stages 3–7 remain pending. Artistic approval is requested against concrete review sheets at stages 4–7. Extra atlases, broader character production, weapon production and unrelated gameplay changes remain outside this plan's required work.
