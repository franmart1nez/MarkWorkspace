// Recounts the roadmap checkboxes and refreshes the status marks and progress
// tables in the Workspace card. Run after ticking tasks:  npm run roadmap
// With --check it only reports whether the files are up to date (exit code 1 if not).
import { readFile, writeFile } from 'node:fs/promises';

const CARD = new URL('../../../workspace/2026-11-10_world-in-dreams/', import.meta.url);
const ROADMAP = new URL('ROADMAP.md', CARD), OVERVIEW = new URL('OVERVIEW.md', CARD);
const MARK = /\s+(?:✅|🔶|⬜)\s*$/u;
const status = (done, total) => (total && done === total ? '✅' : done ? '🔶' : '⬜');
const bar = (done, total) => {
  const n = done ? Math.max(1, Math.round((10 * done) / total)) : 0;
  return `${'▰'.repeat(n)}${'▱'.repeat(10 - n)}`;
};
const count = (done, total) => `${done}/${total}`;

function parse(lines) {
  const milestones = [];
  let phase = '', ms = null, sub = null;
  lines.forEach((line, i) => {
    let m;
    if ((m = line.match(/^## Phase ([A-Z]) · /))) { phase = m[1]; ms = sub = null; return; }
    if (/^## /.test(line)) { ms = sub = null; return; }
    if ((m = line.match(/^### (M\d+) · (.+)$/))) {
      ms = { id: m[1], title: m[2].replace(MARK, ''), phase, line: i, size: '', points: '', done: 0, total: 0, subs: [] };
      milestones.push(ms); sub = null; return;
    }
    if (!ms) return;
    if ((m = line.match(/^\*\*Size:\*\* (\S+) · \*\*From your points?:\*\* (.+?)\s*$/))) { ms.size = m[1]; ms.points = m[2]; return; }
    if ((m = line.match(/^#### (\d+\.\d+) (.+)$/))) {
      sub = { id: m[1], title: m[2].replace(MARK, ''), line: i, done: 0, total: 0 };
      ms.subs.push(sub); return;
    }
    if ((m = line.match(/^\s*- \[([ xX])\] /))) {
      const done = m[1] !== ' ';
      ms.total++; if (done) ms.done++;
      if (sub) { sub.total++; if (done) sub.done++; }
    }
  });
  return milestones;
}

/** Replace the body of a `## heading` section (up to the next `## ` heading). */
function replaceSection(lines, heading, body) {
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start < 0) throw new Error(`Section not found: ${heading}`);
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end < 0) end = lines.length;
  return [...lines.slice(0, start + 1), '', ...body, '', ...lines.slice(end)];
}

const nl = (text) => (text.includes('\r\n') ? '\r\n' : '\n');
const roadmapText = await readFile(ROADMAP, 'utf8'), overviewText = await readFile(OVERVIEW, 'utf8');
let lines = roadmapText.split(/\r?\n/);
const milestones = parse(lines);
if (!milestones.length) throw new Error('No milestones found in ROADMAP.md');

for (const ms of milestones) {
  lines[ms.line] = `### ${ms.id} · ${ms.title} ${status(ms.done, ms.total)}`;
  for (const s of ms.subs) lines[s.line] = `#### ${s.id} ${s.title} ${status(s.done, s.total)}`;
}
const done = milestones.reduce((a, m) => a + m.done, 0), total = milestones.reduce((a, m) => a + m.total, 0);
const overall = `**Overall:** ${done} of ${total} tasks (${Math.round((100 * done) / total)}%).`;
const full = ['| | Milestone | From point | Size | Progress | Done |', '| --- | --- | --- | --- | --- | --- |',
  ...milestones.map((m) => `| ${status(m.done, m.total)} | **${m.id}** ${m.title} | ${m.points} | ${m.size} | ${bar(m.done, m.total)} | ${count(m.done, m.total)} |`), '', overall];
lines = replaceSection(lines, '## Progress at a glance', full);

const compact = ['| | Milestone | Progress | Done |', '| --- | --- | --- | --- |',
  ...milestones.map((m) => `| ${status(m.done, m.total)} | **${m.id}** ${m.title} | ${bar(m.done, m.total)} | ${count(m.done, m.total)} |`), '',
  `${overall} Ticked tasks already exist in the game. Every task is in the **Roadmap** tab.`];
const overviewLines = replaceSection(overviewText.split(/\r?\n/), '## Roadmap at a glance', compact);

const nextRoadmap = lines.join(nl(roadmapText)), nextOverview = overviewLines.join(nl(overviewText));
const stale = [nextRoadmap !== roadmapText && 'ROADMAP.md', nextOverview !== overviewText && 'OVERVIEW.md'].filter(Boolean);
if (process.argv.includes('--check')) {
  console.log(stale.length ? `Out of date: ${stale.join(', ')}. Run npm run roadmap.` : 'Roadmap progress is up to date.');
  process.exit(stale.length ? 1 : 0);
}
if (stale.includes('ROADMAP.md')) await writeFile(ROADMAP, nextRoadmap);
if (stale.includes('OVERVIEW.md')) await writeFile(OVERVIEW, nextOverview);
console.log(`${done}/${total} tasks done across ${milestones.length} milestones.${stale.length ? ` Updated ${stale.join(' and ')}.` : ' Nothing to update.'}`);
for (const m of milestones) console.log(`  ${status(m.done, m.total)} ${m.id.padEnd(4)} ${bar(m.done, m.total)} ${count(m.done, m.total).padEnd(6)} ${m.title}`);
