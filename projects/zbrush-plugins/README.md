# ZBrush plugins - 3.2.3

**Exportar ID** now exports manually prepared colors/textures without generating RGB, PolyGroups, materials or masks. **Generar y exportar ID** keeps its existing generation behavior. See [3.2.3 verification](Plugin%20de%20zbrush/Development/VERIFICATION_3.2.3.md).

Render and ID reuse ZPass_1, notify matching-file overwrites before processing, and restore original per-SubTool Colorize flags. ID no longer saves an automatic Tool backup. Camera Bank and the v9 data format are unchanged.

The authoritative package is [Plugin de zbrush](Plugin%20de%20zbrush/). See [3.2.2 verification](Plugin%20de%20zbrush/Development/VERIFICATION_3.2.2.md). 104 automated tests passed. The older acceptance record below describes 3.2.1; its backup behavior is superseded.

## Historical 3.2.1 acceptance


**Camera Bank 25, Render Capture and Generar y exportar ID are compiled and installed in ZBrush 2023.2.1.** This update fixes the first-SubTool identifier failure caused by saving/loading a ZTL with a different filename. The authoritative package is [Plugin de zbrush](Plugin%20de%20zbrush/).

New banks store native mesh IDs alongside the existing name markers. A matching model/bank pair can use an arbitrary ZTL filename when the first SubTool's identity is unambiguous. The reader is shared by all three components. Other SubTools retain their markers; unknown or ambiguous identity is rejected without a positional guess. IDs use two 16-bit halves to preserve unsigned 32-bit values exactly.

Data is now **v9, 123,088 bytes**. Update all three components together; older binaries cannot read v9 banks. Store/update cameras, save the matching ZTL/ZPR after the latest change, then export the bank. Compatible merges still require equal visibility in every occupied camera, including gray ones, and a retained marker. Store/update refreshes the ID inventory after supported edits.

## Existing banks

Tracked v8 banks migrate when imported on their matching marked Tool in Edit mode. Export a new bank afterward. If the first marker is already lost, use the matching marked ZTL/ZPR once for migration. Old banks do not contain enough evidence to identify that missing marker by themselves. Untracked legacy banks retain their reviewed UPDATE ACTIVE workflow on the original unmerged Tool.

The supplied bank was migrated and all five views passed on the **original, unchanged `a.ztl`**. Its delivered copy is `D:/Descargas/a/Recovered/CameraBank25_v3_2_1.zcv`. Both original inputs are unchanged.

## Installation and verification

Run `Plugin de zbrush/INSTALAR.cmd` for all components, or use an individual launcher. The installer backs up replacements, skips identical DLLs and promotes genuine compiled ZSCs to ZStartup. It does not close applications. The exact installed sources were compiled natively; final source and binary hashes match the package. All three controls also loaded automatically on the recovery launch.

**114 automated tests passed.** Native checks covered arbitrary-name Save As/reopen with three byte-identical camera image pairs, the original five-camera case, Render reader recall, the installed ID action, ID backup reopening, and public v9 export/import. The owner's saved document/settings were restored, desktop control released, and ZBrush remained open after the client closed. The control-client launch/cleanup incident and exact limits are recorded in [3.2.1 verification](Plugin%20de%20zbrush/Development/VERIFICATION_3.2.1.md).

Render still writes non-BPR PNGs and seven BPR PSD maps into the same camera folders. ID still changes mesh PolyGroups, RGB, materials and masks; run it after surface passes or reopen its recovery ZTL. Full render phase-order acceptance remains the historical 3.2.0 evidence, not a new 3.2.1 full-render run.

- [Data format](Plugin%20de%20zbrush/Development/DATA_FORMAT.md)
- [Model/bank contract](Plugin%20de%20zbrush/Development/MERGE_HANDOFF.md)
- [Native control and launch isolation](CONTROL.md)
- [Historical 3.2.0 verification](Plugin%20de%20zbrush/Development/VERIFICATION_3.2.0.md)
- [3.2.0 coordination](ORCHESTRATION_3.2.0.md) and [video analysis](VIDEO_ANALYSIS_3.2.0.md)

The existing Workspace card is `workspace/2026-11-13_zbrush-plugins/`. Private native fixtures, scripts, logs and session backups remain in ignored `.cache/zbrush-321/`; historical worker receipts remain in ignored `.mrmak/`. No new worker, commit or push was used for this correction.
