# Unreal reference library

Stage 3 · captured 2026-11-17 · Unreal 5.8.4. The Art bible now has direct **Environments**, **Materials**, **Assets**, **Characters**, **Mascot**, and **Signage & UI** tabs. The editable `.card.json` files are the source of truth. Technical verification and owner artistic approval remain distinct.

## Coverage

- **Environments:** 11 unique lit viewport captures; 13 entries including shared-lighting and review-rig explanations. Current implementation includes unfinished areas. These are editor images, not gameplay.
- **Materials:** all 88 MaterialInstanceConstant assets under `/Game/Art/MI/Utility_Materials`, in 14 native families. Flat, curved and edged comparisons record exact MI/parent, texture sources, instance overrides and inspected map consumers.
- **Assets:** 69 selected geometry/tool/prop references. Native 256 × 256 previews show mesh defaults; scene overrides may differ.
- **Characters:** the initial skeletal mesh survey covered the Manny and Quinn templates. The owner subsequently identified the provisional fantasy NPCs in `/Game/Programming/Enemies/FlipBooks`. The current Characters gallery now shows their native sprite texture previews. [NPC reference](NPC_REFERENCE.md).
- **Mascot:** Stage 3 preserved six owner prototypes. The current Mascot gallery contains the [twelve final Stage 4 poses](MASCOT_STAGE4_LIBRARY.md).
- **Signage & UI:** the initial survey captured two native texture previews and the owner’s goblin prototype. The current Stage 5 gallery contains the twelve approved sign designs. [Editable artwork](BASEMENT_SIGNAGE_STAGE5.md).
- **Building concepts:** Stage 6 pairs fresh Unreal captures with wall and ceiling studies for Basement and Level_01. [Structural concepts](BUILDING_STRUCTURE_CONCEPTS_STAGE6.md).

The [reference index](REFERENCE_INDEX.json) contains exact native paths, camera/FOV metadata, material parameters, texture import records, verified current source matches and all 98 inspected mesh assets, including their native previews. The extra 27 legacy geometry bundles/thin details remain inventory evidence; they are not featured as useful finished-art examples. [File rules](FILE_PLACEMENT.md) and the [FBX map](FILE_MAP.csv) remain the authority before a reimport. Matching a filename is not proof of source/export geometry equivalence.

## Environment provenance

`/Game/Levels/Inteior_Lobby` was captured with its existing `/Game/Levels/Streaming_Levels/Basement` and `/Game/Levels/Streaming_Levels/Main_Lights` loaded. The images cover lobby entry/atrium/reverse, the janitor service stair, Basement entry/corridor/descent/shop. `/Game/Levels/LaCarlota` provides cleaning-tool, existing flat-material and modular-finish contexts with the same shared Main_Lights level. Basement and Main_Lights were also loaded directly and inspected without saving.

Main_Lights contains DirectionalLight, ExponentialHeightFog, PostProcessVolume, SkyAtmosphere and SkyLight. The Basement's local fluorescent Blueprint lights remain in Basement. Captures retain authored lighting, material overrides, geometry and tiling. Dark areas and renderer noise are part of these current editor captures; no image exposure/color correction was applied. Cameras are recorded per image, in centimeters and degrees, at 75° FOV.

The lobby still has WorldGrid assignments. LaCarlota has 23 StaticMeshActors with empty mesh assignments, although the corresponding named laboratory assets can be loaded and previewed independently. These are coverage/implementation findings, not completed repairs or evidence of approved final art.

## Material review level

The existing LaCarlota study uses flat samples and was insufficient for consistent curved/edged comparisons. It was preserved. The approved separate review level is **`/Game/Levels/Art_Material_Reference`**.

Each of 88 stations uses the original MI unchanged on four engine basic shapes. From the recorded camera's left to right: a **2 m flat panel**, **1 m cube**, **1 m diameter sphere**, and **1 m flat panel**. Stations are spaced 1,200 cm apart in an eight-column grid. Names start `REF_001_` through `REF_088_`; the material index records their origins and cameras. Camera FOV is 55°.

Engine basic-shape UV domains remain 0–1. Thus the 2 m panel stretches the same UV region rather than doubling repetitions. This reveals the effect of scale alongside the unchanged MI tiling overrides; it is **not** a 256/512 px/m calibration. Preserve production UVs, floor/ceiling exceptions and Blueprint overrides. Trim samples on generic shapes are diagnostic; the authored consumer determines correct trim placement.

The rig uses neutral ground/backdrops, a white directional light at 3 lux (pitch −40°, yaw 65°, 3.5° source angle) and the engine DaylightAmbientCubemap at intensity 1. Its post-process settings fix exposure min/max to EV100 0 and set exposure bias, bloom and vignette to zero. The project's existing disabled auto-exposure setting was preserved; this is a consistent visual comparison, not a photometric measurement. Glass/LOD/glass-liquid utility stations include black/white contrast bars behind the samples.

Reopening the saved level verified **643 actors and all 352 intended MI assignments**. The editable [setup script](../../projects/total-insanitation/scripts/unreal_reference_showcase.py) records construction and refuses dirty sessions or existing target packages. Inspect the existing level rather than rerunning it over current work. It is not part of gameplay and is not a new Office/Basement design.

Two existing magic instances show a checker fallback. Loading LaCarlota reports the absent `/FabLauncher/MSPresets/MS_DefaultMaterial_Fuzzy/Functions/MF_Tiling` dependency through `MM_Emmisive_Mask_Panner`. Their native captures document this problem and are not approved magical finishes. Several glass utilities are nearly invisible or strongly refractive; the contrast target makes their actual output explicit. Repairs remain separate.

Sixteen exact Utility_Materials instances have direct consumers in inspected lobby/Basement actors. Other entries name their LaCarlota consumer or explicitly state missing direct scene coverage. A current rig render does not prove that an instance is used in a final game scene.

## Preservation and media

Only two native packages were added:

- `/Game/Levels/Art_Material_Reference`
- `/Game/Art/Tools/MaterialReference/M_Reference_Neutral` — a review-rig helper, not a new production finish

All **8,014 existing native packages** retained their baseline size and modification time; none was removed. No existing production level, material, Blueprint, source blend, Substance source or asset link was saved, relinked or deleted. The saved showcase reopened cleanly. Unreal was returned to clean `/Game/Levels/Test`, the original camera, 90° FOV and editor overlays; PIE remains off. No editor/session restart, paid generation or delegated worker was used.

Full-resolution viewport review images are WebP copies at the original 2014 × 1187 resolution; native mesh previews retain their original 256 × 256 size. Texture previews retain their own source-thumbnail dimensions. No geometry, paint, lighting or colors were edited in the images. Uncompressed original PNG captures and transient native receipts remain local under ignored `.mrmak/total-insanitation/stage-3/`. Initial black/incomplete MCP readbacks and unsuitable camera frames were repeated before delivery. Native captures were visually reviewed as sheets and targeted full-size images. Every gallery preview uses the Workspace enlargement and download controls.

Stage 4 is complete. This reference library supplies the native baseline for Stage 6 scene studies and Stage 7 individual assets. Stage 5 reviews the graphics on their own.
