# Camera Bank Fast 0.3

The active Camera Bank, with native ZAppLink VWS import and support for large SubTool lists. Render Capture and both ID actions use Fast.

[Download Camera Bank Fast 0.3](camera-bank-fast-0.3.zip)

## Import client shots

Open the matching model in Edit mode, set your starting canvas/lens and choose **IMPORT VWS**. The native 320-byte file has eight view positions: Front, Back, Rght, Left, Top, Botm, Cust1, Cust2. Stored views fill the first free slots; empty views are skipped. The whole set must fit in the 25 slots.

New cameras start **orange (Render ON)** with the current canvas, lens, zoom/pan and effective visibility. Above the numbers, **Desactivar todas las camaras** sets Render OFF and **Activar todas las camaras** sets Render ON for every stored camera. Recall and adjust views as needed, then press **UPDATE ACTIVE**. Save the matching ZTL/ZPR and export the bank for Render/ID or transfer.

The importer does not change ZAppLink's native views or infer lens values from filenames. Invalid/empty/unsupported sets are rejected; one recoverable writer transaction covers the batch. An occupied untracked legacy bank needs its existing review/update workflow first.

Native ZBrush 2023.2.1 compiled and loaded Fast 0.3. The supplied example imported all eight views with Render ON. Both bulk buttons worked on the new and existing slots. Native save fixtures verified the position and scale conversion in Fast 0.2. Data remains **v9, 123,088 bytes**.

## Existing Fast behavior

Fast keeps the 25 cameras, camera/lens/canvas data, effective visibility, gray/orange camera flags, import/export and compatible merges. It runs independently of Render and ID.

For an unchanged model with distinct native IDs, routine saves update the bank without selecting or renaming every SubTool. Recall checks IDs by index and activates only the final visible SubTool. Initial setup and detected structural changes still require a full binding.

## What changes

Arrows show **Standard → Fast** after setup.

| Parts | Save activations | Recall activations |
|---|---:|---:|
| 100 | 303 → 0 | 102 → 1 |
| 300 | 903 → 0 | 302 → 1 |

Fast also reduces per-save mesh renames from 100/300 to zero.

These are counts from executing the delivered ZScript in the test host, not native timing measurements. They describe the usual case after setup, with distinct native IDs.

## Native measurements

ZBrush 2023.2.1, separate lightweight Tools with distinct native IDs. Times in seconds: initial setup, second save and mean recall routine over ten switches.

| Parts | Setup | Save | Recall |
|---|---:|---:|---:|
| 100 | 10.93 s | 0.03 s | 0.73 s |
| 300 | 33.41 s | 0.11 s | 2.06 s |

These times measure the recall routine; the inherited fixed two-second public notices have also been replaced with nonblocking status messages. Both tests reproduced the expected eyes exactly. An actual compatible MergeDown (300 → 299 parts) preserved both existing views, including after a new post-merge save. These are fixture measurements; complex production geometry and redraw can take longer.

## Limits and use

- A compatible merge still requires identical visibility in every occupied camera, including gray cameras, and a retained CB marker. Fast revalidates after structural changes and rebuilds stable markers on the next save.
- Duplicated meshes can share a native ID. Fast checks names for ambiguous duplicates; those cases can still require visiting many SubTools.
- Fast trusts a validated native-ID binding between structural changes. After manually editing/removing CB markers, use **RESCAN MODEL**. Fast deliberately keeps a validated binding between structural changes.
- Use Fast as the sole camera writer; the old writer has been retired.
- Save the matching ZTL/ZPR after identifier changes and send it with the exported bank. Existing bank imports need one update to establish stable per-mesh markers.

Run **INSTALAR FAST.cmd**. In the open ZBrush, choose **Macro → Reload All Macros → Mak Plugins → Load Camera Bank Fast**. The palette is **ZPlugin → Camera Bank Fast**.

The standalone installer writes only Fast's source, binary, dependency and reload macro. It does not close or restart ZBrush.

## Verification

The original Fast 0.1 baseline covered 100/300 SubTools, all 25 cameras, visibility, duplicate IDs, merges, interruption recovery, large native IDs, bank round trips and installation isolation. Native results and package hashes are in VERIFICATION.md and manifest.json in the ZIP.
