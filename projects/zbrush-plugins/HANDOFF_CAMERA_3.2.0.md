# Camera Bank 3.2.0 worker

Implement the Camera Bank changes in `Version 3.2.0.txt` together, on your assigned worktree branch. Source baseline: `1d3ebe2`; sources are now in `projects/zbrush-plugins/Plugin de zbrush`, never D:/Descargas. Read root AGENTS.md, project README.md/CONTROL.md, the existing Development data/merge documentation, and `.agents/skills/feature-handoff/SKILL.md`.

## Execution and ownership

This is a visible Codex worker: agent `codex`, exact model `gpt-6.1sol`, effort `xhigh`, worktree enabled. Do not substitute settings, launch workers, push, merge, rebase, close/restart applications, or control ZBrush. The orchestrator holds ZBrush exclusively until an explicit handover. Native testing comes after source review; report required probes and blockers without claiming native validation.

Own Camera Bank/CameraBank25.txt and Development/build_camera.py, build_visibility.py, camera_reader.inc, merge_visibility.inc, merge_visibility_writer.inc, verify.py, verify_merge.py, DATA_FORMAT.md and MERGE_HANDOFF.md. You may add camera-specific tests and a CAMERA_3.2.0_RESULT.md. Do not change render_body.txt, RenderCapture.txt, build_all.py, installer/uninstaller/launchers, manifest.json, README files, workspace registry/card, or another worker's files. Generated RenderCapture.txt may change locally when building; do not commit it. The orchestrator regenerates it after merging the shared camera reader.

## Required behavior

- Remove the PREPARE TRANSFER button and the need for a separate manual preparation step. Store/update must automatically capture effective visible/hidden SubTools for each camera, including gray occupied cameras.
- Match SubTools by names/identifiers rather than current list position, so reordering and supported compatible merges preserve camera visibility. Avoid positional guessing for ambiguous/missing identities. Explain the precise contract for duplicate names, renamed parts, added/deleted parts and native merge names. Preserve prior compatible-merge requirements when feasible, without forcing extra user buttons. Do not silently corrupt geometry or overwrite the user's original files.
- Diagnose and fix EXPORT BANK, with a regression reproducing the actual failure if discoverable. A normal export after storing cameras must write a usable file, cancellation must preserve data, and import/export must round-trip all occupied cameras. Handle file errors honestly.
- Keep Camera Bank and the generated shared reader consistent. Migrate old bank versions safely; do not invent ancestry that old data does not contain. Preserve dimensions, lens, transforms, render flags, folder/Solo effective visibility, recovery and 1000-SubTool capacity.
- Set new source version to 3.2.0. Change data version only if needed; document migration and expose the final schema to the orchestrator.

## Validation and delivery

Run the appropriate source generator and meaningful mock regressions. Extend tests for reorder/name identity, duplicate/renamed/missing SubTools, multiple cameras including gray, automatic store/update tracking, real export content/cancel/error, legacy migration and compatible merge. These tests are not native compilation.

Review selected files for credentials/personal/runtime data before committing. Commit only your owned sources/tests/docs on your assigned branch. Provide commit hash, exact changed paths, reproducible test commands/results, remaining risks, and a short native acceptance sequence. Keep session IDs/transcripts out of Git. When delivered, stay available in this same worker for corrections.
