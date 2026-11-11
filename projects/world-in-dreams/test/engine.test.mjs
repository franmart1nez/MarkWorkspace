import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, run, step, serialize, deserialize, fingerprint, getLayout, foodDays, DAY, SEASON_DAYS, YEAR_DAYS } from '../src/engine/index.js';
import { segSeg } from '../src/engine/geom.js';

test('the same seed produces the same region and history', () => {
  const a = run(createWorld('determinism'), 2 * DAY);
  const b = run(createWorld('determinism'), 2 * DAY);
  assert.equal(fingerprint(a), fingerprint(b));
  const c = run(createWorld('another seed'), 2 * DAY);
  assert.notEqual(fingerprint(a), fingerprint(c));
});

test('a saved world continues exactly like the original', () => {
  const a = run(createWorld('save-load'), DAY + 300);
  const b = deserialize(serialize(a));
  run(a, 900);
  run(b, 900);
  assert.equal(fingerprint(a), fingerprint(b));
});

test('the region is one city with villages, free of a tile grid', () => {
  for (const seed of ['alpha', 'beta', 'gamma']) {
    const L = getLayout(createWorld(seed));
    assert.equal(L.sites.filter((s) => s.kind === 'city').length, 1);
    assert.ok(L.sites.filter((s) => s.kind === 'village').length >= 4);
    assert.ok(L.blds.filter((b) => b.site === 0).length > 350, 'the city is large');
    // buildings are placed at free angles and positions, not on a lattice
    const angles = new Set(L.blds.map((b) => Math.round((((b.a % Math.PI) + Math.PI) % Math.PI) * 20)));
    assert.ok(angles.size > 30, 'buildings face many directions');
    assert.ok(L.blds.some((b) => Math.abs(b.x - Math.round(b.x)) > 0.01), 'positions are continuous');
    for (const name of ['townhall', 'guild', 'temple', 'granary', 'keep']) assert.ok(L.blds[L.sites[0][name]], `city has a ${name}`);
  }
});

test('roads cross the river only on bridges', () => {
  const L = getLayout(createWorld('bridges'));
  for (const e of L.edges) {
    if (e.bridge) continue;
    const A = L.nodes[e.a], B = L.nodes[e.b];
    for (let i = 0; i + 1 < L.river.length; i++) {
      const [ax, ay] = L.river[i], [bx, by] = L.river[i + 1];
      assert.equal(segSeg(A.x, A.y, B.x, B.y, ax, ay, bx, by), -1, `edge ${e.a}-${e.b} crosses the river`);
    }
  }
  assert.ok(L.bridges.length >= 3);
});

test('every building can be reached on foot from the market square', () => {
  const L = getLayout(createWorld('roads'));
  const seen = new Set([L.sites[0].n]), stack = [L.sites[0].n];
  while (stack.length) for (const { to } of L.adj[stack.pop()]) if (!seen.has(to)) { seen.add(to); stack.push(to); }
  for (const b of L.blds) assert.ok(seen.has(b.n), `${b.k} ${b.id} is cut off`);
  for (const s of L.sites) assert.ok(seen.has(s.n), `${s.name} is cut off`);
});

test('people keep a daily rhythm: asleep at night, out by day', () => {
  const S = createWorld('rhythm');
  run(S, DAY - (S.t % DAY) + 3 * 60); // 03:00 on day 2
  const alive = S.people.filter((p) => p.alive && !p.away);
  const asleep = alive.filter((p) => p.act === 'sleep' || p.na === 'sleep').length;
  assert.ok(asleep / alive.length > 0.8, `only ${asleep} of ${alive.length} asleep at 03:00`);
  run(S, 8 * 60); // 11:00
  const working = alive.filter((p) => p.alive && p.age >= 16 && p.age < 60 && ['farm', 'tend', 'work', 'guard', 'patrol', 'fish', 'chop', 'herd', 'train', 'stalk', 'quest', 'load', 'unload'].includes(p.route ? p.na : p.act)).length;
  const adults = alive.filter((p) => p.age >= 16 && p.age < 60).length;
  assert.ok(working / adults > 0.45, `only ${working} of ${adults} adults working at 11:00`);
  assert.ok(alive.filter((p) => p.route).length > 20, 'people walk the streets');
});

test('a full year: fields are sown and harvested, nobody starves en masse', () => {
  const S = createWorld('harvest');
  let sown = false, ripe = false;
  for (let d = 0; d < YEAR_DAYS + 1; d++) {
    run(S, DAY);
    if (S.fields.some((F) => F.st === 1)) sown = true;
    if (S.fields.some((F) => F.st === 2)) ripe = true;
    if (d === SEASON_DAYS * 3 + 1) assert.ok(S.fields.every((F, i) => getLayout(S).fields[i].crop === 'pasture' || F.st === 3), 'winter leaves stubble');
  }
  assert.ok(sown && ripe);
  const start = 1700, alive = S.people.filter((p) => p.alive && p.job !== 'trader').length;
  assert.ok(alive > start * 0.9, `population fell to ${alive}`);
  for (let i = 0; i < S.sites.length; i++) assert.ok(foodDays(S, i) > 3, `${getLayout(S).sites[i].name} has run out of food`);
  assert.ok(S.events.some((e) => /harvest begins/.test(e.text)));
});

test('state stays sane and serializable', () => {
  const S = createWorld('sanity');
  for (let i = 0; i < 6; i++) {
    run(S, DAY);
    for (const p of S.people) {
      if (!p.alive || p.away) continue;
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${p.name} is nowhere`);
      assert.ok(Math.abs(p.x) < 3000 && Math.abs(p.y) < 2200, `${p.name} left the map`);
    }
    for (const a of S.animals) assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y));
    for (const s of S.sites) assert.ok(Number.isFinite(s.food) && s.food >= 0);
  }
  step(S);
  assert.deepEqual(JSON.parse(serialize(S)), JSON.parse(JSON.stringify(S)));
  assert.ok(!serialize(S).includes('null,null'), 'no NaN leaked into the save');
});
