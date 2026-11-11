// Wildlife and livestock: animals move freely over open ground in herds.
// Deer, boar and rabbits graze and flee; wolves hunt at night; sheep keep to
// their pasture; slimes drift over the meadows.
import { rand, randInt, chance } from './rng.js';
import { DAY, seasonOf, dayOf, log } from './core.js';
import { hyp } from './geom.js';
import { die, wound, fullName } from './fate.js';

/** Speeds in metres per minute, the distance at which prey bolts, the herd size limit. */
export const BEASTS = {
  deer: { name: 'Deer', walk: 26, run: 360, flee: 95, cap: 10, meat: 70 },
  boar: { name: 'Boar', walk: 20, run: 280, flee: 55, cap: 7, meat: 95 },
  rabbit: { name: 'Rabbit', walk: 18, run: 240, flee: 34, cap: 10, meat: 9 },
  wolf: { name: 'Wolf', walk: 50, run: 300, flee: 0, cap: 8, meat: 0 },
  sheep: { name: 'Sheep', walk: 9, run: 90, flee: 0, cap: 9, meat: 40 },
  slime: { name: 'Slime', walk: 4, run: 4, flee: 0, cap: 14, meat: 0 },
};
const ROAM = { deer: 260, boar: 200, rabbit: 45, slime: 130, wolf: 0, sheep: 0 };

export function addAnimal(S, h, x, y) {
  const a = { id: S.nextA++, k: h.k, h: h.id, x, y, tx: x, ty: y, st: 0, until: S.t + randInt(S, 0, 30) };
  S.animals.push(a);
  h.n++;
  return a;
}

export function addHerd(S, L, k, spot, n, r, field) {
  const h = { id: S.herds.length, k, x: spot.x, y: spot.y, hx: spot.x, hy: spot.y, r, n: 0, st: 'idle', until: 0, tx: spot.x, ty: spot.y, fed: S.t - DAY, tg: -1, field: field ? field.id : -1, site: field ? field.site : -1, hit: -1 };
  S.herds.push(h);
  for (let i = 0; i < n; i++) {
    const th = rand(S) * 6.283, rr = r * Math.sqrt(rand(S));
    addAnimal(S, h, spot.x + Math.cos(th) * rr, spot.y + Math.sin(th) * rr);
  }
  return h;
}

/** Remove up to n animals of a herd, those nearest to (x, y) first. Returns how many. */
export function cull(S, h, n, x = h.x, y = h.y) {
  const mine = S.animals.filter((a) => a.h === h.id).sort((a, b) => hyp(a.x, a.y, x, y) - hyp(b.x, b.y, x, y)).slice(0, n);
  if (!mine.length) return 0;
  const gone = new Set(mine.map((a) => a.id));
  S.animals = S.animals.filter((a) => !gone.has(a.id));
  h.n -= mine.length;
  return mine.length;
}

const nearSite = (L, x, y, pad = 0) => L.sites.some((s) => hyp(x, y, s.x, s.y) < s.r + pad);

function wolfAttack(S, L, h, p) {
  const armed = p.job === 'hunter' || p.job === 'adventurer' || p.job === 'guard';
  const r = rand(S), site = S.sites[p.site], where = L.sites[p.site] ? L.sites[p.site].name : 'the road';
  if (site) site.fear = Math.min(100, site.fear + 35);
  h.hit = dayOf(S.t);
  if (armed) {
    if (r < 0.4) { cull(S, h, 1, p.x, p.y); log(S, 'wild', 1, `${fullName(p)} killed a wolf that came at them near ${where}.`, p.x, p.y, p.id); } else if (r < 0.55) { wound(S, L, p, 3, 'Mauled by wolves.'); log(S, 'wild', 1, `${fullName(p)} was mauled by wolves near ${where}.`, p.x, p.y, p.id); }
    return;
  }
  if (r < 0.1) die(S, L, p, 'was killed by wolves', 2);
  else if (r < 0.6) { wound(S, L, p, 3, 'Mauled by wolves.'); log(S, 'wild', 1, `Wolves attacked ${fullName(p)} near ${where}; ${p.sex === 'f' ? 'she' : 'he'} escaped wounded.`, p.x, p.y, p.id); }
}

function packThink(S, L, h) {
  const t = S.t, m = t % DAY, night = m >= 19 * 60 || m < 5 * 60;
  if (h.n <= 0) return;
  if (h.st === 'idle') {
    if (!night || t < h.until || t - h.fed < 1.6 * DAY) return;
    const near = (k) => S.herds.filter((q) => q.k === k && q.n > 0 && hyp(q.x, q.y, h.hx, h.hy) < 3200).sort((a, b) => hyp(a.x, a.y, h.x, h.y) - hyp(b.x, b.y, h.x, h.y));
    const deer = near('deer'), sheep = near('sheep');
    const lean = seasonOf(t) === 3 || deer.reduce((a, q) => a + q.n, 0) < 8;
    const prey = (lean && sheep.length && chance(S, 0.5)) || !deer.length ? sheep[randInt(S, 0, Math.min(2, sheep.length - 1))] : deer[0];
    if (!prey) { h.until = t + 120; return; }
    h.tg = prey.id; h.st = 'hunt'; h.tx = prey.x; h.ty = prey.y;
    return;
  }
  if (h.st === 'hunt') {
    const prey = S.herds[h.tg];
    if (!night || !prey || prey.n <= 0) { h.st = 'back'; h.tx = h.hx; h.ty = h.hy; return; }
    h.tx = prey.x; h.ty = prey.y;
    if (h.hit !== dayOf(t)) {
      for (const p of S.people) {
        if (!p.alive || p.away || p.in >= 0 || hyp(p.x, p.y, h.x, h.y) > 75 || nearSite(L, p.x, p.y)) continue;
        wolfAttack(S, L, h, p);
        break;
      }
    }
    if (hyp(h.x, h.y, prey.x, prey.y) > 60) return;
    h.fed = t; h.st = 'feed'; h.until = t + 80;
    if (prey.k === 'deer') {
      if (chance(S, 0.5)) { cull(S, prey, 1, h.x, h.y); log(S, 'wild', 0, 'The wolves brought down a deer in the night.', h.x, h.y); }
      return;
    }
    const site = S.sites[prey.site], name = L.sites[prey.site] ? L.sites[prey.site].name : 'a farm';
    if (chance(S, 0.35)) { log(S, 'wild', 0, `Dogs drove the wolves from a fold near ${name}.`, h.x, h.y); return; }
    const n = cull(S, prey, randInt(S, 1, 2), h.x, h.y);
    if (site) site.fear = Math.min(100, site.fear + 30);
    log(S, 'wild', 1, `Wolves broke into a fold near ${name} and killed ${n} sheep.`, h.x, h.y);
    return;
  }
  if (h.st === 'feed') { if (t >= h.until) { h.st = 'back'; h.tx = h.hx; h.ty = h.hy; } return; }
  if (h.st === 'back' && hyp(h.x, h.y, h.hx, h.hy) < 40) { h.st = 'idle'; h.until = t + 60; }
}

function herdThink(S, L, h) {
  if (h.k === 'wolf') return packThink(S, L, h);
  const roam = ROAM[h.k];
  if (!roam || S.t < h.until) return;
  h.until = S.t + randInt(S, 90, 320);
  const th = rand(S) * 6.283, rr = roam * Math.sqrt(rand(S)), x = h.hx + Math.cos(th) * rr, y = h.hy + Math.sin(th) * rr;
  if (L.open(x, y) && !nearSite(L, x, y, 60) && !L.riverCross(h.x, h.y, x, y)) { h.x = x; h.y = y; }
}

/** One minute of animal life. `folk` are the people out in the wild: [{x, y}]. */
export function stepWild(S, L, folk) {
  const t = S.t, m = t % DAY, dark = m >= 20 * 60 || m < 5 * 60;
  for (const h of S.herds) {
    if ((t + h.id) % 10 === 0) herdThink(S, L, h);
    if (h.k === 'wolf' && (h.st === 'hunt' || h.st === 'back')) {
      const d = hyp(h.x, h.y, h.tx, h.ty), sp = 95;
      if (d > 1) {
        const nx = h.x + ((h.tx - h.x) / d) * Math.min(sp, d), ny = h.y + ((h.ty - h.y) / d) * Math.min(sp, d);
        if (!L.inWall(nx, ny, -25)) { h.x = nx; h.y = ny; } else { h.st = 'back'; h.tx = h.hx; h.ty = h.hy; }
      }
    }
  }
  const threats = folk;
  for (const h of S.herds) if (h.k === 'wolf' && h.st !== 'idle' && h.n > 0) threats.push(h);
  for (const a of S.animals) {
    const B = BEASTS[a.k], h = S.herds[a.h];
    if (a.st) {
      const sp = a.st === 2 ? B.run : B.walk, dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      if (d <= sp) { a.x = a.tx; a.y = a.ty; a.st = 0; a.until = t + (h.k === 'wolf' && h.st !== 'idle' ? 1 : randInt(S, 3, 30)); } else { a.x += (dx / d) * sp; a.y += (dy / d) * sp; }
    } else if (t >= a.until) {
      const busy = h.k === 'wolf' && h.st !== 'idle';
      const still = (dark && a.k !== 'wolf' && a.k !== 'slime') || (!dark && a.k === 'wolf' && !busy);
      const th = rand(S) * 6.283, rr = h.r * (still ? 0.25 : busy ? 0.4 : 1) * Math.sqrt(rand(S));
      const x = h.x + Math.cos(th) * rr, y = h.y + Math.sin(th) * rr;
      if (still && hyp(a.x, a.y, h.x, h.y) < h.r * 0.3) a.until = t + randInt(S, 30, 90);
      else if (busy || (L.open(x, y) && !L.riverCross(a.x, a.y, x, y))) { a.tx = x; a.ty = y; a.st = busy || hyp(a.x, a.y, x, y) > h.r * 2 ? 2 : 1; } else a.until = t + 6;
    }
    if (B.flee && a.st !== 2 && (t + a.id) % 3 === 0) {
      for (const q of threats) {
        const d = hyp(a.x, a.y, q.x, q.y);
        if (d > B.flee || d < 0.01) continue;
        const ux = (a.x - q.x) / d, uy = (a.y - q.y) / d, far = 150 + rand(S) * 110;
        for (const turn of [0, 0.9, -0.9]) {
          const c = Math.cos(turn), s = Math.sin(turn), x = a.x + (ux * c - uy * s) * far, y = a.y + (ux * s + uy * c) * far;
          if (!L.open(x, y) || L.riverCross(a.x, a.y, x, y)) continue;
          a.tx = x; a.ty = y; a.st = 2;
          if (hyp(h.x + ux * 45, h.y + uy * 45, h.hx, h.hy) < 520 && L.open(h.x + ux * 45, h.y + uy * 45)) { h.x += ux * 45; h.y += uy * 45; }
          break;
        }
        break;
      }
    }
  }
}

/** Once a day: breeding by season, wool and milk from the flocks, new packs. */
export function wildDay(S, L) {
  const season = seasonOf(S.t), day = dayOf(S.t);
  for (const h of S.herds) {
    const B = BEASTS[h.k];
    const born = () => { const th = rand(S) * 6.283; addAnimal(S, h, h.x + Math.cos(th) * 6, h.y + Math.sin(th) * 6); };
    if (h.k === 'sheep') {
      if (S.sites[h.site]) S.sites[h.site].food += h.n * 0.9;
      if (season === 0 && h.n >= 2 && h.n < B.cap && chance(S, 0.3)) born();
      else if (h.n < 2 && chance(S, 0.08)) { born(); born(); born(); } // the village buys new ewes
    } else if (h.k === 'slime') {
      if (h.n < B.cap && chance(S, h.n ? 0.2 : 0.05)) born();
    } else if (h.k === 'wolf') {
      if (h.n > 0 && h.n < 6 && season === 0 && chance(S, 0.2)) born();
      if (h.n <= 0 && S.wolfBack === 0) S.wolfBack = day + randInt(S, 20, 40);
      if (h.n <= 0 && S.wolfBack && day >= S.wolfBack) {
        S.wolfBack = 0; h.x = h.hx; h.y = h.hy; h.st = 'idle';
        for (let i = 0; i < 4; i++) born();
        log(S, 'wild', 1, 'A new wolf pack has moved into the deep woods.', h.x, h.y);
      }
    } else if (h.n < B.cap && season < 3) {
      const rate = h.k === 'rabbit' ? 0.22 : season === 0 ? 0.3 : 0.1;
      if (h.n >= 2 ? chance(S, rate) : chance(S, 0.04)) born();
    }
  }
}
