import path from 'node:path';
import { realpath, readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { secret, equalSecret } from './util.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { taskTitle } from './titles.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export const workerModel = value => {
  if (typeof value !== 'string' || !/^[\w.-]+\/[\w.:-]+(?:#[\w.-]+)?$/.test(value)) fail('Choose an exact OpenCode provider/model#variant.');
  return value;
};

// A controller gets its own memory-only capability, never the desktop token.
// It can create/read/follow up only its own workers in its exact working folder.
export class AgentControl {
  constructor({ sessions, origin, focus, transcripts }) {
    Object.assign(this, { sessions, origin, focus, transcripts });
    this.grants = new Map(); this.requests = new Map(); this.pending = new Map();
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
      const { requestId, name, model, handoff } = input;
      if (typeof requestId !== 'string' || !/^[\w-]{1,100}$/.test(requestId)) fail('Supply a stable requestId to prevent duplicate workers.');
      if (input.agent !== 'opencode') fail('Automatic workers currently support OpenCode.');
      taskTitle(name);
      workerModel(model);
      if (typeof handoff !== 'string') fail('Supply a handoff file in this project.');
      const root = await realpath(parent.cwd), file = await realpath(path.resolve(root, handoff));
      const relative = path.relative(root, file);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !/\.md$/i.test(file)) fail('Choose a Markdown handoff inside this project.');
      if (relative.split(path.sep).some(p => p.startsWith('.'))) fail('Choose a project handoff outside private runtime folders.');
      if ((await stat(file)).size > 100000) fail('Use a handoff smaller than 100 KB.');
      const text = await readFile(file, 'utf8');
      const key = `${parent.id}:${requestId}`;
      const signature = createHash('sha256').update(JSON.stringify({ name, model, file, text })).digest('hex');
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
        const folder = path.join(this.sessions.stateDir, 'agent-control', 'handoffs');
        await mkdir(folder, { recursive: true });
        const attachment = path.join(folder, `${randomUUID()}.md`);
        await writeFile(attachment, text, { encoding: 'utf8', mode: 0o600 });
        return this.sessions.create({ agent: 'opencode', name, cwd: root, bypass: parent.bypass === true,
          controlRequestId: requestId, controlSignature: signature,
          controllerId: parent.id, workerModel: model, workerFile: attachment,
          initialPrompt: 'Read the attached handoff completely and carry out the authorized task. Preserve its constraints and report actual deliverables and remaining limits.', orchestrator: false });
      })().then(session => {
        this.focus(session.id); return { delivered: true, session };
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
