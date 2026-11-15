# ZBrush plugins

Current source revision: **3.1.0 / bank data v8**, 2026-11-14. No new native
compilation, renderer execution or desktop control was performed.

- Camera Bank prepares ZTL/ZPR name markers for effective-visibility groups.
  Compatible merges and reordering use those markers, not the original list count.
- User selected native merges with short SubTool-name identifiers. The native
  result must preserve a compatible marker. The same-visibility rule applies to
  all occupied cameras, including gray ones. Arbitrary native ancestry is not inferred.
- PREPARE TRANSFER, save the ZTL/ZPR, EXPORT BANK, send both. Export auto-prepares
  when needed. Edits after preparation regenerate matching markers; save both again.
- Legacy v1-7 imports require a reviewed UPDATE ACTIVE for every occupied view on
  the original unmerged Tool before preparing. Unmarked merged history is unknown.
- Both plugins require the updated sources/schema. No current ZSC is included.
  The installer supplies ZFileUtils for both and backs up/retires stale binaries.
- 32 logic scenarios, two installer fixtures and a 1,000-SubTool mock smoke pass.
  Actual native name behavior, geometry/framing and visual output remain pending.
- Previous BPR settings and numbered Screenshots copies are retained.
- Deliverable: `D:/Descargas/Plugin de zbrush/`. Workflow/limits:
  `Development/MERGE_HANDOFF.md`; format: `Development/DATA_FORMAT.md`.
- Existing card: `workspace/2026-11-13_zbrush-plugins/PROJECT.md`.
- Backups: workspace `.cache/zbrush-306/` (outside Git and download).

## Historical native baseline

Baseline **3.0.3** was natively verified on 2026-11-13. The installed pair
was subsequently removed at the owner's request; it is ready to reinstall.

- Deliverable: `D:/Descargas/Plugin de zbrush/` (editable sources, unchanged Camera Bank ZSC,
  installer/uninstaller, Verification and local Recovery backups).
- Card: `workspace/2026-11-13_zbrush-plugins/PROJECT.md`.
- Evidence: package `Development/VERIFICATION.md`; historical native outputs in `Verification/v3.0.3`.
- The owner's two crash logs ended at Light:Save. Removed Light:Save/Load;
  light-2 on/SSS settings now recover from session memory. Light 2 stays selected.
- Camera redraw was intercepted by Thumbnail. It is now hidden temporarily;
  LightBox closes and Edit is validated before restoring the transform.
- Final buttons tested: STORE NEW -> 03; warning and no save for 04 outside Edit;
  public BPR callback. Across QA: 42 PSDs, 8 PNGs, four sizes up to 2604 x 3818,
  DemoHead with two SubTools and a copy of the recovered one-SubTool project.
- Thirteen logic scenarios and installer/uninstaller fixtures pass. PSD payloads,
  dimensions, native 16-bit Depth, decoded PNGs and visual previews verified.
- Removed 11 package files and current-session controls/loaders/test bank.
  Stock Maxon plugin hashes unchanged. Backups:
  `Recovery/Uninstalled-20261113-190822-295` and `Recovery/before-3.0.3`.
- Source package retained. Run INSTALAR.cmd for the fresh install. No app restart
  occurred. ZBrush was closed at task start and launched once for verification.
- Prior personal project/bank backups remain in Recovery. Do not delete those
  or treat the QA bank as the owner's production camera set.
- Runtime scripts/logs: `.cache/zbrush-fix-303/`; previous QA in
  `.cache/zbrush-native/`. See CONTROL.md for the local Windows-MCP connection.

Other versions, large production scenes and every interruption point were not
stress tested. Data v7 is unchanged; older records with missing dimensions need
UPDATE ACTIVE. Do not restart active applications without permission.
