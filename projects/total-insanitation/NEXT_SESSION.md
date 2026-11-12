# Continue Total (in)Sanitation

Read the project `AGENTS.md`, then the pinned Workspace card. Setup was completed on 12 November 2026; the first environment art pass is still pending.

## Ready to use

- Epic's bundled UE 5.8.4 MCP is configured at `http://127.0.0.1:8000/mcp` when the project editor is open. The environment/editor and Slate tools were discovered and called successfully.
- The existing Blender Lab addon 1.0.3 and the matching Lab client 1.0.2 work with Blender 5.2.4 LTS. Do not install the unrelated community addon over it.
- Project-scoped `.codex/config.toml` and `.mcp.json` contain both connections, preserving Photoshop. No global configuration or permission-mode changes were made.
- If this agent session does not expose the new tools, use `scripts/mcp_client.py` with the isolated venv. Do not restart an active editor or agent just to refresh tools.
- Designer 15.0.1's native cooker and renderer passed a real material export. Interactive `sd` graph control is prepared, not verified.

## First production pass

1. Use `3d-production-routing`, then `game-level-design` for scene planning and `materials-to-game` for material changes as applicable. Use `gameplay-visual-review` for actual engine appearance checks.
2. Verify the live project/file/map before actions. Discover the exact schemas; Unreal toolsets use full identifiers and calls must remain sequential.
3. Establish the Basement in the intended assembly/global-lighting context. The saved native corridor baseline is a standalone Basement view. A closer shop probe was too dark for appearance review and was not published as reference.
4. Check one representative modular wall/floor/corner group: grid size, joins, pivots, UV scale, collision and copied export/reimport. Do not overwrite the source for the trial.
5. Propose a compact 1970s service-area art pass and review it against the owner's direction. The shop and player approach are the focal problem; the exact first pass is still a proposal in the Decisions tab.
6. Apply the chosen pass to allowed assets/maps, retain editable sources, capture matching views and record agent checks versus owner acceptance separately.

## Confirmed technical target

PC: **RTX 2060 + Ryzen 5 5600, 1920 × 1080, medium-high, approximately 60 FPS**. Densities are **px/m**: 256 on some modular structures and 512 on simple objects, with current exceptions. No performance benchmark has been run. Set budgets from representative gameplay profiling; do not assume the captured editor view measures the target.

## Existing issues and constraints

- Three unpacked Blender image paths are missing: Bars, Chains and Old_Elevator_Door base colors. Matching `.sbs` sources exist. Verify active usage before repairing; the elevator atlas may already cover the actual game asset.
- The Unreal repository already had user changes before setup, including its descriptor, `.gitignore` and deletion of `Lights.umap`. Setup added five editor-only plugin entries and an MCP settings section, preserving previous content. Local before-tools copies are under `.mrmak/total-insanitation/`.
- No `.umap`, `.uasset`, `.blend` or `.sbs` source was saved by setup. Only the four named maps are in scope. Shared materials can affect other maps.
- English stored work; keep related revisions in this same card and update its `updated` date.

The Tools tab has exact paths, commands and limitations. Raw audits, native capture receipts, tool source/venv and scratch exports live under ignored `.mrmak/total-insanitation/`; retain them locally and keep them out of Git.
