# Automatic worker chats

An explicitly enabled orchestrator chat can open a visible **OpenCode** worker,
select its exact native `provider/model#variant`, send a project handoff, read
progress and send corrections to the same native conversation after it finishes.
The orchestrator can be any supported agent CLI. Automatic workers currently
use OpenCode's native **run** mode inside a normal Mr. Mak chat tab; existing
interactive OpenCode tabs retain their normal behavior.

## Enable for one new orchestrator

In **Chats → New chat**, choose the orchestrator CLI, set the project folder
under **Advanced** if it differs from the default, then select **Allow this chat
to coordinate workers**. This option is off by default
and is separate from the CLI permission/bypass selection. Keep the permissions
you intend the worker to inherit.

The new process receives `MRMAK_AGENT_CONTROL_URL` and
`MRMAK_AGENT_CONTROL_TOKEN` in its environment. Do not print, copy or save their
values. The capability is held in service memory, expires when that controller
stops/closes and rotates on relaunch. It cannot access the desktop API or other
controllers' workers. Ordinary child workers do not inherit it.

The app/service must include this feature before the checkbox is available.
Preparing source or a build does not update a running desktop installation.
Do not restart an active app/agent to activate an update without the owner's
permission.

## Give the orchestrator a task

Provide the project handoff plus these instructions:

> Follow `processes/visible-agent-orchestration.md`. Use
> `scripts/agent-control.mjs` to create a visible OpenCode worker with the exact
> requested model, monitor it, independently inspect the delivered artifacts and
> send any corrections back to that same worker. Preserve sources and permissions.

Write a request JSON file containing:

```json
{
  "requestId": "basement-assets-20261112",
  "agent": "opencode",
  "name": "Basement Asset Production",
  "model": "opencode-go/deepseek-v4.1-flash#max",
  "handoff": "projects/total-insanitation/CORRIDOR_ASSET_HANDOFF.md"
}
```

The model ID above was verified against the owner's installed OpenCode 2.2.6
catalog: **DeepSeek V4.1 Flash 1017 / OpenCode Go / max**. It is not an alias for
the similarly named free or other-provider model. Verify availability on a later
machine/account. Never silently substitute another model.

From the enabled orchestrator chat:

```text
node scripts/agent-control.mjs list
node scripts/agent-control.mjs open path/to/request.json
node scripts/agent-control.mjs read WORKER_CHAT_ID
node scripts/agent-control.mjs send WORKER_CHAT_ID path/to/corrections.txt
```

Use the returned real chat ID. `open` focuses its visible tab and returns delivery
state. `read` includes the native screen, transcript/model and observed process
state. Delivery is not completion. Independently verify outputs before acceptance.
`send` resumes the **same native conversation** in another run after the prior
process exits naturally; it refuses to inject corrections into an active run.
It never terminates a running worker.

The handoff must be a Markdown file inside the controller's exact project folder,
outside hidden/private runtime directories. Workers keep that folder and inherit
the controller's selected bypass value; requests cannot raise it. No login or
provider credential is sent as part of the handoff. OpenCode uses its existing
account/provider setup.

The validated handoff text is frozen in a private runtime attachment before
launch. Later source edits or symlink changes cannot alter that request's input.

## Repetition and interruption

- A stable `requestId` prevents duplicate launches, including retries and service
  restoration of the same controller. Reusing it with changed content is an error.
- At most eight workers may be open/starting per controller. List existing workers
  before starting a new task. An older manually opened tab is not automatically
  owned by a new controller grant.
- Source ownership and editor access still require coordination. A visible agent
  tab does not make concurrent writes to one Blender/Unreal session safe.
- Runtime state lives under ignored `.mrmak/`; tokens are never written there.
  Requests/prompts and native transcripts are private runtime/task data, not Git
  deliverables. Keep reusable specifications and final evidence in the project.
- Permission or login prompts are not answered by this bridge. An unsuccessful
  or timed-out launch does not authorize creating another paid job.

## Verification boundary

The native test uses the installed OpenCode binary, isolated home/config/state
and a loopback fixture model. It verifies automatic visible-terminal execution,
handoff-file delivery and a follow-up retaining the original native context,
without paid model calls or changing the user's live sessions.

```text
node --test desktop/service/test/agent-control.test.mjs
node desktop/service/test-opencode-native.mjs --binary ABSOLUTE_OPENCODE_BINARY --worker
node desktop/service/test/agent-control-ui.mjs
```

See `workspace/2026-11-12_total-insanitation/AGENT_PRODUCTION.md` for the actual
production worker's state. A passing loopback integration test does not prove
that its meshes are finished or accepted.
