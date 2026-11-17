# Blender authoring and FBX delivery

Owner-confirmed production rules, checked against the installed exporter/preset during stage 2 on 2026-11-17 UTC. Follow the [file placement contract](../../workspace/2026-11-12_total-insanitation/FILE_PLACEMENT.md) for current directories and the existing-FBX map. This audit did not create a new export or verify a new asset round trip.

## Editable sources

Paths are relative to `D:/GameJam/Total (in)Sanitation/`.

| Work | Source |
| --- | --- |
| Structures, modular kit and floor-specific/shop geometry | `Assets/Building/Interior_Building.blend` |
| Individual environment assets and props | `Assets/Enviroment_Assets/Enviroment_Assets.blend` |

Use the existing blends and collections. Create a separate blend only when explicitly needed. Preserve owner construction, names, pivots and unrelated objects. Keep reference/importer/backup collections out of the visible export batch.

## Super Duper Batch Exporter

| Setting | Owner configuration |
| --- | --- |
| Directory | Actual destination for the selected family; validate after restructuring |
| Filename | `$OBJ` |
| Format / Mode / Limit to | FBX / Parent Objects / Visible |
| Preset | `Unreal_Only_FBX` |
| Apply Modifiers / Object Types | On / Mesh only |
| Transform on Export / Create LOD | Off / Off |

The installed preset uses scale 1, apply units, `FBX_SCALE_NONE`, forward `-Z`, up `Y`, face smoothing, tangent space, SRGB vertex colors and no animation/embedded textures. Reinspect it before a new delivery. It still stores an old `D:/GameJam/BoomeRacist/...` filepath; the batch add-on overwrites this per job. Set Directory explicitly, check any Project Directory override and the export preview. Neither main blend stores current `scene.batch_export` settings; Props' legacy `export_folder` is also stale.

This is the static-mesh recipe. Chicken and Tongue Mop have armatures and existing Unreal SkeletalMesh assets; do not overwrite those with a Mesh-only export. Existing cleaning-tool FBXs bundle unparented UCX nodes with render meshes; Parent Objects alone will not reproduce those bundles. Preserve their established contents until a specific per-tool export is checked.

The owner's panel screenshot remains at `workspace/2026-11-12_total-insanitation/media/export-settings.png`. Before delivery, verify parents, visibility and destination, then check dimensions/orientation, pivots, material slots, UVs, vertex colors and reimport behavior in Unreal. Assign materials through the project's modular Blueprint workflow where applicable; use the existing Unreal Utility_Materials library.

## UVs and links

Owner references are 256 px/m for some structures and 512 px/m for simple props. Floors/ceilings may intentionally differ to match tileables. Preserve these exceptions.

The stage-2 contract records the moved structural trim replacement, seven consuming building objects, two missing atlas images used by ten props, and confirmed zero-user retired materials/links. Preserve active and owner-reference data. No links were changed or native files saved. After a separately authorized targeted relink/removal, rerun the audit and keep relative links where practical.
