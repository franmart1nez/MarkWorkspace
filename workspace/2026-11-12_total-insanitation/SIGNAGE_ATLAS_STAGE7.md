# Signage Atlas · Stage 7 specification

The independent 2048 × 2048 page contains the twelve approved graphics in **Art bible → Signage & UI**. Its editable package is `Signage_Atlas.sbs` beside `General_Atlas.sbs` under `Utility_Materials/TrimSheet&Atlas/General_Atlas/`. The two linked bitmap inputs, editable SVGs, individual PNGs and relative layout data are in `Resources/Signage_Atlas/`. [Approved artwork](BASEMENT_SIGNAGE_STAGE5.md) · [Pixel rectangles and UVs](sources/basement-stage7-atlas-layout.json).

![The twelve approved sign designs in the delivered Designer atlas](media/basement-stage7/signage-atlas-designer.webp)

Adobe's Substance cooker and renderer read the delivered package and resolved both links. Base Color and Coverage rendered at 2048² and matched their corresponding inputs pixel for pixel. The page uses the approved standalone PNG exports resized into their recorded rectangles. Source packing passed BOX isolation through mip 5 on all twelve allocations. The graph reads the packed pages as inputs. Changes to the layout are made in the resources and repacked before updating the graph output. [Adobe publishing documentation](https://experienceleague.adobe.com/en/docs/substance-3d-designer/using/substance-graphs/publishing-substance-3d-asset-files-sbsar).

## Historical Text_Atlas audit

A disposable copy of `Utility_Materials/TrimSheet&Atlas/General_Atlas/General_Atlas.sbs` cooked and rendered through the installed Substance tools. Its `Text_Atlas` graph exported Base Color, Normal, Roughness and Reference at 1024 × 1024. In Base Color, visible art sits mainly in the lower-left quarter. The native render places the legacy strip at pixel Y 513–528, the goblin symbol at Y 532–747, the test word at Y 802–832 and the dark rectangle at Y 911–1008. The top-left origin is used for these measurements. The Reference output has a full-frame grid behind the graphics.

A read-only Blender audit covered all ten consumers of the `Atlas` material. Its two image nodes use repeat addressing and the active render UV. The union of their polygon coverage spans the full sheet and touches about 93% of the 1024² texels in the rasterized diagnostic. The ten are `Ashtray_01`, `Cigarette_01–05`, `Pipes_01–03` and `SM_Centrifuge`. The centrifuge also samples the repeated tile above V=1. The two PNG links in the saved blend are missing. This render establishes the current graph's layout, with historical export identity still unverified.

![Legacy Base Color and Blender UV coverage over the Reference output](media/basement-stage7/legacy-atlas-audit.webp)

The owner removed the old `Text_Atlas` graph. The saved historical audit documents why this page has independent outputs, padding and localization. The current `General_Atlas.sbs` contains the `General_Atlas` graph. The approved mascot resources in `Resources/Pet` are the twelve vector poses in black and white and their eight approved PNG sizes. Interface labels and dynamic values belong in localized UMG text.

## Update and test the page

1. **Rasterize each approved SVG into its content rectangle.** Keep the word objects editable in the SVG sources. Use the matching fonts and the exact `content_xywh_px` values from the layout JSON. The proof uses 640 × 960 for A Clean Start, original aspect ratios, stable identifiers and zero rotations. Lock the rectangles across re-exports and localizations.
2. **Pack and bleed the edges before import.** Reserve 32 px on every side of each graphic and extend the nearest texel colors out to its padded rectangle. Preserve artwork coverage in a separate linear channel or file where a masked silhouette requires it. Align each outer rectangle to four-texel blocks. The tested plan allocates 76.25% of the page including gutters. Its largest continuous open rectangle is 1344 × 392 px, plus smaller gaps.
3. **Refresh the companion Designer source.** `General_Atlas/Signage_Atlas.sbs` has linked Base Color and Coverage at 2048². Keep Base Color sRGB and Coverage raw. Use material-instance roughness and a flat tangent-space normal for the initial Unreal check. Create matched packed-rect masks only when a specific material needs ink wear or exposed metal. Keep paper dielectric and reserve metalness for exposed metal.
4. **Import and bind in Unreal.** Keep the world texture and instances under a proposed `/Game/Art/MI/Utility_Materials/Signage/` branch and put the shared surface parent with the existing basic materials. On a plane with local 0–1 UV0, calculate `AtlasUV = UVOffset + saturate(LocalUV) * UVScale`. The layout records half-texel-centered offsets and scales in top-left raster/Unreal convention. Verify the V axis through a single FBX before baking atlas UVs in Blender. Keep opaque planes for paper and solid signs. Use masked coverage where the actual silhouette requires it. Set texture address mode to Clamp and use world mips and streaming for these surfaces. Interface widgets can reference compatible icons separately. [Epic texture settings](https://dev.epicgames.com/documentation/en-us/unreal-engine/texture-asset-editor-in-unreal-engine?application_version=5.8).
5. **Verify the pilot before filling production.** Start with A Clean Start on a provisional 45 × 67.5 cm plane and one wide sign with small letters. Review straight ahead, at a grazing angle, near, far and with forced mips under the existing aisle light. Confirm the neighboring tiles, color, letter readability and exact SVG source. The current layout passed a synthetic BOX-filter border test at mip 0–5. Unreal compression, streaming, anisotropy and longer-distance cases remain native implementation checks. If a particular sign needs more headroom, increase resolution or assign it an isolated page after the native comparison.

## Two-sign raster proof

A Clean Start uses the recorded 640 × 960 px rectangle at (32, 32). Low Clearance uses 640 × 202 px at (1368, 1168). Its smaller “WATCH YOUR HEAD” line and rounded corners exercise fine lettering and the coverage mask. Both renders match the approved SVG hashes and use the originals' installed fonts. The paper poster is opaque. Low Clearance has a separate linear coverage mask for its rounded panel.

![A Clean Start and Low Clearance from the two-sign atlas with mip 3, 4 and 5 samples](media/basement-stage7/signage-pilot-proof.webp)

The padding kept both color and coverage identical through mip 5 when the area outside the padded rectangles was filled with contrasting test colors. Five half-texel UV samples per sign matched the top-left atlas coordinates. In the enlarged offline samples, the small copy becomes hard to read by mip 4. Test the wide sign at the distance where the player needs the warning, using the actual mesh, Basement light and Unreal's compression and streaming settings. The FBX V direction and native readability are pending.

[Base Color PNG](sources/basement-stage7-signage-pilot/signage-pilot-basecolor.png) · [Linear Coverage PNG](sources/basement-stage7-signage-pilot/signage-pilot-coverage.png) · [Raster and packing checks](sources/basement-stage7-signage-pilot/packing-evidence.json).

The layout and UV audit are editable as data. Existing signs stay linked to their original SVGs in the asset record. [Atlas layout JSON](sources/basement-stage7-atlas-layout.json) · [Basement kit and material gaps](BASEMENT_ASSETS_STAGE7.md).
