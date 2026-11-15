# ZBrush plugins — 3.2.0

Authoritative source: [Plugin de zbrush](Plugin%20de%20zbrush/). The source is committed in this repository; D:/Descargas is no longer the source location.

The three components are integrated:

- **Camera Bank 25:** store/update automatically captures effective visibility and maintains SubTool-name markers. There is no PREPARE TRANSFER button. Reordering and compatible merges resolve those names. EXPORT BANK writes independently of Edit mode and verifies the saved bytes.
- **Render Capture:** non-BPR PNGs and all seven BPR PSD maps share each camera folder. Screenshots copies and collision protection remain.
- **Generar y exportar ID:** one action for every enabled Camera Bank view, preparing Flat Color, Auto Groups and Polypaint From Polygroups once per required mesh, then exporting ID.png. A uniquely named recovery folder preserves the first SubTool's exact marked ZTL filename. Colorize remains enabled on processed meshes.

All three final sources compiled and are installed in ZBrush 2023.2.1. Camera store/name tracking, actual reorder and compatible MergeDown, public bank export/import, both render phase orders, ID color/Colorize behavior, collision protection, exact-name backup reopening and standalone ID folder creation passed native checks. The 100-test integrated suite passed; six installer/uninstaller checks passed after the loaded-DLL fix, covering 102 distinct scenarios in total. [Verification and limits](Plugin%20de%20zbrush/Development/VERIFICATION_3.2.0.md) distinguish mock checks, native execution and owner acceptance. No restart was used to test automatic startup.

## Use and data contract

Run `Plugin de zbrush/INSTALAR.cmd` for all three components, or use an individual component launcher. Installation backs up replaced files and retires incompatible plugin and loader binaries. It does not close or restart ZBrush. Load Camera Bank before the other components; the package README describes source loaders and compilation.

Data remains **v8, 111,084 bytes**. Save the matching model after the latest store/update and export its bank. When saving a ZTL, retain the first SubTool's complete marker in the filename stem; ZBrush Save As can rename that SubTool. A ZPR project can use an arbitrary filename. Merge only parts with identical visibility in every occupied camera, including gray ones, and preserve a compatible marker. Unknown or ambiguous names are rejected without a position-based guess.

Legacy untracked banks need reviewed UPDATE ACTIVE operations on the original unmerged Tool. Their missing history cannot be reconstructed after arbitrary merges. ID changes actual PolyGroups, RGB, assigned materials and masks; its recovery ZTL restores the original mesh data. Run it after the other surface passes or reopen that backup before returning to the original materials.

- [Data format](Plugin%20de%20zbrush/Development/DATA_FORMAT.md)
- [Model/bank handoff contract](Plugin%20de%20zbrush/Development/MERGE_HANDOFF.md)
- [Native acceptance checklist](Plugin%20de%20zbrush/Development/NATIVE_TEST.md)
- [Native control route](CONTROL.md)
- [3.2.0 coordination](ORCHESTRATION_3.2.0.md)
- [Video analysis before the ID handoff](VIDEO_ANALYSIS_3.2.0.md)
- [Camera worker handoff](HANDOFF_CAMERA_3.2.0.md), [Render worker handoff](HANDOFF_RENDER_3.2.0.md), [ID worker handoff](HANDOFF_ID_3.2.0.md)

The existing Workspace card is `workspace/2026-11-13_zbrush-plugins/`. Native session backups and transient test scripts are under ignored `.cache/zbrush-320/`; worker receipts/transcripts remain under ignored `.mrmak/`. They are not distributable source. Historical 3.0.3 native results remain in Development/VERIFICATION.md and the card's earlier reports. No push is authorized, and applications/worker tabs stay open unless the owner permits otherwise.
