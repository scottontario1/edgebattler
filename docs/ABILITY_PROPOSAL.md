# SYS-01 prototype ability proposal

Revised on 2026-09-29. Confirmed MVP direction supersedes the earlier automatic-priority proposal. Ability numbers below remain proposals, not approved default balance. Do not implement the superseded shared priority editor as MVP work.

## Confirmed changes and open contracts

- Players pick active abilities during planning; player-managed automatic priority is shelved for the MVP and may return later. Movement, targeting and combat resolution remain automatic after one Resolve battle command.
- Type-wide equipped skills remain shared. Active picks are per unit for now, with group selection/apply-to-class controls; this selection scope may change later. Multiple active abilities may be picked, resolved in fixed effect phases rather than user priority. Picks persist until changed, with an out-of-energy exception still needing definition: clear picks versus suspend their execution. Optional automatic Rally remains open.
- Brace temporarily forces defensive/Hold stance for that battle, applied before automatic movement. Restore the persistent stance afterward; repeated Brace can apply the temporary override again when legal. Decide whether this override requires an affordable/ready cast and what happens if Brace never receives an attack.
- Cavalier Charge requires Advance already selected; picking Charge does not set or change stance automatically.
- Flanking is a passive bonus on Cavalier side/back attacks, including Charge; it is not an active pick. Players may set facing in planning, and automatic movement can change direction. Lock facing before the attack batch so attack animation cannot erase an earned flank. Exact direction updates and starting facing require a deterministic rule. Future Cavalier auto-battle behavior should emphasize flank opportunities; keep that tactical AI enhancement explicit as future scope. Preview flank eligibility from authoritative facing, not incidental sprite direction.
- Advancing battle movement is approximately two-thirds of planning movement, as a separate allowance. Prototype fraction is confirmed as a tuning direction; rounding and terrain-cost treatment remain open. Existing full/full movement is superseded.

## Proposed shared values

Start at 0 energy, max 4, +1 at each planning refresh including round 1; clamp overflow. Reserves receive the baseline plus their existing extra +1. Costs and cooldowns are checked before committing an ability. Reservation, cancellation/refunds, invalidation and the out-of-energy persistence exception still need agreement. Multiple picked abilities require an explicit affordability rule so fixed phases do not silently introduce a new user-priority system. Basic attacks/movement remain free. Cooldown 2 used in round 5 is ready in round 7.

Selected recovery/support effects and attack enhancements need explicit phases; no user priority editor or repeated-cast chain. Suggested prototype phases: apply stance constraints, resolve simultaneous movement, apply selected recovery/protection, then simultaneous enhanced/basic attacks. This is proposed timing, not an approved lethal-action or cross-faction spell contract.

Existing purchased Barrier remains the current passive 2 damage reduction per battle unless Scott explicitly changes it. It is separate from active Brace.

## Proposed kits for approval

**Pikeman Rally:** restore 10 HP, +1 energy now and next round, cooldown 2 (user-specified). Proposed cost 0. Only useful when healing or a bonus energy gain can be used. Planning selection versus automatic recovery remains open.

**Pikeman Brace:** proposed cost 2, cooldown 2, absorb up to 4 total incoming basic-attack damage this round; forces defensive/Hold stance before movement. Proposed stacking with equipped Barrier after Ward reduction; unused absorption expires after combat. Temporary defense is confirmed; payment if no attack arrives remains open.

**Archer Focused Shot:** proposed cost 2, cooldown 2, +4 basic-attack damage and +20 percentage points hit chance capped at 100%; no additional attack. Requires an eligible ranged target; CORE-01 targeting correction is prerequisite.

**Cavalier Charge:** requires Advance. Proposed cost 2, cooldown 2, +4 damage on this round's basic attack if the Cavalier actually moves at least one tile during battle and reaches a legal melee target. Uses the ordinary reduced battle movement budget, not extra movement. User confirmed Advance requirement; effect/cost/movement trigger remain proposals.

**Cavalier flanking:** side/back geometry confirmed; proposed +4 damage on a qualifying melee strike. Passive and stacking with Charge are confirmed. Exact bonus value and deterministic facing semantics remain open. The old opposite-ally trigger is withdrawn.

**Cavalier Second Wind:** proposed cost 1, cooldown 3, restore 6 HP at or below half maximum, usable outside combat. Remains proposed; not required by the user's latest correction.

## Verification and completion

Verify selection/cancellation/invalidation, affordability, cooldown timing, independent unit state, reserve preservation, optional selection/no compulsory per-unit click-through, temporary Brace stance restoration, Charge Advance eligibility, multiple selections/fixed phases, group application and the out-of-energy exception, reduced movement budgets and front/side/back facing. Demonstrate the three recruit kits over multiple browser rounds. Verify both factions and deterministic AI/log replay. Report ability use, energy spent/capped, match outcomes/duration and strategic differences before recommending balance changes.

Priority controls are deferred; selected abilities, stance constraints and facing are the active system scope. No new character art or campaign is required. Record genuine dependencies within this pass.
