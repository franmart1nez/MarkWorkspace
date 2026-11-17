# Total (in)Sanitation — execution log

The owner approved the seven-stage plan and initially requested stage 1 only. On 2026-11-17 (UTC), the owner requested continuation from the New Setup handoff, starting stage 2. This document records changes in status and the evidence for completion. Stages are marked complete only after their checks pass.

| Stage | Status | Result / next check |
| --- | --- | --- |
| 1. Reset Workspace project data | **Completed** | 624 files removed; protected files unchanged; file/link and desktop/mobile checks passed |
| 2. File placement and export rules | **Completed** | 19 blends, 94 existing FBXs and 557 native packages audited; file contract/export map verified; native files preserved |
| 3. Unreal reference library | Pending | Rebuild categorized galleries and material showcase from fresh Unreal captures |
| 4. Mascot | Pending | Master design review, then consistent poses |
| 5. Signage, UI and atlas specification | Pending | Review concrete examples before implementation |
| 6. Basement concepts | Pending | Fresh native captures and a separate ChatGPT conversation after graphic approval |
| 7. Individual assets and production | Pending | Approved sheets, exact Unreal materials and a verified first asset |

## Stage 1 activity

- **Started:** 2026-11-16T22:50:41.11005-03:00 (UTC). The owner authorized stage 1 after approving the plan.
- **Inventory:** reviewed the project/card folders, local task outputs and reusable documentation. Identified retired asset sources, concepts, renders, reports, task scripts and recovery copies.
- **Preservation:** keep the Office Level Builder's working assets/script/setup instructions; owner-supplied originals under `Temp`; the source brief; selected mascot/sign prototypes; Blender/Unreal/Designer connectors; native chat/session state and unrelated projects.
- **Scope:** Workspace project data only. No Blender, Designer or Unreal production file will be saved or deleted by this stage.
- **Removed:** 624 files across 148 exact targets, totaling 549,044,569 bytes. This includes retired delivery records, concepts, renders, copied sources/exports, task-specific scripts, local recovery copies and obsolete previews. Duplicate owner-reference copies were removed; their original `Temp` files remain.
- **Rewritten:** minimal Overview/Art bible/Plan/Rules & tools navigation; project continuity and export rules; concise builder guide; project section of `context/goals.md`; project-specific examples in shared orchestration documentation.
- **Preservation checks passed:** SHA-256 matches for 60 protected files, including the two production environment blends, atlas source, owner originals, mascot/sign prototypes, builder packages/script and essential connection/configuration files. The retained builder's editable runtime source matches its installed script.
- **Completed:** 2026-11-17T01:58:14.213617+00:00 (UTC). All 148 removal targets are absent; all six registry paths exist; Art bible schema valid; no active references to retired deliveries remain.
- **Visual/link verification:** six tabs at 1440, 768 and 390 px in dark/light themes (36 checks), with no console errors. Image enlargement, fit, download and close passed. The tool environments, unrelated registry entities and other project goals are unchanged.
- **Audit trail:** the [cleanup manifest](CLEANUP_MANIFEST.json) records exact deleted paths, sizes and hashes plus preservation checks. It contains metadata, not copies of retired content. Git history and native chat/session state were retained.

## Stage 2 activity

- **Started:** 2026-11-17 (UTC). The owner requested continuation from `inbox/handoffs/2026-11-17-new-setup-56c685b5.md`.
- **Scope:** inspect source collections, parents, export settings, resource consumers and current Unreal package paths; write a placement/export contract. No native production saves, deletion, generation or later-stage art production.
- **Initial check:** stage-1 worktree changes are present, along with unrelated classifier changes. Preserve both; do not rerun completed cleanup helpers.
- **Source audit:** 19 non-backup blends inspected in isolated Blender 5.2.4 LTS processes, with factory startup and automatic script execution disabled. Building remains 282 objects; Props 191, both Metric at scale length 1. Collections, parents, visibility, material/image consumers and saved exporter properties were recorded. The retained audit helper now reports these relationships.
- **Existing exports:** 94 FBXs imported into disposable background scenes, with no import errors. The [export map](FILE_MAP.csv) records their 107 nodes and source-name/collection matches. No new FBX was generated.
- **Native connection:** Unreal was closed; the existing 5.8.4 project was opened without restarting another session or changing its configuration. Live schemas were discovered before sequential read-only MCP calls. Startup map `/Game/Levels/Test` stayed clean, with PIE off; no map was switched or edited.
- **Unreal audit:** 557 packages inspected for class, import tags, dependencies, referencers and dirty state; all were clean. The audit found 70 redirectors. Of 189 FBX import records, 96 map to existing current exports after explicit root/layout mapping; 67 match the recorded file MD5. These are metadata/file checks, not new asset acceptance.
- **Classifications:** moved structural-trim file with seven object consumers; active missing atlas exports with ten prop consumers; six zero-user Corridor materials and an unused props T01 image classified retired. Preserve owner reference data and the existing `Text_Atlas` graph in `General_Atlas.sbs`. No resource was relinked, regenerated or purged.
- **Exceptions recorded:** stale preset/reimport paths; rigged Chicken/Tongue Mop exports; unparented UCX bundles; misleading `Janitor_Building.fbx` elevator contents; existing letter-mesh folder exception; old UI consumers outside `/Game/Art`; confirmed future UI/character destinations still absent.
- **Dependency preservation:** the validation Blueprint and its four trial meshes remain referenced through `/Game/Levels/LaCarlota`. All three Office Level Builder Blueprints are also referenced there. None was deleted, rebuilt or saved.
- **Deliverable:** [File placement and export rules](FILE_PLACEMENT.md), under **Rules & tools → File rules**, with the CSV and [audit evidence](FILE_AUDIT.json). Continuity, Blender/export instructions and the registry were updated within this existing card. Four top-level tabs and default Progress selection are preserved.
- **Preservation passed:** all 20 protected source SHA-256 checks match. Metadata/path checks found no added, changed or removed files among 3,236 source files and 8,014 native Unreal packages. Unrelated registry entities and project goals were preserved.
- **Presentation passed:** all seven registered views at 1440, 768 and 390 px, in dark/light themes (42 checks), with no console errors. File-contract links and JSON/CSV content, Markdown rendering, tab selection, image enlargement/fit/download/close and page overflow checks passed. Desktop/phone screenshots were visually reviewed.
- **Completed:** 2026-11-17 (UTC); the exact completion timestamp and preservation evidence are in `FILE_AUDIT.json`. The placement contract acceptance checks passed. Native repairs, visual production review and a first new asset round trip remain future tasks.

## Confirmed production decisions

- Preserve the Office Level Builder as the essential tool.
- Game text uses English, with future localization.
- Future UI assets belong in `/Game/Art/UI`; characters in `/Game/Art/Characters`.
- Use current Unreal captures as the production reference authority. Proposed graphics and generated concepts remain explicitly labeled development work.

See the [approved plan](ACTION_PLAN_2026-11-16.md) for the full stage definitions. This log will be updated as authorized stages start, change or finish.

## Current handoff

**Stages 1–2 are complete. Stages 3–7 are pending.** The next planned stage is the Unreal reference library/material showcase, when the owner directs continuation. Read File rules before future exports or targeted native resource repairs. No later stage has started.
