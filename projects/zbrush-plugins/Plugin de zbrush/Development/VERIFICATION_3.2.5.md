# 3.2.5 — Camera Bank Fast is the default provider

Render Capture and both Generate and Export ID actions now read the independent Camera Bank Fast bank (FB25Data). The old CB25Data bank is never substituted. Fast 0.1 itself, including its source, binary, installer, documentation and standalone ZIP, is unchanged.

## Implementation

The read-only camera adapter is generated from the unchanged Fast source. It shares Fast's validated binding cache and imports only reader routines and their referenced globals. It does not register camera controls, create/import a bank, rename meshes, store cameras or recover a writer transaction. Both consumers reject pending light/full Fast writer records before export snapshots. ID recovery records its provider and bank nonce so a different bank does not receive an old active-camera index.

INSTALAR.cmd now defaults to RenderID, installing only the two consumers. Both startup and source-adjacent compiled consumer files are synchronized, preventing source reloads from selecting an old adjacent binary. Install/load Fast separately first. Historical explicit Camera/All/Both installer selections are retained; their legacy camera component does not supply data to the updated consumers. Data remains v9, 123,088 bytes.

## Automated checks

67 focused tests passed in 74.291 seconds. Coverage includes conflicting simultaneous Fast/legacy banks, no legacy fallback when Fast is missing/empty/invalid, all pending writer markers, warm-cache reuse on 300 SubTools, ID recovery across bank changes, both render phase orders, enabled/gray camera labels, manual/generating ID, Colorize activation, replacement without overwrite notices, camera filename aliases, installer defaults, backup/rollback and uninstall behavior.

Seven installer/uninstaller checks were rerun after adding that adjacent-binary synchronization; all passed in 5.482 seconds.

## Native checks — ZBrush 2023.2.1

Each exact consumer source compiled natively as an independent script. The native release binaries match those compiled copies. A private three-SubTool fixture stored orange Fast cameras 01/02 and gray Fast camera 25. A conflicting legacy bank enabled only 25.

- The actual Exportar ID button exported only Fast 01/02. Independently prepared RGB (240,30,40), (20,220,50) and (40,70,240) appeared exactly in the PNGs, starting with Colorize disabled.
- The actual Generar y exportar ID button generated and replaced both ID.png files, without intermediate overwrite notices. Both images contain nonblank colored IDs. Neither gray Fast 25 nor legacy 25 produced an output.
- A separate Render test callback ran the actual bank check, preflight, camera recall, snapshot, document export and recovery routines. Its two flat captures match the generated-ID pixels exactly; the legacy bank is byte-identical afterward. The helper filenames are zero-based (render-0.png and render-1.png). This is focused camera-provider/capture validation; full new beauty/material/BPR rendering is not claimed. Those unchanged render behaviors retain their historical native acceptance and automated coverage.

The first test harness incorrectly combined all three plugin sources, exceeding ZScript's variable limit and causing a fatal application error. The scene at that point was private and the original project/document had verified backups. The owner authorized reopening ZBrush. All subsequent native tests loaded one plugin at a time; independent release compilation and the checks above passed.

The original project/document were restored. Before/after exported canvas pixels are identical, and the original Fast bank is byte-identical. The owner's subsequently disabled screensaver preference is preserved. Runtime projects, images, bank snapshots, scripts and receipts remain ignored under .cache/zbrush-325/ and are not bundled.
