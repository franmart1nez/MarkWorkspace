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
│  ├─ schedule.js     sunrise and sunset, bedtimes, working hours, meals, sleep debt
│  ├─ crime.js        character, crime, the watch and the courts, corruption, hidden tax
│  ├─ ills.js         illness, accidents at work, the weather of the year, hail, blight, murrain
│  ├─ trades.js       demand between trades, hiring, layoffs, closures, reopenings
│  ├─ economy.js      purses, wages, prices, rents, taxes, the weekly round
│  ├─ interior.js     rooms, furniture and spots in buildings; seating
│  ├─ wild.js         animals and the wolf pack
│  ├─ fate.js         wounds, deaths, funerals, banishment, successions
│  └─ index.js        public API
├─ src/ui/            viewer: main.js (camera, input, panels), render.js (painted style, interiors), qol.js, viewer-tools.js, style.css
├─ scripts/           sim.mjs (headless run), layout-stats.mjs
├─ test/              engine, economy, lives and viewer-tool tests (node --test)
├─ archive/v1-continent/   the previous continent version, unchanged
├─ docs/design.md     rules, data model, the owner's answers
├─ server.mjs         local static server on port 5179
└─ index.html         viewer entry point
```

## Public API (`src/engine/index.js`)

| Export | Purpose |
| --- | --- |
| `createWorld(seed)` | Generate a new world from a seed |
| `step(state)` / `run(state, minutes)` | Advance one minute / several — the only functions that change the world |
| `serialize(state)` / `deserialize(json)` | Save and load (version 4 saves only; checks the economy, seating, timetable, crime and illness fields) |
| `fingerprint(state)` | Short hash of the state, used by determinism tests |
| `getLayout(state)` | The region: buildings, roads, fields, trees, river, sites |
| `describe`, `needsOf`, `placeName` | Read helpers for inspectors and future narrators |
| `dateOf`, `foodDays`, `priceOf`, `fullName`, `isNotable`, `jobOf` | Calendar and settlement helpers |
| `moneyTotal`, `economySummary`, `foodPrice`, `rentOf`, `housePrice`, `ownerOf`, `bizKind` | Economy read helpers |
| `interiorOf(layout, building)`, `toWorld` | A building's rooms, furniture and spots |
| `planOf(state, person, job)`, `sunOf(t)` | A person's working hours, waking and bedtime today; sunrise and sunset |
| `honesty(person)`, `temper(person)`, `ILLS` | Character worked out from traits; the illnesses |
| `DAY`, `WEEK`, `SEASON_DAYS`, `YEAR_DAYS`, `SPECIES`, `JOBS`, `BEASTS` | Constants and tables |

## World state (version 4)

```js
{
  version: 4, seed, seedText, rng, t,   // t: minutes since the start
  people: [],      // every inhabitant: home, household, trade, position, spot indoors, activity, route, needs, family, history,
                   // sleep start and debt, cells and sickness until, immunity, tonight's planned crime
  households: [],  // members, home building, purse, larder, goods, rent arrears
  occ: {},         // building id -> household id
  own: {},         // house id -> owning household (absent: the lord)
  biz: {},         // business, temple and guild purses: coins, stock, price, sales, owner
  seats: {},       // building id -> spot -> person id
  lord,            // the household living in the keep
  econ: {},        // external inflow/outflow, this week's flows, weekly history
  sites: [],       // per settlement: food store, treasury, food base price, wage bill, firewood, fear
  fields: [],      // per field: stage, work done, growth, harvested share
  herds: [], animals: [], quests: [],
  law: {},         // person id -> record: known and unknown crimes, times jailed, stolen, embezzled, grudge
  gallows: [], rites: [],   // hangings due; funerals due (time, place, mourners)
  ills: [], nextIll,        // outbreaks: illness, settlement, cases, deaths
  weather,         // this year's kind and harvest multiplier per settlement
  tally,           // this year's and last year's counts: deaths by cause, crimes, the law, abuses, trades, misfortune, vice
  levyDay,
  events: [], eventCount, born, died, tune
}
```

The layout (about 900 road nodes, 700 buildings, 300 fields and 40,000 trees)
is rebuilt from the seed on load in about 0.2 s and cached together with
per-destination route trees. A save is about 2–2.5 MB.

## The minute tick (`sim.js`)

Each `step`: once a day handle seasons, the year's weather, illness, hail and
blight, births, marriages, deaths, newcomers and wildlife breeding, and at
midnight plan the night's burglaries and murders; then every person either walks one minute along their route
or, when their activity ends, decides the next one; animals move and flee;
every 30 minutes fields grow and record the work done; every 20 minutes stores,
traders and the guild's quests are checked. Once a day the economy wears out
goods, pays pensions and adjusts prices; once a week it collects rents and
taxes (some hidden), handles evictions, house sales, profits, alms and poor
relief, reviews every workshop's staff, and lets officials, watchmen and the
lord abuse their power. A person's plan for the day (`schedule.js`) is worked
out whenever they decide, never stored. Two years of simulation take about
10 seconds headless.

## Viewer (`src/ui/`)

The painter draws the static region — meadows, fields by stage, roads, river,
bridges, buildings with hipped roofs, walls, towers and trees — into 512-pixel
pieces per zoom level, repainted gradually when the season or the crops change.
People, carts, animals, selection, night tint and lights are drawn every frame,
with positions interpolated between minutes at slow speeds. Close up (or for a
selected building) the roofs fade out and each interior — floors, walls, door,
furniture and the people at their spots — is drawn every frame.

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
| Money ledger | Total money equals the start plus counted inflows minus outflows; no purse goes negative |
| Bounded money | Over two years money per head grows less than 60%, the poorest tenth keep coins, prices stay sensible |
| Rents | Owners and tenants both exist; tenants pay most of the rent due |
| Interiors | Every building but the stalls has rooms, furniture and spots inside its walls; houses have beds and seats |
| Seating | People indoors stand inside the walls, at distinct spots, sleepers in beds; a save continues identically |
| Old saves | Version 2 and damaged saves are refused with a clear message |
| Timetables | Under 8% of homes lit at 23:00; the night watch and tavern folk awake; bakers at work at 04:00 while craftsmen sleep; farmers and children in bed by 21:45; winter nights longer than summer ones |
| A hard world | Over a year and a half: at least four causes of death beyond sickness and age, thefts and burglaries, arrests and jail, abuses of power, dice; prisoners in the barracks; the money ledger still closes; a save continues identically |
| Failed harvest | A failed year brings in far less food; famine makes a meal more than 2.4 times dearer |
| Trades | A slack workshop lets a hand go, a failing one closes without destroying coins, a busy one hires |
| v0.3 saves | Version 3 and incomplete saves are refused with a clear message |
| Viewer tools | People search, shortcuts, save recovery and save validation (5 tests) |

Status on 2026-11-11 (v0.35): 31 of 31 pass, including tests added by the quality-of-life work.
