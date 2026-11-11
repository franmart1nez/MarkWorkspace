// Static terrain: generated from the seed alone, so it is never saved.
import { rand, randInt, shuffle } from './rng.js';

export const B = {
  OCEAN: 0, SHALLOWS: 1, PLAINS: 2, STEPPE: 3, FOREST: 4, DEEPWOOD: 5, ENCHANTED: 6, HILLS: 7,
  MOUNTAIN: 8, PEAK: 9, VOLCANO: 10, SWAMP: 11, DESERT: 12, TUNDRA: 13, DARKLANDS: 14,
};

export const BIOMES = [
  { name: 'Ocean', color: '#234a78', fert: 0.5, cost: 2.6 },
  { name: 'Shallows and reefs', color: '#3a79a8', fert: 0.9, cost: 2.2 },
  { name: 'Plains', color: '#86b35a', fert: 1.0, cost: 1.0 },
  { name: 'Steppe', color: '#b9b56a', fert: 0.6, cost: 1.0 },
  { name: 'Forest', color: '#4f8f46', fert: 0.75, cost: 1.6 },
  { name: 'Deep dark forest', color: '#2f6238', fert: 0.5, cost: 2.2 },
  { name: 'Enchanted forest', color: '#3fa58c', fert: 0.8, cost: 1.8 },
  { name: 'Hills', color: '#9c9a5c', fert: 0.6, cost: 1.8 },
  { name: 'Mountains', color: '#8a8478', fert: 0.3, cost: 3.5 },
  { name: 'Peaks', color: '#d9dde2', fert: 0.1, cost: 6 },
  { name: 'Volcano', color: '#5a3a36', fert: 0.1, cost: 6 },
  { name: 'Swamp', color: '#5f7f5f', fert: 0.5, cost: 2.6 },
  { name: 'Desert', color: '#dcc98a', fert: 0.25, cost: 1.8 },
  { name: 'Tundra', color: '#c3d0cf', fert: 0.25, cost: 2.0 },
  { name: 'Darklands', color: '#4b3a55', fert: 0.2, cost: 1.8 },
];

function h2(x, y, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = h2(xi, yi, seed), b = h2(xi + 1, yi, seed);
  const c = h2(xi, yi + 1, seed), d = h2(xi + 1, yi + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export function fbm(x, y, seed, oct = 5) {
  let v = 0, amp = 0.5, tot = 0;
  for (let i = 0; i < oct; i++) {
    v += vnoise(x, y, seed + i * 101) * amp;
    tot += amp;
    amp *= 0.5;
    x *= 2;
    y *= 2;
  }
  return v / tot;
}

/** Replace values by their rank (0..1) among the tiles selected by `mask`. */
function rankify(values, mask) {
  const idx = [];
  for (let i = 0; i < values.length; i++) if (mask[i]) idx.push(i);
  idx.sort((a, b) => values[a] - values[b] || a - b);
  const out = new Float32Array(values.length);
  for (let k = 0; k < idx.length; k++) out[idx[k]] = k / Math.max(1, idx.length - 1);
  return out;
}

function bfsDistance(w, h, isSource) {
  const dist = new Int32Array(w * h).fill(-1);
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  for (let i = 0; i < w * h; i++) if (isSource(i)) { dist[i] = 0; queue[tail++] = i; }
  while (head < tail) {
    const c = queue[head++];
    const x = c % w, y = (c - x) / w;
    if (x > 0 && dist[c - 1] < 0) { dist[c - 1] = dist[c] + 1; queue[tail++] = c - 1; }
    if (x < w - 1 && dist[c + 1] < 0) { dist[c + 1] = dist[c] + 1; queue[tail++] = c + 1; }
    if (y > 0 && dist[c - w] < 0) { dist[c - w] = dist[c] + 1; queue[tail++] = c - w; }
    if (y < h - 1 && dist[c + w] < 0) { dist[c + w] = dist[c] + 1; queue[tail++] = c + w; }
  }
  return dist;
}

export function generateMap(seed, w = 192, h = 120) {
  const N = w * h;
  const g = { rng: (seed ^ 0x51ab3c7d) | 0 };
  const elev = new Float32Array(N);
  const moistRaw = new Float32Array(N);
  const enchRaw = new Float32Array(N);
  const temp = new Float32Array(N);
  const s1 = seed & 0xffff, s2 = s1 + 977, s3 = s1 + 1999, s4 = s1 + 3301, s5 = s1 + 4421;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const u = x / w, v = y / w;
      let e = fbm(u * 4.4, v * 4.4, s1, 6);
      const dx = Math.abs(x / w - 0.5) * 2, dy = Math.abs(y / h - 0.5) * 2;
      const d = Math.max(dx, dy);
      e -= 0.3 * d * d * d;
      const ridge = 1 - Math.abs(fbm(u * 7, v * 7, s2, 4) * 2 - 1);
      e += 0.1 * ridge * ridge;
      elev[i] = e;
      moistRaw[i] = fbm(u * 5.5, v * 5.5, s3, 5);
      enchRaw[i] = fbm(u * 9, v * 9, s4, 3);
      temp[i] = (y / h) * 0.85 + 0.15 * fbm(u * 6, v * 6, s5, 3);
    }
  }
  const all = new Uint8Array(N).fill(1);
  const elevRank = rankify(elev, all);
  const SEA = 0.56;
  const land = new Uint8Array(N);
  for (let i = 0; i < N; i++) land[i] = elevRank[i] > SEA ? 1 : 0;
  const landRank = rankify(elev, land);
  const moist = rankify(moistRaw, land);
  const ench = rankify(enchRaw, land);
  const distSea = bfsDistance(w, h, (i) => !land[i]);
  const distLand = bfsDistance(w, h, (i) => land[i] === 1);

  const biome = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (!land[i]) { biome[i] = distLand[i] <= 2 ? B.SHALLOWS : B.OCEAN; continue; }
    const r = landRank[i], m = moist[i], t = temp[i] - r * 0.12;
    let b;
    if (r > 0.955) b = B.PEAK;
    else if (r > 0.86) b = B.MOUNTAIN;
    else if (t < 0.17) b = B.TUNDRA;
    else if (r > 0.68) b = B.HILLS;
    else if (r < 0.25 && m > 0.7) b = B.SWAMP;
    else if (t > 0.62 && m < 0.45) b = B.DESERT;
    else if (m < 0.25) b = B.STEPPE;
    else if (m > 0.8) b = B.DEEPWOOD;
    else if (m > 0.55) b = B.FOREST;
    else b = B.PLAINS;
    if ((b === B.FOREST || b === B.DEEPWOOD) && ench[i] > 0.74) b = B.ENCHANTED;
    biome[i] = b;
  }

  // Darklands: one blighted region around a random inland point.
  const inland = [];
  for (let i = 0; i < N; i++) if (land[i] && distSea[i] >= 4 && biome[i] !== B.PEAK) inland.push(i);
  if (inland.length) {
    const c = inland[randInt(g, 0, inland.length - 1)];
    const cx = c % w, cy = (c - cx) / w;
    for (let y = Math.max(0, cy - 20); y < Math.min(h, cy + 20); y++) {
      for (let x = Math.max(0, cx - 20); x < Math.min(w, cx + 20); x++) {
        const i = y * w + x;
        if (!land[i] || biome[i] === B.PEAK || biome[i] === B.MOUNTAIN) continue;
        const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
        if (d + enchRaw[i] * 10 < 15) biome[i] = B.DARKLANDS;
      }
    }
  }

  // Volcanoes on a few well separated peaks.
  const peaks = [];
  for (let i = 0; i < N; i++) if (biome[i] === B.PEAK) peaks.push(i);
  shuffle(g, peaks);
  const volcanoes = [];
  for (const p of peaks) {
    if (volcanoes.length >= 3) break;
    const px = p % w, py = (p - px) / w;
    if (volcanoes.some((v) => Math.abs((v % w) - px) + Math.abs(Math.floor(v / w) - py) < 30)) continue;
    volcanoes.push(p);
    for (const n of [p, p - 1, p + 1, p - w, p + w]) if (n >= 0 && n < N && land[n]) biome[n] = B.VOLCANO;
  }

  // Rivers: walk from the highlands towards the sea.
  const river = new Uint8Array(N);
  const sources = [];
  for (let i = 0; i < N; i++) if ((biome[i] === B.MOUNTAIN || biome[i] === B.HILLS) && distSea[i] >= 7) sources.push(i);
  shuffle(g, sources);
  for (let k = 0; k < Math.min(18, sources.length); k++) {
    let cur = sources[k];
    while (land[cur] && !river[cur]) {
      river[cur] = 1;
      const x = cur % w;
      let best = -1, bestE = Infinity;
      for (const n of [x > 0 ? cur - 1 : -1, x < w - 1 ? cur + 1 : -1, cur - w, cur + w]) {
        if (n < 0 || n >= N || distSea[n] >= distSea[cur]) continue;
        const e = elev[n] + rand(g) * 0.01;
        if (e < bestE) { bestE = e; best = n; }
      }
      if (best < 0) break;
      cur = best;
    }
  }

  const fert = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let f = BIOMES[biome[i]].fert;
    const x = i % w;
    if (land[i] && (river[i] || (x > 0 && river[i - 1]) || (x < w - 1 && river[i + 1]) || river[i - w] || river[i + w])) f += 0.3;
    fert[i] = f;
  }
  const byBiome = BIOMES.map(() => []);
  for (let i = 0; i < N; i++) byBiome[biome[i]].push(i);
  return { w, h, biome, river, fert, elev, byBiome };
}

// ---- A* over tiles -------------------------------------------------------

class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p];
      i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v;
    const top = v[0];
    const lk = k.pop(), lv = v.pop();
    const n = k.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c];
        i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

/** Cheapest tile path between two tile indices; roads make travel cheaper. */
export function findPath(map, road, a, b) {
  const { w, h, biome, river } = map;
  const N = w * h;
  const gs = new Float32Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const bx = b % w, by = (b - bx) / w;
  const heur = (i) => {
    const x = i % w, y = (i - x) / w;
    const dx = Math.abs(x - bx), dy = Math.abs(y - by);
    return (Math.max(dx, dy) + 0.41 * Math.min(dx, dy)) * 0.45;
  };
  const heap = new Heap();
  gs[a] = 0;
  heap.push(heur(a), a);
  while (heap.size) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === b) break;
    const x = cur % w, y = (cur - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (closed[n]) continue;
        let c = BIOMES[biome[n]].cost * (road[n] ? 0.45 : 1) + (river[n] ? 0.5 : 0);
        if (dx && dy) c *= 1.41;
        const ng = gs[cur] + c;
        if (ng < gs[n]) { gs[n] = ng; from[n] = cur; heap.push(ng + heur(n), n); }
      }
    }
  }
  if (from[b] < 0 && a !== b) return null;
  const path = [];
  for (let c = b; c !== -1; c = from[c]) path.push(c);
  return path.reverse();
}

/** Straight tile line, used by flyers. */
export function linePath(map, a, b) {
  const w = map.w;
  let x0 = a % w, y0 = Math.floor(a / w);
  const x1 = b % w, y1 = Math.floor(b / w);
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  const path = [];
  for (;;) {
    path.push(y0 * w + x0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return path;
}
