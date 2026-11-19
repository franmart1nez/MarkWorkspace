# Architecture (v0.3.5)

How the code is organised, how a tick runs, what the world state contains and
how the viewer reads it. Rules and tuning values are in [systems.md](systems.md).
Known structural problems are listed at the end and in the audit
(`workspace/2026-11-10_world-in-dreams/AUDIT_2026-11-18.md`).

## Principles

| Principle | In code |
| --- | --- |
| **The engine rules** | All dynamic state is one plain JSON object `S`. Only `step(S)` changes it |
| **Determinism** | `createWorld(seed)` plus N calls to `step` always gives the same `S`. All randomness goes through `rng.js`, whose state lives in `S.rng`; a loaded save continues identically (tested) |
| **No tile grid** | Positions are metres on a plane centred on the city (0,0). Roads are a graph of points; buildings and fields are rotated rectangles; spatial hashes only accelerate queries |
| **Static layout is not saved** | The region (`layout.js`) and interiors (`interior.js`) are rebuilt from the seed and cached; the save holds only dynamic state |
| **Read-only viewer** | `src/ui/` reads `S` and the layout and never writes to them |
| **No dependencies** | Plain ES modules, no build step, Node 22+ and modern browsers |

## Files

```
projects/world-in-dreams/
├─ index.html                 viewer page (loads src/ui/main.js)
├─ server.mjs                 static server; port from argv (default 5179)
├─ Start World in Dreams.cmd  starts the server and opens the browser
├─ package.json               npm start | test | sim | roadmap
├─ src/engine/                deterministic engine, no DOM (about 4,300 lines)
├─ src/ui/                    canvas viewer (about 2,450 lines)
├─ test/                      node --test suites + optional Playwright review
├─ scripts/                   headless run, layout statistics, roadmap recount
├─ assets/portraits/          optional species portraits for the inspector
├─ docs/                      architecture.md (this file), systems.md
└─ archive/v1-continent/      abandoned v0.1 code; not part of the game
```

### Engine modules (`src/engine/`)

| Module | Lines | Responsibility |
| --- | --- | --- |
| `index.js` | 83 | Public API; `serialize`, `deserialize` (save version check), `fingerprint`, `describe`, `needsOf`, `placeName` |
| `rng.js` | 36 | Seeded generator; state in `S.rng` (or `R.rng` for the layout) |
| `noise.js` | 29 | Smooth value noise (`fbm`) for forest and rock masks |
| `geom.js` | 115 | Distances, segment tests, rotated rectangles, the `Hash` spatial index |
| `layout.js` | 792 | One `build(seed)` function: river, city wall/streets/citadel, buildings, country roads, villages, farmsteads, forest and rock masks, ponds, fields, trees, work and wild spots, lamps, towers, road adjacency. Cached for the last 3 seeds |
| `names.js` | 102 | Person, family and place names; archetypes and goals |
| `people.js` | 61 | Species mix, `JOBS` (work style, hours, wage, colour), traits, activity texts |
| `core.js` | 139 | Calendar constants and `dateOf`; road routing (Dijkstra trees per destination, cached on the layout); chronicle `log`, personal `note`, `census`, yearly `tally` |
| `worldgen.js` | 193 | `createWorld`: households in houses, trades per settlement, stores, wildlife, crop yield calibration |
| `sim.js` | 699 | The minute tick: walking, deciding the next activity, work of each trade, leisure, fields, carts, the guild's board, the daily round of lives |
| `schedule.js` | 97 | Sunrise and sunset, each person's plan for the day, meals, sleep debt — computed, never stored |
| `economy.js` | 593 | Purses, wages, prices, goods, rents, evictions, house sales, taxes, the weekly round, the money ledger |
| `trades.js` | 125 | Demand between workshops, weekly staff review, closures and reopenings |
| `crime.js` | 416 | Honesty and temper from traits, theft, burglary, brawls, murder, the courts, vice, corruption, hidden tax, gifts |
| `ills.js` | 165 | Outbreaks, accidents at work, the year's weather, hail, blight, murrain |
| `fate.js` | 115 | Wounds, deaths, funerals, banishment, replacing workers, names |
| `interior.js` | 401 | Rooms, furniture and spots per building kind; seating people at spots |
| `wild.js` | 183 | Herds and animals, grazing and fleeing, the wolf pack, breeding |

### Viewer modules (`src/ui/`)

| Module | Lines | Responsibility |
| --- | --- | --- |
| `main.js` | 874 | Boot, camera, input, the frame loop (runs `step` within a time budget), Inspect/Region/People panels, chronicle, URL parameters |
| `render.js` | 629 | The painter: static region drawn into 512-px tiles per zoom level and repainted when season or crops change; people, animals, carts, interiors, night tint and lights drawn every frame |
| `observer.js`, `observer-tools.js`, `observer.css` | 473 | Back/forward history, pins, overview map, roof modes, life-status search, event filters, alerts, timed advance, settings |
| `qol.js` | 225 | Toolbar, help and replace dialogs, browser persistence, recovery banner, preferences |
| `checkpoint-store.js` | 35 | Named checkpoints and recovery in IndexedDB |
| `viewer-tools.js` | 76 | Pure helpers: people search, keyboard shortcut map, save store, save validation |
| `style.css` | 131 | Base layout and theme |

## The minute tick

`step(S)` in `sim.js`:

1. `S.t++`.
2. At midnight, `newDay`: season change (every 12 days: sowing state, winter
   losses, the year's weather), wildlife breeding, illness, hail and blight;
   fear and food decay; for every person ageing, coming of age at 15,
   retirement at 63, yearly death risk (divided by `YEAR_DAYS`), starvation,
   births and courtship; hungry households leave; `census`; the daily economy;
   on the first day of each week the seat sweep and the weekly law and abuse
   round; newcomers; tonight's burglaries and murders are planned.
3. Every person: walk one minute along `p.route`, or, when `S.t >= p.until`,
   `decide` the next activity (which may start a route with `goB`/`goP`).
   People outdoors in the wild are collected for the wildlife step.
4. `stepWild`: herds think every 10 minutes; animals move, graze, rest and
   flee from nearby people; the wolf pack hunts.
5. Every 30 minutes `stepFields`: growth and the work done on each field.
6. Every 20 minutes (`t % 20 === 7`) `stepWorld`: the gallows, funerals, store
   alarms, travelling merchants, the guild's notice board.

A person's timetable (`planOf` in `schedule.js`) is recomputed from the date,
trade, age, traits and sleep debt whenever they decide; only `zs` (sleep start)
and `debt` are stored.

### Movement

`start` builds a route from the current place to a target `{x, y, n}` with
`route(L, from, to)`: a straight leg to road node `n`, the shortest road path
(cached Dijkstra tree towards the destination node), then a straight leg to the
target. `walk` advances 66–74 m per minute (children 52, the old 48, carts
62). On arrival at a building the person is placed inside (`p.in`) and
`seat()` moves them to a free spot that fits the activity. There is no
collision and no avoidance; see the known problems below.

## World state (save version 4)

```js
{
  version: 4, seedText, seed, rng, t,           // t: minutes since the start (the world starts at 05:00 on day 1)
  people: [ {                                   // every inhabitant ever born or arrived; dead ones stay with alive=false
    id, name, fam, sex, sp, born, age, hh, home, site, job, work,
    x, y, in, n, act, until, route, ri, na, nu, nd, db, dn, ws,  // position, building inside, activity, route and next activity
    ate, miss, soc, hurt, off, traits, arch, goal, spouse, mom, dad, friends, hist,
    alive, away, seat, shift, post, fi, farm, load, cart, wild, q, tg, to, hunts, stage,
    zs, debt, nn, jail, sick, ill, imm, plan, wd, died, gone } ],
  households: [ { id, home, site, m, pantry, coins, fam, shopT, goods, arrears, owed, goodsT } ],
  occ: {},          // building id -> household id
  own: {},          // house id -> owning household (absent: the lord)
  biz: {},          // business, temple and guild purses: coins, stock, price, sales, owner
  seats: {},        // building id -> spot index -> person id
  lord,             // household id of the lord
  econ: {},         // inflow, outflow, this week's flows, weekly history
  sites: [ { food, coins, wood, fear, short, sow, reap, price, ... } ],  // one per settlement, index = layout site
  fields: [ { st, w, g, h } ],                  // stage, work, growth, harvested share; index = layout field
  herds: [], animals: [], quests: [], nextA, nextQ,
  law: {},          // person id -> record (known and unknown crimes, jailings, stolen, embezzled, grudge)
  gallows: [], rites: [],                       // hangings and funerals due
  ills: [], nextIll,                            // outbreaks
  weather,          // this year's kind and harvest multiplier per settlement
  tally: { y, cur, prev },                      // this year's and last year's counts
  levyDay, events: [], eventCount, born, died, fv, tune: { yield }, wolfBack
}
```

**Every field is declared when its object is created** (`makePerson`,
`settle`, …). Adding or deleting properties later made V8 run the tick about
twice as slow; keep this rule for new fields.

A save is `JSON.stringify(S)`, about 2 MB. `deserialize` refuses any version
other than 4 and checks that the economy, seating, timetable, crime and illness
fields exist. The viewer additionally checks references with
`validateWorld` before replacing the current world.

## The layout (`getLayout(S)`)

| Field | Content |
| --- | --- |
| `W`, `H`, `X0…Y1` | Region size and bounds in metres |
| `nodes`, `edges`, `adj` | Road graph: `{id, x, y, city}`; `{a, b, k (0 track … 3 main street), bridge, len}`; adjacency lists |
| `blds` | Buildings: rotated rectangles `{id, k (kind), x, y, w, d, a, dx, dy (door), n, n2 (street nodes), site, name, trade}` |
| `fields` | Rotated rectangles with `crop` (grain, veg, orchard, pasture), `site`, `n` |
| `sites` | Settlements `{id, name, kind, x, y, r, n, green}`; index 0 is the city |
| `river`, `ponds`, `rocks`, `trees` | River polyline (28 m wide); ponds; rock patches; trees as a flat array `[x, y, r, look, …]` |
| `spots` | Work and wild places: fish, wood, deer, boar, rabbit, slime, den |
| `gates`, `towers`, `bridges`, `lamps`, `posts`, `exits`, `wall` | City furniture and guard posts |
| Helpers | `open(x, y)`, `riverDist`, `riverCross`, `riverSide`, `inWall`, `inPond`, `nearestNode`, `forest(x, y)`, spatial hashes, `routes` cache |

`interiorOf(L, b)` returns a building's rooms, walls, door, furniture and
spots (`bed`, `seat`, `work`, `pew`, `cust`) in local coordinates;
`toWorld(b, lx, ly)` converts them.

## Public API (`src/engine/index.js`)

| Export | Purpose |
| --- | --- |
| `createWorld(seed)` | New world from any text seed |
| `step(S)`, `run(S, minutes)` | Advance one minute or several — the only functions that change the world |
| `serialize`, `deserialize` | Save and load (version 4 only) |
| `fingerprint(S)` | Short hash of the whole state, for determinism tests |
| `getLayout(S)` | The cached region for the state's seed |
| `describe`, `needsOf`, `placeName`, `fullName`, `isNotable`, `jobOf` | Read helpers for inspectors |
| `dateOf`, `dayOf`, `seasonOf`, `ageOf`, `foodDays`, `priceOf` | Calendar and settlement helpers |
| `moneyTotal`, `economySummary`, `foodPrice`, `rentOf`, `housePrice`, `ownerOf`, `bizKind`, `luxOf`, `GOODS_PRICE` | Economy read helpers |
| `interiorOf`, `toWorld` | Interiors |
| `planOf(S, p, job)`, `sunOf(t)` | A person's plan for today; sunrise and sunset |
| `honesty(p)`, `temper(p)`, `ILLS` | Character and illnesses |
| `DAY`, `WEEK`, `SEASON_DAYS`, `YEAR_DAYS`, `SEASONS`, `SPECIES`, `JOBS`, `BEASTS`, `ACT_TEXT`, `MEALS` | Constants and tables |

## Browser persistence

| Key or store | Holds |
| --- | --- |
| `localStorage` manual save key | The manual checkpoint (Save, Ctrl+S) |
| `localStorage` recovery key, IndexedDB | Automatic recovery every 30 s and on page hide, with the previous copy rotated |
| IndexedDB checkpoints | Three named checkpoints with viewing context |
| `world-in-dreams:observer:v1` | Viewer preferences (roof mode, comfort settings, pins) |

## Tests and tools

| Command | What it does |
| --- | --- |
| `npm test` | `node --test test/*.test.mjs`: 31 tests, about 21 s |
| `npm run sim -- dreams 48 1` | Headless run: seed, days, minimum event importance to print |
| `node scripts/layout-stats.mjs dreams` | Counts what the region generator produced |
| `npm run roadmap` | Recounts the roadmap checkboxes and refreshes its progress tables (`-- --check` only reports) |
| `node test/viewer-browser.mjs` | Optional Playwright review against a running server (`npm start`); uses the workspace root's Playwright and writes to `.cache/wid-qol-review/` |

| Test file | Covers |
| --- | --- |
| `engine.test.mjs` | Same seed → same history; save and continue; one city with villages, no grid; bridges; reachability; daily rhythm; a full year of farming; state sanity |
| `economy.test.mjs` | Money ledger; bounded money over two years; rents; interiors; seating across a save; old saves refused |
| `lives.test.mjs` | Timetables; a hard world (deaths, crime, the law); failed harvest and famine prices; trades; v0.3 saves refused |
| `viewer-tools.test.mjs`, `observer-tools.test.mjs` | Search, shortcuts, save recovery and validation, framing, history, chronicle queries, timed advance, alerts |

Measured on 2026-11-18 (seed `dreams`): one 48-day year headless in about
5.0 s; 706 buildings, 894 road nodes, 306 fields, about 58,000 trees, 1,799
people, 408 animals in 70 herds; save 1.96 MB.

## Known structural problems

| Problem | Effect | Roadmap |
| --- | --- | --- |
| `layout.js` builds the land around a fixed city at (0,0); region size and village positions are constants | A generated continent needs a land-first generator | M1.1, M1.3, M4.2 |
| Calendar constants imported by ten modules; literal `48` in crop growth (`sim.js:475`); yearly chances divided by `YEAR_DAYS` | A configurable calendar would break the tuning | M1.2.5, M2.4, M5.2 |
| `wild.js` uses fixed night hours instead of `sunOf` | Animals ignore the seasons' daylight | M1.2.7 |
| Straight legs to and from road nodes; indoor jumps to spots; no avoidance | About 0.6% of walking positions are inside buildings people are not entering | M5.1 |
| Animals are herds with shared state | No needs, ages or life cycles | M1.7 |
| `sim.js` calls every system directly | Systems cannot be swapped or tested in isolation | M1.1.3, M5.5 |
| Engine on the main thread | Fast speeds compete with drawing | M5.3.2 |
