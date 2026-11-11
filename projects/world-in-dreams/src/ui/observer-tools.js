// Presentation-only state and queries. No world mutations belong here.
export const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const copy = (v) => JSON.parse(JSON.stringify(v));

export function fitRegion(L, width, height) {
  return { x: (L.X0 + L.X1) / 2, y: (L.Y0 + L.Y1) / 2, s: Math.min(width / L.W, height / L.H) * 0.98 };
}
export function constrainCamera(view, L, width, height, dpr = 1) {
  const min = fitRegion(L, width, height).s;
  view.s = Math.max(min, Math.min(16 * dpr, Number.isFinite(view.s) ? view.s : min));
  for (const [axis, lo, hi, span] of [['x', L.X0, L.X1, width], ['y', L.Y0, L.Y1, height]]) {
    const half = span / (2 * view.s), middle = (lo + hi) / 2;
    view[axis] = half >= (hi - lo) / 2 ? middle : Math.max(lo + half, Math.min(hi - half, Number.isFinite(view[axis]) ? view[axis] : middle));
  }
  return view;
}
export function personScale(scale, dpr, indoors, comfort = 1.6) {
  const base = scale * (indoors ? 0.62 : 1);
  return comfort <= 1 ? base : Math.max(base, 1.5 * comfort * dpr / 0.95);
}
export function createHistory(limit = 80) {
  let entries = [], at = -1;
  return {
    reset(state) { entries = [copy(state)]; at = 0; },
    visit(from, to) {
      if (JSON.stringify(from) === JSON.stringify(to)) return;
      if (at < 0) { entries = [copy(from)]; at = 0; }
      entries[at] = copy(from);
      entries.splice(at + 1); entries.push(copy(to)); at++;
      if (entries.length > limit) { entries.shift(); at--; }
    },
    move(delta, current) {
      if (at + delta < 0 || at + delta >= entries.length) return null;
      entries[at] = copy(current); at += delta; return copy(entries[at]);
    },
    get back() { return at > 0; }, get forward() { return at + 1 < entries.length; },
  };
}

export function chronicleQuery(events, { query = '', min = 0, from = '', to = '', people = null, types = null, limit = 150 } = {}, day = 1440) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const ids = people === null ? null : new Set(people);
  const matches = events.filter((e) => e.imp >= min && (!types || types[e.type])
    && (from === '' || Math.floor(e.t / day) + 1 >= Number(from))
    && (to === '' || Math.floor(e.t / day) + 1 <= Number(to))
    && (!ids || ids.has(e.who)) && words.every((w) => e.text.toLowerCase().includes(w)));
  return { total: matches.length, list: matches.slice(-limit).reverse(), oldest: events[0]?.t ?? null };
}

export function targetMinute(t, kind, day, seasonMinutes, customDay, clock = '07:00') {
  if (kind === 'morning') { const next = Math.floor(t / day) * day + 7 * 60; return next > t ? next : next + day; }
  if (kind === 'season') return (Math.floor(t / seasonMinutes) + 1) * seasonMinutes;
  const [h, m] = clock.split(':').map(Number), target = (Number(customDay) - 1) * day + h * 60 + m;
  if (!Number.isInteger(Number(customDay)) || Number(customDay) < 1 || !Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(m) || m < 0 || m > 59
    || !Number.isSafeInteger(target) || target <= t || target - t > seasonMinutes * 4) throw new Error('Choose a future time within four seasons.');
  return target;
}

/** Small cancelable batches: each tick still uses the real minute step. */
export function createAdvance({ time, step, now = () => performance.now() }) {
  let target = null, start = 0;
  return {
    start(end) { if (!Number.isSafeInteger(end) || end <= time()) throw new Error('The target must be in the future.'); start = time(); target = end; },
    cancel() { target = null; },
    batch(budget = 8) {
      if (target === null) return false;
      const began = now(); let count = 0;
      while (time() < target && count++ < 120) { if (step() === false) { target = null; return false; } if (now() - began >= budget) break; }
      if (time() >= target) target = null;
      return target !== null;
    },
    get active() { return target !== null; }, get target() { return target; },
    get progress() { return target === null ? 1 : (time() - start) / (target - start); },
  };
}

/** Detect observed state changes, without guessing causes from prose. */
export function createAlerts() {
  let world = null, previous = new Map(), shorts = [], lastEvent = 0;
  return {
    reset(S) { world = S; previous.clear(); shorts = S.sites.map((s) => Boolean(s.short)); lastEvent = S.eventCount; },
    poll(S, ids, { lives = false, events = false, food = false } = {}) {
      if (world !== S) this.reset(S);
      const out = [];
      for (const id of ids) {
        const p = S.people[id]; if (!p) continue;
        const old = previous.get(id);
        if (lives && old) {
          if (old.alive && !p.alive) out.push({ person: id, text: p.gone ? 'Left the region' : 'Died', t: S.t });
          else if (p.alive && p.hurt > S.t && p.hurt > old.hurt) out.push({ person: id, text: 'Was injured', t: S.t });
        }
        previous.set(id, { alive: p.alive, hurt: p.hurt });
      }
      for (const id of previous.keys()) if (!ids.has(id)) previous.delete(id);
      if (events) for (const e of S.events) if (e.n > lastEvent && e.imp >= 1 && ids.has(e.who)) out.push({ person: e.who, text: e.text, t: e.t, event: e.n });
      if (food) S.sites.forEach((s, i) => { if (s.short && !shorts[i]) out.push({ site: i, text: 'Food shortage', t: S.t }); });
      shorts = S.sites.map((s) => Boolean(s.short)); lastEvent = S.eventCount;
      return out;
    },
  };
}
