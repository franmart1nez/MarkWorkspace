// The money of the region. Coins are never created by work: every wage is paid
// by someone (a settlement treasury, a business, the temple, the guild or the
// lord), and every purchase moves coins from one purse to another. Money only
// enters or leaves with travelling merchants, newcomers and departing families,
// and those flows are counted in S.econ so the total can be checked.
//
// Purses: households (hh.coins), settlement treasuries (S.sites[i].coins),
// businesses, the temple and the guild (S.biz[building id].coins). The lord is
// the household living in the keep (S.lord).
import { rand, pick, chance } from './rng.js';
import { WEEK, dayOf, log, note } from './core.js';
import { jobOf } from './people.js';
import { replaceWorker } from './fate.js';
import { dodger, evade, generosity } from './crime.js';
import { reviewTrades, skillOf } from './trades.js';

export const GOODS_PRICE = 9;
const GOODS_CAP = 30, ALE_CAP = 220;
const FOOD_TRADES = new Set(['baker', 'butcher', 'miller']);
const LORD_JOBS = new Set(['steward', 'servant']); // the city watch is paid by the council
const UNPAID = new Set(['lord', 'homemaker', 'child', 'retired', 'trader']);
const RENT_RATE = [0.15, 0.08]; // coins per square metre per week: city, villages
const HEARTH_TAX = [3, 2], TALLAGE = [0.015, 0.01];
const TOLL = 0.06, RETAIL = 0.18, CITY_FARM = 500;

/** Kind of business run in building b, or null. */
export function bizKind(b) {
  if (b.k === 'shop') return b.trade === 'brewer' ? 'ale' : FOOD_TRADES.has(b.trade) ? 'food' : 'goods';
  if (b.k === 'tavern' || b.k === 'stall' || b.k === 'guild') return b.k;
  if (b.k === 'temple' || b.k === 'chapel') return 'temple';
  return null;
}

export const rentOf = (L, b) => Math.max(2, Math.round(b.w * b.d * RENT_RATE[b.site === 0 ? 0 : 1]));
export const housePrice = (L, b) => rentOf(L, b) * 45;
export const ownerOf = (S, bid) => (S.own[bid] === undefined ? -1 : S.own[bid]);

const SHOPS = new WeakMap();
/** Business buildings of a settlement, grouped by kind (cached per layout). */
export function shopsOf(L, si) {
  let all = SHOPS.get(L);
  if (!all) {
    all = L.sites.map(() => ({ goods: [], food: [], ale: [] }));
    for (const b of L.blds) { const k = bizKind(b); if (all[b.site] && (k === 'goods' || k === 'food' || k === 'ale')) all[b.site][k].push(b.id); }
    SHOPS.set(L, all);
  }
  return all[si];
}

const week0 = () => ({ relief: 0, tw: [0, 0, 0, 0, 0, 0, 0, 0], tf: [0, 0, 0, 0, 0, 0, 0, 0], share: 0, wages: 0, wTre: 0, wBiz: 0, wLord: 0, imports: 0, exports: 0, rent: 0, tax: 0, toll: 0, food: 0, goods: 0, drink: 0, offer: 0, alms: 0, tribute: 0, short: 0, evicted: 0, bought: 0, made: 0 });

/** Purses, prices and house ownership for a new world. */
export function setupEconomy(S, L) {
  S.biz = {};
  S.own = {};
  S.econ = { inflow: 0, outflow: 0, wk: week0(), last: null, hist: [] };
  for (const b of L.blds) {
    const k = bizKind(b);
    if (!k) continue;
    const start = { goods: 150, food: 120, ale: 120, tavern: 220, stall: 100, guild: 600, temple: b.k === 'temple' ? 500 : 120 }[k];
    S.biz[b.id] = { coins: start, stock: k === 'goods' ? 18 : k === 'ale' ? 80 : 0, price: k === 'goods' ? GOODS_PRICE : 0, sales: 0, owner: -1, avg: 0, bad: 0, good: 0, closed: 0 };
  }
  // the master of each workshop, the innkeeper or the merchant owns the business
  for (const p of S.people) {
    const B = p.work >= 0 && S.biz[p.work];
    if (B && B.owner < 0 && L.blds[p.work].k !== 'temple' && L.blds[p.work].k !== 'chapel' && L.blds[p.work].k !== 'guild') B.owner = p.hh;
  }
  for (const s of S.sites) { s.price = 0.8; s.bill = 0; }
  S.lord = S.households.findIndex((h) => h.home === L.sites[0].keep);
  // who owns the houses: many families own theirs, the lord holds the rest,
  // and a few well-off city families let out houses of their own
  const rich = S.households.filter((h) => h.site === 0 && h.id !== S.lord && h.coins > 140);
  for (const hh of S.households) {
    if (hh.id === S.lord) continue;
    const b = L.blds[hh.home], city = b.site === 0;
    const own = b.k === 'farmhouse' ? 0.5 : city ? 0.38 : 0.7;
    if (chance(S, own)) S.own[b.id] = hh.id;
    else if (city && rich.length && chance(S, 0.22)) S.own[b.id] = pick(S, rich).id;
  }
  for (const hh of S.households) { hh.goods = Math.round(hh.m.length * (0.8 + rand(S) * 0.8) * 10) / 10; hh.arrears = 0; }
  billing(S, L);
  // treasuries start with about six days of wages in hand and a price that roughly pays for them
  S.sites.forEach((s, i) => { s.coins = Math.round(treasuryTarget(s)); s.price = i === 0 ? 0.95 : 0.7; });
}

/** Who pays the wage of person p, as a purse ({coins}) or null. */
export function payerOf(S, L, p) {
  if (UNPAID.has(p.job)) return null;
  if (LORD_JOBS.has(p.job)) return S.households[S.lord];
  if (p.job === 'adventurer' || p.job === 'guild clerk') return S.biz[L.sites[0].guild] || S.sites[0];
  if (p.job !== 'labourer' && p.work >= 0 && S.biz[p.work]) return S.biz[p.work];
  // a day labourer is paid by whoever hired them for the day
  if (p.job === 'labourer' && p.in >= 0 && S.biz[p.in]) return S.biz[p.in];
  return S.sites[p.site] || null;
}

const totalOf = (list) => list.reduce((a, x) => a + x.coins, 0);
export function moneyTotal(S) {
  let t = totalOf(S.households) + totalOf(S.sites);
  for (const k in S.biz) t += S.biz[k].coins;
  return t;
}

/** Money crossing the edge of the region: kind is 'in' or 'out'. */
export function external(S, kind, amount) {
  if (kind === 'in') { S.econ.inflow += amount; S.econ.wk.exports += amount; } else { S.econ.outflow += amount; S.econ.wk.imports += amount; }
}

export function moveMoney(from, to, amount) {
  const n = Math.max(0, Math.min(amount, from.coins));
  from.coins -= n;
  to.coins += n;
  return n;
}

/** Pay person p for `amount` coins of work, as far as the employer can. */
export function payWage(S, L, p, amount) {
  const hh = S.households[p.hh], payer = payerOf(S, L, p);
  if (!hh || !payer || payer === hh || amount <= 0) return;
  const paid = moveMoney(payer, hh, amount);
  S.econ.wk.wages += paid;
  const si = S.sites.indexOf(payer);
  if (payer === S.households[S.lord]) S.econ.wk.wLord += paid; else if (si >= 0) { S.econ.wk.wTre += paid; S.econ.wk.tw[si] += paid; } else S.econ.wk.wBiz += paid;
  if (paid >= amount * 0.98) return;
  S.econ.wk.short++;
  const d = dayOf(S.t);
  if (d - (payer.warned ?? -99) < WEEK) return;
  payer.warned = d;
  const who = payer === S.households[S.lord] ? `The lord of ${L.sites[0].name}` : si >= 0 ? `The treasury of ${L.sites[si].name}` : placeOf(L, p);
  log(S, 'work', si >= 0 || payer === S.households[S.lord] ? 1 : 0, `${who} could not pay full wages.`, p.x, p.y, p.id);
}
const placeOf = (L, p) => (p.work >= 0 && L.blds[p.work] ? (L.blds[p.work].name || `The ${L.blds[p.work].trade || L.blds[p.work].k}'s workshop`) : 'An employer');

// ---- prices ----------------------------------------------------------------------

const NORMAL_DAYS = [14, 35];
/** Coins a treasury tries to keep in hand: about six days of the wages it pays. */
export const treasuryTarget = (s) => Math.max(400, (s.bill || 0) * 6);
export const foodDaysOf = (S, si) => S.sites[si].food / Math.max(1, S.sites[si].pop * 3);
/** Price of a meal in a settlement: the treasury's base price times scarcity. */
export function foodPrice(S, si) {
  const s = S.sites[si], d = Math.max(0.5, foodDaysOf(S, si));
  // in a famine food becomes dear enough that the poor cannot buy it
  const scarce = Math.max(0.85, Math.min(3, Math.sqrt(NORMAL_DAYS[si === 0 ? 0 : 1] / d)));
  return Math.round(s.price * scarce * 100) / 100;
}

// ---- buying and selling ------------------------------------------------------------

/** A household restocks its larder at a market stall, a food shop or the village barn (building bid). */
export function buyFood(S, L, p, hh, bid, days = 5) {
  const site = S.sites[p.site], price = foodPrice(S, p.site), want = hh.m.length * 3 * days - hh.pantry;
  const n = Math.max(0, Math.min(want, Math.floor(site.food), Math.floor(Math.max(0, hh.coins) / price)));
  if (n > 0) {
    const cost = n * price, shop = S.biz[bid];
    hh.coins -= cost; hh.pantry += n; site.food -= n;
    if (shop) { shop.coins += cost * RETAIL; shop.sales += cost; site.coins += cost * (1 - RETAIL); } else site.coins += cost;
    S.econ.wk.tf[p.site] += shop ? cost * (1 - RETAIL) : cost;
    S.econ.wk.food += cost;
  }
  return n;
}

/** A meal bought while out (at work, with an empty larder at home). */
export function mealOut(S, si, hh) {
  const site = S.sites[si], price = foodPrice(S, si) * 1.6;
  if (hh.coins < price || site.food < 1) return false;
  hh.coins -= price; site.coins += price; site.food--;
  S.econ.wk.food += price;
  S.econ.wk.tf[si] += price;
  return true;
}

/** How much a household wants to own and use up of everyday goods: clothes, tools, pots, shoes. */
export function luxOf(hh) {
  const per = hh.coins / Math.max(1, hh.m.length);
  return Math.max(0, Math.min(2.5, (per - 30) / 60));
}
/** Coins a household keeps back for a week of food and the rent before spending on anything else. */
export const reserveOf = (S, L, hh) => hh.m.length * 21 * foodPrice(S, hh.site) + (ownerOf(S, hh.home) === hh.id ? 0 : rentOf(L, L.blds[hh.home]));
export const spare = (S, L, hh) => hh.coins - reserveOf(S, L, hh);
export const wantsGoods = (S, L, hh) => hh.m.length > 0 && hh.goods < hh.m.length * (0.7 + luxOf(hh) * 0.5) && spare(S, L, hh) > 10;

/** Workshops where a household of settlement si can buy goods; villagers walk to the city if theirs has none. */
export function goodsShopsFor(S, L, si) {
  const own = shopsOf(L, si).goods.filter((id) => S.biz[id].stock >= 1 && !S.biz[id].closed);
  if (own.length) return own;
  return shopsOf(L, 0).goods.filter((id) => S.biz[id].stock >= 1 && !S.biz[id].closed);
}

/** The businesses in a list that are still open. */
export const openOf = (S, list) => list.filter((id) => !S.biz[id] || !S.biz[id].closed);

export function buyGoods(S, L, p, hh, bid) {
  const shop = S.biz[bid];
  if (!shop || !hh) return 0;
  const lux = luxOf(hh), want = hh.m.length * (1.6 + lux) - hh.goods;
  const budget = Math.min(hh.coins - hh.m.length * 8, Math.max(shop.price, spare(S, L, hh)));
  const n = Math.max(0, Math.min(Math.floor(want), Math.floor(shop.stock), Math.floor(budget / shop.price)));
  if (n <= 0) return 0;
  const cost = n * shop.price;
  hh.coins -= cost; hh.goods += n; shop.stock -= n; shop.coins += cost; shop.sales += cost;
  S.econ.wk.goods += cost;
  return n;
}

/** Hours of work in a workshop turn into stock; materials are bought from the settlement. */
export function produce(S, L, p, minutes) {
  const hired = p.job === 'labourer', bid = hired ? p.in : p.work, shop = S.biz[bid];
  if (!shop || p.in !== bid) return;
  if (shop.closed) return;
  const k = bizKind(L.blds[bid]), h = (minutes / 60) * (hired ? 0.6 : 1) * skillOf(p);
  if (k === 'goods' && shop.stock < GOODS_CAP) {
    const n = h * 0.1;
    shop.stock += n;
    // wood, clay and wool come from the settlement; iron, dyes and salt from far away
    moveMoney(shop, S.sites[L.blds[bid].site], n * 0.4);
    const imp = Math.min(shop.coins, n * 0.4);
    shop.coins -= imp;
    external(S, 'out', imp);
    S.econ.wk.made += n;
  } else if (k === 'ale' && shop.stock < ALE_CAP) {
    const n = h * 3.2;
    shop.stock += n;
    moveMoney(shop, S.sites[L.blds[bid].site], n * 0.12);
  }
}

/** An evening at the tavern: the guest pays, the tavern buys its ale. */
export function drink(S, L, p, hh, bid) {
  const tav = S.biz[bid], price = 2;
  if (!tav || !hh || hh.coins < price) return;
  hh.coins -= price; tav.coins += price; tav.sales += price;
  S.econ.wk.drink += price;
  const brewers = shopsOf(L, L.blds[bid].site).ale.concat(shopsOf(L, 0).ale);
  const br = brewers.length ? S.biz[brewers[(bid + dayOf(S.t)) % brewers.length]] : null;
  if (br && br.stock >= 1) { br.stock--; moveMoney(tav, br, 0.55); br.sales += 0.55; } else moveMoney(tav, S.sites[L.blds[bid].site], 0.55);
  // wine and spices come from far away
  const imp = Math.min(tav.coins, 0.25);
  tav.coins -= imp;
  external(S, 'out', imp);
}

/** A travelling merchant pays for a night at the inn. */
export function lodge(S, bid) {
  const tav = S.biz[bid];
  if (!tav) return;
  tav.coins += 8; tav.sales += 8;
  external(S, 'in', 8);
}

/**
 * A travelling merchant at the warehouses: sells food to the city, pays the
 * warehouse dues and buys up workshop goods to carry away.
 */
export function traderDeal(S, L, p, sold) {
  const city = S.sites[0], price = foodPrice(S, 0) * 0.55;
  if (sold >= 0) { const paid = Math.min(city.coins, sold * price); city.coins -= paid; external(S, 'out', paid); } else { city.coins -= sold * price; external(S, 'in', -sold * price); }
  city.coins += 12; external(S, 'in', 12);
  let bought = 0;
  const shops = shopsOf(L, 0).goods.filter((id) => S.biz[id].stock > 20).sort((a, b) => S.biz[b].stock - S.biz[a].stock || a - b);
  for (const id of shops.slice(0, 3)) {
    const shop = S.biz[id], n = Math.floor(shop.stock - 16);
    const cost = n * shop.price * 0.85;
    shop.stock -= n; shop.coins += cost; shop.sales += cost;
    external(S, 'in', cost);
    bought += n;
  }
  // and sells wine, spices and fine cloth to the wealthiest families of the city
  const buyers = S.households.filter((h) => h.site === 0 && h.m.length && h.id !== S.lord && spare(S, L, h) > 150)
    .sort((a, b) => b.coins - a.coins || a.id - b.id).slice(0, 15);
  for (const h of buyers) {
    const n = spare(S, L, h) * 0.12;
    h.coins -= n; h.goods += n / GOODS_PRICE;
    external(S, 'out', n);
  }
  const lord = S.households[S.lord];
  if (lord && lord.coins > 2500) { const n = (lord.coins - 2500) * 0.08; lord.coins -= n; lord.goods += n / GOODS_PRICE; external(S, 'out', n); }
  return bought;
}

/** Offering at prayer. */
export function offer(S, L, p, hh, bid) {
  const t = S.biz[bid], share = generosity(p);
  if (!t || !hh || hh.coins < 30 || !share) return;
  const n = Math.min(10, hh.coins * share);
  hh.coins -= n; t.coins += n;
  S.econ.wk.offer += n;
}

/** Fee to the apothecary when someone is hurt. */
export function healer(S, L, p) {
  const hh = S.households[p.hh], list = shopsOf(L, 0).goods.filter((id) => L.blds[id].trade === 'apothecary' && !S.biz[id].closed);
  if (!hh || !list.length) return;
  const shop = S.biz[list[p.id % list.length]];
  const n = moveMoney(hh, shop, 8);
  shop.sales += n;
}

/** Bounty money: the city pays the guild when it posts a quest. */
export function fundQuest(S, L, reward) {
  const guild = S.biz[L.sites[0].guild];
  if (guild && guild.coins < reward) moveMoney(S.sites[0], guild, reward - guild.coins);
}
export function payReward(S, L, p, amount) {
  const hh = S.households[p.hh], guild = S.biz[L.sites[0].guild] || S.sites[0];
  if (hh) moveMoney(guild, hh, amount);
}

// ---- households that move, merge or end ---------------------------------------------

/** Hand the coins of a household that is ending to its heirs, or to the settlement. */
export function closeEstate(S, hh, heir) {
  const to = heir || S.sites[hh.site];
  if (to) to.coins += Math.max(0, hh.coins);
  else S.econ.outflow += Math.max(0, hh.coins);
  if (heir) heir.goods = (heir.goods || 0) + (hh.goods || 0);
  hh.coins = 0; hh.goods = 0;
  for (const k in S.own) if (S.own[k] === hh.id) delete S.own[k];
}

/** A family leaves the region and takes its money with it. */
export function emigrate(S, hh) {
  S.econ.outflow += Math.max(0, hh.coins);
  hh.coins = 0; hh.goods = 0;
  for (const k in S.own) if (S.own[k] === hh.id) delete S.own[k];
}

export function moveHome(S, L, hh, bid) {
  delete S.occ[hh.home];
  hh.home = bid;
  S.occ[bid] = hh.id;
  for (const id of hh.m) { const p = S.people[id]; p.home = bid; if (!p.route) p.until = Math.min(p.until, S.t + 1); }
}

function mergeInto(S, L, hh, host) {
  for (const id of hh.m) {
    const p = S.people[id];
    p.hh = host.id; p.home = host.home;
    host.m.push(id);
    if (!p.route) p.until = Math.min(p.until, S.t + 1);
  }
  delete S.occ[hh.home];
  hh.m = [];
  closeEstate(S, hh, host);
}

/** Pay a settlement treasury's or employer's weekly bills: compute who they pay. */
function billing(S, L) {
  for (const s of S.sites) s.bill = 0;
  for (const k in S.biz) S.biz[k].bill = 0;
  const lord = S.households[S.lord];
  if (lord) lord.bill = 0;
  for (const p of S.people) {
    if (!p.alive || p.away) continue;
    const payer = payerOf(S, L, p);
    if (payer && payer !== S.households[p.hh]) payer.bill = (payer.bill || 0) + jobOf(p).w;
  }
}

// ---- the daily and weekly round -------------------------------------------------------

export function econDay(S, L, season) {
  const day = dayOf(S.t);
  // goods wear out, and whoever keeps the house mends, spins and sews; firewood in winter
  for (const p of S.people) if (p.alive && !p.away && p.job === 'homemaker' && S.households[p.hh]) S.households[p.hh].goods += 0.12;
  for (const hh of S.households) {
    if (!hh.m.length) continue;
    hh.goods = Math.max(0, hh.goods - hh.m.length * 0.07 * (1 + luxOf(hh) * 0.6));
    if (season === 3) moveMoney(hh, S.sites[hh.site], hh.m.length * 0.4);
  }
  // the old live on a small pension from the settlement
  for (const p of S.people) if (p.alive && !p.away && p.job === 'retired' && S.households[p.hh] && S.sites[p.site]) moveMoney(S.sites[p.site], S.households[p.hh], 2);
  // the treasury sets the price of food so that it can pay its people
  // (it aims at about six days of wages in hand, and watches whether the
  // coins are rising or falling so that it does not overshoot)
  S.sites.forEach((s) => {
    s.flow = Math.round(((s.flow || 0) * 0.75 + (s.coins - (s.prev ?? s.coins)) * 0.25) * 100) / 100;
    s.prev = Math.round(s.coins * 100) / 100;
    const target = treasuryTarget(s), err = Math.max(-1, Math.min(1, (s.coins + s.flow * 6 - target) / target));
    s.price = Math.round(Math.max(0.25, Math.min(2.5, s.price * Math.exp(-0.035 * err))) * 1000) / 1000;
  });
  // workshops price their goods by what is on the shelves and what is in the till
  for (const k in S.biz) {
    const B = S.biz[k];
    if (!B.price) continue;
    const f = B.stock > 26 ? 0.98 : B.stock < 10 ? 1.03 : B.coins < (B.bill || 0) * 3 ? 1.02 : 1;
    B.price = Math.max(5, Math.min(24, B.price * f));
    B.price = Math.round(B.price * 100) / 100;
  }
  if (day % WEEK === 0) econWeek(S, L);
}

function econWeek(S, L) {
  const W = S.econ.wk, lord = S.households[S.lord];
  billing(S, L);
  // rent and the hearth tax
  for (const hh of S.households) {
    if (!hh.m.length || hh.id === S.lord) continue;
    const b = L.blds[hh.home], si = b.site === 0 ? 0 : 1, site = S.sites[hh.site];
    // the hearth tax, and the tallage: a small share of the savings of those
    // who have them. Some families hide their savings or skip the hearth tax.
    const tallage = hh.coins > 100 ? (hh.coins - 100) * TALLAGE[si] : 0, dodge = dodger(S, hh);
    const hearth = dodge && chance(S, 0.4) ? 0 : HEARTH_TAX[si], tall = dodge ? tallage * 0.3 : tallage;
    W.tax += moveMoney(hh, site, hearth);
    if (tall > 0) W.tax += moveMoney(hh, site, tall);
    if (dodge && HEARTH_TAX[si] - hearth + tallage - tall > 0.5) evade(S, L, hh, HEARTH_TAX[si] - hearth + tallage - tall);
    const owner = ownerOf(S, b.id);
    if (owner === hh.id) { hh.arrears = 0; continue; }
    const rent = rentOf(L, b), to = owner >= 0 && S.households[owner].m.length ? S.households[owner] : lord;
    const paid = moveMoney(hh, to, rent);
    W.rent += paid;
    hh.arrears = paid < rent * 0.5 ? hh.arrears + 1 : paid < rent * 0.98 ? hh.arrears : 0;
  }
  evictions(S, L);
  purchases(S, L);
  // businesses: the market toll, then the owner draws the profit
  for (const k in S.biz) {
    const B = S.biz[k], b = L.blds[k], site = S.sites[b.site];
    W.toll += moveMoney(B, site, B.sales * TOLL);
    B.avg = Math.round((B.avg ? B.avg * 0.6 + B.sales * 0.4 : B.sales) * 100) / 100;
    B.sales = 0;
    if (B.closed) continue;
    const keep = Math.max(80, (B.bill || 0) * 6), extra = B.coins - keep;
    if (extra <= 0) continue;
    if (b.k === 'temple' || b.k === 'chapel') alms(S, L, B, b, extra * 0.7);
    else if (b.k === 'guild') moveMoney(B, S.sites[0], extra * 0.5);
    else {
      let owner = S.households[B.owner];
      if (!owner || !owner.m.length) {
        const w = S.people.find((p) => p.alive && !p.away && p.work === Number(k));
        B.owner = w ? w.hh : -1;
        owner = S.households[B.owner];
      }
      if (owner) moveMoney(B, owner, extra * 0.6);
    }
  }
  // poor relief: what a treasury holds beyond its needs first helps the
  // households that have almost nothing
  S.sites.forEach((site, i) => {
    const spareCoins = site.coins - treasuryTarget(site) * 0.8;
    if (spareCoins <= 0) return;
    const needy = S.households.filter((h) => h.site === i && h.m.length && h.id !== S.lord && h.coins < h.m.length * 8);
    const gap = needy.reduce((a, h) => a + h.m.length * 8 - h.coins, 0);
    if (gap <= 0) return;
    const k = Math.min(1, (spareCoins * 0.5) / gap);
    for (const h of needy) W.relief += moveMoney(site, h, (h.m.length * 8 - h.coins) * k);
  });
  // a village treasury with far more than it needs shares out the harvest money
  // (the city lowers its price of food instead)
  S.sites.forEach((site, i) => {
    if (i === 0) return;
    const target = treasuryTarget(site);
    if (site.coins < target * 1.5) return;
    const homes = S.households.filter((h) => h.site === i && h.m.length && h.id !== S.lord);
    if (!homes.length) return;
    const pot = (site.coins - target * 1.5) * 0.4, people = homes.reduce((a, h) => a + h.m.length, 0);
    for (const h of homes) W.share += moveMoney(site, h, (pot * h.m.length) / people);
    log(S, 'town', 0, `${L.sites[i].name} shared ${Math.round(pot)} coins of its harvest money among its households.`, L.sites[i].x, L.sites[i].y);
  });
  // the city pays its lord a fixed rent for its charter, the farm of the town
  if (lord) W.tribute += moveMoney(S.sites[0], lord, CITY_FARM);
  // the guild's retainer from the city
  const guild = S.biz[L.sites[0].guild];
  if (guild) moveMoney(S.sites[0], guild, 420);
  // the lord spends: fine goods from the city's workshops, and works for the town
  if (lord && lord.coins > 3000) {
    let spend = (lord.coins - 3000) * 0.25;
    for (const id of shopsOf(L, 0).goods) {
      const B = S.biz[id];
      if (spend <= 0) break;
      const n = Math.min(Math.floor(B.stock - 4), Math.floor(spend / B.price));
      if (n <= 0) continue;
      B.stock -= n; lord.coins -= n * B.price; B.coins += n * B.price; B.sales += n * B.price; lord.goods += n; spend -= n * B.price;
    }
    if (spend > 0) moveMoney(lord, S.sites[0], spend);
  }
  reviewTrades(S, L);
  S.econ.last = { ...W, day: dayOf(S.t), money: Math.round(moneyTotal(S)) };
  S.econ.hist.push(summary(S, L));
  if (S.econ.hist.length > 24) S.econ.hist.shift();
  S.econ.wk = week0();
}

/** Coins from the temple to the poorest households of its settlement. */
function alms(S, L, B, b, amount) {
  const poor = S.households.filter((h) => h.site === b.site && h.m.length && h.coins / h.m.length < 6).sort((a, c) => a.coins - c.coins || a.id - c.id).slice(0, 12);
  if (!poor.length) return;
  const each = amount / poor.length;
  for (const h of poor) S.econ.wk.alms += moveMoney(B, h, each);
}

function evictions(S, L) {
  for (const hh of S.households) {
    if (!hh.m.length || hh.arrears < 4 || hh.id === S.lord) continue;
    const old = L.blds[hh.home], si = hh.site, rent = rentOf(L, old);
    const cheaper = L.blds.filter((b) => b.site === si && b.k === 'house' && S.occ[b.id] === undefined && ownerOf(S, b.id) !== hh.id && rentOf(L, b) < rent * 0.85)
      .sort((a, b) => rentOf(L, a) - rentOf(L, b) || a.id - b.id);
    const name = L.sites[si].name;
    S.econ.wk.evicted++;
    hh.arrears = 0;
    if (cheaper.length) {
      moveHome(S, L, hh, cheaper[0].id);
      for (const id of hh.m) note(S, S.people[id], 'Could not pay the rent and moved to a smaller house.');
      log(S, 'town', 1, `The ${hh.fam} family of ${name} fell behind on the rent and moved to a smaller house.`, cheaper[0].x, cheaper[0].y, hh.m[0]);
      continue;
    }
    // kin or friends take them in
    const ids = new Set(hh.m), kinOf = (h) => h.m.some((id) => { const q = S.people[id]; return hh.m.some((m) => { const p = S.people[m]; return q.mom === p.id || q.dad === p.id || p.mom === q.id || p.dad === q.id || (p.mom >= 0 && p.mom === q.mom); }); });
    const hosts = S.households.filter((h) => h.id !== hh.id && h.site === si && h.m.length && h.m.length + hh.m.length <= 8 && !h.m.some((id) => ids.has(id)));
    const host = hosts.find(kinOf) || hosts.find((h) => h.m.some((id) => hh.m.some((m) => S.people[m].friends.includes(id))));
    if (host) {
      for (const id of hh.m) note(S, S.people[id], `Evicted for unpaid rent; taken in by the ${host.fam} household.`);
      log(S, 'town', 1, `The ${hh.fam} family of ${name} was evicted for unpaid rent and moved in with the ${host.fam} household.`, old.x, old.y, hh.m[0]);
      mergeInto(S, L, hh, host);
      continue;
    }
    for (const id of hh.m) { const p = S.people[id]; p.alive = false; p.gone = true; p.route = null; replaceWorker(S, p); note(S, p, 'Evicted, and left the region to look for work.'); }
    log(S, 'town', 2, `Evicted for unpaid rent, the ${hh.fam} family left ${name} to look for work elsewhere.`, old.x, old.y, hh.m[0]);
    delete S.occ[hh.home];
    emigrate(S, hh);
    hh.m = [];
  }
}

function purchases(S, L) {
  for (const hh of S.households) {
    if (!hh.m.length || hh.id === S.lord) continue;
    const b = L.blds[hh.home], owner = ownerOf(S, b.id);
    // tenants buy the house they live in
    if (owner !== hh.id) {
      const price = housePrice(L, b);
      if (hh.coins > price + 90 * hh.m.length && chance(S, 0.3)) {
        const seller = owner >= 0 && S.households[owner].m.length ? S.households[owner] : S.households[S.lord];
        moveMoney(hh, seller, price);
        S.own[b.id] = hh.id;
        S.econ.wk.bought++;
        for (const id of hh.m) if (S.people[id].age >= 18) note(S, S.people[id], 'Bought the family home.');
        log(S, 'town', 0, `The ${hh.fam} family bought their house in ${L.sites[hh.site].name}.`, b.x, b.y, hh.m[0]);
      }
      continue;
    }
    // owners with money to spare buy an empty house to let out
    if (hh.coins < 900 || !chance(S, 0.12)) continue;
    const held = Object.values(S.own).filter((o) => o === hh.id).length;
    if (held >= 8) continue;
    const free = L.blds.filter((x) => x.site === hh.site && x.k === 'house' && S.occ[x.id] === undefined && ownerOf(S, x.id) < 0);
    if (!free.length) continue;
    const pickB = pick(S, free), price = housePrice(L, pickB);
    if (hh.coins < price + 500) continue;
    moveMoney(hh, S.households[S.lord], price);
    S.own[pickB.id] = hh.id;
    S.econ.wk.bought++;
    log(S, 'town', 0, `The ${hh.fam} family bought a house in ${L.sites[hh.site].name} to let.`, pickB.x, pickB.y, hh.m[0]);
  }
}

/** At the turn of each season every village sends a tribute to the lord. */
export function tribute(S, L) {
  const lord = S.households[S.lord];
  if (!lord) return;
  let total = 0;
  S.sites.forEach((s, i) => { const extra = s.coins - treasuryTarget(s) * 1.25; if (i > 0 && extra > 0) total += moveMoney(s, lord, extra * 0.25); });
  S.econ.wk.tribute += total;
  // and the lord owes the king his levy
  const levy = Math.max(0, (lord.coins - 2500) * 0.5);
  lord.coins -= levy;
  external(S, 'out', levy);
  const k = L.blds[L.sites[0].keep];
  if (total > 0 || levy > 0) log(S, 'town', 1, `The villages paid ${Math.round(total).toLocaleString('en-US')} coins of seasonal tribute to the lord of ${L.sites[0].name}${levy > 0 ? `, who sent ${Math.round(levy).toLocaleString('en-US')} to the king as the royal levy` : ''}.`, k.x, k.y);
}

/** A compact picture of who holds the money, for the viewer and the tuning script. */
export function summary(S, L) {
  const hh = S.households.filter((h) => h.m.length && h.id !== S.lord);
  const per = hh.map((h) => h.coins).sort((a, b) => a - b);
  const q = (f) => Math.round(per[Math.min(per.length - 1, Math.floor(per.length * f))] || 0);
  let biz = 0;
  for (const k in S.biz) biz += S.biz[k].coins;
  const lord = S.households[S.lord];
  const owners = hh.filter((h) => ownerOf(S, h.home) === h.id).length;
  return {
    day: dayOf(S.t), money: Math.round(moneyTotal(S)), households: Math.round(totalOf(hh)), treasuries: Math.round(totalOf(S.sites)), biz: Math.round(biz),
    lord: Math.round(lord ? lord.coins : 0), p10: q(0.1), p50: q(0.5), p90: q(0.9), owners, tenants: hh.length - owners,
    food: S.sites.map((s, i) => foodPrice(S, i)), goods: avgGoodsPrice(S, L),
  };
}

export function avgGoodsPrice(S, L) {
  const list = shopsOf(L, 0).goods;
  return list.length ? Math.round((list.reduce((a, id) => a + S.biz[id].price, 0) / list.length) * 100) / 100 : GOODS_PRICE;
}

