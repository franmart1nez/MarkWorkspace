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
- Owner confirmed 256/512 px/m and target PC: RTX 2060 + Ryzen 5 5600,
  1080p, medium-high settings, approximately 60 FPS. Performance is unmeasured.
- Epic Unreal MCP and the existing Blender Lab MCP were verified with real
  native calls; Designer's cooker/renderer passed a material export check.
  Interactive Designer graph control is not yet verified.
- Setup did not save level or asset changes. Begin the art pass with assembled
  lighting context, module fit/export verification and the decisions card.

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
