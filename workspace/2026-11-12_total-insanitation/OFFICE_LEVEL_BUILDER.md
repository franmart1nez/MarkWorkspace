# Office Level Builder

**Retained by the owner's explicit decision.** This tool builds 4 m modular layouts from room rectangles and stair markers using the project's existing modular Blueprints. The Workspace cleanup preserved the native tool and its editable source/setup code. It did not run the generator or verify a new layout.

## Files

| Item | Location |
| --- | --- |
| Builder | `/Game/Art/Tools/OfficeLevelBuilder/BP_OLB_Builder` |
| Room marker | `/Game/Art/Tools/OfficeLevelBuilder/BP_OLB_Room` |
| Stair marker | `/Game/Art/Tools/OfficeLevelBuilder/BP_OLB_Stair` |
| Installed runtime script | `BoomeRacist/Content/Art/Tools/OfficeLevelBuilder/Python/olb_build.py` |
| Matching editable runtime source | `projects/total-insanitation/scripts/olb_build.py` |
| Blueprint setup/refresh source | `projects/total-insanitation/scripts/olb_setup_assets.py` |

The saved runtime source matches the installed script at reset time. Setup/refresh changes tool packages; it is a maintenance action, not an audit. Inspect the target and preserve current owner changes before running it. Old demo placement and migration scripts are not needed for normal use.

## Use

1. Place one `BP_OLB_Builder` in the target level; its location is the 4 m grid origin. Set `Group` and select wall, corner, floor, ceiling and lit-ceiling classes.
2. Add `BP_OLB_Room` markers of the same group. Scale 1 represents one 4 × 4 m cell; scale 4 × 3 represents 16 × 12 m. Keep yaw 0. Move vertically in 400 cm increments for another floor.
3. Set room overrides as needed. Empty piece lists inherit the Builder. Where rooms overlap, higher `Priority` selects the pieces. Touching/overlapping rooms merge; they do not automatically gain partition walls or doorways.
4. Set `Light Spacing X/Y`: 1 means every cell, 2 every other cell, 0 no lights; −1 on a room inherits the Builder. The pattern is centered per room; narrow corridors retain a center row.
5. Place `BP_OLB_Stair` on the upper floor. Its 1 × 2-cell footprint descends one 400 cm floor; the orange arrow points downhill. Rotate in 90° steps and connect upper/lower room cells to the stair ends.
6. Press **Build** from a marker's Details panel after changes. **Clear** on the Builder removes generated actors. Each operation is a single undo transaction.

Use separate groups for independent layouts. Generated actors carry `OLB_Generated` and live under `OfficeBuilder/<Group>/L<floor>/`. A rebuild replaces that group's generated actors: remove the tag or change the marker group before preserving hand-edited results. Marker Blueprints are editor-only.

## Rules and limits

- Grid: 400 cm; standard wall thickness: 15 cm. Open convex corners use the 385 cm wall variant to avoid overlapping end faces. Keep the kit's edge pivots and ceiling offsets.
- Stair cells receive no ordinary floor/ceiling. The tool uses a mirrored copy of the chosen stair piece for the stepped ceiling; inspect orientation and adjoining walls in the actual scene.
- Build snaps markers to the grid. Review warnings, collision and walkability before accepting a layout.
- Lit ceiling materials are not a promise of sufficient real lighting. Verify with the target lighting setup.
- Interior partitions, door systems and broader layout features need separate design/implementation work.
- The reset removed old demo reports/screenshots and local demo recovery copies. It did not remove, rebuild or save any demo/current actors in Unreal. Inspect the live level before any future Build/Clear.
