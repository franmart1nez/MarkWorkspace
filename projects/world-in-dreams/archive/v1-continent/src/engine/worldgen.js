// Builds a new world from a seed: realms, lairs, routes and notable inhabitants.
import { B } from './map.js';
import { hashSeed, rand, randInt, randRange, pick, chance, shuffle } from './rng.js';
import { SP, SPECIES, attitude } from './species.js';
import { placeName, TRADES } from './names.js';
import { KIND, getMap, makeSite, makeFaction, makeNpc, installRuler, connect, dist2, log } from './core.js';

// species, realms, government, capital [kind, label], satellites [kind, label, count], radius
const REALMS = [
  ['human', 3, 'Kingdom', ['city', 'capital city'], [['castle', 'castle', 1], ['town', 'market town', 2], ['village', 'farming village', 5]], 15],
  ['elf', 2, 'Court', ['town', 'elven city'], [['village', 'elven village', 3]], 11],
  ['dwarf', 2, 'Hold', ['town', 'dwarven hold'], [['castle', 'mountain fortress', 1], ['village', 'mining village', 2]], 10],
  ['orc', 2, 'Clan', ['castle', 'orc stronghold'], [['village', 'war camp', 3]], 11],
  ['halfling', 1, 'Shire', ['town', 'shire town'], [['village', 'halfling village', 4]], 9],
  ['catfolk', 1, 'Free Company', ['town', 'caravanserai'], [['village', 'roadside village', 1]], 8],
  ['wolffolk', 2, 'Pack', ['town', 'pack hall'], [['village', 'pack den', 2]], 9],
  ['foxfolk', 1, 'Shrine', ['town', 'shrine town'], [['village', 'shrine village', 2]], 8],
  ['rabbitfolk', 1, 'Warren League', ['town', 'warren town'], [['village', 'meadow warren', 3]], 8],
  ['harpy', 2, 'Flock', ['village', 'great roost'], [['village', 'cliff roost', 1]], 8],
  ['lizardfolk', 2, 'Tribe', ['town', 'temple town'], [['village', 'lizard village', 2]], 9],
  ['minotaur', 1, 'Labyrinth', ['castle', 'labyrinth'], [['village', 'herd village', 1]], 8],
  ['centaur', 2, 'Horde', ['village', 'great camp'], [['village', 'nomad camp', 2]], 10],
  ['merfolk', 2, 'Tide Court', ['town', 'reef city'], [['village', 'reef village', 2]], 9],
  ['arachne', 1, 'Brood', ['town', 'silk city'], [['village', 'web nest', 2]], 8],
  ['lamia', 1, 'Coven', ['town', 'sunken palace'], [['village', 'ruin enclave', 1]], 8],
  ['fairy', 1, 'Fey Court', ['town', 'fairy court'], [['village', 'fairy ring', 2]], 7],
  ['gnome', 1, 'Guild', ['town', 'workshop town'], [['village', 'gnome burrow', 2]], 8],
  ['dryad', 1, 'Circle', ['village', 'elder grove'], [['village', 'dryad grove', 2]], 9],
  ['demon', 1, 'Legion', ['castle', 'infernal citadel'], [['town', 'demon stronghold', 1], ['village', 'thrall village', 1]], 9],
  ['angel', 1, 'Host', ['castle', 'celestial sanctuary'], [['village', 'mountain temple', 1]], 9],
];

const POP = { village: [300, 700], town: [1500, 2600], city: [5000, 8000], castle: [300, 500] };
const HABITABLE = [B.PLAINS, B.STEPPE, B.FOREST, B.DEEPWOOD, B.ENCHANTED, B.HILLS, B.MOUNTAIN, B.SWAMP, B.DESERT, B.TUNDRA, B.DARKLANDS];

function tooClose(state, x, y, minDist) {
  for (const s of state.sites) if (Math.abs(s.x - x) < minDist && Math.abs(s.y - y) < minDist && dist2(s, { x, y }) < minDist) return true;
  return false;
}

/** Best-scoring free tile of the given biomes, anywhere or near a point. */
export function findSpot(state, o) {
  const map = getMap(state);
  const { w, h } = map;
  let total = 0;
  for (const b of o.biomes) total += map.byBiome[b].length;
  let best = null, bestScore = -Infinity;
  for (let k = 0; k < (o.tries || 90); k++) {
    let x, y;
    if (o.near) {
      const r = o.near.rmax;
      x = o.near.x + randInt(state, -r, r);
      y = o.near.y + randInt(state, -r, r);
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
      const d = dist2({ x, y }, o.near);
      if (d > r || d < (o.near.rmin || 0)) continue;
      if (!o.biomes.includes(map.biome[y * w + x])) continue;
    } else {
      if (!total) return null;
      let r = Math.floor(rand(state) * total), idx = -1;
      for (const b of o.biomes) {
        const list = map.byBiome[b];
        if (r < list.length) { idx = list[r]; break; }
        r -= list.length;
      }
      x = idx % w; y = (idx - x) / w;
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
    }
    if (tooClose(state, x, y, o.minDist || 4)) continue;
    let score = map.fert[y * w + x] + rand(state) * 0.3;
    if (o.spread) {
      let dm = 60;
      for (const s of state.sites) dm = Math.min(dm, dist2(s, { x, y }));
      score += dm * 0.08;
    }
    if (score > bestScore) { bestScore = score; best = { x, y }; }
  }
  return best;
}

/** findSpot with progressively relaxed constraints, so every species gets a home. */
function spotFor(state, biomes, o = {}) {
  const sea = biomes.includes(B.SHALLOWS);
  const fallback = sea ? [B.SHALLOWS, B.OCEAN] : HABITABLE;
  return findSpot(state, { ...o, biomes })
    || findSpot(state, { ...o, biomes: fallback, tries: 160 })
    || (o.near && findSpot(state, { ...o, biomes: fallback, near: { ...o.near, rmin: 2, rmax: o.near.rmax * 2 }, minDist: 3, tries: 200 }))
    || findSpot(state, { biomes, minDist: 3, tries: 300 })
    || findSpot(state, { biomes: fallback, minDist: 3, tries: 400 });
}

function civilSite(state, taken, species, kind, label, spot, faction) {
  const sp = SP[species];
  const K = KIND[kind];
  const s = makeSite(state, {
    name: placeName(state, sp.style, taken), kind, label, species, mode: 'civil', x: spot.x, y: spot.y,
    pop: Math.round(randRange(state, POP[kind][0], POP[kind][1]) * sp.pm), faction: faction.id,
  });
  s.garrison = Math.round(s.pop * K.mil * sp.mil);
  s.food = (s.pop + s.garrison) * 70;
  s.wealth = Math.round(s.pop * randRange(state, 0.5, 1.5) * sp.trade);
  s.unrest = randInt(state, 3, 18);
  return s;
}

function populateNotables(state, s) {
  installRuler(state, s);
  if (s.kind !== 'village') makeNpc(state, s.species, 'captain', s, { title: 'Captain of the Guard' });
  const extra = s.kind === 'city' ? 4 : s.kind === 'town' ? 3 : 1;
  const others = Object.keys(s.pops).filter((k) => k !== s.species);
  const used = [];
  for (let i = 0; i < extra; i++) {
    let trade = pick(state, TRADES);
    if (used.includes(trade)) trade = pick(state, TRADES);
    used.push(trade);
    const species = others.length && chance(state, 0.3) ? pick(state, others) : s.species;
    makeNpc(state, species, trade, s, { title: trade });
  }
}

function factionName(state, species, gov, capital, taken) {
  const word = placeName(state, SP[species].style, taken);
  switch (gov) {
    case 'Kingdom': return `Kingdom of ${capital}`;
    case 'Clan': case 'Pack': case 'Flock': case 'Horde': case 'Tribe': case 'Brood': case 'Coven': return `${word} ${gov}`;
    default: return `${gov} of ${capital}`;
  }
}

export function createWorld(seedInput = 'dreams', opts = {}) {
  const seedText = String(seedInput);
  const seed = hashSeed(seedText);
  const state = {
    version: 1, seed, seedText, w: opts.w || 192, h: opts.h || 120, rng: (seed ^ 0x9e3779b9) | 0,
    day: 0, nextId: 1, sites: [], factions: [], npcs: [], parties: [], edges: [], events: [], eventCount: 0,
  };
  const taken = new Set();
  const realmLinks = [];

  // 1. Realms of the civil species.
  for (const [species, count, gov, cap, sats, radius] of REALMS) {
    const sp = SP[species];
    for (let r = 0; r < count; r++) {
      const spot = spotFor(state, sp.biomes, { spread: true, minDist: 7, tries: 140 });
      if (!spot) continue;
      const faction = makeFaction(state, { species, gov });
      const capital = civilSite(state, taken, species, cap[0], cap[1], spot, faction);
      faction.capital = capital.id;
      faction.name = factionName(state, species, gov, capital.name, taken);
      for (const [kind, label, n] of sats) {
        for (let i = 0; i < n; i++) {
          const p = spotFor(state, sp.biomes, { near: { x: spot.x, y: spot.y, rmin: 3, rmax: radius }, minDist: 4 });
          if (!p) continue;
          const s = civilSite(state, taken, species, kind, label, p, faction);
          realmLinks.push([capital.id, s.id]);
        }
      }
    }
  }

  // 2. Minorities in towns and cities: open species mingle.
  const mixers = SPECIES.filter((s) => s.mode === 'civil' && s.open >= 0.5).map((s) => s.id);
  for (const s of state.sites) {
    if (s.kind !== 'town' && s.kind !== 'city') continue;
    if (SP[s.species].open < 0.5) continue;
    const n = s.kind === 'city' ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const m = pick(state, mixers);
      if (m === s.species || attitude(m, s.species) < 0) continue;
      const moved = s.pops[s.species] * randRange(state, 0.02, 0.07);
      s.pops[s.species] -= moved;
      s.pops[m] = (s.pops[m] || 0) + moved;
    }
  }
  const civil = state.sites.slice();
  for (const s of civil) populateNotables(state, s);

  // 3. Dragons first, so kobolds can settle beneath them.
  const dragonLairs = [];
  for (let i = 0; i < 3; i++) {
    const spot = spotFor(state, SP.dragon.biomes, { minDist: 9, spread: true });
    if (!spot) continue;
    const s = makeSite(state, { name: placeName(state, 'dark', taken), kind: 'lair', label: 'dragon lair', species: 'dragon', mode: 'dragon', x: spot.x, y: spot.y, pop: 1, orig: 'dragon' });
    const npc = makeNpc(state, 'dragon', 'dragon', s, { title: 'Dragon', power: randInt(state, 320, 650), hoard: randInt(state, 2000, 9000) });
    s.boss = npc.id;
    s.cd = randInt(state, 60, 260);
    s.name = `${npc.name}'s Peak`;
    dragonLairs.push(s);
  }

  // 4. Raider lairs near the people they prey on.
  const nearCivil = (species, rmin, rmax, biomes, prefer) => {
    for (let t = 0; t < 30; t++) {
      const a = pick(state, civil);
      if (prefer && !prefer(a)) continue;
      if (SP[a.species].biomes.includes(B.SHALLOWS)) continue;
      if (species !== 'bandit' && attitude(species, a.species) >= -20) continue;
      const p = findSpot(state, { biomes, near: { x: a.x, y: a.y, rmin, rmax }, minDist: 4 })
        || findSpot(state, { biomes: HABITABLE, near: { x: a.x, y: a.y, rmin, rmax: rmax + 4 }, minDist: 4 });
      if (p) return p;
    }
    return spotFor(state, biomes, { minDist: 4 });
  };
  const lair = (species, spot, extra = {}) => {
    const sp = SP[species];
    const s = makeSite(state, {
      name: placeName(state, sp.style, taken), kind: 'lair', label: sp.lair, species, mode: 'raider', x: spot.x, y: spot.y,
      pop: randInt(state, sp.lairPop[0], sp.lairPop[1]), orig: species, ...extra,
    });
    s.food = s.pop * 40;
    s.cd = randInt(state, 10, 60);
    const chief = makeNpc(state, species, 'chief', s, { title: species === 'vampire' ? 'Vampire Lord' : species === 'giant' ? 'Jarl' : 'Chief' });
    s.boss = chief.id;
    return s;
  };
  const RAIDERS = [['goblin', 7], ['ogre', 3], ['troll', 3], ['giant', 3], ['vampire', 2]];
  for (const [species, n] of RAIDERS) {
    for (let i = 0; i < n; i++) {
      const prefer = species === 'vampire' ? (a) => a.kind === 'town' || a.kind === 'city' : null;
      const spot = nearCivil(species, 5, 12, SP[species].biomes, prefer);
      if (spot) lair(species, spot);
    }
  }
  for (let i = 0; i < 3; i++) {
    const d = dragonLairs[i % Math.max(1, dragonLairs.length)];
    const spot = d ? spotFor(state, SP.kobold.biomes, { near: { x: d.x, y: d.y, rmin: 3, rmax: 9 }, minDist: 3 }) : spotFor(state, SP.kobold.biomes, {});
    if (spot) lair('kobold', spot);
  }
  for (let i = 0; i < 3; i++) {
    const spot = nearCivil('bandit', 4, 10, [B.FOREST, B.HILLS, B.DEEPWOOD], (a) => a.species === 'human');
    if (!spot) continue;
    const s = makeSite(state, { name: placeName(state, 'human', taken), kind: 'lair', label: 'bandit camp', species: 'human', mode: 'raider', outlaw: true, x: spot.x, y: spot.y, pop: randInt(state, 40, 100), orig: 'bandit' });
    s.food = s.pop * 40;
    s.cd = randInt(state, 10, 50);
    s.boss = makeNpc(state, 'human', 'chief', s, { title: 'Bandit Chief' }).id;
  }

  // 5. Wild sites.
  const wild = (species, spot, label, extra = {}) => {
    const sp = SP[species];
    return makeSite(state, {
      name: placeName(state, sp.style, taken), kind: 'lair', label: label || sp.lair, species, mode: 'wild',
      x: spot.x, y: spot.y, threat: randInt(state, 15, 50), orig: species, ...extra,
    });
  };
  for (let i = 0; i < 3; i++) {
    const spot = i === 0 ? spotFor(state, [B.DARKLANDS], { minDist: 4 }) : nearCivil('undead', 4, 10, SP.undead.biomes);
    if (!spot) continue;
    const s = wild('undead', spot);
    if (i === 0) { s.threat = 65; s.boss = makeNpc(state, 'undead', 'lich', s, { title: 'Lich' }).id; s.label = 'lich barrow'; }
  }
  for (let i = 0; i < 2; i++) {
    const spot = nearCivil('ghost', 3, 8, SP.ghost.biomes);
    if (!spot) continue;
    const s = wild('ghost', spot);
    s.boss = makeNpc(state, 'ghost', 'ghost', s, { title: 'Restless Spirit', goal: pick(state, ['see their killer judged', 'deliver a letter never sent', 'be remembered by name', 'find their lost child']) }).id;
  }
  const ELEMENTS = [['Fire', [B.VOLCANO]], ['Storm', [B.PEAK]], ['Water', [B.SWAMP, B.SHALLOWS]], ['Earth', [B.MOUNTAIN]]];
  for (const [el, biomes] of ELEMENTS) {
    const spot = spotFor(state, biomes, { minDist: 4 });
    if (spot) wild('elemental', spot, `${el.toLowerCase()} elemental node`, { element: el });
  }
  for (let i = 0; i < 4; i++) {
    const spot = nearCivil('slime', 4, 11, SP.slime.biomes);
    if (!spot) continue;
    const s = wild('slime', spot);
    if (chance(state, 0.25)) s.boss = makeNpc(state, 'slime', 'slime', s, { title: 'Talking Slime', traits: ['intelligent', 'curious', 'voracious'], deviant: 2 }).id;
  }
  for (let i = 0; i < 2; i++) {
    const spot = spotFor(state, SP.golem.biomes, { minDist: 6, spread: true });
    if (!spot) continue;
    const s = wild('golem', spot, 'ancient ruin', { threat: 60, hoard: randInt(state, 1500, 5000) });
    s.boss = makeNpc(state, 'golem', 'warden', s, { title: 'Ancient Warden', goal: 'guard the vault until the makers return' }).id;
  }

  // 6. Routes. Roads join settlements; trails lead to lairs.
  for (const [a, b] of realmLinks) connect(state, a, b);
  const isCivil = (s) => s.mode === 'civil';
  for (const s of state.sites) {
    const near = state.sites
      .filter((t) => t !== s && isCivil(t) && dist2(s, t) < 42)
      .sort((p, q) => dist2(s, p) - dist2(s, q) || p.id - q.id)
      .slice(0, 2);
    for (const t of near) connect(state, s.id, t.id, !isCivil(s));
  }
  // Join whatever is still isolated (islands, far lairs) to the main network.
  for (;;) {
    const comp = new Array(state.sites.length).fill(-1);
    const flood = (start, c) => {
      const stack = [start];
      comp[start] = c;
      while (stack.length) {
        const u = stack.pop();
        for (const e of state.edges) {
          const v = e.a === u ? e.b : e.b === u ? e.a : -1;
          if (v >= 0 && comp[v] < 0) { comp[v] = c; stack.push(v); }
        }
      }
    };
    flood(0, 0);
    let bestA = -1, bestB = -1, bd = Infinity;
    for (const a of state.sites) {
      if (comp[a.id] !== 0) continue;
      for (const b of state.sites) {
        if (comp[b.id] === 0) continue;
        const d = dist2(a, b);
        if (d < bd) { bd = d; bestA = a.id; bestB = b.id; }
      }
    }
    if (bestA < 0) break;
    connect(state, bestA, bestB, !(isCivil(state.sites[bestA]) && isCivil(state.sites[bestB])));
  }

  // 7. Opening relations between factions.
  for (const f of state.factions) {
    for (const g of state.factions) {
      if (g.id <= f.id) continue;
      const base = f.species === g.species ? 10 + randInt(state, -35, 25) : attitude(f.species, g.species) + randInt(state, -12, 12);
      f.rel[g.id] = base;
      g.rel[f.id] = base;
    }
  }
  state.maxSites = state.sites.filter((s) => s.mode === 'civil').length + 30;
  log(state, 'world', 3, `The world of "${seedText}" awakens: ${state.factions.length} realms, ${state.sites.length} places and ${SPECIES.length} species.`);
  return state;
}
