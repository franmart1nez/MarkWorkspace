# Source inventory

**Read-only baseline, 12 November 2026.** Object totals include references, backups, cutters and source variants. They are not counts of finished game assets.

| Source | Observed | Purpose |
| --- | --- | --- |
| `Assets/Building/Interior_Building.blend` | 282 object datablocks; 26 materials; Metric, scale 1 | Modular structures, floor-specific geometry and shop |
| `Assets/Enviroment_Assets/Enviroment_Assets.blend` | 191 object datablocks; 18 materials; Metric, scale 1 | Props; 139 objects belong directly to `Importer assets (ignore)` |
| `Utility_Materials/` | 38 `.sbs` source files; 14 top-level categories | Existing material library; not all categories are materials |

All paths above are relative to `D:/GameJam/Total (in)Sanitation/`. Automated raw `.blend` audits are stored locally under `.mrmak/total-insanitation/`.

## Structure collections

The building source already has `Modular_Blocks`, `Modular_Walls`, `Floor`, `Roof`, `Stairs`, decoration collections and a separate `Floors` hierarchy. `Modular_Walls` contains seven direct objects:

- `Wall_01`, `Wall_02`, `Wall_Corner_01`.
- `Wall_Corner_VertexColor_01`, `Wall_VertexColor_01`, `Wall_VertexColor_02`, `Wall_VertexColor_03`.

`Shop` contains 16 direct objects. `Basement` contains 11 direct objects. These counts describe collection membership, not export readiness or complete level coverage. The lobby has several older/backed-up source collections. Preserve those placeholders until their modular conversion is specifically scheduled.

## Missing image references

Three unpacked file references in `Interior_Building.blend` do not exist at their stored paths:

```text
Assets/Building/Delivery/Janitor/Textures/Bars_basecolor.png
Assets/Building/Delivery/Janitor/Textures/Chains_basecolor.png
Assets/Building/Delivery/Janitor/Textures/Old_Elevator_Door_basecolor.png
```

The `.sbs` sources with matching names exist in the same directory. The `Elevator_Atlas` base color, normal and packed ORM files also exist. Check which material slots are still used by exported assets before deciding whether to regenerate these maps, relink them or leave archival nodes alone. Do not infer that the in-game elevator is broken from this source-file warning.

No missing unpacked image references were found in `Enviroment_Assets.blend` by this audit.

## Ownership and current focus

| Location | Owner's intent | Current priority |
| --- | --- | --- |
| `Assets/Building/Interior_Building.blend` | Structures; modular kit; unique shop under Floors | Now |
| `Assets/Enviroment_Assets/Enviroment_Assets.blend` | Props intended to use tileables; windows still here | Now; window migration remains a proposal |
| `Utility_Materials/TrimSheet/Trimsheet_Structure_01` | Existing structural trim sheet | Reuse and verify UV/channel conventions |
| `Assets/Cleaning_Tools` | Unique janitorial equipment | Context and scale references |
| `Assets/Trash` | Gameplay trash, liquid/soot decals, blackhole | Environment context; no gameplay edits |
| `Assets/Weapons`, `Characters` | Weapons and characters | Deferred |
| `UI` | Existing UI; unimplemented Stop_sign | Deferred |
| `Total (in)Sanitation_Pureref.pur` | Owner's older mixed reference board | Optional; not a style authority |

## Unreal map scope

Project root: `D:/GItHub/BoomeRacist/`.

| Asset path below `/Game/Levels/` | Role |
| --- | --- |
| `Inteior_Lobby` | Main assembly map; spelling retained exactly |
| `LaCarlota` | Asset/material test map |
| `Streaming_Levels/Main_Lights` | Global lighting and post-process |
| `Streaming_Levels/Basement` | Main environment production target |

`Test` and `MainMenu` also exist on disk and are outside this task's scope. The native baseline opened `Inteior_Lobby` and `Basement` for inspection without saving either. The assembly map's read-only audit reported 159 actors in its persistent level; this does not establish streaming coverage. A native search confirmed `Basement_Shop_C_1` in the Basement.

## Before the first asset pass

Confirm grid dimensions, pivots, mesh names, FBX import/reimport settings, collision and lightmap/UV usage on one representative copy. The Blender scene's Metric/1 setting does not by itself prove the export scale. The owner confirmed **256/512 px/m** and a **PC target of RTX 2060 + Ryzen 5 5600, 1080p, medium-high, approximately 60 FPS**. Profile actual gameplay on comparable hardware before assigning budgets; the 60 FPS target allows approximately 16.7 ms per frame. Capture the assembled lighting context in addition to the standalone Basement before judging final color or exposure.
