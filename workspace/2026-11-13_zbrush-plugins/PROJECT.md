# ZBrush plugins — 3.2.0

**Camera Bank, Render Capture and Generar y exportar ID are integrated, compiled and installed.** Three visible Codex workers used gpt-6.1-sol / xhigh in separate worktrees; their branches were independently reviewed and merged. ZBrush was used by one operator at a time.

- Camera Bank captures visibility automatically during store/update, identifies SubTools through their names and restores compatible reordered/merged models. PREPARE TRANSFER is removed. Public EXPORT BANK and IMPORT BANK passed native round-trip checks.
- Non-BPR PNGs and all seven BPR PSD maps share each camera folder. Both phase orders, Screenshots copies and 16-bit Depth passed native checks.
- Generar y exportar ID uses one button for every enabled camera, prepares the needed meshes once, keeps Colorize on and exports ID.png. A uniquely named recovery folder preserves the exact marked ZTL filename.

[Download the complete 3.2.0 package](zbrush-plugins-source.zip) · [Native verification and images](verification-3.2.0.md) · [Reviewed video references](video-analysis-3.2.0.md)

Editable source: `projects/zbrush-plugins/Plugin de zbrush/`. Run INSTALAR.cmd for all three components, or the individual component launcher. The installer backs up replacements, skips identical loaded DLLs and does not close/restart ZBrush. Native ZSCs are installed for the next normal launch; startup was not tested by restarting the active session.

**For a ZTL save, keep the first SubTool's complete CB...G..._ marker in the filename.** ZBrush can rename that SubTool from a changed basename. Use any folder, or an arbitrarily named ZPR project. Merge only parts sharing visibility across all occupied cameras, including gray ones. Untracked old banks need reviewed updates on their original Tool.

ID changes mesh colors, PolyGroups, material assignments and masks. Run it after the other surface passes or reopen its backup before restoring the original treatment. Display restoration alone is not a mesh undo.

The integrated suite passed 100 tests; six installer/uninstaller checks passed afterward, covering 102 distinct scenarios overall. Native tests used ZBrush 2023.2.1 with disposable DemoHead. The owner's original document/settings were restored and desktop control released. No push, app restart or worker closure occurred. Owner visual acceptance and untested versions/large production scenes remain separate.

Historical records: [3.1.0 handoff](merge-handoff-3.1.0.md) · [3.0.3 verification](verification-3.0.3.md).
