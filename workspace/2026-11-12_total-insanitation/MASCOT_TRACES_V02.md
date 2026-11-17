# Wizard mascot / approved action traces v02

**SVG approval recorded · 2026-11-17.** The owner accepted both v02 traces and their finish, and requested the same quality for the remaining poses. [Ten new raster proposals](MASCOT_ROUND_02_REVIEW.md) await selection before their own tracing. The approved v02 masters and package remain unchanged.

**The owner approved both ChatGPT action images.** Their pointing-left and mopping contours have now been traced into editable SVG and presented on different backgrounds and at display sizes, following the requested order. These two traces are delivered; stage 4's remaining pose set is still pending.

## Review and downloads

- [Light, dark and yellow backgrounds](media/mascot-trace-v02/backgrounds-v02.png).
- [Approved raster versus SVG, including hand details](media/mascot-trace-v02/trace-comparison-v02.png).
- [Actual display sizes](media/mascot-trace-v02/sizes-v02.png): 32, 48, 64, 96, 128 and 256 px. Open at 100% for those pixel sizes.
- [Complete editable package](sources/mascot-trace-v02.zip): SVGs, transparent PNG exports, review sheets, raw trace sources, manifest and usage notes.

Individual masters:

- Pointing left: [black SVG](sources/mascot-trace-v02/wizard-point-left-v02.svg), [white SVG](sources/mascot-trace-v02/wizard-point-left-v02-white.svg), [black 1024 PNG](media/mascot-trace-v02/wizard-point-left-v02-1024.png), [white 1024 PNG](media/mascot-trace-v02/wizard-point-left-v02-white-1024.png).
- Mopping: [black SVG](sources/mascot-trace-v02/wizard-mopping-v02.svg), [white SVG](sources/mascot-trace-v02/wizard-mopping-v02-white.svg), [black 1024 PNG](media/mascot-trace-v02/wizard-mopping-v02-1024.png), [white 1024 PNG](media/mascot-trace-v02/wizard-mopping-v02-white-1024.png).

## What was preserved

The actual approved raster contours supplied the shapes. There was no reconstruction from circles/limb primitives and no attempt to force both poses into the rejected v01 proportions. Hat, head, hands, feet, staff/mop, negative spaces, original 1254-square framing and ground strokes remain derived from the chosen images. The originals retain their recorded SHA-256 hashes.

The four master SVGs contain editable filled Bezier paths with transparent negative spaces and no embedded bitmap, text, white background rectangle or raster mask. Black/white variants use identical geometry. The presentation sheets include the original raster only where labeled for comparison; that does not turn the master artwork into an embedded image.

The white canvas and light regions returned by the vectorizer were resolved into transparency, including hand separations, orb sparkle and limb gaps. Near-black edge regions were normalized to one solid ink. Changing the fill to white preserves the holes; they are not opaque white paint. The original Adobe trace files and provenance metadata are retained.

## Fidelity and transparency checks

At the original **1254 × 1254** resolution, comparing the approved raster's ink with the rasterized SVG alpha at a 50% threshold gives:

- Pointing left: **99.53% foreground silhouette overlap**; all binary differences are within a one-pixel boundary band.
- Mopping: **99.41% foreground silhouette overlap**; all binary differences are within a one-pixel boundary band.

This measures the foreground intersection divided by its union, rather than letting the large white background inflate the score. A one-pixel band uses the immediate eight-connected neighborhood. It is a bounded fidelity check, not a claim of identical antialiasing or artistic reapproval. Full figures and enlarged hand/grip details were also inspected visually.

Black/white masters have identical geometry and checked transparency. Transparent PNGs are supplied at 32, 48, 64, 96, 128, 256, 512 and 1024 square pixels. Alpha is identical in the 512/1024 exports; smaller browser exports differ by at most one level out of 255 at a few antialiased edge pixels. The 32/48 px examples expose fine-detail loss. At 64 px, judge the silhouette before relying on small hand/sparkle cutouts. No compact redesign was made, and no minimum world-sign distance, engine mip behavior or complete graphic palette has been approved by these browser checks.

## Source and method

Canonical source directory:

`D:/GameJam/Total (in)Sanitation/Utility_Materials/TrimSheet&Atlas/General_Atlas/Resources/Pet/Development/Stage4_Trace_v02/`

Workspace copies live in `sources/mascot-trace-v02/`. The owner-selected ChatGPT PNGs, original greeting JPG and rejected v01 SVGs remain preserved. No new image generation, atlas edit, Unreal import or native production change was made in this trace round.

Adobe's `image_vectorize` produced the initial editable paths from the approved rasters. The [preparation script](../../projects/total-insanitation/scripts/prepare_mascot_traces.py) consolidates those existing paths using union/difference and preserves the source coordinate system. This uses the [Skia Path Ops bindings](https://github.com/fonttools/skia-pathops) and [FontTools SVG parser](https://fonttools.readthedocs.io/en/latest/svgLib/path/parser.html); it does not fit new anatomy. The [review-sheet source](../../projects/total-insanitation/scripts/build_mascot_trace_review.py) lays out those same path data. Tool environments and runtime receipts remain under ignored project state, outside production files.

Keep v02 as this trace revision. After hand editing, make a later revision rather than rerunning preparation over the edited master. A matching source/hash manifest and preservation guard prevent silent replacement of changed SVGs.

The remaining mascot poses and full signage/UI milestones retain the approved plan's scope and review gates. The v02 selection covered these two actions. The subsequent owner continuation produced the ten new proposals in `MASCOT_ROUND_02_REVIEW.md`; those images await their own selection before tracing. The full stage remains in progress.
