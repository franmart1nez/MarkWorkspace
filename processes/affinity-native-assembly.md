# Assemble reviewed images in Affinity

Use this procedure for an editable montage made **inside Affinity** from a
reviewed base image and selected repair crops. Generation, crop preparation,
native assembly, agent review and user acceptance are separate stages. The
receiving project's brief controls permitted image changes and approval gates.

The procedure was exercised on Windows with Affinity **3.3.3.5004** on
November 7, 2026. Endpoint, Desktop restrictions and SDK details below describe
that verified environment; read the running application's documentation before
using them with a different version. A skill alone does not install Affinity
or enable its native AI connection.

## 1. Finish preparation, then check application readiness

Complete the required crop generation and review first. Keep the selected
base/crops, original canvas dimensions/profile, source hashes, placement
rectangles, overlap and source-derived masks together. Zero crops is valid
when the source comparison finds no repair needs. Affinity can be closed
during this preparation.

**Affinity must be running before native assembly can start.** At the end of
crop review:

- If the user has already opened Affinity, check the connection and documents
  read-only. Continue when the intended working target is verified; do not ask
  them to open it again.
- If it is not running, tell the user the crops are ready and ask them to open
  Affinity, preferably with the intended source composite. Wait until it is
  reachable. Prepare staging/manifests while waiting if useful.
- If it is running but disconnected, diagnose the native server separately
  from desktop control. Ask for a specific app-side action only when current
  evidence establishes that it is needed. Preserve open apps and sessions.

Suggested handoff, localized to the conversation:

> All required crops are ready and reviewed. Please open Affinity, preferably
> with [the intended composite]. Once the native connection and document are
> verified, I can begin the montage.

Having the PSD already open is convenient, **not a technical requirement for
the native server**. The agent can open a verified staged source through the
SDK after connecting, if the live tools and file permission support it. Do not
equate an open window, reachable server, loaded chat tools and correct document.

## 2. Connect and discover the live interface

Prefer exposed Affinity native tools when sufficient. Otherwise run the shared
standard-library client from the repository root:

```powershell
python .agents/skills/affinity-native-assembly/scripts/affinity_mcp.py status
python .agents/skills/affinity-native-assembly/scripts/affinity_mcp.py catalog
python .agents/skills/affinity-native-assembly/scripts/affinity_mcp.py docs preamble
python .agents/skills/affinity-native-assembly/scripts/affinity_mcp.py docs nodes.js
```

`status` is a fixed read-only application/version/document-count query. It does
not select or edit a document and does **not** establish target identity. Use a
separate documented read-only script to inspect open documents, session IDs,
source path/name, dimensions, profile and layer structure before mutation.
Match the intended source/work file; identify the working document explicitly
inside every editing script. Do not blindly use `documents.current` when
several documents are open. Session IDs are runtime values, not reusable IDs.

Verified transport: **`http://[::1]:6767/sse`**. IPv4 `127.0.0.1:6767` refused
connections on the tested machine. Do not replace IPv6 with IPv4 by habit.
If the native server is unavailable, verify whether the installed version
provides/enables its native AI connection. Do not install plugins, change global
permissions or restart an application to guess at a fix.

Read the live catalog for exact tool fields and the **live SDK preamble in each
connection**, then the topics needed for the operation. Cached docs do not
satisfy a per-connection SDK gate. The client does this for its operational
commands; `execute_script` also reads application/document topics. Add relevant
topics for bitmap, node, transform, import/export and filesystem operations.
Use names actually listed by the running SDK.

Save the exact argument object in a private JSON file; for example an
`execute_script` object has a `script` field. Then invoke the live tool:

```powershell
python .agents/skills/affinity-native-assembly/scripts/affinity_mcp.py call execute_script --arguments-file .mrmak/affinity/operation.json --sdk-topic nodes.js --state-dir .mrmak/affinity
```

This is a command shape, not an assembly script. Write scripts for the current
source/placements after reading the relevant SDK. The client does not start
another AI model or require pip/npm packages. It submits each operation once
and writes private receipts/SDK responses under ignored `.mrmak/affinity/` by
default. Use a project-specific `--state-dir` when useful.

## 3. Stage files within the live native filesystem permission

The tested SDK allowed native file access **only on Desktop**, even when the
desktop-control setting allowed any application. That application setting
does not grant the native SDK arbitrary disk access.

Resolve the actual Windows Desktop using
`[Environment]::GetFolderPath('Desktop')`; it may be localized or redirected to
OneDrive. Create a task-specific staging folder there with source, base,
repairs, masks, placement metadata and output subfolders. Copy project files;
keep canonical originals intact. Verify existence and SHA-256 after copying,
including when resuming a task: yesterday's staged folder may no longer exist.

Use these verified staged paths for native load/save/export. After checking
the saved files, copy deliveries back into canonical project output folders
and verify matching hashes. Keep the staging folder while native documents
or linked assets may use it. Do not delete or move open files.

## 4. Assemble in a separate versioned working document

Preserve the source canvas, profile/bit depth and original PSD. Inspect missing
profile metadata rather than silently asserting a source profile. Keep the
original reference hidden/locked in the working document as appropriate.
Never overwrite a user's unrelated or unsaved document.

Place the generated full image, then selected repairs in named containers.
Record source/paste rectangles, actual spread bounds and uniform scale plus
translation. Preserve aspect ratio; document padding/offset when dimensions
differ slightly. Do not warp failed geometry to fit. Keep an editable mask for
each repair and a separate full-source contour mask when required. Source
Mask/ID passes control geometry; generated crops supply the selected image.

The native SDK lessons that prevented concrete failures in the verified run:

| Operation | Verified behavior and check |
| --- | --- |
| Mask bitmap import | `Bitmap.loadFromFile(path, RasterFormat.M8)` used alpha. An opaque grayscale PNG loaded as all 255. Prepare RGBA with the intended selection in **alpha**, import it, and inspect the rendered mask. |
| Transform assignment | Replacing `Transform.data` with a new array did not change the native transform. Documented `scale()` and `translate()` methods worked. Inspect actual spread bounds. |
| Pixel buffer writes | Mutating the returned `PixelBuffer.buffer` ArrayBuffer did not update the intended native contents in that attempt. Source-derived alpha PNG import worked. |
| Stack order | Main-child traversal was bottom to top. Insertion using `Behind` failed; insertion inside the container followed by documented `NodeMoveType.Before` / `After` worked. Verify siblings and native render. |
| Group masks | Repair image plus source-derived enclosure mask kept the edit reversible. Identity group transforms made source-canvas mask positions explicit. |
| Stream parsing | Scalar progress/keepalive messages are not JSON-RPC objects. The client checks packet type before looking for response IDs. |

These are observed behaviors, not a replacement for current live SDK docs.
Prepare source-derived masks/comparison aids outside Affinity when useful, but
perform actual montage placement, stack/mask application and rendering inside
Affinity. A collage rendered elsewhere does not prove native assembly.

Apply each project's own application choice and assembly limits. Projects that
choose another native editor use that project's integration procedure.

## 5. Render, save, reopen and deliver

Inspect the native layer tree and native render at full view and 100% near
faces/hands, fine relief, silhouette and repair joins as relevant. Compare to
the aligned original for shape/placement. Numeric differences are aids; color
changes mean RGB differences alone do not measure geometric fidelity.

Save a **new native version**, plus requested review PNG and supported layered
exchange. The tested Affinity 3 saved `.af`; do not rename it `.afphoto` or
assume another version uses the same extension. Keep the saved native path,
version, exports and selected assets linked in the project manifest.

Reopen the actual saved native file from disk, render again and compare with
the pre-close export. Reopen the PSD exchange separately when delivering one;
inspect expected groups/masks and render it too. A successful save/export call
or an existing document tab is insufficient evidence. Close only task-owned
saved review copies when needed, preserving the user's open source/unsaved work.
Report measured differences and lost editability rather than promising a
lossless round trip. In the verified example AF was pixel-identical; PSD kept
the expected layers/masks and differed by at most 1/255 RGB. Those are results
of that file, not future guarantees.

Copy verified outputs back from Desktop, verify hashes and register the
deliverables with links, review evidence and the current acceptance state.
Leave the native version available for user review. Do not advance to a later
view or mark approval unless the receiving project's gate is actually met.

## Recover the specific failure

| Symptom | Next action |
| --- | --- |
| Affinity is closed | Ask the user to open it after crop review; wait for native readiness. |
| Computer Use reports `native pipe is unavailable` | This fails before app/file selection. Check native MCP independently; moving files alone cannot fix that bridge. |
| IPv4 connection refused | Try the verified IPv6 endpoint and inspect the actual local server; do not conclude Affinity is unavailable. |
| `NOT_ALLOWED` on a native file/tool operation | Read the actual restriction and current SDK permission. Verify Desktop staging; request only the necessary user-side action if still required. |
| Missing staged source | Restore a copy from canonical project files, check its hash, then resume. |
| Tool timeout/disconnect, or script error after partial work | Treat outcome as unknown/possibly partial. Inspect receipt, new files, current document and layer tree before preparing a continuation for only missing steps. Never blindly repeat the full mutation. |
| Black render or incorrect masking | Check alpha values, visible stack order, group/mask enclosure and spread bounds before changing image content. |

Keep raw receipts, live session handles and app diagnostics in ignored runtime
storage. Reusable findings belong in repository documentation, not global agent
memory or published SDK hints. Preserve evidence of rejected versions.
