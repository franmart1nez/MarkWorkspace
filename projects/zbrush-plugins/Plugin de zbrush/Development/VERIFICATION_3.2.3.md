# 3.2.3 — export existing ID colors

Requested 2026-11-16. Adds **Exportar ID** beside **Generar y exportar ID**.

The new button exports existing colors/textures to `ZPass_1/<camera>/ID.png` for orange cameras. It shares camera validation, output notices and recovery with generation, but bypasses material filling, Auto Groups, Polypaint From Polygroups and mask clearing. Original Colorize/texture flags remain in effect. PolyFrame/floor overlays are temporarily hidden, and the original view/display settings are restored afterward.

Export-only uses Render Flat to capture colors/textures without shading, as described in the [Maxon Render reference](https://help.maxon.net/zbr/en-us/Content/html/reference-guide/render/render.html). Prepare the visible colors and mask display before export. The existing generation button retains its original capture path. Neither button automatically copies the Tool.

52 focused automated tests passed: 40 ID/installer/uninstaller tests in 55.493 seconds, plus 12 camera-identity tests in 4.835 seconds. Five new tests cover unchanged mesh data and display across views/reordering, unavailable generation controls, repeated overwrite export followed by generation, export failure, and interrupted export recovery from either button. The installer reload macro now retires both controls before loading the new source.

Camera Bank remains 3.2.1, Render Capture remains 3.2.2, and the bank remains data v9. Historical 3.2.2 full-suite coverage is in its own verification record. Runtime scripts and test artifacts remain private under `.cache/zbrush-323/`.

Native ZBrush 2023.2.1 compiled the exact release source. The actual Exportar ID button exported two enabled 640 × 480 cameras from a private DemoHead fixture, omitting gray camera 03. RGB was prepared independently with RGB-only fills while keeping the assigned metallic material. Exported pixels exactly match the prepared colors: (240,30,40) / (20,220,50) for the two heads and (40,70,240) for the eyes; the PNGs contain those flat colors and the background, without metallic shading. No generating-ID action was invoked for this check.

The source, native binary and two-button reload macro were installed. ZBrush was closed at the start of native validation and was launched independently for the private fixture; no active owner project was replaced or application restarted. The Workspace delivery tab passed 1440/768/390 px in both light and dark themes, with no page errors.

The native before/after state records are byte-identical: selected SubTool, canvas dimensions, current material/color, transform, Colorize flags and SubTool statuses were restored. The temporary output-root memory was cleared after QA. All 63 release ZIP entries were checked against the manifest; runtime projects, banks and receipts are excluded.
