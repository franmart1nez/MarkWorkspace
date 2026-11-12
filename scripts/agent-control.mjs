// Run from an explicitly enabled controller chat. Never reads a desktop token.
import { readFile } from 'node:fs/promises';
const [action, ...rest] = process.argv.slice(2);
const help = 'Usage: node scripts/agent-control.mjs list | open request.json | read CHAT_ID | send CHAT_ID message.txt';
try {
  const origin = process.env.MRMAK_AGENT_CONTROL_URL, token = process.env.MRMAK_AGENT_CONTROL_TOKEN;
  if (!origin || !token) throw new Error('This chat has no worker-coordination grant. Enable it when opening a new orchestrator chat in Mr. Mak.');
  const url = new URL(origin);
  if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname) || url.username || url.password) throw new Error('Agent control must use the local Mr. Mak service.');
  let input;
  if (action === 'list') input = { action };
  else if (action === 'open' && rest[0]) input = { ...JSON.parse(await readFile(rest[0], 'utf8')), action };
  else if (action === 'read' && rest[0]) input = { action, id: rest[0] };
  else if (action === 'send' && rest[0] && rest[1]) input = { action, id: rest[0], text: await readFile(rest[1], 'utf8') };
  else throw new Error(help);
  const response = await fetch(new URL('/agent-control', url), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(60000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Agent control failed (${response.status}). Inspect the worker before retrying.`);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} catch (error) { process.stderr.write(String(error.message) + '\n'); process.exitCode = 1; }
