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
