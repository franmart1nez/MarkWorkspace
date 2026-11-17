"""Local web server for the Clasificador. Run: python app/server.py [--port 8765] [--no-browser]."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import mimetypes
import os
import subprocess
import sys
import threading
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ai  # noqa: E402
import core  # noqa: E402

WEB_DIR = core.APP_DIR / "web"
THUMB_DIR = core.DATA_DIR / "thumbs"
JOBS = ai.JobManager()

try:
    from PIL import Image, ImageOps
    Image.MAX_IMAGE_PIXELS = 300_000_000
except Exception:  # Pillow is optional: originals are served instead
    Image = None

mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("image/avif", ".avif")
mimetypes.add_type("text/javascript", ".js")


def thumbnail(path: Path, size: int) -> tuple:
    if Image is None:
        return path.read_bytes(), mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    st = path.stat()
    key = hashlib.sha1(f"{path}|{st.st_mtime_ns}|{st.st_size}|{size}".encode("utf-8", "replace")).hexdigest()
    cached = THUMB_DIR / key[:2] / f"{key}.webp"
    if cached.exists():
        return cached.read_bytes(), "image/webp"
    with Image.open(path) as im:
        im.seek(0)
        im = ImageOps.exif_transpose(im)
        im.draft("RGB", (size, size))
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA")
        im.thumbnail((size, size))
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=82, method=4)
    data = buf.getvalue()
    try:
        cached.parent.mkdir(parents=True, exist_ok=True)
        cached.write_bytes(data)
    except OSError:
        pass
    return data, "image/webp"


def image_info(path: Path) -> dict:
    st = path.stat()
    info = {"path": str(path), "name": path.name, "size": st.st_size, "mtime": st.st_mtime}
    if Image is not None:
        try:
            with Image.open(path) as im:
                info.update(width=im.width, height=im.height, format=im.format)
        except Exception:
            pass
    return info


def pick_folder(initial: str) -> str:
    code = ("import tkinter as tk, sys\nfrom tkinter import filedialog\nr=tk.Tk();r.withdraw();"
            "r.attributes('-topmost',True)\np=filedialog.askdirectory(initialdir=sys.argv[1] or None,"
            "title='Elige una carpeta')\nprint(p or '')")
    r = subprocess.run([sys.executable, "-c", code, initial or ""], capture_output=True, text=True,
                       encoding="utf-8", timeout=600)
    return os.path.normpath(r.stdout.strip()) if r.stdout.strip() else ""


def source_images(source: str, limit, recursive=False) -> list:
    p = Path(source)
    if not p.is_dir():
        raise FileNotFoundError(f"No existe la carpeta de origen: {source}")
    dest = None
    try:
        dest = Path(core.load_config()["settings"]["destination"]).resolve()
    except Exception:
        pass
    files = []
    if recursive:
        for root, dirs, names in os.walk(p):
            if dest and Path(root).resolve() == dest:
                dirs[:] = []
                continue
            dirs[:] = [d for d in dirs if not (dest and (Path(root) / d).resolve() == dest)]
            files += [Path(root) / n for n in sorted(names) if Path(n).suffix.lower() in core.AI_EXT]
    else:
        files = [f for f in sorted(p.iterdir()) if f.is_file() and f.suffix.lower() in core.AI_EXT]
    busy = {it["file"] for j in JOBS.jobs.values() for it in j.items
            if it["decision"] == "pending" and it["status"] in ("queued", "working", "done")}
    files = [f for f in files if str(f) not in busy]
    return files[:limit] if limit else files


class Handler(BaseHTTPRequestHandler):
    server_version = "Clasificador/1.0"

    def log_message(self, fmt, *args):
        if "--verbose" in sys.argv:
            super().log_message(fmt, *args)

    # ------------------------------------------------------------ helpers
    def _host_ok(self) -> bool:
        host = (self.headers.get("Host") or "").split(":")[0].lower()
        return host in ("127.0.0.1", "localhost")

    def _send(self, code, body: bytes, ctype="application/json; charset=utf-8", cache=False):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "max-age=3600" if cache else "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (ConnectionAbortedError, BrokenPipeError, ConnectionResetError):
            pass

    def _json(self, data, code=200):
        self._send(code, json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def _body(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n).decode("utf-8")) if n else {}

    # ------------------------------------------------------------ routing
    def do_GET(self):
        if not self._host_ok():
            return self._send(403, b"forbidden", "text/plain")
        url = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        try:
            self._get(url.path, q)
        except FileNotFoundError as e:
            self._json({"error": str(e)}, 404)
        except Exception as e:
            traceback.print_exc()
            self._json({"error": str(e)}, 500)

    def do_POST(self):
        self._write("POST")

    def do_PUT(self):
        self._write("PUT")

    def do_DELETE(self):
        self._write("DELETE")

    def _write(self, method):
        # Custom header blocks cross-site form posts; Host check blocks DNS rebinding.
        if not self._host_ok() or self.headers.get("X-Clasificador") != "1":
            return self._send(403, b"forbidden", "text/plain")
        try:
            body = self._body()
            self._post(method, urlparse(self.path).path, body)
        except (KeyError, ValueError, FileNotFoundError) as e:
            self._json({"error": str(e)}, 400)
        except subprocess.TimeoutExpired:
            self._json({"error": "La IA tardó demasiado en responder"}, 504)
        except Exception as e:
            traceback.print_exc()
            self._json({"error": str(e)}, 500)

    def _get(self, path, q):
        if path in ("/", "/index.html"):
            return self._static("index.html")
        if path.startswith("/static/"):
            return self._static(path[len("/static/"):])
        if path == "/api/state":
            cfg = core.load_config()
            return self._json({"config": cfg, "problems": core.validate(cfg), "pillow": Image is not None})
        if path == "/api/stats":
            return self._json(core.node_stats(core.load_config()))
        if path == "/api/prompt":
            return self._json({"prompt": core.PromptContext(core.load_config()).prompt()})
        if path == "/api/models":
            try:
                return self._json({"models": ai.list_models()})
            except Exception as e:
                return self._json({"models": [], "error": str(e)})
        if path == "/api/fs/list":
            return self._json(core.list_dir(q["path"], q.get("recursive") == "1"))
        if path == "/api/fs/tree":
            return self._json(core.dir_tree(q["path"]))
        if path == "/api/fs/info":
            return self._json(image_info(Path(q["path"])))
        if path == "/api/file":
            p = Path(q["path"])
            if p.suffix.lower() not in core.IMAGE_EXT or not p.is_file():
                raise FileNotFoundError("imagen no encontrada")
            return self._send(200, p.read_bytes(), mimetypes.guess_type(p.name)[0] or "application/octet-stream",
                              cache=True)
        if path == "/api/thumb":
            p = Path(q["path"])
            if p.suffix.lower() not in core.IMAGE_EXT or not p.is_file():
                raise FileNotFoundError("imagen no encontrada")
            try:
                data, ctype = thumbnail(p, max(64, min(1024, int(q.get("s", 320)))))
            except Exception:
                data, ctype = p.read_bytes(), mimetypes.guess_type(p.name)[0] or "application/octet-stream"
            return self._send(200, data, ctype, cache=True)
        if path == "/api/history":
            return self._json({"history": core.read_history()})
        if path == "/api/jobs":
            return self._json({"jobs": JOBS.list()})
        if path.startswith("/api/jobs/"):
            job = JOBS.get(path.split("/")[3])
            if q.get("v") and int(q["v"]) == job.version:
                return self._json({"unchanged": True, "version": job.version})
            return self._json(job.view())
        self._send(404, b"not found", "text/plain")

    def _static(self, rel):
        p = (WEB_DIR / rel).resolve()
        if WEB_DIR.resolve() not in p.parents or not p.is_file():
            return self._send(404, b"not found", "text/plain")
        self._send(200, p.read_bytes(), (mimetypes.guess_type(p.name)[0] or "text/plain") + "; charset=utf-8")

    def _post(self, method, path, b):
        if path == "/api/config" and method == "PUT":
            cfg = core.save_config(b["config"])
            return self._json({"config": cfg, "problems": core.validate(cfg)})
        if path == "/api/validate":
            cfg = core.normalize_config(b["config"])
            return self._json({"problems": core.validate(cfg)})

        # ---------------- files
        if path == "/api/fs/move":
            return self._json(core.transfer(b["files"], Path(b["dest"]), b.get("op", "move"),
                                            core.load_config()["settings"].get("unhide", True),
                                            label=b.get("label") or f"Manual: {len(b['files'])} → {Path(b['dest']).name}"))
        if path == "/api/fs/trash":
            return self._json(core.recycle(b["files"]))
        if path == "/api/fs/mkdir":
            p = Path(b["parent"]) / core.safe_folder_name(b["name"])
            p.mkdir(parents=True, exist_ok=True)
            return self._json({"path": str(p)})
        if path == "/api/fs/rename":
            p = Path(b["path"])
            new = p.with_name(core.safe_folder_name(b["name"]))
            if new.exists() and new.resolve() != p.resolve():
                raise ValueError("Ya existe una carpeta con ese nombre")
            p.rename(new)
            return self._json({"path": str(new)})
        if path == "/api/fs/reveal":
            p = Path(b["path"])
            if p.is_file():
                subprocess.Popen(["explorer", "/select,", str(p)])
            else:
                os.startfile(str(p))  # noqa: S606 - local desktop tool
            return self._json({"ok": True})
        if path == "/api/fs/open":
            os.startfile(str(Path(b["path"])))
            return self._json({"ok": True})
        if path == "/api/fs/pick":
            return self._json({"path": pick_folder(b.get("initial", ""))})
        if path == "/api/fs/relocate":
            cfg = core.load_config()
            return self._json(core.relocate(cfg, b["old"], b["new"]))
        if path == "/api/fs/plan":
            return self._json({"missing": core.plan_tree_on_disk(core.load_config())})
        if path == "/api/fs/create-tree":
            made = []
            for m in core.plan_tree_on_disk(core.load_config()):
                Path(m).mkdir(parents=True, exist_ok=True)
                made.append(m)
            return self._json({"created": made})
        if path == "/api/fs/import":
            return self._json({"additions": core.import_from_disk(core.load_config())})
        if path == "/api/history/undo":
            res = core.undo_last()
            for job in JOBS.jobs.values():
                job.reverted(res.get("restored", []))
            return self._json(res)

        # ---------------- jobs
        if path == "/api/jobs" and method == "POST":
            cfg = core.load_config()
            s = cfg["settings"]
            files = b.get("files") or source_images(b.get("source") or s["source"], b.get("limit", s["limit"]),
                                                    bool(b.get("recursive")))
            if not files:
                raise ValueError("No hay imágenes que clasificar en el origen")
            if not any(True for _ in core.leaves(cfg)):
                raise ValueError("El árbol no tiene carpetas")
            job = JOBS.create(cfg, files, b.get("mode", s["mode"]), b.get("threshold", s["threshold"]),
                              b.get("threads", s["threads"]), b.get("label") or f"{len(files)} imágenes")
            return self._json(job.summary())
        if path.startswith("/api/jobs/"):
            parts = path.split("/")
            job = JOBS.get(parts[3])
            action = parts[4] if len(parts) > 4 else ""
            if method == "DELETE":
                JOBS.delete(job.id)
                return self._json({"ok": True})
            if action == "stop":
                job.stop()
                return self._json(job.summary())
            if action == "apply":
                return self._json(job.apply(b["items"]))
            if action == "reject":
                job.reject([str(i) for i in b["ids"]])
                return self._json(job.summary())
            if action == "retry":
                job.retry([str(i) for i in b["ids"]])
                return self._json(job.summary())

        # ---------------- AI authoring
        if path.startswith("/api/ai/"):
            cfg = core.load_config()
            kind = path.split("/")[3]
            if kind == "describe":
                return self._json(ai.describe_node(cfg, b["node"], b.get("images", True)))
            if kind == "children":
                return self._json({"children": ai.suggest_children(cfg, b["node"], b.get("hint", ""))})
            if kind == "identifiers":
                return self._json({"items": ai.suggest_identifiers(cfg, b["node"], b.get("field", "include"),
                                                                   b.get("partial", ""))})
            if kind == "audit":
                return self._json({"problems": ai.audit_tree(cfg)})
            if kind == "assistant":
                return self._json(ai.assistant(cfg, b["message"], b.get("selected")))
        self._send(404, b"not found", "text/plain")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--no-browser", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()
    core.load_config()
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    except OSError:
        url = f"http://127.0.0.1:{args.port}/"
        print(f"El Clasificador ya está abierto en {url}")
        if not args.no_browser:
            webbrowser.open(url)
        return
    srv.daemon_threads = True
    url = f"http://127.0.0.1:{args.port}/"
    print(f"Clasificador abierto en {url}\nCierra esta ventana para detenerlo.", flush=True)
    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
