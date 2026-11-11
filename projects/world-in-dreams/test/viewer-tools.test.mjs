import test from 'node:test';
import assert from 'node:assert/strict';
import { findPeople, shortcut, createSaveStore, SAVE_KEY, RECOVERY_KEY, validateWorld } from '../src/ui/viewer-tools.js';
import { createWorld, getLayout, SPECIES, serialize, deserialize, step, fingerprint } from '../src/engine/index.js';

const sites = [{ name: 'Árbol' }, { name: 'Riverbank' }];
const nameOf = (p) => p.name;
const people = Array.from({ length: 125 }, (_, id) => ({ id, name: `Person ${String(id).padStart(3, '0')}`, job: 'farmer', sp: 'human', alive: true, site: id % 2, in: id % 3 ? -1 : 4, away: id === 0 }));

test('people search reaches every result, without a hidden 60-person cutoff', () => {
  const ids = [];
  for (let page = 0; page < 4; page++) {
    const result = findPeople(people, sites, nameOf, { page });
    assert.equal(result.total, 125);
    ids.push(...result.list.map((p) => p.id));
  }
  assert.equal(new Set(ids).size, 125);
  assert.equal(ids.length, 125);
});

test('search combines accent-insensitive words, settlement and location filters', () => {
  const result = findPeople(people, sites, nameOf, { query: 'arbol HUMAN farmer', site: '0', status: 'outdoors', size: 200 });
  assert.ok(result.total > 0);
  assert.ok(result.list.every((p) => p.site === 0 && p.in < 0 && !p.away));
  assert.deepEqual(findPeople(people, sites, nameOf, { status: 'away' }).list.map((p) => p.id), [0]);
  assert.equal(findPeople(people, sites, nameOf, { query: 'nothing', page: 9 }).page, 0);
  assert.equal(findPeople(people, sites, nameOf, { page: 99 }).page, 3);
  const original = people.map((p) => p.id);
  findPeople(people, sites, nameOf);
  assert.deepEqual(people.map((p) => p.id), original);
});

test('shortcuts respect typing, native buttons, modifiers and key repeat', () => {
  const e = (key, rest = {}) => ({ key, code: key === ' ' ? 'Space' : '', target: { closest: () => null }, ...rest });
  assert.equal(shortcut(e('.')), 'step');
  assert.equal(shortcut(e('s', { ctrlKey: true })), 'save');
  assert.equal(shortcut(e('r', { ctrlKey: true })), null);
  assert.equal(shortcut(e('f', { target: { isContentEditable: true } })), null);
  for (const tag of ['input', 'textarea', 'select', 'dialog']) {
    assert.equal(shortcut(e('c', { target: { closest: (s) => s.includes(tag) ? {} : null } })), null);
  }
  assert.equal(shortcut(e(' ', { target: { closest: (s) => s.includes('button') ? {} : null } })), null);
  assert.equal(shortcut(e('f', { repeat: true })), null);
  assert.equal(shortcut(e('ArrowRight', { repeat: true })), 'right');
  assert.equal(shortcut(e('6')), 'speed:6');
  assert.equal(shortcut(e('/', { isComposing: true })), null);
});

test('automatic recovery cannot overwrite the manual checkpoint', () => {
  const data = new Map(), storage = { setItem: (k, v) => data.set(k, v), getItem: (k) => data.get(k) ?? null };
  const store = createSaveStore(() => storage);
  const world = { seedText: 'test', t: 30 };
  store.save('manual checkpoint');
  store.backup(world, 123);
  world.t = 100;
  assert.equal(data.get(SAVE_KEY), 'manual checkpoint');
  assert.deepEqual(store.recover(), { savedAt: 123, world: { seedText: 'test', t: 30 } });
  assert.ok(data.has(RECOVERY_KEY));
  data.set(RECOVERY_KEY, '{}');
  assert.throws(() => store.recover(), /unreadable/);
  const denied = createSaveStore(() => { throw new Error('blocked'); });
  assert.throws(() => denied.save('a'), /blocked/);
  assert.throws(() => denied.load(), /blocked/);
  assert.throws(() => denied.backup(world), /blocked/);
});

test('current engine saves validate without changing their deterministic continuation', () => {
  const world = createWorld('qol-roundtrip'), layout = getLayout(world);
  const before = fingerprint(world);
  validateWorld(world, layout, SPECIES);
  assert.equal(fingerprint(world), before);
  const copy = deserialize(serialize(world));
  validateWorld(copy, layout, SPECIES);
  step(world); step(copy);
  assert.equal(fingerprint(world), fingerprint(copy));
  const damaged = deserialize(serialize(world));
  damaged.people[0].home = 999999;
  assert.throws(() => validateWorld(damaged, layout, SPECIES), /damaged/);
  damaged.people[0].home = world.people[0].home;
  damaged.fields.pop();
  assert.throws(() => validateWorld(damaged, layout, SPECIES), /damaged/);
  assert.equal(fingerprint(copy), fingerprint(world));
});
