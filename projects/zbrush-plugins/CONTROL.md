# Native ZBrush control

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
