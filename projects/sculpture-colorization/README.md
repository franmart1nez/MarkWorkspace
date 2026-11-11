# Sculpture Colorization

Colorize remaining sculpture views from a supplied, finished **Composite 01**.
It is the highest appearance reference; `shared/approved-client-work/` supplies
the reusable quality benchmark. Each target's original PSD controls geometry.

Start at [START_HERE.md](START_HERE.md). The complete contract is in
[DIRECTIVES.md](DIRECTIVES.md), with generation settings in
[GENERATION_POLICY.md](GENERATION_POLICY.md).

Create independent sculptures with **Create New Sculpture.cmd**. Each receives:

- `inputs/reference-composite-01/`: finished master, used read-only.
- `inputs/composites-psd/`: all remaining original view folders and passes.
- `work/`: previews, crop plans, source/generated crops, masks, batch record and QA.
- `outputs/photoshop/`: editable versioned PSD/PSB montages.
- `outputs/review/`, `outputs/approved/`, `outputs/exports/`: per-view deliveries.

Plan low-count crops directly from all target sources, according to size.
Generate and review the complete crop batch first. Then notify the user to open
Photoshop and assemble the views sequentially. See
[PHOTOSHOP_INTEGRATION.md](PHOTOSHOP_INTEGRATION.md) and the Workspace
[Workflow](../../workspace/2026-11-05_sculpture-colorization/WORKFLOW.md).
