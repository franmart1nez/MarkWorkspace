---
name: affinity-native-assembly
description: Assemble reviewed images and repair crops as an editable masked collage inside Affinity using its native MCP, with application readiness, Desktop staging and verified save/reopen checks.
---

# Native Affinity assembly

Read the [assembly procedure](../../../processes/affinity-native-assembly.md)
before controlling Affinity. It covers the user handoff, native connection,
file staging, SDK pitfalls and delivery verification. Use this skill after
image generation/review when the requested deliverable is a native collage.
Keep the receiving project's editing limits and acceptance rules.

## Readiness before assembly

Finish and review the required crops first. Prepare source dimensions,
selected outputs, placement rectangles and masks before touching the montage.
If assembly reveals another defect, return to repair generation/review before
resuming placement.

Affinity must be running and its native MCP reachable. It need not remain open
during generation. If it is not open when the crops are ready, tell the user
that preparation is complete and ask them to open Affinity, preferably with the
intended source composite. Wait for readiness; do not claim assembly has begun.
If it is already open, perform a read-only connection/document check and
continue within existing authorization without asking again.

An already-open source document is convenient, not a server requirement. With
the application connected, the SDK can open the staged source if live tools
and permissions allow it. Bind edits to the verified target document, never
whichever unrelated document happens to be current. Preserve originals and
unsaved work; create a versioned working document.

## Native control

Prefer the available Affinity native tools; inspect their live schemas. If the
chat has no such tools, use [the local client](scripts/affinity_mcp.py), Python
standard library only. From this repository's root:

```powershell
python .agents/skills/affinity-native-assembly/scripts/affinity_mcp.py status
python .agents/skills/affinity-native-assembly/scripts/affinity_mcp.py catalog
python .agents/skills/affinity-native-assembly/scripts/affinity_mcp.py docs nodes.js
```

The verified endpoint is IPv6 loopback `http://[::1]:6767/sse`; recheck the live
app in a different environment/version. The client reads the live preamble in
every operational connection. Include relevant repeatable `--sdk-topic` flags
for scripted operations. Submit each mutation once. On timeout/disconnect,
inspect receipts, files and fresh app state before deciding what remains.

Use the real Windows Desktop location for SDK-readable staging when the live
permission limits native file access to Desktop. Keep canonical originals in
the project, verify copy hashes and copy verified deliveries back afterward.
The Desktop bridge, native MCP and filesystem permission are separate checks.

Keep named image groups, proportional placement, editable source-derived
masks and the source reference. Render inside Affinity, inspect the stack and
joins, save a new native version, export the requested review/exchange files,
then reopen the actual files and verify rendering plus layer/mask presence.
Keep private receipts and session IDs under ignored `.mrmak/`; `--state-dir`
can separate a project's runtime records. An agent-reviewed montage is not
user approval. Do not carry another project's crops, masks or approval forward.
