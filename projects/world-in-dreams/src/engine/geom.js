// Plane geometry for a world without a tile grid: everything is points,
// segments, rotated rectangles and polygons in metres.

export const hyp = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Distance from point P to segment AB. */
export function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

/** Position 0..1 along AB where it crosses CD, or -1. */
export function segSeg(ax, ay, bx, by, cx, cy, dx, dy) {
  const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return -1;
  const t = ((cx - ax) * sy - (cy - ay) * sx) / den;
  const u = ((cx - ax) * ry - (cy - ay) * rx) / den;
  return t > 0 && t < 1 && u > 0 && u < 1 ? t : -1;
}

/** Corners of a rotated rectangle {x, y, w, d, a} grown by `pad`: [x0,y0, ... x3,y3]. */
export function corners(r, pad = 0) {
  const c = Math.cos(r.a), s = Math.sin(r.a);
  const hw = r.w / 2 + pad, hd = r.d / 2 + pad;
  return [
    r.x - c * hw + s * hd, r.y - s * hw - c * hd,
    r.x + c * hw + s * hd, r.y + s * hw - c * hd,
    r.x + c * hw - s * hd, r.y + s * hw + c * hd,
    r.x - c * hw - s * hd, r.y - s * hw + c * hd,
  ];
}

export function bbox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    if (pts[i] < x0) x0 = pts[i];
    if (pts[i] > x1) x1 = pts[i];
    if (pts[i + 1] < y0) y0 = pts[i + 1];
    if (pts[i + 1] > y1) y1 = pts[i + 1];
  }
  return [x0, y0, x1, y1];
}

/** Point inside rotated rectangle (grown by pad). */
export function inRect(px, py, r, pad = 0) {
  const c = Math.cos(r.a), s = Math.sin(r.a);
  const lx = (px - r.x) * c + (py - r.y) * s, ly = -(px - r.x) * s + (py - r.y) * c;
  return Math.abs(lx) <= r.w / 2 + pad && Math.abs(ly) <= r.d / 2 + pad;
}

/** Two rotated rectangles overlap (separating axis test); `pad` grows the first. */
export function rectsHit(r1, r2, pad = 0) {
  const A = corners(r1, pad), B = corners(r2);
  for (const r of [r1, r2]) {
    const c = Math.cos(r.a), s = Math.sin(r.a);
    for (const [nx, ny] of [[c, s], [-s, c]]) {
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (let i = 0; i < 8; i += 2) {
        const pa = A[i] * nx + A[i + 1] * ny, pb = B[i] * nx + B[i + 1] * ny;
        if (pa < a0) a0 = pa;
        if (pa > a1) a1 = pa;
        if (pb < b0) b0 = pb;
        if (pb > b1) b1 = pb;
      }
      if (a1 < b0 || b1 < a0) return false;
    }
  }
  return true;
}

/** Segment AB touches the rotated rectangle grown by pad. */
export function segHitsRect(ax, ay, bx, by, r, pad = 0) {
  const c = Math.cos(r.a), s = Math.sin(r.a);
  const x0 = (ax - r.x) * c + (ay - r.y) * s, y0 = -(ax - r.x) * s + (ay - r.y) * c;
  const x1 = (bx - r.x) * c + (by - r.y) * s, y1 = -(bx - r.x) * s + (by - r.y) * c;
  const hw = r.w / 2 + pad, hd = r.d / 2 + pad;
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dy = y1 - y0;
  for (const [p, q] of [[-dx, x0 + hw], [dx, hw - x0], [-dy, y0 + hd], [dy, hd - y0]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}

/** Loose spatial index (an acceleration structure only; the world has no grid). */
export class Hash {
  constructor(cell = 64) { this.cell = cell; this.map = new Map(); this.stamp = 0; }
  add(x0, y0, x1, y1, item) {
    const c = this.cell;
    for (let gy = Math.floor(y0 / c); gy <= Math.floor(y1 / c); gy++) for (let gx = Math.floor(x0 / c); gx <= Math.floor(x1 / c); gx++) {
      const k = gx * 73856093 ^ gy * 19349663;
      let a = this.map.get(k);
      if (!a) this.map.set(k, (a = []));
      a.push(item);
    }
  }
  /** Items whose cells touch the box (each once). */
  query(x0, y0, x1, y1, out = []) {
    const c = this.cell, st = ++this.stamp;
    out.length = 0;
    for (let gy = Math.floor(y0 / c); gy <= Math.floor(y1 / c); gy++) for (let gx = Math.floor(x0 / c); gx <= Math.floor(x1 / c); gx++) {
      const a = this.map.get(gx * 73856093 ^ gy * 19349663);
      if (a) for (const it of a) if (it._q !== st) { it._q = st; out.push(it); }
    }
    return out;
  }
}
