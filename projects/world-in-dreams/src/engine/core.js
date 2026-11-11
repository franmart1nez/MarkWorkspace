// Shared helpers: the calendar, walking routes over the road network and the
// chronicle. One tick of the simulation is one minute.
import { layoutFor } from './layout.js';
import { hyp } from './geom.js';

export const DAY = 1440, SEASON_DAYS = 12, YEAR_DAYS = 48, WEEK = 6;
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
export const WEEKDAYS = ['Moonday', 'Fireday', 'Waterday', 'Woodday', 'Goldday', 'Restday'];

export const getLayout = (S) => layoutFor(S.seed);
export const dayOf = (t) => Math.floor(t / DAY);
export const seasonOf = (t) => Math.floor((dayOf(t) % YEAR_DAYS) / SEASON_DAYS);

export function dateOf(t) {
  const day = dayOf(t), m = t % DAY;
  const year = Math.floor(day / YEAR_DAYS) + 1, season = seasonOf(t), dom = (day % SEASON_DAYS) + 1;
  const clock = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return { day, year, season, dom, clock, weekday: WEEKDAYS[day % WEEK], text: `${WEEKDAYS[day % WEEK]}, ${dom} ${SEASONS[season]}, Year ${year}`, short: `${dom} ${SEASONS[season]} Y${year}` };
}

/** True when minute-of-day m lies in the window [a, b), which may wrap past midnight. */
export const inWin = (m, a, b) => { a = ((a % DAY) + DAY) % DAY; b = ((b % DAY) + DAY) % DAY; return a <= b ? m >= a && m < b : m >= a || m < b; };
/** Next absolute time at which the clock shows minute-of-day m. */
export const nextAt = (t, m) => { m = ((m % DAY) + DAY) % DAY; const d = t - (t % DAY) + m; return d > t ? d : d + DAY; };

// ---- routes -------------------------------------------------------------------

/** Shortest-path tree towards one road node, computed once and kept with the layout. */
function treeTo(L, dest) {
  let tr = L.routes.get(dest);
  if (tr) return tr;
  const n = L.nodes.length, dist = new Float64Array(n).fill(Infinity), next = new Int32Array(n).fill(-1);
  const heap = [dest];
  dist[dest] = 0;
  const hd = [0];
  // binary heap of [distance, node] kept in two parallel arrays
  const push = (d, v) => {
    let i = hd.length;
    hd.push(d); heap.push(v);
    while (i > 0) { const p = (i - 1) >> 1; if (hd[p] <= d) break; hd[i] = hd[p]; heap[i] = heap[p]; i = p; }
    hd[i] = d; heap[i] = v;
  };
  const pop = () => {
    const top = heap[0], d = hd.pop(), v = heap.pop(), len = hd.length;
    if (len) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= len) break;
        if (c + 1 < len && hd[c + 1] < hd[c]) c++;
        if (hd[c] >= d) break;
        hd[i] = hd[c]; heap[i] = heap[c]; i = c;
      }
      hd[i] = d; heap[i] = v;
    }
    return top;
  };
  while (hd.length) {
    const d0 = hd[0], u = pop();
    if (d0 > dist[u]) continue;
    for (const e of L.adj[u]) {
      const nd = d0 + e.len;
      if (nd < dist[e.to]) { dist[e.to] = nd; next[e.to] = u; push(nd, e.to); }
    }
  }
  tr = { dist, next };
  L.routes.set(dest, tr);
  return tr;
}

/** Road node closest to a point. */
export function nodeNear(L, x, y) {
  for (const r of [80, 300, 1200, 6000]) {
    const n = L.nearestNode(x, y, r);
    if (n >= 0) return n;
  }
  return 0;
}

/**
 * Walking route as a flat list of coordinates. `from` and `to` are places
 * {x, y, n} where n is the road node that gives access to them; a building
 * also offers n2, the other end of its street.
 */
export function route(L, from, to) {
  if (from.n === to.n) return [to.x, to.y];
  const tr = treeTo(L, to.n);
  let cur = from.n;
  if (from.n2 !== undefined && from.n2 !== from.n) {
    const A = L.nodes[from.n], B = L.nodes[from.n2];
    if (tr.dist[from.n2] + hyp(from.x, from.y, B.x, B.y) < tr.dist[from.n] + hyp(from.x, from.y, A.x, A.y)) cur = from.n2;
  }
  const out = [];
  for (let guard = 0; cur !== to.n && cur >= 0 && guard < 2000; guard++) {
    out.push(L.nodes[cur].x, L.nodes[cur].y);
    cur = tr.next[cur];
  }
  if (cur === to.n) out.push(L.nodes[cur].x, L.nodes[cur].y);
  out.push(to.x, to.y);
  return out;
}

export function routeLength(L, from, to) {
  if (from.n === to.n) return hyp(from.x, from.y, to.x, to.y);
  return treeTo(L, to.n).dist[from.n];
}

// ---- chronicle ----------------------------------------------------------------

/** type: life | work | town | wild | quest | crime. imp: 0 everyday .. 3 memorable. */
export function log(S, type, imp, text, x, y, who) {
  const ev = { n: ++S.eventCount, t: S.t, type, imp, text };
  if (x !== undefined) { ev.x = Math.round(x); ev.y = Math.round(y); }
  if (who !== undefined) ev.who = who;
  S.events.push(ev);
  if (S.events.length > 1500) S.events.splice(0, 500);
}

export function note(S, p, text) {
  if (!p) return;
  p.hist.push({ t: S.t, text });
  if (p.hist.length > 14) p.hist.shift();
}

/** Count the residents of every settlement. */
export function census(S) {
  for (const s of S.sites) s.pop = 0;
  for (const p of S.people) if (p.alive && !p.away && S.sites[p.site]) S.sites[p.site].pop++;
}

/** Count something that happened this year (deaths by cause, crimes, bankruptcies...). Last year's counts are kept in S.tally.prev. */
export function tally(S, group, key, n = 1) {
  const y = Math.floor(dayOf(S.t) / YEAR_DAYS);
  if (!S.tally || S.tally.y !== y) S.tally = { y, cur: {}, prev: S.tally ? S.tally.cur : null };
  const g = (S.tally.cur[group] ||= {});
  g[key] = (g[key] || 0) + n;
}

export const ageOf = (S, p) => Math.floor((dayOf(S.t) - p.born) / YEAR_DAYS);
