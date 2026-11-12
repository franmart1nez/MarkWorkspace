# Goals

## Current project

## Total (in)Sanitation

Art-only production hub created 2026-11-12. Current focus: finish the modular
Basement environment in the owner's pharmaceutical-company game. Direction:
predominantly 1970s interiors with medieval fantasy accents, blending
semi-realism and stylization. Public-facing polish contrasts with neglected,
dungeon-like back-of-house spaces. Characters, weapons and UI are deferred.

- Read `projects/total-insanitation/README.md` and its `AGENTS.md`.
- Pinned card: `workspace/2026-11-12_total-insanitation/`, registry ID
  `total-insanitation`; overview, Basement/assets, art bible/materials/decisions,
  and tools.
- Unreal: `D:/GItHub/BoomeRacist/BoomeRacist.uproject`, UE 5.8.4. Only
  `Inteior_Lobby`, `LaCarlota`, `Streaming_Levels/Main_Lights` and
  `Streaming_Levels/Basement` are in scope.
- Sources: `D:/GameJam/Total (in)Sanitation/`. Preserve editable originals.
- Owner confirmed 256/512 px/m references. Floors and ceilings may deliberately
  use other densities to match their tileables; preserve these UV exceptions.
- New structures/shop assets belong inside the existing `Interior_Building.blend`;
  individual props belong inside `Enviroment_Assets.blend`. Create a new blend
  only when explicitly needed. FBX delivery uses Super Duper Batch Exporter and
  `Unreal_Only_FBX`; read the project’s `BLENDER_WORKFLOW.md`.
- Obsolete texture references were removed after atlas replacement. A fresh
  read-only check found no missing unpacked file images in either saved blend.
- Epic Unreal MCP and the existing Blender Lab MCP were verified with real
  native calls; Designer's cooker/renderer passed a material export check.
  Interactive Designer graph control is not yet verified.
- Basement pass 01 is implemented and agent-verified: a service sign and warm
  task light, one corrected ORM texture, three matched PIE pairs and a verified
  copied 4 m module group. The owner permitted overwriting art assets if changes
  are marked; Pass 01 lists four changed packages and nine additions. Original
  building source retained. Owner visual acceptance remains pending.
- Temp's 12 supplied references and notes are incorporated into the same card.
  Main_Lights is saved in Basement and LaCarlota. Continue from the project's
  `NEXT_SESSION.md` and `MODULE_CONTRACT.md`.
- Latest: four new native PIE captures after walking the corridor/stair route,
  three generated dressing concepts and a seven-family asset/material proposal
  are in Basement → Corridor concepts / Asset proposal. The owner accepted the
  concept direction for modeling and requested a visible OpenCode worker with
  DeepSeek V4.1 Flash 1017 (Max), supervised and reviewed by the current agent.
  Read `CORRIDOR_ASSET_HANDOFF.md` and `processes/visible-agent-orchestration.md`.
  The owner manually started **sub-agente 1**, OpenCode Go / deepseek-v4.1-flash /
  max. The 25-mesh N01–N07 set, 25 FBXs and T01 are delivered and orchestrator-
  verified in saved Blender sources and native Unreal (13,694 triangles, 473 old
  objects preserved). See Basement → Models / Model review. Owner aesthetics
  and final Basement placement remain pending.
  A scoped automatic worker bridge is prepared/tested in app source/build;
  `docs/agent-orchestration.md` explains it. Not activated in the running service.

## Sculpture Colorization

Reusable workflow for independent sculpture colorization projects.

- Start at `projects/sculpture-colorization/START_HERE.md`, `DIRECTIVES.md`,
  `GENERATION_POLICY.md` and `NEXT_SESSION.md`. Revision: **2026-11-08**.
- Active sculpture: **mother-talzin**. Production started 2026-11-08: all 35
  required crops generated and agent-selected for views 02–15. The user requested
  three crops for complete sculpture views 02–04. Continue from its `START_HERE.md`
  and `work/batch.json` for native Photoshop assembly verification and user review.
- Composite 01 is supplied finished and is the highest appearance reference.
  The only other appearance references are shared client-approved quality examples.
  Every target's own original PSD controls geometry, detail, camera and placement.
- Start directly with the remaining views: plan a small crop set per source
  according to size, generate and review every required crop for the entire batch.
  Then announce readiness and ask the user to open Photoshop if closed.
- Assemble only in Photoshop, one view at a time, preserving layers and masks.
  Assembly includes placement, masks, edge joins and shape checks without manual
  color/lighting corrections. Save and reopen-verify editable PSD/PSB plus review PNG.
- Keep the existing highest-quality ChatGPT generation preferences and truthful
  live-control reporting in `GENERATION_POLICY.md`. Magnific is explicit opt-in.
- Workspace card: `workspace/2026-11-05_sculpture-colorization/PROJECT.md`.
  Local Photoshop MCP: `projects/sculpture-colorization/PHOTOSHOP_INTEGRATION.md`.

## World in Dreams (world simulation)

Stage 1 of the personal isekai project, started 2026-11-10. On 2026-11-11 the
owner redirected it to a close-up MVP (v0.2): one walled city, five villages and
some wildlife, every inhabitant simulated minute by minute, no tile grid, and the
painted look of the art bible's Zoom 01–03. The same day the owner chose to
deepen this region rather than add another: v0.3 adds simple building interiors
and a closed, more realistic economy (employers, rents, taxes, prices) and keeps
the 48-day year. v0.35 (same day) concentrates on the people: timetables by
trade and season, trades that follow demand, death from many causes, crime, the
law and abuses of power, and the weather of the year. Other cities and species, the protagonist and text RPG ("much
later"), the AI agents and anything commercial are deferred. The continent-scale
v0.1 is kept in `projects/world-in-dreams/archive/v1-continent/`.

- Project brief and how to run: `projects/world-in-dreams/README.md`
- Rules, data model, the owner's answers: `projects/world-in-dreams/docs/design.md`
- Workspace card: `workspace/2026-11-10_world-in-dreams/PROJECT.md`
- Source GDD v0.2 (Spanish): Google Doc linked in the project README
