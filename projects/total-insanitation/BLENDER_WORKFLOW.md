# Blender authoring and FBX delivery

**Owner instructions, 12 November 2026.** This is the production workflow for future assets and exports. Read it with `AGENTS.md` and `MODULE_CONTRACT.md`.

## Existing editable sources

All paths are relative to `D:/GameJam/Total (in)Sanitation/`.

| Work | Source |
| --- | --- |
| Structures, modular building pieces, floor-specific geometry and shop work; current priority | `Assets/Building/Interior_Building.blend` |
| Individual environment assets and props | `Assets/Enviroment_Assets/Enviroment_Assets.blend` |

Create new assets inside the appropriate existing source. Create a new `.blend` only when the task explicitly requires one; do not make a separate file for each new asset. Preserve collections, unrelated work and editable construction. The separate Pass 01 sign source and module-test copies predate this instruction; retain them as historical editable evidence, not as a template for future authoring.

## Super Duper Batch Exporter

Use the owner's installed [Super Duper Batch Exporter](https://extensions.blender.org/add-ons/superduperbatchexporter/) for Blender → Unreal FBX exports. The local extension manifest was inspected: version **2.9.3**. The owner's screenshot defines the panel configuration:

| Setting | Required value |
| --- | --- |
| Directory | Set for the current asset destination; the screenshot's `//Delivery\Basement\Shop\` is an example relative to the source blend |
| Filename | `$OBJ` |
| Format | FBX (`.fbx`) |
| Mode | Parent Objects |
| Limit to | Visible |
| Preset | `Unreal_Only_FBX` |
| Apply Modifiers | Enabled |
| Object Types | Mesh only |
| Transform on Export | Disabled |
| Create LOD | Disabled |

The [owner's panel screenshot](../../workspace/2026-11-12_total-insanitation/media/export-settings.png) is preserved in the Workspace Tools and Decisions tabs. Before exporting, verify the intended parents, child meshes, visibility and destination so the visible batch contains only the intended delivery assets. Preserve names and pivots.

### Installed preset checked locally

The existing preset was read from `%APPDATA%/Blender Foundation/Blender/5.2/scripts/presets/operator/export_scene.fbx/Unreal_Only_FBX.py`. Important values:

| Option | Value |
| --- | --- |
| Scale | `global_scale=1.0`, `apply_unit_scale=True`, `apply_scale_options='FBX_SCALE_NONE'` |
| Axes | Forward `-Z`, Up `Y` |
| Space transforms | `use_space_transform=True`, `bake_space_transform=False` |
| Geometry | Mesh only; modifiers enabled; smoothing `FACE`; tangent space enabled; automatic triangulation disabled |
| Vertex colors | `colors_type='SRGB'`, `prioritize_active_color=False` |
| Animation | Disabled |
| Textures | `path_mode='AUTO'`, embedded textures disabled |

The installed extension loads the selected preset and overrides the output filepath, selection and modifier toggle for each batch job. Its output directory is the panel Directory; do not reuse the old filepath stored inside the preset. Other preset values remain unchanged.

The earlier copied-module test used direct FBX export with different axes (`-Y / Z`). It remains historical evidence for that particular test. Future production uses the owner's preset above. No export/import round trip through this exact addon/preset was performed during this documentation update. On the next asset delivery, check size, orientation, pivots, materials, UVs and vertex colors in Unreal; do not silently substitute the older test settings. Materials continue to be assigned in modular Blueprints.

## Texel density and tileable alignment

**Production recipe verified, 12 November 2026:** the corridor pass exported 25 real meshes through Super Duper Batch Exporter / Unreal_Only_FBX, reimported all FBXs and imported all 25 into Unreal. All library-layout translations were removed temporarily for export and source transforms restored. Native imports retained the 400 cm span, prop dimensions, unit scale, material slot names and one UV channel; totals match 13,694 triangles. The documented export axes were not substituted. See `CORRIDOR_IMPLEMENTATION.md` and the Workspace **Model review** tab. This supersedes the earlier “exact addon/preset round trip unverified” setup limit for this delivered set.

The normal references remain **256 px/m** for some modular structures and **512 px/m** for simple props. Some existing modular floors and ceilings deliberately depart from those values to match their specific tileable textures. Preserve those UVs and material tiling; do not normalize them merely to meet a nominal density.

The sampled wall measured about 256 px/m; the sampled concrete floor measured about 128 px/m. The floor belongs to this intentional exception policy and is not an outstanding density fix.

## Retired texture warnings

The owner confirmed that old texture references in `Enviroment_Assets` were removed because an atlas replaced them. A fresh read-only audit of both saved sources on 12 November 2026 found **zero missing unpacked file images in either source**. The old Bars, Chains and Old_Elevator_Door warning is closed. Do not regenerate or relink those retired textures.

Raw audit evidence is local under `.mrmak/total-insanitation/owner-setup-20261112/image-audit.json`. The audit did not save either source or change the active graphical Blender session.
