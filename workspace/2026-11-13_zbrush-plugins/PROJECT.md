# ZBrush plugins - Render/ID 3.2.6 + Fast 0.3

**Camera Bank Fast is now the only camera writer.** The Render/ID package no longer contains the old Camera Bank folder, binary or camera installer option. Its installer backs up and retires explicit old installed writer files while preserving Fast and saved banks.

[Download Camera Bank Fast 0.3](camera-bank-fast-0.3.zip) · [Download Render/ID 3.2.6](zbrush-plugins-source.zip)

**IMPORT VWS** adds native ZAppLink views to free slots in native order with Render ON (orange). Current resolution, lens and SubTool visibility supply editable defaults. **Desactivar todas las camaras** and **Activar todas las camaras** appear above the numbers and set the Render flag on all stored cameras.

1. Open the matching model in Edit mode and choose the starting canvas size and lens.
2. Choose **Camera Bank Fast → IMPORT VWS** and select the client's file.
3. To adjust a camera, recall it, configure it and press **UPDATE ACTIVE**.
4. Save the matching ZTL/ZPR and **EXPORT BANK**. Render Capture and both ID actions use these regular Fast cameras.

Fast 0.3 is installed in ZBrush 2023.2.1. The eight example views landed orange in slots 09–16. The bulk buttons then set the enabled count to zero and back to sixteen. The original Fast bank was restored byte for byte.

A VWS file contains no focal length; a lens value in its filename is not metadata. Set the client's intended lens before importing. Unsupported layouts and sets that exceed free capacity are rejected without replacing cameras. Current support is the native 320-byte, eight-view ZAppLink layout.

[Fast workflow, performance and limits](camera-bank-fast.md) · Verification: `VERIFICATION.md` in Fast and `Development/VERIFICATION_3.2.6.md` in Render/ID. Full BPR/ID rendering acceptance remains the historical record.

[3.2.1 identity verification](verification-3.2.1.md) · [Original ZTL recovery](ztl-import-recovery.md) · [3.2.0 render verification](verification-3.2.0.md)
