/* Image browser, disk folder tree, quick-sort shortcuts and lightbox viewer. */
"use strict";

const Images = (() => {
  const S = { path: null, data: null, list: [], sel: new Set(), anchor: -1, focus: -1, shown: 0,
    recursive: false, sort: "name", filter: "", group: "", size: 180, expanded: new Set(), tree: null };
  const deep = () => S.recursive || !!S.group;  // a group filter looks through every subfolder
  const CHUNK = 240;
  try {
    S.expanded = new Set(JSON.parse(localStorage.getItem("clf.fsExpanded") || "[]"));
    S.size = +localStorage.getItem("clf.thumb") || 180;
  } catch { /* ignore */ }

  /* ---------------------------------------------------------------- browsing */
  async function open(path, keepSel = false) {
    if (!path) return;
    try {
      const data = await GET(`/api/fs/list?path=${encodeURIComponent(path)}${deep() ? "&recursive=1" : ""}`);
      if (S.path !== data.path && !keepSel) { S.sel.clear(); S.anchor = -1; S.focus = -1; }
      S.path = data.path; S.data = data;
      try { localStorage.setItem("clf.lastPath", S.path); } catch { /* ignore */ }
      apply();
      renderCrumbs(); renderTiles(); renderSide();
      if (!keepSel) $("#browser-body").scrollTop = 0;
    } catch (e) { fail(e); }
  }
  const reload = () => open(S.path, true);
  /* Group of a folder: the nearest group along its tree path (folders inside Clasificadas only). */
  const groupCache = new Map();
  function groupOfDir(dir) {
    const key = dir.toLowerCase();
    if (groupCache.has(key)) return groupCache.get(key);
    let g = null;
    const rel = relTo(App.cfg.settings.destination, dir);
    if (rel !== null) {
      let n = App.cfg.root;
      for (const part of rel ? rel.split("/") : []) {
        const c = n.children.find((x) => x.kind === "variable") || n.children.find((x) => norm(x.name) === norm(part));
        if (!c) break;
        n = c;
        if (c.group) g = c.group;
      }
    }
    groupCache.set(key, g);
    return g;
  }
  const groupSig = () => JSON.stringify([App.cfg.groups, App.cfg.root]);
  /* Called when the tab is shown: the tree may have new groups or folders since the last listing. */
  function refreshGroups() { if (S.data && S.sig !== groupSig()) apply(); else renderGroupSelect(S.group ? S.counts : null); }
  function renderGroupSelect(counts = null) {
    const sel = $("#img-group");
    if (!App.cfg) return;
    const groups = App.cfg.groups;
    if (S.group && S.group !== "__none" && !groups.some((g) => g.id === S.group)) S.group = "";
    sel.hidden = !groups.length && !S.group;
    sel.innerHTML = "";
    const label = (v, text) => (counts && v ? `${text} (${counts[v] || 0})` : text);
    sel.append(h("option", { value: "" }, "Todos los grupos"),
      ...groups.map((g) => h("option", { value: g.id }, label(g.id, "● " + g.name))),
      h("option", { value: "__none" }, label("__none", "Sin grupo")));
    sel.value = S.group;
    const g = groups.find((x) => x.id === S.group);
    sel.classList.toggle("active-filter", !!S.group);
    sel.style.borderColor = g ? g.color : "";
    sel.style.color = g ? g.color : "";
  }
  function apply() {
    const q = norm(S.filter);
    groupCache.clear();
    const valid = new Set(App.cfg.groups.map((g) => g.id));
    let list = S.data ? S.data.images.filter((i) => !q || norm(i.name).includes(q) || norm(i.rel).includes(q)) : [];
    const counts = {};
    for (const i of list) {
      const g = groupOfDir(i.path.replace(/[\\/][^\\/]*$/, ""));
      i.group = valid.has(g) ? g : null;
      const k = i.group || "__none";
      counts[k] = (counts[k] || 0) + 1;
    }
    if (S.group) list = list.filter((i) => (S.group === "__none" ? !i.group : i.group === S.group));
    S.counts = counts;
    S.sig = groupSig();
    renderGroupSelect(S.group ? counts : null);
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
    // The folder belongs to the tree: offer to improve its description from the images it holds.
    const rel = relTo(App.cfg.settings.destination, S.path);
    const node = rel ? Tree.nodeAtRel(rel.split("/")) : null;
    const b = $("#btn-improve-here");
    b.hidden = !node || node.id === "root";
    if (node) {
      b.title = `La IA analiza las imágenes de «${node.name}» y mejora su descripción para clasificar mejor`;
      b.onclick = () => Inspector.improve(node.id);
    }
  }
  function countLine(d) {
    const total = d.total ?? d.images, deep = total - d.images;
    const imgs = (n) => `${n} imagen${n === 1 ? "" : "es"}`;
    const dirs = d.subdirs ? ` · ${d.subdirs} carpeta${d.subdirs === 1 ? "" : "s"}` : "";
    if (!total) return h("small", {}, `Sin imágenes${dirs}`);
    if (!d.images) return h("small", { class: "deep", title: "Todas están dentro de sus subcarpetas" }, `${imgs(total)} en subcarpetas${dirs}`);
    return h("small", {}, `${imgs(d.images)}${deep ? ` (+${deep} en subcarpetas)` : ""}${dirs}`);
  }
  function renderTiles() {
    const box = $("#dir-tiles");
    box.innerHTML = "";
    for (const d of S.data.dirs) {
      const total = d.total ?? d.images;
      const mosaic = d.preview.length
        ? h("div", { class: "mosaic" }, [0, 1, 2, 3].map((i) => d.preview[i] ? h("img", { loading: "lazy", src: thumbUrl(d.preview[i], 160) }) : h("div", { class: "blank" })),
          d.deepPreview ? h("span", { class: "deep-tag" }, "de las subcarpetas") : null)
        : h("div", { class: "mosaic none", html: icon("folder") });
      const t = h("div", { class: "dir-tile" + (total ? "" : " is-empty"), title: d.path, onclick: () => open(d.path),
        oncontextmenu: (e) => { e.preventDefault(); folderMenu(e, d.path); } }, mosaic,
        h("div", { class: "meta" }, h("b", {}, d.name), countLine(d)));
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
    if (S.group && S.path && relTo(App.cfg.settings.destination, S.path) === null) {
      empty.hidden = false;
      empty.textContent = "Los grupos solo existen dentro de Clasificadas: abre esa carpeta o una de sus subcarpetas.";
    } else if (S.group && S.data && S.data.images.length && !S.list.length) {
      empty.textContent = "Ninguna imagen de este grupo aquí ni en sus subcarpetas.";
    }
    const hint = $("#grid-hint");
    const inside = S.data ? S.data.dirs.reduce((a, d) => a + (d.total ?? d.images), 0) : 0;
    hint.hidden = !(S.data && !deep() && !S.data.images.length && inside);
    hint.innerHTML = "";
    if (!hint.hidden) hint.append(h("span", {}, `Esta carpeta no tiene imágenes sueltas, pero dentro de sus subcarpetas hay ${inside}.`),
      h("button", { class: "btn small", onclick: () => { $("#img-recursive").checked = true; S.recursive = true; reload(); } }, "Verlas todas aquí"));
    updateSelBar();
  }
  function more() {
    const grid = $("#grid");
    const end = Math.min(S.list.length, S.shown + CHUNK);
    const frag = document.createDocumentFragment();
    const ts = S.size > 260 ? 640 : 320;
    const groups = deep() ? new Map(App.cfg.groups.map((g) => [g.id, g])) : null;
    for (let i = S.shown; i < end; i++) {
      const it = S.list[i];
      const g = groups && it.group ? groups.get(it.group) : null;
      frag.append(h("div", { class: "tile" + (S.sel.has(it.path) ? " sel" : "") + (i === S.focus ? " focus" : ""), "data-i": i, draggable: true, title: `${it.rel ? it.rel + "\\" : ""}${it.name}\n${fmtSize(it.size)} · ${fmtDate(it.mtime)}${g ? "\nGrupo: " + g.name : ""}` },
        h("img", { loading: "lazy", src: thumbUrl(it.path, ts), alt: "" }), h("span", { class: "tick" }),
        g ? h("span", { class: "gdot tile-g", style: { background: g.color } }) : null,
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
    renderGroupSelect(S.group ? S.counts : null);
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
      { label: "Borrar carpetas vacías dentro…", fn: () => cleanEmpty(p) },
      "-",
      { label: "Mostrar en el Explorador", fn: () => POST("/api/fs/reveal", { path: p }).catch(fail) },
    ]);
  }
  /* Lists the folders below root that hold no image at all and sends the chosen ones to the recycle bin. */
  async function cleanEmpty(root = S.path) {
    if (!root) return;
    let r;
    try { r = await GET(`/api/fs/empty?path=${encodeURIComponent(root)}`); } catch (e) { return fail(e); }
    if (!r.dirs.length) return toast(`No hay carpetas sin imágenes dentro de «${baseName(root)}»`, "ok");
    const checks = r.dirs.map((d) => h("input", { type: "checkbox", checked: !d.others }));
    const withFiles = r.dirs.filter((d) => d.others).length;
    const body = h("div", {},
      h("p", { class: "hint", style: { marginTop: 0 } }, `Carpetas dentro de «${baseName(root)}» que no tienen ninguna imagen, ni sueltas ni en sus subcarpetas. Irán a la Papelera de reciclaje de Windows. ` +
        "Las carpetas del árbol se vuelven a crear solas cuando se clasifique una imagen en ellas."),
      withFiles ? h("p", { class: "hint" }, `${withFiles} de ellas tienen otros archivos (no imágenes): quedan sin marcar para que decidas.`) : null,
      h("div", { class: "btn-row", style: { marginBottom: "6px" } },
        h("button", { class: "btn small", onclick: () => checks.forEach((c) => (c.checked = true)) }, "Marcar todas"),
        h("button", { class: "btn small", onclick: () => checks.forEach((c) => (c.checked = false)) }, "Ninguna")),
      h("div", { class: "pick-list", style: { padding: "4px 0" } }, r.dirs.map((d, i) => h("label", { class: "check", style: { display: "flex", padding: "3px 10px" } }, checks[i],
        h("code", {}, d.rel), d.others ? h("span", { class: "muted" }, `— tiene ${d.others} archivo(s) que no son imágenes`) : null))));
    const ok = await modal({ title: `Carpetas sin imágenes: ${r.dirs.length}`, wide: true, body,
      buttons: [{ label: "Cancelar", value: false }, { label: "Enviar marcadas a la papelera", value: true, primary: true, cls: "danger" }] });
    if (!ok) return;
    const paths = r.dirs.filter((_, i) => checks[i].checked).map((d) => d.path);
    if (!paths.length) return;
    const res = await POST("/api/fs/remove-dirs", { paths, root }).catch(fail);
    if (!res) return;
    const bad = res.results.filter((x) => !x.ok);
    toast(`${paths.length - bad.length} carpeta(s) a la papelera${bad.length ? ` · ${bad.length} sin borrar: ${bad[0].error}` : ""}`, bad.length ? "error" : "ok", null, 7000);
    folderCache.time = 0;
    loadTree();
    if (S.path) reload();
    Main.refreshStats();
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
        { label: `✨ Etiquetar ${files.length} con IA`, fn: () => Tags.startFiles(files) },
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
    $("#img-group").onchange = (e) => { S.group = e.target.value; reload(); };
    renderGroupSelect();
    $("#btn-clean").onclick = () => cleanEmpty();
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
      if (act === "tag") Tags.startFiles(files);
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

  return { init, open, reload, loadTree, onKey, moveFiles, renderSide, refreshGroups, undoLast, cleanEmpty, get path() { return S.path; } };
})();

/* ==================================================================== lightbox */
const Lightbox = (() => {
  let items = [], idx = 0, opts = {}, view = { k: 1, x: 0, y: 0, fit: true }, nat = { w: 0, h: 0 };
  const img = () => $("#lb-img");

  function open(list, i, o = {}) {
    items = list.slice(); opts = o; idx = Math.max(0, Math.min(i, list.length - 1));
    if (!items.length) return;
    const lb = $("#lightbox");
    lb.hidden = false;
    // "over": opened from a dialog, shown above it and limited to viewing.
    lb.classList.toggle("over", !!o.over);
    $("#lb-move").hidden = !o.onMove;
    $("#lb-trash").hidden = !o.onTrash;
    $("#lb-classify").hidden = !!o.over;
    $("#lb-shortcuts").hidden = !o.onMove;
    show();
    renderShortcuts();
  }
  function close() { $("#lightbox").hidden = true; $("#lightbox").classList.remove("over"); $(".lb-answer")?.remove(); img().src = ""; }
  const isOpen = () => !$("#lightbox").hidden;
  const isOver = () => isOpen() && $("#lightbox").classList.contains("over");
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
    $("#lb-move").onclick = async () => { if (!opts.onMove) return; const d = await pickFolder({ title: "Mover imagen a…" }); if (d) moveCurrent(d); };
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
    else if (k === "Delete" && opts.onTrash) trashCurrent();
    else if (k.toLowerCase() === "m" && opts.onMove) $("#lb-move").click();
    else if (k === "+" || k === "=") { const r = $("#lb-stage").getBoundingClientRect(); zoomAt(1.25, r.width / 2, r.height / 2); }
    else if (k === "-") { const r = $("#lb-stage").getBoundingClientRect(); zoomAt(0.8, r.width / 2, r.height / 2); }
    else if (k === "0") fitView();
    else if (/^[1-9]$/.test(k) && opts.onMove) { const d = App.shortcuts()[+k - 1]; if (d) moveCurrent(d); else toast(`El atajo ${k} no está asignado`); }
    else return false;
    e.preventDefault();
    return true;
  }
  return { init, open, close, onKey, isOpen, isOver, removed, renderShortcuts };
})();
