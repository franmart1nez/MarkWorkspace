# Basement / verified representative module contract

**12 November 2026.** Confirmed in Temp and checked against the saved building blend and Unreal meshes. This covers a representative group, not every kit variant.

| Item | Dimensions | Local bounds, cm |
| --- | --- | --- |
| Wall_01 | 400 × 15 × 400 cm | X 0–400; Y -15–0; Z 0–400 |
| Wall_Corner_01 | 385 × 15 × 400 cm | Same edge pivot; 15 cm shorter |
| Floor_01 | 400 × 400 × 15 cm | X/Y 0–400; Z -15–0; walking surface at pivot height |
| Wall_VertexColor_01 | 400 × 15 × 400 cm | Same wall convention; alpha carries paint variation |

The source is Metric at scale 1; these objects have unit scale and zero rotation. A corner at the grid origin, yaw 90°, ends at Y 385. An adjoining wall placed at Y 400 begins at Y 385 because it is 15 cm thick. This closes the corner without overlapping wall faces. Decorations retain the owner's 4 m convention and shorter corner variants.

## Production workflow

Use the existing source blends and Super Duper Batch Exporter with the owner’s `Unreal_Only_FBX` preset. Read [BLENDER_WORKFLOW.md](BLENDER_WORKFLOW.md) for the exact panel settings and locally inspected preset (`-Z / Y` axes). The copied test below predates this instruction; it does not override the production preset. Check the first addon/preset delivery in Unreal.

## Historical tested copied transfer

1. Preserve source edge pivots; use copies and do not center origins.
2. Historical validation export only: export individual FBXs: `global_scale=1`, `apply_unit_scale=True`, `apply_scale_options='FBX_SCALE_NONE'`, forward `-Y`, up `Z`, mesh modifiers enabled, no animation. The alternative unit-metadata trial arrived at 4 cm instead of 400 cm with the tested legacy importer.
3. Import geometry without new materials/textures. Assign materials in modular Blueprints, following the owner's workflow.
4. Fresh painted copies need **Vertex Color Import Option: Replace**. The initial default imported with Ignore and discarded alpha. Atomic reimports may preserve existing paint; inspect the result rather than relying only on the requested option.
5. The copied legacy FBX test temporarily disables the session's Interchange FBX flag and restores it immediately. This is not a project-wide replacement of the production Interchange workflow.
6. Check dimensions, bounds, triangles, slots and UVs after reimport from another directory. Four types passed. Native export back to Blender retained expected UV scale and varying painted alpha (approximately 0.63–1 after 8-bit conversion).

Use Unreal `Rotator(pitch=..., yaw=..., roll=...)` keyword arguments. This build's positional constructor order differs from the assumed pitch/yaw/roll order.

## UV and collision

- Walls use about 0.5 UV units/m: 512 px gives about 256 px/m. The sampled concrete floor uses about 0.24975 units/m at 1× tiling: about 128 px/m. This is an intentional tileable-alignment exception confirmed by the owner. Floors and ceilings can depart from 256/512 px/m; preserve their UVs and material tiling.
- Original samples have one authored UV channel. No baked-lightmap pass was performed.
- Copies use existing structural **Complex As Simple** collision, with no simple hulls. This sample does not prescribe a new kit-wide collision policy.
- Native probe distances: floor 100 cm; wall 185 cm; corner 85 cm; straight-wall seam 185 cm. The L-corner assembly was inspected in the engine.

Review actor: `ART_REVIEW_Basement_Kit_Validation` in LaCarlota at `(12000, -2400, 0)` cm, folder `Art Review/Basement 2026-11-12`. Assets: `/Game/Art/Assets/Building/Modular_Blocks/Validation/Basement_20261112`.

Scripts: `modular_copy_trial.py`, `validate_module_roundtrip.py`, `export_validation_meshes.py`, `check_exported_module_uvs.py`, `build_module_validation_scene.py`. Inspect destination paths and existing assets before use; the assembly creator refuses to duplicate an existing test Blueprint.

The doorway mesh still needs a modular Blueprint. It was not replaced in this pass.
