// The 33 species of the GDD ("Razas y especies"), as data templates.
//
// mode:   civil  - founds settlements, farms, trades, joins factions, wages war
//         raider - lives in lairs and preys on roads and settlements
//         dragon - a single powerful individual with a hoard
//         wild   - no economy; a site whose threat grows and sometimes spills out
// farm/fert/might/mil/trade are multipliers around 1 (human baseline).
// life is lifespan in years (>= 1000 means it does not die of old age).
// open (0..1) is openness to other species, aggr (0..1) eagerness for war.
// traits is the stereotype pool; anti is the pool for individuals who deviate.
import { B } from './map.js';

const { SHALLOWS: SH, PLAINS: PL, STEPPE: ST, FOREST: FO, DEEPWOOD: DW, ENCHANTED: EN, HILLS: HI,
  MOUNTAIN: MO, PEAK: PK, VOLCANO: VO, SWAMP: SW, DESERT: DE, TUNDRA: TU, DARKLANDS: DK } = B;

const D = { farm: 1, fert: 1, might: 1, mil: 1, trade: 1, life: 75, open: 0.5, aggr: 0.4, pm: 1 };

const LIST = [
  // ---- Classic ----
  { id: 'human', name: 'Human', plural: 'Humans', group: 'Classic', mode: 'civil', align: 'folk', style: 'human', color: '#e0b48a',
    biomes: [PL, FO, HI], trade: 1.2, open: 0.7, aggr: 0.5,
    habitat: 'Villages, cities and kingdoms',
    tendency: 'Adaptable and ambitious; the most numerous and the most varied in trades and beliefs.',
    traits: ['adaptable', 'ambitious', 'industrious', 'devout', 'curious'], anti: ['complacent', 'unambitious', 'rigid', 'cynical'] },
  { id: 'elf', name: 'Elf', plural: 'Elves', group: 'Classic', mode: 'civil', align: 'folk', style: 'elf', color: '#9fe0a0',
    biomes: [FO, DW, EN], fert: 0.45, might: 1.3, mil: 1.1, trade: 0.8, life: 700, open: 0.3, aggr: 0.35, pm: 0.7,
    habitat: 'Forests',
    tendency: 'Arrogant and beautiful; long-lived and reserved with other species.',
    traits: ['arrogant', 'graceful', 'reserved', 'patient', 'proud'], anti: ['humble', 'clumsy', 'outgoing', 'reckless'] },
  { id: 'dwarf', name: 'Dwarf', plural: 'Dwarves', group: 'Classic', mode: 'civil', align: 'folk', style: 'dwarf', color: '#c98b5a',
    biomes: [MO, HI], fert: 0.7, might: 1.4, mil: 1.2, trade: 1.3, life: 250, aggr: 0.4, pm: 0.8,
    habitat: 'Mountains and mines',
    tendency: 'Stubborn, fine smiths and miners; fond of gold and beer.',
    traits: ['stubborn', 'industrious', 'gold-loving', 'hard-drinking', 'loyal'], anti: ['flexible', 'lazy', 'generous', 'teetotal'] },
  { id: 'orc', name: 'Orc', plural: 'Orcs', group: 'Classic', mode: 'civil', align: 'folk', style: 'orc', color: '#7fa05a',
    biomes: [ST, DE], fert: 1.2, might: 1.6, mil: 1.7, trade: 0.5, life: 55, open: 0.3, aggr: 0.9, pm: 0.9,
    habitat: 'Steppes and strongholds',
    tendency: 'Proud warriors who respect strength.',
    traits: ['proud', 'fierce', 'honor-bound', 'blunt', 'strength-worshipping'], anti: ['gentle', 'scholarly', 'diplomatic', 'timid'] },
  { id: 'goblin', name: 'Goblin', plural: 'Goblins', group: 'Classic', mode: 'raider', align: 'brute', style: 'goblin', color: '#6b8f3a',
    biomes: [HI, MO, FO], fert: 2.2, might: 0.5, life: 35, open: 0.05,
    raid: { settle: true, roads: true, kidnap: true, range: 30, freq: 1 }, lair: 'goblin cave', lairPop: [80, 220], cap: 420,
    habitat: 'Caves',
    tendency: 'Dim, ugly and repulsive; they raid and kidnap other species, humanoids above all. Exceptions exist, such as an attractive, civilized goblin.',
    traits: ['dim-witted', 'greedy', 'cruel', 'cowardly', 'filthy'], anti: ['clever', 'civilized', 'charming', 'brave', 'fastidious'] },
  { id: 'halfling', name: 'Halfling', plural: 'Halflings', group: 'Classic', mode: 'civil', align: 'folk', style: 'halfling', color: '#e6c56a',
    biomes: [HI, PL], farm: 1.25, might: 0.6, mil: 0.6, life: 100, open: 0.7, aggr: 0.08, pm: 0.8,
    habitat: 'Hills and rural villages',
    tendency: 'Easygoing and fond of food; they avoid conflict.',
    traits: ['easygoing', 'gluttonous', 'peace-loving', 'homely', 'cheerful'], anti: ['adventurous', 'ascetic', 'hot-headed', 'restless'] },
  { id: 'dragon', name: 'Dragon', plural: 'Dragons', group: 'Classic', mode: 'dragon', align: 'monster', style: 'dark', color: '#e0503a',
    biomes: [PK, VO], life: 3000, open: 0.05, lair: 'dragon lair',
    habitat: 'Summits and volcanoes',
    tendency: 'Powerful and greedy; they hoard treasure and believe themselves superior.',
    traits: ['greedy', 'haughty', 'territorial', 'vain', 'wrathful'], anti: ['generous', 'humble', 'curious about mortals', 'gentle'] },

  // ---- Beastfolk ----
  { id: 'catfolk', name: 'Catfolk', plural: 'Catfolk', group: 'Beastfolk', mode: 'civil', align: 'folk', style: 'beast', color: '#f0a060',
    biomes: [PL, FO, HI], mil: 0.8, trade: 1.3, life: 70, open: 0.85, aggr: 0.3, pm: 0.8,
    habitat: 'Cities and roads',
    tendency: 'Agile and curious; independent and playful.',
    traits: ['agile', 'curious', 'independent', 'playful', 'fickle'], anti: ['clumsy', 'dutiful', 'serious', 'clingy'] },
  { id: 'wolffolk', name: 'Wolffolk', plural: 'Wolffolk', group: 'Beastfolk', mode: 'civil', align: 'folk', style: 'beast', color: '#9aa3b5',
    biomes: [FO, PL], might: 1.3, mil: 1.3, trade: 0.7, life: 65, open: 0.4, aggr: 0.6,
    habitat: 'Forests and plains',
    tendency: 'Loyal to the pack; proud and territorial.',
    traits: ['loyal', 'proud', 'territorial', 'disciplined', 'protective'], anti: ['lone-wolf', 'meek', 'easygoing', 'treacherous'] },
  { id: 'foxfolk', name: 'Foxfolk', plural: 'Foxfolk', group: 'Beastfolk', mode: 'civil', align: 'folk', style: 'beast', color: '#e88a3c',
    biomes: [FO, EN], might: 0.9, mil: 0.8, trade: 1.2, life: 120, open: 0.55, aggr: 0.3,
    habitat: 'Forests and shrines',
    tendency: 'Cunning tricksters; fond of illusion magic.',
    traits: ['cunning', 'deceitful', 'charming', 'illusion-loving', 'playful'], anti: ['honest', 'blunt', 'gullible', 'earnest'] },
  { id: 'rabbitfolk', name: 'Rabbitfolk', plural: 'Rabbitfolk', group: 'Beastfolk', mode: 'civil', align: 'folk', style: 'beast', color: '#f2d9d0',
    biomes: [PL], farm: 1.2, fert: 1.6, might: 0.6, mil: 0.6, trade: 0.9, life: 50, open: 0.6, aggr: 0.1,
    habitat: 'Meadows',
    tendency: 'Timid and swift; very sociable among their own.',
    traits: ['timid', 'swift', 'sociable', 'gentle', 'skittish'], anti: ['fearless', 'aloof', 'fierce', 'solitary'] },
  { id: 'harpy', name: 'Harpy', plural: 'Harpies', group: 'Beastfolk', mode: 'civil', align: 'folk', style: 'sea', color: '#b58ad6', fly: true,
    biomes: [MO, PK, HI], fert: 0.9, might: 1.1, mil: 1.3, trade: 0.4, life: 50, open: 0.15, aggr: 0.55, pm: 0.5,
    habitat: 'Cliffs and summits',
    tendency: 'Volatile and territorial; they live in flocks and distrust strangers.',
    traits: ['volatile', 'territorial', 'flock-minded', 'suspicious', 'shrill'], anti: ['calm', 'welcoming', 'solitary', 'trusting'] },
  { id: 'lizardfolk', name: 'Lizardfolk', plural: 'Lizardfolk', group: 'Beastfolk', mode: 'civil', align: 'folk', style: 'lizard', color: '#5fb39a',
    biomes: [SW, DE], might: 1.2, mil: 1.1, trade: 0.7, life: 80, open: 0.35,
    habitat: 'Swamps and deserts',
    tendency: 'Pragmatic and cold; they value tradition and patience.',
    traits: ['pragmatic', 'cold', 'traditional', 'patient', 'stoic'], anti: ['sentimental', 'warm', 'innovative', 'impulsive'] },
  { id: 'minotaur', name: 'Minotaur', plural: 'Minotaurs', group: 'Beastfolk', mode: 'civil', align: 'folk', style: 'giant', color: '#a8744f',
    biomes: [MO, HI], might: 2.2, mil: 1.4, trade: 0.6, life: 70, open: 0.35, aggr: 0.55, pm: 0.6,
    habitat: 'Labyrinths and mountains',
    tendency: 'Strong and obstinate; they take honor very seriously.',
    traits: ['strong', 'obstinate', 'honorable', 'solemn', 'short-tempered'], anti: ['flexible', 'dishonorable', 'jovial', 'gentle'] },

  // ---- Hybrids ----
  { id: 'centaur', name: 'Centaur', plural: 'Centaurs', group: 'Hybrid', mode: 'civil', align: 'folk', style: 'sea', color: '#c9a36b',
    biomes: [PL, ST], might: 1.5, mil: 1.4, trade: 0.7, life: 70, open: 0.35, aggr: 0.5, pm: 0.8,
    habitat: 'Plains',
    tendency: 'Proud nomads; superb archers and riders.',
    traits: ['proud', 'nomadic', 'keen-eyed', 'free-spirited', 'haughty'], anti: ['humble', 'settled', 'friendly to outsiders', 'sedentary'] },
  { id: 'merfolk', name: 'Merfolk', plural: 'Merfolk', group: 'Hybrid', mode: 'civil', align: 'folk', style: 'sea', color: '#5ac8e0',
    biomes: [SH], mil: 0.9, trade: 0.6, life: 150, open: 0.2, aggr: 0.3,
    habitat: 'Seas and reefs',
    tendency: 'Capricious, with sorcery in their voices; reserved with land dwellers.',
    traits: ['capricious', 'enchanting-voiced', 'reserved', 'vain', 'curious about land'], anti: ['steadfast', 'tone-deaf', 'outgoing', 'humble'] },
  { id: 'arachne', name: 'Arachne', plural: 'Arachnids', group: 'Hybrid', mode: 'civil', align: 'shadow', style: 'dark', color: '#8a6fb0',
    biomes: [DW, FO], might: 1.4, mil: 1.1, trade: 0.8, life: 90, open: 0.2, aggr: 0.45, pm: 0.6,
    habitat: 'Caverns and dark forests',
    tendency: 'Patient and calculating; weavers and ambush hunters.',
    traits: ['patient', 'calculating', 'meticulous', 'predatory', 'reclusive'], anti: ['impulsive', 'scatterbrained', 'warm', 'gregarious'] },
  { id: 'lamia', name: 'Lamia', plural: 'Lamias', group: 'Hybrid', mode: 'civil', align: 'shadow', style: 'lizard', color: '#d67fa0',
    biomes: [DE, ST], might: 1.3, trade: 0.9, life: 200, open: 0.3, pm: 0.6,
    habitat: 'Ruins and deserts',
    tendency: 'Seductive and dangerous; they collect secrets.',
    traits: ['seductive', 'dangerous', 'secretive', 'possessive', 'cunning'], anti: ['shy', 'harmless', 'forthright', 'generous'] },

  // ---- Brutes and giants ----
  { id: 'troll', name: 'Troll', plural: 'Trolls', group: 'Brutes and giants', mode: 'raider', align: 'brute', style: 'giant', color: '#6f8a6a',
    biomes: [SW, HI, FO], fert: 0.4, might: 6, life: 150, open: 0.05,
    raid: { roads: true, range: 18, freq: 0.7 }, lair: 'troll den', lairPop: [5, 14], cap: 24,
    habitat: 'Bridges, caves and swamps',
    tendency: 'Brutish and gluttonous; they regenerate and distrust sunlight.',
    traits: ['brutish', 'gluttonous', 'sun-shy', 'suspicious', 'dull'], anti: ['gentle', 'thoughtful', 'trusting', 'clever'] },
  { id: 'ogre', name: 'Ogre', plural: 'Ogres', group: 'Brutes and giants', mode: 'raider', align: 'brute', style: 'orc', color: '#a08a5a',
    biomes: [HI, SW, PL], fert: 0.7, might: 4, life: 80, open: 0.1,
    raid: { settle: true, roads: true, range: 28, freq: 0.8 }, lair: 'ogre village', lairPop: [25, 60], cap: 110,
    habitat: 'Crude villages',
    tendency: 'Gluttonous and violent, though sometimes naive.',
    traits: ['gluttonous', 'violent', 'naive', 'crude', 'boastful'], anti: ['gentle', 'shrewd', 'refined', 'modest'] },
  { id: 'giant', name: 'Giant', plural: 'Giants', group: 'Brutes and giants', mode: 'raider', align: 'brute', style: 'giant', color: '#b0b8c8',
    biomes: [MO, TU, HI], fert: 0.15, might: 25, life: 400, open: 0.05,
    raid: { settle: true, range: 30, freq: 0.3 }, lair: 'giant steading', lairPop: [2, 6], cap: 9,
    habitat: 'Mountains and highlands',
    tendency: 'Solitary and unsociable; they see every other species as small.',
    traits: ['solitary', 'aloof', 'condescending', 'slow to anger', 'territorial'], anti: ['sociable', 'curious about small folk', 'gentle', 'humble'] },

  // ---- Fey ----
  { id: 'fairy', name: 'Fairy', plural: 'Fairies', group: 'Fey', mode: 'civil', align: 'fey', style: 'fey', color: '#f0a8e8', fly: true,
    biomes: [EN, FO], fert: 0.6, might: 0.7, mil: 0.8, trade: 0.5, life: 2000, open: 0.3, aggr: 0.3, pm: 0.5,
    habitat: 'Enchanted forests',
    tendency: 'Mischievous and capricious; they keep their promises to the letter.',
    traits: ['mischievous', 'capricious', 'literal-minded', 'playful', 'oath-bound'], anti: ['serious', 'steady', 'straightforward', 'solemn'] },
  { id: 'gnome', name: 'Gnome', plural: 'Gnomes', group: 'Fey', mode: 'civil', align: 'folk', style: 'fey', color: '#e07a6a',
    biomes: [HI, FO], fert: 0.8, might: 0.6, mil: 0.6, trade: 1.5, life: 300, open: 0.75, aggr: 0.1, pm: 0.6,
    habitat: 'Burrows and workshops',
    tendency: 'Curious, absent-minded inventors.',
    traits: ['inventive', 'curious', 'absent-minded', 'talkative', 'tinkering'], anti: ['traditional', 'incurious', 'focused', 'taciturn'] },
  { id: 'kobold', name: 'Kobold', plural: 'Kobolds', group: 'Fey', mode: 'raider', align: 'brute', style: 'goblin', color: '#c07a4a',
    biomes: [MO, HI], fert: 1.8, might: 0.4, life: 40, open: 0.1,
    raid: { roads: true, range: 22, freq: 0.8 }, lair: 'kobold warren', lairPop: [60, 160], cap: 300,
    habitat: 'Mines and dungeons',
    tendency: 'Cowardly and servile, but ingenious with traps; they worship dragons.',
    traits: ['cowardly', 'servile', 'trap-clever', 'dragon-worshipping', 'skittish'], anti: ['brave', 'defiant', 'straightforward', 'independent'] },
  { id: 'dryad', name: 'Dryad', plural: 'Dryads', group: 'Fey', mode: 'civil', align: 'fey', style: 'elf', color: '#7fd07a',
    biomes: [DW, EN, FO], fert: 0.3, might: 1.2, trade: 0.2, life: 2000, open: 0.25, aggr: 0.15, pm: 0.3,
    habitat: 'Ancient forests',
    tendency: 'Serene protectors of their tree; reluctant to leave it.',
    traits: ['serene', 'protective', 'rooted', 'gentle', 'wary'], anti: ['restless', 'wandering', 'wrathful', 'careless'] },

  // ---- Supernatural ----
  { id: 'demon', name: 'Demon', plural: 'Demons', group: 'Supernatural', mode: 'civil', align: 'dark', style: 'dark', color: '#d0405a',
    biomes: [DK], farm: 0.9, fert: 0.6, might: 2, mil: 1.6, trade: 0.9, life: 2000, open: 0.2, aggr: 0.75, pm: 0.7,
    habitat: 'Dark lands and hells',
    tendency: 'Manipulative and proud; they bargain in pacts.',
    traits: ['manipulative', 'proud', 'deal-making', 'ruthless', 'charismatic'], anti: ['honest', 'humble', 'merciful', 'guileless'] },
  { id: 'angel', name: 'Angel', plural: 'Angels', group: 'Supernatural', mode: 'civil', align: 'holy', style: 'holy', color: '#fff2b0', fly: true,
    biomes: [PK, MO], fert: 0.2, might: 2.5, mil: 1.6, trade: 0.3, life: 3000, open: 0.3, pm: 0.3,
    habitat: 'Temples and heavens',
    tendency: 'Solemn and rigid; they look on mortals with condescension.',
    traits: ['solemn', 'rigid', 'condescending', 'righteous', 'dutiful'], anti: ['playful', 'lenient', 'humble', 'doubting'] },
  { id: 'vampire', name: 'Vampire', plural: 'Vampires', group: 'Supernatural', mode: 'raider', align: 'dark', style: 'dark', color: '#a02040',
    biomes: [DW, FO, HI, DK], fert: 0.2, might: 8, life: 3000, open: 0.1,
    raid: { settle: true, feed: true, range: 26, freq: 1.2 }, lair: 'vampire castle', lairPop: [8, 20], cap: 40,
    habitat: 'Castles and cities by night',
    tendency: 'Elegant and arrogant; they live by night and on the blood of others.',
    traits: ['elegant', 'arrogant', 'nocturnal', 'predatory', 'refined'], anti: ['uncouth', 'humble', 'remorseful', 'gentle'] },
  { id: 'undead', name: 'Undead', plural: 'Undead', group: 'Supernatural', mode: 'wild', align: 'dark', style: 'dark', color: '#b8c0a8',
    biomes: [DK, SW, PL, HI], might: 0.8, life: 9999, open: 0, lair: 'cursed graveyard', grow: 0.16, horde: 2.2,
    habitat: 'Graveyards and ruins',
    tendency: 'Skeletons, zombies and liches: obedient or terrifying depending on who controls them.',
    traits: ['obedient', 'relentless', 'hollow', 'dreadful'], anti: ['self-willed', 'sorrowful', 'gentle'] },
  { id: 'ghost', name: 'Ghost', plural: 'Ghosts', group: 'Supernatural', mode: 'wild', align: 'dark', style: 'human', color: '#c8e0f0',
    biomes: [PL, FO, HI, SW], life: 9999, open: 0, lair: 'haunted ruin', grow: 0.06,
    habitat: 'Ruins and abandoned houses',
    tendency: 'Bound to unfinished business; obsessive.',
    traits: ['obsessive', 'sorrowful', 'bound', 'restless'], anti: ['at peace', 'forgetful', 'kindly'] },
  { id: 'elemental', name: 'Elemental', plural: 'Elementals', group: 'Supernatural', mode: 'wild', align: 'monster', style: 'giant', color: '#f0903a',
    biomes: [VO, PK, SW, MO], might: 3, life: 9999, open: 0, lair: 'elemental node', grow: 0.1, horde: 0.5,
    habitat: 'Volcanoes, rivers, storms and caves',
    tendency: 'Capricious and violent, like the element they embody.',
    traits: ['capricious', 'violent', 'primal', 'untamed'], anti: ['calm', 'gentle', 'curious'] },
  { id: 'slime', name: 'Slime', plural: 'Slimes', group: 'Supernatural', mode: 'wild', align: 'monster', style: 'fey', color: '#70d0b0',
    biomes: [HI, MO, SW, FO], might: 0.3, life: 9999, open: 0, lair: 'slime cave', grow: 0.2, horde: 3,
    habitat: 'Caves and dungeons',
    tendency: 'Simple and voracious; a few, by exception, are intelligent.',
    traits: ['simple', 'voracious', 'mindless'], anti: ['intelligent', 'friendly', 'curious'] },
  { id: 'golem', name: 'Golem', plural: 'Golems and automatons', group: 'Supernatural', mode: 'wild', align: 'monster', style: 'dwarf', color: '#a8a090',
    biomes: [DE, HI, MO, TU], might: 5, life: 9999, open: 0, lair: 'ancient ruin', grow: 0.05,
    habitat: 'Ancient ruins and workshops',
    tendency: 'Obedient and literal; they follow their original order until someone changes it.',
    traits: ['obedient', 'literal', 'tireless', 'unfeeling'], anti: ['self-aware', 'questioning', 'gentle'] },
];

export const SPECIES = LIST.map((s) => ({ ...D, ...s }));
export const SP = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

const ALIGN = {
  'folk|folk': 15, 'fey|folk': 5, 'folk|holy': 20, 'folk|shadow': -15, 'dark|folk': -60, 'brute|folk': -45, 'folk|monster': -40,
  'fey|fey': 30, 'fey|holy': 10, 'fey|shadow': -10, 'dark|fey': -60, 'brute|fey': -50, 'fey|monster': -20,
  'holy|holy': 50, 'holy|shadow': -30, 'dark|holy': -95, 'brute|holy': -40, 'holy|monster': -30,
  'shadow|shadow': 10, 'dark|shadow': 5, 'brute|shadow': -10, 'monster|shadow': -10,
  'dark|dark': 20, 'brute|dark': 0, 'dark|monster': 0, 'brute|brute': -5, 'brute|monster': -10, 'monster|monster': 0,
};
const PAIRS = {
  'dwarf|elf': -25, 'dragon|kobold': 80, 'human|orc': -35, 'elf|orc': -40, 'dwarf|orc': -35, 'goblin|orc': -10,
  'minotaur|orc': 15, 'demon|vampire': 25, 'undead|vampire': 30, 'rabbitfolk|wolffolk': -20, 'catfolk|foxfolk': 20,
  'elf|fairy': 30, 'dryad|elf': 35, 'dwarf|gnome': 30, 'halfling|human': 35, 'catfolk|human': 30, 'goblin|kobold': 10,
};

/** Baseline attitude between two species, from -100 (hatred) to 100 (kinship). */
export function attitude(a, b) {
  if (a === b) return 40;
  const key = a < b ? `${a}|${b}` : `${b}|${a}`;
  if (key in PAIRS) return PAIRS[key];
  const A = SP[a], Bs = SP[b];
  const ak = A.align < Bs.align ? `${A.align}|${Bs.align}` : `${Bs.align}|${A.align}`;
  const v = (ALIGN[ak] ?? 0) + (A.open + Bs.open - 1) * 20;
  return Math.max(-100, Math.min(100, Math.round(v)));
}
