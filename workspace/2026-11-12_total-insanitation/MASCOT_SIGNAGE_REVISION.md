# Mascot and signage revision

The atlas resources include thirteen wizard poses in black and white and twelve signs. Open **Art bible → Mascot** and **Art bible → Signage & UI** for full-size previews and individual SVGs. [Download all 38 SVGs and the palette](sources/mascot-signage-revision.zip).

- The wizard uses three fingers and a thumb. The eleven open hands in eight poses were rebuilt with even finger widths, rounded tips and a single palm shape, scaled to each forearm. Only the hand regions changed; the skeleton hands keep their wrist-bone cut-outs. Pointing left mirrors the Pointing right hand. Closed grips on tools and supplies retain their simplified silhouette.
- **Stop signal** (`wizard-stop-v01`) is a new pose built on the approved Pointing left body: the forearm ends in an upright open palm. It replaces the pointing wizard on Restricted Area and Keep Out, re-centred by about 6 units on each sign.
- The Quiet Please elf holds a finger to its lips, with closed eyes and the lips visible on both sides of the finger. The crossed-out sound waves were removed and the elf is centred on the panel.
- Sign 04 reads **EQUIPMENT** on one centred line. The file keeps the name `04-cleaning-equipment.svg` so existing atlas links remain valid.
- Chemical Spill and the standalone acid pose share the same updated art. Three vapor trails rise above the puddle, and the boot and puddle meet in one continuous outline.

## Safety yellow

The palette comes from Chemical Spill. Chemical Spill, Wet Floor, Toxic Vapors and Low Clearance use the same sRGB gradient. The Wet Floor CAUTION letters and the Restricted Area stripe use its center color. [Palette JSON](sources/mascot-signage-revision/signage-palette.json).

| Gradient position | sRGB hex |
| --- | --- |
| 0% | `#FFD035` |
| 55% | `#FFCA28` |
| 100% | `#F6BC22` |

## Atlas resources

`General_Atlas/Resources/Pet/SVG` contains the 26 mascot SVGs on 2048 × 2048 canvases. The original 1254 × 1254 framing is centered at its original scale. `General_Atlas/Resources/Signage_Atlas/SVG` contains the twelve signs at their existing power-of-two dimensions and positions. The nine revised signs retain editable lettering. [Signage canvas sizes](SIGNAGE_ATLAS_STAGE7.md#power-of-two-resource-canvases).

All SVGs were rendered in Chromium and checked against the files in the resource folders. They are ready for the owner's next Substance Designer import and atlas export; the import should add `wizard-stop-v01` and its white mask.
