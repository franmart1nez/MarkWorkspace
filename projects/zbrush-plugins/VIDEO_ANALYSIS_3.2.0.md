# ID plugin reference analysis

Reviewed on 2026-11-15 before writing the ID worker handoff. Sources are the owner's tracked [A Materails All Tools.mp4](A%20Materails%20All%20Tools.mp4) (50.32 s) and [A ID Zbrush.mp4](A%20ID%20Zbrush.mp4) (61.95 s). The local video-watch extractor produced scene samples; a denser two-second series and enlarged key frames were visually inspected. This is sampled visual analysis, not a claim of watching every frame or transcribing audio.

## Observations

| Clip and time | Visible evidence | Implementation implication |
| --- | --- | --- |
| Materials, 00:00-00:16 | White, flat silhouette of the bust; Flat Color is selected. | A shaded material is not the desired ID appearance. |
| Materials, 00:20-00:28 | ZPlugin > SubTool Master, floating SubTool Master panel and Fill. | Automate the material-fill operation across applicable SubTools. |
| Materials, 00:30-00:36 | Fill dialog explicitly selects Material, not Color or Color & Material; Flat Color is visible in the material selector. | Preserve RGB values while assigning Flat Color. |
| Materials, 00:38-00:48 | Status text advances through SubTools while the silhouette stays flat. | Processing must cover the intended SubTools, not just the active one. |
| ID, 00:00-00:14 | Tool > Polypaint > Polypaint From Polygroups is visible; Auto Groups is in the lower custom shelf. | These are separate operations. The owner explicitly requires Auto Groups even though its exact click is not established by the sparse frames. |
| ID, 00:16 then 00:18-00:26 | Colored regions first appear on the chest with PolyFrame, then disappear; Colorize is initially off. | PolyFrame display alone is not valid exported polypaint. |
| ID, 00:26-00:30 | Polypaint From Polygroups is invoked; Colorize becomes orange and the chest displays flat colored regions. | Ensure actual polypaint and Colorize on each processed SubTool. |
| ID, 00:42-00:48 | Apply Last Action To All Subtools opens a dialog asking to repeat on all other visible SubTools. | The reference batch is visibility-scoped. Do not accidentally include hidden geometry in the exported view. |
| ID, 00:52-01:00 | The entire visible bust has distinct flat color regions. | Acceptance requires a full colored ID view, not a partially colored active part. |

Neither clip shows an export dialog or proves a filename, file format, camera-bank batch policy, hidden-part processing policy, or restoration of old polypaint. Those must be explicit implementation decisions. The owner explicitly requests a third plugin named **Generar y exportar ID**, one action button, Auto Groups, Polypaint From PolyGroups, Flat Color, export, and active SubTool polypaint.

## Provisional export contract

The orchestrator asked whether to export every enabled Camera Bank view or the current view. Until answered, use the existing batch workflow: one lossless `ID.png` in each enabled camera's existing `ZPass_N/01`-style folder, respecting that camera's visibility. If no Render Capture session exists, the single button can choose a parent directory and create a fresh numbered session itself. A missing/empty bank must fail clearly before editing geometry; no extra public preparation button is needed. This is a stated integration assumption, not a video observation.

Prepare each required mesh once, across the union of visible meshes needed by the enabled views, before exporting any camera. Generating random PolyGroup colors separately per camera would make the IDs inconsistent between views. Do not alter meshes that no enabled camera needs. Back up the current Tool before modifying its PolyGroups, polypaint or material assignments; never overwrite an owner file or claim an automatic undo that was not verified.

## Evidence locations

Local extractor outputs already exist at `workspace/2026-11-15_zbrush-320-materials/` and `workspace/2026-11-15_zbrush-320-id/`. Contact sheets 1-2 for Materials and 1-3 for ID, plus enlarged frames at Materials 00:30 and ID 00:26/00:44, were inspected. Runtime copies and all sampled frames are not required in the distributable plugin. Link curated evidence from the existing ZBrush card during integration.
