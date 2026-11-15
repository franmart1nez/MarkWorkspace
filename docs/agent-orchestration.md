# Automatic worker chats

An explicitly enabled orchestrator chat can open visible **OpenCode**, **Claude
Code** or **Codex** workers with an exact model, send a project handoff, read
progress and send corrections to the same native conversation. The orchestrator
can be any supported agent CLI. Workers open in the orchestrator's tab group.

| Worker `agent` | `model` | Reasoning | How it runs |
| --- | --- | --- | --- |
| `opencode` | exact `provider/model#variant` | the `#variant` | OpenCode's native **run** mode: one process per task or follow-up |
| `claude` | exact Claude model ID, such as `claude-opus-5-5` | optional `effort` | interactive Claude Code tab that stays open |
| `codex` | exact Codex model ID, such as `gpt-6.1sol` | optional `effort` | interactive Codex tab that stays open |

`effort` is `medium`, `high`, `xhigh` or `max`; without it a Claude or Codex
worker uses `medium`. Existing interactive tabs retain their normal behavior.

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
> `scripts/agent-control.mjs` to create a visible worker with the exact
> requested CLI and model, monitor it, independently inspect the delivered
> artifacts and send any corrections back to that same worker. Preserve sources
> and permissions.

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

A Codex or Claude worker names its model and reasoning separately:

```json
{
  "requestId": "plugin-ui-20261115",
  "agent": "codex",
  "name": "Plugin UI Pass",
  "model": "gpt-6.1sol",
  "effort": "xhigh",
  "handoff": "projects/example/HANDOFF.md"
}
```

### Separate branches (worktrees)

Parallel workers in one folder can overwrite each other's files. Add
`"worktree": true` to a request to give that worker its own Git branch and
checkout:

- Mr. Mak creates the branch `mrmak/<name>-<random>` from the controller's current
  commit and checks it out in `<repository>.worktrees/` beside the repository. The
  worker opens in the same subfolder the controller uses.
- The result contains `worktree.path`, `worktree.branch` and `worktree.base`.
  A `note` reports uncommitted or untracked files: they are **not** in the
  worktree, so commit what the worker needs first. Ignored files such as
  `node_modules` or `.env` are not copied either.
- The worker is told to commit on its branch and not to merge, rebase or push.
  Review from the controller with `git diff <base>...<branch>`, then merge.
- After merging, close the worker's tab, then run `git worktree remove <path>` and
  `git branch -d <branch>`. Mr. Mak removes a worktree itself only when its worker
  never started.
- Mr. Mak creates worktrees itself rather than passing `claude -w` or
  `codex --worktree`: the branch starts at the local commit (Claude's own default
  is the remote default branch), all three CLIs behave the same, and the worker's
  conversation stays in a folder Mr. Mak knows. A new folder may make a CLI ask
  for folder trust once; answer it in the worker's tab.

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
`send` continues the **same native conversation** and never terminates a running
worker:

- OpenCode: a new run starts after the prior process exits naturally; corrections
  are refused while a run is active.
- Claude and Codex: the correction is sent into the open tab once the worker's
  turn has finished. It is refused while the worker is working or waiting for
  input. If the worker's CLI has exited, it resumes with the same model.

A Claude or Codex worker CLI may show its own first-run screens, such as folder
trust or sign-in. Read the screen after `open`; the bridge does not answer them.

The handoff must be a Markdown file inside the controller's exact project folder,
outside hidden/private runtime directories. Workers keep that folder and inherit
the controller's selected bypass value; requests cannot raise it. No login or
provider credential is sent as part of the handoff. OpenCode uses its existing
account/provider setup.

The validated handoff text is frozen in a private runtime attachment before
launch. Later source edits or symlink changes cannot alter that request's input.
Each worker has its own runtime folder for that attachment and its follow-ups. A
Claude worker is given read access to that folder only; OpenCode and Codex
receive the file directly or read it by path.

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
