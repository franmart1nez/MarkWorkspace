# 3.2.2 — fixed output folder and polypaint state

Requested on 2026-11-16. Camera Bank and data v9 are unchanged.

- Removed the pre-ID Tool save, backup-path validation and recovery-file writes. Session display recovery remains. ID still changes mesh RGB, materials, PolyGroups and masks.
- Render and ID choose/reuse ZPass_1. Selecting that directory directly is supported, including trailing separators and case differences. Cached older numbered sessions are rejected. Existing old output folders are not removed.
- Before processing, each enabled camera lists the exact existing files that this action will replace. Only that phase's filenames are replaced; disabled cameras and unrelated files are preserved. Missing numbered camera folders are created inside ZPass_1.
- Z document/BPR respect original per-SubTool Colorize flags. Utility material passes temporarily disable them. ID temporarily enables Colorize for its maps and restores each original flag on success and recovery.

104 automated tests passed in 124.305 seconds:

```text
python -m unittest -q verify verify_merge verify_camera_320 test_render_layout test_id_export test_installer test_uninstaller test_ztl_identity
```

The superseded backup/collision-rejection tests were replaced with reuse, overwrite-notice-before-processing, no-backup and flag-restoration coverage. Camera identity, failure/interruption recovery, installer and other unchanged contracts remain covered. Mock exports are not native image/render acceptance.

Native ZBrush 2023.2.1 compiled the exact Render/ID sources. Focused native checks on 11 SubTools used mixed Colorize states, verified temporary Render disable/reapply, and verified ID_Restore with the success argument. Both recorded zero mismatches. The original flags, active SubTool and transform were restored; no ID mesh generation was run on the open model.

The first automatic QA harness called ID before its top-level arrays had initialized and reported `Missing control: 0`. The harness was changed to an explicit test button after source loading; that native check passed. This was a harness execution-order issue. QA buttons are excluded from the release sources. Private harnesses and receipts are under `.cache/zbrush-322/`.

The native RC_Export routine replaced an existing scratch file with a readable 1238 × 926 PNG (3,445,722 bytes). Both final plugins were installed without restarting ZBrush. Installed source and binary hashes were compared with the release package. The notification order, camera enumeration and repeated multi-pass behavior are covered by the automated tests, not by this single-image native check.

The existing Workspace delivery tab passed 1440, 768 and 390 px checks in dark/light themes, with no page errors. Historical full BPR acceptance and original-ZTL identity evidence remain in the 3.2.0/3.2.1 records. No full new production render batch, application restart, commit or push is claimed.

Overwrites remove the old target immediately before exporting/copying its replacement. An export failure can therefore leave that individual target absent; the other files are not pre-deleted. No render rollback copy is created.
