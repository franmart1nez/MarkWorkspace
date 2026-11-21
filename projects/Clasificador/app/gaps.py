"""Folder balance and web searches for the emptiest folders.

The balance counts the images of every final folder of a branch on disk, without the AI, and compares
each folder with the average of its equivalent folders: the same folder under the other values of a
variable (the other species) or, when there is no variable, its sibling folders.

A web search asks the AI for search terms that fit a folder (its whole criteria chain, so a realistic
branch gets photographs and a non-realistic branch gets drawings), downloads candidates from image
sources that only serve family-friendly content, lets the classifier check every candidate and moves
the accepted ones into the folder. Adult-content folders are never searched."""
from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import os
import random
import re
import shutil
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from pathlib import Path

import ai
import core
import dups

try:
    from PIL import Image
except Exception:  # Pillow is optional; image headers are checked by their signature instead
    Image = None

WEB_DIR = core.DATA_DIR / "web"
UA = "Clasificador/1.0 (organizador local de imagenes de referencia)"
ADULT_RE = re.compile(r"er[oó]tic|sexual|desnud|nsfw|adult|porn|hentai|xxx|expl[ií]cit", re.I)


def is_adult(group) -> bool:
    """Groups for adult content (by their name, or an explicit "adult" flag) are never searched on the web."""
    if not group:
        return False
    if "adult" in group:
        return bool(group["adult"])
    return bool(ADULT_RE.search(group.get("name") or ""))


# =========================================================================== balance (no AI)

def _chain(cfg, node_id) -> list:
    """Tree nodes from the first level down to node_id."""
    if node_id == "root":
        return []
    found = []

    def rec(n, acc):
        for c in n["children"]:
            if c["id"] == node_id or rec(c, acc + [c]):
                if not found:
                    found.extend(acc + [c])
                return True
        return False

    rec(cfg["root"], [])
    return found


def analyse(cfg, node_id="root") -> dict:
    dest = Path(cfg["settings"]["destination"])
    idx = core.DiskIndex(dest)
    groups = core.groups_by_id(cfg)
    base, base_segs, _ = core.find(cfg, node_id)
    if base is None:
        raise KeyError("Carpeta no encontrada")
    chain = _chain(cfg, node_id)
    leaves, levels = [], {}

    # Concrete folders of the analysed node: variables expand to the values on disk, fixed folders are
    # kept even when missing (they count as 0).
    starts = [((), {})]
    for n in chain:
        nxt = []
        for rel, b in starts:
            kids = idx.children.get(rel, {})
            if n["kind"] == "variable":
                nxt += [(rel + (real,), {**b, n["name"]: real}) for real in sorted(kids.values(), key=str.lower)]
            else:
                nxt.append((rel + (kids.get(core.normalize(n["name"], 200), n["name"]),), b))
        starts = nxt

    def rec(n, rel, tmpl, binds, nodes):
        kids = n["children"]
        if not kids:
            grp = next((groups[x["group"]] for x in reversed(nodes) if x.get("group") in groups), None)
            leaves.append({"rel": "/".join(rel), "parts": list(rel), "template": "/".join(tmpl),
                           "vars": [i for i, s in enumerate(tmpl) if core.VAR_RE.match(s)],
                           "values": binds, "count": idx.total.get(rel, 0), "exists": rel in idx.total,
                           "group": grp["id"] if grp else None, "node": n["id"],
                           "adult": any(is_adult(groups.get(x.get("group"))) for x in nodes)})
            return
        var = next((c for c in kids if c["kind"] == "variable"), None)
        disk = idx.children.get(rel, {})
        if var:
            opts = [(var, real, real, {**binds, var["name"]: real}) for real in sorted(disk.values(), key=str.lower)]
        else:
            opts = [(c, c["name"], disk.get(core.normalize(c["name"], 200), c["name"]), binds) for c in kids]
        lv = levels.setdefault("/".join(tmpl), {"path": "/".join(tmpl), "node": n["id"],
                                                "variable": var["name"] if var else None, "options": {}})
        for c, label, real, b in opts:
            sub = rel + (real,)
            lv["options"][label] = lv["options"].get(label, 0) + idx.total.get(sub, 0)
            rec(c, sub, tmpl + (core.segment(c),), b, nodes + [c])

    for rel, b in starts:
        rec(base, rel, tuple(base_segs), b, chain)

    by_t, by_parent = {}, {}
    for lf in leaves:
        by_t.setdefault(lf["template"], []).append(lf)
        by_parent.setdefault(tuple(lf["parts"][:-1]), []).append(lf)
    for lf in leaves:
        peers, basis = by_t[lf["template"]], "values"
        if len(peers) < 2:
            peers, basis = by_parent[tuple(lf["parts"][:-1])], "siblings"
        if len(peers) < 2:
            lf.update(mean=None, ratio=None, missing=0, peers=len(peers), basis=None)
            continue
        mean = sum(x["count"] for x in peers) / len(peers)
        lf.update(mean=round(mean, 1), ratio=round(lf["count"] / mean, 3) if mean else None,
                  missing=max(0, math.ceil(mean - lf["count"] - 1e-9)), peers=len(peers), basis=basis)

    out_levels = []
    for lv in levels.values():
        opts = lv["options"]
        if len(opts) < 2:
            continue
        mean = sum(opts.values()) / len(opts)
        out_levels.append({"path": lv["path"], "node": lv["node"], "variable": lv["variable"],
                           "mean": round(mean, 1), "total": sum(opts.values()),
                           "options": [{"name": k, "total": v, "ratio": round(v / mean, 3) if mean else None}
                                       for k, v in sorted(opts.items(), key=lambda kv: (-kv[1], kv[0].lower()))]})
    gsum = {}
    for lf in leaves:
        if lf["group"]:
            gsum[lf["group"]] = gsum.get(lf["group"], 0) + lf["count"]
    in_leaves = sum(lf["count"] for lf in leaves)
    base_total = sum(idx.total.get(rel, 0) for rel, _ in starts)
    return {"node": node_id, "basePath": "/".join(base_segs), "total": base_total, "inLeaves": in_leaves,
            "leaves": leaves, "levels": out_levels, "time": time.time(),
            "groups": [{"id": gid, "name": groups[gid]["name"], "color": groups[gid].get("color"), "total": t,
                        "adult": is_adult(groups[gid])} for gid, t in gsum.items()]}


def target_info(cfg, rel: str) -> dict:
    """Tree chain of a concrete final folder; refuses folders that are not final or hold adult content."""
    parts = [p for p in str(rel).replace("\\", "/").split("/") if p.strip()]
    groups = core.groups_by_id(cfg)
    n, chain, tmpl, values = cfg["root"], [], [], {}
    for p in parts:
        c = next((x for x in n["children"] if x["kind"] == "variable"), None) or \
            next((x for x in n["children"] if core.normalize(x["name"], 200) == core.normalize(p, 200)), None)
        if not c:
            raise ValueError(f"«{rel}» no es una carpeta del árbol")
        if c["kind"] == "variable":
            values[c["name"]] = p
        chain.append(c)
        tmpl.append(core.segment(c))
        n = c
    if not chain or n["children"]:
        raise ValueError(f"«{rel}» no es una carpeta final del árbol")
    if any(is_adult(groups.get(x.get("group"))) for x in chain):
        raise ValueError(f"«{rel}» es de contenido para adultos: la búsqueda en internet solo usa fuentes "
                         "aptas para todo público y no busca para esas carpetas")
    return {"chain": chain, "template": tmpl, "values": values, "parts": parts}


def same_place(a, b) -> bool:
    pa = [x for x in str(a).replace("\\", "/").split("/") if x]
    pb = [x for x in str(b).replace("\\", "/").split("/") if x]
    return len(pa) == len(pb) and all(core.normalize(x, 200) == core.normalize(y, 200) or core.forms(x) & core.forms(y)
                                      for x, y in zip(pa, pb))


# =========================================================================== image sources

SOURCES = {
    "safebooru": "Safebooru: ilustraciones anime y manga aptas para todo público",
    "e926": "e926: arte furry y antropomórfico apto para todo público",
    "openverse": "Openverse: fotos e ilustraciones con licencia libre (Flickr, Wikimedia…)",
}
SOURCE_HELP = {
    "safebooru": ('ilustraciones anime/manga aptas para todo público, buscadas con etiquetas exactas de Danbooru en '
                  'inglés. "texto": de 2 a 4 etiquetas separadas por espacios, con guiones bajos dentro de cada una, '
                  'las imprescindibles primero: el sexo con "1girl" o "1boy", la especie o rasgo con su etiqueta exacta '
                  '("orc", "elf", "cat_girl", "colored_skin", "tusks", "pointy_ears", "horns"), luego "solo" y ropa o '
                  'pose ("armor", "dress", "full_body"). Una etiqueta que no existe deja la búsqueda vacía (p. ej. '
                  '"female" no existe: usa "1girl"). Solo para carpetas NO realistas.'),
    "e926": ('arte furry y antropomórfico apto para todo público (animales o monstruos con cuerpo humano), con '
             'etiquetas exactas de e621 en inglés. "texto": de 2 a 4 etiquetas, las imprescindibles primero: la especie '
             '("felid", "canine", "lagomorph", "reptile", "orc"), "anthro", el sexo ("female" o "male") y "solo". '
             'Solo para carpetas NO realistas.'),
    "openverse": ('fotos e ilustraciones con licencia libre (Flickr, Wikimedia…). "texto": de 2 a 5 palabras en inglés. '
                  'Indica "tipo": "photograph" para fotos o "illustration" para dibujos.'),
}
BLOCKED = {"nsfw", "nude", "nudity", "naked", "sex", "sexy", "sexual", "porn", "hentai", "ecchi", "lewd", "lingerie",
           "underwear", "panties", "bra", "thong", "bikini", "swimsuit", "breast", "breasts", "nipple", "nipples",
           "topless", "bottomless", "explicit", "erotic", "erotica", "fetish", "ass", "butt", "cleavage", "bdsm",
           "bondage", "gore", "guro", "naughty", "seductive"}
SOURCE_LOCKS = {k: threading.BoundedSemaphore(2) for k in SOURCES}  # at most 2 requests at once per site
DOWNLOADS_AT_ONCE = 3
IMG_EXT = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}


def clean_query(text, booru: bool) -> str:
    """Drops words that would ask for adult content and any rating/order syntax (the rating is set here)."""
    out = []
    for w in re.split(r"[\s,]+", str(text or "").strip()):
        lw = w.lower()
        if not w or lw.startswith(("rating:", "score:", "order:", "-")):
            continue
        if any(p in BLOCKED for p in re.split(r"[_\-:\s()]+", lw)):
            continue
        out.append(lw if booru else w)
    return " ".join(out[:4] if booru else out[:8])


def _get_json(url, timeout=45):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
    return json.loads(data) if data.strip() else []


def _booru_tries(text):
    tags = text.split()
    return [tags[:n] for n in range(len(tags), 0, -1)]


def search_safebooru(text, kind=""):
    data = []
    for tags in _booru_tries(text):
        data = _get_json("https://safebooru.org/index.php?" + urllib.parse.urlencode(
            {"page": "dapi", "s": "post", "q": "index", "json": 1, "limit": 100, "tags": " ".join(tags + ["rating:general"])}))
        if data:
            break
    out = []
    for p in data or []:
        if p.get("rating") != "general":
            continue
        url = p.get("file_url") or (f"https://safebooru.org/images/{p.get('directory')}/{p['image']}" if p.get("image") else "")
        if not url or Path(urllib.parse.urlparse(url).path).suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            continue
        out.append({"src": "safebooru", "key": f"safebooru:{p.get('id')}", "url": url,
                    "alt": p.get("sample_url") if p.get("sample") else "", "id": p.get("id"),
                    "page": f"https://safebooru.org/index.php?page=post&s=view&id={p.get('id')}",
                    "title": "", "author": "", "license": ""})
    return out


def search_e926(text, kind=""):
    posts = []
    for tags in _booru_tries(text):
        data = _get_json("https://e926.net/posts.json?" + urllib.parse.urlencode({"limit": 60, "tags": " ".join(tags + ["rating:s"])}))
        posts = data.get("posts", []) if isinstance(data, dict) else data
        if posts:
            break
    out = []
    for p in posts or []:
        if p.get("rating") != "s":
            continue
        f = p.get("files")
        if isinstance(f, dict):  # current format
            meta, orig = f.get("meta") or {}, f.get("original") or {}
            url, ext, size, md5 = orig.get("url"), meta.get("ext"), meta.get("size"), meta.get("md5")
            alt = (f.get("sample") or {}).get("jpg") if meta.get("has_sample") else ""
        else:  # older format
            fo = p.get("file") or {}
            url, ext, size, md5 = fo.get("url"), fo.get("ext"), fo.get("size"), fo.get("md5")
            alt = (p.get("sample") or {}).get("url") or ""
        if not url or ext not in ("jpg", "jpeg", "png", "webp"):
            continue
        if size and size > core.MAX_AI_BYTES:
            url, alt = alt, ""
        if url:
            out.append({"src": "e926", "key": f"e926:{md5 or p.get('id')}", "url": url, "alt": alt, "id": p.get("id"),
                        "page": f"https://e926.net/posts/{p.get('id')}", "title": "", "author": "", "license": ""})
    return out


def search_openverse(text, kind=""):
    params = {"q": text, "page_size": 20, "mature": "false"}
    if kind in ("photograph", "illustration", "digitized_artwork"):
        params["category"] = kind
    data = _get_json("https://api.openverse.org/v1/images/?" + urllib.parse.urlencode(params))
    out = []
    for r in data.get("results", []) if isinstance(data, dict) else []:
        if r.get("mature") or r.get("unstable__sensitivity"):
            continue
        ft = (r.get("filetype") or Path(urllib.parse.urlparse(r.get("url") or "").path).suffix.lstrip(".")).lower()
        if not r.get("url") or (ft and ft not in ("jpg", "jpeg", "png", "webp")):
            continue
        lic = str(r.get("license") or "")
        lic = lic.upper() if lic in ("cc0", "pdm") else (f"CC {lic.upper()} {r.get('license_version') or ''}".strip() if lic else "")
        out.append({"src": "openverse", "key": f"openverse:{r.get('id')}", "url": r["url"], "alt": r.get("thumbnail") or "",
                    "id": r.get("id"), "page": r.get("foreign_landing_url") or "", "title": r.get("title") or "",
                    "author": r.get("creator") or "", "license": lic})
    return out


SEARCH = {"safebooru": search_safebooru, "e926": search_e926, "openverse": search_openverse}


def download(url) -> tuple:
    """Returns (bytes, extension, width, height) of a JPEG/PNG/WebP image of at most 10 MiB."""
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "image/*,*/*;q=0.5"})
    with urllib.request.urlopen(req, timeout=45) as r:
        if int(r.headers.get("Content-Length") or 0) > core.MAX_AI_BYTES:
            raise ValueError("más de 10 MiB")
        data = r.read(core.MAX_AI_BYTES + 1)
    if len(data) > core.MAX_AI_BYTES:
        raise ValueError("más de 10 MiB")
    if Image is not None:
        try:
            with Image.open(io.BytesIO(data)) as im:
                fmt, w, h = im.format, im.width, im.height
        except Exception:
            raise ValueError("no es una imagen válida")
    else:
        fmt = "JPEG" if data[:3] == b"\xff\xd8\xff" else "PNG" if data[:8] == b"\x89PNG\r\n\x1a\n" else \
            "WEBP" if data[:4] == b"RIFF" and data[8:12] == b"WEBP" else ""
        w = h = 0
    if fmt not in IMG_EXT:
        raise ValueError(f"formato {fmt or 'desconocido'} no admitido")
    if w and h and min(w, h) < 256:
        raise ValueError("imagen demasiado pequeña")
    return data, IMG_EXT[fmt], w, h


class SeenStore:
    """Results already downloaded by earlier searches, so a new search brings new images."""

    def __init__(self):
        self.path = WEB_DIR / "vistas.json"
        self.lock = threading.Lock()
        self.data = None

    def _load(self):
        if self.data is None:
            try:
                self.data = json.loads(self.path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                self.data = {}

    def has(self, key) -> bool:
        with self.lock:
            self._load()
            return bool(key) and key in self.data

    def add(self, *keys):
        with self.lock:
            self._load()
            for k in keys:
                if k:
                    self.data[k] = int(time.time())

    def save(self):
        with self.lock:
            if self.data is None:
                return
            if len(self.data) > 60000:
                self.data = dict(sorted(self.data.items(), key=lambda kv: kv[1])[-50000:])
            try:
                WEB_DIR.mkdir(parents=True, exist_ok=True)
                tmp = self.path.with_suffix(".json.tmp")
                tmp.write_text(json.dumps(self.data, separators=(",", ":")), encoding="utf-8")
                os.replace(tmp, self.path)
            except OSError:
                pass


SEEN = SeenStore()


class Library:
    """Fingerprints already known (the repeated-image cache, the target folders and this search's downloads)."""
    DIST = 4

    def __init__(self):
        self.lock = threading.Lock()
        self.shas, self.buckets = set(), {}
        self.chunks = dups._chunks(self.DIST)
        for info in list(dups._load_cache().values()):
            self._add(info.get("sha"), int(info["dh"], 16) if info.get("dh") else None)

    @staticmethod
    def _usable(h):
        return h is not None and 3 <= bin(h).count("1") <= 61

    def _add(self, sha, h):
        if sha:
            self.shas.add(sha)
        if self._usable(h):
            for c, (shift, mask) in enumerate(self.chunks):
                self.buckets.setdefault((c, (h >> shift) & mask), []).append(h)

    def add_file(self, path):
        try:
            _, info = dups.fingerprint(Path(path))
        except Exception:
            return
        with self.lock:
            self._add(info.get("sha"), int(info["dh"], 16) if info.get("dh") else None)

    def known(self, sha, h) -> bool:
        """True when the image is already there (same file or nearly identical); otherwise remembers it."""
        with self.lock:
            if sha in self.shas:
                return True
            if self._usable(h):
                for c, (shift, mask) in enumerate(self.chunks):
                    if any(bin(h ^ o).count("1") <= self.DIST for o in self.buckets.get((c, (h >> shift) & mask), ())):
                        return True
            self._add(sha, h)
            return False


# =========================================================================== web search runs

class WebRun:
    def __init__(self, cfg, targets, mode="review", threshold=80, threads=4, sources=None):
        self.id = core.new_id()
        self.cfg, self.settings = cfg, cfg["settings"]
        self.mode = "auto" if mode == "auto" else "review"
        self.threshold = max(0, min(100, int(80 if threshold is None else threshold)))
        self.threads = max(1, min(16, int(threads or 4)))
        self.sources = [s for s in (sources or []) if s in SOURCES] or list(SOURCES)
        self.created = time.time()
        self.lock = threading.RLock()
        self.stopped = self.finished = False
        self.version = 0
        self.targets, seen = [], set()
        for t in targets:
            rel = "/".join(p.strip() for p in str(t.get("rel") or "").replace("\\", "/").split("/") if p.strip())
            if not rel or rel.lower() in seen:
                continue
            info = target_info(cfg, rel)
            seen.add(rel.lower())
            want = max(1, min(40, int(t.get("want") or 8)))
            self.targets.append({"id": str(len(self.targets)), "rel": rel, "template": info["template"], "want": want,
                                 "cap": min(60, math.ceil(want * 1.5) + 2), "status": "queued", "phase": "en cola",
                                 "queries": [], "note": "", "error": "", "cands": [], "added": 0, "reserved": 0,
                                 "dups": 0, "failed": 0, "next": 0})
        if not self.targets:
            raise ValueError("No hay carpetas válidas para buscar")
        n = len(self.targets)
        self.label = " / ".join(self.targets[0]["rel"].split("/")[-3:]) if n == 1 else f"{n} carpetas"

    @property
    def dir(self) -> Path:
        return WEB_DIR / self.id

    # ---- running
    def start(self):
        threading.Thread(target=self._run, daemon=True).start()
        return self

    def _set(self, obj, **kw):
        with self.lock:
            obj.update(kw)
            self.version += 1

    def _run(self):
        try:
            self.ctx = core.PromptContext(self.cfg)
            self.idx = core.DiskIndex(Path(self.settings["destination"]))
            self.library = Library()
            self.dir.mkdir(parents=True, exist_ok=True)
            with ThreadPoolExecutor(max_workers=self.threads) as vpool:
                self.vpool = vpool
                with ThreadPoolExecutor(max_workers=min(3, len(self.targets))) as ppool:
                    list(ppool.map(self._prepare, self.targets))
        except Exception as e:
            for t in self.targets:
                if t["status"] in ("queued", "working"):
                    self._set(t, status="error", phase="error", error=str(e))
        finally:
            with self.lock:
                self.finished = True
                for t in self.targets:
                    for c in t["cands"]:
                        if c["status"] in ("queued", "checking"):
                            c["status"] = "stopped"
                self.version += 1
            SEEN.save()
            self.save()

    def _prepare(self, t):
        if self.stopped:
            return self._set(t, status="stopped", phase="detenida")
        try:
            self._set(t, status="working", phase="pensando búsquedas")
            queries, note = self._queries(t)
            self._set(t, queries=queries, note=note, phase="buscando")
            pool = self._search(t, queries)
            if not pool:
                raise ValueError("Las búsquedas no devolvieron imágenes nuevas")
            self._set(t, phase="descargando")
            for p in ai._node_images(self.cfg, t["rel"].split("/"), idx=self.idx, limit=600):
                self.library.add_file(p)  # never download again what the folder already holds
            got, todo, running = 0, iter(pool), set()
            with ThreadPoolExecutor(max_workers=DOWNLOADS_AT_ONCE) as dl:
                while True:
                    while len(running) < DOWNLOADS_AT_ONCE and got + len(running) < t["cap"] and not self.stopped:
                        c = next(todo, None)
                        if c is None:
                            break
                        running.add(dl.submit(self._download, t, c))
                    if not running:
                        break
                    done, running = wait(running, return_when=FIRST_COMPLETED)
                    for f in done:
                        cand = f.result()
                        if cand:
                            got += 1
                            self.vpool.submit(self._verify, t, cand)
            if not got:
                raise ValueError("No se pudo descargar ninguna imagen nueva" +
                                 (f" ({t['dups']} ya estaban en la biblioteca)" if t["dups"] else ""))
            self._set(t, status="done", phase="detenida" if self.stopped else "verificando")
        except Exception as e:
            self._set(t, status="error", phase="error", error=str(e))

    def _samples(self, t) -> list:
        for segs in (t["template"], t["template"][:-1]):
            if segs:
                paths = ai._node_images(self.cfg, tuple(segs), idx=self.idx, limit=1500)
                if paths:
                    return ai._spread_sample(paths, 3)
        return []

    def _queries(self, t):
        info = target_info(self.cfg, t["rel"])
        lines = []
        for n, seg, real in zip(info["chain"], info["template"], info["parts"]):
            cr = core.criteria(self.cfg, n)
            line = f"- {seg} = «{real}»" if n["kind"] == "variable" else f"- {seg}"
            line += f": {cr['description'] or '(sin descripción)'}"
            if cr["include"] and n["kind"] != "variable":
                line += f" | Señales: {', '.join(cr['include'])}"
            if cr["exclude"]:
                line += f" | NO si: {', '.join(cr['exclude'])}"
            lines.append(line)
        samples = self._samples(t)
        prompt = ("Ayudas a ampliar una biblioteca de imágenes de referencia buscando imágenes nuevas en internet. "
                  "Escribe en español, salvo los términos de búsqueda, que van en inglés. No uses herramientas.\n\n"
                  f"Carpeta que necesita más imágenes: «{t['rel']}»\n"
                  "Una imagen solo vale si cumple el criterio de TODOS estos niveles (el primero marca el estilo: "
                  "realista o no realista; respétalo):\n" + "\n".join(lines) + "\n\n" +
                  (f"Te adjunto {len(samples)} imagen(es) que ya están en carpetas equivalentes de la biblioteca: "
                   "fíjate en el estilo, el encuadre y el tipo de imagen que busco.\n\n" if samples else "") +
                  "Fuentes disponibles:\n" + "\n".join(f"- {k}: {SOURCE_HELP[k]}" for k in self.sources) + "\n\n"
                  "Propón de 3 a 6 búsquedas distintas que devuelvan imágenes que irían en esa carpeta: varía la ropa, "
                  "la pose y el encuadre, y usa solo las fuentes que encajen con el estilo. Solo contenido apto para "
                  "todo público.\nResponde SOLO con JSON:\n"
                  '{"busquedas": [{"fuente": "<fuente>", "texto": "...", "tipo": ""}], "nota": "<una frase: qué imágenes buscas>"}')
        data = ai.ask_json(self.settings, prompt, samples, timeout=max(240, int(self.settings.get("timeout") or 0)))
        out, keys = [], set()
        for q in data.get("busquedas") or data.get("consultas") or []:
            if not isinstance(q, dict):
                continue
            src = core.normalize(q.get("fuente") or "")
            if src not in self.sources:
                continue
            text = clean_query(q.get("texto"), booru=src != "openverse")
            kind = str(q.get("tipo") or "").strip().lower()
            if text and (src, text.lower()) not in keys:
                keys.add((src, text.lower()))
                out.append({"src": src, "text": text, "kind": kind if kind in ("photograph", "illustration") else "",
                            "found": None, "new": None, "error": ""})
        if not out:
            raise ValueError("La IA no propuso búsquedas válidas para las fuentes elegidas")
        return out[:6], str(data.get("nota") or "").strip()[:300]

    def _search(self, t, queries) -> list:
        def one(q):
            if self.stopped:
                return []
            try:
                with SOURCE_LOCKS[q["src"]]:
                    res = SEARCH[q["src"]](q["text"], q["kind"])
            except Exception as e:
                res = []
                q["error"] = str(e)[:160]
            fresh = [c for c in res if not SEEN.has(c["key"]) and not SEEN.has(c["url"])]
            random.shuffle(fresh)
            self._set(q, found=len(res), new=len(fresh))
            return fresh

        with ThreadPoolExecutor(max_workers=len(queries)) as pool:
            lists = list(pool.map(one, queries))
        out, keys = [], set()
        while any(lists) and len(out) < t["cap"] * 3:
            for lst in lists:
                while lst:
                    c = lst.pop(0)
                    if c["key"] not in keys:
                        keys.add(c["key"])
                        out.append(c)
                        break
        return out

    def _download(self, t, c):
        SEEN.add(c["key"], c["url"])
        data = None
        for url in (c["url"], c.get("alt")):
            if not url:
                continue
            try:
                data, ext, w, h = download(url)
                break
            except Exception:
                data = None
        if data is None:
            self._set(t, failed=t["failed"] + 1)
            return None
        sha = hashlib.sha1(data).hexdigest()
        stem = re.sub(r"[^A-Za-z0-9_-]+", "", str(c.get("id") or sha[:12]))[:40] or sha[:12]
        path = core.free_path(self.dir, f"{c['src']}_{stem}{ext}")
        path.write_bytes(data)
        try:
            dh = dups._dhash(path)[0]
        except Exception:
            dh = None
        if self.library.known(sha, dh):
            path.unlink(missing_ok=True)
            self._set(t, dups=t["dups"] + 1)
            return None
        with self.lock:
            cand = {"id": f"{t['id']}-{t['next']}", "file": str(path), "name": path.name, "status": "checking",
                    "verdict": "", "src": c["src"], "url": c["url"], "page": c.get("page", ""), "title": c.get("title", ""),
                    "author": c.get("author", ""), "license": c.get("license", ""), "w": w, "h": h, "size": len(data),
                    "proposal": None, "confidence": None, "reason": "", "error": "", "dest": None}
            t["next"] += 1
            t["cands"].append(cand)
            self.version += 1
        return cand

    def _verify(self, t, c):
        if self.stopped:
            return self._set(c, status="stopped")
        try:
            answer, last = None, ""
            for _ in range(2):
                try:
                    last = ai.ask(self.settings, self.ctx.prompt(), [Path(c["file"])])
                except Exception as e:
                    last = f"ERROR: {e}"
                    continue
                answer = core.resolve_answer(self.ctx, last)
                if answer:
                    break
            if not answer:
                raise ValueError(f"respuesta inválida: {last[:160]}")
            verdict = "match" if same_place(answer["path"], t["rel"]) else "other"
            self._set(c, status=verdict, verdict=verdict, proposal=answer["path"], confidence=answer["confidence"],
                      reason=answer["reason"], error="")
            if self.mode == "auto" and verdict == "match" and answer["confidence"] >= self.threshold:
                with self.lock:
                    room = t["added"] + t["reserved"] < t["want"]
                    if room:
                        t["reserved"] += 1
                if room:
                    try:
                        self.apply([{"target": t["id"], "cand": c["id"]}], auto=True)
                    finally:
                        with self.lock:
                            t["reserved"] -= 1
        except Exception as e:
            self._set(c, status="error", error=str(e))

    def stop(self):
        with self.lock:
            self.stopped = True
            self.version += 1

    # ---- decisions
    def _find(self, tid, cid):
        t = next((x for x in self.targets if x["id"] == str(tid)), None)
        c = next((x for x in t["cands"] if x["id"] == str(cid)), None) if t else None
        return t, c

    def apply(self, entries: list, auto=False) -> dict:
        dest_root = Path(self.settings["destination"])
        groups = {}
        with self.lock:
            for e in entries:
                t, c = self._find(e.get("target"), e.get("cand"))
                if not c or c["status"] in ("added", "discarded", "checking", "moving"):
                    continue
                rel = str(e.get("dest") or t["rel"]).replace("\\", "/")
                parts = [core.safe_folder_name(p) for p in rel.split("/") if core.safe_folder_name(p)]
                if parts:
                    c["status"] = "moving"
                    groups.setdefault("/".join(parts), []).append((t, c))
        applied, errors = 0, []
        gid = f"web:{self.id}:{'auto' if auto else core.new_id()}"
        for rel, pairs in groups.items():
            res = core.transfer([c["file"] for _, c in pairs], dest_root.joinpath(*rel.split("/")), "move",
                                self.settings.get("unhide", True), label=f"Internet: {len(pairs)} → {rel}", group=gid)
            for (t, c), r in zip(pairs, res["results"]):
                with self.lock:
                    if r["ok"]:
                        c.update(status="added", dest=r["to"], error="")
                        t["added"] += 1
                        applied += 1
                    else:
                        c.update(status=c["verdict"] or "error", error=str(r.get("error")))
                        errors.append(f"{c['name']}: {r.get('error')}")
                    self.version += 1
                if r["ok"]:
                    self._credit(c, rel, r["to"])
        self.save()
        return {"applied": applied, "errors": errors}

    def _credit(self, c, rel, to):
        """Source, author and licence of every added image, next to the old registro.csv."""
        try:
            reg = Path(self.settings["destination"]) / "fuentes_web.csv"
            new = not reg.exists() or reg.stat().st_size == 0
            with core.fs_lock, open(reg, "a", newline="", encoding="utf-8-sig") as f:
                w = csv.writer(f)
                if new:
                    w.writerow(["fecha", "archivo", "carpeta", "fuente", "url", "pagina", "autor", "licencia", "titulo"])
                w.writerow([time.strftime("%Y-%m-%d %H:%M:%S"), Path(to).name, rel, c["src"], c["url"], c["page"],
                            c["author"], c["license"], c["title"]])
        except OSError:
            pass

    def discard(self, entries: list) -> int:
        n = 0
        with self.lock:
            for e in entries:
                _, c = self._find(e.get("target"), e.get("cand"))
                if c and c["status"] not in ("added", "discarded", "checking", "moving"):
                    try:
                        Path(c["file"]).unlink(missing_ok=True)
                    except OSError:
                        continue
                    c["status"] = "discarded"
                    n += 1
            self.version += 1
        self.save()
        return n

    def reverted(self, restored: list):
        """Puts candidates back to review after an undo moved their files back to the download folder."""
        back = {os.path.normcase(os.path.normpath(r["from"])): r["to"] for r in restored}
        changed = False
        with self.lock:
            for t in self.targets:
                for c in t["cands"]:
                    to = back.get(os.path.normcase(os.path.normpath(c["dest"]))) if c["status"] == "added" and c["dest"] else None
                    if to and to != "(papelera)":
                        c.update(file=to, status=c["verdict"] or "other", dest=None)
                        t["added"] = max(0, t["added"] - 1)
                        changed = True
            if changed:
                self.version += 1
        if changed:
            self.save()

    # ---- views and storage
    @property
    def running(self):
        return not self.finished

    def view(self, full=True) -> dict:
        with self.lock:
            counts = {}
            targets = []
            for t in self.targets:
                pending = any(c["status"] in ("queued", "checking") for c in t["cands"])
                phase = t["phase"]
                if t["status"] == "done" and phase == "verificando" and not pending:
                    phase = "listo"
                for c in t["cands"]:
                    counts[c["status"]] = counts.get(c["status"], 0) + 1
                if full:
                    targets.append({**json.loads(json.dumps(t)), "phase": phase})
            out = {"id": self.id, "label": self.label, "created": self.created, "mode": self.mode,
                   "threshold": self.threshold, "sources": self.sources, "running": self.running,
                   "stopped": self.stopped, "version": self.version, "counts": counts,
                   "folders": len(self.targets), "want": sum(t["want"] for t in self.targets),
                   "added": sum(t["added"] for t in self.targets),
                   "working": sum(1 for t in self.targets if t["status"] in ("queued", "working"))}
            if full:
                out["targets"] = targets
            return out

    def save(self):
        try:
            d = WEB_DIR / "runs"
            d.mkdir(parents=True, exist_ok=True)
            data = self.view()
            data.update(cfg=self.cfg, threads=self.threads, targets=json.loads(json.dumps(self.targets)))
            (d / f"{self.id}.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        except OSError:
            pass

    @classmethod
    def load(cls, path: Path):
        data = json.loads(path.read_text(encoding="utf-8"))
        run = cls.__new__(cls)
        run.id, run.cfg = data["id"], data["cfg"]
        run.settings = run.cfg["settings"]
        run.mode, run.threshold, run.sources = data["mode"], data["threshold"], data["sources"]
        run.threads, run.created, run.label = data.get("threads", 4), data["created"], data.get("label", "")
        run.lock = threading.RLock()
        run.stopped = run.finished = True
        run.version = 0
        run.targets = data["targets"]
        for t in run.targets:
            if t["status"] in ("queued", "working"):
                t.update(status="stopped", phase="detenida")
            for c in t["cands"]:
                if c["status"] in ("queued", "checking", "moving"):
                    c["status"] = c.get("verdict") or "stopped"
                if c["status"] not in ("added", "discarded") and not Path(c["file"]).is_file():
                    c.update(status="discarded", error="la descarga ya no existe")
        return run

    def delete_files(self):
        shutil.rmtree(self.dir, ignore_errors=True)
        try:
            (WEB_DIR / "runs" / f"{self.id}.json").unlink()
        except OSError:
            pass


class RunManager:
    def __init__(self):
        self.runs = {}
        d = WEB_DIR / "runs"
        if d.is_dir():
            for p in sorted(d.glob("*.json"), key=lambda p: p.stat().st_mtime)[-12:]:
                try:
                    r = WebRun.load(p)
                    self.runs[r.id] = r
                except Exception:
                    pass

    def create(self, cfg, targets, mode, threshold, threads, sources) -> WebRun:
        if any(r.running for r in self.runs.values()):
            raise ValueError("Ya hay una búsqueda en internet en curso")
        run = WebRun(cfg, targets, mode, threshold, threads, sources)
        self.runs[run.id] = run
        return run.start()

    def list(self):
        return sorted((r.view(full=False) for r in self.runs.values()), key=lambda v: -v["created"])

    def get(self, rid) -> WebRun:
        r = self.runs.get(rid)
        if not r:
            raise KeyError("Búsqueda no encontrada")
        return r

    def delete(self, rid):
        r = self.get(rid)
        if r.running:
            raise ValueError("Detén la búsqueda antes de quitarla")
        self.runs.pop(rid, None)
        r.delete_files()

    def reverted(self, restored):
        for r in list(self.runs.values()):
            r.reverted(restored)
