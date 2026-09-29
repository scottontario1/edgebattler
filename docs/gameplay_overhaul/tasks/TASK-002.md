# TASK-002 — Bounded shared automatic battle resolver

## Goal

Add a deterministic, presentation-independent resolver for a single bounded round. It must plan both factions from a shared snapshot, resolve movement as a batch, then resolve combat from that resulting board without allowing JavaScript iteration or animation order to decide lethal exchanges.

## Context files

- `GAME.md` — “Round structure”, “Automatic battle rules”, “Stances, objectives, and automatic abilities”.
- `docs/gameplay_overhaul/GAME_GAPS.md` — GAP-002 evidence and priority.
- `src/rules.js` — current movement costs, terrain-aware range/path helpers.
- `src/combat.js` — current forecast and sequential exchange calculations.
- `src/ai.js` — current one-unit-at-a-time enemy decision logic.
- `src/units.js` — plain fields and faction/coordinate conventions.

## Exact files this task may edit

- `src/battle.js`

## Files this task must not edit

- Every file except `src/battle.js`, including all task docs/logs, `task_list.md`, `src/ui.js`, `src/ai.js`, `src/combat.js`, and all existing user-modified files.

## Steps

1. Define a pure exported round resolver that accepts plain unit records, map/rule adapters or explicit legal movement candidates, locked orders/stances, and an injected seeded RNG; return final records plus ordered presentation events grouped by batch.
2. Resolve both factions' movement intentions from one snapshot, using each unit's automatic allowance once, class movement costs and occupied-tile rules where supplied. Specify deterministic tie and collision handling for contested destinations and crossing paths.
3. Resolve one bounded combat activation per living unit against the post-movement snapshot. Reuse `forecast`/weapon rules when available. Collect declared strikes first and apply them together so mutually lethal attacks resolve consistently; cap actions/reactions and preserve state for surviving units.
4. Ensure playback events do not mutate authoritative state, and return explicit reasons for holds/no legal action when practical.
5. Append timestamped progress/completion to the assigned log. Run the relevant project build check and report exact result.

## Dependencies

None. Export a documented plain-data API that root integration can adapt to current scene/unit objects.

## Measurable acceptance criteria

- Resolver has no DOM, renderer, animation, or global randomness dependency.
- Movement decisions are gathered before coordinates are committed, and combat damage is applied in explicit batches.
- A deterministic seed and identical input produce identical final unit state and event batches.
- Each unit has at most one bounded activation opportunity per call; lethal simultaneous attacks can kill both participants.
- Output preserves survivors' coordinates, HP, and arbitrary persistent state, and does not require manual “done” flags.
- Relevant project build completes; completion log gives command and result.
