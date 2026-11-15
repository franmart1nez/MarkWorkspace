import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
async function git(cwd, args) {
  const { stdout } = await run('git', args, { cwd, windowsHide: true, timeout: 120000, maxBuffer: 8_000_000 });
  return stdout.trim();
}

export const branchSlug = value => String(value || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'worker';

// A worker's own branch and checkout, beside the repository rather than inside
// it, so neither Git status nor parent-folder agent instructions pick it up.
// It starts from the controller's current commit: uncommitted and ignored
// files (dependencies, .env) stay in the controller's checkout.
export async function createWorktree(cwd, name) {
  let root;
  try { root = path.resolve(await git(cwd, ['rev-parse', '--show-toplevel'])); }
  catch { fail('A worktree needs the controller folder to be inside a Git repository.'); }
  let base;
  try { base = await git(root, ['rev-parse', '--verify', 'HEAD^{commit}']); }
  catch { fail('A worktree needs at least one commit in this repository.'); }
  const prefix = await git(cwd, ['rev-parse', '--show-prefix']);
  const pending = (await git(root, ['status', '--porcelain'])).split('\n').filter(Boolean).length;
  const slug = `${branchSlug(name)}-${randomBytes(3).toString('hex')}`;
  const branch = `mrmak/${slug}`;
  const folder = path.join(path.dirname(root), `${path.basename(root)}.worktrees`, slug);
  await mkdir(path.dirname(folder), { recursive: true });
  await git(root, ['worktree', 'add', '-b', branch, folder, base]);
  const workerCwd = path.resolve(folder, prefix);
  if (!(await stat(workerCwd).catch(() => null))?.isDirectory()) {
    await removeWorktree({ root, path: folder, branch }).catch(() => {});
    fail('The controller folder is not committed, so it would not exist in a new worktree. Commit it first.');
  }
  return { root, path: folder, cwd: workerCwd, branch, base, pending };
}

// Used only to undo a worktree whose worker never started.
export async function removeWorktree({ root, path: folder, branch }) {
  await git(root, ['worktree', 'remove', '--force', folder]);
  await git(root, ['branch', '-D', branch]);
}
