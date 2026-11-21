"""Image tags: a tag store that follows files when they move, and AI tagging runs."""
from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import ai
import core

DB_PATH = core.DATA_DIR / "etiquetas.json"
MAX_PER_CATEGORY = 8


def file_sha(path) -> str:
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def pkey(p) -> str:
    return os.path.normcase(os.path.normpath(str(p)))


def clean_value(v) -> str:
    return core.normalize(v, 40)


class TagDB:
    """Records keyed by file content (SHA-1): {"paths", "size", "tags": {category id: [values]}, "by", "time"}.

    A file is found by its path; when it was moved, renamed or copied outside the app, files with the
    size of a known record are hashed and matched by content, so their tags come back."""

    def __init__(self, path: Path = DB_PATH):
        self.path = path
        self.lock = threading.RLock()
        self.save_lock = threading.Lock()
        self.items, self.by_path, self.sizes = {}, {}, set()
        self.dirty = False
        self.sha_cache = {}
        try:
            self.items = json.loads(path.read_text(encoding="utf-8")).get("items") or {}
        except (OSError, json.JSONDecodeError, AttributeError):
            self.items = {}
        self._reindex()

    def _reindex(self):
        self.by_path = {pkey(p): sha for sha, rec in self.items.items() for p in rec.get("paths", [])}
        self.sizes = {rec.get("size") for rec in self.items.values()}

    def _set_paths(self, sha, paths):
        rec = self.items[sha]
        for p in rec.get("paths", []):
            if self.by_path.get(pkey(p)) == sha:
                self.by_path.pop(pkey(p), None)
        rec["paths"] = list(dict.fromkeys(paths))
        for p in rec["paths"]:
            self.by_path[pkey(p)] = sha
        self.dirty = True

    def save(self, force=False):
        with self.save_lock:
            with self.lock:
                if not (self.dirty or force):
                    return
                text = json.dumps({"version": 1, "items": self.items}, ensure_ascii=False, separators=(",", ":"))
                self.dirty = False
            try:
                core.DATA_DIR.mkdir(parents=True, exist_ok=True)
                tmp = self.path.with_suffix(".json.tmp")
                tmp.write_text(text, encoding="utf-8")
                os.replace(tmp, self.path)
            except OSError:
                with self.lock:
                    self.dirty = True

    def sha_of(self, path: Path, st=None) -> str:
        st = st or path.stat()
        k = (pkey(path), st.st_mtime_ns, st.st_size)
        sha = self.sha_cache.get(k)
        if not sha:
            sha = self.sha_cache[k] = file_sha(path)
        return sha

    def lookup(self, path, size):
        """The record of a file, or None when it has no tags."""
        k = pkey(path)
        with self.lock:
            sha = self.by_path.get(k)
            rec = self.items.get(sha) if sha else None
            if rec and rec.get("size") == size:
                return rec
            if rec:  # same path, different content: the file was replaced
                self._set_paths(sha, [p for p in rec["paths"] if pkey(p) != k])
            if size not in self.sizes:
                return None
        try:
            sha = self.sha_of(Path(path))
        except OSError:
            return None
        with self.lock:
            rec = self.items.get(sha)
            if rec:  # moved or copied: keep the paths that still exist and add this one
                self._set_paths(sha, [p for p in rec["paths"] if pkey(p) != k and os.path.exists(p)] + [str(path)])
            return rec

    def _record(self, path: Path):
        st = path.stat()
        sha = self.sha_of(path, st)
        with self.lock:
            rec = self.items.get(sha)
            if not rec:
                rec = self.items[sha] = {"paths": [], "size": st.st_size, "tags": {}}
                self.sizes.add(st.st_size)
            if pkey(path) not in {pkey(p) for p in rec["paths"]}:
                self._set_paths(sha, [p for p in rec["paths"] if os.path.exists(p)] + [str(path)])
            return rec

    def set_tags(self, path, tags: dict, by="manual", model=""):
        rec = self._record(Path(path))
        with self.lock:
            rec["tags"] = {k: list(v) for k, v in tags.items() if v}
            rec.update(by=by, time=time.time())
            if model:
                rec["model"] = model
            self.dirty = True
            return dict(rec["tags"])

    def edit(self, paths, add=None, remove=None, set_=None, clear=False) -> list:
        """Adds/removes values in several files at once; returns [{path, tags}]."""
        out = []
        for p in paths:
            try:
                rec = self._record(Path(p))
            except OSError as e:
                out.append({"path": p, "error": str(e)})
                continue
            with self.lock:
                tags = {} if clear else {k: list(v) for k, v in rec.get("tags", {}).items()}
                for cat, vals in (set_ or {}).items():
                    tags[cat] = list(dict.fromkeys(clean_value(v) for v in vals if clean_value(v)))
                for cat, vals in (add or {}).items():
                    cur = tags.setdefault(cat, [])
                    for v in vals:
                        v = clean_value(v)
                        if v and v not in cur:
                            cur.append(v)
                for cat, vals in (remove or {}).items():
                    drop = {clean_value(v) for v in vals}
                    tags[cat] = [v for v in tags.get(cat, []) if v not in drop]
                rec["tags"] = {k: v for k, v in tags.items() if v}
                rec.update(by="manual", time=time.time())
                self.dirty = True
                out.append({"path": p, "tags": dict(rec["tags"])})
        self.save()
        return out

    def rename_value(self, cat, old, new) -> int:
        old, new = clean_value(old), clean_value(new)
        changed = 0
        with self.lock:
            for rec in self.items.values():
                vals = rec.get("tags", {}).get(cat)
                if vals and old in vals:
                    rec["tags"][cat] = list(dict.fromkeys(new if v == old else v for v in vals if new or v != old))
                    if not rec["tags"][cat]:
                        del rec["tags"][cat]
                    changed += 1
            self.dirty = self.dirty or bool(changed)
        self.save()
        return changed

    def vocab(self) -> dict:
        """{category id: {value: number of files}} over the whole store."""
        out = {}
        with self.lock:
            for rec in self.items.values():
                for cat, vals in rec.get("tags", {}).items():
                    d = out.setdefault(cat, {})
                    for v in vals:
                        d[v] = d.get(v, 0) + 1
        return out


def list_scope(db: TagDB, path: str, recursive=True, limit=40000) -> dict:
    root = Path(path)
    if not root.is_dir():
        raise FileNotFoundError(f"No existe la carpeta: {path}")
    images = []
    for folder, dirs, names in os.walk(root):
        dirs[:] = sorted((d for d in dirs if not d.startswith(".")), key=str.lower) if recursive else []
        rel = "" if Path(folder) == root else os.path.relpath(folder, root)
        for fn in sorted(names, key=str.lower):
            if os.path.splitext(fn)[1].lower() not in core.IMAGE_EXT:
                continue
            fp = os.path.join(folder, fn)
            try:
                st = os.stat(fp)
            except OSError:
                continue
            rec = db.lookup(fp, st.st_size)
            images.append({"path": fp, "name": fn, "rel": rel, "size": st.st_size, "mtime": st.st_mtime,
                           "tags": dict(rec["tags"]) if rec else None, "by": rec.get("by") if rec else None})
            if len(images) >= limit:
                break
        if len(images) >= limit:
            break
    db.save()
    return {"path": str(root), "images": images, "truncated": len(images) >= limit}


# --------------------------------------------------------------------------- AI tagging

class Vocab:
    """Values already used per category, shared by a run so the AI keeps reusing the same words."""

    def __init__(self, cfg, counts: dict):
        self.lock = threading.Lock()
        self.cats = cfg["tags"]["categories"]
        self.counts = {c["id"]: dict(counts.get(c["id"], {})) for c in self.cats}

    def known(self, cid, top=40) -> list:
        with self.lock:
            return sorted(self.counts.get(cid, {}).items(), key=lambda kv: -kv[1])[:top]

    def resolve(self, cat, value):
        """Reuses an existing or suggested value with the same singular/plural form; None if not allowed."""
        v = clean_value(value)
        if not v:
            return None
        wanted = core.forms(v)
        with self.lock:
            known = self.counts.setdefault(cat["id"], {})
            pool = list(cat["values"]) + (list(known) if cat["open"] else [])
            for existing in pool:
                if core.forms(existing) & wanted:
                    return existing
            return v if cat["open"] else None

    def add(self, tags: dict):
        with self.lock:
            for cid, vals in tags.items():
                d = self.counts.setdefault(cid, {})
                for v in vals:
                    d[v] = d.get(v, 0) + 1


def build_prompt(cfg, vocab: Vocab) -> str:
    t = cfg["tags"]
    lines = []
    for c in t["categories"]:
        line = f"- {c['name']}: {c['description'] or '(sin descripción)'}"
        if c["open"]:
            sug = list(dict.fromkeys(c["values"] + [v for v, _ in vocab.known(c["id"])]))
            if sug:
                line += f" | Ya usadas: {', '.join(sug[:45])}"
        else:
            line += f" | SOLO estas: {', '.join(c['values']) or '(ninguna)'}"
        if not c["multi"]:
            line += " | UNA sola etiqueta"
        lines.append(line)
    example = ", ".join(f'"{c["name"]}": ["..."]' for c in t["categories"])
    return ("Etiquetas imágenes de una biblioteca de referencias para poder filtrarlas después. Mira la imagen y "
            "escribe, para cada categoría, las etiquetas que se VEN claramente.\n"
            + (f"{t['instructions'].strip()}\n" if t["instructions"].strip() else "") +
            "\nCATEGORÍAS:\n" + "\n".join(lines) + "\n\n"
            "Reglas: etiquetas cortas de 1 a 3 palabras, en español, en singular, minúsculas y sin tildes. "
            "Reutiliza una etiqueta ya usada si significa lo mismo; inventa una nueva solo si ninguna encaja. "
            f"Máximo {MAX_PER_CATEGORY} por categoría. Deja la lista vacía si la categoría no aplica.\n\n"
            "No uses herramientas. Responde SOLO con este JSON:\n{\"etiquetas\": {" + example + "}}")


def parse_answer(cfg, vocab: Vocab, text: str):
    cats = cfg["tags"]["categories"]
    by_name = {core.normalize(c["name"]): c for c in cats} | {core.normalize(c["id"]): c for c in cats}
    for obj in reversed(core.extract_jsons(text)):
        raw = obj.get("etiquetas") if isinstance(obj.get("etiquetas"), dict) else obj
        if not isinstance(raw, dict):
            continue
        out, matched = {}, False
        for k, vals in raw.items():
            cat = by_name.get(core.normalize(k))
            if not cat:
                continue
            matched = True
            if isinstance(vals, str):
                vals = [x for x in vals.split(",")]
            if not isinstance(vals, list):
                continue
            got = []
            for v in vals:
                r = vocab.resolve(cat, v) if isinstance(v, (str, int, float)) else None
                if r and r not in got:
                    got.append(r)
            got = got[:1] if not cat["multi"] else got[:MAX_PER_CATEGORY]
            if got:
                out[cat["id"]] = got
        if matched:
            return out
    return None


class TagJob:
    def __init__(self, cfg, db: TagDB, files: list, threads: int, label: str):
        self.id = core.new_id()
        self.cfg, self.db = cfg, db
        self.settings = cfg["settings"]
        self.threads = max(1, min(16, int(threads or 4)))
        self.label = label
        self.created = time.time()
        self.vocab = Vocab(cfg, db.vocab())
        self.lock = threading.Lock()
        self.stopped = False
        self.version = 0
        self.last_save = time.time()
        self.items = [{"id": str(i), "file": str(f), "name": Path(f).name, "status": "queued", "tags": None, "error": ""}
                      for i, f in enumerate(dict.fromkeys(str(f) for f in files))]

    def start(self, subset=None):
        threading.Thread(target=self._run, args=(subset,), daemon=True).start()
        return self

    def _set(self, it, **kw):
        with self.lock:
            it.update(kw)
            self.version += 1

    def _one(self, it):
        if self.stopped:
            return
        self._set(it, status="working")
        path = Path(it["file"])
        try:
            if not path.is_file():
                raise FileNotFoundError("el archivo ya no existe")
            if path.suffix.lower() not in core.AI_EXT:
                raise ValueError(f"formato {path.suffix} no admitido por la IA")
            if path.stat().st_size > core.MAX_AI_BYTES:
                raise ValueError("archivo de más de 10 MiB")
            tags, last = None, ""
            for _ in range(2):
                try:
                    last = ai.ask(self.settings, build_prompt(self.cfg, self.vocab), [path])
                except Exception as e:
                    last = f"ERROR: {e}"
                    continue
                tags = parse_answer(self.cfg, self.vocab, last)
                if tags is not None:
                    break
            if tags is None:
                raise ValueError(f"respuesta inválida: {last[:200]}")
            self.vocab.add(tags)
            self.db.set_tags(path, tags, by="ia", model=self.settings.get("model", ""))
            self._set(it, status="done", tags=tags, error="")
        except Exception as e:
            self._set(it, status="error", error=str(e))
        if time.time() - self.last_save > 5:
            self.last_save = time.time()
            self.db.save()

    def _run(self, subset=None):
        todo = subset or [it for it in self.items if it["status"] == "queued"]
        with ThreadPoolExecutor(max_workers=self.threads) as pool:
            list(pool.map(self._one, todo))
        self.db.save()
        with self.lock:
            self.version += 1

    def stop(self):
        with self.lock:
            self.stopped = True
            for it in self.items:
                if it["status"] == "queued":
                    it["status"] = "stopped"
            self.version += 1

    def retry(self):
        with self.lock:
            subset = [it for it in self.items if it["status"] in ("error", "stopped")]
            for it in subset:
                it.update(status="queued", error="")
            self.stopped = False
            self.version += 1
        if subset:
            self.start(subset)

    @property
    def running(self) -> bool:
        return any(it["status"] in ("queued", "working") for it in self.items)

    def view(self, full=True) -> dict:
        with self.lock:
            st = {}
            for it in self.items:
                st[it["status"]] = st.get(it["status"], 0) + 1
            out = {"id": self.id, "label": self.label, "created": self.created, "total": len(self.items),
                   "status": st, "running": self.running, "version": self.version}
            if full:
                out["items"] = [dict(it) for it in self.items]
            return out
