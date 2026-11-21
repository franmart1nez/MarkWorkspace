# Office Level Builder

Build 4 m modular layouts from room volumes and stair markers using the project's existing modular Blueprints. Use Z scale for height, **Enclosed Room** for a room within a larger one, and **Keep Shared Walls** for separate finishes where two rooms touch.

## Files

| Item | Location |
| --- | --- |
| Builder | `/Game/Art/Tools/OfficeLevelBuilder/BP_OLB_Builder` |
| Room marker | `/Game/Art/Tools/OfficeLevelBuilder/BP_OLB_Room` |
| Stair marker | `/Game/Art/Tools/OfficeLevelBuilder/BP_OLB_Stair` |
| Installed runtime script | `BoomeRacist/Content/Art/Tools/OfficeLevelBuilder/Python/olb_build.py` |
| Matching editable runtime source | `projects/total-insanitation/scripts/olb_build.py` |
| Blueprint setup/refresh source | `projects/total-insanitation/scripts/olb_setup_assets.py` |

The editable runtime source matches the installed script. Setup/refresh changes tool packages and is only needed for installing or maintaining the Blueprint assets.

Select modular classes from `Modular_Blocks/BP/<Area>/<PieceType>/`. Automatic corner selection finds `<wall family>_Corner_NN` beside the chosen wall, then anywhere under `Modular_Blocks/BP/`. For example, `BP/Basement/Wall/BP_Wall_VertexConcrete_03` uses `BP_Wall_VertexConcrete_Corner_01`. The setup script's default classes use the same folders. [Current modular folders](FILE_PLACEMENT.md)

## Use

1. Place one `BP_OLB_Builder` in the target level; its location is the 4 m grid origin. Set `Group` and select wall, corner, floor, ceiling and lit-ceiling classes.
2. Add `BP_OLB_Room` markers of the same group. New markers start in `Office`; if the Builder uses another group, such as `Basement`, set **Office Builder → Group** on every Room and Stair to that exact name. **Scale X/Y** sets the footprint in 4 m cells, and **Scale Z** sets the height in 4 m increments. For example, a scale of **4 × 3 × 2** makes a 16 × 12 m room with an 8 m ceiling. The actor's Z location sets the base floor.
   **Rotate a Room** in 90° steps to turn its floor and ceiling pieces and its light pattern. Build snaps other angles to the nearest step and keeps the rotation. The footprint is the green box, which turns around its corner pivot; move it back into place after rotating. The Basement roof pipes, cable tray and fluorescent fixture run along the piece's local Y. A corridor along world X therefore needs a yaw of 90° and a scale of **1 × N**. For example, a 6-cell corridor that starts at X −400 and Y −1200 uses location (2000, −1200), yaw 90 and scale 1 × 6 × 1. Walls depend only on the footprint.
3. Place a smaller marker inside a larger room of the same group and enable **Office Builder → Enclosed Room** on the smaller one. It gets walls, floor and ceiling, with its own piece and light overrides. At a shared floor or ceiling plane, the enclosed room provides the tile within its footprint.
4. For adjoining rooms, align their edges on the grid and enable **Office Builder → Keep Shared Walls** on both markers. Assign **Wall Classes** on each room for its own finish.
5. Give the room whose wall should stay flush the higher **Priority**. For example, set the wallpaper room to **1** and its neighbor to **0** to keep the wallpaper face on the grid line. The opposite face shifts 30 cm into the lower-priority room. With equal priorities both faces move inward 15 cm. **Priority** also selects pieces in overlapping ordinary markers, including floor patches. Empty piece lists inherit the Builder.
6. Set **Light Spacing X/Y** to 1 for every cell, 2 for every other cell, 0 for no lights or −1 on a room to inherit the Builder. The pattern is centered per room and retains a center row in narrow corridors. X and Y follow the room's own axes, so they turn with the room. Ceiling pieces take the rotation of the room that controls this pattern; floor pieces take the rotation of the room that supplies them, such as a rug patch.
7. Place `BP_OLB_Stair` on the upper floor. Its 1 × 2-cell footprint descends one 400 cm floor. The orange arrow points downhill. Rotate in 90° steps and connect upper/lower room cells to the stair ends.
8. Press **Build** from a marker's Details panel after changes. **Clear** on the Builder removes generated actors. Each operation is a single undo transaction.

Use separate groups for independent layouts. Generated actors carry `OLB_Generated` and live under `<Outliner Folder>/<Group>/L<floor>/` in the World Outliner. Set **Office Builder → Outliner Folder** on the Builder to rename the base folder; it accepts nested paths such as `Generated/Basement`, and an empty value uses `OfficeBuilder`. The next Build moves the group's actors there and removes the folders it leaves empty. A folder that still holds other actors stays. A rebuild replaces that group's generated actors: remove the tag or change the marker group before preserving hand-edited results. Marker Blueprints are editor-only.

## Rules and limits

- Grid: 400 cm; standard wall thickness: 15 cm. Open convex corners use the 385 cm wall variant to avoid overlapping end faces. Keep the kit's edge pivots and ceiling offsets.
- Ordinary rooms connect by default. At an open 4 m to 8 m join, the passage stays open up to 4 m and wall modules close the space above it. A tall room has one floor and one ceiling across its clear height. Stacking separate 4 m room markers retains their dividing floor and ceiling.
- **Keep Shared Walls** works between adjoining ordinary rooms or adjoining enclosed rooms. Both markers opt in. Overlapping ordinary rooms still merge. The two wall modules meet back to back, with 30 cm between their interior faces. At a height difference the taller wall continues at the same inset. Shared partitions are solid, and doorways require manual authoring.
- An enclosed marker must fit within the footprint and height of a larger ordinary marker. Overlapping enclosed markers are skipped with a warning. Enclosed walls are generated solid. Doorways require manual authoring.
- Stair cells receive no ordinary floor/ceiling. The tool uses a mirrored copy of the chosen stair piece for the stepped ceiling; inspect orientation and adjoining walls in the actual scene.
- A stair that crosses an enclosed room's footprint or lands inside it is skipped with a warning.
- Build snaps markers to the grid. Review warnings, collision and walkability before accepting a layout.
- Lit ceiling materials are not a promise of sufficient real lighting. Verify with the target lighting setup.

## When Build does nothing

A Build that generates nothing opens a dialog that explains why. The Output Log has every warning; filter it by `OLB`.

- **No marker has the Builder's group:** the dialog names the groups that the markers use, for example `"Office" (8 room(s), 5 stair(s))`. Give the markers and the Builder the same **Group**. Leading and trailing spaces are ignored.
- **The selected markers' group has no Builder:** the dialog lists the Builder groups in the level.
- A Build that finds no markers keeps the group's earlier generated actors. Use **Clear** on the Builder to remove them.

## Shared wall alignment in Unreal

The same camera shows the wallpaper-to-wood joint on a temporary test map. With equal priorities, the wallpaper face sits 15 cm in front of the adjacent wood wall.

![Equal priorities leave a 15 cm step between wallpaper and wood](media/level-builder/shared-wall-priority-centered.webp)

With wallpaper set to **Priority 10** and the room across the partition set to **0**, the wallpaper and wood faces meet flush. Collision traces measured both faces at the same grid coordinate and the opposite partition face 30 cm away. Reversing the priorities moved the offset to the wallpaper side.

![Higher wallpaper priority lines up the two wall faces and their baseboards](media/level-builder/shared-wall-priority-aligned.webp)

## Revision history

- Room Z scale sets the ceiling height in 4 m increments. **Enclosed Room** adds a separate floor, walls and ceiling inside a larger room.
- **Keep Shared Walls** builds a back-to-back pair between touching markers, retaining a separate wall finish for each room.
- **Priority** controls the alignment of that pair. The higher-priority face lines up with ordinary walls on the same grid line and the other room absorbs the full partition thickness. Equal priorities keep the centered placement.
- 2026-11-20: corner lookup follows the kit's `BP/<Area>/<PieceType>/` folders. A Build that finds no matching markers explains the group mismatch instead of silently doing nothing.
- 2026-11-20: the Builder's **Outliner Folder** replaces the fixed `OfficeBuilder` base folder. Build and Clear remove generated folders they leave empty.
- 2026-11-20: a Room's yaw, in 90° steps, turns its floor and ceiling pieces and its light pattern. Earlier builds reset every Room to 0°.
