# Decisions and roadmap

**In short:** on 2026-11-11 the owner redirected the project from a
continent-scale simulation to a close-up one: one city and a few villages with
some wildlife, no tile grid, and the look of the art bible's zoom images. v0.2
implements that; five questions are waiting for the owner.

## Decisions made on 2026-11-11

| Topic | Decision | Before (v0.1, 2026-11-10) |
| --- | --- | --- |
| Scale | One region (~5.2 × 3.6 km): one large city, five villages, wildlife — the MVP | A continent with ~30 realms |
| Grid | Removed: continuous positions and angles in metres | 192 × 120 tile grid |
| Detail | Every inhabitant simulated individually with home, family, trade and routine | Numbers per settlement, ~350 notables |
| Tick | One minute; 48-day year | One day; 360-day year |
| Look | Painted top-down style of Zoom 01–03: warm roofs, pale stone, yellow-green fields, round crowns, blue water; seasons and night | Flat coloured tiles |
| Species | Six in this region (humans dominate); other species and cities deferred | All 33 |
| Previous version | Kept unchanged in `archive/v1-continent/` | — |

## Still valid from 2026-11-10

| Topic | Decision |
| --- | --- |
| Language and platform | JavaScript ES modules, no dependencies; Node and browser |
| Storage | One JSON save; the region is rebuilt from the seed |
| Engine rules | Only the engine changes the world; the viewer reads |

## Deferred by decision

- Other cities, realms and the remaining 27 species.
- The RPG: player, turns, combat, skills, loot, magic, progression.
- The AI agents: interpreter, narrator, director, chronicler…
- Building interiors.
- Anything commercial (never planned).

## Open questions for the owner

| # | Question | Today |
| --- | --- | --- |
| 1 | **The rest of the world:** a second region next, or make this one deeper first? | One region |
| 2 | **Interiors:** should houses, taverns and the guild get interiors? | People vanish inside buildings |
| 3 | **Money:** add rents, taxes and price pressure? | Households and villages grow steadily richer |
| 4 | **Time scale:** keep the 48-day year? | Seasons pass in 12 days |
| 5 | **The player:** where does the protagonist enter? | Not started |

## Roadmap

1. **Watch and tune.** Several seeds through a few seasons; note what feels wrong.
2. **Decide.** Answer the five questions above.
3. **Visuals.** Character and building sprites on top of the painted style; portraits.
4. **Then the game.** RPG layer and AI agents on top of `src/engine/index.js`.

## Not yet verified

- Long play sessions with mouse and keyboard.
- The viewer's narrow-screen layout.
