// Viewer: runs the engine in the browser and shows the region from above,
// from the whole countryside down to a single street. It only reads the world.
import {
  createWorld, step, serialize, deserialize, getLayout, dateOf, describe, needsOf, placeName, foodDays, priceOf, fullName, isNotable,
  jobOf, SPECIES, BEASTS, SEASONS, DAY, SEASON_DAYS, MEALS, seasonOf, interiorOf, economySummary, rentOf, housePrice, ownerOf, bizKind, moneyTotal,
  sunOf, planOf, honesty, temper,
} from '../engine/index.js';
import { inRect, corners } from '../engine/geom.js';
import { Painter, SEASON_LOOK, drawPerson, drawAnimal, nightOf, glowSprite, CLOTH, hairOf, drawInterior } from './render.js';
import { findPeople, validateWorld } from './viewer-tools.js';
import { installQualityOfLife } from './qol.js';
import { installObserver } from './observer.js';
import { fitRegion, constrainCamera, personScale } from './observer-tools.js';

const $ = (id) => document.getElementById(id);
const canvas = $('map');
const g = canvas.getContext('2d');
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TAU = Math.PI * 2;

let S, L, painter;
const view = { x: 0, y: 0, s: 2 };
let speed = 1, acc = 0, last = performance.now(), frac = 1;
let sel = null; // { type: 'person' | 'bld' | 'field' | 'animal' | 'site', id }
let follow = false, tab = 'inspect';
let qol, observer;
let hoverPerson = -1;
const peopleSearch = { site: '', status: '', life: 'living', page: 0 };
let px = new Float32Array(0), py = new Float32Array(0), hd = new Float32Array(0);
const apos = new Map(); // animal id -> [previous x, previous y, heading]
let lit = new Uint8Array(0), litAt = 0;
let shownEvents = -1, panelAt = 0, panelDirty = true, fvSeen = -1, seasonSeen = -1, invalidAt = 0, hudAt = 0, query = '';
const filters = { life: true, work: true, town: true, wild: true, quest: true, crime: true };
const tmp = [];
const openB = new Map(); // building id -> how far its roof is lifted (0..1), this frame

// ---- world lifecycle ---------------------------------------------------------

function adopt(world) {
  const layout = getLayout(world);
  validateWorld(world, layout, SPECIES);
  const nextPainter = new Painter(layout);
  S = world;
  L = layout;
  painter = nextPainter;
  sel = null; follow = false;
  acc = 0; frac = 1; litAt = -Infinity;
  hd.fill(0);
  apos.clear();
  shownEvents = -1; panelDirty = true; fvSeen = -1; seasonSeen = -1;
  $('seed').value = S.seedText;
  $('tip').hidden = true;
  snapshot();
  frameCity();
  observer?.adopted();
}

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2400);
}

function setSpeed(v) {
  if (![0, 0.25, 1, 6, 30, 180, 720].includes(v)) return;
  speed = v;
  acc = 0;
  for (const b of document.querySelectorAll('#speeds [data-speed]')) {
    b.classList.toggle('on', Number(b.dataset.speed) === v);
    b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === v));
  }
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
  const width = Math.max(50, Math.round(r.width * dpr())), height = Math.max(50, Math.round(r.height * dpr()));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}
function frameCity() {
  resize();
  view.x = 0; view.y = 0;
  view.s = Math.min(canvas.width / (L.wall.rx * 2.5), canvas.height / (L.wall.ry * 2.35));
}
function frameRegion() {
  Object.assign(view, fitRegion(L, canvas.width, canvas.height));
}
function clampView() {
  constrainCamera(view, L, canvas.width, canvas.height, dpr());
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
  if (o.type === 'household') { const hh = S.households[o.id]; if (L.blds[hh.home]) centerOn({ type: 'bld', id: hh.home }); return; }
  if (o.type === 'person') { const p = S.people[o.id]; view.x = p.x; view.y = p.y; view.s = Math.max(view.s, 5 * dpr()); } else if (o.type === 'bld') { const b = L.blds[o.id]; view.x = b.x; view.y = b.y; view.s = Math.max(view.s, 3.5 * dpr()); } else if (o.type === 'field') { const f = L.fields[o.id]; view.x = f.x; view.y = f.y; view.s = Math.max(view.s, 2 * dpr()); } else if (o.type === 'site') { const s = L.sites[o.id]; view.x = s.x; view.y = s.y; view.s = canvas.width / (s.r * (o.id ? 4 : 2.6)); } else if (o.type === 'animal') { const a = S.animals.find((q) => q.id === o.id); if (a) { view.x = a.x; view.y = a.y; view.s = Math.max(view.s, 4 * dpr()); } }
}

function select(o, center = false) {
  if (o && !validSelection(o)) return;
  const previous = captureView();
  if (!o || !sel || o.type !== sel.type || o.id !== sel.id) follow = false;
  sel = o;
  if (!o || o.type !== 'person') follow = false;
  if (center) centerOn(o);
  if (o) setTab('inspect', false);
  $('panel').scrollTop = 0;
  panelDirty = true;
  observer?.navigated(previous);
}

function validSelection(o) {
  if (!Number.isInteger(o.id) || o.id < 0) return false;
  return Boolean(({ person: S.people, household: S.households, bld: L.blds, field: L.fields, site: L.sites })[o.type]?.[o.id]
    || (o.type === 'animal' && S.animals.some((a) => a.id === o.id)));
}

function toggleFollow() {
  const p = sel?.type === 'person' && S.people[sel.id];
  if (!p || !p.alive || p.away) return;
  follow = !follow;
  if (follow) centerOn(sel);
  panelDirty = true;
}

function captureView() {
  return { seed: S.seed, version: S.version, view: { ...view, s: view.s / dpr() }, sel: sel && { ...sel }, tab, follow,
    query, people: { ...peopleSearch }, eventFilters: { ...filters }, minor: $('minor').checked, scroll: $('panel').scrollTop, observation: observer?.capture() };
}
function restoreView(data, includeObserver = true) {
  if (!data || data.seed !== S.seed || data.version !== S.version) return;
  if (data.view && [data.view.x, data.view.y, data.view.s].every(Number.isFinite) && data.view.s > 0) Object.assign(view, { ...data.view, s: data.view.s * dpr() });
  sel = data.sel && validSelection(data.sel) ? { type: data.sel.type, id: data.sel.id } : null;
  follow = Boolean(data.follow && sel?.type === 'person' && S.people[sel.id].alive && !S.people[sel.id].away);
  query = typeof data.query === 'string' ? data.query : '';
  if (data.people) for (const k of Object.keys(peopleSearch)) if (typeof data.people[k] === typeof peopleSearch[k]) peopleSearch[k] = data.people[k];
  if (data.eventFilters) for (const k of Object.keys(filters)) if (typeof data.eventFilters[k] === 'boolean') filters[k] = data.eventFilters[k];
  for (const b of $('filters').querySelectorAll('button')) { b.classList.toggle('on', filters[b.dataset.f]); b.setAttribute('aria-pressed', String(filters[b.dataset.f])); }
  if (typeof data.minor === 'boolean') $('minor').checked = data.minor;
  if (['inspect', 'region', 'people'].includes(data.tab)) tab = data.tab;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
  $('panel').innerHTML = ''; renderPanel(); $('panel').scrollTop = Number.isFinite(data.scroll) ? data.scroll : 0;
  observer?.restore(includeObserver ? data.observation : { ...data.observation, pins: undefined });
  clampView(); panelDirty = false;
}

function householdOfSelection() {
  if (sel?.type === 'household') return sel.id;
  if (sel?.type === 'person') return S.people[sel.id].hh;
  return -1;
}

function selectionLabel(o) {
  if (!validSelection(o)) return '';
  if (o.type === 'person') { const p = S.people[o.id]; return `${fullName(p)}${!p.alive ? p.gone ? ' · left region' : ' · deceased' : p.away ? ' · away' : ''}`; }
  if (o.type === 'household') return `${S.households[o.id].fam} household`;
  if (o.type === 'bld') return bldTitle(L.blds[o.id]);
  if (o.type === 'site') return L.sites[o.id].name;
  if (o.type === 'field') return CROP[L.fields[o.id].crop];
  return BEASTS[S.animals.find((a) => a.id === o.id).k].name;
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
    if (p.alive && !p.away) { const [x, y] = ppos(p), amount = observer?.settings.reduced ? 1 : 0.18; view.x += (x - view.x) * amount; view.y += (y - view.y) * amount; } else follow = false;
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
  // interiors: close up the roofs lift off; a selected building always opens
  openB.clear();
  const cs = s / dpr(), roofMode = observer?.settings.roofs || 'auto';
  const lift = roofMode === 'auto' ? Math.max(0, Math.min(1, (cs - 4.2) / 1.6)) : 0;
  if (cs >= 1.2) {
    const selB = sel && sel.type === 'bld' ? sel.id : sel && sel.type === 'person' && S.people[sel.id].alive ? S.people[sel.id].in : -1;
    for (const b of L.bldHash.query(x0, y0, x1, y1, tmp)) {
      const a = roofMode !== 'closed' && b.id === selB ? 1 : lift;
      if (a <= 0 || b.k === 'stall') continue;
      const I = interiorOf(L, b);
      if (!I) continue;
      drawInterior(g, b, I, s, sx(b.x), sy(b.y), a);
      openB.set(b.id, a);
    }
    if (openB.size) for (const p of S.people) {
      if (!p.alive || p.away || p.in < 0 || (openB.get(p.in) || 0) < 0.5) continue;
      const [x, y] = ppos(p);
      drawPerson(g, sx(x), sy(y), personScale(s, dpr(), true, observer?.settings.size), p, p.age < 15 ? 'none' : jobOf(p).c, hd[p.id] || 0, p.id === hoverPerson || sel?.type === 'person' && sel.id === p.id);
    }
  }
  let outdoors = 0;
  if (s >= 0.28 * dpr()) {
    for (const p of S.people) {
      if (!p.alive || p.away || p.in >= 0) continue;
      outdoors++;
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      const [x, y] = ppos(p);
      drawPerson(g, sx(x), sy(y), personScale(s, dpr(), false, observer?.settings.size), p, p.age < 15 ? 'none' : jobOf(p).c, hd[p.id] || 0, p.id === hoverPerson || sel?.type === 'person' && sel.id === p.id);
    }
  } else for (const p of S.people) if (p.alive && !p.away && p.in < 0) outdoors++;
  draw.outdoors = outdoors;

  // what is selected
  if (sel) {
    g.strokeStyle = '#fff'; g.lineWidth = 2 * dpr(); g.setLineDash([]);
    if (sel.type === 'person') {
      const p = S.people[sel.id];
      if (p.alive && !p.away) {
        const [x, y] = p.in >= 0 && (openB.get(p.in) || 0) < 0.5 ? [L.blds[p.in].x, L.blds[p.in].y] : ppos(p);
        if (p.route) {
          g.setLineDash([6 * dpr(), 5 * dpr()]); g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.6 * dpr();
          g.beginPath(); g.moveTo(sx(x), sy(y));
          for (let i = p.ri; i < p.route.length; i += 2) g.lineTo(sx(p.route[i]), sy(p.route[i + 1]));
          g.stroke(); g.setLineDash([]);
        }
        g.strokeStyle = '#ffe9a8'; g.lineWidth = 2 * dpr();
        g.beginPath(); g.arc(sx(x), sy(y), Math.max(9 * dpr(), (p.in >= 0 ? 1.1 : 2.4) * s) + (observer?.settings.reduced ? 0 : Math.sin(now / 260) * 2), 0, TAU); g.stroke();
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
  const dark = $('lyNight').checked ? nightOf(minute, sunOf(S.t)) : 0;
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
  const people = peopleNear(x, y);
  if (people.length) return { type: 'person', id: people[0].id };
  for (const a of S.animals) { const d = Math.hypot(a.x - x, a.y - y); if (d < bd) { bd = d; best = { type: 'animal', id: a.id }; } }
  if (best) return best;
  for (const b of L.bldHash.query(x, y, x, y, tmp)) if (inRect(x, y, b, 0.6)) return { type: 'bld', id: b.id };
  if (s < 0.6 * dpr()) for (const site of L.sites) if (Math.hypot(site.x - x, site.y - y) < site.r) return { type: 'site', id: site.id };
  for (const f of L.fieldHash.query(x, y, x, y, tmp)) if (inRect(x, y, f)) return { type: 'field', id: f.id };
  return null;
}

function peopleNear(x, y) {
  if (view.s < 0.28 * dpr()) return [];
  const radius = Math.max(10 * dpr(), personScale(view.s, dpr(), false, observer?.settings.size) * 1.5);
  const found = [];
  for (const p of S.people) {
    if (!p.alive || p.away || p.in >= 0 && (openB.get(p.in) || 0) < 0.5) continue;
    const [qx, qy] = ppos(p), distance = Math.hypot(qx - x, qy - y) * view.s;
    if (distance <= radius) found.push({ id: p.id, distance });
  }
  return found.sort((a, b) => a.distance - b.distance || a.id - b.id);
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

const go = (type, id, text) => `<a class="go" href="#${type}:${id}" data-go="${type}:${id}">${esc(text)}</a>`;
const person = (p, extra = '') => `<div class="row"><span>${go('person', p.id, fullName(p))}${p.alive ? '' : ' †'}</span><span class="n">${esc(extra || `${p.job}, ${p.age}`)}</span></div>`;
const stat = (k, v, pct, color = 'var(--accent)') => `<div class="stat"><span class="k">${k}</span><span class="bar"><i style="width:${Math.max(0, Math.min(100, pct))}%;background:${color}"></i></span><span class="v">${v}</span></div>`;
const tone = (v) => (v > 60 ? 'var(--good)' : v > 30 ? 'var(--accent)' : 'var(--bad)');
const hist = (list) => (list.length ? `<ul class="hist">${list.slice().reverse().map((h) => `<li><span class="d">${dateOf(h.t).short}</span>${esc(h.text)}</li>`).join('')}</ul>` : '<div class="sub">Nothing of note yet.</div>');

// ---- money ------------------------------------------------------------------------

const coins = (n) => `${fmt(n)} coin${Math.round(n) === 1 ? '' : 's'}`;
function standing(hh) {
  const per = hh.coins / Math.max(1, hh.m.length);
  return per < 4 ? ['destitute', 'bad'] : per < 15 ? ['poor', 'bad'] : per < 45 ? ['getting by', ''] : per < 120 ? ['comfortable', 'good'] : ['wealthy', 'odd'];
}
function landlordName(hh) {
  const o = ownerOf(S, hh.home);
  if (o === hh.id) return null;
  const lord = S.households[S.lord];
  return o >= 0 && S.households[o].m.length ? `the ${S.households[o].fam} family` : `the lord${lord ? ` (${lord.fam})` : ''}`;
}
function homeRows(hh) {
  const b = L.blds[hh.home];
  if (!b || hh.id === S.lord) return '';
  const lord = landlordName(hh), [word, cls] = standing(hh);
  return `<div class="row"><span>Standing</span><span class="n"><span class="tag ${cls}">${word}</span></span></div>
    <div class="row"><span>The house</span><span class="n">${lord ? `rented from ${esc(lord)}, ${coins(rentOf(L, b))} a week${hh.arrears ? ` · <b style="color:var(--bad)">${hh.arrears} week${hh.arrears > 1 ? 's' : ''} behind</b>` : ''}` : 'owned by the family'}</span></div>
    ${stat('Goods', `${hh.goods.toFixed(1)}`, (hh.goods / Math.max(1, hh.m.length)) * 55, tone((hh.goods / Math.max(1, hh.m.length)) * 55))}`;
}
function spark(values, color = 'var(--accent)', title = 'Recorded money · coins') {
  if (values.length < 2) return '';
  const lo = Math.min(...values), hi = Math.max(...values), w = 220, h = 34;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - lo) / Math.max(1, hi - lo)) * (h - 6)).toFixed(1)}`).join(' ');
  const dates = S.econ.hist.map((entry) => dateOf(entry.day * DAY).short);
  return `<figure class="money-chart"><figcaption>${esc(title)}</figcaption><svg class="spark" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" role="img" aria-label="${esc(title)}: ${fmt(values[0])} to ${fmt(values.at(-1))} coins"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>
    <div class="chart-axis"><span>${dates[0]}</span><span>${dates.at(-1)}</span></div><div class="sub">Min ${fmt(lo)} · max ${fmt(hi)} · latest ${fmt(values.at(-1))} coins</div>
    <details><summary>Recorded values</summary><table><thead><tr><th>Game date</th><th>Coins</th></tr></thead><tbody>${values.map((v, i) => `<tr><td>${dates[i]}</td><td>${fmt(v)}</td></tr>`).join('')}</tbody></table></details></figure>`;
}
const BIZ_WORD = { goods: 'Workshop', food: 'Food shop', ale: 'Brewery', tavern: 'Tavern', stall: 'Market stall', temple: 'Temple purse', guild: 'Guild purse' };
function bizRows(b) {
  const B = S.biz[b.id], k = bizKind(b);
  if (!B) return '';
  const owner = S.households[B.owner];
  return `<h3>${BIZ_WORD[k] || 'Business'}</h3>
    ${B.closed ? `<div class="row"><span>Status</span><span class="n"><span class="tag bad">closed</span> since ${dateOf(B.closed * DAY).short}</span></div>` : ''}
    <div class="row"><span>In the till</span><span class="n">${coins(B.coins)}</span></div>
    ${k === 'goods' ? `<div class="row"><span>On the shelves</span><span class="n">${B.stock.toFixed(1)} goods at ${B.price.toFixed(2)} each</span></div>` : ''}
    ${k === 'ale' ? `<div class="row"><span>In the cellar</span><span class="n">${fmt(B.stock)} jugs of ale</span></div>` : ''}
    ${B.bill ? `<div class="row"><span>Wages</span><span class="n">${coins(B.bill)} a full day</span></div>` : ''}
    <div class="row"><span>Sales this week</span><span class="n">${coins(B.sales)}</span></div>
    ${owner && owner.m.length ? `<div class="row"><span>Owned by</span><span class="n">${go('person', owner.m[0], `the ${owner.fam} family`)}</span></div>` : ''}`;
}
function insideRows(b) {
  const I = interiorOf(L, b);
  if (!I) return '';
  const rooms = {};
  for (const r of I.rooms) rooms[r.name] = (rooms[r.name] || 0) + 1;
  const list = Object.entries(rooms).map(([k, v]) => (v > 1 ? `${v} ${k}s` : k)).join(', ');
  const c = I.count, parts = [c.bed && `${c.bed} sleeping places`, c.seat && `${c.seat} seats`, c.pew && `${c.pew} places on the pews`, c.work && `${c.work} working places`].filter(Boolean);
  return `<h3>Inside</h3><div class="btns"><button data-act="inside">Show inside</button><button data-act="outside">Show exterior</button></div><div class="row"><span>Rooms</span><span class="n">${esc(list)}</span></div><div class="row"><span>Room for</span><span class="n">${parts.join(' · ')}</span></div>`;
}

function householdPanel(hh) {
  const members = S.people.filter((p) => p.hh === hh.id);
  return `<h2>${esc(hh.fam)} household</h2><div class="sub">${go('site', hh.site, L.sites[hh.site].name)}</div>
    <div class="row"><span>Current purse</span><span class="n">${coins(hh.coins)}</span></div>
    <div class="row"><span>Larder</span><span class="n">${fmt(hh.pantry)} meals</span></div>
    ${L.blds[hh.home] ? `<div class="row"><span>Home</span>${go('bld', hh.home, bldTitle(L.blds[hh.home]))}</div>${homeRows(hh)}` : ''}
    <h3>Recorded members</h3>${members.map((p) => person(p, !p.alive ? p.gone ? 'left the region' : 'deceased' : `${p.job}, ${p.age}`)).join('') || '<p class="sub">No members remain associated with this household.</p>'}
    <p class="sub">Current household associations and retained records; a complete family archive is not available.</p>`;
}

function personPanel(p) {
  const hh = S.households[p.hh], n = needsOf(S, p), sp = SPECIES[p.sp], home = L.blds[p.home];
  const kin = [];
  if (p.spouse >= 0) kin.push(person(S.people[p.spouse], p.sex === 'f' ? 'husband' : 'wife'));
  for (const id of [p.mom, p.dad]) if (id >= 0) kin.push(person(S.people[id], id === p.mom ? 'mother' : 'father'));
  for (const q of S.people) if (q.mom === p.id || q.dad === p.id) kin.push(person(q, `${q.sex === 'f' ? 'daughter' : 'son'}, ${q.age}`));
  const mates = hh ? hh.m.map((id) => S.people[id]).filter((q) => q.id !== p.id && q.spouse !== p.id && q.mom !== p.id && q.dad !== p.id && p.mom !== q.id && p.dad !== q.id) : [];
  const state = !p.alive ? `<span class="tag bad">${p.gone ? 'left the region' : 'dead'}</span>` : p.jail > S.t ? '<span class="tag bad">in the cells</span>' : p.sick > S.t ? '<span class="tag bad">sick</span>' : p.hurt > S.t ? '<span class="tag bad">wounded</span>' : p.miss > 2 ? '<span class="tag bad">hungry</span>' : '';
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
      ${homeRows(hh)}
      <div class="row"><span>Larder</span><span class="n">${fmt(hh.pantry)} meals (${(hh.pantry / Math.max(1, hh.m.length * MEALS)).toFixed(1)} days)</span></div>` : ''}
    ${kin.length ? `<h3>Family</h3>${kin.join('')}` : ''}
    ${mates.length ? `<h3>Also in the house</h3>${mates.map((q) => person(q)).join('')}` : ''}
    ${p.friends.length ? `<h3>Friends</h3>${p.friends.map((id) => person(S.people[id])).join('')}` : ''}
    <h3>Character</h3>
    <div>${p.traits.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}<span class="tag odd">${esc(p.arch)}</span></div>
    <div class="row"><span>Dream</span><span class="n">${esc(p.goal)}</span></div>
    ${natureRows(p)}
    <h3>Life so far</h3>${hist(p.hist)}`;
}

const clock = (m) => { const v = ((Math.round(m) % DAY) + DAY) % DAY; return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`; };
/** Conscience, temper, the hours a person keeps and what the law knows of them. */
function natureRows(p) {
  const h = honesty(p), t = temper(p), r = S.law[p.id], P = p.alive && !p.away && p.job !== 'trader' ? planOf(S, p, jobOf(p)) : null;
  const rows = [`<div class="row"><span>Nature</span><span class="n">${h >= 1 ? 'honest' : h <= -1.2 ? 'crooked' : h < 0 ? 'not above temptation' : 'decent'} · ${t >= 1 ? 'quick to anger' : t <= -0.5 ? 'mild' : 'even-tempered'}</span></div>`];
  if (P) rows.push(`<div class="row"><span>Keeps hours</span><span class="n">up at ${clock(P.wake)} · to bed at ${clock(P.bed)}${p.debt > 60 ? ' · short of sleep' : ''}</span></div>`);
  if (r && (r.n || r.u || r.jail)) rows.push(`<div class="row"><span>Record</span><span class="n">${r.n} known offence${r.n === 1 ? '' : 's'} · jailed ${r.jail} time${r.jail === 1 ? '' : 's'}${r.u ? ` · ${r.u} never found out` : ''}</span></div>`);
  if (r && r.foe >= 0 && S.people[r.foe]) rows.push(`<div class="row"><span>Bears a grudge against</span><span class="n">${go('person', r.foe, fullName(S.people[r.foe]))}</span></div>`);
  return rows.join('');
}

function bldPanel(b) {
  const site = L.sites[b.site];
  const res = S.people.filter((p) => p.alive && p.home === b.id), workers = S.people.filter((p) => p.alive && p.work === b.id);
  const inside = S.people.filter((p) => p.alive && !p.away && p.in === b.id);
  const guests = inside.filter((p) => p.home !== b.id && p.work !== b.id);
  const store = b.id === site.granary ? S.sites[b.site] : null;
  return `<h2>${esc(bldTitle(b))}</h2>
    <div class="sub">${esc(cap(b.k))} in ${go('site', b.site, site.name)} · ${inside.length} inside now</div>
    ${b.k === 'house' || b.k === 'farmhouse' ? (() => {
      const o = ownerOf(S, b.id), hh = S.households[S.occ[b.id]];
      const who = o >= 0 && S.households[o].m.length ? `the ${S.households[o].fam} family` : 'the lord';
      return `<div class="row"><span>Owner</span><span class="n">${hh && o === hh.id ? 'the family who live here' : esc(who)}</span></div>
        <div class="row"><span>Worth</span><span class="n">${coins(housePrice(L, b))} · rent ${coins(rentOf(L, b))} a week</span></div>`;
    })() : ''}
    ${b.id === L.sites[0].keep && S.households[S.lord] ? `<div class="row"><span>The lord's coffers</span><span class="n">${coins(S.households[S.lord].coins)}</span></div>` : ''}
    ${bizRows(b)}
    ${store ? `<h3>Common store</h3>${stat('Food', `${fmt(store.food)} meals`, foodDays(S, b.site) * 2.5, tone(foodDays(S, b.site) * 4))}<div class="row"><span>Lasts</span><span class="n">${foodDays(S, b.site).toFixed(0)} days</span></div>` : ''}
    ${res.length ? `<h3>Lives here</h3>${res.map((p) => person(p)).join('')}` : b.k === 'house' ? '<div class="sub">The house stands empty.</div>' : ''}
    ${workers.length ? `<h3>Works here</h3>${workers.map((p) => person(p, `${p.job}${p.in === b.id ? ' · in' : ''}`)).join('')}` : ''}
    ${guests.length ? `<h3>Visitors now</h3>${guests.slice(0, 30).map((p) => person(p, describe(S, L, p).split(' at ')[0])).join('')}` : ''}
    ${insideRows(b)}`;
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
    <div class="row"><span>Treasury</span><span class="n">${fmt(d.coins)} coins · pays ${coins(d.bill || 0)} a full day</span></div>
    <div class="row"><span>Homes</span><span class="n">${(() => { const hs = S.households.filter((h) => h.site === i && h.m.length && h.id !== S.lord); const own = hs.filter((h) => ownerOf(S, h.home) === h.id).length; return `${own} owned · ${hs.length - own} rented`; })()}</span></div>
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
    ${yearRows()}
    <h3>Settlements</h3>
    ${L.sites.map((s, i) => `<div class="card" role="button" tabindex="0" data-go="site:${i}"><div class="head"><strong>${esc(s.name)}</strong><span>${fmt(S.sites[i].pop)} people</span></div><p>${s.kind === 'city' ? 'City' : cap(s.type === 'plain' ? 'farming' : s.type) + ' village'} · food for ${foodDays(S, i).toFixed(0)} days${S.sites[i].short ? ' · <b style="color:var(--bad)">shortage</b>' : ''}</p></div>`).join('')}
    ${economyRows()}
    <h3>Wildlife and flocks</h3>
    ${Object.keys(BEASTS).map((k) => `<div class="row"><span>${BEASTS[k].name}</span><span class="n">${beasts[k] || 0}</span></div>`).join('')}
    <h3>Guild notice board</h3>
    ${quests.map((q) => `<div class="row"><span>${q.kind === 'wolf' ? 'Wolf bounty' : 'Slime cull'} ${esc(q.near)}</span><span class="n">${q.party} of ${q.max} · ${q.reward} coins</span></div>`).join('') || '<div class="sub">No open quests.</div>'}
    <h3>Controls</h3>
    <div class="sub">Drag to pan, wheel to zoom. <kbd>Space</kbd> pause, <kbd>1</kbd>–<kbd>6</kbd> speed, <kbd>.</kbd> one minute, <kbd>C</kbd> city, <kbd>R</kbd> region, <kbd>F</kbd> follow, <kbd>Esc</kbd> deselect.</div>`;
}

const YEAR_WORD = { good: 'a kind year', normal: 'an ordinary year', fair: 'a middling year', poor: 'a poor year', failed: 'a failed harvest' };
/** What this year has brought: the harvest outlook, deaths by cause, crime and punishment, trades, misfortune. */
function yearRows() {
  const T = (S.tally && S.tally.cur) || {}, W = S.weather, line = (o) => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${fmt(v)} ${esc(k)}`).join(' · ');
  const sick = S.ills.filter((o) => o.open).map((o) => `${esc(L.sites[o.site].name)}`);
  const rows = [['Harvest', W && W.told ? cap(YEAR_WORD[W.kind]) : 'Too early to tell'], ['Illness', sick.length ? `Outbreak in ${sick.join(', ')}` : 'None going round'],
    ['Deaths', line(T.deaths)], ['Crimes', line(T.crimes)], ['The law', line(T.justice)], ['Abuses', line(T.abuses)], ['Trades', line(T.trades)], ['Misfortune', line(T.misfortune)], ['Vice', line(T.vice)]];
  return `<h3>This year</h3>${rows.filter(([, v]) => v).map(([k, v]) => `<div class="row"><span>${k}</span><span class="n">${v}</span></div>`).join('')}`;
}

function economyRows() {
  const e = economySummary(S, L), w = S.econ.last, h = S.econ.hist;
  const parts = [['Households', e.households, 'var(--good)'], ['Treasuries', e.treasuries, 'var(--accent)'], ['Businesses', e.biz, '#b98a5e'], ['The lord', e.lord, '#8e3fa8']];
  const total = Math.max(1, e.money);
  return `<h3>Economy</h3>
    <div class="row"><span>Money in the region</span><span class="n">${coins(moneyTotal(S))}</span></div>
    ${spark(h.map((x) => x.money), 'var(--accent)', 'Total regional money · coins · weekly snapshots')}
    ${parts.map(([k, v, c]) => stat(k, fmt(v), (v / total) * 100, c)).join('')}
    <div class="row"><span>Household savings · coins</span><span class="n">10th percentile ${fmt(e.p10)} · median ${fmt(e.p50)} · 90th percentile ${fmt(e.p90)}</span></div>
    ${spark(h.map((x) => x.p50), 'var(--good)', 'Median household savings · coins · weekly snapshots')}
    <div class="row"><span>Homes</span><span class="n">${e.owners} owned · ${e.tenants} rented</span></div>
    <div class="row"><span>A meal in the city</span><span class="n">${e.food[0].toFixed(2)} · villages ${(e.food.slice(1).reduce((a, b) => a + b, 0) / Math.max(1, e.food.length - 1)).toFixed(2)}</span></div>
    <div class="row"><span>Goods</span><span class="n">${e.goods.toFixed(2)} coins each</span></div>
    ${w ? `<div class="sub">Last completed six-day week, in coins: wages ${fmt(w.wages)} · food ${fmt(w.food)} · goods ${fmt(w.goods)} · ale ${fmt(w.drink)} · rent ${fmt(w.rent)} · taxes and tolls ${fmt(w.tax + w.toll)} · offerings ${fmt(w.offer)} · temple alms ${fmt(w.alms)} · poor relief ${fmt(w.relief)} · exports ${fmt(w.exports)} · imports ${fmt(w.imports)}${w.evicted ? ` · ${w.evicted} evicted` : ''}${w.bought ? ` · ${w.bought} houses sold` : ''}</div>` : '<div class="sub">The first week is not over yet.</div>'}
    <details class="economy-help"><summary>How to read these figures</summary><p>Household savings are total coins per household, excluding the lord. The 10th and 90th percentiles are distribution cutoffs. Standing in a person inspector uses coins per member instead.</p><p>Food is priced in coins per meal; larder days assume ${MEALS} meals per person per day. Wages are paid from employers' purses. Rent and taxes are collected every six-day week; arrears count unpaid weeks. Workshop sales are weekly revenue before costs.</p><p>These summaries show recorded amounts. A transaction history for an individual household is not available.</p></details>`;
}

function peoplePanel() {
  const result = findPeople(S.people, L.sites, fullName, { ...peopleSearch, query });
  peopleSearch.page = result.page;
  const option = (value, text, selected) => `<option value="${value}"${String(selected) === String(value) ? ' selected' : ''}>${esc(text)}</option>`;
  return `<div class="people-search"><label class="sub" for="find">Find an inhabitant</label>
    <input id="find" type="search" placeholder="Name, trade, species or settlement" value="${esc(query)}">
    <div class="search-filters"><select id="find-site" aria-label="Filter by settlement">${option('', 'All settlements', peopleSearch.site)}${L.sites.map((s) => option(s.id, s.name, peopleSearch.site)).join('')}</select>
    <select id="find-status" aria-label="Filter by location">${[['', 'Any location'], ['outdoors', 'Outdoors'], ['indoors', 'Indoors'], ['away', 'Away']].map(([v, t]) => option(v, t, peopleSearch.status)).join('')}</select>
    <select id="find-life" aria-label="Filter by life status">${[['living', 'Living'], ['dead', 'Deceased'], ['gone', 'Left the region'], ['all', 'All recorded people']].map(([v, t]) => option(v, t, peopleSearch.life)).join('')}</select></div></div>
    <div id="found"><div class="search-summary"><span role="status">${fmt(result.total)} ${result.total === 1 ? 'person' : 'people'} found</span><button data-search="reset">Reset</button></div>
    ${result.list.map((p) => person(p, `${p.job}${!p.alive ? p.gone ? ' · left region' : ' · deceased' : p.away ? ' · away' : ''}`)).join('') || '<div class="empty">No matches. Try fewer words or reset the filters.</div>'}
    <div class="pagination"><button data-search="prev"${result.page === 0 ? ' disabled' : ''}>Previous</button><span>Page ${result.page + 1} of ${result.pages}</span><button data-search="next"${result.page + 1 >= result.pages ? ' disabled' : ''}>Next</button></div></div>`;
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
  else if (sel.type === 'household') el.innerHTML = householdPanel(S.households[sel.id]);
  else if (sel.type === 'bld') el.innerHTML = bldPanel(L.blds[sel.id]);
  else if (sel.type === 'field') el.innerHTML = fieldPanel(L.fields[sel.id]);
  else if (sel.type === 'site') el.innerHTML = sitePanel(sel.id);
  else if (sel.type === 'animal') { const a = S.animals.find((x) => x.id === sel.id); el.innerHTML = a ? animalPanel(a) : '<div class="empty">It is gone.</div>'; }
  el.scrollTop = top;
}

function renderEvents() {
  const minor = $('minor').checked;
  const list = observer ? observer.chronicleEvents(S.events, minor, filters) : S.events.filter((e) => filters[e.type] && (minor || e.imp >= 1)).slice(-150).reverse();
  const events = $('events'), top = events.getBoundingClientRect().top;
  const anchor = (events.scrollTop > 4 && [...events.querySelectorAll('[data-n]')].find((b) => b.getBoundingClientRect().bottom > top)) || null;
  const anchorId = anchor?.dataset.n, offset = anchor ? anchor.getBoundingClientRect().top - top : 0;
  const focused = events.contains(document.activeElement) ? document.activeElement.dataset.n : null;
  $('events').innerHTML = list.map((e) => `<li class="t-${e.type} i${e.imp}"><button data-n="${e.n}"><span class="d">${dateOf(e.t).short} · ${dateOf(e.t).clock}</span>${esc(e.text)}</button></li>`).join('') || '<li class="empty">No events match these filters yet.</li>';
  if (anchorId) {
    const next = [...events.querySelectorAll('[data-n]')].find((b) => b.dataset.n === anchorId);
    if (next) events.scrollTop += next.getBoundingClientRect().top - top - offset;
  }
  if (focused) [...events.querySelectorAll('[data-n]')].find((b) => b.dataset.n === focused)?.focus({ preventScroll: true });
}

function renderDate() {
  const d = dateOf(S.t), night = nightOf(S.t % DAY, sunOf(S.t)) > 0.3;
  $('date').innerHTML = `${d.text}<b>${d.clock}</b> ${night ? '☾' : '☀'}`;
}

function renderHud() {
  const cssS = view.s / dpr();
  let metres = 110 / cssS;
  const pow = 10 ** Math.floor(Math.log10(metres));
  metres = (metres / pow >= 5 ? 5 : metres / pow >= 2 ? 2 : 1) * pow;
  $('hud').innerHTML = `${draw.outdoors || 0} people outdoors · ${SEASONS[seasonOf(S.t)]}<span class="scale" style="width:${Math.round(metres * cssS)}px"></span> ${metres >= 1000 ? `${metres / 1000} km` : `${metres} m`}`;
}

function setTab(t, remember = true) {
  if (!['inspect', 'region', 'people'].includes(t)) return;
  if (tab === t) return;
  const previous = captureView();
  tab = t;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === t);
  $('panel').innerHTML = '';
  panelDirty = true;
  if (remember) observer?.navigated(previous);
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
      if (observer?.afterStep() === false) { acc = 0; break; }
      if (performance.now() - t0 > 24) { acc = 0; break; }
    }
    frac = speed <= 6 ? acc : 1;
  } else frac = 1;
  draw(now);
  if (S.eventCount !== shownEvents) { shownEvents = S.eventCount; renderEvents(); }
  const refreshPeople = tab === 'people' && now - panelAt > 1600 && !$('found')?.contains(document.activeElement);
  const refreshInspect = tab !== 'people' && now - panelAt > 600 && !$('panel').contains(document.activeElement);
  if (panelDirty || ((refreshInspect || refreshPeople) && (speed > 0 || painter.pending))) { panelAt = now; panelDirty = false; renderPanel(); }
  if (now - hudAt > 250) { hudAt = now; renderDate(); renderHud(); qol?.update(); observer?.update(now); }
  if (!painter.pending) window.__ready = true;
  requestAnimationFrame(frame);
}

// ---- input -----------------------------------------------------------------------

let drag = null, pickerTimer = null;
const local = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * dpr(), (e.clientY - r.top) * dpr()]; };
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  clearTimeout(pickerTimer);
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
  hoverPerson = o?.type === 'person' ? o.id : -1;
  if (!o) { tip.hidden = true; return; }
  tip.innerHTML = tipText(o);
  tip.hidden = false;
  const r = canvas.getBoundingClientRect();
  tip.style.left = `${Math.min(r.width - 260, e.clientX - r.left + 14)}px`;
  tip.style.top = `${e.clientY - r.top + 14}px`;
});
canvas.addEventListener('pointerup', (e) => {
  canvas.classList.remove('dragging');
  if (drag && !drag.moved) {
    const [cx, cy] = local(e), x = wx(cx), y = wy(cy), nearby = peopleNear(x, y);
    if (observer && nearby.length > 1) pickerTimer = setTimeout(() => observer.choosePeople(nearby, e.clientX, e.clientY), 220);
    else select(pickAt(x, y));
  }
  drag = null;
});
canvas.addEventListener('pointercancel', () => { drag = null; canvas.classList.remove('dragging'); });
canvas.addEventListener('lostpointercapture', () => { drag = null; canvas.classList.remove('dragging'); });
canvas.addEventListener('pointerleave', () => { $('tip').hidden = true; hoverPerson = -1; });
canvas.addEventListener('dblclick', (e) => {
  clearTimeout(pickerTimer); observer?.dismissPicker();
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
  const a = e.target.closest('[data-go]'), b = e.target.closest('[data-act]'), search = e.target.closest('[data-search]');
  if (a) { e.preventDefault(); goTo(a.dataset.go); }
  else if (search) {
    if (search.dataset.search === 'reset') { query = ''; Object.assign(peopleSearch, { site: '', status: '', life: 'living', page: 0 }); $('panel').innerHTML = ''; }
    else peopleSearch.page += search.dataset.search === 'next' ? 1 : -1;
    renderPanel(); $('panel').scrollTop = 0;
  } else if (b && b.dataset.act === 'follow') toggleFollow(); else if (b && b.dataset.act === 'center') centerOn(sel);
  else if (b) observer?.action(b.dataset.act);
});
$('panel').addEventListener('input', (e) => { if (e.target.id === 'find') { query = e.target.value; peopleSearch.page = 0; renderPanel(); } });
$('panel').addEventListener('change', (e) => {
  if (e.target.id === 'find-site') peopleSearch.site = e.target.value;
  else if (e.target.id === 'find-status') peopleSearch.status = e.target.value;
  else if (e.target.id === 'find-life') { peopleSearch.life = e.target.value; peopleSearch.status = ''; $('find-status').value = ''; }
  else return;
  peopleSearch.page = 0; renderPanel();
});
$('panel').addEventListener('keydown', (e) => {
  const card = e.target.closest('.card[data-go]');
  if (card && (e.key === 'Enter' || e.code === 'Space')) { e.preventDefault(); goTo(card.dataset.go); }
});
$('events').addEventListener('click', (e) => {
  const button = e.target.closest('[data-n]');
  const ev = button && S.events.find((x) => x.n === Number(button.dataset.n));
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
$('filters').innerHTML = Object.keys(filters).map((k) => `<button data-f="${k}" aria-pressed="true" class="on t-${k}">${k}</button>`).join('');
$('filters').addEventListener('click', (e) => {
  const k = e.target.dataset.f;
  if (!k) return;
  filters[k] = !filters[k];
  e.target.classList.toggle('on', filters[k]);
  e.target.setAttribute('aria-pressed', String(filters[k]));
  renderEvents();
});
new ResizeObserver(resize).observe(canvas);

// ---- start: ?seed=…&days=…&minutes=…&view=x,y,scale&inspect=person:12&speed=0&tab=region&follow=1 ---------------

const params = new URLSearchParams(location.search);
adopt(createWorld(params.get('seed') || 'dreams'));
{
  const minutes = Math.min(200 * DAY, Number(params.get('days') || 0) * DAY + Number(params.get('minutes') || 0));
  for (let i = 0; i < minutes; i++) step(S);
  snapshot();
  if (params.get('view')) { const [x, y, s] = params.get('view').split(',').map(Number); if ([x, y, s].every(Number.isFinite) && s > 0) { view.x = x; view.y = y; view.s = s * dpr(); } }
  if (params.get('inspect')) { const keep = { ...view }; goTo(params.get('inspect')); if (params.get('view')) Object.assign(view, keep); }
  if (params.get('follow') === '1' && sel?.type === 'person' && S.people[sel.id].alive && !S.people[sel.id].away) follow = true;
  if (params.get('tab')) setTab(params.get('tab'));
  setSpeed(params.has('speed') ? Number(params.get('speed')) : 1);
}
qol = installQualityOfLife({
  world: () => S, speed: () => speed, setSpeed, adopt, serialize, deserialize, create: createWorld, toast,
  validate: (world) => validateWorld(world, getLayout(world), SPECIES), day: (t) => dateOf(t).day,
  filters, events: renderEvents, capture: captureView, restore: restoreView, cancelAdvance: () => observer?.cancelAdvance(), following: () => follow && sel?.type === 'person' ? fullName(S.people[sel.id]) : '',
  search() { setTab('people'); renderPanel(); $('find').focus(); $('find').select(); },
  action(action) {
    if (action === 'step') { observer?.cancelAdvance(); setSpeed(0); advanceOne(); }
    else if (action === 'city') { follow = false; frameCity(); }
    else if (action === 'region') { follow = false; frameRegion(); }
    else if (action === 'follow') toggleFollow();
    else if (action === 'center') { if (sel) centerOn(sel); else toast('Select a person or place first'); }
    else if (action === 'clear') select(null);
    else if (action === 'zoomIn' || action === 'zoomOut') { view.s *= action === 'zoomIn' ? 1.3 : 1 / 1.3; clampView(); }
    else if (['left', 'right', 'up', 'down'].includes(action)) {
      follow = false;
      const distance = 80 * dpr() / view.s;
      if (action === 'left' || action === 'right') view.x += action === 'left' ? -distance : distance;
      else view.y += action === 'up' ? -distance : distance;
      clampView();
    }
    else observer?.action(action);
  },
});
function advanceOne() {
  snapshot(); step(S); frac = 1; panelDirty = true;
  return observer?.afterStep() !== false;
}
observer = installObserver({
  world: () => S, layout: () => L, selection: () => sel, household: householdOfSelection, valid: validSelection, label: selectionLabel,
  capture: captureView, restore: restoreView, select, speed: () => speed, setSpeed, toast, serialize,
  dirty: () => { panelDirty = true; }, events: renderEvents, day: DAY, seasonMinutes: SEASON_DAYS * DAY,
  date: (t) => `${dateOf(t).short} ${dateOf(t).clock}`, camera: () => view, viewport: () => ({ width: canvas.width, height: canvas.height }),
  panTo(x, y) { follow = false; view.x = x; view.y = y; clampView(); },
  action: (name) => { if (name === 'region') { follow = false; frameRegion(); } }, advanceOne,
  loadRecord: (record, message) => qol.loadRecord(record, message),
});
requestAnimationFrame(frame);
