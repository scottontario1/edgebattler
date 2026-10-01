> Historical snapshot archived 2026-10-01. Earlier revisions/proposals, not current main. [Current docs index](../../../../../README.md).

# TASK-001 — Card economy and reserve rules

## Goal

Implement a small deterministic rules module for the first prototype's shared recruitment pool, retained hand, Supply, paid reserve bench, and population accounting. Keep this module independent of DOM, Three.js, and rendering.

## Context files

- `GAME.md` — “Cards, hand, and resources”, “Deploying units and controlling territory”, and implementation milestone 1.
- `docs/gameplay_overhaul/GAME_GAPS.md` — GAP-001 evidence and priority.
- `src/units.js` — current class IDs, base stats, names, and hardcoded roster.
- `src/maps/river_ford.js` — map has a blue keep (`C`) and village tiles (`V`); no deployment system currently consumes them.

## Exact files this task may edit

- `src/cards.js`

## Files this task must not edit

- Every file except `src/cards.js`, including all task docs/logs, `task_list.md`, `src/ui.js`, `src/units.js`, and all existing user-modified files.

## Steps

1. Define a catalog for the existing recruit identities (`pikeman`, `archer`, `cavalier`) with costs, class display data, star level, range, default stance, and concise ability text; include a small weighted pool and a few spell-card definitions for the later spell system.
2. Export pure helpers to create state, draw reproducibly from an injected RNG, retain existing hand cards, cap hand at eight, report blocked draws, and grant three Supply per round up to six (initial Supply three; opening hand five, later draw three).
3. Export validated transitions for buying a unit into paid reserves, checking affordability, reserve capacity/population, deployment eligibility and Supply/population projections. A failed transition must not mutate state or charge anything. Keep reserves distinct from hand and field units.
4. Include a seeded RNG helper or accept an injected RNG; do not use unseeded randomness inside transitions. Document the module's exported API with concise comments.
5. Append a timestamped progress and completion entry to `docs/gameplay_overhaul/task_log/TASK-001.log` (log is append-only and root-managed task status is not yours to change). Run the relevant build check and report the exact result.

## Dependencies

None. The API should use stable unit identity strings and plain data so TASK-004 and root integration can consume it.

## Measurable acceptance criteria

- `src/cards.js` exports catalog/state/draw/Supply/recruitment/deployment helpers with no DOM or Three.js imports.
- With an identical seed, two opening draws have identical ordered card IDs; opening hand size is five; later draws request three, retain unplayed cards, never exceed eight, and report blocked draws.
- Supply begins at three, gains three per round, and never exceeds six.
- Unit recruitment creates a paid reserve record only when the cost and capacity/population rules pass; invalid or cancelled transitions preserve state and Supply.
- The implementation includes named prototype limits/defaults and does not silently spend hand cards as upgrade ingredients.
- Relevant project build completes; completion log gives command and result.
