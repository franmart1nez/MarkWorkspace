// Shared state helpers: derived caches, the route graph, the chronicle and
// the constructors for sites, factions and characters.
import { generateMap, findPath, linePath } from './map.js';
import { rand, randInt, randRange, pick, chance } from './rng.js';
import { SP } from './species.js';
import { personName, ARCHETYPES, GOALS } from './names.js';

export const YEAR = 360;

// Settlement tiers. prod: food produced per inhabitant per day (each one eats 1).
export const KIND = {
  village: { prod: 2.1, trade: 0.004, mil: 0.03, walls: 1.0, cap: 900, reach: 5 },
  town: { prod: 1.0, trade: 0.010, mil: 0.05, walls: 1.3, cap: 3500, reach: 7 },
  city: { prod: 0.6, trade: 0.016, mil: 0.06, walls: 1.6, cap: 12000, reach: 9 },
  castle: { prod: 0.5, trade: 0.008, mil: 0.5, walls: 2.2, cap: 800, reach: 6 },
};

export function dateOf(day) {
  const year = Math.floor(day / YEAR) + 1;
  const d = day % YEAR;
  const season = ['Spring', 'Summer', 'Autumn', 'Winter'][Math.floor(d / 90)];
  const part = ['Early', 'Mid', 'Late'][Math.floor((d % 90) / 30)];
  const dom = (d % 30) + 1;
  return { year, season, part, dom, text: `${dom} ${part} ${season}, Year ${year}` };
}

// ---- derived caches (never saved) ----------------------------------------

const CACHE = new WeakMap();

export function ctx(state) {
  let c = CACHE.get(state);
  if (!c) {
    const map = generateMap(state.seed, state.w, state.h);
    c = { map, road: new Uint8Array(map.w * map.h), adj: null, adjN: -1 };
    for (const e of state.edges) if (!e.trail) for (const i of e.path) c.road[i] = 1;
    CACHE.set(state, c);
  }
  return c;
}

export const getMap = (state) => ctx(state).map;
export const tileOf = (state, s) => s.y * state.w + s.x;

function adjacency(state) {
  const c = ctx(state);
  if (!c.adj || c.adjN !== state.edges.length || c.adj.length !== state.sites.length) {
    c.adj = state.sites.map(() => []);
    state.edges.forEach((e, i) => {
      c.adj[e.a].push({ to: e.b, edge: i });
      c.adj[e.b].push({ to: e.a, edge: i });
    });
    c.adjN = state.edges.length;
  }
  return c.adj;
}

export const neighbors = (state, id) => adjacency(state)[id] || [];

export function hasEdge(state, a, b) {
  return neighbors(state, a).some((n) => n.to === b);
}

export function connect(state, a, b, trail = false) {
  if (a === b || hasEdge(state, a, b)) return;
  const c = ctx(state);
  const A = state.sites[a], Bs = state.sites[b];
  const path = findPath(c.map, c.road, tileOf(state, A), tileOf(state, Bs)) || linePath(c.map, tileOf(state, A), tileOf(state, Bs));
  state.edges.push({ a, b, path, trail });
  if (!trail) for (const i of path) c.road[i] = 1;
}

/** Shortest routes over the site graph from one site (cost = tiles travelled). */
export function dijkstra(state, from, maxCost = Infinity) {
  const adj = adjacency(state);
  const n = state.sites.length;
  const dist = new Array(n).fill(Infinity);
  const prevNode = new Array(n).fill(-1);
  const prevEdge = new Array(n).fill(-1);
  const done = new Uint8Array(n);
  dist[from] = 0;
  for (;;) {
    let u = -1, best = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0 || best > maxCost) break;
    done[u] = 1;
    for (const { to, edge } of adj[u]) {
      const nd = best + state.edges[edge].path.length;
      if (nd < dist[to]) { dist[to] = nd; prevNode[to] = u; prevEdge[to] = edge; }
    }
  }
  return { from, dist, prevNode, prevEdge };
}

/** Tile path from the dijkstra origin to `to`, or null when unreachable. */
export function routePath(state, d, to) {
  if (to === d.from) return [tileOf(state, state.sites[to])];
  if (d.prevNode[to] < 0) return null;
  const legs = [];
  for (let n = to; n !== d.from; n = d.prevNode[n]) legs.push([d.prevNode[n], d.prevEdge[n]]);
  legs.reverse();
  const path = [];
  for (const [fromNode, ei] of legs) {
    const e = state.edges[ei];
    const seg = e.a === fromNode ? e.path : e.path.slice().reverse();
    for (let i = path.length ? 1 : 0; i < seg.length; i++) path.push(seg[i]);
  }
  return path;
}

export function flightPath(state, a, b) {
  return linePath(getMap(state), tileOf(state, state.sites[a]), tileOf(state, state.sites[b]));
}

export const dist2 = (a, b) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));

// ---- chronicle ------------------------------------------------------------

/** type: war | raid | economy | monster | people | world. imp: 0 minor .. 3 historic. */
export function log(state, type, imp, text, site) {
  const ev = { n: ++state.eventCount, day: state.day, type, imp, text };
  if (site) { ev.site = site.id; ev.x = site.x; ev.y = site.y; }
  state.events.push(ev);
  if (state.events.length > 4000) state.events.splice(0, 1000);
  if (site && imp >= 1) {
    site.history.push({ day: state.day, text });
    if (site.history.length > 25) site.history.shift();
  }
}

export function note(state, npc, text) {
  if (!npc) return;
  npc.history.push({ day: state.day, text });
  if (npc.history.length > 20) npc.history.shift();
}

// ---- population helpers ---------------------------------------------------

export function scalePop(s, f) {
  for (const k in s.pops) s.pops[k] *= f;
  s.pop *= f;
}
export function killPop(s, n) {
  if (s.pop <= 0) return;
  scalePop(s, Math.max(0, 1 - n / s.pop));
}
export function addPop(s, species, n) {
  s.pops[species] = (s.pops[species] || 0) + n;
  s.pop += n;
}

export function defense(s) {
  const K = KIND[s.kind] || KIND.village;
  return (s.garrison * SP[s.species].might + s.pop * 0.02) * K.walls;
}

// ---- constructors ---------------------------------------------------------

export function makeSite(state, o) {
  const map = getMap(state);
  let f = 0, n = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = o.x + dx, y = o.y + dy;
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
    f += map.fert[y * map.w + x]; n++;
  }
  const s = {
    id: state.sites.length, name: '?', kind: 'village', label: 'village', species: 'human', mode: 'civil',
    x: 0, y: 0, pops: {}, pop: 0, food: 0, wealth: 0, unrest: 0, safety: 100, garrison: 0, damage: 0,
    faction: null, fertility: Math.max(0.75, Math.min(1.25, 0.7 + 0.4 * (f / n))),
    hunger: 0, famine: false, siege: null, grudges: {}, notables: [], history: [],
    cd: 0, away: false, threat: 0, captives: 0, boss: null, outlaw: false, orig: null, founded: state.day,
    ...o,
  };
  if (o.pop) { s.pops = { [s.species]: o.pop }; s.pop = o.pop; }
  state.sites.push(s);
  return s;
}

export function makeFaction(state, o) {
  const id = state.factions.length;
  const hue = Math.round((id * 137.508) % 360);
  const f = {
    id, name: '?', species: 'human', gov: 'Kingdom', color: `hsl(${hue} 70% ${id % 2 ? 58 : 46}%)`,
    capital: null, ruler: null, rel: {}, wars: {}, truce: {}, alive: true, musterCd: 0, expCd: 0, founded: state.day,
    ...o,
  };
  state.factions.push(f);
  return f;
}

export function makeNpc(state, species, role, site, o = {}) {
  const sp = SP[species];
  const sex = chance(state, 0.5) ? 'f' : 'm';
  const traits = [];
  let off = 0;
  while (traits.length < 3) {
    const deviates = chance(state, 0.18);
    const t = pick(state, deviates ? sp.anti : sp.traits);
    if (traits.includes(t)) continue;
    traits.push(t);
    if (deviates) off++;
  }
  const immortal = sp.life >= 1000;
  const npc = {
    id: state.npcs.length, name: personName(state, sp.style, sex), species, sex, role,
    archetype: pick(state, ARCHETYPES), traits, deviant: off, goal: pick(state, GOALS),
    age: Math.round(immortal ? randRange(state, 80, 900) : randRange(state, sp.life * 0.22, sp.life * 0.7)),
    maxAge: immortal ? null : Math.round(sp.life * randRange(state, 0.8, 1.15)),
    site: site ? site.id : null, alive: true, born: state.day, history: [],
    ...o,
  };
  state.npcs.push(npc);
  if (site) site.notables.push(npc.id);
  return npc;
}

export const RULER_TITLES = {
  Kingdom: ['King', 'Queen'], Court: ['High Lord', 'High Lady'], Hold: ['Thane', 'Thane'], Clan: ['Warchief', 'Warchief'],
  Shire: ['Mayor', 'Mayor'], 'Free Company': ['Caravan Master', 'Caravan Mistress'], Pack: ['Alpha', 'Alpha'],
  Shrine: ['High Priest', 'High Priestess'], 'Warren League': ['Speaker', 'Speaker'], Flock: ['Patriarch', 'Matriarch'],
  Tribe: ['Chieftain', 'Chieftain'], Labyrinth: ['Horned King', 'Horned Queen'], Horde: ['Khan', 'Khatun'],
  'Tide Court': ['Tide King', 'Tide Queen'], Brood: ['Broodfather', 'Broodmother'], Coven: ['Coven Lord', 'Coven Mother'],
  'Fey Court': ['Fairy King', 'Fairy Queen'], Guild: ['Guildmaster', 'Guildmistress'], Circle: ['Elder', 'Elder'],
  Legion: ['Archdemon', 'Archdemon'], Host: ['Archangel', 'Archangel'], 'Free City': ['Lord Mayor', 'Lady Mayor'],
};

/** Create (or replace) the ruling notable of a civil site. */
export function installRuler(state, site, species) {
  const f = state.factions[site.faction];
  const isCapital = f && f.capital === site.id;
  const npc = makeNpc(state, species || site.species, 'ruler', site);
  const pair = isCapital ? RULER_TITLES[f.gov] || ['Ruler', 'Ruler']
    : site.kind === 'village' ? ['Elder', 'Elder'] : site.kind === 'castle' ? ['Castellan', 'Castellan'] : ['Governor', 'Governor'];
  npc.title = pair[npc.sex === 'f' ? 1 : 0];
  site.ruler = npc.id;
  if (isCapital) f.ruler = npc.id;
  return npc;
}

export function removeNpc(state, npc, how) {
  if (!npc || !npc.alive) return;
  npc.alive = false;
  npc.died = state.day;
  note(state, npc, how);
  const site = state.sites[npc.site];
  if (site) site.notables = site.notables.filter((id) => id !== npc.id);
}

export { rand, randInt, randRange, pick, chance };
