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
