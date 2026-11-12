import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createService } from '../server.mjs';
import { launchBrowser, desktopAuth } from './browser.mjs';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const repo = await mkdtemp(path.join(root, '.cache/agent-control-ui-'));
await mkdir(path.join(repo, 'workspace'));
await writeFile(path.join(repo, 'workspace/workspace.json'), '{"entities":[]}');
const service = await createService({ repo, uiDir: path.join(root, 'dist') });
const options = [];
service.sessions.create = async value => {
  options.push(value);
  const item = service.sessions.make({ ...value, id: 'controller-fixture', name: 'Controller fixture', status: 'stopped', open: true });
  service.sessions.items.set(item.id, item); await service.sessions.hydrate(item);
  return service.sessions.list().find(s => s.id === item.id);
};
let browser;
try {
  browser = await launchBrowser();
  const context = await browser.newContext(); await desktopAuth(context, service.urls.chats);
  const page = await context.newPage();
  for (const width of [1000, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(service.urls.chats);
    await page.getByRole('button', { name: 'New chat', exact: true }).click();
    const checkbox = page.getByRole('checkbox', { name: /Allow this chat to coordinate workers/ });
    await checkbox.waitFor(); assert.equal(await checkbox.isChecked(), false);
    await checkbox.check();
    const permissions = page.getByRole('checkbox', { name: /Bypass agent permission prompts|Auto-approve permission prompts/ });
    assert.equal(await permissions.isChecked(), false);
    assert.ok(await page.locator('html').evaluate(n => n.scrollWidth <= n.clientWidth + 2));
    await page.screenshot({ path: path.join(repo, `new-chat-${width}.png`), fullPage: true });
    if (width === 1000) {
      await page.getByRole('button', { name: 'Open chat', exact: true }).click();
      await page.getByRole('heading', { name: 'New chat' }).waitFor({ state: 'hidden' });
      assert.equal(options.at(-1).orchestrator, true);
      assert.equal(options.at(-1).bypass, false);
    } else await page.getByRole('button', { name: 'Close', exact: true }).click();
  }
  console.log(JSON.stringify({ widths: [1000,390], optInDefaultOff: true, permissionsUnchanged: true, submitted: true, screenshots: repo }));
} finally { await browser?.close(); await service.close(); }
