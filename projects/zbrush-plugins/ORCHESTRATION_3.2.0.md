# Version 3.2.0 coordination

Source baseline: `1d3ebe2` on the owner's existing branch. Authoritative package: `projects/zbrush-plugins/Plugin de zbrush`. No push is authorized. Applications and worker tabs must remain open; closing or restarting requires the owner's permission.

Three visible worktree workers use `codex` / `gpt-6.1-sol` / `xhigh` (owner-corrected model ID), opened only with `scripts/agent-control.mjs` under the existing scoped grant. Session IDs and transcripts belong under ignored `.mrmak/`, never this record.

| Scope | Owner | Handoff |
| --- | --- | --- |
| Camera tracking, automatic capture, EXPORT BANK and shared camera reader | Camera worker | HANDOFF_CAMERA_3.2.0.md |
| Unified camera output folders | Render worker | HANDOFF_RENDER_3.2.0.md |
| New one-button Generate and Export ID plugin | ID worker, video analysis completed | HANDOFF_ID_3.2.0.md |
| Install/uninstall, launchers, build integration, manifest, README, Workspace, review/merges | Orchestrator | This file |

**ZBrush lease: orchestrator only.** Workers may inspect source and installed-file metadata but must not load scripts, change native UI, install into the live app, or automate it until the orchestrator explicitly grants and records exclusive access. Native review will follow independent branch review and integration. Never overwrite an unsaved owner project to run QA; stage recoverable test data.

Camera worker startup/model and handoff delivery are verified; Render worktree creation is in progress. ID reference analysis is recorded in VIDEO_ANALYSIS_3.2.0.md and its handoff is ready. Source tests, worker delivery, orchestrator review and owner acceptance are separate milestones. Slow worktree creation can outlive the CLI request timeout; inspect the original request/session and never duplicate it.
