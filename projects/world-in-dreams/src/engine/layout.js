// The region, generated from the seed as free-form geometry (metres, no tiles):
// a river, one walled city with radial streets, villages, farmsteads, roads,
// fields, woods and rocks. The layout never changes during play, so it is not
// saved: it is rebuilt from the seed and cached.
import { rand, randRange, randInt, pick, chance, shuffle } from './rng.js';
import { fbm } from './noise.js';
import { hyp, clamp, smooth, segDist, segSeg, corners, bbox, inRect, rectsHit, segHitsRect, Hash } from './geom.js';
import { placeName } from './names.js';

export const W = 5200, H = 3600;
/** Road widths by kind: 0 track, 1 lane or street, 2 road, 3 main street. */
export const RW = [2.6, 4.2, 5.6, 8];
export const RIVER_W = 28;

const CACHE = new Map();
export function layoutFor(seed) {
  let L = CACHE.get(seed);
  if (!L) {
    L = build(seed);
    CACHE.set(seed, L);
    if (CACHE.size > 3) CACHE.delete(CACHE.keys().next().value);
  }
  return L;
}

const TAVERN_A = ['Golden', 'Sleeping', 'Laughing', 'Red', 'Silver', 'Drunken', 'Wandering', 'Lucky', 'Old', 'Merry', 'Blue', 'Hungry'];
const TAVERN_B = ['Stag', 'Dragon', 'Slime', 'Griffin', 'Barrel', 'Lantern', 'Fox', 'Hero', 'Kettle', 'Boar', 'Moon', 'Wyvern'];
const TRADES = ['baker', 'blacksmith', 'carpenter', 'weaver', 'potter', 'tailor', 'cobbler', 'butcher', 'brewer', 'apothecary', 'scribe', 'cooper'];

function build(seed) {
  const R = { rng: seed >>> 0 };
  const X0 = -W / 2, Y0 = -H / 2, X1 = W / 2, Y1 = H / 2;
  const L = {
    seed, W, H, X0, Y0, X1, Y1, nodes: [], edges: [], blds: [], fields: [], sites: [], farms: [], ponds: [], rocks: [],
    exits: [], posts: [], gates: [], bridges: [], lamps: [], spots: { fish: [], wood: [], deer: [], boar: [], rabbit: [], slime: [], den: [] },
  };
  const nodeHash = new Hash(80), edgeHash = new Hash(80), bldHash = new Hash(80), fieldHash = new Hash(120), riverHash = new Hash(120);
  const names = new Set();
  const tmp = [], tmpR = [], tmpN = [];

  // ---- river -----------------------------------------------------------------
  const river = [];
  {
    const ph1 = randRange(R, 3.3, 4.4), ph2 = randRange(R, 0, 6.28), STEP = 16;
    const wig = (s) => (0.42 + 0.22 * smooth(300, 700, Math.abs(s))) * Math.sin(s / 175 + ph1) + 0.2 * Math.sin(s / 71 + ph2);
    const north = [];
    let x = 85, y = 0, s = 0;
    while (y > Y0 - 80 && north.length < 400) {
      s += STEP;
      const th = -Math.PI / 2 + 0.13 * smooth(300, 700, s) + wig(s);
      x += Math.cos(th) * STEP; y += Math.sin(th) * STEP;
      north.push([x, y]);
    }
    const south = [];
    x = 85; y = 0; s = 0;
    while (y < Y1 + 80 && x > X0 - 80 && south.length < 500) {
      s += STEP;
      const th = Math.PI / 2 + 0.9 * smooth(380, 1000, s) + wig(-s);
      x += Math.cos(th) * STEP; y += Math.sin(th) * STEP;
      south.push([x, y]);
    }
    river.push(...north.reverse(), [85, 0], ...south);
    for (let i = 0; i + 1 < river.length; i++) {
      const [ax, ay] = river[i], [bx, by] = river[i + 1];
      riverHash.add(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), { ax, ay, bx, by, i });
    }
  }
  L.river = river;
  const riverDist = (x, y, max = 60) => {
    let best = Infinity;
    for (const s of riverHash.query(x - max, y - max, x + max, y + max, tmpR)) {
      const d = segDist(x, y, s.ax, s.ay, s.bx, s.by);
      if (d < best) best = d;
    }
    return best;
  };
  const riverCross = (ax, ay, bx, by) => {
    for (const s of riverHash.query(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), tmpR)) {
      const t = segSeg(ax, ay, bx, by, s.ax, s.ay, s.bx, s.by);
      if (t >= 0) return { t, i: s.i, x: ax + (bx - ax) * t, y: ay + (by - ay) * t };
    }
    return null;
  };
  /** +1 east bank, -1 west bank (relative to the downstream direction). */
  const riverSide = (x, y) => {
    let best = Infinity, side = 1;
    for (let i = 0; i + 1 < river.length; i++) {
      const [ax, ay] = river[i], [bx, by] = river[i + 1];
      const d = segDist(x, y, ax, ay, bx, by);
      if (d < best) { best = d; side = (bx - ax) * (y - ay) - (by - ay) * (x - ax) > 0 ? -1 : 1; }
    }
    return side;
  };
  const riverNormal = (i) => {
    const a = river[Math.max(0, i - 1)], b = river[Math.min(river.length - 1, i + 1)];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [-(b[1] - a[1]) / d, (b[0] - a[0]) / d];
  };

  // ---- graph helpers -----------------------------------------------------------
  const node = (x, y, city = false) => {
    const n = { id: L.nodes.length, x, y, city, dead: false };
    L.nodes.push(n);
    nodeHash.add(x, y, x, y, n);
    return n.id;
  };
  const ekeys = new Set();
  function edge(a, b, k, bridge = false) {
    if (a === b) return null;
    const key = a < b ? a * 100000 + b : b * 100000 + a;
    if (ekeys.has(key)) return null;
    ekeys.add(key);
    const A = L.nodes[a], B = L.nodes[b];
    const e = { a, b, k, bridge, dead: false };
    L.edges.push(e);
    edgeHash.add(Math.min(A.x, B.x), Math.min(A.y, B.y), Math.max(A.x, B.x), Math.max(A.y, B.y), e);
    return e;
  }
  function nearestNode(x, y, max, ok) {
    let best = max, id = -1;
    for (const n of nodeHash.query(x - max, y - max, x + max, y + max, tmpN)) {
      if (n.dead || (ok && !ok(n))) continue;
      const d = hyp(x, y, n.x, n.y);
      if (d < best) { best = d; id = n.id; }
    }
    return id;
  }
  function splitEdge(e, x, y) {
    const A = L.nodes[e.a], B = L.nodes[e.b];
    if (hyp(x, y, A.x, A.y) < 7) return e.a;
    if (hyp(x, y, B.x, B.y) < 7) return e.b;
    const m = node(x, y, A.city && B.city);
    e.dead = true;
    edge(e.a, m, e.k, e.bridge);
    edge(m, e.b, e.k, e.bridge);
    return m;
  }

  // ---- city: wall, plaza, radial streets ----------------------------------------------
  const rx = 320, ry = 275;
  const inWall = (x, y, inset = 0) => (x / (rx - inset)) ** 2 + (y / (ry - inset)) ** 2 < 1;
  const P = { x: -70, y: 0, r: 34 };
  const C = { x: 0, y: -ry * 0.42, r: 56 };
  {
    let mx = -Infinity;
    for (const [x, y] of river) if (Math.abs(y - C.y) < C.r + 16 && x > mx) mx = x;
    for (; C.r > 38; C.r -= 2) {
      C.x = mx + 32 + C.r;
      if (inWall(C.x + C.r * 0.75, C.y - C.r * 0.75, 16) && inWall(C.x + C.r, C.y, 16)) break;
    }
  }
  L.wall = { rx, ry };
  L.plaza = P;
  const RINGS = [34, 80, 126, 172, 218, 264, 310, 356, 402, 448];
  const spokesAt = (r) => (r < 60 ? 8 : r < 190 ? 16 : 32);
  const grid = RINGS.map((r) => new Array(spokesAt(r)).fill(-1));
  const cardinal = [[], [], [], []];
  RINGS.forEach((r, i) => {
    const n = grid[i].length;
    for (let j = 0; j < n; j++) {
      const card = j % (n / 4) === 0;
      const th = (2 * Math.PI * j) / n + (card ? 0 : randRange(R, -0.13, 0.13) * (2 * Math.PI / n));
      const rr = r + (card || i === 0 ? 0 : randRange(R, -6, 6));
      const x = P.x + Math.cos(th) * rr, y = P.y + Math.sin(th) * rr;
      if (!inWall(x, y, 24) || riverDist(x, y) < RIVER_W / 2 + 12 || hyp(x, y, C.x, C.y) < C.r + 14) continue;
      grid[i][j] = node(x, y, true);
      if (card) cardinal[j / (n / 4)].push(grid[i][j]);
    }
  });
  const cityEdge = (a, b, k) => {
    if (a < 0 || b < 0) return;
    const A = L.nodes[a], B = L.nodes[b];
    if (!riverCross(A.x, A.y, B.x, B.y)) edge(a, b, k);
  };
  RINGS.forEach((r, i) => {
    const n = grid[i].length;
    for (let j = 0; j < n; j++) {
      if (i === 0 || i < 2 || !chance(R, 0.1)) cityEdge(grid[i][j], grid[i][(j + 1) % n], 1);
      if (i + 1 < RINGS.length) {
        const m = grid[i + 1].length / n;
        cityEdge(grid[i][j], grid[i + 1][j * m], j % (n / 4) === 0 ? 3 : 1);
      }
    }
  });
  const P0 = node(P.x, P.y, true);
  for (let c = 0; c < 4; c++) edge(P0, grid[0][c * 2], 3);

  function bridgeAt(i, k) {
    const [x, y] = river[i], [nx, ny] = riverNormal(i), off = RIVER_W / 2 + 5;
    const ends = [-1, 1].map((sd) => node(x + nx * sd * off, y + ny * sd * off, true));
    edge(ends[0], ends[1], k, true);
    L.bridges.push({ a: ends[0], b: ends[1] });
    ends.forEach((id, q) => {
      const B = L.nodes[id], sd = q ? 1 : -1;
      let best = Infinity, to = -1;
      for (const n of nodeHash.query(B.x - 130, B.y - 130, B.x + 130, B.y + 130, [])) {
        if (n.id === ends[0] || n.id === ends[1] || n.dead || ((n.x - x) * nx + (n.y - y) * ny) * sd <= 0) continue;
        const d = hyp(B.x, B.y, n.x, n.y);
        if (d < best && !riverCross(B.x, B.y, n.x, n.y)) { best = d; to = n.id; }
      }
      if (to >= 0) edge(id, to, k);
    });
  }
  const riverIndexAtY = (ty) => {
    let bi = 0, bd = Infinity;
    river.forEach(([, y], i) => { if (Math.abs(y - ty) < bd) { bd = Math.abs(y - ty); bi = i; } });
    return bi;
  };
  bridgeAt(riverIndexAtY(0), 3);
  bridgeAt(riverIndexAtY(-ry * 0.5), 1);
  bridgeAt(riverIndexAtY(ry * 0.52), 1);

  // gates on the four main streets
  const yg = ry * Math.sqrt(1 - (P.x / rx) ** 2);
  [[rx, 0, 1, 0, 'East'], [P.x, yg, 0, 1, 'South'], [-rx, 0, -1, 0, 'West'], [P.x, -yg, 0, -1, 'North']].forEach(([gx, gy, ox, oy, name], c) => {
    const g = node(gx, gy, true), out = node(gx + ox * 46, gy + oy * 46);
    const last = cardinal[c][cardinal[c].length - 1];
    edge(last, g, 3);
    edge(g, out, 3);
    L.gates.push({ x: gx, y: gy, ox, oy, n: g, out, name: `${name} Gate` });
    for (const sd of [-1, 1]) L.posts.push({ x: gx - ox * 9 - oy * sd * 6.5, y: gy - oy * 9 + ox * sd * 6.5, n: g, name: `${name} Gate` });
  });

  // citadel precinct
  {
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const th = (i + 0.5) * Math.PI / 4, rr = C.r * randRange(R, 0.94, 1.04);
      pts.push(C.x + Math.cos(th) * rr, C.y + Math.sin(th) * rr);
    }
    const dx = -0.45, dy = 0.893;
    const g = node(C.x + dx * (C.r + 3), C.y + dy * (C.r + 3), true), court = node(C.x + dx * C.r * 0.3, C.y + dy * C.r * 0.3, true);
    edge(g, court, 1);
    const G = L.nodes[g];
    const to = nearestNode(G.x, G.y, 170, (n) => n.id !== g && n.id !== court && hyp(n.x, n.y, C.x, C.y) > C.r + 8 && !riverCross(G.x, G.y, n.x, n.y));
    if (to >= 0) edge(g, to, 1);
    L.citadel = { x: C.x, y: C.y, r: C.r, pts, gate: { x: G.x, y: G.y, a: Math.atan2(dy, dx) }, court, beds: [] };
    for (const [bx, by] of [[-0.42, 0.42], [-0.12, 0.5], [0.2, 0.55], [0.5, -0.3]]) L.citadel.beds.push({ x: C.x + bx * C.r, y: C.y + by * C.r, w: C.r * 0.24, d: C.r * 0.2, a: 0 });
    L.posts.push({ x: G.x + 5, y: G.y + 2, n: g, name: 'Citadel Gate' }, { x: G.x - 5, y: G.y - 2, n: g, name: 'Citadel Gate' });
  }

  // drop street stubs that are not connected to the plaza, then shorten long streets
  {
    const seen = new Set([P0]), stack = [P0], adj = new Map();
    for (const e of L.edges) for (const [u, v] of [[e.a, e.b], [e.b, e.a]]) { if (!adj.has(u)) adj.set(u, []); adj.get(u).push(v); }
    const flood = () => { while (stack.length) for (const v of adj.get(stack.pop()) || []) if (!seen.has(v)) { seen.add(v); stack.push(v); } };
    flood();
    // join cut-off street pieces to the network with a short connecting street
    for (let round = 0; round < 12; round++) {
      let best = null;
      for (const n of L.nodes) {
        if (seen.has(n.id) || !adj.has(n.id)) continue;
        for (const m of nodeHash.query(n.x - 75, n.y - 75, n.x + 75, n.y + 75, [])) {
          if (!seen.has(m.id)) continue;
          const d = hyp(n.x, n.y, m.x, m.y);
          if ((!best || d < best.d) && d < 75 && !riverCross(n.x, n.y, m.x, m.y) && segDist(C.x, C.y, n.x, n.y, m.x, m.y) > C.r + 8) best = { d, a: n.id, b: m.id };
        }
      }
      if (!best) break;
      edge(best.a, best.b, 1);
      adj.get(best.a).push(best.b);
      seen.add(best.a); stack.push(best.a);
      flood();
    }
    for (const n of L.nodes) if (!seen.has(n.id)) n.dead = true;
    for (const e of L.edges) if (!seen.has(e.a)) e.dead = true;
    for (const e of L.edges.slice()) {
      if (e.dead || e.bridge) continue;
      const A = L.nodes[e.a], B = L.nodes[e.b];
      if (hyp(A.x, A.y, B.x, B.y) > 36) splitEdge(e, (A.x + B.x) / 2, (A.y + B.y) / 2);
    }
  }

  // ---- buildings ---------------------------------------------------------------
  const WD = { x: river[riverIndexAtY(150)][0] + 100, y: 150, r: 78 }; // warehouse quarter
  L.yard = WD;
  function bldFree(r, zone) {
    const cs = corners(r), bb = bbox(cs);
    for (let i = 0; i < 8; i += 2) {
      const x = cs[i], y = cs[i + 1];
      if (x < X0 + 20 || x > X1 - 20 || y < Y0 + 20 || y > Y1 - 20) return false;
      if (zone === 'city' ? !inWall(x, y, 13) : inWall(x, y, -34)) return false;
      if (riverDist(x, y) < RIVER_W / 2 + 6) return false;
      if (zone === 'city' && (hyp(x, y, P.x, P.y) < P.r + 5 || hyp(x, y, C.x, C.y) < C.r + 7)) return false;
    }
    if (riverDist(r.x, r.y) < RIVER_W / 2 + 6) return false;
    for (const e of edgeHash.query(bb[0] - 6, bb[1] - 6, bb[2] + 6, bb[3] + 6, tmp)) {
      if (e.dead) continue;
      const A = L.nodes[e.a], B = L.nodes[e.b];
      if (segHitsRect(A.x, A.y, B.x, B.y, r, RW[e.k] / 2 + 0.7)) return false;
    }
    for (const b of bldHash.query(bb[0] - 2, bb[1] - 2, bb[2] + 2, bb[3] + 2, tmp)) if (rectsHit(r, b, 0.9)) return false;
    return true;
  }
  function addBld(r, o) {
    const b = { id: L.blds.length, k: 'house', site: 0, roof: randInt(R, 0, 3), ...r, ...o };
    L.blds.push(b);
    const bb = bbox(corners(b));
    bldHash.add(bb[0], bb[1], bb[2], bb[3], b);
    return b;
  }
  /** Try a building beside edge e at distance s from its start; side is +1 or -1. */
  function tryBld(e, side, s, w, d, setback, zone, o) {
    const A = L.nodes[e.a], B = L.nodes[e.b], len = hyp(A.x, A.y, B.x, B.y);
    const ux = (B.x - A.x) / len, uy = (B.y - A.y) / len, nx = -uy * side, ny = ux * side, half = RW[e.k] / 2;
    const mx = A.x + ux * s, my = A.y + uy * s, off = half + setback + d / 2;
    const r = { x: mx + nx * off, y: my + ny * off, w, d, a: Math.atan2(uy, ux) };
    if (!bldFree(r, zone)) return null;
    return addBld(r, { dx: mx + nx * half * 0.5, dy: my + ny * half * 0.5, n: s < len / 2 ? e.a : e.b, n2: s < len / 2 ? e.b : e.a, ...o });
  }
  const liveEdges = (ok) => L.edges.filter((e) => !e.dead && !e.bridge && ok(L.nodes[e.a], L.nodes[e.b]));
  const mid = (e) => [(L.nodes[e.a].x + L.nodes[e.b].x) / 2, (L.nodes[e.a].y + L.nodes[e.b].y) / 2];
  function special(k, w, d, cx, cy, rmin, rmax, zone, o = {}, pool = null) {
    const cand = shuffle(R, (pool || liveEdges((a, b) => (zone === 'city') === (a.city && b.city))).filter((e) => {
      const [x, y] = mid(e), dd = hyp(x, y, cx, cy);
      return dd >= rmin && dd <= rmax;
    }));
    for (const e of cand) {
      const len = hyp(L.nodes[e.a].x, L.nodes[e.a].y, L.nodes[e.b].x, L.nodes[e.b].y);
      for (const side of chance(R, 0.5) ? [1, -1] : [-1, 1]) {
        const b = tryBld(e, side, len / 2, w, d, 1.6, zone, { k, ...o });
        if (b) return b;
      }
    }
    return null;
  }
  function fill(edges, o) {
    let count = 0;
    for (const e of edges) {
      const A = L.nodes[e.a], B = L.nodes[e.b], len = hyp(A.x, A.y, B.x, B.y);
      for (const side of [1, -1]) {
        if (o.skip && chance(R, o.skip)) continue;
        let s = randRange(R, 1.5, 4);
        while (s + 6 < len) {
          if (o.limit && count >= o.limit) return count;
          const big = o.big ? o.big((A.x + B.x) / 2, (A.y + B.y) / 2, e) : 0;
          let w = randRange(R, o.w[0], o.w[1]) * (1 + big * 0.5);
          const d = randRange(R, o.d[0], o.d[1]) * (1 + big * 0.35);
          if (s + w > len - 0.5) w = len - 0.5 - s;
          if (w < 6.2) break;
          const b = tryBld(e, side, s + w / 2, w, d, randRange(R, o.set[0], o.set[1]), o.zone, { k: 'house', site: o.site });
          if (b) { count++; s += w + (chance(R, o.alley) ? randRange(R, 3, 8) : randRange(R, o.gap[0], o.gap[1])); } else s += 2.5;
        }
      }
    }
    return count;
  }

  const city = { id: 0, name: placeName(R, 'human', names), kind: 'city', type: 'city', x: 0, y: 0, r: 345, n: P0, market: [], taverns: [], shops: [] };
  L.sites.push(city);
  {
    // citadel buildings sit inside the precinct, outside the street rules
    const cn = L.citadel.court, cc = L.nodes[cn];
    city.keep = addBld({ x: C.x - C.r * 0.08, y: C.y - C.r * 0.3, w: C.r * 0.62, d: C.r * 0.4, a: 0 }, { k: 'keep', dx: cc.x, dy: cc.y, n: cn, n2: cn, name: 'The Keep' }).id;
    city.barracks = addBld({ x: C.x + C.r * 0.42, y: C.y + C.r * 0.22, w: C.r * 0.5, d: C.r * 0.2, a: 0.25 }, { k: 'barracks', dx: cc.x + 4, dy: cc.y, n: cn, n2: cn, name: 'Barracks' }).id;
    const th = special('townhall', 30, 15, P.x, P.y, 40, 115, 'city', { name: 'Town Hall' });
    const gu = special('guild', 24, 13, P.x, P.y, 40, 150, 'city', { name: "Adventurers' Guild" });
    const te = special('temple', 32, 16, P.x, P.y, 95, 210, 'city', { name: 'Temple of the Dawn' });
    const gr = special('granary', 30, 14, WD.x, WD.y, 0, 90, 'city', { name: 'City Granary' });
    city.townhall = th ? th.id : city.keep;
    city.guild = gu ? gu.id : city.townhall;
    city.temple = te ? te.id : city.townhall;
    city.granary = gr ? gr.id : city.townhall;
    city.warehouses = [];
    for (let i = 0; i < 7; i++) {
      const b = special('warehouse', randRange(R, 20, 27), randRange(R, 10, 13), WD.x, WD.y, 0, 95, 'city', { name: 'Warehouse' });
      if (b) city.warehouses.push(b.id);
    }
    for (let i = 0; i < 11; i++) {
      const th2 = (i / 11) * 6.283 + randRange(R, -0.2, 0.2), rr = randRange(R, 70, 250);
      const tname = `The ${pick(R, TAVERN_A)} ${pick(R, TAVERN_B)}`;
      const b = !names.has(tname) && special('tavern', 15, 10.5, P.x + Math.cos(th2) * rr, P.y + Math.sin(th2) * rr, 0, 70, 'city', { name: tname });
      if (b) { city.taverns.push(b.id); names.add(tname); }
    }
    // market stalls around the plaza, leaving the four main streets open
    for (let i = 0; i < 20; i++) {
      const th2 = (i + 0.5) * (Math.PI / 10), q = (th2 % (Math.PI / 2)) / (Math.PI / 2);
      if (q < 0.19 || q > 0.81) continue;
      const rr = P.r - 9;
      const b = addBld({ x: P.x + Math.cos(th2) * rr, y: P.y + Math.sin(th2) * rr, w: 7.5, d: 4.6, a: th2 + Math.PI / 2 },
        { k: 'stall', dx: P.x + Math.cos(th2) * (rr - 5), dy: P.y + Math.sin(th2) * (rr - 5), n: P0, n2: P0, name: 'Market stall' });
      city.market.push(b.id);
    }
    for (const sd of [[-9, -9], [9, 9]]) L.posts.push({ x: P.x + sd[0], y: P.y + sd[1], n: P0, name: 'Market Square' });
    const cityEdges = shuffle(R, liveEdges((a, b) => a.city && b.city));
    cityEdges.sort((a, b) => b.k - a.k);
    const first = L.blds.length;
    fill(cityEdges, {
      zone: 'city', site: 0, w: [7.5, 12], d: [6.5, 9.5], set: [1, 2.2], gap: [0.3, 1.3], alley: 0.13,
      big: (x, y, e) => (hyp(x, y, WD.x, WD.y) < WD.r ? 1.1 : hyp(x, y, P.x, P.y) < 120 || e.k === 3 ? 0.5 : 0),
    });
    for (let i = first; i < L.blds.length; i++) {
      const b = L.blds[i], dp = hyp(b.x, b.y, P.x, P.y);
      if (hyp(b.x, b.y, WD.x, WD.y) < WD.r && b.w > 14) { b.k = 'warehouse'; b.name = 'Warehouse'; city.warehouses.push(b.id); } else if (dp < 260 && chance(R, dp < 130 ? 0.3 : 0.11)) {
        b.k = 'shop'; b.trade = pick(R, TRADES); city.shops.push(b.id);
      }
    }
  }

  // ---- country roads ---------------------------------------------------------------
  function wander(ax, ay, bx, by, amp = 0.1) {
    const len = hyp(ax, ay, bx, by), n = Math.max(2, Math.round(len / 60)), ux = (bx - ax) / len, uy = (by - ay) / len;
    const sd = randInt(R, 1, 1e6), A = Math.min(150, len * amp), pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, off = (fbm(t * len / 300, 0.5, sd, 3) - 0.5) * 2.6 * A * Math.sin(Math.PI * t);
      pts.push({ x: ax + ux * len * t - uy * off, y: ay + uy * len * t + ux * off });
    }
    return pts;
  }
  function bridgeFix(pts) {
    for (let guard = 0; guard < 3; guard++) {
      let hit = null, hi = -1;
      for (let i = 1; i < pts.length && !hit; i++) if (!pts[i].br && (hit = riverCross(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y))) hi = i;
      if (!hit) break;
      const [nx, ny] = riverNormal(hit.i), off = RIVER_W / 2 + 7;
      const sd = (pts[hi - 1].x - hit.x) * nx + (pts[hi - 1].y - hit.y) * ny > 0 ? 1 : -1;
      const far = (p, i) => i === 0 || i === pts.length - 1 || hyp(p.x, p.y, hit.x, hit.y) > 58;
      pts = [
        ...pts.filter((p, i) => i < hi && far(p, i)),
        { x: hit.x + nx * sd * off, y: hit.y + ny * sd * off },
        { x: hit.x - nx * sd * off, y: hit.y - ny * sd * off, br: true },
        ...pts.filter((p, i) => i >= hi && far(p, i)),
      ];
    }
    return pts;
  }
  function firstCrossing(ax, ay, bx, by, skipA, skipB) {
    let best = null;
    for (const e of edgeHash.query(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), tmp)) {
      if (e.dead || e.bridge || e.a === skipA || e.b === skipA || e.a === skipB || e.b === skipB) continue;
      const A = L.nodes[e.a], B = L.nodes[e.b];
      const t = segSeg(ax, ay, bx, by, A.x, A.y, B.x, B.y);
      if (t >= 0 && (!best || t < best.t)) best = { t, e, x: ax + (bx - ax) * t, y: ay + (by - ay) * t };
    }
    return best;
  }
  function extend(prev, x, y, k, br) {
    for (let guard = 0; guard < 6; guard++) {
      const A = L.nodes[prev];
      const snap = br ? -1 : nearestNode(x, y, 12, (n) => n.id !== prev && !n.city);
      const tx = snap >= 0 ? L.nodes[snap].x : x, ty = snap >= 0 ? L.nodes[snap].y : y;
      const hit = br ? null : firstCrossing(A.x, A.y, tx, ty, prev, snap);
      if (hit) {
        const m = splitEdge(hit.e, hit.x, hit.y);
        if (m === prev) break;
        edge(prev, m, k);
        prev = m;
        continue;
      }
      const n = snap >= 0 ? snap : node(x, y);
      const e = edge(prev, n, k, !!br);
      if (br && e) L.bridges.push({ a: prev, b: n });
      return n;
    }
    const n = node(x, y);
    edge(prev, n, k);
    return n;
  }
  function addRoad(raw, k) {
    const fixed = bridgeFix(raw), pts = [fixed[0]];
    for (let i = 1; i < fixed.length; i++) {
      const a = fixed[i - 1], b = fixed[i], len = hyp(a.x, a.y, b.x, b.y), n = b.br ? 1 : Math.max(1, Math.ceil(len / 38));
      for (let j = 1; j < n; j++) pts.push({ x: a.x + (b.x - a.x) * j / n, y: a.y + (b.y - a.y) * j / n });
      pts.push(b);
    }
    let prev = nearestNode(pts[0].x, pts[0].y, 8);
    if (prev < 0) prev = node(pts[0].x, pts[0].y);
    const ids = [prev];
    for (let i = 1; i < pts.length; i++) { prev = extend(prev, pts[i].x, pts[i].y, k, pts[i].br); ids.push(prev); }
    return ids;
  }

  const targets = [[X1, randRange(R, -250, 350)], [randRange(R, -50, 350), Y1], [X0, randRange(R, -350, 250)], [randRange(R, -520, -150), Y0]];
  L.gates.forEach((g, c) => {
    const O = L.nodes[g.out];
    const ids = addRoad(wander(O.x, O.y, targets[c][0], targets[c][1]), 2);
    L.exits.push(ids[ids.length - 1]);
  });

  // ---- villages ----------------------------------------------------------------
  const jit = (v) => v + randRange(R, -100, 100);
  const vspots = [[jit(-1250), jit(-850), 'hill'], [jit(1150), jit(-900), 'forest'], [jit(1100), jit(1000), 'plain'], [jit(-1650), jit(330), 'plain']];
  {
    const i = riverIndexAtY(1150), [nx, ny] = riverNormal(i), sd = ny < 0 ? 1 : -1;
    vspots.push([river[i][0] + nx * sd * 175, river[i][1] + ny * sd * 175, 'river']);
  }
  for (const [vx, vy, type] of vspots) {
    let best = Infinity, to = -1;
    for (const n of L.nodes) {
      if (n.dead || n.city) continue;
      const d = hyp(vx, vy, n.x, n.y) + 0.3 * Math.hypot(n.x, n.y);
      if (d < best) { best = d; to = n.id; }
    }
    const T = L.nodes[to];
    const ids = addRoad(wander(T.x, T.y, vx, vy, 0.1), 2);
    const cn = ids[ids.length - 1], cN = L.nodes[cn], pv = L.nodes[ids[ids.length - 2]];
    const a0 = Math.atan2(cN.y - pv.y, cN.x - pv.x);
    L.sites.push({ id: L.sites.length, name: placeName(R, 'human', names), kind: 'village', type, x: cN.x, y: cN.y, r: 200, n: cn, a0, taverns: [], shops: [], market: [] });
  }
  const villages = L.sites.slice(1);
  for (let i = 0; i < villages.length; i++) for (let j = i + 1; j < villages.length; j++) {
    const a = villages[i], b = villages[j];
    if (hyp(a.x, a.y, b.x, b.y) > 2400 || segDist(0, 0, a.x, a.y, b.x, b.y) < 560 || riverSide(a.x, a.y) !== riverSide(b.x, b.y)) continue;
    const pts = wander(a.x, a.y, b.x, b.y, 0.09);
    if (pts.some((p, q) => q && riverCross(pts[q - 1].x, pts[q - 1].y, p.x, p.y))) continue;
    addRoad(pts, 1);
  }
  for (const v of villages) {
    const lanes = [[Math.PI * 0, randRange(R, 100, 150)], [Math.PI / 2 + randRange(R, -0.3, 0.3), randRange(R, 80, 120)], [-Math.PI / 2 + randRange(R, -0.3, 0.3), randRange(R, 80, 120)]];
    for (const [da, len] of lanes) {
      const a = v.a0 + da, ex = v.x + Math.cos(a) * len, ey = v.y + Math.sin(a) * len;
      if (riverDist(ex, ey, 80) < 60 || riverCross(v.x, v.y, ex, ey)) continue;
      addRoad(wander(v.x, v.y, ex, ey, 0.12), 1);
    }
    const near = liveEdges((a, b) => !a.city && !b.city).filter((e) => { const [x, y] = mid(e); return hyp(x, y, v.x, v.y) < 165; })
      .map((e) => ({ e, key: hyp(...mid(e), v.x, v.y) + randRange(R, -40, 40) })).sort((a, b) => a.key - b.key).map((q) => q.e);
    const o = { site: v.id };
    const barn = special('barn', 20, 10.5, v.x, v.y, 20, 120, 'out', { ...o, name: `${v.name} Barn` }, near);
    const tav = special('tavern', 14.5, 10, v.x, v.y, 0, 90, 'out', { ...o, name: `The ${pick(R, TAVERN_A)} ${pick(R, TAVERN_B)}` }, near);
    const chap = special('chapel', 12, 7.5, v.x, v.y, 20, 140, 'out', { ...o, name: `${v.name} Chapel` }, near);
    const first = L.blds.length;
    fill(near, { zone: 'out', site: v.id, w: [8.5, 12.5], d: [6.5, 8.5], set: [2.5, 6], gap: [3, 9], alley: 0.3, limit: randInt(R, 19, 27), skip: 0.15 });
    v.barn = barn ? barn.id : first;
    v.granary = v.barn;
    if (tav) v.taverns.push(tav.id);
    v.temple = chap ? chap.id : -1;
    v.market = [v.barn];
    v.green = { x: v.x + Math.cos(v.a0 + 2.3) * 13, y: v.y + Math.sin(v.a0 + 2.3) * 13 };
    if (L.blds.length > first + 6 && chance(R, 0.8)) { const s = L.blds[first + 3]; s.k = 'shop'; s.trade = pick(R, ['blacksmith', 'miller', 'carpenter']); v.shops.push(s.id); }
  }
  const siteNear = (x, y) => {
    if (Math.hypot(x, y) < 1050) return 0;
    let best = Infinity, id = 0;
    for (const v of villages) { const d = hyp(x, y, v.x, v.y); if (d < best) { best = d; id = v.id; } }
    return best < Math.hypot(x, y) ? id : 0;
  };

  // ---- farmsteads -----------------------------------------------------------------
  {
    const cand = shuffle(R, liveEdges((a, b) => !a.city && !b.city).filter((e) => {
      const [x, y] = mid(e);
      return e.k >= 1 && !inWall(x, y, -110) && villages.every((v) => hyp(x, y, v.x, v.y) > 300) && Math.abs(x) < X1 - 200 && Math.abs(y) < Y1 - 200;
    }));
    let made = 0;
    for (const closeWanted of [true, false]) for (const e of cand) {
      if (made >= (closeWanted ? 13 : 30)) break;
      const A = L.nodes[e.a], B = L.nodes[e.b], len = hyp(A.x, A.y, B.x, B.y);
      const ux = (B.x - A.x) / len, uy = (B.y - A.y) / len, side = chance(R, 0.5) ? 1 : -1, off = randRange(R, 30, 48);
      const yx = A.x - uy * side * off, yy = A.y + ux * side * off;
      const closeCity = Math.hypot(yx, yy) < 950;
      if (closeWanted !== closeCity) continue;
      if (L.farms.some((f) => hyp(f.x, f.y, yx, yy) < 190) || riverDist(yx, yy, 70) < 50 || riverCross(A.x, A.y, yx, yy)) continue;
      if (firstCrossing(A.x, A.y, yx, yy, e.a, -1) || nearestNode(yx, yy, 26) >= 0) continue;
      const a = Math.atan2(uy, ux);
      const hr = { x: yx - uy * side * 9, y: yy + ux * side * 9, w: 11.5, d: 8, a };
      const br = { x: yx + ux * 15 - uy * side * 3, y: yy + uy * 15 + ux * side * 3, w: 8.5, d: 14, a };
      if (!bldFree(hr, 'out') || !bldFree(br, 'out') || rectsHit(hr, br, 1)) continue;
      const yn = node(yx, yy);
      edge(e.a, yn, 0);
      const site = siteNear(yx, yy), f = { id: L.farms.length, site, x: yx, y: yy, n: yn, a };
      f.house = addBld(hr, { k: 'farmhouse', site, farm: f.id, dx: yx, dy: yy, n: yn, n2: yn }).id;
      f.barn = addBld(br, { k: 'shed', site, farm: f.id, dx: yx, dy: yy, n: yn, n2: yn }).id;
      L.farms.push(f);
      made++;
    }
  }

  // ---- terrain functions -----------------------------------------------------------
  const sd1 = seed ^ 0x51ab, sd2 = seed ^ 0x9e37;
  const forest = (x, y) => fbm(x / 820 + 11.3, y / 820 - 4.1, sd1) + 0.2 * smooth(200, 1900, x) - 0.06 * smooth(-500, -2200, x)
    - 0.3 * (1 - smooth(430, 950, Math.hypot(x, y)));
  const rocky = (x, y) => smooth(0.5, 0.72, fbm(x / 520 + 3.7, y / 520 + 8.2, sd2) * (0.5 + 0.95 * smooth(-500, -2100, x) * smooth(-150, -1500, y) + 0.3 * smooth(-1700, -2500, x)));
  L.forest = forest;
  L.rocky = rocky;

  // ---- ponds ---------------------------------------------------------------------
  for (let tries = 0; tries < 200 && L.ponds.length < 3; tries++) {
    const x = randRange(R, X0 + 300, X1 - 300), y = randRange(R, Y0 + 300, Y1 - 300), r = randRange(R, 45, 85);
    if (Math.hypot(x, y) < 800 || riverDist(x, y, 220) < 200 || L.sites.some((s) => hyp(x, y, s.x, s.y) < 420)) continue;
    if (nearestNode(x, y, r + 60) >= 0 || L.ponds.some((p) => hyp(x, y, p.x, p.y) < 700)) continue;
    if (bldHash.query(x - r - 30, y - r - 30, x + r + 30, y + r + 30, tmp).length) continue;
    const pts = [], sdp = randInt(R, 1, 1e6);
    for (let i = 0; i < 18; i++) {
      const th = (i / 18) * 6.283, rr = r * (0.72 + 0.5 * fbm(Math.cos(th) * 1.3 + 5, Math.sin(th) * 1.3 + 5, sdp, 2));
      pts.push(x + Math.cos(th) * rr * 1.25, y + Math.sin(th) * rr * 0.85);
    }
    L.ponds.push({ x, y, r: r * 1.25, pts });
  }
  const inPond = (x, y, pad = 0) => L.ponds.some((p) => hyp(x, y, p.x, p.y) < p.r + pad);

  // ---- fields --------------------------------------------------------------------
  function fieldFree(r) {
    const cs = corners(r, 2), bb = bbox(cs);
    for (let i = 0; i < 8; i += 2) {
      const x = cs[i], y = cs[i + 1];
      if (x < X0 + 40 || x > X1 - 40 || y < Y0 + 40 || y > Y1 - 40 || inWall(x, y, -30) || riverDist(x, y) < RIVER_W / 2 + 9 || inPond(x, y, 10)) return false;
    }
    if (riverDist(r.x, r.y, 90) < Math.max(r.w, r.d) / 2 || rocky(r.x, r.y) > 0.5 || forest(r.x, r.y) > 0.63) return false;
    for (const e of edgeHash.query(bb[0] - 6, bb[1] - 6, bb[2] + 6, bb[3] + 6, tmp)) {
      if (e.dead) continue;
      const A = L.nodes[e.a], B = L.nodes[e.b];
      if (segHitsRect(A.x, A.y, B.x, B.y, r, RW[e.k] / 2 + 3)) return false;
    }
    for (const b of bldHash.query(bb[0] - 6, bb[1] - 6, bb[2] + 6, bb[3] + 6, tmp)) if (rectsHit(r, b, 5)) return false;
    for (const f of fieldHash.query(bb[0] - 4, bb[1] - 4, bb[2] + 4, bb[3] + 4, tmp)) if (rectsHit(r, f, 2.5)) return false;
    return true;
  }
  const roadAngle = (x, y) => {
    let best = 140, a = randRange(R, 0, 3.14);
    for (const e of edgeHash.query(x - 140, y - 140, x + 140, y + 140, tmp)) {
      if (e.dead) continue;
      const A = L.nodes[e.a], B = L.nodes[e.b], d = segDist(x, y, A.x, A.y, B.x, B.y);
      if (d < best) { best = d; a = Math.atan2(B.y - A.y, B.x - A.x); }
    }
    return a;
  };
  function fieldBlock(cx, cy, site, mix, farm = -1, max = 99) {
    const a = roadAngle(cx, cy) + randRange(R, -0.06, 0.06), ca = Math.cos(a), sa = Math.sin(a);
    const cols = randInt(R, 2, 4), rows = randInt(R, 1, 3), w = randRange(R, 62, 105), d = randRange(R, 42, 72);
    let made = 0;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (made >= max) return made;
      const lx = (i - (cols - 1) / 2) * (w + 5), ly = (j - (rows - 1) / 2) * (d + 5);
      const r = { x: cx + lx * ca - ly * sa, y: cy + lx * sa + ly * ca, w, d, a };
      if (!fieldFree(r)) continue;
      let roll = rand(R), crop = 'grain';
      for (const [k, p] of mix) { if (roll < p) { crop = k; break; } roll -= p; }
      const n = nearestNode(r.x, r.y, 420, (q) => !q.city && !riverCross(r.x, r.y, q.x, q.y));
      if (n < 0) continue;
      const f = { id: L.fields.length, ...r, crop, site, farm, n, area: w * d, look: randInt(R, 0, 999) };
      L.fields.push(f);
      fieldHash.add(bb4(r)[0], bb4(r)[1], bb4(r)[2], bb4(r)[3], f);
      made++;
    }
    return made;
  }
  const bb4 = (r) => bbox(corners(r));
  const MIX = {
    city: [['veg', 0.34], ['orchard', 0.2], ['pasture', 0.06], ['grain', 1]],
    plain: [['veg', 0.2], ['orchard', 0.13], ['pasture', 0.12], ['grain', 1]],
    hill: [['veg', 0.14], ['orchard', 0.08], ['pasture', 0.4], ['grain', 1]],
    forest: [['veg', 0.22], ['orchard', 0.2], ['pasture', 0.14], ['grain', 1]],
    river: [['veg', 0.3], ['orchard', 0.12], ['pasture', 0.12], ['grain', 1]],
  };
  for (const f of L.farms) {
    let got = 0;
    for (let t = 0; t < 14 && got < 4; t++) {
      const th = randRange(R, 0, 6.283), rr = randRange(R, 70, 150);
      got += fieldBlock(f.x + Math.cos(th) * rr, f.y + Math.sin(th) * rr, f.site, MIX[L.sites[f.site].type], f.id, 4 - got);
    }
  }
  for (const v of villages) {
    let got = 0;
    const want = randInt(R, 24, 30);
    for (let t = 0; t < 160 && got < want; t++) {
      const th = randRange(R, 0, 6.283), rr = randRange(R, 150, 520);
      got += fieldBlock(v.x + Math.cos(th) * rr, v.y + Math.sin(th) * rr, v.id, MIX[v.type], -1, want - got);
    }
  }
  {
    let got = 0;
    for (let t = 0; t < 260 && got < 64; t++) {
      const th = randRange(R, 0, 6.283), k = randRange(R, 1.3, 2.45);
      got += fieldBlock(Math.cos(th) * rx * k, Math.sin(th) * ry * k, 0, MIX.city, -1, 64 - got);
    }
  }

  // ---- trees and rocks -----------------------------------------------------------
  const clearAt = (x, y, pad) => {
    for (const e of edgeHash.query(x - 12, y - 12, x + 12, y + 12, tmp)) {
      if (e.dead) continue;
      const A = L.nodes[e.a], B = L.nodes[e.b];
      if (segDist(x, y, A.x, A.y, B.x, B.y) < RW[e.k] / 2 + pad) return false;
    }
    for (const b of bldHash.query(x - 3, y - 3, x + 3, y + 3, tmp)) if (inRect(x, y, b, pad + 0.5)) return false;
    return true;
  };
  const trees = [];
  for (let gy = Y0 - 400; gy < Y1 + 400; gy += 12.5) for (let gx = X0 - 400; gx < X1 + 400; gx += 12.5) {
    const x = gx + rand(R) * 12.5, y = gy + rand(R) * 12.5, roll = rand(R), size = rand(R);
    const f = forest(x, y), dens = f > 0.57 ? 0.86 : f > 0.52 ? 0.3 : 0.022;
    if (roll > dens * (1 - 0.7 * rocky(x, y))) continue;
    if (inWall(x, y, -16) || riverDist(x, y, 30) < RIVER_W / 2 + 4 || inPond(x, y, 4) || !clearAt(x, y, 3.5)) continue;
    if (fieldHash.query(x, y, x, y, tmp).some((q) => inRect(x, y, q, 4))) continue;
    trees.push(x, y, 4.6 + size * 3.6, Math.floor(roll * 9973) % 4);
  }
  for (let i = 0; i < 3000; i++) {
    const th = rand(R) * 6.283, k = Math.sqrt(rand(R)), x = Math.cos(th) * (rx - 5) * k, y = Math.sin(th) * (ry - 5) * k, size = rand(R);
    if (!inWall(x, y, 6) || riverDist(x, y, 30) < RIVER_W / 2 + 3 || hyp(x, y, P.x, P.y) < P.r + 3 || hyp(x, y, WD.x, WD.y) < WD.r * 0.8) continue;
    if (hyp(x, y, C.x, C.y) < C.r + 4 || !clearAt(x, y, 2.6)) continue;
    trees.push(x, y, 2.8 + size * 2.4, i % 4);
  }
  for (let i = 0; i < river.length; i += 1) {
    if (!chance(R, 0.5)) continue;
    const [nx, ny] = riverNormal(i), sd = chance(R, 0.5) ? 1 : -1, off = RIVER_W / 2 + randRange(R, 5, 14);
    const x = river[i][0] + nx * sd * off, y = river[i][1] + ny * sd * off;
    if (inWall(x, y, -16) || !clearAt(x, y, 3.5) || fieldHash.query(x, y, x, y, tmp).some((q) => inRect(x, y, q, 3))) continue;
    trees.push(x, y, randRange(R, 4, 6.5), i % 4);
  }
  L.trees = new Float32Array(trees);
  L.treeCell = 260;
  L.treeMap = new Map();
  for (let i = 0; i < trees.length; i += 4) {
    const k = Math.floor(trees[i] / 260) * 4096 + Math.floor(trees[i + 1] / 260);
    if (!L.treeMap.has(k)) L.treeMap.set(k, []);
    L.treeMap.get(k).push(i);
  }
  for (let gy = Y0; gy < Y1; gy += 70) for (let gx = X0; gx < X1; gx += 70) {
    const x = gx + rand(R) * 70, y = gy + rand(R) * 70, roll = rand(R), size = rand(R), rk = rocky(x, y);
    if (roll > rk * 0.85 || inWall(x, y, -60) || riverDist(x, y, 80) < 50 || !clearAt(x, y, 8 + size * 20)) continue;
    if (bldHash.query(x - 40, y - 40, x + 40, y + 40, tmp).length || fieldHash.query(x - 30, y - 30, x + 30, y + 30, tmp).length) continue;
    L.rocks.push({ x, y, r: 14 + size * 30 * rk, sd: Math.floor(roll * 1e6) });
  }

  // ---- working and wild spots --------------------------------------------------------
  const access = (x, y, max = 500) => nearestNode(x, y, max, (q) => !q.city && !riverCross(x, y, q.x, q.y));
  const openGround = (x, y) => !inWall(x, y, -40) && riverDist(x, y, 60) > 30 && !inPond(x, y, 12) && x > X0 + 80 && x < X1 - 80 && y > Y0 + 80 && y < Y1 - 80;
  L.sites.forEach((s) => {
    const fish = [], wood = [];
    for (let i = 2; i < river.length - 2; i += 3) {
      const [x, y] = river[i];
      const dd = hyp(x, y, s.x, s.y);
      if (s.kind === 'city' ? (dd < 380 || dd > 720) : dd > 420) continue;
      if (s.kind !== 'city' && s.type !== 'river') continue;
      const [nx, ny] = riverNormal(i), sd = chance(R, 0.5) ? 1 : -1;
      const px = x + nx * sd * (RIVER_W / 2 + 2.5), py = y + ny * sd * (RIVER_W / 2 + 2.5), n = access(px, py, 320);
      if (n >= 0 && x > X0 + 60 && y < Y1 - 60) fish.push({ x: px, y: py, n });
    }
    for (let t = 0; t < 300 && wood.length < 7; t++) {
      const th = rand(R) * 6.283, rr = randRange(R, s.kind === 'city' ? 620 : 240, s.kind === 'city' ? 1100 : 760), x = s.x + Math.cos(th) * rr, y = s.y + Math.sin(th) * rr;
      if (forest(x, y) < 0.58 || !openGround(x, y)) continue;
      const n = access(x, y, 600);
      if (n >= 0) wood.push({ x, y, n });
    }
    L.spots.fish.push(fish);
    L.spots.wood.push(wood);
  });
  const wild = (out, want, ok, apart) => {
    for (let t = 0; t < 4000 && out.length < want; t++) {
      const x = randRange(R, X0 + 150, X1 - 150), y = randRange(R, Y0 + 150, Y1 - 150);
      if (!openGround(x, y) || !ok(x, y) || out.some((q) => hyp(x, y, q.x, q.y) < apart)) continue;
      out.push({ x, y, n: access(x, y, 900) });
    }
  };
  const farFrom = (x, y, d) => L.sites.every((s) => hyp(x, y, s.x, s.y) > d + (s.kind === 'city' ? 250 : 0));
  const noField = (x, y) => !fieldHash.query(x - 30, y - 30, x + 30, y + 30, tmp).length;
  wild(L.spots.deer, 8, (x, y) => forest(x, y) > 0.5 && forest(x, y) < 0.66 && farFrom(x, y, 380) && noField(x, y), 420);
  wild(L.spots.boar, 3, (x, y) => forest(x, y) > 0.62 && farFrom(x, y, 450), 700);
  wild(L.spots.rabbit, 10, (x, y) => forest(x, y) < 0.52 && forest(x, y) > 0.36 && farFrom(x, y, 260) && noField(x, y) && rocky(x, y) < 0.3, 380);
  wild(L.spots.slime, 5, (x, y) => forest(x, y) < 0.5 && farFrom(x, y, 330) && noField(x, y) && rocky(x, y) < 0.3, 650);
  {
    let best = null, score = -Infinity;
    for (let t = 0; t < 400; t++) {
      const x = randRange(R, X0 + 200, X1 - 200), y = randRange(R, Y0 + 200, Y1 - 200);
      if (!openGround(x, y) || forest(x, y) < 0.62) continue;
      const sc = Math.min(...L.sites.map((s) => hyp(x, y, s.x, s.y) - (s.kind === 'city' ? 400 : 0)));
      if (sc > score) { score = sc; best = { x, y }; }
    }
    if (best) L.spots.den.push({ ...best, n: access(best.x, best.y, 1200) });
  }

  // ---- finish: lamps, wall towers, adjacency ------------------------------------------------
  for (const e of L.edges) {
    if (e.dead || e.k !== 3) continue;
    const A = L.nodes[e.a], B = L.nodes[e.b];
    if (A.city && B.city && !e.bridge) L.lamps.push({ x: (A.x + B.x) / 2 + (B.y - A.y) * 0.16, y: (A.y + B.y) / 2 - (B.x - A.x) * 0.16 });
  }
  for (const v of villages) L.lamps.push({ x: v.green.x, y: v.green.y });
  L.towers = [];
  for (let i = 0; i < 34; i++) {
    const th = (i + 0.5) / 34 * 6.283, x = Math.cos(th) * rx, y = Math.sin(th) * ry;
    if (L.gates.every((g) => hyp(x, y, g.x, g.y) > 26) && riverDist(x, y, 40) > RIVER_W / 2 + 9) L.towers.push({ x, y, a: Math.atan2(y / ry, x / rx) });
  }
  L.edges = L.edges.filter((e) => !e.dead);
  L.adj = L.nodes.map(() => []);
  for (const e of L.edges) {
    const A = L.nodes[e.a], B = L.nodes[e.b];
    e.len = hyp(A.x, A.y, B.x, B.y);
    L.adj[e.a].push({ to: e.b, len: e.len });
    L.adj[e.b].push({ to: e.a, len: e.len });
  }
  L.edgeHash = new Hash(160);
  for (const e of L.edges) {
    const A = L.nodes[e.a], B = L.nodes[e.b];
    L.edgeHash.add(Math.min(A.x, B.x), Math.min(A.y, B.y), Math.max(A.x, B.x), Math.max(A.y, B.y), e);
  }
  Object.assign(L, { nodeHash, bldHash, fieldHash, riverHash, riverDist, riverCross, riverSide, inWall, inPond, nearestNode, routes: new Map() });
  L.siteFields = L.sites.map((s) => L.fields.filter((f) => f.site === s.id).map((f) => f.id));
  /** Ground an animal or a walker may stand on. */
  L.open = (x, y) => x > X0 + 30 && x < X1 - 30 && y > Y0 + 30 && y < Y1 - 30 && !inWall(x, y, -18) && riverDist(x, y, 40) > RIVER_W / 2 + 4 && !inPond(x, y, 3);
  return L;
}
