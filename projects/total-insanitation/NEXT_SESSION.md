# Continue Total (in)Sanitation

Read `AGENTS.md`, **Plan → Progress**, **Rules & tools → File rules**, the [Unreal capture notes](../../workspace/2026-11-12_total-insanitation/REFERENCE_LIBRARY.md) and the [approved mascot library](../../workspace/2026-11-12_total-insanitation/MASCOT_STAGE4_LIBRARY.md). Stages 1–4 are complete.

Retired AI production data was removed, the hub simplified, the source/FBX/Unreal contract verified and the native reference library rebuilt. The Office Level Builder is explicitly retained. Owner originals remain in `Temp` and the mascot and sign prototypes remain in the source root. Existing production Blender, Designer and Unreal packages were preserved.

The stage-2 [file contract](../../workspace/2026-11-12_total-insanitation/FILE_PLACEMENT.md) records the source/collection/export/package mapping, installed static preset and rig/UCX exceptions. Its CSV covers 94 existing FBXs; its audit evidence records 19 blends and 557 native packages. Native source repairs and a new export round trip were not performed.

Preserve the moved structural trim until a targeted relink; two missing atlas images still have ten Blender object consumers. Six zero-user Corridor materials and the zero-user props T01 image are classified retired, but were not removed from native files. `Janitor_Building.fbx` actually contains elevator meshes. Unreal still references the validation Blueprint from `LaCarlota`; do not delete that chain or fix redirectors indiscriminately.

The Art bible has direct Environments, Materials, Assets, Characters, Mascot and Signage & UI tabs. All 88 Utility_Materials instances have flat/curved/edged native captures in `/Game/Levels/Art_Material_Reference`; 69 selected assets and 11 environment images provide the native baseline. The [reference index](../../workspace/2026-11-12_total-insanitation/REFERENCE_INDEX.json) records exact paths, cameras, source matches, parameters and all 98 inspected mesh previews. Reopening verified 352 material assignments in 643 actors. The new level and `/Game/Art/Tools/MaterialReference/M_Reference_Neutral` are the only added native packages; all 8,014 prior packages retained baseline size/time.

Preserve the recorded limitations: WorldGrid lobby assignments, 23 empty LaCarlota StaticMeshActor mesh assignments, two magic MIs with checker fallback from the missing FabLauncher `MF_Tiling` dependency, and no matching imported owner fantasy characters. Manny/Quinn are placeholders, not new project character approvals. These issues were documented, not repaired.

**Stage 5 awaits owner direction.** Review the [four signage concepts, health HUD and main menu](../../workspace/2026-11-12_total-insanitation/SIGNAGE_UI_STAGE5_REVIEW.md) in **Art bible → Signage & UI**. After direction approval, recover the occupied atlas regions, compare layout options and check sign mounting, viewing distance and mips in Unreal.

Stage 5 observed the live editor on `/Game/Levels/Art_Material_Reference` with PIE off. Menu and Lobby evidence came from isolated standalone processes. Verify project, map and unsaved state before any live view change. Inspect the saved review rig and preserve the active editor session.

Confirmed decisions: English game text with future localization; UI in `/Game/Art/UI`; characters in `/Game/Art/Characters`. Use real Unreal material instances under `/Game/Art/MI/Utility_Materials`. The later graphic, Basement and individual-asset approvals remain ahead.

The retained tool's guide is `workspace/2026-11-12_total-insanitation/OFFICE_LEVEL_BUILDER.md`. Its editable runtime source and setup script are in `scripts/`. Do not run setup, demo generation or map edits during Workspace cleanup.
