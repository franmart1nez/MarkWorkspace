# Visible agent orchestration

Use when the owner asks one agent to coordinate another native CLI worker in **Mr. Mak → Chats**. Keep project-specific scope in the project's handoff; this process supplies the repeatable coordination steps.

## Prepare a concrete task

1. Read root/project instructions, current source state, accepted references and applicable skills. Record which visual direction the owner accepted and which implementation is still unseen.
2. Write a project handoff containing stable asset/task IDs, source paths, editable deliverables, allowed modifications, shared-file ownership, recovery requirements, exact requested CLI/model/variant, available tool routes and completion checks. Link references directly. Never send credentials, global config dumps or private transcripts to the worker.
3. Give the worker exclusive write ownership over its source scope. The orchestrator owns the registry, coordination notes and independent review. Native editors are shared resources; do not have two agents edit them concurrently.

## Open and verify the visible worker

The implementation and reusable commands for enabled orchestrator chats are in
**`docs/agent-orchestration.md`**. Use `scripts/agent-control.mjs` when its scoped
environment grant is available. It creates native OpenCode run-mode workers in
visible Mr. Mak tabs with an explicit provider/model/variant and supports
follow-ups to the same conversation. Existing interactive tabs are preserved.
The checkbox is available only after the updated app/service is activated;
preparing a build is not activation.

4. Use a connected Mr. Mak chat tool or its already-authenticated local API when available. Otherwise use the connected desktop UI. Choose **a new chat only when requested**; otherwise reuse the appropriate chat. Title it with a concise English task name and set the exact working folder.
5. Read the startup screen before sending work. Confirm the native CLI is ready, not a shell, login, permissions prompt or crashed process. Preserve the user's chosen permissions. Do not raise approval/bypass settings.
6. Verify the **exact provider/model/variant** in the worker, not just the app's default-agent selector. For OpenCode, model and reasoning are native OpenCode settings. Record the stable Mr. Mak chat ID and native session ID only in ignored runtime records. Never substitute another model silently.
7. Send a short kickoff pointing to the complete handoff, then verify delivery and the worker's actual response. Pasting successfully is not proof the worker accepted the task.

## Monitor and review

8. Monitor native activity/transcript and saved progress. Keep status updates factual: created, prompt delivered, working, needs input, delivered, independently reviewed. Do not infer completion from silence or process exit.
9. Keep long work in the same worker session, with exact follow-ups for blockers or corrections. Do not duplicate paid jobs, restart editors, kill active agents or create replacement chats merely because progress is slow.
10. After delivery, verify artifacts independently: open actual saved files, inspect relevant native previews and run meaningful source/scale/function checks. Compare with the accepted reference and preservation baseline. A worker-authored report alone is insufficient.
11. Send a specific correction list to the same session. Re-check changed results. Record remaining risks/limits and distinguish worker delivery, orchestrator verification and owner acceptance.
12. Register useful deliverables in the existing project card, update continuity notes and leave editable sources plus a reusable kickoff. Keep transcripts, receipts and session IDs under `.mrmak`, outside Git.

## Access failures

- Mr. Mak's desktop API requires its existing bearer authentication. The public `/health` response and `.mrmak/runtime.json` give service identity/origin, **not permission or credentials**. Never disable authentication, extract memory secrets, alter browser security or start a replacement service against the live state folder.
- If desktop/browser control and authenticated chat tools are unavailable, prepare the handoff and ask the owner to open the requested visible worker. State that the worker is **not launched yet**. Do not claim a detached CLI process is a Mr. Mak chat tab or modify persisted session JSON to fake one.
- Before native API automation of an already-open worker, inspect that version's actual help/schema and match its exact native session. Do not send to another chat merely because it shares a folder/model. Use a safe configured connector; do not expose credentials in commands, logs or documents.
- Pending user input does not authorize a different model, broader permissions or a hidden worker. Continue independent preparation and verification while waiting.

## Reusable owner request

“Act as orchestrator. Follow `processes/visible-agent-orchestration.md` and the project's current handoff. Open a new visible [CLI] chat in Mr. Mak with [exact model + variant], send the handoff, monitor it, review the delivered artifacts independently and return any corrections to that same worker. Preserve existing sessions and permissions.”

For Total (in)Sanitation corridor modeling, the task packet is **`projects/total-insanitation/CORRIDOR_ASSET_HANDOFF.md`**. The requested worker is **OpenCode / DeepSeek V4.1 Flash 1017 (Max)** and its suggested title is **Basement Asset Production**.
