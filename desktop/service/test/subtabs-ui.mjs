// Check nested project navigation without starting the desktop service or sessions.
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { launchBrowser } from './browser.mjs';
await import('../../../scripts/ensure-workspace-link.mjs');
const server = await createServer({ root: process.cwd(), server: { host: '127.0.0.1', port: 0, open: false, watch: null, hmr: false } });
const entity = { id: 'subtabs-fixture', title: 'Nested navigation', folder: 'subtabs-fixture', category: 'research', type: 'group', status: 'active', created: '2026-11-11', defaultStep: 0, steps: [
  { name: 'Art bible', path: 'art.md' },
  { name: 'Other', path: 'other.md' },
  { name: 'References', path: 'references.md', parent: 'art.md' },
  { name: 'Orphan', path: 'orphan.md', parent: 'missing.md' },
  { name: 'Deeper', path: 'deeper.md', parent: 'references.md' },
] };
let browser;
try {
  await server.listen(); browser = await launchBrowser(); const page = await browser.newPage();
  await page.addInitScript(() => localStorage.setItem('mak.sidebarCollapsed', '1'));
  await page.route('**/workspace/workspace.json*', route => route.fulfill({ json: { entities: [entity] } }));
  await page.route('**/workspace/subtabs-fixture/*.md', route => route.fulfill({ contentType: 'text/plain', body: '# ' + new URL(route.request().url()).pathname.split('/').pop() }));
  await page.goto(server.resolvedUrls.local[0] + '#/subtabs-fixture/0');
  const roots = page.getByRole('tablist', { name: 'Project tabs', exact: true });
  const sections = page.getByRole('tablist', { name: 'Art bible sections', exact: true });
  await sections.waitFor();
  assert.equal(await roots.getByRole('tab').count(), 4);
  assert.equal(await roots.getByRole('tab', { name: 'References', exact: true }).count(), 0);
  await sections.getByRole('tab', { name: 'References', exact: true }).click();
  await page.getByRole('heading', { name: 'references.md', exact: true }).waitFor();
  assert.match(page.url(), /\/2$/);
  assert.equal(await roots.getByRole('tab', { name: 'Art bible', exact: true }).getAttribute('aria-selected'), 'true');
  await sections.getByRole('tab', { name: 'Overview', exact: true }).click(); await page.getByRole('heading', { name: 'art.md', exact: true }).waitFor();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await sections.getByRole('tab', { name: 'References', exact: true }).click();
    await page.getByRole('heading', { name: 'references.md', exact: true }).waitFor();
    assert.ok(await page.locator('.topbar').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await sections.getByRole('tab', { name: 'Overview', exact: true }).click();
  }
  await roots.getByRole('tab', { name: 'Other', exact: true }).click();
  await page.getByRole('heading', { name: 'other.md', exact: true }).waitFor();
  assert.equal(await sections.count(), 0);
  await page.goto(server.resolvedUrls.local[0] + '#/subtabs-fixture/2');
  await page.getByRole('heading', { name: 'references.md', exact: true }).waitFor();
  assert.equal(await sections.getByRole('tab', { name: 'References', exact: true }).getAttribute('aria-selected'), 'true');
  console.log('Subtabs: parent activation, child routes, overview return, direct links, fallback tabs and three widths passed.');
} finally { await browser?.close(); await server.close(); }
