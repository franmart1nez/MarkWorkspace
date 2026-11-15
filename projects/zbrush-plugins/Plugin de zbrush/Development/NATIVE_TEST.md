# Native acceptance checklist - 3.1.0 additions (pending)

Do not treat offline source checks as completed native acceptance.

1. Load both new TXT sources in a disposable ZTL/ZPR. Verify genuine compilation
   and that Camera Bank can find RenameSetNext through the installed/source DLL.
2. Pose at least two views on four parts (A/B and C/D), with different sizes and
   opposite group visibility. Include a hidden folder, Solo, a hidden active part
   and duplicate human names/native duplicated meshes. Inspect each saved view.
3. PREPARE TRANSFER; verify markers, original human names, selection, statuses
   and framing. Save the prepared model, export the bank and reopen/import both.
4. Use actual MergeDown on compatible parts; test reorder and the native
   MergeVisible/new-Tool path while retaining every class needed by a view.
   Check actual name retention/truncation and compare matched before/after images.
5. Run NON BPR and BPR on the changed list. Verify visibility/framing, PNG/PSD
   passes, Screenshots copies, pre-BPR quality values and final Solo recovery.
6. Reject foreign/removed markers and a missing visible class before rendering.
   Test storing/updating after merging; save both refreshed files and reopen.
7. Exercise rename failure/Escape on a disposable Tool; confirm name, bank and
   view recovery on the same Tool, and rejection when another Tool is selected.
8. Review/update every camera from a COPY of a v7 bank on its unmerged source.
   Verify the new matching pair after preparation, and old-bank compatibility.

Prior baseline checklist follows; its v3.0.x native passes are historical.

---

# Native acceptance checklist

Core camera/UI, PNG and BPR paths were executed successfully for v3.0.2 and v3.0.3.
See VERIFICATION.md for actual results and untested cases. The checklist below
remains useful for future revisions.

Use a saved disposable 3D Tool in Edit mode in ZBrush 2023.2.1. Do not use an
unsaved production sculpt for the first native test. Load the custom materials.

1. Load `Camera Bank/CameraBank25.txt` through ZScript > Load. Confirm no native
   compilation error and confirm that the .zsc was generated beside the source.
   Load `Render Capture/RenderCapture.txt` and perform the same check.
2. Store camera 01 with a landscape canvas and perspective ON; camera 02 with
   a portrait canvas, different FOV and perspective OFF. Recall both. Verify
   document width/height, lens values, framing, visibility and Edit mode.
   Check both universal and classic camera modes if both are used.
3. Confirm the original first-click recall / subsequent-click Render toggle,
   Store, Clear, Clear All and bank import/export behavior. Export/re-import
   the new bank. Test a COPY of an old bank, then update its dimensions.
4. Enable those two cameras, leave a third stored camera gray, and press
   CREATE FOLDERS. Confirm only enabled cameras get folders.
5. Run NON BPR at small sizes (for example 640x480 and 480x640). Confirm eight
   PNG files, full document pixel dimensions, correct framing and materials.
   Check that Shadows was OFF and active color white during capture. Check
   Z document Polypaint and the other three unpainted material passes visually.
   Confirm Screenshots/01.png and Screenshots/02.png are byte-identical to the
   original NonBPR/Z document.png files. Check a camera numbered 10 or above,
   a disabled camera, and an existing screenshot name without overwriting it.
6. Run BPR. Confirm fourteen PSD files, including separate AO and SSS maps.
   Inspect all seven passes per view and their dimensions. Verify Shadows,
   AOcclusion and Sss ON for rendering and map reuse OFF.
7. Confirm original RGB, material, render options and per-SubTool Polypaint and
   texture display are restored after each phase. The last camera stays active.
8. Repeat a phase: it must refuse to overwrite existing images. Create a new
   folder session and confirm ZPass_2 is used without changing ZPass_1.
9. Test missing Basic Thor, suffixed DoubleShade, and Metal 111 without Metal 11.
   Missing required materials must stop before any export. Confirm successful
   loading from both portable package and installed loader macro locations.
10. Interrupt a small batch with Escape and press a Render Capture button again.
    Check display recovery on the same Tool. Do not alter the SubTool list.
11. After successful native compilation, run the installer again, and verify
    automatic startup at your next normal restart. Do not restart active work
    merely to perform this check.

If ZBrush reports a command/path error, retain its exact text and script line.
The local 2023 command map was consulted, but it does not replace execution.
