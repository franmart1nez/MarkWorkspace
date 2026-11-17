"""Folder-tree model, disk scanning, prompt building and file operations."""
from __future__ import annotations

import copy
import ctypes
import json
import os
import re
import shutil
import threading
import time
import unicodedata
import uuid
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
PROJECT_DIR = APP_DIR.parent
DATA_DIR = Path(os.environ.get("CLASIFICADOR_DATA") or PROJECT_DIR / "data")
CONFIG_PATH = Path(os.environ.get("CLASIFICADOR_CONFIG") or PROJECT_DIR / "clasificador.json")
HISTORY_PATH = DATA_DIR / "historial.jsonl"

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif", ".jfif"}
AI_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_AI_BYTES = 10 * 1024 * 1024

config_lock = threading.RLock()
fs_lock = threading.RLock()


def new_id() -> str:
    return uuid.uuid4().hex[:10]


# --------------------------------------------------------------------------- names

def normalize(name: str, limit: int = 60) -> str:
    """'Dragón ' -> 'dragon'; removes accents and characters invalid on Windows."""
    n = unicodedata.normalize("NFKD", str(name)).encode("ascii", "ignore").decode().lower()
    n = re.sub(r'[<>:"/\\|?*\x00-\x1f{}]', "", n)
    n = re.sub(r"\s+", " ", n).strip(" .")
    return n[:limit].strip(" .")


def safe_folder_name(name: str) -> str:
    """Keeps case and accents but removes characters invalid on Windows."""
    n = re.sub(r'[<>:"/\\|?*\x00-\x1f{}]', "", str(name))
    n = re.sub(r"\s+", " ", n).strip(" .")
    return n[:80].strip(" .")


IRREGULAR = {"aves": "ave", "peces": "pez"}


def forms(name: str) -> set:
    """Singular/plural variants so existing folders are reused."""
    n = normalize(name)
    if not n:
        return set()
    out = {n}
    if n in IRREGULAR:
        out.add(IRREGULAR[n])
    if n.endswith("s") and len(n) > 2:
        out.add(n[:-1])
    if n.endswith("es") and len(n) > 3:
        out.add(n[:-2])
    return out


# --------------------------------------------------------------------------- config

DEFAULT_SETTINGS = {
    "source": r"D:\AI\Game_References",
    "destination": r"D:\AI\Game_References\Clasificadas",
    "model": "opencode-go/deepseek-v4.1-flash",
    "effort": "high",
    "threads": 5,
    "limit": 20,
    "mode": "review",
    "threshold": 70,
    "unhide": True,
    "timeout": 180,
    "instructions": ("Mira la imagen y elige la carpeta que mejor la describe. "
                     "Si hay varios personajes, elige el más prominente."),
    "shortcuts": [],
}


def node(name, description="", children=None, kind="folder", **extra):
    n = {"id": new_id(), "name": name, "kind": kind, "description": description,
         "include": [], "exclude": [], "group": None, "open": False, "openHint": "",
         "children": children or []}
    n.update(extra)
    return n


def default_config() -> dict:
    """Tree migrated from the original script."""
    g = {
        "normal": {"id": new_id(), "name": "Contenido normal", "color": "#4caf7d",
                   "description": "Personaje sin contenido sexual ni erótico",
                   "include": ["ropa completa", "pose neutral"], "exclude": ["desnudo"]},
        "erotica": {"id": new_id(), "name": "Contenido erótico", "color": "#e0a03a",
                    "description": "Contenido erótico: desnudos o insinuaciones sexuales sin actos explícitos",
                    "include": ["desnudo", "lencería", "pose insinuante"], "exclude": ["acto sexual explícito"]},
        "sexual": {"id": new_id(), "name": "Contenido sexual", "color": "#d9534f",
                   "description": "Contenido sexual explícito",
                   "include": ["acto sexual explícito"], "exclude": []},
    }

    def rating():
        return [node(k, group=g[k]["id"]) for k in ("normal", "erotica", "sexual")]

    root = node("Clasificadas", children=[
        node("anime", "Ilustración de estilo anime o manga", children=[
            node("personajes", "Una o varias figuras con aspecto de personaje como sujeto principal", children=[
                node("especie", ("especie o tipo (orco, elfo, goblin, dragon, humano, lobo, gato, caballo...), "
                                 "en singular, en minúsculas y sin tildes"), kind="variable", children=[
                    node("masculino", "Personaje principal masculino", children=rating()),
                    node("femenino", "Personaje principal femenino", children=rating()),
                ]),
            ]),
            node("animales", "Animal como sujeto principal", children=[
                node("especie", "animal concreto, en singular y en minúsculas", kind="variable"),
            ]),
            node("escenarios", "Lugar o paisaje sin personaje protagonista", children=[
                node("interior", "Escenario interior (habitación, cueva, taberna...)"),
                node("exterior", "Escenario exterior (bosque, ciudad, montaña...)"),
            ]),
            node("otros", "Cualquier imagen anime que no encaje en las demás carpetas",
                 open=True, openHint="subcategoría de la imagen (mapa, objeto, interfaz...)"),
        ]),
        node("realista", "Fotografía o render de aspecto realista"),
    ])
    root["id"] = "root"
    return {"version": 1, "settings": dict(DEFAULT_SETTINGS), "groups": list(g.values()), "root": root}


def _fill_node(n: dict) -> dict:
    n.setdefault("id", new_id())
    n.setdefault("name", "carpeta")
    n.setdefault("kind", "folder")
    for k, v in (("description", ""), ("openHint", "")):
        n[k] = str(n.get(k) or v)
    for k in ("include", "exclude"):
        n[k] = [str(x).strip() for x in (n.get(k) or []) if str(x).strip()]
    n.setdefault("group", None)
    n["open"] = bool(n.get("open"))
    n["children"] = [_fill_node(c) for c in (n.get("children") or []) if isinstance(c, dict)]
    return n


def normalize_config(cfg: dict) -> dict:
    cfg = copy.deepcopy(cfg)
    settings = dict(DEFAULT_SETTINGS)
    settings.update(cfg.get("settings") or {})
    cfg["settings"] = settings
    cfg["groups"] = [g for g in (cfg.get("groups") or []) if isinstance(g, dict) and g.get("id")]
    for g in cfg["groups"]:
        g.setdefault("name", "Grupo")
        g.setdefault("color", "#6c8cd5")
        g["description"] = str(g.get("description") or "")
        g["include"] = [str(x) for x in (g.get("include") or [])]
        g["exclude"] = [str(x) for x in (g.get("exclude") or [])]
    root = cfg.get("root") or {"name": "Clasificadas"}
    root["id"] = "root"
    cfg["root"] = _fill_node(root)
    cfg["version"] = 1
    return cfg


def load_config() -> dict:
    with config_lock:
        if CONFIG_PATH.exists():
            try:
                return normalize_config(json.loads(CONFIG_PATH.read_text(encoding="utf-8")))
            except (OSError, json.JSONDecodeError):
                backup = CONFIG_PATH.with_suffix(".json.bak")
                if backup.exists():
                    return normalize_config(json.loads(backup.read_text(encoding="utf-8")))
                raise
        cfg = default_config()
        save_config(cfg)
        return cfg


def save_config(cfg: dict) -> dict:
    cfg = normalize_config(cfg)
    problems = validate(cfg)
    if any(p["level"] == "error" for p in problems):
        raise ValueError("; ".join(p["message"] for p in problems if p["level"] == "error"))
    with config_lock:
        text = json.dumps(cfg, ensure_ascii=False, indent=2)
        if CONFIG_PATH.exists():
            shutil.copy2(CONFIG_PATH, CONFIG_PATH.with_suffix(".json.bak"))
        tmp = CONFIG_PATH.with_suffix(".json.tmp")
        tmp.write_text(text, encoding="utf-8")
        os.replace(tmp, CONFIG_PATH)
    return cfg


# --------------------------------------------------------------------------- tree helpers

def segment(n: dict) -> str:
    return "{" + n["name"] + "}" if n.get("kind") == "variable" else n["name"]


def walk(root: dict, path=()):
    """Yields (node, segments, parent) for every node below root (root excluded)."""
    for c in root.get("children", []):
        segs = path + (segment(c),)
        yield c, segs, root
        yield from walk(c, segs)


def leaves(cfg: dict):
    for n, segs, _ in walk(cfg["root"]):
        if not n["children"]:
            yield n, segs


def find(cfg: dict, node_id: str):
    if node_id == "root":
        return cfg["root"], (), None
    for n, segs, parent in walk(cfg["root"]):
        if n["id"] == node_id:
            return n, segs, parent
    return None, None, None


def groups_by_id(cfg):
    return {g["id"]: g for g in cfg.get("groups", [])}


def criteria(cfg: dict, n: dict) -> dict:
    """Effective description and identifiers (group + own)."""
    g = groups_by_id(cfg).get(n.get("group"))
    desc = [d for d in ((g or {}).get("description", ""), n.get("description", "")) if d.strip()]
    inc = list(dict.fromkeys(((g or {}).get("include") or []) + n.get("include", [])))
    exc = list(dict.fromkeys(((g or {}).get("exclude") or []) + n.get("exclude", [])))
    return {"description": ". ".join(d.strip().rstrip(".") for d in desc), "include": inc, "exclude": exc,
            "group": (g or {}).get("name")}


VAR_RE = re.compile(r"^\{([^{}]+)\}$")


def validate(cfg: dict) -> list:
    out = []

    def err(msg, nid=None, level="error"):
        out.append({"level": level, "message": msg, "node": nid})

    def check(n, path):
        names = {}
        for c in n["children"]:
            label = "/".join(path + (segment(c),))
            if not str(c["name"]).strip():
                err(f"Hay una carpeta sin nombre en '{'/'.join(path) or 'raíz'}'", c["id"])
                continue
            if safe_folder_name(c["name"]) != c["name"]:
                err(f"'{label}' contiene caracteres no válidos para Windows", c["id"])
            key = normalize(segment(c))
            if key in names:
                err(f"Nombre repetido en el mismo nivel: '{label}'", c["id"])
            names[key] = c
            if c["kind"] == "variable" and not c["description"].strip() and not criteria(cfg, c)["description"]:
                err(f"La variable '{label}' necesita una descripción: la IA la usa para escribir el nombre",
                    c["id"], "warning")
            if not c["children"] and not criteria(cfg, c)["description"]:
                err(f"La carpeta final '{label}' no tiene descripción", c["id"], "warning")
            check(c, path + (segment(c),))
        variables = [c for c in n["children"] if c["kind"] == "variable"]
        if variables and len(n["children"]) > 1:
            err(f"'{'/'.join(path) or 'raíz'}' mezcla una carpeta variable con otras carpetas; "
                "la variable debe ser la única hija", variables[0]["id"])

    check(cfg["root"], ())
    if not any(True for _ in leaves(cfg)):
        err("El árbol no tiene carpetas", "root", "warning")
    return out


# --------------------------------------------------------------------------- disk scan

class DiskIndex:
    """Snapshot of the destination: directory children and image counts."""

    def __init__(self, root: Path):
        self.root = root
        self.children = {}   # rel tuple -> {normalized name: real name}
        self.direct = {}     # rel tuple -> image count in that folder
        self.total = {}      # rel tuple -> image count recursively
        if root.is_dir():
            self._scan(root, ())

    def _scan(self, path: Path, rel: tuple, depth=0):
        kids, count = {}, 0
        try:
            with os.scandir(path) as it:
                entries = list(it)
        except OSError:
            entries = []
        for e in entries:
            try:
                if e.is_dir(follow_symlinks=False):
                    if not e.name.startswith(".") and depth < 25:
                        kids[normalize(e.name, 200)] = e.name
                elif Path(e.name).suffix.lower() in IMAGE_EXT:
                    count += 1
            except OSError:
                pass
        self.children[rel] = kids
        self.direct[rel] = count
        total = count
        for real in kids.values():
            sub = rel + (real,)
            self._scan(path / real, sub, depth + 1)
            total += self.total.get(sub, 0)
        self.total[rel] = total

    def expand(self, segs) -> list:
        """Concrete existing folders for a template path: [(rel tuple, {var: value})]."""
        current = [((), {})]
        for s in segs:
            m = VAR_RE.match(s)
            nxt = []
            for rel, binds in current:
                kids = self.children.get(rel, {})
                if m:
                    for real in sorted(kids.values(), key=str.lower):
                        b = dict(binds)
                        b[m.group(1)] = real
                        nxt.append((rel + (real,), b))
                else:
                    real = kids.get(normalize(s, 200))
                    if real:
                        nxt.append((rel + (real,), binds))
            current = nxt
        return current


def node_stats(cfg: dict) -> dict:
    dest = Path(cfg["settings"]["destination"])
    idx = DiskIndex(dest)
    out = {"root": {"exists": dest.is_dir(), "images": idx.total.get((), 0),
                    "direct": idx.direct.get((), 0), "paths": [str(dest)], "values": []}}
    for n, segs, _ in walk(cfg["root"]):
        ex = idx.expand(segs)
        stats = {"exists": bool(ex), "images": sum(idx.total.get(r, 0) for r, _ in ex),
                 "direct": sum(idx.direct.get(r, 0) for r, _ in ex),
                 "paths": [str(dest.joinpath(*r)) for r, _ in ex[:50]], "values": []}
        if n["kind"] == "variable":
            vals = {}
            for r, b in ex:
                v = b.get(n["name"])
                vals[v] = vals.get(v, 0) + idx.total.get(r, 0)
            stats["values"] = [{"name": k, "images": v} for k, v in sorted(vals.items(), key=lambda kv: -kv[1])]
        if not n["children"]:
            subs = {}
            for r, _ in ex:
                for real in idx.children.get(r, {}).values():
                    subs[real] = subs.get(real, 0) + idx.total.get(r + (real,), 0)
            stats["subfolders"] = [{"name": k, "images": v} for k, v in sorted(subs.items())]
        out[n["id"]] = stats
    return out


# --------------------------------------------------------------------------- prompt

class PromptContext:
    """Known variable values and open-folder subfolders, shared by a classification job."""

    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.lock = threading.Lock()
        self.leaves = [("/".join(segs), n, segs) for n, segs in leaves(cfg)]
        self.by_template = {t: (n, segs) for t, n, segs in self.leaves}
        idx = DiskIndex(Path(cfg["settings"]["destination"]))
        self.values = {}     # (prefix template, var) -> set of names
        self.subs = {}       # leaf template -> set of names
        for t, n, segs in self.leaves:
            for i, s in enumerate(segs):
                m = VAR_RE.match(s)
                if m:
                    key = ("/".join(segs[:i]), m.group(1))
                    if key not in self.values:
                        self.values[key] = {b[m.group(1)] for _, b in idx.expand(segs[:i + 1])}
            if n["open"]:
                found = set()
                for r, _ in idx.expand(segs):
                    found.update(idx.children.get(r, {}).values())
                self.subs[t] = found

    def register_value(self, key, proposal: str) -> str:
        name = normalize(proposal, 40) or "desconocido"
        wanted = forms(name)
        with self.lock:
            known = self.values.setdefault(key, set())
            for existing in known:
                if forms(existing) & wanted:
                    return existing
            known.add(name)
            return name

    def register_sub(self, template: str, proposal: str) -> str:
        sub = normalize(proposal, 40)
        if not sub:
            return ""
        wanted = forms(sub)
        with self.lock:
            known = self.subs.setdefault(template, set())
            for existing in known:
                if forms(existing) & wanted:
                    return existing
            known.add(sub)
            return sub

    def outline(self) -> str:
        cfg = self.cfg
        lines = []

        def rec(n, depth, segs):
            for c in n["children"]:
                s = segs + (segment(c),)
                cr = criteria(cfg, c)
                line = "  " * depth + f"- {segment(c)}"
                if c["kind"] == "variable":
                    key = ("/".join(segs), c["name"])
                    used = ", ".join(sorted(self.values.get(key, set()))) or "ninguno todavía"
                    line += f" [CARPETA VARIABLE: tú escribes el nombre = {cr['description'] or c['name']}. Ya usados: {used}]"
                elif cr["description"]:
                    line += f": {cr['description']}"
                if cr["include"] and c["kind"] != "variable":
                    line += f" | Señales: {', '.join(cr['include'])}"
                if cr["exclude"]:
                    line += f" | NO si: {', '.join(cr['exclude'])}"
                if not c["children"]:
                    t = "/".join(s)
                    if c["open"]:
                        ex = ", ".join(sorted(self.subs.get(t, set()))) or "ninguna todavía"
                        line += f" [admite subcarpeta: {c['openHint'] or 'subcategoría'}. Ya existen: {ex}]"
                lines.append(line)
                rec(c, depth + 1, s)

        rec(cfg["root"], 0, ())
        return "\n".join(lines)

    def prompt(self) -> str:
        s = self.cfg["settings"]
        with self.lock:
            outline = self.outline()
        leaves_txt = "\n".join(f"- {t}" for t, _, _ in self.leaves)
        variables = sorted({VAR_RE.match(x).group(1) for _, _, segs in self.leaves for x in segs if VAR_RE.match(x)})
        vals_json = "{" + ", ".join(f'"{v}": "<valor>"' for v in variables) + "}"
        text = (f"{s['instructions']}\n\n"
                "ÁRBOL DE CARPETAS. Cada nivel tiene su criterio; una imagen solo puede ir a una rama si "
                "cumple el criterio de TODOS sus niveles. 'Señales' son pistas a favor y 'NO si' descarta la carpeta.\n"
                f"{outline}\n\n"
                "CARPETAS FINALES VÁLIDAS (elige exactamente UNA, copiándola tal cual, con sus llaves {...}):\n"
                f"{leaves_txt}\n\n")
        if variables:
            text += ("Para cada llave {...} escribe un valor corto, en singular, en minúsculas y sin tildes. "
                     "Reutiliza un valor ya usado si encaja.\n")
        if any(n["open"] for _, n, _ in self.leaves):
            text += ("Si la carpeta admite subcarpeta, indica una (reutiliza una existente si encaja, si no, "
                     "inventa un nombre corto en español, singular y minúsculas). Si no, deja \"subcarpeta\" vacío.\n")
        text += ("\nNo uses herramientas. Responde SOLO con este JSON:\n"
                 '{"carpeta": "<ruta exacta de la lista>", "valores": ' + vals_json +
                 ', "subcarpeta": "", "confianza": <0-100>, "motivo": "<frase corta: qué ves y por qué esa carpeta>"}')
        return text


DECODER = json.JSONDecoder()


def extract_jsons(text: str) -> list:
    objs, i = [], 0
    while i < len(text):
        if text[i] == "{":
            try:
                obj, end = DECODER.raw_decode(text[i:])
            except json.JSONDecodeError:
                i += 1
                continue
            if isinstance(obj, dict):
                objs.append(obj)
                i += end
                continue
        i += 1
    return objs


def match_template(ctx: PromptContext, route: str):
    route = str(route).strip().strip("`\"'").replace("\\", "/").strip("/")
    if not route:
        return None, {}
    exact = {t.lower(): t for t in ctx.by_template}.get(route.lower())
    if exact:
        return exact, {}
    pieces = route.split("/")
    for t in ctx.by_template:
        parts = t.split("/")
        if len(parts) not in (len(pieces), len(pieces) - 1):
            continue
        found = {}
        for p, v in zip(parts, pieces):
            m = VAR_RE.match(p)
            if m:
                found[m.group(1)] = v
            elif normalize(p) != normalize(v):
                break
        else:
            if len(parts) == len(pieces) - 1:
                if not ctx.by_template[t][0]["open"]:
                    continue
                found["__sub__"] = pieces[-1]
            return t, found
    return None, {}


def resolve_answer(ctx: PromptContext, text: str):
    """Returns dict(template, path, confidence, reason) or None."""
    for cand in reversed(extract_jsons(text)):
        template, found = match_template(ctx, cand.get("carpeta", ""))
        if not template:
            continue
        vals = cand.get("valores")
        if isinstance(vals, str):
            try:
                vals = json.loads(vals)
            except json.JSONDecodeError:
                vals = {}
        vals = {str(k).strip().strip("{}").lower(): v for k, v in (vals or {}).items()} if isinstance(vals, dict) else {}
        parts = template.split("/")
        for i, p in enumerate(parts):
            m = VAR_RE.match(p)
            if m:
                var = m.group(1)
                prop = vals.get(var.lower()) or found.get(var) or ""
                parts[i] = ctx.register_value(("/".join(template.split("/")[:i]), var),
                                              prop if isinstance(prop, str) else "")
        path = "/".join(parts)
        if ctx.by_template[template][0]["open"]:
            sub = cand.get("subcarpeta") or found.get("__sub__") or ""
            sub = ctx.register_sub(template, sub if isinstance(sub, str) else "")
            if sub:
                path += "/" + sub
        try:
            conf = int(float(cand.get("confianza", 50)))
        except (TypeError, ValueError):
            conf = 50
        if 0 < conf <= 1 and isinstance(cand.get("confianza"), float):
            conf = int(cand["confianza"] * 100)
        return {"template": template, "path": path, "confidence": max(0, min(100, conf)),
                "reason": str(cand.get("motivo") or "")[:400]}
    return None


# --------------------------------------------------------------------------- file ops

def free_path(folder: Path, name: str) -> Path:
    p, n = folder / name, 1
    while p.exists():
        p = folder / f"{Path(name).stem}_{n}{Path(name).suffix}"
        n += 1
    return p


def unhide(p: Path):
    if os.name != "nt":
        return
    try:
        k32 = ctypes.windll.kernel32
        k32.GetFileAttributesW.restype = ctypes.c_uint32
        k32.GetFileAttributesW.argtypes = [ctypes.c_wchar_p]
        k32.SetFileAttributesW.argtypes = [ctypes.c_wchar_p, ctypes.c_uint32]
        attrs = k32.GetFileAttributesW(str(p))
        if attrs != 0xFFFFFFFF and attrs & 2:
            k32.SetFileAttributesW(str(p), attrs & ~2)
    except Exception:
        pass


def record_history(kind: str, items: list, label: str = "", group: str | None = None):
    if not items:
        return None
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    batch = {"id": new_id(), "time": time.time(), "kind": kind, "label": label, "items": items}
    if group:
        batch["group"] = group
    with fs_lock, open(HISTORY_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(batch, ensure_ascii=False) + "\n")
    return batch["id"]


def read_history(limit=30) -> list:
    if not HISTORY_PATH.exists():
        return []
    rows = []
    for line in HISTORY_PATH.read_text(encoding="utf-8").splitlines():
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            pass
    return rows[-limit:][::-1]


def transfer(files: list, dest: Path, op: str = "move", do_unhide=True, label="", group=None) -> dict:
    """Moves or copies files into dest. Records one undoable history batch."""
    results, done = [], []
    with fs_lock:
        dest.mkdir(parents=True, exist_ok=True)
        for f in files:
            src = Path(f)
            try:
                if not src.is_file():
                    raise FileNotFoundError("no existe")
                if src.parent.resolve() == dest.resolve() and op == "move":
                    results.append({"from": str(src), "to": str(src), "ok": True, "skipped": True})
                    continue
                target = free_path(dest, src.name)
                (shutil.copy2 if op == "copy" else shutil.move)(str(src), str(target))
                if do_unhide:
                    unhide(target)
                results.append({"from": str(src), "to": str(target), "ok": True})
                done.append({"from": str(src), "to": str(target), "op": op})
            except Exception as e:
                results.append({"from": str(src), "ok": False, "error": str(e)})
    batch = record_history(op, done, label, group)
    return {"results": results, "batch": batch}


def recycle(paths: list) -> dict:
    """Sends files to the Windows recycle bin (undo from the bin itself)."""
    results = []
    for p in paths:
        try:
            _recycle_one(Path(p))
            results.append({"path": p, "ok": True})
        except Exception as e:
            results.append({"path": p, "ok": False, "error": str(e)})
    return {"results": results}


def _recycle_one(p: Path):
    if not p.exists():
        raise FileNotFoundError("no existe")
    if os.name != "nt":
        raise OSError("solo disponible en Windows")
    from ctypes import wintypes

    class SHFILEOPSTRUCTW(ctypes.Structure):
        _fields_ = [("hwnd", wintypes.HWND), ("wFunc", wintypes.UINT), ("pFrom", wintypes.LPCWSTR),
                    ("pTo", wintypes.LPCWSTR), ("fFlags", ctypes.c_ushort), ("fAnyOperationsAborted", wintypes.BOOL),
                    ("hNameMappings", ctypes.c_void_p), ("lpszProgressTitle", wintypes.LPCWSTR)]

    op = SHFILEOPSTRUCTW()
    op.wFunc = 3  # FO_DELETE
    op.pFrom = str(p.resolve()) + "\0"
    op.fFlags = 0x40 | 0x10 | 0x4 | 0x400  # ALLOWUNDO | NOCONFIRMATION | SILENT | NOERRORUI
    rc = ctypes.windll.shell32.SHFileOperationW(ctypes.byref(op))
    if rc:
        raise OSError(f"SHFileOperation código {rc}")


def _undo_batch(batch) -> tuple:
    restored, errors = [], []
    for it in reversed(batch["items"]):
        to, frm = Path(it["to"]), Path(it["from"])
        try:
            if it["op"] == "copy":
                _recycle_one(to)
                restored.append({"from": str(to), "to": "(papelera)"})
            else:
                frm.parent.mkdir(parents=True, exist_ok=True)
                target = free_path(frm.parent, frm.name)
                shutil.move(str(to), str(target))
                restored.append({"from": str(to), "to": str(target)})
        except Exception as e:
            errors.append(f"{to.name}: {e}")
    return restored, errors


def undo_last() -> dict:
    """Undoes the newest batch; batches sharing its group (one review click or one auto run) go together."""
    hist = read_history(5000)
    undone_ids = {h.get("undoes") for h in hist if h.get("kind") == "undo"}
    live = [b for b in hist if b.get("kind") in ("move", "copy") and b["id"] not in undone_ids]
    if not live:
        return {"undone": None, "count": 0, "errors": ["No hay nada que deshacer"]}
    first = live[0]
    batches = [b for b in live if first.get("group") and b.get("group") == first["group"]] or [first]
    restored, errors = [], []
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with fs_lock:
        for batch in batches:
            r, e = _undo_batch(batch)
            restored += r
            errors += e
            with open(HISTORY_PATH, "a", encoding="utf-8") as f:
                f.write(json.dumps({"id": new_id(), "time": time.time(), "kind": "undo", "undoes": batch["id"],
                                    "items": r}, ensure_ascii=False) + "\n")
    label = first.get("label", "") if len(batches) == 1 else f"{len(batches)} lotes de la misma tanda"
    return {"undone": first["id"], "label": label, "count": len(restored), "errors": errors, "restored": restored}


def merge_folder(src: Path, dst: Path):
    """Moves the contents of src into dst (creating it), renaming on collisions."""
    dst.mkdir(parents=True, exist_ok=True)
    for e in list(src.iterdir()):
        target = dst / e.name
        if e.is_dir():
            if target.exists():
                merge_folder(e, target)
            else:
                shutil.move(str(e), str(target))
        else:
            shutil.move(str(e), str(free_path(dst, e.name)))
    try:
        src.rmdir()
    except OSError:
        pass


def relocate(cfg: dict, old_segs: list, new_segs: list) -> dict:
    """Renames/moves every concrete disk folder of a tree node after a rename or move."""
    dest = Path(cfg["settings"]["destination"])
    idx = DiskIndex(dest)
    moved, skipped = [], []
    with fs_lock:
        for rel, binds in idx.expand(old_segs):
            parts = []
            for s in new_segs:
                m = VAR_RE.match(s)
                if m:
                    if m.group(1) not in binds:
                        parts = None
                        break
                    parts.append(binds[m.group(1)])
                else:
                    parts.append(s)
            src = dest.joinpath(*rel)
            if parts is None:
                skipped.append(f"{src}: el nuevo lugar necesita un valor de variable que no existe")
                continue
            dst = dest.joinpath(*parts)
            if src.resolve() == dst.resolve():
                continue
            try:
                if dst.exists():
                    if src.resolve().as_posix().lower() == dst.resolve().as_posix().lower():
                        tmp = src.with_name(src.name + ".__tmp__")
                        src.rename(tmp)
                        tmp.rename(dst)
                    else:
                        merge_folder(src, dst)
                else:
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(src), str(dst))
                moved.append({"from": str(src), "to": str(dst)})
            except Exception as e:
                skipped.append(f"{src}: {e}")
    return {"moved": moved, "skipped": skipped}


def plan_tree_on_disk(cfg: dict) -> list:
    """Folders of the tree that can be created now (variables expand to existing values)."""
    dest = Path(cfg["settings"]["destination"])
    idx = DiskIndex(dest)
    missing = []

    def rec(n, concretes):
        for c in n["children"]:
            nxt = []
            for rel in concretes:
                if c["kind"] == "variable":
                    nxt.extend(rel + (real,) for real in idx.children.get(rel, {}).values())
                else:
                    real = idx.children.get(rel, {}).get(normalize(c["name"], 200))
                    new_rel = rel + (real or c["name"],)
                    if not real and not dest.joinpath(*new_rel).exists():
                        missing.append(str(dest.joinpath(*new_rel)))
                    nxt.append(new_rel)
            rec(c, nxt)

    rec(cfg["root"], [()])
    return sorted(set(missing))


def import_from_disk(cfg: dict) -> list:
    """Folder nodes found on disk but not in the tree, as [{parent_id, node}]."""
    dest = Path(cfg["settings"]["destination"])
    idx = DiskIndex(dest)
    additions = []

    def build(rel):
        return [node(real, children=build(rel + (real,))) for real in sorted(idx.children.get(rel, {}).values(), key=str.lower)]

    def rec(n, rel):
        if any(c["kind"] == "variable" for c in n["children"]):
            var = next(c for c in n["children"] if c["kind"] == "variable")
            for real in idx.children.get(rel, {}).values():
                rec(var, rel + (real,))
            return
        known = {normalize(c["name"], 200): c for c in n["children"]}
        for key, real in sorted(idx.children.get(rel, {}).items()):
            if key in known:
                rec(known[key], rel + (real,))
            elif not n["open"] or n["children"]:
                if not any(a["parent"] == n["id"] and normalize(a["node"]["name"], 200) == key for a in additions):
                    additions.append({"parent": n["id"], "node": node(real, children=build(rel + (real,)))})

    rec(cfg["root"], ())
    return additions


def list_dir(path: str, recursive=False, limit=20000) -> dict:
    p = Path(path)
    if not p.is_dir():
        raise FileNotFoundError(f"No existe la carpeta: {path}")
    dirs, images = [], []

    def add_image(e, rel=""):
        try:
            st = e.stat()
            images.append({"name": e.name, "path": e.path, "size": st.st_size, "mtime": st.st_mtime, "rel": rel})
        except OSError:
            pass

    with os.scandir(p) as it:
        entries = sorted(it, key=lambda e: e.name.lower())
    for e in entries:
        try:
            if e.is_dir(follow_symlinks=False):
                if e.name.startswith("."):
                    continue
                count, sub, preview = 0, 0, []
                try:
                    with os.scandir(e.path) as it2:
                        for e2 in it2:
                            if e2.is_dir(follow_symlinks=False):
                                sub += 1
                            elif Path(e2.name).suffix.lower() in IMAGE_EXT:
                                count += 1
                                if len(preview) < 4:
                                    preview.append(e2.path)
                except OSError:
                    pass
                dirs.append({"name": e.name, "path": e.path, "images": count, "subdirs": sub, "preview": preview})
            elif Path(e.name).suffix.lower() in IMAGE_EXT:
                add_image(e)
        except OSError:
            pass
    if recursive:
        for root, dnames, fnames in os.walk(p):
            dnames[:] = [d for d in dnames if not d.startswith(".")]
            if Path(root) == p:
                continue
            rel = os.path.relpath(root, p)
            for fn in sorted(fnames, key=str.lower):
                if Path(fn).suffix.lower() in IMAGE_EXT:
                    fp = os.path.join(root, fn)
                    try:
                        st = os.stat(fp)
                        images.append({"name": fn, "path": fp, "size": st.st_size, "mtime": st.st_mtime, "rel": rel})
                    except OSError:
                        pass
                if len(images) >= limit:
                    break
            if len(images) >= limit:
                break
    parent = str(p.parent) if p.parent != p else None
    return {"path": str(p), "parent": parent, "dirs": dirs, "images": images[:limit], "truncated": len(images) >= limit}


def dir_tree(path: str, max_nodes=6000) -> dict:
    """Nested folder listing for pickers."""
    p = Path(path)
    count = [0]

    def rec(q: Path, depth):
        out = []
        if depth > 12 or count[0] > max_nodes:
            return out
        try:
            with os.scandir(q) as it:
                for e in sorted(it, key=lambda e: e.name.lower()):
                    if e.is_dir(follow_symlinks=False) and not e.name.startswith("."):
                        count[0] += 1
                        out.append({"name": e.name, "path": e.path, "children": rec(Path(e.path), depth + 1)})
        except OSError:
            pass
        return out

    return {"name": p.name or str(p), "path": str(p), "children": rec(p, 0) if p.is_dir() else []}
