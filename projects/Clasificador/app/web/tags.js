/* Tags tab: AI tagging runs, filtering a folder's images by their tags and editing tags by hand. */
"use strict";

const Tags = (() => {
  const S = { path: null, recursive: true, images: [], loaded: false, truncated: false, list: [], filters: {}, status: "all",
    q: "", sort: "name", size: 170, sel: new Set(), anchor: -1, focus: -1, shown: 0, more: {}, job: null, vocab: {},
    threads: null };
  const CHUNK = 240;
  let timer = null;
  try {
    S.path = localStorage.getItem("clf.tagsPath");
    S.recursive = localStorage.getItem("clf.tagsRec") !== "0";
    S.size = +localStorage.getItem("clf.tagsThumb") || 170;
  } catch { /* ignore */ }

  const cats = () => App.cfg?.tags?.categories || [];
  const has = (img) => !!img.tags && Object.keys(img.tags).length > 0;
  const tagCount = (t) => (t ? Object.values(t).reduce((a, v) => a + v.length, 0) : 0);
  const cleanTag = (s) => norm(s).replace(/[<>:"/\\|?*{}\x00-\x1f]/g, "").replace(/\s+/g, " ").replace(/^[ .]+|[ .]+$/g, "").slice(0, 40);
  function tagsText(t) {
    const txt = cats().filter((c) => t?.[c.id]?.length).map((c) => `${c.name}: ${t[c.id].join(", ")}`).join(" · ");
    return txt || "Sin etiquetas";
  }

  /* ---------------------------------------------------------------- loading */
  async function load(path = S.path || App.cfg.settings.destination) {
    S.loaded = false; renderGrid();
    try {
      const r = await GET(`/api/tags/list?path=${encodeURIComponent(path)}&recursive=${S.recursive ? 1 : 0}`);
      if (r.path !== S.path) { S.sel.clear(); S.anchor = S.focus = -1; }
      S.path = r.path; S.images = r.images; S.truncated = r.truncated;
      try { localStorage.setItem("clf.tagsPath", S.path); } catch { /* ignore */ }
    } catch (e) {
      fail(e);
      if (path !== App.cfg.settings.destination) return load(App.cfg.settings.destination);
      S.images = [];
    }
    S.loaded = true;
    apply();
    GET("/api/tags/vocab").then((r) => { S.vocab = r.vocab; }).catch(() => {});
  }

  /* ---------------------------------------------------------------- filtering
     Within a category the chosen values add up (any of them); across categories all must match. */
  function passes(img, skipCat = null) {
    if (S.status === "tagged" && !has(img)) return false;
    if (S.status === "untagged" && has(img)) return false;
    const t = img.tags || {};
    for (const [cid, f] of Object.entries(S.filters)) {
      if (cid === skipCat) continue;
      const have = t[cid] || [];
      const inc = Object.keys(f).filter((v) => f[v] === 1);
      if (inc.length && !inc.some((v) => have.includes(v))) return false;
      if (Object.keys(f).some((v) => f[v] === -1 && have.includes(v))) return false;
    }
    if (S.q) {
      const hay = norm(`${img.name} ${img.rel} ${Object.values(t).flat().join(" ")}`);
      if (!norm(S.q).split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  }
  function apply({ keep = false } = {}) {
    let list = S.images.filter((i) => passes(i));
    if (S.sort === "mtime") list = [...list].sort((a, b) => b.mtime - a.mtime);
    else if (S.sort === "few") list = [...list].sort((a, b) => tagCount(a.tags) - tagCount(b.tags));
    S.list = list;
    const keepSel = new Set(list.map((i) => i.path));
    for (const p of [...S.sel]) if (!keepSel.has(p)) S.sel.delete(p);
    renderSide(); renderBar(); renderGrid(keep); renderInsp();
  }
  function facetCounts(cid) {
    const out = {};
    for (const img of S.images) {
      if (!img.tags?.[cid] || !passes(img, cid)) continue;
      for (const v of img.tags[cid]) out[v] = (out[v] || 0) + 1;
    }
    return out;
  }
  function cycle(cid, v) {
    const f = (S.filters[cid] = S.filters[cid] || {});
    if (f[v] === 1) f[v] = -1; else if (f[v] === -1) delete f[v]; else f[v] = 1;
    if (!Object.keys(f).length) delete S.filters[cid];
    apply();
  }
  const activeCount = () => Object.values(S.filters).reduce((a, f) => a + Object.keys(f).length, 0);

  /* ---------------------------------------------------------------- side panel */
  function renderSide() {
    const box = $("#tags-side");
    if (!App.cfg) return;
    box.innerHTML = "";
    const dest = App.cfg.settings.destination;
    const untagged = S.images.filter((i) => !has(i)).length;
    const rel = S.path ? relTo(dest, S.path) : null;
    fill(box,
      h("div", { class: "side-head" }, h("h3", {}, "Carpeta")),
      h("div", { class: "loc active", title: "Cambiar carpeta", onclick: (e) => pickScope(e.currentTarget) },
        h("b", {}, rel === null ? baseName(S.path || "") : rel === "" ? "Clasificadas (todas)" : rel), h("small", {}, S.path || "")),
      h("label", { class: "check", style: { margin: "2px 0 6px" } }, h("input", { type: "checkbox", checked: S.recursive, onchange: (e) => {
        S.recursive = e.target.checked;
        try { localStorage.setItem("clf.tagsRec", S.recursive ? "1" : "0"); } catch { /* ignore */ }
        load();
      } }), "Incluir subcarpetas"),
      S.truncated ? h("p", { class: "hint" }, "Hay demasiadas imágenes: elige una carpeta más concreta para verlas todas.") : null,
      h("div", { class: "side-head" }, h("h3", {}, "Etiquetar con IA"),
        h("button", { class: "btn small", title: "Qué categorías mira la IA y qué etiquetas sugiere", onclick: editCategories }, "Categorías…")),
      jobBox(untagged),
      h("div", { class: "side-head" }, h("h3", {}, "Filtrar"),
        activeCount() ? h("button", { class: "btn small", onclick: () => { S.filters = {}; apply(); } }, "Quitar filtros") : null),
      h("div", { class: "seg", style: { marginBottom: "6px" } }, [["all", "Todas"], ["tagged", "Con etiquetas"], ["untagged", "Sin etiquetas"]]
        .map(([k, l]) => h("button", { class: S.status === k ? "active" : "", onclick: () => { S.status = k; apply(); } }, l))),
      h("p", { class: "hint" }, "Clic en una etiqueta: solo las que la tienen · otro clic: excluirlas · otro: quitar. Clic derecho: renombrar o unir."),
      facets());
  }
  function facets() {
    const box = h("div", {});
    if (!S.images.some(has)) { box.append(h("p", { class: "hint" }, "Todavía no hay imágenes con etiquetas en esta carpeta.")); return box; }
    for (const c of cats()) {
      const counts = facetCounts(c.id);
      const f = S.filters[c.id] || {};
      const vals = Object.keys({ ...counts, ...f }).sort((a, b) => (counts[b] || 0) - (counts[a] || 0) || a.localeCompare(b));
      if (!vals.length) continue;
      const open = S.more[c.id];
      const shown = open ? vals : vals.slice(0, 14);
      for (const v of Object.keys(f)) if (!shown.includes(v)) shown.push(v);
      box.append(h("div", { class: "facet" },
        h("div", { class: "facet-head" }, h("b", {}, c.name),
          Object.keys(f).length ? h("button", { class: "link", onclick: () => { delete S.filters[c.id]; apply(); } }, "quitar") : null),
        h("div", { class: "facet-vals" }, shown.map((v) => h("button", {
          class: "fchip" + (f[v] === 1 ? " on" : f[v] === -1 ? " not" : ""),
          title: f[v] === 1 ? "Solo las que la tienen (clic: excluir)" : f[v] === -1 ? "Excluidas (clic: quitar filtro)" : "Clic: solo las que la tienen",
          onclick: () => cycle(c.id, v), oncontextmenu: (e) => { e.preventDefault(); valueMenu(e, c, v); } },
          f[v] === -1 ? "sin " + v : v, h("small", {}, counts[v] || 0)))),
        vals.length > 14 ? h("button", { class: "link", onclick: () => { S.more[c.id] = !open; renderSide(); } },
          open ? "ver menos" : `ver ${vals.length - 14} más`) : null));
    }
    return box;
  }
  function jobBox(untagged) {
    const j = S.job, box = h("div", { class: "card-lite" });
    const running = !!j?.running;
    if (S.threads === null) S.threads = App.cfg.settings.threads || 4;
    if (j?.id) {
      const st = j.status || {};
      const done = j.total - (st.queued || 0) - (st.working || 0);
      fill(box, h("div", { class: "row" }, h("b", { class: "grow" }, running ? "Etiquetando…" : "Último etiquetado"),
        h("span", { class: "muted" }, `${done}/${j.total}`)),
      h("div", { class: "progress" }, h("i", { style: { width: (100 * done / Math.max(1, j.total)) + "%", background: "var(--ai)" } })),
      h("div", { class: "muted", style: { fontSize: "12px" } }, `${st.done || 0} etiquetadas${st.error ? ` · ${st.error} con error` : ""}${st.stopped ? ` · ${st.stopped} detenidas` : ""}`),
      h("div", { class: "btn-row", style: { margin: "6px 0 4px" } },
        running ? h("button", { class: "btn small danger", onclick: () => POST("/api/tags/job/stop").then(() => poll(true)).catch(fail) }, "Detener") : null,
        !running && (st.error || st.stopped) ? h("button", { class: "btn small", onclick: () => POST("/api/tags/job/retry").then(() => poll(true)).catch(fail) }, "Reintentar errores") : null,
        st.error ? h("button", { class: "btn small", onclick: showErrors }, "Ver errores") : null));
    }
    fill(box,
      h("p", { class: "hint", style: { margin: "6px 0" } }, `${untagged} de ${S.images.length} imágenes de esta carpeta sin etiquetas.`),
      h("div", { class: "btn-row" },
        h("button", { class: "btn small ai primary", disabled: running || !untagged,
          onclick: () => start(S.images.filter((i) => !has(i)).map((i) => i.path), `${untagged} sin etiquetas`) },
        h("span", { class: "i-spark" }), `Etiquetar ${untagged} sin etiquetas`),
        h("button", { class: "btn small ai", disabled: running || !S.images.length, title: "Vuelve a etiquetar todas las imágenes de la carpeta y reemplaza sus etiquetas",
          onclick: () => start(S.images.map((i) => i.path), `${S.images.length} (todas)`) }, "Rehacer todas")),
      h("div", { class: "row", style: { marginTop: "6px" } }, h("span", { class: "muted" }, "IAs a la vez"),
        h("input", { type: "number", min: 1, max: 16, value: S.threads, style: { width: "58px", flex: "none" }, onchange: (e) => (S.threads = Math.max(1, Math.min(16, +e.target.value || 4))) }),
        h("span", { class: "grow" }),
        h("button", { class: "btn small", title: "Lo que recibe la IA con cada imagen", onclick: showPrompt }, "Ver prompt")));
    return box;
  }
  function valueMenu(e, c, v) {
    contextMenu(e.clientX, e.clientY, [
      { label: `Renombrar o unir «${v}» con otra…`, fn: async () => {
        const nv = await promptBox(`Renombrar «${v}» (${c.name})`, "Nuevo nombre. Si ya existe, las dos se unen. Afecta a todas las imágenes.", v);
        if (!nv || cleanTag(nv) === v) return;
        const r = await POST("/api/tags/rename", { category: c.id, old: v, new: nv }).catch(fail);
        if (r) { toast(`${r.changed} imagen(es) actualizadas`, "ok"); renameLocal(c.id, v, cleanTag(nv)); }
      } },
      { label: `Quitar «${v}» de todas las imágenes…`, fn: async () => {
        if (!(await confirmBox("Quitar etiqueta", `Se quitará «${v}» (${c.name}) de todas las imágenes que la tienen, también las de otras carpetas.`, "Quitar", true))) return;
        const r = await POST("/api/tags/rename", { category: c.id, old: v, new: "" }).catch(fail);
        if (r) { toast(`Quitada de ${r.changed} imagen(es)`, "ok"); renameLocal(c.id, v, ""); }
      } },
    ]);
  }
  function renameLocal(cid, old, nv) {
    for (const img of S.images) {
      const vals = img.tags?.[cid];
      if (!vals?.includes(old)) continue;
      img.tags[cid] = [...new Set(vals.map((x) => (x === old ? nv : x)).filter(Boolean))];
      if (!img.tags[cid].length) delete img.tags[cid];
    }
    const f = S.filters[cid];
    if (f && f[old] !== undefined) { const m = f[old]; delete f[old]; if (nv) f[nv] = m; if (!Object.keys(f).length) delete S.filters[cid]; }
    apply({ keep: true });
  }
  async function pickScope(anchor) {
    const s = App.cfg.settings;
    const items = [
      { label: "Clasificadas (todas)", hint: s.destination, fn: () => load(s.destination) },
      { label: "Sin clasificar (origen)", hint: s.source, fn: () => load(s.source) },
    ];
    if (Images.path) items.push({ label: "La carpeta abierta en Imágenes", hint: Images.path, fn: () => load(Images.path) });
    items.push("-", { label: "Otra carpeta de Clasificadas…", cls: "plain", fn: async () => { const p = await pickFolder({ title: "Ver etiquetas de…", allowCreate: false }); if (p) load(p); } },
      { label: "Elegir en el disco…", cls: "plain", fn: async () => { const r = await POST("/api/fs/pick", { initial: S.path || "" }).catch(fail); if (r?.path) load(r.path); } });
    popMenu(anchor, items, { filter: false });
  }

  /* ---------------------------------------------------------------- AI runs */
  async function start(files, label) {
    if (!files.length) return false;
    if (files.length > 40 && !(await confirmBox("Etiquetar con IA", `La IA mirará ${files.length} imágenes, una llamada por imagen. Puedes detenerlo cuando quieras.`, "Empezar"))) return false;
    try {
      await Main.flush();
      S.job = await POST("/api/tags/job", { files, threads: S.threads || App.cfg.settings.threads, label });
      toast(`Etiquetando ${files.length} imagen(es)…`);
      poll(true);
      renderSide();
      return true;
    } catch (e) { fail(e); return false; }
  }
  async function startFiles(files) {
    if (await start(files, `${files.length} seleccionadas`)) toast("Las etiquetas aparecen en la pestaña Etiquetas", "", { label: "Ver", fn: () => Main.showTab("tags") });
  }
  async function poll(force = false) {
    clearTimeout(timer);
    try {
      const v = await GET(`/api/tags/job${!force && S.job?.version !== undefined && S.job?.items ? `?v=${S.job.version}` : ""}`);
      if (!v.unchanged) {
        const merged = merge(v);
        S.job = v;
        pill();
        if (App.tab === "tags") { if (merged) apply({ keep: true }); else renderSide(); }
        else if (merged) S.list = S.images.filter((i) => passes(i));
        if (!v.running && merged) GET("/api/tags/vocab").then((r) => { S.vocab = r.vocab; }).catch(() => {});
      }
    } catch { /* server restarting */ }
    if (S.job?.running) timer = setTimeout(poll, 1500);
  }
  function merge(v) {
    if (!v.items) return false;
    const byPath = new Map(S.images.map((i) => [i.path.toLowerCase(), i]));
    let changed = false;
    for (const it of v.items) {
      if (it.status !== "done") continue;
      const img = byPath.get(it.file.toLowerCase());
      if (img && JSON.stringify(img.tags) !== JSON.stringify(it.tags)) { img.tags = it.tags; img.by = "ia"; changed = true; }
    }
    return changed;
  }
  function pill() {
    const p = $("#tags-pill");
    const left = S.job?.running ? (S.job.status.queued || 0) + (S.job.status.working || 0) : 0;
    p.hidden = !left; p.textContent = left;
    p.title = left ? `${left} imágenes por etiquetar` : "";
  }
  function showErrors() {
    const errs = (S.job?.items || []).filter((i) => i.status === "error");
    modal({ title: `Errores del etiquetado (${errs.length})`, wide: true,
      body: h("div", {}, errs.map((i) => h("div", { class: "hist-row" }, h("span", { class: "when", title: i.file }, i.name), h("span", { class: "selectable" }, i.error)))) });
  }
  async function showPrompt() {
    await Main.flush();
    const r = await GET("/api/tags/prompt").catch(fail);
    if (r) modal({ title: "Prompt que recibe la IA con cada imagen al etiquetar", wide: true,
      body: h("div", {}, h("p", { class: "hint" }, "Se genera con las categorías, sus descripciones y las etiquetas ya usadas (para que reutilice las mismas palabras)."), h("pre", {}, r.prompt)) });
  }

  /* ---------------------------------------------------------------- categories editor */
  function vocabList(cid) {
    return Object.entries(S.vocab[cid] || {}).map(([value, count]) => ({ value, count }));
  }
  async function editCategories() {
    const t = JSON.parse(JSON.stringify(App.cfg.tags || { instructions: "", categories: [] }));
    const list = h("div", {});
    const instr = h("textarea", { rows: 2, value: t.instructions });
    const draw = () => {
      list.innerHTML = "";
      t.categories.forEach((c, i) => list.append(h("div", { class: "cat-card" },
        h("div", { class: "row" },
          h("input", { value: c.name, placeholder: "Nombre (p. ej. piel)", style: { fontWeight: 600 }, oninput: (e) => (c.name = e.target.value) }),
          h("button", { class: "icon-btn", title: "Subir", html: icon("up"), disabled: !i, onclick: () => { t.categories.splice(i - 1, 0, t.categories.splice(i, 1)[0]); draw(); } }),
          h("button", { class: "icon-btn", title: "Quitar la categoría (las etiquetas ya puestas se guardan, pero no se muestran)", html: icon("trash"), onclick: () => { t.categories.splice(i, 1); draw(); } })),
        h("textarea", { rows: 2, value: c.description, placeholder: "Qué debe mirar la IA en esta categoría", oninput: (e) => (c.description = e.target.value) }),
        h("div", { class: "muted", style: { fontSize: "12px", margin: "6px 0 3px" } }, c.open ? "Etiquetas sugeridas (la IA las prefiere)" : "Etiquetas permitidas (la IA solo usa estas)"),
        chipInput({ values: c.values, placeholder: "Añadir…", suggestions: () => vocabList(c.id), onChange: (v) => (c.values = v.map(cleanTag).filter(Boolean)) }),
        h("div", { class: "row", style: { marginTop: "6px", gap: "16px", flexWrap: "wrap" } },
          h("label", { class: "check" }, h("input", { type: "checkbox", checked: c.open, onchange: (e) => { c.open = e.target.checked; draw(); } }), "La IA puede inventar etiquetas nuevas"),
          h("label", { class: "check" }, h("input", { type: "checkbox", checked: c.multi, onchange: (e) => (c.multi = e.target.checked) }), "Varias etiquetas por imagen")))));
    };
    draw();
    const body = h("div", {},
      h("p", { class: "hint", style: { marginTop: 0 } }, "Cada categoría es algo que la IA mira en la imagen (color de piel, ropa, acción…). Escribe qué debe mirar y algunas etiquetas de ejemplo: la IA reutiliza las ya usadas para que el vocabulario no se disperse."),
      list,
      h("button", { class: "btn small", onclick: () => { t.categories.push({ id: uid(), name: "", description: "", values: [], multi: true, open: true }); draw(); } }, "+ Nueva categoría"),
      h("label", { class: "field", style: { marginTop: "12px" } }, "Instrucciones generales para la IA", instr));
    const ok = await modal({ title: "Categorías de etiquetas", wide: true, body,
      buttons: [{ label: "Cancelar", value: false }, { label: "Guardar", value: true, primary: true, cls: "primary" }] });
    if (!ok) return;
    t.instructions = instr.value;
    t.categories = t.categories.filter((c) => c.name.trim());
    App.cfg.tags = t;
    Main.changed({ soft: true });
    apply({ keep: true });
  }

  /* ---------------------------------------------------------------- toolbar and grid */
  function initBar() {
    const bar = $("#tags-bar");
    const q = h("input", { id: "tags-q", placeholder: "Buscar etiqueta o nombre…", autocomplete: "off",
      oninput: debounce((e) => { S.q = e.target.value; apply(); }, 150),
      onkeydown: (e) => { e.stopPropagation(); if (e.key === "Escape") { e.target.value = ""; S.q = ""; apply(); e.target.blur(); } } });
    const sort = h("select", { onchange: (e) => { S.sort = e.target.value; apply(); } },
      h("option", { value: "name" }, "Por carpeta y nombre"), h("option", { value: "mtime" }, "Más recientes"), h("option", { value: "few" }, "Menos etiquetas primero"));
    const size = h("input", { type: "range", min: 90, max: 420, value: S.size, title: "Tamaño de miniaturas", oninput: (e) => {
      S.size = +e.target.value; $("#tags-grid").style.setProperty("--thumb", S.size + "px");
      try { localStorage.setItem("clf.tagsThumb", S.size); } catch { /* ignore */ }
    } });
    fill(bar, q, h("div", { class: "active-filters", id: "tags-active" }), h("div", { class: "grow" }), h("span", { class: "muted", id: "tags-count" }), sort, size,
      h("button", { class: "icon-btn", title: "Volver a leer la carpeta", html: icon("refresh"), onclick: () => load() }));
  }
  function renderBar() {
    const act = $("#tags-active");
    act.innerHTML = "";
    for (const [cid, f] of Object.entries(S.filters)) {
      const c = cats().find((x) => x.id === cid);
      for (const [v, m] of Object.entries(f)) act.append(h("button", { class: "fchip " + (m === 1 ? "on" : "not"), title: "Quitar filtro",
        onclick: () => { delete f[v]; if (!Object.keys(f).length) delete S.filters[cid]; apply(); } }, `${c ? c.name + ": " : ""}${m === -1 ? "sin " : ""}${v} ×`));
    }
    $("#tags-count").textContent = S.loaded ? `${S.list.length} de ${S.images.length} imágenes` : "Cargando…";
  }
  function renderGrid(keep = false) {
    const body = $("#tags-body"), grid = $("#tags-grid");
    const top = body.scrollTop, before = S.shown;
    grid.innerHTML = "";
    grid.style.setProperty("--thumb", S.size + "px");
    S.shown = 0;
    more(keep ? before : 0);
    body.scrollTop = keep ? top : 0;
    const empty = $("#tags-empty");
    empty.hidden = S.loaded && !!S.list.length;
    empty.textContent = !S.loaded ? "Cargando…" : S.images.length ? "Ninguna imagen coincide con los filtros." : "No hay imágenes en esta carpeta.";
  }
  function more(min = 0) {
    const end = Math.min(S.list.length, Math.max(S.shown + CHUNK, min));
    const frag = document.createDocumentFragment();
    const ts = S.size > 260 ? 640 : 320;
    for (let i = S.shown; i < end; i++) {
      const it = S.list[i], n = tagCount(it.tags);
      frag.append(h("div", { class: "tile" + (S.sel.has(it.path) ? " sel" : "") + (i === S.focus ? " focus" : ""), "data-i": i,
        title: `${it.rel ? it.rel + "\\" : ""}${it.name}\n${tagsText(it.tags)}` },
        h("img", { loading: "lazy", src: thumbUrl(it.path, ts), alt: "" }), h("span", { class: "tick" }),
        n ? h("span", { class: "tag-n", title: `${n} etiquetas` }, n) : null,
        h("div", { class: "cap" }, n ? Object.values(it.tags).flat().slice(0, 10).join(" · ") : (it.rel ? it.rel + " / " : "") + it.name)));
    }
    $("#tags-grid").append(frag);
    S.shown = end;
  }
  function refreshTiles() {
    $$("#tags-grid .tile").forEach((t) => {
      const i = +t.dataset.i;
      t.classList.toggle("sel", S.sel.has(S.list[i]?.path));
      t.classList.toggle("focus", i === S.focus);
    });
  }
  const selected = () => S.list.filter((i) => S.sel.has(i.path));
  function openLightbox(i) {
    Lightbox.open(S.list.map((x) => ({ path: x.path, name: x.name, size: x.size, extra: tagsText(x.tags) })), i, {
      onIndex: (item) => { S.focus = S.list.findIndex((x) => x.path === item.path); S.sel = new Set([item.path]); refreshTiles(); renderInsp(true); },
    });
  }
  function openInImages(img) {
    Main.showTab("images");
    Images.open(img.path.replace(/[\\/][^\\/]*$/, ""));
  }

  /* ---------------------------------------------------------------- inspector */
  function renderInsp(force = false) {
    const el = $("#tags-insp");
    const active = el.contains(document.activeElement) && document.activeElement.matches("input, textarea") ? document.activeElement : null;
    if (active && !force) return;
    const refocus = active?.closest("[data-cat]")?.dataset.cat;
    el.innerHTML = "";
    if (!App.cfg) return;
    const sel = selected();
    if (!sel.length) return summary(el);
    if (sel.length === 1) single(el, sel[0]); else multi(el, sel);
    if (refocus) el.querySelector(`[data-cat="${CSS.escape(refocus)}"] input`)?.focus();
  }
  function summary(el) {
    const tagged = S.images.filter(has).length;
    const top = [];
    for (const c of cats()) {
      const cnt = facetCounts(c.id);
      const best = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v]) => v);
      if (best.length) top.push(h("div", { class: "stat-row" }, h("span", { class: "muted" }, c.name), h("span", {}, best.join(", "))));
    }
    fill(el,
      h("p", { class: "hint", style: { marginTop: 0 } }, "Selecciona una imagen para ver y editar sus etiquetas (Ctrl o Mayús para varias). Doble clic: verla en grande."),
      h("div", { class: "stat-row" }, h("span", {}, "Imágenes en la carpeta"), h("b", {}, S.images.length)),
      h("div", { class: "stat-row" }, h("span", {}, "Con etiquetas"), h("b", {}, tagged)),
      h("div", { class: "stat-row" }, h("span", {}, "Mostradas con los filtros"), h("b", {}, S.list.length)),
      top.length ? h("div", { class: "insp-section" }, h("h3", { style: { marginBottom: "6px" } }, "Lo más frecuente aquí"), top) : null);
  }
  async function save(imgs, ops) {
    try {
      const r = await POST("/api/tags/edit", { paths: imgs.map((i) => i.path), ...ops });
      const m = new Map(r.items.map((x) => [x.path, x]));
      for (const img of imgs) {
        const x = m.get(img.path);
        if (x && !x.error) { img.tags = Object.keys(x.tags).length ? x.tags : null; img.by = "manual"; }
      }
      const bad = r.items.filter((x) => x.error);
      if (bad.length) toast(`${bad.length} sin guardar: ${bad[0].error}`, "error");
      for (const [cid, vals] of Object.entries({ ...(ops.add || {}), ...(ops.set || {}) })) {
        const d = (S.vocab[cid] = S.vocab[cid] || {});
        vals.map(cleanTag).filter(Boolean).forEach((v) => (d[v] = (d[v] || 0) + 1));
      }
      apply({ keep: true });
      renderInsp(true);
    } catch (e) { fail(e); }
  }
  function suggestions(c) {
    const out = new Map(vocabList(c.id).map((s) => [s.value, s]));
    c.values.forEach((v) => { if (!out.has(v)) out.set(v, { value: v, count: 0 }); });
    return [...out.values()];
  }
  function single(el, img) {
    const idx = S.list.indexOf(img);
    fill(el,
      h("img", { class: "insp-thumb", src: thumbUrl(img.path, 640), title: "Ver en grande", onclick: () => openLightbox(idx) }),
      h("div", { class: "insp-name selectable" }, img.name),
      h("div", { class: "insp-path" }, relTo(App.cfg.settings.destination, img.path.replace(/[\\/][^\\/]*$/, "")) ?? img.path),
      h("div", { class: "muted", style: { fontSize: "12px", margin: "-4px 0 10px" } },
        !has(img) ? "Sin etiquetas todavía" : img.by === "ia" ? "Etiquetas puestas por la IA" : "Etiquetas editadas a mano"),
      cats().map((c) => h("div", { class: "field", "data-cat": c.id }, c.name,
        chipInput({ values: img.tags?.[c.id] || [], placeholder: "Añadir…", suggestions: () => suggestions(c),
          onChange: (vals) => save([img], { set: { [c.id]: vals } }) }))),
      actions([img]));
  }
  function multi(el, imgs) {
    fill(el,
      h("p", { style: { margin: "0 0 6px" } }, h("b", {}, `${imgs.length} imágenes seleccionadas`)),
      h("div", { class: "imp-strip mini" }, imgs.slice(0, 12).map((i) => h("img", { src: thumbUrl(i.path, 120), loading: "lazy", title: i.name }))),
      h("p", { class: "hint" }, "Las etiquetas llenas están en todas; las punteadas solo en algunas (clic para ponerlas en todas). Lo que escribas se añade a todas."));
    for (const c of cats()) {
      const cnt = {};
      imgs.forEach((i) => (i.tags?.[c.id] || []).forEach((v) => (cnt[v] = (cnt[v] || 0) + 1)));
      const dl = h("datalist", { id: `tags-dl-${c.id}` }, suggestions(c).map((s) => h("option", { value: s.value })));
      const input = h("input", { placeholder: "Añadir a todas…", list: dl.id, onkeydown: (e) => {
        e.stopPropagation();
        if (e.key === "Enter" && e.target.value.trim()) { e.preventDefault(); save(imgs, { add: { [c.id]: [e.target.value] } }); }
      } });
      const chips = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([v, n]) => {
        const remove = h("button", { title: "Quitar de todas", onclick: (e) => { e.stopPropagation(); save(imgs, { remove: { [c.id]: [v] } }); } }, "×");
        return n === imgs.length ? h("span", { class: "chip" }, v, remove)
          : h("span", { class: "chip partial", title: `En ${n} de ${imgs.length}. Clic para ponerla en todas`, onclick: () => save(imgs, { add: { [c.id]: [v] } }) }, `${v} · ${n}`, remove);
      });
      el.append(h("div", { class: "field", "data-cat": c.id }, c.name, h("div", { class: "chips" }, chips, input), dl));
    }
    el.append(actions(imgs));
  }
  function actions(imgs) {
    return h("div", { class: "btn-row insp-section" },
      h("button", { class: "btn small ai", disabled: !!S.job?.running, onclick: () => start(imgs.map((i) => i.path), `${imgs.length} seleccionadas`) },
        h("span", { class: "i-spark" }), imgs.length === 1 ? "Etiquetar con IA" : `Etiquetar ${imgs.length} con IA`),
      imgs.some(has) ? h("button", { class: "btn small danger", onclick: async () => {
        if (imgs.length > 1 && !(await confirmBox("Borrar etiquetas", `Se quitan todas las etiquetas de ${imgs.length} imágenes.`, "Borrar", true))) return;
        save(imgs, { clear: true });
      } }, "Borrar etiquetas") : null,
      imgs.length === 1 ? h("button", { class: "btn small", onclick: () => openInImages(imgs[0]) }, "Abrir su carpeta") : null);
  }

  /* ---------------------------------------------------------------- events */
  function init() {
    initBar();
    const grid = $("#tags-grid");
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
      refreshTiles(); renderInsp(true);
    });
    grid.addEventListener("dblclick", (e) => { const t = e.target.closest(".tile"); if (t) openLightbox(+t.dataset.i); });
    grid.addEventListener("contextmenu", (e) => {
      const t = e.target.closest(".tile");
      if (!t) return;
      e.preventDefault();
      const it = S.list[+t.dataset.i];
      if (!S.sel.has(it.path)) { S.sel = new Set([it.path]); refreshTiles(); renderInsp(true); }
      const imgs = selected();
      contextMenu(e.clientX, e.clientY, [
        { label: "Ver  (Enter)", fn: () => openLightbox(+t.dataset.i) },
        { label: `✨ Etiquetar ${imgs.length} con IA`, fn: () => start(imgs.map((i) => i.path), `${imgs.length} seleccionadas`) },
        { label: "Abrir su carpeta en Imágenes", fn: () => openInImages(it) },
        { label: "Mostrar en el Explorador", fn: () => POST("/api/fs/reveal", { path: it.path }).catch(fail) },
        "-",
        { label: `Borrar etiquetas de ${imgs.length}`, fn: () => save(imgs, { clear: true }) },
      ]);
    });
    new IntersectionObserver((ents) => { if (ents[0].isIntersecting && S.shown < S.list.length) more(); },
      { root: $("#tags-body"), rootMargin: "800px" }).observe($("#tags-sentinel"));
    poll(true);
  }
  function show() {
    if (!S.started) { S.started = true; load(); } else if (S.loaded) apply({ keep: true });
    poll(true);
  }
  function onKey(e) {
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && k.toLowerCase() === "a") { S.sel = new Set(S.list.map((i) => i.path)); refreshTiles(); renderInsp(true); }
    else if (k === "Escape" && S.sel.size) { S.sel.clear(); refreshTiles(); renderInsp(true); }
    else if ((k === "Enter" || k === " ") && S.list.length) openLightbox(Math.max(0, S.focus));
    else return false;
    return true;
  }

  return { init, show, onKey, startFiles };
})();
