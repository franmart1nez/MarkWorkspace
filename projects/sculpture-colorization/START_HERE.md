# Sculpture Colorization - Start here

**Active sculpture: Mother Talzin. Production started November 8, 2026.**

Read its [handoff](sculptures/mother-talzin/START_HERE.md) and [batch](sculptures/mother-talzin/work/batch.json) to continue. All **35 generated crops** for fourteen target views (02–15) passed agent review. The user-requested revision uses three crops for complete sculpture views 02–04. Native Photoshop assembly progress, editable paths and disk-reopen verification are tracked per view in the batch.

Read [DIRECTIVES.md](DIRECTIVES.md), [GENERATION_POLICY.md](GENERATION_POLICY.md),
[NEXT_SESSION.md](NEXT_SESSION.md), `project.json` and the Workspace
[Workflow](../../workspace/2026-11-05_sculpture-colorization/WORKFLOW.md).

Create/select a user-named sculpture with **Create New Sculpture.cmd** or:

```powershell
python projects/sculpture-colorization/scripts/new_sculpture.py create "Name"
```

Supply finished Composite 01 in `inputs/reference-composite-01/` and the remaining
original view PSDs in `inputs/composites-psd/`. The master plus shared quality
examples are the only appearance references. Produce a low-count crop set
directly from each target source, adjusted to size. Finish and review crops for
all views, then notify the user to open Photoshop and assemble views one by one.

Use [the Photoshop connection guide](PHOTOSHOP_INTEGRATION.md). The local MCP can
be discovered while Photoshop is closed. Native editing and saved-file fidelity
are checked per saved view after the user opens it. Do not launch/restart
applications automatically or confuse agent review with user acceptance.
