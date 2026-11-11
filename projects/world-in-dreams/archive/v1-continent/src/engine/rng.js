// Deterministic random numbers. The generator state is a single uint32 stored
// on the object passed in (`s.rng`), so it is saved together with the world.

export function hashSeed(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** mulberry32: returns a float in [0, 1). */
export function rand(s) {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const randRange = (s, a, b) => a + rand(s) * (b - a);
export const randInt = (s, a, b) => a + Math.floor(rand(s) * (b - a + 1));
export const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];
export const chance = (s, p) => rand(s) < p;

export function shuffle(s, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}
