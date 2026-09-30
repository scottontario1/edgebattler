# SYS-01 prototype ability proposal

Revised on 2026-09-29. Confirmed MVP direction supersedes the earlier automatic-priority proposal. Ability numbers below remain proposals, not approved default balance. Do not implement the superseded shared priority editor as MVP work.

## Confirmed changes and open contracts

- Players pick active abilities during planning; player-managed automatic priority is shelved for the MVP and may return later. Movement, targeting and combat resolution remain automatic after one Resolve battle command.
- Type-wide equipped skills remain shared. Whether active picks apply per unit or class, number of picks, persistence and optional automatic Rally remain to be confirmed. Shared equipment/old shared priority does not settle these new questions.
- Brace forces defensive/Hold stance. That stance must be applied before automatic movement. Whether it persists afterward remains open.
- Cavalier Charge requires Advance. Decide whether picking Charge sets Advance or requires the player to set it separately.
- Flanking means striking the enemy's side or back, replacing the opposite-ally geometry proposal. Units need explicit facing; facing control and lock timing are open. Preview flank eligibility from the same authoritative state used by combat; incidental sprite direction must not decide the result.
- Advancing battle movement is approximately two-thirds of planning movement, as a separate allowance. Prototype fraction is confirmed as a tuning direction; rounding and terrain-cost treatment remain open. Existing full/full movement is superseded.

## Proposed shared values

Start at 0 energy, max 4, +1 at each planning refresh including round 1; clamp overflow. Reserves receive the baseline plus their existing extra +1. Costs and cooldowns are checked before committing an ability. Reservation, cancellation/refunds, invalidation and selection persistence still need agreement. Basic attacks/movement remain free. Cooldown 2 used in round 5 is ready in round 7.

Selected recovery/support effects and attack enhancements need explicit phases; no user priority editor or repeated-cast chain. Suggested prototype phases: apply stance constraints, resolve simultaneous movement, apply selected recovery/protection, then simultaneous enhanced/basic attacks. This is proposed timing, not an approved lethal-action or cross-faction spell contract.

Existing purchased Barrier remains the current passive 2 damage reduction per battle unless Scott explicitly changes it. It is separate from active Brace.

## Proposed kits for approval

**Pikeman Rally:** restore 10 HP, +1 energy now and next round, cooldown 2 (user-specified). Proposed cost 0. Only useful when healing or a bonus energy gain can be used. Planning selection versus automatic recovery remains open.

**Pikeman Brace:** proposed cost 2, cooldown 2, absorb up to 4 total incoming basic-attack damage this round; forces defensive/Hold stance before movement. Proposed stacking with equipped Barrier after Ward reduction; unused absorption expires after combat. Decide stance duration and payment if no attack arrives.

**Archer Focused Shot:** proposed cost 2, cooldown 2, +4 basic-attack damage and +20 percentage points hit chance capped at 100%; no additional attack. Requires an eligible ranged target; CORE-01 targeting correction is prerequisite.

**Cavalier Charge:** requires Advance. Proposed cost 2, cooldown 2, +4 damage on this round's basic attack if the Cavalier actually moves at least one tile during battle and reaches a legal melee target. Uses the ordinary reduced battle movement budget, not extra movement. User confirmed Advance requirement; effect/cost/movement trigger remain proposals.

**Cavalier flanking:** side/back geometry confirmed; proposed +4 damage on a qualifying melee strike. Open: passive bonus versus selected active skill, stacking with Charge, and facing semantics. The old opposite-ally trigger is withdrawn.

**Cavalier Second Wind:** proposed cost 1, cooldown 3, restore 6 HP at or below half maximum, usable outside combat. Remains proposed; not required by the user's latest correction.

## Verification and completion

Verify selection/cancellation/invalidation, affordability, cooldown timing, independent unit state, reserve preservation, optional selection/no compulsory per-unit click-through, Brace stance enforcement, Charge eligibility, reduced movement budgets and front/side/back facing. Demonstrate the three recruit kits over multiple browser rounds. Verify both factions and deterministic AI/log replay. Report ability use, energy spent/capped, match outcomes/duration and strategic differences before recommending balance changes.

Priority controls are deferred; selected abilities, stance constraints and facing are the active system scope. No new character art or campaign is required. Record genuine dependencies within this pass.
