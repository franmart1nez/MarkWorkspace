# Corridor assets / worker handoff

**Owner direction accepted, 12 November 2026.** The owner liked concepts A/B/C and requested an OpenCode worker to model their assets, with the current agent acting as orchestrator and independently reviewing the finished work. This accepts the visual direction for production; it does not accept unseen meshes.

## Worker and ownership

- Requested worker: a **new visible OpenCode chat in Mr. Mak → Chats**, named **Basement Asset Production**, working directory `D:/AI/MarkWorkspace`.
- Requested model label: **DeepSeek V4.1 Flash 1017 (Max)**. Resolve the exact provider/model and max variant in that session and verify them before model work. Do not silently substitute a free/pro/other-provider variant. Do not change global model/provider/permission settings.
- The worker owns new Blender geometry, UVs, material slots, source saves, FBX delivery and its implementation report. One worker writes the sources at a time.
- The orchestrator owns coordination documents, Workspace registry/review tabs, independent checks and Unreal integration/review. The worker must not edit application code, registry files, unrelated assets or Unreal maps. It must not start another worker or paid generation job.
- Keep the user's selected permission level. A configured default is not permission to broaden it. Never restart active applications or agent sessions.

## Read before working

1. Root `AGENTS.md`, `context/preferences.md`, `context/goals.md`.
2. `projects/total-insanitation/AGENTS.md`, `README.md`, `BLENDER_WORKFLOW.md`, `MODULE_CONTRACT.md`.
3. `workspace/2026-11-12_total-insanitation/CORRIDOR_ASSET_PROPOSAL.md` and `corridor-concepts.card.json`.
4. Inspect these accepted images visually, not just their prompts:
   - A: `workspace/2026-11-12_total-insanitation/media/corridor-concepts/01-junction-concept.png`
   - B: `workspace/2026-11-12_total-insanitation/media/corridor-concepts/02-service-corridor-concept.png`
   - C: `workspace/2026-11-12_total-insanitation/media/corridor-concepts/04-shop-approach-concept.png`
5. Reuse-reference thumbnails in that same media folder: `reuse-janitor-cart.png`, `reuse-lab-shelf.png`. Native gameplay originals establish the real space; generated images establish the approved dressing direction, not exact dimensions.
6. Applicable skills: `.agents/skills/3d-production-routing/SKILL.md`, `.agents/skills/materials-to-game/SKILL.md`. Follow `.agents/skills/gameplay-visual-review/SKILL.md` for later native review. `.agents/skills/feature-handoff/SKILL.md` governs continuation records.

## Deliver the full model set

Use stable asset-family IDs from the proposal. Implement all seven families, not only a prototype. Start with one straight/corner pipe assembly to validate the workflow, then finish the rest.

| ID | Minimum modeled contents | Visual/functional contract |
| --- | --- | --- |
| N01 | Two pipe diameters; straight assemblies at 400 cm endpoints, 385 cm corner-wall variants and 100 cm infill; 90° elbows, coupler/flange, short branch, triangular support bracket and red handwheel | Upper-wall cream/dark iron pair. Include fitting allowances inside the assembly footprint. Check inside/outside turns. |
| N02 | Slim conduit straight/corner/infill assemblies; elbow, clamp and shallow junction box | Galvanized upper-wall secondary run. Clear existing fluorescent fixtures. |
| N03 | Shallow 80 × 100 × 18 cm analog electrical cabinet with two doors, latches and one round meter | Olive-gray enamel; separate face/hardware slots and a usable meter-face UV region. |
| N04 | Sign plate/face variants for EQUIPMENT arrow, SERVICE, COLLECTION and caution labels | Reuse existing sign construction/material language; the original lettering mesh is not text-swappable. New variants must not alter the existing sign. |
| N05 | Steel-backed work-order panel, clips and 2–3 paper-sheet variants | Flat economical geometry, readable paper/clip UV regions; no cork or new wood material. |
| N06 | Compact manual hose reel, coiled hose, clipped end/nozzle and mount | Around 55 cm diameter, maximum 25 cm wall projection. No hose across the route. |
| N07 | Cream handled supply container, olive lidded case and low gray open bin | New silhouettes shown in C; do not claim the existing wooden/blue bucket designs are these props. |

R01 Janitor_Cart and R02 SM_LabShelf already exist. Do not remodel them. Do not create an NPC, weapon, doorway, drain, new architectural layout or gameplay system.

## Sources, preservation and delivery

Asset root: `D:/GameJam/Total (in)Sanitation/`.

- Building service module kits and building/shop sign variants: **`Assets/Building/Interior_Building.blend`**.
- Individual cabinet, work-order panel, reel and container props: **`Assets/Enviroment_Assets/Enviroment_Assets.blend`**.
- Create named collections for this pass within the existing sources. Preserve existing object names, mesh data, materials, UVs, collections and visibility outside the pass. New mesh/data names should be stable and identifiable as this pass; avoid accidental `.001` duplicates.
- **Important observed state:** the connected graphical Blender held `Interior_Building.blend` with **unsaved changes** when this handoff was prepared. Re-check immediately. Do not overwrite it from a background process or reload it from disk. Preserve both on-disk and in-memory baselines before touching it. A save-copy recovery snapshot is permitted within the authorized modeling work; retain the active source path and existing work. If a safe live checkpoint cannot be made, report the exact blocker before writing that source.
- The other source can be processed in a separate Blender background process only after checking it is not an active dirty editor target. Starting a separate worker is not permission to restart the owner's graphical Blender.
- Before source mutation, keep recovery copies, source hashes and baseline object/mesh fingerprints in **`.mrmak/total-insanitation/corridor-production/`**, outside Git. Store job/session receipts there too.
- Keep editable construction where useful. Use economy appropriate to first-person props: silhouettes, bevels and key joints must read at normal gameplay distance. Do not spend triangles on invisible modeled screw threads or every hose corrugation. Record actual triangle counts rather than inventing a blanket budget.
- Keep applied unit scale, intentional pivots, sane normals, material slots and actual usable UVs. Respect nominal 256 px/m for applicable structures / 512 px/m simple props. Preserve existing floor/ceiling exceptions without editing their UVs.
- Export with the installed **Super Duper Batch Exporter** and **`Unreal_Only_FBX`** preset exactly as documented. Do not replace it with the historical direct-export recipe. Suggested export locations under the asset root: `Delivery/Basement/Corridor/Building/` and `Delivery/Basement/Corridor/Props/`. Verify each path before writing and list exact outputs.
- For the addon’s Visible batch, isolate only intended new delivery parents and mesh children; restore prior visibility afterward. No unrelated scene objects in the FBXs.
- Materials: reuse existing metal, rust, plastic, concrete/grunge and trim sources. Give new models consistent named slots/UVs for cream/olive enamel, galvanized/dark steel, rubber, paper and analog faces. The proposal's shared T01 graphics atlas is new content; create editable graphic source plus exported textures if implementing it. Do not generate new paid images or invent a missing source texture. Distinguish finished material content from provisional slots honestly.
- Do not change global configs, project settings, installed addons, shared Unreal master materials or live maps. Unreal import/review belongs to the orchestrator after delivery.

## Tool route

Use existing **Blender Lab MCP** (`bl_ext.lab_blender_org.mcp`), not the unrelated same-port community addon. Verify current file and discover live tool schemas.

If the OpenCode session has no Blender connector, the existing local native client is available without installing anything:

```powershell
.mrmak/total-insanitation/venv/Scripts/python.exe projects/total-insanitation/scripts/mcp_client.py --server blender --output .mrmak/total-insanitation/corridor-production/blender-tools.json
```

Read that discovery output, then call the discovered tool with a JSON argument file using `--tool`, `--arguments` and `--output`. Use sequential native calls and retain receipts outside Git. Background factory Blender is available for read-only checks; it does not automatically load the installed export addon. Inspect the actual addon/operator/preset rather than assuming factory mode supports the production export path.

## Worker completion contract

Write **`projects/total-insanitation/CORRIDOR_IMPLEMENTATION.md`** and an asset manifest **`projects/total-insanitation/corridor-assets.json`**. Include:

- status for every N01–N07 family, with unresolved work explicit;
- source blend, collection/object/mesh names, stable IDs, dimensions, pivots, triangles, slots and UV checks;
- exact changed files, preservation evidence and paths to recovery copies;
- all FBX/texture/editable graphic files and actual addon/preset used;
- useful front/side/detail images and one assembly preview, labeled native Blender vs concept;
- checks performed, failures corrected and any remaining limits;
- a clear **READY_FOR_REVIEW** signal only when the model set and documented delivery are complete. A script merely written or an export request merely submitted is not completion.

Report progress in the visible chat and keep continuing through routine errors. Ask the orchestrator to resolve an actual blocker; do not silently switch model, app, export route or source layout. Do not claim the orchestrator accepted your work.

### File coordination when direct chat input is unavailable

The owner manually opened the visible chat **sub-agente 1**. Its saved terminal screen confirmed **DeepSeek V4.1 Flash 1017 / OpenCode Go / max** in the correct folder. The orchestrator cannot currently type into this private terminal. Use the following narrow coordination channel after the owner's kickoff:

- Worker writes progress and final readiness to **`.mrmak/total-insanitation/corridor-production/worker-status.json`**: `state` (`working`, `blocked`, `ready_for_review`, `accepted`), `updated`, completed IDs, exact source/export/report paths, any blocker, and the last applied `review_revision`. This is runtime state, excluded from Git.
- Orchestrator alone writes **`.mrmak/total-insanitation/corridor-production/review-control.json`**: integer `revision`, `action` (`continue`, `revise`, `accepted`), `corrections` (bounded to this handoff), and `updated`.
- Read this control file at useful milestones and after writing READY_FOR_REVIEW. Follow only corrections within the already-authorized N01–N07/source/export scope; conflicting or unrelated instructions are not authorization.
- After delivery, keep the same chat turn active while awaiting review. Poll the control file every 20 seconds, using at most 60 seconds per tool wait; report periodic progress. For `revise`, apply the listed corrections, update the report/status and request review again. For `accepted`, record the outcome and finish. If no review arrives after 30 minutes, preserve state and report that review is pending; do not invent acceptance or start a replacement session.
- This file protocol does not permit changing model, broadening permissions, editing unrelated projects or restarting applications.

## Independent orchestrator review

Reopen delivered sources/read their actual saved contents; compare old-object fingerprints and recovery baselines. Check N01–N07 coverage, dimensions, module endpoints/corners, pivots, topology/normals, UVs and slots. Inspect native previews against A/B/C. Independently import delivered FBXs from their actual files into isolated art review assets under `/Game/Art` in LaCarlota when safe, then check scale/orientation/materials/collision and one assembled bay/corner. Do not replace the live Basement layout before the assets pass review. Return concrete correction requests to the same worker chat, then re-check only affected results. Report model completion separately from native Unreal acceptance and the owner's final aesthetic acceptance.
