// Public surface of the engine. The viewer and any future RPG layer or AI
// agent talk to the world only through this module.
export { createWorld } from './worldgen.js';
export { step, run } from './sim.js';
export { SPECIES, SP, attitude } from './species.js';
export { BIOMES, B } from './map.js';
export { KIND, YEAR, dateOf, getMap, defense } from './core.js';

/** The whole world as JSON. Terrain is rebuilt from the seed on load. */
export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(json) {
  const state = typeof json === 'string' ? JSON.parse(json) : json;
  if (!state || state.version !== 1 || !Array.isArray(state.sites)) throw new Error('Not a World in Dreams save (version 1).');
  return state;
}

/** Small stable fingerprint of a state, for determinism checks. */
export function fingerprint(state) {
  const text = JSON.stringify(state);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}
