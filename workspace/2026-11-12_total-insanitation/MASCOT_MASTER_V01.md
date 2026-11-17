# Wizard mascot / first master review

**Historical vector v01 · not accepted for finish quality.** The owner liked SVG delivery and the background/size presentation, but rejected the contour quality compared with the original greeting JPG. Follow the current [ChatGPT action review](MASCOT_IMAGE_REVIEW.md): generate from the original, obtain owner selection, then faithfully trace the selected raster images into SVG and repeat presentation checks. The material below records the earlier proposal; its geometry and usage rules are not approved. Stage 3 remains completed; stage 4 remains in progress.

Start with the **Mascot** category in Art bible: master sheet, application sheet, readability sheet and unchanged native context. **Signage & UI** also links the application study. The six original prototypes remain in their existing entries and source folder.

## What this proposal preserves

The greeting prototype is the primary identity reference: a simple faceless figure, round head, bent pointed hat, broad brim, rounded limbs and orb staff with a four-point negative-space sparkle. The other five prototypes supply action ideas. The detailed electrical skeleton, melting illustration and different staff terminals are not treated as alternate approved masters.

This v01 is manually authored vector geometry, not an automatic image trace or an AI-generated replacement. It proposes a single construction system while retaining the original's recognizable silhouette. The ground line is removed from the reusable character; ground/water cues belong to an individual scene or action.

## Concrete review material

- [Master sheet](media/mascot-v01/master-sheet-v01.png): primary reference beside the proposed master and proportions.
- [Three applications](media/mascot-v01/applications-v01.png): direction, cleaning instruction and wet-floor hazard. Supporting action studies are first-review prototypes, not approved production poses.
- [Readability and alpha](media/mascot-v01/readability-v01.png): full/compact versions at 32, 48, 64, 96 and 128 px, plus light/dark/yellow backgrounds. Open at 100% for the stated sizes.
- [Native context pairing](media/mascot-v01/context-v01.png): unmodified stage-3 janitor room and Basement shop captures beside the draft. No sign placement, lighting correction or Unreal implementation is claimed.
- [Editable package](sources/mascot-v01.zip): SVG sources, transparent PNGs, specification, manifest and review sheets.

The individual [full master SVG](sources/mascot-v01/wizard-mascot-v01.svg) and [compact SVG](sources/mascot-v01/wizard-mascot-v01-compact.svg) remain editable. PNG exports are available at 512 and 1024 square pixels, in black and white ink, with real transparency. See the manifest for all filenames. The SVG presentation sheets retain editable sign text; the PNG sheets are review renders.

## Proposed construction and usage

The square viewbox is `-100 0 800 800`. Head diameter **H = 110 units**. The brim is 178 units wide (1.62 H), torso width 70 units (0.64 H), arm weight 32 units (0.29 H), leg weight 41 units and staff shaft 14 units (0.13 H). These are new proposed construction values, not owner-confirmed measurements of the original.

Keep a round featureless head, the same bent crown and brim, no added beard/costume/face, rounded limb ends and the same orb staff. The full greeting uses three raised fingers plus a thumb; the compact hand is a simple palm. Feet use rounded toe shapes. Grip and orb cutouts are transparent, not white paint. Use a solid ink silhouette without an extra outer outline.

Allow at least **0.5 H (55 units)** around the ink bounds. The current greeting export meets that margin. Proposed minimum square-canvas sizes are **96 px for full** and **64 px for compact**. At smaller sizes, fine fingers, sparkle and grip separation become unreliable; 32/48 px are diagnostic samples, not approved delivery targets. The compact removes the fingers, hat band, orb sparkle and grip gap. It is an optical treatment of the same silhouette, not a different character.

Staff handling is proposed per action:

- Greeting: held in the screen-right hand.
- Pointing right: the same staff switches to the screen-left support hand; the hat is not mirrored.
- Mopping: staff omitted so both hands can operate the mop clearly.
- Slipping: staff omitted for a clear falling action. The head/hat geometry and limb weights remain shared.

The instruction/sign copy is editable English. Cream/black and yellow/black treatments and Arial fallback typography are provisional application studies. No complete corporate palette, font system, HUD/menu mockup, wear treatment or atlas layout is approved here. No safety-standard or accessibility certification is claimed.

## Editable source and preservation

Canonical source directory:

`D:/GameJam/Total (in)Sanitation/Utility_Materials/TrimSheet&Atlas/General_Atlas/Resources/Pet/Development/Stage4_Master_v01/`

The Workspace `sources/mascot-v01/` copies match the canonical SVG sources. Named groups/symbols contain the head, hat, torso, limbs, staff, hands and review poses. Paths and masks can be edited in an SVG-capable editor. The reproducible [authoring script](../../projects/total-insanitation/scripts/build_mascot_master.py) writes this versioned draft branch; it must not be used to overwrite later hand edits. Keep subsequent revisions as v02, v03, etc., after rereading the current sources.

Original wizard JPGs, the goblin warning source, `General_Atlas.sbs`, native materials, maps and UI remain unchanged. This round makes no native-editor changes and does not import the draft to `/Game/Art/UI`.

**Generation record:** manually authored SVG; deterministic local browser rasterization. Generative provider/model: not applicable. Submissions: **0**. External generation cost: **0**. The exact provider/model/count/cost must still be recorded before any future generative submission; this draft does not authorize one.

## Review decision and next gate

The requested decision is whether this v01 should become the master basis, or what concrete silhouette/proportion/accessory changes it needs. Review the master and all three applications together. The plan requires owner master/style approval before the remaining pose batch.

After that approval, keep the planned twelve slots: neutral/welcome, greeting, point left, point right, mopping, pushing equipment, carrying supplies, explaining instructions, slipping/falling, electrical accident, chemical/acid accident, fleeing fire/magic. Neutral/welcome should use a relaxed free hand and greeting a raised hand so the first two are visibly distinct. These are a pending batch plan, not delivered poses.

Stage 4 stays **in progress** until its approved reusable master, pose set, contact sheet and usage rules are delivered. Stage 5's full graphic-system and real-scene HUD/sign milestone remain pending. Later Basement concepts and asset production retain their own approvals.
