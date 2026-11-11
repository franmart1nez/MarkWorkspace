// Viewer-only helpers. These never change the simulation state.
export const SAVE_KEY = 'world-in-dreams:save:v2'; // Keep existing browser saves accessible.
export const RECOVERY_KEY = 'world-in-dreams:recovery:v1';
export const SPEEDS = [0.25, 1, 6, 30, 180, 720];

const normal = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function findPeople(people, sites, nameOf, { query = '', site = '', status = '', life = 'living', page = 0, size = 40 } = {}) {
  const words = normal(query).trim().split(/\s+/).filter(Boolean);
  const matches = people.filter((p) => {
    if ((life === 'living' && !p.alive) || (life === 'dead' && (p.alive || p.gone)) || (life === 'gone' && !p.gone) || (site !== '' && p.site !== Number(site))) return false;
    if (status && !p.alive) return false;
    if (status === 'outdoors' && (p.away || p.in >= 0)) return false;
    if (status === 'indoors' && (p.away || p.in < 0)) return false;
    if (status === 'away' && !p.away) return false;
    const text = normal(`${nameOf(p)} ${p.job} ${p.sp} ${sites[p.site]?.name || ''}`);
    return words.every((word) => text.includes(word));
  }).sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'en') || a.id - b.id);
  const pages = Math.max(1, Math.ceil(matches.length / size));
  page = Math.max(0, Math.min(pages - 1, Math.floor(page) || 0));
  return { total: matches.length, pages, page, list: matches.slice(page * size, (page + 1) * size) };
}

export function shortcut(e) {
  const target = e.target;
  if (target?.isContentEditable || target?.closest?.('input, textarea, select, [contenteditable="true"], dialog[open]')) return null;
  if (e.altKey || e.isComposing) return null;
  const key = e.key.toLowerCase();
  if (e.ctrlKey || e.metaKey) return key === 's' && !e.shiftKey && !e.repeat ? 'save' : null;
  // Let Space/Enter activate a focused control normally.
  if (e.code === 'Space' && target?.closest?.('button, a, summary, [role="button"]')) return null;
  if (e.repeat && !['arrowleft', 'arrowright', 'arrowup', 'arrowdown', '+', '=', '-'].includes(key)) return null;
  if (key >= '1' && key <= '6') return `speed:${key}`;
  return ({ ' ': 'pause', '.': 'step', c: 'city', r: 'region', f: 'follow', escape: 'clear',
    '/': 'search', '?': 'help', h: 'help', tab: null, '+': 'zoomIn', '=': 'zoomIn', '-': 'zoomOut',
    arrowleft: 'left', arrowright: 'right', arrowup: 'up', arrowdown: 'down' })[key] || null;
}

export function createSaveStore(storage) {
  return {
    save(text) { storage().setItem(SAVE_KEY, text); },
    load() { return storage().getItem(SAVE_KEY); },
    recover() {
      const text = storage().getItem(RECOVERY_KEY);
      if (!text) return null;
      const record = JSON.parse(text);
      if (!record?.world || !Number.isFinite(record.savedAt)) throw new Error('The recovery copy is unreadable. Import a JSON save instead.');
      return record;
    },
    backup(world, now = Date.now(), view) {
      storage().setItem(RECOVERY_KEY, JSON.stringify({ savedAt: now, world, ...(view ? { view } : {}) }));
    },
  };
}

/** Check references needed by the viewer before replacing its current world. */
export function validateWorld(world, layout, species) {
  const fail = () => { throw new Error('This save is incomplete or damaged. The current world has been kept.'); };
  if (!Number.isSafeInteger(world.t) || world.t < 0 || !Number.isInteger(world.seed) || !Number.isInteger(world.rng) || typeof world.seedText !== 'string') fail();
  for (const k of ['people', 'households', 'animals', 'herds', 'quests', 'events', 'sites', 'fields']) if (!Array.isArray(world[k])) fail();
  if (world.sites.length !== layout.sites.length || world.fields.length !== layout.fields.length || !Number.isFinite(world.tune?.yield)) fail();
  for (const k of ['animals', 'herds', 'quests', 'events', 'sites', 'fields']) if (world[k].some((entry) => !entry || typeof entry !== 'object')) fail();
  for (const f of world.fields) if (!['st', 'w', 'g', 'h'].every((k) => Number.isFinite(f[k]))) fail();
  for (const site of world.sites) if (!['food', 'coins', 'wood', 'fear', 'sow', 'reap'].every((k) => Number.isFinite(site[k]))) fail();
  for (const [i, p] of world.people.entries()) {
    if (!p || p.id !== i || !species[p.sp] || !Number.isFinite(p.x) || !Number.isFinite(p.y) || typeof p.name !== 'string' || typeof p.fam !== 'string' || typeof p.job !== 'string') fail();
    if (!Array.isArray(p.friends) || !Array.isArray(p.traits) || !Array.isArray(p.hist) || p.hist.some((h) => !h || !Number.isFinite(h.t))) fail();
    if (p.in !== -1 && !layout.blds[p.in]) fail();
    if (p.home !== -1 && !layout.blds[p.home]) fail();
    if (p.hh !== -1 && !world.households[p.hh]) fail();
    for (const id of [p.spouse, p.mom, p.dad, ...p.friends]) if (id !== -1 && !world.people[id]) fail();
    if (p.route !== null && (!Array.isArray(p.route) || p.route.length % 2 || !p.route.every(Number.isFinite))) fail();
  }
  for (const hh of world.households) if (!hh || !Array.isArray(hh.m) || hh.m.some((id) => !world.people[id])) fail();
  return world;
}
