import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, realpath, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { AgentControl } from '../agent-control.mjs';
import { terminalCommand, childEnvironment, initialPromptArgument } from '../agents.mjs';
import { Sessions } from '../sessions.mjs';
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
  await assert.rejects(control.execute(parent, { ...open, requestId: 'shell', agent: 'shell' }), /support OpenCode, Claude and Codex/);
  await assert.rejects(control.execute(parent, { ...open, requestId: 'kimi', agent: 'kimi' }), /support OpenCode, Claude and Codex/);
  await assert.rejects(control.execute(parent, { ...open, requestId: 'oc-effort', effort: 'high' }), /#variant/);
  await mkdir(path.join(parent.cwd, '.private')); await writeFile(path.join(parent.cwd, '.private/task.md'), 'Private');
  await assert.rejects(control.execute(parent, { ...open, requestId: 'private', handoff: '.private/task.md' }), /private runtime/);
  assert.equal((await control.execute(parent, { action: 'list' })).length, 1);
});

test('Claude and Codex workers keep the exact model and effort, read only their own folder and join the controller group', async t => {
  const { parent, creates, control } = await fixture(t);
  parent.group = 'Gus';
  const claude = { ...open, requestId: 'claude-01', agent: 'claude', model: 'claude-opus-5-5', effort: 'xhigh' };
  await control.execute(parent, claude);
  const first = creates.at(-1);
  assert.equal(first.agent, 'claude'); assert.equal(first.workerModel, 'claude-opus-5-5'); assert.equal(first.effort, 'xhigh');
  assert.equal(first.group, 'Gus'); assert.equal(first.bypass, false); assert.equal(first.orchestrator, false);
  assert.equal(first.readDir, first.workerDir); assert.equal(path.dirname(first.workerFile), first.workerDir);
  assert.ok(first.initialPrompt.includes(first.workerFile));
  assert.equal(initialPromptArgument(first.initialPrompt), first.initialPrompt);
  assert.equal(await readFile(first.workerFile, 'utf8'), '# A concrete task\nPreserve the source.');
  await control.execute(parent, { ...open, requestId: 'codex-01', agent: 'codex', model: 'gpt-6.1sol', effort: 'xhigh' });
  const second = creates.at(-1);
  assert.equal(second.agent, 'codex'); assert.equal(second.workerModel, 'gpt-6.1sol'); assert.equal(second.group, 'Gus');
  assert.equal(second.readDir, undefined); assert.notEqual(second.workerDir, first.workerDir);
  await assert.rejects(control.execute(parent, { ...claude, effort: 'high' }), /already used/);
  await assert.rejects(control.execute(parent, { ...claude, requestId: 'variant', model: 'claude-opus-5-5#max' }), /exact Claude model/);
  await assert.rejects(control.execute(parent, { ...claude, requestId: 'option', model: '--dangerously-skip-permissions' }), /exact Claude model/);
  await assert.rejects(control.execute(parent, { ...claude, requestId: 'codex-variant', agent: 'codex', model: 'gpt-6.1sol#xhigh' }), /exact Codex model/);
  await assert.rejects(control.execute(parent, { ...claude, requestId: 'effort', effort: 'ultra' }), /Effort must be/);
  assert.equal(creates.length, 2);
});

test('a worktree worker starts on its own branch beside the project and is told to commit there', async t => {
  const { parent, root, creates, control } = await fixture(t);
  await assert.rejects(control.execute(parent, { ...open, requestId: 'no-git', worktree: true }), /Git repository/);
  await assert.rejects(control.execute(parent, { ...open, requestId: 'flag', worktree: 'yes' }), /true or false/);
  const git = (...args) => promisify(execFile)('git', ['-c', 'user.name=Mr Mak Test', '-c', 'user.email=test@example.invalid', ...args], { cwd: root, windowsHide: true }).then(r => r.stdout.trim());
  await git('init', '-q'); await git('add', 'task.md'); await git('commit', '-q', '-m', 'Task');
  const real = await realpath(root);
  t.after(() => rm(`${real}.worktrees`, { recursive: true, force: true }));
  const result = await control.execute(parent, { ...open, requestId: 'tree-01', agent: 'codex', model: 'gpt-6.1sol', effort: 'high', worktree: true });
  const created = creates.at(-1);
  assert.match(result.worktree.branch, /^mrmak\/basement-assets-[0-9a-f]{6}$/);
  assert.equal(created.cwd, result.worktree.path); assert.equal(path.dirname(created.cwd), `${real}.worktrees`);
  assert.equal(created.worktree.branch, result.worktree.branch);
  assert.ok(created.initialPrompt.includes(result.worktree.branch) && /Commit your changes there/.test(created.initialPrompt));
  assert.match(result.note, /not in it/, 'Uncommitted runtime files are reported');
  assert.equal(await git('-C', created.cwd, 'branch', '--show-current'), result.worktree.branch);
  // The same request with and without a worktree is a different task.
  await assert.rejects(control.execute(parent, { ...open, requestId: 'tree-01', agent: 'codex', model: 'gpt-6.1sol', effort: 'high' }), /already used/);
});

test('interactive worker follow-ups reach the same open chat only between turns', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mrmak-followup-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sessions = await new Sessions(root, path.join(root, '.state')).init();
  t.after(() => clearInterval(sessions.timer));
  const writes = [];
  const worker = sessions.make({ id: 'worker', agent: 'codex', name: 'Worker', cwd: root, open: true, controllerId: 'parent', workerModel: 'gpt-6.1sol',
    workerDir: path.join(root, '.state', 'agent-control', 'workers', 'one'), nativeId: '019a0000-0000-7000-8000-000000000000', activity: 'working' });
  worker.process = { write: data => writes.push(data) };
  sessions.items.set(worker.id, worker);
  await assert.rejects(sessions.followupWorker('worker', 'Fix the UV seam'), /working or waiting/);
  assert.equal(writes.length, 0);
  worker.activity = 'idle';
  assert.equal((await sessions.followupWorker('worker', 'Fix the UV seam')).delivered, true);
  const file = /follow-up at (.+?) and continue/.exec(writes[0])[1];
  assert.ok(writes[0].startsWith('\x1b[200~'));
  assert.equal(path.dirname(file), worker.workerDir);
  assert.equal(await readFile(file, 'utf8'), 'Fix the UV seam');
  await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(writes.at(-1), '\r');
  worker.process = null;
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

test('Claude and Codex worker commands pass the exact model, never as an option', () => {
  const decode = command => command.args.includes('-EncodedCommand') ? Buffer.from(command.args.at(-1), 'base64').toString('utf16le') : command.args.join(' ');
  const claude = decode(terminalCommand('claude', { workerModel: 'claude-opus-5-5', effort: 'xhigh', initialPrompt: 'Read the handoff at C:\\state\\handoff.md completely.', readDir: path.resolve('worker folder') }));
  assert.ok(claude.includes('--model') && claude.includes('claude-opus-5-5'));
  // --add-dir takes every following argument, so the model must come first.
  assert.ok(claude.indexOf('claude-opus-5-5') < claude.indexOf('--add-dir'));
  const codex = decode(terminalCommand('codex', { resumeId: '019a0000-0000-7000-8000-000000000000', workerModel: 'gpt-6.1sol', initialPrompt: 'Read the follow-up at C:\\state\\followup.txt and continue.' }));
  assert.ok(codex.includes('--model') && codex.includes('gpt-6.1sol') && codex.includes('019a0000-0000-7000-8000-000000000000'));
  assert.ok(codex.indexOf('gpt-6.1sol') < codex.indexOf('Read the follow-up'));
  assert.throws(() => terminalCommand('codex', { workerModel: '-c', initialPrompt: 'Start.' }), /exact worker model/);
  assert.throws(() => terminalCommand('kimi', { workerModel: 'k2' }), /exact worker model/);
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
