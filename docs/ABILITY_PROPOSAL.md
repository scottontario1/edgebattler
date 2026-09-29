# SYS-01 prototype ability proposal

Status: proposed for Scott's approval on 2026-09-29; not approved for implementation or default balance changes. This proposal implements the confirmed energy/abilities-first roadmap. Confirmed choices: priority is shared by unit type and inherited by future recruits; players can enable/disable abilities without a minimum-energy reserve control; Rally fires when healing or energy gain is useful; the prototype covers Pikeman, Archer and Cavalier; Scott approves concrete kits before implementation.

## Proposed shared rules

- Start at 0 energy, maximum 4 for all three recruit classes. Gain 1 at the start of each planning round, including round 1. Clamp overflow; do not add attack/damage energy bonuses in this initial kit.
- Reserves receive the same baseline plus the current extra 1 energy per round. Preserve HP, energy and cooldowns on deployment/withdrawal. This proposes baseline energy in addition to existing reserve recovery, not a reset on deployment.
- Shared class loadout panel: drag/reorder abilities left to right and enable/disable each. Proposed toggles are shared by class as well. HP, energy, cooldowns and status effects remain per unit. No energy reserve threshold or per-round manual casting is required.
- Abilities run after simultaneous movement. In each synchronized ability wave, each living unit selects its next eligible enabled ability from its shared priority row. Apply each wave as a simultaneous batch, then evaluate the next wave. At most one use per ability and three active uses per unit per round. After abilities, resolve simultaneous basic attacks, including strikes declared by units lethally hit in that attack wave.
- Cooldown 2 used in round 5 is unavailable in 6 and ready in 7. Skip disabled, cooling-down, unaffordable and invalid-trigger skills. Skip without paying or starting cooldown. Basic attacks/movement stay free.
- Existing equipped Barrier remains the current passive 2 damage reduction per unit per battle. Do not silently convert that purchased skill to an energy-spending active. A disabled passive supplies no effect; enabled passives do not occupy active cast limits. Offensive enhancements expire after that round's basic-attack batch and never persist accidentally.

## Pikeman: sustain and frontline protection

Default priority: Rally, Brace. Both enabled.

**Rally:** cost 0, cooldown 2. Restore 10 HP; gain 1 energy immediately and 1 at the next planning refresh. Trigger when HP is below maximum or immediate/next-round bonus energy can be useful. Consider the scheduled next-round baseline when testing usefulness; full HP and energy with no usable bonus must not trigger. Never require a nearby enemy.

**Brace:** cost 2, cooldown 2. Absorb up to 4 total incoming basic-attack damage this combat round. Trigger if a living enemy can attack the Pike from the post-movement snapshot. Consume a battle-wide absorption budget rather than reducing every hit by 4. Proposed stacking: Brace's remaining absorption and equipped Barrier's 2 reduction can both apply, after Ward's existing damage reduction. Unused Brace expires after combat.

## Archer: deliberate burst damage

Default priority: Focused Shot. Enabled.

**Focused Shot:** cost 2, cooldown 2. Enhance this round's basic attack with +4 damage and +20 percentage points to hit chance, capped at 100%; no additional attack and no change to critical chance. Trigger only when an enemy is at legal weapon range. First fix eligible target selection so an adjacent enemy cannot prevent firing at a legal range-2 target.

One active skill is deliberate for the first ranged kit; it tests charging and burst without inventing a recovery skill for every class. Additional Archer skills are expansion backlog items.

## Cavalier: flank pressure and recovery

Default priority: Flanking Strike, Second Wind. Both enabled.

**Flanking Strike:** cost 2, cooldown 2. Enhance the basic attack by +4 damage when a living friendly unit stands on the exact opposite adjacent tile from the Cavalier across that target after movement. Example: target (6,5), Cavalier (5,5), friendly unit (7,5). Do not require facing or past-round history; no extra attack or movement allowance. Choose a legal qualifying target and retain it for the enhanced attack.

**Second Wind:** cost 1, cooldown 3. Restore 6 HP when current HP is at or below half maximum. Available outside combat as well. Flanking Strike first means offense can take priority over recovery; reversing the shared row changes that tradeoff.

## Verification and completion

- Verify baseline/overflow, cooldown timing, disabled skills, skipped payments, class-wide priority inheritance, independent unit resource state, reserve preservation and bounded ability waves.
- Demonstrate a charged Archer's enhanced hit, Pike recovery/protection and Cavalier flank/recovery over multiple browser rounds, including opposite priority orders.
- Verify simultaneous strikes, eligible ranged targets, protection stacking and faction symmetry; confirm AI uses the same actions/rules and deterministic logs replay.
- Compare seeded runs against existing policies, reporting outcome/duration, abilities used/skipped, energy spent/capped, class survival and strategic differences. These proposed values require Scott's approval before they become defaults; simulation results may recommend later adjustments.
- This system does not require new character art, new classes or a full campaign. Add genuine dependencies within the pass and record them in DEVELOPMENT.md/CURRENT_GAPS.md.
