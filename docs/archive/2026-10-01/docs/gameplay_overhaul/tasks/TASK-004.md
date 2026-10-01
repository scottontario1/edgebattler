> Historical snapshot archived 2026-10-01. Earlier revisions/proposals, not current main. [Current docs index](../../../../../README.md).

# TASK-004 — Explicit three-of-a-kind upgrades

## Goal

Implement optional star combinations across paid reserve and deployed unit records, with exact identity matching, visible preview data, and state inheritance that does not grant a free heal or resource reset.

## Context files

- `GAME.md` — “Three-of-a-kind upgrades”, “Cards, hand, and resources”, and prototype defaults.
- `docs/gameplay_overhaul/GAME_GAPS.md` — GAP-004 evidence and priority.
- `src/units.js` — current class identity fields and base stats.
- `src/cards.js` — TASK-001 planned paid-reserve data contract (read when available; do not edit).

## Exact files this task may edit

- `src/upgrades.js`

## Files this task must not edit

- Every file except `src/upgrades.js`, including all task docs/logs, `task_list.md`, `src/cards.js`, `src/units.js`, and all existing user-modified files.

## Steps

1. Export pure match/preview helpers over plain reserve and deployed unit records. Match only identical class/variant identity and star level; require exactly three eligible copies and cap at three stars.
2. Exclude hand cards, heroes/commanders, spells, and mismatched factions/identities from ingredients unless `GAME.md` explicitly authorizes them (it does not authorize hand cards or spells).
3. Preview consumed IDs, output stars/stats, destination/survivor choice, and population delta. Combining is always an explicit call and has no extra Supply charge.
4. Apply named stat growth rather than tripling every stat. Inherit the aggregate input current-HP/max-HP ratio against the new max HP, and preserve/aggregate energy, cooldown, status, and order state conservatively without resetting them.
5. Append timestamped progress/completion to the assigned log. Run relevant project build check and report exact result.

## Dependencies

None for rule implementation; it must accept the documented TASK-001 reserve records. Runtime integration waits until both modules are complete.

## Measurable acceptance criteria

- Three matching paid reserve/deployed units at one star produce a preview for one next-star unit; two do not, hand cards do not count, mismatched class/variant or star does not match, and 3-star units cannot upgrade.
- No input records mutate when previewing or when an invalid combination is attempted.
- A successful combine requires an explicit survivor/destination choice, reports population change, consumes only the three selected records, and adds no cost.
- Output stats use defined star increments; HP ratio inheritance does not heal inputs for free; energy/cooldown/status are not silently reset.
- Relevant project build completes; completion log gives command and result.
