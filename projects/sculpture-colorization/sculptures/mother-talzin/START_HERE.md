# Mother Talzin — production handoff

User-requested three-crop pass: 35/35 crops generated and 35/35 agent-selected. Views 02–04 use three crops each. 14/14 views assembled in Photoshop, saved as editable PSDs, reopened and verified with 0 render differences. User acceptance remains pending.

Current action: **Review all fourteen finished views with the user; user acceptance is pending. Preserve the editable PSDs, PNGs and source passes.**

Read `BRIEF.md`, `project.json`, `work/batch.json`, parent directives and generation policy before continuing. Finished Composite 01 remains the read-only appearance master. Original target PSDs control geometry and camera; all source and reference hashes are recorded.

The user requested about three crops for complete sculptures. Views 02–04 now have revised plans `work/crop-plans/<view>-v002.json`, with boundaries y1450/y2450, 192 px overlap and source-mask-based margin reduction. Earlier plans and outputs remain preserved. The remaining views keep size/detail-dependent plans, generally three crops, or one uninterrupted close portrait.

Native deliverables: `outputs/photoshop/mother-talzin-<view>-colorized-<version>.psd` and `outputs/review/mother-talzin-<view>-colorized-<version>-sRGB.png`. View 12 uses v002 after a lateral-hand geometry repair; other views use v001. Per-view native layer/mask audits, original hashes, file hashes, placement records and measured disk-reopen render differences are in `work/assembly/`. Final review PNGs are natively exported with embedded sRGB for browser display; this profile conversion is separate from the zero-difference native reopen check. The original source data is retained in hidden Smart Objects and an unchanged reference layer. Agent review does not imply user acceptance.

Actual model and quality are not exposed by native ChatGPT image generation. Private receipts are in ignored `.mrmak/sculpture-colorization/jobs/`, named `mother-talzin-pass002-*`. Inspect existing receipts before resubmitting. Resume completed generations; do not duplicate them.

Only agent-reviewed generated outputs count toward readiness. Source extraction is separate. Do not start Photoshop assembly before the entire batch passes. No application restart is authorized.
