// Trades follow demand. Customers prefer the trades a household needs most and
// the cheaper shops; a workshop or tavern that sells well takes on a hand, one
// that cannot pay its people lets them go, and one that keeps losing money
// closes. When the shops left in a settlement cannot keep up, someone with
// savings reopens a closed one.
import { rand, pick, chance } from './rng.js';
import { dayOf, log, note, tally } from './core.js';
import { jobOf } from './people.js';
import { moveMoney, luxOf, GOODS_PRICE } from './economy.js';
import { fullName } from './fate.js';

/** How much of a household's spending on goods each trade attracts. */
export const TRADE_DEMAND = { blacksmith: 1.3, carpenter: 1.1, weaver: 1, tailor: 1, cobbler: 1, potter: 0.8, apothecary: 0.6, cooper: 0.55, scribe: 0.35 };
const LUX_DEMAND = { scribe: 1.6, tailor: 0.5, apothecary: 0.5 };
const CLOSED_WEEKS = 6, MAX_CREW = 4;

/** Choose the workshop a household buys from: by what it needs and by price. */
export function pickShop(S, L, hh, list) {
  if (list.length < 2) return list[0];
  const lux = luxOf(hh);
  let total = 0;
  const w = list.map((id) => {
    const tr = L.blds[id].trade, x = (TRADE_DEMAND[tr] ?? 1) * (1 + lux * (LUX_DEMAND[tr] || 0)) * (GOODS_PRICE / S.biz[id].price) ** 1.5;
    total += x;
    return x;
  });
  let r = rand(S) * total;
  for (let i = 0; i < list.length; i++) { if (r < w[i]) return list[i]; r -= w[i]; }
  return list[list.length - 1];
}

/** How well a worker works: the diligent and practical make more, the lazy and clumsy less. */
export function skillOf(p) {
  const t = p.traits;
  return 1 + (t.includes('diligent') ? 0.15 : 0) + (t.includes('practical') ? 0.08 : 0) - (t.includes('lazy') ? 0.2 : 0) - (t.includes('clumsy') ? 0.15 : 0);
}

const title = (b) => b.name || `the ${b.trade}'s workshop`;
const tradeOf = (b) => (b.k === 'tavern' ? 'innkeeper' : b.trade);

/** Once a week, after the books are closed: hire, lay off, close and reopen. */
export function reviewTrades(S, L) {
  const crews = {};
  for (const p of S.people) if (p.alive && !p.away && p.work >= 0 && S.biz[p.work] && p.job !== 'labourer') (crews[p.work] ||= []).push(p);
  const demand = strain(S, L, crews);
  for (const k in S.biz) {
    const B = S.biz[k], b = L.blds[k];
    if (b.k !== 'shop' && b.k !== 'tavern') continue;
    if (B.closed) { if (dayOf(S.t) - B.closed >= CLOSED_WEEKS * 6 && demand[b.site] > 1.15 && chance(S, 0.2)) reopen(S, L, B, b); continue; }
    const crew = crews[k] || [];
    const bill = crew.reduce((a, p) => a + jobOf(p).w * 5, 0);
    const weak = B.coins < bill * 1.2 && (B.avg || 0) < bill, strong = B.coins > bill * 4 + 60 && (B.avg || 0) > bill * 1.3;
    B.bad = weak ? (B.bad || 0) + 1 : Math.max(0, (B.bad || 0) - 1);
    B.good = strong ? (B.good || 0) + 1 : 0;
    if (B.bad >= 3 && crew.length > 1) layOff(S, L, B, b, crew);
    else if (B.bad >= 7 && crew.length <= 1) close(S, L, B, b, crew);
    else if (B.good >= 3 && crew.length < MAX_CREW) hire(S, L, B, b);
  }
}

/** For each settlement: how hard its open workshops are pressed (sales over wages). */
function strain(S, L, crews) {
  const sales = L.sites.map(() => 0), bills = L.sites.map(() => 1);
  for (const k in S.biz) {
    const B = S.biz[k], b = L.blds[k];
    if (b.k !== 'shop' || B.closed) continue;
    sales[b.site] += B.avg || 0;
    bills[b.site] += (crews[k] || []).reduce((a, p) => a + jobOf(p).w * 5, 0);
  }
  return sales.map((s, i) => s / bills[i]);
}

function layOff(S, L, B, b, crew) {
  // hired hands go first, the owner's family last, the master never
  const owner = B.owner, order = crew.filter((p) => p.job !== 'innkeeper').sort((a, c) => (a.hh === owner) - (c.hh === owner) || a.age - c.age || a.id - c.id);
  const p = order[0];
  if (!p) return;
  p.job = 'labourer'; p.work = -1;
  if (!p.route) p.until = Math.min(p.until, S.t + 1);
  B.bad = 1;
  tally(S, 'trades', 'laid off');
  note(S, p, `Let go from ${title(b)} when trade fell off.`);
  log(S, 'work', 0, `Trade is slack at ${title(b)} in ${L.sites[b.site].name}; ${fullName(p)} was let go.`, b.x, b.y, p.id);
}

function close(S, L, B, b, crew) {
  const master = crew[0], site = S.sites[b.site];
  // what is left in the till goes to the creditors, the stock is sold off for nothing
  moveMoney(B, site, B.coins);
  Object.assign(B, { closed: Math.max(1, dayOf(S.t)), stock: 0, bad: 0, good: 0, avg: 0, price: B.price ? GOODS_PRICE : 0 });
  for (const p of crew) { p.job = 'labourer'; p.work = -1; if (!p.route) p.until = Math.min(p.until, S.t + 1); note(S, p, `${title(b)[0].toUpperCase()}${title(b).slice(1)} failed and closed its doors.`); }
  const hh = S.households[B.owner];
  if (hh) for (const id of hh.m) if (S.people[id].age >= 18 && !crew.includes(S.people[id])) note(S, S.people[id], 'The family business failed.');
  B.owner = -1;
  tally(S, 'trades', 'closed');
  log(S, 'work', 1, `${title(b)[0].toUpperCase()}${title(b).slice(1)} in ${L.sites[b.site].name} has closed${master ? `: ${fullName(master)} could not make it pay` : ''}.`, b.x, b.y, master ? master.id : undefined);
}

function hire(S, L, B, b) {
  const owner = S.households[B.owner];
  const cand = S.people.filter((q) => q.alive && !q.away && q.site === b.site && q.job === 'labourer' && q.age >= 15 && q.age <= 35 && !(q.jail > S.t));
  if (!cand.length) return;
  const kin = owner ? cand.filter((q) => q.hh === owner.id) : [];
  const p = kin.length ? kin[0] : pick(S, cand);
  p.job = b.k === 'tavern' ? 'tavern hand' : b.trade; p.work = b.id;
  if (!p.route) p.until = Math.min(p.until, S.t + 1);
  B.good = 0;
  tally(S, 'trades', 'taken on');
  note(S, p, `Taken on at ${title(b)}.`);
  log(S, 'work', 0, `Business is good at ${title(b)} in ${L.sites[b.site].name}; ${fullName(p)} was taken on.`, b.x, b.y, p.id);
}

function reopen(S, L, B, b) {
  const cand = S.people.filter((q) => q.alive && !q.away && q.site === b.site && q.job === 'labourer' && q.age >= 20 && q.age <= 50 && !(q.jail > S.t)
    && S.households[q.hh] && S.households[q.hh].coins >= 120 && S.households[q.hh].id !== S.lord);
  if (!cand.length) return;
  const p = pick(S, cand), hh = S.households[p.hh];
  moveMoney(hh, B, 80);
  Object.assign(B, { closed: 0, owner: hh.id, bad: 0, good: 0, avg: 60 });
  p.job = tradeOf(b); p.work = b.id;
  if (!p.route) p.until = Math.min(p.until, S.t + 1);
  tally(S, 'trades', 'reopened');
  note(S, p, `Put the family savings into reopening ${title(b)}.`);
  log(S, 'work', 1, `${fullName(p)} has reopened ${title(b)} in ${L.sites[b.site].name}.`, b.x, b.y, p.id);
}
