# Next branch: restore skills

User direction recorded 2026-10-01: add skills back after integrating Shards/continuous combat. Start a new branch from updated main. This document prepares work; it does not enable skills or create a branch.

The next branch also includes rewards, higher Supply income and purchasable early population capacity. [branch.next.md](../branch.next.md) owns those TBD decisions; run skill comparisons with economy held constant before evaluating the combined progression.

## Accepted design

The army sidebar is the primary editor. Selecting a unit reveals stats and three slots to the right with card icons. Dragging a skill into a slot chooses trigger time. All friendly units of a type share the order, including reserves, later recruits and respawns. Retained implementation uses 3/9/15-second windows in an up-to-18-second phase, with individual energy/cooldowns and failed casts skipped. Keep this starting prototype unless testing supports a recorded change.

Restore active kits alongside Shards; retain identity passives. Specific type grouping for skills differs from base `cls` grouping for Shards. Keep spells separately disabled unless requested. Automatic skill selection is a comparison policy, not the primary interaction.

## Acceptance before merge

- Show three clear slots and live stats without hiding actions. Test desktop, portrait phone and short-height screens; avoid earlier panel/menu overlap.
- Drag/select/reorder/clear immediately save one type plan. Show empties, prohibit duplicates. Verify field/bench/future recruit/respawn inheritance with individual energy/cooldowns.
- Explain casts/skips: death, cooldown, energy, stance, movement or targets. Distinguish skips from windows never reached due to early completion.
- Preserve simultaneous attacks, finite mitigation, passive rebuilding, boundaries and playback locks. Keep Shards buy/apply/remove/combine, stats invariants and spell gating working.
- Log flags, slot orders, seeds, encounters and event outcomes for exact replay. Check saved reports and disclose remaining phone logging limits.
- Pass relevant tests/build, browser interaction and representative mission replays. Record new revision/evidence in [verification](VERIFICATION.md).

## Experiments

Use paired seeds across five factions/three missions with default, reversed and empty player plans, explicitly skills-on/spells-off/Shards-on. Include pressure fixtures where survival, damage and clear time vary even if all win. Change one cadence/damage/timing variable at a time; earlier acceleration changed two together.

Collect outcome, rounds/phases, duration, attacks, surviving HP, separate player/enemy casts, cast/skip reasons by slot, and windows not reached. Preserve raw configuration/data, summarize tradeoffs and device observations. Compare against current main, not only the pre-Shards skill branch.

## Remaining prototype choices

Three-slot interaction is accepted. Evidence should guide failed-cast prominence, usefulness of late windows in short encounters and encounters creating timing tradeoffs. Selectable monster actives, spell restoration, new grouping rules or persistent unlocks are additional design scope; do not silently include them in skill restoration.
