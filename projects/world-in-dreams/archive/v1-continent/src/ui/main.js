// Viewer: runs the engine in the browser and shows the world top-down.
import { createWorld, step, serialize, deserialize, getMap, dateOf, SPECIES, SP, BIOMES, KIND, defense } from '../engine/index.js';
import { TILE, buildTerrain, buildRoads, buildTerritory, siteStyle, drawSite, drawParty, PARTY } from './render.js';

const $ = (id) => document.getElementById(id);
const canvas = $('map');
const g = canvas.getContext('2d');
const SAVE_KEY = 'world-in-dreams:save';
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

let state, map, terrain, roads, territory;
let roadsKey = -1, terrKey = '';
const view = { scale: 6, x: 0, y: 0 };
let speed = 0, acc = 0, last = performance.now();
let sel = null; // { type: 'site' | 'npc' | 'party' | 'faction' | 'tile', id }
let tab = 'inspect';
let fitted = false, panelDirty = true, shownEvents = -1, lastPanel = 0;
const prev = new Map(); // party id -> previous tile position, for smooth motion
const filters = { war: true, raid: true, economy: true, monster: true, people: true, world: true };

// ---- world lifecycle --------------------------------------------------------

function adopt(world) {
  state = world;
  map = getMap(state);
  terrain = buildTerrain(map);
  roadsKey = -1;
  terrKey = '';
  sel = null;
  prev.clear();
  shownEvents = -1;
  panelDirty = true;
  $('seed').value = state.seedText;
  fitted = false;
  touched = false;
}

function fit() {
  const r = canvas.getBoundingClientRect();
  view.scale = Math.max(2, Math.min(r.width / map.w, r.height / map.h));
  view.x = (r.width - map.w * view.scale) / 2;
  view.y = (r.height - map.h * view.scale) / 2;
}

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2200);
}

function setSpeed(v) {
  speed = v;
  for (const b of document.querySelectorAll('#speeds [data-speed]')) b.classList.toggle('on', Number(b.dataset.speed) === v);
}

function advance() {
  prev.clear();
  for (const p of state.parties) prev.set(p.id, p.path[Math.floor(p.pos)]);
  step(state);
}

// ---- geometry ---------------------------------------------------------------

const sx = (tx) => (tx + 0.5) * view.scale + view.x;
const sy = (ty) => (ty + 0.5) * view.scale + view.y;

function partyTile(p, frac) {
  const cur = p.path[Math.floor(p.pos)];
  let x = cur % map.w, y = Math.floor(cur / map.w);
  const before = prev.get(p.id);
  if (before !== undefined && frac < 1) {
    const bx = before % map.w, by = Math.floor(before / map.w);
    if (Math.abs(bx - x) + Math.abs(by - y) < 30) { x = bx + (x - bx) * frac; y = by + (y - by) * frac; }
  }
  return [x, y];
}

// ---- drawing ----------------------------------------------------------------

function draw(frac) {
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  if (canvas.width !== Math.round(r.width * dpr) || canvas.height !== Math.round(r.height * dpr)) {
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#0d1a2b';
  g.fillRect(0, 0, r.width, r.height);
  const W = map.w * view.scale, H = map.h * view.scale;
  g.imageSmoothingEnabled = view.scale < TILE;
  g.drawImage(terrain, view.x, view.y, W, H);

  if ($('lyTerritory').checked) {
    let key = '';
    for (const s of state.sites) if (s.mode === 'civil') key += s.id + ':' + s.faction + ':' + s.kind + ',';
    if (key !== terrKey) { territory = buildTerritory(state, map); terrKey = key; }
    g.imageSmoothingEnabled = false;
    g.drawImage(territory.canvas, view.x, view.y, W, H);
  }
  if ($('lyRoads').checked) {
    if (roadsKey !== state.edges.length) { roads = buildRoads(state, map); roadsKey = state.edges.length; }
    g.imageSmoothingEnabled = true;
    g.drawImage(roads, view.x, view.y, W, H);
  }

  const zoomed = view.scale / 6;
  const base = Math.max(3.2, Math.min(11, 4.2 * Math.sqrt(zoomed)));
  const labels = $('lyLabels').checked;
  g.textAlign = 'center';
  for (const s of state.sites) {
    const x = sx(s.x), y = sy(s.y);
    if (x < -40 || y < -40 || x > r.width + 40 || y > r.height + 40) continue;
    const big = s.mode === 'civil' && (s.kind === 'city' || s.kind === 'castle' || s.kind === 'town');
    const rad = base * (s.kind === 'city' ? 1.35 : big ? 1.15 : s.mode === 'civil' ? 0.95 : 0.9);
    if (s.mode === 'civil' && (s.famine || s.siege !== null)) {
      g.strokeStyle = s.siege !== null ? '#ffffff' : '#ffb020';
      g.lineWidth = 2;
      g.setLineDash([4, 3]);
      g.beginPath(); g.arc(x, y, rad * 2.1, 0, 6.3); g.stroke();
      g.setLineDash([]);
    }
    drawSite(g, siteStyle(state, s), x, y, rad);
    if (sel && sel.type === 'site' && sel.id === s.id) ring(x, y, rad * 2.4);
    if (labels && (big ? view.scale >= 4.5 : view.scale >= 9)) {
      g.font = `${big ? '600 ' : ''}${Math.round(Math.max(10, Math.min(15, 9 + zoomed * 1.5)))}px system-ui, sans-serif`;
      g.textBaseline = 'top';
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(10,12,16,0.85)';
      g.strokeText(s.name, x, y + rad * 1.5);
      g.fillStyle = s.mode === 'civil' ? '#fff' : '#e8c8c0';
      g.fillText(s.name, x, y + rad * 1.5);
    }
  }
  if ($('lyParties').checked) {
    const pr = Math.max(3, Math.min(9, 3.4 * Math.sqrt(zoomed)));
    for (const p of state.parties) {
      const [tx, ty] = partyTile(p, frac);
      const x = sx(tx), y = sy(ty) - (p.state === 'siege' ? base * 2.2 : 0);
      drawParty(g, state, p, x, y, pr);
      if (sel && sel.type === 'party' && sel.id === p.id) ring(x, y, pr * 2.2);
    }
  }
  if (sel && sel.type === 'tile') {
    g.strokeStyle = '#fff';
    g.lineWidth = 1.5;
    g.strokeRect((sel.id % map.w) * view.scale + view.x, Math.floor(sel.id / map.w) * view.scale + view.y, view.scale, view.scale);
  }
}

function ring(x, y, r) {
  g.strokeStyle = '#fff';
  g.lineWidth = 2;
  g.beginPath(); g.arc(x, y, r, 0, 6.3); g.stroke();
}

// ---- panels -----------------------------------------------------------------

const go = (type, id, text) => `<a class="go" data-go="${type}:${id}">${text}</a>`;
const chip = (color) => `<span class="chip" style="background:${color}"></span>`;
const siteLink = (id) => (state.sites[id] ? go('site', id, state.sites[id].name) : '—');
const factionLink = (id) => (state.factions[id] ? chip(state.factions[id].color) + go('faction', id, state.factions[id].name) : 'Unaligned');

function stat(k, pct, text, color) {
  return `<div class="stat"><span class="k">${k}</span><span class="bar"><i style="width:${Math.max(0, Math.min(100, pct))}%;background:${color}"></i></span><span class="v">${text}</span></div>`;
}

function history(list) {
  if (!list.length) return '<div class="sub">Nothing of note yet.</div>';
  return `<ul class="hist">${list.slice().reverse().map((h) => `<li><span class="d">${dateOf(h.day).text}</span>${h.text}</li>`).join('')}</ul>`;
}

function npcRow(n) {
  const odd = n.deviant ? ' <span class="tag odd" title="Deviates from the stereotype of the species">exception</span>' : '';
  return `<div class="row"><span>${go('npc', n.id, n.name)} <span class="sub">· ${n.title || n.role}, ${SP[n.species].name.toLowerCase()}</span>${odd}</span></div>`;
}

function sitePanel(s) {
  const sp = SP[s.species];
  let h = `<h2>${s.name}</h2><div class="sub">${cap(s.label)} · ${chip(sp.color)}${s.outlaw ? 'Outlaws' : sp.plural} · ${BIOMES[map.biome[s.y * map.w + s.x]].name}</div>`;
  if (s.mode === 'civil') {
    const f = state.factions[s.faction];
    const m = s.pop + s.garrison;
    const fd = s.food / Math.max(1, m);
    h += `<div>${factionLink(f.id)}${f.capital === s.id ? ' <span class="tag good">capital</span>' : ''}</div><div style="margin:6px 0">`;
    if (s.famine) h += '<span class="tag bad">Famine</span>';
    if (s.siege !== null) h += '<span class="tag bad">Besieged</span>';
    if (Object.keys(f.wars).length) h += '<span class="tag bad">Realm at war</span>';
    if (s.unrest > 70) h += '<span class="tag bad">On the edge of revolt</span>';
    if (s.safety < 50) h += '<span class="tag bad">Roads unsafe</span>';
    if (s.damage > 20) h += '<span class="tag bad">Damaged</span>';
    h += '</div>';
    h += stat('Population', s.pop / (KIND[s.kind].cap * 1.1) * 100, fmt(s.pop), '#8fb8e0');
    h += stat('Food reserve', fd / 100 * 100, `${fmt(fd)} days`, fd < 12 ? '#e0604a' : '#c9b458');
    h += stat('Wealth', Math.sqrt(s.wealth) / 4.5, `${fmt(s.wealth)} g`, '#e8c26a');
    h += stat('Unrest', s.unrest, fmt(s.unrest), s.unrest > 60 ? '#e0604a' : '#b08ad0');
    h += stat('Route safety', s.safety, fmt(s.safety), '#7fc77f');
    h += stat('Garrison', s.garrison / Math.max(1, s.pop * KIND[s.kind].mil * sp.mil * 1.5) * 100, fmt(s.garrison), '#c0c6d0');
    h += stat('Damage', s.damage, fmt(s.damage), '#e0604a');
    h += `<div class="sub" style="margin-top:4px">Defence strength ${fmt(defense(s))} · land fertility ${s.fertility.toFixed(2)}</div>`;
    const pops = Object.entries(s.pops).filter(([, n]) => n >= 1).sort((a, b) => b[1] - a[1]);
    if (pops.length > 1) {
      h += '<h3>Inhabitants</h3>';
      for (const [k, n] of pops) h += `<div class="row"><span>${chip(SP[k].color)}${SP[k].plural}</span><span class="n">${fmt(n)}</span></div>`;
    }
  } else if (s.mode === 'raider') {
    h += stat('Members', Math.min(100, s.pop / ((s.outlaw ? 160 : sp.cap) || 100) * 100), fmt(s.pop), '#e0604a');
    h += stat('Larder', Math.min(100, s.food / Math.max(1, s.pop * 25) * 100), `${fmt(s.food)}`, '#c9b458');
    h += `<div class="row"><span>Loot</span><span class="n">${fmt(s.wealth)} g</span></div>`;
    if (s.captives >= 1) h += `<div class="row"><span>Captives held</span><span class="n">${fmt(s.captives)}</span></div>`;
    h += `<div class="sub">${s.away ? 'A war band is out raiding.' : s.food > s.pop * 25 ? 'Well fed and quiet for now.' : 'Hungry; a raid is being planned.'}</div>`;
  } else if (s.mode === 'dragon') {
    const d = state.npcs[s.boss];
    if (d) h += `<div class="row"><span>${go('npc', d.id, d.name)}</span><span class="n">power ${fmt(d.power)} · hoard ${fmt(d.hoard)} g</span></div><div class="sub">${s.away ? 'The dragon is abroad.' : 'The dragon sleeps on its hoard.'}</div>`;
  } else if (s.mode === 'wild') {
    h += stat('Threat', s.threat, fmt(s.threat), '#9a5ad0');
    if (s.hoard) h += `<div class="row"><span>Rumoured treasure</span><span class="n">${fmt(s.hoard)} g</span></div>`;
  } else {
    h += '<div class="sub">Empty for now. Something may move in.</div>';
  }
  const people = s.notables.map((id) => state.npcs[id]).filter((n) => n && n.alive);
  if (people.length) h += `<h3>Notable inhabitants</h3>${people.map(npcRow).join('')}`;
  const trips = state.parties.filter((p) => p.from === s.id || p.to === s.id);
  if (trips.length) {
    h += '<h3>On the road</h3>';
    for (const p of trips) h += `<div class="row"><span>${go('party', p.id, PARTY[p.type].label)}</span><span class="n">${state.sites[p.from].name} → ${state.sites[p.to].name}</span></div>`;
  }
  return h + `<h3>History</h3>${history(s.history)}`;
}

function npcPanel(n) {
  const sp = SP[n.species];
  const pool = new Set(sp.anti);
  let h = `<div class="who"><div class="portrait" style="background:${sp.color}">${sp.name[0]}</div><div>`;
  h += `<h2>${n.name}</h2><div class="sub">${n.title || cap(n.role)} · ${chip(sp.color)}${sp.name}, ${n.sex === 'f' ? 'female' : 'male'}, ${n.age} years</div>`;
  h += n.alive ? (n.site !== null && state.sites[n.site] ? `<div>Lives in ${siteLink(n.site)}</div>` : '<div class="sub">On the road.</div>')
    : `<div><span class="tag bad">Dead</span> ${dateOf(n.died || 0).text}</div>`;
  h += '</div></div>';
  h += `<h3>Archetype</h3><span class="tag">${n.archetype}</span>`;
  h += `<h3>Personality</h3>${n.traits.map((t) => `<span class="tag ${pool.has(t) ? 'odd' : ''}">${t}</span>`).join('')}`;
  if (n.deviant) h += `<div class="sub">${n.deviant > 1 ? 'A striking exception' : 'Something of an exception'} among ${sp.plural.toLowerCase()} (highlighted traits break the stereotype).</div>`;
  h += `<h3>Goal</h3><div>${cap(n.goal)}.</div>`;
  if (n.power) h += `<h3>Dragon</h3><div class="row"><span>Power ${fmt(n.power)}</span><span class="n">hoard ${fmt(n.hoard)} g</span></div>`;
  return h + `<h3>Life</h3>${history(n.history)}`;
}

function partyPanel(p) {
  const def = PARTY[p.type];
  const sp = SP[p.species];
  let h = `<h2>${def.label}</h2><div class="sub">${chip(sp.color)}${p.outlaw ? 'Outlaws' : sp.plural}${p.faction != null && state.factions[p.faction] ? ' · ' + factionLink(p.faction) : ''}</div>`;
  const status = { go: 'Travelling', return: 'Returning home', prowl: `Lying in ambush (${p.timer} days left)`, siege: `Besieging (${p.timer} days)` }[p.state];
  h += `<div class="row"><span>From</span><span>${siteLink(p.from)}</span></div><div class="row"><span>To</span><span>${siteLink(p.to)}</span></div>`;
  h += `<div class="row"><span>Status</span><span class="n">${status}</span></div>`;
  h += `<div class="row"><span>${p.type === 'caravan' ? 'Guards' : 'Strength'}</span><span class="n">${fmt(p.size)}${p.type === 'adventurers' ? ' adventurers' : ''}</span></div>`;
  if (p.cargo.food > 0) h += `<div class="row"><span>Food carried</span><span class="n">${fmt(p.cargo.food)}</span></div>`;
  if (p.cargo.wealth > 0) h += `<div class="row"><span>Gold carried</span><span class="n">${fmt(p.cargo.wealth)} g</span></div>`;
  if (p.cargo.captives >= 1) h += `<div class="row"><span>Captives</span><span class="n">${fmt(p.cargo.captives)}</span></div>`;
  const leader = state.npcs[p.leader];
  if (leader) h += `<h3>Led by</h3>${npcRow(leader)}`;
  return h;
}

function factionPanel(f) {
  const sites = state.sites.filter((s) => s.mode === 'civil' && s.faction === f.id).sort((a, b) => b.pop - a.pop);
  const sp = SP[f.species];
  let h = `<h2>${chip(f.color)}${f.name}</h2><div class="sub">${f.gov} of the ${sp.plural.toLowerCase()}${f.alive ? '' : ' · <span class="tag bad">fallen</span>'}</div>`;
  const ruler = state.npcs[f.ruler];
  if (ruler && ruler.alive) h += `<div>Ruled by ${ruler.title} ${go('npc', ruler.id, ruler.name)} from ${siteLink(f.capital)}</div>`;
  h += `<div class="row" style="margin-top:6px"><span>Population</span><span class="n">${fmt(sites.reduce((a, s) => a + s.pop, 0))}</span></div>`;
  h += `<div class="row"><span>Soldiers</span><span class="n">${fmt(sites.reduce((a, s) => a + s.garrison, 0))}</span></div>`;
  const wars = Object.keys(f.wars);
  if (wars.length) h += `<h3>At war with</h3>${wars.map((id) => `<div class="row"><span>${factionLink(id)}</span><span class="n">since ${dateOf(f.wars[id].since).text}</span></div>`).join('')}`;
  h += `<h3>Settlements (${sites.length})</h3>${sites.map((s) => `<div class="row"><span>${siteLink(s.id)} <span class="sub">· ${s.label}</span></span><span class="n">${fmt(s.pop)}</span></div>`).join('')}`;
  const rel = Object.entries(f.rel).filter(([id]) => state.factions[id].alive).sort((a, b) => a[1] - b[1]);
  const show = rel.slice(0, 4).concat(rel.length > 8 ? rel.slice(-4) : rel.slice(4));
  h += `<h3>Relations</h3>${show.map(([id, v]) => `<div class="row"><span>${factionLink(id)}</span><span class="n" style="color:${v < -35 ? '#e0604a' : v > 25 ? '#7fc77f' : ''}">${v > 0 ? '+' : ''}${fmt(v)}</span></div>`).join('')}`;
  return h;
}

function tilePanel(i) {
  const x = i % map.w, y = Math.floor(i / map.w);
  const o = territory ? territory.owner[i] : -1;
  return `<h2>${BIOMES[map.biome[i]].name}</h2><div class="sub">Tile ${x}, ${y}${map.river[i] ? ' · river' : ''}</div><div>${o >= 0 ? 'Held by ' + factionLink(o) : 'Unclaimed wilderness'}</div>`;
}

function worldPanel() {
  const civil = state.sites.filter((s) => s.mode === 'civil');
  const totals = {};
  const places = {};
  for (const s of state.sites) {
    if (s.mode === 'empty') continue;
    places[s.species] = (places[s.species] || 0) + 1;
    for (const k in s.pops) totals[k] = (totals[k] || 0) + s.pops[k];
  }
  const max = Math.max(...Object.values(totals));
  let h = `<h2>The world of “${state.seedText}”</h2><div class="sub">${dateOf(state.day).text} · ${map.w}×${map.h} tiles</div>`;
  h += `<div class="row"><span>Settled population</span><span class="n">${fmt(civil.reduce((a, s) => a + s.pop, 0))}</span></div>`;
  h += `<div class="row"><span>Settlements</span><span class="n">${civil.length}</span></div>`;
  h += `<div class="row"><span>Lairs and wild places</span><span class="n">${state.sites.filter((s) => s.mode !== 'civil' && s.mode !== 'empty').length}</span></div>`;
  h += `<div class="row"><span>In famine / besieged</span><span class="n">${civil.filter((s) => s.famine).length} / ${civil.filter((s) => s.siege !== null).length}</span></div>`;
  h += `<div class="row"><span>Notable people alive</span><span class="n">${state.npcs.filter((n) => n.alive).length}</span></div>`;
  const wars = [];
  for (const f of state.factions) for (const id in f.wars) if (Number(id) > f.id) wars.push(`<div class="row"><span>${factionLink(f.id)} <span class="sub">vs</span> ${factionLink(id)}</span></div>`);
  h += `<h3>Wars (${wars.length})</h3>${wars.join('') || '<div class="sub">The realms are at peace.</div>'}`;
  h += '<h3>Realms</h3>';
  const realms = state.factions.filter((f) => f.alive).map((f) => {
    const own = civil.filter((s) => s.faction === f.id);
    return [f, own.length, own.reduce((a, s) => a + s.pop, 0)];
  }).sort((a, b) => b[2] - a[2]);
  for (const [f, n, pop] of realms) h += `<div class="row"><span>${factionLink(f.id)}</span><span class="n">${n} · ${fmt(pop)}</span></div>`;
  h += '<h3>Peoples</h3>';
  for (const sp of SPECIES.slice().sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0))) {
    const n = totals[sp.id] || 0;
    h += `<div class="pop-row"><span>${chip(sp.color)}${sp.plural}</span><span class="bar"><i style="width:${Math.sqrt(n / max) * 100}%;background:${sp.color}"></i></span><span class="n" style="text-align:right">${n >= 1 ? fmt(n) : (places[sp.id] || 0) + ' sites'}</span></div>`;
  }
  return h;
}

function speciesPanel() {
  const modes = { civil: 'builds realms', raider: 'raids from lairs', dragon: 'solitary hoarder', wild: 'wild threat' };
  let h = '<h2>Species of the world</h2><div class="sub">Tendencies of the majority, never rules: any individual may be the exception.</div>';
  let group = '';
  for (const sp of SPECIES) {
    if (sp.group !== group) { group = sp.group; h += `<h3>${group}</h3>`; }
    h += `<div class="card"><div class="head"><strong>${chip(sp.color)}${sp.plural}</strong><span class="tag">${modes[sp.mode]}</span></div><p><em>${sp.habitat}.</em> ${sp.tendency}</p><p>${sp.traits.map((t) => `<span class="tag">${t}</span>`).join('')}</p></div>`;
  }
  return h;
}

function renderPanel() {
  let html;
  if (tab === 'world') html = worldPanel();
  else if (tab === 'species') html = speciesPanel();
  else if (!sel) html = '<div class="empty">Click a settlement, a lair, a traveller on the road or any tile to inspect it.<br><br>Press ▶ to let the world run.</div>';
  else if (sel.type === 'site') html = sitePanel(state.sites[sel.id]);
  else if (sel.type === 'npc') html = npcPanel(state.npcs[sel.id]);
  else if (sel.type === 'faction') html = factionPanel(state.factions[sel.id]);
  else if (sel.type === 'tile') html = tilePanel(sel.id);
  else {
    const p = state.parties.find((q) => q.id === sel.id);
    html = p ? partyPanel(p) : '<div class="empty">That journey has ended.</div>';
  }
  const panel = $('panel');
  const top = panel.scrollTop;
  panel.innerHTML = html;
  panel.scrollTop = top;
  if (tab === 'inspect' && sel && sel.type === 'npc') addPortrait(panel.querySelector('.portrait'), state.npcs[sel.id].species);
}

// Optional art: drop assets/portraits/<species id>.png and it replaces the letter.
const portraits = new Map(); // species -> Image | false | 'loading'
function addPortrait(box, species) {
  const known = portraits.get(species);
  if (known && known !== 'loading') { box.appendChild(known.cloneNode()); return; }
  if (known !== undefined) return;
  portraits.set(species, 'loading');
  const img = new Image();
  img.alt = '';
  img.onload = () => { portraits.set(species, img); panelDirty = true; };
  img.onerror = () => portraits.set(species, false);
  img.src = `assets/portraits/${species}.png`;
}

function renderEvents() {
  shownEvents = state.eventCount;
  const minor = $('minor').checked;
  const out = [];
  for (let i = state.events.length - 1; i >= 0 && out.length < 150; i--) {
    const e = state.events[i];
    if (!filters[e.type] || (!minor && e.imp < 1)) continue;
    out.push(`<li class="t-${e.type} i${e.imp}" data-ev="${i}"><span class="d">${dateOf(e.day).text}</span>${e.text}</li>`);
  }
  $('events').innerHTML = out.join('');
}

function select(type, id, center) {
  sel = { type, id };
  if (tab !== 'inspect') setTab('inspect');
  if (center && type === 'site') centerOn(state.sites[id].x, state.sites[id].y);
  panelDirty = true;
}

function centerOn(tx, ty) {
  touched = true;
  const r = canvas.getBoundingClientRect();
  if (view.scale < 7) view.scale = 7;
  view.x = r.width / 2 - (tx + 0.5) * view.scale;
  view.y = r.height / 2 - (ty + 0.5) * view.scale;
}

function setTab(t) {
  tab = t;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === t);
  $('panel').scrollTop = 0;
  panelDirty = true;
}

// ---- input ------------------------------------------------------------------

let drag = null;
let touched = false; // once the user moves the camera, stop auto-fitting
canvas.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
  if (drag.moved) { touched = true; view.x = drag.vx + dx; view.y = drag.vy + dy; canvas.classList.add('dragging'); }
});
canvas.addEventListener('pointerup', (e) => {
  canvas.classList.remove('dragging');
  const wasDrag = drag && drag.moved;
  drag = null;
  if (wasDrag) return;
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  let best = null, bd = 14;
  if ($('lyParties').checked) for (const p of state.parties) {
    const [tx, ty] = partyTile(p, 1);
    const d = Math.hypot(sx(tx) - mx, sy(ty) - my);
    if (d < bd) { bd = d; best = ['party', p.id]; }
  }
  if (!best) {
    bd = 16;
    for (const s of state.sites) {
      const d = Math.hypot(sx(s.x) - mx, sy(s.y) - my);
      if (d < bd) { bd = d; best = ['site', s.id]; }
    }
  }
  if (!best) {
    const tx = Math.floor((mx - view.x) / view.scale), ty = Math.floor((my - view.y) / view.scale);
    if (tx >= 0 && ty >= 0 && tx < map.w && ty < map.h) best = ['tile', ty * map.w + tx];
  }
  if (best) select(best[0], best[1]);
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  touched = true;
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  const next = Math.max(2, Math.min(48, view.scale * (e.deltaY < 0 ? 1.18 : 1 / 1.18)));
  view.x = mx - (mx - view.x) * (next / view.scale);
  view.y = my - (my - view.y) * (next / view.scale);
  view.scale = next;
}, { passive: false });

let sidePressed = false; // do not rebuild the panel under a click in progress
$('side').addEventListener('pointerdown', () => { sidePressed = true; });
window.addEventListener('pointerup', () => { setTimeout(() => { sidePressed = false; }, 0); });
$('side').addEventListener('click', (e) => {
  const link = e.target.closest('[data-go]');
  if (link) {
    const [type, id] = link.dataset.go.split(':');
    select(type, Number(id), true);
    return;
  }
  const ev = e.target.closest('[data-ev]');
  if (ev) {
    const item = state.events[Number(ev.dataset.ev)];
    if (item && item.site !== undefined) select('site', item.site, true);
  }
});
$('tabs').addEventListener('click', (e) => { if (e.target.dataset.tab) setTab(e.target.dataset.tab); });
$('speeds').addEventListener('click', (e) => { if (e.target.dataset.speed !== undefined) setSpeed(Number(e.target.dataset.speed)); });
$('stepDay').addEventListener('click', () => { setSpeed(0); advance(); panelDirty = true; });
$('minor').addEventListener('change', renderEvents);
$('newWorld').addEventListener('click', () => {
  const seed = $('seed').value.trim() || String(Math.floor(Math.random() * 1e9));
  setSpeed(0);
  adopt(createWorld(seed));
  toast(`New world from seed "${seed}"`);
});
$('save').addEventListener('click', () => {
  try { localStorage.setItem(SAVE_KEY, serialize(state)); toast('World saved in this browser'); }
  catch (err) { toast('Could not save here; use Export instead'); }
});
$('load').addEventListener('click', () => {
  let text = null;
  try { text = localStorage.getItem(SAVE_KEY); } catch (err) { /* storage unavailable */ }
  if (!text) return toast('No saved world found');
  setSpeed(0);
  adopt(deserialize(text));
  toast('World loaded');
});
$('export').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([serialize(state)], { type: 'application/json' }));
  a.download = `world-${state.seedText}-year${dateOf(state.day).year}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('import').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try { setSpeed(0); adopt(deserialize(await file.text())); toast('World imported'); }
  catch (err) { toast(err.message); }
});
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const speeds = [2, 10, 45, 180];
  if (e.code === 'Space') { e.preventDefault(); setSpeed(speed ? 0 : (setSpeed.last || 10)); }
  else if (e.key >= '1' && e.key <= '4') setSpeed(speeds[Number(e.key) - 1]);
  else if (e.key === '.') { setSpeed(0); advance(); panelDirty = true; }
  if (speed) setSpeed.last = speed;
});

const filterBox = $('filters');
for (const type of Object.keys(filters)) {
  const b = document.createElement('button');
  b.textContent = type;
  b.className = `on t-${type}`;
  b.addEventListener('click', () => { filters[type] = !filters[type]; b.classList.toggle('on', filters[type]); renderEvents(); });
  filterBox.appendChild(b);
}

// ---- main loop --------------------------------------------------------------

function frame(now) {
  if (!fitted) { fit(); fitted = true; } // layout is only final on the first frame
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (speed > 0) {
    acc += dt * speed;
    let n = Math.min(Math.floor(acc), 12);
    acc -= Math.floor(acc);
    while (n-- > 0) advance();
  } else acc = 1;
  draw(speed > 0 && speed <= 10 ? acc : 1);
  if (state.eventCount !== shownEvents) renderEvents();
  if (panelDirty || (speed > 0 && now - lastPanel > 400 && !sidePressed)) {
    renderPanel();
    panelDirty = false;
    lastPanel = now;
  }
  $('date').textContent = dateOf(state.day).text;
  requestAnimationFrame(frame);
}

const params = new URLSearchParams(location.search);
adopt(createWorld(params.get('seed') || 'dreams'));
setSpeed(0);
// Optional URL shortcuts: ?seed=x&days=720 fast-forwards, &inspect=site:0 opens a panel.
for (let i = Math.min(Number(params.get('days')) || 0, 360000); i > 0; i--) step(state);
if (params.get('inspect')) {
  const [type, id] = params.get('inspect').split(':');
  if (type === 'world' || type === 'species') setTab(type);
  else if (type === 'npc' ? state.npcs[id] : type === 'faction' ? state.factions[id] : state.sites[id]) select(type, Number(id), type === 'site');
}
window.addEventListener('resize', () => { if (!touched) fit(); panelDirty = true; });
// Console access for debugging and for the browser-driven checks.
window.wid = { get state() { return state; }, get view() { return view; }, get sel() { return sel; }, get speed() { return speed; }, step: advance, select };
requestAnimationFrame(frame);
