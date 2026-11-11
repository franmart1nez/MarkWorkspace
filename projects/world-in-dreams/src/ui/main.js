// Viewer: runs the engine in the browser and shows the region from above,
// from the whole countryside down to a single street. It only reads the world.
import {
  createWorld, step, serialize, deserialize, getLayout, dateOf, describe, needsOf, placeName, foodDays, priceOf, fullName, isNotable,
  jobOf, SPECIES, BEASTS, SEASONS, DAY, MEALS, seasonOf,
} from '../engine/index.js';
import { inRect, corners } from '../engine/geom.js';
import { Painter, SEASON_LOOK, drawPerson, drawAnimal, nightOf, glowSprite, CLOTH, hairOf } from './render.js';

const $ = (id) => document.getElementById(id);
const canvas = $('map');
const g = canvas.getContext('2d');
const SAVE_KEY = 'world-in-dreams:save:v2';
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TAU = Math.PI * 2;

let S, L, painter;
const view = { x: 0, y: 0, s: 2 };
let speed = 1, acc = 0, last = performance.now(), frac = 1;
let sel = null; // { type: 'person' | 'bld' | 'field' | 'animal' | 'site', id }
let follow = false, tab = 'inspect';
let px = new Float32Array(0), py = new Float32Array(0), hd = new Float32Array(0);
const apos = new Map(); // animal id -> [previous x, previous y, heading]
let lit = new Uint8Array(0), litAt = 0;
let shownEvents = -1, panelAt = 0, panelDirty = true, fvSeen = -1, seasonSeen = -1, invalidAt = 0, hudAt = 0, query = '';
const filters = { life: true, work: true, town: true, wild: true, quest: true };
const tmp = [];

// ---- world lifecycle ---------------------------------------------------------

function adopt(world) {
  S = world;
  L = getLayout(S);
  painter = new Painter(L);
  sel = null; follow = false;
  apos.clear();
  shownEvents = -1; panelDirty = true; fvSeen = -1; seasonSeen = -1;
  $('seed').value = S.seedText;
  snapshot();
  frameCity();
}

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2400);
}

function setSpeed(v) {
  speed = v;
  acc = 0;
  for (const b of document.querySelectorAll('#speeds [data-speed]')) b.classList.toggle('on', Number(b.dataset.speed) === v);
}

/** Remember where everybody stands, so that movement between two minutes can be drawn smoothly. */
function snapshot() {
  const n = S.people.length;
  if (px.length < n) {
    const grow = (a) => { const b = new Float32Array(Math.ceil(n * 1.3) + 16); b.set(a); return b; };
    px = grow(px); py = grow(py); hd = grow(hd);
  }
  for (let i = 0; i < n; i++) { const p = S.people[i]; px[i] = p.x; py[i] = p.y; }
  if (apos.size > S.animals.length * 2 + 50) apos.clear();
  for (const a of S.animals) {
    const e = apos.get(a.id);
    if (e) { e[0] = a.x; e[1] = a.y; } else apos.set(a.id, [a.x, a.y, (a.id * 2.4) % TAU]);
  }
}

// ---- camera ----------------------------------------------------------------------

const dpr = () => window.devicePixelRatio || 1;
function resize() {
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.max(50, Math.round(r.width * dpr()));
  canvas.height = Math.max(50, Math.round(r.height * dpr()));
}
function frameCity() {
  resize();
  view.x = 0; view.y = 0;
  view.s = Math.min(canvas.width / (L.wall.rx * 2.5), canvas.height / (L.wall.ry * 2.35));
}
function frameRegion() {
  view.x = 0; view.y = 0;
  view.s = Math.max(canvas.width / L.W, canvas.height / L.H) * 1.02;
}
function clampView() {
  const minS = Math.max(canvas.width / L.W, canvas.height / L.H);
  view.s = Math.max(minS, Math.min(16 * dpr(), view.s));
  const hw = canvas.width / 2 / view.s, hh = canvas.height / 2 / view.s;
  view.x = Math.max(L.X0 + hw, Math.min(L.X1 - hw, view.x));
  view.y = Math.max(L.Y0 + hh, Math.min(L.Y1 - hh, view.y));
}
const sx = (x) => (x - view.x) * view.s + canvas.width / 2;
const sy = (y) => (y - view.y) * view.s + canvas.height / 2;
const wx = (cx) => (cx - canvas.width / 2) / view.s + view.x;
const wy = (cy) => (cy - canvas.height / 2) / view.s + view.y;

/** Where a person is drawn: between the last two minutes, a little to one side of the street. */
function ppos(p) {
  const i = p.id;
  let x = p.x, y = p.y;
  if (i < px.length && frac < 1) { x = px[i] + (p.x - px[i]) * frac; y = py[i] + (p.y - py[i]) * frac; }
  if (i < px.length) {
    const dx = p.x - px[i], dy = p.y - py[i];
    if (dx * dx + dy * dy > 0.01) hd[i] = Math.atan2(dy, dx);
  }
  if (p.route) { const off = ((p.id * 37) % 7 - 3) * 0.55; x -= Math.sin(hd[i]) * off; y += Math.cos(hd[i]) * off; }
  return [x, y];
}
function apoint(a) {
  const e = apos.get(a.id);
  if (!e) return [a.x, a.y, 0];
  const dx = a.x - e[0], dy = a.y - e[1];
  if (dx * dx + dy * dy > 0.01) e[2] = Math.atan2(dy, dx);
  return frac < 1 ? [e[0] + dx * frac, e[1] + dy * frac, e[2]] : [a.x, a.y, e[2]];
}

function centerOn(o) {
  if (!o) return;
  if (o.type === 'person') { const p = S.people[o.id]; view.x = p.x; view.y = p.y; view.s = Math.max(view.s, 5 * dpr()); } else if (o.type === 'bld') { const b = L.blds[o.id]; view.x = b.x; view.y = b.y; view.s = Math.max(view.s, 3.5 * dpr()); } else if (o.type === 'field') { const f = L.fields[o.id]; view.x = f.x; view.y = f.y; view.s = Math.max(view.s, 2 * dpr()); } else if (o.type === 'site') { const s = L.sites[o.id]; view.x = s.x; view.y = s.y; view.s = canvas.width / (s.r * (o.id ? 4 : 2.6)); } else if (o.type === 'animal') { const a = S.animals.find((q) => q.id === o.id); if (a) { view.x = a.x; view.y = a.y; view.s = Math.max(view.s, 4 * dpr()); } }
}

function select(o, center = false) {
  sel = o;
  if (!o || o.type !== 'person') follow = false;
  if (center) centerOn(o);
  if (o) setTab('inspect');
  panelDirty = true;
}

// ---- drawing -------------------------------------------------------------------

const look = {
  pal: SEASON_LOOK[0], season: 0,
  field: (f) => {
    const F = S.fields[f.id], site = S.sites[f.site];
    return { st: F.st, g: F.g, work: F.st === 0 ? Math.min(1, F.w / (site.sow * f.area)) : F.st === 2 ? F.h : 0 };
  },
};

function label(text, x, y, size, italic) {
  g.font = `${italic ? 'italic ' : ''}600 ${Math.round(size * dpr())}px Georgia, "Times New Roman", serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 3.5 * dpr();
  g.strokeStyle = 'rgba(42,29,20,0.85)';
  g.strokeText(text, x, y);
  g.fillStyle = '#fff6dc';
  g.fillText(text, x, y);
}

function draw(now) {
  const W = canvas.width, Hh = canvas.height, s = view.s, minute = S.t % DAY, season = seasonOf(S.t);
  if (season !== seasonSeen || (S.fv !== fvSeen && now - invalidAt > 1500)) { painter.invalidate(); seasonSeen = season; fvSeen = S.fv; invalidAt = now; }
  look.pal = SEASON_LOOK[season];
  look.season = season;
  if (follow && sel && sel.type === 'person') {
    const p = S.people[sel.id];
    if (p.alive && !p.away) { const [x, y] = ppos(p); view.x += (x - view.x) * 0.18; view.y += (y - view.y) * 0.18; } else follow = false;
  }
  clampView();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  painter.draw(g, view, W, Hh, look);

  const m = 12, x0 = wx(0) - m, y0 = wy(0) - m, x1 = wx(W) + m, y1 = wy(Hh) + m;
  for (const a of S.animals) {
    if (a.x < x0 || a.x > x1 || a.y < y0 || a.y > y1) continue;
    const [x, y, h] = apoint(a);
    drawAnimal(g, sx(x), sy(y), s, a, h, now);
  }
  let outdoors = 0;
  if (s >= 0.28 * dpr()) {
    for (const p of S.people) {
      if (!p.alive || p.away || p.in >= 0) continue;
      outdoors++;
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      const [x, y] = ppos(p);
      drawPerson(g, sx(x), sy(y), s, p, p.age < 15 ? 'none' : jobOf(p).c, hd[p.id] || 0, sel && sel.type === 'person' && sel.id === p.id);
    }
  } else for (const p of S.people) if (p.alive && !p.away && p.in < 0) outdoors++;
  draw.outdoors = outdoors;

  // what is selected
  if (sel) {
    g.strokeStyle = '#fff'; g.lineWidth = 2 * dpr(); g.setLineDash([]);
    if (sel.type === 'person') {
      const p = S.people[sel.id];
      if (p.alive && !p.away) {
        const [x, y] = p.in >= 0 ? [L.blds[p.in].x, L.blds[p.in].y] : ppos(p);
        if (p.route) {
          g.setLineDash([6 * dpr(), 5 * dpr()]); g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.6 * dpr();
          g.beginPath(); g.moveTo(sx(x), sy(y));
          for (let i = p.ri; i < p.route.length; i += 2) g.lineTo(sx(p.route[i]), sy(p.route[i + 1]));
          g.stroke(); g.setLineDash([]);
        }
        g.strokeStyle = '#ffe9a8'; g.lineWidth = 2 * dpr();
        g.beginPath(); g.arc(sx(x), sy(y), Math.max(9 * dpr(), 2.4 * s) + Math.sin(now / 260) * 2, 0, TAU); g.stroke();
      }
    } else if (sel.type === 'bld' || sel.type === 'field') {
      const r = sel.type === 'bld' ? L.blds[sel.id] : L.fields[sel.id], c = corners(r, 1);
      g.strokeStyle = '#ffe9a8'; g.lineWidth = 2.5 * dpr();
      g.beginPath(); for (let i = 0; i < 8; i += 2) g.lineTo(sx(c[i]), sy(c[i + 1])); g.closePath(); g.stroke();
    } else if (sel.type === 'animal') {
      const a = S.animals.find((q) => q.id === sel.id);
      if (a) { const [x, y] = apoint(a); g.strokeStyle = '#ffe9a8'; g.beginPath(); g.arc(sx(x), sy(y), Math.max(9 * dpr(), 2.4 * s), 0, TAU); g.stroke(); } else select(null);
    }
  }

  // night: a blue dusk over everything, then the warm lights
  const dark = $('lyNight').checked ? nightOf(minute) : 0;
  if (dark > 0.01) {
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = `rgb(${Math.round(255 - dark * 215)},${Math.round(255 - dark * 190)},${Math.round(255 - dark * 105)})`;
    g.fillRect(0, 0, W, Hh);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = Math.min(1, dark * 1.5);
    const sp = glowSprite();
    if (now - litAt > 500) {
      litAt = now;
      if (lit.length !== L.blds.length) lit = new Uint8Array(L.blds.length);
      lit.fill(0);
      for (const p of S.people) if (p.alive && p.in >= 0 && p.act !== 'sleep') lit[p.in] = 1;
    }
    const glow = (x, y, r) => g.drawImage(sp, sx(x) - r * s, sy(y) - r * s, r * 2 * s, r * 2 * s);
    for (const b of L.bldHash.query(x0, y0, x1, y1, tmp)) if (lit[b.id]) glow(b.x, b.y, Math.max(b.w, b.d) * 0.85);
    for (const q of L.lamps) if (q.x > x0 && q.x < x1 && q.y > y0 && q.y < y1) glow(q.x, q.y, 13);
    if (s > 0.5) for (const p of S.people) if (p.alive && !p.away && p.in < 0 && (p.job === 'guard' || p.cart) && p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1) glow(p.x, p.y, 6);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  if ($('lyLabels').checked) {
    if (s < 1.7 * dpr()) for (const site of L.sites) label(site.name, sx(site.x), sy(site.y - (site.kind === 'city' ? L.wall.ry + 34 : 105)) , site.kind === 'city' ? 19 : 14);
    if (s >= 2.6 * dpr()) for (const b of L.bldHash.query(x0, y0, x1, y1, tmp)) if (b.name && b.k !== 'stall' && b.k !== 'warehouse') label(b.name, sx(b.x), sy(b.y), 11.5, true);
  }
}

// ---- picking ------------------------------------------------------------------

function pickAt(x, y) {
  const s = view.s, rp = Math.max(2.4, (11 * dpr()) / s);
  let best = null, bd = rp;
  if (s >= 0.28 * dpr()) for (const p of S.people) {
    if (!p.alive || p.away || p.in >= 0 || Math.abs(p.x - x) > rp + 3) continue;
    const [qx, qy] = ppos(p), d = Math.hypot(qx - x, qy - y);
    if (d < bd) { bd = d; best = { type: 'person', id: p.id }; }
  }
  if (best) return best;
  for (const a of S.animals) { const d = Math.hypot(a.x - x, a.y - y); if (d < bd) { bd = d; best = { type: 'animal', id: a.id }; } }
  if (best) return best;
  for (const b of L.bldHash.query(x, y, x, y, tmp)) if (inRect(x, y, b, 0.6)) return { type: 'bld', id: b.id };
  if (s < 0.6 * dpr()) for (const site of L.sites) if (Math.hypot(site.x - x, site.y - y) < site.r) return { type: 'site', id: site.id };
  for (const f of L.fieldHash.query(x, y, x, y, tmp)) if (inRect(x, y, f)) return { type: 'field', id: f.id };
  return null;
}

const CROP = { grain: 'Grain field', veg: 'Vegetable plot', orchard: 'Orchard', pasture: 'Pasture' };
function fieldStage(f) {
  const F = S.fields[f.id];
  if (f.crop === 'pasture') return 'grazing';
  if (F.st === 0) return seasonOf(S.t) === 3 ? 'resting' : 'being sown';
  if (F.st === 1) return f.crop === 'orchard' ? (F.g < 0.3 ? 'in blossom' : 'fruit setting') : 'growing';
  if (F.st === 2) return 'being harvested';
  return 'stubble';
}
const bldTitle = (b) => cap(placeName(L, b).replace(/^(a|the) /, ''));

function tipText(o) {
  if (o.type === 'person') { const p = S.people[o.id]; return `${esc(fullName(p))} <i>· ${esc(p.job)} · ${esc(describe(S, L, p))}</i>`; }
  if (o.type === 'animal') { const a = S.animals.find((q) => q.id === o.id); return a ? BEASTS[a.k].name : ''; }
  if (o.type === 'bld') return esc(bldTitle(L.blds[o.id]));
  if (o.type === 'field') { const f = L.fields[o.id]; return `${CROP[f.crop]} <i>· ${fieldStage(f)}</i>`; }
  if (o.type === 'site') return esc(L.sites[o.id].name);
  return '';
}

// ---- panels -------------------------------------------------------------------

const go = (type, id, text) => `<a class="go" data-go="${type}:${id}">${esc(text)}</a>`;
const person = (p, extra = '') => `<div class="row"><span>${go('person', p.id, fullName(p))}${p.alive ? '' : ' †'}</span><span class="n">${esc(extra || `${p.job}, ${p.age}`)}</span></div>`;
const stat = (k, v, pct, color = 'var(--accent)') => `<div class="stat"><span class="k">${k}</span><span class="bar"><i style="width:${Math.max(0, Math.min(100, pct))}%;background:${color}"></i></span><span class="v">${v}</span></div>`;
const tone = (v) => (v > 60 ? 'var(--good)' : v > 30 ? 'var(--accent)' : 'var(--bad)');
const hist = (list) => (list.length ? `<ul class="hist">${list.slice().reverse().map((h) => `<li><span class="d">${dateOf(h.t).short}</span>${esc(h.text)}</li>`).join('')}</ul>` : '<div class="sub">Nothing of note yet.</div>');

function personPanel(p) {
  const hh = S.households[p.hh], n = needsOf(S, p), sp = SPECIES[p.sp], home = L.blds[p.home];
  const kin = [];
  if (p.spouse >= 0) kin.push(person(S.people[p.spouse], p.sex === 'f' ? 'husband' : 'wife'));
  for (const id of [p.mom, p.dad]) if (id >= 0) kin.push(person(S.people[id], id === p.mom ? 'mother' : 'father'));
  for (const q of S.people) if (q.mom === p.id || q.dad === p.id) kin.push(person(q, `${q.sex === 'f' ? 'daughter' : 'son'}, ${q.age}`));
  const mates = hh ? hh.m.map((id) => S.people[id]).filter((q) => q.id !== p.id && q.spouse !== p.id && q.mom !== p.id && q.dad !== p.id && p.mom !== q.id && p.dad !== q.id) : [];
  const state = !p.alive ? `<span class="tag bad">${p.gone ? 'left the region' : 'dead'}</span>` : p.hurt > S.t ? '<span class="tag bad">wounded</span>' : p.miss > 2 ? '<span class="tag bad">hungry</span>' : '';
  return `<div class="who">
      <div class="portrait" style="background:${CLOTH[p.age < 15 ? 'none' : jobOf(p).c] || '#c98b6a'}"><span class="hair" style="background:${hairOf(p)}"></span><img src="assets/portraits/${p.sp}.png" alt="" onerror="this.remove()"></div>
      <div><h2>${esc(fullName(p))}</h2>
      <div class="sub">${sp.name} ${p.age < 15 ? (p.sex === 'f' ? 'girl' : 'boy') : p.sex === 'f' ? 'woman' : 'man'}, ${p.age} · ${esc(cap(p.job))}${isNotable(p) ? ' <span class="tag odd">notable</span>' : ''} ${state}</div>
      <div class="sub">${p.site >= 0 ? go('site', p.site, L.sites[p.site].name) : 'Travelling merchant'}</div></div>
    </div>
    <div class="now">${esc(describe(S, L, p))}</div>
    ${p.alive && !p.away ? `<div class="btns"><button data-act="follow" class="${follow ? 'on' : ''}">${follow ? 'Following' : 'Follow'}</button><button data-act="center">Show on map</button></div>` : ''}
    ${p.alive ? stat('Mood', n.mood, n.mood, tone(n.mood)) + stat('Fed', n.fed, n.fed, tone(n.fed)) + stat('Company', n.company, n.company, tone(n.company)) + stat('Health', n.health, n.health, tone(n.health)) : ''}
    ${hh ? `<h3>Household of ${esc(hh.fam)}</h3>
      <div class="row"><span>Home</span><span class="n">${home ? go('bld', home.id, bldTitle(home)) : '—'}</span></div>
      ${p.work >= 0 ? `<div class="row"><span>Works at</span><span class="n">${go('bld', p.work, bldTitle(L.blds[p.work]))}</span></div>` : ''}
      <div class="row"><span>Purse</span><span class="n">${fmt(hh.coins)} coins</span></div>
      <div class="row"><span>Larder</span><span class="n">${fmt(hh.pantry)} meals (${(hh.pantry / Math.max(1, hh.m.length * MEALS)).toFixed(1)} days)</span></div>` : ''}
    ${kin.length ? `<h3>Family</h3>${kin.join('')}` : ''}
    ${mates.length ? `<h3>Also in the house</h3>${mates.map((q) => person(q)).join('')}` : ''}
    ${p.friends.length ? `<h3>Friends</h3>${p.friends.map((id) => person(S.people[id])).join('')}` : ''}
    <h3>Character</h3>
    <div>${p.traits.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}<span class="tag odd">${esc(p.arch)}</span></div>
    <div class="row"><span>Dream</span><span class="n">${esc(p.goal)}</span></div>
    <h3>Life so far</h3>${hist(p.hist)}`;
}

function bldPanel(b) {
  const site = L.sites[b.site];
  const res = S.people.filter((p) => p.alive && p.home === b.id), workers = S.people.filter((p) => p.alive && p.work === b.id);
  const inside = S.people.filter((p) => p.alive && !p.away && p.in === b.id);
  const guests = inside.filter((p) => p.home !== b.id && p.work !== b.id);
  const store = b.id === site.granary ? S.sites[b.site] : null;
  return `<h2>${esc(bldTitle(b))}</h2>
    <div class="sub">${esc(cap(b.k))} in ${go('site', b.site, site.name)} · ${inside.length} inside now</div>
    ${store ? `<h3>Common store</h3>${stat('Food', `${fmt(store.food)} meals`, foodDays(S, b.site) * 2.5, tone(foodDays(S, b.site) * 4))}<div class="row"><span>Lasts</span><span class="n">${foodDays(S, b.site).toFixed(0)} days</span></div>` : ''}
    ${res.length ? `<h3>Lives here</h3>${res.map((p) => person(p)).join('')}` : b.k === 'house' ? '<div class="sub">The house stands empty.</div>' : ''}
    ${workers.length ? `<h3>Works here</h3>${workers.map((p) => person(p, `${p.job}${p.in === b.id ? ' · in' : ''}`)).join('')}` : ''}
    ${guests.length ? `<h3>Visitors now</h3>${guests.slice(0, 30).map((p) => person(p, describe(S, L, p).split(' at ')[0])).join('')}` : ''}`;
}

function fieldPanel(f) {
  const F = S.fields[f.id], site = S.sites[f.site], st = look.field(f);
  const hands = S.people.filter((p) => p.alive && p.in < 0 && !p.route && p.fi === f.id && (p.act === 'farm' || p.act === 'tend' || p.act === 'herd'));
  const sheep = f.crop === 'pasture' ? S.herds.find((h) => h.field === f.id) : null;
  return `<h2>${CROP[f.crop]}</h2>
    <div class="sub">${fmt(f.area)} m² · ${go('site', f.site, L.sites[f.site].name)}${f.farm >= 0 ? ' · farmstead land' : ''}</div>
    <div class="now">${cap(fieldStage(f))}</div>
    ${F.st === 0 && f.crop !== 'pasture' ? stat('Sown', `${Math.round(st.work * 100)}%`, st.work * 100) : ''}
    ${F.st === 1 ? stat('Growth', `${Math.round(F.g * 100)}%`, F.g * 100, 'var(--good)') : ''}
    ${F.st === 2 ? stat('Harvested', `${Math.round(F.h * 100)}%`, F.h * 100) : ''}
    ${f.crop !== 'pasture' ? `<div class="row"><span>Full harvest</span><span class="n">${fmt(f.area * S.tune.yield * { grain: 1.15, veg: 0.85, orchard: 0.8 }[f.crop])} meals</span></div><div class="row"><span>Work to reap</span><span class="n">${fmt((site.reap * f.area) / 60)} hours</span></div>` : ''}
    ${sheep ? `<div class="row"><span>Flock</span><span class="n">${sheep.n} sheep</span></div>` : ''}
    ${hands.length ? `<h3>In the field now</h3>${hands.map((p) => person(p)).join('')}` : ''}`;
}

function animalPanel(a) {
  const h = S.herds[a.h], B = BEASTS[a.k];
  const doing = a.st === 2 ? 'Running' : a.st === 1 ? 'Moving' : a.k === 'wolf' && h.st === 'idle' ? 'Resting at the den' : 'Grazing';
  const pack = { idle: 'at the den', hunt: 'out hunting', feed: 'feeding', back: 'returning to the den' }[h.st] || '';
  return `<h2>${B.name}</h2><div class="sub">One of ${h.n} in this ${a.k === 'wolf' ? 'pack' : a.k === 'sheep' ? 'flock' : a.k === 'slime' ? 'cluster' : 'herd'}</div>
    <div class="now">${a.k === 'slime' ? 'Wobbling about' : doing}${a.k === 'wolf' ? ` · pack ${pack}` : ''}</div>
    ${a.k === 'sheep' && h.field >= 0 ? `<div class="row"><span>Pasture</span><span class="n">${go('field', h.field, 'show')}</span></div>` : ''}`;
}

function sitePanel(i) {
  const site = L.sites[i], d = S.sites[i], folk = S.people.filter((p) => p.alive && !p.away && p.site === i);
  const jobs = {};
  for (const p of folk) jobs[p.job] = (jobs[p.job] || 0) + 1;
  const days = foodDays(S, i), notable = folk.filter(isNotable);
  const out = folk.filter((p) => p.in < 0).length, asleep = folk.filter((p) => p.act === 'sleep').length;
  return `<h2>${esc(site.name)}</h2>
    <div class="sub">${site.kind === 'city' ? 'Walled city' : `${cap(site.type === 'plain' ? 'farming' : site.type)} village`} · ${fmt(folk.length)} people · ${S.households.filter((h) => h.site === i && h.m.length).length} households</div>
    ${d.short ? '<span class="tag bad">food shortage</span>' : ''}${d.fear > 40 ? '<span class="tag bad">afraid of wolves</span>' : ''}
    ${stat('Food store', `${fmt(d.food)} meals`, days * 2.5, tone(days * 4))}
    <div class="row"><span>Lasts</span><span class="n">${days.toFixed(0)} days · ${priceOf(S, i).toFixed(2)} coins a meal</span></div>
    <div class="row"><span>Treasury</span><span class="n">${fmt(d.coins)} coins</span></div>
    <div class="row"><span>Firewood</span><span class="n">${fmt(d.wood)} cords</span></div>
    <div class="row"><span>Right now</span><span class="n">${out} outdoors · ${asleep} asleep</span></div>
    <h3>Notables</h3>${notable.map((p) => person(p)).join('') || '<div class="sub">None.</div>'}
    <h3>Trades</h3>${Object.entries(jobs).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="row"><span>${esc(cap(k))}</span><span class="n">${v}</span></div>`).join('')}`;
}

function regionPanel() {
  const d = dateOf(S.t), alive = S.people.filter((p) => p.alive && p.job !== 'trader');
  const beasts = {};
  for (const a of S.animals) beasts[a.k] = (beasts[a.k] || 0) + 1;
  const st = [0, 0, 0, 0];
  S.fields.forEach((F) => { if (F.st < 4) st[F.st]++; });
  const quests = S.quests.filter((q) => q.open);
  return `<h2>${esc(L.sites[0].name)} and its lands</h2>
    <div class="sub">${d.text} · seed “${esc(S.seedText)}”</div>
    <div class="row"><span>People</span><span class="n">${fmt(alive.length)} (${S.born} born, ${S.died} died)</span></div>
    <div class="row"><span>Outdoors now</span><span class="n">${draw.outdoors || 0}</span></div>
    <div class="row"><span>Fields</span><span class="n">${st[0]} bare · ${st[1]} growing · ${st[2]} ripe · ${st[3]} stubble</span></div>
    <h3>Settlements</h3>
    ${L.sites.map((s, i) => `<div class="card" data-go="site:${i}"><div class="head"><strong>${esc(s.name)}</strong><span>${fmt(S.sites[i].pop)} people</span></div><p>${s.kind === 'city' ? 'City' : cap(s.type === 'plain' ? 'farming' : s.type) + ' village'} · food for ${foodDays(S, i).toFixed(0)} days${S.sites[i].short ? ' · <b style="color:var(--bad)">shortage</b>' : ''}</p></div>`).join('')}
    <h3>Wildlife and flocks</h3>
    ${Object.keys(BEASTS).map((k) => `<div class="row"><span>${BEASTS[k].name}</span><span class="n">${beasts[k] || 0}</span></div>`).join('')}
    <h3>Guild notice board</h3>
    ${quests.map((q) => `<div class="row"><span>${q.kind === 'wolf' ? 'Wolf bounty' : 'Slime cull'} ${esc(q.near)}</span><span class="n">${q.party} of ${q.max} · ${q.reward} coins</span></div>`).join('') || '<div class="sub">No open quests.</div>'}
    <h3>Controls</h3>
    <div class="sub">Drag to pan, wheel to zoom. <kbd>Space</kbd> pause, <kbd>1</kbd>–<kbd>6</kbd> speed, <kbd>.</kbd> one minute, <kbd>C</kbd> city, <kbd>R</kbd> region, <kbd>F</kbd> follow, <kbd>Esc</kbd> deselect.</div>`;
}

function peoplePanel() {
  const q = query.trim().toLowerCase();
  const list = q
    ? S.people.filter((p) => p.alive && `${fullName(p)} ${p.job}`.toLowerCase().includes(q)).slice(0, 60)
    : S.people.filter((p) => p.alive && (isNotable(p) || p.job === 'adventurer' || p.job === 'trader'));
  return `<input id="find" placeholder="Search by name or trade" value="${esc(query)}">
    <div id="found">${q ? '' : '<h3>Notables, adventurers and merchants</h3>'}${list.map((p) => person(p, `${p.job}${p.away ? ' · away' : ''}`)).join('') || '<div class="sub">Nobody by that name.</div>'}</div>`;
}

function renderPanel() {
  const el = $('panel');
  if (tab === 'people') {
    if (!$('find')) { el.innerHTML = peoplePanel(); return; }
    const tmpEl = document.createElement('div');
    tmpEl.innerHTML = peoplePanel();
    $('found').innerHTML = tmpEl.querySelector('#found').innerHTML;
    return;
  }
  const top = el.scrollTop;
  if (tab === 'region') el.innerHTML = regionPanel();
  else if (!sel) el.innerHTML = '<div class="empty"><p>Click a person, an animal, a building or a field to inspect it.</p><p>Zoom in until you can see people in the streets; double-click somebody to follow them through their day.</p></div>';
  else if (sel.type === 'person') el.innerHTML = personPanel(S.people[sel.id]);
  else if (sel.type === 'bld') el.innerHTML = bldPanel(L.blds[sel.id]);
  else if (sel.type === 'field') el.innerHTML = fieldPanel(L.fields[sel.id]);
  else if (sel.type === 'site') el.innerHTML = sitePanel(sel.id);
  else if (sel.type === 'animal') { const a = S.animals.find((x) => x.id === sel.id); el.innerHTML = a ? animalPanel(a) : '<div class="empty">It is gone.</div>'; }
  el.scrollTop = top;
}

function renderEvents() {
  const minor = $('minor').checked;
  const list = S.events.filter((e) => filters[e.type] && (minor || e.imp >= 1)).slice(-150).reverse();
  $('events').innerHTML = list.map((e) => `<li class="t-${e.type} i${e.imp}" data-n="${e.n}"><span class="d">${dateOf(e.t).short} · ${dateOf(e.t).clock}</span>${esc(e.text)}</li>`).join('');
}

function renderDate() {
  const d = dateOf(S.t), night = nightOf(S.t % DAY) > 0.3;
  $('date').innerHTML = `${d.text}<b>${d.clock}</b> ${night ? '☾' : '☀'}`;
}

function renderHud() {
  const cssS = view.s / dpr();
  let metres = 110 / cssS;
  const pow = 10 ** Math.floor(Math.log10(metres));
  metres = (metres / pow >= 5 ? 5 : metres / pow >= 2 ? 2 : 1) * pow;
  $('hud').innerHTML = `${draw.outdoors || 0} people outdoors · ${SEASONS[seasonOf(S.t)]}<span class="scale" style="width:${Math.round(metres * cssS)}px"></span> ${metres >= 1000 ? `${metres / 1000} km` : `${metres} m`}`;
}

function setTab(t) {
  if (tab === t) return;
  tab = t;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === t);
  $('panel').innerHTML = '';
  panelDirty = true;
}

// ---- main loop ----------------------------------------------------------------

function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (speed > 0) {
    acc += dt * speed;
    const t0 = performance.now();
    let n = Math.floor(acc);
    acc -= n;
    if (n > 0 && speed > 6) snapshot();
    while (n-- > 0) {
      if (speed <= 6) snapshot();
      step(S);
      if (performance.now() - t0 > 24) { acc = 0; break; }
    }
    frac = speed <= 6 ? acc : 1;
  } else frac = 1;
  draw(now);
  if (S.eventCount !== shownEvents) { shownEvents = S.eventCount; renderEvents(); }
  if (panelDirty || (now - panelAt > 600 && tab !== 'people' && (speed > 0 || painter.pending))) { panelAt = now; panelDirty = false; renderPanel(); }
  if (now - hudAt > 250) { hudAt = now; renderDate(); renderHud(); }
  if (!painter.pending) window.__ready = true;
  requestAnimationFrame(frame);
}

// ---- input -----------------------------------------------------------------------

let drag = null;
const local = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * dpr(), (e.clientY - r.top) * dpr()]; };
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', (e) => {
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; follow = false; }
    if (drag.moved) { view.x = drag.vx - (dx * dpr()) / view.s; view.y = drag.vy - (dy * dpr()) / view.s; $('tip').hidden = true; }
    return;
  }
  const [cx, cy] = local(e), o = pickAt(wx(cx), wy(cy)), tip = $('tip');
  if (!o) { tip.hidden = true; return; }
  tip.innerHTML = tipText(o);
  tip.hidden = false;
  const r = canvas.getBoundingClientRect();
  tip.style.left = `${Math.min(r.width - 260, e.clientX - r.left + 14)}px`;
  tip.style.top = `${e.clientY - r.top + 14}px`;
});
canvas.addEventListener('pointerup', (e) => {
  canvas.classList.remove('dragging');
  if (drag && !drag.moved) { const [cx, cy] = local(e); select(pickAt(wx(cx), wy(cy))); }
  drag = null;
});
canvas.addEventListener('pointerleave', () => { $('tip').hidden = true; });
canvas.addEventListener('dblclick', (e) => {
  const [cx, cy] = local(e), o = pickAt(wx(cx), wy(cy));
  if (o && o.type === 'person') { select(o); follow = true; view.s = Math.max(view.s, 5 * dpr()); panelDirty = true; }
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const [cx, cy] = local(e), bx = wx(cx), by = wy(cy);
  view.s *= Math.exp(-e.deltaY * 0.0014);
  clampView();
  if (!follow) { view.x = bx - (cx - canvas.width / 2) / view.s; view.y = by - (cy - canvas.height / 2) / view.s; }
}, { passive: false });

function goTo(code) {
  const [type, id] = code.split(':');
  select({ type, id: Number(id) }, true);
}
$('panel').addEventListener('click', (e) => {
  const a = e.target.closest('[data-go]'), b = e.target.closest('[data-act]');
  if (a) goTo(a.dataset.go);
  else if (b && b.dataset.act === 'follow') { follow = !follow; if (follow) centerOn(sel); panelDirty = true; } else if (b && b.dataset.act === 'center') centerOn(sel);
});
$('panel').addEventListener('input', (e) => { if (e.target.id === 'find') { query = e.target.value; renderPanel(); } });
$('events').addEventListener('click', (e) => {
  const li = e.target.closest('li');
  const ev = li && S.events.find((x) => x.n === Number(li.dataset.n));
  if (!ev) return;
  const who = ev.who !== undefined ? S.people[ev.who] : null;
  if (who && who.alive && !who.away) return select({ type: 'person', id: who.id }, true);
  if (who) select({ type: 'person', id: who.id });
  if (ev.x !== undefined) { view.x = ev.x; view.y = ev.y; view.s = Math.max(view.s, 2 * dpr()); }
});
$('tabs').addEventListener('click', (e) => { if (e.target.dataset.tab) setTab(e.target.dataset.tab); });
$('speeds').addEventListener('click', (e) => { if (e.target.dataset.speed !== undefined) setSpeed(Number(e.target.dataset.speed)); });
$('viewCity').addEventListener('click', () => { follow = false; frameCity(); });
$('viewRegion').addEventListener('click', () => { follow = false; frameRegion(); });
$('minor').addEventListener('change', renderEvents);
$('filters').innerHTML = Object.keys(filters).map((k) => `<button data-f="${k}" class="on t-${k}">${k}</button>`).join('');
$('filters').addEventListener('click', (e) => {
  const k = e.target.dataset.f;
  if (!k) return;
  filters[k] = !filters[k];
  e.target.classList.toggle('on', filters[k]);
  renderEvents();
});

const SPEEDS = [0.25, 1, 6, 30, 180, 720];
let resume = 1;
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); if (speed) { resume = speed; setSpeed(0); } else setSpeed(resume); } else if (e.key >= '1' && e.key <= '6') setSpeed(SPEEDS[Number(e.key) - 1]);
  else if (e.key === '.') { snapshot(); step(S); panelDirty = true; } else if (e.key === 'c' || e.key === 'C') { follow = false; frameCity(); } else if (e.key === 'r' || e.key === 'R') { follow = false; frameRegion(); } else if ((e.key === 'f' || e.key === 'F') && sel && sel.type === 'person') { follow = !follow; panelDirty = true; } else if (e.key === 'Escape') select(null);
});
new ResizeObserver(resize).observe(canvas);

$('newWorld').addEventListener('click', () => {
  const seed = $('seed').value.trim() || Math.random().toString(36).slice(2, 8);
  adopt(createWorld(seed));
  toast(`New world “${S.seedText}”`);
});
$('save').addEventListener('click', () => {
  try { localStorage.setItem(SAVE_KEY, serialize(S)); toast('Saved in this browser'); } catch { toast('The browser refused the save; use Export instead'); }
});
$('load').addEventListener('click', () => {
  const text = localStorage.getItem(SAVE_KEY);
  if (!text) return toast('No saved world in this browser');
  try { adopt(deserialize(text)); toast('World loaded'); } catch (err) { toast(err.message); }
});
$('export').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([serialize(S)], { type: 'application/json' }));
  a.download = `world-in-dreams-${S.seedText}-day${dateOf(S.t).day + 1}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('import').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try { adopt(deserialize(await file.text())); toast('World loaded'); } catch (err) { toast(err.message); }
  e.target.value = '';
});

// ---- start: ?seed=…&days=…&minutes=…&view=x,y,scale&inspect=person:12&speed=0&tab=region&follow=1 ---------------

const params = new URLSearchParams(location.search);
adopt(createWorld(params.get('seed') || 'dreams'));
{
  const minutes = Math.min(200 * DAY, Number(params.get('days') || 0) * DAY + Number(params.get('minutes') || 0));
  for (let i = 0; i < minutes; i++) step(S);
  snapshot();
  if (params.get('view')) { const [x, y, s] = params.get('view').split(',').map(Number); view.x = x; view.y = y; view.s = s * dpr(); }
  if (params.get('inspect')) { const keep = { ...view }; goTo(params.get('inspect')); if (params.get('view')) Object.assign(view, keep); }
  if (params.get('follow')) follow = true;
  if (params.get('tab')) setTab(params.get('tab'));
  setSpeed(params.has('speed') ? Number(params.get('speed')) : 1);
}
requestAnimationFrame(frame);
