# Render Capture 3.2.0 worker

Implement the output-layout change in `Version 3.2.0.txt` on your assigned worktree branch. Source baseline: `1d3ebe2`; authoritative package: `projects/zbrush-plugins/Plugin de zbrush`, never D:/Descargas. Read root AGENTS.md, project README.md/CONTROL.md and `.agents/skills/feature-handoff/SKILL.md`.

## Execution and ownership

Visible Codex worker: agent `codex`, exact model `gpt-6.1-sol` (owner correction), effort `xhigh`, worktree enabled. Do not substitute settings, launch workers, push, merge/rebase, close/restart applications, or control ZBrush. The orchestrator holds ZBrush exclusively until explicit handover.

Own Development/render_body.txt, Render Capture/RenderCapture.txt, new Development/test_render_layout.py and Development/RENDER_3.2.0_RESULT.md. The camera worker owns camera_reader.inc and verify.py; do not commit edits to those. Do not edit build_all.py, installer/uninstaller/launchers, manifest.json, README files or Workspace. After merging, the orchestrator regenerates RenderCapture.txt with the new camera reader. Add focused tests without changing another worker's test infrastructure; flag any old tests needing adjustment.

## Required behavior

Both BPR and non-BPR outputs must be directly in the SAME camera subfolder: `ZPass_N/01/Z document.png`, `Normal.png`, `Double.png`, `Metal.png`, `_AO.psd`, `_Composite.psd`, `_Depth.psd`, `_Mask.psd`, `_Render.psd`, `_Shadow.psd`, `_SSS.psd`. Current camera names are the bank's displayed 01..25 labels; verify in source before implementation. Do not add a separate camera-renaming feature. No NonBPR/BPR child directories should be created.

Preserve Screenshots/01.png byte copies, disabled-camera omission, new-session numbering, collision protection, phase independence (BPR can follow non-BPR and vice versa), recovery, native PSD/PNG behavior and all render quality/material settings. Set the render source header to 3.2.0. Do not make unrelated rendering changes.

## Acceptance and delivery

Test both phase orders with both sets coexisting, same-phase rerun collisions preserving files, camera isolation and disabled cameras, Screenshots copies and new-session folders. Use the actual source routines/mock host where practical; do not rely only on string assertions. Run existing relevant regressions and explain integration failures caused by the changed contract.

Before committing inspect selected files for personal/runtime data. Commit only owned sources/tests/docs. Deliver commit hash, changed paths, test results and a concise native test plan. Distinguish offline validation from native ZBrush results. Stay available in the same worker for corrections.
