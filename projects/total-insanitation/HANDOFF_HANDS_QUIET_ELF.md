# Handoff: wizard hands and Quiet Please elf (ChatGPT image round)

You are a visible Codex worker. Generate raster images only, with your built-in
ChatGPT image generation tool. Do not edit SVG, Workspace cards, Blender, Unreal or
Designer files. The orchestrator traces, splices and reviews your images.

Read `projects/total-insanitation/AGENTS.md` for art rules. All paths below are
relative to `D:/AI/MarkWorkspace`.

## Folders

- Inputs: `workspace/2026-11-12_total-insanitation/media/hands-quiet-revision/inputs/`
- Save every output PNG to: `workspace/2026-11-12_total-insanitation/media/hands-quiet-revision/generated/`
- Put rejected takes in `generated/rejected/` with a short reason in the log.
- Log: `generated/prompts.json` — one entry per saved image: output name, exact
  prompt, the input images used (as Image 1, Image 2…), and the original path the
  generator returned (under `~/.codex/generated_images/`).

Load each input file with your image-viewing tool before a generation so the
generator receives it as a reference. Name outputs exactly as listed.

## Owner goal

1. The wizard mascot has **four digits per hand: three fingers and one thumb**.
   That stays. The current hands look deformed: thin stick fingers on a tiny palm.
   The owner's reference is the classic four-fingered TV cartoon hand, as in
   *The Simpsons*: a rounded, slightly wide palm; three plump, sausage-like fingers
   of equal thickness with round tips and narrow gaps; a shorter thumb set lower on
   the side of the palm; a gently tapered wrist.
2. On the **Quiet Please** sign, nobody can tell the elf is making the "shh"
   gesture. Redesign the elf so the finger-to-lips gesture reads instantly.

Style for all wizard images: flat solid black silhouette on plain white, smooth
vector-like edges, no outlines, no grey, no shading, no texture, no text, no
fingernails, no knuckle or palm lines. Trace-friendly.

## Phase 1 — do this now, then stop and report

### 1A. Hand design sheet → `hand-sheet-01.png`

Image 1: `inputs/wizard-greeting-v03.png` (style and arm thickness only).

> Create a hand design reference sheet for the wizard mascot in Image 1. Match its
> style exactly: flat solid black silhouette on a plain white background, smooth
> clean edges. Draw six isolated hands in a 3 × 2 grid with generous spacing, each
> attached to a short forearm stub as thick as the wizard's arms in Image 1:
> (1) open palm facing the viewer, fingers together pointing up, a "stop" hand;
> (2) waving hand, fingers slightly spread pointing up; (3) open hand palm up,
> offering, seen from the side; (4) pointing hand, index finger extended, other
> fingers curled, thumb resting on top; (5) fingers spread wide in alarm;
> (6) relaxed hand hanging down. Every hand has exactly four digits: three fingers
> and one thumb, in the manner of classic four-fingered American TV cartoon hands
> such as The Simpsons: a rounded, slightly wide palm, three plump fingers of equal
> thickness with round tips and narrow gaps between them, and a shorter thumb set
> lower on the side of the palm. The hand is about one and a half times as wide as
> the forearm. No fingernails, knuckle lines, outlines, shading, text or labels.

Check before saving: every hand has exactly three fingers plus one thumb, no
fused or extra digits, fingers equal in thickness with round tips, solid black only.
Regenerate up to two times if it fails.

### 1B. Quiet Please elf, three variants

References: Image 1 `inputs/sign-10-quiet-current.png` (the sign, its palette and
the elf to replace); Image 2 `inputs/sign-08-toxic-vapors-current.png` and Image 3
`inputs/sign-09-low-clearance-current.png` (pictogram style of the other fantasy
species signs).

Shared requirements for all three:

> Design a replacement pictogram for the elf in Image 1, a "Quiet please" office
> sign. The character is a fantasy elf office worker from the 1970s: a simple
> rounded head with long pointed ears, a suit jacket with lapels and a tie, cut off
> at the chest with a flat bottom edge like the current elf. Flat single-colour
> artwork in dark green #123F2C on a plain cream #F8E9CC background; interior
> details are cream negative-space shapes. Match the bold, simple pictogram style
> of Images 2 and 3. The "shh" gesture must read instantly even at small size: one
> hand raised, index finger straight up and pressed vertically against the centre
> of the lips, the other fingers curled into a fist below the chin. The finger
> touches the lips only; it does not reach the nose or eyes. A clear thin cream gap
> separates the hand and finger from the face and chin. The arm is short and
> natural, bending up from the elbow, not a long diagonal pole. Four digits on the
> hand are fine. Centre the bust on a square canvas with generous margins. No
> text, no sound waves, no symbols, no border, no sign panel, no gradient.

Variant-specific additions:

- `quiet-elf-a-01.png` — **strict side profile facing right.** The lips sit on the
  profile edge and the raised index finger stands in front of them, so the finger
  silhouette clearly sticks out past the face line. One long pointed ear, closed eye.
- `quiet-elf-b-01.png` — **front view.** The lips are a cream shape visible on
  both sides of the vertical finger; closed, calm eyes; ears pointing out to both
  sides; the fist sits just below the chin.
- `quiet-elf-c-01.png` — **three-quarter view facing right**, eyes closed or
  glancing sideways, lips slightly pursed around the finger as if saying "shh".

Check before saving: the gesture reads as "be quiet" at 128 px; not nose
picking, not a rude gesture, not a thumbs-up. Regenerate up to two times per
variant if it fails.

**After Phase 1, stop and report** the saved file names and anything you
rejected. Wait for the orchestrator's message before Phase 2.

## Phase 2 — only after the orchestrator says continue

Thirteen hand edits. Image 1 is a 1024 px crop of one approved wizard pose; Image 2
is the hand sheet the orchestrator selects. Inputs are in `inputs/crops/`. Each
output: `<input name without .png>-01.png`, for example
`greeting-v03-hand-a-01.png`, square 1024 × 1024, same framing as Image 1.

Shared prompt for every crop:

> Image 1 is a close-up crop of the wizard mascot. Redraw only the hand in Image 1
> using the hand design from Image 2: exactly four digits, three plump fingers of
> equal thickness with round tips and narrow gaps plus a shorter thumb set lower on
> the side of a rounded, slightly wide palm, like classic four-fingered TV cartoon
> hands such as The Simpsons. Keep the hand the same overall size and position and
> joined to the forearm at the same wrist. Keep everything else in Image 1
> pixel-for-pixel unchanged: the forearm, its angle and thickness, every other
> shape, the crop framing and the white background. Flat solid black on white, no
> outlines, shading, nails, knuckle lines or text. [GESTURE]

`[GESTURE]` per crop:

| Input | Gesture |
| --- | --- |
| `greeting-v03-hand-a.png` | Waving hand raised high, palm toward the viewer, fingers slightly spread pointing up, thumb on the right side (toward the head). |
| `neutral-welcome-v03-hand-a.png` | Welcoming open hand extended down to the left, palm up, fingers pointing left, thumb on the upper side. |
| `stop-v01-hand-a.png` | Upright "stop" hand: palm flat toward the viewer, fingers together pointing straight up, thumb on the right side, slightly apart. |
| `explaining-instructions-v03-hand-a.png` | Open hand extended to the left, palm up as if presenting, fingers pointing left, thumb on the upper side pointing up. |
| `point-left-v02-hand-a.png` | Pointing left: index finger straight out to the left, the other two fingers curled into the palm, thumb resting on top. |
| `point-right-v03-hand-a.png` | Pointing right: index finger straight out to the right, the other two fingers curled into the palm, thumb resting on top. |
| `slipping-falling-v04-hand-a.png` | Hand flung upward in alarm, fingers spread pointing up, thumb on the left side. |
| `slipping-falling-v04-hand-b.png` | Arm flung out to the right, fingers spread pointing right, thumb on the upper side. |
| `chemical-accident-v04-hand-a.png` | Hand thrown up in shock, fingers spread pointing up, thumb on the left side. |
| `chemical-accident-v04-hand-b.png` | Hand hanging down to the lower left with fingers spread pointing down, thumb on the right side. |
| `electrical-accident-v04-hand-a.png` | Electrocuted skeleton's raised hand, fingers spread pointing up, thumb on the right side. Keep the white bone forearm and white joint cut-outs exactly; only the black hand changes. |
| `electrical-accident-v04-hand-b.png` | Electrocuted skeleton's raised hand, fingers spread pointing up, thumb on the left side. Keep the white bone forearm and white joint cut-outs exactly; only the black hand changes. |
| `fleeing-fire-magic-v04-hand-a.png` | Hand raised beside the head, palm out, fingers spread pointing up, thumb on the right side. Keep the head and hat unchanged. |

Check each output: exactly three fingers and one thumb, correct thumb side, the
forearm still meets the hand at the same place, nothing else redrawn. Regenerate
up to two times per crop if it fails. Report when all thirteen are saved.

## Outcome (2026-11-20)

Phase 1 and Phase 2 were delivered. The worker rejected all thirteen Phase 2 takes because the generator altered pixels outside the hand. The orchestrator accepted the best take for each crop because only the hand is spliced onto the approved forearm. The front-view elf (`quiet-elf-b-01.png`) was selected. Results and verification: [Hand and Quiet elf revision](../../workspace/2026-11-12_total-insanitation/MASCOT_SIGNAGE_REVISION.md#hand-and-quiet-elf-revision-2026-11-20).

For a future round, ask only for the hand to be redrawn and accept changes outside it. The splice keeps the approved silhouette.
