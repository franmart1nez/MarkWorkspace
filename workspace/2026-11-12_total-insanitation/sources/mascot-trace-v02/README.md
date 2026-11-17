# Wizard action traces v02

The owner approved both ChatGPT rasters (point left and mop). These SVGs trace those approved images. Stage 4's full pose batch is still pending.

Open wizard-point-left-v02.svg or wizard-mopping-v02.svg for the black masters, or the -white.svg files for white ink. Each is a filled compound Bezier path with transparent holes and no embedded bitmap. The viewBox remains 0 0 1254 1254. Ground strokes and pose proportions are preserved. Edit contours using node/compound-path tools in a vector editor.

PNG exports: transparent square canvases at 32, 48, 64, 96, 128, 256, 512 and 1024 px. SVG geometry is identical between black/white variants. Alpha is identical at 512/1024; smaller browser exports differ by at most 1/255 at a few antialiased edge pixels. 32/48 are diagnostic. No compact redesign or world-sign minimum is established.

Review sheets: trace-comparison-v02, backgrounds-v02, sizes-v02 (SVG and PNG). Open the size sheet at 100% for native pixel labels. Review backgrounds are not approved full signage rules. Original raster images appear only in the comparison sheet.

Adobe image_vectorize produced the initial paths. Existing vector geometry was consolidated with winding-aware union/difference to remove the white canvas and make white regions into holes; near-black edge regions were normalized to one ink. No anatomy was rebuilt. Original Adobe trace sources and provenance remain under adobe-originals. Runtime receipts are excluded.

Foreground overlap at 1254-square resolution: pointing left 99.53%; mopping 99.41%. All thresholded differences are within the immediate one-pixel boundary band. This is technical verification, not identical antialiasing or artistic reapproval.

Keep hand edits and later revisions separate. Preparation checks source hashes before overwriting a revision. No new generation, Unreal import, atlas edit or native production change was made.
