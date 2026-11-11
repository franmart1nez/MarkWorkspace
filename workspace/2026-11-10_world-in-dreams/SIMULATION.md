# Simulation rules

**In short:** one tick is one minute. A single region — one walled city and
five villages — is simulated with every inhabitant as an individual following a
daily routine. Fields follow the seasons, carts move the food, wildlife lives in
the countryside. Numbers below are the current tuning, not commitments.

## Time

| Unit | Length |
| --- | --- |
| Tick | 1 minute |
| Day | 1,440 minutes |
| Week | 6 days (Moonday … Restday; Restday is the day off) |
| Season | 12 days |
| Year | 48 days |

## The region

Generated from the seed with free positions and angles — there is no tile grid.

| Part | What it holds |
| --- | --- |
| City | Elliptical wall with four gates and towers, round market square, radial and ring streets, citadel with keep and barracks, three bridges, warehouse quarter, town hall, temple, guild, granary, ~15 taverns, ~65 workshops, ~450 houses |
| Villages | Five (hill, forest, two farming, river), each with barn, tavern, chapel and 20–30 houses |
| Countryside | 30 farmsteads, ~300 fields (grain, vegetables, orchards, pastures), roads, an eastern forest, north-western rocks, ponds, ~40,000 trees |

## A day in the life

| Activity | Rule |
| --- | --- |
| Sleep | Bedtime and waking depend on the trade (bakers and fishers rise early, innkeepers close late, night guards sleep by day) |
| Meals | Three a day, about 4.5 hours apart: at home, or at work during working hours |
| Work | During the trade's hours, not on Restday (except guards and taverns); wages go to the household |
| Shopping | At the market or the village barn when the larder runs low; restock for about five days |
| Leisure | Prayer on Restday morning, tavern in the evening, strolls on the square and the lit main streets, visits to friends, children's play and lessons |

Walking follows the shortest route on the road network at about 4 km/h; carts,
children and elders are slower.

## Trades

| Group | Trades |
| --- | --- |
| Rule and order | Lord, mayor, steward, clerks, servants, captain, 30 guards in two shifts at 20 posts |
| Faith and guild | Priest, acolytes, guild clerks, 10 adventurers |
| Food | Farmers, shepherds, fishers, hunters, granary keepers, carters |
| Trade and craft | Merchants at the stalls, porters at the warehouses, bakers, smiths, carpenters, potters, weavers, tailors, cobblers, butchers, brewers, apothecaries, scribes, coopers, millers |
| Taverns | Innkeepers and tavern hands |
| Others | Woodcutters, day labourers, homemakers, retired people, children, travelling merchants who come and go |

## Food and seasons

- **Spring:** farmers plough and sow; each field needs a share of their working
  minutes. Grain ripens in about 21 days, orchards 19, vegetables 10.
- **Summer and autumn:** ripe fields are reaped; meals enter the settlement's
  store as each field is cut.
- **Winter:** unharvested crops are lost; fields rest under frost.
- Villages keep 40 days of food, the city 12; surplus goes to the city granary by
  cart (900 meals a load). A village under 6 days gets a relief cart.
- Price per meal follows the days of food in store, from 0.45 to 3 coins.

## Lives

- Children start work at 15; people retire at 63 and a labourer takes their post.
- Yearly death risk rises with age and doubles in winter without firewood.
- Couples have children; single adults marry and move into an empty house.
- Newcomers arrive when a settlement has food to spare; a family that cannot eat
  for days leaves the region.

## Wildlife

| Animal | Behaviour |
| --- | --- |
| Deer, boar, rabbits | Graze by day, rest at night, bolt from people; breed in spring; hunters take some for the larder |
| Wolf pack | Rests in the deep woods; hunts deer at night; in winter or when deer are scarce raids sheep folds and may attack people alone in the countryside; a new pack arrives a month after one is destroyed |
| Sheep | Stay on their pasture with a shepherd; give a little food daily; lambs in spring |
| Slimes | Drift over the meadows and multiply |

Wolf attacks frighten the settlement; the Adventurers' Guild then posts a bounty
and up to four adventurers go out. Large slime clusters get a cull quest.

## Chronicle

Every event has a date, a time, a type (life, work, town, wild, quest) and an
importance from 0 (everyday) to 3. Everyday events are hidden by default.
