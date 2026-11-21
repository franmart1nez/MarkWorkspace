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
  Folder tiles count the images inside their subfolders too, and a folder with only
  subfolders offers to show all of them at once. *Borrar carpetas vacías* lists the
  folders below the current one that hold no image at all (folders with other files
  are left unticked) and sends the chosen ones to the recycle bin; the same action is
  in a folder's context menu and in the tree's *Disco* menu. Inside a tree folder,
  *Mejorar descripción* opens the AI description review below. The group selector
  shows only the images of one group (or of no group) in the current folder and all
  its subfolders, with counts per group and a coloured dot on each image; it stays
  active while navigating.
- **Clasificar** — runs the AI over the source folder. *Revisar antes* proposes a
  folder for every image and waits for approval; *Mover* / *Copiar* apply proposals
  above a confidence threshold and leave the rest for review. Each proposal shows the
  AI's confidence and reason. Its destination is shown as clickable folders: clicking
  one lists the alternatives at that level (tree folders, existing variable values,
  folders on disk), keeps the rest of the path when it still fits and asks for any
  missing level. The pencil types a path by hand, the folder button offers recent
  destinations, shortcuts and a full search, and *Enviar seleccionadas a…* moves a
  whole selection to one folder.
- **Buscar imágenes repetidas** (in *Clasificar*) — compares image content locally,
  without the AI: byte-identical copies and the same image saved at another size,
  format or compression (difference hash). It searches the source and/or the
  classified library, proposes keeping the copy already classified or the largest
  one, and sends the rest to the recycle bin. Fingerprints are cached in
  `data/hashes.json`, so later searches are fast.
- **Etiquetas** — the AI looks at each image and writes tags per category (skin,
  hair, clothing, action, framing, objects, features, background by default). Each
  category has a description, suggested values, *la IA puede inventar etiquetas
  nuevas* (off = only the listed values) and *varias etiquetas por imagen*; edit them
  in *Categorías…*. The prompt lists the values already used so the vocabulary stays
  consistent (singular, lower case, no accents; plural forms are merged). Choose a
  folder (with or without subfolders), then tag the untagged images or redo all; one
  run at a time, stoppable, errors can be retried. *Etiquetar con IA* is also in the
  *Imágenes* selection bar and context menu. The side panel filters by tag: a click
  keeps images with the tag, a second click excludes it, a third removes the filter;
  values of one category add up, different categories must all match. Right-click a
  value to rename, merge or remove it everywhere. The right panel edits the tags of
  one image, or of a selection (full chips are on all images, dashed ones on some).
  Tags are stored by file content (SHA-1) in `data/etiquetas.json`, so they follow an
  image that is moved, renamed or copied, even outside the app.
- **Huecos** — counts the images of every final folder of a branch on disk, without
  the AI, and compares each one with the average of its equivalent folders: the same
  folder under the other values of a variable (e.g. `femenino/normal` of every
  species) or, without a variable, its sibling folders. Missing combinations count
  as 0. *Por nivel* shows the total of every option at every level (species, sexes,
  groups) against the level average.
- **Búsqueda web** (in *Huecos*) — for the folders marked in the list, the AI reads
  the criteria of every level of the folder (so *realista* asks for photographs and
  *No realista* for drawings) and a few images from equivalent folders, and writes
  search terms. Candidates come from sources that serve only family-friendly content:
  Safebooru (anime, rating *general*), e926 (furry, rating *safe*) and Openverse
  (CC-licensed photos and illustrations, mature results excluded); words that would ask
  for adult content are removed from the queries. Folders whose group is adult content
  (a group named like *erótico* or *sexual*, or with `"adult": true`) are never
  searched. About 1.5× the requested images are downloaded to `data/web/<id>/`;
  images already in the folder, in the repeated-image cache or seen by an earlier
  search are skipped. The classifier then checks every candidate: it *encaja* only
  when the classifier would put it in exactly that folder. *Revisar antes* waits for
  approval; *Añadir solas* adds the matching ones above a confidence threshold, up to
  the requested number. Added images are moved like any other transfer (undoable with
  *Deshacer último lote*), and their source, author and licence are appended to
  `fuentes_web.csv` in the destination. A candidate the classifier would put
  elsewhere can be added there instead.
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
- *Analizar imágenes y mejorar descripción* — the AI looks at up to 16 images
  already stored in the folder (spread across its subfolders and variable values)
  plus reviewed images you moved into or out of it, then rewrites the description,
  identifiers and exclusions. The proposal is editable and applied only on
  confirmation (Ctrl+Z undoes it).
- *Mejorar en lote* (tree toolbar, inspector, context menu) — the same analysis for a
  whole branch at once: one AI call per tree folder and one per shared group used in
  the branch, several in parallel (default: *A la vez* from the classify settings, up
  to 16). A variable folder `{…}` has a single criterion for all its values, so it is
  analysed with images from every value (every species). Folders that use a group are
  improved through the group, sampling images from every folder of that group. The
  run continues if the dialog is closed; each proposal can be edited, limited to the
  description or left out, and the chosen ones are applied as one undo step. A group
  card also has *Mejorar con IA* for that group alone.
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
- Deleting empty folders re-checks each folder for images just before sending it to
  the recycle bin and never touches the source or destination roots.
- The interface cannot be text-selected by dragging; only fields can.
- The server listens on `127.0.0.1` only and rejects write requests without its
  own header or with a foreign `Host`.

## Files

| Path | Purpose |
| --- | --- |
| `Abrir Clasificador.cmd` | Launcher (installs Pillow for thumbnails if missing). |
| `app/server.py` | Local HTTP server and API. |
| `app/core.py` | Tree model, disk scanning, prompt building and file operations. |
| `app/ai.py` | OpenCode calls: classification runs and authoring help. |
| `app/dups.py` | Repeated-image search (SHA-1 and difference hash). |
| `app/tags.py` | Tag store (follows files by content) and AI tagging runs. |
| `app/gaps.py` | Folder balance and web searches for the emptiest folders. |
| `app/web/` | Interface (no build step). |
| `clasificador.json` | The tree, groups and settings (created on first start from the old script's tree). |
| `data/` | Thumbnail cache, run results, file history, tags (`etiquetas.json`) and web downloads awaiting review (`web/`); ignored by Git. |
| `legacy/` | The previous script and launcher. |

Options: `python app/server.py --port 8765 --no-browser`. The environment variables
`CLASIFICADOR_CONFIG` and `CLASIFICADOR_DATA` point the server to another
configuration and data folder, which is how it was tested without touching the
real library.
