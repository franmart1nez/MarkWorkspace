# Species

> **v0.2 (2026-11-11):** the close-up region uses six species — humans (about 84% of households), catfolk, elves, dwarves, halflings and foxfolk. The full table of all 33 species below is kept for when other cities and realms return; its data lives in `projects/world-in-dreams/archive/v1-continent/src/engine/species.js`.


**In short:** all 33 species of the GDD are in the engine as data templates
(`projects/world-in-dreams/src/engine/species.js`). Each one has a behaviour mode
that decides how it lives in the simulation.

## By behaviour

| Mode | Count | How it lives |
| --- | --- | --- |
| **Civil** | 21 | Founds settlements, farms, trades, forms realms and wages war |
| **Raider** | 6 | Lives in lairs and preys on roads and settlements (human bandits behave the same way) |
| **Dragon** | 1 | A single powerful individual with a hoard |
| **Wild** | 5 | No economy; a site whose threat grows and sometimes spills out |

Stereotypes are tendencies, not rules: each notable can draw traits from the
species' opposite pool and be marked as an exception (for example, an attractive,
civilized goblin).

## Classic (7)

| Species | Id | Mode | Habitat | Tendency | Lifespan |
| --- | --- | --- | --- | --- | --- |
| **Humans** | `human` | civil | Villages, cities and kingdoms | Adaptable and ambitious; the most numerous and the most varied in trades and beliefs. | 75 |
| **Elves** | `elf` | civil | Forests | Arrogant and beautiful; long-lived and reserved with other species. | 700 |
| **Dwarves** | `dwarf` | civil | Mountains and mines | Stubborn, fine smiths and miners; fond of gold and beer. | 250 |
| **Orcs** | `orc` | civil | Steppes and strongholds | Proud warriors who respect strength. | 55 |
| **Goblins** | `goblin` | raider | Caves | Dim, ugly and repulsive; they raid and kidnap other species, humanoids above all. Exceptions exist, such as an attractive, civilized goblin. | 35 |
| **Halflings** | `halfling` | civil | Hills and rural villages | Easygoing and fond of food; they avoid conflict. | 100 |
| **Dragons** | `dragon` | dragon | Summits and volcanoes | Powerful and greedy; they hoard treasure and believe themselves superior. | No old age |

## Beastfolk (7)

| Species | Id | Mode | Habitat | Tendency | Lifespan |
| --- | --- | --- | --- | --- | --- |
| **Catfolk** | `catfolk` | civil | Cities and roads | Agile and curious; independent and playful. | 70 |
| **Wolffolk** | `wolffolk` | civil | Forests and plains | Loyal to the pack; proud and territorial. | 65 |
| **Foxfolk** | `foxfolk` | civil | Forests and shrines | Cunning tricksters; fond of illusion magic. | 120 |
| **Rabbitfolk** | `rabbitfolk` | civil | Meadows | Timid and swift; very sociable among their own. | 50 |
| **Harpies** | `harpy` | civil | Cliffs and summits | Volatile and territorial; they live in flocks and distrust strangers. | 50 |
| **Lizardfolk** | `lizardfolk` | civil | Swamps and deserts | Pragmatic and cold; they value tradition and patience. | 80 |
| **Minotaurs** | `minotaur` | civil | Labyrinths and mountains | Strong and obstinate; they take honor very seriously. | 70 |

## Hybrid (4)

| Species | Id | Mode | Habitat | Tendency | Lifespan |
| --- | --- | --- | --- | --- | --- |
| **Centaurs** | `centaur` | civil | Plains | Proud nomads; superb archers and riders. | 70 |
| **Merfolk** | `merfolk` | civil | Seas and reefs | Capricious, with sorcery in their voices; reserved with land dwellers. | 150 |
| **Arachnids** | `arachne` | civil | Caverns and dark forests | Patient and calculating; weavers and ambush hunters. | 90 |
| **Lamias** | `lamia` | civil | Ruins and deserts | Seductive and dangerous; they collect secrets. | 200 |

## Brutes and giants (3)

| Species | Id | Mode | Habitat | Tendency | Lifespan |
| --- | --- | --- | --- | --- | --- |
| **Trolls** | `troll` | raider | Bridges, caves and swamps | Brutish and gluttonous; they regenerate and distrust sunlight. | 150 |
| **Ogres** | `ogre` | raider | Crude villages | Gluttonous and violent, though sometimes naive. | 80 |
| **Giants** | `giant` | raider | Mountains and highlands | Solitary and unsociable; they see every other species as small. | 400 |

## Fey (4)

| Species | Id | Mode | Habitat | Tendency | Lifespan |
| --- | --- | --- | --- | --- | --- |
| **Fairies** | `fairy` | civil | Enchanted forests | Mischievous and capricious; they keep their promises to the letter. | No old age |
| **Gnomes** | `gnome` | civil | Burrows and workshops | Curious, absent-minded inventors. | 300 |
| **Kobolds** | `kobold` | raider | Mines and dungeons | Cowardly and servile, but ingenious with traps; they worship dragons. | 40 |
| **Dryads** | `dryad` | civil | Ancient forests | Serene protectors of their tree; reluctant to leave it. | No old age |

## Supernatural (8)

| Species | Id | Mode | Habitat | Tendency | Lifespan |
| --- | --- | --- | --- | --- | --- |
| **Demons** | `demon` | civil | Dark lands and hells | Manipulative and proud; they bargain in pacts. | No old age |
| **Angels** | `angel` | civil | Temples and heavens | Solemn and rigid; they look on mortals with condescension. | No old age |
| **Vampires** | `vampire` | raider | Castles and cities by night | Elegant and arrogant; they live by night and on the blood of others. | No old age |
| **Undead** | `undead` | wild | Graveyards and ruins | Skeletons, zombies and liches: obedient or terrifying depending on who controls them. | Does not age |
| **Ghosts** | `ghost` | wild | Ruins and abandoned houses | Bound to unfinished business; obsessive. | Does not age |
| **Elementals** | `elemental` | wild | Volcanoes, rivers, storms and caves | Capricious and violent, like the element they embody. | Does not age |
| **Slimes** | `slime` | wild | Caves and dungeons | Simple and voracious; a few, by exception, are intelligent. | Does not age |
| **Golems and automatons** | `golem` | wild | Ancient ruins and workshops | Obedient and literal; they follow their original order until someone changes it. | Does not age |

## Attitudes between species

Baseline attitudes run from −100 (hatred) to 100 (kinship); the same species
scores 40. They come from an alignment table plus each species' openness, with
hand-set pairs that override it. Raiders attack whoever they regard below −20.

| Alignment | Species |
| --- | --- |
| folk | Most civil species |
| fey | Fairies, dryads |
| holy | Angels |
| shadow | Arachnids, lamias |
| dark | Demons, vampires, undead, ghosts |
| brute | Goblins, trolls, ogres, giants, kobolds |
| monster | Dragons, elementals, slimes, golems |

| Hand-set pair | Attitude |
| --- | --- |
| Kobold – Dragon | +80 (worship) |
| Dryad – Elf | +35 |
| Halfling – Human | +35 |
| Catfolk – Human, Elf – Fairy, Dwarf – Gnome, Undead – Vampire | +30 |
| Demon – Vampire, Catfolk – Foxfolk | +25 / +20 |
| Dwarf – Elf | −25 |
| Human – Orc, Dwarf – Orc | −35 |
| Elf – Orc | −40 |
| Angel – Demon (holy vs dark) | −95 plus openness |
