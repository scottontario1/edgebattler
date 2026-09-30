# SYS-01 approved MVP ability contract

Scott approved this package on 2026-09-29 after design elicitation. The implementation uses these prototype defaults; later balance changes need explicit selection. Automatic ability prioritization remains deferred.

## Planning and persistence

Players pick active abilities per unit with optional same-class group selection. Groups can select a subset or all living field units of the class. Apply validates every member before changing any. Multiple picks resolve in fixed phases, never user priority. Picking, clearing and cancelling spend no energy. New/edited selections must fit total cost into current energy; future Rally gains cannot fund planning. Picks repeat until changed. If retained paid picks exceed available energy at battle start, suspend the entire paid bundle for that battle, while free selected Rally, movement and basic attacks remain available. Cooldown-blocked paid picks still count toward the bundle reservation; there is no hidden spending priority.

Charge requires Advance already selected when edited and when executed. It never changes stance. Ready affordable Brace temporarily overrides movement to Hold for one battle; persistent stance remains intact. It commits even without incoming attacks. Invalid triggers or missing targets spend nothing and start no cooldown. Cooldown 2 used in round 5 is unavailable in 6 and ready in 7. Each active ID executes at most once per unit per round.

## Energy and kits

All current units have max energy 4 and initial 0 before the round-1 +1 baseline. Field units gain +1 each planning refresh. Reserves gain that baseline plus their extra +1, heal 4 HP, and tick cooldowns. Clamp overflow. A newly purchased reserve starts at 0; recruiting or deploying does not retroactively grant this round's refresh. Withdraw/redeploy preserve picks, facing, cooldowns, HP, energy and pending Rally bonus. The next refresh consumes that bonus exactly once. Champions respawn with cleared picks/cooldowns and 1 energy after their arrival baseline.

- **Pikeman Rally:** cost 0, cooldown 2, heal 10, +1 energy now and next refresh. Explicit selection required. Executes only when healing or bonus energy can be used.
- **Pikeman Brace:** cost 2, cooldown 2, temporary Hold before movement; absorb 4 total incoming basic damage this battle, then expire. Paid even without attacks.
- **Archer Focused Shot:** cost 2, cooldown 2, +4 damage and +20 hit percentage points (cap 100) on its ordinary strike. Requires a legal ranged target; no extra attack.
- **Cavalier Charge:** cost 2, cooldown 2, +4 ordinary-strike damage. Requires Advance, actual automatic movement of at least one tile, and a legal melee target. Uses the regular reduced movement budget.
- **Cavalier Second Wind:** cost 1, cooldown 3, heal 6 at or below half HP, usable without combat.
- **Cavalier Flank:** passive +4 on adjacent side/back attacks, stacking with Charge before critical multiplication. No active pick.
- **Purchased Barrier:** remains passive 2 total absorption per battle. Ward halves each incoming hit first, then Brace and Barrier absorb across the incoming batch. No carried absorption or attack enhancement after cleanup.

## Facing, movement and fixed phases

Facing is north/east/south/west. Initial blue faces north, red south toward the opposing end of the map. Planning allows explicit facing changes; planning movement and accepted battle movement face the final path step. Stationary units retain facing. Lock before simultaneous strikes; animation does not turn authoritative facing toward an attacker.

Advance gets max(1, round(MOV * 2/3)) movement-cost points: 4 -> 3, 5 -> 3, 7 -> 5, preserving terrain costs. This is independent of full planning movement. Hold gets 0. Protect retains its existing full movement allowance. Future Cavalier movement preference for flanks remains deferred. Gold overlays preview current side/back attack tiles, not a promise about an enemy's post-move facing.

Execution: existing queued spells; ready Brace commitment; simultaneous movement/final facing; selected Rally/Second Wind recovery; legal attack enhancements; simultaneous basic strikes; cleanup and next refresh. Paid-bundle eligibility freezes before recovery. Interacting cross-faction spells and mutual keep capture remain CORE-03 decisions.

## Implementation and verification

Engine: abilities.js, battle.js and match.js. Planning actions: abilities with unitId or unitIds and abilityIds; facing with unitId and cardinal facing. UI: select a friendly unit, Plan abilities, toggle picks, optionally select a group, Apply picks. Existing picks need no repeated clicks. The panel exposes costs, cooldowns, shortfalls and suspended picks; markers show authoritative facing. Type-wide purchased equipment remains distinct.

Verification evidence and limitations are recorded in CURRENT_GAPS.md and SYS01_VERIFICATION.md. The next system is SYS-02 card circulation/capacity. No priority editor, new art, card recycling rules or keep balance changes were added in this pass.
