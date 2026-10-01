# Timed combat timing experiment

Status: provisional harness results; no candidate timing profile is adopted as a shipped default.

`tools/compare-timed-combat.mjs` compares an 18-second combat clock with three candidate rhythms. The primary profile uses a 0.25-second fixed simulation step, speed-based basic-attack intervals, skill windows at 3, 9 and 15 seconds, and a provisional 0.35 damage multiplier. The alternatives use two windows at 6 and 13 seconds with 0.30 damage, or three windows with 0.30 damage and attack intervals accelerating by up to 30% across the battle. Current resolver skill windows only emit timeline markers unless a callback is supplied, so this first run measures cadence and damage only; it does not compare real skill activations.

The fixtures are a pikeman-versus-cavalier duel, a mixed ranged screen, and a hold-line formation. Each of 100 seeds runs in both faction assignments (200 games per profile and fixture). The command reports normalized wins/draws, surviving HP, attack count, first strike, hit rate, damage and duration. Results from the initial run:

| Fixture | Three-beat steady | Two-beat slower | Three-beat accelerating |
|---|---|---|---|
| Duel | 190/0/10 wins/losses/draws; 14 attacks; 9.1 average damage per side | 190/0/10; 14 attacks; 9.1 damage | 196/0/4; 16 attacks; 10.4 damage |
| Ranged screen | 110/62/28; 35 attacks; 21.0 damage per side | 110/62/28; 35 attacks; 21.0 damage | 186/10/4; 40 attacks; 24.2 damage |
| Hold line | 0/200/0; 35 attacks; 21.1 damage per side | 0/200/0; 35 attacks; 21.1 damage | 0/200/0; 40 attacks; 24.2 damage |

The accelerated profile consistently adds five attacks in the mixed formations and roughly 3 damage per side; in the duel it adds two attacks and 1.3 damage. The two non-accelerated profiles produce identical outcomes because the fixtures have no active abilities and coarse integer damage rounds the 0.30/0.35 values to the same per-hit result. This is evidence that rate acceleration changes combat throughput, not that it improves gameplay. The hold-line fixture also shows the limitation of tiny static tests: its outcome remains one-sided across every seed and profile.

## Follow-up

Wire actual selected-skill callbacks before comparing skill-window timing. Then run full-match paired-seed tests for mixed 5v5 armies, Hold defenses against Advance, ranged screens against cavalry flanks, crowded chokepoints, terrain and wall interactions, a unit dying before the first skill window, simultaneous lethal attacks, and keep defense/attack. Record time-to-first-hit and time-to-first-death per unit, successful abilities per selected unit, target switches, stuck movement, survivor HP and round-level wins/draws. Repeat with side swaps and replay checks before proposing defaults.

## Known integration risks

Movement currently plans one step from a shared snapshot per resolve. Repeated movement needs a clear cadence, occupancy/collision rules and target-retargeting policy. Same-time strikes should use one snapshot to preserve simultaneous lethality. Abilities should spend energy and start cooldown once per battle activation. Round-based death, champion respawn, persistent HP/energy and queued spell timing need explicit boundaries. Playback speed and pause must not alter simulation results.


## Integrated prototype and verification

Root selected steady three-beat combat (18s; skill windows 3/9/15s; 0.35 strike damage). The fixed simulation uses 0.25s ticks. Attack cadence combines existing SPD and class delays; first readiness is 0.75s. Each window grants +1 capped energy, retries eligible selected skills and allows one success per skill per combat phase. The existing round cooldown system is retained. Browser default is timed; `?combat=classic` is the baseline comparison. Direct match factories opt in using `combat:{duration:18}`. Header configuration is preserved by replay.

Refinements from integration: full-range path planning chooses one free next tile and avoids friendly transit tiles, fixing blocked melee lines. Flat passive mitigation is applied before timed damage scaling, fixing accidental immunity in the final defensive encounter. Barriers/Brace deplete across incoming attacks; active strike buffs are consumed by a strike; passives are rebuilt on post-movement snapshots without accumulating. Dead units cannot act later, while simultaneous lethal strikes both land. Spawned blockers appear at their skill window, cannot share tiles, and destroyed/consumed objects leave playback at their events. Spell-lethal sprites animate their death immediately. Corpses/revenants/capture/respawn remain round-boundary actions.

Tests: 223 total, 218 pass, zero failures, five existing TODOs. New checks cover cadence, simultaneity, dead attackers, ranged retargeting, movement collisions, barrier pools, deterministic events, scaled passive mitigation, skill timing/limits, empty-field regroup and same-window spawn occupancy. Production build passes with the pre-existing large-bundle warning.

`node tools/check-timed-campaign.mjs` completes all 15 faction/mission combinations at seed7 with exact replay, using normal march/regroup/rally actions and automatic kits. North Road takes 4–5 phases, Woods 7 phases and Pass 7–12 phases. These scripted starting armies are evidence of playable flow, not difficulty/balance certification.

With a dev server running, `PORT=5180 node tools/verify-timed-combat.mjs` and `--mobile` exercise a durable 300-HP combat fixture for the full real 18s, record 46 attacks and skills at 3/9/15s, verify input lock/start-round economy and return to planning. The artificial HP fixture isolates timing and is not presented as a normal replayable playtest. `tools/verify-timed-spell.mjs` verifies a spell-lethal sprite disappears while combat continues. Normal `tools/verify-campaign.mjs road crown 1280 800` finishes round4 with both regroup/rallies, saved statistics and exact replay; `pass court 960 480` finishes round9 with exact replay. Console checks report no errors. Screenshot evidence lives in docs/campaign/evidence/timed-combat-*.png, timed-spell-death.png and the refreshed mission victory captures.

The experiment is isolated in its own worktree/branch and incorporates the incoming Shards UI for compatibility. Main retains its own development work. Remaining choices: tune attack/damage/phase pacing after human feedback; skills currently share three checkpoints rather than editable per-character slots; attacks are quantized to simulation ticks; broad skirmish stall/capture balance remains open.


## Player-assigned skill windows

Scott chose three per-unit skill slots: slot1 at3s, slot2 at9s, slot3 at15s. The editor supports dragging from the kit or between slots, selecting a skill then selecting a slot (touch/keyboard), clearing slots and saving the same timeline to exact-type groups. Placing a skill replaces the destination and empties its prior location. A skill may occupy one slot; empty slots remain empty. Saving is atomic and logs skillSlots; selectedAbilities remains derived for the existing kit/AI/UI contracts. Slots do not require full up-front energy, because each scheduled skill checks energy and cooldown at execution. A failed assigned-window trigger is skipped for that phase. Previous automatic-window timed logs remain replayable via explicit legacy skillMode.

Verification: 227 checks total /222pass /zero failures /five existing TODOs. Fifteen seeded campaign/faction combinations complete and replay with the new defaults. Desktop/portrait interaction driver tools/verify-skill-slots.mjs exercises drag/drop, moving Brace to15s, select/place Rally at3s, group-save, one live combat and exact replay. Evidence: docs/campaign/evidence/skill-slots-desktop.png and skill-slots-portrait.png. The new tests verify actual15s activation, missed-window non-retry, invalid/duplicate group atomicity, clear and move semantics. Build retains the existing large-bundle warning. Future: repeated same-skill slots or variable window times require separate decisions.
