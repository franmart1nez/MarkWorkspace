// Smooth value noise, sampled at any real coordinate.

function h2(x, y, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function noise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h2(xi, yi, seed), b = h2(xi + 1, yi, seed), c = h2(xi, yi + 1, seed), d = h2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fractal noise in 0..1. */
export function fbm(x, y, seed, oct = 4) {
  let s = 0, amp = 0.5, norm = 0;
  for (let i = 0; i < oct; i++) {
    s += amp * noise(x, y, seed + i * 1013);
    norm += amp;
    x *= 2.03; y *= 2.03; amp *= 0.5;
  }
  return s / norm;
}

/** Stable 0..1 hash of two integers, for per-object visual variation. */
export const hash01 = (a, b = 0) => h2(a | 0, b | 0, 9781);
