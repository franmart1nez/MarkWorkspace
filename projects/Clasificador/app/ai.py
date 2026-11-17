"""OpenCode calls: image classification jobs and tree-authoring assistance."""
from __future__ import annotations

import csv
import json
import os
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
