# Corridor production sources (2026-11-12)

Editable authoring scripts for the Basement corridor pass (N01–N07). They build the
assets inside the two existing source blends; no separate asset `.blend` is created.

| File | Purpose |
| --- | --- |
| `corridor_lib.py` | Geometry builder (boxes, cylinders, swept tubes, tapered bodies, paper sheets), UV mapping (box/cylindrical/atlas), material creation, UV and dimension reports. |
| `t01_atlas.py` | T01 graphics atlas: editable Blender text objects plus numpy-drawn plates, meter dial, caution diamond, paper forms. Renders the text layer and composites the 1024×1024 PNG. |
| `build_building.py` | N01 pipe kit, N02 conduit kit, N04 sign variants. Writes into `Assets/Building/Interior_Building.blend`. |
| `build_props.py` | N03 cabinet, N05 work-order panel and sheet, N06 hose reel, N07 containers. Writes into `Assets/Enviroment_Assets/Enviroment_Assets.blend`. |
| `export_pass.py` | Super Duper Batch Exporter call with `$OBJ`, Parent Objects, Visible, `Unreal_Only_FBX`, Apply Modifiers, Mesh only. Temporarily moves targets to the local origin and restores their exact transforms. |
| `preview_lib.py`, `eevee_preview.py` | Workbench geometry diagnostics and EEVEE material previews used for the delivered images. |
| `write_manifest.py` | Regenerates `projects/total-insanitation/corridor-assets.json` from the build/export reports. |

## Rebuild

Run inside Blender 5.2 with the project extension set enabled:

- Building assets: execute `build_building.py`'s `build_all()` in the live
  `Interior_Building.blend`, then save.
- Props: open `Enviroment_Assets.blend`, run `build_props.build_all()`, save, then run
  `export_pass.export_targets(...)`.
- T01 atlas: `t01_atlas.build_atlas(collection, out_png, text_render_path)`; the text
  source lives in the `T01_Graphics_Source` collection of `Enviroment_Assets.blend`.

Runtime receipts, recovery copies and the baseline fingerprints stay under
`.mrmak/total-insanitation/corridor-production/` and are not part of this folder.
