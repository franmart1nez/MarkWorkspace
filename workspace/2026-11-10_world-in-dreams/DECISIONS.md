# Decisions and roadmap

**In short:** on 2026-11-11 the owner redirected the project from a
continent-scale simulation to a close-up one: one city and a few villages with
some wildlife, no tile grid, and the look of the art bible's zoom images. v0.2
implements that. The owner then answered the five open questions; v0.3 adds
interiors and a closed economy. For v0.35 the owner asked to concentrate on the
people: realistic timetables, trades that follow demand, death, and the bad
things of the world. Nothing is waiting on the owner.

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
- The protagonist and the RPG: player, turns, combat, skills, loot, magic,
  progression ("much later", owner, 2026-11-11).
- The AI agents: interpreter, narrator, director, chronicler…
- Anything commercial (never planned).

## The owner's answers (2026-11-11)

| # | Question | Answer | v0.3 |
| --- | --- | --- | --- |
| 1 | A second region, or deepen this one? | Deepen this one: it is already large; make it work realistically | Done: interiors and economy |
| 2 | Interiors? | Yes, simple for now, but they must exist | Rooms, furniture and a spot for everyone indoors; roofs lift off close up |
| 3 | Rents, taxes, price pressure? | Start a more realistic economy | Closed money: employers, rents, evictions, house sales, taxes, tolls, tribute, levy, alms, poor relief, moving prices |
| 4 | Keep the 48-day year? | Yes, for now | Unchanged |
| 5 | Where does the protagonist enter? | Much later; the world and this region first | Not started |

## Economy decisions (v0.3)

| Topic | Decision | Why |
| --- | --- | --- |
| Money | Never created by work; only merchants, newcomers and leavers move money across the region's edge, and that is counted | Fixes the steadily growing purses of v0.2 |
| Wages | Paid by treasuries, businesses, temple, guild or lord, as far as they can | Every coin has a source |
| City watch | Paid by the city treasury, not the lord | The lord's rents and tribute could not cover it |
| City and lord | The city pays a fixed weekly farm; villages pay seasonal tribute | A share of the city treasury made prices swing |
| Redistribution | Poor relief from treasuries, temple alms, village harvest shares, a tallage on savings | Without them a quarter of families ended penniless |
| Prices | Treasuries aim at six days of wages and watch their trend; workshops price by stock and till | Steadier prices than a stock-only rule |

## v0.35 decisions (people and their harsher world)

| Topic | Decision | Why |
| --- | --- | --- |
| Timetables | Worked out from date, trade, age, traits and sleep debt at every decision; nothing stored but the sleep start and debt | Keeps the save small and the rules in one place |
| Daylight | A cosine over the 48-day year, 16 hours at midsummer to 8½ at midwinter; the viewer's dusk uses the same times | Farmers' hours and bedtimes follow the season |
| Meals | Three at set points of the waking day instead of every 4.5 hours | Supper no longer falls at 22:00; work breaks for dinner |
| Character | Honesty and temper worked out from the three existing traits | No new random draws per person; the inspector can explain behaviour |
| Crime | Real night trips for burglary and murder; purse-cutting, shoplifting, brawls, dice and drink resolved where they happen | People can be seen prowling at night; daytime crime costs nothing extra |
| Justice | Restitution, fines, the cells in the barracks, banishment after repeated crimes, the gallows for murder; bribes for corrupt watchmen | Gives crime consequences without a separate trial system |
| Illness | Contagion inside households is strong and between neighbours weak | A first tuning (20% between neighbours) infected the whole city and starved it |
| Weather | One roll per year for the region, ±8% per settlement; the first year is ordinary | Some years are hungry without collapsing the region at once |
| Famine prices | The scarcity multiplier can reach 3, and free meals stop under eight days of food | Hunger reaches the poor first, as it should |
| Trades | Customers weigh trade demand and price; weekly staff review with layoffs, closures, hiring and reopenings; a building keeps its trade | The tools in each workshop's interior come from its trade |
| Performance | Every new field is declared when a person, household or business is created | Adding and deleting properties on the fly made V8 run the tick about twice as slow |

## Roadmap

1. **Deepen this region.** More life inside buildings (cooking, visitors at the
   table), the first-winter dip of the poorest, the first spring's food price
   peak; watch several seeds.
2. **Visuals.** Character and building sprites on top of the painted style; portraits.
3. **Much later.** The protagonist, the RPG layer and the AI agents on top of
   `src/engine/index.js`.

## Not yet verified

- Long play sessions with mouse and keyboard.
- The viewer's narrow-screen layout.
