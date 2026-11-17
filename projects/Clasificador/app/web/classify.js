/* Classification runs: start, live progress, review/correct proposals, apply and undo. */
"use strict";

const Classify = (() => {
  const S = { jobs: [], job: null, jobId: null, sel: new Set(), edits: {}, filter: "review", sort: "order", bulkMin: 70, pendingRender: false };
  let pollTimer = null;

  /* ---------------------------------------------------------------- form */
  function initForm() {
    const s = App.cfg.settings;
    $("#run-source").value = s.source;
    $("#run-limit").value = s.limit || "";
    $("#run-threads").value = s.threads;
    $("#run-threshold").value = s.threshold;
    setMode(s.mode || "review");
    updateThreshold();
    $("#run-model").textContent = `IA: ${s.model}${s.effort ? " · esfuerzo " + s.effort : ""} (cámbiala en Ajustes)`;
  }
  function setMode(m) {
    $$("#run-mode button").forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
    $("#run-threshold-wrap").style.display = m === "review" ? "none" : "";
    S.mode = m;
  }
  function updateThreshold() { $("#run-threshold-val").textContent = $("#run-threshold").value + "%"; }
  function saveForm() {
    const s = App.cfg.settings;
    s.source = $("#run-source").value.trim();
    s.limit = +$("#run-limit").value || null;
    s.threads = Math.max(1, Math.min(16, +$("#run-threads").value || 4));
    s.threshold = +$("#run-threshold").value;
    s.mode = S.mode;
    Main.changed({ soft: true });
  }

  async function start(btn) {
    saveForm();
    await busy(btn, async () => {
      await Main.flush();
      const s = App.cfg.settings;
      const j = await POST("/api/jobs", { source: s.source, recursive: $("#run-recursive").checked, mode: S.mode,
        threshold: s.threshold, limit: s.limit, threads: s.threads });
      S.filter = S.mode === "review" ? "review" : "all";
      select(j.id);
      toast(`Clasificando ${j.total} imágenes…`);
    });
  }
  async function startFiles(files, label) {
    if (!files.length) return;
    try {
      await Main.flush();
      const j = await POST("/api/jobs", { files, mode: "review", label: label || `${files.length} seleccionadas` });
      S.filter = "review";
      Main.showTab("classify");
      select(j.id);
    } catch (e) { fail(e); }
  }
  async function quickAsk(path) {
    await Main.flush();
    const j = await POST("/api/jobs", { files: [path], mode: "review", threads: 1, label: "Consulta rápida" });
    try {
      for (let i = 0; i < 400; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const v = await GET(`/api/jobs/${j.id}`);
        const it = v.items[0];
        if (it.status === "done") return it;
        if (it.status === "error") throw new Error(it.error);
      }
      throw new Error("La IA no respondió a tiempo");
    } finally {
      api("DELETE", `/api/jobs/${j.id}`).catch(() => {});
    }
  }

  /* ---------------------------------------------------------------- jobs */
  async function loadJobs() {
    try {
      const r = await GET("/api/jobs");
      S.jobs = r.jobs.filter((j) => j.label !== "Consulta rápida");
      renderJobs();
      const pending = S.jobs.reduce((a, j) => a + reviewCount(j), 0);
      const pill = $("#review-pill");
      pill.hidden = !pending; pill.textContent = pending;
      if (!S.jobId && S.jobs.length) select(S.jobs[0].id, true);
    } catch { /* server restarting */ }
  }
  function reviewCount(j) { return j.reviewable ?? 0; }
  function renderJobs() {
    const box = $("#job-list");
    box.innerHTML = "";
    if (!S.jobs.length) box.append(h("p", { class: "hint" }, "Todavía no hay tandas."));
    for (const j of S.jobs) {
      const done = j.total - (j.status.queued || 0) - (j.status.working || 0);
      const running = !j.finished && !j.stopped;
      box.append(h("div", { class: "job" + (j.id === S.jobId ? " active" : ""), onclick: () => select(j.id) },
        h("div", { class: "row" }, h("b", { class: "grow" }, j.label), h("span", { class: "muted" }, fmtDate(j.created))),
        h("div", { class: "muted" }, `${{ review: "Revisar", move: "Mover", copy: "Copiar" }[j.mode]} · ${done}/${j.total}` +
          `${j.decisions.applied ? ` · ${j.decisions.applied} aplicadas` : ""}${j.status.error ? ` · ${j.status.error} errores` : ""}${running ? " · en curso" : ""}`),
        h("div", { class: "bar" }, h("i", { style: { width: (100 * done / j.total) + "%" } }))));
    }
  }
  async function select(id, quiet = false) {
    S.jobId = id; S.sel.clear();
    await refresh(true);
    renderJobs();
    if (!quiet) poll();
  }
  async function refresh(force = false) {
    if (!S.jobId) return;
    try {
      const v = await GET(`/api/jobs/${S.jobId}${!force && S.job ? `?v=${S.job.version}` : ""}`);
      if (v.unchanged) return;
      const firstLoad = !S.job || S.job.id !== v.id;
      const appliedBefore = S.job && S.job.id === v.id ? (S.job.decisions.applied || 0) : null;
      S.job = v;
      if (firstLoad) S.bulkMin = v.threshold || App.cfg.settings.threshold;
      if (appliedBefore !== null && (v.decisions.applied || 0) > appliedBefore) { Main.refreshStats(); folderCache.time = 0; }
      render();
    } catch (e) {
      if (/no encontrado/i.test(e.message)) { S.jobId = null; S.job = null; render(); }
    }
  }
  function poll() {
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      await refresh();
      if (S.job && (S.job.finished || S.job.stopped) && !S.job.items.some((i) => i.status === "working" || i.status === "queued")) {
        clearInterval(pollTimer); pollTimer = null; loadJobs();
      }
    }, 1200);
  }

  /* ---------------------------------------------------------------- review */
  const isReviewable = (it) => it.status === "done" && it.decision === "pending";
  function visibleItems() {
    let list = S.job.items;
    const f = S.filter;
    if (f === "review") list = list.filter(isReviewable);
    else if (f === "applied") list = list.filter((i) => i.decision === "applied");
    else if (f === "rejected") list = list.filter((i) => i.decision === "rejected");
    else if (f === "error") list = list.filter((i) => i.status === "error" || i.status === "stopped");
    if (S.sort === "conf") list = [...list].sort((a, b) => (a.confidence ?? 999) - (b.confidence ?? 999));
    return list;
  }
  function render() {
    const box = $("#review");
    if (!S.job) { box.innerHTML = ""; box.append(h("div", { class: "empty big", html: "Elige una carpeta de origen y pulsa <b>Clasificar</b>. Las propuestas aparecerán aquí." })); return; }
    if (box.contains(document.activeElement) && document.activeElement.matches(".dest input")) { S.pendingRender = true; return; }
    S.pendingRender = false;
    const j = S.job;
    const st = j.status, dec = j.decisions;
    const working = (st.queued || 0) + (st.working || 0);
    const reviewable = j.items.filter(isReviewable).length;
    const errors = (st.error || 0) + (st.stopped || 0);
    const pct = (n) => (100 * n / j.total) + "%";
    const scroll = $(".review-list", box)?.scrollTop || 0;
    box.innerHTML = "";

    const filters = [["review", `Para revisar (${reviewable})`], ["all", `Todas (${j.total})`], ["applied", `Aplicadas (${dec.applied || 0})`],
      ["rejected", `Descartadas (${dec.rejected || 0})`], ["error", `Errores (${errors})`]];
    const head = h("div", { class: "review-head" },
      h("div", { class: "top" }, h("b", { style: { fontSize: "15px" } }, j.label),
        h("span", { class: "badge" }, { review: "Revisar antes", move: "Mover ≥ " + j.threshold + "%", copy: "Copiar ≥ " + j.threshold + "%" }[j.mode]),
        h("span", { class: "muted" }, working ? `Analizando… quedan ${working}` : "Terminado"),
        h("span", { class: "grow" }),
        working ? h("button", { class: "btn small danger", onclick: () => POST(`/api/jobs/${j.id}/stop`).then(() => refresh(true)).catch(fail) }, "Detener") : null,
        h("button", { class: "btn small", onclick: showPrompt }, "Ver prompt"),
        h("button", { class: "icon-btn", title: "Quitar esta tanda de la lista (no toca archivos)", html: icon("trash"), onclick: async () => {
          if (!(await confirmBox("Quitar tanda", "Se quita de la lista. Los archivos no se tocan.", "Quitar"))) return;
          await api("DELETE", `/api/jobs/${j.id}`).catch(fail); S.jobId = null; S.job = null; render(); loadJobs();
        } })),
      h("div", { class: "progress", title: "Verde: aplicadas · Azul: para revisar · Rojo: errores" },
        h("i", { style: { width: pct(dec.applied || 0), background: "var(--ok)" } }),
        h("i", { style: { width: pct(reviewable), background: "var(--accent)" } }),
        h("i", { style: { width: pct(dec.rejected || 0), background: "var(--line2)" } }),
        h("i", { style: { width: pct(errors), background: "var(--err)" } })),
      h("div", { class: "review-filters" },
        h("div", { class: "seg" }, filters.map(([k, label]) => h("button", { class: S.filter === k ? "active" : "", onclick: () => { S.filter = k; S.sel.clear(); render(); } }, label))),
        h("select", { onchange: (e) => { S.sort = e.target.value; render(); } },
          h("option", { value: "order", selected: S.sort === "order" }, "Orden original"), h("option", { value: "conf", selected: S.sort === "conf" }, "Menos seguras primero"))));

    const list = visibleItems();
    const selectable = list.filter(isReviewable);
    const bulk = h("div", { class: "review-filters", style: { marginTop: "8px" } },
      h("label", { class: "check" }, h("input", { type: "checkbox", checked: selectable.length && selectable.every((i) => S.sel.has(i.id)),
        onchange: (e) => { selectable.forEach((i) => (e.target.checked ? S.sel.add(i.id) : S.sel.delete(i.id))); render(); } }), "Todas"),
      h("button", { class: "btn small primary", disabled: !S.sel.size, onclick: () => applyItems([...S.sel]) }, `Aplicar seleccionadas (${S.sel.size})`),
      h("button", { class: "btn small", disabled: !S.sel.size, onclick: () => reject([...S.sel]) }, "Descartar seleccionadas"),
      h("span", { class: "sep" }),
      h("button", { class: "btn small", disabled: !reviewable, onclick: () => applyItems(j.items.filter((i) => isReviewable(i) && i.confidence >= S.bulkMin).map((i) => i.id)) },
        `Aplicar todas ≥ ${S.bulkMin}% (${j.items.filter((i) => isReviewable(i) && i.confidence >= S.bulkMin).length})`),
      h("input", { type: "range", min: 0, max: 100, step: 5, value: S.bulkMin, style: { width: "90px" }, oninput: (e) => { S.bulkMin = +e.target.value; render(); } }),
      errors ? h("button", { class: "btn small", onclick: () => retry(j.items.filter((i) => i.status === "error" || i.status === "stopped").map((i) => i.id)) }, `Reintentar errores (${errors})`) : null);
    head.append(bulk);

    const body = h("div", { class: "review-list" });
    if (!list.length) body.append(h("div", { class: "empty" }, S.filter === "review" && working ? "Esperando las primeras respuestas de la IA…" : "Nada en esta vista."));
    for (const it of list) body.append(row(it, j));
    box.append(head, body, datalist());
    body.scrollTop = scroll;
  }
  function confColor(c, thr) { return c >= thr ? "var(--ok)" : c >= 40 ? "var(--warn)" : "var(--err)"; }
  function row(it, j) {
    const editKey = `${j.id}:${it.id}`;
    const reviewable = isReviewable(it);
    const statusBadge = it.status === "working" ? h("span", { class: "badge work" }, "analizando…")
      : it.status === "queued" ? h("span", { class: "badge" }, "en cola")
      : it.status === "error" ? h("span", { class: "badge err" }, "error")
      : it.status === "stopped" ? h("span", { class: "badge warn" }, "detenida")
      : it.decision === "applied" ? h("span", { class: "badge ok" }, j.mode === "copy" ? "copiada" : "movida")
      : it.decision === "rejected" ? h("span", { class: "badge" }, "descartada")
      : h("span", { class: "badge warn" }, "para revisar");
    const destInput = h("input", { value: S.edits[editKey] ?? it.proposal ?? "", list: "dest-folders", disabled: !reviewable,
      title: "Carpeta de destino relativa a la carpeta Clasificadas. Puedes escribir otra o una nueva.",
      oninput: (e) => (S.edits[editKey] = e.target.value),
      onkeydown: (e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); applyItems([it.id]); } },
      onblur: () => { if (S.pendingRender) setTimeout(render, 0); } });
    const thumb = h("img", { class: "thumb", loading: "lazy", src: thumbUrl(it.decision === "applied" && it.dest ? it.dest : it.file, 200), onclick: () => openViewer(it) });
    return h("div", { class: `ritem ${it.decision}` },
      reviewable ? h("input", { type: "checkbox", checked: S.sel.has(it.id), onchange: (e) => { e.target.checked ? S.sel.add(it.id) : S.sel.delete(it.id); render(); } }) : h("span"),
      thumb,
      h("div", { class: "info" },
        h("div", { class: "row" }, h("span", { class: "fname grow", title: it.file }, it.name), statusBadge,
          it.confidence !== null && it.confidence !== undefined ? h("span", { class: "conf", title: "Confianza de la IA" },
            h("i", {}, h("b", { style: { width: it.confidence + "%", background: confColor(it.confidence, j.threshold) } })), it.confidence + "%") : null),
        it.status === "done" ? h("div", { class: "dest" }, destInput,
          reviewable ? h("button", { class: "icon-btn", title: "Elegir carpeta", html: icon("folder"), onclick: async () => {
            const p = await pickFolder({ title: "Destino para " + it.name });
            const rel = p && relTo(App.cfg.settings.destination, p);
            if (rel === null && p) return toast("Elige una carpeta dentro de Clasificadas", "error");
            if (p) { S.edits[editKey] = rel; render(); }
          } }) : null) : null,
        it.reason ? h("div", { class: "reason" }, it.reason) : null,
        it.decision === "applied" && it.dest ? h("div", { class: "reason" }, "→ " + it.dest) : null,
        it.error ? h("div", { class: "err" }, it.error) : null),
      h("div", { class: "acts" },
        reviewable ? h("button", { class: "btn small primary", title: "Aplicar (Enter en la ruta)", onclick: () => applyItems([it.id]) }, "✓ Aplicar") : null,
        reviewable ? h("button", { class: "btn small", onclick: () => reject([it.id]) }, "✗ Descartar") : null,
        ["error", "stopped"].includes(it.status) || it.decision === "rejected" || reviewable ? h("button", { class: "btn small", title: "Volver a preguntar a la IA", onclick: () => retry([it.id]) }, "↻") : null));
  }
  function datalist() {
    const dl = h("datalist", { id: "dest-folders" });
    destFolders().then((list) => list.forEach((f) => dl.append(h("option", { value: f.rel }))));
    return dl;
  }
  function openViewer(it) {
    const list = visibleItems().map((x) => ({ path: x.decision === "applied" && x.dest ? x.dest : x.file, name: x.name, extra: x.proposal ? "IA: " + x.proposal : "", _id: x.id }));
    const i = list.findIndex((x) => x._id === it.id);
    Lightbox.open(list, i, {
      onMove: async (item, dest) => {
        const src = S.job.items.find((x) => x.id === item._id);
        const rel = relTo(App.cfg.settings.destination, dest);
        if (src && isReviewable(src) && rel !== null) { await applyItems([src.id], { [src.id]: rel }); return true; }
        return (await Images.moveFiles([item.path], dest)).length > 0;
      },
    });
  }
  async function applyItems(ids, override = {}) {
    if (!ids.length) return;
    const items = ids.map((id) => ({ id, dest: override[id] ?? S.edits[`${S.job.id}:${id}`] ?? S.job.items.find((i) => i.id === id)?.proposal }));
    try {
      const r = await POST(`/api/jobs/${S.job.id}/apply`, { items });
      ids.forEach((id) => S.sel.delete(id));
      toast(`${r.applied} imagen(es) ${S.job.mode === "copy" ? "copiadas" : "movidas"}${r.errors.length ? ` · ${r.errors.length} errores: ${r.errors[0]}` : ""}`,
        r.errors.length ? "error" : "ok", r.applied ? { label: "Deshacer", fn: async () => { await Images.undoLast(); refresh(true); } } : null);
      folderCache.time = 0;
      await refresh(true); loadJobs(); Main.refreshStats();
    } catch (e) { fail(e); }
  }
  async function reject(ids) {
    await POST(`/api/jobs/${S.job.id}/reject`, { ids }).catch(fail);
    ids.forEach((id) => S.sel.delete(id));
    refresh(true); loadJobs();
  }
  async function retry(ids) {
    await Main.flush();
    await POST(`/api/jobs/${S.job.id}/retry`, { ids }).catch(fail);
    await refresh(true); poll();
  }
  async function showPrompt() {
    await Main.flush();
    const r = await GET("/api/prompt").catch(fail);
    if (!r) return;
    const pre = h("pre", {}, r.prompt);
    modal({ title: "Prompt que recibe la IA con cada imagen", wide: true,
      body: h("div", {}, h("p", { class: "hint" }, "Se genera a partir del árbol, las descripciones, los grupos y las señales. Los valores ya usados de cada variable se actualizan durante la tanda."), pre),
      buttons: [{ label: "Copiar", value: null, check: async () => { await navigator.clipboard.writeText(r.prompt); toast("Copiado"); return false; } }, { label: "Cerrar", value: null, primary: true }] });
  }

  function init() {
    $("#run-pick").innerHTML = icon("folder");
    $("#run-pick").onclick = async () => {
      const r = await POST("/api/fs/pick", { initial: $("#run-source").value }).catch(fail);
      if (r?.path) { $("#run-source").value = r.path; saveForm(); }
    };
    $("#run-mode").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { setMode(b.dataset.mode); saveForm(); } });
    $("#run-threshold").oninput = () => { updateThreshold(); };
    $("#run-threshold").onchange = saveForm;
    for (const id of ["run-source", "run-limit", "run-threads"]) $("#" + id).addEventListener("change", saveForm);
    $("#run-start").onclick = (e) => start(e.currentTarget);
    $("#btn-undo-batch").onclick = async () => { await Images.undoLast(); refresh(true); };
    loadJobs();
    setInterval(() => { if (S.jobs.some((j) => !j.finished && !j.stopped) || document.visibilityState === "visible") loadJobs(); }, 5000);
  }

  return { init, initForm, startFiles, quickAsk, loadJobs, showPrompt, render };
})();
