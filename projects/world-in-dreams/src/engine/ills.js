// Misfortune that nobody chooses: fevers that pass from house to house, accidents
// at work, the weather of the year, and the hail, blight and murrain that ruin a
// harvest or a flock.
import { rand, randInt, randRange, pick, chance } from './rng.js';
import { DAY, YEAR_DAYS, dayOf, seasonOf, log, note, tally } from './core.js';
import { die, wound, fullName } from './fate.js';
import { healer } from './economy.js';
import { cull } from './wild.js';

// ---- sickness -------------------------------------------------------------------

/** mort: chance of dying per day of illness for small children, adults and the old. */
export const ILLS = {
  fever: { name: 'a fever', spread: 0.05, home: 0.2, days: [4, 9], mort: [0.03, 0.004, 0.025], season: [1.4, 0.5, 1, 2] },
  flux: { name: 'the bloody flux', spread: 0.045, home: 0.25, days: [3, 7], mort: [0.045, 0.003, 0.02], season: [0.6, 2.2, 1.2, 0.3] },
  pox: { name: 'the pox', spread: 0.07, home: 0.35, days: [8, 14], mort: [0.035, 0.006, 0.02], season: [1, 1, 1, 1] },
};
const KINDS = Object.keys(ILLS);

const residents = (S, si) => S.people.filter((p) => p.alive && !p.away && p.site === si);
const canCatch = (S, p) => p.alive && !p.away && !(p.sick > S.t) && (p.imm || 0) <= dayOf(S.t);

function fallIll(S, L, p, o) {
  const I = ILLS[o.kind];
  p.sick = S.t + randInt(S, I.days[0], I.days[1]) * DAY;
  p.ill = o.id;
  o.cases++;
  note(S, p, `Fell ill with ${I.name}.`);
  healer(S, L, p);
  if (!p.route && p.act !== 'sleep') p.until = Math.min(p.until, S.t + 1);
}

/** Once a day: outbreaks begin, spread through households and neighbours, kill some and pass. */
export function illDay(S, L) {
  const day = dayOf(S.t), season = seasonOf(S.t);
  // a new outbreak somewhere?
  S.sites.forEach((site, si) => {
    if (S.ills.some((o) => o.open && o.site === si)) return;
    const kind = chance(S, 0.08) ? 'pox' : season === 1 ? 'flux' : chance(S, 0.75) ? 'fever' : 'flux';
    const risk = (si === 0 ? 0.0075 : 0.0032) * ILLS[kind].season[season] * (site.short ? 2 : 1);
    if (!chance(S, risk)) return;
    const folk = residents(S, si).filter((p) => canCatch(S, p));
    if (folk.length < 10) return;
    const o = { id: ++S.nextIll, kind, site: si, start: day, cases: 0, deaths: 0, open: true };
    S.ills.push(o);
    for (let i = randInt(S, 2, 4); i > 0; i--) fallIll(S, L, pick(S, folk), o);
    tally(S, 'misfortune', 'outbreaks');
    log(S, 'life', 2, `${ILLS[kind].name[0].toUpperCase()}${ILLS[kind].name.slice(1)} has broken out in ${L.sites[si].name}.`, L.sites[si].x, L.sites[si].y);
  });
  for (const o of S.ills) {
    if (!o.open) continue;
    const I = ILLS[o.kind], folk = residents(S, o.site), sick = folk.filter((p) => p.ill === o.id && p.sick > S.t);
    for (const p of sick) {
      // the old, the very young and the hungry die of it more often
      const k = p.age < 5 ? 0 : p.age > 60 ? 2 : 1, cold = season === 3 && S.sites[p.site].wood <= 0 ? 1.6 : 1;
      if (chance(S, I.mort[k] * (1 + p.miss / 6) * cold)) { o.deaths++; die(S, L, p, `died of ${I.name}`, 1, 'illness'); continue; }
      const hh = S.households[p.hh];
      if (hh) for (const id of hh.m) { const q = S.people[id]; if (canCatch(S, q) && chance(S, I.home)) fallIll(S, L, q, o); }
      if (chance(S, I.spread)) { const q = pick(S, folk); if (canCatch(S, q)) fallIll(S, L, q, o); }
    }
    for (const p of folk) if (p.ill === o.id && p.sick <= S.t) { p.sick = 0; p.ill = -1; p.imm = day + 2 * YEAR_DAYS; note(S, p, `Recovered from ${I.name}.`); }
    if (!folk.some((p) => p.ill === o.id) || day - o.start > 40) {
      o.open = false;
      for (const p of folk) if (p.ill === o.id) { p.sick = 0; p.ill = -1; }
      tally(S, 'misfortune', 'fell ill', o.cases);
      log(S, 'life', o.deaths >= 3 ? 2 : 1, `${I.name[0].toUpperCase()}${I.name.slice(1)} in ${L.sites[o.site].name} has passed: ${o.cases} fell ill${o.deaths ? ` and ${o.deaths} died` : ', and all recovered'}.`, L.sites[o.site].x, L.sites[o.site].y);
    }
  }
  if (S.ills.length > 30) S.ills = S.ills.filter((o) => o.open);
}

// ---- accidents ----------------------------------------------------------------------

/** Per hour of the activity: chance of a wound, chance of death, and how death comes. */
const RISK = {
  chop: [0.0012, 0.00007, 'was crushed by a falling tree'],
  fish: [0.00025, 0.00006, 'drowned when the boat overturned'],
  farm: [0.0002, 0.000012, 'was trampled by the plough oxen'],
  tend: [0.00008, 0.000004, 'fell from an orchard ladder'],
  herd: [0.00012, 0.000006, 'was gored by a ram'],
  train: [0.0005, 0.000006, 'was killed in a training bout'],
  unload: [0.004, 0.0004, 'was crushed under an overturned cart'],
  load: [0.002, 0.0002, 'was crushed under an overturned cart'],
};
const TRADE_RISK = {
  blacksmith: [0.0004, 0.00002, 'died of burns from the forge'],
  carpenter: [0.0004, 0.00003, 'fell from a roof beam'],
  porter: [0.0003, 0.00002, 'was crushed by falling crates'],
  cooper: [0.0002, 0.00001, 'was crushed by a rolling cask'],
  'granary keeper': [0.0002, 0.00001, 'fell from the granary loft'],
};

/** After `minutes` of a working activity, perhaps an accident. Returns true if the person died. */
export function mishap(S, L, p, act, minutes) {
  const r = act === 'work' ? TRADE_RISK[p.job] : RISK[act];
  if (!r || minutes <= 0) return false;
  const h = act === 'unload' || act === 'load' ? 1 : minutes / 60, x = rand(S);
  const where = L.sites[p.site] ? L.sites[p.site].name : 'the road';
  if (x < r[1] * h) { tally(S, 'misfortune', 'accidents'); die(S, L, p, r[2], 1, 'accident'); return true; }
  if (x < (r[0] + r[1]) * h) {
    tally(S, 'misfortune', 'injuries');
    wound(S, L, p, randInt(S, 2, 6), 'Hurt in an accident at work.');
    log(S, 'life', 0, `${fullName(p)} was hurt at work near ${where}.`, p.x, p.y, p.id);
  }
  return false;
}

// ---- the weather of the year and the ruin of crops ------------------------------------

const YEARS = [['good', 0.18, 1.15], ['normal', 0.42, 1], ['fair', 0.22, 0.88], ['poor', 0.12, 0.68], ['failed', 0.06, 0.45]];

/** At the start of spring: how the year will grow, for the region and each settlement. */
export function rollYear(S) {
  const year = Math.floor(dayOf(S.t) / YEAR_DAYS);
  let kind = 'normal', mult = 1;
  if (year > 0) {
    let r = rand(S);
    for (const [k, w, m] of YEARS) { if (r < w) { kind = k; mult = m; break; } r -= w; }
  }
  S.weather = { year, kind, mult: S.sites.map(() => Math.round(mult * randRange(S, 0.92, 1.08) * 100) / 100), told: false };
}

/** At the start of summer the farmers can tell how the year is growing. */
export function tellYear(S, L) {
  const W = S.weather;
  if (!W || W.told) return;
  W.told = true;
  const text = { good: 'A kind growing year: the crops stand tall and green across the region.', poor: 'The spring rains failed: the crops stand thin and a poor harvest is feared.', failed: 'Drought and late frost have ruined the growing year: the harvest will fail and hunger is feared.' }[W.kind];
  if (text) log(S, 'town', W.kind === 'good' ? 1 : 2, text, 0, 0);
}

/** Once a day in the growing months: hail, blight and murrain strike here and there. */
export function ruinDay(S, L) {
  const season = seasonOf(S.t);
  if (season === 3) return;
  S.sites.forEach((site, si) => {
    const mine = L.siteFields[si].filter((id) => L.fields[id].crop !== 'pasture' && (S.fields[id].st === 1 || S.fields[id].st === 2));
    if (mine.length < 4) return;
    const LS = L.sites[si];
    if (season > 0 && chance(S, si === 0 ? 0.0015 : 0.003)) {
      // a hailstorm flattens part of the fields
      const share = randRange(S, 0.2, 0.55);
      let n = 0;
      for (const id of mine) if (chance(S, share)) { Object.assign(S.fields[id], { st: 3, w: 0 }); n++; }
      S.fv++;
      tally(S, 'misfortune', 'fields lost', n);
      log(S, 'town', 2, `A hailstorm swept over ${LS.name} and flattened ${n} fields.`, LS.x, LS.y);
    } else if (season > 0 && chance(S, 0.002)) {
      const crop = chance(S, 0.5) ? 'orchard' : 'veg', hit = mine.filter((id) => L.fields[id].crop === crop);
      if (hit.length < 2) return;
      let n = 0;
      for (const id of hit) if (chance(S, 0.5)) { Object.assign(S.fields[id], { st: 3, w: 0 }); n++; }
      S.fv++;
      tally(S, 'misfortune', 'fields lost', n);
      log(S, 'town', 1, `${crop === 'orchard' ? 'Blight has withered the orchards' : 'Rot and pests have spoiled the vegetable plots'} around ${LS.name}: ${n} fields are lost.`, LS.x, LS.y);
    }
  });
  for (const h of S.herds) {
    if (h.k !== 'sheep' || h.n < 3 || !chance(S, 0.0012)) continue;
    const n = cull(S, h, Math.ceil(h.n / 2));
    const name = L.sites[h.site] ? L.sites[h.site].name : 'a farm';
    tally(S, 'misfortune', 'sheep lost', n);
    log(S, 'wild', 1, `Murrain struck a flock near ${name}: ${n} sheep died.`, h.x, h.y);
  }
}
