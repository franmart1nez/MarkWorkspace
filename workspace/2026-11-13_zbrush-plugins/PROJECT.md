# ZBrush plugins - 3.2.3

**Exportar ID** exports manually prepared ID colors/textures without generating or altering mesh data. **Generar y exportar ID** retains automatic generation and export.

Render Capture and Generate and Export ID reuse **ZPass_1**. The pre-ID Tool copy is removed, and every SubTool's original polypaint toggle is restored.

[Download the complete package](zbrush-plugins-source.zip)

- Choose the parent directory or ZPass_1 itself. Missing camera folders use the bank labels, 01–25, inside ZPass_1.
- Existing matching PNG/PSD files are listed by camera before rendering, then overwritten. Unrelated files and disabled camera outputs remain untouched. Existing ZPass_2 or other old folders are not deleted.
- Z document and BPR use each SubTool's original Colorize state. Normal, Double and Metal temporarily disable it. The generating ID action enables it for its capture, then restores the original per-SubTool state.
- Neither ID action creates an automatic ZTL copy. The generating action's existing edits to RGB, PolyGroups, materials and masks remain; run it after surface passes.

Camera Bank remains 3.2.1 with data v9 (123,088 bytes). The ZTL filename identity correction is retained. Run the included INSTALAR.cmd to install the package on another machine.

52 focused automated tests passed. Native compilation and export checks are recorded in the package's Development/VERIFICATION_3.2.3.md. Manual export retains the prepared Colorize/texture flags and uses flat rendering. Full BPR acceptance is historical coverage, not a new full production render run.

[3.2.1 identity verification](verification-3.2.1.md) · [Original ZTL recovery](ztl-import-recovery.md) · [3.2.0 render verification](verification-3.2.0.md)
