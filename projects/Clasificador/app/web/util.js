/* Shared helpers: API, DOM, toasts, modals, chip inputs and folder picker. */
"use strict";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

async function api(method, url, body) {
  const opt = { method, headers: {} };
  if (method !== "GET") opt.headers["X-Clasificador"] = "1";
  if (body !== undefined) {
    opt.headers["Content-Type"] = "application/json";
    opt.body = JSON.stringify(body);
  }
  const r = await fetch(url, opt);
  let data;
  try { data = await r.json(); } catch { data = {}; }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`);
  return data;
}
const GET = (url) => api("GET", url);
const POST = (url, body = {}) => api("POST", url, body);

function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "value") value = v;
    else if (k === "class") e.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "html") e.innerHTML = v;
    else if (k in e && typeof v !== "string") e[k] = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    e.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  if (value !== undefined) e.value = value;
  return e;
}

/* Element.append writes null as text: this appends only real children. */
function fill(el, ...kids) {
  el.append(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
  return el;
}

const ICONS = {
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  expand: '<path d="M7 10l5 5 5-5"/><path d="M7 4l5 5 5-5"/>',
  collapse: '<path d="M7 14l5-5 5 5"/><path d="M7 20l5-5 5 5"/>',
  folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  refresh: '<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  reset: '<path d="M3 12a9 9 0 109-9"/><path d="M3 4v5h5"/>',
  copies: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const fmtSize = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";
const fmtDate = (t) => new Date(t * 1000).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
const thumbUrl = (p, s = 320) => `/api/thumb?s=${s}&path=${encodeURIComponent(p)}`;
const fileUrl = (p) => `/api/file?path=${encodeURIComponent(p)}`;
const baseName = (p) => String(p).split(/[\\/]/).filter(Boolean).pop() || p;
const joinPath = (a, b) => a.replace(/[\\/]+$/, "") + "\\" + b;
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const uid = () => Math.random().toString(16).slice(2, 12);

function relTo(root, p) {
  const r = String(root).replace(/[\\/]+$/, "").toLowerCase();
  const q = String(p);
  if (q.toLowerCase() === r) return "";
  if (q.toLowerCase().startsWith(r + "\\") || q.toLowerCase().startsWith(r + "/")) return q.slice(r.length + 1).replace(/\\/g, "/");
  return null;
}

/* ---------- toasts */
function toast(msg, type = "", action = null, ms = 4500) {
  const t = h("div", { class: `toast ${type}` }, h("span", {}, msg));
  if (action) t.append(h("button", { onclick: () => { action.fn(); t.remove(); } }, action.label));
  $("#toasts").append(t);
  setTimeout(() => t.remove(), action ? ms + 3000 : ms);
}
function fail(e) { console.error(e); toast(e.message || String(e), "error", null, 7000); }

async function busy(btn, fn) {
  if (btn) btn.classList.add("busy");
  try { return await fn(); } catch (e) { fail(e); } finally { if (btn) btn.classList.remove("busy"); }
}

/* ---------- modal */
function modal({ title, body, buttons = [{ label: "Cerrar", value: null }], wide = false, onOpen }) {
  return new Promise((resolve) => {
    const back = h("div", { class: "modal-back" });
    const close = (v) => { back.remove(); document.removeEventListener("keydown", onKey, true); resolve(v); };
    const foot = h("div", { class: "modal-foot" }, buttons.map((b) =>
      h("button", { class: `btn ${b.cls || ""}`, onclick: async () => {
        if (b.check && !(await b.check())) return;
        close(typeof b.value === "function" ? b.value() : b.value);
      } }, b.label)));
    const m = h("div", { class: `modal ${wide ? "wide" : ""}` },
      h("div", { class: "modal-head" }, title), h("div", { class: "modal-body" }, body), foot);
    back.append(m);
    back.addEventListener("mousedown", (e) => { if (e.target === back) close(null); });
    const onKey = (e) => {
      if (e.target.closest?.("#ctx-menu") || back !== $("#modal-root").lastElementChild || Lightbox.isOver()) return;
      if (e.key === "Escape") { e.stopPropagation(); close(null); }
      if (e.key === "Enter" && !e.shiftKey && e.target.tagName !== "TEXTAREA" && !e.target.closest?.(".chips")) {
        const primary = buttons.find((b) => b.primary);
        if (primary) { e.preventDefault(); e.stopPropagation(); foot.children[buttons.indexOf(primary)].click(); }
      }
    };
    document.addEventListener("keydown", onKey, true);
    $("#modal-root").append(back);
    if (onOpen) onOpen(m, close);
    const first = m.querySelector("input, textarea");
    if (first) setTimeout(() => first.focus(), 30);
  });
}
async function confirmBox(title, text, okLabel = "Aceptar", danger = false) {
  return modal({ title, body: h("p", {}, text), buttons: [
    { label: "Cancelar", value: false }, { label: okLabel, value: true, primary: true, cls: danger ? "danger" : "primary" }] });
}
async function promptBox(title, label, value = "") {
  const inp = h("input", { value, style: { width: "100%" } });
  return modal({ title, body: h("label", { class: "field" }, label, inp), buttons: [
    { label: "Cancelar", value: null }, { label: "Aceptar", value: () => inp.value.trim() || null, primary: true, cls: "primary" }] });
}

/* ---------- context menu */
let menuOnClose = null;
function closeMenu() {
  const m = $("#ctx-menu");
  if (m.hidden) return;
  m.hidden = true;
  const fn = menuOnClose; menuOnClose = null;
  if (fn) fn();
}
function placeMenu(m, x, y, below = null) {
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + "px";
  let top = y;
  if (top + r.height > innerHeight - 8) top = below !== null ? below - r.height : innerHeight - r.height - 8;
  m.style.top = Math.max(8, top) + "px";
}
function contextMenu(x, y, items) {
  closeMenu();
  const m = $("#ctx-menu");
  m.innerHTML = "";
  for (const it of items) {
    if (it === "-") { m.append(h("hr")); continue; }
    m.append(h("button", { onclick: () => { closeMenu(); it.fn(); } }, it.label));
  }
  m.hidden = false;
  placeMenu(m, x, y);
}
/* Dropdown under an element. Items: {label, hint, on, fn, always} or "-" or {header}. Long lists get a filter box. */
function popMenu(anchor, items, { filter = items.filter((i) => i.fn).length > 9, placeholder = "Filtrar…", onClose = null } = {}) {
  closeMenu();
  const m = $("#ctx-menu");
  m.innerHTML = "";
  const list = h("div", { class: "pm-list" });
  const input = filter ? h("input", { class: "pm-filter", placeholder }) : null;
  let rows = [], idx = -1;
  const choose = (it) => { const q = input ? input.value.trim() : ""; closeMenu(); it.fn(q); };
  const draw = () => {
    const q = input ? norm(input.value) : "";
    const shown = items.filter((it) => typeof it !== "object" || !it.fn || it.always || !q || norm(it.label + " " + (it.hint || "")).includes(q));
    list.innerHTML = "";
    rows = [];
    shown.forEach((it, k) => {
      if (it === "-") { if (k && shown[k - 1] !== "-" && k < shown.length - 1) list.append(h("hr")); return; }
      if (it.header) { list.append(h("div", { class: "pm-head" }, it.header)); return; }
      const b = h("button", { class: (it.on ? "on " : "") + (it.cls || ""), title: it.title || "", onclick: () => choose(it) },
        h("span", { class: "pm-label" }, it.label), it.hint ? h("small", {}, it.hint) : null);
      rows.push({ it, b });
      list.append(b);
    });
    idx = q && rows.length ? 0 : rows.findIndex((r) => r.it.on);
    rows.forEach((r, i) => r.b.classList.toggle("kb", i === idx));
    if (!rows.length) list.append(h("div", { class: "pm-head" }, "Nada coincide"));
  };
  if (input) {
    input.addEventListener("input", draw);
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!rows.length) return;
        idx = (idx + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length;
        rows.forEach((r, i) => r.b.classList.toggle("kb", i === idx));
        rows[idx].b.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") { e.preventDefault(); if (rows[idx]) choose(rows[idx].it); }
      else if (e.key === "Escape") closeMenu();
    });
    m.append(input);
  }
  m.append(list);
  draw();
  m.hidden = false;
  menuOnClose = onClose;
  const r = anchor.getBoundingClientRect();
  placeMenu(m, r.left, r.bottom + 4, r.top - 4);
  if (input) setTimeout(() => input.focus(), 0);
}
document.addEventListener("mousedown", (e) => { if (!e.target.closest("#ctx-menu")) closeMenu(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#ctx-menu").hidden) { e.stopImmediatePropagation(); e.preventDefault(); closeMenu(); } }, true);

/* ---------- no accidental text selection: only fields and explicitly selectable text can be selected */
const SELECTABLE = "input, textarea, [contenteditable], pre, .selectable, .msg";
document.addEventListener("selectstart", (e) => {
  const t = e.target.nodeType === 1 ? e.target : e.target.parentElement;
  if (!t || !t.closest(SELECTABLE)) e.preventDefault();
});

/* ---------- chip input with autocomplete and AI suggestions */
function chipInput({ values, inherited = [], placeholder = "Añadir…", suggestions = () => [], onChange, onAI }) {
  let list = [...values];
  const wrap = h("div");
  const box = h("div", { class: "chips" });
  const input = h("input", { placeholder });
  const ac = h("div", { class: "autocomplete", hidden: true });
  const sugRow = h("div", { class: "suggest-row", hidden: true });
  let acItems = [], acIndex = 0;

  const commit = () => onChange([...list]);
  const add = (v) => {
    v = String(v).trim().replace(/,$/, "");
    if (!v || list.some((x) => norm(x) === norm(v))) return;
    list.push(v); render(); commit();
  };
  function render() {
    box.innerHTML = "";
    for (const v of inherited) box.append(h("span", { class: "chip inherited", title: "Heredado del grupo" }, v));
    list.forEach((v, i) => box.append(h("span", { class: "chip" }, v,
      h("button", { title: "Quitar", onclick: () => { list.splice(i, 1); render(); commit(); } }, "×"))));
    box.append(input, ac);
  }
  function showAC() {
    const q = norm(input.value);
    const have = new Set([...list, ...inherited].map(norm));
    acItems = suggestions().filter((s) => !have.has(norm(s.value)) && (!q || norm(s.value).includes(q)))
      .sort((a, b) => (norm(a.value).startsWith(q) ? 0 : 1) - (norm(b.value).startsWith(q) ? 0 : 1) || b.count - a.count)
      .slice(0, 8);
    acIndex = 0;
    ac.innerHTML = "";
    acItems.forEach((s, i) => ac.append(h("div", { class: i === acIndex ? "on" : "", onmousedown: (e) => { e.preventDefault(); add(s.value); input.value = ""; showAC(); } },
      s.value, s.count > 1 ? h("small", {}, `usado ${s.count}×`) : null)));
    ac.hidden = !acItems.length || document.activeElement !== input;
  }
  input.addEventListener("input", showAC);
  input.addEventListener("focus", showAC);
  input.addEventListener("blur", () => { setTimeout(() => (ac.hidden = true), 100); if (input.value.trim()) { add(input.value); input.value = ""; } });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (input.value.trim()) add(input.value);
      else if (!ac.hidden && acItems[acIndex]) add(acItems[acIndex].value);
      input.value = ""; showAC();
    } else if (e.key === "Tab" && !ac.hidden && acItems[acIndex] && input.value) {
      e.preventDefault(); add(acItems[acIndex].value); input.value = ""; showAC();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!acItems.length) return;
      e.preventDefault();
      acIndex = (acIndex + (e.key === "ArrowDown" ? 1 : -1) + acItems.length) % acItems.length;
      [...ac.children].forEach((c, i) => c.classList.toggle("on", i === acIndex));
    } else if (e.key === "Backspace" && !input.value && list.length) {
      list.pop(); render(); commit(); input.focus();
    }
    e.stopPropagation();
  });
  box.addEventListener("click", (e) => { if (e.target === box) input.focus(); });
  wrap.append(box, sugRow);
  render();

  wrap.showSuggestions = (items) => {
    sugRow.innerHTML = "";
    const have = new Set(list.map(norm));
    const fresh = items.filter((s) => !have.has(norm(s)));
    if (!fresh.length) { sugRow.hidden = true; toast("La IA no propuso nada nuevo"); return; }
    for (const s of fresh) {
      const c = h("span", { class: "chip suggested", title: "Clic para añadir", onclick: () => { add(s); c.remove(); if (!sugRow.querySelector(".chip")) sugRow.hidden = true; } }, "+ " + s);
      sugRow.append(c);
    }
    sugRow.append(h("button", { class: "btn small", onclick: () => { fresh.forEach(add); sugRow.hidden = true; } }, "Añadir todas"),
      h("button", { class: "btn small", onclick: () => (sugRow.hidden = true) }, "Descartar"));
    sugRow.hidden = false;
  };
  wrap.partial = () => input.value.trim();
  return wrap;
}

/* ---------- folder picker (destination folders) */
let folderCache = { root: null, time: 0, list: [] };
async function destFolders(force = false) {
  const root = App.cfg.settings.destination;
  if (!force && folderCache.root === root && Date.now() - folderCache.time < 15000) return folderCache.list;
  const out = [];
  try {
    const t = await GET(`/api/fs/tree?path=${encodeURIComponent(root)}`);
    const rec = (n, rel) => { for (const c of n.children) { const r = rel ? rel + "/" + c.name : c.name; out.push({ rel: r, path: c.path }); rec(c, r); } };
    rec(t, "");
  } catch { /* destination may not exist yet */ }
  folderCache = { root, time: Date.now(), list: out };
  return out;
}

async function pickFolder({ title = "Mover a…", allowCreate = true } = {}) {
  const root = App.cfg.settings.destination;
  const folders = await destFolders(true);
  const short = App.shortcuts();
  const input = h("input", { placeholder: "Escribe para buscar o una ruta nueva (p. ej. anime/otros/mapa)", style: { width: "100%" } });
  const list = h("div", { class: "pick-list" });
  let rows = [], idx = 0, chosen = null;
  const render = () => {
    const q = norm(input.value).replace(/\\/g, "/");
    const words = q.split(/\s+/).filter(Boolean);
    rows = folders.filter((f) => words.every((w) => norm(f.rel).includes(w))).slice(0, 300);
    if (!q) rows = [...short.map((s) => ({ rel: relTo(root, s) ?? s, path: s, key: short.indexOf(s) + 1 })), { rel: "(raíz) " + baseName(root), path: root }, ...rows];
    const exact = folders.some((f) => norm(f.rel) === q);
    if (allowCreate && q && !exact) rows.unshift({ rel: input.value.trim().replace(/\\/g, "/"), path: null, create: true });
    idx = Math.min(idx, Math.max(0, rows.length - 1));
    list.innerHTML = "";
    rows.forEach((r, i) => list.append(h("div", { class: i === idx ? "on" : "", onclick: () => { idx = i; done(); } },
      r.key ? h("span", { class: "k" }, r.key) : null, r.create ? h("span", { class: "k" }, "Crear:") : null, r.rel)));
  };
  let doneFn;
  const done = () => { const r = rows[idx]; if (!r) return; chosen = r.create ? joinPath(root, r.rel.replace(/\//g, "\\")) : r.path; doneFn && doneFn(); };
  input.addEventListener("input", () => { idx = 0; render(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { idx = Math.min(rows.length - 1, idx + 1); render(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { idx = Math.max(0, idx - 1); render(); e.preventDefault(); }
    else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); done(); }
  });
  render();
  const res = await modal({ title, body: h("div", {}, input, list), buttons: [{ label: "Cancelar", value: null }],
    onOpen: (_m, close) => { doneFn = () => close("ok"); } });
  return res === "ok" ? chosen : null;
}
