// Data for the inhabitants: the species present in this region, the trades
// and their working hours, and the personality pools.

/** Share of households by species. Humans dominate this first region. */
export const SPECIES = {
  human: { name: 'Human', style: 'human' },
  catfolk: { name: 'Catfolk', style: 'beast' },
  elf: { name: 'Elf', style: 'elf' },
  dwarf: { name: 'Dwarf', style: 'dwarf' },
  halfling: { name: 'Halfling', style: 'halfling' },
  foxfolk: { name: 'Foxfolk', style: 'beast' },
};
export const SPECIES_MIX = [['human', 0.84], ['catfolk', 0.05], ['elf', 0.03], ['dwarf', 0.03], ['halfling', 0.03], ['foxfolk', 0.02]];

/**
 * t: how the job is carried out. s, e: working hours. w: coins for a full day.
 * c: clothing colour key used by the viewer.
 */
export const JOBS = {
  farmer: { t: 'farm', s: 6.5, e: 17, w: 9, c: 'farm' },
  shepherd: { t: 'herd', s: 6.5, e: 18, w: 9, c: 'herd' },
  woodcutter: { t: 'wood', s: 7, e: 16, w: 10, c: 'wood' },
  fisher: { t: 'fish', s: 5.5, e: 14, w: 10, c: 'fish' },
  hunter: { t: 'hunt', s: 6, e: 15, w: 8, c: 'hunt' },
  carter: { t: 'cart', s: 6.5, e: 17.5, w: 11, c: 'cart' },
  guard: { t: 'guard', s: 6, e: 18, w: 12, c: 'guard' },
  captain: { t: 'in', s: 7, e: 18, w: 20, c: 'guard' },
  merchant: { t: 'stall', s: 7, e: 18, w: 14, c: 'stall' },
  adventurer: { t: 'adv', s: 8, e: 17, w: 5, c: 'adv' },
  innkeeper: { t: 'in', s: 10, e: 23.2, w: 14, c: 'stall' },
  'tavern hand': { t: 'in', s: 13, e: 23.2, w: 9, c: 'in' },
  baker: { t: 'in', s: 3.5, e: 12.5, w: 11, c: 'in' },
  servant: { t: 'in', s: 5.5, e: 19.5, w: 8, c: 'in' },
  priest: { t: 'in', s: 6, e: 18, w: 10, c: 'holy' },
  acolyte: { t: 'in', s: 6, e: 17, w: 7, c: 'holy' },
  lord: { t: 'in', s: 9, e: 16, w: 40, c: 'noble' },
  mayor: { t: 'in', s: 8, e: 17, w: 26, c: 'noble' },
  steward: { t: 'in', s: 7, e: 19, w: 16, c: 'noble' },
  elder: { t: 'home', w: 6, c: 'noble' },
  labourer: { t: 'labour', s: 7, e: 17, w: 9, c: 'labour' },
  homemaker: { t: 'home', w: 0, c: 'home' },
  trader: { t: 'trade', w: 0, c: 'trade' },
  child: { t: 'none', w: 0, c: 'none' },
  retired: { t: 'none', w: 0, c: 'home' },
};
const DEFAULT_JOB = { t: 'in', s: 7, e: 17, w: 10, c: 'in' };
export const jobOf = (p) => JOBS[p.job] || DEFAULT_JOB;

export const TRAITS = ['cheerful', 'stubborn', 'curious', 'shy', 'generous', 'greedy', 'brave', 'cautious', 'lazy', 'diligent', 'devout', 'cynical',
  'gossipy', 'quiet', 'hot-tempered', 'patient', 'proud', 'humble', 'dreamy', 'practical', 'kind', 'sly', 'clumsy', 'graceful'];

/** What the person is doing, as text for the inspector. */
export const ACT_TEXT = {
  sleep: 'Sleeping', home: 'At home', eat: 'Eating', work: 'Working', farm: 'Working the field', tend: 'Tending the crops', shop: 'Buying food',
  drink: 'At the tavern', pray: 'At prayer', school: 'At lessons', stroll: 'Strolling', play: 'Playing', visit: 'Visiting a friend',
  guard: 'Standing guard', patrol: 'On patrol', fish: 'Fishing', chop: 'Felling timber', stalk: 'Stalking game', herd: 'Minding the flock',
  load: 'Loading the cart', unload: 'Unloading', quest: 'On a quest', train: 'Training', trade: 'Trading goods', lodge: 'Lodging at the inn',
  rest: 'Recovering from wounds', leave: 'Leaving the region', idle: 'Idle', walk: 'Walking',
  sick: 'Sick in bed', jail: 'Held in the cells', mourn: 'At a funeral', nurse: 'Tending the baby', prowl: 'Prowling in the dark',
};
export const WORK_ACTS = new Set(['work', 'farm', 'tend', 'guard', 'patrol', 'fish', 'chop', 'stalk', 'herd', 'load', 'unload', 'quest', 'train']);
