"""OpenCode calls: image classification jobs and tree-authoring assistance."""
from __future__ import annotations

import csv
import json
import os
import random
import shutil
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import core

_opencode = None


def opencode_exe() -> str:
    global _opencode
    if _opencode:
        return _opencode
    shim = shutil.which("opencode")
    if not shim:
        raise RuntimeError("No se encuentra OpenCode. Instálalo o revisa el PATH.")
    exe = Path(shim).parent / "node_modules" / "@opencode" / "cli" / "bin" / "opencode.exe"
    _opencode = str(exe) if exe.exists() else shim
    return _opencode


def model_id(settings: dict) -> str:
    m, e = settings.get("model") or core.DEFAULT_SETTINGS["model"], settings.get("effort") or ""
    return f"{m}#{e}" if e else m


def ask(settings: dict, prompt: str, images=(), timeout=None) -> str:
    """Sends a prompt (and optional images) through `opencode run` and returns the reply text."""
    exe = opencode_exe()
    cmd = [exe, "run", "--archived", "--format", "json", "-m", model_id(settings)]
    for img in images:
        cmd += ["-f", str(img)]
    cmd.append(prompt)
    if Path(exe).suffix.lower() in (".cmd", ".bat"):
        cmd = [os.environ.get("COMSPEC", "cmd.exe"), "/c"] + cmd
    core.DATA_DIR.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
                       timeout=timeout or settings.get("timeout") or 180, cwd=core.DATA_DIR,
                       creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    texts, errors = [], []
    for line in r.stdout.splitlines():
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        if ev.get("type") == "text":
            texts.append(ev.get("part", {}).get("text", ""))
        elif ev.get("type") == "error":
            err = ev.get("error", {})
            errors.append(err.get("message") or err.get("data", {}).get("message") or "error desconocido")
    if errors:
        raise RuntimeError(errors[-1])
    if not texts:
        detail = (r.stderr or r.stdout or "sin respuesta").strip()
        raise RuntimeError(f"código {r.returncode}: {detail[-300:]}")
    return texts[-1]


def ask_json(settings: dict, prompt: str, images=(), timeout=None) -> dict:
    last = ""
    for _ in range(2):
        last = ask(settings, prompt, images, timeout)
        objs = core.extract_jsons(last)
        if objs:
            return max(objs, key=lambda o: len(json.dumps(o)))
    raise RuntimeError(f"La IA no devolvió JSON: {last[:200]}")


_models_cache = {"time": 0, "list": []}


def list_models() -> list:
    if time.time() - _models_cache["time"] < 600 and _models_cache["list"]:
        return _models_cache["list"]
    exe = opencode_exe()
    cmd = [exe, "models"]
    if Path(exe).suffix.lower() in (".cmd", ".bat"):
        cmd = [os.environ.get("COMSPEC", "cmd.exe"), "/c"] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60,
                       creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    models = [l.strip() for l in r.stdout.splitlines() if "/" in l and " " not in l.strip()]
    _models_cache.update(time=time.time(), list=models)
    return models


# =========================================================================== jobs

class Job:
    def __init__(self, cfg: dict, files: list, mode: str, threshold: int, threads: int, label: str):
        self.id = core.new_id()
        self.cfg = cfg
        self.settings = cfg["settings"]
        self.mode = mode if mode in ("review", "copy", "move") else "review"
        self.threshold = int(threshold)
        self.threads = max(1, min(16, int(threads)))
        self.label = label
        self.created = time.time()
        self.ctx = core.PromptContext(cfg)
        self.items = [{"id": str(i), "file": str(f), "name": Path(f).name, "status": "queued",
                       "proposal": None, "confidence": None, "reason": "", "error": "",
                       "decision": "pending", "dest": None} for i, f in enumerate(files)]
        self.lock = threading.Lock()
        self.stopped = False
        self.finished = False
        self.version = 0
        self.thread = threading.Thread(target=self._run, daemon=True)

    # ---- running
    def start(self):
        self.thread.start()
        return self

    def _touch(self):
        self.version += 1

    def _classify(self, item):
        if self.stopped:
            return
        with self.lock:
            item["status"] = "working"
            self._touch()
        path = Path(item["file"])
        try:
            if not path.is_file():
                raise FileNotFoundError("el archivo ya no existe")
            if path.suffix.lower() not in core.AI_EXT:
                raise ValueError(f"formato {path.suffix} no admitido por la IA")
            if path.stat().st_size > core.MAX_AI_BYTES:
                raise ValueError("archivo de más de 10 MiB")
            answer, last = None, ""
            for _ in range(2):
                try:
                    last = ask(self.settings, self.ctx.prompt(), [path])
                except Exception as e:
                    last = f"ERROR: {e}"
                    continue
                answer = core.resolve_answer(self.ctx, last)
                if answer:
                    break
            if not answer:
                raise ValueError(f"respuesta inválida: {last[:200]}")
            with self.lock:
                item.update(status="done", proposal=answer["path"], template=answer["template"],
                            confidence=answer["confidence"], reason=answer["reason"], error="")
                self._touch()
            if self.mode in ("copy", "move") and answer["confidence"] >= self.threshold:
                self.apply([{"id": item["id"], "dest": answer["path"]}], auto=True)
        except Exception as e:
            with self.lock:
                item.update(status="error", error=str(e))
                self._touch()

    def _run(self, subset=None):
        todo = subset or [it for it in self.items if it["status"] == "queued"]
        with ThreadPoolExecutor(max_workers=self.threads) as pool:
            list(pool.map(self._classify, todo))
        with self.lock:
            if not any(it["status"] in ("queued", "working") for it in self.items):
                self.finished = True
            self._touch()
        self.save()

    def stop(self):
        self.stopped = True
        with self.lock:
            for it in self.items:
                if it["status"] == "queued":
                    it["status"] = "stopped"
            self._touch()

    def retry(self, ids: list):
        subset = []
        with self.lock:
            for it in self.items:
                if it["id"] in ids and it["decision"] != "applied":
                    it.update(status="queued", error="", proposal=None, decision="pending")
                    subset.append(it)
            self.stopped = False
            self.finished = False
            self._touch()
        threading.Thread(target=self._run, args=(subset,), daemon=True).start()

    # ---- decisions
    def apply(self, entries: list, auto=False) -> dict:
        dest_root = Path(self.settings["destination"])
        op = "copy" if self.mode == "copy" else "move"
        by_id = {it["id"]: it for it in self.items}
        groups = {}
        for e in entries:
            it = by_id.get(str(e.get("id")))
            if not it or it["decision"] == "applied":
                continue
            rel = str(e.get("dest") or it.get("proposal") or "").replace("\\", "/").strip("/")
            if not rel:
                continue
            parts = [core.safe_folder_name(p) for p in rel.split("/") if core.safe_folder_name(p)]
            groups.setdefault("/".join(parts), []).append(it)
        applied, errors = 0, []
        group = f"{self.id}:auto" if auto else f"{self.id}:{core.new_id()}"
        for rel, its in groups.items():
            res = core.transfer([it["file"] for it in its], dest_root.joinpath(*rel.split("/")), op,
                                self.settings.get("unhide", True),
                                label=f"{'Auto' if auto else 'Revisión'}: {len(its)} → {rel}", group=group)
            for it, r in zip(its, res["results"]):
                with self.lock:
                    if r["ok"]:
                        it.update(decision="applied", dest=r["to"])
                        applied += 1
                    else:
                        errors.append(f"{it['name']}: {r.get('error')}")
                    self._touch()
                self._log(it, rel, r)
        self.save()
        return {"applied": applied, "errors": errors}

    def reverted(self, restored: list):
        """Puts items back to review after their files were moved back by an undo."""
        back = {str(Path(r["from"])).lower(): r["to"] for r in restored}
        changed = False
        with self.lock:
            for it in self.items:
                if it["decision"] == "applied" and it.get("dest") and str(Path(it["dest"])).lower() in back:
                    to = back[str(Path(it["dest"])).lower()]
                    if self.mode != "copy" and to != "(papelera)":
                        it["file"] = to
                    it.update(decision="pending", dest=None)
                    changed = True
            if changed:
                self._touch()
        if changed:
            self.save()

    def reject(self, ids: list):
        with self.lock:
            for it in self.items:
                if it["id"] in ids and it["decision"] == "pending":
                    it["decision"] = "rejected"
            self._touch()
        self.save()

    def _log(self, it, rel, r):
        try:
            reg = Path(self.settings["destination"]) / "registro.csv"
            new = not reg.exists() or reg.stat().st_size == 0
            with core.fs_lock, open(reg, "a", newline="", encoding="utf-8-sig") as f:
                w = csv.writer(f)
                if new:
                    w.writerow(["fecha", "archivo", "carpeta", "destino", "confianza", "motivo"])
                w.writerow([time.strftime("%Y-%m-%d %H:%M:%S"), it["name"],
                            rel if r["ok"] else f"ERROR: {r.get('error')}", r.get("to", ""),
                            it.get("confidence"), it.get("reason", "")])
        except OSError:
            pass

    # ---- views
    def summary(self) -> dict:
        with self.lock:
            st = {}
            for it in self.items:
                st[it["status"]] = st.get(it["status"], 0) + 1
            dec = {}
            for it in self.items:
                dec[it["decision"]] = dec.get(it["decision"], 0) + 1
            return {"id": self.id, "label": self.label, "mode": self.mode, "threshold": self.threshold,
                    "created": self.created, "total": len(self.items), "status": st, "decisions": dec,
                    "reviewable": sum(1 for it in self.items if it["status"] == "done" and it["decision"] == "pending"),
                    "finished": self.finished, "stopped": self.stopped, "version": self.version}

    def view(self) -> dict:
        s = self.summary()
        with self.lock:
            s["items"] = [dict(it) for it in self.items]
        return s

    def save(self):
        try:
            d = core.DATA_DIR / "jobs"
            d.mkdir(parents=True, exist_ok=True)
            data = self.view()
            data["cfg"] = self.cfg
            (d / f"{self.id}.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        except OSError:
            pass

    @classmethod
    def load(cls, path: Path):
        data = json.loads(path.read_text(encoding="utf-8"))
        job = cls.__new__(cls)
        job.id = data["id"]
        job.cfg = data["cfg"]
        job.settings = job.cfg["settings"]
        job.mode, job.threshold, job.label = data["mode"], data["threshold"], data.get("label", "")
        job.threads = job.settings.get("threads", 4)
        job.created = data["created"]
        job.ctx = core.PromptContext(job.cfg)
        job.items = data["items"]
        for it in job.items:
            if it["status"] in ("queued", "working"):
                it["status"] = "stopped"
        job.lock = threading.Lock()
        job.stopped, job.finished, job.version = True, True, 0
        return job


class JobManager:
    def __init__(self):
        self.jobs = {}
        d = core.DATA_DIR / "jobs"
        if d.is_dir():
            for p in sorted(d.glob("*.json"), key=lambda p: p.stat().st_mtime)[-15:]:
                try:
                    j = Job.load(p)
                    self.jobs[j.id] = j
                except Exception:
                    pass

    def create(self, cfg, files, mode, threshold, threads, label):
        job = Job(cfg, files, mode, threshold, threads, label)
        self.jobs[job.id] = job
        return job.start()

    def list(self):
        return sorted((j.summary() for j in self.jobs.values()), key=lambda s: -s["created"])

    def get(self, jid):
        j = self.jobs.get(jid)
        if not j:
            raise KeyError("Trabajo no encontrado")
        return j

    def delete(self, jid):
        self.jobs.pop(jid, None)
        try:
            (core.DATA_DIR / "jobs" / f"{jid}.json").unlink()
        except OSError:
            pass

    def forget(self, paths: list):
        """Marks pending proposals whose file went to the recycle bin as discarded."""
        gone = {os.path.normcase(os.path.normpath(p)) for p in paths}
        for job in list(self.jobs.values()):
            changed = False
            with job.lock:
                for it in job.items:
                    if it["decision"] == "pending" and os.path.normcase(os.path.normpath(it["file"])) in gone:
                        it.update(decision="rejected", error="enviada a la papelera")
                        changed = True
                if changed:
                    job._touch()
            if changed:
                job.save()


# =========================================================================== authoring help

def _context_lines(cfg, segs) -> str:
    """Ancestor chain with criteria, to give the model the node's context."""
    lines, n = [], cfg["root"]
    for s in segs[:-1]:
        n = next((c for c in n["children"] if core.segment(c) == s), None)
        if not n:
            break
        cr = core.criteria(cfg, n)
        lines.append(f"- {core.segment(n)}: {cr['description'] or '(sin descripción)'}")
    return "\n".join(lines) or "(es una carpeta de primer nivel)"


def _samples(cfg, segs, limit=2) -> list:
    dest = Path(cfg["settings"]["destination"])
    idx = core.DiskIndex(dest)
    out = []
    for rel, _ in idx.expand(segs):
        for root, _d, files in os.walk(dest.joinpath(*rel)):
            for fn in files:
                p = Path(root) / fn
                if p.suffix.lower() in core.AI_EXT:
                    try:
                        if p.stat().st_size <= core.MAX_AI_BYTES:
                            out.append(p)
                    except OSError:
                        pass
                if len(out) >= limit:
                    return out
    return out


def _node_brief(cfg, n, segs) -> str:
    _, _, parent = core.find(cfg, n["id"])
    siblings = [c for c in (parent or cfg["root"])["children"] if c["id"] != n["id"]]
    sib = "\n".join(f"- {core.segment(c)}: {core.criteria(cfg, c)['description'] or '(sin descripción)'}"
                    for c in siblings) or "(ninguna)"
    kids = ", ".join(core.segment(c) for c in n["children"]) or "(ninguna)"
    cr = core.criteria(cfg, n)
    kind = ("VARIABLE (la IA escribe el nombre real de la carpeta, p. ej. una especie)"
            if n["kind"] == "variable" else "normal")
    return (f"Carpeta: \"{core.segment(n)}\" (tipo {kind})\nRuta: {'/'.join(segs)}\n"
            f"Descripción actual: {n['description'] or '(vacía)'}\n"
            f"Grupo: {cr['group'] or '(ninguno)'}\n"
            f"Señales actuales: {', '.join(n['include']) or '(ninguna)'}\n"
            f"Exclusiones actuales: {', '.join(n['exclude']) or '(ninguna)'}\n"
            f"Niveles superiores:\n{_context_lines(cfg, segs)}\n"
            f"Carpetas hermanas (debe distinguirse de ellas):\n{sib}\n"
            f"Subcarpetas: {kids}\n")


INTRO = ("Ayudas a organizar una biblioteca de imágenes de referencia en un árbol de carpetas. "
         "Otra IA de visión leerá las descripciones para decidir dónde va cada imagen, así que deben ser "
         "concretas, visuales y comprobables mirando la imagen (no subjetivas). Escribe en español. "
         "No uses herramientas.\n\n")


def describe_node(cfg, node_id, use_images=True) -> dict:
    n, segs, _ = core.find(cfg, node_id)
    if not n:
        raise KeyError("Carpeta no encontrada")
    imgs = _samples(cfg, segs) if use_images else []
    prompt = (INTRO + _node_brief(cfg, n, segs) +
              (f"\nTe adjunto {len(imgs)} imagen(es) que ya están en esta carpeta como ejemplo.\n" if imgs else "") +
              "\nEscribe una descripción breve (máx. 25 palabras) que defina qué imágenes van aquí y la "
              "distinga de las hermanas; 3-6 señales visuales a favor y 0-4 exclusiones (casos que van en "
              "otra carpeta). Señales y exclusiones: etiquetas cortas de 1-4 palabras. Responde SOLO con JSON:\n"
              '{"descripcion": "...", "incluir": ["..."], "excluir": ["..."]}')
    data = ask_json(cfg["settings"], prompt, imgs)
    return {"description": str(data.get("descripcion") or "").strip(),
            "include": [str(x) for x in data.get("incluir") or []][:8],
            "exclude": [str(x) for x in data.get("excluir") or []][:6]}


def suggest_children(cfg, node_id, hint="") -> list:
    n, segs, _ = core.find(cfg, node_id)
    if not n:
        raise KeyError("Carpeta no encontrada")
    brief = _node_brief(cfg, n, segs) if node_id != "root" else "Carpeta raíz de la biblioteca.\n"
    prompt = (INTRO + brief + (f"\nPetición del usuario: {hint}\n" if hint else "") +
              "\nPropón de 2 a 8 subcarpetas que dividan esta carpeta en categorías sin solapamientos y "
              "que cubran los casos habituales (incluye una tipo 'otros' solo si hace falta). Nombres cortos, "
              "en minúsculas, en español, sin tildes. Si las subcarpetas deben ser un valor libre escrito por "
              "la IA (p. ej. una especie o un país), propón UNA sola con \"variable\": true. Responde SOLO con JSON:\n"
              '{"carpetas": [{"nombre": "...", "descripcion": "...", "incluir": ["..."], "excluir": [], "variable": false}]}')
    data = ask_json(cfg["settings"], prompt)
    out = []
    for c in data.get("carpetas") or []:
        if isinstance(c, dict) and c.get("nombre"):
            out.append({"name": core.safe_folder_name(str(c["nombre"]).strip("{}")),
                        "description": str(c.get("descripcion") or ""),
                        "include": [str(x) for x in c.get("incluir") or []][:8],
                        "exclude": [str(x) for x in c.get("excluir") or []][:6],
                        "variable": bool(c.get("variable"))})
    return out


def suggest_identifiers(cfg, node_id, field="include", partial="") -> list:
    n, segs, _ = core.find(cfg, node_id)
    if not n:
        raise KeyError("Carpeta no encontrada")
    what = ("señales visuales que indican que una imagen SÍ va en esta carpeta" if field == "include"
            else "casos parecidos que NO van en esta carpeta (van en una hermana u otra rama)")
    prompt = (INTRO + _node_brief(cfg, n, segs) +
              f"\nPropón 6-10 {what}. Frases de 1-4 palabras, sin repetir las actuales" +
              (f", que completen o empiecen por: \"{partial}\"" if partial else "") +
              ". Responde SOLO con JSON: {\"identificadores\": [\"...\"]}")
    data = ask_json(cfg["settings"], prompt, timeout=120)
    return [str(x).strip() for x in data.get("identificadores") or [] if str(x).strip()][:12]


def audit_tree(cfg) -> list:
    ctx = core.PromptContext(cfg)
    prompt = (INTRO + "Este es el árbol completo con sus criterios:\n" + ctx.outline() +
              "\n\nRevísalo como lo haría la IA clasificadora: señala carpetas hermanas que se solapan, "
              "descripciones vagas, huecos (imágenes típicas que no tendrían sitio) y nombres confusos. "
              "Máximo 10 problemas, los más importantes primero. Responde SOLO con JSON:\n"
              '{"problemas": [{"ruta": "<ruta de la carpeta>", "problema": "...", "sugerencia": "...", '
              '"descripcion_nueva": "<descripción mejorada o vacío>"}]}')
    data = ask_json(cfg["settings"], prompt, timeout=240)
    out = []
    for p in data.get("problemas") or []:
        if isinstance(p, dict):
            out.append({"path": str(p.get("ruta") or ""), "problem": str(p.get("problema") or ""),
                        "suggestion": str(p.get("sugerencia") or ""),
                        "description": str(p.get("descripcion_nueva") or "")})
    return out


def assistant(cfg, message: str, selected_id=None) -> dict:
    ctx = core.PromptContext(cfg)
    sel = ""
    if selected_id:
        n, segs, _ = core.find(cfg, selected_id)
        if n:
            sel = f"\nCarpeta seleccionada ahora: {'/'.join(segs) or '(raíz)'}\n"
    groups = "\n".join(f"- {g['name']}: {g['description']}" for g in cfg["groups"]) or "(ninguno)"
    prompt = (INTRO + "Árbol actual (rutas con sus criterios):\n" + (ctx.outline() or "(vacío)") +
              f"\n\nGrupos de descripción compartida:\n{groups}\n{sel}"
              f"\nPetición del usuario: {message}\n\n"
              "Responde a la petición. Si implica cambiar el árbol, propón acciones. Tipos de acción:\n"
              '- {"tipo": "crear", "padre": "<ruta existente o \\"\\" para la raíz>", "nombre": "...", '
              '"variable": false, "descripcion": "...", "incluir": [], "excluir": [], "grupo": "<nombre de grupo o vacío>"}\n'
              '- {"tipo": "editar", "ruta": "<ruta existente>", "descripcion": "...", "incluir": [], "excluir": [], "grupo": ""}\n'
              '- {"tipo": "grupo", "nombre": "...", "descripcion": "...", "incluir": [], "excluir": [], "rutas": ["<rutas que lo usan>"]}\n'
              "Para crear una rama con varios niveles, crea primero el padre y luego los hijos usando la ruta nueva "
              "(las llaves de las variables se escriben {asi}). Responde SOLO con JSON:\n"
              '{"respuesta": "<explicación breve>", "acciones": [ ... ]}')
    data = ask_json(cfg["settings"], prompt, timeout=240)
    acts = [a for a in data.get("acciones") or [] if isinstance(a, dict) and a.get("tipo") in ("crear", "editar", "grupo")]
    return {"answer": str(data.get("respuesta") or ""), "actions": acts}


# =========================================================================== improve from images

def _node_images(cfg, segs, limit=4000, idx=None) -> list:
    """Images stored in every concrete folder of a node (all variable values and subfolders)."""
    dest = Path(cfg["settings"]["destination"])
    idx = idx or core.DiskIndex(dest)
    out = []
    for rel, _ in idx.expand(segs):
        for root, dirs, files in os.walk(dest.joinpath(*rel)):
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            for fn in files:
                if os.path.splitext(fn)[1].lower() in core.AI_EXT:
                    out.append(Path(root) / fn)
            if len(out) >= limit:
                return out
    return out


def _spread_sample(paths: list, count: int) -> list:
    """Random images taken in turn from each folder, so every value and subfolder is represented."""
    by_dir = {}
    for p in paths:
        by_dir.setdefault(str(p.parent).lower(), []).append(p)
    pools = list(by_dir.values())
    for pool in pools:
        random.shuffle(pool)
    random.shuffle(pools)
    out = []
    while pools and len(out) < count:
        for pool in list(pools):
            while pool:
                p = pool.pop()
                try:
                    if p.stat().st_size <= core.MAX_AI_BYTES:
                        out.append(p)
                        break
                except OSError:
                    pass
            if not pool:
                pools.remove(pool)
            if len(out) >= count:
                break
    return out


def _corrections(cfg, segs_list, jobs, limit=3) -> tuple:
    """Reviewed images the user sent to a different place than the AI proposed, relative to these folders."""
    dest = cfg["settings"]["destination"]
    into, out = [], []
    inside = lambda parts: any(core.path_matches(s, parts) for s in segs_list)  # noqa: E731
    for job in sorted(list(jobs.jobs.values()) if jobs else [], key=lambda j: -j.created):
        with job.lock:
            items = [dict(it) for it in job.items]
        for it in items:
            if it.get("decision") != "applied" or not it.get("dest") or not it.get("proposal"):
                continue
            target = Path(it["dest"])
            applied = core.rel_parts(dest, target.parent)
            if applied is None or target.suffix.lower() not in core.AI_EXT:
                continue
            proposed = tuple(x for x in str(it["proposal"]).split("/") if x)
            here_now, here_ai = inside(applied), inside(proposed)
            if here_now == here_ai:
                continue
            try:
                if not target.is_file() or target.stat().st_size > core.MAX_AI_BYTES:
                    continue
            except OSError:
                continue
            entry = {"path": str(target), "proposal": "/".join(proposed), "applied": "/".join(applied)}
            if here_now and len(into) < limit:
                into.append(entry)
            elif here_ai and len(out) < limit:
                out.append(entry)
        if len(into) >= limit and len(out) >= limit:
            break
    return into, out


def _material(cfg, segs_list, count, jobs) -> tuple:
    """Sample images from the folders plus the corrections that concern them (never the same file twice)."""
    count = max(2, min(16, int(count or 8)))
    into, out = _corrections(cfg, segs_list, jobs)
    skip = {os.path.normcase(e["path"]) for e in into + out}
    idx = core.DiskIndex(Path(cfg["settings"]["destination"]))
    paths = []
    for segs in segs_list:
        for p in _node_images(cfg, segs, idx=idx):
            k = os.path.normcase(str(p))
            if k not in skip:
                skip.add(k)
                paths.append(p)
    samples = _spread_sample(paths, count)
    if not samples and not into:
        raise ValueError("Esta carpeta todavía no tiene imágenes que analizar")
    return samples, into, out


def _ask_improve(cfg, header, samples, into, out, task, where) -> dict:
    images, legend = list(samples), []
    if samples:
        legend.append(f"- Imágenes 1 a {len(samples)}: ya están guardadas en {where} (son ejemplos correctos).")
    for e in into:
        images.append(Path(e["path"]))
        legend.append(f"- Imagen {len(images)}: la IA clasificadora la mandó a «{e['proposal']}», pero el usuario la "
                      f"corrigió y la puso en «{e['applied']}». La nueva definición debe incluir casos así.")
    for e in out:
        images.append(Path(e["path"]))
        legend.append(f"- Imagen {len(images)}: la IA clasificadora la propuso para «{e['proposal']}», pero el usuario la "
                      f"corrigió y la mandó a «{e['applied']}». La nueva definición debe dejar fuera casos así.")
    prompt = (INTRO + header +
              f"\nTe adjunto {len(images)} imagen(es), en este orden:\n" + "\n".join(legend) + "\n\n"
              f"Analiza qué tienen en común las imágenes de {where} y qué las distingue de las hermanas. "
              "Generaliza: no describas una imagen concreta.\n" + task +
              "- analisis: de 1 a 3 frases: qué tienen en común las imágenes y qué has cambiado respecto al criterio actual.\n"
              "Escribe las señales y exclusiones como etiquetas cortas de 1 a 4 palabras. Responde SOLO con JSON:\n"
              '{"descripcion": "...", "incluir": ["..."], "excluir": ["..."], "analisis": "..."}')
    return ask_json(cfg["settings"], prompt, images, timeout=max(300, int(cfg["settings"].get("timeout") or 0)))


def _result(data, samples, into, out, with_include=True) -> dict:
    def clean(xs, cap):
        return [str(x).strip() for x in (xs or []) if str(x).strip()][:cap]

    used = ([{"path": str(p), "role": "ejemplo"} for p in samples] +
            [{"path": e["path"], "role": "corregida hacia aquí", "detail": f"la IA dijo {e['proposal']}"} for e in into] +
            [{"path": e["path"], "role": "corregida fuera", "detail": f"el usuario la puso en {e['applied']}"} for e in out])
    return {"description": str(data.get("descripcion") or "").strip(),
            "include": clean(data.get("incluir"), 10) if with_include else [],
            "exclude": clean(data.get("excluir"), 8),
            "analysis": str(data.get("analisis") or "").strip(),
            "images": used}


TASK_FOLDER = ("Mejora la definición para que la IA clasificadora acierte más en el futuro:\n"
               "- descripcion: máx. 35 palabras, concreta y visual: qué se ve en las imágenes que van aquí y en qué "
               "se diferencian de las carpetas hermanas.\n"
               "- incluir: la lista COMPLETA de 3 a 8 señales visuales (conserva las actuales que sigan siendo útiles "
               "y quita las que no encajan con las imágenes).\n"
               "- excluir: la lista COMPLETA de 0 a 6 casos parecidos que van en otra carpeta.\n")


def improve_node(cfg, node_id, count=8, jobs=None) -> dict:
    """Looks at the images already in a folder (and past corrections) and rewrites its criteria."""
    n, segs, _ = core.find(cfg, node_id)
    if not n or node_id == "root":
        raise KeyError("Carpeta no encontrada")
    samples, into, out = _material(cfg, [segs], count, jobs)
    g = core.groups_by_id(cfg).get(n.get("group"))
    cr = core.criteria(cfg, n)
    is_var = n["kind"] == "variable"
    header = _node_brief(cfg, n, segs)
    if g:
        header += (f"\nEsta carpeta usa el grupo «{g['name']}», que ya aporta: «{g.get('description') or '(sin descripción)'}»"
                   f" | señales: {', '.join(g.get('include') or []) or '(ninguna)'}"
                   f" | NO si: {', '.join(g.get('exclude') or []) or '(ninguna)'}. Ese texto lo comparten otras "
                   "carpetas y no lo cambias: escribe SOLO el detalle propio de esta carpeta, sin repetir lo del grupo.\n")
    if is_var:
        idx = core.DiskIndex(Path(cfg["settings"]["destination"]))
        vals = {}
        for rel, binds in idx.expand(segs):
            v = binds.get(n["name"])
            vals[v] = vals.get(v, 0) + idx.total.get(rel, 0)
        listed = ", ".join(f"{k} ({v})" for k, v in sorted(vals.items(), key=lambda kv: -kv[1])[:80]) or "(ninguno todavía)"
        header += f"Valores que ya ha escrito la IA (nombre e imágenes): {listed}\n"
        task = ("Es una carpeta VARIABLE: la IA clasificadora escribe el nombre real de la carpeta (p. ej. una especie). "
                "Mejora la 'descripcion' para que explique con precisión QUÉ nombre debe escribir y con qué formato, "
                "a la vista de los valores y las imágenes. Si hay valores que deberían unificarse (sinónimos, plurales, "
                "grafías distintas), dilo en el análisis. Deja 'incluir' vacío; usa 'excluir' solo si hay casos que "
                "no deben llegar a esta rama.\n")
    else:
        task = TASK_FOLDER
    header += (f"Criterio completo que lee hoy la IA clasificadora: {cr['description'] or '(sin descripción)'}"
               f" | Señales: {', '.join(cr['include']) or '(ninguna)'} | NO si: {', '.join(cr['exclude']) or '(ninguna)'}\n")
    data = _ask_improve(cfg, header, samples, into, out, task, "esta carpeta")
    return _result(data, samples, into, out, with_include=not is_var)


def improve_group(cfg, group_id, count=8, jobs=None) -> dict:
    """Rewrites a shared group from the images of every folder that uses it."""
    g = core.groups_by_id(cfg).get(group_id)
    if not g:
        raise KeyError("Grupo no encontrado")
    members = [(n, segs, parent) for n, segs, parent in core.walk(cfg["root"]) if n.get("group") == group_id]
    if not members:
        raise ValueError("El grupo no se usa en ninguna carpeta")
    samples, into, out = _material(cfg, [segs for _, segs, _ in members], count, jobs)
    siblings = {}
    member_ids = {n["id"] for n, _, _ in members}
    for _, _, parent in members:
        for c in (parent or cfg["root"])["children"]:
            if c["id"] in member_ids:
                continue
            cr = core.criteria(cfg, c)
            siblings.setdefault((core.segment(c), cr["description"]), cr)
    sib = "\n".join(f"- {name}{' (grupo ' + cr['group'] + ')' if cr['group'] else ''}: {desc or '(sin descripción)'}"
                    for (name, desc), cr in siblings.items()) or "(ninguna)"
    used_in = "\n".join(f"- {'/'.join(segs)}" + (f" (además tiene detalle propio: {n['description']})" if n["description"] else "")
                        for n, segs, _ in members)
    header = (f"Grupo de descripción compartida: «{g['name']}»\n"
              f"Descripción actual del grupo: {g.get('description') or '(vacía)'}\n"
              f"Señales actuales: {', '.join(g.get('include') or []) or '(ninguna)'}\n"
              f"Exclusiones actuales: {', '.join(g.get('exclude') or []) or '(ninguna)'}\n"
              f"Lo usan estas carpetas (la IA clasificadora lee el texto del grupo en todas ellas):\n{used_in}\n"
              f"Carpetas hermanas de las que debe distinguirse:\n{sib}\n")
    task = ("Mejora el texto COMPARTIDO del grupo para que valga en todas sus carpetas y la IA clasificadora acierte más:\n"
            "- descripcion: máx. 35 palabras, concreta y visual, sin mencionar una rama concreta (sirve para todas).\n"
            "- incluir: la lista COMPLETA de 3 a 8 señales visuales (conserva las actuales que sigan siendo útiles).\n"
            "- excluir: la lista COMPLETA de 0 a 6 casos parecidos que van en una carpeta hermana.\n")
    data = _ask_improve(cfg, header, samples, into, out, task, "las carpetas de este grupo")
    return _result(data, samples, into, out)


class ImproveBatch:
    """Many folders and groups analysed at once, each by its own AI call, several in parallel."""

    def __init__(self, cfg, tasks: list, count: int, threads: int, jobs=None):
        self.id = core.new_id()
        self.cfg, self.jobs = cfg, jobs
        self.count = max(2, min(16, int(count or 8)))
        self.threads = max(1, min(16, int(threads or 4)))
        self.created = time.time()
        self.lock = threading.Lock()
        self.stopped = False
        groups = core.groups_by_id(cfg)
        self.items, seen = [], set()
        for t in tasks:
            kind, tid = ("group" if t.get("kind") == "group" else "node"), str(t.get("id") or "")
            if (kind, tid) in seen:
                continue
            if kind == "group":
                if tid not in groups:
                    continue
                label = groups[tid]["name"]
            else:
                n, segs, _ = core.find(cfg, tid)
                if not n or tid == "root":
                    continue
                label = "/".join(segs)
            seen.add((kind, tid))
            self.items.append({"key": f"{kind}:{tid}", "kind": kind, "id": tid, "label": label,
                               "status": "queued", "result": None, "error": "", "applied": False})
        if not self.items:
            raise ValueError("No hay carpetas que analizar")

    def start(self):
        threading.Thread(target=self._run, daemon=True).start()
        return self

    def _run(self):
        with ThreadPoolExecutor(max_workers=min(self.threads, len(self.items))) as pool:
            list(pool.map(self._one, self.items))

    def _one(self, it):
        with self.lock:
            if self.stopped:
                it["status"] = "stopped"
                return
            it["status"] = "working"
        try:
            fn = improve_group if it["kind"] == "group" else improve_node
            res = fn(self.cfg, it["id"], self.count, self.jobs)
            with self.lock:
                it.update(status="done", result=res)
        except Exception as e:
            with self.lock:
                it.update(status="error", error=str(e))

    def stop(self):
        with self.lock:
            self.stopped = True
            for it in self.items:
                if it["status"] == "queued":
                    it["status"] = "stopped"

    def mark_applied(self, keys: list):
        with self.lock:
            for it in self.items:
                if it["key"] in keys and it["status"] == "done":
                    it["applied"] = True

    def view(self) -> dict:
        with self.lock:
            items = json.loads(json.dumps(self.items))
        return {"id": self.id, "created": self.created, "count": self.count, "threads": self.threads,
                "running": any(it["status"] in ("queued", "working") for it in items), "items": items}
