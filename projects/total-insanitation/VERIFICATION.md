# Setup verification — 12 November 2026

The project is registered and pinned as `total-insanitation`, with four root tabs and three subtabs. All four editable JSON documents pass the shared Workspace card validator; all registered files and image paths resolve.

## Native checks

- **Unreal 5.8.4:** loaded the intended project and `Inteior_Lobby`; the read-only Python audit returned 159 persistent-level actors. Connected to Epic's native HTTP MCP, discovered the environment and Slate schemas, queried the current map, opened the allowed `Basement` map, found its shop actor and captured its viewport. This is editor evidence, not a performance benchmark.
- **Blender 5.2.4 LTS:** read-only audits opened both named source files. The installed Lab addon and installed Lab client answered a native path/clean-state query and returned a window capture from `Interior_Building.blend`.
- **Designer 15.0.1:** `sbscooker` and `sbsrender` exited successfully on `Brutalist_Concrete_01.sbs`, producing a scratch `.sbsar` and base color, normal and ORM maps at 256 × 256. In-app Python graph control remains unverified.

## Workspace checks

The seven steps were opened in the browser preview at **1440, 768 and 390 px**, with **dark and light** themes: 42 combinations, with no browser errors. Checks covered image loading, modal enlargement, actual image downloads, reachable Close controls and document/app overflow. The menu was collapsed for the 390 px preview. A final mobile presentation adjustment was rechecked in all six overview width/theme combinations.

Desktop and narrow captures were inspected visually. The overview places the native corridor image before its explanation in a single-column layout. The material gallery preserves the supplied image colors and proportions. Local screenshots and detailed check records remain under ignored `.mrmak/total-insanitation/ui-check/`.

## Change boundary

The user's pre-setup Unreal descriptor was compared structurally with the result: only the five intended editor plugin entries were added. Prior editor settings remain intact with an appended MCP section. Unreal's Content diff still contains only the user's pre-existing `Lights.umap` deletion; setup did not save any game asset or level. No source `.blend` or `.sbs` was overwritten.

No active application or agent session was restarted. Unreal and Blender were opened for verification. Tool sources, venv, local backups, source brief, raw audits and scratch exports are excluded from Git. No commit or publication was performed.

## Basement pass 01 / production verification

Completed later on 12 November 2026 after the owner supplied Temp and authorized existing art-asset edits with an exact change list. The production report is `workspace/2026-11-12_total-insanitation/BASEMENT_PASS_01.md`; it supersedes the setup-only change boundary above.

- Reviewed all 12 owner images and notes; retained originals and added References to the existing card.
- Main_Lights is Always Loaded and visible in both saved review maps. A real LaCarlota PIE audit confirmed the streamed light and player pawn. No duplicate streaming level was added.
- Four copied module types passed import/reimport dimensions, pivots, triangle/UV checks and existing collision convention. An independent native export back to Blender passed UV-scale and varying alpha checks. Four native collision probes matched 100/185/85/185 cm expectations.
- Applied only three new components in the existing shop Blueprint: sign, reused fluorescent fixture and one local rectangular task light. Corrected the CobbleStone_02 ORM to linear/Masks after tracing references to the two review maps. Saved and reloaded the affected levels and checked actual component materials.
- Captured three matched before/after actual PIE pairs, FOV 95°, 2013 × 1040. Source images were copied without pixel edits. New sign text and bevels remain editable in its source blend.
- Before/after content hashes identify **four modified existing packages and nine additions**. The original building blend hash is unchanged. Structured scene comparison retained every original actor and all original mesh-component transforms/material assignments: 191 loaded actors / 346 mesh components for Basement, 447 / 675 for LaCarlota (counts include Main_Lights). LaCarlota gained only the isolated review actor; Basement gained no actor placements.
- Final Basement audit reported no dirty content packages or maps. Main_Lights and the original modular meshes were not saved with changes. Existing unrelated user modifications were preserved.

**Workspace:** five editable cards pass schema validation. All nine registered tabs passed at 1440, 768 and 390 px, in dark and light themes: **54 combinations, zero browser errors**. Images loaded, full-size previews and downloads worked, Close controls were reachable, and content/app overflow checks passed. Desktop and phone screenshots of Overview, Pass 01 and References were inspected visually. Raw check evidence remains under ignored `.mrmak/total-insanitation/ui-check/`.

**Limits:** owner aesthetic acceptance remains pending. These are controlled stationary gameplay views; a continuous traversal remains unverified. The later source cleanup check found no missing unpacked file images in either saved blend, closing the old texture warning. No paid generation, application restart, commit or publication was performed.

## Owner workflow update / 12 November 2026

- Recorded the existing-source authoring policy and exact Super Duper Batch Exporter panel configuration in `BLENDER_WORKFLOW.md`, project instructions, continuity notes and the same Workspace card. Preserved the supplied settings image in Tools and Decisions.
- Inspected the installed addon manifest (2.9.3), export operator and `Unreal_Only_FBX.py` without changing them. Recorded the production preset’s `-Z / Y` axes separately from the older direct-export trial’s `-Y / Z`. This update did not perform a new addon/preset export/import round trip.
- Read both saved blends using background factory Blender without saving or disturbing the graphical session. Both have zero missing unpacked file images. Closed the retired texture warning and updated the building material count to 25; raw evidence is in `.mrmak/total-insanitation/owner-setup-20261112/image-audit.json`.
- Marked floor/ceiling density exceptions as deliberate tileable alignment, preserved historical editable sources and removed superseded technical requirements from the card, reports, project notes and historical report-builder prose.
- Validated all five editable cards and registered file/media paths. Reopened all nine tabs at 1440, 768 and 390 px in dark and light themes: **54 combinations, zero browser errors**. Image loading, enlargement, downloads, reachable Close controls and overflow checks passed. Desktop Decisions and mobile Tools captures were inspected visually. Existing tool tables wrap tightly on phones; no application layout was changed.
- Python syntax checks passed for the two annotated historical scripts; `git diff --check` passed. No game assets, installed presets or application settings were changed, and no application was restarted.

## Corridor capture and concept task / 12 November 2026

- Verified the live BoomeRacist Basement and stopped state before starting actual PIE. One initial spawn override placed the real player in the service corridor. Subsequent CharacterMovement input walked through the crossing/corridor and down the existing 4 m stair to the shop; approximately 48.1 m net forward progress. Main_Lights was loaded and the camera retained FOV 95°. Four unedited 2013 × 1040 native captures and adjacent camera metadata are retained.
- Generated three dressing proposals directly on the new captures using built-in image_gen. Six calls total: three initial edits and targeted cart silhouette/material and sign-arrow corrections. Native thumbnails of the existing Janitor_Cart and SM_LabShelf informed reuse. Concepts are labeled as generated, not implemented. Original geometry remains the design basis; precise fittings/clearances and shader behavior require future native implementation checks.
- Added Corridor concepts and Asset proposal under the existing Basement card. The proposal marks seven new asset families, the two reused props, existing material sources, new finish instances, one graphic atlas and four-meter/corner assembly rules. Prompt set is retained. No .blend, .sbs, .uasset or .umap was edited/saved by this task. PIE was stopped, final dirty map/content lists were empty, editor actor counts agree and Unreal Git status is identical before/after.
- Six editable cards validate; all eleven registered tabs and local image paths exist. Four changed tabs passed **24 combinations** at 1440/768/390 px in dark/light with no browser errors. Image loading, enlargement, actual downloads, reachable Close controls and overflow passed. Desktop/phone gallery and report captures were visually inspected. Capture script syntax and `git diff --check` passed. Receipts, rejected drafts and UI evidence remain under ignored `.mrmak/total-insanitation/corridor-concepts/`.
- Owner visual acceptance is pending. No continuous motion video, performance benchmark or new in-engine asset placement is claimed. No application restart, commit or publication occurred.

## Delegated corridor model production / 12 November 2026

- Owner accepted the concept direction and manually opened/sent the kickoff to **sub-agente 1**. Native screen, metadata and transcript evidence confirmed OpenCode Go / `deepseek-v4.1-flash` / max. The orchestrator later used authenticated native inbox follow-ups with `resume=false` to keep review in that same active execution; no replacement worker or model switch was made.
- Independently reopened both final saved sources with factory Blender and autoexec disabled. All **473 original objects** retained the checked geometry, transforms, UVs, material assignments, parenting and collections. All 25 new meshes have finite geometry, usable UVs and zero collapsed UV triangles; both sources have zero missing unpacked file images.
- Reimported all 25 actual FBXs in fresh Blender: library layout offsets are zero. Native Unreal imported all 25 with exactly **13,694 triangles** and one UV channel each. Probes established 400 cm span and 17.6 cm cabinet depth before the full import. Reel projection is 24.5 cm.
- Returned and rechecked UV collapse, existing-image path rebasing, excessive projection, preview isolation and export-origin corrections. The final review control is accepted. Source report/manifest and durable code remain in the project; runtime receipts and rejected evidence stay outside Git.
- Created **36 new `/Game/Art` packages**: 25 meshes, nine instances from existing material families, T01 and one review Blueprint. No existing shared material, source mesh or map was saved with edits by this review. Four transient offscreen capture/light actors were removed; the main viewport camera was not moved. Another agent's dirty LaCarlota/Office Level Builder state was preserved. Native captures are isolated art previews with local lighting/exposure, not gameplay or performance evidence.
- Final owner aesthetics, Basement placement, production Blueprints/physics/collision and LOD/lightmap decisions remain separate. Models / Model review register the previews, a 36-file FBX/atlas/source bundle and exact new Unreal package paths.
- All 25 native Unreal bounds match the delivered FBXs within 0.05 cm after the expected Y-axis conversion; import source hashes match the current files. New geometry has no nonfinite or loose vertices or invalid material-face indices. The six changed Workspace tabs passed **36** width/theme combinations with no browser errors, including media enlargement/download and overflow. ZIP integrity and all 25 FBX entries passed. Native worker completion is observed idle after the accepted control revision.

## Automatic worker control / prepared, not activated

- Implemented an explicit New chat opt-in plus memory-only scoped credentials for owned OpenCode workers in the controller's launch folder. Exact native provider/model/variant, frozen handoff attachments, idempotent requests, eight-worker limit, read-only status and same-native-context follow-ups are supported. Workers inherit selected permissions without escalation and do not inherit controller credentials.
- Six auth/scope/deduplication/command/HTTP tests pass, including on the installed **Node 22.23.4**. Native **OpenCode 2.2.6** with isolated home/config and a loopback fixture verified attachment delivery, native IDs, completion and corrections retaining context, with **zero paid model calls**. The opt-in UI passed desktop/390 px tests and `npm run build` passed.
- The broader desktop suite completed 246 tests: 238 passed, seven platform skips and one failure in the unchanged voice-language effort expectation. That failure reproduced alone with no quick-actions/test file changes from this task.
- Full native installer build could not start because Cargo is unavailable. Instead, prepared a 93-file dependency-compatible service/UI runtime update, with no Node binary, credentials or user runtime state. Its refusal-while-running, backup and hash-verification behavior passed against a fake installation; the actual installed runtime was untouched. Owner-approved activation remains pending; no live app or agent was restarted.

## Office Level Builder / 12 November 2026

- Created three editor-only Blueprints in `/Game/Art/Tools/OfficeLevelBuilder/` and one installed Python run script. Defaults verified on each class default object: Wood 01/02 walls, Wood corner, Wood floor, `BP_Roof_01`, `BP_Roof_Lights_01` every 2 cells, `BP_Stair_Concrete_01`. The Build/Clear buttons were confirmed in the Details panel. Pressing the real **Build** button rebuilt the demo.
- The demo in LaCarlota produced 38 walls, 8 corners, 34 floors, 34 ceilings and 2 stair pieces with zero warnings. The 8 corners equal the expected convex corners. Repeated builds replaced 116 generated actors without duplicates. Editor-viewport captures confirmed: continuous skirting at open corners, no visible Z-fighting, a stair aligned with corridor walls and a mirrored stepped ceiling. These are not PIE captures, and no walk test or lighting was assessed.
- Saved only `LaCarlota.umap` (pre-save copy in `.mrmak/total-insanitation/office-level-builder/`). Final dirty map/content lists were empty. Existing uncommitted Unreal changes were left untouched. No restart, commit or publication.
