import { createSaveStore, shortcut, SPEEDS } from './viewer-tools.js';
import { createCheckpointStore } from './checkpoint-store.js';

/** Navigation and persistence around the existing viewer; no simulation rules. */
export function installQualityOfLife(api) {
  const $ = (id) => document.getElementById(id);
  const store = createSaveStore(() => localStorage);
  const checkpoints = createCheckpointStore(), VIEW_KEY = 'world-in-dreams:manual-view:v1';
  const PREFS = 'world-in-dreams:viewer:v1';
  let savedWorld = api.world(), savedMinute = savedWorld.t, recoveryPending = true, backupInProgress = false;
  let backedWorld = null, backedMinute = -1, backedView = '', failedBackup = false, busy = false;
  let resume = api.speed() || 1;

  $('stage').insertAdjacentHTML('beforeend', `<div id="map-tools" aria-label="Map controls">
    <button data-tool="zoomIn" title="Zoom in (+)" aria-label="Zoom in">+</button>
    <button data-tool="zoomOut" title="Zoom out (-)" aria-label="Zoom out">−</button>
    <button data-tool="step" title="Pause and advance one minute (.)">+1 min</button>
    <button data-tool="center" title="Center on selection">Locate</button>
    <button id="toggleSide" data-tool="sidebar" aria-controls="side" aria-expanded="true" title="Show or hide the sidebar">Panel</button>
    <button data-tool="help" title="Controls (?)">?</button>
  </div><div id="play-state" role="status"></div>`);
  $('bar').insertAdjacentHTML('beforeend', '<span id="save-status" class="sub" role="status">Auto recovery every 30s</span>');
  $('bar').insertAdjacentHTML('afterend', `<div id="recovery-notice" hidden role="status">
    <span id="recovery-text"></span><button id="restoreRecovery">Restore</button><button id="keepCurrent">Keep current world</button>
  </div>`);
  document.body.insertAdjacentHTML('beforeend', `<dialog id="viewer-dialog" aria-labelledby="dialog-title">
    <h2 id="dialog-title"></h2><div id="dialog-body"></div><div id="dialog-actions" class="btns"></div>
  </dialog>`);
  const dialog = $('viewer-dialog');
  $('toast').setAttribute('role', 'status');
  $('map').setAttribute('aria-label', 'World map. Drag to pan, wheel to zoom. Press ? for controls.');

  function preferences() {
    const settings = { labels: $('lyLabels').checked, night: $('lyNight').checked, minor: $('minor').checked,
      collapsed: document.body.classList.contains('side-hidden'), filters: api.filters };
    try { localStorage.setItem(PREFS, JSON.stringify(settings)); } catch { /* Preferences are optional. */ }
  }
  function sidebar(collapsed) {
    document.body.classList.toggle('side-hidden', collapsed);
    $('toggleSide').setAttribute('aria-expanded', String(!collapsed));
    preferences();
  }
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || 'null');
    if (p) {
      for (const [id, key] of [['lyLabels', 'labels'], ['lyNight', 'night'], ['minor', 'minor']]) if (typeof p[key] === 'boolean') $(id).checked = p[key];
      for (const k of Object.keys(api.filters)) if (typeof p.filters?.[k] === 'boolean') api.filters[k] = p.filters[k];
      document.body.classList.toggle('side-hidden', p.collapsed === true);
      $('toggleSide').setAttribute('aria-expanded', String(p.collapsed !== true));
      for (const b of $('filters').querySelectorAll('button')) { b.classList.toggle('on', api.filters[b.dataset.f]); b.setAttribute('aria-pressed', String(api.filters[b.dataset.f])); }
      api.events();
    }
  } catch { /* A damaged preference never prevents opening the game. */ }
  for (const id of ['lyLabels', 'lyNight', 'minor']) $(id).addEventListener('change', preferences);
  $('filters').addEventListener('click', preferences);

  function save() {
    try {
      store.save(api.serialize(api.world()));
      try { localStorage.setItem(VIEW_KEY, JSON.stringify({ seed: api.world().seed, version: api.world().version, t: api.world().t, view: api.capture() })); } catch { /* The world checkpoint still succeeded. */ }
      savedWorld = api.world(); savedMinute = savedWorld.t;
      $('save-status').textContent = 'Manual save · ' + new Date().toLocaleTimeString();
      api.toast('Saved in this browser');
      return true;
    } catch { api.toast('The browser refused the save. Export a JSON copy instead.'); return false; }
  }
  async function backup() {
    const world = api.world();
    if (recoveryPending || backupInProgress) return;
    const capturedView = api.capture(), viewText = JSON.stringify(capturedView);
    if (backedWorld === world && backedMinute === world.t && backedView === viewText) return;
    backupInProgress = true;
    try {
      const minute = world.t, record = { world: JSON.parse(api.serialize(world)), view: capturedView, savedAt: Date.now() };
      // A transaction rotates the old recovery only if the new record commits.
      try { await checkpoints.put('recovery', record); }
      catch { store.backup(record.world, record.savedAt, record.view); }
      backedWorld = world; backedMinute = minute; backedView = viewText; failedBackup = false;
      $('save-status').textContent = 'Recovery saved · ' + new Date().toLocaleTimeString();
    } catch {
      $('save-status').textContent = 'Recovery unavailable · use Export';
      if (!failedBackup) api.toast('Auto recovery could not be saved. Export a JSON copy.');
      failedBackup = true;
    } finally { backupInProgress = false; }
  }

  function showDialog(title, body, actions) {
    return new Promise((resolve) => {
      $('dialog-title').textContent = title;
      $('dialog-body').innerHTML = body;
      const buttons = $('dialog-actions'); buttons.replaceChildren();
      let result = false;
      for (const [label, value, before] of actions) {
        const b = document.createElement('button'); b.textContent = label;
        b.addEventListener('click', () => { if (before && !before()) return; result = value; dialog.close(); });
        buttons.append(b);
      }
      dialog.addEventListener('close', () => resolve(result), { once: true });
      dialog.showModal();
      buttons.firstElementChild.focus();
    });
  }
  async function replace(makeWorld, message) {
    if (busy || document.querySelector('dialog[open]')) return false;
    api.cancelAdvance();
    busy = true;
    const wasSpeed = api.speed(); api.setSpeed(0);
    try {
      // Validate/read/create first, so failure leaves the current world intact.
      const result = await makeWorld(), world = result?.world || result;
      api.validate(world);
      if (api.world() !== savedWorld || api.world().t !== savedMinute) {
        const ok = await showDialog('Replace the current world?', '<p>There are changes since the last manual save. You can save them before continuing.</p>', [
          ['Cancel', false], ['Save & continue', true, save], ['Continue without saving', true],
        ]);
        if (!ok) { api.setSpeed(wasSpeed); return false; }
      }
      api.adopt(world);
      if (result?.view) api.restore(result.view);
      savedWorld = world; savedMinute = world.t;
      api.setSpeed(0);
      api.toast(message + ' · paused');
      return true;
    } catch (err) { api.setSpeed(wasSpeed); api.toast(err.message || 'Could not open that world.'); return false; }
    finally { busy = false; }
  }

  async function help() {
    if (document.querySelector('dialog[open]') || busy) return;
    api.cancelAdvance();
    const wasSpeed = api.speed(); api.setSpeed(0);
    await showDialog('Controls', `<p>Drag the map to pan. Wheel to zoom toward the pointer. Click to inspect; double-click a person to follow.</p>
      <dl class="controls-list"><dt>Space</dt><dd>Pause / resume the last speed</dd><dt>1–6</dt><dd>¼ min, 1 min, 6 min, 30 min, 3h, 12h per second</dd>
      <dt>.</dt><dd>Pause and advance one minute</dd><dt>Arrow keys</dt><dd>Pan the map</dd><dt>+ / −</dt><dd>Zoom in / out</dd><dt>C / R</dt><dd>Frame city / region</dd>
      <dt>F</dt><dd>Follow / stop following the selected person</dd><dt>/</dt><dd>Search people</dd><dt>Ctrl / ⌘ + S</dt><dd>Save in this browser</dd><dt>Esc</dt><dd>Close help / clear selection</dd><dt>? / H</dt><dd>Show this help</dd></dl>
      <p>Automatic recovery keeps a separate copy every 30 seconds. Save keeps your manual checkpoint. Export downloads a JSON copy.</p>`, [['Close', true]]);
    api.setSpeed(wasSpeed);
  }
  function run(action) {
    if (document.querySelector('dialog[open]') || busy) return;
    if (action === 'save') return save();
    if (action === 'help') return void help();
    if (action === 'sidebar') return sidebar(!document.body.classList.contains('side-hidden'));
    if (action === 'search') { sidebar(false); return api.search(); }
    if (action === 'pause') { if (api.speed()) { resume = api.speed(); api.setSpeed(0); } else api.setSpeed(resume); return; }
    if (action.startsWith('speed:')) { resume = SPEEDS[Number(action.split(':')[1]) - 1]; api.setSpeed(resume); return; }
    api.action(action);
  }
  window.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]') || busy || e.defaultPrevented) return;
    const action = shortcut(e);
    if (!action) return;
    e.preventDefault(); run(action);
  });
  $('map-tools').addEventListener('click', (e) => { const b = e.target.closest('[data-tool]'); if (b) run(b.dataset.tool); });
  $('speeds').addEventListener('click', () => { if (api.speed()) resume = api.speed(); });
  $('save').addEventListener('click', save);
  $('newWorld').addEventListener('click', () => replace(() => api.create($('seed').value.trim() || Math.random().toString(36).slice(2, 8)), 'New world ready'));
  $('load').addEventListener('click', () => replace(() => {
    const text = store.load();
    if (!text) throw new Error('No manual save in this browser.');
    const world = api.deserialize(text);
    let metadata;
    try { metadata = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null'); } catch { /* Legacy save without a view. */ }
    return { world, view: metadata?.seed === world.seed && metadata?.version === world.version && metadata?.t === world.t ? metadata.view : null };
  }, 'Manual save loaded'));
  $('import').addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await replace(async () => api.deserialize(await file.text()), 'JSON save loaded');
    e.target.value = '';
  });
  $('export').addEventListener('click', () => {
    const world = api.world(), a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([api.serialize(world)], { type: 'application/json' }));
    const seed = world.seedText.replace(/[^a-z0-9_-]/gi, '_').slice(0, 60) || 'world';
    a.download = `world-in-dreams-${seed}-day${api.day(world.t) + 1}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    api.toast('JSON download requested');
  });

  async function readRecovery() {
    try {
      let record = null, legacy = null, readable = false;
      try { record = await checkpoints.get('recovery'); readable = true; } catch { /* Try the older browser copy. */ }
      try { legacy = store.recover(); readable = true; } catch { /* Keep an IndexedDB copy if available. */ }
      if (legacy && (!record || legacy.savedAt > record.savedAt)) record = legacy;
      if (!readable) throw new Error('Recovery storage is unavailable.');
      if (!record) { recoveryPending = false; return; }
      $('recovery-notice').hidden = false;
      $('recovery-text').textContent = `Recovery available: “${record.world.seedText}” · ${new Date(record.savedAt).toLocaleString()}`;
      $('save-status').textContent = 'Previous recovery protected';
      $('restoreRecovery').addEventListener('click', async () => {
        const loaded = await replace(() => ({ world: api.deserialize(record.world), view: record.view }), 'Recovery restored');
        if (loaded) {
          recoveryPending = false; $('recovery-notice').hidden = true;
          backedWorld = api.world(); backedMinute = backedWorld.t; backedView = JSON.stringify(api.capture());
          $('save-status').textContent = 'Recovery restored · paused';
        }
      });
    } catch {
    $('save-status').textContent = 'Recovery unavailable · manual Save / Import available';
    recoveryPending = true;
    $('recovery-notice').hidden = false;
    $('recovery-text').textContent = 'The previous recovery could not be read. Keep the current world to try a fresh recovery copy.';
    $('restoreRecovery').hidden = true;
    }
  }
  void readRecovery();
  $('keepCurrent').addEventListener('click', () => { recoveryPending = false; $('recovery-notice').hidden = true; backup(); });
  setInterval(backup, 30_000);
  window.addEventListener('pagehide', backup);
  document.addEventListener('visibilitychange', () => { if (document.hidden) backup(); });

  return {
    loadRecord: (record, message) => replace(() => ({ world: api.deserialize(record.world), view: record.view }), message),
    update() {
      const p = api.following();
      const text = [api.speed() === 0 ? 'Paused' : '', p ? `Following ${p}` : ''].filter(Boolean).join(' · ');
      if ($('play-state').textContent !== text) $('play-state').textContent = text;
      $('play-state').hidden = !text;
    },
  };
}
