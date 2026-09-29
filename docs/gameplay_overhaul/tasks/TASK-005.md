# TASK-005 — Game/UI integration and verified playable slice (root-owned)

## Goal

Connect the completed rule modules to the live game so planning uses cards, Supply, paid reserves, optional deployment/upgrades/spell queueing, and a single Resolve battle command. Return the player to planning with persistent survivors and correct map objective results.

## Context files

- `GAME.md` — round structure, cards, deployment, upgrades, spells, automatic battle, UI, implementation milestones.
- `docs/gameplay_overhaul/GAME_GAPS.md` and TASK-001 through TASK-004 briefs/logs.
- Current integration surfaces: `src/ui.js`, `src/units.js`, `src/rules.js`, `src/map.js`, `src/maps/river_ford.js`, `index.html`, `src/style.css`.

## Exact files this task may edit

- `src/ui.js`
- `src/units.js`
- `index.html`
- `src/style.css`
- `src/game.js` only if a real entrypoint integration need is confirmed.
- This task's log, and `docs/gameplay_overhaul/task_list.md` (root agent only).

## Files this task must not edit

- Any subagent-owned module until its task is complete: `src/cards.js`, `src/battle.js`, `src/abilities.js`, `src/upgrades.js`.
- Existing user changes in `src/camera.js`, `public/sprites/manifest.json`, `tools/blender/build_env.py`, and generated `__pycache__` files.

## Steps

1. Wait for TASK-001 through TASK-004 completion, inspect each changed module, and adapt the actual exported APIs rather than assuming the brief was followed exactly.
2. Extend unit creation for dynamic recruits without deleting or rewriting current scene/model behavior; support coordinates/state refresh and reserve-to-field transitions.
3. Replace per-unit player Attack/Wait as the primary loop with a planning dock, legal reserve deployment, compact stance/order controls, pending spells, and prominent Resolve battle; retain inspect/forecast as needed.
4. Invoke the battle resolver once for both factions, animate its returned events separately, preserve state between rounds, and apply objective/capture/victory checks at a defined boundary. Keep UI handlers out of authoritative resolution logic.
5. Add a concise readable card dock and responsive layout; adjust camera framing only if supported by current camera API and necessary for dock insets.
6. Append timestamped progress and final verification to this task log; update only root-owned statuses in `task_list.md` after criteria are verified.

## Dependencies

TASK-001, TASK-002, TASK-003, and TASK-004.

## Measurable acceptance criteria

- A round can be completed with one Resolve battle click and no required manual attack or per-unit wait.
- Opening hand, Supply, affordability, reserve cards, legal deployment, population, pending spells and optional triples have visible, coherent UI state.
- Failed/cancelled plays do not consume cards, Supply, or units.
- Both sides' movement resolves before combat; playback is event-only; surviving HP/position/energy/cooldowns persist into planning.
- Map objective outcome follows enemy keep capture/destruction baseline; Brenna's death alone does not immediately end the match; report outcome reason.
- `npm run build` passes, and any unverified acceptance criterion is marked blocked with its specific reason in the log and task list.
