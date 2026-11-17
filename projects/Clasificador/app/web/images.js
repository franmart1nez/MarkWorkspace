/* Image browser, disk folder tree, quick-sort shortcuts and lightbox viewer. */
"use strict";

const Images = (() => {
  const S = { path: null, data: null, list: [], sel: new Set(), anchor: -1, focus: -1, shown: 0,
    recursive: false, sort: "name", filter: "", size: 180, expanded: new Set(), tree: null };
  const CHUNK = 240;
  try {
    S.expanded = new Set(JSON.parse(localStorage.getItem("clf.fsExpanded") || "[]"));
    S.size = +localStorage.getItem("clf.thumb") || 180;
  } catch { /* ignore */ }

  /* ---------------------------------------------------------------- browsing */
  async function open(path, keepSel = false) {
    if (!path) return;
    try {
      const data = await GET(`/api/fs/list?path=${encodeURIComponent(path)}${S.recursive ? "&recursive=1" : ""}`);
      if (S.path !== data.path && !keepSel) { S.sel.clear(); S.anchor = -1; S.focus = -1; }
      S.path = data.path; S.data = data;
      try { localStorage.setItem("clf.lastPath", S.path); } catch { /* ignore */ }
      apply();
      renderCrumbs(); renderTiles(); renderSide();
      if (!keepSel) $("#browser-body").scrollTop = 0;
    } catch (e) { fail(e); }
  }
  const reload = () => open(S.path, true);
  function apply() {
    const q = norm(S.filter);
    let list = S.data ? S.data.images.filter((i) => !q || norm(i.name).includes(q) || norm(i.rel).includes(q)) : [];
    if (S.sort === "mtime") list = [...list].sort((a, b) => b.mtime - a.mtime);
    else if (S.sort === "size") list = [...list].sort((a, b) => b.size - a.size);
    S.list = list;
    const keep = new Set(list.map((i) => i.path));
    for (const p of [...S.sel]) if (!keep.has(p)) S.sel.delete(p);
    renderGrid();
  }
  function renderCrumbs() {
    const c = $("#crumbs");
    c.innerHTML = "";
    const parts = S.path.split(/[\\/]/).filter(Boolean);
    let acc = "";
    parts.forEach((p, i) => {
      acc = i === 0 ? p + "\\" : joinPath(acc, p);
      const target = acc;
      if (i) c.append(h("span", {}, "›"));
      c.append(h("button", { onclick: () => open(target) }, p));
    });
  }
  function renderTiles() {
    const box = $("#dir-tiles");
    box.innerHTML = "";
    for (const d of S.data.dirs) {
      const mosaic = d.preview.length
        ? h("div", { class: "mosaic" }, [0, 1, 2, 3].map((i) => d.preview[i] ? h("img", { loading: "lazy", src: thumbUrl(d.preview[i], 160) }) : h("div", { class: "blank" })))
        : h("div", { class: "mosaic none", html: icon("folder") });
      const t = h("div", { class: "dir-tile", title: d.path, onclick: () => open(d.path),
        oncontextmenu: (e) => { e.preventDefault(); folderMenu(e, d.path); } }, mosaic,
        h("div", { class: "meta" }, h("b", {}, d.name), h("small", {}, `${d.images} imágenes${d.subdirs ? ` · ${d.subdirs} carpetas` : ""}`)));
      dropTarget(t, d.path);
      box.append(t);
    }
  }
  function renderGrid() {
    const grid = $("#grid");
    grid.innerHTML = "";
    grid.style.setProperty("--thumb", S.size + "px");
    S.shown = 0;
    more();
    const empty = $("#grid-empty");
    empty.hidden = !!S.list.length;
    empty.textContent = S.data && S.data.images.length ? "Ninguna imagen coincide con el filtro." : (S.data?.dirs.length ? "" : "No hay imágenes en esta carpeta.");
    if (S.data && !S.data.images.length && S.data.dirs.length) empty.hidden = true;
    updateSelBar();
  }
  function more() {
    const grid = $("#grid");
    const end = Math.min(S.list.length, S.shown + CHUNK);
    const frag = document.createDocumentFragment();
    const ts = S.size > 260 ? 640 : 320;
    for (let i = S.shown; i < end; i++) {
      const it = S.list[i];
      frag.append(h("div", { class: "tile" + (S.sel.has(it.path) ? " sel" : "") + (i === S.focus ? " focus" : ""), "data-i": i, draggable: true, title: `${it.rel ? it.rel + "\\" : ""}${it.name}\n${fmtSize(it.size)} · ${fmtDate(it.mtime)}` },
        h("img", { loading: "lazy", src: thumbUrl(it.path, ts), alt: "" }), h("span", { class: "tick" }),
        h("div", { class: "cap" }, (it.rel ? it.rel + " / " : "") + it.name)));
    }
    grid.append(frag);
    S.shown = end;
  }
  function tileEl(i) { return $(`#grid .tile[data-i="${i}"]`); }
  function refreshTiles() {
    $$("#grid .tile").forEach((t) => {
      const i = +t.dataset.i;
      t.classList.toggle("sel", S.sel.has(S.list[i]?.path));
      t.classList.toggle("focus", i === S.focus);
    });
    updateSelBar();
  }
  function updateSelBar() {
    const n = S.sel.size;
    $("#selection-bar").hidden = !n;
    $("#sel-count").textContent = `${n} seleccionada${n === 1 ? "" : "s"} de ${S.list.length}`;
  }
  function selected() { return S.list.filter((i) => S.sel.has(i.path)).map((i) => i.path); }

  /* ---------------------------------------------------------------- side panel */
  async function loadTree() {
    try { S.tree = await GET(`/api/fs/tree?path=${encodeURIComponent(App.cfg.settings.destination)}`); }
    catch { S.tree = null; }
    renderSide();
  }
  function renderSide() {
    if (!App.cfg) return;
    const s = App.cfg.settings;
    const loc = $("#locations");
    loc.innerHTML = "";
    for (const [label, p] of [["Sin clasificar", s.source], ["Clasificadas", s.destination]]) {
      const el = h("div", { class: "loc" + (S.path && S.path.toLowerCase() === String(p).toLowerCase() ? " active" : ""), onclick: () => open(p) },
        h("b", {}, label), h("small", {}, p));
      dropTarget(el, p);
      loc.append(el);
    }
    const tree = $("#fs-tree");
    tree.innerHTML = "";
    if (!S.tree) { tree.append(h("p", { class: "hint" }, "La carpeta destino aún no existe.")); }
    else {
      const rec = (n, container) => {
        for (const c of n.children) {
          const open_ = S.expanded.has(c.path.toLowerCase());
          const key = App.shortcuts().findIndex((x) => x.toLowerCase() === c.path.toLowerCase());
          const row = h("div", { class: "fs-row" + (S.path && S.path.toLowerCase() === c.path.toLowerCase() ? " active" : ""), title: c.path },
            h("span", { class: "caret", onclick: (e) => { e.stopPropagation(); toggle(c.path); } }, c.children.length ? (open_ ? "▾" : "▸") : ""),
            h("span", { class: "name" }, c.name), key >= 0 ? h("span", { class: "key" }, key + 1) : null);
          row.onclick = () => open(c.path);
          row.oncontextmenu = (e) => { e.preventDefault(); folderMenu(e, c.path); };
          dropTarget(row, c.path);
          container.append(row);
          if (open_ && c.children.length) { const kids = h("div", { class: "fs-kids" }); container.append(kids); rec(c, kids); }
        }
      };
      rec(S.tree, tree);
    }
    const sl = $("#shortcut-list");
    sl.innerHTML = "";
    const shorts = App.shortcuts();
    if (!shorts.length) sl.append(h("p", { class: "hint" }, "Sin atajos."));
    shorts.forEach((p, i) => sl.append(h("div", { class: "shortcut", title: p }, h("span", { class: "key" }, i + 1),
      h("span", { class: "name" }, relTo(s.destination, p) ?? p),
      h("button", { class: "icon-btn", title: "Quitar", html: icon("close"), onclick: () => setShortcut(p, false) }))));
  }
  function toggle(p) {
    const k = p.toLowerCase();
    S.expanded.has(k) ? S.expanded.delete(k) : S.expanded.add(k);
    try { localStorage.setItem("clf.fsExpanded", JSON.stringify([...S.expanded])); } catch { /* ignore */ }
    renderSide();
  }
  function setShortcut(p, on) {
    let list = App.shortcuts().filter((x) => x.toLowerCase() !== p.toLowerCase());
    if (on) { if (list.length >= 9) return toast("Máximo 9 atajos", "error"); list.push(p); }
    App.cfg.settings.shortcuts = list;
    Main.changed({ soft: true });
    renderSide();
    Lightbox.renderShortcuts();
  }
  function folderMenu(e, p) {
    const has = App.shortcuts().some((x) => x.toLowerCase() === p.toLowerCase());
    contextMenu(e.clientX, e.clientY, [
      { label: "Abrir", fn: () => open(p) },
      { label: has ? "Quitar atajo" : "Fijar atajo (tecla 1–9)", fn: () => setShortcut(p, !has) },
      { label: "Nueva subcarpeta…", fn: async () => {
        const name = await promptBox("Nueva subcarpeta", `Dentro de ${baseName(p)}`);
        if (!name) return;
        await POST("/api/fs/mkdir", { parent: p, name }).catch(fail);
        loadTree(); if (S.path === p) reload();
      } },
      { label: "Renombrar…", fn: async () => {
        const name = await promptBox("Renombrar carpeta", "Nuevo nombre", baseName(p));
        if (!name) return;
        try { const r = await POST("/api/fs/rename", { path: p, name }); toast("Renombrada. Si la carpeta está en el árbol, renómbrala también allí.");
          loadTree(); if (S.path === p) open(r.path); else reload(); } catch (err) { fail(err); }
      } },
      "-",
      { label: "Mostrar en el Explorador", fn: () => POST("/api/fs/reveal", { path: p }).catch(fail) },
    ]);
  }
  function dropTarget(el, path) {
    el.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("application/x-clf-files")) { e.preventDefault(); el.classList.add("drop"); e.dataTransfer.dropEffect = e.ctrlKey ? "copy" : "move"; } });
    el.addEventListener("dragleave", () => el.classList.remove("drop"));
    el.addEventListener("drop", (e) => {
      e.preventDefault(); el.classList.remove("drop");
      const files = JSON.parse(e.dataTransfer.getData("application/x-clf-files") || "[]");
      if (files.length) moveFiles(files, path, e.ctrlKey ? "copy" : "move");
    });
  }

  /* ---------------------------------------------------------------- file actions */
  async function moveFiles(files, dest, op = "move") {
    try {
      const r = await POST("/api/fs/move", { files, dest, op });
      const ok = r.results.filter((x) => x.ok && !x.skipped);
      const bad = r.results.filter((x) => !x.ok);
      if (op === "move") removeFromView(ok.map((x) => x.from));
      toast(`${op === "copy" ? "Copiadas" : "Movidas"} ${ok.length} → ${relTo(App.cfg.settings.destination, dest) ?? baseName(dest)}${bad.length ? ` · ${bad.length} con error` : ""}`,
        bad.length ? "error" : "ok", ok.length ? { label: "Deshacer", fn: undoLast } : null);
      folderCache.time = 0;
      Main.refreshStats();
      if (S.tree && !dest.toLowerCase().startsWith(S.path.toLowerCase())) loadTree();
      return ok.map((x) => x.from);
    } catch (e) { fail(e); return []; }
  }
  async function undoLast() {
    try {
      const r = await POST("/api/history/undo");
      if (!r.undone) return toast(r.errors[0] || "Nada que deshacer");
      toast(`Deshecho: ${r.count} archivo(s) devueltos${r.errors.length ? ` · ${r.errors.length} errores` : ""}`, r.errors.length ? "error" : "ok");
      reload(); Main.refreshStats();
    } catch (e) { fail(e); }
  }
  function removeFromView(paths) {
    const gone = new Set(paths.map((p) => p.toLowerCase()));
    if (!gone.size || !S.data) return;
    S.data.images = S.data.images.filter((i) => !gone.has(i.path.toLowerCase()));
    paths.forEach((p) => S.sel.delete(p));
    const top = $("#browser-body").scrollTop;
    apply();
    while (S.shown < S.list.length && S.shown < S.focus + CHUNK) more();
    $("#browser-body").scrollTop = top;
    Lightbox.removed(gone);
  }
  async function trash(files) {
    if (!files.length) return;
    if (!(await confirmBox("Enviar a la papelera", `${files.length} imagen(es) irán a la Papelera de reciclaje de Windows.`, "Papelera", true))) return false;
    const r = await POST("/api/fs/trash", { files }).catch(fail);
    if (!r) return false;
    const ok = r.results.filter((x) => x.ok).map((x) => x.path);
    removeFromView(ok);
    toast(`${ok.length} a la papelera`, "ok");
    Main.refreshStats();
    return true;
  }
  async function moveWithPicker(files, op = "move") {
    if (!files.length) return;
    const dest = await pickFolder({ title: `${op === "copy" ? "Copiar" : "Mover"} ${files.length} imagen(es) a…` });
    if (dest) await moveFiles(files, dest, op);
  }
  function shortcutMove(n, files) {
    const dest = App.shortcuts()[n - 1];
    if (!dest) return toast(`El atajo ${n} no está asignado (clic derecho en una carpeta → Fijar atajo)`);
    if (files.length) moveFiles(files, dest);
  }

  /* ---------------------------------------------------------------- events */
  function init() {
    const grid = $("#grid");
    grid.addEventListener("click", (e) => {
      const t = e.target.closest(".tile");
      if (!t) return;
      const i = +t.dataset.i, p = S.list[i].path;
      if (e.shiftKey && S.anchor >= 0) {
        const [a, b] = [Math.min(S.anchor, i), Math.max(S.anchor, i)];
        if (!(e.ctrlKey || e.metaKey)) S.sel.clear();
        for (let k = a; k <= b; k++) S.sel.add(S.list[k].path);
      } else if (e.ctrlKey || e.metaKey || e.target.classList.contains("tick")) {
        S.sel.has(p) ? S.sel.delete(p) : S.sel.add(p); S.anchor = i;
      } else { S.sel = new Set([p]); S.anchor = i; }
      S.focus = i;
      refreshTiles();
    });
    grid.addEventListener("dblclick", (e) => {
      const t = e.target.closest(".tile");
      if (t) openLightbox(+t.dataset.i);
    });
    grid.addEventListener("dragstart", (e) => {
      const t = e.target.closest(".tile");
      if (!t) return;
      const p = S.list[+t.dataset.i].path;
      if (!S.sel.has(p)) { S.sel = new Set([p]); refreshTiles(); }
      const files = selected();
      e.dataTransfer.setData("application/x-clf-files", JSON.stringify(files));
      e.dataTransfer.effectAllowed = "copyMove";
      const badge = h("div", { style: { position: "fixed", top: "-100px", padding: "4px 10px", background: "#7c9cff", color: "#000", borderRadius: "10px", fontWeight: 700 } }, `${files.length} imagen(es)`);
      document.body.append(badge);
      e.dataTransfer.setDragImage(badge, 10, 10);
      setTimeout(() => badge.remove(), 0);
    });
    grid.addEventListener("contextmenu", (e) => {
      const t = e.target.closest(".tile");
      if (!t) return;
      e.preventDefault();
      const p = S.list[+t.dataset.i].path;
      if (!S.sel.has(p)) { S.sel = new Set([p]); refreshTiles(); }
      const files = selected();
      contextMenu(e.clientX, e.clientY, [
        { label: "Ver  (Enter)", fn: () => openLightbox(+t.dataset.i) },
        { label: `Mover ${files.length} a…  (M)`, fn: () => moveWithPicker(files) },
        { label: `Copiar ${files.length} a…`, fn: () => moveWithPicker(files, "copy") },
        { label: `✨ Clasificar ${files.length} con IA`, fn: () => Classify.startFiles(files) },
        { label: "Mostrar en el Explorador", fn: () => POST("/api/fs/reveal", { path: p }).catch(fail) },
        { label: "Abrir con la app predeterminada", fn: () => POST("/api/fs/open", { path: p }).catch(fail) },
        "-",
        { label: `Enviar ${files.length} a la papelera  (Supr)`, fn: () => trash(files) },
      ]);
    });
    new IntersectionObserver((ents) => { if (ents[0].isIntersecting && S.shown < S.list.length) more(); },
      { root: $("#browser-body"), rootMargin: "800px" }).observe($("#grid-sentinel"));

    $("#btn-up").innerHTML = icon("up");
    $("#btn-up").onclick = () => S.data?.parent && open(S.data.parent);
    $("#btn-fs-refresh").innerHTML = icon("refresh");
    $("#btn-fs-refresh").onclick = () => { loadTree(); reload(); };
    $("#img-filter").addEventListener("input", debounce((e) => { S.filter = e.target.value; apply(); }, 150));
    $("#img-filter").addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") { e.target.value = ""; S.filter = ""; apply(); e.target.blur(); } });
    $("#img-sort").onchange = (e) => { S.sort = e.target.value; apply(); };
    $("#img-recursive").onchange = (e) => { S.recursive = e.target.checked; reload(); };
    const size = $("#img-size");
    size.value = S.size;
    size.oninput = () => { S.size = +size.value; $("#grid").style.setProperty("--thumb", S.size + "px"); try { localStorage.setItem("clf.thumb", S.size); } catch { /* ignore */ } };
    $("#selection-bar").addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      const files = selected();
      if (act === "all") { S.sel = new Set(S.list.map((i) => i.path)); refreshTiles(); }
      if (act === "none") { S.sel.clear(); refreshTiles(); }
      if (act === "move") moveWithPicker(files);
      if (act === "copy") moveWithPicker(files, "copy");
      if (act === "classify") Classify.startFiles(files);
      if (act === "reveal") POST("/api/fs/reveal", { path: files[0] }).catch(fail);
      if (act === "trash") trash(files);
    });
  }
  function columns() {
    const tiles = $$("#grid .tile");
    if (tiles.length < 2) return 1;
    const top = tiles[0].offsetTop;
    let c = 0;
    while (c < tiles.length && tiles[c].offsetTop === top) c++;
    return c;
  }
  function onKey(e) {
    if (!S.list.length && !["Backspace"].includes(e.key)) return false;
    const ctrl = e.ctrlKey || e.metaKey;
    const files = selected();
    const k = e.key;
    if (k.startsWith("Arrow")) {
      const cols = columns();
      const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[k];
      let i = Math.max(0, Math.min(S.list.length - 1, (S.focus < 0 ? 0 : S.focus + d)));
      while (i >= S.shown) more();
      S.focus = i;
      if (e.shiftKey) S.sel.add(S.list[i].path); else S.sel = new Set([S.list[i].path]);
      S.anchor = e.shiftKey ? S.anchor : i;
      refreshTiles();
      tileEl(i)?.scrollIntoView({ block: "nearest" });
    } else if (k === "Enter" || k === " ") { openLightbox(S.focus >= 0 ? S.focus : 0); }
    else if (ctrl && k.toLowerCase() === "a") { S.sel = new Set(S.list.map((i) => i.path)); refreshTiles(); }
    else if (k === "Delete") trash(files);
    else if (k.toLowerCase() === "m" && files.length) moveWithPicker(files);
    else if (/^[1-9]$/.test(k) && !ctrl) shortcutMove(+k, files);
    else if (k === "Backspace") { S.data?.parent && open(S.data.parent); }
    else if (k === "Escape") { S.sel.clear(); refreshTiles(); }
    else return false;
    return true;
  }
  function openLightbox(i) {
    Lightbox.open(S.list, i, {
      onMove: async (item, dest) => (await moveFiles([item.path], dest)).length > 0,
      onTrash: async (item) => trash([item.path]),
      onIndex: (item) => { S.focus = S.list.findIndex((x) => x.path === item.path); S.sel = new Set([item.path]); refreshTiles(); },
    });
  }

  return { init, open, reload, loadTree, onKey, moveFiles, renderSide, undoLast, get path() { return S.path; } };
})();

/* ==================================================================== lightbox */
const Lightbox = (() => {
  let items = [], idx = 0, opts = {}, view = { k: 1, x: 0, y: 0, fit: true }, nat = { w: 0, h: 0 };
  const img = () => $("#lb-img");

  function open(list, i, o = {}) {
    items = list.slice(); opts = o; idx = Math.max(0, Math.min(i, list.length - 1));
    if (!items.length) return;
    $("#lightbox").hidden = false;
    show();
    renderShortcuts();
  }
  function close() { $("#lightbox").hidden = true; $(".lb-answer")?.remove(); img().src = ""; }
  const isOpen = () => !$("#lightbox").hidden;
  function show() {
    const it = items[idx];
    if (!it) return close();
    $(".lb-answer")?.remove();
    const im = img();
    im.style.opacity = 0;
    im.onload = () => { nat = { w: im.naturalWidth, h: im.naturalHeight }; fitView(); im.style.opacity = 1; info(it); };
    im.src = fileUrl(it.path);
    $("#lb-title").textContent = `${idx + 1} / ${items.length} · ${it.name}`;
    $("#lb-prev").hidden = idx <= 0; $("#lb-next").hidden = idx >= items.length - 1;
    if (items[idx + 1]) new Image().src = fileUrl(items[idx + 1].path);
    opts.onIndex && opts.onIndex(it);
  }
  function info(it) {
    const folder = it.path.split(/[\\/]/).slice(-2, -1)[0];
    $("#lb-info").textContent = `${nat.w}×${nat.h} · ${it.size ? fmtSize(it.size) : ""} · ${folder}${it.extra ? " · " + it.extra : ""}`;
  }
  function fitView() {
    const r = $("#lb-stage").getBoundingClientRect();
    const k = Math.min(1, (r.width - 40) / nat.w, (r.height - 20) / nat.h);
    view = { k, x: (r.width - nat.w * k) / 2, y: (r.height - nat.h * k) / 2, fit: true };
    applyView();
  }
  function applyView() {
    img().style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.k})`;
    img().style.width = nat.w + "px"; img().style.height = nat.h + "px";
    $("#lb-zoom").textContent = Math.round(view.k * 100) + "%";
  }
  function zoomAt(f, cx, cy) {
    const k = Math.max(0.05, Math.min(20, view.k * f));
    view.x = cx - (cx - view.x) * (k / view.k); view.y = cy - (cy - view.y) * (k / view.k);
    view.k = k; view.fit = false; applyView();
  }
  function go(d) { const j = idx + d; if (j >= 0 && j < items.length) { idx = j; show(); } }
  /* Drops files that left the folder; stays on the same position so the next image appears. */
  function removed(goneSet) {
    if (!isOpen()) return;
    const cur = items[idx];
    const before = items.slice(0, idx).filter((i) => goneSet.has(i.path.toLowerCase())).length;
    items = items.filter((i) => !goneSet.has(i.path.toLowerCase()));
    if (!items.length) return close();
    idx = Math.min(idx - before, items.length - 1);
    if (cur && goneSet.has(cur.path.toLowerCase())) show();
    else $("#lb-title").textContent = `${idx + 1} / ${items.length} · ${items[idx].name}`;
  }
  async function moveCurrent(dest) {
    const it = items[idx];
    if (!it || !opts.onMove) return;
    if (await opts.onMove(it, dest)) removed(new Set([it.path.toLowerCase()]));
  }
  async function trashCurrent() {
    const it = items[idx];
    if (!it || !opts.onTrash) return;
    if (await opts.onTrash(it)) removed(new Set([it.path.toLowerCase()]));
  }
  function renderShortcuts() {
    const box = $("#lb-shortcuts");
    if (!box) return;
    box.innerHTML = "";
    App.shortcuts().forEach((p, i) => box.append(h("button", { title: p, onclick: () => moveCurrent(p) }, h("b", {}, i + 1), relTo(App.cfg.settings.destination, p) ?? baseName(p))));
  }
  async function where(btn) {
    const it = items[idx];
    if (!it) return;
    await busy(btn, async () => {
      const r = await Classify.quickAsk(it.path);
      $(".lb-answer")?.remove();
      if (items[idx] !== it) return;
      const dest = joinPath(App.cfg.settings.destination, r.proposal.replace(/\//g, "\\"));
      $("#lightbox").append(h("div", { class: "lb-answer" },
        h("div", {}, h("b", {}, r.proposal)), h("div", { class: "conf" }, `Confianza ${r.confidence}%`),
        h("p", { class: "muted", style: { margin: "6px 0" } }, r.reason),
        h("div", { class: "btn-row" },
          opts.onMove ? h("button", { class: "btn small primary", onclick: () => moveCurrent(dest) }, "Mover allí") : null,
          h("button", { class: "btn small", onclick: (e) => e.target.closest(".lb-answer").remove() }, "Cerrar"))));
    });
  }

  function init() {
    $("#lb-close").innerHTML = icon("close");
    $("#lb-close").onclick = close;
    $("#lb-prev").onclick = () => go(-1);
    $("#lb-next").onclick = () => go(1);
    $("#lb-move").onclick = async () => { const d = await pickFolder({ title: "Mover imagen a…" }); if (d) moveCurrent(d); };
    $("#lb-trash").onclick = trashCurrent;
    $("#lb-reveal").onclick = () => items[idx] && POST("/api/fs/reveal", { path: items[idx].path }).catch(fail);
    $("#lb-classify").onclick = (e) => where(e.currentTarget);
    const stage = $("#lb-stage");
    stage.addEventListener("wheel", (e) => { e.preventDefault(); const r = stage.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0018), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    let pan = null;
    stage.addEventListener("pointerdown", (e) => { pan = { sx: e.clientX, sy: e.clientY, x: view.x, y: view.y, moved: false }; stage.setPointerCapture(e.pointerId); stage.classList.add("panning"); });
    stage.addEventListener("pointermove", (e) => { if (!pan) return; const dx = e.clientX - pan.sx, dy = e.clientY - pan.sy; if (Math.abs(dx) + Math.abs(dy) > 3) pan.moved = true; view.x = pan.x + dx; view.y = pan.y + dy; view.fit = false; applyView(); });
    stage.addEventListener("pointerup", (e) => { stage.classList.remove("panning"); if (pan && !pan.moved && e.target === stage) close(); pan = null; });
    stage.addEventListener("dblclick", (e) => {
      const r = stage.getBoundingClientRect();
      if (view.fit) zoomAt(1 / view.k, e.clientX - r.left, e.clientY - r.top); else fitView();
    });
    window.addEventListener("resize", () => { if (isOpen() && view.fit) fitView(); });
  }
  function onKey(e) {
    if (!isOpen()) return false;
    const k = e.key;
    if (k === "Escape") close();
    else if (k === "ArrowLeft") go(-1);
    else if (k === "ArrowRight" || k === " ") go(1);
    else if (k === "Delete") trashCurrent();
    else if (k.toLowerCase() === "m") $("#lb-move").click();
    else if (k === "+" || k === "=") { const r = $("#lb-stage").getBoundingClientRect(); zoomAt(1.25, r.width / 2, r.height / 2); }
    else if (k === "-") { const r = $("#lb-stage").getBoundingClientRect(); zoomAt(0.8, r.width / 2, r.height / 2); }
    else if (k === "0") fitView();
    else if (/^[1-9]$/.test(k)) { const d = App.shortcuts()[+k - 1]; if (d) moveCurrent(d); else toast(`El atajo ${k} no está asignado`); }
    else return false;
    e.preventDefault();
    return true;
  }
  return { init, open, close, onKey, isOpen, removed, renderShortcuts };
})();
