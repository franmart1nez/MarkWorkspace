# Art direction

## Confirmed by the owner — 2026-11-11

- The general view remains **top-down**, including the detailed environment.
- Seek architectural and world references directly from classic isekai, especially
  **KonoSuba, Overlord and Re:Zero**.
- Keep the desired imagery moderately stylised, with emphasis on villages and cities.
- For settlement-scale general maps, use reference **Isekai 01 (Axel)**.
- For more distant regional maps, combine **Isekai 04 (Re:Zero regional map)**
  and **Isekai 05 (Overlord regional geography)**.
- The owner liked the first two generated images and requested a unified cenital
  revision with three connected scales: **close city, several-city region, almost
  the entire continent**. Preserve north-up orientation and recognisable geography
  so the sequence reads like zooming out in one game.

The reference collection and provisional miniature art bible live in the existing
Workspace **Art bible** tab:
`workspace/2026-11-10_world-in-dreams/art-bible.card.json`.

## Implemented in the game — 2026-11-11

The v0.2 viewer paints the region procedurally after **Zoom 01–03**: strict
top-down roof plans with hipped terracotta roofs, pale stone walls with square
towers and gatehouses, a round market square with striped stalls, a citadel with
round corner towers, yellow-green field patches with furrows, orchards in rows,
round dark-green tree crowns with light highlights, a saturated blue river and
ponds. Seasons change the palette (spring blossom, autumn colour, winter snow)
and nights darken the map with lit windows and street lamps. Code:
`src/ui/render.js`. Sprites and portraits may later replace the procedural shapes.

## Working interpretation — proposed

Create future layout concepts from a straight-down, orthographic-style camera.
Use anime aerial views to study roofs, districts, gates, waterways and landscape
relationships, while translating their perspective into the confirmed top-down view.
Keep the same street and river layout across world, settlement and detail scales.
Vary town footprints with habitat and function rather than making every town circular.

Original image concepts and their preserved earlier versions are in **Art bible →
Overview**. The twelve collected source images are in **Art bible → References**,
stored in `workspace/2026-11-10_world-in-dreams/art-references.card.json`.
The v002 sequence is generated in order: city → region using the city → continent
using the region. Prompts are saved in `ART_ZOOM_PROMPTS_V002.md` beside the cards.
These are visual proposals, not engine exports or seed-derived terrain. Generated
scale continuity must be reviewed separately from exact world-coordinate continuity.
