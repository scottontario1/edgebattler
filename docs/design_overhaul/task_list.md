# Design overhaul task list

| Task ID | Gap ID | Title | Exclusive files | Dependencies | Status | Log path |
|---|---|---|---|---|---|---|
| TASK-001 | DES-002, DES-008 (skill loadouts), DES-009 | Hand cards, reserve cards and card detail bar | `src/ui/hand.js`, `src/ui/hand.css` | None | done (verified; root tweaks to tray.css + hand.css) | `docs/design_overhaul/task_log/TASK-001.log` |
| TASK-002 | DES-003 (tray), DES-006 (locked state), DES-011 | Planning tray shell: ledger, collapse, battle lock, height budget | `src/ui/tray.js`, `src/ui/tray.css` | None | done (verified) | `docs/design_overhaul/task_log/TASK-002.log` |
| TASK-003 | DES-003 (unit card), DES-005, DES-007, DES-009 | Unit card, inspect sheet, roster strip, terrain chip, shared icon set | `src/ui/unitpanels.js`, `src/ui/unitpanels.css`, `src/ui/icons.js` | None | done (verified) | `docs/design_overhaul/task_log/TASK-003.log` |
| TASK-004 | DES-006 | Battle presentation: phase pill, banners, floating numbers, round results feed | `src/ui/feed.js`, `src/ui/feed.css` | None | done (verified) | `docs/design_overhaul/task_log/TASK-004.log` |
| TASK-005 | DES-008, DES-009 | Queued spells, upgrade prompts and the combine dialog | `src/ui/upgrade.js`, `src/ui/upgrade.css` | TASK-002 (tray must leave `.planning` overflow visible and publish `--tray-h`) | done (verified) | `docs/design_overhaul/task_log/TASK-005.log` |
| TASK-006 | DES-004 | On-map plates: stance, energy, stars, statuses and village ownership markers | `src/ui/plates.js`, `src/ui/plates.css` | TASK-003 (uses `src/ui/icons.js`) | done (built by root, verified) | `docs/design_overhaul/task_log/TASK-006.log` |
| INT | DES-003, DES-010, DES-011, DES-012 | Root integration after the parallel tasks | `src/ui.js`, `src/style.css`, `index.html`, `src/camera.js`, `src/game.js` | TASK-001..006 | done (DES-012 left open) | `docs/design_overhaul/task_log/INT.log` |

Ownership is exclusive: subagents write only the files in their row (plus `evidence/after-TASK-00X-*` screenshots and their own log). Only root edits this table and `DESIGN_BACKLOG.md`. Wave 1 (TASK-001..004) runs concurrently; TASK-005 starts after TASK-002 is verified done, TASK-006 after TASK-003 is verified done. Status values: pending, in progress, done (verified against the acceptance criteria), blocked (reason in the log).
