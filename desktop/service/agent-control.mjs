import path from 'node:path';
import { realpath, readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { secret, equalSecret } from './util.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { taskTitle } from './titles.mjs';
import { WORKER_AGENTS, validWorkerModel } from './agents.mjs';
import { workerEfforts } from './effort.mjs';
import { createWorktree, removeWorktree } from './worktrees.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export const workerModel = (agent, value) => {
  if (!validWorkerModel(agent, value)) fail(agent === 'opencode' ? 'Choose an exact OpenCode provider/model#variant.' : `Choose an exact ${agent === 'claude' ? 'Claude' : 'Codex'} model ID. Set reasoning with effort, not a #variant.`);
  return value;
};
export const handoffPrompt = file => `Read the handoff at ${file} completely and carry out the authorized task. Preserve its constraints and report actual deliverables and remaining limits.`;
const attachedPrompt = 'Read the attached handoff completely and carry out the authorized task. Preserve its constraints and report actual deliverables and remaining limits.';
export const worktreePrompt = branch => ` You work in your own Git worktree on branch ${branch}. Commit your changes there; do not merge, rebase or push.`;

// A controller gets its own memory-only capability, never the desktop token.
// It can create/read/follow up only its own workers in its exact working folder.
export class AgentControl {
  constructor({ sessions, origin, focus, transcripts }) {
    Object.assign(this, { sessions, origin, focus, transcripts });
    this.grants = new Map(); this.requests = new Map(); this.pending = new Map();
    // Concurrent `git worktree add` calls contend for the same repository locks.
    this.worktrees = Promise.resolve();
  }
  environment(session) {
    if (!session.orchestrator || session.agent === 'shell') return {};
    const token = secret();
    this.grants.set(session.id, token); // Re-launch invalidates the previous grant.
    return { MRMAK_AGENT_CONTROL_URL: this.origin(), MRMAK_AGENT_CONTROL_TOKEN: token };
  }
  authorize(request) {
    if (request.headers.origin) fail('Agent control accepts native clients only.', 403);
    const incoming = request.headers.authorization;
    for (const [id, token] of this.grants) {
      if (!equalSecret(incoming, `Bearer ${token}`)) continue;
      const parent = this.sessions.get(id);
      if (!parent.open || !parent.process || !parent.orchestrator) fail('The controller chat is no longer running.', 401);
      return parent;
    }
    fail('Start a chat with worker coordination enabled.', 401);
  }
  target(parent, id) {
    const item = this.sessions.get(id);
    if (item.controllerId !== parent.id) fail('This worker belongs to another chat.', 403);
    return item;
  }
  async execute(parent, input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Choose an agent-control action.');
    const { action } = input;
    if (action === 'list') return this.sessions.list().filter(s => s.controllerId === parent.id);
    if (action === 'open') {
      const { requestId, name, model, handoff, agent, effort, worktree } = input;
      if (typeof requestId !== 'string' || !/^[\w-]{1,100}$/.test(requestId)) fail('Supply a stable requestId to prevent duplicate workers.');
      if (!WORKER_AGENTS.includes(agent)) fail('Automatic workers support OpenCode, Claude and Codex.');
      taskTitle(name);
      workerModel(agent, model);
      if (effort != null && agent === 'opencode') fail('Set OpenCode reasoning with the model #variant.');
      if (effort != null && !workerEfforts.includes(effort)) fail(`Effort must be ${workerEfforts.join(', ')}.`);
      if (worktree != null && typeof worktree !== 'boolean') fail('Set worktree to true or false.');
      if (typeof handoff !== 'string') fail('Supply a handoff file in this project.');
      const root = await realpath(parent.cwd), file = await realpath(path.resolve(root, handoff));
      const relative = path.relative(root, file);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !/\.md$/i.test(file)) fail('Choose a Markdown handoff inside this project.');
      if (relative.split(path.sep).some(p => p.startsWith('.'))) fail('Choose a project handoff outside private runtime folders.');
      if ((await stat(file)).size > 100000) fail('Use a handoff smaller than 100 KB.');
      const text = await readFile(file, 'utf8');
      const key = `${parent.id}:${requestId}`;
      // OpenCode keeps its original signature, so workers recorded before
      // Claude/Codex and worktree support still match their requestId.
      const described = agent === 'opencode' ? { name, model, file, text } : { agent, name, model, effort: effort ?? null, file, text };
      const signature = createHash('sha256').update(JSON.stringify(worktree ? { ...described, worktree: true } : described)).digest('hex');
      const saved = this.requests.get(key);
      if (saved) {
        if (saved.signature !== signature) fail('This requestId was already used for another task.', 409);
        return saved.promise;
      }
      const prior = this.sessions.list().find(s => s.controllerId === parent.id && s.controlRequestId === requestId);
      if (prior) {
        if (this.sessions.get(prior.id).controlSignature !== signature) fail('This requestId was already used for another task.', 409);
        return { delivered: true, existing: true, session: prior };
      }
      const pending = this.pending.get(parent.id) || 0;
      if (this.sessions.list().filter(s => s.controllerId === parent.id && s.open).length + pending >= 8) fail('This controller already has eight open or starting workers.');
      this.pending.set(parent.id, pending + 1);
      const promise = (async () => {
        // Freeze the validated text: later source edits/symlink swaps cannot
        // change what this request actually sends to the worker.
        // Each worker has its own folder for the handoff and later follow-ups;
        // a Claude worker may read only that folder outside its project.
        const folder = path.join(this.sessions.stateDir, 'agent-control', 'workers', randomUUID());
        await mkdir(folder, { recursive: true });
        const attachment = path.join(folder, 'handoff.md');
        await writeFile(attachment, text, { encoding: 'utf8', mode: 0o600 });
        const interactive = agent !== 'opencode';
        let tree;
        if (worktree) {
          const next = this.worktrees.then(() => createWorktree(root, name));
          this.worktrees = next.catch(() => {});
          tree = await next;
        }
        const prompt = (interactive ? handoffPrompt(attachment) : attachedPrompt) + (tree ? worktreePrompt(tree.branch) : '');
        try {
          const session = await this.sessions.create({ agent, name, cwd: tree?.cwd || root, bypass: parent.bypass === true, group: parent.group || undefined,
            effort: interactive ? effort : undefined,
            controlRequestId: requestId, controlSignature: signature,
            controllerId: parent.id, workerModel: model, workerFile: attachment, workerDir: folder,
            worktree: tree && { root: tree.root, path: tree.path, branch: tree.branch, base: tree.base },
            readDir: agent === 'claude' ? folder : undefined,
            initialPrompt: prompt, orchestrator: false });
          return { session, tree };
        } catch (error) {
          // Nothing ran in the new checkout, so it is not kept.
          if (tree) await removeWorktree(tree).catch(() => {});
          throw error;
        }
      })().then(({ session, tree }) => {
        this.focus(session.id);
        if (!tree) return { delivered: true, session };
        return { delivered: true, session, worktree: { path: tree.path, branch: tree.branch, base: tree.base },
          ...(tree.pending ? { note: `The worktree starts at commit ${tree.base.slice(0, 12)}. ${tree.pending} uncommitted or untracked paths in the repository are not in it.` } : {}) };
      }).finally(() => this.pending.set(parent.id, (this.pending.get(parent.id) || 1) - 1));
      this.requests.set(key, { signature, promise });
      // Retain failed attempts too: a timeout is not permission to duplicate work.
      return promise;
    }
    const item = this.target(parent, input.id);
    if (action === 'read') {
      const transcript = await this.transcripts.read(item);
      return { session: this.sessions.list().find(s => s.id === item.id), screen: await this.sessions.read(item.id),
        model: transcript.model, messages: transcript.messages?.slice(-12), truncated: transcript.truncated };
    }
    if (action === 'send') {
      if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 100000) fail('Supply a follow-up shorter than 100 KB.');
      return this.sessions.followupWorker(item.id, input.text);
    }
    fail('Supported actions are list, open, read and send.');
  }
}
