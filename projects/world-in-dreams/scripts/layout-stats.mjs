// Prints what the region generator produced for a seed: node scripts/layout-stats.mjs [seed]
import { hashSeed } from '../src/engine/rng.js';
import { layoutFor } from '../src/engine/layout.js';
const seed = process.argv[2] || 'dreams';
const t0 = performance.now();
const L = layoutFor(hashSeed(seed));
const kinds = {};
for (const b of L.blds) kinds[b.k] = (kinds[b.k] || 0) + 1;
const crops = {};
for (const f of L.fields) crops[f.crop] = (crops[f.crop] || 0) + 1;
console.log(`seed ${seed}: ${(performance.now() - t0).toFixed(0)} ms`);
console.log(`nodes ${L.nodes.filter((n) => !n.dead).length}, edges ${L.edges.length}, bridges ${L.bridges.length}, buildings ${L.blds.length}`, kinds);
console.log(`fields ${L.fields.length}`, crops, `area ${(L.fields.reduce((a, f) => a + f.area, 0) / 1e6).toFixed(2)} km2`);
console.log(`trees ${L.trees.length / 4}, rocks ${L.rocks.length}, ponds ${L.ponds.length}, farms ${L.farms.length}, towers ${L.towers.length}`);
for (const s of L.sites) console.log(` ${s.kind} ${s.name} (${s.type}) at ${s.x.toFixed(0)},${s.y.toFixed(0)}: ${L.blds.filter((b) => b.site === s.id).length} buildings, ${L.siteFields[s.id].length} fields, fish ${L.spots.fish[s.id].length}, wood ${L.spots.wood[s.id].length}`);
console.log('wild spots', Object.fromEntries(Object.entries(L.spots).filter(([k]) => !['fish', 'wood'].includes(k)).map(([k, v]) => [k, v.length])));
