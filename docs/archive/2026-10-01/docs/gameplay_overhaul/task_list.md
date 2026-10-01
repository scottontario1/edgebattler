> Historical snapshot archived 2026-10-01. Earlier revisions/proposals, not current main. [Current docs index](../../../../README.md).

# Gameplay overhaul task list

| Task ID | Gap ID | Title | Exclusive files | Dependencies | Status | Log path |
|---|---|---|---|---|---|---|
| TASK-001 | GAP-001 | Card economy and reserve rules | `src/cards.js` | None | blocked — `npm run build` cannot launch configured Node runtime | `docs/gameplay_overhaul/task_log/TASK-001.log` |
| TASK-002 | GAP-002 | Bounded shared automatic battle resolver | `src/battle.js` | None | blocked — `npm run build` cannot launch configured Node runtime | `docs/gameplay_overhaul/task_log/TASK-002.log` |
| TASK-003 | GAP-003, GAP-005 | Persistent energy, abilities, and spell rules | `src/abilities.js` | None | blocked — `npm run build` cannot launch configured Node runtime | `docs/gameplay_overhaul/task_log/TASK-003.log` |
| TASK-004 | GAP-004 | Explicit three-of-a-kind upgrades | `src/upgrades.js` | TASK-001 API contract is in this plan; no runtime dependency | blocked — `npm run build` cannot launch configured Node runtime | `docs/gameplay_overhaul/task_log/TASK-004.log` |
| TASK-005 | GAP-001–GAP-007 | Game/UI integration and verified playable slice | `src/ui.js`, `src/units.js`, `index.html`, `src/style.css`, `src/game.js` (only if required) | TASK-001 through TASK-004 implementation complete | blocked — `npm run build` cannot launch configured Node runtime | `docs/gameplay_overhaul/task_log/TASK-005.log` |

Task ownership is exclusive. Subagents may edit only the single source file assigned in their brief, and must not edit this list. The root agent owns TASK-005 and all shared UI/unit integration. Existing user changes in other files are outside this work and must be preserved.
