# Verified gameplay gaps

These gaps compare the intended prototype loop in the root `GAME.md` with the current source. The first implementation slice targets a playable card-driven round with persistent units and automatic battle. Later balance and presentation work remains listed where the design itself leaves rules open.

## Prioritized gaps

1. **GAP-001 — No card economy, hand, or paid reserves (Critical).** `GAME.md` → “Cards, hand, and resources” and milestone 1 specify a seeded shared-pool hand, Supply, paid recruitment, reserves, and a population cap. `src/units.js:20–31` hardcodes the full roster in `UNITS`; `src/ui.js:205–244` has no inventory or card state; `createUnits` (`src/units.js:298`) constructs the fixed units at startup.
2. **GAP-002 — No one-command shared battle round (Critical).** `GAME.md` → “Round structure” and “Automatic battle rules” require one Resolve battle command, joint movement, then simultaneous combat. `src/ui.js:343–363` exposes Attack, Wait, and End turn; `src/ui.js:511–558` advances each friendly unit manually and then runs `enemyPhase`; `src/combat.js:63–81` resolves a sequential attacker/counter/follow-up exchange.
3. **GAP-003 — No persistent stance, energy, or ability activation model (High).** `GAME.md` → “Persistent energy, recovery, and cooldowns” and “Stances, objectives, and automatic abilities” require persistent unit state and ordered auto-abilities. The unit records in `src/units.js:20–31` contain no energy, cooldown, stance, objective, or ability fields; `src/ai.js:9–34` only chooses a strike or advances toward the nearest foe.
4. **GAP-004 — No optional star upgrades (High).** `GAME.md` → “Three-of-a-kind upgrades” requires explicit matching across reserve and deployed copies, stat previews, and an optional choice. There is no combination system or star field in `src/units.js:20–31`; the only unit constructor produces fixed one-off records.
5. **GAP-005 — No spell-card queue or type-wide skill loadout (High).** `GAME.md` → “Spells” and the ability/loadout sections require planning-time spell queueing and transferable shared skills. `src/ui.js:235–244` has no planning card state, and `src/combat.js` only models weapon exchanges; neither a spell nor skill inventory/resolver exists.
6. **GAP-006 — Match end rules contradict the intended objective (High).** `GAME.md` → “Current demo foundation” and “Three-of-a-kind upgrades” say the standard objective is the enemy keep and hero death should not normally end the match. `src/ui.js:468–480` awards a win for routing all red units or entering any `K` tile, and declares defeat when Brenna dies or all blue units die.
7. **GAP-007 — Captures, reinforcements, and survivor state are not part of the round loop (Medium).** `GAME.md` → “Deploying units and controlling territory” calls for persistent village control, controlled-location deployment, and surviving state across rounds. The map has terrain symbols (`src/maps/river_ford.js`), but no control/deployment state is stored; `src/ui.js:535–558` only resets the `done`/`moved` flags after the enemy phase.

## Scope note

The source confirms these were absent or materially different at initial inspection, rather than merely undocumented. The first pass added isolated, deterministic gameplay rule modules, then connected the supported loop through the shared UI/unit layer. Values and edge cases explicitly called open in `GAME.md` use named prototype defaults and remain tunable.

## Implementation outcomes from this pass

This register records the verified starting gaps above. The code now implements the following first slice, but the integrated game build could not be verified because the configured Node launcher fails before Vite starts; see `task_list.md` and the task logs.

- **GAP-001:** Added seeded hand draws, Supply, recruitment costs, reserve/population limits, reserve deployment rules, and the planning dock. Reserve withdrawal/recovery, selling, and recycling remain open.
- **GAP-002:** Added a shared movement/combat batch resolver and a single Resolve battle flow with event playback. Follow-up/reaction timing and end-to-end browser behavior remain unverified.
- **GAP-003:** Added persistent stance, energy, cooldown, status, and bounded Rally handling. The UI changes Advance/Hold but does not yet edit Protect objectives or ability priority; multiple abilities, passives, and toggles remain future work.
- **GAP-004:** Added explicit three-of-a-kind match, preview, survivor/destination choice, population projection, and combine behavior.
- **GAP-005:** Added Mend, Ward, and Fireburst queue rules plus Barrier as a paid, transferable type-wide skill. The dock now equips and transfers Barrier between Pikeman, Archer, and Cavalier loadouts; each friendly unit of the equipped type reduces its total incoming damage by 2 in the next battle. More skill cards, priority editing, and loadout verification remain future work.
- **GAP-006:** Changed the win check to enemy-keep occupation and added delayed, Supply-costed Brenna respawn.
- **GAP-007:** Added persistent village ownership, controlled-location deployment, and survivor state across rounds. Enemy recruitment under the shared card rules and withdrawal/recovery are not implemented.
