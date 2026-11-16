# Version 3.2.1 verification

**The actual three-component plugin update is compiled and installed.** Final checks completed on 2026-11-16 in Windows ZBrush **2023.2.1**. The supplied original ZTL works with its migrated bank. The owner's saved document and settings are restored, desktop control is released, and ZBrush remained open after the control client closed.

## Correction and compatibility

ZBrush can expose the first SubTool under the ZTL filename stem, removing its visible `CB...G..._` marker. Data v9 appends native ID/group records to the v8 prefix. An unmarked first SubTool is accepted only when its name matches the Tool basename and its native ID has one supported visibility group after accounting for explicitly marked peers. Valid name markers remain authoritative. Unknown, foreign, malformed and ambiguous identity is rejected; no list-position fallback was added.

IDs occupy two 16-bit halves, avoiding single-float rounding for large unsigned 32-bit values. Camera Bank, Render and ID use the same reader. Banks are **30,772 float cells / 123,088 bytes**. Older binaries do not read v9.

Tracked v8 banks acquire IDs when imported on their matching marked Tool in Edit mode; export the migrated bank afterward. A v8 bank alone cannot resolve an already missing first marker. Untracked old banks still need reviewed updates on their original unmerged Tool. See [DATA_FORMAT.md](DATA_FORMAT.md) and [MERGE_HANDOFF.md](MERGE_HANDOFF.md).

## Automated checks

From `Development`:

```text
python -m unittest -v verify verify_merge verify_camera_320 test_render_layout test_id_export test_installer test_uninstaller test_ztl_identity
```

**114 tests passed in 150.279 seconds.** The final log is retained privately in `.cache/zbrush-321/final-tests.txt`. No production source changed after that passing run; the continuation changed release documentation, evidence and private native harnesses only. Source hashes were verified against the native compilation receipts before final packaging.

The 12 new identity tests cover arbitrary filenames, reordered first meshes, repeated IDs with equal/different visibility, subtraction of marked peers, ambiguous deletions, IDs above float precision through 4294967295, invalid/foreign/missing markers, store after filename changes, v8 migration, malformed ID-table rejection and both shared capture readers. Existing coverage includes camera/visibility transactions, 1,000 SubTools, export failures, render layout, ID preparation/recovery and installer preservation. These are modeled host tests, not native stress tests.

## Native results

| Check | Observed result |
| --- | --- |
| New v9 bank | DemoHead with a duplicated mesh; three views including gray camera 03. Native Duplicate produced distinct IDs 6806552, 7993886 and 3372108. |
| Arbitrary ZTL name | Saved as `my new.project.ztl`, recalled, reopened and imported v9. All three before/after exported PNG pairs are byte-identical; visibility matches. |
| Supplied original case | Migrated v8 on the matching marked Tool, then loaded original `a.ztl` unchanged. All five camera dimensions and visibility sets pass. |
| Render reader | `RC_CheckBank` and private camera recall passed on the filename-alias fixture. Both PNGs are byte-identical to Camera Bank's outputs. This is reader/recall coverage. |
| Installed ID action | Exact installed ID source compiled; its public button reported 2 cameras / 3 meshes / Colorize ON. Two flat 640 × 480 ID images were inspected; gray camera 03 was omitted. Different duplicated heads have different ID colors. |
| Actual ID backup | Reopened `Recovery/Before_ID_1/my new.project.ztl`. Three SubTools and original metallic surface were present. Actual Camera Bank buttons 01/02 recalled successfully on the filename alias. |
| Public EXPORT BANK | Exported a new `public-v9.zcv`; native read-back success dialog observed. Verified 123,088 bytes, magic 252523, version 9, three ID/group records and retained gray flag. |
| Public IMPORT BANK | Imported that export via the public button; success dialog observed. Camera 02 recalled at 640 × 480 with visibility [hidden, visible, visible]. All persistent bank cells match the exported bank; only active-camera and button-click UI cells changed. |
| Compilation/install | Final exact installed sources compiled into genuine ZSCs. All package sources, installed sources, data-folder binaries and ZStartup root binaries were hash-checked. Identical dependencies were preserved. |
| Startup | On the independent recovery launch, all three public control paths existed before manual source loading and the bank version was 9. |
| Final restoration | Original ZPR/ZBR and bank restored; native flags are width=2122, height=1280, Edit=0 and screen saver=60. RGB/Z intensity 25, Dots and Alpha Off were visually restored. Test cameras are absent from the restored bank. |

The original case's native dimensions and visible counts were 01: 1872 × 1280 / 10; 02: 1564 × 4561 / 10; 03: 710 × 636 / 10; 04: 1872 × 1280 / 8 (shirt/backpack hidden); 05: 1564 × 4561 / 9 (main body hidden). Its migrated bank was copied to `D:/Descargas/a/Recovered/CameraBank25_v3_2_1.zcv`; both original input SHA-256 hashes were unchanged.

| Component | Final native binary size |
| --- | ---: |
| CameraBank25.zsc | 86,544 bytes |
| RenderCapture.zsc | 71,716 bytes |
| GenerateExportID.zsc | 86,420 bytes |

Exact final hashes are in `manifest.json`. Curated DemoHead images and a machine-readable evidence summary are in `Verification/v3.2.1/`. Native scripts, private banks, model backups and raw captures stay outside the distribution.

## Session handling and limits

ZBrush was already closed when this continuation began. Launching through Windows-MCP exposed a client lifecycle issue: client shutdown terminated its launched ZBrush child, once before test loading and once after the first document restoration. The saved original and QA files remained intact. ZBrush was then launched independently of the client, the saved owner state was restored again, and the client was released/closed. A process check confirmed ZBrush was still running and responding afterward. This was a control-client issue; the installer itself never closes an application. Future control sessions must use an independently launched app, as documented in the project's CONTROL.md.

The 3.2.1 Render check does not repeat the full BPR/non-BPR phase-order acceptance run. [3.2.0 verification](VERIFICATION_3.2.0.md) retains that historical evidence within its original scope. Repeated native IDs and very large IDs are covered offline; the native duplicated meshes had distinct IDs. Other host versions, arbitrary MergeVisible ancestry, every interruption point and production-scale scenes are not certified. Owner visual acceptance remains separate. No new agent, commit or push was performed.

## Delivery checks

All 61 ZIP entries were read back and checked against the release allowlist; each manifest file size and SHA-256 matches the package and archived bytes. No private model, bank, runtime capture, Recovery folder, cache or credentials file is included. All 44 local links in the changed reports resolve. Four changed Workspace tabs passed at 1440, 768 and 390 px in dark/light themes, with working image preview/download/close controls, a valid ZIP response and no page errors. Representative desktop/mobile screenshots were visually reviewed.

The repository-wide `node scripts/check-template.mjs` check fails its existing starter-card assertion: it expects four sample cards, while both HEAD and the current registry contain zero. Unrelated card entries are unchanged. This does not affect the targeted release, archive or preview checks above.
