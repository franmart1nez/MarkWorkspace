# Render Capture 3.2.0 result

Both render phases now export directly into the same numbered camera folder.
`CREATE FOLDERS` creates `ZPass_N/Screenshots` and enabled camera folders only;
neither it nor a render creates `NonBPR` or `BPR` child directories.

Source baseline: `1d3ebe2`. The worker started at `ab17796`, after the two
coordination-only handoff/model commits. The authoritative package is
`projects/zbrush-plugins/Plugin de zbrush`. This is an offline source delivery;
native ZBrush compilation, rendering and owner acceptance remain pending.

Delivered paths, relative to that package:

- `Development/render_body.txt`: header 3.2.0; removed phase-folder creation
  and the unused phase variable; shared camera output path. Each phase still
  checks only its own filenames, with the extra screenshot check for non-BPR.
- `Render Capture/RenderCapture.txt`: assembled from the unchanged baseline
  camera reader plus the updated render body using the existing concatenation
  rule. The orchestrator must regenerate it with the camera worker's reader
  after integration. `build_all.py` was not run or edited.
- `Development/test_render_layout.py`: executes the delivered camera/render
  routines through the existing `verify.Host`, with temporary filesystem output,
  distinct binary mock payloads and an assertion against attempted overwrites.
- `Development/RENDER_3.2.0_RESULT.md`: this result and continuation record.

The bank's `CB29_ApplyVisual` builds its button path from `slot + 1`, padding
single digits. Its 25 camera switches display `01` through `25`; `RC_Label`
already follows that convention. No camera-renaming feature was added.

For example, camera `01` now contains these eleven files directly:

```text
ZPass_N/01/Z document.png
ZPass_N/01/Normal.png
ZPass_N/01/Double.png
ZPass_N/01/Metal.png
ZPass_N/01/_AO.psd
ZPass_N/01/_Composite.psd
ZPass_N/01/_Depth.psd
ZPass_N/01/_Mask.psd
ZPass_N/01/_Render.psd
ZPass_N/01/_Shadow.psd
ZPass_N/01/_SSS.psd
```

`ZPass_N/Screenshots/01.png` remains a byte copy of `01/Z document.png`.
Export commands, PNG/PSD extensions, camera recall, recovery routines, material
selection, Polypaint/texture handling and render-quality settings are unchanged.
Existing output folders are not migrated or deleted.

Offline checks on 2026-11-15, using Python 3.14.3 (commands run from
`Development`; no running applications were controlled):

| Command | Result |
| --- | --- |
| `python verify.py` before implementation | 16 passed |
| `python test_render_layout.py` after implementation | 9 passed |
| `python verify.py` after implementation | 15 passed; 1 obsolete-path error described below |
| `python verify_merge.py` | 16 passed |
| `python test_installer.py` | 1 passed, isolated fake installation |
| `python test_uninstaller.py` | 1 passed, isolated fake installation |
| `git diff --check` | Passed |

The new suite covers both phase orders with all eleven files coexisting;
reruns of both phases preserving all files without another export; each of the
eleven pass-name collisions on the last enabled camera blocking the entire
phase; screenshot collisions; independent sparse cameras `01`, `10`, `25`;
omission of disabled `03` and empty `02`; byte-identical screenshot copies;
new sessions skipping occupied numbers and preserving previous sessions;
source reload retaining the session; and an interruption after the first export
recovering on the next phase while retaining the partial output. It also checks
per-camera dimensions/visibility, materials, display restoration, BPR settings,
all 25 labels and assembled-source equality.

The single existing regression error is
`Regression.test_screenshots_preserve_original_bytes_and_camera_numbers` in
`verify.py`, line 365 at this baseline. It reads
`session/label/'NonBPR/Z document.png'`; the required 3.2.0 assertion must read
`session/label/'Z document.png'`. The new suite verifies that copy at the new
location. `verify.py` belongs to the camera worker and was deliberately left
unchanged. This contract adjustment must be reconciled by its owner during
integration. No production fallback folder should be added to satisfy it.

Only the four delivered paths are in this worker's commit. Camera sources and
reader, shared test infrastructure, builders, installer/uninstaller/launchers,
manifest, README files and Workspace were left unchanged. Selected files were
reviewed for credentials, personal data, runtime state and unrelated media.
No install into ZBrush, application close/restart, merge/rebase or push occurred.

Native continuation plan for the orchestrator holding the ZBrush lease:

1. Integrate the camera reader and the obsolete test-path correction, regenerate
   `RenderCapture.txt`, then rerun the offline checks. Compile/load the integrated
   sources against recoverable test data, preserving the owner's unsaved project.
2. Enable `01`, `10`, `25`, disable stored `03`, and leave `02` empty. Create a
   scratch session, run non-BPR then BPR. Check the eleven direct files per enabled
   camera, absence of phase/disabled folders, camera framing/visibility and
   SHA-256 equality of each screenshot copy to its document PNG.
3. Rerun each phase and confirm collision messages and unchanged file hashes.
   Create a new numbered session and repeat BPR then non-BPR; verify that the
   previous session remains intact.
4. Decode the native PNG/PSD exports and check dimensions, BPR maps and native
   Depth bit depth against the existing baseline. Visually compare materials,
   framing and quality; interrupt a test render, then verify display/light
   recovery on the next button and preservation of partial files.

The mock exports placeholder bytes, so its pass results do not certify native
PNG/PSD payloads, Depth bit depth, renderer output, native dialogs, compilation
or visual quality. No new ZSC or native render evidence is delivered here.
