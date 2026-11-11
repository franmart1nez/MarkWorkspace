// Fills a freshly generated region with households, trades, stores and wildlife.
import { hashSeed, rand, randRange, randInt, pick, chance, shuffle } from './rng.js';
import { layoutFor } from './layout.js';
import { personName, placeName, ARCHETYPES, GOALS } from './names.js';
import { SPECIES, SPECIES_MIX, TRAITS } from './people.js';
import { DAY, YEAR_DAYS, dayOf, log, census } from './core.js';
import { addHerd } from './wild.js';
import { setupEconomy } from './economy.js';
import { rollYear } from './ills.js';

/** Meals one person eats in a day, and the relative yield of each crop. */
export const MEALS = 3;
export const CROP_K = { grain: 1.15, veg: 0.85, orchard: 0.8, pasture: 0 };

export function makePerson(S, o) {
  const sex = o.sex || (chance(S, 0.5) ? 'f' : 'm');
  const traits = [];
  while (traits.length < 3) { const t = pick(S, TRAITS); if (!traits.includes(t)) traits.push(t); }
  const p = {
    id: S.people.length, name: personName(S, SPECIES[o.sp].style, sex), fam: o.fam, sex, sp: o.sp,
    born: dayOf(S.t) - Math.round(o.age * YEAR_DAYS) - randInt(S, 0, YEAR_DAYS - 1), age: o.age,
    hh: -1, home: -1, site: 0, job: o.age < 15 ? 'child' : 'labourer', work: -1,
    x: 0, y: 0, in: -1, n: -1, act: 'idle', until: 0, route: null, ri: 0, na: 'idle', nu: 0, nd: 0, db: -1, dn: -1, ws: 0,
    ate: S.t - 500, miss: 0, soc: randInt(S, 30, 80), hurt: 0, off: randInt(S, -25, 25),
    traits, arch: pick(S, ARCHETYPES), goal: pick(S, GOALS), spouse: -1, mom: -1, dad: -1, friends: [], hist: [],
    alive: true, away: false, seat: -1, shift: 0, post: -1, fi: -1, farm: -1, load: 0, cart: false, wild: false, q: -1, tg: -1, to: 0, hunts: 0, stage: 0,
    zs: 0, debt: 0, nn: 0, jail: 0, sick: 0, ill: -1, imm: 0, plan: null, wd: -1, died: -1, gone: false,
  };
  S.people.push(p);
  return p;
}

export function pickSpecies(S, village) {
  if (village && chance(S, 0.6)) return 'human';
  let r = rand(S);
  for (const [sp, w] of SPECIES_MIX) { if (r < w) return sp; r -= w; }
  return 'human';
}

/** Create a household in building b. kind: 'family' | 'couple' | 'single' | 'elders' | 'three'. */
export function settle(S, L, b, kind, sp) {
  const fam = placeName(S, SPECIES[sp].style);
  const hh = { id: S.households.length, home: b.id, site: b.site, m: [], pantry: 0, coins: Math.round(randRange(S, 40, 170)), fam, shopT: 0, goods: 0, arrears: 0, owed: 0, goodsT: 0 };
  S.households.push(hh);
  S.occ[b.id] = hh.id;
  const add = (age, o = {}) => {
    const p = makePerson(S, { sp, fam, age, ...o });
    Object.assign(p, { hh: hh.id, home: b.id, site: b.site, x: b.dx, y: b.dy, in: b.id, n: b.n });
    hh.m.push(p.id);
    return p;
  };
  const couple = (lo, hi) => {
    const a = add(randInt(S, lo, hi), { sex: 'm' }), c = add(Math.max(18, a.age + randInt(S, -6, 4)), { sex: 'f' });
    a.spouse = c.id; c.spouse = a.id;
    return [a, c];
  };
  if (kind === 'single') add(randInt(S, 18, 68));
  else if (kind === 'elders') couple(60, 76);
  else if (kind === 'couple') couple(20, 58);
  else {
    const [a, c] = couple(22, 46), top = Math.min(16, Math.min(a.age, c.age) - 19);
    const kids = top < 0 ? 0 : randInt(S, 1, 3);
    for (let i = 0; i < kids; i++) { const k = add(randInt(S, 0, top)); k.dad = a.id; k.mom = c.id; }
    if (kind === 'three') add(randInt(S, 62, 80));
  }
  hh.pantry = hh.m.length * MEALS * randInt(S, 2, 5);
  hh.goods = hh.m.length;
  return hh;
}

const KINDS = [['family', 0.5], ['couple', 0.14], ['single', 0.12], ['elders', 0.08], ['three', 0.16]];
const rollKind = (S) => { let r = rand(S); for (const [k, w] of KINDS) { if (r < w) return k; r -= w; } return 'family'; };

export function createWorld(seedInput = 'dreams') {
  const seedText = String(seedInput).trim() || 'dreams';
  const seed = hashSeed(seedText);
  const L = layoutFor(seed);
  const S = {
    version: 4, seedText, seed, rng: (seed ^ 0x2545f491) | 0, t: 5 * 60,
    people: [], households: [], occ: {}, seats: {}, animals: [], herds: [], quests: [], nextA: 0, nextQ: 0,
    sites: L.sites.map(() => ({ food: 0, coins: 600, wood: 300, fear: 0, short: false, sow: 1, reap: 1 })),
    fields: L.fields.map((f) => ({ st: f.crop === 'pasture' ? 4 : f.crop === 'orchard' ? 1 : 0, w: 0, g: 0, h: 0 })),
    events: [], eventCount: 0, fv: 0, tune: { yield: 0 }, wolfBack: 0, born: 0, died: 0,
    law: {}, gallows: [], rites: [], ills: [], nextIll: 0, levyDay: -99, weather: null, tally: { y: 0, cur: {}, prev: null },
  };

  // ---- households ---------------------------------------------------------------
  for (const b of L.blds) {
    if (b.k !== 'house' && b.k !== 'farmhouse') continue;
    if (b.k === 'house' && chance(S, 0.035)) continue; // a few empty houses wait for newcomers
    settle(S, L, b, b.k === 'farmhouse' ? (chance(S, 0.7) ? 'family' : 'three') : rollKind(S), pickSpecies(S, b.site !== 0 || b.k === 'farmhouse'));
  }
  const keep = L.blds[L.sites[0].keep];
  const noble = settle(S, L, keep, 'family', 'human');
  noble.coins = 4000;

  // ---- trades ---------------------------------------------------------------------
  const give = (p, job, work = -1) => { p.job = job; p.work = work; };
  S.people[noble.m[0]].job = 'lord';
  S.people[noble.m[0]].work = keep.id;
  S.people[noble.m[1]].job = 'homemaker';
  L.sites.forEach((site, si) => {
    const here = S.people.filter((p) => p.site === si && p.hh !== noble.id);
    for (const p of here) if (p.age > 62) p.job = 'retired';
    const farmFolk = here.filter((p) => L.blds[p.home].k === 'farmhouse' && p.age >= 15 && p.age <= 62);
    for (const p of farmFolk) { p.job = 'farmer'; p.farm = L.blds[p.home].farm; }
    const pool = shuffle(S, here.filter((p) => p.age >= 15 && p.age <= 62 && p.job === 'labourer'));
    const take = (job, work, n = 1, each) => {
      for (let i = 0; i < n && pool.length; i++) { const p = pool.pop(); give(p, job, work); if (each) each(p, i); }
    };
    const fields = L.siteFields[si].map((id) => L.fields[id]);
    const pastures = fields.filter((f) => f.crop === 'pasture');
    if (si === 0) {
      take('mayor', site.townhall);
      take('clerk', site.townhall, 4);
      take('steward', site.keep);
      take('servant', site.keep, 5);
      take('captain', site.barracks);
      take('guard', site.barracks, 30, (p, i) => { p.shift = i >= 18 ? 1 : 0; const k = i >= 18 ? i - 18 : i; p.post = k < (i >= 18 ? 8 : 12) ? k : -1; });
      take('priest', site.temple);
      take('acolyte', site.temple, 3);
      take('guild clerk', site.guild, 2);
      take('adventurer', site.guild, 10);
      take('granary keeper', site.granary, 2);
      take('carter', site.granary, 6);
      for (const w of site.warehouses) take('porter', w, 4);
      for (const s of site.market) take('merchant', s);
      for (const s of site.shops) take(L.blds[s].trade, s, randInt(S, 2, 3));
      take('fisher', -1, Math.min(6, L.spots.fish[0].length));
      take('hunter', -1, 3);
      take('woodcutter', -1, L.spots.wood[0].length ? 4 : 0);
    } else {
      take('elder', -1);
      if (site.temple >= 0) take('priest', site.temple);
      for (const s of site.shops) take(L.blds[s].trade, s, 2);
      take('carter', site.barn, 2);
      take('fisher', -1, site.type === 'river' ? Math.min(5, L.spots.fish[si].length) : 0);
      take('hunter', -1, 1);
      take('woodcutter', -1, L.spots.wood[si].length ? (site.type === 'forest' ? 5 : 2) : 0);
    }
    for (const t of site.taverns) { take('innkeeper', t); take('tavern hand', t, 2); }
    for (const f of pastures) take('shepherd', -1, 1, (p) => { p.fi = f.id; });
    const crops = fields.filter((f) => f.crop !== 'pasture').length;
    take('farmer', -1, Math.max(0, Math.round(crops * 0.95) - farmFolk.length));
    // of those left, one adult per young family keeps the house; the rest hire out by the day
    for (const p of pool) {
      const hh = S.households[p.hh];
      const kids = hh.m.some((id) => S.people[id].age < 10), kept = hh.m.some((id) => S.people[id].job === 'homemaker');
      if (kids && !kept) p.job = 'homemaker';
    }
    const grown = here.filter((p) => p.age >= 15);
    for (const p of grown) for (let i = 0; i < 2; i++) { const f = pick(S, grown); if (f.id !== p.id && f.hh !== p.hh && !p.friends.includes(f.id)) p.friends.push(f.id); }
  });

  // ---- stores and the farming balance ----------------------------------------------------
  const pop = S.people.length;
  census(S);
  let weighted = 0;
  L.fields.forEach((f) => { weighted += f.area * CROP_K[f.crop]; });
  S.tune.yield = (pop * MEALS * YEAR_DAYS * 1.22) / Math.max(1, weighted);
  L.sites.forEach((site, si) => {
    const n = S.sites[si].pop;
    S.sites[si].food = n * MEALS * (si === 0 ? 24 : 30);
    S.sites[si].coins = n * 6;
    const farmers = Math.max(1, S.people.filter((p) => p.site === si && p.job === 'farmer').length);
    const fs = L.siteFields[si].map((id) => L.fields[id]).filter((f) => f.crop !== 'pasture');
    const area = fs.reduce((a, f) => a + f.area, 0) || 1, sown = fs.filter((f) => f.crop !== 'orchard').reduce((a, f) => a + f.area, 0) || 1;
    S.sites[si].sow = (farmers * 480 * 4.5) / sown; // minutes of work per square metre
    S.sites[si].reap = (farmers * 480 * 5) / area;
  });

  // ---- wildlife ---------------------------------------------------------------------
  for (const s of L.spots.deer) addHerd(S, L, 'deer', s, randInt(S, 5, 8), 170);
  for (const s of L.spots.boar) addHerd(S, L, 'boar', s, randInt(S, 3, 5), 130);
  for (const s of L.spots.rabbit) addHerd(S, L, 'rabbit', s, randInt(S, 5, 8), 60);
  for (const s of L.spots.slime) addHerd(S, L, 'slime', s, randInt(S, 4, 7), 70);
  for (const s of L.spots.den) addHerd(S, L, 'wolf', s, 5, 90);
  for (const f of L.fields) if (f.crop === 'pasture') addHerd(S, L, 'sheep', { x: f.x, y: f.y }, randInt(S, 4, 7), Math.min(f.w, f.d) * 0.42, f);

  // ---- travelling merchants who come and go ---------------------------------------------
  for (let i = 0; i < 8; i++) {
    const sp = pickSpecies(S, false);
    const p = makePerson(S, { sp, fam: placeName(S, SPECIES[sp].style), age: randInt(S, 24, 58) });
    Object.assign(p, { job: 'trader', site: -1, away: true, until: S.t + randInt(S, 1, 5 * DAY), cart: true });
  }

  setupEconomy(S, L);
  rollYear(S);
  for (const p of S.people) if (!p.away) p.until = S.t + randInt(S, 0, 30);
  const city = L.sites[0];
  log(S, 'town', 2, `The chronicle of ${city.name} and its ${L.sites.length - 1} villages begins: ${pop.toLocaleString('en-US')} souls.`, 0, 0);
  return S;
}
