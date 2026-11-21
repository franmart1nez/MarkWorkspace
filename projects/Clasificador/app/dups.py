"""Repeated-image detection: byte-identical files (SHA-1) and visual copies (difference hash)."""
from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import core

try:
    from PIL import Image, ImageOps
    Image.MAX_IMAGE_PIXELS = 300_000_000
except Exception:  # without Pillow only byte-identical copies are found
    Image = None

CACHE_PATH = core.DATA_DIR / "hashes.json"
CACHE_LIMIT = 150_000
LEVELS = {"exact": 0, "normal": 4, "wide": 9}

_cache = None
_cache_lock = threading.Lock()


def _load_cache() -> dict:
    global _cache
    with _cache_lock:
        if _cache is None:
            try:
                _cache = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                _cache = {}
        return _cache


def _save_cache(seen: set):
    with _cache_lock:
        if _cache is None:
            return
        data = _cache if len(_cache) <= CACHE_LIMIT else {k: v for k, v in _cache.items() if k in seen}
        try:
            core.DATA_DIR.mkdir(parents=True, exist_ok=True)
            tmp = CACHE_PATH.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
            os.replace(tmp, CACHE_PATH)
        except OSError:
            pass


def _dhash(path: Path) -> tuple:
    """64-bit difference hash and the oriented size, or (None, w, h) when the image cannot be decoded."""
    if Image is None:
        return None, 0, 0
    with Image.open(path) as im:
        im.seek(0)
        im.draft("RGB", (256, 256))
        im = ImageOps.exif_transpose(im)
        w, h = im.size
        if im.mode in ("RGBA", "LA", "P", "PA"):
            im = im.convert("RGBA")
            bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
            bg.alpha_composite(im)
            im = bg
        small = im.convert("L").resize((9, 8), Image.LANCZOS)
        px = list(small.getdata())
    bits = 0
    for row in range(8):
        for col in range(8):
            bits = (bits << 1) | (px[row * 9 + col] > px[row * 9 + col + 1])
    return bits, w, h


def fingerprint(path: Path) -> tuple:
    st = path.stat()
    key = f"{os.path.normcase(str(path))}|{st.st_mtime_ns}|{st.st_size}"
    cache = _load_cache()
    hit = cache.get(key)
    if hit:
        return key, hit
    sha = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            sha.update(chunk)
    info = {"sha": sha.hexdigest(), "dh": None, "w": 0, "h": 0}
    try:
        bits, info["w"], info["h"] = _dhash(path)
        info["dh"] = None if bits is None else format(bits, "016x")
    except Exception:
        pass
    with _cache_lock:
        cache[key] = info
    return key, info


def _chunks(dist: int) -> list:
    """Splits 64 bits into dist+1 parts: two hashes within dist bits share at least one part exactly."""
    k = dist + 1
    sizes = [64 // k + (1 if i < 64 % k else 0) for i in range(k)]
    out, shift = [], 64
    for s in sizes:
        shift -= s
        out.append((shift, (1 << s) - 1))
    return out


def find_groups(items: list, dist: int) -> list:
    """Union-find over identical SHA-1 and, when dist > 0, difference hashes within dist bits."""
    n = len(items)
    parent = list(range(n))
    closeness = {}

    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def join(a, b, d):
        ra, rb = root(a), root(b)
        if ra != rb:
            parent[rb] = ra
        r = root(a)
        closeness[r] = max(closeness.get(ra, 0), closeness.get(rb, 0), d)

    by_sha = {}
    for i, it in enumerate(items):
        by_sha.setdefault(it["sha"], []).append(i)
    for idxs in by_sha.values():
        for j in idxs[1:]:
            join(idxs[0], j, 0)

    if dist > 0:
        hashes = []
        for it in items:
            h = int(it["dh"], 16) if it.get("dh") else None
            # Nearly featureless images (flat colours) all share hash 0: only exact copies count there.
            hashes.append(h if h is not None and 3 <= bin(h).count("1") <= 61 else None)
        buckets = {}
        for i, h in enumerate(hashes):
            if h is None:
                continue
            for c, (shift, mask) in enumerate(_chunks(dist)):
                buckets.setdefault((c, (h >> shift) & mask), []).append(i)
        for idxs in buckets.values():
            idxs = idxs[:3000]
            for a in range(len(idxs)):
                i = idxs[a]
                for b in range(a + 1, len(idxs)):
                    j = idxs[b]
                    if root(i) == root(j):
                        continue
                    d = bin(hashes[i] ^ hashes[j]).count("1")
                    if d > dist:
                        continue
                    wi, hi, wj, hj = items[i]["w"], items[i]["h"], items[j]["w"], items[j]["h"]
                    if wi and hi and wj and hj and abs(wi / hi - wj / hj) > 0.12 * max(wi / hi, wj / hj):
                        continue  # different framing: a crop, not a copy
                    join(i, j, d)

    groups = {}
    for i in range(n):
        groups.setdefault(root(i), []).append(i)
    out = []
    for r, idxs in groups.items():
        if len(idxs) < 2:
            continue
        members = [items[i] for i in idxs]
        identical = len({m["sha"] for m in members}) == 1
        members.sort(key=lambda m: (m["where"] != "clasificadas", -(m["w"] * m["h"]), -m["size"], len(m["path"])))
        for k, m in enumerate(members):
            m["keep"] = k == 0
        out.append({"identical": identical, "distance": 0 if identical else closeness.get(r, 0), "items": members})
    out.sort(key=lambda g: (not g["identical"], g["distance"], -len(g["items"])))
    return out


class Scan:
    """One background search at a time; the interface polls its state."""

    def __init__(self):
        self.lock = threading.Lock()
        self.state = {"id": None, "running": False, "phase": "", "done": 0, "total": 0, "groups": None,
                      "error": "", "options": {}, "finished": None, "files": 0}

    def view(self) -> dict:
        with self.lock:
            return json.loads(json.dumps(self.state))

    def start(self, roots: list, level: str) -> dict:
        with self.lock:
            if self.state["running"]:
                raise ValueError("Ya hay una búsqueda de repetidas en curso")
            self.state.update(id=core.new_id(), running=True, phase="Buscando imágenes…", done=0, total=0,
                              groups=None, error="", options={"roots": roots, "level": level},
                              finished=None, files=0)
        threading.Thread(target=self._run, args=(roots, LEVELS.get(level, 4)), daemon=True).start()
        return self.view()

    def _set(self, **kw):
        with self.lock:
            self.state.update(kw)

    def _run(self, roots: list, dist: int):
        try:
            files, seen_paths = [], set()
            for r in roots:
                base, where = Path(r["path"]), r["where"]
                if not base.is_dir():
                    continue
                skip = {os.path.normcase(os.path.normpath(s)) for s in r.get("skip") or []}
                walker = os.walk(base) if r.get("recursive", True) else [(str(base), [], os.listdir(base))]
                for folder, dirs, names in walker:
                    dirs[:] = [d for d in dirs if not d.startswith(".") and
                               os.path.normcase(os.path.normpath(os.path.join(folder, d))) not in skip]
                    for fn in names:
                        if os.path.splitext(fn)[1].lower() not in core.IMAGE_EXT:
                            continue
                        p = os.path.join(folder, fn)
                        k = os.path.normcase(p)
                        if k in seen_paths or not os.path.isfile(p):
                            continue
                        seen_paths.add(k)
                        files.append((Path(p), where, str(base)))
                self._set(phase=f"Buscando imágenes… {len(files)}")
            self._set(phase="Comparando imágenes…", total=len(files), files=len(files))
            items, seen_keys, done = [], set(), [0]

            def work(entry):
                p, where, base = entry
                try:
                    key, info = fingerprint(p)
                    st = p.stat()
                    rel = core.rel_parts(base, p.parent) or ()
                    item = {"path": str(p), "name": p.name, "where": where, "folder": "/".join(rel),
                            "size": st.st_size, "mtime": st.st_mtime, **info}
                except Exception:
                    key, item = None, None
                with self.lock:
                    done[0] += 1
                    self.state["done"] = done[0]
                return key, item

            with ThreadPoolExecutor(max_workers=max(2, min(8, os.cpu_count() or 4))) as pool:
                for key, item in pool.map(work, files):
                    if item:
                        items.append(item)
                        seen_keys.add(key)
            _save_cache(seen_keys)
            self._set(phase="Agrupando…")
            groups = find_groups(items, dist)
            self._set(running=False, phase="Terminado", groups=groups, finished=time.time())
        except Exception as e:
            self._set(running=False, phase="Error", error=str(e), finished=time.time())

    def forget(self, paths: list):
        """Drops files that were sent to the recycle bin from the last results."""
        gone = {os.path.normcase(os.path.normpath(p)) for p in paths}
        with self.lock:
            groups = self.state.get("groups")
            if not groups:
                return
            kept = []
            for g in groups:
                g["items"] = [m for m in g["items"] if os.path.normcase(os.path.normpath(m["path"])) not in gone]
                if len(g["items"]) > 1:
                    kept.append(g)
            self.state["groups"] = kept
