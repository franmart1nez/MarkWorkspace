# Stage 5 · Graphic direction and atlas baseline

The owner approved twelve sign designs as examples of the game's general signage. The gallery contains the approved artwork with editable English lettering and links to the twelve SVG masters. [Stage 5 artwork](BASEMENT_SIGNAGE_STAGE5.md) · [SVG bundle](sources/signage-stage5-svg.zip).

The owner's goblin-skull graphic informed Toxic Vapors. The original is indexed with the provisional fantasy species and source branches. [NPC reference](NPC_REFERENCE.md).

## Atlas baseline

The 55-node `Text_Atlas` graph in `General_Atlas.sbs` has a linked goblin bitmap upstream of Base Color, Normal, Roughness and Reference. The file retains its legacy export folder. The normal and reference PNGs are missing from the current Blender links, which still have ten prop consumers. [File and dependency audit](FILE_PLACEMENT.md).

Recover occupied UV regions and verify consumers before assigning atlas space. Record bleed, mip tests, channels, resolution and expansion space. Keep localized strings editable.
