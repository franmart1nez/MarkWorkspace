// The minute-by-minute simulation. Every inhabitant is an individual who
// sleeps, eats, walks to work along the streets, shops, prays and drinks; the
// fields follow the seasons; carts carry the harvest to the city.
import { rand, randRange, randInt, pick, chance } from './rng.js';
import { DAY, WEEK, YEAR_DAYS, SEASON_DAYS, SEASONS, getLayout, dayOf, seasonOf, inWin, nextAt, route, nodeNear, log, note, ageOf, census, tally } from './core.js';
import { jobOf, WORK_ACTS } from './people.js';
import { hyp } from './geom.js';
import { stepWild, wildDay, cull, BEASTS } from './wild.js';
import { die, wound, fullName, isNotable, replaceWorker, leaveEmpty } from './fate.js';
import { MEALS, CROP_K, settle, pickSpecies, makePerson } from './worldgen.js';
import {
  payWage, produce, foodPrice, spare, buyFood, mealOut, buyGoods, wantsGoods, goodsShopsFor, shopsOf, drink, lodge, traderDeal, offer,
  fundQuest, payReward, emigrate, econDay, tribute, moveMoney, openOf,
} from './economy.js';
import { seat, sweepSeats } from './interior.js';
import { planOf, mealDue, nextMeal } from './schedule.js';
import { atMarket, atCounter, atTavern, planNight, prowl, gallows, lawWeek, drunkard } from './crime.js';
import { illDay, mishap, rollYear, tellYear, ruinDay } from './ills.js';
import { pickShop } from './trades.js';

const LOAD = 900;
const H = 60;

export const foodDays = (S, si) => S.sites[si].food / Math.max(1, S.sites[si].pop * MEALS);
export const priceOf = foodPrice;
/** Food a settlement keeps for itself before selling: enough to reach the next harvest. */
const reserve = (S, si) => S.sites[si].pop * MEALS * (si === 0 ? 12 : 40);
const sowable = (t) => seasonOf(t) === 0 || (seasonOf(t) === 1 && dayOf(t) % SEASON_DAYS < 4);
const fieldNeeds = (S, L, id) => { const F = S.fields[id]; return F.st === 2 || (F.st === 0 && sowable(S.t)); };

// ---- going places -------------------------------------------------------------

const here = (L, p) => (p.in >= 0
  ? { x: L.blds[p.in].dx, y: L.blds[p.in].dy, n: L.blds[p.in].n, n2: L.blds[p.in].n2 }
  : { x: p.x, y: p.y, n: p.n >= 0 ? p.n : nodeNear(L, p.x, p.y) });

function setAct(S, p, act, until) {
  p.act = act;
  p.until = until;
  if (WORK_ACTS.has(act)) p.ws = S.t;
  if (act === 'sleep' && !p.zs) p.zs = S.t;
  if (p.in >= 0) seat(S, getLayout(S), p); else p.seat = -1;
}

function start(S, L, p, to, db, act, until, dur) {
  const from = here(L, p);
  p.x = from.x; p.y = from.y;
  p.route = route(L, from, to);
  p.in = -1; p.seat = -1; p.ri = 0; p.db = db; p.dn = to.n; p.na = act; p.nu = until || 0; p.nd = dur || 0; p.act = 'walk';
}

/** Go to a building and do `act` there until a time, or for `dur` minutes after arriving. */
function goB(S, L, p, bid, act, until, dur) {
  if (p.in === bid) return setAct(S, p, act, dur ? S.t + dur : until);
  const b = L.blds[bid];
  const j = b.k === 'stall' ? 2.2 : 0;
  start(S, L, p, { x: b.dx + randRange(S, -j, j), y: b.dy + randRange(S, -j, j), n: b.n }, bid, act, until, dur);
}
const goP = (S, L, p, pt, act, until, dur) => start(S, L, p, pt, -1, act, until, dur);

function arrive(S, L, p) {
  p.route = null;
  if (p.db >= 0 && L.blds[p.db].k !== 'stall') p.in = p.db;
  p.n = p.dn;
  setAct(S, p, p.na, p.nd ? S.t + p.nd : Math.max(p.nu, S.t + 1));
}

function walk(S, L, p) {
  let rem = p.cart ? 62 : p.age < 12 ? 52 : p.age > 62 ? 48 : 66 + (p.id % 9);
  const r = p.route;
  while (rem > 0 && p.ri < r.length) {
    const dx = r[p.ri] - p.x, dy = r[p.ri + 1] - p.y, d = Math.hypot(dx, dy);
    if (d <= rem) { p.x = r[p.ri]; p.y = r[p.ri + 1]; p.ri += 2; rem -= d; } else { p.x += (dx / d) * rem; p.y += (dy / d) * rem; rem = 0; }
  }
  if (p.ri >= r.length) arrive(S, L, p);
}

function pointIn(S, f) {
  const lx = randRange(S, -f.w / 2 + 4, f.w / 2 - 4), ly = randRange(S, -f.d / 2 + 4, f.d / 2 - 4), c = Math.cos(f.a), s = Math.sin(f.a);
  return { x: f.x + lx * c - ly * s, y: f.y + lx * s + ly * c, n: f.n };
}

const WALKS = new WeakMap();
/** Places where townsfolk like to stroll: the square, the lamps of the main streets, the green. */
function walksOf(L, si) {
  let w = WALKS.get(L);
  if (!w) {
    w = L.sites.map((s) => (s.kind === 'city'
      ? L.lamps.filter((q) => Math.hypot(q.x, q.y) < 330).map((q) => ({ x: q.x, y: q.y, n: nodeNear(L, q.x, q.y) }))
      : [{ x: s.green.x, y: s.green.y, n: s.n }]));
    WALKS.set(L, w);
  }
  return w[si];
}

// ---- what an activity leaves behind -----------------------------------------------

function eat(S, p, hh, site) {
  if (!hh) { p.ate = S.t; return; }
  if (hh.pantry >= 1) hh.pantry--;
  else if (!mealOut(S, p.site, hh)) { p.miss++; p.ate = S.t; return; }
  p.ate = S.t;
  if (p.miss) p.miss--;
}

function buy(S, L, p, hh) {
  if (!hh) return;
  buyFood(S, L, p, hh, p.db);
  // nobody goes without two days of meals while the store can spare them;
  // in a famine the store keeps what it has and the poor go hungry
  const site = S.sites[p.site], alms = Math.min(hh.m.length * MEALS * 2 - hh.pantry, Math.floor(site.food));
  if (alms > 0 && foodDays(S, p.site) > 8) { hh.pantry += alms; site.food -= alms; }
  atMarket(S, L, p, hh);
}

function closeQuest(S, L, q, p, won) {
  q.open = false;
  if (!won) return;
  const h = S.herds[q.herd], city = L.sites[0];
  for (const s of S.sites) s.fear = 0;
  if (p) { payReward(S, L, p, q.reward); note(S, p, q.kind === 'wolf' ? 'Struck the last blow against the wolf pack.' : 'Finished a slime cull for the guild.'); }
  log(S, 'quest', q.kind === 'wolf' ? 2 : 1, q.kind === 'wolf'
    ? `The adventurers of ${city.name} destroyed the wolf pack${p ? `; ${fullName(p)} struck the last blow` : ''}.`
    : `The slimes ${q.near} were culled${p ? ` by ${fullName(p)} and companions` : ''}.`, h.x, h.y, p ? p.id : undefined);
}

function questResult(S, L, p) {
  const q = S.quests.find((x) => x.id === p.q), hh = S.households[p.hh];
  p.wild = false;
  if (!q || !q.open) { p.q = -1; return; }
  const h = S.herds[q.herd];
  if (hyp(p.x, p.y, h.x, h.y) > 380) return;
  if (q.kind === 'slime') {
    const n = cull(S, h, randInt(S, 1, 2), p.x, p.y);
    if (hh) payReward(S, L, p, n * 5);
    if (h.n <= 3) closeQuest(S, L, q, p, true);
    return;
  }
  const r = rand(S);
  if (r < 0.45) cull(S, h, 1, p.x, p.y);
  else if (r < 0.6) { wound(S, L, p, 3, 'Wounded fighting the wolves.'); log(S, 'quest', 1, `${fullName(p)} was wounded fighting the wolves.`, p.x, p.y, p.id); } else if (r < 0.625) { die(S, L, p, 'fell fighting the wolves', 2); return; }
  if (h.n <= 1) { cull(S, h, 1); closeQuest(S, L, q, p, true); }
}

function finish(S, L, p) {
  const act = p.act, hh = S.households[p.hh], site = S.sites[p.site], J = jobOf(p);
  if (WORK_ACTS.has(act) && hh) {
    const mins = Math.min(600, S.t - p.ws);
    if (J.w) payWage(S, L, p, (J.w * mins) / 540);
    if (act === 'work') produce(S, L, p, mins);
    if (mishap(S, L, p, act, mins)) return;
  }
  p.act = 'idle';
  switch (act) {
    case 'sleep': {
      // on waking: how short of a night's sleep the person fell
      const P = planOf(S, p, J);
      if (p.zs && !inWin(S.t % DAY, P.bed, P.wake)) { p.debt = Math.round(Math.max(0, Math.min(240, p.debt * 0.5 + P.need - (S.t - p.zs)))); p.zs = 0; }
      break;
    }
    case 'eat': eat(S, p, hh, site); break;
    case 'shop': buy(S, L, p, hh); break;
    case 'buy': buyGoods(S, L, p, hh, p.db); if (hh) atCounter(S, L, p, hh, p.db); break;
    case 'drink': drink(S, L, p, hh, p.in); atTavern(S, L, p, hh, p.in); p.soc = 100; break;
    case 'prowl': prowl(S, L, p); break;
    case 'lodge': lodge(S, p.in); break;
    case 'pray': offer(S, L, p, hh, p.in); p.soc = Math.min(100, p.soc + 35); break;
    case 'stroll': case 'visit': case 'play': p.soc = Math.min(100, p.soc + 35); break;
    case 'fish': site.food += ((S.t - p.ws) / 60) * 9; break;
    case 'chop': site.wood += ((S.t - p.ws) / 60) * 6; p.wild = false; break;
    case 'stalk': {
      const h = S.herds[p.tg];
      p.wild = false;
      if (h && h.n > 0 && hyp(h.x, h.y, p.x, p.y) < 340 && chance(S, 0.4)) {
        cull(S, h, 1, p.x, p.y);
        p.load = BEASTS[h.k].meat;
        log(S, 'wild', 0, `${fullName(p)} took a ${h.k} for the larder of ${L.sites[p.site].name}.`, p.x, p.y, p.id);
        // a cornered boar fights back
        if (h.k === 'boar' && chance(S, 0.12)) {
          if (chance(S, 0.15)) { die(S, L, p, 'was gored by a wild boar', 1, 'boar'); return; }
          wound(S, L, p, randInt(S, 2, 5), 'Gored by a wild boar.');
          log(S, 'wild', 1, `${fullName(p)} was gored by a wild boar while hunting.`, p.x, p.y, p.id);
        }
      }
      break;
    }
    case 'load': {
      const v = S.sites[p.tg];
      const n = v ? Math.min(LOAD, Math.floor(v.food - reserve(S, p.tg))) : 0;
      if (n > 150) { v.food -= n; p.load = n; }
      break;
    }
    case 'unload':
      if (p.job === 'hunter') site.food += p.load;
      else if (p.load > 0 && S.sites[p.to]) {
        S.sites[p.to].food += p.load;
        // the buyer pays what food costs where it was grown, plus the carting
        moveMoney(S.sites[p.to], S.sites[p.tg], p.load * foodPrice(S, p.tg) * 1.15);
        log(S, 'work', p.to === 0 ? 0 : 1, p.to === 0
          ? `A cart with ${p.load} meals of food from ${L.sites[p.tg].name} reached the city granary.`
          : `A relief cart from ${L.sites[0].name} brought ${p.load} meals to hungry ${L.sites[p.to].name}.`, p.x, p.y, p.id);
      }
      p.load = 0;
      break;
    case 'quest': questResult(S, L, p); break;
    case 'trade': {
      // merchants bring food when the city is short and carry its surplus away when it has plenty
      const city = S.sites[0], d = foodDays(S, 0);
      const sold = d < 12 ? p.load : d < 24 ? Math.round(p.load * 0.35) : -Math.min(800, Math.max(0, Math.floor(city.food - city.pop * MEALS * 24)));
      city.food += sold;
      traderDeal(S, L, p, sold);
      p.load = 250;
      break;
    }
    case 'leave': p.away = true; p.until = S.t + randInt(S, 2 * DAY, 6 * DAY); p.in = -1; break;
    default:
  }
}

// ---- trades with their own routines ----------------------------------------------------

function farm(S, L, p, until, m) {
  const mine = L.siteFields[p.site];
  let fi = -1;
  if (p.fi >= 0 && L.fields[p.fi].crop !== 'pasture' && fieldNeeds(S, L, p.fi)) fi = p.fi;
  else {
    let cand = p.farm >= 0 ? mine.filter((id) => L.fields[id].farm === p.farm && fieldNeeds(S, L, id)) : [];
    if (!cand.length) cand = mine.filter((id) => L.fields[id].crop !== 'pasture' && fieldNeeds(S, L, id));
    const ripe = cand.filter((id) => S.fields[id].st === 2);
    if (ripe.length) cand = ripe;
    if (cand.length) fi = cand[randInt(S, 0, cand.length - 1)];
  }
  if (fi >= 0) { p.fi = fi; goP(S, L, p, pointIn(S, L.fields[fi]), 'farm', until); return true; }
  if (m < 12.5 * H) {
    const growing = mine.filter((id) => S.fields[id].st === 1 && (p.farm < 0 || L.fields[id].farm === p.farm));
    if (growing.length && seasonOf(S.t) < 3) { p.fi = growing[randInt(S, 0, growing.length - 1)]; goP(S, L, p, pointIn(S, L.fields[p.fi]), 'tend', until); return true; }
    goB(S, L, p, p.home, 'work', Math.min(until, S.t + 150));
    return true;
  }
  // out of season there is threshing, mending and carting in the barn
  if (m < 15 * H) { goB(S, L, p, L.sites[p.site].granary, 'work', Math.min(until, S.t + 180)); return true; }
  return false;
}

function hunt(S, L, p, m) {
  const LS = L.sites[p.site];
  if (p.load > 0) { goB(S, L, p, LS.granary, 'unload', 0, 6); return true; }
  if (p.hunts >= 1 || m > 13.5 * H) return false;
  const home = L.blds[p.home];
  let best = null, bd = 2400;
  for (const h of S.herds) {
    if (!((h.k === 'deer' && h.n >= 6) || (h.k === 'boar' && h.n >= 4) || (h.k === 'rabbit' && h.n >= 5))) continue;
    const d = hyp(h.x, h.y, home.x, home.y) * (h.k === 'rabbit' ? 1.5 : 1);
    if (d < bd) { bd = d; best = h; }
  }
  if (!best) return false;
  const n = L.nearestNode(best.x, best.y, 1500, (q) => !q.city && !L.riverCross(best.x, best.y, q.x, q.y));
  if (n < 0) return false;
  const th = rand(S) * 6.283;
  p.tg = best.id; p.wild = true; p.hunts++;
  goP(S, L, p, { x: best.x + Math.cos(th) * 70, y: best.y + Math.sin(th) * 70, n }, 'stalk', 0, randInt(S, 25, 60));
  return true;
}

function cart(S, L, p, until, m) {
  const gran = L.sites[0].granary, base = p.site === 0 ? gran : L.sites[p.site].barn;
  if (p.load > 0) { p.cart = true; goB(S, L, p, L.sites[p.to].granary, 'unload', 0, 15); return true; }
  const spare = foodDays(S, 0) > 16, wanted = foodDays(S, 0) < 26; // the city only buys what it needs
  if (p.site === 0) {
    let best = -1, top = LOAD * 0.6, needy = -1;
    for (let i = 1; i < S.sites.length; i++) {
      const sur = S.sites[i].food - reserve(S, i);
      if (sur > top) { top = sur; best = i; }
      if (foodDays(S, i) < 6 && spare) needy = i;
    }
    if (needy > 0 && p.in === base && m < 15 * H) { p.tg = 0; p.to = needy; p.load = LOAD; S.sites[0].food -= LOAD; p.cart = true; goB(S, L, p, L.sites[needy].granary, 'unload', 0, 15); return true; }
    if (best > 0 && wanted && m < 15 * H) { p.cart = true; p.tg = best; p.to = 0; goB(S, L, p, L.sites[best].barn, 'load', 0, 15); return true; }
  } else if (p.in === base && wanted && m < 15.5 * H && S.sites[p.site].food - reserve(S, p.site) > LOAD) {
    S.sites[p.site].food -= LOAD; p.load = LOAD; p.cart = true; p.tg = p.site; p.to = 0;
    goB(S, L, p, gran, 'unload', 0, 15);
    return true;
  }
  p.cart = p.in !== base;
  goB(S, L, p, base, 'work', Math.min(until, S.t + 45));
  return true;
}

function adventure(S, L, p, until, m) {
  const q = S.quests.find((x) => x.open && (x.id === p.q || x.party < x.max));
  if (q && m < 14.5 * H) {
    const h = S.herds[q.herd];
    if (!h || h.n <= 0) closeQuest(S, L, q, null, false);
    else {
      const n = L.nearestNode(h.x, h.y, 1800, (k) => !k.city && !L.riverCross(h.x, h.y, k.x, k.y));
      if (n >= 0) {
        if (p.q !== q.id) { p.q = q.id; q.party++; }
        p.wild = true;
        goP(S, L, p, { x: h.x + randRange(S, -25, 25), y: h.y + randRange(S, -25, 25), n }, 'quest', 0, randInt(S, 40, 80));
        return true;
      }
    }
  }
  goB(S, L, p, L.sites[0].guild, 'train', Math.min(until, S.t + 150));
  return true;
}

function work(S, L, p, J, until, m, day) {
  const LS = L.sites[p.site];
  switch (J.t) {
    case 'in': case 'stall': if (p.work < 0) return false; goB(S, L, p, p.work, 'work', until); return true;
    case 'farm': return farm(S, L, p, until, m);
    case 'labour': {
      if (m < 14 * H && (p.id + day) % 3 !== 0 && L.siteFields[p.site].some((id) => S.fields[id].st === 2)) return farm(S, L, p, until, m);
      // shops only take on a hand they can pay; otherwise there is always work at the stores
      const list = [...LS.shops.filter((b) => !S.biz[b] || (!S.biz[b].closed && S.biz[b].coins > 40)), ...(LS.warehouses || []), LS.granary];
      goB(S, L, p, list[(p.id + day) % list.length], 'work', until);
      return true;
    }
    case 'guard':
      if (p.post >= 0) goP(S, L, p, L.posts[p.post], 'guard', until);
      else goP(S, L, p, L.posts[randInt(S, 0, L.posts.length - 1)], 'patrol', 0, randInt(S, 5, 14));
      return true;
    case 'herd': if (!L.fields[p.fi]) return false; goP(S, L, p, pointIn(S, L.fields[p.fi]), 'herd', Math.min(until, S.t + 120)); return true;
    case 'fish': {
      const spots = L.spots.fish[p.site];
      if (!spots.length) return false;
      goP(S, L, p, spots[(p.id + day) % spots.length], 'fish', until);
      return true;
    }
    case 'wood': {
      const spots = L.spots.wood[p.site];
      if (!spots.length) return false;
      const s = spots[(p.id + day) % spots.length];
      p.wild = true;
      goP(S, L, p, { x: s.x + randRange(S, -15, 15), y: s.y + randRange(S, -15, 15), n: s.n }, 'chop', Math.min(until, S.t + 240));
      return true;
    }
    case 'hunt': return hunt(S, L, p, m);
    case 'cart': return cart(S, L, p, until, m);
    case 'adv': return adventure(S, L, p, until, m);
    default: return false;
  }
}

function leisure(S, L, p, m, day, hh, lim) {
  const LS = L.sites[p.site], t = S.t, rest = day % WEEK === WEEK - 1, age = p.age, home = L.blds[p.home];
  const room = lim - t - 20; // minutes left before bed, keeping time for the walk home
  const fit = (lo, hi) => Math.min(randInt(S, lo, hi), room);
  if (age < 4) return goB(S, L, p, p.home, 'home', Math.min(t + 120, lim));
  if (age < 14) {
    if (!rest && age >= 6 && LS.temple >= 0 && m >= 7.5 * H && m < 11.5 * H) return goB(S, L, p, LS.temple, 'school', nextAt(t, 12 * H));
    if (m > 8 * H && m < 19 * H && room > 40 && chance(S, 0.6)) return goP(S, L, p, { x: home.dx + randRange(S, -9, 9), y: home.dy + randRange(S, -9, 9), n: home.n }, 'play', 0, fit(25, 70));
    return goB(S, L, p, p.home, 'home', Math.min(t + randInt(S, 30, 90), lim));
  }
  if (hh && room > 45 && hh.pantry < hh.m.length * MEALS * 1.4 && m >= 7 * H && m < 19.3 * H && hh.shopT < t) {
    hh.shopT = t + 150;
    // butchers and bakers have more hands than a stall, and more customers
    const fs = openOf(S, shopsOf(L, p.site).food), food = LS.kind === 'city' ? LS.market.concat(fs, fs, fs) : LS.market;
    return goB(S, L, p, pick(S, food), 'shop', 0, randInt(S, 10, 22));
  }
  if (hh && room > 45 && age >= 15 && m >= 8 * H && m < 17 * H && (hh.goodsT || 0) < t && wantsGoods(S, L, hh)) {
    hh.goodsT = t + 300;
    const list = goodsShopsFor(S, L, p.site);
    if (list.length) return goB(S, L, p, pickShop(S, L, hh, list), 'buy', 0, randInt(S, 8, 20));
  }
  const taverns = openOf(S, LS.taverns), sot = drunkard(p);
  const opts = [['home', room < 90 ? 6 : 2.5]];
  if (rest && m >= 7.3 * H && m < 10.3 * H && LS.temple >= 0) opts.push(['pray', 4]);
  if (m >= 17 * H && room > 60 && age >= 16 && hh && (spare(S, L, hh) > 6 || (sot && hh.coins > 4)) && taverns.length) opts.push(['drink', (p.job === 'adventurer' ? 7 : rest ? 3 : p.soc < 50 ? 2.5 : 1.2) * (sot ? 3 : 1)]);
  if (m >= 8 * H && room > 40) { opts.push(['stroll', age > 62 || rest ? 3 : 1.5]); if (p.friends.length && room > 60) opts.push(['visit', 0.8]); }
  let r = rand(S) * opts.reduce((a, o) => a + o[1], 0), what = 'home';
  for (const [k, w] of opts) { if (r < w) { what = k; break; } r -= w; }
  if (what === 'pray') return goB(S, L, p, LS.temple, 'pray', nextAt(t, 10.6 * H));
  if (what === 'drink') return goB(S, L, p, pick(S, taverns), 'drink', 0, fit(50, 140));
  if (what === 'stroll') {
    const sq = LS.kind === 'city' && chance(S, 0.35) ? { x: L.plaza.x, y: L.plaza.y, n: LS.n } : pick(S, walksOf(L, p.site));
    const a = rand(S) * 6.283, rr = (LS.kind === 'city' && sq.n === LS.n ? 22 : 6) * Math.sqrt(rand(S));
    return goP(S, L, p, { x: sq.x + Math.cos(a) * rr, y: sq.y + Math.sin(a) * rr, n: sq.n }, 'stroll', 0, fit(20, 60));
  }
  if (what === 'visit') {
    const f = S.people[pick(S, p.friends)];
    if (f && f.alive && S.occ[f.home] !== undefined) return goB(S, L, p, f.home, 'visit', 0, fit(40, 100));
  }
  return goB(S, L, p, p.home, 'home', Math.min(t + randInt(S, 40, 120), lim));
}

function traderNext(S, L, p, m) {
  const city = L.sites[0];
  if (p.stage === 0) {
    p.stage = 1;
    if (m > 14 * H && openOf(S, city.taverns).length) return goB(S, L, p, pick(S, openOf(S, city.taverns)), 'lodge', nextAt(S.t, 6.5 * H));
  }
  p.stage = 2;
  const ex = L.nodes[pick(S, L.exits)];
  return goP(S, L, p, { x: ex.x, y: ex.y, n: ex.id }, 'leave', 0, 1);
}

function traderArrive(S, L, p) {
  const ex = L.nodes[pick(S, L.exits)], city = L.sites[0];
  Object.assign(p, { away: false, x: ex.x, y: ex.y, in: -1, n: ex.id, cart: true, load: 500 + randInt(S, 0, 400), stage: 0, ate: S.t });
  goB(S, L, p, pick(S, city.warehouses.length ? city.warehouses : [city.granary]), 'trade', 0, randInt(S, 100, 220));
  log(S, 'town', 0, `${fullName(p)}, a travelling merchant, is on the road to ${city.name}.`, ex.x, ex.y, p.id);
}

/** A mother with a baby under a year old wakes once in the night to tend it. */
function nursing(S, p, hh) {
  for (const id of hh.m) { const k = S.people[id]; if (k.mom === p.id && k.age < 1 && k.alive) return true; }
  return false;
}

/** The funeral this person should attend, if one is near. */
function riteOf(S, p, t) {
  for (const r of S.rites) if (t < r.t + 50 && t > r.t - 6 * H && r.ids.includes(p.id)) return r;
  return null;
}

/** Called whenever a person has nothing left to do: choose the next activity. */
function decide(S, L, p) {
  finish(S, L, p);
  if (!p.alive || p.away || p.route) return;
  const t = S.t, m = t % DAY, day = dayOf(t);
  if (p.job === 'trader') return traderNext(S, L, p, m);
  const hh = S.households[p.hh];
  // in the cells: bread and water from the city store
  if (p.jail > t) {
    if (t - p.ate > 300) { p.ate = t; if (p.miss) p.miss--; S.sites[0].food = Math.max(0, S.sites[0].food - 1); }
    return goB(S, L, p, L.sites[0].barracks, 'jail', Math.min(p.jail, t + 240));
  }
  const J = jobOf(p), P = planOf(S, p, J), { s, e, wake, bed } = P, off = p.off;
  if (p.plan && t >= p.plan.at - 30) return goB(S, L, p, p.plan.b, 'prowl', 0, randInt(S, 8, 20));
  if (inWin(m, bed, wake)) {
    const nid = m < 12 * H ? day - 1 : day;
    if (p.in === p.home && p.nn !== nid && p.sex === 'f' && hh && nursing(S, p, hh)) {
      if (p.zs && t - p.zs >= 120) { p.nn = nid; return setAct(S, p, 'nurse', t + randInt(S, 12, 25)); }
      return goB(S, L, p, p.home, 'sleep', Math.min(nextAt(t, wake), t + randInt(S, 150, 270)));
    }
    return goB(S, L, p, p.home, 'sleep', nextAt(t, wake));
  }
  const rite = S.rites.length ? riteOf(S, p, t) : null;
  if (rite && t >= rite.t - 45) return goB(S, L, p, rite.b, 'mourn', rite.t + 70);
  if (p.sick > t) {
    if (p.in === p.home && mealDue(t, P, p.ate)) return setAct(S, p, 'eat', t + 25);
    return goB(S, L, p, p.home, 'sick', Math.min(p.sick, t + 180, nextAt(t, bed)));
  }
  const rest = day % WEEK === WEEK - 1;
  const works = J.t !== 'none' && J.t !== 'home' && (!rest || J.t === 'guard' || p.job === 'innkeeper' || p.job === 'tavern hand');
  const atWork = works && p.hurt <= t && inWin(m, s - 40 + off, e + off);
  if (mealDue(t, P, p.ate)) {
    if (p.in === p.home) return setAct(S, p, 'eat', t + 20);
    if (atWork && p.wd === day) return setAct(S, p, 'eat', t + 20);
    if (!atWork) return goB(S, L, p, p.home, 'eat', 0, 22);
  }
  if (p.hurt > t) return goB(S, L, p, p.home, 'rest', Math.min(p.hurt, t + 180));
  if (atWork) {
    p.wd = day;
    let until = Math.max(t + 10, Math.min(nextAt(t, e + off), nextMeal(t, P)));
    if (rite && rite.t - 45 > t) until = Math.min(until, rite.t - 45);
    if (work(S, L, p, J, until, m, day)) return;
  }
  p.cart = false;
  return leisure(S, L, p, m, day, hh, rite && rite.t - 45 > t ? Math.min(nextAt(t, bed), rite.t - 25) : nextAt(t, bed));
}

// ---- fields, seasons and the common store ------------------------------------------------

function stepFields(S, L) {
  const RATE = { grain: 1 / 21, veg: 1 / 10, orchard: 1 / 19 };
  const year = Math.floor(dayOf(S.t) / YEAR_DAYS);
  for (let i = 0; i < S.fields.length; i++) {
    const F = S.fields[i], f = L.fields[i], site = S.sites[f.site];
    if (F.st === 0) {
      if (F.w >= site.sow * f.area) { F.st = 1; F.w = 0; F.g = 0; S.fv++; }
    } else if (F.st === 1) {
      F.w = 0;
      F.g += RATE[f.crop] / 48;
      if (F.g >= 1) {
        F.st = 2; F.h = 0; F.g = 1; S.fv++;
        site.rp ||= {};
        if (site.rp[f.crop] !== year) {
          site.rp[f.crop] = year;
          log(S, 'work', 1, `${{ grain: 'The grain stands ripe', veg: 'The vegetable plots are ready', orchard: 'The orchards hang heavy' }[f.crop]} around ${L.sites[f.site].name}; the harvest begins.`, f.x, f.y);
        }
      }
    } else if (F.st === 2) {
      const done = Math.min(1, F.w / (site.reap * f.area));
      if (done > F.h) {
        site.food += f.area * S.tune.yield * CROP_K[f.crop] * (done - F.h) * (S.weather ? S.weather.mult[f.site] : 1);
        if (Math.floor(done * 4) > Math.floor(F.h * 4)) S.fv++;
        F.h = done;
      }
      if (done >= 1) { F.st = 3; F.w = 0; S.fv++; }
    }
  }
}

function seasonTurn(S, L, season) {
  let lost = 0;
  if (season === 0) rollYear(S);
  if (season === 1) tellYear(S, L);
  S.fields.forEach((F, i) => {
    const crop = L.fields[i].crop;
    if (crop === 'pasture') return;
    if (season === 0) Object.assign(F, { st: crop === 'orchard' ? 1 : 0, w: 0, g: 0, h: 0 });
    if (season === 3 && (F.st === 1 || F.st === 2)) { if (F.st === 2) lost++; Object.assign(F, { st: 3, w: 0 }); }
  });
  S.fv++;
  tribute(S, L);
  const text = ['Spring has come: the ploughs go out and the sowing begins.', 'Summer has come.', 'Autumn has come: the grain harvest is near.', 'Winter has come; the fields rest under the frost.'][season];
  log(S, 'town', 1, text + (lost ? ` ${lost} unharvested fields were lost to the frost.` : ''), 0, 0);
}

function stepWorld(S, L) {
  const t = S.t, m = t % DAY;
  gallows(S, L);
  if (S.rites.length && S.rites[0].t + 120 < t) S.rites = S.rites.filter((r) => r.t + 120 >= t);
  S.sites.forEach((site, i) => {
    const d = foodDays(S, i), name = L.sites[i].name;
    if (d < 3 && !site.short) { site.short = true; log(S, 'town', 2, `The stores of ${name} are nearly empty: food is dear and families go hungry.`, L.sites[i].x, L.sites[i].y); } else if (d > 8 && site.short) { site.short = false; log(S, 'town', 1, `The granary of ${name} is filling again.`, L.sites[i].x, L.sites[i].y); }
  });
  if (m > 7 * H && m < 13 * H) for (const p of S.people) if (p.away && p.job === 'trader' && t >= p.until) { traderArrive(S, L, p); break; }
  // the guild's notice board
  for (const q of S.quests) if (q.open && t - q.posted > 6 * DAY) q.open = false;
  for (const h of S.herds) {
    if (h.n <= 0 || S.quests.some((q) => q.open && q.herd === h.id)) continue;
    const near = L.sites.reduce((a, s) => (hyp(h.x, h.y, s.x, s.y) < hyp(h.x, h.y, a.x, a.y) ? s : a));
    if (h.k === 'wolf' && S.sites.some((s) => s.fear >= 50)) {
      S.quests.push({ id: ++S.nextQ, kind: 'wolf', herd: h.id, max: 4, party: 0, reward: 120, open: true, posted: t, near: `near ${near.name}` });
      fundQuest(S, L, 120);
      log(S, 'quest', 1, `After the attacks, a bounty on the wolves was posted at the Adventurers' Guild of ${L.sites[0].name}.`, h.x, h.y);
    } else if (h.k === 'slime' && h.n >= 11) {
      S.quests.push({ id: ++S.nextQ, kind: 'slime', herd: h.id, max: 2, party: 0, reward: 30, open: true, posted: t, near: `near ${near.name}` });
      fundQuest(S, L, 30 + 5 * h.n);
      log(S, 'quest', 0, `The guild posted a slime cull near ${near.name}.`, h.x, h.y);
    }
  }
}

// ---- lives ---------------------------------------------------------------------------

function comeOfAge(S, L, p) {
  if (p.job !== 'child') return;
  const farmKid = L.blds[p.home] && L.blds[p.home].k === 'farmhouse';
  p.job = farmKid || (p.site !== 0 && chance(S, 0.6)) ? 'farmer' : 'labourer';
  if (farmKid) p.farm = L.blds[p.home].farm;
  note(S, p, `Came of age and began work as a ${p.job}.`);
}

function birth(S, L, mother, hh) {
  const b = L.blds[hh.home];
  if (chance(S, 0.03)) {
    tally(S, 'misfortune', 'stillbirths');
    note(S, mother, 'Lost a child at birth.');
    log(S, 'life', 0, `The ${S.people[mother.spouse].fam} family of ${L.sites[hh.site].name} lost a child at birth.`, b.x, b.y, mother.id);
    return;
  }
  const baby = makePerson(S, { sp: mother.sp, fam: S.people[mother.spouse].fam, age: 0 });
  Object.assign(baby, { born: dayOf(S.t), hh: hh.id, home: hh.home, site: hh.site, x: b.dx, y: b.dy, in: b.id, n: b.n, mom: mother.id, dad: mother.spouse, ate: S.t, until: S.t + 60 });
  hh.m.push(baby.id);
  seat(S, L, baby);
  S.born++;
  note(S, mother, `Gave birth to ${baby.name}.`);
  log(S, 'life', 0, `A ${baby.sex === 'f' ? 'girl' : 'boy'}, ${baby.name}, was born to the ${baby.fam} family of ${L.sites[hh.site].name}.`, b.x, b.y, baby.id);
  if (chance(S, 0.012)) die(S, L, mother, 'died in childbirth', 1, 'childbirth');
}

function court(S, L, p) {
  const cand = S.people.filter((q) => q.alive && !q.away && q.site === p.site && q.sex !== p.sex && q.spouse < 0 && q.age >= 18 && q.age <= 40
    && Math.abs(q.age - p.age) <= 9 && q.hh !== p.hh && q.fam !== p.fam && q.job !== 'trader');
  if (!cand.length) return;
  const q = pick(S, cand), olds = [S.households[p.hh], S.households[q.hh]];
  p.spouse = q.id; q.spouse = p.id;
  const free = L.blds.filter((b) => b.site === p.site && b.k === 'house' && S.occ[b.id] === undefined);
  let hh;
  if (free.length) {
    const b = pick(S, free);
    hh = { id: S.households.length, home: b.id, site: b.site, m: [], pantry: 12, coins: 0, fam: (p.sex === 'm' ? p : q).fam, shopT: 0, goods: 1, arrears: 0, owed: 0, goodsT: 0 };
    S.households.push(hh);
    // each family gives the young couple what it can spare
    for (const o of olds) moveMoney(o, hh, Math.min(40, o.coins * 0.3));
    S.occ[b.id] = hh.id;
  } else hh = olds[0].m.length <= olds[1].m.length ? olds[0] : olds[1];
  for (const x of [p, q]) {
    if (x.hh === hh.id) continue;
    const old = S.households[x.hh];
    old.m = old.m.filter((id) => id !== x.id);
    x.hh = hh.id; x.home = hh.home;
    hh.m.push(x.id);
    leaveEmpty(S, old);
  }
  for (const x of [p, q]) note(S, x, `Married ${fullName(x === p ? q : p)}.`);
  log(S, 'life', isNotable(p) || isNotable(q) ? 1 : 0, `${fullName(p)} and ${fullName(q)} of ${L.sites[p.site].name} were wed.`, L.blds[hh.home].x, L.blds[hh.home].y, p.id);
}

function newcomers(S, L, si) {
  const free = L.blds.filter((b) => b.site === si && b.k === 'house' && S.occ[b.id] === undefined);
  if (!free.length) return;
  const b = pick(S, free), hh = settle(S, L, b, chance(S, 0.7) ? 'family' : 'couple', pickSpecies(S, si !== 0));
  S.econ.inflow += hh.coins;
  const ex = L.nodes[pick(S, L.exits)];
  hh.m.forEach((id, i) => {
    const p = S.people[id];
    if (p.age >= 15) p.job = i === 1 && hh.m.length > 2 ? 'homemaker' : si !== 0 ? 'farmer' : 'labourer';
    Object.assign(p, { x: ex.x, y: ex.y, in: -1, n: ex.id, ate: S.t });
    note(S, p, `Arrived in ${L.sites[si].name} from far away.`);
    goB(S, L, p, b.id, 'home', 0, 90);
  });
  log(S, 'life', 1, `The ${hh.fam} family arrived by the road and settled in ${L.sites[si].name}.`, b.x, b.y, hh.m[0]);
}

function newDay(S, L) {
  const day = dayOf(S.t), season = seasonOf(S.t);
  if (day % SEASON_DAYS === 0) seasonTurn(S, L, season);
  wildDay(S, L);
  illDay(S, L);
  ruinDay(S, L);
  for (const site of S.sites) { site.fear *= 0.9; site.food *= 0.998; if (season === 3) site.wood = Math.max(0, site.wood - site.pop * 0.25); }
  const n0 = S.people.length;
  for (let i = 0; i < n0; i++) {
    const p = S.people[i];
    if (!p.alive || p.job === 'trader') continue;
    p.hunts = 0;
    p.soc = Math.max(0, p.soc - 12);
    const age = ageOf(S, p);
    if (age !== p.age) {
      p.age = age;
      if (age === 15) comeOfAge(S, L, p);
      if (age === 63 && p.job !== 'lord' && p.job !== 'elder' && p.job !== 'retired') { replaceWorker(S, p); p.job = 'retired'; p.work = -1; note(S, p, 'Retired from work.'); }
    }
    // a hard world: many babies do not live to see five, and the old fade
    const cold = season === 3 && S.sites[p.site].wood <= 0 ? 2 : 1;
    const yearly = (age < 1 ? 0.16 : age < 5 ? 0.03 : age < 15 ? 0.006 : age < 50 ? 0.005 : age < 62 ? 0.016 : age < 72 ? 0.05 : age < 82 ? 0.14 : 0.3) * cold;
    if (chance(S, yearly / YEAR_DAYS)) {
      const [why, kind] = age < 1 ? ['died in the cradle', 'infancy'] : age > 60 ? ['died of old age', 'old age'] : cold > 1 && chance(S, 0.5) ? ['died of the cold', 'cold']
        : [pick(S, ['died of a fever', 'died of a wasting sickness', 'died of a sudden illness', 'died of a wound gone bad']), 'illness'];
      die(S, L, p, why, 0, kind);
      continue;
    }
    // hunger kills slowly: the longer without food, the likelier
    if (p.miss >= 9 && chance(S, Math.min(0.25, (p.miss - 7) * 0.02))) { die(S, L, p, 'starved', 2, 'hunger'); continue; }
    const hh = S.households[p.hh];
    if (p.sex === 'f' && p.spouse >= 0 && age >= 18 && age <= 41 && hh.m.length < 7 && p.miss < 3) {
      const sp = S.people[p.spouse];
      if (sp.alive && sp.hh === p.hh && chance(S, 0.3 / YEAR_DAYS)) birth(S, L, p, hh);
    }
    if (p.spouse < 0 && age >= 18 && age <= 36 && chance(S, 0.5 / YEAR_DAYS)) court(S, L, p);
  }
  for (const hh of S.households) {
    if (!hh.m.length || !hh.m.every((id) => S.people[id].miss >= 8) || !chance(S, 0.3)) continue;
    for (const id of hh.m) { const p = S.people[id]; p.alive = false; p.gone = true; p.route = null; replaceWorker(S, p); note(S, p, 'Left the region to escape hunger.'); }
    log(S, 'town', 2, `Hunger drove the ${hh.fam} family away from ${L.sites[hh.site].name}.`, L.blds[hh.home].x, L.blds[hh.home].y);
    emigrate(S, hh);
    hh.m = [];
    delete S.occ[hh.home];
  }
  census(S);
  econDay(S, L, season);
  if (day % WEEK === 0) { sweepSeats(S); lawWeek(S, L); }
  S.sites.forEach((site, i) => { if (foodDays(S, i) > 14 && chance(S, i === 0 ? 0.12 : 0.04)) newcomers(S, L, i); });
  if (S.quests.length > 40) S.quests = S.quests.filter((q) => q.open);
  planNight(S, L);
  if (day % YEAR_DAYS === 0) log(S, 'town', 2, `Year ${day / YEAR_DAYS + 1} begins. ${S.people.filter((p) => p.alive && p.job !== 'trader').length.toLocaleString('en-US')} people live in the region.`, 0, 0);
}

// ---- the tick --------------------------------------------------------------------------

const folk = [];

/** Advance the world by one minute. The only function that changes it. */
export function step(S) {
  const L = getLayout(S);
  S.t++;
  if (S.t % DAY === 0) newDay(S, L);
  folk.length = 0;
  const n = S.people.length;
  for (let i = 0; i < n; i++) {
    const p = S.people[i];
    if (!p.alive || p.away) continue;
    if (p.route) walk(S, L, p);
    else {
      if (p.act === 'farm' || p.act === 'tend') {
        const F = S.fields[p.fi];
        if (!F || (p.act === 'farm' && F.st !== 0 && F.st !== 2)) p.until = S.t; else F.w++;
      }
      if (S.t >= p.until) decide(S, L, p);
    }
    if (p.wild && p.in < 0) folk.push(p);
  }
  stepWild(S, L, folk);
  if (S.t % 30 === 0) stepFields(S, L);
  if (S.t % 20 === 7) stepWorld(S, L);
  return S;
}

export function run(S, minutes) {
  for (let i = 0; i < minutes; i++) step(S);
  return S;
}

export { SEASONS };
