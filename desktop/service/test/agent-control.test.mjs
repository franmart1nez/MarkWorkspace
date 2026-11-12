import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AgentControl } from '../agent-control.mjs';
import { terminalCommand, childEnvironment } from '../agents.mjs';
import { createService } from '../server.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mrmak-control-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'task.md'), '# A concrete task\nPreserve the source.');
  const parent = { id: 'parent', cwd: root, open: true, process: {}, orchestrator: true, bypass: false };
  const items = new Map([[parent.id, parent]]), creates = [];
  const sessions = { stateDir: path.join(root, '.state'), get: id => { if (!items.has(id)) throw new Error('Missing session'); return items.get(id); }, list: () => [...items.values()],
    create: async options => { creates.push(options); const s = { ...options, id: 'worker', open: true }; items.set(s.id, s); return s; },
    read: async () => ({ text: 'Native output' }), followupWorker: async (id, text) => ({ id, text }) };
  const control = new AgentControl({ sessions, origin: () => 'http://127.0.0.1:1234', focus: () => {}, transcripts: { read: async () => ({ model: 'opencode-go/deepseek-v4.1-flash', messages: [{ text: 'Delivered' }] }) } });
  const env = control.environment(parent), request = { headers: { authorization: `Bearer ${env.MRMAK_AGENT_CONTROL_TOKEN}` } };
  return { root, parent, items, sessions, creates, control, env, request };
}
const open = { action: 'open', requestId: 'assets-01', agent: 'opencode', name: 'Basement Assets', model: 'opencode-go/deepseek-v4.1-flash#max', handoff: 'task.md' };

test('controller grants require explicit selection, expire on relaunch/close and do not reach workers', async t => {
  const { parent, control, env, request } = await fixture(t);
  assert.deepEqual(control.environment({ ...parent, orchestrator: false }), {});
  assert.equal(control.authorize(request), parent);
  assert.throws(() => control.authorize({ headers: { ...request.headers, origin: 'https://example.org' } }), /native clients/);
  control.environment(parent);
  assert.throws(() => control.authorize(request), /coordination enabled/);
  const fresh = control.environment(parent);
  parent.process = null;
  assert.throws(() => control.authorize({ headers: { authorization: `Bearer ${fresh.MRMAK_AGENT_CONTROL_TOKEN}` } }), /no longer running/);
  const old = process.env.MRMAK_AGENT_CONTROL_TOKEN;
  process.env.MRMAK_AGENT_CONTROL_TOKEN = env.MRMAK_AGENT_CONTROL_TOKEN;
  try { assert.equal(childEnvironment().MRMAK_AGENT_CONTROL_TOKEN, undefined); }
  finally { if (old === undefined) delete process.env.MRMAK_AGENT_CONTROL_TOKEN; else process.env.MRMAK_AGENT_CONTROL_TOKEN = old; }
});

test('opening is idempotent, scoped to the project and uses the exact model without raising permissions', async t => {
  const { parent, creates, control } = await fixture(t);
  const [a, b] = await Promise.all([control.execute(parent, { ...open, bypass: true, orchestrator: true }), control.execute(parent, { ...open, bypass: true })]);
  assert.equal(a.session.id, b.session.id); assert.equal(creates.length, 1);
  assert.equal(creates[0].workerModel, open.model);
  assert.equal(creates[0].bypass, false); assert.equal(creates[0].orchestrator, false);
  assert.equal(creates[0].controllerId, parent.id); assert.equal(creates[0].cwd, parent.cwd);
  assert.notEqual(creates[0].workerFile, path.join(parent.cwd, 'task.md'));
  assert.equal(await readFile(creates[0].workerFile, 'utf8'), '# A concrete task\nPreserve the source.');
  control.requests.clear(); // Same controller after service restoration retains the worker record.
  assert.equal((await control.execute(parent, open)).existing, true); assert.equal(creates.length, 1);
  await assert.rejects(control.execute(parent, { ...open, model: 'other/model#high' }), /already used/);
  await assert.rejects(control.execute(parent, { ...open, requestId: 'bad', model: 'DeepSeek Max' }), /exact OpenCode/);
  await assert.rejects(control.execute(parent, { ...open, requestId: 'shell', agent: 'shell' }), /support OpenCode/);
  await mkdir(path.join(parent.cwd, '.private')); await writeFile(path.join(parent.cwd, '.private/task.md'), 'Private');
  await assert.rejects(control.execute(parent, { ...open, requestId: 'private', handoff: '.private/task.md' }), /private runtime/);
  assert.equal((await control.execute(parent, { action: 'list' })).length, 1);
});

test('concurrent opens enforce the worker limit before launch and failed requests cannot duplicate a job', async t => {
  const { parent, sessions, creates, control } = await fixture(t);
  sessions.create = async options => { creates.push(options); await new Promise(resolve => setTimeout(resolve, 20)); return { ...options, id: String(creates.length) }; };
  const results = await Promise.allSettled(Array.from({ length: 9 }, (_, i) => control.execute(parent, { ...open, requestId: `task-${i}` })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 8); assert.equal(creates.length, 8);
  assert.match(results.find(r => r.status === 'rejected').reason.message, /eight/);
  sessions.create = async () => { throw new Error('Uncertain launch failure'); };
  await assert.rejects(control.execute(parent, { ...open, requestId: 'failed' }), /Uncertain launch failure/);
  sessions.create = async () => { throw new Error('must not retry'); };
  await assert.rejects(control.execute(parent, { ...open, requestId: 'failed' }), /Uncertain launch failure/);
});

test('read/followup cannot target a foreign chat or invoke arbitrary control actions', async t => {
  const { parent, control, items } = await fixture(t);
  await control.execute(parent, open);
  items.set('foreign', { id: 'foreign', controllerId: 'someone-else' });
  await assert.rejects(control.execute(parent, { action: 'read', id: 'foreign' }), /another chat/);
  await assert.rejects(control.execute(parent, { action: 'send', id: 'foreign', text: 'Do work' }), /another chat/);
  const read = await control.execute(parent, { action: 'read', id: 'worker' });
  assert.equal(read.messages[0].text, 'Delivered');
  assert.deepEqual(await control.execute(parent, { action: 'send', id: 'worker', text: 'Fix the UV seam' }), { id: 'worker', text: 'Fix the UV seam' });
  await assert.rejects(control.execute(parent, { action: 'kill', id: 'worker' }), /Supported actions/);
});

test('native task command preserves exact model, handoff path and session without stdin UI typing', () => {
  const command = terminalCommand('opencode', { opencodeMajor: 2, resumeId: 'ses_controlFixture', workerModel: open.model,
    workerFile: path.resolve('task with spaces.md'), initialPrompt: 'Follow the attached handoff.', bypass: false });
  const text = command.args.includes('-EncodedCommand') ? Buffer.from(command.args.at(-1), 'base64').toString('utf16le') : command.args.join(' ');
  assert.match(text, /run/); assert.ok(text.includes(open.model)); assert.ok(text.includes('ses_controlFixture'));
  assert.ok(text.includes('task with spaces.md')); assert.ok(!text.includes('--auto'));
  assert.throws(() => terminalCommand('opencode', { workerModel: 'provider/model;echo bad', workerFile: path.resolve('task.md') }), /exact OpenCode/);
});

test('HTTP control is separately authenticated and cannot reuse the desktop token', async t => {
  const { root } = await fixture(t);
  await mkdir(path.join(root, 'workspace')); await writeFile(path.join(root, 'workspace/workspace.json'), '{"entities":[]}');
  const service = await createService({ repo: root, uiDir: root });
  const parent = service.sessions.make({ id: 'controller', agent: 'codex', cwd: root, open: true, orchestrator: true, bypass: false, process: {} });
  parent.process = {};
  service.sessions.items.set(parent.id, parent);
  const env = service.sessions.controlEnvironment(parent);
  const request = token => fetch(service.origin + '/agent-control', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{"action":"list"}' });
  try {
    assert.equal((await request(service.token)).status, 401);
    const r = await request(env.MRMAK_AGENT_CONTROL_TOKEN); assert.equal(r.status, 200); assert.deepEqual(await r.json(), []);
    assert.equal((await fetch(service.origin + '/api/bootstrap', { headers: { Authorization: `Bearer ${env.MRMAK_AGENT_CONTROL_TOKEN}` } })).status, 401);
  } finally { parent.process = null; await service.close(); }
});
