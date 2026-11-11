# Setup and intake

Run **Create New Sculpture.cmd** or `scripts/new_sculpture.py create "Name"` from
the Workspace root. Place finished Composite 01 in its reference input folder
and the remaining original views in its PSD input folder. Preserve Mask/ID
passes and folder names. Record one exact final master in the sculpture manifest.

Shared quality examples remain at `shared/approved-client-work/`. An individual
sculpture does not need a separate palette input folder.

The Windows Photoshop MCP is installed in ignored local storage and registered
in the repository's `.codex/config.toml` and `.mcp.json`. Follow
[PHOTOSHOP_INTEGRATION.md](PHOTOSHOP_INTEGRATION.md) to reproduce or inspect it.
No API key, cloud upload or Photoshop remote-debugging port is required by the
local bridge. Photoshop can stay closed until all generated crop sets pass.

## Prepare a target's source crops

After exporting and checking a source-size preview, run the helper with that
view's original source. For example, after creating a sculpture named `Name`:

```powershell
python projects/sculpture-colorization/scripts/prepare_crops.py --sculpture projects/sculpture-colorization/sculptures/name --view 02 --source-psd projects/sculpture-colorization/sculptures/name/inputs/composites-psd/02/Composite.psd --preview projects/sculpture-colorization/sculptures/name/work/psd-previews/02.png
```

The default starting plan uses up to a 2048 px core edge and 128 px contextual
overlap: typically one crop for a small view and four for a 3240 x 4050 view.
Inspect source detail and seam placement before generation. Use `--core-edge`,
`--overlap`, `--revision` and `--rationale` to adapt the plan; exceeding the
default six-crop allowance requires an explicit rationale. Resized previews
are rejected because paste coordinates must match the original PSD/PSB.

The helper extracts source crops only. Populate the batch record and crop
records with generated outputs and their review before announcing readiness.

This setup does not start a generation, choose a sculpture or restart an app.
