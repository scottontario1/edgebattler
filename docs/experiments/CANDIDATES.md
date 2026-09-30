# Candidate cards and abilities (experimental, not in the game)

Everything here is opt-in and lives beside the game, not in it. The default card pool, kits, costs and rules are unchanged: the shipped simulations are byte-identical with and without the hooks (checked with `cmp` on all 6 baseline summary CSVs and on game-log bodies), and `tests/candidates.test.mjs` proves the hooks are inert until a candidate is registered. Scott chooses what, if anything, enters the game. All numbers are provisional starting points chosen to be comparable to existing cards, not balance proposals.

- Definitions: [experiments/candidates/index.mjs](../../experiments/candidates/index.mjs) (`enableCandidates([...])`, `disableCandidates()`).
- Engine hooks (data driven, no effect unless registered): `src/abilities.js` (`ABILITY_CATALOG`, `registerAbilities`), `src/cards.js` (`registerCandidateCards`, `setRecruitmentPool`), `src/battle.js` (`setSpears` status), `src/match.js` (`withEquip`, forced Hold for Set Spears).
- Evidence: [COMBAT_CASES.md](COMBAT_CASES.md), results in `docs/experiments/results/`.

## Provisional values

| candidate | kind | who | cost | cooldown | when | effect |
|---|---|---|---|---|---|---|
| **Whetstone** | passive equipment, type-wide, 1 of 2 slots per unit type | any recruit class | 2 Supply (same as Barrier) | none | permanent | +2 Str: +2 damage on every hit the unit deals |
| **Bulwark** | passive equipment, type-wide, 1 of 2 slots | any recruit class | 2 Supply | none | permanent | +2 Def: every strike against the unit does 2 less (never below 0) |
| **Set Spears** | pick in planning (kit ability) | Pikeman | 1 energy | 2 | defense phase, before movement | Hold this battle. Cavalier Charge, Momentum and flank bonuses against this Pikeman are ignored, and its own strike against a Cavalier gains +4 damage |
| **Momentum** | pick in planning (kit ability) | Cavalier | 1 energy | 1 | enhancement phase, after movement | Needs Advance and at least 2 tiles of automatic movement and a legal target. Strike gains +1 damage per tile moved, up to +5. Stacks with Charge |

Design intent of each, stated so they can be judged against it:

- **Whetstone / Bulwark** are the simplest possible "stat" equipment, compared against the shipped Barrier (absorbs 2 total damage a battle, at the same price). One +2 is a big swing at these numbers: an attack of 16 against a defence of 16 deals 0, at 18 it deals 2 (see the keep results).
- **Set Spears** is a cheap, situational counter to cavalry, paired with the existing Brace (2 energy, absorbs 4 total, good against anything). It costs a fraction of a Cavalier's bonus stack and is sustainable: +1 energy per round pays for it every other round.
- **Momentum** rewards moving before attacking. It is cheaper than Charge (1 v 2 energy, +5 at full run-up v +4) and, like Charge, only pays off on the round the Cavalier actually closes distance. In the case studies it behaves as a one-round opener (see COMBAT_CASES.md).

## Accounting used in comparisons

Supply uses recipe pricing (a 2★ Pikeman = three 1★ recipes = 3 Supply; 3★ = 9), reported as `unit Supply + equipment Supply` per side; population is the weighted population (1★ 1, 2★ 2, 3★ 3). Energy cost is not Supply: a unit gains 1 energy per round from a start of 1 in round 1, so ability use is limited by the clock, not the bank.

## How to enable them

```bash
node experiments/combat/run.mjs --suite all --seeds 400            # scenarios name their candidates
node tools/sim/run.mjs --games 50 --blue heuristic --red heuristic --candidates whetstone,bulwark,setSpears,momentum --pool --verify
node experiments/maps/run-maps.mjs --maps river_ford,flat_open --candidates whetstone,bulwark   # full games, cards in the draw pool
```

With `--pool` the two equipment cards join the shared draw pool with weight 1 each (the default pool has 10 entries). The heuristic commander equips any skill card it holds on its most numerous unit type and picks Set Spears when an enemy Cavalier is within reach and Momentum when it advances next to an enemy. Ordinary replay (`replay(entries)` with no `create`) cannot reconstruct candidate games in a fresh process; `run.mjs --verify` and the scenario runner rebuild them from the header.
