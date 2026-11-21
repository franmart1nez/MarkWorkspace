/* Classification runs: start, live progress, review/correct proposals, apply and undo. */
"use strict";

const Classify = (() => {
  const S = { jobs: [], job: null, jobId: null, sel: new Set(), edits: {}, filter: "review", sort: "order", bulkMin: 70, pendingRender: false,
    folders: [], foldersLoaded: false, typing: null, recent: [] };
  let pollTimer = null;
  try { S.recent = JSON.parse(localStorage.getItem("clf.recentDest") || "[]"); } catch { /* ignore */ }

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
    if (!S.foldersLoaded) { S.foldersLoaded = true; destFolders().then((l) => { S.folders = l; render(); }).catch(() => {}); }
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
      h("button", { class: "btn small", disabled: !S.sel.size, title: "Elige una carpeta y mueve allí todas las seleccionadas", onclick: async () => {
        const ids = [...S.sel];
        const p = await pickFolder({ title: `Enviar ${ids.length} imagen(es) a…` });
        if (!p) return;
        const rel = relTo(App.cfg.settings.destination, p);
        if (!rel) return toast("Elige una subcarpeta dentro de Clasificadas", "error");
        applyItems(ids, Object.fromEntries(ids.map((id) => [id, rel])));
      } }, `Enviar seleccionadas a… (${S.sel.size})`),
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
    const thumb = h("img", { class: "thumb", loading: "lazy", src: thumbUrl(it.decision === "applied" && it.dest ? it.dest : it.file, 200), onclick: () => openViewer(it) });
    const edited = S.edits[editKey] !== undefined && S.edits[editKey] !== it.proposal;
    return h("div", { class: `ritem ${it.decision}`, "data-id": it.id },
      reviewable ? h("input", { type: "checkbox", checked: S.sel.has(it.id), onchange: (e) => { e.target.checked ? S.sel.add(it.id) : S.sel.delete(it.id); render(); } }) : h("span"),
      thumb,
      h("div", { class: "info" },
        h("div", { class: "row" }, h("span", { class: "fname grow", title: it.file }, it.name), statusBadge,
          it.confidence !== null && it.confidence !== undefined ? h("span", { class: "conf", title: "Confianza de la IA" },
            h("i", {}, h("b", { style: { width: it.confidence + "%", background: confColor(it.confidence, j.threshold) } })), it.confidence + "%") : null),
        it.status === "done" ? destEditor(it, editKey, reviewable) : null,
        edited && reviewable ? h("div", { class: "edited-note" }, `Cambiada por ti · la IA proponía ${it.proposal}`) : null,
        it.reason ? h("div", { class: "reason selectable" }, it.reason) : null,
        it.decision === "applied" && it.dest ? h("div", { class: "reason" }, "→ " + it.dest) : null,
        it.error ? h("div", { class: "err" }, it.error) : null),
      h("div", { class: "acts" },
        reviewable ? h("button", { class: "btn small primary", title: "Aplicar (Enter en la ruta)", onclick: () => applyItems([it.id]) }, "✓ Aplicar") : null,
        reviewable ? h("button", { class: "btn small", onclick: () => reject([it.id]) }, "✗ Descartar") : null,
        ["error", "stopped"].includes(it.status) || it.decision === "rejected" || reviewable ? h("button", { class: "btn small", title: "Volver a preguntar a la IA", onclick: () => retry([it.id]) }, "↻") : null));
  }
  /* ---------------------------------------------------------------- destination editor
     The proposal is shown as clickable folders: each one opens the alternatives at that level
     (tree folders, existing variable values, folders on disk), keeping the rest of the path when it still fits. */
  const splitRel = (s) => String(s || "").replace(/\\/g, "/").split("/").map((x) => x.trim()).filter(Boolean);
  const editKeyOf = (it) => `${S.job.id}:${it.id}`;
  const curParts = (it) => splitRel(S.edits[editKeyOf(it)] ?? it.proposal);
  function diskChildren(prefix) {
    const pre = prefix.join("/").toLowerCase();
    return S.folders.filter((f) => { const i = f.rel.lastIndexOf("/"); return (i < 0 ? "" : f.rel.slice(0, i).toLowerCase()) === pre; })
      .map((f) => baseName(f.rel));
  }
  function levelOptions(prefix) {
    const options = [], seen = new Set();
    const add = (name, hint) => { const k = norm(name); if (k && !seen.has(k)) { seen.add(k); options.push({ name, hint }); } };
    const node = Tree.nodeAtRel(prefix);
    const disk = diskChildren(prefix);
    let newLabel = "Nueva carpeta…", variable = null;
    if (node) {
      variable = node.children.find((c) => c.kind === "variable") || null;
      if (variable) { disk.forEach((d) => add(d, "")); newLabel = `Nuevo valor de {${variable.name}}…`; }
      else {
        node.children.forEach((c) => add(c.name, Tree.crit(c).description));
        if (!node.children.length && node.open) { disk.forEach((d) => add(d, "subcarpeta")); newLabel = "Nueva subcarpeta…"; }
      }
    }
    disk.forEach((d) => add(d, "solo en disco"));
    return { options, newLabel, variable };
  }
  /* Replaces level i and keeps the following folders while they still exist under the new branch. */
  function rebuild(parts, i, name) {
    const out = [...parts.slice(0, i), name];
    for (const t of parts.slice(i + 1)) {
      const node = Tree.nodeAtRel(out);
      const fixed = node?.children.find((c) => c.kind !== "variable" && norm(c.name) === norm(t));
      const fits = fixed || node?.children.some((c) => c.kind === "variable") || (node && !node.children.length && node.open) ||
        diskChildren(out).some((d) => norm(d) === norm(t));
      if (!fits) break;
      out.push(fixed ? fixed.name : t);
    }
    return out;
  }
  const needsMore = (parts) => !!Tree.nodeAtRel(parts)?.children.length;
  function setDest(it, parts, { next = true } = {}) {
    const key = editKeyOf(it), rel = parts.join("/");
    if (rel === it.proposal) delete S.edits[key]; else S.edits[key] = rel;
    render();
    if (next && needsMore(parts)) {
      const btn = $(`.ritem[data-id="${CSS.escape(it.id)}"] .seg-btn.need`);
      if (btn) chooseLevel(btn, it, parts.length);
    }
  }
  async function chooseLevel(anchor, it, i) {
    S.folders = await destFolders().catch(() => S.folders);
    const parts = curParts(it);
    const { options, newLabel, variable } = levelOptions(parts.slice(0, i));
    const cur = parts[i];
    const items = options.map((o) => ({ label: o.name, hint: o.hint, on: cur !== undefined && norm(o.name) === norm(cur),
      fn: () => setDest(it, rebuild(parts, i, o.name)) }));
    if (items.length) items.push("-");
    items.push({ label: newLabel, cls: "plain", always: true, fn: async (typed) => {
      const v = await promptBox(newLabel.replace("…", ""), `Dentro de ${parts.slice(0, i).join("/") || "Clasificadas"}`, typed || "");
      if (!v) return;
      const name = variable ? norm(v).replace(/[<>:"/\\|?*{}]/g, "").replace(/\s+/g, " ").trim() : Tree.cleanName(v);
      if (name) setDest(it, rebuild(parts, i, name));
    } });
    if (i > 0 && i < parts.length) items.push({ label: `Dejarla en «${parts[i - 1]}»`, cls: "plain", always: true, title: "Quita esta carpeta y las siguientes",
      fn: () => setDest(it, parts.slice(0, i), { next: false }) });
    popMenu(anchor, items, { placeholder: variable ? `Buscar o escribir ${variable.name}…` : "Buscar…" });
  }
  function destMenu(anchor, it) {
    const root = App.cfg.settings.destination;
    const now = curParts(it).join("/");
    const items = [];
    const recent = S.recent.filter((r) => r !== now);
    if (recent.length) {
      items.push({ header: "Usadas hace poco" });
      recent.forEach((r) => items.push({ label: r, fn: () => setDest(it, splitRel(r), { next: false }) }));
    }
    const shorts = App.shortcuts().map((p, k) => ({ rel: relTo(root, p), k })).filter((x) => x.rel);
    if (shorts.length) {
      items.push({ header: "Atajos" });
      shorts.forEach((x) => items.push({ label: x.rel, hint: `tecla ${x.k + 1}`, fn: () => setDest(it, splitRel(x.rel), { next: false }) }));
    }
    if (items.length) items.push("-");
    items.push({ label: "Buscar en todas las carpetas…", cls: "plain", fn: async () => {
      const p = await pickFolder({ title: "Destino para " + it.name });
      if (!p) return;
      const rel = relTo(root, p);
      if (!rel) return toast("Elige una subcarpeta dentro de Clasificadas", "error");
      setDest(it, splitRel(rel), { next: false });
    } });
    popMenu(anchor, items, { filter: false });
  }
  function destEditor(it, editKey, reviewable) {
    const value = S.edits[editKey] ?? it.proposal ?? "";
    if (!reviewable) return h("div", { class: "dest" }, h("span", { class: "dest-static" }, value));
    if (S.typing === editKey) {
      return h("div", { class: "dest" }, h("input", { value, list: "dest-folders",
        title: "Ruta dentro de Clasificadas. Enter aplica, Esc vuelve.",
        oninput: (e) => (S.edits[editKey] = e.target.value),
        onkeydown: (e) => {
          e.stopPropagation();
          if (e.key === "Enter") { e.preventDefault(); S.typing = null; e.target.blur(); applyItems([it.id]); }
          else if (e.key === "Escape") { e.preventDefault(); S.typing = null; e.target.blur(); }
        },
        onblur: () => { S.typing = null; setTimeout(render, 0); } }));
    }
    const parts = splitRel(value);
    const edited = S.edits[editKey] !== undefined && S.edits[editKey] !== it.proposal;
    const path = h("div", { class: "dest-path" + (edited ? " edited" : ""), title: "Clic en una carpeta para cambiarla por otra del mismo nivel" });
    parts.forEach((p, i) => {
      if (i) path.append(h("span", { class: "slash" }, "/"));
      path.append(h("button", { class: "seg-btn", onclick: (e) => chooseLevel(e.currentTarget, it, i) }, p));
    });
    const node = Tree.nodeAtRel(parts);
    if (node && node.children.length) {
      if (parts.length) path.append(h("span", { class: "slash" }, "/"));
      path.append(h("button", { class: "seg-btn add need", title: "Esta carpeta tiene subcarpetas: elige una", onclick: (e) => chooseLevel(e.currentTarget, it, parts.length) }, "elige… ▾"));
    } else if ((node && node.open) || diskChildren(parts).length) {
      path.append(h("button", { class: "seg-btn add", title: "Añadir una subcarpeta", onclick: (e) => chooseLevel(e.currentTarget, it, parts.length) }, "+"));
    }
    return h("div", { class: "dest" }, path,
      h("button", { class: "icon-btn", title: "Escribir la ruta a mano", html: icon("edit"), onclick: () => {
        S.typing = editKey; render();
        const inp = $(`.ritem[data-id="${CSS.escape(it.id)}"] .dest input`);
        if (inp) { inp.focus(); inp.select(); }
      } }),
      h("button", { class: "icon-btn", title: "Recientes, atajos o buscar entre todas las carpetas", html: icon("folder"), onclick: (e) => destMenu(e.currentTarget, it) }),
      edited ? h("button", { class: "icon-btn", title: `Volver a la propuesta de la IA (${it.proposal})`, html: icon("reset"), onclick: () => { delete S.edits[editKey]; render(); } }) : null);
  }
  function rememberDest(rels) {
    const used = [...new Set(rels.filter(Boolean))];
    if (!used.length) return;
    S.recent = [...used, ...S.recent.filter((r) => !used.includes(r))].slice(0, 8);
    try { localStorage.setItem("clf.recentDest", JSON.stringify(S.recent)); } catch { /* ignore */ }
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
      if (r.applied) rememberDest(items.map((x) => splitRel(x.dest).join("/")));
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
    $("#dup-open").innerHTML = icon("copies") + "Buscar imágenes repetidas";
    $("#dup-open").onclick = () => Dups.open();
    loadJobs();
    setInterval(() => { if (S.jobs.some((j) => !j.finished && !j.stopped) || document.visibilityState === "visible") loadJobs(); }, 5000);
  }

  return { init, initForm, startFiles, quickAsk, loadJobs, showPrompt, render, refresh };
})();

/* ==================================================================== repeated images */
const Dups = (() => {
  let timer = null;

  async function open() {
    const st = await GET("/api/dups").catch(fail);
    if (!st) return;
    const view = { body: h("div", {}) };
    modal({ title: "Imágenes repetidas", wide: true, body: view.body, buttons: [{ label: "Cerrar", value: null }] })
      .then(() => { clearInterval(timer); timer = null; });
    if (st.running) progress(view);
    else options(view, st);
  }

  function options(view, st) {
    const s = App.cfg.settings;
    const src = h("input", { type: "checkbox", checked: true });
    const rec = h("input", { type: "checkbox", checked: $("#run-recursive").checked });
    const lib = h("input", { type: "checkbox", checked: true });
    const level = h("select", {},
      h("option", { value: "exact" }, "Solo copias exactas (el mismo archivo)"),
      h("option", { value: "normal", selected: true }, "Casi idénticas: la misma imagen con otro tamaño, formato o compresión (recomendado)"),
      h("option", { value: "wide" }, "Parecidas: también retoques leves (puede dar falsos positivos)"));
    const go = h("button", { class: "btn primary", onclick: async () => {
      if (!src.checked && !lib.checked) return toast("Marca al menos una carpeta", "error");
      const r = await POST("/api/dups", { source: src.checked, recursive: rec.checked, destination: lib.checked, level: level.value }).catch(fail);
      if (r) progress(view);
    } }, "Buscar repetidas");
    view.body.innerHTML = "";
    view.body.append(h("div", { class: "dup-opts" },
      h("p", { class: "hint", style: { margin: 0 } }, "Compara el contenido de las imágenes (no el nombre) en este ordenador, sin gastar IA: encuentra copias exactas y la misma imagen guardada con otro tamaño, formato o compresión. Propone conservar la que ya está en Clasificadas o la de mayor resolución."),
      h("label", { class: "check" }, src, h("span", {}, "Sin clasificar (origen): ", h("code", {}, s.source))),
      h("label", { class: "check", style: { marginLeft: "24px" } }, rec, "Incluir sus subcarpetas"),
      h("label", { class: "check" }, lib, h("span", {}, "Clasificadas: ", h("code", {}, s.destination))),
      h("label", { class: "field", style: { margin: 0 } }, "Sensibilidad", level),
      h("div", { class: "btn-row" }, go,
        st.groups ? h("button", { class: "btn", onclick: () => results(view, st) }, `Ver la búsqueda anterior (${st.groups.length} grupos)`) : null)));
  }

  function progress(view) {
    const bar = h("i", { style: { width: "0%", background: "var(--accent)" } });
    const label = h("div", { class: "muted" }, "Empezando…");
    view.body.innerHTML = "";
    view.body.append(label, h("div", { class: "progress" }, bar),
      h("p", { class: "hint" }, "Puedes cerrar esta ventana: la búsqueda sigue y verás el resultado al volver a abrirla. La primera vez tarda más; después recuerda las imágenes ya analizadas."));
    clearInterval(timer);
    timer = setInterval(async () => {
      if (!view.body.isConnected) { clearInterval(timer); timer = null; return; }
      const st = await GET("/api/dups").catch(() => null);
      if (!st) return;
      label.textContent = st.total ? `${st.phase} ${st.done} / ${st.total}` : st.phase;
      bar.style.width = st.total ? (100 * st.done / st.total) + "%" : "0%";
      if (!st.running) {
        clearInterval(timer); timer = null;
        if (st.error) label.textContent = "Error: " + st.error;
        else results(view, st);
      }
    }, 600);
  }

  function results(view, st) {
    const groups = st.groups || [];
    view.body.innerHTML = "";
    const again = h("button", { class: "btn small", onclick: () => options(view, st) }, "Nueva búsqueda");
    if (!groups.length) {
      view.body.append(h("p", {}, `No hay imágenes repetidas entre las ${st.files} analizadas. ✔`), again);
      return;
    }
    const marked = new Set();
    groups.forEach((g) => g.items.forEach((m) => { if (!m.keep) marked.add(m.path); }));
    const trashBtn = h("button", { class: "btn danger" });
    const update = () => { trashBtn.textContent = `Enviar ${marked.size} marcadas a la papelera`; trashBtn.disabled = !marked.size; };
    trashBtn.onclick = async () => {
      const files = [...marked];
      if (!(await confirmBox("Enviar a la papelera", `${files.length} imagen(es) repetidas irán a la Papelera de reciclaje de Windows (se pueden recuperar desde allí).`, "Papelera", true))) return;
      const r = await POST("/api/fs/trash", { files }).catch(fail);
      if (!r) return;
      const bad = r.results.filter((x) => !x.ok);
      toast(`${files.length - bad.length} a la papelera${bad.length ? ` · ${bad.length} con error: ${bad[0].error}` : ""}`, bad.length ? "error" : "ok");
      Main.refreshStats(); Images.reload(); Classify.loadJobs(); Classify.refresh(true);
      const fresh = await GET("/api/dups").catch(() => null);
      if (fresh && view.body.isConnected) results(view, fresh);
    };
    const total = groups.reduce((a, g) => a + g.items.length, 0);
    view.body.append(h("div", { class: "dup-summary" },
      h("span", {}, `${groups.length} grupo(s) · ${total} imágenes repetidas de ${st.files} analizadas.`),
      h("span", { class: "muted" }, "Verde: se conserva · rojo: a la papelera. Clic en la miniatura para compararlas en grande."),
      h("span", { class: "grow" }), again, trashBtn));
    groups.forEach((g, gi) => view.body.append(groupEl(g, gi, marked, update)));
    update();
  }

  function groupEl(g, gi, marked, update) {
    const el = h("div", { class: "dup-group" });
    const draw = () => {
      el.innerHTML = "";
      const label = (m) => `${m.where === "clasificadas" ? "Clasificadas" : "Origen"}${m.folder ? " / " + m.folder : ""}`;
      el.append(h("div", { class: "g-top" }, h("b", {}, `Grupo ${gi + 1}`),
        h("span", { class: "badge " + (g.identical ? "ok" : "warn") }, g.identical ? "copias exactas" : `casi idénticas · diferencia ${g.distance}/64`),
        h("span", { class: "grow" }),
        h("button", { class: "btn small", onclick: () => { g.items.forEach((m) => marked.delete(m.path)); draw(); update(); } }, "Conservar todas")),
        h("div", { class: "dup-items" }, g.items.map((m, i) => {
          const drop = marked.has(m.path);
          return h("div", { class: "dup-item " + (drop ? "drop" : "keep"), title: m.path },
            h("img", { src: thumbUrl(m.path, 320), loading: "lazy",
              onclick: () => Lightbox.open(g.items.map((x) => ({ path: x.path, name: x.name, size: x.size, extra: label(x) })), i, { over: true }) }),
            h("span", { class: "where" + (m.where === "clasificadas" ? " lib" : "") }, m.where === "clasificadas" ? "Clasificadas" : "Origen"),
            h("div", { class: "nm" }, m.name),
            h("div", { class: "fd" }, `${m.w && m.h ? `${m.w}×${m.h} · ` : ""}${fmtSize(m.size)}`),
            h("div", { class: "fd", title: label(m) }, m.folder || "(raíz)"),
            h("label", { class: "check" }, h("input", { type: "checkbox", checked: drop,
              onchange: (e) => { e.target.checked ? marked.add(m.path) : marked.delete(m.path); draw(); update(); } }), "A la papelera"));
        })));
    };
    draw();
    return el;
  }

  return { open };
})();
