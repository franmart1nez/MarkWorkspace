import test from 'node:test';
import assert from 'node:assert/strict';
import { fitRegion, constrainCamera, personScale, createHistory, chronicleQuery, createAdvance, targetMinute, createAlerts } from '../src/ui/observer-tools.js';
import { findPeople } from '../src/ui/viewer-tools.js';
import { createWorld, step, fingerprint, DAY, SEASON_DAYS } from '../src/engine/index.js';

test('region framing fits every edge at wide, narrow and high-DPI sizes', () => {
  const L = { X0: -2600, X1: 2600, Y0: -1800, Y1: 1800, W: 5200, H: 3600 };
  for (const [w, h, dpr] of [[1400, 700, 1], [390, 240, 1], [768, 900, 2]]) {
    const v = fitRegion(L, w, h); constrainCamera(v, L, w, h, dpr);
    assert.ok(v.x - w / (2 * v.s) <= L.X0); assert.ok(v.x + w / (2 * v.s) >= L.X1);
    assert.ok(v.y - h / (2 * v.s) <= L.Y0); assert.ok(v.y + h / (2 * v.s) >= L.Y1);
    v.x = Infinity; v.y = -Infinity; v.s = NaN; constrainCamera(v, L, w, h, dpr);
    assert.ok([v.x, v.y, v.s].every(Number.isFinite));
  }
  assert.ok(personScale(0.8, 1, false, 1.6) > 0.8);
  assert.equal(personScale(6, 1, false, 1.6), 6);
  assert.equal(personScale(6, 1, true, 1), 6 * 0.62);
});

test('observation history returns exact search/camera state and discards abandoned forward branches', () => {
  const h = createHistory(), a = { tab: 'people', query: 'farmer', scroll: 180, view: { x: 12, s: 2 } }, b = { tab: 'inspect', sel: 7 }, c = { tab: 'inspect', sel: 9 };
  h.reset(a); h.visit(a, b); h.visit(b, c);
  assert.deepEqual(h.move(-1, c), b); assert.deepEqual(h.move(-1, b), a);
  assert.ok(h.forward); h.visit(a, { tab: 'region' }); assert.equal(h.forward, false);
  const back = h.move(-1, { tab: 'region' }); back.view.x = 999;
  assert.equal(h.move(1, a).tab, 'region'); assert.equal(h.move(-1, { tab: 'region' }).view.x, 12);
});

test('deceased and departed inhabitants remain discoverable without becoming living outdoor results', () => {
  const people = [{ id: 0, name: 'A', alive: true, in: -1 }, { id: 1, name: 'B', alive: false, gone: false, in: -1 }, { id: 2, name: 'C', alive: false, gone: true, in: -1 }];
  const query = (options) => findPeople(people, [], (p) => p.name, options).list.map((p) => p.id);
  assert.deepEqual(query({ life: 'dead' }), [1]); assert.deepEqual(query({ life: 'gone' }), [2]);
  assert.deepEqual(query({ life: 'all' }), [0, 1, 2]); assert.deepEqual(query({ life: 'all', status: 'outdoors' }), [0]);
});

test('chronicle queries combine primary subject, dates, text, importance and paging over retained events', () => {
  const events = Array.from({ length: 220 }, (_, n) => ({ n, t: n * DAY, who: n % 2, imp: n % 4, type: 'life', text: 'A recorded event' }));
  const all = chronicleQuery(events, { min: 0 }); assert.equal(all.total, 220); assert.equal(all.list.length, 150);
  const result = chronicleQuery(events, { query: 'recorded event', people: [0], from: '11', to: '41', min: 2, types: { life: true }, limit: 300 });
  assert.ok(result.total > 0); assert.ok(result.list.every((e) => e.who === 0 && e.t >= 10 * DAY && e.t <= 40 * DAY && e.imp >= 2));
  assert.equal(chronicleQuery(events, { people: [] }).total, 0);
  assert.equal(chronicleQuery(events, { limit: 300 }).list.length, 220);
});

test('batched advance uses every real minute, is deterministic and cancels at the current minute', () => {
  const a = createWorld('qol-advance'), b = structuredClone(a); let wall = 0;
  const runner = createAdvance({ time: () => a.t, step: () => step(a), now: () => wall++ });
  const target = a.t + 180; runner.start(target);
  while (runner.batch(3)) { /* Yield between small batches. */ }
  for (let i = 0; i < 180; i++) step(b);
  assert.equal(a.t, target); assert.equal(fingerprint(a), fingerprint(b));
  runner.start(a.t + 200); runner.batch(2); runner.cancel(); const stopped = a.t;
  assert.equal(runner.batch(), false); assert.equal(a.t, stopped);
  const interrupted = createAdvance({ time: () => a.t, step: () => { step(a); return false; } });
  interrupted.start(a.t + 100); interrupted.batch(); assert.equal(a.t, stopped + 1); assert.equal(interrupted.active, false);
});

test('advance targets respect game days, morning boundaries and seasons', () => {
  assert.equal(targetMinute(5 * 60, 'morning', DAY, SEASON_DAYS * DAY), 7 * 60);
  assert.equal(targetMinute(7 * 60, 'morning', DAY, SEASON_DAYS * DAY), DAY + 7 * 60);
  assert.equal(targetMinute(SEASON_DAYS * DAY, 'season', DAY, SEASON_DAYS * DAY), 2 * SEASON_DAYS * DAY);
  assert.equal(targetMinute(300, 'custom', DAY, SEASON_DAYS * DAY, 2, '03:15'), DAY + 195);
  assert.throws(() => targetMinute(300, 'custom', DAY, SEASON_DAYS * DAY, 1, '04:00'));
  assert.throws(() => targetMinute(300, 'custom', DAY, SEASON_DAYS * DAY, 2, '25:00'));
});

test('alerts observe fresh transitions once and do not invent causes or replay older events', () => {
  const S = { t: 100, people: [{ alive: true, hurt: 0 }], sites: [{ short: false }], events: [{ n: 1, who: 0, imp: 2, text: 'Old event' }], eventCount: 1 };
  const alerts = createAlerts(), ids = new Set([0]), options = { lives: true, food: true, events: true };
  alerts.reset(S); assert.deepEqual(alerts.poll(S, ids, options), []);
  S.people[0].hurt = 300; S.sites[0].short = true; S.t++;
  assert.deepEqual(alerts.poll(S, ids, options).map((a) => a.text), ['Was injured', 'Food shortage']);
  assert.deepEqual(alerts.poll(S, ids, options), []);
  S.people[0].alive = false; S.people[0].gone = true; S.eventCount = 2; S.events.push({ n: 2, who: 0, imp: 1, text: 'Recorded cause', t: S.t });
  assert.deepEqual(alerts.poll(S, ids, options).map((a) => a.text), ['Left the region', 'Recorded cause']);
  alerts.reset(S); assert.deepEqual(alerts.poll(S, ids, options), []);
});
