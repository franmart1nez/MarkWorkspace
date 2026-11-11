# Simulation rules

**In short:** one tick is one minute. A single region — one walled city and
five villages — is simulated with every inhabitant as an individual following a
daily timetable set by trade and season. People are inside buildings at real
places; money circulates in a closed economy. Fields follow the seasons and the
weather of the year, carts move the food, wildlife lives in the countryside.
People fall ill, have accidents and die; some steal, fight and kill, and those
in power abuse it. Numbers below are the current tuning, not commitments.

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
| Sleep | Set by trade, season, age and character: farmers work dawn to dusk and sleep by about 21:00, bakers rise at 03:00, tavern folk close near midnight, the night watch sleeps by day, children go to bed at 19:30–21:00; longer nights in winter; later on the eve of the rest day; a sleep debt brings bedtime forward |
| Meals | Three a day at set points of the waking day: on rising, at midday, supper before bed; at home, or at work during working hours |
| Work | During the trade's hours, not on Restday (except guards and taverns); the employer pays the household for the minutes worked |
| Shopping | Food at a stall, a food shop or the village barn when the larder runs low (about five days); goods at a workshop when the household's goods run low and there is money to spare |
| Leisure | Prayer on Restday morning, tavern in the evening, strolls on the square and the lit main streets, visits to friends, children's play and lessons |

Walking follows the shortest route on the road network at about 4 km/h; carts,
children and elders are slower. Daylight runs from about 16 hours at midsummer
to 8½ at midwinter, and the viewer's dusk follows it.

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
- The city buys village surplus only while it holds under 26 days of food, at
  the village's price plus 15%; with more than 24 days it sells to merchants.
- The price of a meal is set by each treasury (see the economy) and rises by up
  to 1.8 times when the store runs low, and up to 3 times in a real famine; free
  meals for the poor stop when the store falls under eight days.
- **The weather of the year:** kind (×1.15 harvest, 18%), ordinary (42%),
  middling (×0.88, 22%), poor (×0.68, 12%) or failed (×0.45, 6%), announced at the
  start of summer. Hail can flatten a settlement's fields, blight take its
  orchards or vegetables, murrain half a flock.

## Interiors

Every building except the market stalls has rooms and furniture fitted to its
size and kind: halls with hearth and table and bedrooms with beds in houses; a
taproom and guest rooms in taverns; a shop and a workroom with the trade's tools
in workshops; pews and an altar in the temple and chapels; desks and a council
table in the town hall; a training ring and common room in the guild; a great
hall and chambers in the keep; bunks in the barracks; sacks and crates in stores.
A person indoors takes a free bed, seat, working place, pew or customer place
that fits what they are doing; families keep their own beds.

## The economy

| Part | Rule |
| --- | --- |
| Purses | Households, the treasury of each settlement, each business, the temple, the guild, the lord |
| Wages | Treasury: officials, the watch, farmers, carters, porters, fishers, hunters, woodcutters, field and store labourers, pensions. Business: its workers and hired hands. Temple: clergy. Guild: clerks, adventurers, bounties. Lord: steward and servants |
| Food | Treasury base price aiming at six days of wages in hand; scarcity multiplier 0.85–1.8; stalls and food shops keep 18% |
| Goods | Made by workshops from hours of work (half the materials imported); 5–24 coins by stock and till; worn out daily, mended by homemakers; bought only with money to spare after food and rent |
| Ale | 2 coins; the tavern buys ale from a brewer and imports wine and spices |
| Houses | ~40% of city and ~70% of village families own theirs; others rent from the lord or a landlord family (0.15 and 0.08 coins per m² a week); four weeks behind means eviction; tenants with savings buy, the rich buy houses to let |
| Taxes | Weekly hearth tax (3 city, 2 village), tallage on savings over 100 (1.5% city, 1% village), 6% market toll; the city's fixed farm to the lord; seasonal village tribute; the lord's royal levy to the king |
| Surplus | Owners draw business profit; temples give alms; treasuries give poor relief, then villages share harvest money; the lord and the richest families buy imported luxuries |
| External money | Merchants (lodging, dues, food bought and sold, goods), newcomers and departing families; all counted so the total can be checked |

## Trades follow demand

Households buy from the trades they need most and from cheaper shops. A
workshop or tavern that cannot pay its people lets a hand go; one that keeps
losing money closes; a busy one takes someone on; a closed one can be reopened
by a family with savings when the open shops are pressed. Diligent workers make
more, lazy and clumsy ones less.

## Lives and deaths

- Children start work at 15; people retire at 63 and a labourer takes their post.
- Yearly death risk by age: about one baby in six dies in its first year; risk
  is low through adulthood and rises steeply after 60; it doubles in winter
  without firewood. 3% of births are stillborn and about one mother in eighty
  dies in childbirth. The starving die slowly.
- **Illness:** fevers in winter and spring, the flux in summer, rarely the pox;
  they pass through households and neighbours; the sick stay in bed; small
  children, the old and the hungry die most; survivors are immune for two years.
- **Accidents at work:** falling trees, drowning, overturned carts, forges, roof
  beams; a cornered boar can gore a hunter.
- **Funerals** the next morning at the temple or chapel with family and friends.
- Couples have children; single adults marry and move into an empty house.
- Newcomers arrive when a settlement has food to spare; a family that cannot eat
  for days leaves the region.
- About 70–80 births and 45–80 deaths a year; the population grows slowly in
  ordinary years.

## Crime, the law and those in power

| Part | Rule |
| --- | --- |
| Character | Worked out from each person's three traits: honesty (kind, generous, devout up; sly, greedy, cynical down) and temper (hot-tempered, proud up; patient, kind down) |
| Theft | The dishonest and the desperate cut purses at the market and tavern, shoplift, and burgle houses and tills between 01:00 and 03:30 |
| Violence | Tavern brawls among the hot-tempered (occasionally fatal); grudges from brawls, beatings, false arrests and burglaries can end in murder |
| Vice | Drunkards drink more often and beyond their means; gamblers stake the family's coins at dice |
| Taxes and gifts | Dishonest families hide savings from the tallage and skip the hearth tax until the collectors find out; the greedy give nothing at prayer, the devout give generously |
| The law | Some culprits are caught: restitution, fines, days in the cells at the barracks, banishment after repeated crimes, the gallows for murder. A corrupt watchman or elder takes bribes; a hot-tempered one beats prisoners |
| Those in power | Corrupt officials skim the treasury until an audit catches them; corrupt watchmen extort the market; a crooked captain jails the poor; a grasping lord demands extraordinary levies |

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

Every event has a date, a time, a type (life, work, town, wild, quest, crime)
and an importance from 0 (everyday) to 3. Everyday events are hidden by default.
The Region tab's **This year** section counts deaths by cause, crimes, the law's
work, abuses, trades, misfortune and vice.
