# Camera Bank 3.1.0 - merge-compatible ZTL/ZPR handoff

Camera recall and both Render Capture phases now use effective visibility groups
after transfer preparation. Reordering or reducing the SubTool list by compatible
merges no longer invalidates camera visibility solely because the count changed.

## Preparing the model and bank

1. Load both updated plugin sources. Keep the complete package together, or run
   INSTALAR.cmd and use Macro > Reload All Macros > Mak Plugins > Load Camera Bank,
   then Load Render Capture. Both plugins now require data v8. The installer
   provides the existing Maxon ZFileUtils dependency for Camera Bank as well.
2. On the original unmerged Tool, store the cameras and inspect their framing and
   visible parts. Complete capture before reordering or merging unprepared parts.
3. Press **PREPARE TRANSFER**. The plugin adds a 20-character marker such as
   `CB123456654321G0001_` before each human-readable SubTool name. Parts with the
   same marker have identical effective visibility in every occupied camera.
4. Save the prepared **ZTL or ZPR**, then **EXPORT BANK** to a .zcv file. Export
   also performs preparation automatically if it has not been done yet. Send
   both matching files. Do not send a ZTL/ZPR saved before preparation.
5. The recipient opens that ZTL/ZPR, imports the bank, and can reorder parts or
   merge compatible parts using native ZBrush commands. Preserve a complete
   marker from a source part in the resulting SubTool name.

Merge only parts sharing visibility in **all occupied cameras**, including gray
cameras not currently selected for rendering. A change to the human-readable name
is fine while retaining the marker. MergeVisible's documented `Merged_` prefix
is accepted because markers are recognized inside a name, not only at its start.
If a native command replaces the entire name (for example with a folder name),
retain a compatible source marker in the result before recalling/rendering.

When storing/updating cameras on a prepared Tool, the plugin first remaps every
existing view to the current SubTools, then regroups the edited visibility and
refreshes the markers. Save and send a new matching ZTL/ZPR + bank pair afterward.
Previously exported pairs remain separate; a foreign/stale marker is rejected.

## What visibility means

Capture accounts for individual eyes, the parent folder eye, Solo, and ZBrush's
always-visible active SubTool. Recall selects a visible part and opens folder
eyes while applying the recorded per-part eyes. This preserves the effective
visible geometry; the folder eye UI need not match the original arrangement.
Solo is disabled for camera recall; Render Capture restores the user's starting
Solo state after the batch. Framing data, sizes, lens settings, the prior BPR
quality values and numbered Screenshots copies remain in the workflow.

## Existing banks and scope

Data versions 1-7 can still be imported. They contain positional visibility,
not the new effective snapshots or identifiers. On the original unmerged Tool,
recall and visually inspect **every occupied camera**, then UPDATE ACTIVE for
each before preparing a new transfer. Older banks can also lack canvas/lens data.
An already merged, unmarked model cannot reliably reconstruct that missing history.

The method uses a surviving **visibility-group marker**, not geometric ancestry.
It rejects missing, malformed, ambiguous or foreign markers and missing visible
groups. It cannot detect every incompatible native merge after the operation has
discarded the other source names. The agreed same-visibility merge rule remains
a precondition; there is no claim of reconstructing arbitrary merged geometry.

Names and the bank are updated with a session-memory recovery snapshot. A handled
rename failure restores previous names, flags, selection and view. After Escape,
use a Camera Bank action on the same unchanged Tool to recover. Render Capture
blocks while recovery is pending. Session recovery does not survive app termination;
save original files before editing, as for any native model work.

## Verification status

**Source-only revision. ZBrush was not launched, controlled, restarted, compiled
or rendered by the agent. Native acceptance remains pending.** Native command
behavior, actual name retention/truncation, framing after real merges and the
resulting images require an application check when the owner chooses to run it.

Offline results: 32 logic scenarios (16 existing + 16 merge-visibility cases),
installer/uninstaller fixtures, and a 1,000-SubTool duplicate-name smoke check.
Cases include a bank-file round trip into a fresh mock host, compatible merges
and reordering, all 25 mask bits, hidden folders, Solo, active-hidden parts,
duplicate native mesh IDs, legacy migration, invalid metadata, stale markers,
edits after merging, rename failures and Escape during snapshot/edit/cleanup.
The simulated merged model also completes both renderer phases and Screenshots
copies. Neither simulation nor source parsing is native compilation/visual QA.

Reviewed references:
- [Maxon SubTools / MergeVisible naming](https://help.maxon.net/zbr/en-us/Content/html/reference-guide/tool/polymesh/subtool/subtool.html)
- [Maxon ZFileUtils / RenameSetNext](https://help.maxon.net/zbr/en-us/Content/html/user-guide/customizing-zbrush/zscripting/zfileutils/zfileutils.html)
- [Maxon command reference](https://help.maxon.net/zbr/en-us/Content/html/user-guide/customizing-zbrush/zscripting/command-reference/command-reference.html)
- [SubTool folder-status example by Marcus Civis](https://www.zbrushcentral.com/t/open-subtool-folder-before-deleting-the-subtool/421807)
