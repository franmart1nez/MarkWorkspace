# Delegated corridor asset production

**12 November 2026 · Model/export delivery accepted by the orchestrator; owner aesthetic review pending.**

The owner approved concepts A/B/C as a modeling direction and requested a **new visible OpenCode chat** in Mr. Mak, using **DeepSeek V4.1 Flash 1017 (Max)**. The current agent acts as orchestrator and independently checks the delivered models.

**Completed:** sub-agente 1 delivered N01–N07: **25 meshes, 25 FBXs and T01**, 13,694 triangles. The orchestrator checked both saved sources, all exports and native Unreal imports/materials, returned scoped corrections and accepted the model/export set. **Models / Model review** contain the previews, downloadable bundle and exact paths. Original 473 objects retained their checked data; final Basement placement remains a separate step.

## Ready to use

- Project task packet: `projects/total-insanitation/CORRIDOR_ASSET_HANDOFF.md`.
- Repeatable procedure: `processes/visible-agent-orchestration.md`.
- Owner-created chat: **sub-agente 1**. Suggested descriptive title for future runs: **Basement Asset Production**.
- Working folder: **`D:/AI/MarkWorkspace`**.
- Accepted image direction: **Basement → Corridor concepts**.
- Asset/material scope: **Basement → Asset proposal**; N01–N07, plus existing cart/shelf reuse.

## Kickoff message

Paste this into the ready OpenCode chat after selecting the requested model:

```text
Build the approved Total (in)Sanitation corridor assets. Read and follow projects/total-insanitation/CORRIDOR_ASSET_HANDOFF.md completely, inspect the three referenced images, and implement all N01–N07 model families in the specified existing Blender sources. Preserve the current dirty graphical Blender state and all unrelated work; make recovery snapshots first. Use the owner's Super Duper Batch Exporter / Unreal_Only_FBX workflow. Keep the exact requested DeepSeek V4.1 Flash 1017 (Max) model. Report the actual provider/model/variant before starting. Do not edit Unreal maps or Workspace registry files. Deliver the saved models, exports, corridor-assets.json and CORRIDOR_IMPLEMENTATION.md, then signal READY_FOR_REVIEW with any real limits. The orchestrator will independently review the assets and send corrections here.
```

## Checks already made

- OpenCode **2.2.6** is installed. The owner opened **sub-agente 1**. Its saved native terminal screen confirms **DeepSeek V4.1 Flash 1017 / OpenCode Go / max**, working folder `D:/AI/MarkWorkspace`. Native model discovery maps this to `opencode-go/deepseek-v4.1-flash#max`. No global model/permission setting was changed.
- The connected Blender is `Interior_Building.blend`. It initially reported unsaved changes, then was clean at the read-only object/mesh/UV fingerprint snapshot. The worker must re-check live state before writing. Saved building/prop source hashes and the live building fingerprint were recorded locally; no source was changed by the orchestrator.
- This coordinator session currently has **no working desktop/browser-control connection** and **no authenticated connection to Mr. Mak's Chats service**. The service is running, but its origin/health endpoint does not supply its required credentials.
- The owner-created chat and selected model were confirmed. The private per-tab server requires its own native credential; the existing background-service credential was rejected, and no authentication bypass was attempted. The owner confirmed sending the single kickoff. A narrow file protocol supports subsequent progress, review and corrections in the same chat. No detached process was substituted; no application restart or authentication change was made.

## Review ownership and completion

The worker owned new geometry, source saves and exports. The orchestrator independently checked the finished files and created isolated Unreal review assets. Review corrections covered preview isolation, projection limits, collapsed UVs, image paths and FBX origins. Native evidence confirms the selected provider/model/max variant. The model/export set passed orchestrator review; final owner aesthetic acceptance remains separate.

Continue this same chat rather than creating duplicate work. Worker progress is written to `worker-status.json`, and orchestrator corrections go to `review-control.json`, under ignored `.mrmak/total-insanitation/corridor-production/`. Keep chat/native session IDs, transcripts, tool receipts and recovery copies there too. Update this report to the observed state after actual progress, delivery and review.

The final control revision is accepted. After the first native session was created, its exact model/folder were verified through OpenCode's authenticated native API. Scoped follow-ups were durably admitted with `delivery=steer, resume=false`, so the existing worker consumed them without a second scheduled execution. This did not require the private TUI server's password or disabling authentication.

## Automatic repetition / prepared implementation

The owner then requested automating the manual launch/send steps. The repository now contains a scoped local agent-control bridge and CLI, plus **Allow this chat to coordinate workers** in the New chat dialog. The feature is **prepared and tested in source/build, not activated in the running desktop service**. No running application or worker was restarted.

An enabled orchestrator chat can automatically open a visible native OpenCode worker with an exact `provider/model#variant`, attach the project handoff, read its screen/transcript and send corrections to the same native conversation after the current run finishes naturally. It uses OpenCode run mode in a normal Mr. Mak terminal tab. Existing interactive chats are unchanged.

The capability is off by default, limited to that controller's own workers in its exact project folder and kept only in process memory. It cannot access the desktop API; child workers do not inherit it. Requests retain stable IDs to avoid duplicate launches across retries/restoration. CLI permission selection is inherited without escalation.

Canonical instructions: **`docs/agent-orchestration.md`**. Reusable orchestration process: **`processes/visible-agent-orchestration.md`**. Client: **`scripts/agent-control.mjs`**.

**Verified:** native OpenCode 2.2.6 against an isolated loopback fixture accepted the handoff file and a correction in the same conversation, with zero paid calls or live-chat changes. The permission checkbox passed desktop and 390 px browser checks. Targeted auth/scope/deduplication/launch tests and the application build passed. The broader test suite has one separately reproduced failure in the unchanged `voice-language.test.mjs` effort expectation; no voice behavior was changed by this task. Activation must wait for an owner-approved app/service restart, especially while sub-agente 1 is working.

A **local runtime update** is staged at `.mrmak/maintenance/agent-control-update.zip` (93 service/UI files; no credentials, sessions or game assets). It is **not applied**. Six targeted tests also pass on the installed Node 22.23.4 runtime. The update/recovery script was tested against a fake installation, including refusal while an app is running and hash verification after copying. The installed dependency manifests match, so this service/UI-only update can retain the current Tauri shell and Node binary. A full native installer build was unavailable because Cargo is not installed in this session; no global tool installation was performed. Other active agents must be considered before owner-approved activation.
