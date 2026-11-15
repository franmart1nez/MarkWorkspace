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

