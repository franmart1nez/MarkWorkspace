# Version 3.2.0 coordination

Source baseline: `1d3ebe2` on the owner's existing branch. Authoritative package: `projects/zbrush-plugins/Plugin de zbrush`. No push is authorized. Applications and worker tabs must remain open; closing or restarting requires the owner's permission.

Three visible worktree workers use `codex` / `gpt-6.1-sol` / `xhigh` (owner-corrected model ID), opened only with `scripts/agent-control.mjs` under the existing scoped grant. Session IDs and transcripts belong under ignored `.mrmak/`, never this record.

| Scope | Owner | Handoff |
| --- | --- | --- |
| Camera tracking, automatic capture, EXPORT BANK and shared camera reader | Camera worker | HANDOFF_CAMERA_3.2.0.md |
| Unified camera output folders | Render worker | HANDOFF_RENDER_3.2.0.md |
| New one-button Generate and Export ID plugin | ID worker, video analysis completed | HANDOFF_ID_3.2.0.md |
| Install/uninstall, launchers, build integration, manifest, README, Workspace, review/merges | Orchestrator | This file |

**ZBrush lease: released after native verification.** No worker received a native lease. Workers may inspect source and installed-file metadata but must not load scripts, change native UI, install into the live app, or automate it until the orchestrator explicitly grants and records exclusive access. Native review followed independent branch review and integration. Never overwrite an unsaved owner project to run QA; stage recoverable test data.

All three worker startups, exact native model/effort and handoff delivery were verified. Their branches are merged locally after independent review. ID reference analysis was completed before its handoff; the owner confirmed export for every enabled camera.

| Delivery | Reviewed commits / current state |
| --- | --- |
| Camera | 531b5fe, 51bf15a, afeb8a1, 175d322; native store/reorder, compatible MergeDown and public bank export/import pass. Native parser findings and the ZTL basename contract are documented. |
| Render | f7c0702; native non-BPR/BPR and reversed phase order pass, 48 files validated with Depth16 and identical Screenshots copies. |
| ID | 348e8d9, 03dd1a0, 48a0e57, 6a2b924, 75eb820, 556be02, 8c5e4d3; exact installed source passed standalone native export, color/Colorize, collision and backup-reopen checks. |
| Shared | Three-component installer/build integration, loaded-DLL/rollback fixtures, stale binary retirement, final manifest/README/ZIP and the reviewed Workspace evidence are completed. |

The final integrated 100-test suite passed. Six installer/uninstaller tests passed after adding two lock regressions (102 distinct scenarios overall). See `Plugin de zbrush/Development/VERIFICATION_3.2.0.md` for completed native checks and limitations. Owner visual acceptance is separate.

Native work is on disposable DemoHead, with the owner's original project and document backed up in ignored `.cache/zbrush-320/native/`. The user returned ZBrush from its screen saver when automated input stopped responding; the desktop control gate remains enabled. No application restart/closure or push has occurred. Worker tabs/worktrees remain open. Runtime requests, chat/native IDs and transcripts stay under ignored `.mrmak/zbrush-320/`.

Slow worktree creation can outlive a CLI request timeout; the existing requests were inspected and recovered without duplicate launches. Continue corrections in the existing three sessions only.

## Final integration

All three components and native corrections are merged. Final ID corrections include 556be02 and 8c5e4d3. Exact installed sources compiled; standalone ID, backup reopening and native compatible MergeDown passed. The original document and observed brush/screen-saver settings were restored, test cameras cleared and Windows-MCP released/closed. ZBrush and the three worker tabs remain open. Final installer checks also cover identical loaded DLLs and rollback after a changed locked DLL. The native record and manifest are the authoritative final status; earlier table checkpoints are historical. No push occurred.
