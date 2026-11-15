# Version 3.2.0 verification

**The three plugins are integrated, compiled and installed.** Selected native checks passed in Windows ZBrush **2023.2.1**. The owner's original document was restored and desktop control released. No application or worker tab was closed/restarted, and no push was performed.

## Source review and automated checks

Three visible Codex workers used `gpt-6.1-sol`, `xhigh`, and separate Git worktrees through `scripts/agent-control.mjs`. The orchestrator reviewed their changes, returned native findings to the same sessions and merged the branches locally. Only the orchestrator controlled ZBrush.

| Component | Reviewed worker commits |
| --- | --- |
| Camera Bank | 531b5fe, 51bf15a, afeb8a1, 175d322 |
| Render Capture | f7c0702 |
| Generate and Export ID | 348e8d9, 03dd1a0, 48a0e57, 6a2b924, 75eb820, 556be02, 8c5e4d3 |

The orchestrator owns installer/build integration, final metadata, documentation, evidence and packaging. Worker reports describe their delivery checkpoints; this file records the integrated result.

From `Development`:

```text
python -m unittest -v verify verify_merge verify_camera_320 test_render_layout test_id_export test_installer test_uninstaller
```

**100 integrated tests passed in 148.752 seconds.** After a real repeat-install exposed a loaded-DLL lock, the installer/uninstaller suite was rerun: **six tests passed**, including two new lock/rollback regressions. That is 102 distinct scenarios across the final checks, with four installer cases shared between the two runs. The final real reinstall also passed while ZBrush remained open.

Coverage includes automatic identifiers, reordered/duplicate/renamed/missing names, all 25 cameras including gray flags, 1,000 SubTools, legacy migration, compatible merge logic, rollback/interruption, export round trips and failures, both render orders/collisions, ID union preparation/material-only fill/Colorize, output and backup failures, maximum path/message lengths, and installer/uninstaller preservation. Mock rendering and modeled backup reopening are not native evidence.

Native testing found and corrected parser/API differences missed by the original mocks: inline ASCII/string lookups in conditions, one-input and compound-number StrMerge conversion, underscore-containing generated variable names, uninitialized MemRead outputs, the real Draw Polyframe path and nested ToolSetPath calls. The final production sources contain no diagnostic tracing.

## Native results

Disposable DemoHead, two original SubTools, enabled cameras 01/02 and gray occupied camera 03. Dimensions: 640 x 480 and 480 x 640. Sources were loaded from the actual installed data folders and produced genuine ZSC files; source/binary/dependency hashes were checked against the package.

| Check | Result |
| --- | --- |
| Automatic tracking | First store and later stores create/refresh name identifiers; no PREPARE TRANSFER control. Three cameras retained, including the gray view. |
| Actual MoveUp reorder | Both cameras retain visible geometry and framing. Camera 02 is byte-identical. Camera 01 has native inactive-SubTool material dimming after active selection changes; this is not a pixel-equality claim. |
| Actual compatible MergeDown | A same-visibility duplicate was merged: 3 SubTools became 2. The surviving names passed strict matching and both cameras recalled/exported successfully. No incompatible merge is claimed as supported. |
| Public EXPORT BANK | Wrote and read-back verified 111,084 bytes: magic 252523, data v8, occupied 01/02/03, enabled 01/02. |
| Public IMPORT BANK | Imported that exported bank successfully; subsequent capture retained the stored cameras and flags. |
| ZTL naming | Saving to a different basename can rename the first SubTool and remove its marker. Saving with its marked default stem preserves it. A separate ZPR filename preserved markers and subsequent recall. |
| Both render phase orders | 48 valid files across two sessions: 16 pass PNGs, four identical Screenshots copies and 28 native PSDs. Each camera folder directly contains both pass sets; no BPR/NonBPR or gray-camera subfolder. |
| Native payloads | PNGs decoded; dimensions matched. All seven PSD maps per camera had valid headers and complete uncompressed payloads. Depth remained 16-bit; other maps 8-bit. |
| ID with existing render session | Two flat ID.png files generated in the same camera folders; all 48 preexisting render hashes remained unchanged. Surface colors were consistent between views. |
| Final installed ID, standalone | Its sole public button opened the native folder chooser, created ZPass_1 and exported two valid ID PNGs without CREATE FOLDERS. The shared head color was RGB 18/236/236 in both views; hidden eye geometry was absent from camera 02. |
| Colorize / completion | Native flags recorded two processed SubTools, both Colorize=1, and recovery phase=0 after success. |
| Collision protection | A repeated public ID action rejected existing outputs before processing; both ID hashes stayed unchanged. |
| Actual backup reopening | The pre-ID ZTL reopened with original surface treatment, strict name matching and both camera recalls passing. Backup lives in a new Recovery/Before_ID_N folder with the exact first-SubTool filename. |
| Installation | All three loader bodies loaded their installed sources; ZSC/source/DLL hashes matched. Reinstall skipped the loaded identical DLL and promoted all three binaries without closing ZBrush. |
| Owner restoration | Original ZPR/ZBR restored; width=2122, height=1280, Edit=0, screen-saver timer=60 seconds. Observed RGB/Z intensity, stroke and alpha restored; test camera count=0. |

Curated images and native hashes are in `Verification/v3.2.0/` and the existing Workspace card. Raw test outputs/scripts and original-session backups remain in ignored `.cache/zbrush-320/native/`. Private worker receipts/transcripts remain in ignored `.mrmak/`; they are excluded from the ZIP.

## Limits and practical contract

Visibility identifiers are equal-visibility classes across every occupied camera, including gray ones. Native merges must retain a compatible marker. Arbitrary discarded ancestry cannot be recovered; unknown/ambiguous names are rejected. Old untracked banks require reviewed updates on their original unmerged Tool.

For ZTL, preserve the first SubTool's complete CB marker in the filename stem; use another folder or an arbitrarily named ZPR project. ID intentionally changes PolyGroups, RGB, assigned materials and masks of required meshes. Its backup recovers mesh data; display recovery is not an undo. Run ID after other surface passes or reopen the backup before returning to the original treatment.

Native checks cover the stated version, fixtures and selected flows. The 1,000-SubTool check and many interruption/failure cases are offline simulations, not production-scale native stress tests. Other ZBrush versions and arbitrary MergeVisible ancestry are not certified. Startup binaries are installed, but a new application launch was not exercised because the owner prohibited restarts without permission. Owner aesthetic acceptance remains separate.
