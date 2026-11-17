# 3.2.4 — enable Polypaint and replace outputs without notices

Requested 2026-11-17. Exportar ID now enables and verifies Colorize on each required SubTool before every enabled camera. This activation precedes camera recall so SubTool selection cannot disturb the bank's saved framing. Its control is also checked during preflight. Existing RGB, PolyGroups, material assignments and masks are not regenerated. Texture display retains its previous behavior; original display flags and view are restored after success or failure.

Removed per-camera overwrite MessageOK notices from both ID actions and both Render Capture phases. Matching targets are still deleted immediately before export to avoid the native save dialog. Real replacement/write/export failures remain errors. No automatic Tool backup was added.

60 automated tests passed in 69.808 seconds: test_id_export, test_render_layout, test_installer, test_uninstaller and test_ztl_identity. Coverage includes initially disabled Colorize, multiple cameras, ignored/disabled Colorize controls, camera framing after selection, interrupted export, recovery, repeated ID export followed by generation, both render phase orders and unrelated-file preservation.

Native ZBrush 2023.2.1 compiled the exact Render and ID release sources. On a private three-SubTool DemoHead fixture, all three Colorize toggles started at zero. The public Exportar ID action exported two enabled 640 x 480 cameras and omitted gray camera 03. RGB was independently filled with (240,30,40), (20,220,50) and (40,70,240), retaining the fixture's assigned metallic material. The PNGs contain precisely those colors and the background (48,48,48). A second public export replaced both existing ID.png files without an overwrite notice; the files are byte-identical to the first export. The 160-byte before/after display records match exactly, including the original Colorize flags.

A temporary native test control also ran the actual Render Capture preflight for both phases against existing PNG/PSD/screenshot targets, then replaced a scratch PNG twice. It reached its completion marker without any overwrite notice. This is focused file-flow validation, not a full new BPR render run.

The installation was updated without restarting ZBrush. The app was closed at the start and launched independently for this private test; no owner project was loaded. Runtime projects, scripts, captures and receipts stay ignored under .cache/zbrush-324/. Camera Bank remains 3.2.1 and data remains v9 (123,088 bytes). Full BPR rendering and generating new mesh IDs retain their historical native acceptance; they were not rerun for this correction.

The existing Workspace delivery page passed 1440/768/390 px in light and dark themes, with no page errors.
