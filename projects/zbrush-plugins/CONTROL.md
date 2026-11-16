# Native ZBrush control

## Completed 3.2.3 update — 2026-11-16

Added and installed Exportar ID. ZBrush was closed, then launched independently
for a private DemoHead fixture. The public new button exported two manually
colored views with exact flat RGB and identical before/after display records.
No owner project was loaded. Temporary output-root memory was cleared, and
the app was left open on the private fixture. See
`Plugin de zbrush/Development/VERIFICATION_3.2.3.md` and `.cache/zbrush-323/`.

## Completed 3.2.2 update — 2026-11-16

Render/ID were compiled, loaded and installed without restarting the open ZBrush.
Focused checks preserved mixed Colorize flags on 11 SubTools and replaced a
scratch PNG. No ID mesh generation was run on the open DemoSoldier model.
Original Colorize flags, active SubTool and transform were restored. Runtime
evidence is in `.cache/zbrush-322/`; see the package's
`Development/VERIFICATION_3.2.2.md`. Load-time QA must not call ID routines before
top-level array initialization: use a test button after source loading.

## Completed 3.2.1 correction — 2026-11-16

The actual plugin correction is compiled and installed. Native checks include
arbitrary-name ZTL reopening, the supplied original ZTL with a migrated v9 bank,
Render reader recall, the installed ID action and backup reopening, and public
v9 export/import. See [3.2.1 verification](Plugin%20de%20zbrush/Development/VERIFICATION_3.2.1.md).
The original owner ZPR/ZBR and bank were restored: 2122 × 1280, Edit off,
screen saver 60, RGB/Z intensity 25, Dots and Alpha Off. Desktop control was
released and its client closed; ZBrush remained running and responding afterward.

**Launch isolation:** ZBrush was closed at the start of the continuation.
Windows-MCP client shutdown terminated ZBrush processes launched through its
App tool (both direct executable and Start Menu routes). Do not use that route
for an application that must remain open after client cleanup. Launch ZBrush
independently before connecting, or use the owner's already-running instance.
A normal independent `Start-Process` launch was verified to survive clean MCP
shutdown. Do not restart an active app to apply changes. The original files and
private QA backups survived this incident; restoration was repeated successfully.

The current runtime client is `.cache/zbrush-321/native/mcp_client.py`. When
transporting it through pipes, use Python `-X utf8 -u` to avoid Windows output
encoding errors. It only forwards the server's declared tools. No client is
left running. The migrated user bank is
`D:/Descargas/a/Recovered/CameraBank25_v3_2_1.zcv`; original inputs are unchanged.

## Current workflow: native diagnosis authorized again

The owner subsequently reauthorized desktop control to run the prepared
diagnostic or directly correct the import failure. Native automation may resume
for this case under the existing control gate. Preserve the original files and
verify the repaired copy before delivery. This supersedes the temporary
manual-only workflow below; it does not authorize application restarts.

## Earlier temporary workflow: owner-run ZScript diagnostics

On 2026-11-15, during the ZTL/bank import investigation, the owner requested
work without desktop takeover and accepted a file-based ZScript workflow.
Prepare diagnostic scripts for the owner to load manually in ZBrush, then read
their local output files. Do not resume mouse/keyboard automation without a
new owner instruction. Windows-MCP was released and its client closed.

The current case inputs are under `D:/Descargas/a/`; private staging is under
`.cache/zbrush-320/recovery-a/`. Preserve the original ZTL and bank. A diagnostic
script is not a compiled plugin update or a completed native verification.
Use the native output to establish the exact missing/changed identifier before
attempting recovery; matching names extracted from ZTL bytes alone do not prove
which names ZBrush exposes after loading it.

### Completed recovery

Native diagnosis confirmed that loading `a.ztl` exposed the first SubTool as
`a`; the original embedded name was `CB620092277855G0003_shirt`. All other
native names matched. A byte-identical copy with that marked basename passed
all five native camera recalls, dimensions and visibility checks. The public
import action passed, and an additional `a-recovered.zpr` saved/reopened with
all ten identifiers preserved. Public camera buttons 01/02 worked afterward.
The installed 3.2.0 plugin was not modified.

Deliverables are in `D:/Descargas/a/Recovered/` and the existing Workspace card's
`ztl-import-recovery.zip`. See
[the recovery record](../../workspace/2026-11-13_zbrush-plugins/ztl-import-recovery.md).
Native evidence and the original-session backups remain in the ignored case
folder. ZBrush was left on the recovered project and camera 01; the 60-second
screen-saver timer was restored and Windows-MCP released/closed. No restart.

## Previous native automation route

The owner explicitly authorized installation/use of an MCP to control ZBrush and
validate these plugins. The bundled Computer Use native pipe was unavailable.
Plugin-directory search found no suitable ZBrush connector. The reviewed DCC-MCP
ZBrush adapter requires ZBrush 2026.1+, while this machine has ZBrush 2023.2.1.

Windows-MCP 0.8.9 was installed in an isolated local checkout:

- Repository: https://github.com/CursorTouch/Windows-MCP
- Commit: `7e32eaf76f5deee1cf80ad1ed57be57b498d391e`
- Checkout: `.cache/zbrush-windows-mcp/`
- Environment: `.cache/zbrush-windows-mcp/.venv/` using existing Python 3.14.3
- Installation: `uv sync --frozen --no-dev --python C:/Python314/python.exe`
- MCP client: `.cache/zbrush-native/mcp_client.py`

The client uses the official MCP SDK over stdio to forward only the server's
declared tools. There is no custom Windows UI automation code in the client.
The tool allowlist is Screenshot, Snapshot, App, Click, Type, Scroll, Move,
Shortcut, ControlStatus and DisplayInventory. Telemetry is disabled for that
server process. No scheduled startup service, public port, account, AI provider,
global client configuration or ZBrush restart was required.

Launch the local client with the environment Python and keep its stdin open:

```powershell
.cache/zbrush-windows-mcp/.venv/Scripts/python.exe -u .cache/zbrush-native/mcp_client.py
```

Each stdin line is a JSON request such as
`{"tool":"Screenshot","args":{"display":[0]}}`.
The client reports response text and saves image blocks locally. Read the declared
schemas in `.cache/zbrush-native/tools.json` before issuing calls. Use current
screenshots, not guessed coordinates. On this machine display 0 is 3840x2160;
the returned 1920x1080 image has scale 2. A full two-display image has scale 4.
The generic App name "ZBrush" matched a browser search title; use observed window
UI directly or an exact title instead of relying on fuzzy matching.

Keep Windows-MCP's control gate enabled. The user can take control back; resume
only in accordance with their current instructions. End with ControlStatus
`release=true`, then `{"quit":true}` to close the client and its MCP child.
This was done after the native QA session.

Runtime captures, logs, original project backups, bank exports and experimental
ZScripts remain in `.cache/zbrush-native/`, excluded from Git. Selected, reviewed
DemoHead test outputs are copied into the deliverable's Verification folder.
Original-session backups are in its Recovery folder, excluded from the distributable ZIP.
