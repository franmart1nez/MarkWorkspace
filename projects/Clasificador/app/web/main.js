/* App bootstrap: tabs, saving, stats, settings page, assistant and global shortcuts. */
"use strict";

const Main = (() => {
  let saveTimer = null, saving = null, dirty = false;

  async function boot() {
    try {
      const st = await GET("/api/state");
      App.cfg = st.config; App.problems = st.problems;
      if (!st.pillow) toast("Pillow no está instalado: las miniaturas usarán la imagen original (más lento)");
    } catch (e) { return fail(e); }
    $("#btn-undo").innerHTML = icon("undo");
    $("#btn-redo").innerHTML = icon("redo");
    $("#btn-fit").innerHTML = icon("fit");
    $("#btn-expand").innerHTML = icon("expand");
    $("#btn-collapse").innerHTML = icon("collapse");
    $("#assistant-close").innerHTML = icon("close");
    Tree.initCanvas(); Images.init(); Lightbox.init(); Classify.init(); Tags.init(); Gaps.init(); Assistant.init();
    initTabs(); initToolbar(); initKeys();
    Tree.render(); Inspector.render(); Classify.initForm(); renderSettings();
    requestAnimationFrame(() => Tree.fit());
    refreshStats(true);
    Images.loadTree();
    let last = null;
    try { last = localStorage.getItem("clf.lastPath"); } catch { /* ignore */ }
    Images.open(last || App.cfg.settings.source).catch?.(() => {});
    let tab = "tree";
    try { tab = localStorage.getItem("clf.tab") || "tree"; } catch { /* ignore */ }
    showTab(location.hash.slice(1) || tab);
    window.addEventListener("beforeunload", (e) => { if (dirty) { flush(); e.preventDefault(); } });
  }

  /* ---------------------------------------------------------------- saving */
  function changed({ soft = false } = {}) {
    dirty = true;
    setState("Sin guardar…", "dirty");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 700);
    Tree.updateMatches();
    Tree.render();
    if (!soft) Inspector.render();
  }
  async function flush() {
    clearTimeout(saveTimer);
    if (saving) await saving;
    if (!dirty) return;
    dirty = false;
    const sent = JSON.stringify(App.cfg);
    setState("Guardando…", "dirty");
    saving = (async () => {
      try {
        const r = await api("PUT", "/api/config", { config: JSON.parse(sent) });
        App.problems = r.problems;
        if (!dirty) setState("Guardado", "");
        Tree.render();
        refreshStats();
      } catch (e) {
        dirty = true;
        setState("No guardado: " + e.message, "error");
        toast("No se pudo guardar: " + e.message, "error", null, 8000);
      } finally { saving = null; }
    })();
    return saving;
  }
  function setState(text, cls) { const el = $("#save-state"); el.textContent = text; el.className = "save-state " + cls; el.title = text; }

  const refreshStats = (() => {
    let t = null;
    const run = async () => {
      try { App.stats = await GET("/api/stats"); Tree.render(); Inspector.render(); } catch { /* ignore */ }
    };
    return (now = false) => { clearTimeout(t); Gaps.markStale(); if (now) run(); else t = setTimeout(run, 1200); };
  })();

  /* ---------------------------------------------------------------- tabs */
  function showTab(name) {
    if (!$("#tab-" + name)) name = "tree";
    $$("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    $$(".tab-page").forEach((p) => p.classList.toggle("active", p.id === "tab-" + name));
    App.tab = name;
    try { localStorage.setItem("clf.tab", name); } catch { /* ignore */ }
    if (name === "tree") requestAnimationFrame(() => Tree.render());
    if (name === "classify") { Classify.initForm(); Classify.loadJobs(); }
    if (name === "settings") renderSettings();
    if (name === "images") { Images.renderSide(); Images.refreshGroups(); }
    if (name === "tags") Tags.show();
    if (name === "gaps") Gaps.show();
  }
  function initTabs() {
    $("#tabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) showTab(b.dataset.tab); });
  }

  /* ---------------------------------------------------------------- toolbar */
  function initToolbar() {
    $("#btn-undo").onclick = () => Tree.undo();
    $("#btn-redo").onclick = () => Tree.redo();
    $("#btn-new-group").onclick = () => Tree.newGroup(App.sel.size && App.primary !== "root" ? App.primary : null);
    $("#btn-prompt").onclick = () => Classify.showPrompt();
    $("#btn-audit").onclick = (e) => audit(e.currentTarget);
    $("#btn-batch").onclick = () => Inspector.improveBatch(App.primary || "root");
    const menu = $("#disk-menu");
    $("#btn-disk-menu").onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
    document.addEventListener("click", () => (menu.hidden = true));
    menu.addEventListener("click", (e) => {
      const act = e.target.dataset.act;
      if (act === "import") importDisk();
      if (act === "create") createOnDisk();
      if (act === "clean") Images.cleanEmpty(App.cfg.settings.destination);
      if (act === "stats") { refreshStats(true); Images.loadTree(); toast("Recuentos actualizados"); }
    });
  }
  async function audit(btn) {
    await busy(btn, async () => {
      await flush();
      const r = await POST("/api/ai/audit");
      const body = h("div", {});
      if (!r.problems.length) body.append(h("p", {}, "La IA no encontró problemas importantes. ✔"));
      for (const p of r.problems) {
        const node = Tree.findByPath(p.path);
        body.append(h("div", { class: "audit-item" },
          h("div", {}, h("code", {}, p.path || "(general)")), h("div", { style: { margin: "4px 0" } }, p.problem),
          p.suggestion ? h("div", { class: "muted" }, "Sugerencia: " + p.suggestion) : null,
          p.description ? h("div", { class: "ai-preview" }, h("b", {}, "Descripción nueva: "), p.description) : null,
          h("div", { class: "btn-row", style: { marginTop: "6px" } },
            node ? h("button", { class: "btn small", onclick: () => Tree.revealNode(node.id) }, "Ir a la carpeta") : null,
            node && p.description ? h("button", { class: "btn small ai primary", onclick: (e) => {
              Tree.mutate(() => (node.description = p.description)); e.target.disabled = true; e.target.textContent = "Aplicada ✔";
            } }, "Aplicar descripción") : null)));
      }
      modal({ title: "Revisión de criterios por la IA", wide: true, body });
    });
  }
  async function importDisk() {
    try {
      await flush();
      const r = await POST("/api/fs/import");
      if (!r.additions.length) return toast("Todas las carpetas del disco ya están en el árbol", "ok");
      const checks = r.additions.map(() => h("input", { type: "checkbox", checked: true }));
      const count = (n) => 1 + n.children.reduce((a, c) => a + count(c), 0);
      const body = h("div", {}, h("p", { class: "hint" }, "Carpetas que existen en disco pero no en el árbol:"),
        r.additions.map((a, i) => {
          const parent = Tree.find(a.parent);
          return h("label", { class: "check", style: { display: "flex", margin: "5px 0" } }, checks[i],
            h("code", {}, [...(parent?.path || []), a.node.name].join("/")), h("span", { class: "muted" }, count(a.node) > 1 ? ` (+${count(a.node) - 1} subcarpetas)` : ""));
        }));
      const ok = await modal({ title: "Importar carpetas del disco", body, buttons: [{ label: "Cancelar", value: false }, { label: "Añadir al árbol", value: true, primary: true, cls: "primary" }] });
      if (!ok) return;
      Tree.mutate(() => r.additions.forEach((a, i) => {
        if (!checks[i].checked) return;
        const p = Tree.find(a.parent)?.n;
        if (p && !Tree.canHoldChild(p, a.node)) p.children.push(a.node);
      }));
      toast("Carpetas importadas. Añádeles descripción para que la IA las use bien.", "ok");
    } catch (e) { fail(e); }
  }
  async function createOnDisk() {
    try {
      await flush();
      const r = await POST("/api/fs/plan");
      if (!r.missing.length) return toast("Todas las carpetas fijas del árbol ya existen en disco", "ok");
      const ok = await modal({ title: `Crear ${r.missing.length} carpeta(s) en disco`, wide: true,
        body: h("div", {}, h("p", { class: "hint" }, "Las carpetas variables {…} se crean solas cuando la IA clasifica."), h("pre", {}, r.missing.join("\n"))),
        buttons: [{ label: "Cancelar", value: false }, { label: "Crear", value: true, primary: true, cls: "primary" }] });
      if (!ok) return;
      const c = await POST("/api/fs/create-tree");
      toast(`${c.created.length} carpeta(s) creadas`, "ok");
      refreshStats(true); Images.loadTree();
    } catch (e) { fail(e); }
  }

  /* ---------------------------------------------------------------- settings */
  function renderSettings() {
    const box = $("#settings");
    if (!App.cfg || (box.contains(document.activeElement) && document.activeElement.matches("input, textarea, select"))) return;
    const s = App.cfg.settings;
    const set = (k, v) => { s[k] = v; changed({ soft: true }); };
    const pathField = (label, key, help) => h("label", { class: "field" }, label,
      h("div", { class: "row" }, h("input", { value: s[key], onchange: (e) => { set(key, e.target.value.trim()); if (key === "destination") { refreshStats(true); Images.loadTree(); } } }),
        h("button", { class: "icon-btn", title: "Elegir carpeta", html: icon("folder"), onclick: async (e) => {
          const r = await POST("/api/fs/pick", { initial: s[key] }).catch(fail);
          if (r?.path) { e.target.closest(".row").querySelector("input").value = r.path; set(key, r.path); if (key === "destination") { refreshStats(true); Images.loadTree(); } }
        } })), help ? h("span", { class: "hint" }, help) : null);
    const modelInput = h("input", { value: s.model, list: "model-list", onchange: (e) => set("model", e.target.value.trim()) });
    const modelList = h("datalist", { id: "model-list" });
    GET("/api/models").then((r) => r.models.forEach((m) => modelList.append(h("option", { value: m })))).catch(() => {});
    const hist = h("div", {});
    box.innerHTML = "";
    box.append(
      h("h2", {}, "Carpetas"),
      h("div", { class: "card" },
        pathField("Imágenes sin clasificar (origen)", "source"),
        pathField("Carpeta destino (raíz del árbol)", "destination", "Aquí se crea el árbol de carpetas. Al renombrar o mover carpetas en el árbol se renombran también aquí."),
        h("label", { class: "check" }, h("input", { type: "checkbox", checked: s.syncDisk !== false, onchange: (e) => set("syncDisk", e.target.checked) }),
          "Renombrar/mover también en disco cuando cambio el árbol"),
        h("br"),
        h("label", { class: "check", style: { marginTop: "8px" } }, h("input", { type: "checkbox", checked: s.unhide, onchange: (e) => set("unhide", e.target.checked) }),
          "Quitar el atributo «oculto» a las imágenes movidas/copiadas")),
      h("h2", {}, "Inteligencia artificial (OpenCode)"),
      h("div", { class: "card" },
        h("label", { class: "field" }, "Modelo", modelInput, modelList, h("span", { class: "hint" }, "La misma IA del script original. Lista completa: opencode models")),
        h("div", { class: "row2" },
          h("label", { class: "field" }, "Esfuerzo", h("select", { onchange: (e) => set("effort", e.target.value) },
            ["", "low", "high", "max"].map((v) => h("option", { value: v, selected: s.effort === v }, v || "(el de OpenCode)")))),
          h("label", { class: "field" }, "Tiempo máximo por imagen (s)", h("input", { type: "number", min: 30, value: s.timeout, onchange: (e) => set("timeout", +e.target.value || 180) }))),
        h("label", { class: "field" }, "Instrucciones generales", h("textarea", { rows: 3, value: s.instructions, onchange: (e) => set("instructions", e.target.value) })),
        h("div", { class: "btn-row" }, h("button", { class: "btn small", onclick: () => Classify.showPrompt() }, "Ver prompt completo"))),
      h("h2", {}, "Historial de archivos"),
      h("div", { class: "card" }, h("div", { class: "btn-row", style: { marginBottom: "8px" } },
        h("button", { class: "btn small", onclick: async () => { await Images.undoLast(); renderSettings(); } }, "Deshacer último lote")), hist),
      h("h2", {}, "Atajos de teclado"),
      h("div", { class: "card" }, h("pre", { style: { whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" } },
        "Global: Alt+1…6 pestañas · Ctrl+K asistente · Ctrl+Z / Ctrl+Y deshacer y rehacer cambios del árbol\n" +
        "Árbol: Tab subcarpeta · Enter hermana · F2 renombrar · doble clic editar · Supr borrar · Ctrl+D duplicar · Ctrl+C / Ctrl+V copiar y pegar rama · flechas navegar · F ajustar · arrastrar para mover (bordes = antes/después, centro = dentro)\n" +
        "Imágenes: flechas mover · Shift+flechas seleccionar · Enter ver · 1–9 mover a atajo · M mover a… · Supr papelera · Retroceso subir · arrastra miniaturas a una carpeta (Ctrl = copiar)\n" +
        "Visor: ← → navegar · rueda zoom · doble clic 100% · 0 ajustar · 1–9 atajos · M mover · Supr papelera · Esc cerrar\n" +
        "Etiquetas: clic, Ctrl+clic y Mayús+clic seleccionar · Ctrl+A todas · Enter ver · Esc quitar selección")));
    GET("/api/history").then((r) => {
      if (!r.history.length) hist.append(h("p", { class: "hint" }, "Sin movimientos todavía."));
      for (const b of r.history) hist.append(h("div", { class: "hist-row" }, h("span", { class: "when" }, fmtDate(b.time)),
        h("span", {}, b.kind === "undo" ? `Deshecho (${b.items.length})` : `${b.label || b.kind} · ${b.items.length} archivo(s)`)));
    }).catch(() => {});
  }

  /* ---------------------------------------------------------------- keys */
  function initKeys() {
    document.addEventListener("keydown", (e) => {
      if ($("#modal-root").children.length && !Lightbox.isOver()) return;
      const typing = e.target.matches("input, textarea, select, [contenteditable]");
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.altKey && /^[1-6]$/.test(e.key)) { e.preventDefault(); return showTab(["tree", "images", "classify", "tags", "gaps", "settings"][+e.key - 1]); }
      if (ctrl && e.key.toLowerCase() === "k") { e.preventDefault(); return Assistant.toggle(true); }
      if (ctrl && e.key.toLowerCase() === "s") { e.preventDefault(); flush(); return; }
      if (typing) return;
      if (Lightbox.onKey(e)) return;
      if (e.key === "Escape" && !$("#assistant").hidden) return Assistant.toggle(false);
      if (ctrl && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); return Tree.undo(); }
      if (ctrl && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); return Tree.redo(); }
      if (App.tab === "images" && Images.onKey(e)) e.preventDefault();
      if (App.tab === "tags" && Tags.onKey(e)) e.preventDefault();
      if (App.tab === "tree" && document.activeElement === document.body && (e.key === "Tab" || e.key === "Enter" || e.key === "F2" || e.key === "Delete" || e.key.startsWith("Arrow"))) {
        $("#canvas").focus(); $("#canvas").dispatchEvent(new KeyboardEvent("keydown", { key: e.key, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, bubbles: true }));
        e.preventDefault();
      }
    });
  }

  return { boot, changed, flush, refreshStats, showTab };
})();

/* ==================================================================== assistant */
const Assistant = (() => {
  function toggle(on) {
    const d = $("#assistant");
    d.hidden = on === undefined ? !d.hidden : !on;
    if (!d.hidden) setTimeout(() => $("#chat-text").focus(), 30);
  }
  function msg(cls, ...content) {
    const m = h("div", { class: "msg " + cls }, ...content);
    $("#chat").append(m);
    $("#chat").scrollTop = 1e9;
    return m;
  }
  function describeAction(a) {
    if (a.tipo === "crear") return h("span", {}, "Crear ", h("code", {}, `${a.padre ? a.padre + "/" : ""}${a.variable ? "{" + a.nombre + "}" : a.nombre}`), a.descripcion ? ` — ${a.descripcion}` : "");
    if (a.tipo === "editar") return h("span", {}, "Editar ", h("code", {}, a.ruta), a.descripcion ? ` — ${a.descripcion}` : "", a.incluir?.length ? ` · señales: ${a.incluir.join(", ")}` : "");
    if (a.tipo === "grupo") return h("span", {}, "Grupo ", h("b", {}, a.nombre), a.descripcion ? ` — ${a.descripcion}` : "", a.rutas?.length ? ` · para ${a.rutas.length} carpeta(s)` : "");
    return h("span", {}, JSON.stringify(a));
  }
  function applyActions(actions) {
    const report = { ok: 0, fail: [] };
    Tree.mutate(() => {
      const groupByName = (name) => App.cfg.groups.find((g) => norm(g.name) === norm(name));
      for (const a of actions) {
        try {
          if (a.tipo === "grupo") {
            let g = groupByName(a.nombre);
            if (!g) { g = { id: uid(), name: a.nombre, color: "#3fb8c4", description: "", include: [], exclude: [] }; App.cfg.groups.push(g); }
            if (a.descripcion) g.description = a.descripcion;
            if (a.incluir) g.include = [...new Set([...g.include, ...a.incluir])];
            if (a.excluir) g.exclude = [...new Set([...g.exclude, ...a.excluir])];
            for (const r of a.rutas || []) { const n = Tree.findByPath(r); if (n && n.id !== "root") n.group = g.id; else report.fail.push(`no existe ${r}`); }
          } else if (a.tipo === "crear") {
            const parent = Tree.findByPath(a.padre || "");
            if (!parent) throw new Error(`no existe ${a.padre}`);
            const name = a.variable ? norm(a.nombre).replace(/[{}]/g, "").replace(/\s+/g, "_") : Tree.cleanName(String(a.nombre).replace(/[{}]/g, ""));
            const existing = parent.children.find((c) => norm(c.name) === norm(name));
            const node = existing || Tree.newNode(name, { kind: a.variable ? "variable" : "folder" });
            if (!existing) {
              const why = Tree.canHoldChild(parent, node);
              if (why) throw new Error(why);
              parent.children.push(node);
            }
            if (a.descripcion) node.description = a.descripcion;
            if (a.incluir) node.include = a.incluir;
            if (a.excluir) node.exclude = a.excluir;
            if (a.grupo) { const g = groupByName(a.grupo); if (g) node.group = g.id; }
            App.collapsed.delete(parent.id);
          } else if (a.tipo === "editar") {
            const n = Tree.findByPath(a.ruta);
            if (!n || n.id === "root") throw new Error(`no existe ${a.ruta}`);
            if (a.descripcion !== undefined && a.descripcion !== "") n.description = a.descripcion;
            if (a.incluir?.length) n.include = a.incluir;
            if (a.excluir?.length) n.exclude = a.excluir;
            if (a.grupo) { const g = groupByName(a.grupo); if (g) n.group = g.id; }
          }
          report.ok++;
        } catch (e) { report.fail.push(e.message); }
      }
    });
    return report;
  }
  async function send(text) {
    text = text.trim();
    if (!text) return;
    msg("user", text);
    $("#chat-text").value = "";
    const wait = msg("ai muted", "Pensando…");
    try {
      await Main.flush();
      const r = await POST("/api/ai/assistant", { message: text, selected: App.primary });
      wait.remove();
      const m = msg("ai", r.answer || "(sin respuesta)");
      if (r.actions.length) {
        const checks = r.actions.map(() => h("input", { type: "checkbox", checked: true }));
        const btn = h("button", { class: "btn small ai primary", onclick: () => {
          const chosen = r.actions.filter((_, i) => checks[i].checked);
          const rep = applyActions(chosen);
          btn.disabled = true; btn.textContent = `Aplicadas ${rep.ok}${rep.fail.length ? ` · ${rep.fail.length} fallaron` : ""}`;
          if (rep.fail.length) toast("Algunas acciones fallaron: " + rep.fail.slice(0, 3).join("; "), "error", null, 8000);
          else toast("Cambios aplicados (Ctrl+Z para deshacer)", "ok");
          Main.showTab("tree");
        } }, `Aplicar ${r.actions.length} cambio(s)`);
        m.append(h("div", { class: "actions-list" }, r.actions.map((a, i) => h("label", { class: "action" }, checks[i], describeAction(a))), h("div", {}, btn)));
      }
    } catch (e) { wait.remove(); msg("ai err", e.message); }
  }
  function init() {
    $("#btn-assistant").onclick = () => toggle();
    $("#assistant-close").onclick = () => toggle(false);
    $("#chat-form").addEventListener("submit", (e) => { e.preventDefault(); send($("#chat-text").value); });
    $("#chat-text").addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e.target.value); }
      if (e.key === "Escape") toggle(false);
    });
    $("#chat").addEventListener("click", (e) => { const q = e.target.closest("[data-q]"); if (q) send(q.dataset.q); });
  }
  return { init, toggle };
})();

Main.boot();
