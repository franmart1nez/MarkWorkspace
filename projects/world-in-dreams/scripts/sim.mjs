// Headless run: node scripts/sim.mjs [seed] [days] [minImportance]
// Prints the chronicle and a daily summary; useful for tuning the rules.
import { createWorld, step, dateOf, fingerprint, foodDays, getLayout, DAY } from '../src/engine/index.js';

const [seed = 'dreams', days = '12', minImp = '1'] = process.argv.slice(2);
const t0 = performance.now();
const S = createWorld(seed);
const L = getLayout(S);
console.log(`Seed "${seed}": created in ${(performance.now() - t0).toFixed(0)} ms. ${S.people.length} people in ${S.households.length} households, ${S.animals.length} animals, ${L.blds.length} buildings, ${L.fields.length} fields.`);
const jobs = {};
for (const p of S.people) jobs[p.job] = (jobs[p.job] || 0) + 1;
console.log(Object.entries(jobs).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
let shown = 0;
function summary() {
  const alive = S.people.filter((p) => p.alive && !p.away);
  const out = alive.filter((p) => p.in < 0).length, hungry = alive.filter((p) => p.miss > 2).length;
  const coins = S.households.reduce((a, h) => a + h.coins, 0) / S.households.length;
  const beasts = {};
  for (const a of S.animals) beasts[a.k] = (beasts[a.k] || 0) + 1;
  const st = [0, 0, 0, 0, 0];
  for (const F of S.fields) st[F.st]++;
  console.log(`== ${dateOf(S.t).text}: pop ${alive.length}, outdoors ${out}, hungry ${hungry}, avg purse ${coins.toFixed(0)}, food days ${S.sites.map((s, i) => foodDays(S, i).toFixed(0)).join('/')}, fields fallow/growing/ripe/stubble ${st.slice(0, 4).join('/')}, beasts ${JSON.stringify(beasts)}`);
}
summary();
const t1 = performance.now();
for (let i = 0; i < Number(days) * DAY; i++) {
  step(S);
  for (; shown < S.events.length; shown++) {
    const e = S.events[shown];
    if (e.imp >= Number(minImp)) console.log(`${dateOf(e.t).short.padEnd(14)} ${dateOf(e.t).clock} [${e.type}] ${e.text}`);
  }
  if (S.t % DAY === 0) summary();
}
const counts = {};
for (const e of S.events) counts[e.type] = (counts[e.type] || 0) + 1;
console.log('Events by type:', counts, `births ${S.born}, deaths ${S.died}`);
console.log(`Simulated ${days} days in ${(performance.now() - t1).toFixed(0)} ms. Save size ${(JSON.stringify(S).length / 1e6).toFixed(2)} MB. Fingerprint ${fingerprint(S)}.`);
