# Version 3.1.0 - source verification

Prepared visibility groups and name markers now support compatible native merge
handoffs through ZTL/ZPR + .zcv. Both plugins use data v8 and require updated
sources. Camera Bank preparation uses the existing bundled Maxon ZFileUtils DLL.

Passed offline: 32 logic scenarios (16 existing and 16 new merge cases), both
installer/uninstaller fixtures, and a 1,000-SubTool duplicate-name smoke test.
Generated sources parse without unresolved routine calls. Installer fixtures
also verify backup/retirement of old-format compiled plugins, component selection
and dependency/loader installation. No real installation was modified.

See [MERGE_HANDOFF.md](MERGE_HANDOFF.md) for the workflow, test coverage and limits.
No new ZSCs are supplied. No native app launch, control, compilation, render or
visual acceptance was performed for 3.1.0. Actual framing, native name behavior,
materials and geometry after real merge operations remain unverified.

Previous sources, CameraBank25.zsc and the prior ZIP are hash-verified/backed up
locally under workspace `.cache/zbrush-306/`, outside Git and this distribution.
Historical native results below apply to 3.0.3 only.

---

# Render Capture 3.0.5 - numbered Z document copies

During NON BPR, each selected camera's exported `NonBPR/Z document.png` is
copied into the shared `ZPass_<session>/Screenshots/` directory. The filename
is the actual two-digit camera number: `01.png`, `10.png`, `25.png`, etc.
The original PNG is retained. This is a file copy, without rendering or exporting
the document a second time. Disabled cameras do not produce copies.

The directory is created by CREATE FOLDERS and also ensured by NON BPR, so an
already chosen session can use the new source. Existing screenshots for selected
cameras are checked before rendering; the plugin stops instead of overwriting.
Copy errors stop the batch, preserve the original PNG and restore display state.

Offline checks passed: 16 logic scenarios (13 existing and 3 new), plus installer
and uninstaller fixtures. The new scenarios cover selected cameras 01/10/25,
a disabled camera, exact copied binary content, no extra exports, filename
collisions before any export, and reported/silent copy failures with restoration.
The generated source matches camera_reader.inc + render_body.txt. The four
pre-BPR quality settings from 3.0.4 are retained.

No ZBrush application was launched, controlled or restarted. Native compilation
and rendering remain pending; no new RenderCapture.zsc is included. Use the
source loader after installation, or load the updated TXT in ZBrush to compile it.
The 3.0.3 native results recorded below and in the Workspace card are historical.
Their exports and Recovery folders are absent from the current trimmed package.
This revision's pre-edit sources and previous ZIP are backed up locally under
`.cache/zbrush-305/` in the workspace, outside Git and the distributable.

Implementation reference: [Maxon ZFileUtils: copying a file](https://help.maxon.net/zbr/en-us/Content/html/user-guide/customizing-zbrush/zscripting/zfileutils/zfileutils.html).
Only a file path is passed in the temporary memory block, released after copying.

Example:

```text
ZPass_1/
  Screenshots/
    01.png
    10.png
  01/NonBPR/Z document.png
  10/NonBPR/Z document.png
```

---

# Render Capture 3.0.4 - source verification (2026-11-14)

Four `ISet` commands now run immediately before every BPR command, inside the
camera loop: Shadow Rays 30, Shadow Angle 15, AO Rays 30, SPix 2. These quality
values remain set after rendering. Camera Bank and non-BPR behavior are unchanged.

Offline verification passed: all 13 existing logic scenarios, installer and
uninstaller fixtures, plus an instrumented two-camera sequence (8 non-BPR and
14 BPR mock exports). At each BPR entry point, the four requested settings were
the immediately preceding commands and had the requested values. Values were
deliberately changed between cameras to confirm reapplication. Non-BPR left
them unchanged. Generated source matches camera_reader.inc + render_body.txt.

No ZBrush application was launched, controlled or restarted. No native render
or compilation was performed for 3.0.4. The old RenderCapture.zsc is hash-verified
in Recovery/before-3.0.4-source-update and excluded from the release. Load the
updated RenderCapture.txt in ZBrush to compile it; see README.txt.

Official control references:
- [BPR Shadow](https://help.maxon.net/zbr/en-us/Content/html/reference-guide/render/bpr-shadow/bpr-shadow.html)
- [BPR AO](https://help.maxon.net/zbr/en-us/Content/html/reference-guide/render/bpr-ao/bpr-ao.html)
- [BPR RenderPass / SPix](https://help.maxon.net/zbr/en-us/Content/html/reference-guide/render/bpr-renderpass/bpr-renderpass.html)

The native results below apply to the unchanged 3.0.3 baseline, not this source revision.

---

# Native verification - version 3.0.3

Completed in Windows ZBrush **2023.2.1** on 2026-11-13. The application was
closed at task start; it was launched once for QA and was not restarted.

## Evidence and corrections

The two owner activity logs (18:12 and 18:29 sessions) both end with
`IPress,Light:Save` followed by `***ABNORMAL TERMINATION***`, before any BPR.
The latter also records `Click in document: Thumbnail` during camera resize.
Raw logs and recovery projects remain local, outside the distributable archive.

The renderer no longer calls Light:Save or Light:Load. It saves the two light-2
fields it changes in RC30Recovery and restores them on completion or handled
failure. Light 2 remains selected; the rest of the rig is not rewritten.
This removes the observed crash path; the engine-level cause of Light:Save's
termination was not diagnosed.

Camera resize temporarily hides Thumbnail, closes LightBox, redraws and verifies
Edit before restoring the saved transform. Thumbnail is restored. Saving,
recalling and render preflight reject a missing live 3D model with instructions.
No automatic Make PolyMesh3D conversion or geometry edits are performed.

## Native results

| Scenario | Result |
|---|---|
| DemoHead, 2 SubTools | Three stored views; two complete recall cycles with Thumbnail ON |
| Camera dimensions | 1120 x 840, 500 x 2604, 2604 x 710 |
| DemoHead BPR | 21 PSDs; all seven native maps for each camera |
| Recovered crash project, 1 SubTool | Copied locally; original recovery file preserved |
| Recovered-project dimensions | 1120 x 840 and 2604 x 3818 |
| Non-BPR then BPR | 8 PNGs then 14 PSDs, no crash |
| Render cleanup | Edit=1, Thumbnail=1, recovery active=0, light recovery active=0, SSS restored |
| Failed redraw | Native warning displayed before attempting to apply camera transform |
| Final plugin buttons | STORE NEW -> 03 succeeded; 04 outside Edit displayed a warning and remained empty |
| Final BPR callback | Additional 7 PSDs via the release plugin's public BPR button |
| File checks | 50 exports, matching dimensions, complete raw PSD payloads, 16-bit Depth |

All 42 PSDs were parsed and all eight PNGs decoded. Previews of all passes were
visually reviewed. The 16-bit Depth preview uses its high byte for display;
the delivered PSD retains the original 16-bit samples.

Thirteen source-logic regression scenarios pass. Installer and uninstaller
fixtures pass, including retention of unrelated plugins and bank files. These
checks supplement the native session and do not replace it.

The final release TXT files were compiled by ZBrush to fresh ZSC files. The
installed old pair, data sources and loader macros were backed up with hashes
and removed after QA, as requested. No stock Maxon plugin or sculpt was removed.

## Limits and reproduction

This was verified on ZBrush 2023.2.1 with the stated meshes and dimensions.
Other versions, large production sculpts and every interruption point were not
stress tested. The same v7 bank format is retained. Earlier banks with unknown
canvas dimensions still need UPDATE ACTIVE at the intended size.

Run `build_all.py`, `verify.py`, `test_installer.py` and `test_uninstaller.py`
from Development. Recompile source in ZBrush after any source edit; do not
ship an older ZSC beside new TXT. QA exports are in `Verification/v3.0.3`.

Technical references: [ZScript command reference](https://help.maxon.net/zbr/en-us/Content/html/user-guide/customizing-zbrush/zscripting/command-reference/command-reference.html),
[Thumbnail location](https://help.maxon.net/zbr/en-us/Content/html/zbrushcore/interface-navigation/interface-navigation.html).
