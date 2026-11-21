/* Visual folder-tree editor: layout, editing, groups, inspector and AI helpers. */
"use strict";

const App = {
  cfg: null, problems: [], stats: {}, sel: new Set(), primary: "root",
  collapsed: new Set(), orient: "v", view: { x: 60, y: 80, k: 1 },
  undo: [], redo: [], editKey: null, openGroup: null, clipboard: null, search: "",
  shortcuts() { return this.cfg?.settings?.shortcuts || []; },
};
try {
  App.collapsed = new Set(JSON.parse(localStorage.getItem("clf.collapsed") || "[]"));
  App.orient = localStorage.getItem("clf.orient") || "v";
} catch { /* storage unavailable */ }

const Tree = (() => {
  const W = 210, H = 96;
  let layout = {};
  let matches = [], matchIdx = -1;

  /* ================================================================ model */
  const seg = (n) => (n.kind === "variable" ? `{${n.name}}` : n.name);
  function* walk(n = App.cfg.root, path = [], parent = null) {
    yield { n, path, parent };
    for (const c of n.children) yield* walk(c, [...path, seg(c)], n);
  }
  function find(id) {
    for (const w of walk()) if (w.n.id === id) return w;
    return null;
  }
  const groupOf = (n) => App.cfg.groups.find((g) => g.id === n.group) || null;
  function crit(n) {
    const g = groupOf(n);
    const desc = [g?.description, n.description].filter((d) => d && d.trim()).join(". ");
    return { description: desc, own: n.description, group: g,
      include: [...new Set([...(g?.include || []), ...n.include])],
      exclude: [...new Set([...(g?.exclude || []), ...n.exclude])] };
  }
  const isAncestor = (a, b) => { for (const w of walk(a)) if (w.n.id === b.id && w.n !== a) return true; return false; };
  function uniqueName(parent, base, exceptId) {
    const taken = new Set(parent.children.filter((c) => c.id !== exceptId).map((c) => norm(c.name)));
    if (!taken.has(norm(base))) return base;
    let i = 2;
    while (taken.has(norm(`${base} ${i}`))) i++;
    return `${base} ${i}`;
  }
  const cleanName = (s) => String(s).replace(/[<>:"/\\|?*{}\x00-\x1f]/g, "").replace(/\s+/g, " ").trim().replace(/\.+$/, "");
  function newNode(name, extra = {}) {
    return { id: uid(), name, kind: "folder", description: "", include: [], exclude: [], group: null,
      open: false, openHint: "", children: [], ...extra };
  }
  function findByPath(str) {
    const parts = String(str || "").replace(/\\/g, "/").split("/").map((s) => s.trim()).filter(Boolean);
    let n = App.cfg.root;
    if (parts.length && norm(parts[0]) === norm(n.name) && !n.children.some((c) => norm(c.name) === norm(parts[0]))) parts.shift();
    for (const p of parts) {
      const q = norm(p.replace(/[{}]/g, ""));
      n = n.children.find((c) => norm(c.name) === q) || (n.children.length === 1 && n.children[0].kind === "variable" && p.startsWith("{") ? n.children[0] : null);
      if (!n) return null;
    }
    return n;
  }
  /* Tree node of a concrete folder below the destination (a variable matches any name); null when off the tree. */
  function nodeAtRel(parts) {
    let n = App.cfg.root;
    for (const p of parts) {
      const c = n.children.find((x) => x.kind === "variable") || n.children.find((x) => norm(x.name) === norm(p));
      if (!c) return null;
      n = c;
    }
    return n;
  }
  const hasVariableChild = (n, except) => n.children.some((c) => c.kind === "variable" && c !== except);
  function canHoldChild(parent, child) {
    if (hasVariableChild(parent, child)) return "Esa carpeta tiene una variable {…}: la variable debe ser su única subcarpeta";
    if (child.kind === "variable" && parent.children.some((c) => c !== child)) return "Una variable {…} debe ser la única subcarpeta de su carpeta";
    return null;
  }
  function allIdentifiers() {
    const count = {};
    const add = (v) => { const k = v.trim(); if (k) count[k] = (count[k] || 0) + 1; };
    for (const { n } of walk()) { n.include.forEach(add); n.exclude.forEach(add); }
    for (const g of App.cfg.groups) { g.include.forEach(add); g.exclude.forEach(add); }
    return Object.entries(count).map(([value, c]) => ({ value, count: c }));
  }

  /* ================================================================ undo */
  const snapshot = () => JSON.stringify({ root: App.cfg.root, groups: App.cfg.groups, settings: App.cfg.settings });
  function restore(s) { Object.assign(App.cfg, JSON.parse(s)); }
  function mutate(fn, { disk = [], keepEdit = false } = {}) {
    const before = snapshot();
    const res = fn();
    if (snapshot() === before) return res;
    if (!keepEdit) App.editKey = null;
    App.undo.push({ state: before, disk });
    if (App.undo.length > 150) App.undo.shift();
    App.redo = [];
    Main.changed();
    return res;
  }
  /* Typing in a field creates one undo step per field, not per keystroke. */
  function edit(key, fn) {
    if (App.editKey !== key) {
      App.undo.push({ state: snapshot(), disk: [] });
      App.redo = [];
      App.editKey = key;
    }
    fn();
    Main.changed({ soft: true });
  }
  function relocateAll(ops) {
    if (!ops.length || App.cfg.settings.syncDisk === false) return;
    (async () => {
      const moved = [], skipped = [];
      for (const op of ops) {
        try {
          const r = await POST("/api/fs/relocate", { old: op.old, new: op.new });
          moved.push(...r.moved); skipped.push(...r.skipped);
        } catch (e) { skipped.push(e.message); }
      }
      if (moved.length) toast(`Disco: ${moved.length} carpeta(s) renombrada(s)/movida(s)`, "ok");
      if (skipped.length) toast(`Disco: ${skipped.length} carpeta(s) sin mover — ${skipped[0]}`, "error", null, 9000);
      if (moved.length) Main.refreshStats();
    })();
  }
  function undo() {
    const e = App.undo.pop();
    if (!e) return toast("Nada que deshacer");
    App.redo.push({ state: snapshot(), disk: e.disk });
    restore(e.state);
    App.editKey = null;
    relocateAll([...e.disk].reverse().map((d) => ({ old: d.new, new: d.old })));
    Main.changed();
  }
  function redo() {
    const e = App.redo.pop();
    if (!e) return toast("Nada que rehacer");
    App.undo.push({ state: snapshot(), disk: e.disk });
    restore(e.state);
    App.editKey = null;
    relocateAll(e.disk);
    Main.changed();
  }

  /* ================================================================ operations */
  function select(id, mode = "single") {
    if (mode === "toggle") {
      if (App.sel.has(id) && App.sel.size > 1) { App.sel.delete(id); if (App.primary === id) App.primary = [...App.sel][0]; }
      else { App.sel.add(id); App.primary = id; }
    } else if (mode === "add") { App.sel.add(id); App.primary = id; }
    else { App.sel = new Set([id]); App.primary = id; }
    render(); Inspector.render();
  }
  function addChild(parentId, opts = {}) {
    const w = find(parentId);
    if (!w) return;
    const n = newNode(uniqueName(w.n, opts.name || "nueva carpeta"), opts.extra || {});
    const why = canHoldChild(w.n, n);
    if (why) return toast(why, "error");
    mutate(() => { w.n.children.push(n); App.collapsed.delete(w.n.id); });
    App.sel = new Set([n.id]); App.primary = n.id;
    render(); Inspector.render(); ensureVisible(n.id);
    if (!opts.silent) setTimeout(() => inlineRename(n.id), 30);
    return n;
  }
  function addSibling(id) {
    const w = find(id);
    if (!w || !w.parent) return addChild("root");
    const n = newNode(uniqueName(w.parent, "nueva carpeta"));
    const why = canHoldChild(w.parent, n);
    if (why) return toast(why, "error");
    mutate(() => w.parent.children.splice(w.parent.children.indexOf(w.n) + 1, 0, n));
    App.sel = new Set([n.id]); App.primary = n.id;
    render(); Inspector.render(); ensureVisible(n.id);
    setTimeout(() => inlineRename(n.id), 30);
  }
  function rename(id, name) {
    const w = find(id);
    if (!w || id === "root") return;
    name = cleanName(name);
    if (w.n.kind === "variable") name = norm(name).replace(/\s+/g, "_");
    if (!name || name === w.n.name) return;
    const unique = uniqueName(w.parent, name, id);
    if (unique !== name) toast(`Ya existe «${name}» aquí; se llamará «${unique}»`);
    const oldPath = w.path;
    mutate(() => (w.n.name = unique), { disk: w.n.kind === "variable" ? [] : [{ old: oldPath, new: [...oldPath.slice(0, -1), unique] }] });
    if (w.n.kind !== "variable") relocateAll([{ old: oldPath, new: [...oldPath.slice(0, -1), unique] }]);
  }
  function setKind(id, kind) {
    const w = find(id);
    if (!w || id === "root" || w.n.kind === kind) return;
    if (kind === "variable" && w.parent.children.length > 1) return toast("Una variable {…} debe ser la única subcarpeta de su carpeta", "error");
    mutate(() => { w.n.kind = kind; if (kind === "variable") w.n.name = norm(w.n.name).replace(/\s+/g, "_"); });
    toast(kind === "variable" ? "Ahora la IA escribirá el nombre de esta carpeta (p. ej. cada especie tendrá la suya)" : "Ahora es una carpeta con nombre fijo");
  }
  function topLevelSelection() {
    const ids = [...App.sel].filter((id) => id !== "root");
    return ids.map(find).filter((w) => w && !ids.some((o) => o !== w.n.id && isAncestor(find(o).n, w.n)));
  }
  async function remove(ids = [...App.sel]) {
    const ws = ids.filter((id) => id !== "root").map(find).filter(Boolean);
    if (!ws.length) return;
    const branches = ws.reduce((a, w) => a + [...walk(w.n)].length, 0);
    const imgs = ws.reduce((a, w) => a + (App.stats[w.n.id]?.images || 0), 0);
    if (branches > 1 || imgs) {
      const ok = await confirmBox("Eliminar del árbol",
        `Se eliminarán ${branches} carpeta(s) del árbol.${imgs ? ` En disco tienen ${imgs} imágenes: NO se borran ni se mueven.` : ""}`, "Eliminar", true);
      if (!ok) return;
    }
    const parent = ws[0].parent;
    mutate(() => { for (const w of ws) { const p = find(w.n.id)?.parent; if (p) p.children = p.children.filter((c) => c !== w.n); } });
    App.sel = new Set([parent?.id || "root"]); App.primary = parent?.id || "root";
    render(); Inspector.render();
  }
  function clone(n) { const c = JSON.parse(JSON.stringify(n)); for (const w of walk(c)) w.n.id = uid(); return c; }
  function duplicate(id) {
    const w = find(id);
    if (!w || !w.parent) return;
    if (w.n.kind === "variable") return toast("Una variable no puede tener hermanas", "error");
    const c = clone(w.n);
    c.name = uniqueName(w.parent, w.n.name + " copia");
    mutate(() => w.parent.children.splice(w.parent.children.indexOf(w.n) + 1, 0, c));
    select(c.id); ensureVisible(c.id);
  }
  function copyBranch() { const w = find(App.primary); if (w && w.parent) { App.clipboard = JSON.stringify(w.n); toast(`Rama «${w.n.name}» copiada`); } }
  function pasteBranch() {
    if (!App.clipboard) return;
    const target = find(App.primary);
    const c = clone(JSON.parse(App.clipboard));
    const why = canHoldChild(target.n, c);
    if (why) return toast(why, "error");
    c.name = uniqueName(target.n, c.name);
    mutate(() => { target.n.children.push(c); App.collapsed.delete(target.n.id); });
    select(c.id); ensureVisible(c.id);
  }
  function reorder(id, delta) {
    const w = find(id);
    if (!w || !w.parent) return;
    const arr = w.parent.children, i = arr.indexOf(w.n), j = i + delta;
    if (j < 0 || j >= arr.length) return;
    mutate(() => { arr.splice(i, 1); arr.splice(j, 0, w.n); });
  }
  function move(ids, targetId, zone) {
    const target = find(targetId);
    if (!target) return;
    const newParent = zone === "child" ? target.n : target.parent;
    if (!newParent) return;
    const items = ids.map(find).filter((w) => w && w.n.id !== "root");
    for (const w of items) {
      if (w.n === target.n || isAncestor(w.n, target.n)) return toast("No puedes mover una carpeta dentro de sí misma", "error");
    }
    for (const w of items) {
      if (w.parent === newParent) continue;
      const why = canHoldChild(newParent, w.n);
      if (why) return toast(why, "error");
    }
    const ops = [];
    mutate(() => {
      for (const w of items) {
        const oldPath = find(w.n.id).path;
        w.parent.children = w.parent.children.filter((c) => c !== w.n);
        if (w.parent !== newParent) w.n.name = uniqueName(newParent, w.n.name, w.n.id);
        let idx = newParent.children.length;
        if (zone !== "child") idx = newParent.children.indexOf(target.n) + (zone === "after" ? 1 : 0);
        newParent.children.splice(idx, 0, w.n);
        const newPath = find(w.n.id).path;
        if (oldPath.join("/") !== newPath.join("/")) ops.push({ old: oldPath, new: newPath });
      }
      App.collapsed.delete(newParent.id);
    }, { disk: ops });
    relocateAll(ops);
  }

  /* ================================================================ layout & render */
  function computeLayout() {
    layout = {};
    const v = App.orient === "v";
    const gx = v ? 22 : 90, gy = v ? 60 : 14;
    let next = 0;
    const place = (n, depth, parent) => {
      const kids = App.collapsed.has(n.id) ? [] : n.children;
      let pos;
      if (!kids.length) { pos = next; next += v ? W + gx : H + gy; }
      else { const ps = kids.map((c) => place(c, depth + 1, n)); pos = (ps[0] + ps[ps.length - 1]) / 2; }
      layout[n.id] = v ? { x: pos, y: depth * (H + gy), parent, n } : { x: depth * (W + gx), y: pos, parent, n };
      return pos;
    };
    place(App.cfg.root, 0, null);
  }
  function problemsFor(id) { return App.problems.filter((p) => p.node === id); }

  function card(n) {
    const L = layout[n.id];
    const st = App.stats[n.id] || {};
    const isRoot = n.id === "root";
    const cr = crit(n);
    const g = cr.group;
    const probs = problemsFor(n.id);
    const cls = ["node", isRoot && "root", n.kind === "variable" && "variable", App.sel.has(n.id) && "sel",
      App.primary === n.id && "primary", !n.children.length && "leaf"];
    if (App.search) cls.push(matches.includes(n.id) ? "match" : "dim");
    const el = h("div", { class: cls.filter(Boolean).join(" "), "data-id": n.id,
      style: { left: L.x + "px", top: L.y + "px", ...(g ? { "--gc": g.color } : {}) } });
    const kind = isRoot ? "DESTINO" : n.kind === "variable" ? "{ }" : n.children.length ? "" : "▣";
    let descEl;
    if (isRoot) descEl = h("div", { class: "n-desc inherited" }, App.cfg.settings.destination);
    else if (n.description) descEl = h("div", { class: "n-desc" }, n.description);
    else if (g?.description) descEl = h("div", { class: "n-desc inherited" }, g.description);
    else descEl = h("div", { class: "n-desc empty" }, n.kind === "variable" ? "Describe qué nombre debe escribir la IA…" : "Doble clic para describir…");
    const foot = h("div", { class: "n-foot" });
    if (g) foot.append(h("span", { class: "n-chip group" }, "● " + g.name));
    if (n.kind === "variable" && st.values?.length) foot.append(h("span", { class: "n-chip open" }, `${st.values.length} valores`));
    if (n.open) foot.append(h("span", { class: "n-chip open", title: n.openHint }, "+ subcarpetas IA"));
    if (cr.include.length) foot.append(h("span", { class: "n-chip", title: cr.include.join(", ") }, `${cr.include.length} señales`));
    if (probs.length) foot.append(h("span", { class: "n-chip warn", title: probs.map((p) => p.message).join("\n") }, "⚠"));
    el.append(
      h("div", { class: "n-head" }, kind ? h("span", { class: "n-kind" }, kind) : null,
        h("span", { class: "n-name", title: seg(n) }, isRoot ? baseName(App.cfg.settings.destination) || n.name : n.name),
        st.images ? h("span", { class: "n-count", title: "Imágenes en disco (incluye subcarpetas)" }, st.images) : null),
      descEl, foot,
      h("button", { class: "n-add", title: "Añadir subcarpeta (Tab)", "data-act": "add" }, "+"));
    if (n.children.length) el.append(h("button", { class: "n-toggle", "data-act": "toggle", title: App.collapsed.has(n.id) ? "Expandir" : "Contraer" },
      App.collapsed.has(n.id) ? `▸ ${[...walk(n)].length - 1}` : "▾"));
    return el;
  }

  function render() {
    if (!App.cfg) return;
    computeLayout();
    const world = $("#world"), nodes = $("#nodes"), svg = $("#links");
    world.className = "world " + App.orient;
    nodes.innerHTML = "";
    const v = App.orient === "v";
    let maxX = 0, maxY = 0, paths = "";
    for (const L of Object.values(layout)) {
      maxX = Math.max(maxX, L.x + W); maxY = Math.max(maxY, L.y + H);
      nodes.append(card(L.n));
      if (L.parent) {
        const P = layout[L.parent.id];
        const hot = App.sel.has(L.n.id) ? "hot" : "";
        if (v) {
          const x1 = P.x + W / 2, y1 = P.y + H, x2 = L.x + W / 2, y2 = L.y, my = y1 + (y2 - y1) / 2;
          paths += `<path class="${hot}" d="M${x1} ${y1} V${my - 8} Q${x1} ${my} ${x1 + Math.sign(x2 - x1) * 8} ${my} H${x2 - Math.sign(x2 - x1) * 8} Q${x2} ${my} ${x2} ${my + 8} V${y2}"/>`;
        } else {
          const x1 = P.x + W, y1 = P.y + H / 2, x2 = L.x, y2 = L.y + H / 2, mx = x1 + (x2 - x1) / 2;
          paths += `<path class="${hot}" d="M${x1} ${y1} H${mx - 8} Q${mx} ${y1} ${mx} ${y1 + Math.sign(y2 - y1) * 8} V${y2 - Math.sign(y2 - y1) * 8} Q${mx} ${y2} ${mx + 8} ${y2} H${x2}"/>`;
        }
      }
    }
    svg.setAttribute("width", maxX + 40); svg.setAttribute("height", maxY + 40);
    svg.innerHTML = paths.replace(/NaN/g, "0");
    applyView();
    $$("#orient button").forEach((b) => b.classList.toggle("active", b.dataset.o === App.orient));
    renderGroups(); renderProblems();
  }
  function applyView() { $("#world").style.transform = `translate(${App.view.x}px, ${App.view.y}px) scale(${App.view.k})`; }
  function fit() {
    computeLayout();
    const ls = Object.values(layout);
    const minX = Math.min(...ls.map((l) => l.x)), minY = Math.min(...ls.map((l) => l.y));
    const maxX = Math.max(...ls.map((l) => l.x + W)), maxY = Math.max(...ls.map((l) => l.y + H));
    const r = $("#canvas").getBoundingClientRect();
    const k = Math.min(1.1, (r.width - 60) / (maxX - minX), (r.height - 110) / (maxY - minY));
    App.view = { k: Math.max(0.55, k), x: 0, y: 0 };
    App.view.x = (r.width - (maxX - minX) * App.view.k) / 2 - minX * App.view.k;
    App.view.y = 60 + (r.height - 80 - (maxY - minY) * App.view.k) / 2 - minY * App.view.k;
    if (k < 0.55) {
      // Too big to fit legibly: keep the root in view and let the user pan.
      const R = layout.root;
      if (App.orient === "v") { App.view.x = r.width / 2 - (R.x + W / 2) * App.view.k; App.view.y = 64; }
      else { App.view.x = 24; App.view.y = r.height / 2 - (R.y + H / 2) * App.view.k; }
    }
    applyView();
  }
  function ensureVisible(id, center = false) {
    const L = layout[id];
    if (!L) return;
    const r = $("#canvas").getBoundingClientRect(), k = App.view.k;
    const sx = L.x * k + App.view.x, sy = L.y * k + App.view.y;
    if (center || sx < 20 || sy < 60 || sx + W * k > r.width - 20 || sy + H * k > r.height - 20) {
      App.view.x = r.width / 2 - (L.x + W / 2) * k;
      App.view.y = r.height / 2 - (L.y + H / 2) * k;
      applyView();
    }
  }
  function revealNode(id) {
    let w = find(id);
    while (w && w.parent) { App.collapsed.delete(w.parent.id); w = find(w.parent.id); }
    select(id); ensureVisible(id, true);
  }

  /* ================================================================ inline editing */
  function inlineRename(id) {
    const el = $(`.node[data-id="${id}"]`);
    const w = find(id);
    if (!el || !w || id === "root") return;
    const inp = h("input", { class: "inline", value: w.n.name });
    el.append(inp); inp.focus(); inp.select();
    let done = false;
    const finish = (save, then) => {
      if (done) return; done = true;
      const v = inp.value; inp.remove();
      if (save) rename(id, v);
      render(); Inspector.render();
      if (then) then();
    };
    inp.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") finish(true);
      else if (e.key === "Escape") finish(false);
      else if (e.key === "Tab") { e.preventDefault(); finish(true, () => (e.shiftKey ? addSibling(id) : addChild(id))); }
    });
    inp.addEventListener("blur", () => finish(true));
    inp.addEventListener("pointerdown", (e) => e.stopPropagation());
  }
  function inlineDesc(id) {
    const el = $(`.node[data-id="${id}"]`);
    const w = find(id);
    if (!el || !w || id === "root") return;
    const ta = h("textarea", { class: "inline", placeholder: crit(w.n).group ? "Detalle extra (se suma al grupo)…" : "¿Qué imágenes van aquí? Sé concreto y visual…" });
    ta.value = w.n.description;
    el.append(ta); ta.focus();
    let done = false;
    const finish = (save) => {
      if (done) return; done = true;
      const v = ta.value.trim(); ta.remove();
      if (save && v !== w.n.description) mutate(() => (w.n.description = v));
      render(); Inspector.render();
    };
    ta.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); finish(true); }
      else if (e.key === "Escape") finish(false);
    });
    ta.addEventListener("blur", () => finish(true));
    ta.addEventListener("pointerdown", (e) => e.stopPropagation());
  }

  /* ================================================================ canvas interaction */
  function initCanvas() {
    const canvas = $("#canvas");
    let pan = null, drag = null;

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const k0 = App.view.k, k = Math.max(0.12, Math.min(2.5, k0 * Math.exp(-e.deltaY * 0.0015)));
      App.view.x = mx - (mx - App.view.x) * (k / k0);
      App.view.y = my - (my - App.view.y) * (k / k0);
      App.view.k = k;
      applyView();
    }, { passive: false });

    canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest(".canvas-toolbar, input, textarea, button")) return;
      window.getSelection()?.removeAllRanges();
      const nodeEl = e.target.closest(".node");
      if (nodeEl) {
        drag = { id: nodeEl.dataset.id, el: nodeEl, sx: e.clientX, sy: e.clientY, moved: false, target: null, zone: null };
      } else {
        pan = { sx: e.clientX, sy: e.clientY, vx: App.view.x, vy: App.view.y, moved: false };
        canvas.classList.add("panning");
      }
      canvas.setPointerCapture(e.pointerId);
      canvas.focus({ preventScroll: true });
    });
    canvas.addEventListener("pointermove", (e) => {
      if (pan) {
        const dx = e.clientX - pan.sx, dy = e.clientY - pan.sy;
        if (Math.abs(dx) + Math.abs(dy) > 3) pan.moved = true;
        App.view.x = pan.vx + dx; App.view.y = pan.vy + dy; applyView();
      } else if (drag) {
        const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
        if (drag.id === "root") return;
        drag.moved = true;
        drag.el.classList.add("dragging");
        drag.el.style.transform = `translate(${dx / App.view.k}px, ${dy / App.view.k}px)`;
        $$(".node.drop-child, .node.drop-before, .node.drop-after").forEach((n) => n.classList.remove("drop-child", "drop-before", "drop-after"));
        const t = document.elementFromPoint(e.clientX, e.clientY)?.closest(".node");
        drag.target = null;
        if (t && t !== drag.el) {
          const r = t.getBoundingClientRect();
          const f = App.orient === "v" ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height;
          let zone = f < 0.22 ? "before" : f > 0.78 ? "after" : "child";
          if (t.dataset.id === "root") zone = "child";
          t.classList.add("drop-" + zone);
          drag.target = t.dataset.id; drag.zone = zone;
        }
      }
    });
    const end = (e) => {
      canvas.classList.remove("panning");
      if (pan) {
        if (!pan.moved && !e.target.closest(".node")) { App.sel = new Set(); App.primary = null; render(); Inspector.render(); }
        pan = null;
      } else if (drag) {
        const d = drag; drag = null;
        if (d.moved) {
          d.el.classList.remove("dragging"); d.el.style.transform = "";
          if (d.target) {
            const ids = App.sel.has(d.id) && App.sel.size > 1 ? topLevelSelection().map((w) => w.n.id) : [d.id];
            move(ids, d.target, d.zone);
          }
          render();
        } else {
          const act = e.target.closest("[data-act]")?.dataset.act;
          if (act === "add") return addChild(d.id);
          if (act === "toggle") { App.collapsed.has(d.id) ? App.collapsed.delete(d.id) : App.collapsed.add(d.id); saveLocal(); return render(); }
          select(d.id, e.ctrlKey || e.metaKey ? "toggle" : e.shiftKey ? "add" : "single");
        }
      }
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", () => { pan = null; if (drag) { drag.el.style.transform = ""; drag = null; render(); } });

    canvas.addEventListener("dblclick", (e) => {
      const el = e.target.closest(".node");
      if (!el) return;
      if (e.target.closest(".n-name")) inlineRename(el.dataset.id);
      else inlineDesc(el.dataset.id);
    });
    canvas.addEventListener("contextmenu", (e) => {
      const el = e.target.closest(".node");
      if (!el) return;
      e.preventDefault();
      const id = el.dataset.id;
      if (!App.sel.has(id)) select(id);
      const w = find(id);
      const items = [
        { label: "Añadir subcarpeta  (Tab)", fn: () => addChild(id) },
        ...(id !== "root" ? [{ label: "Añadir hermana  (Enter)", fn: () => addSibling(id) },
          { label: "Renombrar  (F2)", fn: () => inlineRename(id) },
          { label: "Editar descripción", fn: () => inlineDesc(id) },
          { label: "Duplicar rama  (Ctrl+D)", fn: () => duplicate(id) },
          { label: "Copiar rama  (Ctrl+C)", fn: copyBranch }] : []),
        ...(App.clipboard ? [{ label: "Pegar rama dentro  (Ctrl+V)", fn: pasteBranch }] : []),
        "-",
        { label: "✨ Sugerir subcarpetas con IA", fn: () => Inspector.suggestChildren(id) },
        ...(id !== "root" ? [{ label: "✨ Generar descripción con IA", fn: () => { select(id); Inspector.generate(); } },
          { label: "✨ Analizar imágenes y mejorar descripción", fn: () => Inspector.improve(id) },
          ...(w.n.children.length ? [{ label: "✨ Mejorar toda la rama en lote…", fn: () => Inspector.improveBatch(id) }] : []),
          { label: w.n.kind === "variable" ? "Convertir en carpeta fija" : "Convertir en variable {…}", fn: () => setKind(id, w.n.kind === "variable" ? "folder" : "variable") },
          { label: `Seleccionar todas las «${w.n.name}»`, fn: () => selectSameName(id) }] : []),
        { label: "Ver imágenes", fn: () => Inspector.openImages(id) },
        ...(id !== "root" ? ["-", { label: "Eliminar del árbol  (Supr)", fn: () => remove() }] : []),
      ];
      contextMenu(e.clientX, e.clientY, items);
    });

    canvas.addEventListener("keydown", (e) => {
      if (e.target !== canvas) return;
      const id = App.primary;
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.key === "Tab" && id) { e.preventDefault(); addChild(id); }
      else if (e.key === "Enter" && id) { e.preventDefault(); addSibling(id); }
      else if (e.key === "F2" && id) { e.preventDefault(); inlineRename(id); }
      else if ((e.key === "Delete" || e.key === "Backspace") && App.sel.size) { e.preventDefault(); remove(); }
      else if (ctrl && e.key.toLowerCase() === "d" && id) { e.preventDefault(); duplicate(id); }
      else if (ctrl && e.key.toLowerCase() === "c") { copyBranch(); }
      else if (ctrl && e.key.toLowerCase() === "v") { pasteBranch(); }
      else if (ctrl && e.key.toLowerCase() === "a") { e.preventDefault(); App.sel = new Set([...walk()].map((w) => w.n.id)); render(); Inspector.render(); }
      else if (e.key.toLowerCase() === "f" && !ctrl) fit();
      else if (e.key === "Escape") { App.sel = new Set(); App.primary = null; render(); Inspector.render(); }
      else if (e.key.startsWith("Arrow") && id) { e.preventDefault(); navigate(id, e.key); }
    });

    $("#orient").addEventListener("click", (e) => {
      const o = e.target.dataset.o;
      if (o) { App.orient = o; saveLocal(); render(); fit(); }
    });
    $("#btn-fit").onclick = fit;
    $("#btn-expand").onclick = () => { App.collapsed.clear(); saveLocal(); render(); fit(); };
    $("#btn-collapse").onclick = () => {
      for (const { n, path } of walk()) if (n.children.length && path.length >= 2) App.collapsed.add(n.id);
      saveLocal(); render(); fit();
    };
    const search = $("#tree-search");
    search.addEventListener("input", () => { App.search = search.value; updateMatches(); render(); });
    search.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter" && matches.length) {
        matchIdx = (matchIdx + (e.shiftKey ? -1 : 1) + matches.length) % matches.length;
        revealNode(matches[matchIdx]);
      } else if (e.key === "Escape") { search.value = ""; App.search = ""; updateMatches(); render(); canvas.focus(); }
    });
  }
  function navigate(id, key) {
    const w = find(id);
    if (!w) return;
    const v = App.orient === "v";
    const toParent = v ? "ArrowUp" : "ArrowLeft", toChild = v ? "ArrowDown" : "ArrowRight";
    const prev = v ? "ArrowLeft" : "ArrowUp";
    let t = null;
    if (key === toParent) t = w.parent;
    else if (key === toChild) t = App.collapsed.has(id) ? null : w.n.children[0];
    else if (w.parent) {
      const sib = w.parent.children, i = sib.indexOf(w.n);
      t = sib[i + (key === prev ? -1 : 1)];
    }
    if (t) { select(t.id); ensureVisible(t.id); }
  }
  function updateMatches() {
    const q = norm(App.search);
    matches = [];
    matchIdx = -1;
    if (q) for (const { n } of walk()) {
      const g = groupOf(n);
      const hay = norm([n.name, n.description, ...n.include, ...n.exclude, g?.name, g?.description].join(" "));
      if (hay.includes(q)) matches.push(n.id);
    }
    $("#search-count").textContent = q ? `${matches.length}` : "";
  }
  function selectSameName(id) {
    const name = norm(find(id).n.name);
    App.sel = new Set([...walk()].filter((w) => norm(w.n.name) === name).map((w) => w.n.id));
    App.primary = id;
    render(); Inspector.render();
    toast(`${App.sel.size} carpetas «${find(id).n.name}» seleccionadas`);
  }
  function saveLocal() {
    try {
      localStorage.setItem("clf.collapsed", JSON.stringify([...App.collapsed]));
      localStorage.setItem("clf.orient", App.orient);
    } catch { /* ignore */ }
  }

  /* ================================================================ groups */
  function renderGroups() {
    const list = $("#groups-list");
    if (list.contains(document.activeElement) && document.activeElement.matches("input, textarea")) return;
    list.innerHTML = "";
    if (!App.cfg.groups.length) list.append(h("p", { class: "hint" }, "Aún no hay grupos."));
    for (const g of App.cfg.groups) {
      const members = [...walk()].filter((w) => w.n.group === g.id);
      const open = App.openGroup === g.id;
      const c = h("div", { class: "group-card" + (open ? " open" : ""), style: { "--gc": g.color } },
        h("div", { class: "g-head", onclick: () => { App.openGroup = open ? null : g.id; renderGroups(); } },
          h("span", { class: "g-name" }, g.name), h("span", { class: "muted" }, `${members.length}`)),
        !open ? h("div", { class: "g-desc" }, g.description || "Sin descripción") : null);
      if (open) {
        const key = (f) => `group:${g.id}:${f}`;
        c.append(h("div", { class: "g-edit" },
          h("div", { class: "row" },
            h("input", { type: "color", value: g.color, oninput: (e) => edit(key("color"), () => { g.color = e.target.value; render(); }) }),
            h("input", { value: g.name, oninput: (e) => edit(key("name"), () => (g.name = e.target.value)), onchange: () => render() })),
          h("textarea", { rows: 3, placeholder: "Descripción compartida por todas las carpetas del grupo",
            value: g.description, oninput: (e) => edit(key("desc"), () => (g.description = e.target.value)), onchange: () => render() }),
          h("div", { class: "muted" }, "Señales"),
          chipInput({ values: g.include, suggestions: allIdentifiers, onChange: (v) => mutate(() => (g.include = v)) }),
          h("div", { class: "muted" }, "No va si…"),
          chipInput({ values: g.exclude, suggestions: allIdentifiers, onChange: (v) => mutate(() => (g.exclude = v)) }),
          h("div", { class: "btn-row" },
            h("button", { class: "btn small", onclick: () => {
              App.sel = new Set(members.map((w) => w.n.id)); App.primary = members[0]?.n.id || null;
              members.forEach((w) => revealAncestors(w.n.id)); render(); Inspector.render(); fit();
            } }, `Seleccionar ${members.length}`),
            App.sel.size ? h("button", { class: "btn small", onclick: () => assignGroup([...App.sel], g.id) }, "Asignar a selección") : null,
            h("button", { class: "btn small ai", title: "La IA mira imágenes de todas las carpetas del grupo y mejora su descripción compartida",
              onclick: () => Inspector.improveBatch(null, [{ kind: "group", id: g.id }]) }, h("span", { class: "i-spark" }), "Mejorar con IA"),
            h("button", { class: "btn small danger", onclick: async () => {
              if (!(await confirmBox("Eliminar grupo", `Las ${members.length} carpetas dejarán de compartir esta descripción.`, "Eliminar", true))) return;
              mutate(() => { App.cfg.groups = App.cfg.groups.filter((x) => x !== g); members.forEach((w) => (w.n.group = null)); });
            } }, "Eliminar"))));
      }
      list.append(c);
    }
    const repeated = repeatedNames();
    if (repeated.length) list.append(h("button", { class: "btn small", style: { width: "100%", justifyContent: "center" }, onclick: groupRepeated },
      `Agrupar nombres repetidos (${repeated.length})`));
  }
  function revealAncestors(id) { let w = find(id); while (w && w.parent) { App.collapsed.delete(w.parent.id); w = find(w.parent.id); } }
  function newGroup(fromId) {
    const colors = ["#6c8cd5", "#4cb782", "#e3a33b", "#e2605f", "#b48cff", "#3fb8c4", "#d580b5", "#a3b84c"];
    const src = fromId ? find(fromId)?.n : null;
    const g = { id: uid(), name: src ? src.name : "Nuevo grupo", color: colors[App.cfg.groups.length % colors.length],
      description: src?.description || "", include: [...(src?.include || [])], exclude: [...(src?.exclude || [])] };
    mutate(() => {
      App.cfg.groups.push(g);
      if (src) {
        const ids = App.sel.size > 1 ? [...App.sel] : [src.id];
        for (const id of ids) { const n = find(id)?.n; if (n && n.id !== "root") { n.group = g.id; n.description = ""; n.include = []; n.exclude = []; } }
      }
    });
    App.openGroup = g.id;
    render(); Inspector.render();
    return g;
  }
  function assignGroup(ids, gid) {
    mutate(() => { for (const id of ids) { const n = find(id)?.n; if (n && n.id !== "root") n.group = gid || null; } });
    render(); Inspector.render();
  }
  function repeatedNames() {
    const by = {};
    for (const { n } of walk()) if (n.id !== "root" && !n.group && n.kind !== "variable") (by[norm(n.name)] ||= []).push(n);
    return Object.values(by).filter((a) => a.length > 1);
  }
  async function groupRepeated() {
    const sets = repeatedNames();
    const checks = sets.map(() => h("input", { type: "checkbox", checked: true }));
    const body = h("div", {}, h("p", { class: "hint" }, "Crea un grupo por cada nombre repetido. La descripción del grupo se toma de la primera carpeta que la tenga."),
      sets.map((s, i) => h("label", { class: "check", style: { display: "flex", margin: "6px 0" } }, checks[i],
        h("b", {}, s[0].name), h("span", { class: "muted" }, ` — ${s.length} carpetas · ${s.map((n) => find(n.id).path.slice(-2, -1)[0] || "raíz").join(", ")}`))));
    const ok = await modal({ title: "Agrupar nombres repetidos", body, buttons: [{ label: "Cancelar", value: false }, { label: "Crear grupos", value: true, primary: true, cls: "primary" }] });
    if (!ok) return;
    const colors = ["#6c8cd5", "#4cb782", "#e3a33b", "#e2605f", "#b48cff", "#3fb8c4", "#d580b5"];
    mutate(() => sets.forEach((s, i) => {
      if (!checks[i].checked) return;
      const base = s.find((n) => n.description) || s[0];
      const g = { id: uid(), name: s[0].name, color: colors[(App.cfg.groups.length) % colors.length], description: base.description,
        include: [...new Set(s.flatMap((n) => n.include))], exclude: [...new Set(s.flatMap((n) => n.exclude))] };
      App.cfg.groups.push(g);
      s.forEach((n) => { n.group = g.id; n.description = n.description === base.description ? "" : n.description; n.include = []; n.exclude = []; });
    }));
  }
  function renderProblems() {
    const list = $("#problems-list");
    list.innerHTML = "";
    $("#problem-count").textContent = App.problems.length ? `${App.problems.length}` : "";
    if (!App.problems.length) { list.append(h("p", { class: "hint" }, "Sin problemas. ✔")); return; }
    for (const p of App.problems.slice(0, 40)) {
      list.append(h("div", { class: `problem ${p.level}`, onclick: () => p.node && revealNode(p.node) }, p.message));
    }
  }

  return { W, H, seg, walk, find, crit, groupOf, mutate, edit, undo, redo, render, fit, select, addChild, addSibling,
    rename, setKind, remove, duplicate, reorder, move, newGroup, assignGroup, revealNode, initCanvas, findByPath, nodeAtRel,
    allIdentifiers, uniqueName, newNode, canHoldChild, cleanName, inlineRename, updateMatches, selectSameName, ensureVisible };
})();

/* ==================================================================== inspector */
const Inspector = (() => {
  const box = () => $("#inspector");

  function render() {
    const el = box();
    if (el.contains(document.activeElement) && document.activeElement.matches("input, textarea, select")) return;
    el.innerHTML = "";
    if (!App.cfg) return;
    if (App.sel.size > 1) return renderMulti(el);
    const w = App.primary ? Tree.find(App.primary) : null;
    if (!w) {
      el.append(h("p", { class: "hint" }, "Selecciona una carpeta del árbol para editar su descripción, sus señales y su grupo."),
        h("p", { class: "hint" }, "Consejo: describe cada carpeta con lo que se VE en la imagen y en qué se diferencia de sus hermanas. La IA lee el criterio de todos los niveles de la rama."));
      return;
    }
    if (w.n.id === "root") return renderRoot(el);
    renderNode(el, w);
  }

  function renderRoot(el) {
    const s = App.cfg.settings, st = App.stats.root || {};
    el.append(h("div", { class: "insp-title" }, h("h2", { style: { margin: 0, fontSize: "16px" } }, "Carpeta destino")),
      h("div", { class: "insp-path" }, s.destination),
      h("div", { class: "stat-row" }, h("span", {}, "Imágenes clasificadas"), h("b", {}, st.images ?? "—")),
      h("div", { class: "insp-section" },
        h("label", { class: "field" }, "Instrucciones generales para la IA",
          h("textarea", { rows: 4, value: s.instructions, oninput: (e) => Tree.edit("instr", () => (s.instructions = e.target.value)) }))),
      h("div", { class: "btn-row" },
        h("button", { class: "btn small", onclick: () => Tree.addChild("root") }, "+ Carpeta"),
        h("button", { class: "btn small ai", onclick: () => suggestChildren("root") }, h("span", { class: "i-spark" }), "Sugerir carpetas"),
        h("button", { class: "btn small ai", title: "Varias IAs a la vez mejoran las descripciones de todo el árbol", onclick: () => improveBatch("root") }, h("span", { class: "i-spark" }), "Mejorar todo en lote"),
        h("button", { class: "btn small", onclick: () => openImages("root") }, "Ver imágenes")));
  }

  function renderMulti(el) {
    const ws = [...App.sel].map(Tree.find).filter((w) => w && w.n.id !== "root");
    const sel = h("select", { onchange: (e) => {
      if (e.target.value === "__new") Tree.newGroup(App.primary !== "root" ? App.primary : ws[0]?.n.id);
      else Tree.assignGroup(ws.map((w) => w.n.id), e.target.value || null);
    } }, h("option", { value: "" }, "(sin grupo)"), App.cfg.groups.map((g) => h("option", { value: g.id }, g.name)),
      h("option", { value: "__new" }, "+ Nuevo grupo con la descripción de la principal"));
    const common = new Set(ws.map((w) => w.n.group));
    sel.value = common.size === 1 ? ([...common][0] || "") : "";
    el.append(h("div", { class: "insp-title" }, h("h2", { style: { margin: 0, fontSize: "16px" } }, `${ws.length} carpetas seleccionadas`)),
      h("div", { class: "value-chips" }, ws.slice(0, 40).map((w) => h("span", { class: "chip", title: w.path.join("/"), onclick: () => Tree.select(w.n.id) }, w.n.name))),
      h("div", { class: "insp-section" }, h("label", { class: "field" }, "Grupo (descripción compartida)", sel),
        h("p", { class: "hint" }, "Al agrupar, todas usan la misma descripción y señales. Cada carpeta puede añadir un detalle propio.")),
      h("div", { class: "btn-row" },
        h("button", { class: "btn small danger", onclick: () => Tree.remove() }, `Eliminar ${ws.length}`)));
  }

  function renderNode(el, w) {
    const n = w.n;
    const cr = Tree.crit(n);
    const g = cr.group;
    const st = App.stats[n.id] || {};
    const isVar = n.kind === "variable";
    const key = (f) => `${n.id}:${f}`;

    const nameInput = h("input", { value: n.name, title: "Nombre de la carpeta",
      onkeydown: (e) => { if (e.key === "Enter") e.target.blur(); e.stopPropagation(); },
      onchange: (e) => { Tree.rename(n.id, e.target.value); render(); } });
    const kindBtn = h("button", { class: "btn small", title: "Fija: nombre fijo. Variable: la IA escribe el nombre (p. ej. la especie)",
      onclick: () => { Tree.setKind(n.id, isVar ? "folder" : "variable"); render(); } }, isVar ? "{ } Variable" : "Fija");
    el.append(h("div", { class: "insp-title" }, nameInput, kindBtn), h("div", { class: "insp-path" }, w.path.join(" / ")));

    // group
    const gsel = h("select", { onchange: (e) => {
      if (e.target.value === "__new") Tree.newGroup(n.id); else Tree.assignGroup([n.id], e.target.value || null);
    } }, h("option", { value: "" }, "(sin grupo)"), App.cfg.groups.map((x) => h("option", { value: x.id }, x.name)),
      h("option", { value: "__new" }, "+ Crear grupo desde esta carpeta"));
    gsel.value = n.group || "";
    el.append(h("label", { class: "field" }, "Grupo", gsel));
    if (g) el.append(h("div", { class: "inherit-note", style: { "--gc": g.color } }, h("b", {}, g.name + ": "), g.description || "(el grupo no tiene descripción)",
      " ", h("a", { href: "#", onclick: (e) => { e.preventDefault(); App.openGroup = g.id; Tree.render(); } }, "editar grupo")));

    // description
    const descLabel = isVar ? "Qué nombre escribe la IA (p. ej. «especie del personaje, en singular»)" : g ? "Detalle propio (se suma al del grupo)" : "Descripción: qué imágenes van aquí";
    const genBtn = h("button", { class: "btn small ai", title: "La IA propone descripción y señales (usa imágenes de ejemplo si la carpeta ya tiene)", onclick: (e) => generate(e.currentTarget) },
      h("span", { class: "i-spark" }), "Generar");
    const preview = h("div", { id: "ai-desc-preview" });
    el.append(h("div", { class: "field" }, h("div", { class: "field-head" }, h("span", {}, descLabel), genBtn),
      h("textarea", { rows: 3, value: n.description, placeholder: isVar ? "especie o tipo, en singular y minúsculas" : "Concreto y visual: qué se ve y en qué se diferencia de las hermanas",
        oninput: (e) => Tree.edit(key("desc"), () => (n.description = e.target.value)), onchange: () => Tree.render() }), preview,
      h("button", { class: "btn small ai", style: { alignSelf: "flex-start", marginTop: "4px" }, disabled: st.images === 0,
        title: st.images === 0 ? "La carpeta todavía no tiene imágenes" : "La IA mira las imágenes que ya hay en esta carpeta (y las que corregiste a mano al revisar) y propone una definición más precisa",
        onclick: () => improve(n.id) }, h("span", { class: "i-spark" }), "Analizar imágenes y mejorar descripción"),
      n.children.length ? h("button", { class: "btn small ai", style: { alignSelf: "flex-start", marginTop: "4px" },
        title: "Varias IAs a la vez analizan esta carpeta, todas sus subcarpetas y sus grupos",
        onclick: () => improveBatch(n.id) }, h("span", { class: "i-spark" }), "Mejorar toda la rama en lote") : null));

    // identifiers
    if (!isVar) {
      const inc = chipInput({ values: n.include, inherited: g?.include || [], placeholder: "Añadir señal… (Enter)", suggestions: Tree.allIdentifiers,
        onChange: (v) => Tree.mutate(() => (n.include = v)) });
      el.append(h("div", { class: "field" }, h("div", { class: "field-head" }, h("span", {}, "Señales a favor (identificadores)"),
        h("button", { class: "btn small ai", onclick: (e) => suggestIds(e.currentTarget, n.id, "include", inc) }, h("span", { class: "i-spark" }), "Sugerir")), inc));
    }
    const exc = chipInput({ values: n.exclude, inherited: g?.exclude || [], placeholder: "Caso que NO va aquí…", suggestions: Tree.allIdentifiers,
      onChange: (v) => Tree.mutate(() => (n.exclude = v)) });
    el.append(h("div", { class: "field" }, h("div", { class: "field-head" }, h("span", {}, "No va aquí si…"),
      h("button", { class: "btn small ai", onclick: (e) => suggestIds(e.currentTarget, n.id, "exclude", exc) }, h("span", { class: "i-spark" }), "Sugerir")), exc));

    // open folder
    if (!n.children.length) {
      el.append(h("div", { class: "insp-section" },
        h("label", { class: "check" }, h("input", { type: "checkbox", checked: n.open, onchange: (e) => { Tree.mutate(() => (n.open = e.target.checked)); render(); } }),
          "La IA puede crear subcarpetas aquí"),
        n.open ? h("input", { style: { width: "100%", marginTop: "6px" }, value: n.openHint, placeholder: "Qué significa la subcarpeta (p. ej. tipo de objeto)",
          oninput: (e) => Tree.edit(key("hint"), () => (n.openHint = e.target.value)) }) : null));
    }

    // disk
    const disk = h("div", { class: "insp-section" }, h("h3", {}, "En disco"),
      h("div", { class: "stat-row" }, h("span", {}, "Imágenes (con subcarpetas)"), h("b", {}, st.images ?? "—")),
      h("div", { class: "stat-row" }, h("span", {}, "Carpeta creada"), h("span", {}, st.exists ? "sí" : "todavía no")));
    if (isVar && st.values?.length) disk.append(h("div", { class: "muted", style: { marginTop: "6px" } }, "Valores que ha escrito la IA:"),
      h("div", { class: "value-chips" }, st.values.map((v) => h("span", { class: "chip", title: "Ver imágenes", onclick: () => openImages(n.id, v.name) }, `${v.name} · ${v.images}`))));
    if (st.subfolders?.length) disk.append(h("div", { class: "muted", style: { marginTop: "6px" } }, "Subcarpetas en disco:"),
      h("div", { class: "value-chips" }, st.subfolders.map((v) => h("span", { class: "chip", onclick: () => openImages(n.id, null, v.name) }, `${v.name} · ${v.images}`))));
    disk.append(h("div", { class: "btn-row", style: { marginTop: "8px" } },
      h("button", { class: "btn small", onclick: () => openImages(n.id) }, "Ver imágenes"),
      st.exists ? h("button", { class: "btn small", onclick: () => POST("/api/fs/reveal", { path: st.paths[0] }).catch(fail) }, "Explorador") : null));
    el.append(disk);

    el.append(h("div", { class: "insp-section btn-row" },
      h("button", { class: "btn small", onclick: () => Tree.addChild(n.id) }, "+ Subcarpeta"),
      h("button", { class: "btn small ai", onclick: () => suggestChildren(n.id) }, h("span", { class: "i-spark" }), "Sugerir subcarpetas"),
      h("button", { class: "btn small", title: "Mover antes", onclick: () => Tree.reorder(n.id, -1) }, "↑"),
      h("button", { class: "btn small", title: "Mover después", onclick: () => Tree.reorder(n.id, 1) }, "↓"),
      h("button", { class: "btn small", onclick: () => Tree.duplicate(n.id) }, "Duplicar"),
      h("button", { class: "btn small danger", onclick: () => Tree.remove([n.id]) }, "Eliminar")));
  }

  /* ---------- AI */
  async function generate(btn) {
    const id = App.primary;
    const w = Tree.find(id);
    if (!w) return;
    btn = btn || $("#inspector .btn.ai");
    await busy(btn, async () => {
      await Main.flush();
      const r = await POST("/api/ai/describe", { node: id });
      const prev = $("#ai-desc-preview");
      if (!prev || App.primary !== id) return toast("Descripción generada para " + w.n.name);
      prev.innerHTML = "";
      prev.append(h("div", { class: "ai-preview" }, h("b", {}, "Propuesta: "), r.description,
        r.include.length ? h("div", {}, h("span", { class: "muted" }, "Señales: "), r.include.join(", ")) : null,
        r.exclude.length ? h("div", {}, h("span", { class: "muted" }, "No si: "), r.exclude.join(", ")) : null,
        h("div", { class: "acts" },
          h("button", { class: "btn small ai primary", onclick: () => { apply(true); } }, "Aplicar todo"),
          h("button", { class: "btn small", onclick: () => { apply(false); } }, "Solo descripción"),
          h("button", { class: "btn small", onclick: () => (prev.innerHTML = "") }, "Descartar"))));
      const apply = (all) => {
        Tree.mutate(() => {
          w.n.description = r.description;
          if (all) {
            const g = Tree.groupOf(w.n);
            const have = new Set([...(g?.include || []), ...(g?.exclude || [])].map(norm));
            w.n.include = [...new Set([...w.n.include, ...r.include.filter((x) => !have.has(norm(x)))])];
            w.n.exclude = [...new Set([...w.n.exclude, ...r.exclude.filter((x) => !have.has(norm(x)))])];
          }
        });
        Tree.render(); render();
      };
    });
  }
  async function suggestIds(btn, id, field, chips) {
    await busy(btn, async () => {
      await Main.flush();
      const r = await POST("/api/ai/identifiers", { node: id, field, partial: chips.partial() });
      chips.showSuggestions(r.items);
    });
  }
  async function suggestChildren(id) {
    const w = Tree.find(id);
    if (!w) return;
    const hint = h("input", { placeholder: "Opcional: cómo quieres dividirla (p. ej. «por tipo de arma»)", style: { flex: 1 } });
    const list = h("div", { style: { marginTop: "10px" } }, h("p", { class: "hint" }, "Pulsa «Pedir a la IA» para recibir propuestas."));
    let items = [];
    const ask = async (btn) => busy(btn, async () => {
      await Main.flush();
      const r = await POST("/api/ai/children", { node: id, hint: hint.value });
      items = r.children.map((c) => ({ ...c, on: true }));
      list.innerHTML = "";
      if (!items.length) list.append(h("p", { class: "hint" }, "Sin propuestas."));
      for (const it of items) {
        list.append(h("div", { class: "sugg-item" },
          h("input", { type: "checkbox", checked: true, onchange: (e) => (it.on = e.target.checked) }),
          h("div", { class: "body" },
            h("input", { value: (it.variable ? "{" : "") + it.name + (it.variable ? "}" : ""), oninput: (e) => (it.name = e.target.value.replace(/[{}]/g, "")) }),
            h("textarea", { rows: 2, value: it.description, oninput: (e) => (it.description = e.target.value) }),
            it.include.length ? h("div", { class: "muted", style: { fontSize: "12px" } }, "Señales: " + it.include.join(", ")) : null)));
      }
    });
    const askBtn = h("button", { class: "btn ai", onclick: (e) => ask(e.currentTarget) }, h("span", { class: "i-spark" }), "Pedir a la IA");
    hint.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); askBtn.click(); } });
    const ok = await modal({ title: `Subcarpetas para «${id === "root" ? "destino" : w.n.name}»`, wide: true,
      body: h("div", {}, h("div", { class: "row" }, hint, askBtn), list),
      buttons: [{ label: "Cancelar", value: false }, { label: "Añadir seleccionadas", value: true, primary: true, cls: "primary" }],
      onOpen: () => setTimeout(() => askBtn.click(), 50) });
    if (!ok) return;
    const chosen = items.filter((i) => i.on && i.name.trim());
    if (!chosen.length) return;
    const vars = chosen.filter((i) => i.variable);
    if (vars.length && (chosen.length > 1 || w.n.children.length)) return toast("Una variable debe ser la única subcarpeta: añádela sola", "error");
    if (Tree.canHoldChild(w.n, Tree.newNode("x"))) return toast(Tree.canHoldChild(w.n, Tree.newNode("x")), "error");
    Tree.mutate(() => {
      for (const it of chosen) {
        const name = it.variable ? norm(it.name).replace(/\s+/g, "_") : Tree.cleanName(it.name);
        w.n.children.push(Tree.newNode(Tree.uniqueName(w.n, name), { description: it.description, include: it.include, exclude: it.exclude, kind: it.variable ? "variable" : "folder" }));
      }
      App.collapsed.delete(w.n.id);
    });
    Tree.render(); Tree.ensureVisible(id);
    toast(`${chosen.length} subcarpeta(s) añadidas`, "ok");
  }
  /* AI looks at the images already stored in a folder (plus review corrections) and proposes better criteria. */
  async function improve(id) {
    const w = Tree.find(id);
    if (!w || id === "root") return;
    const n = w.n;
    const isVar = n.kind === "variable";
    const g = Tree.groupOf(n);
    const count = h("select", {}, [4, 8, 12, 16].map((v) => h("option", { value: v, selected: v === 8 }, `${v} imágenes`)));
    const out = h("div", { style: { marginTop: "12px" } });
    let proposal = null;
    const ask = (btn) => busy(btn, async () => {
      await Main.flush();
      proposal = null;
      out.innerHTML = "";
      out.append(h("p", { class: "hint" }, "La IA está mirando las imágenes… puede tardar un par de minutos."));
      try { show(await POST("/api/ai/improve", { node: id, count: +count.value })); }
      catch (e) { out.innerHTML = ""; out.append(h("p", { class: "err", style: { color: "var(--err)" } }, e.message)); }
    });
    const show = (r) => {
      const inGroup = (list) => new Set((list || []).map(norm));
      const gi = inGroup(g?.include), ge = inGroup(g?.exclude);
      const state = { description: r.description || n.description,
        include: r.include.filter((x) => !gi.has(norm(x))), exclude: r.exclude.filter((x) => !ge.has(norm(x))) };
      proposal = state;
      const ta = h("textarea", { rows: 4, value: state.description, oninput: (e) => (state.description = e.target.value) });
      const incChips = isVar ? null : chipInput({ values: state.include, inherited: g?.include || [], suggestions: Tree.allIdentifiers, onChange: (v) => (state.include = v) });
      const excChips = chipInput({ values: state.exclude, inherited: g?.exclude || [], suggestions: Tree.allIdentifiers, onChange: (v) => (state.exclude = v) });
      const dropped = (old, now) => old.filter((x) => !now.some((y) => norm(y) === norm(x)));
      const lostInc = isVar ? [] : dropped(n.include, state.include), lostExc = dropped(n.exclude, state.exclude);
      const roleCls = { "corregida hacia aquí": "into", "corregida fuera": "out" };
      out.innerHTML = "";
      fill(out, 
        h("div", { class: "muted" }, `Imágenes analizadas (${r.images.length}) · clic para verla grande`),
        h("div", { class: "imp-strip" }, r.images.map((im, i) => h("figure", { class: roleCls[im.role] || "", title: `${im.path}${im.detail ? "\n" + im.detail : ""}` },
          h("img", { src: thumbUrl(im.path, 200), loading: "lazy", style: { cursor: "zoom-in" },
            onclick: () => Lightbox.open(r.images.map((x) => ({ path: x.path, name: baseName(x.path), extra: x.role === "ejemplo" ? "" : `${x.role} (${x.detail})` })), i, { over: true }) }),
          im.role !== "ejemplo" ? h("figcaption", {}, im.role) : null))),
        r.analysis ? h("div", { class: "imp-analysis selectable" }, r.analysis) : null,
        h("div", { class: "imp-cols" },
          h("div", {}, h("div", { class: "muted" }, "Ahora"),
            h("div", { class: "old selectable" }, n.description || "(sin descripción)",
              !isVar && n.include.length ? h("div", { style: { marginTop: "6px" } }, "Señales: ", n.include.map((x) => h("span", { class: "chip" }, x))) : null,
              n.exclude.length ? h("div", { style: { marginTop: "6px" } }, "No si: ", n.exclude.map((x) => h("span", { class: "chip" }, x))) : null)),
          h("div", {}, h("div", { class: "muted" }, g ? `Propuesta (detalle propio; el grupo «${g.name}» se mantiene)` : "Propuesta (puedes editarla)"), ta)),
        incChips ? h("div", { class: "field", style: { marginTop: "10px" } }, "Señales a favor", incChips,
          lostInc.length ? h("span", { class: "hint" }, "Las que tienen + se quitarían: clic en una para conservarla.") : null) : null,
        h("div", { class: "field", style: { marginTop: incChips ? 0 : "10px" } }, "No va aquí si…", excChips,
          lostExc.length ? h("span", { class: "hint" }, "Las que tienen + se quitarían: clic en una para conservarla.") : null));
      if (lostInc.length) incChips.showSuggestions(lostInc);
      if (lostExc.length) excChips.showSuggestions(lostExc);
    };
    const askBtn = h("button", { class: "btn ai", onclick: (e) => ask(e.currentTarget) }, h("span", { class: "i-spark" }), "Analizar");
    const ok = await modal({ title: `Mejorar la descripción de «${n.name}»`, wide: true,
      body: h("div", {},
        h("p", { class: "hint", style: { marginTop: 0 } }, "La IA mira imágenes que ya están en esta carpeta (repartidas entre sus subcarpetas) y las que corregiste a mano al revisar tandas, y reescribe la descripción, las señales y las exclusiones para que en el futuro clasifique mejor. Revisa la propuesta antes de aplicarla."),
        h("div", { class: "row" }, h("span", { class: "muted" }, "Mirar hasta"), count, askBtn, h("span", { class: "grow" })), out),
      buttons: [{ label: "Cancelar", value: false },
        { label: "Aplicar", value: true, primary: true, cls: "ai primary", check: () => { if (!proposal) toast("Primero pulsa «Analizar»"); return !!proposal; } }],
      onOpen: () => setTimeout(() => askBtn.click(), 50) });
    if (!ok || !proposal || !Tree.find(id)) return;
    Tree.mutate(() => {
      n.description = proposal.description.trim();
      if (!isVar) n.include = [...new Set(proposal.include)];
      n.exclude = [...new Set(proposal.exclude)];
    });
    Tree.render(); render();
    toast(`Descripción de «${n.name}» actualizada (Ctrl+Z para deshacer)`, "ok");
  }

  /* ---------- improve many folders at once: one AI per folder and per shared group, several in parallel */
  async function improveBatch(id, presetTasks = null) {
    const cur = await GET("/api/ai/batch").catch(() => null);
    const view = { body: h("div", {}), timer: null, st: null };
    modal({ title: "Mejorar descripciones en lote", wide: true, body: view.body, buttons: [{ label: "Cerrar", value: null }] })
      .then(() => clearInterval(view.timer));
    const pending = cur?.id && (cur.running || cur.items.some((i) => i.status === "done" && !i.applied));
    if (pending) return batchProgress(view, cur, id);
    if (presetTasks) return batchStart(view, presetTasks, 8, App.cfg.settings.threads || 4, id);
    batchSetup(view, id || "root");
  }

  function batchSetup(view, id) {
    const base = Tree.find(id) || Tree.find("root");
    const imgs = (nid) => App.stats[nid]?.images || 0;
    const all = [...Tree.walk()];
    const groups = new Map(), plain = [];
    for (const x of Tree.walk(base.n)) {
      if (x.n.id === "root") continue;
      const g = Tree.groupOf(x.n);
      if (g) { if (!groups.has(g.id)) groups.set(g.id, g); }
      else plain.push(x.n);
    }
    const rows = [];
    const pick = (kind, tid, label, detail, n, extra = null) => {
      const cb = h("input", { type: "checkbox", checked: n > 0, disabled: n === 0 });
      rows.push({ kind, id: tid, cb });
      return h("label", { class: "check batch-pick" + (n ? "" : " off"), title: n ? "" : "Sin imágenes todavía: no hay nada que analizar" },
        cb, extra, h("span", { class: "grow" }, label), h("span", { class: "muted" }, detail));
    };
    const count = h("select", {}, [4, 6, 8, 12, 16].map((v) => h("option", { value: v, selected: v === 8 }, `${v} imágenes`)));
    const threads = h("input", { type: "number", min: 1, max: 16, value: App.cfg.settings.threads || 4, style: { width: "64px", flex: "none" } });
    const summary = h("span", { class: "muted" });
    const refresh = () => {
      const n = rows.filter((r) => r.cb.checked).length;
      const k = Math.min(n, +threads.value || 1);
      summary.textContent = `${n} análisis · hasta ${k} IA${k === 1 ? "" : "s"} a la vez`;
    };
    const groupRows = [...groups.values()].map((g) => {
      const members = all.filter((w) => w.n.group === g.id);
      const n = members.reduce((a, w) => a + imgs(w.n.id), 0);
      return pick("group", g.id, g.name, `usado en ${members.length} carpetas · ${n} imágenes`, n,
        h("span", { class: "gdot", style: { background: g.color } }));
    });
    const folderRows = plain.map((n) => {
      const path = Tree.find(n.id).path.join("/");
      return pick("node", n.id, path, `${imgs(n.id)} imágenes${n.kind === "variable" ? " · variable" : ""}`, imgs(n.id));
    });
    rows.forEach((r) => r.cb.addEventListener("change", refresh));
    threads.addEventListener("input", refresh);
    const setAll = (on) => { rows.forEach((r) => { if (!r.cb.disabled) r.cb.checked = on; }); refresh(); };
    const go = h("button", { class: "btn ai primary", onclick: () => {
      const tasks = rows.filter((r) => r.cb.checked).map((r) => ({ kind: r.kind, id: r.id }));
      if (!tasks.length) return toast("Marca al menos una carpeta o grupo", "error");
      batchStart(view, tasks, +count.value, +threads.value || 4, id);
    } }, h("span", { class: "i-spark" }), "Empezar");
    view.body.innerHTML = "";
    fill(view.body, 
      h("p", { class: "hint", style: { marginTop: 0 } }, `Cada carpeta del árbol dentro de «${base.n.id === "root" ? "todo el árbol" : base.n.name}» y cada grupo que usan se analiza con su propia IA, varias a la vez. ` +
        "Las carpetas variables {…} comparten un único criterio para todos sus valores (todas las especies), así que se analizan con imágenes de todos ellos. " +
        "Al terminar revisas cada propuesta y aplicas las que quieras."),
      h("div", { class: "row", style: { flexWrap: "wrap", marginBottom: "10px" } },
        h("span", { class: "muted" }, "Imágenes por análisis"), count, h("span", { class: "muted" }, "IAs a la vez"), threads,
        h("span", { class: "grow" }),
        h("button", { class: "btn small", onclick: () => setAll(true) }, "Marcar todo"), h("button", { class: "btn small", onclick: () => setAll(false) }, "Nada")),
      groupRows.length ? h("h3", { style: { margin: "4px 0 6px" } }, "Grupos (descripción compartida)") : null,
      groupRows.length ? h("div", { class: "batch-list" }, groupRows) : null,
      groupRows.length ? h("p", { class: "hint" }, "Las carpetas que usan un grupo se mejoran a través de él: su texto vale para todas.") : null,
      folderRows.length ? h("h3", { style: { margin: "10px 0 6px" } }, "Carpetas") : null,
      folderRows.length ? h("div", { class: "batch-list" }, folderRows) : null,
      h("div", { class: "row", style: { marginTop: "12px" } }, summary, h("span", { class: "grow" }), go));
    refresh();
  }

  async function batchStart(view, tasks, count, threads, id) {
    await Main.flush();
    const r = await POST("/api/ai/batch", { tasks, count, threads }).catch(fail);
    if (r) batchProgress(view, r, id);
  }

  function batchProgress(view, st, id) {
    const state = {};
    const label = h("span", {});
    const bar = h("i", { style: { width: "0%", background: "var(--ai)" } });
    const stopBtn = h("button", { class: "btn small danger", onclick: () => POST("/api/ai/batch/stop").then((s) => update(s)).catch(fail) }, "Detener");
    const applyBtn = h("button", { class: "btn ai primary" });
    const list = h("div", {});
    const chosen = () => (view.st?.items || []).filter((it) => it.status === "done" && !it.applied && state[it.key]?.apply);
    const countApply = () => { const n = chosen().length; applyBtn.textContent = `Aplicar seleccionadas (${n})`; applyBtn.disabled = !n; };
    const targetOf = (it) => (it.kind === "group" ? App.cfg.groups.find((g) => g.id === it.id) : Tree.find(it.id)?.n);
    const badge = (it) => it.applied ? h("span", { class: "badge ok" }, "aplicada")
      : { queued: h("span", { class: "badge" }, "en cola"), working: h("span", { class: "badge work" }, "analizando…"),
        done: h("span", { class: "badge warn" }, "propuesta lista"), error: h("span", { class: "badge err" }, "error"),
        stopped: h("span", { class: "badge" }, "detenida") }[it.status];
    const draw = (s, it) => {
      s.el.innerHTML = "";
      s.el.className = `batch-item ${it.status}${it.applied ? " applied" : ""}`;
      const target = targetOf(it);
      const ready = it.status === "done" && it.result && target;
      s.el.append(h("div", { class: "row" },
        ready && !it.applied ? h("input", { type: "checkbox", checked: s.apply, onchange: (e) => { s.apply = e.target.checked; countApply(); } }) : null,
        it.kind === "group" && target ? h("span", { class: "gdot", style: { background: target.color } }) : null,
        h("b", { class: "grow" }, it.kind === "group" ? `Grupo «${it.label}»` : it.label), badge(it)));
      if (it.status === "error") s.el.append(h("div", { class: "err" }, it.error));
      if (it.status === "done" && !target) s.el.append(h("div", { class: "err" }, "Esta carpeta o grupo ya no existe en el árbol."));
      if (!ready) return;
      const r = it.result;
      if (s.desc === null) s.desc = r.description;
      const ids = [r.include.length ? `Señales: ${r.include.join(", ")}` : "", r.exclude.length ? `No si: ${r.exclude.join(", ")}` : ""].filter(Boolean).join(" · ");
      fill(s.el, 
        h("div", { class: "imp-strip mini" }, r.images.map((im, i) => h("img", { src: thumbUrl(im.path, 120), loading: "lazy", class: im.role === "ejemplo" ? "" : im.role === "corregida fuera" ? "out" : "into",
          title: `${im.role}${im.detail ? " · " + im.detail : ""}\n${im.path}`,
          onclick: () => Lightbox.open(r.images.map((x) => ({ path: x.path, name: baseName(x.path), extra: x.role === "ejemplo" ? "" : `${x.role} (${x.detail})` })), i, { over: true }) }))),
        h("div", { class: "imp-cols" },
          h("div", { class: "old selectable" }, h("div", { class: "muted" }, "Ahora"), target.description || "(sin descripción)"),
          h("textarea", { rows: 3, value: s.desc, disabled: it.applied, oninput: (e) => (s.desc = e.target.value) })),
        ids ? h("div", { class: "muted batch-ids selectable" }, ids) : null,
        r.analysis ? h("div", { class: "hint selectable", style: { margin: "4px 0 0" } }, r.analysis) : null,
        !it.applied ? h("label", { class: "check", style: { marginTop: "4px" } }, h("input", { type: "checkbox", checked: s.onlyDesc, onchange: (e) => (s.onlyDesc = e.target.checked) }),
          "Solo la descripción (no tocar señales ni exclusiones)") : null);
    };
    const update = (st2) => {
      view.st = st2;
      const items = st2.items;
      const finished = items.filter((i) => !["queued", "working"].includes(i.status)).length;
      const working = items.filter((i) => i.status === "working").length;
      const ok = items.filter((i) => i.status === "done").length, err = items.filter((i) => i.status === "error").length;
      label.textContent = st2.running ? `Analizando… ${finished}/${items.length} terminados · ${working} IA${working === 1 ? "" : "s"} trabajando`
        : `Terminado: ${ok} propuesta(s)${err ? ` · ${err} con error` : ""}`;
      bar.style.width = (100 * finished / Math.max(1, items.length)) + "%";
      stopBtn.hidden = !st2.running;
      for (const it of items) {
        let s = state[it.key];
        if (!s) { s = state[it.key] = { el: h("div", {}), status: null, applied: null, apply: true, onlyDesc: false, desc: null }; list.append(s.el); }
        if (s.status !== it.status || s.applied !== it.applied) { s.status = it.status; s.applied = it.applied; draw(s, it); }
      }
      countApply();
    };
    applyBtn.onclick = async () => {
      const items = chosen();
      if (!items.length) return;
      Tree.mutate(() => {
        for (const it of items) {
          const s = state[it.key], r = it.result, desc = String(s.desc ?? r.description).trim();
          if (it.kind === "group") {
            const g = App.cfg.groups.find((x) => x.id === it.id);
            if (!g) continue;
            if (desc) g.description = desc;
            if (!s.onlyDesc) { if (r.include.length) g.include = [...new Set(r.include)]; if (r.exclude.length) g.exclude = [...new Set(r.exclude)]; }
          } else {
            const n = Tree.find(it.id)?.n;
            if (!n) continue;
            if (desc) n.description = desc;
            if (!s.onlyDesc) {
              const g = Tree.groupOf(n);
              const gi = new Set((g?.include || []).map(norm)), ge = new Set((g?.exclude || []).map(norm));
              const inc = r.include.filter((x) => !gi.has(norm(x))), exc = r.exclude.filter((x) => !ge.has(norm(x)));
              if (n.kind !== "variable" && inc.length) n.include = [...new Set(inc)];
              if (exc.length) n.exclude = [...new Set(exc)];
            }
          }
        }
      });
      Tree.render(); render();
      const s2 = await POST("/api/ai/batch/applied", { keys: items.map((i) => i.key) }).catch(() => null);
      if (s2) update(s2);
      toast(`${items.length} descripción(es) actualizada(s). Ctrl+Z deshace todas de una vez.`, "ok", null, 6000);
    };
    view.body.innerHTML = "";
    view.body.append(
      h("div", { class: "dup-summary" }, label, h("span", { class: "grow" }), stopBtn,
        h("button", { class: "btn small", title: "Elegir otra rama y empezar otra tanda", onclick: () => { clearInterval(view.timer); batchSetup(view, id || App.primary || "root"); } }, "Nueva tanda"),
        applyBtn),
      h("div", { class: "progress" }, bar),
      h("p", { class: "hint" }, "Puedes cerrar esta ventana: la tanda sigue y al volver a abrirla verás las propuestas. Edita el texto propuesto si quieres antes de aplicar."),
      list);
    update(st);
    clearInterval(view.timer);
    if (st.running) view.timer = setInterval(async () => {
      if (!view.body.isConnected) return clearInterval(view.timer);
      const s2 = await GET("/api/ai/batch").catch(() => null);
      if (!s2 || s2.id !== st.id) return;
      update(s2);
      if (!s2.running) clearInterval(view.timer);
    }, 1500);
  }

  async function openImages(id, value = null, sub = null) {
    const st = App.stats[id] || {};
    const w = Tree.find(id);
    let path = st.paths?.[0];
    if (value && w) path = st.paths?.find((p) => baseName(p).toLowerCase() === value.toLowerCase()) || path;
    if (sub && path) path = joinPath(path, sub);
    if (!path) {
      const dest = App.cfg.settings.destination;
      let cur = w;
      while (cur && cur.parent && !(App.stats[cur.parent.id]?.paths?.length)) cur = Tree.find(cur.parent.id);
      path = (cur?.parent && App.stats[cur.parent.id]?.paths?.[0]) || dest;
      toast("Esa carpeta aún no existe en disco; te muestro la más cercana");
    }
    Main.showTab("images");
    Images.open(path);
  }

  return { render, generate, suggestChildren, openImages, improve, improveBatch };
})();
