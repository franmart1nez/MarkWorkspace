import { escapeHtml as esc, createHistory, chronicleQuery, createAlerts, createAdvance, targetMinute } from './observer-tools.js';
import { createCheckpointStore } from './checkpoint-store.js';

export function installObserver(api) {
  const sheet = document.createElement('link'); sheet.rel = 'stylesheet'; sheet.href = new URL('./observer.css', import.meta.url).href; document.head.append(sheet);
  const $ = (id) => document.getElementById(id), history = createHistory(), alerts = createAlerts();
  const storageKey = 'world-in-dreams:observer:v1', db = createCheckpointStore();
  const defaults = { size: 1.6, roofs: 'auto', overview: true, text: 13, side: 390, split: 57,
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, pauseHidden: false, chronicle: true,
    lives: false, events: false, food: false, pauseAlerts: false };
  let settings = { ...defaults }, pins = [], recent = [], signature = '', rateAt = performance.now(), rateT = api.world().t, achieved = 0;
  let world = api.world(), runWorld = null, runEnd = 0, applying = false, overviewSeed = null, lastOverview = 0;
  const chronicle = { query: '', min: '1', from: '', to: '', scope: 'all', limit: 150 };
  const advance = createAdvance({ time: () => api.world().t, step: () => api.advanceOne() });
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (raw) for (const k of Object.keys(defaults)) if (typeof raw[k] === typeof defaults[k]) settings[k] = raw[k];
  } catch { /* Optional preferences must not block the viewer. */ }
  settings.size = Math.max(1, Math.min(2.2, settings.size)); settings.text = Math.max(12, Math.min(18, settings.text));
  settings.side = Math.max(320, Math.min(620, settings.side)); settings.split = Math.max(30, Math.min(75, settings.split));
  if (!['auto', 'selected', 'closed'].includes(settings.roofs)) settings.roofs = 'auto';
  function pinKey() { const S = api.world(); return `world-in-dreams:pins:${S.version}:${S.seed}`; }
  function savePreferences() { try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch { /* Optional. */ } }
  function savePins() { try { localStorage.setItem(pinKey(), JSON.stringify(pins)); } catch { api.toast('Pins could not be stored in this browser.'); } }
  function loadPins() {
    try { const value = JSON.parse(localStorage.getItem(pinKey()) || '[]'); pins = Array.isArray(value) ? value.filter((p) => p && Number.isInteger(p.id) && ['person', 'household', 'bld', 'site', 'field', 'animal'].includes(p.type)).slice(0, 20) : []; }
    catch { pins = []; }
  }
  function applySettings() {
    const root = document.documentElement;
    root.style.setProperty('--viewer-font', `${settings.text}px`); root.style.setProperty('--side-width', `${settings.side}px`);
    root.style.setProperty('--inspect-weight', String(settings.split)); root.style.setProperty('--chronicle-weight', String(100 - settings.split));
    document.body.classList.toggle('chronicle-hidden', !settings.chronicle);
    document.body.classList.toggle('reduced-motion', settings.reduced);
    $('overview').hidden = !settings.overview; $('roof-mode').value = settings.roofs;
    $('toggleChronicle').setAttribute('aria-expanded', String(settings.chronicle));
    api.dirty(); savePreferences();
  }
  $('side').insertAdjacentHTML('afterbegin', `<div id="observer-nav"><button id="inspectBack" title="Previous observation">← Back</button><button id="inspectForward" title="Next observation">Forward →</button><button id="pinSelection">Pin</button><button id="pinHousehold" hidden>Pin household</button></div>
    <details id="pins"><summary>Pinned subjects <span id="pin-count">0</span></summary><div id="pin-list"></div></details>`);
  $('map-tools').insertAdjacentHTML('beforeend', '<button data-tool="checkpoints">Saves</button><button data-tool="advance">Advance</button><button data-tool="preferences" aria-label="Viewer preferences">Settings</button><button id="alertInbox" data-tool="alerts" hidden>Alerts</button>');
  $('lyInside')?.closest('label').replaceWith(Object.assign(document.createElement('label'), { innerHTML: `Roofs <select id="roof-mode" aria-label="Roof visibility"><option value="auto">Automatic</option><option value="selected">Selected only</option><option value="closed">Roofs visible</option></select>` }));
  $('stage').insertAdjacentHTML('beforeend', `<div id="overview"><canvas id="overview-map" width="180" height="125" tabindex="0" role="button" aria-label="Region overview. Click to move the camera; Enter frames the region."></canvas></div>
    <div id="people-picker" hidden role="group" aria-label="Choose a nearby person"></div>
    <div id="play-rate"></div><div id="advance-state" hidden><span></span><progress max="1"></progress><button id="cancelAdvance">Cancel</button></div>`);
  $('chronicle').querySelector('.chron-head').insertAdjacentHTML('beforeend', '<button id="toggleChronicle" aria-controls="events chronicle-controls" aria-expanded="true" title="Show or hide chronicle">▾</button>');
  $('events').insertAdjacentHTML('beforebegin', `<div id="chronicle-controls"><details><summary>Search &amp; event filters</summary><input id="chron-query" type="search" placeholder="Search retained events" aria-label="Search retained events">
    <div class="search-filters"><select id="chron-scope" aria-label="Chronicle subject"><option value="all">All subjects</option><option value="selection">Selected person</option><option value="household">Selected household</option></select>
    <select id="chron-min" aria-label="Minimum event importance"><option value="0">All importance</option><option value="1" selected>Notable or above</option><option value="2">Major or above</option><option value="3">Memorable only</option></select></div>
    <div class="chron-dates"><label>Day from <input id="chron-from" type="number" min="1" placeholder="1"></label><label>to <input id="chron-to" type="number" min="1" placeholder="Any"></label></div><div id="chron-window" class="sub"></div></details><button id="moreEvents" hidden>Show 150 more</button></div>`);
  document.body.insertAdjacentHTML('beforeend', `<dialog id="observer-dialog" aria-labelledby="observer-title"><h2 id="observer-title"></h2><div id="observer-body"></div><div class="btns"><button id="closeObserver">Close</button></div></dialog>`);
  const dialog = $('observer-dialog'); let dialogWorld, dialogSpeed;
  function open(title, html) {
    if (document.querySelector('dialog[open]')) return false;
    cancelAdvance(); dialogWorld = api.world(); dialogSpeed = api.speed(); api.setSpeed(0);
    $('observer-title').textContent = title; $('observer-body').innerHTML = html; dialog.showModal(); return true;
  }
  $('closeObserver').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { if (api.world() === dialogWorld) api.setSpeed(dialogSpeed); });
  const toolsObserver = new ResizeObserver(() => {
    $('stage').style.setProperty('--tools-bottom', `${$('map-tools').offsetHeight + 18}px`);
  }); toolsObserver.observe($('map-tools'));

  function pinnedIds() {
    const ids = new Set(), S = api.world();
    const households = new Map(pins.filter((p) => p.type === 'household').map((p) => [p.id, p]));
    let changed = false;
    for (const pin of pins) {
      if (pin.type === 'person') ids.add(pin.id);
      else if (pin.type === 'household' && Array.isArray(pin.members)) for (const id of pin.members) if (Number.isInteger(id) && S.people[id]) ids.add(id);
    }
    if (households.size) for (const p of S.people) {
      const pin = households.get(p.hh); if (!pin) continue;
      ids.add(p.id);
      if (!Array.isArray(pin.members)) pin.members = [];
      if (!pin.members.includes(p.id)) { pin.members.push(p.id); changed = true; }
    }
    if (changed) savePins();
    return ids;
  }
  function paintPins() {
    const sig = JSON.stringify(pins.map((p) => [p.type, p.id, api.label(p)]));
    if (sig === signature) return;
    signature = sig; $('pin-count').textContent = pins.length;
    $('pin-list').innerHTML = pins.map((pin, i) => `<div class="pin-row"><button data-pin="${i}"${api.valid(pin) ? '' : ' disabled'}>${esc(api.label(pin) || pin.label || 'Unavailable subject')}</button><button data-unpin="${i}" aria-label="Remove pin">×</button></div>`).join('') || '<div class="sub">Pin a person, household or place to return to it.</div>';
  }
  function togglePin(pin) {
    if (!pin || !api.valid(pin)) return;
    const found = pins.findIndex((p) => p.type === pin.type && p.id === pin.id);
    if (found >= 0) pins.splice(found, 1);
    else if (pins.length < 20) pins.push({ ...pin, label: api.label(pin) });
    else return api.toast('The pinned list holds 20 subjects. Remove a pin first.');
    savePins(); paintPins(); alerts.reset(api.world()); alerts.poll(api.world(), pinnedIds(), settings);
  }
  $('pin-list').addEventListener('click', (e) => {
    const go = e.target.closest('[data-pin]'), remove = e.target.closest('[data-unpin]');
    if (go) api.select(pins[Number(go.dataset.pin)], true);
    if (remove) { pins.splice(Number(remove.dataset.unpin), 1); savePins(); paintPins(); }
  });
  $('pinSelection').addEventListener('click', () => togglePin(api.selection()));
  $('pinHousehold').addEventListener('click', () => { const hh = api.household(); if (hh >= 0) togglePin({ type: 'household', id: hh }); });
  for (const [id, delta] of [['inspectBack', -1], ['inspectForward', 1]]) $(id).addEventListener('click', () => {
    const state = history.move(delta, api.capture());
    if (state) { applying = true; api.restore(state, false); applying = false; api.events(); updateNavigation(); }
  });
  function updateNavigation() {
    $('inspectBack').disabled = !history.back; $('inspectForward').disabled = !history.forward;
    $('pinSelection').disabled = !api.selection(); $('pinHousehold').hidden = api.household() < 0;
  }
  $('roof-mode').addEventListener('change', () => { settings.roofs = $('roof-mode').value; applySettings(); });
  $('toggleChronicle').addEventListener('click', () => { settings.chronicle = !settings.chronicle; applySettings(); });
  for (const [id, key] of [['chron-query', 'query'], ['chron-scope', 'scope'], ['chron-min', 'min'], ['chron-from', 'from'], ['chron-to', 'to']]) {
    $(id).addEventListener(id === 'chron-query' ? 'input' : 'change', () => { chronicle[key] = $(id).value; chronicle.limit = 150; api.events(); });
  }
  $('moreEvents').addEventListener('click', () => { chronicle.limit += 150; api.events(); });
  $('minor').addEventListener('change', () => { chronicle.min = $('minor').checked ? '0' : '1'; $('chron-min').value = chronicle.min; api.events(); });

  function preferences() {
    if (!open('Viewer settings', `<div class="settings-grid">
      <label>People size<select data-setting="size"><option value="1">Standard</option><option value="1.6">Comfortable</option><option value="2.2">Large</option></select></label>
      <label>Text size <output id="text-value"></output><input data-setting="text" type="range" min="12" max="18"></label>
      <label>Sidebar width <input data-setting="side" type="range" min="320" max="620" step="10"></label>
      <label>Inspector space <input data-setting="split" type="range" min="30" max="75"></label>
      ${[['overview', 'Show region overview (desktop)'], ['reduced', 'Reduce camera motion and selection pulses'], ['pauseHidden', 'Pause when this page is hidden'], ['lives', 'Alert for pinned deaths, departures and injuries'], ['events', 'Alert for notable events about pinned people'], ['food', 'Alert for settlement food shortages'], ['pauseAlerts', 'Pause when an enabled alert occurs']].map(([k, text]) => `<label class="check"><input data-setting="${k}" type="checkbox">${text}</label>`).join('')}
      </div><p class="sub">Alerts use recorded events and observed state. Historical events are not replayed when enabling alerts.</p><div id="recent-alerts"></div>`)) return;
    for (const el of dialog.querySelectorAll('[data-setting]')) {
      const key = el.dataset.setting;
      if (el.type === 'checkbox') el.checked = settings[key]; else el.value = settings[key];
      el.addEventListener('input', () => {
        settings[key] = el.type === 'checkbox' ? el.checked : Number(el.value);
        $('text-value').textContent = `${settings.text}px`; applySettings();
        alerts.reset(api.world()); alerts.poll(api.world(), pinnedIds(), settings);
      });
    }
    $('text-value').textContent = `${settings.text}px`;
    $('recent-alerts').innerHTML = alertMarkup();
  }

  function alertMarkup() {
    return '<h3>Recent alerts this session</h3>' + (recent.map((a, i) => `<p><button data-alert-go="${i}">${esc(a.description)}</button></p>`).join('') || '<p class="sub">No alerts.</p>');
  }
  function alertInbox() { open('Observed alerts', alertMarkup()); }
  $('observer-body').addEventListener('click', (e) => {
    const button = e.target.closest('[data-alert-go]'), record = button && recent[Number(button.dataset.alertGo)];
    if (record && api.valid(record.subject)) { dialog.close(); api.select(record.subject, true); }
  });

  async function checkpoints() {
    if (!open('Named checkpoints', '<p id="slot-status" role="status">Reading checkpoint storage…</p><div id="slot-list"></div>')) return;
    async function refresh() {
      try {
        const list = await db.slots();
        if (!dialog.open || !$('slot-list')) return;
        $('slot-status').textContent = 'Three named slots and the previous automatic recovery. Loading leaves playback paused.';
        $('slot-list').innerHTML = list.map(({ key, record }, i) => `<div class="checkpoint"><strong>${i < 3 ? `Slot ${i + 1}` : 'Previous recovery'}</strong>
          <p>${record ? `${esc(record.name || 'Untitled')} · seed “${esc(record.world.seedText)}” · ${esc(api.date(record.world.t))} · save v${record.world.version}<br>${esc(new Date(record.savedAt).toLocaleString())}` : 'Empty'}</p>
          ${i < 3 ? `<label>Name <input data-slot-name="${key}" maxlength="60" value="${esc(record?.name || '')}"></label><button data-slot-save="${key}">Save here</button>` : ''}
          <button data-slot-load="${key}"${record ? '' : ' disabled'}>Load</button></div>`).join('');
      } catch { if ($('slot-status')) $('slot-status').textContent = 'Named checkpoints are unavailable. Manual Save and JSON Export remain available.'; }
    }
    await refresh();
    $('slot-list')?.addEventListener('click', async (e) => {
      const save = e.target.closest('[data-slot-save]'), load = e.target.closest('[data-slot-load]');
      if (!save && !load) return;
      const button = save || load; button.disabled = true;
      try {
        if (save) {
          const key = save.dataset.slotSave, name = dialog.querySelector(`[data-slot-name="${key}"]`).value.trim();
          await db.put(key, { name, world: JSON.parse(api.serialize(api.world())), view: api.capture(), savedAt: Date.now() });
          api.toast('Named checkpoint saved'); await refresh();
        } else {
          const record = await db.get(load.dataset.slotLoad);
          if (!record) throw new Error('That checkpoint is empty.');
          // Close first so the common replacement dialog can own focus.
          dialogSpeed = 0; dialog.close();
          await api.loadRecord(record, 'Checkpoint loaded');
        }
      } catch (err) { api.toast(err.message || 'Checkpoint storage failed. Use Export.'); }
      finally { if (button.isConnected) button.disabled = false; }
    });
  }

  function cancelAdvance(message = '') {
    if (!advance.active) return;
    advance.cancel(); api.setSpeed(0); $('advance-state').hidden = true;
    if (message) api.toast(message);
  }
  function startAdvance(target) {
    dialogSpeed = 0; dialog.close(); api.setSpeed(0); runWorld = api.world(); runEnd = target;
    advance.start(target); $('advance-state').hidden = false;
    const pump = () => {
      if (!advance.active) return;
      if (api.world() !== runWorld || api.speed() > 0) return cancelAdvance('Advance canceled');
      const more = advance.batch();
      $('advance-state').querySelector('span').textContent = `Advancing to ${api.date(runEnd)}`;
      $('advance-state').querySelector('progress').value = advance.progress;
      if (more) requestAnimationFrame(pump);
      else { $('advance-state').hidden = true; api.setSpeed(0); api.dirty(); api.toast(api.world().t >= runEnd ? 'Reached target · paused' : 'Advance stopped · paused'); }
    };
    requestAnimationFrame(pump);
  }
  function advanceDialog() {
    const day = Math.floor(api.world().t / api.day) + 1;
    if (!open('Advance time', `<p>Advance using the real simulation, then stop paused. You can cancel while it runs.</p><div class="btns"><button id="advanceMorning">Next morning · 07:00</button><button id="advanceSeason">Next season</button></div>
      <div class="advance-custom"><label>Absolute game day <input id="advanceDay" type="number" min="${day}" value="${day}"></label><label>Time <input id="advanceClock" type="time" value="12:00"></label><button id="advanceCustom">Advance to time</button></div><p id="advance-error" role="status"></p>`)) return;
    for (const [id, kind] of [['advanceMorning', 'morning'], ['advanceSeason', 'season'], ['advanceCustom', 'custom']]) $(id).addEventListener('click', () => {
      try { startAdvance(targetMinute(api.world().t, kind, api.day, api.seasonMinutes, $('advanceDay').value, $('advanceClock').value)); }
      catch (err) { $('advance-error').textContent = err.message; }
    });
  }
  $('cancelAdvance').addEventListener('click', () => cancelAdvance('Advance canceled · paused'));
  $('speeds').addEventListener('click', () => cancelAdvance(), { capture: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden && settings.pauseHidden) { cancelAdvance(); api.setSpeed(0); } });

  function overview(now) {
    if (!settings.overview || now - lastOverview < 400 || $('overview').getBoundingClientRect().width === 0) return;
    lastOverview = now;
    const L = api.layout(), cv = $('overview-map'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    if (overviewSeed !== L.seed || !overview.background) {
      const bg = document.createElement('canvas'); bg.width = W; bg.height = H; const c = bg.getContext('2d');
      c.fillStyle = '#53683c'; c.fillRect(0, 0, W, H);
      const x = (v) => (v - L.X0) / L.W * W, y = (v) => (v - L.Y0) / L.H * H;
      c.strokeStyle = '#5eb0dd'; c.lineWidth = 3; c.beginPath(); L.river.forEach(([px, py], i) => i ? c.lineTo(x(px), y(py)) : c.moveTo(x(px), y(py))); c.stroke();
      c.strokeStyle = '#e0ce9b'; c.lineWidth = 0.6; c.beginPath();
      for (const e of L.edges) { const a = L.nodes[e.a], b = L.nodes[e.b]; c.moveTo(x(a.x), y(a.y)); c.lineTo(x(b.x), y(b.y)); } c.stroke();
      for (const s of L.sites) { c.fillStyle = s.kind === 'city' ? '#e8b06b' : '#eee2c6'; c.beginPath(); c.arc(x(s.x), y(s.y), s.kind === 'city' ? 4 : 2.5, 0, Math.PI * 2); c.fill(); }
      overview.background = bg; overviewSeed = L.seed;
    }
    ctx.drawImage(overview.background, 0, 0);
    const v = api.camera(), r = api.viewport(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.strokeRect((v.x - r.width / (2 * v.s) - L.X0) / L.W * W, (v.y - r.height / (2 * v.s) - L.Y0) / L.H * H, r.width / v.s / L.W * W, r.height / v.s / L.H * H);
  }
  $('overview-map').addEventListener('click', (e) => { const L = api.layout(), r = e.currentTarget.getBoundingClientRect(); api.panTo(L.X0 + (e.clientX - r.left) / r.width * L.W, L.Y0 + (e.clientY - r.top) / r.height * L.H); });
  $('overview-map').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.code === 'Space') { e.preventDefault(); api.action('region'); } });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('people-picker').hidden = true; });
  $('people-picker').addEventListener('click', (e) => { const b = e.target.closest('[data-person]'); if (b) { api.select({ type: 'person', id: Number(b.dataset.person) }); $('people-picker').hidden = true; } });

  loadPins(); applySettings(); history.reset(api.capture()); alerts.reset(world); alerts.poll(world, pinnedIds(), settings); updateNavigation(); paintPins();
  return {
    settings, db,
    capture() { return { pins, settings: { roofs: settings.roofs }, chronicle: { ...chronicle } }; },
    restore(data) {
      if (Array.isArray(data?.pins)) { pins = data.pins.filter((p) => p && api.valid(p)).slice(0, 20); savePins(); signature = ''; }
      if (['auto', 'selected', 'closed'].includes(data?.settings?.roofs)) { settings.roofs = data.settings.roofs; applySettings(); }
      if (data?.chronicle) {
        for (const k of ['query', 'min', 'from', 'to', 'scope']) if (typeof data.chronicle[k] === 'string') chronicle[k] = data.chronicle[k];
        for (const [id, key] of [['chron-query', 'query'], ['chron-scope', 'scope'], ['chron-min', 'min'], ['chron-from', 'from'], ['chron-to', 'to']]) $(id).value = chronicle[key];
      }
      api.events(); paintPins();
    },
    adopted() { world = api.world(); cancelAdvance(); loadPins(); recent = []; $('alertInbox').hidden = true; signature = ''; overviewSeed = null; overview.background = null; rateT = world.t; rateAt = performance.now(); alerts.reset(world); alerts.poll(world, pinnedIds(), settings); history.reset(api.capture()); updateNavigation(); paintPins(); },
    navigated(from) { if (!applying) history.visit(from, api.capture()); updateNavigation(); api.events(); },
    action(name) {
      if (name === 'preferences') preferences(); else if (name === 'checkpoints') void checkpoints(); else if (name === 'advance') advanceDialog();
      else if (name === 'alerts') alertInbox();
      else if (name === 'inside' || name === 'outside') { settings.roofs = name === 'inside' ? 'selected' : 'closed'; applySettings(); }
    },
    cancelAdvance,
    dismissPicker() { $('people-picker').hidden = true; },
    choosePeople(list, clientX, clientY) {
      if (list.length < 2) return false;
      const picker = $('people-picker'); picker.hidden = false;
      picker.innerHTML = `<strong>${list.length} people nearby</strong>` + list.slice(0, 12).map(({ id }) => `<button data-person="${id}">${esc(api.label({ type: 'person', id }))}</button>`).join('') + (list.length > 12 ? '<p>Showing the nearest 12; zoom in to narrow the choice.</p>' : '');
      const r = $('stage').getBoundingClientRect(), x = clientX - r.left, y = clientY - r.top;
      const left = x + 14 + picker.offsetWidth < r.width ? x + 14 : x - picker.offsetWidth - 14;
      const top = y + 14 + picker.offsetHeight < r.height ? y + 14 : y - picker.offsetHeight - 14;
      picker.style.left = `${Math.max(4, Math.min(r.width - picker.offsetWidth - 4, left))}px`; picker.style.top = `${Math.max(4, Math.min(r.height - picker.offsetHeight - 4, top))}px`;
      return true;
    },
    chronicleEvents(events, minor, types) {
      let ids = null;
      if (chronicle.scope !== 'all') {
        const selected = api.selection(); ids = [];
        if (chronicle.scope === 'selection' && selected?.type === 'person') ids = [selected.id];
        if (chronicle.scope === 'household') { const hh = api.household(), pin = pins.find((p) => p.type === 'household' && p.id === hh); ids = [...new Set([...(pin?.members || []), ...api.world().people.filter((p) => p.hh === hh && hh >= 0).map((p) => p.id)])]; }
      }
      const result = chronicleQuery(events, { ...chronicle, min: Math.max(minor ? 0 : 1, Number(chronicle.min)), people: ids, types }, api.day);
      const description = result.oldest === null ? 'No recorded events yet.' : `Retained from ${api.date(result.oldest)}. ${result.list.length} of ${result.total} matching events. Subject links use the recorded primary person.`;
      if ($('chron-window').textContent !== description) $('chron-window').textContent = description;
      $('moreEvents').hidden = result.list.length >= result.total;
      return result.list;
    },
    afterStep() {
      const found = alerts.poll(api.world(), pinnedIds(), settings);
      if (!found.length) return true;
      const descriptions = found.map((a) => `${api.date(a.t)} · ${a.person !== undefined ? api.label({ type: 'person', id: a.person }) : api.label({ type: 'site', id: a.site })}: ${a.text}`);
      recent = [...descriptions.map((description, i) => ({ description, subject: found[i].person !== undefined ? { type: 'person', id: found[i].person } : { type: 'site', id: found[i].site } })), ...recent].slice(0, 8);
      $('alertInbox').textContent = `Alerts (${recent.length})`; $('alertInbox').hidden = false;
      api.toast(descriptions[0] + (descriptions.length > 1 ? ` (+${descriptions.length - 1} more)` : ''));
      if (settings.pauseAlerts) { api.setSpeed(0); return false; } return true;
    },
    update(now = performance.now()) {
      updateNavigation(); paintPins(); overview(now);
      if (now - rateAt >= 1000) { achieved = Math.max(0, (api.world().t - rateT) / ((now - rateAt) / 1000)); rateAt = now; rateT = api.world().t; }
      const rate = api.speed() ? `Target ${api.speed()} min/s · achieved ${achieved.toFixed(1)} min/s` : '';
      if ($('play-rate')?.textContent !== rate) $('play-rate').textContent = rate;
    },
  };
}
