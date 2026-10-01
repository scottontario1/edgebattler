> Historical snapshot archived 2026-10-01. Earlier revisions/proposals, not current main. [Current docs index](../../../../README.md).

# Economy sweep and five showcase levels

Branch `sim/combat-experiments`, 2026-09-30. Follow-up to [COMBAT_CASES.md](../../../../experiments/COMBAT_CASES.md): the recommended economy sweep (with much wider ranges), the tests it prompted, and five single-player levels that show what the skills do. Nothing shipped changed; every switch below is off by default and recorded in the log header. No screenshots.

## 1. Economy sweep

**Tool:** `experiments/economy/sweep.mjs`. A mesh grid (or Latin hypercube with `--lhs N`) over the limits, cells fanned out across worker threads, no game logs written, one game per cell replayed from its header. 56 cells × 24 seeds (1,344 games) take about 30 s on 12 cores; every replay check passed (over 300 cells in all).

```bash
node experiments/economy/sweep.mjs --grid pop=4,6,8,10,14,18,22,28 income=1,2,3,4,6,8,12 --games 24 --map flat_open
# axes: pop income bank hand start draw | dmg (strike damage x) | seize (heuristic march threshold) | keepdeploy (0 = no deploy onto the keep tile)
```

Ranges covered, all heuristic v heuristic on `flat_open` and River Ford, 30 rounds: population cap 4–28, Supply per round 1–12 with the bank at max(6, 2×income) and separately 3–24, hand size 4–16, cards drawn per round 1–8, strike damage ×1–×4, march threshold 0–2. Raw tables: `docs/experiments/results/economy/`.

### Result: no economy setting breaks the mirror stalemate

Draws, population cap × Supply per round (flat_open; River Ford is 92–100% everywhere):

| pop \ income | 1 | 2 | 3 | 4 | 6 | 8 | 12 |
|---|---|---|---|---|---|---|---|
| 4 | 54% | 50% | 42% | 42% | 42% | 42% | 42% |
| 6 | 92% | 92% | 83% | 83% | 92% | 92% | 92% |
| 10 | 92% | 79% | 96% | 100% | 100% | 96% | 96% |
| 18 | 92% | 79% | 96% | 100% | 100% | 100% | 100% |
| 28 | 92% | 79% | 96% | 96% | 96% | 100% | 96% |

- Only a population cap of 4 is decisive, and only because the two starting armies (5 units) fight it out before anything is recruited. From 6 to 28 the draw rate is 79–100% regardless of income.
- The capacity pressure was real and is now removed at the top of the range: rounds where an affordable unit card has no population room fall from 88% (cap 10, income 8) to 0–1% (cap 28), and units per side rise from 7.4 to about 10. Deaths per round do not move (0.5–0.67 both sides).
- Hand size 4–16 × cards per round 1–8 (cap 28, income 8): 83–100% draws everywhere. More draws mean bigger armies (6.7 → 13 units alive per side) and no more games that end.
- Bank size 3–24 changed nothing measurable (draws 92–100%, `bank-income-*.md`).

### What was tested and ruled out (mirror draw rate)

| lever | range | mirror draws |
|---|---|---|
| population cap / income / hand / draw / bank | 4–28 / 1–12 / 4–16 / 1–8 / 3–24 | 79–100% (excl. cap 4) |
| strike damage multiplier | ×1 to ×4, cap 6–28 | flat 63–100%, River Ford 92–100% |
| AI aggression (`seizeRatio`: 0 = always march on the keep) | 0–2, damage ×1–×4 | flat 83–100% |
| champions removed and always marching | — | 94% |
| keep tile not deployable | on/off, ×2 aggression, ×2 income | flat 89–96%, River Ford 95–98% |

Watching one damage ×4, always-march game: the blue army never gets closer than 9 tiles to the red keep (red reaches 3–9 tiles from blue's) and 2–3 units die most rounds. Fights are decisive; they just never reach the keep, because reinforcements spawn at the defender's own keep. The further a push advances, the shorter the defender's supply line and the longer the attacker's.

### What does move it: forward reinforcement points plus aggression

Adding a chain of villages along the diagonal (`experiments/maps/village_chain.js`: extra villages at 6,7, 8,5 and 10,3) gives a pushing side a nearer deployment area:

| map (mirror, damage ×1) | march threshold 1.3 | always march |
|---|---|---|
| flat_open | 95% draws | 90% |
| village_center (2 villages) | 95% | 85% |
| village_chain (3 more) | 83% | 65% |

And on the chain, economy finally matters (always march, damage ×2, 40 seeds a cell):

| pop \ income | 3 | 8 |
|---|---|---|
| 10 | 68% | 60% |
| 18 | 60% | 53% |
| 28 | 60% | 53% |

So the reading is: **the stalemate comes from geometry of reinforcement, not the size of the economy.** Bigger economies pay off only when winning ground moves your own spawn point forward. The lever for Scott to choose is some form of forward deployment (capturable reinforcement locations, deploying next to a captured or held tile, or a map with more of them), not the numbers in `CARD_LIMITS`. Even the best cell here still draws 53%, so this narrows the search rather than solving it.

## 2. Five single-player levels

**Files:** `experiments/levels/levels.mjs`, run through the case-study runner. Blue is the player; Red follows a fixed script (including its own energy preparation) and never plays cards. Each level is played four ways: **naive** (default stances, no picks, no spells), **skilled** (the level's plan), and the skilled plan with each ability removed everywhere, and each spell or manoeuvre removed, one at a time. 400 seeds each, 10 seeds per variant replayed from their headers (310 logs, 0 mismatches).

```bash
node experiments/combat/run.mjs --file experiments/levels/levels.mjs --suite all --seeds 400 --replay 10 --out docs/experiments/results/levels
sh experiments/levels/quick.sh level-3 200      # compact view while tuning
```

| level | setting (Blue v Red) | skilled win | naive win | skills and what removing each costs (points) |
|---|---|---|---|---|
| 1 Hold the Crossing | 3 Pikemen guard the mouth of a one-tile crossing v 6 Pikemen | **98%** | 0% | Rally −38, Brace −3 |
| 2 Arrow Rain | 2 Pikemen + 2 Archers v 3 Pikemen + Cavalier (one Pikeman late) | **86%** | 0% | Focused Shot −36, Rally −30, Brace −8 |
| 3 Ride Them Down | 2 Cavaliers + 2 Pikemen v 3 Pikemen + 4 Archers (Braced) | **74%** | 0% | Rally −53, Charge −30, flank route −23, Second Wind −19 |
| 4 Cavalry Storm | 3 Pikemen + Archer + spells v 5 Cavaliers that stage, then Charge | **66%** | 0% | Rally −57, Fireburst −33, Brace −11, Mend −9, Focused Shot −5 (ns), Ward −1 (ns) |
| 5 The Warlord's Keep | 2 × 2★ + 3 Pikemen + 2 Archers + Cavalier + spells v Dreg + 6 Pikemen + 4 Archers on the keep | **49%** | 0% | Focused Shot −44, Fireburst −24, Rally −5 (ns), Ward 0, Mend 0; candidate Whetstone +44 |

The ramp is 98 → 86 → 74 → 66 → 49% for the skilled plan; the naive plan loses every level, so each level is a skill check, not a numbers check.

What each level shows:

1. **Hold + Rally.** Standing at the crossing mouth makes the crowd arrive one at a time; Rally (free, heals 10) is worth 38 points and Brace almost nothing here because the Pikemen are healthy until the last rounds.
2. **Formation and Focused Shot.** Pikemen screen, Archers behind, Focused Shot once energy allows on round 2. Removing the shot costs 36 points; the Archers' damage is the difference between a stand-off and a win.
3. **Flank, Charge, Second Wind.** The Cavaliers wait a round to earn Charge energy, swing round the north end, and hit the Braced line from the side. Each piece is worth 20–30 points; none of them alone makes the level.
4. **Spells.** Fireburst on the staged Cavaliers before they move (6 damage each to up to three, at battle start) is the difference (−33). Ward and Mend contribute little (Brace may already absorb the same first hits; not isolated here).
5. **The champion wall.** Marching on the keep, spells ignore Defense, which is the shipped way through Dreg: a single Fireburst on the packed garrison plus Focused Shot from the Archers decides it. Whetstone (candidate) lifts the level to 93%.

### Mechanics these levels expose

- **Rally is the strongest skill in the game at these numbers** (−30 to −57 points when removed in levels 1–4): it is free and heals 10. It is worth checking whether a free 10-HP heal every other round is meant to outweigh the paid abilities.
- **Brace conflicts with advancing.** It forces Hold for the battle. In level 5 the marching plan is 23 points *better* without it, so a good Brace plan is a defender's tool only.
- **Fireburst punishes packing.** It deals 6 direct damage ignoring Defense to up to five tiles; against a garrison stacked around the keep, four casts won the level outright (100%, an earlier tuning). With one cast it is worth 24 points. The count of Fireburst cards in a hand is a difficulty dial.
- **Charge is narrow but strong.** It needs movement and a target in the same round, and in level 3 it fired on only some cavalry turns (the trigger log is in the evidence), yet removing it costs 30 points because it lands as the opening blow.
- **Ward and Mend are nearly free of effect** once Brace and Rally exist. That is a candidate for rebalancing (stronger Ward, or costlier defensive picks) if the intent is for spells to matter.

## Recommended next experiment

**Forward deployment.** The economy is not the constraint, so test the mechanism the data points to: let a side deploy at any owned or recently captured tile (or within N tiles of a controlled village), on `flat_open`, `village_chain` and River Ford, mirror and against greedy, 100 seeds a cell with paired seeds, sweeping N and the number of villages. Success looks like the mirror draw rate falling well below 50% while games still last more than 10 rounds. Keep the keep/champion cliff (recruit attack 16 v defence 16) as a separate second experiment.

## Files

- Engine switches (all inert by default): `src/cards.js` `setCardLimits`, `src/battle.js` `BATTLE_TUNING`, `src/match.js` `EXPERIMENT_RULES`; checked by `tests/economy.test.mjs` (37 rule checks pass in total).
- Sweep tool: `experiments/economy/sweep.mjs`. Levels: `experiments/levels/`. Extra map: `experiments/maps/village_chain.js`.
- Replay: sweep cells and level logs replay from their headers. Ordinary replay in a fresh process without the same switches cannot reconstruct them.
