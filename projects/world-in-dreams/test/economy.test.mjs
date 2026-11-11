import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld, run, serialize, deserialize, fingerprint, getLayout, interiorOf, toWorld, moneyTotal, economySummary, rentOf, ownerOf, DAY, WEEK, YEAR_DAYS,
} from '../src/engine/index.js';
import { inRect } from '../src/engine/geom.js';

const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;

test('every coin is accounted for: no wage is paid out of nothing', () => {
  const S = createWorld('ledger');
  const start = moneyTotal(S);
  run(S, 3 * WEEK * DAY);
  const expected = start + S.econ.inflow - S.econ.outflow;
  assert.ok(near(moneyTotal(S), expected, 1), `money ${moneyTotal(S).toFixed(1)} but the ledger says ${expected.toFixed(1)}`);
  assert.ok(S.econ.last.wages > 0 && S.econ.last.rent > 0 && S.econ.last.tax > 0 && S.econ.last.food > 0, 'wages, rents, taxes and food sales all flow');
  for (const h of S.households) assert.ok(h.coins >= -1e-6, `household ${h.id} is in debt`);
  for (const s of S.sites) assert.ok(s.coins >= -1e-6 && s.price > 0, 'treasuries never go below zero');
  for (const k in S.biz) assert.ok(S.biz[k].coins >= -1e-6 && S.biz[k].stock >= 0, `business ${k} is negative`);
});

test('money stays bounded and the poorest are not left at zero over two years', () => {
  const S = createWorld('bounded');
  const perHead0 = moneyTotal(S) / S.people.filter((p) => p.alive && !p.away).length;
  run(S, 2 * YEAR_DAYS * DAY);
  const alive = S.people.filter((p) => p.alive && !p.away).length;
  const perHead = moneyTotal(S) / alive;
  assert.ok(perHead < perHead0 * 1.6, `money per head grew from ${perHead0.toFixed(0)} to ${perHead.toFixed(0)}`);
  const e = economySummary(S, getLayout(S));
  assert.ok(e.p10 > 0, 'the poorest tenth of households still have some coins');
  assert.ok(e.p90 > e.p50 && e.p50 > e.p10, 'wealth is unequal, as it should be');
  assert.ok(e.food.every((f) => f > 0.1 && f < 3), `meal prices stay sensible: ${e.food.join(', ')}`);
  assert.ok(alive > 1600, `population fell to ${alive}`);
});

test('houses are owned or rented, and tenants pay their landlords', () => {
  const S = createWorld('landlords');
  const L = getLayout(S);
  const homes = S.households.filter((h) => h.m.length && h.id !== S.lord);
  const owned = homes.filter((h) => ownerOf(S, h.home) === h.id).length;
  assert.ok(owned > homes.length * 0.25 && owned < homes.length * 0.8, `${owned} of ${homes.length} own their home`);
  const tenants = homes.filter((h) => ownerOf(S, h.home) !== h.id);
  const due = tenants.reduce((a, h) => a + rentOf(L, L.blds[h.home]), 0);
  run(S, WEEK * DAY - (S.t % DAY) + 1); // just past the first rent day
  const paid = S.econ.last.rent;
  assert.ok(paid > due * 0.7 && paid <= due + 1, `tenants paid ${paid.toFixed(0)} of ${due} coins of rent`);
});

test('interiors: every building but the stalls has rooms, furniture and spots inside its walls', () => {
  const L = getLayout(createWorld('rooms'));
  for (const b of L.blds) {
    const I = interiorOf(L, b);
    if (b.k === 'stall') { assert.equal(I, null); continue; }
    assert.ok(I.rooms.length >= 1 && I.items.length >= 1 && I.spots.length >= 1, `${b.k} ${b.id} is empty`);
    for (const sp of I.spots) { const [x, y] = toWorld(b, sp.x, sp.y); assert.ok(inRect(x, y, b, -0.05), `${b.k} ${b.id}: a spot sits in the wall`); }
    if (b.k === 'house' || b.k === 'farmhouse') assert.ok(I.count.bed >= 2 && I.count.seat >= 2, `house ${b.id} has nowhere to sleep or sit`);
    if (b.k === 'temple' || b.k === 'chapel') assert.ok(I.count.pew >= 10);
    if (b.k === 'tavern') assert.ok(I.count.seat >= 8 && I.count.bed >= 1);
  }
});

test('people indoors sit, sleep and work at their own spots, and keep them across a save', () => {
  const S = createWorld('seated');
  const L = getLayout(S);
  run(S, DAY - (S.t % DAY) + 2 * 60); // 02:00 on day 2
  const inside = S.people.filter((p) => p.alive && !p.away && p.in >= 0 && !p.route);
  assert.ok(inside.length > 1000);
  const seated = inside.filter((p) => p.seat >= 0);
  assert.ok(seated.length / inside.length > 0.85, `only ${seated.length} of ${inside.length} have a spot`);
  for (const p of inside) assert.ok(inRect(p.x, p.y, L.blds[p.in], 0.05), `${p.name} stands outside the walls of ${L.blds[p.in].k}`);
  const asleep = seated.filter((p) => p.act === 'sleep');
  assert.ok(asleep.filter((p) => interiorOf(L, L.blds[p.in]).spots[p.seat].k === 'bed').length / asleep.length > 0.8, 'sleepers lie in beds');
  const taken = new Set();
  for (const p of seated) { const key = `${p.in}:${p.seat}`; assert.ok(!taken.has(key), `two people share spot ${key}`); taken.add(key); }
  const copy = deserialize(serialize(S));
  run(S, 600); run(copy, 600);
  assert.equal(fingerprint(S), fingerprint(copy));
});

test('old or damaged saves are refused with a clear message', () => {
  const S = createWorld('refuse');
  const old = JSON.parse(serialize(S));
  old.version = 2;
  assert.throws(() => deserialize(old), /version 0\.2/);
  const broken = JSON.parse(serialize(S));
  delete broken.biz;
  assert.throws(() => deserialize(broken), /economy or interiors/);
});
