# SYS-01 prototype ability proposal

Revised on 2026-09-29. Confirmed MVP direction supersedes the earlier automatic-priority proposal. Ability numbers below remain proposals, not approved default balance. Do not implement the superseded shared priority editor as MVP work.

## Confirmed changes and open contracts

- Players pick active abilities during planning; player-managed automatic priority is shelved for the MVP and may return later. Movement, targeting and combat resolution remain automatic after one Resolve battle command.
- Type-wide equipped skills remain shared. Active picks are per unit for now, with group selection/apply-to-class controls; this selection scope may change later. Multiple active abilities may be picked, resolved in fixed effect phases rather than user priority. Picks persist until changed; unaffordable picks remain selected but execution is suspended until energy recovers. Planning edits must fit the total picked energy cost into available energy and show shortfalls. Rally uses the same explicit planning selection as other active skills; it repeats while selected, ready and useful.
- Brace temporarily forces defensive/Hold stance for that battle, applied before automatic movement. Restore the persistent stance afterward; repeated Brace can apply the temporary override again when legal. Decide whether this override requires an affordable/ready cast and what happens if Brace never receives an attack.
- Cavalier Charge requires Advance already selected; picking Charge does not set or change stance automatically.
- Flanking is a passive bonus on Cavalier side/back attacks, including Charge; it is not an active pick. Players may set facing in planning, and automatic movement can change direction. Lock facing before the attack batch so attack animation cannot erase an earned flank. Facing after automatic movement follows the final path step. Stationary units keep their planning facing. Starting facing still needs a deterministic initialization; proposed default faces the opposing keep. The user wrote 32A in response to question 31; this final-step interpretation is recorded as an assumption, not a new numbered approval. Future Cavalier auto-battle behavior should emphasize flank opportunities; keep that tactical AI enhancement explicit as future scope. Preview flank eligibility from authoritative facing, not incidental sprite direction.
- Advancing battle movement is approximately two-thirds of planning movement, as a separate allowance. Prototype fraction is confirmed as a tuning direction; rounding and terrain-cost treatment remain open. Existing full/full movement is superseded.

## Proposed shared values

Start at 0 energy, max 4, +1 at each planning refresh including round 1; clamp overflow. Reserves receive the baseline plus their existing extra +1. Costs and cooldowns are checked before committing an ability. Total-cost validation in planning and suspension rather than clearing are confirmed. Reservation, cancellation/refunds and invalidation remain proposed below. Multiple picks must not silently turn fixed phases into a new user-priority system. Basic attacks/movement remain free. Cooldown 2 used in round 5 is ready in round 7.

Selected recovery/support effects and attack enhancements need explicit phases; no user priority editor or repeated-cast chain. Suggested prototype phases: apply stance constraints, resolve simultaneous movement, apply selected recovery/protection, then simultaneous enhanced/basic attacks. This is proposed timing, not an approved lethal-action or cross-faction spell contract.

Existing purchased Barrier remains the current passive 2 damage reduction per battle unless Scott explicitly changes it. It is separate from active Brace.

## Proposed kits for approval

**Pikeman Rally:** restore 10 HP, +1 energy now and next round, cooldown 2 (user-specified). Proposed cost 0. Only useful when healing or a bonus energy gain can be used. Requires planning selection, persists like other picks and fires only when useful; it is not an independent automatic recovery exception.

**Pikeman Brace:** proposed cost 2, cooldown 2, absorb up to 4 total incoming basic-attack damage this round; forces defensive/Hold stance before movement. Proposed stacking with equipped Barrier after Ward reduction; unused absorption expires after combat. Temporary defense is confirmed; payment if no attack arrives remains open.

**Archer Focused Shot:** proposed cost 2, cooldown 2, +4 basic-attack damage and +20 percentage points hit chance capped at 100%; no additional attack. Requires an eligible ranged target; CORE-01 targeting correction is prerequisite.

**Cavalier Charge:** requires Advance. Proposed cost 2, cooldown 2, +4 damage on this round's basic attack if the Cavalier actually moves at least one tile during battle and reaches a legal melee target. Uses the ordinary reduced battle movement budget, not extra movement. User confirmed Advance requirement; effect/cost/movement trigger remain proposals.

**Cavalier flanking:** side/back geometry confirmed; proposed +4 damage on a qualifying melee strike. Passive and stacking with Charge are confirmed. Exact bonus value and deterministic facing semantics remain open. The old opposite-ally trigger is withdrawn.

**Cavalier Second Wind:** proposed cost 1, cooldown 3, restore 6 HP at or below half maximum, usable outside combat. Remains proposed; not required by the user's latest correction.

## Verification and completion

Verify selection/cancellation/invalidation, affordability, cooldown timing, independent unit state, reserve preservation, optional selection/no compulsory per-unit click-through, temporary Brace stance restoration, Charge Advance eligibility, multiple selections/fixed phases, group application and the out-of-energy exception, reduced movement budgets and front/side/back facing. Demonstrate the three recruit kits over multiple browser rounds. Verify both factions and deterministic AI/log replay. Report ability use, energy spent/capped, match outcomes/duration and strategic differences before recommending balance changes.

Priority controls are deferred; selected abilities, stance constraints and facing are the active system scope. No new character art or campaign is required. Record genuine dependencies within this pass.

## Proposed MVP execution contract for final approval

- New/edited picks must fit the unit's current energy; do not credit future Rally energy to make planning legal. Show total cost and any shortfall. If persistent picks become unaffordable in a later round, keep them selected and suspend the paid bundle together; free selected Rally and basic movement/attacks remain available. This bundle rule is proposed to avoid hidden energy-spending priority and must be approved.
- Picking and cancelling during planning spends no energy. Commit a legal ability's cost exactly once when it executes; invalid target/trigger/stance skips incur no cost or cooldown. A ready, affordable selected Brace commits before movement and forces temporary Hold; it costs energy even if no attack arrives. Charge needs Advance already selected, actual automatic movement of at least one tile, and a legal melee target; otherwise it does not spend or start cooldown.
- Proposed effect phases: ready Brace stance/protection commitment, simultaneous movement with final-step facing, useful selected Rally/Second Wind recovery, attack-enhancement commitment, simultaneous basic attacks, cleanup and restoration of persistent stance. Active IDs can execute at most once per unit per round. No selectable priority or repeat-cast chain. Cross-faction spell timing remains a separately tracked core gap.
- Reduced Advance movement uses max(1, round(planning MOV * 2/3)) movement-cost points with the existing terrain costs: MOV 4 -> 3, MOV 5 -> 3, MOV 7 -> 5. This is a proposed rounding default within the confirmed approximate two-thirds direction.
- MVP passive flanking applies +4 flat damage before critical multiplication to a qualifying side/back Cavalier attack and stacks with Charge's proposed +4. Facing is one of four cardinal directions; side/rear classification uses adjacent melee positions and locked target facing. No immediate turn-to-attacker before damage. Future auto-movement preference for flanks remains deferred.
- All three recruit classes: max energy 4, initial 0 before round-1 +1 baseline; field +1 each planning refresh, reserves baseline + existing extra +1; clamp overflow. Rally: cost 0 / cooldown 2 / heal 10 / +1 now and next. Brace: cost 2 / cooldown 2 / absorb 4. Focused Shot: cost 2 / cooldown 2 / +4 damage / +20 hit percentage points capped at 100. Charge: cost 2 / cooldown 2 / +4 damage. Second Wind: cost 1 / cooldown 3 / heal 6 at or below half HP. Existing Barrier stays passive reduction 2; Ward retains current halving, then absorption/reduction apply.

All values and proposed edge-case contracts above await Scott's approval; confirmed interaction decisions do not imply approval of the balance package. Once approved, implement CORE-01 and SYS-01 under the documented verification requirements before proceeding to SYS-02.