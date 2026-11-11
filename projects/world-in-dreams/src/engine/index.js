// Public surface of the engine. The viewer and any future RPG layer or AI
// agent talk to the world only through this module.
import { ACT_TEXT } from './people.js';

export { createWorld, MEALS } from './worldgen.js';
export { step, run, foodDays, priceOf } from './sim.js';
export { DAY, WEEK, SEASON_DAYS, YEAR_DAYS, SEASONS, dateOf, dayOf, seasonOf, getLayout, ageOf } from './core.js';
export { SPECIES, JOBS, jobOf, ACT_TEXT } from './people.js';
export { BEASTS } from './wild.js';
export { fullName, isNotable } from './fate.js';

/** The whole dynamic world as JSON. The region itself is rebuilt from the seed on load. */
export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(json) {
  const state = typeof json === 'string' ? JSON.parse(json) : json;
  if (!state || state.version !== 2 || !Array.isArray(state.people)) throw new Error('Not a World in Dreams save (version 2).');
  return state;
}

/** Small stable fingerprint of a state, for determinism checks. */
export function fingerprint(state) {
  const text = JSON.stringify(state);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}

const GOING = {
  farm: 'the fields', tend: 'the fields', herd: 'the pasture', fish: 'the river bank', chop: 'the woods', stalk: 'the hunting grounds',
  guard: 'their post', patrol: 'the next post', stroll: 'take the air', play: 'play outside', quest: 'the quest', leave: 'the far road',
};

export function placeName(L, b, p) {
  if (b.name) return b.name;
  if (b.k === 'shop') return `the ${b.trade}'s workshop`;
  if (b.k === 'house' || b.k === 'farmhouse') return p && b.id === p.home ? 'home' : b.k === 'farmhouse' ? 'a farmhouse' : 'a house';
  return `the ${b.k}`;
}

/** One line on what a person is doing right now. */
export function describe(S, L, p) {
  if (!p.alive) return p.gone ? 'Left the region' : 'Dead';
  if (p.away) return 'Travelling in far lands';
  if (p.route) {
    const to = p.db >= 0 ? placeName(L, L.blds[p.db], p) : GOING[p.na] || 'somewhere';
    return `${p.cart ? 'Driving the cart' : 'Walking'} to ${to}`;
  }
  const at = p.in >= 0 && p.in !== p.home ? ` at ${placeName(L, L.blds[p.in], p)}` : '';
  return (ACT_TEXT[p.act] || p.act) + at;
}

/** Needs as 0..100 bars for the inspector (100 is good). */
export function needsOf(S, p) {
  const hh = S.households[p.hh];
  const fed = Math.max(0, Math.min(100, 100 - ((S.t - p.ate) / (7 * 60)) * 55 - p.miss * 12));
  const health = p.hurt > S.t ? 35 : Math.max(20, 100 - p.miss * 8);
  const larder = hh ? Math.min(100, (hh.pantry / Math.max(1, hh.m.length * 3 * 5)) * 100) : 100;
  const mood = Math.round(Math.max(0, Math.min(100, fed * 0.4 + p.soc * 0.25 + health * 0.2 + larder * 0.15)));
  return { fed: Math.round(fed), company: Math.round(p.soc), health, larder: Math.round(larder), mood };
}
