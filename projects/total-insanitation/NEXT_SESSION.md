# Continue Total (in)Sanitation

Read `AGENTS.md`, the pinned card and **Basement → Pass 01**. The service-area pass was implemented and agent-verified on 12 November 2026. Owner aesthetic acceptance is pending.

## Latest / Office Level Builder

Implemented and agent-verified on 12 November 2026: `BP_OLB_Builder`, `BP_OLB_Room`, `BP_OLB_Stair` in `/Game/Art/Tools/OfficeLevelBuilder/` plus the run script `Content/Art/Tools/OfficeLevelBuilder/Python/olb_build.py`. The demo is in LaCarlota under `Art Review/Office Level Builder 2026-11-12` at (14000, 2000, 0). It produced 38 walls, 8 corners, 34 floors, 34 ceilings and 2 stair pieces with no warnings. Read the Workspace **Level builder** tab first. Lights now use separate `LightSpacingX`/`LightSpacingY` (centred per room; narrow corridors get their centre row). The owner authorized new Office maps; none created yet. Open items: partitions between touching rooms (currently merged), doorway Blueprint/door marker, real lights for office ceilings, and which new Office maps may be created. Python runs in the live editor via the Output Log `Cmd` box (`py "<file>"`); remote execution is disabled.

## Latest / delegated corridor models delivered and verified

N01–N07 is complete as a **model/export set**: 25 meshes, 25 FBXs, one 1024px T01 atlas and durable authoring scripts, 13,694 triangles. The owner-created **sub-agente 1** used **OpenCode Go / deepseek-v4.1-flash / max** throughout. Its accepted status and exact native identifiers remain under ignored `.mrmak/total-insanitation/corridor-production/`. No replacement worker was started.

Read **Basement → Models / Model review**, `workspace/2026-11-12_total-insanitation/CORRIDOR_MODEL_REVIEW.md`, the worker's `CORRIDOR_IMPLEMENTATION.md` and `corridor-assets.json`. Independent saved-source checks retained all 282 building + 191 prop baseline objects, with zero collapsed new UVs or missing images. All FBXs reimport at zero layout translation. Native Unreal imported 25 meshes with matching triangle/UV counts; nine finish instances, T01 and one material-assigned review Blueprint are under `/Game/Art` (36 new packages total).

The orchestrator used isolated offscreen SceneCapture2D review lighting, never moved the main viewport camera, removed all four transient helpers and did not save/reload LaCarlota. Another agent's Office Level Builder work and existing dirty map state were preserved. Final Basement placement, production module Blueprints/collision and owner aesthetic acceptance remain next steps.

The owner also requested automatic worker orchestration. The scoped bridge/client/checkbox are **implemented and tested but not installed**. A dependency-compatible service/UI update is staged under `.mrmak/maintenance/agent-control-update.zip`; six tests pass on installed Node 22.23.4 and native OpenCode fixture tests passed without paid calls. Read `docs/agent-orchestration.md`. No app/agent restart occurred. Activation needs the owner's permission and consideration of other running agents. The full test suite has one independently reproduced pre-existing voice-language effort expectation failure.

## Delegation record

The owner liked A/B/C and accepted their direction for modeling. They requested a **new visible OpenCode chat in Mr. Mak → Chats** with **DeepSeek V4.1 Flash 1017 (Max)**, the current agent as orchestrator, independent review afterward and a repeatable procedure. Read **`CORRIDOR_ASSET_HANDOFF.md`**, **`processes/visible-agent-orchestration.md`** and the Workspace **Agent production** tab.

The owner opened **sub-agente 1** and sent the single kickoff manually. Native terminal/transcript evidence confirms the selected model and folder. Progress/corrections used the handoff's file protocol plus authenticated native inbox follow-ups after session creation. Independent model/export review finished and the final control action is accepted; owner aesthetics remain pending.

The owner then requested full automation. A scoped bridge, CLI and opt-in New chat checkbox are prepared in app source/build; see **`docs/agent-orchestration.md`**. Native OpenCode fixture tests verified file handoff and same-context corrections without paid calls. This feature is **not activated in the running service**. Never restart the active worker/app to apply it without the owner's permission.

The building source was initially dirty, then clean at the baseline snapshot. Both saved sources now include this pass. Re-check the live filepath/dirty state before any future work; do not restore old backups over the delivered models. Recovery and baseline hashes remain under ignored `.mrmak/total-insanitation/`.

## Corridor concept evidence

The owner requested walking in PIE, fresh screenshots and generated dressing proposals. This capture/concept work is complete: four native views and three final image edits are in **Basement → Corridor concepts**. **Asset proposal** (`CORRIDOR_ASSET_PROPOSAL.md`) marks seven new asset families, existing cart/shelf reuse, material variants and one proposed graphic atlas. Prompts are retained in `CORRIDOR_PROMPTS.json`.

The generated proposals are **owner-accepted as a modeling direction, not implemented assets**. They add 4 m-compatible utility pipe/conduit assemblies, an analog cabinet, sign variants, work-order panels, a hose reel and small supply containers. Existing architecture, counter/spike openings and floor/ceiling UV exceptions remain the basis. Do not treat generated fittings as measured production geometry. No Unreal map/asset or Blender source was edited/saved by the capture task; final dirty package lists were empty and Unreal Git status was unchanged.

PIE used real CharacterMovement from the north corridor through the junction and down the existing 4 m stair to the shop, approximately 48.1 m net forward progress. Native camera metadata is adjacent to the four original images. Runtime walking logs and rejected drafts remain under ignored `.mrmak/total-insanitation/corridor-concepts/`. Next step is the requested visible worker launch, then modeling/export and independent review under the new handoff.

## Completed

- Reviewed all notes and 12 supplied images in Temp; integrated English production notes in References, Materials and Decisions.
- Verified Main_Lights as Always Loaded/visible in Basement and LaCarlota. It was already in the live LaCarlota session; saved without a duplicate. Actual PIE confirmed the streamed light and player pawn.
- Verified four copied module types through import/reimport and independent native FBX → Blender UV/color inspection. Read `MODULE_CONTRACT.md`. The original building blend hash is unchanged.
- Added only three shop components: `ArtPass_EquipmentSign`, `ArtPass_ServiceFluorescent`, `ArtPass_ServiceTaskLight`. One rectangular light: 80 lumens, 3900 K, 550 cm radius. Original shop mesh components retained.
- Corrected CobbleStone_02 ORM to linear/Masks after tracing references to Basement and LaCarlota. Pass 01 lists the exact four changed existing packages and nine additions.
- Saved/reloaded both maps, verified material overrides and captured three matched actual gameplay pairs at FOV 95°. Final Basement audit had no dirty content or maps.
- Added `ART_REVIEW_Basement_Kit_Validation` in LaCarlota at `(12000, -2400, 0)` cm, folder `Art Review/Basement 2026-11-12`. This checker assembly passed floor, wall, corner and wall-seam collision probes.

## Next art work

Review the sign wording and light balance with the owner, then prioritize the existing doorway mesh's missing modular Blueprint, controlled wear variation or service props. NPC choice and bar interaction remain deferred. Agent verification does not imply owner aesthetic acceptance.

The sampled concrete floor is about 128 px/m; the sampled wall reaches about 256 px/m. The owner explicitly confirmed that some floors and ceilings intentionally differ from 256/512 px/m to match their tileable textures. Preserve their UVs and tiling; no density correction is pending for this floor.

## Scope and tools

- The owner permits overwriting existing art assets when needed if the exact changes are marked afterward. New/modified art assets stay under `/Game/Art`; only the four named maps are in scope.
- Native UE and Blender Lab MCPs work. Discover schemas and verify project/file/map; keep Unreal calls sequential.
- Offline read-only audits can use `--background --factory-startup --disable-autoexec`. The generic MCP CLI timed out with normal user addons; direct factory mode passed. Production FBX exports must use the installed Super Duper Batch Exporter and owner preset; factory mode does not load that addon automatically. The graphical source session was preserved.
- Read `BLENDER_WORKFLOW.md` before authoring/export. Create structures and shop assets inside the existing `Interior_Building.blend`; individual props inside `Enviroment_Assets.blend`. New blends require an explicit need.
- Use Super Duper Batch Exporter with the supplied panel configuration and `Unreal_Only_FBX`; change Directory for the destination. Installed preset axes are `-Z / Y`. Verify the first delivery in Unreal; the older direct-export test used different axes.
- Historical reproduction scripts are in `scripts/`. The Pass 01 sign’s separate editable blend and FBX are in `sources/shop-service-pass/`; retain them, but do not repeat this source layout for new assets. Materials remain assigned in the Blueprint.
- Native receipts, recovery copies, copied module sources, camera metadata and failed probes remain under ignored `.mrmak/total-insanitation/basement-review/`. Do not restart active editors or sessions.
- Designer batch tools passed during setup; interactive graph control remains unverified. No Designer edit was required.

## Remaining limits

The original Pass 01 pairs establish stationary appearance. The later corridor task verified actual PIE walking and stair descent and preserved four fresh 2013 × 1040 stills; no motion video or performance benchmark was recorded. Owner visual acceptance remains pending.

The owner removed obsolete texture references after atlas replacement. A fresh read-only scan of both saved blends found no missing unpacked file images. The old texture warning is closed. Unrelated Unreal edits, including the old Lights.umap deletion, were retained.
