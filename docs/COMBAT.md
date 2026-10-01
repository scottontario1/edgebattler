# Continuous combat

Current browser default, reviewed 2026-10-01. Pure engine/older simulators retain discrete defaults; opt in with `combat: {duration:18}`. Browser `combat=classic` selects discrete battles.

End Round locks planning and runs a deterministic phase up to 18 seconds. Units pursue legal enemies and repeatedly move/attack. Simulation tick: 0.25 seconds. Movement interval: 0.8 seconds quantized to ticks. First attack readiness: 0.75 seconds. Out-of-range units retain readiness and retarget legal enemies on subsequent attacks.

Attack interval: `clamp(2.8 - 0.12 × (SPD - 4) + classDelay, 1.2, 3.5)` seconds. Pikemen add 0.1, Cavaliers subtract 0.15, Knights/Berserkers add 0.3; others add zero. Explicit per-unit intervals can override the base expression. These are provisional defaults in `src/timed-battle.js`.

Damage uses existing strike rules with a provisional 0.35 multiplier after flat passive mitigation. Same-time strikes resolve simultaneously; units killed earlier cannot act later. Barriers/Brace are finite pools. Post-movement passives rebuild without accumulating, and strike buffs are consumed according to their rule. Pursuit avoids occupied allied tiles.

Elimination can end combat early. Empty-field travel ends after arrival or idling. Capture, death objects, revenants, respawn, waves and income remain phase-boundary operations. Playback keeps starting round/economy on the HUD and folds the shop; hidden browser pages pause playback.

## Retained skill timeline

Normal main disables active skills/spells. Restored skills have three slots attempting casts at 3/9/15 seconds, only at their own window. Unmet requirements skip rather than retry. Empty slots are valid; no duplicate copies of a skill. Energy is individually capped and gains +1 at windows when abilities are enabled; cooldowns remain individual/round-based.

One plan is shared by type across field, bench and future deployments/respawns. Skills group by variant/named unit/class identity; Shards by base class. [Switches](ARCHIVED_COMBAT.md); [next branch](NEXT_SKILLS_BRANCH.md). Early completion can leave later windows unattempted; absence is not a failed cast.
