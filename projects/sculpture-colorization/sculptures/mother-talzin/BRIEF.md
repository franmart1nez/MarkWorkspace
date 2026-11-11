# Mother Talzin — production brief

Production started November 8, 2026 under the user's request to begin this sculpture.

The supplied finished master is `inputs/reference-composite-01/061126 SW3D - Mother Talzin Sculpt Image 001.jpg`: 3240 × 4050, RGB 8-bit, embedded sRGB IEC61966-2.1. Its exact SHA-256 and preview are in `project.json#/appearanceMaster` and `work/source-inventory-v001.json`. It remains read-only.

The fourteen remaining views are **02–15**, each at `inputs/composites-psd/<view>/Composite.psd`, 3240 × 4050, RGB 8-bit without embedded ICC. Each has AO, Depth, Double, ID, Mask, Metal, Normal, Shade, Shadows, SSS and ZDocument passes. All 168 original PSDs were hashed and rechecked unchanged.

The master controls the vivid red robe, burgundy recesses, pale face and dark makeup, lime/cyan magic, undead flesh and faded red clothing, and dark teal temple with aged bronze trim. Each target's own source controls geometry, camera, sculpted detail and part placement. Preserve the target's black background; exclude the master's promotional labels and teal backdrop.

Selected shared quality references: `Phantom of the Opera (3).png` and `Exogorth Diorama (13).png`. They guide skin/surface detail and material separation, never geometry or palette. Their exact roles and hashes are recorded in the manifest and crop plans.

The revised batch contains **35 direct source crops** with source-derived masks. Exact source/paste rectangles, 192 px overlaps where applicable, hashes and per-view rationale are in `work/crop-plans/`. All source-mask foreground is covered. At the user's request, views 02–04 use three crops with empty side margins excluded; 07–09 use one uninterrupted close portrait; 13 uses two; the others use three horizontal regions.

Native ChatGPT generation is authorized by the production request. No numerical spending cap or output limit was supplied; no separately billed API or Magnific operation was used. Requested preference: GPT Image 2.6 Sunburst / max, with the existing preauthorized fallback. Actual native tool model and quality are **not exposed**. Prompt words do not establish backend settings.

All 35 required crops have been generated and agent-selected after source, appearance and overlap review. The current pass used 40 generations, retaining five rejected takes and their reasons. Historical view 02 C01/C02 v001 are retained separately, superseded by the three-crop pass. Exact prompts, actual native dimensions and hashes remain in the crop plans. The native tool exposes neither model nor quality settings. User acceptance is pending.

The complete crop batch passed its review gate before native assembly. The user opened Photoshop on request. Each view is assembled sequentially on the original canvas using Smart Objects, source-derived editable masks and native overlap ramps, with hidden source passes and the unchanged original composite. Uniform size reconciliation is recorded; no warping or manual color/lighting correction is used. `work/batch.json` records current assembly progress; `work/assembly/` holds layer/mask audits and measured disk-reopen pixel comparisons. Deliverables are under `outputs/photoshop/` and `outputs/review/`.

Native montage found a lateral-hand failure in view 12 C03 v001. Its lower source region was re-extracted at exact 3:1 (3240 × 1080, y2970), retaining three crops and 226 px source overlap. C03 v002 and PSD v002 replace the rejected takes. All native reopened renders remain identical to pre-save renders; final review PNGs use native sRGB profile conversion and embedded ICC for browser viewing.
