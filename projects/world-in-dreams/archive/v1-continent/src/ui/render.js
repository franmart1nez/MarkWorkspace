// Canvas drawing for the top-down view. Reads the world, never changes it.
import { BIOMES, B, KIND, SP } from '../engine/index.js';

export const TILE = 8; // pixels per tile in the pre-rendered terrain

function hash(x, y, k = 0) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(k + 7, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const shade = (c, f) => `rgb(${c.map((v) => Math.max(0, Math.min(255, Math.round(v * f)))).join(',')})`;

export function buildTerrain(map) {
  const { w, h, biome, river } = map;
  const cv = document.createElement('canvas');
  cv.width = w * TILE;
  cv.height = h * TILE;
  const g = cv.getContext('2d');
  const rgb = BIOMES.map((b) => hex(b.color));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const b = biome[y * w + x];
    g.fillStyle = shade(rgb[b], 0.94 + hash(x, y) * 0.12);
    g.fillRect(x * TILE, y * TILE, TILE, TILE);
  }
  const water = (x, y) => x < 0 || y < 0 || x >= w || y >= h || biome[y * w + x] <= B.SHALLOWS;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const b = biome[y * w + x];
    const px = x * TILE, py = y * TILE;
    const r1 = hash(x, y, 1), r2 = hash(x, y, 2), r3 = hash(x, y, 3);
    const tri = (fill, tip) => {
      const cx = px + 4 + (r1 - 0.5) * 2;
      g.fillStyle = fill;
      g.beginPath(); g.moveTo(cx - 4, py + 7.5); g.lineTo(cx, py + 0.5); g.lineTo(cx + 4, py + 7.5); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.beginPath(); g.moveTo(cx, py + 0.5); g.lineTo(cx + 4, py + 7.5); g.lineTo(cx + 0.8, py + 7.5); g.fill();
      if (tip) { g.fillStyle = tip; g.beginPath(); g.moveTo(cx - 1.3, py + 2.8); g.lineTo(cx, py + 0.5); g.lineTo(cx + 1.3, py + 2.8); g.fill(); }
    };
    const blobs = (n, color, rad) => {
      g.fillStyle = color;
      for (let i = 0; i < n; i++) {
        g.beginPath();
        g.arc(px + 1.5 + hash(x, y, 10 + i) * 5, py + 1.5 + hash(x, y, 20 + i) * 5, rad, 0, 6.3);
        g.fill();
      }
    };
    switch (b) {
      case B.FOREST: blobs(2, 'rgba(30,80,35,0.75)', 1.7); break;
      case B.DEEPWOOD: blobs(3, 'rgba(14,48,26,0.8)', 1.9); break;
      case B.ENCHANTED: blobs(2, 'rgba(20,110,95,0.8)', 1.8); if (r3 > 0.55) { g.fillStyle = '#d8fff0'; g.fillRect(px + r1 * 6, py + r2 * 6, 1, 1); } break;
      case B.HILLS: g.strokeStyle = 'rgba(70,65,30,0.5)'; g.lineWidth = 1; g.beginPath(); g.arc(px + 4, py + 6 + r1, 3, 3.5, 5.9); g.stroke(); break;
      case B.MOUNTAIN: tri('#77726a'); break;
      case B.PEAK: tri('#8d8a86', '#ffffff'); break;
      case B.VOLCANO: tri('#3d2a28', '#ff6a2a'); break;
      case B.SWAMP: g.fillStyle = 'rgba(30,50,40,0.45)'; g.fillRect(px + r1 * 4, py + 2 + r2 * 4, 3, 1); g.fillRect(px + r2 * 4, py + 5, 2, 1); break;
      case B.DESERT: g.fillStyle = 'rgba(150,120,60,0.5)'; g.fillRect(px + r1 * 6, py + r2 * 6, 1, 1); g.fillRect(px + r3 * 6, py + r1 * 6, 1, 1); break;
      case B.TUNDRA: if (r1 > 0.5) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(px + r2 * 6, py + r3 * 6, 2, 1); } break;
      case B.DARKLANDS: g.strokeStyle = 'rgba(20,8,28,0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px + 2 + r1 * 4, py + 7); g.lineTo(px + 2 + r1 * 4 + (r2 - 0.5) * 2, py + 2 + r3 * 2); g.stroke(); break;
      case B.STEPPE: if (r1 > 0.6) { g.fillStyle = 'rgba(110,105,50,0.5)'; g.fillRect(px + r2 * 6, py + r3 * 6, 2, 1); } break;
      case B.OCEAN: case B.SHALLOWS: if (r1 > 0.86) { g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(px + r2 * 4, py + r3 * 6, 3, 1); } break;
      default: if (r1 > 0.8) { g.fillStyle = 'rgba(60,110,40,0.45)'; g.fillRect(px + r2 * 6, py + r3 * 6, 1, 2); }
    }
    if (b > B.SHALLOWS) {
      g.fillStyle = 'rgba(15,35,60,0.55)';
      if (water(x - 1, y)) g.fillRect(px, py, 1, TILE);
      if (water(x + 1, y)) g.fillRect(px + TILE - 1, py, 1, TILE);
      if (water(x, y - 1)) g.fillRect(px, py, TILE, 1);
      if (water(x, y + 1)) g.fillRect(px, py + TILE - 1, TILE, 1);
    }
  }
  g.strokeStyle = '#3f83c4';
  g.lineWidth = 2;
  g.lineCap = 'round';
  g.beginPath();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!river[y * w + x]) continue;
    const cx = x * TILE + 4, cy = y * TILE + 4;
    let linked = false;
    if (x < w - 1 && river[y * w + x + 1]) { g.moveTo(cx, cy); g.lineTo(cx + TILE, cy); linked = true; }
    if (y < h - 1 && river[(y + 1) * w + x]) { g.moveTo(cx, cy); g.lineTo(cx, cy + TILE); linked = true; }
    if (!linked) { g.moveTo(cx - 2, cy); g.lineTo(cx + 2, cy); }
  }
  g.stroke();
  return cv;
}

export function buildRoads(state, map) {
  const { w } = map;
  const cv = document.createElement('canvas');
  cv.width = w * TILE;
  cv.height = map.h * TILE;
  const g = cv.getContext('2d');
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const pass = (trail) => {
    for (const e of state.edges) {
      if (!!e.trail !== trail) continue;
      for (let i = 1; i < e.path.length; i++) {
        const a = e.path[i - 1], b = e.path[i];
        const sea = map.biome[a] <= B.SHALLOWS || map.biome[b] <= B.SHALLOWS;
        g.beginPath();
        g.moveTo((a % w) * TILE + 4, Math.floor(a / w) * TILE + 4);
        g.lineTo((b % w) * TILE + 4, Math.floor(b / w) * TILE + 4);
        if (trail) { g.strokeStyle = 'rgba(40,25,15,0.28)'; g.lineWidth = 1; g.setLineDash([2, 3]); }
        else if (sea) { g.strokeStyle = 'rgba(235,245,255,0.4)'; g.lineWidth = 1.2; g.setLineDash([3, 3]); }
        else { g.strokeStyle = 'rgba(92,66,38,0.9)'; g.lineWidth = 1.8; g.setLineDash([]); }
        g.stroke();
      }
    }
  };
  pass(true);
  pass(false);
  return cv;
}

function hslToRgb(text) {
  const m = /hsl\((\d+(?:\.\d+)?) (\d+)% (\d+)%\)/.exec(text);
  if (!m) return [200, 200, 200];
  const h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    t = (t + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255));
}

/** One pixel per tile: which realm holds each tile. Returns { canvas, owner }. */
export function buildTerritory(state, map) {
  const { w, h } = map;
  const owner = new Int16Array(w * h).fill(-1);
  const best = new Float32Array(w * h).fill(1e9);
  for (const s of state.sites) {
    if (s.mode !== 'civil') continue;
    const R = KIND[s.kind].reach;
    const sea = SP[s.species].biomes.includes(B.SHALLOWS);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const x = s.x + dx, y = s.y + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = y * w + x;
      const b = map.biome[i];
      if (b === B.OCEAN || (b === B.SHALLOWS) !== sea) continue;
      const d = Math.sqrt(dx * dx + dy * dy) / R;
      if (d <= 1 && d < best[i]) { best[i] = d; owner[i] = s.faction; }
    }
  }
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  const img = g.createImageData(w, h);
  const colors = state.factions.map((f) => hslToRgb(f.color));
  for (let i = 0; i < w * h; i++) {
    const o = owner[i];
    if (o < 0) continue;
    const x = i % w;
    const edge = (x > 0 && owner[i - 1] !== o) || (x < w - 1 && owner[i + 1] !== o) || (i >= w && owner[i - w] !== o) || (i < w * (h - 1) && owner[i + w] !== o);
    const c = colors[o];
    img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2];
    img.data[i * 4 + 3] = edge ? 215 : 62;
  }
  g.putImageData(img, 0, 0);
  return { canvas: cv, owner };
}

// ---- icons (screen space) --------------------------------------------------

export function siteStyle(state, s) {
  if (s.mode === 'civil') return { icon: s.kind, fill: state.factions[s.faction].color, ring: SP[s.species].color };
  if (s.mode === 'empty') return { icon: 'ruin', fill: '#8b8b8b', ring: '#555' };
  if (s.mode === 'dragon') return { icon: 'dragon', fill: '#e0503a', ring: '#3a0d08' };
  if (s.mode === 'wild') return { icon: 'wild', fill: SP[s.species].color, ring: '#2a1838' };
  return { icon: s.outlaw ? 'camp' : s.species === 'vampire' ? 'castle' : 'cave', fill: s.outlaw ? '#b03030' : SP[s.species].color, ring: '#1a1010' };
}

export function drawSite(g, st, x, y, r) {
  g.lineWidth = Math.max(1, r * 0.22);
  g.strokeStyle = '#15110c';
  g.fillStyle = st.fill;
  const house = (cx, cy, s) => {
    g.beginPath();
    g.moveTo(cx - s, cy + s); g.lineTo(cx - s, cy - s * 0.1); g.lineTo(cx, cy - s); g.lineTo(cx + s, cy - s * 0.1); g.lineTo(cx + s, cy + s);
    g.closePath(); g.fill(); g.stroke();
  };
  switch (st.icon) {
    case 'village': house(x, y, r * 0.7); break;
    case 'town': house(x - r * 0.45, y + r * 0.1, r * 0.62); house(x + r * 0.45, y - r * 0.05, r * 0.75); break;
    case 'city': {
      const s = r * 1.15;
      g.beginPath(); g.rect(x - s, y - s * 0.45, s * 2, s * 1.2); g.fill(); g.stroke();
      for (const dx of [-1, 0, 1]) { g.beginPath(); g.rect(x + dx * s * 0.8 - s * 0.24, y - s * (dx ? 0.85 : 1.15), s * 0.48, s * (dx ? 0.5 : 0.8)); g.fill(); g.stroke(); }
      break;
    }
    case 'castle': {
      const s = r * 0.9;
      g.beginPath(); g.rect(x - s * 0.6, y - s * 0.7, s * 1.2, s * 1.6); g.fill(); g.stroke();
      g.beginPath(); g.rect(x - s * 0.9, y - s * 1.05, s * 1.8, s * 0.45); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(x, y - s * 1.05); g.lineTo(x, y - s * 1.9); g.lineTo(x + s * 0.7, y - s * 1.6); g.lineTo(x, y - s * 1.35); g.stroke();
      break;
    }
    case 'camp':
      g.beginPath(); g.moveTo(x - r, y + r * 0.7); g.lineTo(x, y - r); g.lineTo(x + r, y + r * 0.7); g.closePath(); g.fill(); g.stroke();
      break;
    case 'cave':
      g.fillStyle = '#1c1612';
      g.beginPath(); g.arc(x, y + r * 0.3, r, Math.PI, 0); g.closePath(); g.fill();
      g.strokeStyle = st.fill; g.lineWidth = Math.max(1.5, r * 0.3); g.stroke();
      break;
    case 'dragon':
      g.beginPath(); g.moveTo(x, y - r * 1.2); g.lineTo(x + r * 1.5, y - r * 0.2); g.lineTo(x + r * 0.5, y); g.lineTo(x, y + r * 1.1); g.lineTo(x - r * 0.5, y); g.lineTo(x - r * 1.5, y - r * 0.2);
      g.closePath(); g.fill(); g.stroke();
      break;
    case 'wild':
      g.fillStyle = 'rgba(30,14,44,0.85)';
      g.beginPath(); g.arc(x, y, r * 0.9, 0, 6.3); g.fill();
      g.strokeStyle = st.fill; g.lineWidth = Math.max(1.5, r * 0.3); g.stroke();
      break;
    default: // ruin
      g.beginPath(); g.rect(x - r * 0.8, y - r * 0.2, r * 0.45, r); g.rect(x - r * 0.1, y - r * 0.8, r * 0.45, r * 1.6); g.rect(x + r * 0.6, y + r * 0.2, r * 0.45, r * 0.6);
      g.fill(); g.stroke();
  }
  if (st.ring && st.icon !== 'cave' && st.icon !== 'wild' && st.icon !== 'ruin' && st.icon !== 'dragon') {
    g.fillStyle = st.ring;
    g.strokeStyle = '#15110c';
    g.lineWidth = 1;
    g.beginPath(); g.arc(x + r * 0.95, y - r * 0.95, Math.max(2, r * 0.32), 0, 6.3); g.fill(); g.stroke();
  }
}

export const PARTY = {
  caravan: { letter: 'C', color: '#ecd58a', label: 'Supply caravan' },
  army: { letter: 'A', color: null, label: 'Army' },
  expedition: { letter: 'X', color: null, label: 'Punitive expedition' },
  raid: { letter: 'R', color: '#d83a2a', label: 'Raiding party' },
  prowl: { letter: 'R', color: '#d83a2a', label: 'Ambushers' },
  adventurers: { letter: '★', color: '#ffffff', label: 'Adventuring party' },
  horde: { letter: 'H', color: '#9a5ad0', label: 'Monster horde' },
  dragon: { letter: 'D', color: '#ff5a2a', label: 'Dragon' },
};

export function drawParty(g, state, p, x, y, r) {
  const def = PARTY[p.type] || PARTY.caravan;
  const color = def.color || (state.factions[p.faction] ? state.factions[p.faction].color : '#ccc');
  if (p.type === 'dragon') r *= 1.5;
  g.fillStyle = color;
  g.strokeStyle = p.state === 'siege' ? '#ffffff' : '#15110c';
  g.lineWidth = p.state === 'siege' ? 2 : 1.2;
  g.beginPath();
  if (p.type === 'caravan') g.rect(x - r, y - r * 0.75, r * 2, r * 1.5);
  else if (p.type === 'raid' || p.type === 'prowl' || p.type === 'horde') { g.moveTo(x, y - r * 1.2); g.lineTo(x + r * 1.1, y + r * 0.9); g.lineTo(x - r * 1.1, y + r * 0.9); g.closePath(); }
  else g.arc(x, y, r, 0, 6.3);
  g.fill();
  g.stroke();
  if (r >= 5) {
    g.fillStyle = '#15110c';
    g.font = `bold ${Math.round(r * 1.25)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(def.letter, x, y + (p.type === 'caravan' ? 0 : r * 0.15));
  }
}
