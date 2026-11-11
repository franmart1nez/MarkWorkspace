# World simulation: design notes (v0.2)

How the engine turns the GDD's "Simulación del mundo" into rules for a single,
closely observed region. Numbers are the current tuning, not commitments.
Everything marked **Open** is the owner's call. The continent-scale v0.1 design
is preserved with its code in `archive/v1-continent/`.

## Principles kept from the GDD

- **The engine rules.** All dynamic state is one JSON object; only `step(state)`
  changes it. The viewer only reads.
- **Determinism.** A seed fixes the region, the starting population and the whole
  history. The random generator's state is saved inside the world, so a loaded
  save continues exactly as the original would have (covered by tests).
- **Templates.** Households, trades and personalities come from data tables.

## Decisions made on 2026-11-11 (owner request)

| Topic | Decision | v0.1 |
| --- | --- | --- |
| Scale | One region of about 5.2 × 3.6 km: one large city and five villages, seen from street level up | A continent |
| Space | No tile grid. Positions and angles are continuous, in metres; roads are a graph of free points; a spatial hash is used only to speed up searches | 192 × 120 tiles |
| Tick | One minute. 1,440 per day; 6-day week, 12-day seasons, 48-day year | One day, 360-day year |
| Inhabitants | Every inhabitant is simulated individually (about 1,800–2,000) | Numbers per settlement, ~350 notables |
| Species | Humans (about 84%) plus catfolk, elves, dwarves, halflings and foxfolk | All 33 |
| Wild side | Deer, boar, rabbits, a wolf pack, sheep flocks and slimes | Raiders, dragons, undead, armies |
| Look | Painted top-down style of the art bible: terracotta roofs, pale stone walls, yellow-green fields, round tree crowns, blue river; seasonal palette and night lights | Flat tiles |
| Storage | One JSON save (about 1.5–2 MB); the region layout is rebuilt from the seed | Same principle |

## The region (layout.js)

Generated once from the seed and cached; never saved.

- **River** from north to south-west, 28 m wide, meandering through the city.
- **City**: an elliptical wall (640 × 550 m) with four gates and towers; a round
  market square west of the river with radial and ring streets; a walled citadel
  in the north-east with the keep, barracks and gardens; three bridges; a
  warehouse quarter in the south-east. Public buildings: town hall, temple,
  adventurers' guild, granary, around 15 taverns, about 65 workshops and shops,
  12 market stalls and roughly 450 houses.
- **Countryside**: four roads leave the gates; five villages (hill, forest, two
  farming, river) on wandering roads, each with a barn, tavern, chapel and 20–30
  houses; 30 farmsteads; about 300 fields (grain, vegetables, orchards,
  pastures), a forest mass in the east, rocky ground in the north-west, ponds and
  some 40,000 individual trees.
- Every building faces its street and has a door point on it; every building
  can be reached on foot from the market square (tested); roads cross the river
  only on bridges (tested).

## People (worldgen.js, sim.js)

- **Households** live in houses and farmhouses: families, couples, single
  people, elders and three-generation homes. Each household has a purse and a
  larder of meals. People have species, sex, age, three traits, an archetype, a
  dream, parents, spouse, friends and a short life history.
- **Trades** are assigned per settlement: lord, mayor, steward, clerks, servants,
  captain and 30 guards (day and night shifts, 20 fixed posts), priest and
  acolytes, guild clerks and 10 adventurers, granary keepers, carters, porters,
  merchants at the stalls, craftsmen in the shops, innkeepers and tavern hands,
  fishers, hunters, woodcutters, shepherds and farmers. Those left over hire out
  by the day or keep the house.
- **The day**: each person chooses the next activity when the current one ends —
  sleep (bedtime depends on the trade), meals every ~4.5 hours (at home, or at
  work during working hours), work during the trade's hours (not on the rest
  day, except guards and taverns), shopping when the larder is low, prayer on
  the rest-day morning, tavern in the evening, strolls, visits to friends,
  children's play and lessons. Walking follows the shortest road route at
  about 4 km/h (slower for children, elders and carts).
- **Pay**: a day's wage per trade goes to the household while working; meals
  come from the larder, or are bought at the settlement's price when it is empty;
  shoppers restock for about five days. If the store still has food, nobody is
  left without two days of meals (alms).

## Food and seasons

- One person eats three meals a day. Fields produce meals in proportion to area
  and crop (grain 1.15, vegetables 0.85, orchards 0.8); the yield is calibrated
  at world creation so that the harvest feeds about 1.2 × the population for a
  year.
- **Spring**: fields are ploughed and sown by farmers' minutes of work. Growth
  takes about 10 days for vegetables, 19 for orchards and 21 for grain, so the
  harvest runs from late spring to autumn. Reaping takes work too, and the meals
  enter the store as the field is reaped. **Winter** kills unharvested crops.
- Villages keep 40 days of food in reserve and send any surplus by cart (900
  meals per load) to the city granary; the city keeps 12. When a village falls
  under 6 days and the city has more than 16, a relief cart goes out. Fishers,
  hunters and the sheep flocks add a little food every day.
- Food prices follow the days of food in store (0.45 to 3 coins per meal).

## Lives

Yearly death risk by age (1.2% under 5, 0.4% to 50, rising to 30% over 82,
doubled in winter without firewood); starving people may die; at 15 children
start work, at 63 people retire and someone takes over their post. Couples may
have children (about one every five years while young); single adults marry
within their settlement and move into an empty house. Newcomers settle when a
settlement has food to spare; a family that cannot eat for days leaves.

## Wildlife (wild.js)

Animals move freely over open ground in herds. Deer, boar and rabbits graze by
day, rest at night and bolt from people. The wolf pack rests in the deep woods,
hunts deer at night every couple of days, turns to sheep folds when deer are
scarce or in winter, and may attack someone alone in the countryside. Attacks
frighten the settlement; enough fear makes the guild post a bounty that up to
four adventurers answer; a destroyed pack is replaced after a month or so.
Slimes multiply in the meadows and the guild posts culls. Herds breed in spring;
a village replaces a lost flock.

## Where the future layers plug in

- **RPG and AI agents** will call `src/engine/index.js`. Agents propose actions;
  an engine-side validator applies or rejects them. Individual inhabitants with
  routines, homes, relationships and histories are now available to them.
- **Graphics**: `src/ui/render.js` paints everything procedurally. Sprite sheets
  and portraits (`assets/portraits/<species>.png` already shows in the inspector)
  can replace the procedural shapes piece by piece.

## Open questions for the owner

1. **The rest of the world.** Other cities, realms and the remaining 27 species
   are deferred. Should the next step be a second region, or making this one
   deeper first?
2. **Interiors.** People disappear into buildings. Should houses, taverns and
   the guild get interiors?
3. **Money.** Wages and food sales leave households and village treasuries
   steadily richer; prices, rents and taxes are not modelled yet.
4. **Time scale.** A 48-day year keeps seasons visible in a play session. Keep it,
   or move towards a longer year?
5. **The player.** Where does the isekai protagonist enter this simulation?
