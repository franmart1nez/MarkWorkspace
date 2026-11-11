import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, run, step, serialize, deserialize, fingerprint, SPECIES, attitude, YEAR } from '../src/engine/index.js';

test('the same seed produces the same history', () => {
  const a = run(createWorld('determinism'), 2 * YEAR);
  const b = run(createWorld('determinism'), 2 * YEAR);
  assert.equal(fingerprint(a), fingerprint(b));
  const c = run(createWorld('another seed'), 2 * YEAR);
  assert.notEqual(fingerprint(a), fingerprint(c));
});

test('a saved world continues exactly like the original', () => {
  const a = run(createWorld('save-load'), 400);
  const b = deserialize(serialize(a));
  run(a, 400);
  run(b, 400);
  assert.equal(fingerprint(a), fingerprint(b));
});

test('every species of the design document lives in a new world', () => {
  assert.equal(SPECIES.length, 33);
  for (const seed of ['alpha', 'beta', 'gamma', 'delta']) {
    const w = createWorld(seed);
    const present = new Set(w.sites.flatMap((s) => [s.species, ...Object.keys(s.pops)]));
    for (const sp of SPECIES) assert.ok(present.has(sp.id), `${sp.id} missing in seed ${seed}`);
  }
});

test('every site is reachable over the route graph', () => {
  const w = createWorld('roads');
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) {
    const u = stack.pop();
    for (const e of w.edges) {
      const v = e.a === u ? e.b : e.b === u ? e.a : -1;
      if (v >= 0 && !seen.has(v)) { seen.add(v); stack.push(v); }
    }
  }
  assert.equal(seen.size, w.sites.length);
});

test('attitudes are symmetric and bounded', () => {
  for (const a of SPECIES) for (const b of SPECIES) {
    const v = attitude(a.id, b.id);
    assert.equal(v, attitude(b.id, a.id));
    assert.ok(v >= -100 && v <= 100);
  }
  assert.ok(attitude('kobold', 'dragon') > 50);
  assert.ok(attitude('angel', 'demon') < -80);
});

test('twenty years keep the state sane and serializable', () => {
  for (const seed of ['sanity-1', 'sanity-2']) {
    const w = createWorld(seed);
    for (let d = 0; d < 20 * YEAR; d++) {
      step(w);
      if (d % 90) continue;
      for (const s of w.sites) {
        for (const k of ['pop', 'food', 'wealth', 'unrest', 'safety', 'garrison', 'damage', 'threat']) {
          assert.ok(Number.isFinite(s[k]) && s[k] >= 0, `${seed} day ${w.day}: ${s.name}.${k} = ${s[k]}`);
        }
        assert.ok(s.unrest <= 100 && s.safety <= 100 && s.damage <= 100);
        if (s.mode === 'civil') assert.ok(w.factions[s.faction]?.alive, `${s.name} belongs to a dead faction`);
      }
      for (const p of w.parties) assert.ok(Number.isFinite(p.size) && p.path.length > 0);
    }
    assert.ok(w.sites.some((s) => s.mode === 'civil'), 'civilization survives');
    assert.deepEqual(JSON.parse(serialize(w)), JSON.parse(JSON.stringify(w)));
    assert.ok(!serialize(w).includes('null,null,null'), 'no NaN/Infinity leaked into the save');
  }
});
