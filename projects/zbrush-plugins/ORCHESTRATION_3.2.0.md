# Version 3.2.0 coordination

Source baseline: `1d3ebe2` on the owner's existing branch. Authoritative package: `projects/zbrush-plugins/Plugin de zbrush`. No push is authorized. Applications and worker tabs must remain open; closing or restarting requires the owner's permission.

Three visible worktree workers use `codex` / `gpt-6.1-sol` / `xhigh` (owner-corrected model ID), opened only with `scripts/agent-control.mjs` under the existing scoped grant. Session IDs and transcripts belong under ignored `.mrmak/`, never this record.

| Scope | Owner | Handoff |
| --- | --- | --- |
| Camera tracking, automatic capture, EXPORT BANK and shared camera reader | Camera worker | HANDOFF_CAMERA_3.2.0.md |
| Unified camera output folders | Render worker | HANDOFF_RENDER_3.2.0.md |
| New one-button Generate and Export ID plugin | ID worker, after video analysis | Pending |
| Install/uninstall, launchers, build integration, manifest, README, Workspace, review/merges | Orchestrator | This file |

**ZBrush lease: orchestrator only.** Workers may inspect source and installed-file metadata but must not load scripts, change native UI, install into the live app, or automate it until the orchestrator explicitly grants and records exclusive access. Native review will follow independent branch review and integration. Never overwrite an unsaved owner project to run QA; stage recoverable test data.

Initial state: handoffs prepared for Camera and Render; the ID video references are being analyzed. Source tests, worker delivery, orchestrator review and owner acceptance are separate milestones.
