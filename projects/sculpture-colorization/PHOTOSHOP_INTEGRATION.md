# Local Photoshop MCP

Revision: **2026-11-08**. This project uses **Photoshop only** for montage.

## Installation and scope

Photoshop 2026 is installed on this Windows machine. The reviewed community
[Photoshop MCP](https://github.com/loonghao/photoshop-python-api-mcp-server)
is installed at pinned commit `058c11ee6954c2049609d0a820fa728567b42308`
(package version 0.1.14) in `.mrmak/photoshop-mcp/venv/`. Its Python dependencies
and the virtual environment are local, ignored and contain no project deliverables.
The server communicates with the desktop application through Windows COM and
ExtendScript. No Photoshop cloud API, API key or remote-debugging port is used.

The project launcher `scripts/photoshop_server.py` exposes three tools:

- `photoshop_connection_status`: read-only existing-instance and document-count check.
- `photoshop_inspect_documents`: read-only paths, IDs, canvas, profile/depth and layers.
- `photoshop_execute_jsx`: the upstream native-script tool, using a project adapter.

The adapter attaches only to an already-running application. It replaces the
upstream new-document session and executes a script once; it never starts
Photoshop, creates a blank document during discovery, or retries a possibly
partially executed operation. JSX itself can edit/create/save when requested,
so inspect the exact script and target before using it. A script error requires
state inspection before any corrective submission.

Reproduce the installation from the Workspace root:

```powershell
uv venv .mrmak/photoshop-mcp/venv --python python
uv pip install --python .mrmak/photoshop-mcp/venv/Scripts/python.exe -r projects/sculpture-colorization/scripts/photoshop-requirements.txt
```

The local definitions are in `.codex/config.toml` (Codex) and `.mcp.json`
(compatible MCP clients). Only this repository is configured. These files use
the local virtual environment and project launcher. Codex supports project-scoped
MCP definitions for trusted projects in its [official MCP documentation](https://learn.chatgpt.com/docs/extend/mcp).
This does not change the agent model, permissions or existing provider connections.

## Use without restarting an agent

Run with the installed local interpreter from the Workspace root:

```powershell
.mrmak/photoshop-mcp/venv/Scripts/python.exe projects/sculpture-colorization/scripts/photoshop_mcp.py catalog
.mrmak/photoshop-mcp/venv/Scripts/python.exe projects/sculpture-colorization/scripts/photoshop_mcp.py status
.mrmak/photoshop-mcp/venv/Scripts/python.exe projects/sculpture-colorization/scripts/photoshop_mcp.py documents
```

For native editing, inspect `catalog`, write the exact `{"script":"..."}`
argument to an ignored JSON file, then use:

```powershell
.mrmak/photoshop-mcp/venv/Scripts/python.exe projects/sculpture-colorization/scripts/photoshop_mcp.py call photoshop_execute_jsx --arguments-file .mrmak/photoshop-mcp/operation.json
```

The client starts a local MCP subprocess, initializes it and calls the actual
tool; it does not start another model or agent. Full document/edit responses
and diagnostic logs stay under ignored `.mrmak/photoshop-mcp/`. No automatic
retries are made. A newly registered MCP may need a new client session to appear
as native chat tools; this direct client is usable immediately without a restart.

## Assembly readiness and verification

1. Finish and review generated crops for **every supplied target view**.
2. Announce that the entire crop batch is ready. If Photoshop is closed, ask
   the user to open it, preferably with the first intended source composite,
   and wait. If already open, check read-only and continue.
3. Call status and document inspection. Match document path/ID, dimensions,
   depth/profile and view ID with the source manifest before editing. A process
   name or registry entry alone is not proof of native scripting access.
4. Duplicate/open the exact intended source into a versioned work document.
   Assemble the view's reviewed crops as named layers on its original canvas.
   Preserve the source reference and source passes; use editable source-derived
   masks and appropriate overlaps. Do not warp or correct color/lighting.
5. Save layered PSD/PSB and review PNG. Reopen the saved editable file, inspect
   actual layer/mask counts and dimensions, and compare its rendered output
   with the pre-save review. Record measured differences and source hashes.
   Finish this view before the next. Restore any temporary application units
   or dialog preferences with `try/finally`; do not change global color settings.

## Verification state

On 2026-11-08 the user opened Photoshop after all 35 generated crops passed agent review. Native COM/JSX access to Photoshop 27.11.0 was verified. Mother Talzin views 02–15 were assembled sequentially and saved as layered PSDs with Smart Objects, enabled editable masks, hidden original composites and faithful source-pass data. Each actual saved PSD was reopened in Photoshop and inspected; all fourteen rendered PNGs match their pre-save render with **0 changed pixels**. All 168 original source PSDs and the finished master remain hash-identical.

The hidden Depth Smart Object in reopened view 06 was also opened and verified at 3240 × 4050, 16-bit grayscale, then closed without saving. No application was launched or restarted by the bridge. One early source-profile query failed on an untagged source after opening it; document state was inspected before proceeding and all later profile reads are guarded.

See `sculptures/mother-talzin/work/qa/native-assembly-delivery-v001.json` and the per-view `work/assembly/` records for measured fidelity, file hashes, exact paths and layer/mask audits. Agent review is separate from the user's pending final acceptance.
