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

## What changed in v0.35 (2026-11-11)

The owner asked to concentrate on the people and make their world harsher and
more realistic: real bedtimes, trades that follow demand, people who die, and
the bad things that happen in a world where not everyone is good.

- **Timetables.** Sunrise and sunset follow the year (about 16 hours of daylight
  at midsummer, 8½ at midwinter). Farmers and shepherds work from dawn to dusk
  and are in bed by about 21:00; bakers rise at 03:00; fishers and hunters
  before dawn; craftsmen work by daylight; tavern folk close near midnight; the
  night watch sleeps by day; children go to bed at 19:30–21:00. Three meals at
  set points of the waking day. Winter nights are longer; the eve of the rest
  day runs late and the rest day starts late. A short night leaves a sleep debt,
  repaid by going to bed earlier. Mothers wake once in the night for a baby.
  At 23:00 about 20 homes stay lit, against more than 300 in v0.3.
- **Trades follow demand.** Households buy from the trades they need most and
  from cheaper shops. A workshop or tavern that cannot pay its people lets a
  hand go; one that keeps losing money closes; a busy one takes someone on; when
  the open shops are pressed, someone with savings reopens a closed one.
  Diligent workers make more, lazy and clumsy ones less.
- **Death.** Infant mortality (about one baby in six), childbirth, old age, the
  cold, slow starvation, fevers, the flux and the pox spreading through houses,
  accidents at work (falling trees, drowning, overturned carts, forges), wild
  boar and wolves, brawls, murder and the gallows. The dead get a funeral the
  next morning with family and friends.
- **Bad things.** Character now matters: the sly, greedy and desperate cut
  purses, shoplift and burgle at night; the hot-tempered start tavern brawls;
  grudges can end in murder; drunkards and gamblers ruin their families; some
  families hide their savings from the tax collectors; the greedy give nothing
  at prayer. The watch catches some: fines, the cells in the barracks,
  banishment, hanging. Those in power abuse it: officials embezzle, watchmen
  take bribes and extort the market, a crooked captain jails the poor, a
  grasping lord demands extraordinary levies. Each year has its weather, from
  kind to a failed harvest; hail, blight and murrain strike; in a famine food
  becomes so dear that the poor go hungry.

Saves from v0.3 cannot be loaded: start a new world.

## What changed in v0.3 (2026-11-11)

The owner answered the open questions: deepen this region and make it work
realistically; give buildings simple interiors; start a more realistic economy;
keep the 48-day year; leave the protagonist for much later.

- **Interiors.** Every building has rooms and furniture: beds, tables, hearths,
  counters, the tools of each trade, pews, a throne, sacks and crates. People
  inside sleep, sit, work and pray at their own spots. Close up, the roofs lift
  off and you see them (the *Interiors* toggle keeps the roofs on).
- **A closed economy.** Coins are no longer created by work. Treasuries,
  businesses, the temple, the guild and the lord pay the wages; food, goods and
  ale are bought and sold; families own or rent their houses, can be evicted or
  buy a house; hearth tax, tallage, market tolls, tribute and a royal levy are
  collected; temples and treasuries help the poorest. Prices of food and goods
  move with stores, stock and the purse of whoever sells them. Every coin that
  enters or leaves the region is counted.

Saves from v0.2 cannot be loaded: start a new world.

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
npm test         # determinism, save/load, layout, bridges, reachability, timetables, a full year, money ledger, interiors, crime and death, trades, viewer tools
npm run sim -- dreams 48 1   # headless: seed, days, minimum event importance
node scripts/layout-stats.mjs dreams   # what the region generator produced
```

On Windows you can also double-click `Start World in Dreams.cmd`.

## Viewer

- **Zoom** from the whole region (about 5 × 3.5 km) down to a single street,
  where people, carts and animals are visible. The painted scenery is cached per
  zoom level, so zooming stays smooth. Closer still, the roofs lift off and the
  interiors appear; selecting a building opens it at any close zoom.
- **Click** a person, animal, building, field or settlement to inspect it.
  **Double-click** a person (or press **Follow**) to keep the camera on them
  through their day. Their route is drawn as a dotted line.
- **Speeds:** ¼ (close-up pace), 1, 6 or 30 game minutes, 3 or 12 game hours per
  second. `Space` pauses, `1`–`6` set the speed, `.` advances one minute,
  `C` frames the city, `R` the region, `F` follows, `Esc` deselects.
- **Region** tab: settlements, food stores, the economy (who holds the money,
  household purses, prices and last week's flows), wildlife and the guild's
  notice board; **This year** counts deaths by cause, crimes, the law's work,
  abuses of power, trades opened and closed, misfortune and vice, and gives the
  harvest outlook once summer comes. Inspecting a person shows their nature,
  the hours they keep and their record with the law. Inspecting a household shows its standing, rent or ownership and
  goods; a building shows its owner, rent, till, stock and interior. **People** tab: search by name, trade, species or settlement, filter by
  settlement and indoor/outdoor/away location, and page through all results.
- **Map controls:** arrow keys pan, `+`/`-` zoom, `/` opens people search, `?`
  or `H` opens help. The map's **Panel** button hides the sidebar.
- **Save/Load** keep a manual browser checkpoint; `Ctrl`/`Cmd` + `S` saves.
  A separate recovery copy is updated every 30 seconds and on leaving the page.
  On reopening, choose **Restore** or **Keep current world** before that old copy
  can be overwritten. **Export/Import** use a JSON file. New/imported/loaded
  worlds open paused; replacing unsaved progress offers to save it first.
- Names, night lighting, chronicle filters and sidebar visibility are remembered
  in this browser. `.` pauses and advances exactly one minute.
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
  routines. Households keep a purse, a larder and their goods; inside a building
  everybody has a spot.
- **Food** is grown field by field; the harvest goes to each settlement's store,
  carters bring village surpluses to the city granary and relief carts go back
  when a village is short. Prices rise when stores fall.
- **Money** circulates between households, treasuries, businesses, the temple,
  the guild and the lord: wages, food, goods, ale, rents, taxes, tolls, alms and
  poor relief; see the design notes.
- **Lives:** births, marriages, ageing, retirement; death from many causes
  with funerals; illness that spreads; accidents; an heir takes over a vacant
  trade; newcomers settle in empty houses; hunger can drive a family away.
- **Crime and the law:** thieves, brawlers, murderers, drunkards and gamblers;
  the watch, fines, the cells, banishment and the gallows; corrupt officials,
  watchmen and lords. Trades hire, lay off, close and reopen with demand.
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
  schedule.js   sunrise and sunset, bedtimes, working hours, meals, sleep debt
  crime.js      character, crime, the watch and the courts, corruption, taxes dodged
  ills.js       illness, accidents at work, the weather of the year, hail and blight
  trades.js     demand between trades, hiring, layoffs, closures and reopenings
  economy.js    purses, wages, prices, rents, taxes, the weekly round
  interior.js   rooms, furniture and spots inside buildings; seating
  wild.js       animals and the wolf pack
  fate.js       wounds, deaths, funerals, banishment, successions
  index.js      public API
src/ui/       the viewer (canvas): main.js, render.js (painted style and interiors), qol.js, viewer-tools.js, style.css
scripts/      headless runners
test/         engine, economy, lives and viewer-tool tests
archive/v1-continent/   the previous continent-scale version
docs/design.md          rules, data model, the owner's answers
```

## Next steps

1. Keep deepening this region: more life inside buildings (cooking, visitors at
   the table), people drawn larger at mid zoom, the first spring's food price peak.
2. Sprites and portraits on top of the painted style.
3. Only much later: the protagonist, the RPG layer and the AI agents on top of
   `src/engine/index.js`.
