import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld, run, getLayout, planOf, jobOf, sunOf, moneyTotal, serialize, deserialize, fingerprint, foodPrice, DAY, YEAR_DAYS,
} from '../src/engine/index.js';
import { reviewTrades } from '../src/engine/trades.js';

/** Run a world on to a given day and hour. */
const at = (S, day, hour) => run(S, Math.round(day * DAY + hour * 60) - S.t);
const awake = (p) => p.act !== 'sleep' && !(p.route && p.na === 'sleep');
const share = (list, f) => list.filter(f).length / Math.max(1, list.length);

test('people keep the hours of their trade and of the season', () => {
  const S = createWorld('hours'), L = getLayout(S);
  const alive = () => S.people.filter((p) => p.alive && !p.away && p.job !== 'trader');
  at(S, 3, 23);
  const homes = new Set(L.blds.filter((b) => (b.k === 'house' || b.k === 'farmhouse') && S.occ[b.id] !== undefined).map((b) => b.id));
  const lit = new Set(alive().filter((p) => homes.has(p.in) && p.act !== 'sleep').map((p) => p.in));
  assert.ok(lit.size < homes.size * 0.08, `${lit.size} of ${homes.size} homes still lit at 23:00`);
  const watch = alive().filter((p) => p.job === 'guard' && p.shift === 1);
  assert.ok(share(watch, awake) > 0.8, 'the night watch is awake');
  assert.ok(share(alive().filter((p) => p.job === 'tavern hand' || p.job === 'innkeeper'), awake) > 0.75, 'tavern folk are still up');
  at(S, 4, 4);
  const bakers = alive().filter((p) => p.job === 'baker');
  assert.ok(share(bakers, (p) => (p.route ? p.na : p.act) === 'work' || p.act === 'eat') >= 0.5, 'bakers are up and at the ovens at 04:00');
  assert.ok(share(alive().filter((p) => ['carpenter', 'weaver', 'potter', 'clerk'].includes(p.job)), awake) < 0.1, 'craftsmen still sleep at 04:00');
  at(S, 5, 21.75);
  assert.ok(share(alive().filter((p) => p.job === 'farmer'), (p) => !awake(p)) > 0.85, 'farmers are in bed by 21:45 in spring');
  assert.ok(share(alive().filter((p) => p.age >= 4 && p.age < 12), (p) => !awake(p)) > 0.85, 'children are in bed');
  // winter nights are long and summer nights short
  const summer = { ...S, t: 18 * DAY + 12 * 60 }, winter = { ...S, t: 42 * DAY + 12 * 60 };
  assert.ok(sunOf(summer.t).len - sunOf(winter.t).len > 6, 'midsummer days are far longer than midwinter days');
  const c = alive().find((p) => p.job === 'carpenter' && p.spouse < 0) || alive().find((p) => p.job === 'carpenter');
  const night = (W) => { const P = planOf(W, c, jobOf(c)); return (((P.wake - P.bed) % DAY) + DAY) % DAY; };
  assert.ok(night(winter) > night(summer) + 60, `a carpenter sleeps ${night(winter)} min in winter and ${night(summer)} in summer`);
});

test('a hard world: people die of many causes, some steal and fight, and the law answers', () => {
  const S = createWorld('lives'), start = moneyTotal(S);
  run(S, Math.round(1.5 * YEAR_DAYS) * DAY);
  const sum = {};
  for (const T of [S.tally.prev, S.tally.cur]) for (const g in T || {}) for (const k in T[g]) { sum[g] ||= {}; sum[g][k] = (sum[g][k] || 0) + T[g][k]; }
  const causes = Object.keys(sum.deaths || {});
  assert.ok(causes.length >= 4, `deaths by cause: ${JSON.stringify(sum.deaths)}`);
  assert.ok(causes.includes('infancy') || causes.includes('old age'));
  assert.ok(causes.some((k) => ['accident', 'brawl', 'murder', 'boar', 'wolves', 'hunger', 'childbirth', 'hanged', 'quest'].includes(k)), 'not only sickness and age');
  assert.ok(sum.crimes.pickpocket > 0 && sum.crimes.burglary > 0, `crimes: ${JSON.stringify(sum.crimes)}`);
  assert.ok(sum.justice.caught > 0 && sum.justice.jailed > 0, `the law: ${JSON.stringify(sum.justice)}`);
  assert.ok(Object.keys(sum.abuses || {}).length > 0, 'those in power abuse it now and then');
  assert.ok(sum.vice && sum.vice['games of dice'] > 0, 'some gamble');
  const L = getLayout(S);
  for (const p of S.people) if (p.alive && p.jail > S.t && !p.route && p.act === 'jail') assert.equal(p.in, L.sites[0].barracks, 'prisoners are held in the barracks');
  const alive = S.people.filter((p) => p.alive && !p.away).length;
  assert.ok(alive > 1450 && S.born > 0, `population ${alive}`);
  const expected = start + S.econ.inflow - S.econ.outflow;
  assert.ok(Math.abs(moneyTotal(S) - expected) < 1, `money ${moneyTotal(S).toFixed(1)} but the ledger says ${expected.toFixed(1)}`);
  // and the story continues exactly the same after a save
  const copy = deserialize(serialize(S));
  run(S, 2 * DAY); run(copy, 2 * DAY);
  assert.equal(fingerprint(S), fingerprint(copy));
});

test('a failed harvest brings in far less food, and scarcity makes food dear', () => {
  const good = createWorld('famine'), bad = createWorld('famine');
  bad.weather.mult = bad.weather.mult.map(() => 0.3);
  run(good, 26 * DAY); run(bad, 26 * DAY);
  const food = (S) => S.sites.reduce((a, s) => a + s.food, 0);
  assert.ok(food(bad) < food(good) * 0.85, `food ${food(bad).toFixed(0)} after a failed harvest against ${food(good).toFixed(0)}`);
  const S = createWorld('dear'), city = S.sites[0], base = foodPrice(S, 0);
  city.food = city.pop * 3 * 1.5;
  assert.ok(foodPrice(S, 0) > base * 2.4, `a meal costs ${foodPrice(S, 0)} in a famine against ${base}`);
});

test('trades follow demand: slack shops let hands go, failing ones close, busy ones hire', () => {
  const S = createWorld('trades'), L = getLayout(S);
  const crewOf = (bid) => S.people.filter((p) => p.alive && p.work === bid && p.job !== 'labourer');
  const shops = L.blds.filter((b) => b.k === 'shop' && b.site === 0);
  const crewed = shops.filter((b) => crewOf(b.id).length >= 2);
  const [slack, failing] = crewed, busy = shops.find((b) => b !== slack && b !== failing && crewOf(b.id).length < 4);
  Object.assign(S.biz[slack.id], { coins: 0, avg: 0, bad: 2 });
  const before = crewOf(slack.id).length;
  for (const p of crewOf(failing.id).slice(1)) { p.job = 'labourer'; p.work = -1; }
  Object.assign(S.biz[failing.id], { coins: 5, avg: 0, bad: 6 });
  Object.assign(S.biz[busy.id], { coins: 3000, avg: 900, good: 2 });
  const busyBefore = crewOf(busy.id).length, money = moneyTotal(S);
  reviewTrades(S, L);
  assert.equal(crewOf(slack.id).length, before - 1, 'a slack workshop let one hand go');
  assert.ok(S.biz[failing.id].closed > 0 && crewOf(failing.id).length === 0, 'a failing workshop closed');
  assert.equal(crewOf(busy.id).length, Math.min(4, busyBefore + 1), 'a busy workshop took someone on');
  assert.ok(Math.abs(moneyTotal(S) - money) < 1e-6, 'closing a shop moves coins, it does not destroy them');
});

test('saves from version 0.3 are refused with a clear message', () => {
  const S = createWorld('v3');
  const old = JSON.parse(serialize(S));
  old.version = 3;
  assert.throws(() => deserialize(old), /version 0\.3/);
  const broken = JSON.parse(serialize(S));
  delete broken.law;
  assert.throws(() => deserialize(broken), /timetables, crime or illness/);
});
