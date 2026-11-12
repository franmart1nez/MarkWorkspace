# Setup verification — 12 November 2026

The project is registered and pinned as `total-insanitation`, with four root tabs and three subtabs. All four editable JSON documents pass the shared Workspace card validator; all registered files and image paths resolve.

## Native checks

- **Unreal 5.8.4:** loaded the intended project and `Inteior_Lobby`; the read-only Python audit returned 159 persistent-level actors. Connected to Epic's native HTTP MCP, discovered the environment and Slate schemas, queried the current map, opened the allowed `Basement` map, found its shop actor and captured its viewport. This is editor evidence, not a performance benchmark.
- **Blender 5.2.4 LTS:** read-only audits opened both named source files. The installed Lab addon and installed Lab client answered a native path/clean-state query and returned a window capture from `Interior_Building.blend`.
- **Designer 15.0.1:** `sbscooker` and `sbsrender` exited successfully on `Brutalist_Concrete_01.sbs`, producing a scratch `.sbsar` and base color, normal and ORM maps at 256 × 256. In-app Python graph control remains unverified.

## Workspace checks

The seven steps were opened in the browser preview at **1440, 768 and 390 px**, with **dark and light** themes: 42 combinations, with no browser errors. Checks covered image loading, modal enlargement, actual image downloads, reachable Close controls and document/app overflow. The menu was collapsed for the 390 px preview. A final mobile presentation adjustment was rechecked in all six overview width/theme combinations.

Desktop and narrow captures were inspected visually. The overview places the native corridor image before its explanation in a single-column layout. The material gallery preserves the supplied image colors and proportions. Local screenshots and detailed check records remain under ignored `.mrmak/total-insanitation/ui-check/`.

## Change boundary

The user's pre-setup Unreal descriptor was compared structurally with the result: only the five intended editor plugin entries were added. Prior editor settings remain intact with an appended MCP section. Unreal's Content diff still contains only the user's pre-existing `Lights.umap` deletion; setup did not save any game asset or level. No source `.blend` or `.sbs` was overwritten.

No active application or agent session was restarted. Unreal and Blender were opened for verification. Tool sources, venv, local backups, source brief, raw audits and scratch exports are excluded from Git. No commit or publication was performed.
