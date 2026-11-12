# Total (in)Sanitation — art scope

Read this project's README and the registered Workspace card before working.

- Work concerns art, currently environment and the Basement. The owner is the project's sole artist. Do not invent team members or production decisions.
- Art direction from the owner: semi-realistic/stylized, predominantly 1970s corporate interiors with medieval fantasy accents. The public company is polished; janitorial/back-of-house spaces are neglected and dungeon-like.
- Only these level assets are in scope: `/Game/Levels/Inteior_Lobby`, `/Game/Levels/LaCarlota`, `/Game/Levels/Streaming_Levels/Main_Lights`, `/Game/Levels/Streaming_Levels/Basement`. Preserve the exact `Inteior` spelling.
- Other maps, gameplay code, characters and weapons are outside the current scope. Shared materials can affect several maps: inspect references before changing them.
- Current source files: `Assets/Building/Interior_Building.blend` for structures and Floors/shop; `Assets/Enviroment_Assets/Enviroment_Assets.blend` for props; `Utility_Materials` for materials, relative to the asset root in README.
- Preserve all existing user changes in the Unreal repository. Record a local backup before changing project settings. Do not save audited `.blend`, `.sbs`, `.uasset` or `.umap` sources during setup.
- Use the existing Blender Lab extension (`bl_ext.lab_blender_org.mcp`), not the unrelated community addon using the same default port. Discover the live schema before calling a tool. Verify the current filepath/project/map before edits.
- Epic's MCP is experimental. Call tools sequentially. Use the editor toolset for environment work; additional toolsets need a concrete use case. Confirm native appearance in the engine before claiming a visual change is verified.
- Designer's Python API runs in Designer, not ordinary system Python. Prefer existing tileables, trims and atlas sources over introducing runtime dependencies. Do not auto-upgrade or overwrite materials during audit.
- The owner confirmed 256/512 **pixels per meter**: 256 for some modular structures and 512 for simple props, with exceptions already in the library. Target: PC, RTX 2060 + Ryzen 5 5600, 1920 × 1080, medium-high settings, approximately 60 FPS. These are targets, not measured performance. Profile in-game before setting asset/lighting budgets or changing renderer features.
- Stored work is English. Label owner decisions, proposals, observations and unknowns clearly. The old PureRef board is optional context, not an approved style authority.
- Do not restart active editors/agent sessions without permission. Keep runtime receipts and local tool installs under `.mrmak/total-insanitation/`, outside Git.
