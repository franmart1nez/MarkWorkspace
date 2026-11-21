/* Gaps tab: image counts per final folder against the average of equivalent folders (no AI), and web
   searches that bring new images for the emptiest ones, checked by the classifier before they are added. */
"use strict";

const Gaps = (() => {
  const S = { node: "root", data: null, stale: true, view: "leaves", show: 1, group: "", sel: new Set(), limit: 400,
    runs: [], sources: {}, run: null, runId: null, pick: {} };
  let timer = null;
  try {
    S.node = localStorage.getItem("clf.gapsNode") || "root";
    S.show = +(localStorage.getItem("clf.gapsShow") ?? 1);
    S.view = localStorage.getItem("clf.gapsView") || "leaves";
  } catch { /* ignore */ }
  const remember = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
  const pct = (r) => (r === null || r === undefined ? "—" : Math.round(r * 100) + " %");

  /* ---------------------------------------------------------------- data */
  async function load() {
    if (!Tree.find(S.node)) S.node = "root";
    S.loading = true; renderSide();
    try {
      await Main.flush();
      S.data = await GET(`/api/gaps?node=${encodeURIComponent(S.node)}`);
      S.stale = false;
      const valid = new Set(S.data.leaves.filter((l) => !l.adult).map((l) => l.rel));
      for (const r of [...S.sel]) if (!valid.has(r)) S.sel.delete(r);
    } catch (e) { fail(e); }
    S.loading = false;
    renderSide(); renderMain();
  }
  function visible() {
    if (!S.data) return [];
    let rows = S.data.leaves.filter((l) => S.show === 0 || (l.ratio !== null && l.ratio < S.show));
    if (S.group === "__web") rows = rows.filter((l) => !l.adult);
    else if (S.group) rows = rows.filter((l) => l.group === S.group);
    return rows.sort((a, b) => (a.ratio ?? 9) - (b.ratio ?? 9) || b.missing - a.missing || a.rel.localeCompare(b.rel));
  }
  function shortRel(rel) {
    const base = S.data?.basePath ? S.data.basePath.split("/").length : 0;
    return String(rel).split("/").slice(base).join(" / ") || rel;
  }

  /* ---------------------------------------------------------------- side panel */
  function renderSide() {
    const box = $("#gaps-side");
    if (!App.cfg) return;
    box.innerHTML = "";
    const nodes = [...Tree.walk()].filter((w) => w.n.children.length);
    const pick = h("select", { onchange: (e) => { S.node = e.target.value; remember("clf.gapsNode", S.node); S.sel.clear(); load(); } },
      nodes.map((w) => h("option", { value: w.n.id, selected: w.n.id === S.node },
        w.n.id === "root" ? "Todo el árbol" : "   ".repeat(w.path.length - 1) + Tree.seg(w.n))));
    const d = S.data;
    const below = d ? d.leaves.filter((l) => l.ratio !== null && l.ratio < 1).length : 0;
    const stat = (n, label) => h("div", { class: "gstat" }, h("b", {}, n), h("span", {}, label));
    fill(box,
      h("div", { class: "side-head" }, h("h3", {}, "Analizar"),
        h("button", { class: "icon-btn" + (S.loading ? " busy" : ""), title: "Volver a contar", html: icon("refresh"), onclick: load })),
      h("label", { class: "field" }, "Rama del árbol", pick),
      h("p", { class: "hint" }, "Cuenta en disco, sin IA, las imágenes de cada carpeta final y la compara con el promedio de sus carpetas equivalentes: la misma carpeta en las otras especies (u otros valores de la variable) o, si no hay variable, sus hermanas."),
      d ? h("div", { class: "gaps-stats" }, stat(d.total, "imágenes"), stat(d.leaves.length, "carpetas finales"), stat(below, "bajo el promedio")) : null,
      d && d.total > d.inLeaves ? h("p", { class: "hint" }, `${d.total - d.inLeaves} imagen(es) están sueltas en carpetas intermedias y no cuentan.`) : null,
      h("div", { class: "side-head" }, h("h3", {}, "Buscar en internet")),
      h("p", { class: "hint" }, "Marca carpetas en la lista: la IA escribe búsquedas con el estilo de cada una (realista o no realista, especie, sexo…), descarga candidatas de fuentes aptas para todo público y la IA clasificadora revisa cada imagen antes de añadirla. Las carpetas de contenido para adultos no se buscan."),
      h("button", { class: "btn ai primary big", disabled: !S.sel.size, onclick: openSearch }, h("span", { class: "i-spark" }),
        S.sel.size ? `Buscar imágenes para ${S.sel.size} carpeta${S.sel.size === 1 ? "" : "s"}` : "Marca carpetas en la lista"),
      S.sel.size ? h("button", { class: "btn small", style: { marginTop: "6px" }, onclick: () => { S.sel.clear(); renderSide(); renderMain(); } }, "Quitar marcas") : null,
      h("div", { class: "side-head" }, h("h3", {}, "Búsquedas")),
      h("div", { id: "gaps-runs" }));
    fillRuns();
  }
  function fillRuns() {
    const box = $("#gaps-runs");
    if (!box) return;
    box.innerHTML = "";
    if (!S.runs.length) box.append(h("p", { class: "hint" }, "Todavía no hay búsquedas."));
    for (const r of S.runs) {
      const c = r.counts || {};
      const review = (c.match || 0) + (c.other || 0) + (c.stopped || 0);
      box.append(h("div", { class: "job" + (r.id === S.runId ? " active" : ""), onclick: () => selectRun(r.id) },
        h("div", { class: "row" }, h("b", { class: "grow" }, r.label), h("span", { class: "muted" }, fmtDate(r.created))),
        h("div", { class: "muted" }, `${r.added}/${r.want} añadidas${review ? ` · ${review} por revisar` : ""}${c.checking ? ` · ${c.checking} revisando` : ""}${r.running ? " · en curso" : ""}`),
        r.running ? h("div", { class: "bar" }, h("i", { style: { width: Math.min(100, 100 * (r.added + review) / Math.max(1, r.want)) + "%", background: "var(--ai)" } })) : null));
    }
  }

  /* ---------------------------------------------------------------- main area */
  function setView(v) {
    S.view = v; remember("clf.gapsView", v);
    if (v !== "web" && (S.stale || !S.data)) load(); else renderMain();
  }
  function renderMain() {
    const box = $("#gaps-main");
    if (!App.cfg) return;
    if (box.contains(document.activeElement) && document.activeElement.matches("input[type=number], input[type=text]")) return;
    const body0 = $(".gaps-body", box);
    const scroll = body0 && body0.dataset.view === S.view ? body0.scrollTop : 0;
    box.innerHTML = "";
    const review = S.runs.reduce((a, r) => a + (r.counts?.match || 0) + (r.counts?.other || 0), 0);
    const head = h("div", { class: "gaps-head" },
      h("div", { class: "seg" }, [["leaves", "Carpetas con menos imágenes"], ["levels", "Por nivel"], ["web", `Búsqueda web${review ? ` (${review})` : ""}`]]
        .map(([k, l]) => h("button", { class: S.view === k ? "active" : "", onclick: () => setView(k) }, l))));
    const body = h("div", { class: "gaps-body", "data-view": S.view });
    if (S.view === "web") webView(head, body);
    else if (!S.data) body.append(h("div", { class: "empty" }, S.loading ? "Contando…" : "Elige una rama para contar sus imágenes."));
    else if (S.view === "levels") levelsView(body);
    else leavesView(head, body);
    box.append(head, body);
    body.scrollTop = scroll;
  }

  /* ---- leaves */
  function leavesView(head, body) {
    const groups = App.cfg.groups;
    fill(head, h("span", { class: "grow" }),
      h("select", { title: "Qué carpetas enseñar", onchange: (e) => { S.show = +e.target.value; remember("clf.gapsShow", S.show); renderMain(); } },
        [[1, "Por debajo del promedio"], [0.5, "Menos de la mitad del promedio"], [0.25, "Menos de un cuarto del promedio"], [0, "Todas las carpetas finales"]]
          .map(([v, l]) => h("option", { value: v, selected: S.show === v }, l))),
      h("select", { title: "Filtrar por grupo", onchange: (e) => { S.group = e.target.value; renderMain(); } },
        h("option", { value: "" }, "Todos los grupos"),
        h("option", { value: "__web", selected: S.group === "__web" }, "Solo las que se pueden buscar"),
        groups.map((g) => h("option", { value: g.id, selected: S.group === g.id }, "● " + g.name))));
    const rows = visible();
    if (!rows.length) {
      body.append(h("div", { class: "empty" }, S.data.leaves.length ? "Ninguna carpeta cumple este filtro. ✔" : "Esta rama no tiene carpetas finales."));
      return;
    }
    const eligible = rows.filter((l) => !l.adult);
    const all = h("input", { type: "checkbox", title: "Marcar todas las que se pueden buscar", checked: eligible.length && eligible.every((l) => S.sel.has(l.rel)),
      onchange: (e) => { eligible.forEach((l) => (e.target.checked ? S.sel.add(l.rel) : S.sel.delete(l.rel))); renderSide(); renderMain(); } });
    const table = h("div", { class: "gap-table" },
      h("div", { class: "gap-row head" }, all, h("span", {}, "Carpeta"), h("span", { class: "num" }, "Imágenes"),
        h("span", { class: "num", title: "Promedio de sus carpetas equivalentes" }, "Promedio"), h("span", {}, "Respecto al promedio"),
        h("span", { class: "num", title: "Imágenes que faltan para llegar al promedio" }, "Faltan")),
      rows.slice(0, S.limit).map(leafRow));
    body.append(table);
    if (rows.length > S.limit) body.append(h("div", { class: "empty" }, h("button", { class: "btn small", onclick: () => { S.limit += 400; renderMain(); } }, `Mostrar más (${rows.length - S.limit})`)));
  }
  function leafRow(l) {
    const g = App.cfg.groups.find((x) => x.id === l.group);
    const base = S.data.basePath ? S.data.basePath.split("/").length : 0;
    const path = [];
    l.parts.forEach((p, i) => {
      if (i < base) return;
      if (path.length) path.push(h("span", { class: "slash" }, "/"));
      path.push(h("span", { class: l.vars.includes(i) ? "var" : "" }, p));
    });
    const peers = l.basis === "values" ? `${l.peers} carpetas equivalentes (otros valores de la variable)` : `${l.peers} carpetas hermanas`;
    const cb = h("input", { type: "checkbox", checked: S.sel.has(l.rel), disabled: l.adult,
      title: l.adult ? "Contenido para adultos: no se busca en internet" : "Marcar para buscar imágenes",
      onchange: (e) => { e.target.checked ? S.sel.add(l.rel) : S.sel.delete(l.rel); renderSide(); } });
    return h("div", { class: "gap-row" + (l.adult ? " adult" : "") },
      cb,
      h("button", { class: "gap-path", title: `${l.rel}\n${l.exists ? "Clic: ver sus imágenes" : "Todavía no existe en disco"}`, onclick: () => openFolder(l) },
        g ? h("span", { class: "gdot", style: { background: g.color }, title: g.name }) : null, path),
      h("span", { class: "num" }, l.count),
      h("span", { class: "num muted", title: l.mean === null ? "Sin carpetas con las que comparar" : `Promedio de ${peers}` }, l.mean ?? "—"),
      meter(l.ratio, `${l.count} imágenes · ${pct(l.ratio)} del promedio (${l.mean ?? "—"})`),
      h("span", { class: "num" + (l.missing ? " warn" : "") }, l.missing ? `+${l.missing}` : ""));
  }
  /* Bar on a 0–2× average scale: the tick in the middle is the average. */
  function meter(ratio, title) {
    if (ratio === null || ratio === undefined) return h("span", { class: "muted" }, "—");
    const low = ratio < 1;
    return h("div", { class: "meter", title },
      h("div", { class: "track" }, h("i", { class: low ? "low" : "", style: { width: (Math.min(ratio, 2) / 2 * 100) + "%" } }), h("b", {})),
      h("span", { class: "mval" + (low ? " low" : "") }, (low ? "↓ " : "") + pct(ratio)));
  }
  function openFolder(l) {
    if (!l.exists) return toast("Esta carpeta todavía no existe en disco: no tiene imágenes");
    Main.showTab("images");
    Images.open(joinPath(App.cfg.settings.destination, l.parts.join("\\")));
  }

  /* ---- levels */
  function levelsView(body) {
    const d = S.data;
    const grid = h("div", { class: "level-grid" });
    if (d.groups.length > 1) {
      grid.append(levelCard("Por grupo", "suma de las carpetas de cada grupo en la rama",
        d.groups.map((g) => ({ name: g.name, total: g.total, color: g.color })).sort((a, b) => b.total - a.total)));
    }
    for (const lv of d.levels) {
      const rel = shortRel(lv.path);
      const title = lv.variable ? `{${lv.variable}} en ${lv.path ? rel : "Clasificadas"}` : (lv.path ? rel : "Clasificadas");
      const multi = /\{[^}]+\}/.test(lv.path);
      grid.append(levelCard(title, lv.variable ? `${lv.options.length} valores` + (multi ? " · suma de todas las ramas" : "")
        : multi ? "suma de todos los valores de la variable" : "carpetas hermanas", lv.options));
    }
    if (!grid.children.length) grid.append(h("div", { class: "empty" }, "No hay niveles con varias carpetas que comparar."));
    body.append(h("p", { class: "hint", style: { marginTop: 0 } }, "Total de imágenes de cada opción en cada nivel de la rama. La línea vertical es el promedio del nivel; las opciones por debajo llevan una flecha ↓."), grid);
  }
  function levelCard(title, sub, options) {
    const total = options.reduce((a, o) => a + o.total, 0);
    const mean = total / Math.max(1, options.length);
    const max = Math.max(1, ...options.map((o) => o.total));
    return h("div", { class: "level-card" },
      h("div", { class: "lc-head" }, h("b", { class: "mono" }, title), h("span", { class: "muted" }, `promedio ${Math.round(mean * 10) / 10}`)),
      h("div", { class: "muted lc-sub" }, sub),
      h("div", { class: "lc-rows" }, options.map((o) => {
        const low = o.total < mean;
        return h("div", { class: "lvl-row", title: `${o.name}: ${o.total} imágenes · ${pct(mean ? o.total / mean : null)} del promedio` },
          h("span", { class: "lname" }, o.color ? h("span", { class: "gdot", style: { background: o.color } }) : null, o.name),
          h("div", { class: "track" }, h("i", { class: low ? "low" : "", style: { width: (100 * o.total / max) + "%" } }), h("b", { style: { left: (100 * mean / max) + "%" } })),
          h("span", { class: "lval" + (low ? " low" : "") }, (low ? "↓ " : "") + o.total));
      })));
  }

  /* ---------------------------------------------------------------- web search */
  async function loadRuns() {
    try {
      const r = await GET("/api/web/runs");
      S.runs = r.runs; S.sources = r.sources;
      pill(); fillRuns();
    } catch { /* server restarting */ }
  }
  function pill() {
    const n = S.runs.reduce((a, r) => a + (r.counts?.match || 0) + (r.counts?.other || 0), 0);
    const p = $("#gaps-pill");
    const running = S.runs.some((r) => r.running);
    p.hidden = !n && !running;
    p.textContent = running && !n ? "…" : n;
    p.title = running ? "Búsqueda en internet en curso" : `${n} imágenes de internet por revisar`;
  }
  async function refreshRun(force = false) {
    if (!S.runId) return;
    try {
      const v = await GET(`/api/web/runs/${S.runId}${!force && S.run?.id === S.runId ? `?v=${S.run.version}` : ""}`);
      if (v.unchanged) return;
      if (S.run?.id === v.id && v.added !== S.run.added) { S.stale = true; Main.refreshStats(); folderCache.time = 0; }
      S.run = v;
      if (App.tab === "gaps" && S.view === "web") renderMain();
    } catch (e) {
      if (/no encontrada/i.test(e.message)) { S.runId = null; S.run = null; renderMain(); }
    }
  }
  function poll() {
    clearInterval(timer);
    timer = setInterval(async () => {
      await refreshRun();
      await loadRuns();
      if (!S.runs.some((r) => r.running)) { clearInterval(timer); timer = null; await refreshRun(true); }
    }, 1500);
  }
  async function useRun(id) {
    S.runId = id;
    await refreshRun(true);
    fillRuns();
    if (S.run?.running) poll();
  }
  async function selectRun(id) {
    S.view = "web"; remember("clf.gapsView", "web");
    await useRun(id);
    renderMain();
  }

  async function openSearch() {
    const rows = (S.data?.leaves || []).filter((l) => S.sel.has(l.rel) && !l.adult);
    if (!rows.length) return;
    if (!Object.keys(S.sources).length) await loadRuns();
    const wants = rows.map((l) => h("input", { type: "number", min: 1, max: 40, value: Math.max(1, Math.min(10, l.missing || 5)), style: { width: "60px", flex: "none" } }));
    const srcs = Object.entries(S.sources).map(([k, label]) => ({ k, label, cb: h("input", { type: "checkbox", checked: true }) }));
    let mode = "review";
    const thr = h("input", { type: "range", min: 50, max: 100, step: 5, value: 85 });
    const thrVal = h("b", {}, "85%");
    const thrWrap = h("label", { class: "field", style: { display: "none" } }, h("span", {}, "Confianza mínima para añadirla sola: ", thrVal), thr);
    thr.oninput = () => (thrVal.textContent = thr.value + "%");
    const cards = h("div", { class: "mode-cards" },
      [["review", "Revisar antes", "Descarga y revisa; tú eliges cuáles añadir."], ["auto", "Añadir solas las que encajen", "Añade las que la IA pondría justo en esa carpeta; el resto queda para revisar."]]
        .map(([k, t, d]) => h("button", { class: k === mode ? "active" : "", onclick: (e) => {
          mode = k; [...cards.children].forEach((b) => b.classList.toggle("active", b === e.currentTarget)); thrWrap.style.display = k === "auto" ? "" : "none";
        } }, h("b", {}, t), h("span", {}, d))));
    const threads = h("input", { type: "number", min: 1, max: 16, value: App.cfg.settings.threads || 4, style: { width: "60px", flex: "none" } });
    const estimate = h("span", { class: "muted" });
    const update = () => {
      const calls = wants.reduce((a, w) => a + Math.min(60, Math.ceil((+w.value || 1) * 1.5) + 2), 0) + rows.length;
      estimate.textContent = `Hasta unas ${calls} llamadas a la IA: una por carpeta para las búsquedas y una por cada imagen descargada (se descarga ~1,5× lo pedido porque algunas no encajan).`;
    };
    wants.forEach((w) => w.addEventListener("input", update));
    update();
    const body = h("div", {},
      h("p", { class: "hint", style: { marginTop: 0 } }, "Para cada carpeta, la IA lee el criterio de todos sus niveles y mira unas imágenes de carpetas equivalentes, y con eso escribe las búsquedas. Luego la IA clasificadora revisa cada imagen descargada: encaja solo si la pondría justo en esa carpeta. Las imágenes ya presentes en la biblioteca o descargadas antes se saltan."),
      h("div", { class: "web-plan" }, rows.map((l, i) => h("div", { class: "row" },
        h("span", { class: "grow mono", title: l.rel }, shortRel(l.rel)), h("span", { class: "muted" }, `${l.count} · faltan ${l.missing}`),
        h("span", { class: "muted" }, "buscar"), wants[i]))),
      h("div", { class: "field" }, "Fuentes (todas sirven solo contenido apto para todo público)",
        srcs.map((s) => h("label", { class: "check", style: { display: "flex", color: "var(--text)" } }, s.cb, s.label))),
      h("div", { class: "field" }, "Al revisar", cards),
      thrWrap,
      h("div", { class: "row" }, h("span", { class: "muted" }, "IAs a la vez"), threads),
      h("p", { class: "hint" }, estimate));
    const ok = await modal({ title: "Buscar imágenes en internet", wide: true, body,
      buttons: [{ label: "Cancelar", value: false }, { label: "Empezar", value: true, primary: true, cls: "ai primary" }] });
    if (!ok) return;
    const sources = srcs.filter((s) => s.cb.checked).map((s) => s.k);
    if (!sources.length) return toast("Elige al menos una fuente", "error");
    try {
      await Main.flush();
      const r = await POST("/api/web/runs", { targets: rows.map((l, i) => ({ rel: l.rel, want: +wants[i].value || 5 })),
        mode, threshold: +thr.value, threads: +threads.value || 4, sources });
      S.sel.clear();
      await loadRuns();
      renderSide();
      selectRun(r.id);
      toast("Búsqueda en marcha: puedes seguir usando la aplicación", "ok");
    } catch (e) { fail(e); }
  }

  const REVIEWABLE = ["match", "other", "error", "stopped"];
  const pickKey = (c) => `${S.run.id}:${c.id}`;
  const picked = (c) => REVIEWABLE.includes(c.status) && (S.pick[pickKey(c)] ?? c.status === "match");
  function webView(head, body) {
    const r = S.run;
    if (!r) {
      body.append(h("div", { class: "empty big" }, S.runs.length ? "Elige una búsqueda en la lista de la izquierda."
        : "Marca carpetas en «Carpetas con menos imágenes» y pulsa «Buscar imágenes». Las imágenes encontradas aparecerán aquí."));
      return;
    }
    const all = r.targets.flatMap((t) => t.cands.map((c) => ({ t, c })));
    const chosen = all.filter(({ c }) => picked(c));
    const rest = all.filter(({ c }) => REVIEWABLE.includes(c.status) && !picked(c));
    const checking = all.filter(({ c }) => c.status === "checking").length;
    fill(head,
      h("b", { style: { marginLeft: "6px" } }, r.label),
      h("span", { class: "badge" }, r.mode === "auto" ? `añadir solas ≥ ${r.threshold}%` : "revisar antes"),
      h("span", { class: "muted" }, r.running ? `En curso${r.working ? ` · ${r.working} carpeta(s) buscando` : ""}${checking ? ` · ${checking} revisándose` : ""}` : "Terminada"),
      h("span", { class: "grow" }),
      r.running ? h("button", { class: "btn small danger", onclick: () => POST(`/api/web/runs/${r.id}/stop`).then(() => refreshRun(true)).catch(fail) }, "Detener") : null,
      h("button", { class: "btn small primary", disabled: !chosen.length, onclick: () => applyItems(chosen) }, `Añadir marcadas (${chosen.length})`),
      h("button", { class: "btn small", disabled: !rest.length, title: "Borra las descargas no marcadas", onclick: () => discard(rest) }, `Descartar no marcadas (${rest.length})`),
      h("button", { class: "icon-btn", title: "Quitar esta búsqueda de la lista y borrar sus descargas no añadidas", html: icon("trash"), disabled: r.running, onclick: removeRun }));
    body.append(h("p", { class: "hint", style: { marginTop: 0 } }, "Verde: la IA clasificadora la pondría en esa carpeta · ámbar: la pondría en otra (puedes añadirla allí o igualmente aquí). Pasa el ratón por una imagen para leer el motivo. Las añadidas se pueden deshacer con «Deshacer último lote»."));
    for (const t of r.targets) body.append(targetBlock(r, t));
  }
  const PHASE = { "en cola": "", "pensando búsquedas": "work", buscando: "work", descargando: "work", verificando: "work", listo: "ok", error: "err", detenida: "warn" };
  function targetBlock(r, t) {
    const live = t.cands.filter((c) => c.status !== "discarded");
    const info = [t.dups ? `${t.dups} ya estaban en la biblioteca` : "", t.failed ? `${t.failed} no se pudieron descargar` : ""].filter(Boolean).join(" · ");
    return h("div", { class: "web-target" },
      h("div", { class: "row" }, h("b", { class: "grow mono", title: t.rel }, shortRel(t.rel)),
        h("span", { class: "badge " + (PHASE[t.phase] ?? "") }, t.phase), h("span", { class: "muted" }, `añadidas ${t.added} de ${t.want}`)),
      t.note ? h("div", { class: "hint selectable", style: { margin: "4px 0" } }, t.note) : null,
      t.queries.length ? h("div", { class: "web-queries" }, t.queries.map((q) => h("span", { class: "chip" + (q.error ? " err" : ""),
        title: q.error || (q.found !== null ? `${q.found} resultados, ${q.new} nuevos` : "pendiente") }, h("b", {}, q.src), " ", q.text,
        q.found !== null ? h("small", { class: "muted" }, ` ${q.new}`) : null))) : null,
      t.error ? h("div", { class: "err", style: { fontSize: "12px" } }, t.error) : null,
      info ? h("div", { class: "muted", style: { fontSize: "12px" } }, info) : null,
      live.length ? h("div", { class: "web-cands" }, live.map((c, i) => candEl(t, c, live, i))) : null);
  }
  function candEl(t, c, live, i) {
    const can = REVIEWABLE.includes(c.status);
    const on = picked(c);
    const label = { checking: "revisando…", match: `encaja · ${c.confidence}%`, other: `otra carpeta · ${c.confidence}%`,
      error: "sin revisar (error)", stopped: "sin revisar", added: "añadida", moving: "moviendo…" }[c.status] || c.status;
    const cls = { match: "ok", other: "warn", error: "err", added: "ok", checking: "work", moving: "work" }[c.status] || "";
    const fileOf = (x) => (x.status === "added" && x.dest ? x.dest : x.file);
    const tip = [c.reason && "IA: " + c.reason, c.proposal && c.status !== "match" ? "La pondría en: " + c.proposal : "",
      c.title, c.author && "Autor: " + c.author, c.license && "Licencia: " + c.license, c.w ? `${c.w}×${c.h}` : ""].filter(Boolean).join("\n");
    return h("div", { class: `web-cand ${c.status}${on ? " on" : ""}`, title: tip },
      h("img", { src: thumbUrl(fileOf(c), 320), loading: "lazy", onclick: () => Lightbox.open(live.map((x) => ({ path: fileOf(x), name: x.name, size: x.size,
        extra: [x.src, x.proposal ? "IA: " + x.proposal : "", x.license].filter(Boolean).join(" · ") })), i, {}) }),
      h("span", { class: "badge " + cls }, label),
      c.status === "other" && c.proposal ? h("div", { class: "fd", title: c.proposal }, "→ " + c.proposal.split("/").slice(-3).join(" / ")) : null,
      c.status === "error" && c.error ? h("div", { class: "fd err", title: c.error }, c.error) : null,
      h("div", { class: "row" },
        can ? h("label", { class: "check" }, h("input", { type: "checkbox", checked: on, onchange: (e) => { S.pick[pickKey(c)] = e.target.checked; renderMain(); } }), "Añadir") : null,
        h("span", { class: "grow" }),
        c.page ? h("a", { class: "src", href: c.page, target: "_blank", rel: "noopener noreferrer", title: "Ver la página original" }, c.src) : null),
      c.status === "other" && c.proposal ? h("button", { class: "btn small", title: `Añadirla en ${c.proposal}`, onclick: () => applyItems([{ t, c }], c.proposal) }, "Añadir donde dice la IA") : null);
  }
  async function applyItems(pairs, dest = null) {
    const r = await POST(`/api/web/runs/${S.run.id}/apply`, { items: pairs.map(({ t, c }) => ({ target: t.id, cand: c.id, dest })) }).catch(fail);
    if (!r) return;
    toast(`${r.applied} imagen(es) añadidas a la biblioteca${r.errors.length ? ` · ${r.errors.length} errores: ${r.errors[0]}` : ""}`, r.errors.length ? "error" : "ok",
      r.applied ? { label: "Deshacer", fn: async () => { await Images.undoLast(); S.stale = true; refreshRun(true); loadRuns(); } } : null);
    S.stale = true; folderCache.time = 0; Main.refreshStats();
    await refreshRun(true); loadRuns();
  }
  async function discard(pairs) {
    if (!(await confirmBox("Descartar imágenes", `Se borran ${pairs.length} descarga(s) que no has marcado. No toca tu biblioteca.`, "Descartar", true))) return;
    await POST(`/api/web/runs/${S.run.id}/discard`, { items: pairs.map(({ t, c }) => ({ target: t.id, cand: c.id })) }).catch(fail);
    await refreshRun(true); loadRuns();
  }
  async function removeRun() {
    const left = S.run.targets.reduce((a, t) => a + t.cands.filter((c) => REVIEWABLE.includes(c.status)).length, 0);
    if (!(await confirmBox("Quitar búsqueda", `Se quita de la lista${left ? ` y se borran ${left} descarga(s) sin añadir` : ""}. Las imágenes ya añadidas se quedan en la biblioteca.`, "Quitar", !!left))) return;
    await api("DELETE", `/api/web/runs/${S.run.id}`).catch(fail);
    S.runId = null; S.run = null;
    await loadRuns(); renderMain();
  }

  /* ---------------------------------------------------------------- lifecycle */
  function show() {
    renderSide();
    if (S.view !== "web" && (S.stale || !S.data)) load(); else renderMain();
    loadRuns().then(() => {
      if (!S.runId && S.runs.length) useRun(S.runs[0].id);
      else if (S.runId) refreshRun(true);
    });
  }
  async function init() {
    await loadRuns();
    const running = S.runs.find((r) => r.running);
    if (running) await useRun(running.id);
  }
  function markStale() { S.stale = true; }

  return { init, show, markStale };
})();
