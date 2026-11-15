import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, realpath, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { branchSlug, createWorktree, removeWorktree } from '../worktrees.mjs';

const run = promisify(execFile);
const git = (cwd, ...args) => run('git', ['-c', 'user.name=Mr Mak Test', '-c', 'user.email=test@example.invalid', ...args], { cwd, windowsHide: true }).then(r => r.stdout.trim());

async function repository(t, files = { 'plugin/main.py': 'print(1)\n' }) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'mrmak-worktree-')));
  t.after(() => Promise.all([rm(root, { recursive: true, force: true }), rm(`${root}.worktrees`, { recursive: true, force: true })]));
  await git(root, 'init', '-q'); await git(root, 'config', 'core.autocrlf', 'false');
  for (const [name, text] of Object.entries(files)) { await mkdir(path.dirname(path.join(root, name)), { recursive: true }); await writeFile(path.join(root, name), text); }
  await git(root, 'add', '.'); await git(root, 'commit', '-q', '-m', 'Initial');
  return root;
}

test('branch names are short, ASCII and never empty', () => {
  assert.equal(branchSlug('ZBrush Plugin · Interfaz Rápida'), 'zbrush-plugin-interfaz-rapida');
  assert.equal(branchSlug('***'), 'worker');
  assert.ok(branchSlug('x'.repeat(80)).length <= 40);
});

test('a worktree is a new branch beside the repository at the controller commit and keeps the subfolder', async t => {
  const root = await repository(t);
  await writeFile(path.join(root, 'notes.txt'), 'untracked');
  const head = await git(root, 'rev-parse', 'HEAD');
  const tree = await createWorktree(path.join(root, 'plugin'), 'Plugin UI');
  assert.match(tree.branch, /^mrmak\/plugin-ui-[0-9a-f]{6}$/);
  assert.equal(path.dirname(tree.path), `${root}.worktrees`);
  assert.equal(tree.cwd, path.join(tree.path, 'plugin'));
  assert.equal(tree.base, head); assert.equal(tree.pending, 1);
  assert.equal(await readFile(path.join(tree.cwd, 'main.py'), 'utf8'), 'print(1)\n');
  assert.equal(await git(tree.path, 'branch', '--show-current'), tree.branch);
  assert.equal(await git(root, 'status', '--porcelain'), '?? notes.txt', 'The main checkout does not list the worktree');
  await removeWorktree(tree);
  assert.equal(await git(root, 'branch', '--list', tree.branch), '');
});

test('worktrees refuse folders that are not committed or not in Git', async t => {
  const root = await repository(t);
  await mkdir(path.join(root, 'draft'));
  await assert.rejects(createWorktree(path.join(root, 'draft'), 'Draft'), /not committed/);
  assert.equal(await git(root, 'branch', '--list', 'mrmak/*'), '', 'The refused worktree leaves no branch');
  const plain = await mkdtemp(path.join(os.tmpdir(), 'mrmak-plain-'));
  t.after(() => rm(plain, { recursive: true, force: true }));
  await assert.rejects(createWorktree(plain, 'Plain'), /Git repository/);
});
