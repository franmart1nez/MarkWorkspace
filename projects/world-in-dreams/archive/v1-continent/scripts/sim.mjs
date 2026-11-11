// Headless run: node scripts/sim.mjs [seed] [years] [minImportance]
// Prints the chronicle and a yearly summary; useful for tuning the rules.
import { createWorld, step, dateOf, SPECIES, fingerprint, YEAR } from '../src/engine/index.js';

const [seed = 'dreams', years = '10', minImp = '2'] = process.argv.slice(2);
const t0 = performance.now();
const state = createWorld(seed);
const tGen = performance.now() - t0;
let shown = 0;

function summary() {
  const civil = state.sites.filter((s) => s.mode === 'civil');
  const pop = civil.reduce((a, s) => a + s.pop, 0);
  const famine = civil.filter((s) => s.famine).length;
  const wars = state.factions.reduce((a, f) => a + Object.keys(f.wars).length, 0) / 2;
  const lairs = state.sites.filter((s) => s.mode === 'raider').length;
  const unrest = civil.reduce((a, s) => a + s.unrest, 0) / Math.max(1, civil.length);
  console.log(`== ${dateOf(state.day).text}: ${civil.length} settlements, pop ${Math.round(pop)}, ${state.factions.filter((f) => f.alive).length} realms, ` +
    `${wars} wars, ${famine} famines, ${lairs} lairs, avg unrest ${unrest.toFixed(1)}, ${state.parties.length} parties`);
}

console.log(`Seed "${seed}": generated in ${tGen.toFixed(0)} ms. ${state.sites.length} sites, ${state.edges.length} routes, ${state.npcs.length} notables.`);
const present = new Set(state.sites.flatMap((s) => [s.species, ...Object.keys(s.pops)]));
const missing = SPECIES.filter((s) => !present.has(s.id)).map((s) => s.id);
console.log(missing.length ? `MISSING SPECIES: ${missing.join(', ')}` : `All ${SPECIES.length} species are present.`);
summary();
const t1 = performance.now();
for (let d = 0; d < Number(years) * YEAR; d++) {
  step(state);
  for (; shown < state.events.length; shown++) {
    const e = state.events[shown];
    if (e.imp >= Number(minImp)) console.log(`${dateOf(e.day).text.padEnd(28)} [${e.type}] ${e.text}`);
  }
  if (state.day % YEAR === 0) summary();
}
const counts = {};
for (const e of state.events) counts[e.type] = (counts[e.type] || 0) + 1;
console.log(`Events by type:`, counts);
console.log(`Simulated ${years} years in ${(performance.now() - t1).toFixed(0)} ms. Fingerprint ${fingerprint(state)}.`);
