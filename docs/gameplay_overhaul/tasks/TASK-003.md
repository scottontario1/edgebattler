# TASK-003 — Persistent energy, abilities, and spell rules

## Goal

Implement isolated plain-data rules for unit energy/cooldowns, ordered bounded ability activations, and planning-time spell queues. Spell payment and cancellation must be explicit, and skills must remain type-wide equipment rather than one-shot spells.

## Context files

- `GAME.md` — “Spells”, “Persistent energy, recovery, and cooldowns”, and “Stances, objectives, and automatic abilities”.
- `docs/gameplay_overhaul/GAME_GAPS.md` — GAP-003 and GAP-005 evidence.
- `src/combat.js` — current authoritative damage values and weapon range interface.
- `src/units.js` — current unit records have no ability or energy fields.
- `src/cards.js` — TASK-001 planned card definitions (read when available; do not edit).

## Exact files this task may edit

- `src/abilities.js`

## Files this task must not edit

- Every file except `src/abilities.js`, including all task docs/logs, `task_list.md`, `src/ui.js`, `src/units.js`, and all existing user-modified files.

## Steps

1. Export plain-data defaults/initialization for per-unit energy, maximum energy, ability priority, cooldowns, stance, and objective. Use stable ability IDs and document prototype defaults.
2. Implement a bounded ordered evaluator that checks ability costs, cooldowns, conditions and target validity; supports at least Pike Rally as a recovery example, applies HP healing up to max HP, advances cooldowns using the stated convention, and cannot loop on energy generation.
3. Define an initial spell catalog covering Mend, Ward, and Fireburst, with cost, target restrictions, duration/effect metadata.
4. Implement queue, cancel/retarget, affordability validation, and a battle-start spell resolver using explicit target tracking and one-time payment. Invalid/cancelled plays must not charge or consume; queued spells must not resolve during the planning call.
5. Keep type-wide transferable skills in a separate loadout data structure and ensure new instances of a type can read the shared loadout.
6. Append timestamped progress/completion to the assigned log. Run the relevant project build check and report exact result.

## Dependencies

None. Prefer an API that TASK-002 can call for finite preparation/healing batches later; do not edit TASK-002's file.

## Measurable acceptance criteria

- Exported state and resolvers use plain records and injected RNG only if randomness is needed.
- An ability order is evaluated left-to-right with explicit energy/cooldown/condition checks and a finite maximum ability count per activation.
- Rally heals at most 10 and never exceeds max HP; a cooldown of two used in round five is unavailable in round six and ready in round seven.
- Mend/Ward/Fireburst identify legal target modes and explicit duration/effect; queued spells resolve only when the battle-start resolver is called and commit cost exactly once.
- Skill loadouts are keyed by unit type and are structurally distinct from queued spell cards.
- Relevant project build completes; completion log gives command and result.
