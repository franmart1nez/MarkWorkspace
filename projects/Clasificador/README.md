# Clasificador

A local image organiser for the reference library in `D:\AI\Game_References`.
It replaces the old single script (kept in `legacy/`) with a browser interface
served by a small Python server on this computer. The interface is in Spanish
at the owner's request.

Start it with **`Abrir Clasificador.cmd`**. The browser opens
`http://127.0.0.1:8765/`; close the console window to stop it. The AI is the same
OpenCode model the old script used (`opencode-go/deepseek-v4.1-flash`, effort
`high`), configurable in *Ajustes*.

## Tabs

- **Árbol** — the folder tree drawn as a family tree (vertical or horizontal).
  Create, rename, drag and reorder folders; write a description beside each one.
  The descriptions, *señales* (identifiers that point to a folder) and *no va aquí
  si…* (exclusions) are what the AI reads to decide where an image goes. Every
  level of a branch counts, so a child only needs to say how it differs from its
  siblings.
- **Imágenes** — a fast viewer for any folder: thumbnails, filter, sort, multi
  selection, drag to a folder to move (Ctrl = copy), full-screen viewer with zoom,
  recycle bin, and number keys 1–9 bound to pinned folders for quick manual sorting.
- **Clasificar** — runs the AI over the source folder. *Revisar antes* proposes a
  folder for every image and waits for approval; *Mover* / *Copiar* apply proposals
  above a confidence threshold and leave the rest for review. Each proposal shows the
  AI's confidence and reason, and its destination can be edited before applying.
- **Ajustes** — folders, model, effort, timeout, general instructions and file history.

## Tree concepts

| Concept | Meaning |
| --- | --- |
| Fixed folder | Normal folder with a fixed name. |
| Variable `{name}` | The AI writes the real folder name (e.g. `{especie}` → `orco`, `elfo`). It must be the only child of its parent; its children repeat under every value. |
| Open folder | A final folder where the AI may create one extra subfolder (e.g. `otros/mapa`). |
| Group | A shared description and identifiers used by several folders (e.g. all `normal` folders). Editing the group updates them all; each folder can add its own detail. |

Renaming or moving a folder in the tree also renames or moves the matching folders on
disk (including every value of a variable). This can be switched off in *Ajustes*.
Deleting a folder from the tree never deletes files.

## AI assistance

- *Generar* — description, identifiers and exclusions for a folder, using sample
  images already in it.
- *Sugerir* next to identifiers — more identifiers or exclusions, completing what is typed.
- *Sugerir subcarpetas* — proposes a split of a folder; choose which to add.
- *Revisar criterios* — reviews the whole tree for overlaps, vague descriptions and gaps.
- *Asistente* (Ctrl+K) — free requests such as “crea una rama de vehículos”; it
  proposes tree changes that are applied only after confirmation and can be undone.
- *¿Dónde va?* in the viewer — asks where a single image would go without moving it.
- *Ver prompt* — shows the exact prompt sent with each image.

## Safety

- Tree edits autosave to `clasificador.json` with a `.bak` copy; Ctrl+Z / Ctrl+Y
  undo and redo tree changes.
- Every file move or copy is logged in `data/historial.jsonl`; *Deshacer último
  lote* reverts the last approval or the last automatic run as one step. Copies are
  undone by sending the copy to the recycle bin.
- Applied images are also appended to `registro.csv` in the destination, as before.
- The server listens on `127.0.0.1` only and rejects write requests without its
  own header or with a foreign `Host`.

## Files

| Path | Purpose |
| --- | --- |
| `Abrir Clasificador.cmd` | Launcher (installs Pillow for thumbnails if missing). |
| `app/server.py` | Local HTTP server and API. |
| `app/core.py` | Tree model, disk scanning, prompt building and file operations. |
| `app/ai.py` | OpenCode calls: classification runs and authoring help. |
| `app/web/` | Interface (no build step). |
| `clasificador.json` | The tree, groups and settings (created on first start from the old script's tree). |
| `data/` | Thumbnail cache, run results and file history (ignored by Git). |
| `legacy/` | The previous script and launcher. |

Options: `python app/server.py --port 8765 --no-browser`. The environment variables
`CLASIFICADOR_CONFIG` and `CLASIFICADOR_DATA` point the server to another
configuration and data folder, which is how it was tested without touching the
real library.
