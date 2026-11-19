# Systems: the world today

**In short:** what each part of the simulation does in version 0.3.5, in plain
words, with its main numbers and what it cannot do yet. Numbers are the current
tuning, not promises. The full rules, with every value, are in
`projects/world-in-dreams/docs/systems.md`.

| Works well ✅ | Partly there 🔶 |
| --- | --- |
| Time · People and their day · Interiors · Food and farming · Economy · Trades · Lives and death · Crime and the law · Chronicle · Viewer | The region (flat, built around the city) · Illness and misfortune · Wildlife · The adventurers' guild |

## Time

| Unit | Length |
| --- | --- |
| Tick | 1 minute |
| Day | 1,440 minutes |
| Week | 6 days: Moonday, Fireday, Waterday, Woodday, Goldday, Restday (the day off) |
| Season | 12 days: Spring, Summer, Autumn, Winter |
| Year | 48 days |

Sunrise and sunset follow the year: about 16 hours of daylight at midsummer
(04:45–20:45) and 8½ at midwinter (08:30–17:00). The map darkens at the same
times.

**Not yet:** months, a calendar you can choose, daily weather. Animals still
use fixed night hours.

## The region

Built from the seed, with free positions in metres and no tile grid. The same
seed always gives the same region.

| Part | What it holds |
| --- | --- |
| The city | An oval wall with four gates and towers, a round market square, radial and ring streets, a walled citadel with the keep and barracks, three bridges, a warehouse quarter, the town hall, temple, guild and granary, about 15 taverns, 65 workshops and 450 houses |
| Villages | Five (hill, forest, river and two farming villages), each with a barn, tavern, chapel and 20–30 houses |
| Countryside | 30 farmsteads, about 300 fields, roads, an eastern forest, rocks in the north-west, ponds and about 58,000 trees |

**Not yet:** relief, biomes, coasts, more than one river. The land is shaped
around the city, which always sits at the centre with the river running
through it.

## People and their day

About 1,800 people, each with a species, sex, age, three personality traits,
a home, a family, friends, a trade and a short life story. Humans are about 84%;
the rest are catfolk, elves, dwarves, halflings and foxfolk.

Each person decides what to do next when their current activity ends: sleep,
three meals a day, work in their trade's hours, shop when the larder is low,
pray on Restday morning, go to the tavern, stroll, visit friends; children play
and go to lessons. Hours depend on the trade and season:

| Who | Their day |
| --- | --- |
| Farmers, shepherds | Dawn to dusk; in bed by about 21:00 |
| Bakers | Up at 03:00, at the ovens until midday |
| Craftsmen, clerks, merchants | About 07:00–17:00 |
| Tavern folk | Until about 23:15 |
| Night watch | 18:00–06:00, asleep by day |
| Children | In bed between 19:00 and 21:00 |

A short night leaves a sleep debt, repaid by going to bed earlier. People walk
the shortest way along the roads at about 4 km/h.

**Not yet:** walking that avoids buildings and other people (see the audit),
social classes.

## Interiors

Every building except the market stalls has rooms and furniture: a hall and
bedrooms in houses, a taproom and guest rooms in taverns, a shop and workroom
with the trade's tools in workshops, pews in the temple, a throne in the keep,
bunks in the barracks, sacks and crates in stores. Indoors, each person takes a
free bed, seat, work place or pew that fits what they are doing, and families
keep their own beds. Close up, the roofs lift off.

**Not yet:** buildings with several floors or many rooms; people jump from the
door to their spot instead of walking.

## Food and farming

Fields are ploughed and sown in spring by the farmers' work, ripen in 10–21
days by crop, and are reaped from late spring to autumn; winter kills what is
left. Villages keep 40 days of food and send any surplus by cart to the city
granary; the city keeps 12 and sends relief carts to a hungry village. Fishers,
hunters and the flocks add a little food every day. Each spring rolls the
year's weather, from kind (harvest ×1.15) to failed (×0.45).

**Not yet:** soil or terrain affecting crops, weather affecting daily work.

## Economy

Money is never created by work. Every coin moves between purses: households,
the treasury of each settlement, each business, the temple, the guild and the
lord. Every coin that enters or leaves the region is counted, and the tests
check that the total always balances.

| Flow | How |
| --- | --- |
| Wages | Paid by the employer for the minutes worked: treasury, business, temple, guild or lord |
| Food | Priced by each treasury; up to 1.8× dearer when stores run low, up to 3× in a famine |
| Goods | Made by workshops from hours of work, priced 5–24 coins by stock and till |
| Houses | About 40% of city and 70% of village families own their house; the rest pay rent. Four weeks behind means eviction |
| Taxes | Weekly hearth tax, tallage on savings, market toll; the city pays its lord; the lord sends a levy to the king |
| Help | Temple alms and poor relief from the treasuries |

## Trades

Households buy from the trades they need most and from cheaper shops. A
workshop that cannot pay its people lets a hand go; one that keeps losing money
closes; a busy one hires; a family with savings can reopen a closed shop.
Diligent workers earn more, lazy and clumsy ones less.

**Not yet:** a workshop cannot change its trade.

## Lives and death

Children start work at 15; people retire at 63. Couples have children; single
adults marry and move into an empty house; newcomers arrive when there is food
to spare; hungry families leave. About one baby in six dies in its first year.
People also die of old age, illness, cold, slow starvation, childbirth,
accidents at work, wild animals, brawls, murder and the gallows. Funerals are
held the next morning. In a typical year: 70–80 births and 45–80 deaths.

## Illness and misfortune

| Illness | When | Lasts |
| --- | --- | --- |
| Fever | Winter and spring | 4–9 days |
| Bloody flux | Summer | 3–7 days |
| Pox | Rarely, any season | 8–14 days |

Illness spreads strongly inside households and weakly between neighbours; the
sick stay in bed; small children, the old and the hungry die most; survivors
are immune for two years. Work has its accidents: falling trees, drowning,
overturned carts, forges, roof beams. Hail, blight and murrain can ruin a
settlement's harvest or flock.

**Not yet:** fire, floods, droughts, harsh winters as events.

## Crime and the law

Honesty and temper are worked out from each person's traits. The dishonest and
the desperate cut purses, shoplift and burgle at night; the hot-tempered start
tavern brawls; grudges can end in murder. Drunkards and gamblers ruin their
families; dishonest families hide money from the tax collectors. The watch
catches some: fines, days in the cells, banishment, the gallows for murder.
Corrupt watchmen take bribes and extort the market, officials embezzle, a
crooked captain jails the poor, a greedy lord demands extra levies.

**Not yet:** bandits, organised crime, factions.

## Wildlife

| Animal | Behaviour |
| --- | --- |
| Deer, boar, rabbits | Graze by day, rest at night, bolt from people, breed in spring; hunters take some |
| Wolf pack | Rests in the deep woods, hunts deer at night, raids sheep folds in winter or when deer are scarce, may attack someone alone |
| Sheep | Stay on their pasture; give a little food; lambs in spring |
| Slimes | Drift over the meadows and multiply |

About 400 animals in 70 herds. Animals move as herds, not as individuals.

**Not yet:** hunger, thirst, ages, life cycles, more species, habitats by biome.

## The adventurers' guild

The guild in the city has clerks and ten adventurers. When wolf attacks scare a
settlement, it posts a bounty that up to four adventurers answer; large slime
clusters get a cull. A destroyed pack is replaced after about a month.

**Not yet:** ranks, parties, quests from other needs, dungeons.

## The chronicle

Every event has a date, time, type (life, work, town, wild, quest, crime) and
importance from 0 (everyday) to 3. Clicking an entry jumps to the place or
person. The Region tab's **This year** section counts deaths by cause, crimes,
the law's work, abuses, trades, misfortune and vice.

## The viewer

A painted, top-down map after the art bible: terracotta roofs, pale stone
walls, yellow-green fields, round tree crowns, a blue river; seasonal colours
and night lighting with lit windows and street lamps. Zoom runs from the whole
region to a single room. The sidebar has three tabs — **Inspect**, **Region**
and **People** — plus the chronicle, search, pins, an overview map, named
checkpoints, automatic recovery and comfort settings. Controls are listed in
**[Overview → Controls](#/world-in-dreams/2)**.

**Not yet:** a simpler screen for watching, and a separate developer console
(roadmap M6).
