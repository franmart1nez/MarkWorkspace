// Simple interiors. Every building gets rooms, furniture and the spots where
// people sleep, sit, work or pray, derived from its size, kind and the side its
// door faces. Like the layout, interiors are rebuilt from the seed and never saved.
//
// Coordinates are local metres: x along the building's width (w), y along its
// depth (d), origin at the centre, before the building's rotation `a`.
import { hash01 } from './noise.js';

/** Which kind of spot an activity uses inside a building. */
export const SPOT_OF = {
  sleep: 'bed', rest: 'bed', lodge: 'bed', sick: 'bed', jail: 'bed',
  eat: 'seat', home: 'seat', visit: 'seat', drink: 'seat', idle: 'seat',
  work: 'work', train: 'work', load: 'work', unload: 'work', trade: 'work',
  pray: 'pew', school: 'pew', mourn: 'pew', shop: 'cust', buy: 'cust', prowl: 'cust', nurse: 'seat',
};
const FALLBACK = { bed: ['seat', 'work'], seat: ['pew', 'work', 'cust'], work: ['seat', 'cust'], pew: ['seat'], cust: ['seat', 'work'] };

/** Working furniture by trade. */
const TOOL = {
  blacksmith: ['forge', 'anvil'], carpenter: ['bench', 'bench'], weaver: ['loom', 'loom'], tailor: ['bench', 'loom'], potter: ['wheel', 'kiln'],
  cobbler: ['bench', 'bench'], butcher: ['block', 'block'], brewer: ['vat', 'vat'], baker: ['oven', 'bench'], apothecary: ['shelf', 'bench'],
  scribe: ['desk', 'desk'], cooper: ['barrel', 'bench'], miller: ['millstone', 'sacks'],
};

const STONE_FLOOR = new Set(['temple', 'chapel', 'keep', 'townhall', 'guild', 'barracks']);
const STORE = new Set(['granary', 'warehouse', 'barn', 'shed']);
const CACHE = new WeakMap();

/** The interior of building b (cached per layout). Stalls have none. */
export function interiorOf(L, b) {
  let all = CACHE.get(L);
  if (!all) { all = []; CACHE.set(L, all); }
  if (all[b.id] === undefined) all[b.id] = b.k === 'stall' ? null : plan(b);
  return all[b.id];
}

// ---- seating ---------------------------------------------------------------------
// S.seats[building][spot] = person id. An entry only counts while that person is
// really there (same building and spot, not walking), so nobody has to clear it
// when they leave; a weekly sweep drops the stale ones to keep the save small.

const holds = (S, bid, idx, pid) => {
  const q = S.people[pid];
  return !!q && q.alive && !q.away && q.in === bid && q.seat === idx && !q.route;
};

/**
 * Put person p, who is inside building p.in doing p.act, on a fitting free spot.
 * Sets p.seat (or -1 when standing) and moves p.x, p.y to the spot.
 */
export function seat(S, L, p) {
  const b = L.blds[p.in], I = b && interiorOf(L, b);
  if (!I) return;
  const M = (S.seats[b.id] ||= {});
  const want = SPOT_OF[p.act] || 'seat';
  let pick = -1;
  if (p.seat >= 0 && I.spots[p.seat] && I.spots[p.seat].k === want && M[p.seat] === p.id) pick = p.seat;
  else {
    // start from a stable place per person so families keep "their" beds
    const s0 = (p.id * 2654435761) >>> 0;
    for (const k of [want, ...(FALLBACK[want] || [])]) {
      const list = I.byKind[k];
      if (!list) continue;
      for (let j = 0; j < list.length; j++) {
        const i = list[(s0 + j) % list.length], h = M[i];
        if (h === undefined || h === p.id || !holds(S, b.id, i, h)) { pick = i; break; }
      }
      if (pick >= 0) break;
    }
  }
  p.seat = pick;
  if (pick >= 0) {
    M[pick] = p.id;
    [p.x, p.y] = toWorld(b, I.spots[pick].x, I.spots[pick].y);
  } else {
    // standing somewhere in the main room
    const r = I.rooms[I.rooms.length - 1];
    [p.x, p.y] = toWorld(b, r.x + (hash01(p.id, S.t % 997) - 0.5) * r.w * 0.7, r.y + (hash01(S.t % 991, p.id) - 0.5) * r.d * 0.7);
  }
}

/** Forget the spots of people who have left. */
export function sweepSeats(S) {
  for (const bid in S.seats) {
    const M = S.seats[bid];
    let any = false;
    for (const i in M) { if (holds(S, Number(bid), Number(i), M[i])) any = true; else delete M[i]; }
    if (!any) delete S.seats[bid];
  }
}

/** World position of a local point of building b. */
export function toWorld(b, lx, ly) {
  const c = Math.cos(b.a), s = Math.sin(b.a);
  return [b.x + lx * c - ly * s, b.y + lx * s + ly * c];
}

/**
 * Lay out one building. Work happens in a "canonical" frame whose front wall
 * (the one with the street door) is at y = +D/2; the result is mapped back to
 * the building's local frame.
 */
function plan(b) {
  const c = Math.cos(b.a), s = Math.sin(b.a);
  const lx = (b.dx - b.x) * c + (b.dy - b.y) * s, ly = -(b.dx - b.x) * s + (b.dy - b.y) * c;
  const yFront = Math.abs(ly) / (b.d / 2) >= Math.abs(lx) / (b.w / 2);
  const sg = (yFront ? ly : lx) >= 0 ? 1 : -1;
  const W = yFront ? b.w : b.d, D = yFront ? b.d : b.w;
  const doorX = Math.max(-W / 2 + 1.2, Math.min(W / 2 - 1.2, yFront ? lx * sg : -ly * sg));
  const map = yFront ? (x, y) => [x * sg, y * sg] : (x, y) => [y * sg, -x * sg];
  const rot = yFront ? (sg > 0 ? 0 : Math.PI) : -sg * Math.PI / 2;

  const P = new Planner(b, W, D, doorX);
  if (b.k === 'house' || b.k === 'farmhouse') house(P);
  else if (b.k === 'tavern') tavern(P);
  else if (b.k === 'shop') shop(P);
  else if (b.k === 'temple' || b.k === 'chapel') temple(P);
  else if (b.k === 'townhall') townhall(P);
  else if (b.k === 'guild') guild(P);
  else if (b.k === 'keep') keep(P);
  else if (b.k === 'barracks') barracks(P);
  else if (STORE.has(b.k)) store(P);
  else house(P);

  const out = { floor: STONE_FLOOR.has(b.k) ? 'stone' : STORE.has(b.k) ? 'earth' : 'wood', rooms: [], walls: [], items: [], spots: [], door: null };
  for (const r of P.rooms) { const [x, y] = map(r.x, r.y); out.rooms.push({ x, y, w: yFront ? r.w : r.d, d: yFront ? r.d : r.w, floor: r.floor || out.floor, name: r.name }); }
  for (const w of P.walls) { const [x1, y1] = map(w[0], w[1]), [x2, y2] = map(w[2], w[3]); out.walls.push([x1, y1, x2, y2]); }
  for (const it of P.items) { const [x, y] = map(it.x, it.y); out.items.push({ ...it, x, y, a: (it.a || 0) + rot }); }
  for (const sp of P.spots) { const [x, y] = map(sp.x, sp.y); out.spots.push({ k: sp.k, x, y, a: (sp.a || 0) + rot }); }
  { const [x, y] = map(doorX, D / 2); out.door = { x, y, a: rot }; }
  out.count = {};
  out.byKind = {};
  out.spots.forEach((sp, i) => { out.count[sp.k] = (out.count[sp.k] || 0) + 1; (out.byKind[sp.k] ||= []).push(i); });
  return out;
}

const M = 0.35; // wall thickness

class Planner {
  constructor(b, W, D, doorX) {
    Object.assign(this, { b, W, D, doorX, rooms: [], walls: [], items: [], spots: [] });
    this.x0 = -W / 2 + M; this.x1 = W / 2 - M; this.y0 = -D / 2 + M; this.y1 = D / 2 - M;
    this.rnd = (i) => hash01(b.id * 13 + i, b.id * 7 + 3);
  }

  room(x0, y0, x1, y1, o = {}) { this.rooms.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, d: y1 - y0, ...o }); }
  item(k, x, y, w, d, o = {}) { this.items.push({ k, x, y, w, d, ...o }); }
  spot(k, x, y, a = 0) { this.spots.push({ k, x, y, a }); }

  /** A wall across the building at depth y with a doorway of width `gap` centred at gx. */
  across(y, gx, gap = 1.1, x0 = this.x0, x1 = this.x1) {
    if (gx - gap / 2 > x0) this.walls.push([x0, y, gx - gap / 2, y]);
    if (gx + gap / 2 < x1) this.walls.push([gx + gap / 2, y, x1, y]);
  }
  /** A wall along the depth at x, from y0 to y1, with an optional doorway at gy. */
  along(x, y0, y1, gy = null, gap = 1.1) {
    if (gy === null) { this.walls.push([x, y0, x, y1]); return; }
    if (gy - gap / 2 > y0) this.walls.push([x, y0, x, gy - gap / 2]);
    if (gy + gap / 2 < y1) this.walls.push([x, gy + gap / 2, x, y1]);
  }

  /** A table with chairs around it; seats face the table. */
  table(x, y, w, d, ends = true) {
    this.item('table', x, y, w, d);
    const n = Math.max(1, Math.floor(w / 0.75));
    for (let i = 0; i < n; i++) {
      const cx = x - w / 2 + (w / n) * (i + 0.5);
      this.chair(cx, y - d / 2 - 0.42, Math.PI / 2);
      this.chair(cx, y + d / 2 + 0.42, -Math.PI / 2);
    }
    if (ends) { this.chair(x - w / 2 - 0.42, y, 0); this.chair(x + w / 2 + 0.42, y, Math.PI); }
  }
  chair(x, y, a) { this.item('chair', x, y, 0.45, 0.45, { a }); this.spot('seat', x, y, a); }

  bed(x, y, double, a = Math.PI / 2) {
    const w = double ? 1.45 : 0.95;
    this.item('bed', x, y, w, 1.95, { tone: Math.floor(this.rnd(this.items.length) * 4) });
    if (double) { this.spot('bed', x - 0.33, y - 0.1, a); this.spot('bed', x + 0.33, y - 0.1, a); } else this.spot('bed', x, y - 0.1, a);
  }

  /** Beds in a row against the back wall of a room spanning [x0, x1] with its back at yb. */
  beds(x0, x1, yb, max = 6, firstDouble = true) {
    const room = x1 - x0;
    const n = Math.max(1, Math.min(max, Math.floor((room - 0.3) / 1.35)));
    let x = x0 + 0.2;
    for (let i = 0; i < n; i++) {
      const dbl = firstDouble && i === 0 && room >= 2.6;
      const w = dbl ? 1.45 : 0.95;
      if (x + w > x1 - 0.1) break;
      this.bed(x + w / 2, yb + 1.0, dbl);
      x += w + 0.4;
    }
  }
}

function house(P) {
  const { x0, x1, y0, y1, doorX } = P;
  const iw = x1 - x0, id = y1 - y0;
  const away = doorX > 0 ? -1 : 1; // the side away from the street door
  if (id >= 6.2 && iw >= 5.5) {
    const br = Math.min(4.4, Math.max(2.6, id * 0.4)), wy = y0 + br;
    P.room(x0, y0, x1, wy, { name: 'bedroom' });
    P.room(x0, wy, x1, y1, { name: 'hall' });
    P.across(wy, x0 + iw * (away > 0 ? 0.82 : 0.18), 0.95);
    // a second bedroom when the house is wide
    if (iw >= 9.5) {
      const mx = (x0 + x1) / 2 + away * iw * 0.06;
      P.along(mx, y0, wy);
      P.beds(x0, mx - 0.15, y0, 3);
      P.beds(mx + 0.15, x1, y0, 3, false);
    } else P.beds(x0, x1, y0, 5);
    const hy = (wy + y1) / 2;
    P.item('hearth', away > 0 ? x1 - 0.55 : x0 + 0.55, hy, 0.9, 1.4);
    const tw = Math.min(2.6, Math.max(1.2, iw * 0.32));
    P.table((x0 + x1) / 2 - away * 0.4, hy, tw, 0.9, iw > 6.5);
    P.item('chest', away > 0 ? x0 + 0.5 : x1 - 0.5, wy + 0.5, 0.8, 0.5);
    if (P.b.k === 'farmhouse') P.item('sacks', away > 0 ? x0 + 0.6 : x1 - 0.6, y1 - 0.8, 0.9, 0.9);
  } else {
    P.room(x0, y0, x1, y1, { name: 'room' });
    P.beds(x0, x1 - (iw > 6 ? 0 : 1.2), y0, 3);
    const ty = Math.min(y1 - 1.2, y0 + 2.4 + (y1 - y0 - 2.4) / 2);
    P.item('hearth', away > 0 ? x1 - 0.5 : x0 + 0.5, ty, 0.8, 1.2);
    P.table((x0 + x1) / 2 - away * 0.3, ty, Math.min(1.8, iw * 0.3), 0.8, false);
  }
}

function tavern(P) {
  const { x0, x1, y0, y1, doorX } = P;
  const iw = x1 - x0, id = y1 - y0, away = doorX > 0 ? -1 : 1;
  const back = Math.max(2.6, Math.min(3.6, id * 0.3)), wy = y0 + back;
  // guest rooms along the back
  const n = Math.max(1, Math.floor(iw / 3.1)), rw = iw / n;
  for (let i = 0; i < n; i++) {
    const a = x0 + rw * i, z = a + rw, gx = (a + z) / 2;
    if (i) P.along(a, y0, wy);
    P.walls.push([a, wy, gx - 0.45, wy], [gx + 0.45, wy, z, wy]);
    P.room(a, y0, z, wy, { name: 'guest room' });
    P.bed(gx + (rw > 3.4 ? 0 : 0.6), y0 + 1.05, rw > 3.4);
  }
  P.room(x0, wy, x1, y1, { name: 'taproom' });
  // the bar along the side away from the door
  const bx = away > 0 ? x1 - 1.6 : x0 + 1.6, bl = Math.min(id - back - 2, 5.5);
  P.item('counter', bx, wy + 0.8 + bl / 2, 0.7, bl);
  P.item('barrels', away > 0 ? x1 - 0.5 : x0 + 0.5, wy + 0.8 + bl / 2, 0.7, Math.max(1, bl - 1));
  for (let i = 0; i < 3; i++) P.spot('work', bx + away * 0.85, wy + 1.2 + (bl - 0.8) * (i / 2), away > 0 ? Math.PI : 0);
  P.item('hearth', away > 0 ? x0 + 0.55 : x1 - 0.55, (wy + y1) / 2, 0.9, 1.6);
  // tables in the free part of the taproom
  const fx0 = away > 0 ? x0 + 1.6 : bx + 1.4, fx1 = away > 0 ? bx - 1.4 : x1 - 1.6;
  for (let y = wy + 1.8; y < y1 - 1.2; y += 2.7) for (let x = fx0 + 0.6; x < fx1 - 0.5; x += 2.6) P.table(x, y, 1.1, 0.9);
}

function shop(P) {
  const { x0, x1, y0, y1, doorX, b } = P;
  const iw = x1 - x0, id = y1 - y0, away = doorX > 0 ? -1 : 1;
  const cy = y1 - Math.max(2.2, id * 0.42);
  P.room(x0, cy, x1, y1, { name: 'shop' });
  P.room(x0, y0, x1, cy, { name: 'workroom' });
  P.across(cy - 0.9, away > 0 ? x1 - 0.9 : x0 + 0.9, 1.1);
  // counter across the front room, leaving a gap on the far side
  const cw = Math.max(1.6, iw - 1.8), ccx = away > 0 ? x0 + cw / 2 + 0.2 : x1 - cw / 2 - 0.2;
  P.item('counter', ccx, cy + 0.15, cw, 0.6);
  P.spot('work', ccx, cy - 0.45, Math.PI / 2);
  P.spot('cust', ccx - 0.6, cy + 0.95, -Math.PI / 2);
  P.spot('cust', ccx + 0.6, cy + 0.95, -Math.PI / 2);
  P.item('shelf', x0 + 0.3, (cy + y1) / 2 + 0.3, 0.45, Math.min(2.2, y1 - cy - 1.2));
  P.item('shelf', x1 - 0.3, (cy + y1) / 2 + 0.3, 0.45, Math.min(2.2, y1 - cy - 1.2));
  const tools = TOOL[b.trade] || ['bench', 'bench'];
  const wy = (y0 + cy - 0.9) / 2, n = Math.max(2, Math.min(4, Math.floor(iw / 2.2)));
  for (let i = 0; i < n; i++) {
    const x = x0 + (iw / n) * (i + 0.5), k = tools[i % tools.length];
    const big = k === 'forge' || k === 'kiln' || k === 'oven' || k === 'vat' || k === 'millstone';
    P.item(k, x, wy - 0.35, big ? 1.3 : 1.1, big ? 1.1 : 0.7);
    P.spot('work', x, wy + 0.6, -Math.PI / 2);
  }
}

function temple(P) {
  const { x0, x1, y0, y1 } = P;
  const iw = x1 - x0, cx = (x0 + x1) / 2;
  P.room(x0, y0, x1, y1, { name: 'nave' });
  const aw = Math.min(3.2, iw * 0.32);
  P.item('altar', cx, y0 + 1.3, aw, 0.9);
  P.item('candles', cx - aw / 2 - 0.6, y0 + 1.0, 0.4, 0.4);
  P.item('candles', cx + aw / 2 + 0.6, y0 + 1.0, 0.4, 0.4);
  P.spot('work', cx, y0 + 0.55, Math.PI / 2);
  P.spot('work', cx - aw / 2 - 0.6, y0 + 1.8, Math.PI / 2);
  P.spot('work', cx + aw / 2 + 0.6, y0 + 1.8, Math.PI / 2);
  const aisle = 1.4, pl = (iw - aisle) / 2 - 0.5;
  for (let y = y0 + 3.4; y < y1 - 1.6; y += 1.25) {
    for (const sd of [-1, 1]) {
      const px = cx + sd * (aisle / 2 + pl / 2);
      P.item('pew', px, y, pl, 0.45);
      const k = Math.max(1, Math.floor(pl / 0.65));
      for (let i = 0; i < k; i++) P.spot('pew', px - pl / 2 + (pl / k) * (i + 0.5), y + 0.45, -Math.PI / 2);
    }
  }
}

function townhall(P) {
  const { x0, x1, y0, y1 } = P;
  const iw = x1 - x0, id = y1 - y0, cx = (x0 + x1) / 2, wy = y0 + id * 0.45;
  P.room(x0, y0, x1, wy, { name: 'council chamber' });
  P.room(x0, wy, x1, y1, { name: 'hall of records' });
  P.across(wy, cx, 1.6);
  P.table(cx, (y0 + wy) / 2, Math.min(7, iw * 0.5), 1.4);
  const n = Math.max(3, Math.floor(iw / 2.6));
  for (let i = 0; i < n; i++) {
    const x = x0 + (iw / n) * (i + 0.5);
    P.item('desk', x, wy + 1.4, 1.3, 0.7);
    P.spot('work', x, wy + 0.75, Math.PI / 2);
  }
  P.item('shelf', x0 + 0.3, (wy + y1) / 2 + 1, 0.45, (y1 - wy) * 0.5);
  P.item('shelf', x1 - 0.3, (wy + y1) / 2 + 1, 0.45, (y1 - wy) * 0.5);
  for (let x = x0 + 1.5; x < x1 - 1; x += 2) P.spot('cust', x, y1 - 1.4, -Math.PI / 2);
}

function guild(P) {
  const { x0, x1, y0, y1 } = P;
  const iw = x1 - x0, id = y1 - y0, wy = y0 + id * 0.48, cx = (x0 + x1) / 2;
  P.room(x0, y0, x1, wy, { name: 'training hall' });
  P.room(x0, wy, x1, y1, { name: 'common room' });
  P.across(wy, cx, 1.8);
  // training ring
  const rw = iw * 0.62, rd = (wy - y0) * 0.66;
  P.item('ring', cx, (y0 + wy) / 2, rw, rd);
  for (let i = 0; i < 10; i++) {
    const t = (i / 10) * Math.PI * 2;
    P.spot('work', cx + Math.cos(t) * rw * 0.34, (y0 + wy) / 2 + Math.sin(t) * rd * 0.34, t + Math.PI);
  }
  P.item('rack', x0 + 0.35, (y0 + wy) / 2, 0.5, rd * 0.8);
  P.item('rack', x1 - 0.35, (y0 + wy) / 2, 0.5, rd * 0.8);
  // counter and notice board
  P.item('counter', x1 - 2, wy + 1.1, 2.6, 0.6);
  P.spot('work', x1 - 2.5, wy + 0.5, Math.PI / 2);
  P.spot('work', x1 - 1.5, wy + 0.5, Math.PI / 2);
  P.item('board', x0 + 2.2, wy + 0.25, 2.4, 0.2);
  for (let x = x0 + 1.6; x < x1 - 4.2; x += 2.6) P.table(x, (wy + y1) / 2 + 0.4, 1.2, 0.9);
}

function keep(P) {
  const { x0, x1, y0, y1 } = P;
  const iw = x1 - x0, id = y1 - y0, cx = (x0 + x1) / 2, wy = y0 + id * 0.38;
  // private chambers at the back
  const n = 3, rw = iw / n;
  for (let i = 0; i < n; i++) {
    const a = x0 + rw * i;
    if (i) P.along(a, y0, wy);
    P.room(a, y0, a + rw, wy, { name: i === 1 ? "lord's chamber" : 'chamber' });
    P.walls.push([a, wy, a + rw / 2 - 0.6, wy], [a + rw / 2 + 0.6, wy, a + rw, wy]);
    P.beds(a + 0.4, a + rw - 0.4, y0, i === 1 ? 1 : 3, true);
    P.item('chest', a + rw - 0.8, wy - 0.6, 0.9, 0.5);
  }
  P.room(x0, wy, x1, y1, { name: 'great hall' });
  P.item('throne', cx, wy + 1.2, 1.4, 1.1);
  P.spot('work', cx, wy + 1.25, -Math.PI / 2 + Math.PI);
  P.item('carpet', cx, (wy + y1) / 2 + 1, 2.2, (y1 - wy) * 0.7);
  // two long feast tables run along the depth of the hall
  const tl = (y1 - wy) * 0.55, ty = (wy + y1) / 2 + 0.8;
  for (const sd of [-1, 1]) {
    const tx = cx + sd * (iw * 0.27);
    P.item('table', tx, ty, 1.2, tl);
    const n = Math.max(1, Math.floor(tl / 0.75));
    for (let i = 0; i < n; i++) {
      const y = ty - tl / 2 + (tl / n) * (i + 0.5);
      P.chair(tx - 1.02, y, 0);
      P.chair(tx + 1.02, y, Math.PI);
    }
  }
  P.item('hearth', x0 + 0.6, wy + 2, 1, 2.2);
  P.item('hearth', x1 - 0.6, wy + 2, 1, 2.2);
  for (let i = 0; i < 6; i++) P.spot('work', x0 + 1.5 + i * ((iw - 3) / 5), y1 - 1.2, -Math.PI / 2);
}

function barracks(P) {
  const { x0, x1, y0, y1 } = P;
  const iw = x1 - x0, id = y1 - y0;
  P.room(x0, y0, x1, y1, { name: 'barrack room' });
  for (let x = x0 + 0.7; x < x1 - 0.6; x += 1.4) { P.item('bunk', x, y0 + 1.05, 0.9, 1.9); P.spot('bed', x, y0 + 1.0, Math.PI / 2); }
  if (id > 9) for (let x = x0 + 0.7; x < x1 - 0.6; x += 1.4) { P.item('bunk', x, y0 + 3.2, 0.9, 1.9); P.spot('bed', x, y0 + 3.1, Math.PI / 2); }
  P.table((x0 + x1) / 2, y1 - 2.4, Math.min(5, iw * 0.35), 1);
  P.item('desk', x1 - 1.6, y1 - 1.4, 1.4, 0.7);
  P.spot('work', x1 - 1.6, y1 - 2.0, Math.PI / 2);
  P.item('rack', x0 + 0.35, y1 - 2.5, 0.5, 3);
  for (let i = 0; i < 4; i++) P.spot('work', x0 + 1.4 + i * 1.2, y1 - 1.0, -Math.PI / 2);
}

function store(P) {
  const { x0, x1, y0, y1, b } = P;
  P.room(x0, y0, x1, y1, { name: b.k === 'shed' ? 'shed' : 'store' });
  const k = b.k === 'warehouse' ? 'crates' : 'sacks';
  let i = 0;
  for (let y = y0 + 1.1; y < y1 - 2.2; y += 2.6) {
    for (let x = x0 + 1.1; x < x1 - 0.9; x += 2.3) {
      if (P.rnd(i++) < 0.18) continue;
      P.item(k, x, y, 1.6, 1.5, { tone: Math.floor(P.rnd(i + 50) * 3) });
      if (i % 2) P.spot('work', x + 1.15, y + 1.25, 0);
    }
  }
  if (b.k === 'shed') P.item('cart', (x0 + x1) / 2, y1 - 1.6, 3.4, 1.6);
  for (let x = x0 + 1; x < x1 - 1; x += 2.2) P.spot('work', x, y1 - 0.9, -Math.PI / 2);
}
