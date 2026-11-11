// The daily tick. Everything here is rule-driven and deterministic: the same
// seed always produces the same history.
import { SP, attitude } from './species.js';
import { placeName } from './names.js';
import { B } from './map.js';
import { findSpot } from './worldgen.js';
import {
  KIND, YEAR, getMap, neighbors, connect, dijkstra, routePath, flightPath, dist2, log, note,
  scalePop, killPop, addPop, defense, makeSite, makeFaction, makeNpc, installRuler, removeNpc,
  rand, randInt, randRange, pick, chance,
} from './core.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const mouths = (s) => s.pop + s.garrison;
const foodDays = (s) => s.food / Math.max(1, mouths(s));
const atWar = (f, g) => !!(f && f.wars[g] !== undefined);
const anyWar = (f) => { for (const k in f.wars) return true; return false; };
const civilOf = (state, fid) => state.sites.filter((s) => s.mode === 'civil' && s.faction === fid);
const facName = (state, fid) => (state.factions[fid] ? state.factions[fid].name : 'no one');

function hostile(a, t) {
  if (a.outlaw) return !t.outlaw;
  return attitude(a.species, t.species) < -20;
}

function spawn(state, o) {
  if (!o.path || !o.path.length) return null;
  const p = { id: state.nextId++, pos: 0, state: 'go', timer: 0, speed: 3, size: 1, might: 1, cargo: { food: 0, wealth: 0, captives: 0 }, ...o };
  state.parties.push(p);
  return p;
}

function turnBack(p) {
  p.path = p.path.slice().reverse();
  p.pos = 0;
  p.state = 'return';
}

// ===========================================================================
// Civil settlements
// ===========================================================================

function updateCivil(state, s) {
  const day = state.day;
  const sp = SP[s.species];
  const K = KIND[s.kind];
  const f = state.factions[s.faction];
  const m = mouths(s);
  if (s.siege !== null && !state.parties.some((p) => p.id === s.siege)) s.siege = null;
  const sieged = s.siege !== null;
  const war = anyWar(f);
  const conquered = s.species !== f.species && attitude(s.species, f.species) < 0;
  // Unrest never settles below this level while its causes last.
  const calm = 4 + (war ? 8 : 0) + s.damage / 4 + (conquered ? 15 : 0) + (s.safety < 60 ? 10 : 0) + (s.wealth < s.pop * 0.05 ? 6 : 0);

  // Food: abstract farms and hunters produce, everyone eats.
  s.food += s.pop * K.prod * s.fertility * sp.farm * (1 - s.damage / 150) * (sieged ? 0.2 : 1) - m;
  const store = m * 100;
  if (s.food > store) { s.wealth += (s.food - store) * 0.002; s.food = store; }
  if (s.food <= 0) {
    s.food = 0;
    s.hunger++;
    if (s.hunger === 4 && !s.famine) startFamine(state, s);
    killPop(s, s.pop * 0.004);
    s.garrison *= 0.996;
    s.unrest += 1.1;
    if (s.hunger % 5 === 0) refugees(state, s);
  } else {
    const fd = s.food / m;
    if (s.hunger > 0 && fd > 8) {
      if (s.famine) { log(state, 'economy', 1, `The famine in ${s.name} ends.`, s); s.famine = false; }
      s.hunger = 0;
    }
    if (fd < 12) s.unrest += 0.35;
    else if (fd > 30 && s.unrest > calm) s.unrest -= 0.22;
  }

  // Wealth: abstract trade depends on safe roads and calm streets.
  s.wealth += s.pop * K.trade * sp.trade * (s.safety / 100) * (1 - s.unrest / 200) - s.garrison * 0.012 - s.wealth * 0.0005;
  if (s.wealth < 0) { s.wealth = 0; s.garrison *= 0.99; s.unrest += 0.05; }

  // Unrest.
  if (s.safety < 50) s.unrest += 0.08;
  if (war) s.unrest += 0.03;
  if (conquered) s.unrest += 0.1;
  if (s.unrest < calm) s.unrest += 0.15;
  const target = s.pop * K.mil * sp.mil * (war ? 1.4 : 1);
  if (s.garrison >= target * 0.8 && s.unrest > calm) s.unrest -= 0.05;
  s.unrest = clamp(s.unrest, 0, 100);

  // Garrison.
  if (s.garrison < target && s.wealth > 5 && s.hunger === 0) {
    const add = Math.min((target - s.garrison) * 0.03 + 0.2, s.wealth / 0.5);
    s.garrison += add;
    s.wealth -= add * 0.5;
  } else if (s.garrison > target * 1.6) {
    s.garrison -= (s.garrison - target) * 0.01;
  }

  // Growth and expansion.
  const cap = K.cap * (0.5 + 0.5 * s.fertility) * sp.pm;
  if (s.hunger === 0 && !sieged && s.unrest < 60 && s.food / m > 20) {
    if (s.pop < cap) scalePop(s, 1 + 0.00009 * sp.fert);
    else if ((day + s.id * 7) % 30 === 0 && chance(state, 0.1)) expand(state, s);
  }
  if (s.damage > 0 && s.wealth > 10) { s.damage = Math.max(0, s.damage - 0.1); s.wealth -= 0.5; }
  s.safety = Math.min(100, s.safety + 0.4);

  if (s.unrest >= 100) rebellion(state, s);
  if (s.mode !== 'civil') return;
  if (s.pop < 25) { abandon(state, s); return; }

  if ((day + s.id) % 8 === 0 && !sieged && foodDays(s) > 40) sendCaravan(state, s);
  if ((day + s.id) % 15 === 0) punish(state, s);
  if ((s.kind === 'town' || s.kind === 'city') && (day + s.id * 11) % 90 === 0 && s.wealth > 300 && chance(state, 0.3)) sendAdventurers(state, s);
}

function startFamine(state, s) {
  s.famine = true;
  log(state, 'economy', 2, `Famine grips ${s.name}: the granaries are empty.`, s);
  note(state, state.npcs[s.ruler], `Faced famine in ${s.name}.`);
  // A desperate ruler may accept a demon's bargain.
  const legion = state.factions.find((f) => f.alive && f.species === 'demon' && f.id !== s.faction);
  if (legion && s.species !== 'angel' && state.factions[s.faction].capital !== s.id) {
    const cap = state.sites[legion.capital];
    if (cap && dist2(cap, s) < 70 && chance(state, 0.25)) {
      const old = s.faction;
      s.food += mouths(s) * 60;
      s.hunger = 0;
      s.famine = false;
      s.faction = legion.id;
      s.unrest = Math.min(80, s.unrest + 10);
      log(state, 'people', 2, `${s.name} signs a pact with the ${legion.name}: grain appears overnight, and the town leaves the ${facName(state, old)}.`, s);
    }
  }
}

function refugees(state, s) {
  let best = null, bfd = 10;
  for (const { to } of neighbors(state, s.id)) {
    const t = state.sites[to];
    if (t.mode !== 'civil' || t.hunger > 0 || t.siege !== null || attitude(s.species, t.species) < -20) continue;
    const fd = foodDays(t);
    if (fd > bfd) { bfd = fd; best = t; }
  }
  if (!best) return;
  for (const k in s.pops) {
    const moved = s.pops[k] * 0.03;
    s.pops[k] -= moved;
    s.pop -= moved;
    addPop(best, k, moved);
  }
  if (s.hunger === 5) log(state, 'people', 0, `Refugees leave ${s.name} for ${best.name}.`, s);
}

function sendCaravan(state, s) {
  const d = dijkstra(state, s.id, 60);
  let best = null, bs = 0;
  for (const t of state.sites) {
    if (t === s || t.mode !== 'civil' || t.faction !== s.faction || t.siege !== null || d.dist[t.id] > 60) continue;
    const fd = foodDays(t);
    if (fd >= 45) continue;
    const score = (45 - fd) / (10 + d.dist[t.id]);
    if (score > bs) { bs = score; best = t; }
  }
  if (!best) return;
  const amount = Math.min(s.food - mouths(s) * 30, s.pop * 16);
  if (amount < 200) return;
  s.food -= amount;
  s.wealth += amount * 0.004;
  spawn(state, {
    type: 'caravan', species: s.species, faction: s.faction, from: s.id, to: best.id, home: s.id,
    path: routePath(state, d, best.id), speed: 3, size: Math.round(8 + Math.min(32, Math.sqrt(s.wealth) / 2)),
    might: SP[s.species].might, cargo: { food: amount, wealth: 0, captives: 0 },
  });
}

function expand(state, s) {
  const sp = SP[s.species];
  const f = state.factions[s.faction];
  const civilCount = state.sites.filter((t) => t.mode === 'civil').length;
  if (s.kind === 'village' || s.kind === 'town') {
    // Settlers found a new village nearby.
    if (civilCount < state.maxSites) {
      const sea = sp.biomes.includes(B.SHALLOWS);
      const biomes = sea ? [B.SHALLOWS] : [B.PLAINS, B.STEPPE, B.FOREST, B.HILLS, B.SWAMP, B.DESERT, B.ENCHANTED, B.DEEPWOOD, B.TUNDRA, B.DARKLANDS, B.MOUNTAIN];
      const spot = findSpot(state, { biomes, near: { x: s.x, y: s.y, rmin: 4, rmax: 9 }, minDist: 4, tries: 40 });
      if (spot) {
        const taken = new Set(state.sites.map((t) => t.name));
        const settlers = s.pop * 0.18;
        const v = makeSite(state, { name: placeName(state, sp.style, taken), kind: 'village', label: 'new village', species: s.species, mode: 'civil', x: spot.x, y: spot.y, faction: s.faction });
        for (const k in s.pops) { const moved = s.pops[k] * 0.18; s.pops[k] -= moved; v.pops[k] = moved; }
        s.pop -= settlers;
        v.pop = settlers;
        v.food = settlers * 60;
        s.food = Math.max(0, s.food - settlers * 60);
        v.unrest = 5;
        installRuler(state, v);
        connect(state, s.id, v.id);
        let near = null, nd = 40;
        for (const t of state.sites) if (t !== s && t !== v && t.mode === 'civil' && dist2(t, v) < nd) { nd = dist2(t, v); near = t; }
        if (near) connect(state, v.id, near.id);
        log(state, 'people', 1, `Settlers from ${s.name} found the village of ${v.name}.`, v);
        return;
      }
    }
    if (s.kind === 'village' && chance(state, 0.4)) {
      const towns = civilOf(state, f.id).filter((t) => t.kind !== 'village').length;
      const villages = civilOf(state, f.id).filter((t) => t.kind === 'village').length;
      if (towns * 2 < villages) {
        s.kind = 'town';
        s.label = 'town';
        log(state, 'people', 1, `${s.name} has grown into a town.`, s);
      }
    }
  }
}

// ---- unrest ---------------------------------------------------------------

function reassignCapital(state, f) {
  const left = civilOf(state, f.id).sort((a, b) => b.pop - a.pop || a.id - b.id);
  if (!left.length) {
    f.alive = false;
    for (const g in f.wars) delete state.factions[g].wars[f.id];
    f.wars = {};
    log(state, 'war', 3, `The ${f.name} is no more.`);
    return;
  }
  f.capital = left[0].id;
  const r = state.npcs[left[0].ruler];
  f.ruler = r && r.alive ? r.id : installRuler(state, left[0]).id;
}

function rebellion(state, s) {
  const f = state.factions[s.faction];
  const rebels = s.pop * 0.08 * randRange(state, 0.6, 1.4);
  const loyal = s.garrison * SP[s.species].might * 1.2 * randRange(state, 0.7, 1.3);
  const ruler = state.npcs[s.ruler];
  if (rebels <= loyal) {
    killPop(s, s.pop * 0.04);
    s.garrison *= 0.85;
    s.damage = Math.min(100, s.damage + 6);
    s.unrest = 60;
    log(state, 'people', 1, `A rebellion in ${s.name} is crushed by the garrison.`, s);
    return;
  }
  killPop(s, s.pop * 0.03);
  s.garrison *= 0.3;
  s.damage = Math.min(100, s.damage + 10);
  s.unrest = 30;
  if (f.capital === s.id) {
    s.unrest = 12;
    removeNpc(state, ruler, `Overthrown in the uprising of ${s.name}.`);
    const n = installRuler(state, s);
    log(state, 'people', 2, `Uprising in ${s.name}: ${ruler ? ruler.title + ' ' + ruler.name : 'the ruler'} is overthrown and ${n.title} ${n.name} takes the ${f.name}.`, s);
  } else if (s.kind === 'village') {
    const camps = state.sites.filter((t) => t.outlaw && t.mode === 'raider').length;
    const spot = camps < 8 && findSpot(state, { biomes: [B.FOREST, B.HILLS, B.DEEPWOOD, B.PLAINS, B.STEPPE, B.SWAMP], near: { x: s.x, y: s.y, rmin: 3, rmax: 8 }, minDist: 3, tries: 40 });
    if (spot) {
      const gone = s.pop * 0.12;
      killPop(s, gone);
      const camp = makeSite(state, { name: placeName(state, 'human', new Set(state.sites.map((t) => t.name))), kind: 'lair', label: 'bandit camp', species: s.species, mode: 'raider', outlaw: true, x: spot.x, y: spot.y, pop: gone, orig: 'bandit' });
      camp.food = gone * 30;
      camp.cd = randInt(state, 15, 40);
      camp.boss = makeNpc(state, s.species, 'chief', camp, { title: 'Bandit Chief' }).id;
      connect(state, camp.id, s.id, true);
      log(state, 'people', 1, `Revolt in ${s.name}: the angriest take to the wilds and raise the bandit camp of ${camp.name}.`, s);
    } else {
      log(state, 'people', 1, `Riots shake ${s.name}; the garrison is driven out.`, s);
    }
  } else {
    removeNpc(state, ruler, `Driven out by the rebels of ${s.name}.`);
    const nf = makeFaction(state, { name: `Free City of ${s.name}`, species: s.species, gov: 'Free City', capital: s.id });
    for (const g of state.factions) {
      if (g.id === nf.id) continue;
      const v = g.id === f.id ? -50 : f.rel[g.id] ?? 0;
      nf.rel[g.id] = v;
      g.rel[nf.id] = v;
    }
    s.faction = nf.id;
    installRuler(state, s);
    log(state, 'people', 2, `${s.name} rebels against the ${f.name} and declares itself a free city.`, s);
  }
}

function abandon(state, s) {
  const f = state.factions[s.faction];
  log(state, 'people', 2, `${s.name} is abandoned; only ruins remain.`, s);
  for (const id of s.notables.slice()) removeNpc(state, state.npcs[id], `Lost with the fall of ${s.name}.`);
  s.mode = 'empty';
  s.kind = 'lair';
  s.label = `ruins of a ${s.label}`;
  s.orig = 'ruin';
  s.pops = {}; s.pop = 0; s.garrison = 0; s.food = 0; s.faction = null; s.siege = null; s.grudges = {}; s.ruler = null;
  if (f && f.capital === s.id) reassignCapital(state, f);
}

// ---- expeditions and adventurers -----------------------------------------

function punish(state, s) {
  const f = state.factions[s.faction];
  for (const key in s.grudges) {
    const lair = state.sites[key];
    if (lair.mode !== 'raider') { delete s.grudges[key]; continue; }
    if (s.grudges[key] < 3 || state.day < f.expCd) continue;
    const need = lair.pop * SP[lair.species].might * 1.3 * 1.5;
    const d = dijkstra(state, lair.id, 50);
    let origin = null;
    for (const o of civilOf(state, f.id)) {
      if (d.dist[o.id] > 50 || o.siege !== null) continue;
      if (o.garrison * 0.6 * SP[o.species].might > need && (!origin || o.garrison > origin.garrison)) origin = o;
    }
    if (!origin) { f.expCd = state.day + 60; continue; }
    const size = origin.garrison * 0.6;
    origin.garrison -= size;
    f.expCd = state.day + 200;
    const path = routePath(state, d, origin.id);
    spawn(state, { type: 'expedition', species: origin.species, faction: f.id, from: origin.id, to: lair.id, home: origin.id, path: path && path.slice().reverse(), speed: 2.5, size, might: SP[origin.species].might });
    log(state, 'raid', 1, `${origin.name} sends ${fmt(size)} soldiers to root out the ${lair.label} of ${lair.name}.`, origin);
    return;
  }
}

function clearLair(state, lair, why) {
  for (const id of lair.notables.slice()) removeNpc(state, state.npcs[id], why);
  for (const t of state.sites) delete t.grudges[lair.id];
  lair.mode = 'empty';
  lair.label = lair.orig === 'bandit' ? 'abandoned camp' : `empty ${SP[lair.species].lair || 'lair'}`;
  lair.pops = {}; lair.pop = 0; lair.food = 0; lair.threat = 0; lair.boss = null; lair.outlaw = false; lair.away = false;
}

function sendAdventurers(state, s) {
  const d = dijkstra(state, s.id, 38);
  const options = [];
  for (const t of state.sites) {
    if (d.dist[t.id] > 38) continue;
    if (t.mode === 'wild') options.push(t);
    else if (t.mode === 'raider' && hostile(t, s) && t.pop * (t.outlaw ? 1 : SP[t.species].might) < 70) options.push(t);
  }
  if (!options.length) return;
  const t = pick(state, options);
  const leader = makeNpc(state, pick(state, Object.keys(s.pops)), 'adventurer', null, { title: 'Adventurer', home: s.id });
  const rank = randRange(state, 30, 130);
  spawn(state, { type: 'adventurers', species: leader.species, faction: s.faction, from: s.id, to: t.id, home: s.id, path: routePath(state, d, t.id), speed: 3.2, size: randInt(state, 3, 6), might: rank, leader: leader.id });
  log(state, 'monster', 0, `${leader.name}'s party leaves ${s.name} for the ${t.label} of ${t.name}.`, s);
}

// ===========================================================================
// Raiders, dragons and the wild
// ===========================================================================

function updateRaider(state, s) {
  const sp = SP[s.species];
  const cap = s.outlaw ? 160 : sp.cap || 200;
  s.food -= s.pop * 0.15;
  if (s.food <= 0) { s.food = 0; killPop(s, s.pop * 0.002); }
  else if (s.pop < cap) scalePop(s, 1 + 0.001 * (s.outlaw ? 0.5 : sp.fert));
  if (s.pop < (sp.lairPop ? Math.min(3, sp.lairPop[0]) : 3) && !s.away) {
    log(state, 'raid', 1, `The ${s.label} of ${s.name} dwindles and falls silent.`, s);
    clearLair(state, s, 'Faded away with the lair.');
    return;
  }
  if (s.species === 'kobold' && state.day % 30 === 0) {
    for (const t of state.sites) if (t.mode === 'dragon' && dist2(t, s) < 14 && state.npcs[t.boss]) state.npcs[t.boss].hoard += 15;
  }
  if (s.away || --s.cd > 0) return;
  if (s.food > s.pop * 25) { s.cd = 20; return; } // well fed: no need to risk a raid
  const r = s.outlaw ? { settle: true, roads: true, range: 26, freq: 1 } : sp.raid;
  const might = s.outlaw ? 1 : sp.might;
  const size = s.pop * 0.5;
  const d = dijkstra(state, s.id, r.range);
  const reach = state.sites.filter((t) => t.mode === 'civil' && d.dist[t.id] <= r.range && hostile(s, t));
  s.cd = Math.round(randInt(state, 12, 30) / r.freq);
  if (!reach.length) return;
  if (r.settle) {
    let best = null, bs = 0;
    for (const t of reach) {
      if (!r.feed && defense(t) * randRange(state, 0.8, 1.3) > size * might) continue;
      if (r.feed && t.kind === 'village') continue;
      const score = (r.feed ? t.pop : t.food * 0.2 + t.wealth * 5) * (0.2 + t.safety / 100) / (5 + d.dist[t.id]);
      if (score > bs) { bs = score; best = t; }
    }
    if (best && (!r.roads || s.food < s.pop * 20 || chance(state, 0.5))) {
      s.away = true;
      spawn(state, { type: 'raid', species: s.species, outlaw: s.outlaw, from: s.id, to: best.id, home: s.id, path: routePath(state, d, best.id), speed: 3.5, size: r.feed ? Math.max(2, size * 0.5) : size, might, feed: !!r.feed, kidnap: !!r.kidnap });
      return;
    }
  }
  if (r.roads) {
    // Lie in wait on a road between two settlements.
    const roads = [];
    for (const t of reach) for (const n of neighbors(state, t.id)) {
      const e = state.edges[n.edge];
      if (!e.trail && state.sites[n.to].mode === 'civil' && e.path.length > 4) roads.push([t, e]);
    }
    if (!roads.length) return;
    const [t, e] = pick(state, roads);
    const seg = e.a === t.id ? e.path : e.path.slice().reverse();
    const k = Math.floor(seg.length * randRange(state, 0.3, 0.7));
    const path = routePath(state, d, t.id).concat(seg.slice(1, k + 1));
    s.away = true;
    spawn(state, { type: 'prowl', species: s.species, outlaw: s.outlaw, from: s.id, to: t.id, home: s.id, path, speed: 3.5, size, might });
  }
}

function updateDragon(state, s) {
  const dragon = state.npcs[s.boss];
  if (!dragon || !dragon.alive) { clearLair(state, s, ''); return; }
  if (s.away || --s.cd > 0) return;
  let best = null, bs = 0;
  for (const t of state.sites) {
    if (t.mode !== 'civil' || t.species === 'kobold') continue;
    const dd = dist2(s, t);
    if (dd > 55) continue;
    const score = (t.wealth + 200) * (t.kind === 'castle' ? 1.6 : t.kind === 'city' ? 1.3 : 1) * (1 - t.damage / 110) * randRange(state, 0.5, 1.5) / (10 + dd);
    if (score > bs) { bs = score; best = t; }
  }
  s.cd = randInt(state, 220, 520);
  if (!best) return;
  s.away = true;
  spawn(state, { type: 'dragon', species: 'dragon', from: s.id, to: best.id, home: s.id, path: flightPath(state, s.id, best.id), speed: 9, size: 1, might: dragon.power, leader: dragon.id, fly: true });
  log(state, 'monster', 1, `The dragon ${dragon.name} leaves ${s.name} and takes wing.`, s);
}

function updateWild(state, s) {
  const sp = SP[s.species];
  s.threat = Math.min(100, s.threat + sp.grow * randRange(state, 0.5, 1.5));
  const tick = (state.day + s.id * 3) % 20 === 0;
  if (!tick) return;
  if (s.species === 'ghost') {
    for (const t of state.sites) {
      if (t.mode === 'civil' && dist2(t, s) < 9 && s.threat > 30) {
        t.unrest = Math.min(100, t.unrest + 2);
        if (chance(state, 0.08)) log(state, 'monster', 0, `Folk in ${t.name} whisper of a spirit that walks from ${s.name} at night.`, t);
      }
    }
    return;
  }
  if (!sp.horde || s.threat < 70 || !chance(state, 0.3)) return;
  const d = dijkstra(state, s.id, 32);
  let best = null, bd = Infinity;
  for (const t of state.sites) if (t.mode === 'civil' && d.dist[t.id] < bd) { bd = d.dist[t.id]; best = t; }
  if (!best) return;
  const size = s.threat * sp.horde;
  s.threat = 25;
  spawn(state, { type: 'horde', species: s.species, from: s.id, to: best.id, home: s.id, path: routePath(state, d, best.id), speed: 2, size, might: sp.might });
  const what = s.species === 'undead' ? 'A host of the dead rises' : s.species === 'slime' ? 'A tide of slimes oozes' : `${s.element || 'Wild'} elementals rage`;
  log(state, 'monster', 1, `${what} out of ${s.name} towards ${best.name}.`, s);
}

function updateEmpty(state, s) {
  if ((state.day + s.id * 13) % 30 !== 0 || !chance(state, 0.05)) return;
  const taken = new Set(state.sites.map((t) => t.name));
  const o = s.orig;
  if (o === 'dragon') {
    if (!chance(state, 0.15)) return;
    const npc = makeNpc(state, 'dragon', 'dragon', s, { title: 'Dragon', power: randInt(state, 250, 480), hoard: randInt(state, 300, 1500), age: randInt(state, 60, 200) });
    Object.assign(s, { mode: 'dragon', species: 'dragon', label: 'dragon lair', pops: { dragon: 1 }, pop: 1, boss: npc.id, cd: randInt(state, 120, 300), name: `${npc.name}'s Peak` });
    log(state, 'monster', 2, `A young dragon, ${npc.name}, claims the empty lair.`, s);
    return;
  }
  let species = o;
  if (o === 'ruin') species = pick(state, ['ghost', 'undead', 'bandit', 'goblin']);
  if (species === 'bandit') {
    const n = randInt(state, 30, 70);
    Object.assign(s, { mode: 'raider', species: 'human', outlaw: true, label: 'bandit camp', pops: { human: n }, pop: n, food: n * 30, cd: randInt(state, 15, 40) });
    s.boss = makeNpc(state, 'human', 'chief', s, { title: 'Bandit Chief' }).id;
    log(state, 'raid', 1, `Outlaws make camp at ${s.name}.`, s);
    return;
  }
  const sp = SP[species];
  if (!sp) return;
  if (sp.mode === 'raider') {
    const n = randInt(state, sp.lairPop[0], Math.round((sp.lairPop[0] + sp.lairPop[1]) / 2));
    Object.assign(s, { mode: 'raider', species, label: sp.lair, pops: { [species]: n }, pop: n, food: n * 30, cd: randInt(state, 20, 50) });
    s.boss = makeNpc(state, species, 'chief', s, { title: 'Chief' }).id;
    if (o === 'ruin') s.name = placeName(state, sp.style, taken);
    log(state, 'raid', 1, `${sp.plural} have crept into ${s.name}.`, s);
  } else if (sp.mode === 'wild') {
    Object.assign(s, { mode: 'wild', species, label: o === 'ruin' ? (species === 'ghost' ? 'haunted ruin' : 'cursed ruin') : sp.lair, threat: 20 });
    if (species === 'ghost') s.boss = makeNpc(state, 'ghost', 'ghost', s, { title: 'Restless Spirit', goal: 'see their home restored' }).id;
    log(state, 'monster', 1, species === 'ghost' ? `The ruins of ${s.name} are said to be haunted.` : `${sp.plural} stir again at ${s.name}.`, s);
  }
}

// ===========================================================================
// Parties on the map
// ===========================================================================

function addGrudge(t, lairId) {
  t.grudges[lairId] = (t.grudges[lairId] || 0) + 1;
}

function arrive(state, p) {
  if (p.state === 'return') return arriveHome(state, p);
  const t = state.sites[p.to];
  const home = state.sites[p.home];
  switch (p.type) {
    case 'caravan': {
      if (t.mode !== 'civil') return turnBack(p);
      if (t.siege !== null) {
        const army = state.parties.find((q) => q.id === t.siege);
        log(state, 'war', 1, `A supply caravan bound for ${t.name} is seized by the besiegers.`, t);
        if (army) army.cargo.food += p.cargo.food;
        p.done = true;
        return;
      }
      t.food += p.cargo.food;
      const pay = Math.min(t.wealth, p.cargo.food * 0.004);
      t.wealth -= pay;
      p.done = true;
      return;
    }
    case 'prowl':
      p.state = 'prowl';
      p.timer = randInt(state, 20, 40);
      return;
    case 'raid': return resolveRaid(state, p, t, home);
    case 'horde': return resolveHorde(state, p, t, home);
    case 'dragon': return resolveDragon(state, p, t, home);
    case 'expedition': return resolveExpedition(state, p, t);
    case 'adventurers': return resolveAdventure(state, p, t);
    case 'army': return resolveArmy(state, p, t);
    default: p.done = true;
  }
}

function arriveHome(state, p) {
  const home = state.sites[p.home];
  p.done = true;
  switch (p.type) {
    case 'raid': case 'prowl':
      if (home.mode !== 'raider') return;
      home.away = false;
      home.food += p.cargo.food;
      home.wealth += p.cargo.wealth;
      home.captives += p.cargo.captives;
      return;
    case 'dragon': {
      home.away = false;
      const dragon = state.npcs[p.leader];
      if (dragon) dragon.hoard += p.cargo.wealth;
      return;
    }
    case 'caravan':
      if (home.mode === 'civil') home.food += p.cargo.food;
      return;
    case 'adventurers': {
      const leader = state.npcs[p.leader];
      if (home.mode === 'civil') {
        home.wealth += p.cargo.wealth;
        if (leader) {
          leader.site = home.id;
          if (home.notables.length < 9) home.notables.push(leader.id);
          note(state, leader, `Returned to ${home.name} with ${fmt(p.cargo.wealth)} gold in loot.`);
        }
      }
      return;
    }
    default: // expedition or army coming home
      if (home.mode === 'civil' && home.faction === p.faction) {
        home.garrison += p.size;
        home.wealth += p.cargo.wealth;
        home.food += p.cargo.food;
        if (p.cargo.captives > 0) {
          addPop(home, home.species, p.cargo.captives);
          log(state, 'raid', 1, `${fmt(p.cargo.captives)} freed captives are brought safely to ${home.name}.`, home);
        }
      }
  }
}

function loseRaiders(state, p, home, fraction) {
  const lost = p.size * fraction;
  p.size -= lost;
  if (home.mode === 'raider') killPop(home, lost);
}

function resolveRaid(state, p, t, home) {
  const who = p.outlaw ? 'Bandits' : SP[p.species].plural;
  if (t.mode !== 'civil') return turnBack(p);
  if (p.feed) {
    const victims = Math.min(t.pop * 0.01, p.size * 3 + rand(state) * 5);
    killPop(t, victims);
    t.unrest = Math.min(100, t.unrest + 5);
    p.cargo.food += victims * 40;
    addGrudge(t, home.id);
    log(state, 'raid', chance(state, 0.25) ? 1 : 0, `People vanish by night in ${t.name}; pale strangers were seen on the road from ${home.name}.`, t);
    if (chance(state, 0.2)) loseRaiders(state, p, home, 0.2);
    return turnBack(p);
  }
  const att = p.size * p.might * randRange(state, 0.7, 1.3);
  const def = defense(t) * randRange(state, 0.7, 1.3);
  addGrudge(t, home.id);
  t.safety = Math.max(0, t.safety - 25);
  if (att > def) {
    const food = t.food * 0.25, gold = t.wealth * 0.2;
    t.food -= food; t.wealth -= gold;
    p.cargo.food += food; p.cargo.wealth += gold;
    let taken = 0;
    if (p.kidnap) { taken = Math.min(t.pop * 0.03, p.size * 0.4); killPop(t, taken); p.cargo.captives += taken; }
    killPop(t, t.pop * randRange(state, 0.01, 0.03));
    t.garrison *= 0.7;
    t.damage = Math.min(100, t.damage + randInt(state, 8, 20));
    t.unrest = Math.min(100, t.unrest + 10);
    loseRaiders(state, p, home, 0.1);
    log(state, 'raid', t.kind === 'village' ? 1 : 2, `${who} from ${home.name} sack ${t.name}${taken ? ` and drag off ${fmt(taken)} captives` : ''}.`, t);
    note(state, state.npcs[t.ruler], `${t.name} was sacked by ${who.toLowerCase()}.`);
  } else {
    t.garrison *= 0.92;
    loseRaiders(state, p, home, 0.45);
    log(state, 'raid', 1, `${who} from ${home.name} attack ${t.name} and are beaten back.`, t);
  }
  turnBack(p);
}

function resolveHorde(state, p, t, home) {
  p.done = true;
  if (t.mode !== 'civil') return;
  const att = p.size * p.might * randRange(state, 0.7, 1.3);
  const def = defense(t) * randRange(state, 0.7, 1.3);
  t.safety = Math.max(0, t.safety - 20);
  if (att > def) {
    killPop(t, t.pop * randRange(state, 0.03, 0.06));
    t.garrison *= 0.6;
    t.damage = Math.min(100, t.damage + randInt(state, 10, 22));
    t.unrest = Math.min(100, t.unrest + 10);
    if (p.species === 'undead' && home.mode === 'wild') home.threat = Math.min(100, home.threat + 25);
    log(state, 'monster', 2, `${SP[p.species].plural} from ${home.name} overrun the defences of ${t.name}.`, t);
  } else {
    t.garrison *= 0.9;
    log(state, 'monster', 1, `${t.name} repels the ${SP[p.species].plural.toLowerCase()} of ${home.name}.`, t);
  }
}

function resolveDragon(state, p, t, home) {
  const dragon = state.npcs[p.leader];
  if (t.mode !== 'civil') return turnBack(p);
  const def = defense(t) * 0.6 * randRange(state, 0.5, 1.5);
  const power = dragon.power * 1.5 * randRange(state, 0.7, 1.3);
  if (def > power) {
    t.wealth += dragon.hoard;
    t.damage = Math.min(100, t.damage + 15);
    t.garrison *= 0.7;
    log(state, 'monster', 3, `The dragon ${dragon.name} is slain over ${t.name}! Its hoard of ${fmt(dragon.hoard)} gold goes to the victors.`, t);
    note(state, state.npcs[t.ruler], `Saw the dragon ${dragon.name} slain at ${t.name}.`);
    dragon.hoard = 0;
    removeNpc(state, dragon, `Slain by the defenders of ${t.name}.`);
    clearLair(state, home, '');
    p.done = true;
    return;
  }
  const gold = t.wealth * randRange(state, 0.25, 0.45);
  t.wealth -= gold;
  p.cargo.wealth += gold;
  killPop(t, t.pop * randRange(state, 0.02, 0.06));
  t.garrison *= randRange(state, 0.5, 0.7);
  t.damage = Math.min(100, t.damage + randInt(state, 18, 35));
  t.unrest = Math.min(100, t.unrest + 15);
  t.food *= 0.8;
  dragon.power = Math.round(dragon.power * (def > power * 0.5 ? 0.9 : 1.02));
  log(state, 'monster', 3, `The dragon ${dragon.name} descends on ${t.name}: buildings burn and ${fmt(gold)} gold is carried off.`, t);
  note(state, dragon, `Burned ${t.name}.`);
  const ruler = state.npcs[t.ruler];
  if (ruler && chance(state, 0.12)) {
    removeNpc(state, ruler, `Died in the dragon fire at ${t.name}.`);
    const n = installRuler(state, t);
    log(state, 'people', 1, `${ruler.title} ${ruler.name} dies in the flames; ${n.title} ${n.name} succeeds.`, t);
  } else note(state, ruler, `Survived the dragon attack on ${t.name}.`);
  turnBack(p);
}

function resolveExpedition(state, p, lair) {
  if (lair.mode !== 'raider') return turnBack(p);
  const sp = SP[lair.species];
  const att = p.size * p.might * randRange(state, 0.7, 1.3);
  const def = lair.pop * (lair.outlaw ? 1 : sp.might) * 1.3 * randRange(state, 0.7, 1.3);
  if (att > def) {
    p.size *= 0.8;
    p.cargo.captives += lair.captives;
    p.cargo.wealth += lair.wealth;
    lair.captives = 0; lair.wealth = 0;
    log(state, 'raid', 2, `Soldiers of the ${facName(state, p.faction)} destroy the ${lair.label} of ${lair.name}.`, lair);
    clearLair(state, lair, `Killed when ${lair.name} was destroyed.`);
  } else {
    p.size *= 0.4;
    killPop(lair, lair.pop * 0.2);
    log(state, 'raid', 1, `The expedition against ${lair.name} is routed.`, lair);
  }
  turnBack(p);
}

function resolveAdventure(state, p, t) {
  const leader = state.npcs[p.leader];
  let danger;
  if (t.mode === 'wild') danger = t.threat * 1.2 + 20;
  else if (t.mode === 'raider') danger = t.pop * (t.outlaw ? 1 : SP[t.species].might) * 1.3;
  else {
    note(state, leader, `Found ${t.name} empty.`);
    return turnBack(p);
  }
  if (rand(state) < p.might / (p.might + danger)) {
    const loot = danger * randRange(state, 2, 6) + (t.hoard || 0) * 0.3;
    if (t.hoard) t.hoard *= 0.7;
    p.cargo.wealth += loot;
    if (t.mode === 'wild') {
      t.threat = Math.max(0, t.threat - 35);
      if (t.threat <= 0 && !t.boss && t.species !== 'golem' && t.species !== 'elemental') {
        log(state, 'monster', 1, `${leader.name}'s party cleanses the ${t.label} of ${t.name}.`, t);
        clearLair(state, t, `Laid to rest by ${leader.name}.`);
      } else log(state, 'monster', 0, `${leader.name}'s party returns victorious from the ${t.label} of ${t.name}.`, t);
    } else {
      killPop(t, t.pop * 0.15);
      log(state, 'monster', 0, `${leader.name}'s party bloodies the ${t.label} of ${t.name}.`, t);
    }
    note(state, leader, `Triumphed at ${t.name}.`);
    turnBack(p);
  } else {
    log(state, 'monster', 0, `${leader.name}'s party never returns from the ${t.label} of ${t.name}.`, t);
    removeNpc(state, leader, `Fell at ${t.name}.`);
    p.done = true;
  }
}

// ---- war ------------------------------------------------------------------

function capture(state, t, p, how) {
  const winner = state.factions[p.faction];
  const loser = state.factions[t.faction];
  const old = state.npcs[t.ruler];
  t.faction = winner.id;
  t.garrison = p.size * 0.7;
  t.unrest = Math.min(85, t.unrest + 25);
  t.damage = Math.min(100, t.damage + 12);
  killPop(t, t.pop * 0.04);
  t.food += p.cargo.food;
  t.siege = null;
  t.grudges = {};
  p.done = true;
  if (loser.wars[winner.id]) loser.wars[winner.id].exh += 14;
  if (winner.wars[loser.id]) winner.wars[loser.id].exh += 4;
  log(state, 'war', loser.capital === t.id ? 3 : 2, `${t.name} ${how} to the ${winner.name}.`, t);
  if (old) removeNpc(state, old, chance(state, 0.5) ? `Fell defending ${t.name}.` : `Driven into exile when ${t.name} fell.`);
  const captain = state.npcs[p.leader];
  note(state, captain, `Took ${t.name} for the ${winner.name}.`);
  const wasCapital = loser.capital === t.id;
  installRuler(state, t, winner.species);
  if (wasCapital) reassignCapital(state, loser);
}

function resolveArmy(state, p, t) {
  const f = state.factions[p.faction];
  if (t.mode !== 'civil') return turnBack(p);
  if (t.faction === p.faction) { t.garrison += p.size; p.done = true; return; }
  if (!atWar(f, t.faction)) return turnBack(p);
  if (t.siege !== null) {
    const other = state.parties.find((q) => q.id === t.siege);
    if (other && other.faction === p.faction) { other.size += p.size; p.done = true; return; }
    return turnBack(p);
  }
  const att = p.size * p.might * randRange(state, 0.7, 1.3);
  const def = defense(t) * randRange(state, 0.7, 1.3);
  const war = f.wars[t.faction];
  if (war) war.exh += 3;
  if (att > def) {
    p.size *= 0.85;
    return capture(state, t, p, 'falls by storm');
  }
  if (att > def * 0.45) {
    p.state = 'siege';
    p.timer = 0;
    t.siege = p.id;
    p.size *= 0.92;
    t.garrison *= 0.92;
    log(state, 'war', 2, `The army of the ${f.name} lays siege to ${t.name}.`, t);
    return;
  }
  p.size *= 0.6;
  t.garrison *= 0.9;
  log(state, 'war', 1, `The ${f.name} is thrown back from the walls of ${t.name}.`, t);
  turnBack(p);
}

function siegeDay(state, p) {
  const t = state.sites[p.to];
  const f = state.factions[p.faction];
  const lift = (text) => {
    if (t.siege === p.id) t.siege = null;
    if (text) log(state, 'war', 1, text, t);
    turnBack(p);
  };
  if (t.mode !== 'civil' || t.faction === p.faction || !atWar(f, t.faction)) return lift('');
  p.timer++;
  p.size *= 0.997;
  if (t.hunger >= 6) return capture(state, t, p, 'starves and surrenders');
  if (p.timer % 10 === 0) {
    const att = p.size * p.might * randRange(state, 0.6, 1.2);
    const def = defense(t) * randRange(state, 0.7, 1.3);
    if (att > def) return capture(state, t, p, 'is stormed after a long siege and falls');
    p.size *= 0.9;
    t.garrison *= 0.93;
    t.damage = Math.min(100, t.damage + 3);
  }
  if (p.timer > 150 || p.size < 15) lift(`The siege of ${t.name} is lifted.`);
}

function muster(state, f) {
  const enemies = Object.keys(f.wars).map(Number);
  if (!enemies.length || state.day < f.musterCd) return;
  f.musterCd = state.day + randInt(state, 35, 70);
  const own = civilOf(state, f.id).filter((s) => s.siege === null && s.garrison > 25).sort((a, b) => b.garrison - a.garrison || a.id - b.id);
  if (!own.length) return;
  let pickO = null, pickT = null, pickD = null, bs = 0;
  for (const o of own.slice(0, 3)) {
    const d = dijkstra(state, o.id, 75);
    for (const t of state.sites) {
      if (t.mode !== 'civil' || !enemies.includes(t.faction) || d.dist[t.id] > 75) continue;
      const score = o.garrison / (defense(t) + 20) / (10 + d.dist[t.id]) * (t.siege !== null ? 0.3 : 1);
      if (score > bs) { bs = score; pickO = o; pickT = t; pickD = d; }
    }
  }
  if (!pickO) return;
  let size = pickO.garrison * 0.6;
  pickO.garrison -= size;
  for (const o of own) {
    if (o === pickO) continue;
    const levy = o.garrison * 0.25;
    o.garrison -= levy;
    size += levy;
  }
  if (size * SP[f.species].might < 30) { pickO.garrison += size; return; }
  const captain = pickO.notables.map((id) => state.npcs[id]).find((n) => n.role === 'captain');
  spawn(state, { type: 'army', species: f.species, faction: f.id, from: pickO.id, to: pickT.id, home: pickO.id, path: routePath(state, pickD, pickT.id), speed: 2.5, size, might: SP[f.species].might, leader: captain ? captain.id : null });
  log(state, 'war', 1, `An army of ${fmt(size)} marches from ${pickO.name} against ${pickT.name}.`, pickO);
}

function diplomacy(state, f) {
  const mine = civilOf(state, f.id);
  if (!mine.length) { if (f.alive) reassignCapital(state, f); return; }
  for (const g of state.factions) {
    if (g.id <= f.id || !g.alive) continue;
    const theirs = civilOf(state, g.id);
    let near = false;
    for (const a of mine) { for (const b of theirs) if (dist2(a, b) < 30) { near = true; break; } if (near) break; }
    if (!near && !atWar(f, g.id)) continue;
    const base = f.species === g.species ? 0 : attitude(f.species, g.species);
    let rel = f.rel[g.id] ?? base;
    const war = f.wars[g.id];
    if (war) {
      const total = war.exh + g.wars[f.id].exh;
      const years = (state.day - war.since) / YEAR;
      if ((total > 45 && chance(state, 0.15)) || years > 4 || (!near && chance(state, 0.2))) {
        delete f.wars[g.id];
        delete g.wars[f.id];
        f.truce[g.id] = g.truce[f.id] = state.day + 2 * YEAR;
        rel = Math.max(rel, -25);
        log(state, 'war', 2, `Peace is signed between the ${f.name} and the ${g.name}.`, state.sites[f.capital]);
      }
    } else {
      const aggr = (SP[f.species].aggr + SP[g.species].aggr) / 2;
      rel += (base - rel) * 0.03 + randRange(state, -2.5, 2.5);
      if (chance(state, 0.03 * (0.4 + aggr))) {
        rel -= randInt(state, 12, 28);
        log(state, 'war', 0, `${pick(state, ['A border skirmish', 'A slighted envoy', 'A disputed toll', 'A stolen herd', 'A broken betrothal'])} sours relations between the ${f.name} and the ${g.name}.`, state.sites[f.capital]);
      } else if (chance(state, 0.015)) {
        rel += randInt(state, 10, 20);
        log(state, 'people', 0, `${pick(state, ['A royal wedding', 'A trade pact', 'A shared festival', 'An exchange of gifts'])} warms relations between the ${f.name} and the ${g.name}.`, state.sites[f.capital]);
      }
      if (rel < -35 && state.day > (f.truce[g.id] || 90) && chance(state, 0.035 * aggr * (rel < -60 ? 2 : 1))) {
        f.wars[g.id] = { since: state.day, exh: 0 };
        g.wars[f.id] = { since: state.day, exh: 0 };
        rel = -80;
        f.musterCd = state.day + randInt(state, 5, 25);
        g.musterCd = state.day + randInt(state, 5, 25);
        log(state, 'war', 3, `War! The ${f.name} and the ${g.name} take up arms.`, state.sites[f.capital]);
      }
    }
    rel = clamp(rel, -100, 100);
    f.rel[g.id] = rel;
    g.rel[f.id] = rel;
  }
}

// ---- movement -------------------------------------------------------------

function ambushes(state) {
  const w = state.w;
  const prowlers = state.parties.filter((p) => p.state === 'prowl' && !p.done);
  if (!prowlers.length) return;
  for (const c of state.parties) {
    if (c.type !== 'caravan' || c.done || c.state !== 'go') continue;
    const ct = c.path[Math.floor(c.pos)];
    const cx = ct % w, cy = Math.floor(ct / w);
    for (const p of prowlers) {
      if (p.done || p.state !== 'prowl') continue;
      const pt = p.path[p.path.length - 1];
      if (Math.abs((pt % w) - cx) > 1 || Math.abs(Math.floor(pt / w) - cy) > 1) continue;
      if (!hostile(p, c)) continue;
      const home = state.sites[p.home];
      const from = state.sites[c.from], to = state.sites[c.to];
      const who = p.outlaw ? 'Bandits' : SP[p.species].plural;
      const att = p.size * p.might * randRange(state, 0.6, 1.4);
      const def = c.size * c.might * randRange(state, 0.6, 1.4);
      for (const t of [from, to]) {
        if (t.mode !== 'civil') continue;
        t.safety = Math.max(0, t.safety - 15);
        addGrudge(t, home.id);
      }
      if (att > def) {
        p.cargo.food += c.cargo.food;
        c.done = true;
        log(state, 'raid', 1, `${who} from ${home.name} ambush a caravan on the road from ${from.name} to ${to.name}.`, to);
      } else {
        loseRaiders(state, p, home, 0.3);
        log(state, 'raid', 0, `Caravan guards drive off ${who.toLowerCase()} on the road to ${to.name}.`, to);
        turnBack(p);
      }
      break;
    }
  }
}

function moveParties(state) {
  for (const p of state.parties) {
    if (p.done) continue;
    if (p.state === 'siege') { siegeDay(state, p); continue; }
    if (p.state === 'prowl') {
      if (--p.timer <= 0) turnBack(p);
      continue;
    }
    p.pos = Math.min(p.path.length - 1, p.pos + p.speed);
    if (p.pos >= p.path.length - 1) arrive(state, p);
  }
  ambushes(state);
  if (state.parties.some((p) => p.done)) state.parties = state.parties.filter((p) => !p.done);
}

// ---- people ---------------------------------------------------------------

function newYear(state) {
  for (const npc of state.npcs) {
    if (!npc.alive) continue;
    npc.age++;
    if (npc.maxAge === null || npc.age <= npc.maxAge) continue;
    const site = state.sites[npc.site];
    removeNpc(state, npc, 'Died of old age.');
    if (!site || (site.mode !== 'civil' && site.mode !== 'raider')) continue;
    if (site.ruler === npc.id) {
      const heir = installRuler(state, site);
      const f = state.factions[site.faction];
      const big = f && f.capital === site.id;
      log(state, 'people', big ? 2 : 0, `${npc.title} ${npc.name} of ${big ? 'the ' + f.name : site.name} dies of old age; ${heir.title} ${heir.name} succeeds.`, site);
    } else if (site.boss === npc.id) {
      site.boss = makeNpc(state, npc.species, npc.role, site, { title: npc.title }).id;
    } else if (site.mode === 'civil') {
      makeNpc(state, chance(state, 0.8) ? npc.species : pick(state, Object.keys(site.pops)), npc.role, site, { title: npc.title });
    }
  }
}

// ===========================================================================

/** Advance the world by one day. */
export function step(state) {
  state.day++;
  const n = state.sites.length; // sites founded today start tomorrow
  for (let i = 0; i < n; i++) {
    const s = state.sites[i];
    if (s.mode === 'civil') updateCivil(state, s);
    else if (s.mode === 'raider') updateRaider(state, s);
    else if (s.mode === 'dragon') updateDragon(state, s);
    else if (s.mode === 'wild') updateWild(state, s);
    else updateEmpty(state, s);
  }
  moveParties(state);
  for (const f of state.factions) {
    if (!f.alive) continue;
    if ((state.day + f.id) % 10 === 0) diplomacy(state, f);
    if (f.alive) muster(state, f);
  }
  if (state.day % YEAR === 0) newYear(state);
  return state;
}

export function run(state, days) {
  for (let i = 0; i < days; i++) step(state);
  return state;
}
