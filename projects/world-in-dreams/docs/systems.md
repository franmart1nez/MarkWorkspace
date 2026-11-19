# Systems: rules and tuning (v0.3.5)

The detailed rules of every system in the current game, with the tuning
values in use. Numbers are tuning, not commitments; when code and this file
disagree, the code is right and this file must be corrected. A plain-language
summary for the owner is the **Systems** tab of the Workspace card
(`workspace/2026-11-10_world-in-dreams/SYSTEMS.md`). Code structure is in
[architecture.md](architecture.md).

## Scale

| Topic | Current value |
| --- | --- |
| Region | One region of 5,200 × 3,600 m (`layout.js` `W`, `H`): one walled city and five villages |
| Space | No tile grid. Positions and angles are continuous, in metres; roads are a graph of free points; spatial hashes only speed up searches |
| Tick | One minute: 1,440 per day |
| Calendar | 6-day week (Moonday, Fireday, Waterday, Woodday, Goldday, Restday), 12-day seasons, 48-day year (`core.js` constants). No months |
| Inhabitants | Every inhabitant simulated individually (about 1,800 at start) |
| Species | Humans (84% of households) plus catfolk 5%, elves 3%, dwarves 3%, halflings 3%, foxfolk 2% (`people.js` `SPECIES_MIX`) |
| Wild side | Deer, boar, rabbits, a wolf pack, sheep flocks and slimes |
| Storage | One JSON save of about 2 MB; the region layout and interiors are rebuilt from the seed |

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
  about 58,000 individual trees (seed `dreams`).
- Every building faces its street and has a door point on it; every building
  can be reached on foot from the market square (tested); roads cross the river
  only on bridges (tested).

## People (worldgen.js, sim.js, people.js)

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
  sleep (see *Timetables*), three meals at set points of the waking day (at
  home, or at work during working hours), work during the trade's hours (not on
  the rest day, except guards and taverns), shopping when the larder is low,
  prayer on the rest-day morning, tavern in the evening, strolls, visits to
  friends, children's play and lessons. Leisure always ends in time to walk home
  before bed. Walking follows the shortest road route at
  about 4 km/h (slower for children, elders and carts).
- **Pay**: wages are paid by an employer for the minutes actually worked (see
  *The economy* below); meals come from the larder, or are bought dearer while
  out when it is empty; shoppers restock for about five days at a stall, a food
  shop or the village barn. While the store holds more than eight days of food,
  nobody is left without two days of meals (alms); below that the store keeps
  what it has and the poor go hungry.

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
- The city buys village surplus only while it holds under 26 days of food, and
  pays the price of the village it comes from plus 15% for the carting. With
  more than 24 days in store it sells the excess to travelling merchants.
- Food prices: see *The economy*. Each year's weather multiplies every harvest:
  see *Illness, accidents and harvests*.

## Timetables (schedule.js)

Nothing is stored: each person's plan for the day is worked out from the date,
their trade, age, traits and sleep debt whenever they choose what to do next.

- **Sun.** Day length follows a cosine over the 48-day year: about 16 hours at
  midsummer (sunrise 04:45, sunset 20:45) and 8½ at midwinter (08:30–17:00).
  The viewer's dusk and dawn follow the same times.
- **Sleep need** is about 7½ hours in summer and 9 in winter; children need
  2½ hours more.
- **Bedtime** for people without an early trade is two hours or so after dark,
  between 20:15 and 22:00. Workers get up a set time before work and go to bed
  early enough to sleep, but never before 19:00 or before they can have supper.

| Who | Hours |
| --- | --- |
| Farmers, shepherds | Work from about sunrise to half an hour before sunset (05:00–19:30 in summer, 07:15–16:30 in winter); in bed about 20:15–21:00 |
| Bakers | Up at 03:00, at the ovens 03:30–12:30, in bed by 19:00–19:45 |
| Fishers, hunters | Out half an hour before sunrise |
| Woodcutters | Daylight only |
| Craftsmen, clerks, merchants, labourers | 07:00–17:00, half an hour later in the dark months and never long after sunset; up about an hour before work |
| Tavern folk | Until about 23:15, in bed near midnight, up around 07:00–09:00 |
| Night watch | 18:00–06:00, asleep 07:15–14:30 |
| Lord, mayor | Sit up about 50 minutes later; adventurers later still |
| Homemakers | Up 20 minutes before their spouse to make breakfast, to bed with them |
| Children | Small children 19:00–06:00; older children to bed 19:45–20:50 |
| The old | To bed half an hour earlier in the light months, up before dawn |

- The lazy get up 15 minutes later and arrive late; the diligent 15 minutes
  earlier; the dreamy and the curious sit up 20 minutes longer.
- The eve of the rest day runs 45 minutes later; on the rest day people (not
  farmers, bakers, guards or tavern folk) sleep in for about 70 minutes.
- **Sleep debt.** On waking, the shortfall of the night is added to half of the
  previous debt (at most four hours). The debt brings bedtime forward by half of
  it (at most 90 minutes) and lengthens the rest-day lie-in.
- **Meals:** breakfast on rising, the midday meal at the middle of the waking
  day less 40 minutes, supper 2½ hours before bed. Work breaks for the midday
  meal. More than seven hours without food always makes a meal due.
- A mother with a baby under a year wakes once in the night for 12–25 minutes.
- **Measured (seed dreams, spring):** 486 homes lit at 20:00, 85 at 21:00, 11 at
  22:00, about 20 at 23:00 (mothers with babies, families of tavern folk and
  adventurers), two or three at 02:00; bakeries lit from 03:00.

## Lives

- **Yearly death risk by age:** 16% in the first year, 3% to age 5, 0.6% to 15,
  0.5% to 50, 1.6% to 62, 5% to 72, 14% to 82 and 30% after; doubled in winter
  without firewood. These deaths are counted as infancy, old age, illness or
  cold.
- **Childbirth:** 3% of births are stillborn; 1.2% of mothers die.
- **Hunger** kills slowly: after nine missed meals the daily chance of dying is
  2% for every missed meal beyond seven, up to 25%.
- Accidents, illness, wild animals, crime and the gallows are described below.
- **Funerals:** family, parents, children and friends meet at the temple or
  chapel (or the house) at about 10:00 the next morning. The hanged get none.
- At 15 children start work, at 63 people retire and someone takes over their
  post. Married women have about one child every three years while young.
  Single adults marry within their settlement and move into an empty house.
  Newcomers settle when a settlement has food to spare; a family that cannot eat
  for days leaves.
- **Measured (4 years, 3 seeds):** 70–80 births and 45–80 deaths a year; the
  population grows by 0.5–1.5% a year in ordinary years. A year's deaths are
  typically 10–50 of illness, 10–18 of old age, 8–17 infants, 1–5 accidents,
  0–3 in childbirth, and now and then a murder, a brawl, a boar or hunger.

## Illness, accidents and harvests (ills.js)

**Illness.** Each settlement without an outbreak may start one; the city is
more than twice as likely; hunger doubles the chance.

| Illness | When | Lasts | Spreads per day | Daily death chance (small children / adults / old) |
| --- | --- | --- | --- | --- |
| A fever | Winter and spring | 4–9 days | 20% to each household member, 5% to someone else in the settlement | 3% / 0.4% / 2.5% |
| The bloody flux | Summer | 3–7 days | 25% household, 4.5% settlement | 4.5% / 0.3% / 2% |
| The pox | Rarely, any season | 8–14 days | 35% household, 7% settlement | 3.5% / 0.6% / 2% |

The sick stay in bed at home and pay the apothecary; the hungry and the cold die
of it more often. Survivors are immune for two years. The chronicle reports the
outbreak and, when it passes, how many fell ill and died. Most outbreaks reach
tens of people; once in a few years one sweeps a large part of the city.

**Accidents at work**, per hour of the activity (wound / death): felling timber
0.12% / 0.007%; fishing 0.025% / 0.006% (drowning); ploughing, orchards and
flocks less; a cart trip 0.4% / 0.04%; forges, roof beams, crates, casks and the
granary loft for their trades. A hunter who kills a boar is gored one time in
eight, and dies of it one time in seven of those.

**The weather of the year**, rolled every spring (the first year is ordinary):
kind 18% (harvest ×1.15), ordinary 42% (×1), middling 22% (×0.88), poor 12%
(×0.68), failed 6% (×0.45); each settlement varies by ±8%. At the start of
summer the chronicle announces a kind, poor or failed year. In the growing
months a **hailstorm** may flatten 20–55% of a settlement's fields, **blight**
or rot may take half its orchards or vegetable plots, and **murrain** may kill
half a flock.

## Trades follow demand (trades.js)

- Customers choose a workshop by what households need (blacksmith 1.3,
  carpenter 1.1, weaver, tailor and cobbler 1, potter 0.8, apothecary 0.6,
  cooper 0.55, scribe 0.35; richer families favour the scribe, tailor and
  apothecary) and by price (cheaper shops draw more).
- Workers make more if diligent (+15%) or practical (+8%), less if lazy (−20%)
  or clumsy (−15%).
- Every week each workshop and tavern compares its weekly sales (a moving
  average) and its till with its wage bill. After three weak weeks the youngest
  hand outside the owner's family is let go. After seven weak weeks with only
  the master left, it closes: the till goes to the settlement for its debts and
  the stock is lost. After three strong weeks it takes on a young labourer, the
  owner's children first, up to four hands.
- A shop closed for six weeks may be reopened when the settlement's open shops
  sell well over their wage bill: a labourer whose family has 120 coins puts 80
  of them into it and becomes the master.
- **Measured:** 3–12 people laid off a year (most in the first year, while the
  starting crews settle), one or two closures a year, a few hired.

## Crime, the law and those in power (crime.js)

**Character** comes from each person's three traits; nothing new is stored.
*Honesty* adds kind (+1.5), generous, devout, humble, patient, diligent and
cautious, and subtracts sly (−1.6), greedy (−1.4), cynical, lazy, proud and
hot-tempered. *Temper* adds hot-tempered (+1.5), proud, brave, stubborn and
cynical, and subtracts patient, kind, shy, cautious and humble. *Corrupt* means
an honesty of −1.2 or less. Drunkards are lazy and also cynical, hot-tempered,
proud, greedy or sly; gamblers are sly, or dreamy and not honest. Records live in
`S.law`, only for people who have done something.

**Temptation** to steal grows as honesty falls and with need (missed meals,
fewer than 6 coins a head, rent arrears); the honest steal only when desperate.

| Crime | Where and how | Caught (city; villages ×0.75; more for known offenders) |
| --- | --- | --- |
| Cutting a purse | At the market or the tavern, a few coins | 22–25% |
| Shoplifting | One item from a workshop counter | 30% |
| Burglary | Planned at midnight, done between 01:00 and 03:30: a rich house (10–30% of its coins, at most 60) or a till (15–35%, at most 70). Someone may wake; a hot-tempered burglar may strike them down, rarely kill | 12–16%; 35–45% if seen |
| Brawl | At the tavern, started by the hot-tempered (twice as often when drunk); the loser is hurt and holds a grudge; 1.5% of brawls kill | The watch comes 50% of the time (30% in villages) |
| Murder | A grudge (from a brawl, a beating, a false arrest, a burglary) turns, for the hot-tempered and dishonest, into a night visit to the foe's house | 55%; otherwise the killer may flee the region |
| Hiding tax | Families whose head is dishonest pay tallage on 30% of their savings and skip the hearth tax 40% of weeks | Collectors check 5% a week (3.5% in villages); the fine is twice what was hidden |

**The courts.** A corrupt watchman (or village elder) takes a bribe of twice the
value plus six coins 70% of the time when the culprit can pay. Otherwise what
was taken is returned as far as possible, and: a first petty theft is fined
5 coins plus its value (a day in the cells if it cannot be paid); repeat petty
crimes mean two days in the cells; burglary three days, assault five; a killing
in a brawl eight days and 40 coins of blood money; murder the gallows (65%, at
noon the next day) or banishment; a fourth crime of any kind, or a third
burglary or assault, banishment. Prisoners are held in the barracks and fed from
the city store. A hot-tempered watchman beats one prisoner in five.

**Vice.** Drunkards drink 2–6 coins more per evening, go to the tavern three
times as often and go even when they cannot afford it. Gamblers stake up to 15%
of the family's coins (at most 25) on four evenings in ten and win 45% of the
time.

**Those in power,** weekly. Corrupt mayors, clerks, granary keepers, elders and
stewards skim 1% of the purse they keep (at most 30 coins); an audit catches
them with a chance of 4% plus their total over 2,500, and they are dismissed,
made to pay back what they can and jailed. Corrupt watchmen extort 3–8 coins
from a stall or workshop half the weeks; an honest captain catches one 8% of the
time, a crooked one takes 30% of the take. A crooked captain throws a poor
labourer in the cells on a false charge and keeps 6 coins (5% a week). A
dishonest, greedy or proud lord with less than 2,200 coins may demand an
extraordinary levy of 4 coins from every household, at most every 24 days;
those who cannot pay fall into arrears.

**Gifts.** The devout, generous and kind give 5% of their coins at prayer, other
decent people 3%, the rest 1.5%; the greedy, the cynical and the dishonest give
nothing.

**Measured per year (3 seeds, 4 years):** 50–125 purses cut, 15–36 burglaries,
10–27 brawls, 4–17 shoplifts, 0–2 murders; 26–56 culprits caught, 11–41 jailed,
0–2 banished, a hanging every year or two; 10–24 tax fines; 0–4 officials
removed; up to 600 coins embezzled a year; 2–22 extortions; a few bribes,
beatings and false arrests. About 1,200–1,700 drinking bouts and 450–950 games
of dice.

## Interiors (interior.js)

Every building except the market stalls has a simple interior, generated from
its size, kind and the side its street door faces. Like the layout, it is
rebuilt from the seed and never saved.

| Building | Inside |
| --- | --- |
| House, farmhouse | Hall with hearth, table and chairs; one or two bedrooms with a double bed and single beds; small houses are one room |
| Tavern | Taproom with bar, barrels, hearth and tables; guest rooms with a bed each along the back |
| Workshop | Shop with counter and shelves; workroom with the tools of the trade (forge and anvil, wheel and kiln, looms, oven, vats, desks, benches…) |
| Temple, chapel | Nave with altar and candles, two columns of pews |
| Town hall | Council chamber with a long table; hall of records with clerks' desks |
| Guild | Training hall with a ring and weapon racks; common room with counter, notice board and tables |
| Keep | Great hall with throne, carpet and two feast tables; three private chambers |
| Barracks | Rows of bunks, a table, the captain's desk |
| Granary, barn, warehouse, shed | Sacks or crates in rows with aisles; a cart in the farm sheds |

- Each interior lists **spots**: beds, seats, working places, pews and places for
  customers. A person inside takes a free spot that fits the activity (sleep →
  bed, meals and visits → seat, work and training → working place, prayer and
  lessons → pew, shopping → customer place), with sensible fallbacks; their
  position becomes that spot, so people are now really inside the walls.
- Spots are chosen from a stable starting point per person, so families keep
  "their" beds. Which spots are taken is stored in the save (`S.seats`); an entry
  only counts while that person is really there, so leaving needs no
  bookkeeping, and a weekly sweep removes stale entries.
- **Viewer:** from about 4–6 pixels per metre the roofs fade out and the rooms,
  furniture and people inside appear; a selected building, or the building of a
  selected person, opens at any closer zoom. The *Interiors* toggle keeps the
  roofs on.

## The economy (economy.js)

Coins are never created by work. Every wage is paid by an employer, every
purchase moves coins between purses, and money only crosses the edge of the
region with travelling merchants, newcomers and departing families. Those flows
are counted (`S.econ.inflow`, `S.econ.outflow`), so the total can be checked; the
tests do this.

**Purses.** Households; the treasury of each settlement; each business, the
temple and the guild (`S.biz`); and the lord, who is the household in the keep.

| Who pays | Whom |
| --- | --- |
| Settlement treasury | Mayor, clerks, the city watch and its captain, granary keepers, carters, porters, farmers, shepherds, fishers, hunters, woodcutters, the village elder, labourers in the fields and stores, a small pension for the retired |
| A business | Its own workers; a day labourer it takes on for the day (only if it can pay) |
| Temple or chapel | Priest and acolytes |
| Guild | Guild clerks and a retainer for the adventurers; bounties and cull rewards |
| The lord | Steward and servants |

**Prices.**
- *Food:* each treasury sets a base price per meal so that it keeps about six
  days of its wages in hand, watching whether its coins are rising or falling so
  it does not overshoot; scarcity in the store multiplies it by 0.85–3 (above
  1.8 only in a real famine: under about four days of food in the city or ten in
  a village).
  Market stalls and food shops (bakers, butchers, millers) keep 18% of a sale.
- *Goods:* workshops make generic goods (clothes, tools, pots, shoes) from hours
  of work, buying half their materials from the settlement and half from far
  away. Each prices its goods from 5 to 24 coins by its stock and its till.
  Households wear out goods every day (richer ones faster); homemakers mend,
  spin and sew a little every day; families buy goods, and go to the tavern,
  only with what is left after a reserve for a week of food and the rent.
  Villagers whose village has no workshop walk to the city.
- *Ale:* 2 coins a drink; the tavern buys ale from a brewer and part of its wine
  and spices from far away.

**Houses.** About 40% of city families and 70% of village families own their
house; the lord holds the rest, and a few well-off city families let out houses
of their own. Rent is 0.15 coins per square metre a week in the city and 0.08 in
the villages (a typical city house: about 12 coins). A tenant four weeks behind
on the rent is evicted: to a cheaper empty house if there is one, otherwise in
with kin or friends, otherwise out of the region. Tenants with savings buy their
house (45 weeks of rent); rich owners buy empty houses to let.

**Taxes and dues, weekly unless noted.**
- Hearth tax: 3 coins a household in the city, 2 in the villages.
- Tallage: 1.5% of savings above 100 coins in the city, 1% in the villages.
- Market toll: 6% of a business's sales.
- The city pays its lord a fixed 500 coins (the farm of the town) and the guild a
  retainer; each season the villages pay the lord a quarter of what their
  treasuries hold beyond their needs, and the lord sends the king half of what
  he holds above 2,500 coins (the royal levy).

**Where surplus goes.** Owners draw 60% of a business's profit above six days of
wages; temples give their surplus to the poorest households as alms; treasuries
use what they hold beyond their needs first for poor relief (topping up the
households below 8 coins a person), then villages share the rest of their
harvest money among their households; the lord buys fine goods, and the richest
city families buy imported wine, spices and cloth from the merchants.

**Measured (2026-11-11, 4 years, seeds dreams, alpha and gamma):** at the end the
poorest tenth of households hold 32–40 coins, the middle 90–150, the richest
tenth 390–510; meals cost about 0.65–0.85 coins in the city and 0.25–0.7 in the
villages; money per head rises from about 60 to 80–96 coins over four years
(most of it in the first two). Right after the weekly rent day of the first
winter the poorest tenth can sit at 0 coins for a few weeks: city farmers earn
less in the short winter days. Switching off crime, vice, illness and gifts does
not remove this dip (known issue).

## Wildlife (wild.js)

Animals move freely over open ground in herds. Deer, boar and rabbits graze by
day, rest at night and bolt from people. The wolf pack rests in the deep woods,
hunts deer at night every couple of days, turns to sheep folds when deer are
scarce or in winter, and may attack someone alone in the countryside. Attacks
frighten the settlement; enough fear makes the guild post a bounty that up to
four adventurers answer; a destroyed pack is replaced after a month or so.
Slimes multiply in the meadows and the guild posts culls. Herds breed in spring;
a village replaces a lost flock.

## The adventurers' guild and quests (sim.js)

Every 20 minutes the world step checks the guild's notice board. When any
settlement's fear reaches 50 after wolf attacks, the guild posts a wolf bounty
(reward 120 coins, up to four adventurers). A slime herd of 11 or more gets a
cull (reward 30 plus 5 a slime, up to two adventurers). Open quests expire
after six days. Adventurers on a quest walk out, fight with a chance roll and
return; the guild pays bounties and a retainer from its purse.

## The chronicle (core.js)

`log(S, type, imp, text, x, y, who)` records an event with the minute, a type
(life, work, town, wild, quest, crime), an importance from 0 (everyday) to 3,
an optional position and an optional primary person. The list keeps the last
1,000–1,500 events (trimmed by 500 when it reaches 1,500). Each person keeps
the last 14 notes of their own life (`note`). `tally(S, group, key)` counts
this year's and last year's deaths by cause, crimes, the law's work, abuses,
trades, misfortune and vice for the Region tab.
