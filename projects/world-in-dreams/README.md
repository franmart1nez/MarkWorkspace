# World in Dreams

A close-up, living simulation of one fantasy city and the villages around it,
painted top-down in the style of the art bible's zoom images. Every inhabitant
is an individual who sleeps, eats, walks the streets to work, shops, prays and
drinks; fields are sown and harvested through the seasons; carts carry food to
the city granary; deer, boar, rabbits, wolves, sheep and slimes live in the
countryside. Personal project: it runs entirely on this computer and is not
meant to be published.

Source design document (Spanish, v0.2): *World in Dreams — Game Design Document*,
<https://docs.google.com/document/d/14F-5qV_trlf6DhF2MhxmbkomZVIdfHjgsf0DCxxi9Hk/edit>.

## What changed in v0.2 (2026-11-11)

The owner asked to watch the simulation from very close, like **Zoom 01** of the
art bible, instead of a continent of abstract numbers.

| v0.1 — continent | v0.2 — one region, close up |
| --- | --- |
| 192 × 120 tile grid | No grid: buildings, roads, fields, trees and people have free positions and angles in metres |
| One tick = one day | One tick = one minute; 48-day year, 12-day seasons, 6-day week |
| ~350 notables, everybody else a number | About 1,800–2,000 individual inhabitants with homes, families, trades and daily routines |
| 33 species, realms, wars, dragons | One human-majority city and five villages; six species; wildlife instead of monsters and armies |
| Flat coloured tiles | Painted roofs, walls, fields, trees and water after the art bible; seasons and night lighting |

The v0.1 engine and viewer are preserved unchanged in `archive/v1-continent/`
(open `archive/v1-continent/index.html` through the server to run it).

## Run it

Requires Node.js 22 or newer. No dependencies to install.

```
npm start        # then open http://localhost:5179
npm test         # determinism, save/load, layout, bridges, reachability, daily rhythm, a full year
npm run sim -- dreams 48 1   # headless: seed, days, minimum event importance
node scripts/layout-stats.mjs dreams   # what the region generator produced
```

On Windows you can also double-click `Start World in Dreams.cmd`.

## Viewer

- **Zoom** from the whole region (about 5 × 3.5 km) down to a single street,
  where people, carts and animals are visible. The painted scenery is cached per
  zoom level, so zooming stays smooth.
- **Click** a person, animal, building, field or settlement to inspect it.
  **Double-click** a person (or press **Follow**) to keep the camera on them
  through their day. Their route is drawn as a dotted line.
- **Speeds:** ¼ (close-up pace), 1, 6 or 30 game minutes, 3 or 12 game hours per
  second. `Space` pauses, `1`–`6` set the speed, `.` advances one minute,
  `C` frames the city, `R` the region, `F` follows, `Esc` deselects.
- **Region** tab: settlements, food stores, wildlife and the guild's notice
  board. **People** tab: search inhabitants by name or trade.
- **Save/Load** use the browser; **Export/Import** use a JSON file.
- URL shortcuts: `?seed=isekai&days=10&minutes=300&view=-70,0,6&inspect=person:12&speed=0&follow=1&tab=region`.

## What is simulated

See [the design notes](docs/design.md) for rules and numbers.

- **The region** is generated from the seed: a winding river with three city
  bridges, a walled radial city (market square, northeast citadel, southeast
  warehouse quarter, town hall, temple, guild, taverns and shops), five villages
  of different character, thirty farmsteads, roads, fields, woods, rocks and ponds.
- **People** wake, eat three meals, walk to work along real streets, return home,
  shop at the market, pray on the rest day, go to the tavern in the evening,
  visit friends, play (children), go to lessons, sleep. Guards keep posts in two
  shifts; farmers sow in spring and reap in summer and autumn; fishers, hunters,
  woodcutters, shepherds, carters, merchants and adventurers have their own
  routines. Households keep a purse and a larder.
- **Food** is grown field by field; the harvest goes to each settlement's store,
  carters bring village surpluses to the city granary and relief carts go back
  when a village is short. Prices rise when stores fall.
- **Lives:** births, marriages, ageing, retirement, death; an heir takes over a
  vacant trade; newcomers settle in empty houses; hunger can drive a family away.
- **Wildlife:** herds graze and flee from people; wolves hunt deer at night and,
  when deer are scarce or in winter, raid sheep folds and sometimes people; the
  guild posts bounties and adventurers go out to answer them; slimes multiply.
- **Chronicle:** every event is logged with date, time, type and importance;
  clicking an entry jumps to the place or person.

## Layout

```
src/engine/   the deterministic engine (no DOM, runs in Node and the browser)
  rng.js        seeded random numbers stored in the world state
  noise.js      smooth noise for terrain
  geom.js       plane geometry and a spatial index (no tile grid)
  layout.js     the region generator: river, city, villages, roads, fields, trees
  names.js      name generators, archetypes, dreams
  people.js     species of the region, trades and working hours
  core.js       calendar, walking routes, chronicle
  worldgen.js   households, trades, stores and wildlife for a new world
  sim.js        the minute tick: people, fields, seasons, carts, lives
  wild.js       animals and the wolf pack
  fate.js       wounds, deaths, successions
  index.js      public API
src/ui/       the viewer (canvas): main.js, render.js (painted style), style.css
scripts/      headless runners
test/         engine tests
archive/v1-continent/   the previous continent-scale version
docs/design.md          rules, data model, open questions
```

## Next steps

1. Watch several seeds through a few seasons and note what feels wrong.
2. Decide the open questions in the design notes (other cities and species,
   building interiors, money balance, what the player will be).
3. Sprites and portraits on top of the painted style.
4. Only then: the RPG layer and the AI agents on top of `src/engine/index.js`.
