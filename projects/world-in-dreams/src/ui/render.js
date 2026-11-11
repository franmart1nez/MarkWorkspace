// Painted top-down look after the art bible (zoom 01–03): warm terracotta roofs,
// pale stone, yellow-green fields, dark tree crowns, saturated blue water.
// Static scenery is painted into cached pieces per zoom level; people, animals
// and lights are drawn on top every frame.
import { RW, RIVER_W } from '../engine/layout.js';
import { corners } from '../engine/geom.js';
import { hash01 } from '../engine/noise.js';

const CH = 512;
const TAU = Math.PI * 2;

export const SEASON_LOOK = [
  { grass: '#9bd046', grassA: '#b0dc57', grassB: '#84bf3d', floor: '#6fae3b', tree: ['#2f7d2f', '#357f2c', '#2b7534', '#f0a9c0'], treeHi: ['#58ad3c', '#62b23e', '#4fa540', '#fbd3df'], snow: 0 },
  { grass: '#93c93f', grassA: '#a8d74e', grassB: '#7db838', floor: '#63a336', tree: ['#2c7a2d', '#33802b', '#286f30', '#2f7a36'], treeHi: ['#55a83a', '#5fb03c', '#4a9f3c', '#5aa844'], snow: 0 },
  { grass: '#a9c248', grassA: '#bfd058', grassB: '#93ad3c', floor: '#87a03a', tree: ['#3a7d2c', '#c9772a', '#c9a02c', '#a94f2a'], treeHi: ['#62a83a', '#e79c44', '#e6c350', '#cf6f3c'], snow: 0 },
  { grass: '#dfe9e6', grassA: '#eef4f2', grassB: '#cfdcda', floor: '#c3d3cf', tree: ['#4d7f5c', '#56876a', '#8a7f6c', '#5d8a66'], treeHi: ['#e9f1ee', '#dfeae6', '#cfd6cc', '#eef4f1'], snow: 1 },
];
const ROOF = ['#d2603a', '#c8532f', '#db6f42', '#c05a34'];
const ROOF_D = ['#a94a2d', '#a04126', '#b35834', '#99472a'];
const ROOF_BROWN = ['#96643f', '#855638'], ROOF_BROWN_D = ['#73492d', '#654028'];
const ROOF_BLUE = '#5f8fb0', ROOF_BLUE_D = '#476f8c';
const INK = '#5a2a1c', ROAD = '#ecdcae', ROAD_EDGE = '#b59a66', STONE = '#e4d8b8', STONE_EDGE = '#93835f';
const WATER = '#2f7fd6', WATER_EDGE = '#1e5aa6', WATER_HI = '#7bbaf0';
const AWNING = [['#f4efe2', '#d9634a'], ['#f4efe2', '#e7c355'], ['#f4efe2', '#5f9ad0'], ['#f1e6c8', '#cf8a4a']];

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((pa >> sh) & 255) + (((pb >> sh) & 255) - ((pa >> sh) & 255)) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

export class Painter {
  constructor(L) {
    this.L = L;
    this.cache = new Map();
    this.epoch = 0;
    this.tick = 0;
  }

  /** Mark every cached piece as outdated (season or crops changed); they repaint gradually. */
  invalidate() { this.epoch++; }

  /** Draw the static world for a view {x, y, s}: centre in metres, s in pixels per metre. */
  draw(ctx, view, w, h, look) {
    const lod = Math.max(-4, Math.min(3, Math.round(Math.log2(view.s))));
    const ls = 2 ** lod, size = CH / ls, k = view.s / ls;
    const wx0 = view.x - w / 2 / view.s, wy0 = view.y - h / 2 / view.s;
    const c0 = Math.floor(wx0 / size), c1 = Math.floor((wx0 + w / view.s) / size), r0 = Math.floor(wy0 / size), r1 = Math.floor((wy0 + h / view.s) / size);
    let budget = 2;
    this.tick++;
    ctx.fillStyle = look.pal.grass;
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      const x0 = cx * size, y0 = cy * size;
      if (x0 > this.L.X1 + 200 || x0 + size < this.L.X0 - 200 || y0 > this.L.Y1 + 200 || y0 + size < this.L.Y0 - 200) continue;
      const key = `${lod}:${cx}:${cy}`;
      let c = this.cache.get(key);
      if ((!c || c.epoch !== this.epoch) && budget > 0) {
        budget--;
        if (!c) { c = { cv: document.createElement('canvas') }; c.cv.width = c.cv.height = CH; this.cache.set(key, c); }
        this.paint(c.cv.getContext('2d'), x0, y0, size, ls, look);
        c.epoch = this.epoch;
      }
      if (!c) { this.pending = true; continue; }
      c.used = this.tick;
      const px = Math.round((x0 - wx0) * view.s), py = Math.round((y0 - wy0) * view.s);
      const pw = Math.round((x0 + size - wx0) * view.s) - px, ph = Math.round((y0 + size - wy0) * view.s) - py;
      ctx.drawImage(c.cv, px, py, pw, ph);
    }
    this.pending = budget <= 0;
    if (this.cache.size > 90) {
      const old = [...this.cache.entries()].sort((a, b) => (a[1].used || 0) - (b[1].used || 0)).slice(0, 30);
      for (const [key] of old) this.cache.delete(key);
    }
    return k;
  }

  paint(g, x0, y0, size, ls, look) {
    const L = this.L, pal = look.pal, x1 = x0 + size, y1 = y0 + size, pad = 46;
    const q = [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
    g.setTransform(ls, 0, 0, ls, -x0 * ls, -y0 * ls);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.fillStyle = pal.grass;
    g.fillRect(x0, y0, size, size);

    // painted mottling of the meadows
    const M = 150;
    if (ls >= 0.125) for (let my = Math.floor((y0 - 90) / M); my <= Math.floor((y1 + 90) / M); my++) for (let mx = Math.floor((x0 - 90) / M); mx <= Math.floor((x1 + 90) / M); mx++) {
      for (let i = 0; i < 4; i++) {
        const a = hash01(mx * 7 + i, my * 13 + 1), b = hash01(mx * 11 + 3, my * 5 + i), c = hash01(mx + i * 17, my + 29);
        g.fillStyle = c < 0.5 ? pal.grassA : pal.grassB;
        g.globalAlpha = 0.5;
        g.beginPath();
        g.ellipse((mx + a) * M, (my + b) * M, 30 + c * 55, 18 + a * 36, b * 3, 0, TAU);
        g.fill();
      }
    }
    g.globalAlpha = 1;
    const trees = this.treesIn(q);
    // darker ground under the woods
    g.fillStyle = pal.floor;
    if (ls >= 0.25) {
      g.beginPath();
      for (const i of trees) { const t = L.trees; g.moveTo(t[i] + t[i + 2] * 1.7, t[i + 1]); g.arc(t[i], t[i + 1], t[i + 2] * 1.7, 0, TAU); }
      g.fill();
    }

    for (const r of L.rocks) if (r.x > q[0] - 40 && r.x < q[2] + 40 && r.y > q[1] - 40 && r.y < q[3] + 40) this.rock(g, r, ls, pal);
    for (const f of L.fieldHash.query(...q, [])) this.field(g, f, ls, look);

    // warehouse yard, citadel court
    g.save();
    g.beginPath();
    g.ellipse(0, 0, L.wall.rx - 6, L.wall.ry - 6, 0, 0, TAU);
    g.clip();
    g.fillStyle = pal.snow ? '#e6e2d6' : '#e6d6aa';
    g.beginPath();
    g.ellipse(L.yard.x, L.yard.y, L.yard.r * 0.95, L.yard.r * 0.8, 0.4, 0, TAU);
    g.fill();
    g.restore();

    // roads
    const edges = L.edgeHash.query(...q, []);
    const road = pal.snow ? '#e9e4d6' : ROAD;
    for (const [col, extra] of [[ROAD_EDGE, 1.3], [road, 0]]) for (let k = 0; k < 4; k++) {
      g.strokeStyle = col;
      g.lineWidth = RW[k] + (extra && ls < 0.5 ? extra * 0.5 : extra);
      g.beginPath();
      for (const e of edges) if (e.k === k && !e.bridge) { const A = L.nodes[e.a], B = L.nodes[e.b]; g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); }
      g.stroke();
    }
    // plaza
    const P = L.plaza;
    if (P.x > q[0] - 60 && P.x < q[2] + 60 && P.y > q[1] - 60 && P.y < q[3] + 60) {
      g.fillStyle = road; g.strokeStyle = ROAD_EDGE; g.lineWidth = 0.9;
      g.beginPath(); g.arc(P.x, P.y, P.r + 1.5, 0, TAU); g.fill(); g.stroke();
      g.strokeStyle = '#d8c690'; g.lineWidth = 0.6;
      for (const rr of [10, 18]) { g.beginPath(); g.arc(P.x, P.y, rr, 0, TAU); g.stroke(); }
      g.fillStyle = '#7fb0d8'; g.strokeStyle = STONE_EDGE; g.lineWidth = 0.7;
      g.beginPath(); g.arc(P.x, P.y, 4.2, 0, TAU); g.fill(); g.stroke();
    }
    const c = L.citadel;
    if (c.x > q[0] - 90 && c.x < q[2] + 90 && c.y > q[1] - 90 && c.y < q[3] + 90) {
      g.fillStyle = pal.snow ? '#ece8dc' : '#ead9b0';
      g.beginPath(); for (let i = 0; i < c.pts.length; i += 2) g.lineTo(c.pts[i], c.pts[i + 1]); g.closePath(); g.fill();
      for (const b of c.beds) { g.fillStyle = pal.grassB; g.strokeStyle = '#6a9a3a'; g.lineWidth = 0.5; g.fillRect(b.x - b.w / 2, b.y - b.d / 2, b.w, b.d); g.strokeRect(b.x - b.w / 2, b.y - b.d / 2, b.w, b.d); }
    }

    // water
    const rv = L.river;
    const water = (col, width) => {
      g.strokeStyle = col; g.lineWidth = width;
      g.beginPath();
      let on = false;
      for (let i = 0; i < rv.length; i++) {
        const [x, y] = rv[i];
        if (x < q[0] - 60 || x > q[2] + 60 || y < q[1] - 60 || y > q[3] + 60) { on = false; continue; }
        if (!on && i) g.moveTo(rv[i - 1][0], rv[i - 1][1]);
        g.lineTo(x, y);
        on = true;
      }
      g.stroke();
    };
    water(pal.snow ? '#b9cbd0' : '#5f9a34', RIVER_W + 5);
    water(WATER_EDGE, RIVER_W + 1.6);
    water(WATER, RIVER_W);
    if (ls >= 0.5) {
      g.setLineDash([14, 22]); g.lineDashOffset = 3;
      water(WATER_HI, 1.1);
      g.setLineDash([]);
    }
    for (const p of L.ponds) {
      if (p.x < q[0] - p.r || p.x > q[2] + p.r || p.y < q[1] - p.r || p.y > q[3] + p.r) continue;
      g.beginPath();
      const n = p.pts.length / 2;
      for (let i = 0; i <= n; i++) {
        const a = (i % n) * 2, b = ((i + 1) % n) * 2;
        const mx = (p.pts[a] + p.pts[b]) / 2, my = (p.pts[a + 1] + p.pts[b + 1]) / 2;
        if (!i) g.moveTo(mx, my); else g.quadraticCurveTo(p.pts[a], p.pts[a + 1], mx, my);
      }
      g.fillStyle = WATER; g.strokeStyle = WATER_EDGE; g.lineWidth = 2;
      g.fill(); g.stroke();
    }
    // bridges
    for (const e of edges) if (e.bridge) {
      const A = L.nodes[e.a], B = L.nodes[e.b], wd = RW[e.k] + 2.4;
      for (const [col, wdt] of [[STONE_EDGE, wd + 1.4], [STONE, wd], [road, wd - 2.6]]) { g.strokeStyle = col; g.lineWidth = wdt; g.lineCap = 'butt'; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke(); }
      g.lineCap = 'round';
    }

    // buildings
    const blds = L.bldHash.query(...q, []).sort((a, b) => a.id - b.id);
    if (ls >= 0.5) {
      g.fillStyle = 'rgba(40,50,20,0.28)';
      for (const b of blds) { const c = corners(b); g.beginPath(); for (let i = 0; i < 8; i += 2) g.lineTo(c[i] + 1.3, c[i + 1] + 1.7); g.fill(); }
    }
    for (const b of blds) this.building(g, b, ls, pal);

    // city wall, towers and gates
    if (q[0] < L.wall.rx + 30 && q[2] > -L.wall.rx - 30 && q[1] < L.wall.ry + 30 && q[3] > -L.wall.ry - 30) this.walls(g, ls, pal);

    // trees
    this.trees(g, trees, ls, pal);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  treesIn(q) {
    const L = this.L, c = L.treeCell, out = [];
    for (let gx = Math.floor(q[0] / c); gx <= Math.floor(q[2] / c); gx++) for (let gy = Math.floor(q[1] / c); gy <= Math.floor(q[3] / c); gy++) {
      const a = L.treeMap.get(gx * 4096 + gy);
      if (a) for (const i of a) out.push(i);
    }
    return out;
  }

  trees(g, list, ls, pal) {
    const t = this.L.trees;
    if (ls >= 1) {
      g.fillStyle = 'rgba(30,50,20,0.25)';
      g.beginPath();
      for (const i of list) { g.moveTo(t[i] + 1.4 + t[i + 2], t[i + 1] + 1.9); g.arc(t[i] + 1.4, t[i + 1] + 1.9, t[i + 2], 0, TAU); }
      g.fill();
    }
    for (let v = 0; v < 4; v++) {
      g.fillStyle = pal.tree[v];
      g.strokeStyle = '#1f5526';
      g.lineWidth = ls >= 1 ? 0.5 : 0.9;
      g.beginPath();
      for (const i of list) if (t[i + 3] === v) { g.moveTo(t[i] + t[i + 2], t[i + 1]); g.arc(t[i], t[i + 1], t[i + 2], 0, TAU); }
      if (ls >= 0.25) g.stroke();
      g.fill();
      if (ls < 0.125) continue;
      g.fillStyle = mix(pal.tree[v], pal.treeHi[v], 0.55);
      g.beginPath();
      for (const i of list) if (t[i + 3] === v) { const r = t[i + 2]; g.moveTo(t[i] - r * 0.14 + r * 0.74, t[i + 1] - r * 0.16); g.arc(t[i] - r * 0.14, t[i + 1] - r * 0.16, r * 0.74, 0, TAU); }
      g.fill();
      if (ls < 0.5) continue;
      g.fillStyle = pal.treeHi[v];
      g.beginPath();
      for (const i of list) if (t[i + 3] === v) {
        const r = t[i + 2];
        g.moveTo(t[i] - r * 0.02, t[i + 1] - r * 0.34); g.arc(t[i] - r * 0.3, t[i + 1] - r * 0.34, r * 0.4, 0, TAU);
        if (ls >= 2) { g.moveTo(t[i] + r * 0.5, t[i + 1] - r * 0.02); g.arc(t[i] + r * 0.28, t[i + 1] - r * 0.02, r * 0.22, 0, TAU); }
      }
      g.fill();
    }
  }

  rock(g, r, ls, pal) {
    const n = 9, pts = [];
    for (let i = 0; i < n; i++) {
      const th = (i / n) * TAU, rr = r.r * (0.7 + 0.5 * hash01(r.sd + i, i * 7));
      pts.push(r.x + Math.cos(th) * rr * 1.2, r.y + Math.sin(th) * rr * 0.85);
    }
    const poly = (k, ox, oy) => { g.beginPath(); for (let i = 0; i < pts.length; i += 2) g.lineTo(r.x + (pts[i] - r.x) * k + ox, r.y + (pts[i + 1] - r.y) * k + oy); g.closePath(); };
    g.fillStyle = pal.snow ? '#b9bcc0' : '#a8946f'; g.strokeStyle = '#6f5f45'; g.lineWidth = 1;
    poly(1, 0, 0); g.fill(); g.stroke();
    g.fillStyle = pal.snow ? '#e4e8ea' : '#cdb990';
    poly(0.62, -r.r * 0.16, -r.r * 0.14); g.fill();
    if (ls >= 0.5) { g.fillStyle = pal.snow ? '#f6f8f9' : '#e6d6b0'; poly(0.3, -r.r * 0.26, -r.r * 0.22); g.fill(); }
  }

  field(g, f, ls, look) {
    const st = look.field(f), pal = look.pal;
    const soil = pal.snow ? '#d9dcd2' : '#c4a877';
    let base = soil, stripe = null, gap = 4.5;
    if (f.crop === 'pasture') base = pal.snow ? '#e6eeea' : mix(pal.grassA, '#c2e26e', 0.5);
    else if (f.crop === 'orchard') base = pal.snow ? '#e3ebe7' : mix(pal.grass, '#b4d85a', 0.5);
    else if (st.st === 0) { stripe = pal.snow ? '#c5c8bd' : '#a98d5f'; if (st.work > 0) base = mix(soil, '#9c7f52', Math.min(1, st.work)); } else if (st.st === 3) { base = pal.snow ? '#dfe2d6' : '#dccb8c'; stripe = pal.snow ? '#cdd0c4' : '#c3ae6c'; gap = 6; } else if (f.crop === 'grain') {
      base = st.st === 2 ? mix('#edd052', '#dccb8c', st.work) : mix('#a6d150', '#ecd052', Math.min(1, st.g * 1.1));
      stripe = st.st === 2 ? '#d9b63c' : mix('#8cc043', '#dcbb42', st.g); gap = 3.2;
    } else { base = mix(soil, '#a9c95a', 0.35 + 0.4 * st.g); stripe = st.st === 2 ? mix('#3f9338', soil, st.work) : mix('#7fb548', '#3f9338', st.g); gap = 5; }
    g.save();
    g.translate(f.x, f.y);
    g.rotate(f.a);
    g.fillStyle = base;
    g.fillRect(-f.w / 2, -f.d / 2, f.w, f.d);
    if (stripe && ls >= 0.5) {
      g.strokeStyle = stripe; g.lineWidth = f.crop === 'veg' && st.st ? 1.7 : 0.8; g.lineCap = 'butt';
      g.beginPath();
      for (let y = -f.d / 2 + gap * 0.6; y < f.d / 2 - 1; y += gap) { g.moveTo(-f.w / 2 + 1.5, y); g.lineTo(f.w / 2 - 1.5, y); }
      g.stroke();
      g.lineCap = 'round';
    }
    if (f.crop === 'orchard' && ls >= 0.25) {
      const fruit = st.st === 2 && !pal.snow;
      for (const [col, rr, off] of [['#1f5526', 3.1, 0], [pal.tree[f.look % 3 === 0 && look.season === 0 ? 3 : 0], 2.8, 0], [fruit ? '#e7913c' : pal.treeHi[look.season === 0 ? 3 : 0], 1.3, -0.8]]) {
        g.fillStyle = col;
        g.beginPath();
        for (let y = -f.d / 2 + 6; y < f.d / 2 - 4; y += 9.5) for (let x = -f.w / 2 + 6; x < f.w / 2 - 4; x += 9.5) { g.moveTo(x + off + rr, y + off); g.arc(x + off, y + off, rr, 0, TAU); }
        g.fill();
      }
    }
    g.strokeStyle = f.crop === 'pasture' ? '#8a6a44' : pal.snow ? '#9db0a2' : '#5f9a35';
    g.lineWidth = f.crop === 'pasture' ? 0.7 : 1.5;
    if (f.crop === 'pasture') g.setLineDash([2.5, 1.6]);
    g.strokeRect(-f.w / 2, -f.d / 2, f.w, f.d);
    g.setLineDash([]);
    g.restore();
  }

  building(g, b, ls, pal) {
    const hw = b.w / 2, hd = b.d / 2;
    g.save();
    g.translate(b.x, b.y);
    g.rotate(b.a);
    if (b.k === 'stall') {
      const [c1, c2] = AWNING[b.id % AWNING.length];
      g.fillStyle = c1; g.fillRect(-hw, -hd, b.w, b.d);
      g.fillStyle = c2;
      for (let x = -hw; x < hw - 0.1; x += b.w / 3) g.fillRect(x, -hd, b.w / 6, b.d);
      g.strokeStyle = INK; g.lineWidth = 0.35; g.strokeRect(-hw, -hd, b.w, b.d);
      g.restore();
      return;
    }
    const brown = b.k === 'warehouse' || b.k === 'granary' || b.k === 'barn' || b.k === 'shed';
    const blue = b.k === 'temple' || b.k === 'chapel';
    let hi = brown ? ROOF_BROWN[b.roof % 2] : blue ? ROOF_BLUE : ROOF[b.roof], lo = brown ? ROOF_BROWN_D[b.roof % 2] : blue ? ROOF_BLUE_D : ROOF_D[b.roof];
    if (b.k === 'keep' || b.k === 'townhall') { hi = '#c9503a'; lo = '#9c3a2a'; }
    if (pal.snow) { hi = mix(hi, '#f4f7f8', 0.62); lo = mix(lo, '#dfe6ea', 0.5); }
    // the roof face turned to the north-west light is the bright one
    const lit = Math.sin(b.a) - Math.cos(b.a) > 0;
    if (ls < 0.25) { g.fillStyle = hi; g.fillRect(-hw, -hd, b.w, b.d); g.restore(); return; }
    const hip = ls >= 1 ? Math.min(hd * 0.8, hw * 0.5) : 0;
    g.fillStyle = lit ? lo : hi;
    g.fillRect(-hw, -hd, b.w, hd);
    g.fillStyle = lit ? hi : lo;
    g.fillRect(-hw, 0, b.w, hd);
    if (hip) {
      const west = Math.cos(b.a) + Math.sin(b.a) > 0;
      g.fillStyle = mix(hi, lo, west ? 0.25 : 0.75);
      g.beginPath(); g.moveTo(-hw, -hd); g.lineTo(-hw + hip, 0); g.lineTo(-hw, hd); g.fill();
      g.fillStyle = mix(hi, lo, west ? 0.75 : 0.25);
      g.beginPath(); g.moveTo(hw, -hd); g.lineTo(hw - hip, 0); g.lineTo(hw, hd); g.fill();
    }
    g.strokeStyle = INK;
    g.lineWidth = ls >= 1 ? 0.45 : 0.8;
    g.strokeRect(-hw, -hd, b.w, b.d);
    if (ls >= 0.5) {
      g.lineWidth = 0.35;
      g.beginPath(); g.moveTo(-hw + hip, 0); g.lineTo(hw - hip, 0);
      if (hip) { g.moveTo(-hw, -hd); g.lineTo(-hw + hip, 0); g.lineTo(-hw, hd); g.moveTo(hw, -hd); g.lineTo(hw - hip, 0); g.lineTo(hw, hd); }
      g.stroke();
    }
    if (ls >= 2) {
      // tile rows and a chimney
      g.strokeStyle = 'rgba(90,40,28,0.28)'; g.lineWidth = 0.18;
      g.beginPath();
      for (let y = -hd + 1.3; y < hd; y += 1.3) { if (Math.abs(y) < 0.4) continue; const cut = hip * (1 - Math.abs(y) / hd); g.moveTo(-hw + cut + 0.3, y); g.lineTo(hw - cut - 0.3, y); }
      g.stroke();
      if (b.k === 'house' || b.k === 'shop' || b.k === 'tavern' || b.k === 'farmhouse') {
        g.fillStyle = '#e8dcc0'; g.strokeStyle = INK; g.lineWidth = 0.25;
        const cx = (hash01(b.id, 3) - 0.5) * b.w * 0.5, cy = hd * 0.45 * (b.id % 2 ? 1 : -1);
        g.fillRect(cx - 0.7, cy - 0.7, 1.4, 1.4); g.strokeRect(cx - 0.7, cy - 0.7, 1.4, 1.4);
      }
    }
    if (b.k === 'temple' || b.k === 'chapel' || b.k === 'keep' || b.k === 'townhall' || b.k === 'guild') {
      // a tower or spire marks the public buildings
      const tr = b.k === 'chapel' ? 2.2 : b.k === 'guild' ? 2.6 : 4.2, tx = b.k === 'keep' ? 0 : -hw + tr + 1;
      g.fillStyle = b.k === 'guild' ? '#e9c04e' : pal.snow ? '#eef1f2' : STONE; g.strokeStyle = INK; g.lineWidth = 0.4;
      g.beginPath(); g.arc(tx, 0, tr, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = blue ? ROOF_BLUE_D : '#b8432e';
      g.beginPath(); g.arc(tx, 0, tr * 0.55, 0, TAU); g.fill();
    }
    g.restore();
  }

  walls(g, ls, pal) {
    const L = this.L, { rx, ry } = L.wall, stone = pal.snow ? '#eef0ee' : STONE;
    for (const [col, wd] of [[STONE_EDGE, 9.6], [stone, 8], ['#f1e7cc', 3.4]]) { g.strokeStyle = col; g.lineWidth = wd; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.stroke(); }
    const c = L.citadel;
    for (const [col, wd] of [[STONE_EDGE, 5.4], [stone, 4.2]]) { g.strokeStyle = col; g.lineWidth = wd; g.beginPath(); for (let i = 0; i < c.pts.length; i += 2) g.lineTo(c.pts[i], c.pts[i + 1]); g.closePath(); g.stroke(); }
    g.strokeStyle = pal.snow ? '#ece8dc' : '#ead9b0'; g.lineWidth = 6; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(c.gate.x - Math.cos(c.gate.a) * 6, c.gate.y - Math.sin(c.gate.a) * 6); g.lineTo(c.gate.x + Math.cos(c.gate.a) * 2, c.gate.y + Math.sin(c.gate.a) * 2); g.stroke();
    g.lineCap = 'round';
    g.strokeStyle = INK; g.lineWidth = 0.5;
    for (let i = 0; i < c.pts.length; i += 2) {
      g.fillStyle = stone; g.beginPath(); g.arc(c.pts[i], c.pts[i + 1], 6.2, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#c9553a'; g.beginPath(); g.arc(c.pts[i], c.pts[i + 1], 3.6, 0, TAU); g.fill();
    }
    for (const t of L.towers) {
      g.save(); g.translate(t.x, t.y); g.rotate(t.a);
      g.fillStyle = stone; g.strokeStyle = STONE_EDGE; g.lineWidth = 0.8;
      g.fillRect(-7, -7, 14, 14); g.strokeRect(-7, -7, 14, 14);
      if (ls >= 0.5) { g.strokeStyle = '#cdbf9a'; g.lineWidth = 0.6; g.strokeRect(-4.4, -4.4, 8.8, 8.8); }
      g.restore();
    }
    const road = pal.snow ? '#e9e4d6' : ROAD;
    for (const gt of L.gates) {
      g.save(); g.translate(gt.x, gt.y); g.rotate(Math.atan2(gt.oy, gt.ox));
      g.fillStyle = road; g.fillRect(-6, -4, 12, 8);
      for (const sd of [-1, 1]) {
        g.fillStyle = stone; g.strokeStyle = STONE_EDGE; g.lineWidth = 0.8;
        g.fillRect(-8, sd * 11 - 7, 16, 14); g.strokeRect(-8, sd * 11 - 7, 16, 14);
        g.fillStyle = pal.snow ? '#e9c9c0' : '#c9553a'; g.strokeStyle = INK; g.lineWidth = 0.4;
        g.fillRect(-5.5, sd * 11 - 4.5, 11, 9); g.strokeRect(-5.5, sd * 11 - 4.5, 11, 9);
      }
      g.fillStyle = pal.snow ? '#e9c9c0' : '#b8472f';
      g.fillRect(-4, -4.2, 8, 8.4); g.strokeRect(-4, -4.2, 8, 8.4);
      g.restore();
    }
  }
}

// ---- the living things, drawn every frame ----------------------------------------

export const CLOTH = {
  farm: '#8a6b3f', guard: '#4d6fae', stall: '#c2843a', cart: '#7b5a3a', hunt: '#4f7a45', fish: '#4f8f9a', wood: '#7a4f34', herd: '#b9a26a',
  adv: '#b23a48', in: '#9a7f9c', home: '#c98b6a', none: '#d8b860', labour: '#8f8a78', trade: '#7d4fa0', noble: '#8e3fa8', holy: '#f1ede2',
};
const HAIR = ['#3a2a1c', '#6b4a2a', '#c9a455', '#1f1a18', '#a8552a', '#d9d2c4', '#e79ab0', '#7fb6e0'];
export const hairOf = (p) => HAIR[(p.id * 7 + p.fam.length) % (p.sp === 'human' ? 6 : 8)];

export function drawPerson(g, sx, sy, s, p, type, heading, selected) {
  const r = Math.max(1.5, 0.95 * s);
  if (s < 1.4) {
    g.fillStyle = CLOTH[type] || '#c98b6a';
    g.fillRect(sx - r * 0.7, sy - r * 0.7, r * 1.4, r * 1.4);
    return;
  }
  const small = p.age < 14 ? 0.72 : 1, rr = r * small;
  g.fillStyle = 'rgba(20,30,10,0.3)';
  g.beginPath(); g.ellipse(sx + rr * 0.35, sy + rr * 0.45, rr, rr * 0.8, 0, 0, TAU); g.fill();
  if (p.cart && s >= 1.4) {
    const c = Math.cos(heading), sn = Math.sin(heading);
    g.save(); g.translate(sx, sy); g.rotate(heading);
    g.fillStyle = '#8a5f3a'; g.strokeStyle = '#3d2716'; g.lineWidth = Math.max(0.6, 0.18 * s);
    g.fillRect(-4.6 * s, -1.25 * s, 3.4 * s, 2.5 * s); g.strokeRect(-4.6 * s, -1.25 * s, 3.4 * s, 2.5 * s);
    if (p.load > 0) { g.fillStyle = '#e3cf8a'; g.fillRect(-4.2 * s, -0.9 * s, 2.6 * s, 1.8 * s); }
    g.fillStyle = '#7a5a40'; g.beginPath(); g.ellipse(2.4 * s, 0, 1.5 * s, 0.75 * s, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#5c4230'; g.beginPath(); g.arc(3.9 * s, 0, 0.55 * s, 0, TAU); g.fill();
    g.restore();
    void c; void sn;
  }
  g.fillStyle = CLOTH[type] || '#c98b6a';
  g.strokeStyle = selected ? '#fff' : '#2a1d14';
  g.lineWidth = Math.max(0.7, 0.16 * s);
  g.beginPath(); g.arc(sx, sy, rr, 0, TAU); g.fill(); g.stroke();
  if (s >= 2.4) {
    g.fillStyle = hairOf(p);
    g.beginPath(); g.arc(sx + Math.cos(heading) * rr * 0.18, sy + Math.sin(heading) * rr * 0.18, rr * 0.56, 0, TAU); g.fill();
    if (p.sp === 'catfolk' || p.sp === 'foxfolk') {
      // two ears make the beastfolk readable from above
      for (const sd of [-1, 1]) { g.beginPath(); g.arc(sx + Math.cos(heading + sd * 0.9) * rr * 0.62, sy + Math.sin(heading + sd * 0.9) * rr * 0.62, rr * 0.22, 0, TAU); g.fill(); }
    }
  }
}

const BEAST = {
  deer: ['#b9854f', '#7a5230', 1.25, 0.6], boar: ['#5f4634', '#33241a', 1.15, 0.7], wolf: ['#8a8f96', '#3d4147', 1.15, 0.52],
  rabbit: ['#e6dccb', '#8a7a66', 0.5, 0.36], sheep: ['#f4f1e8', '#8f8a7c', 0.95, 0.75], slime: ['#58c3ee', '#2a7fb0', 0.85, 0.8],
};
export function drawAnimal(g, sx, sy, s, a, heading, time) {
  const [fill, ink, len, wid] = BEAST[a.k];
  const k = Math.max(s, 1.5 / len);
  if (s < 0.5 && a.k !== 'wolf') { g.fillStyle = fill; g.fillRect(sx - 1, sy - 1, 2, 2); return; }
  g.save();
  g.translate(sx, sy);
  if (a.k === 'slime') {
    const wob = 1 + 0.12 * Math.sin(time / 260 + a.id);
    g.fillStyle = 'rgba(20,40,60,0.25)'; g.beginPath(); g.ellipse(0.2 * k, 0.3 * k, len * k, wid * k * 0.9, 0, 0, TAU); g.fill();
    g.fillStyle = fill; g.strokeStyle = ink; g.lineWidth = Math.max(0.6, 0.12 * k); g.globalAlpha = 0.9;
    g.beginPath(); g.ellipse(0, 0, len * k * wob, wid * k / wob, 0, 0, TAU); g.fill(); g.stroke();
    g.globalAlpha = 1; g.fillStyle = '#d9f3ff'; g.beginPath(); g.arc(-0.3 * k, -0.25 * k, 0.2 * k, 0, TAU); g.fill();
    g.restore();
    return;
  }
  g.rotate(heading);
  g.fillStyle = 'rgba(20,30,10,0.28)'; g.beginPath(); g.ellipse(0.25 * k, 0.35 * k, len * k, wid * k, 0, 0, TAU); g.fill();
  g.fillStyle = fill; g.strokeStyle = ink; g.lineWidth = Math.max(0.6, 0.12 * k);
  g.beginPath(); g.ellipse(0, 0, len * k, wid * k, 0, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = a.k === 'sheep' ? '#3d3a36' : fill;
  g.beginPath(); g.ellipse(len * k * 0.95, 0, len * k * 0.36, wid * k * 0.6, 0, 0, TAU); g.fill(); g.stroke();
  if (a.k === 'deer' && s >= 3) { g.strokeStyle = '#e9dcc0'; g.lineWidth = 0.14 * k; g.beginPath(); for (const sd of [-1, 1]) { g.moveTo(len * k * 1.1, sd * 0.2 * k); g.lineTo(len * k * 1.45, sd * 0.6 * k); } g.stroke(); }
  g.restore();
}

/** Darkness for a minute of the day, 0 at noon to about 0.6 in deep night. */
export function nightOf(minute) {
  const h = minute / 60;
  if (h >= 6.5 && h <= 18) return 0;
  if (h > 18 && h < 20.5) return ((h - 18) / 2.5) * 0.6;
  if (h >= 4.5 && h < 6.5) return (1 - (h - 4.5) / 2) * 0.6;
  return 0.6;
}

let glow = null;
export function glowSprite() {
  if (glow) return glow;
  glow = document.createElement('canvas');
  glow.width = glow.height = 64;
  const g = glow.getContext('2d'), gr = g.createRadialGradient(32, 32, 1, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,214,130,0.95)');
  gr.addColorStop(0.35, 'rgba(255,176,80,0.4)');
  gr.addColorStop(1, 'rgba(255,150,60,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return glow;
}
