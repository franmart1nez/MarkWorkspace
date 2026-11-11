# Architecture

**In short:** a deterministic engine written in plain JavaScript (ES modules, no
dependencies) that runs both in Node and in the browser. The region layout is
generated from the seed as free geometry and never saved; the dynamic world is
one JSON object that only `step(state)` changes. The canvas viewer only reads it.

## Principles

| Principle | What it means in code |
| --- | --- |
| **The engine rules** | All dynamic state is one JSON object. Nothing outside the engine's own rules modifies it. |
| **Determinism** | The seed fixes the region, the population and the whole history. The random generator's state lives inside the world, so a loaded save continues identically. |
| **No grid** | Positions are metres on a plane. Roads are a graph of points; buildings and fields are rotated rectangles; a spatial hash only accelerates searches. |
| **Read-only viewer** | The UI never writes to the state; future RPG and AI layers will go through the same public API. |

## Layout

```
projects/world-in-dreams/
├─ src/engine/        deterministic engine (no DOM)
│  ├─ rng.js          seeded random numbers stored in the world state
│  ├─ noise.js        smooth noise for forests and rocks
│  ├─ geom.js         segments, rotated rectangles, spatial hash
│  ├─ layout.js       region generator: river, city, villages, roads, fields, trees
│  ├─ names.js        names, archetypes, dreams
│  ├─ people.js       species of the region, trades and hours, activity texts
│  ├─ core.js         calendar, shortest walking routes, chronicle
│  ├─ worldgen.js     households, trades, stores and wildlife for a new world
│  ├─ sim.js          the minute tick
│  ├─ wild.js         animals and the wolf pack
│  ├─ fate.js         wounds, deaths, successions
│  └─ index.js        public API
├─ src/ui/            viewer: main.js (camera, input, panels), render.js (painted style), style.css
├─ scripts/           sim.mjs (headless run), layout-stats.mjs
├─ test/              engine tests (node --test)
├─ archive/v1-continent/   the previous continent version, unchanged
├─ docs/design.md     rules, data model, open questions
├─ server.mjs         local static server on port 5179
└─ index.html         viewer entry point
```

## Public API (`src/engine/index.js`)

| Export | Purpose |
| --- | --- |
| `createWorld(seed)` | Generate a new world from a seed |
| `step(state)` / `run(state, minutes)` | Advance one minute / several — the only functions that change the world |
| `serialize(state)` / `deserialize(json)` | Save and load (version 2 saves only) |
| `fingerprint(state)` | Short hash of the state, used by determinism tests |
| `getLayout(state)` | The region: buildings, roads, fields, trees, river, sites |
| `describe`, `needsOf`, `placeName` | Read helpers for inspectors and future narrators |
| `dateOf`, `foodDays`, `priceOf`, `fullName`, `isNotable`, `jobOf` | Calendar and settlement helpers |
| `DAY`, `WEEK`, `SEASON_DAYS`, `YEAR_DAYS`, `SPECIES`, `JOBS`, `BEASTS` | Constants and tables |

## World state (version 2)

```js
{
  version: 2, seed, seedText, rng, t,   // t: minutes since the start
  people: [],      // every inhabitant: home, household, trade, position, activity, route, needs, family, history
  households: [],  // members, home building, purse, larder
  occ: {},         // building id -> household id
  sites: [],       // per settlement: food store, treasury, firewood, fear
  fields: [],      // per field: stage, work done, growth, harvested share
  herds: [], animals: [], quests: [],
  events: [], eventCount, born, died, tune
}
```

The layout (about 900 road nodes, 700 buildings, 300 fields and 40,000 trees)
is rebuilt from the seed on load in about 0.2 s and cached together with
per-destination route trees. A save is about 1.5–2 MB.

## The minute tick (`sim.js`)

Each `step`: once a day handle seasons, births, marriages, deaths, newcomers and
wildlife breeding; then every person either walks one minute along their route
or, when their activity ends, decides the next one; animals move and flee;
every 30 minutes fields grow and record the work done; every 20 minutes stores,
traders and the guild's quests are checked. Two years of simulation take about
nine seconds headless.

## Viewer (`src/ui/`)

The painter draws the static region — meadows, fields by stage, roads, river,
bridges, buildings with hipped roofs, walls, towers and trees — into 512-pixel
pieces per zoom level, repainted gradually when the season or the crops change.
People, carts, animals, selection, night tint and lights are drawn every frame,
with positions interpolated between minutes at slow speeds.

## Tests

| Test | Checks |
| --- | --- |
| Same seed, same history | Two runs give identical fingerprints |
| Save and continue | A loaded save continues exactly like the original |
| No grid | One city, at least four villages, free angles and positions, key buildings exist |
| Bridges | No road crosses the river except on a bridge |
| Reachability | Every building and site is reachable on foot from the market |
| Daily rhythm | Over 80% asleep at 03:00, over 45% of adults working at 11:00, people in the streets |
| A full year | Fields are sown and harvested, winter leaves stubble, population holds, no store runs out |
| Sanity | Positions finite and on the map, stores never negative, save round-trips |

Status on 2026-11-11: 8 of 8 pass.
