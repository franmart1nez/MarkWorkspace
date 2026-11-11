// Optional integration review. Requires the workspace root's Playwright dev dependency.
// Run with the local game server running: node test/viewer-browser.mjs
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprint, getLayout } from '../src/engine/index.js';

const output = resolve(fileURLToPath(new URL('../../../.cache/wid-qol-review/', import.meta.url)));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, acceptDownloads: true });
const page = await context.newPage(), errors = [], checks = [];
page.on('pageerror', (e) => errors.push(e.message));
const base = 'http://localhost:5179/';
async function check(name, fn) { await fn(); checks.push(name); console.log('PASS', name); }
async function exportWorld() {
  const ready = page.waitForEvent('download'); await page.locator('#export').click();
  const download = await ready, path = resolve(output, 'test-world.json'); await download.saveAs(path);
  return JSON.parse(await readFile(path, 'utf8'));
}
async function settle() { await page.waitForFunction(() => window.__ready === true); }
try {
  await page.goto(`${base}?seed=qol-review&minutes=420&speed=0`); await settle();
  await check('boot, controls help and focus', async () => {
    assert.equal(await page.title(), 'World in Dreams');
    await page.locator('[data-tool=help]').click(); assert.ok(await page.locator('#viewer-dialog').isVisible());
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    assert.equal(await page.locator('#play-state').innerText(), 'Paused');
  });
  await check('search, household pins and inspector history restore context', async () => {
    await page.keyboard.press('/'); await page.locator('#find').fill('farmer');
    await page.locator('[data-search=next]').click();
    const person = page.locator('#found .go').first(); const name = await person.innerText();
    await person.click(); await page.locator('#pinSelection').click(); await page.locator('#pinHousehold').click();
    await page.locator('#inspectBack').click(); assert.equal(await page.locator('#find').inputValue(), 'farmer');
    assert.match(await page.locator('.pagination').innerText(), /Page 2/);
    await page.locator('#inspectForward').click(); assert.equal(await page.locator('#panel h2').innerText(), name);
    assert.equal(await page.locator('#pin-count').innerText(), '2');
    await page.locator('[data-tab=people]').click(); await page.locator('#find-life').selectOption('dead');
    assert.equal(await page.locator('#find-status').inputValue(), '');
  });
  await check('roof modes, selected building and saved preferences', async () => {
    await page.locator('#inspectBack').click();
    const home = page.locator('#panel [data-go^="bld:"]').first(); await home.click();
    await page.locator('[data-act=outside]').click(); assert.equal(await page.locator('#roof-mode').inputValue(), 'closed');
    await page.locator('[data-act=inside]').click(); assert.equal(await page.locator('#roof-mode').inputValue(), 'selected');
    const value = await page.evaluate(() => JSON.parse(localStorage.getItem('world-in-dreams:observer:v1')).roofs); assert.equal(value, 'selected');
  });
  await check('true region fit and stable sidebar camera', async () => {
    await page.locator('#viewRegion').click(); await page.locator('#save').click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('world-in-dreams:manual-view:v1')));
    const S = await exportWorld(), L = getLayout(S), rect = await page.locator('#map').boundingBox();
    const v = saved.view.view;
    assert.ok(rect.width / v.s >= L.W); assert.ok(rect.height / v.s >= L.H);
    await page.locator('#toggleSide').click(); await page.locator('#save').click();
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('world-in-dreams:manual-view:v1')).view.view);
    assert.equal(after.x, v.x); assert.equal(after.y, v.y);
    await page.locator('#toggleSide').click();
  });
  await check('advance reaches exact minute and the same deterministic world', async () => {
    const before = await exportWorld();
    const expected = await page.evaluate(async (world) => {
      const { step, fingerprint } = await import('/src/engine/index.js');
      for (let i = 0; i < 7; i++) step(world);
      return fingerprint(world);
    }, before);
    await page.locator('[data-tool=advance]').click();
    const target = before.t + 7, hour = Math.floor((target % 1440) / 60), minute = target % 60;
    await page.locator('#advanceDay').fill(String(Math.floor(target / 1440) + 1));
    await page.locator('#advanceClock').fill(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    await page.locator('#advanceCustom').click();
    await page.waitForFunction(() => document.getElementById('advance-state').hidden && !document.querySelector('dialog[open]'));
    const after = await exportWorld();
    assert.equal(after.t, before.t + 7); assert.equal(fingerprint(after), expected); assert.match(await page.locator('#play-state').innerText(), /Paused/);
    await page.locator('[data-tool=advance]').click(); await page.locator('#advanceSeason').click();
    await page.locator('#cancelAdvance').click(); assert.ok(await page.locator('#advance-state').isHidden());
  });
  await check('named checkpoint restores its view and malformed slot preserves current world', async () => {
    await page.locator('#save').click(); const before = await exportWorld();
    await page.locator('[data-tool=checkpoints]').click();
    await page.locator('[data-slot-name=slot1]').fill('Observation checkpoint'); await page.locator('[data-slot-save=slot1]').click();
    await page.waitForFunction(() => document.querySelector('[data-slot-load=slot1]')?.disabled === false);
    await page.locator('#closeObserver').click(); await page.locator('[data-tool=step]').click();
    await page.locator('[data-tool=checkpoints]').click(); await page.locator('[data-slot-load=slot1]').click();
    await page.locator('#viewer-dialog button').filter({ hasText: 'Continue without saving' }).click();
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    assert.equal(fingerprint(await exportWorld()), fingerprint(before));
    await page.evaluate(async () => {
      const { createCheckpointStore } = await import('/src/ui/checkpoint-store.js');
      const db = createCheckpointStore(); const record = await db.get('slot1'); record.world.people[0].home = 999999; await db.put('slot2', record);
    });
    await page.locator('[data-tool=checkpoints]').click(); await page.locator('[data-slot-load=slot2]').click();
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    assert.equal(fingerprint(await exportWorld()), fingerprint(before));
  });
  await check('chronicle filters, comfort settings and no browser-wide hotkeys while editing', async () => {
    await page.locator('#chronicle-controls summary').click(); await page.locator('#chron-query').fill('never matches this phrase');
    assert.match(await page.locator('#events').innerText(), /No events/);
    await page.locator('#chron-query').fill('');
    await page.locator('[data-tool=preferences]').click();
    await page.locator('[data-setting=reduced]').check(); await page.locator('[data-setting=pauseHidden]').check();
    await page.locator('[data-setting=text]').fill('15'); await page.locator('#closeObserver').click();
    assert.ok(await page.locator('body').evaluate((el) => el.classList.contains('reduced-motion')));
    await page.locator('[data-tab=people]').click(); await page.locator('#find').fill('c r f');
    assert.equal(await page.locator('#find').inputValue(), 'c r f');
    await page.locator('#find').blur(); await page.locator('#viewCity').click();
    await page.screenshot({ path: resolve(output, 'desktop.png') });
  });
  await check('overview navigation and crowded-person selection use real map coordinates', async () => {
    await page.locator('[data-tool=zoomIn]').click(); await page.locator('[data-tool=zoomIn]').click();
    const mini = await page.locator('#overview-map').boundingBox(); await page.mouse.click(mini.x + mini.width * .8, mini.y + mini.height * .7);
    await page.locator('#save').click();
    const camera = await page.evaluate(() => JSON.parse(localStorage.getItem('world-in-dreams:manual-view:v1')).view.view);
    assert.ok(Math.abs(camera.x) > 100);
    await page.goto(`${base}?seed=qol-review&minutes=420&speed=0`); await settle();
    const S = await exportWorld(), outdoors = S.people.filter((p) => p.alive && !p.away && p.in < 0);
    let pair;
    for (const a of outdoors) { const b = outdoors.find((p) => p.id !== a.id && Math.hypot(a.x - p.x, a.y - p.y) < 2); if (b) { pair = [a, b]; break; } }
    assert.ok(pair, 'a real crowded pair exists in the selected scenario');
    const x = (pair[0].x + pair[1].x) / 2, y = (pair[0].y + pair[1].y) / 2;
    await page.goto(`${base}?seed=qol-review&minutes=420&speed=0&view=${x},${y},1.6`); await settle();
    const rect = await page.locator('#map').boundingBox(); await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.locator('#people-picker button').first().click(); assert.ok(await page.locator('#people-picker').isHidden());
    assert.ok(await page.locator('#panel h2').isVisible());
    await page.mouse.dblclick(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.waitForFunction(() => document.querySelector('[data-act=follow]')?.textContent === 'Following');
    assert.ok(await page.locator('#people-picker').isHidden());
    await page.screenshot({ path: resolve(output, 'street-inspector.png') });
  });
  for (const width of [768, 390]) await check(`responsive layout at ${width}px`, async () => {
    await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    for (const id of ['map', 'panel', 'events']) { const r = await page.locator('#' + id).boundingBox(); assert.ok(r && r.height > 20 && r.width <= width); }
    await page.locator('[data-tool=preferences]').click();
    const r = await page.locator('#observer-dialog').boundingBox(); assert.ok(r.x >= 0 && r.x + r.width <= width);
    await page.locator('#closeObserver').click(); await page.screenshot({ path: resolve(output, `narrow-${width}.png`) });
  });
  await check('recovery rotation and reopening restore the world and observation metadata', async () => {
    const expected = await page.evaluate(async () => {
      const { createCheckpointStore } = await import('/src/ui/checkpoint-store.js');
      const { step, fingerprint } = await import('/src/engine/index.js');
      const db = createCheckpointStore(), record = await db.get('slot1');
      await db.put('recovery', record);
      const next = structuredClone(record); step(next.world); next.savedAt++;
      await db.put('recovery', next);
      const previous = await db.get('previous');
      return { previous: fingerprint(previous.world), original: fingerprint(record.world), next: fingerprint(next.world), view: next.view };
    });
    assert.equal(expected.previous, expected.original);
    await page.goto(`${base}?seed=qol-review&speed=0`); await settle(); await page.locator('#restoreRecovery').click();
    await page.waitForFunction(() => document.getElementById('recovery-notice').hidden);
    assert.equal(fingerprint(await exportWorld()), expected.next);
    assert.match(await page.locator('#play-state').innerText(), /Paused/);
    await page.locator('#save').click();
    const current = await page.evaluate(() => JSON.parse(localStorage.getItem('world-in-dreams:manual-view:v1')).view);
    assert.deepEqual(current.sel, expected.view.sel); assert.equal(current.tab, expected.view.tab);
    assert.equal(current.query, expected.view.query); assert.equal(current.eventFilters.crime, expected.view.eventFilters.crime);
  });
  await check('storage refusal remains recoverable and high-DPI rendering stays usable', async () => {
    const denied = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
    await denied.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage denied by test'); } });
      Object.defineProperty(window, 'indexedDB', { value: undefined });
    });
    const p = await denied.newPage(), faults = []; p.on('pageerror', (e) => faults.push(e.message));
    await p.goto(`${base}?seed=qol-review&speed=0`); await p.waitForFunction(() => window.__ready);
    await p.locator('#save').click(); assert.match(await p.locator('#toast').innerText(), /refused/);
    await p.locator('#viewRegion').click(); await p.locator('[data-tool=checkpoints]').click();
    await p.waitForFunction(() => document.getElementById('slot-status')?.textContent.includes('unavailable'));
    await p.locator('#closeObserver').click(); assert.deepEqual(faults, []);
    await p.screenshot({ path: resolve(output, 'high-dpi.png') }); await denied.close();
  });
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'checks.json'), JSON.stringify({ capture: 'Automated Chromium gameplay; isolated test profile', checks, errors }, null, 2));
  console.log(`All ${checks.length} browser scenarios passed. Evidence: ${output}`);
} finally { await browser.close(); }
