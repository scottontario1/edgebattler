# Combat experiments, part 2: candidate cards, case studies and map interactions

Branch `sim/combat-experiments` (from `codex/gamegaps` dfe736f), 2026-09-30. Serves CORE-02 (pacing and keep pressure). No shipped default was changed. Part 1 is [BASELINE.md](BASELINE.md); the experimental cards are in [CANDIDATES.md](CANDIDATES.md); raw tables are in `docs/experiments/results/`, seed-1 game logs in `docs/experiments/evidence/`.

## Strongest findings

1. **The mirror stalemate is an equilibrium, not slowness or terrain.** Heuristic v heuristic draws 94% on the shipped map, 94% on a flat open field, and still 29 of 30 games at a 100-round limit. Fighting is continuous (8 strikes a round on flat ground) but deaths (~0.5 a round) are replaced as fast as they happen, with hands full 91% of the time and the population cap reached in 57–70% of round ends. Removing the champions changes almost nothing in the mirror (96% and 100% draws).
2. **Terrain and champions decide games between unequal players, not equal ones.** Flat ground cuts heuristic-v-greedy draws from 89% to 46%; removing both champions as well takes it to 7%. Map shape (chokepoints) pushes the mirror to 100% draws; only a forest belt made the mirror partly decisive (26%).
3. **A keep is a stat cliff, and the champion is the wall.** Six Supply of any attacking mix loses to Dreg plus two Pikemen 100% of the time; take Dreg away and the same army wins 100%. Recruit attack 16 against champion Def 13 + castle 3 = 16 deals 0. A single +2 (candidate Whetstone) moves it from 0% to 50%.
4. **Cavalry only works as a stacked combo, and it has a cheap counter.** Three Pikemen (3 Supply) beat two Cavaliers (6 Supply) 97% of the time. Attack angle (side/back, −11 to −14 points), waiting a round to Charge (−6) and both together (−49: the pair wins 44%) turn it around. Candidate Set Spears (1 energy) restores 96% for the Pikemen even against that best case.
5. **Combining is population relief, not power.** One 2★ Pikeman loses to three 1★ Pikemen (same 3 Supply) 99% of the time. Only forest plus Brace and Rally, or a Bulwark, get it close, and the best variant leaves 37% of games unresolved.
6. **Formation and preparation move results a lot; the candidate numbers move them less.** A gap in a Pike line costs an Archer-and-Pikemen force 59 points against cavalry. Whetstone (+2 Str for 2 Supply) matters everywhere (keep, cavalry, full games); Momentum is a one-round opener that barely moves outcomes.
7. **Extra cards make the smarter player win, not the mirror end.** With Whetstone and Bulwark in the draw pool, heuristic v greedy draws fall (89→75% river, 46→19% flat) because only the heuristic plays them; heuristic v heuristic stays at 96–100% draws.

## Method

All numbers come from the shared engine (`src/match.js`), the same rules the game and simulator use. Scenario definitions are plain data ([suites.mjs](../../experiments/combat/suites.mjs), engine in [scenario.mjs](../../experiments/combat/scenario.mjs)): fixed positions, facing, stance, energy and scripted planning picks applied through `match.apply`, so they are logged like real play. Each variant is played for seeds 1–400; the seed drives every die and movement tie-break. Variant A0 is the baseline and every other variant changes one factor from it (the label says which). Tables give Blue win rate with a 95% Wilson interval and the change from A0 in points (ns = not significant). "Mutual" is both armies destroyed in the same round; the engine currently reports that as a red win (see CORE-03 below), the tables count it separately.

Every table lists what each side paid: **Supply** by recipe pricing (1★ = card cost, 2★ = 3 copies, 3★ = 9 copies), `+n` equipment Supply, and weighted **population**. Preparation time appears as the first-strike round and by waiting rounds in the label. Energy starts at 1 in round 1 and gains 1 per round. Ability picks persist and re-fire off cooldown.

Limits of the method: scripted armies, not AI decisions (the full-match tables use the AI); one formation per case; 15–25 round windows; the defender's facing is set by the scenario and would be a free planning choice in play.

## Case 1: three Pikemen v two Cavaliers

Blue holds a column at c=6, r=5–7 facing east; red's Cavaliers advance from c=12 (5 tiles from contact, so contact is round 1). Supply 3 v 6, population 3 v 2. [Full table](results/pikes-v-cav.md).

| variant (one change from A0) | Blue win | mutual | Δ |
|---|---|---|---|
| A0 frontal, immediate, no abilities | 97% | 1% | — |
| A1 Pikemen face north (side attack) | 86% | 5% | −11 |
| A2 Pikemen face west (back attack) | 83% | 5% | −14 |
| B1 Cavaliers wait a round, then Charge | 91% | 4% | −6 |
| B2 …and Pikemen Brace on the same round | 97% | 0% | 0 (ns) |
| B3 side attack **and** wait/Charge | **48%** | 9% | **−49** |
| C1 Set Spears (candidate) on Pikemen | 98% | 0% | +2 (ns) |
| C2 Momentum (candidate) on Cavaliers | 97% | 1% | 0 (ns) |
| C4 B3 (best case for the Cavaliers) v Set Spears | 96% | 0% | −1 (ns) |
| D1 Whetstone on the Cavaliers (+2 Supply) | 71% | 10% | −26 |
| D2 Bulwark / D3 Whetstone on the Pikemen | 98% / 97% | — | ns |
| E1 six Pikemen (6 Supply, equal to the Cavaliers) | 99% | 0% | ns |
| E2 Pikemen advance instead of holding | 98% | 0% | ns |

What decided it:

- **Per Supply, the Pikeman is far ahead.** A duel on open ground: Pikeman → Cavalier 9 damage at 69%, Cavalier → Pikeman 6 at 82%, both 24 HP (`node tools/sim/matchups.mjs`). Three units also make three strikes a round against two. A Cavalier's real edge is stacking: side/back (+4) and Charge (+4) take a 6-damage hit to 14, so a Pikeman dies in two hits. A single factor rarely beats the Pikemen; the pair does (B3).
- **Preparation only helps when it is combined with position.** Waiting a round to Charge gives −6 points alone because the frontal Pikemen win the first exchange anyway (B1); the same wait against a flank is decisive (B3). The Pikemen's answer is symmetrical: Brace on the arrival round (B2) removes most of Charge's gain.
- **Counterplay is cheap.** Set Spears (1 energy, cooldown 2, re-fires automatically) erases flank and Charge together (C4 96%). The log shows the seam: Set Spears fires in rounds 2 and 4, so in round 3 (on cooldown) the flank returns (`docs/experiments/evidence/pikes-v-cav/C4-seed1.jsonl`, rounds 2–4: "side +0", "side +4", "side +0").
- **Equipment beats abilities per Supply for the Cavalier.** +2 Str on the Cavaliers (D1) is worth 26 points; Momentum (C2) is worth 0, because it lasts only the round the Cavalier closes distance. Bulwark and Whetstone on the winning side change survivors and HP, not the result.
- **Tradeoff.** A hold line is a bet on facing: it must face the charge (free in planning) and cannot cover a second direction. Cavalry's answer is mobility, but mobility only shows up as flank strikes when the defender's facing is wrong or when the map lets them come round.

## Case 2: two Pikemen and an Archer v two Cavaliers

Pikemen (6,5),(6,6), Archer (5,5) behind them, all facing east; Cavaliers from (12,5),(12,6). Supply 4 v 6, population 3 v 2. [Full table](results/pike-archer-v-cav.md).

| variant | Blue win | Δ |
|---|---|---|
| A0 sheltered Archer | 91% | — |
| F1 gap: second Pikeman at (6,7), so (6,6) is open | **33%** | **−59** |
| F2 Archer in the front line at (6,6) | 52% | −40 |
| A1 side attack (all face north) | 66% | −25 |
| B1 Cavaliers wait, then Charge | 88% | −4 (ns) |
| B2 …Archer answers with Focused Shot | 95% | +4 |
| B3 …plus Pikemen Brace | 97% | +6 |
| C1 Set Spears / C2 Momentum | 95% / 87% | ns / ns |
| D1 Whetstone on the Archer / D2 Bulwark on Pikemen | 95% / 100% | ns / +9 |
| E1 Archer swapped for a third Pikeman | 97% | +6 |

- **Formation is the decision that matters.** A single open tile lets the Cavaliers reach the Archer in round 2 and costs 59 points; putting the Archer in the line costs 40. Opposite the "more units is better" result of Case 1, positioning can outweigh a whole unit: the same three Pikemen (E1) do 6 points better than two plus an Archer.
- **The Archer's value is conditional.** Sheltered, it adds a 6-damage shot from behind; exposed, it is the Cavalier's best target (12 damage a hit against its Def 3). The candidate and shipped cards both help it a little (Focused Shot +4, Whetstone +4) without changing the picture.
- **Preparation is a race, both ways.** Waiting to Charge (B1) is answered by preparing Focused Shot and Brace on the same round (B2, B3), which return the Blue win rate to 95–97%. Energy preparation matters as a mirror of the opponent's, not on its own.
- **Counterplay.** Close ranks and face the threat; keep Set Spears or Brace ready; spend the Archer's Focused Shot on the arrival round.

## Case 3: three separate Pikemen v one combined 2★ Pikeman

Blue's three 1★ Pikemen (4,5–7) advance on red's 2★ Pikeman (Supply 3 v 3, population 3 v 2; a 2★ Pikeman has +8 HP, +2 Str, +2 Def, +1 Spd/Skl). [Full table](results/three-v-2star.md).

| variant | Blue win | none | Δ |
|---|---|---|---|
| A0 both advance on open ground | 99% | 0% | — |
| A1 2★ holds at (8,5), open ground | 99% | 0% | ns |
| T1 the same tile is forest (+1 Def, +20 avoid) | 80% | 0% | −19 |
| B1 both Rally (free picks) | 94% | 4% | −5 |
| B2 2★ holds, Rallies and Braces from round 2 | **55%** | **37%** | **−44** |
| D1 Bulwark on the 2★ (+2 Supply) | 92% | 0% | −7 |
| D2 Whetstone on the 2★ / D4 Barrier on both | 99% / 99% | — | ns |
| P1 equal population 3: 2★ + 1★ (Supply 4) | 66% | 0% | −33 |
| P2 equal Supply 6: 2★ ×2 v six 1★ | 100% | 0% | ns |

- **One strike per unit per round is the whole story.** Three bodies deal three strikes; the 2★ deals one, stronger (+2 Str, +2 Def, +8 HP) but nowhere near three times. Combining loses the action economy and buys back one population slot. The rule set therefore makes combining a population-management move, not a power move. That matches "capacity pressure" in the gap register, and it means players at the cap (57–70% of the time in simulation) are paying a power penalty to get a slot.
- **What lets the 2★ survive:** ground plus energy. Forest (T1) alone costs Blue 19 points; holding still to Rally (10 HP) and Brace (4 absorbed) every other round (B2) leaves 37% of games unresolved at the 14-round limit. That is a stall the attacker can only break with more units or with flank/energy of their own, which is the decision structure we want; it is also the mechanism behind the draws.
- **At equal population** (P1) the three still win 66%, so a 2★ is never better than the pieces it replaced except when the population cap forbids the pieces.

## Case 4: an attacking force v a defended keep

Red's keep at (12,1) holds Dreg (Hold) with Pikemen at (11,1) and (12,2). Blue starts about 10 tiles away and advances on the keep (tile objective). 25 rounds. Supply 6 v 2 plus a free champion. [Full table](results/keep-assault.md).

| attackers (6 Supply unless noted) | Blue win | red wins | unresolved |
|---|---|---|---|
| A0 six Pikemen | 0% | 100% | 1% |
| C1 two Cavaliers | 0% | 100% | 0% |
| C2 two Pikemen + two Archers | 0% | 1% | 99% |
| C3 three Pikemen + one Cavalier | 0% | 100% | 0% |
| C4 three Archers | 0% | 0% | 100% |
| G1 **no champion**: a third Pikeman holds the keep | **100%** | 0% | 0% |
| R1 / R2 defender reinforces once / twice | 0% / 0% | 100% / 100% | 0% |
| X1 13 Supply: 4 Pikemen, 3 Archers, 1 Cavalier | 0% | 1% | 100% |
| X2 the same with Whetstone (+4 Supply) | **52%** | 0% | 48% |
| D1 six Pikemen with Whetstone (+2 Supply) | **50%** | 47% | 0% |
| D3 Bulwark on the defending Pikemen | 0% | 99% | 1% |
| S1 two 2★ Pikemen (12 Supply) | 0% | 100% | 0% |

- **Nothing an attacker can buy at the shipped numbers opens the keep**, from 6 to 13 Supply and from 1★ to 2★. Melee attackers die to the champion and its garrison; ranged ones cannot hurt the champion (Archer → Dreg on the keep: 0 damage) and stall. The defender does not even need its reinforcements (R1, R2).
- **The cliff is narrow.** Attack 16 against Def 16 deals 0; +2 Str deals 2 per hit, enough for a 50% keep capture in this setup. That is the strongest evidence in this study that the keep numbers are a threshold, and that tuning either side by one or two points swings a keep from unbreakable to a coin flip. This is a choice for Scott (see CORE-02); the study only shows the shape.
- **Why the champion matters most.** Remove it (G1) and the same army wins every time in 9 rounds. Its DEF 13 plus castle 3 also protect the keep from ranged and cavalry, which are the classes designed to break lines.
- **Counterplay to nothing.** With no realistic attacker path, the defender has no need to reinforce, so this case does not exercise the reinforcement location choice; that needs attackers that can win first (X2, D1).

## Map interactions

### Same assault across map shapes (scenario)

Three Pikemen and an Archer advance on three Pikemen and an Archer holding (Supply 5 v 5) across a river or forest. 25 rounds. [Full table](results/map-assault.md).

| map | Blue win | red | mutual | unresolved | rounds | blocked holds / game |
|---|---|---|---|---|---|---|
| M0 flat open field | 42% | 24% | 34% | 1% | 15.1 | 15.5 |
| M1 river, three-tile crossing | 31% | 41% | 26% | 3% | 15.8 | 15.2 |
| M2 river, one-tile crossing | 30% | 12% | 20% | 39% | 22.8 | 18.9 |
| M3 forest belt; defenders at its far edge | 83% | 3% | 5% | 9% | 16.9 | 19.4 |
| M3b forest belt; defenders inside its west edge | 40% | 15% | 8% | 37% | 19.5 | 26.8 |
| M4 shipped River Ford | 24% | 20% | 29% | 27% | 21.9 | 18.9 |
| M5 one-tile crossing, attackers with Whetstone | 52% | 17% | 30% | 1% | 16.3 | 12.4 |
| M6 one-tile crossing, defender is a 2★ + Archer (Supply 5 v 5) | 86% | 8% | 6% | 0% | 11.7 | 9.0 |

- **A one-tile crossing produces stalemates, a three-tile crossing produces fights.** Narrowing the crossing raises the unresolved share from 3% to 39% at equal forces. River Ford behaves like the one-tile map (27%).
- **Terrain helps whoever stands on it when struck.** With the defenders at the belt's far edge the attackers cross the forest and fight from it, and win 83%; with the defenders inside the belt's near edge, the result is no better than open ground (40%), only slower and more unresolved. A forest belt therefore does not itself favour defence; where each side's units end up standing does.
- **A crowded map is not more decisive.** Blocked holds (no legal move) grow with terrain: 15.5 a game on flat, 19–27 on forest and river. Contested destinations peak at the one-tile crossing (4.7) and in the 2★ case (6.8). Movement in these scenarios spends more on standing still than moving.
- **Roads change nothing.** `R` costs the same as plains in `src/rules.js` `MOVE_COST`, so a road-only variant would equal `flat_open`. Roads are decoration until a cost or bonus is designed; the shipped map's bridge is the only crossing tile whose position matters.
- **Mutual destruction is common in even fights on open ground** (26–34% of M0–M1 and M4): see CORE-03 below.

### Full AI games across maps

heuristic v heuristic (50 games) and heuristic v greedy (50 seeds, both sides), 30-round limit, every game replayed. [Table](results/maps.md).

| map | mirror draws | v greedy draws | keep captures (v greedy) | rounds with a strike (mirror) | blocked share |
|---|---|---|---|---|---|
| river_ford (shipped) | 94% | 89% | 11 | 96% | 17% |
| flat_open | 94% | 46% | 54 | 100% | 26% |
| forest_belt | 74% | 85% | 15 | 90% | 23% |
| choke_gap3 | 100% | 70% | 30 | 98% | 20% |
| choke_gap1 | 100% | 89% | 11 | 92% | 13% |
| village_center | 94% | 39% | 61 | 100% | 27% |

- **Villages/reinforcement locations increase captures, not decisiveness in the mirror.** Central villages raise village captures per game from 2.0 to 2.4 (mirror) and 1.96 to 2.86 (v greedy) and lower draws v greedy from 46% to 39%; the mirror stays at 94%. Forward deployment is common (50–52% of deployments on flat and village_center) but lopsided on the shipped map: 70% of Blue's deployments are away from its keep against 1.4% of Red's (`node experiments/maps/deploys.mjs`), because Blue's village sits on its side of the bridge and Red's is rarely held. The shipped map therefore gives Blue a nearer reinforcement point.
- **Two maps stand out.** `flat_open` and `village_center` make the stronger AI win most games against greedy. `forest_belt` is the only mirror that resolves (26% decisive, 13 keep captures in 50 games, first strike not until round 3.5, 0.20 deaths a round); the cause was not investigated here, so treat it as a lead rather than a design to copy.
- **Chokepoints raise draws and concentrate fights** (choke_gap1: mirror 100%, fewest deaths, fewest strike rounds).

## Candidate cards in full games

Whetstone and Bulwark added to the shared draw pool (weight 1 each), Set Spears and Momentum added to the kits; 50 games per cell. [Table](results/candidate-pool.md).

| candidates | river mirror draws | river v greedy draws | flat mirror draws | flat v greedy draws | flat keep captures v greedy |
|---|---|---|---|---|---|
| none (baseline) | 94% | 89% | 94% | 46% | 54 |
| Set Spears + Momentum | 98% | 91% | 94% | 48% | 52 |
| Whetstone + Bulwark | 100% | 75% | 96% | 19% | 81 |
| all four | 98% | 81% | 90% | 32% | 68 |

The equipment cards make the smarter policy win more against greedy and leave the mirror where it was. The two kit abilities do nothing measurable in full games at 50 games a cell. None of the candidates makes a difference to the equal-player stalemate; they add options and strength, not a route to break the tie.

## Engine observations (for CORE-03 and the register)

- **Mutual annihilation is awarded to red.** `checkEnd` tests blue's elimination first, so if both armies die in the same round red wins by `army-destroyed`. In the 4-v-4 scenarios this affects 20–34% of games. The scenario runner reports these as "mutual". CORE-03 already asks for an explicit simultaneous-victory rule.
- **Misleading hold reason.** A unit already in range of its nearest target but blocked from a better stand tile logs `no legal movement`; the label is the default when no movement was needed. Movement-blocked statistics above use it as reported, so they overstate true blocking.
- **Set Spears cooldown 2 alternates coverage** (used rounds 2, 4). A defender who wants cover every round needs a second source, which is a design lever if this card is adopted.
- **The bench is never used by either AI**, so the graded refunds of SYS-02 have no simulation evidence yet (already in the register).

## Reproduce

```bash
npm test                                                              # 33 rule checks incl. candidate hooks and scenario replay
node experiments/combat/run.mjs --suite all --seeds 400 --replay 10 --out docs/experiments/results --evidence docs/experiments/evidence
node experiments/maps/run-maps.mjs --games 50                         # full AI games on every experiment map
node experiments/maps/run-maps.mjs --games 50 --maps river_ford,flat_open --candidates whetstone,bulwark
node experiments/baseline/no-champions.mjs --games 50                 # champion removal probe
node tools/sim/inspect.mjs docs/experiments/evidence/pikes-v-cav/B3-seed1.jsonl --map experiments/maps/flat_open.js --events --board 3
```

## Replay coverage and limits

- Scenario logs carry their definition in the header (`meta.scenario`); 610 of them (10 seeds for every variant of every suite) were rebuilt from it and replayed with 0 mismatches. `tools/sim/run.mjs --verify` replays candidate and alternate-map games from the header's map id and candidate list. **Ordinary replay (`replay(entries)` with no factory, or a fresh process without the candidates/maps loaded) cannot reconstruct these games**, and `experiments/baseline/no-champions.mjs` (custom roster, not stored in the log) has no replay at all; it is deterministic per seed and rerunnable.
- `setMap()` and candidate registration are process-wide switches for experiments; the game never calls them. The default-map simulations are byte-identical before and after the hooks.
- Outcomes depend on scripted geometry (which unit is nearest to which enemy, who arrives when). The tables show the direction and rough size of each factor, not general win probabilities.
- 400 seeds give roughly ±5 points on a 50% result; the full-match tables use 50 games and are coarser (±10–20 points).

## Recommended next experiment

**Rule-override sweep on replacement and capacity, in the mirror.** Add `--rules` overrides to the simulator (population cap 10 → 8 and 6; Supply per round 3 → 2; hand size 8 → 6) and run heuristic v heuristic on `flat_open` and River Ford, 100 seeds each, with paired seeds and side swaps, reporting draws, duration, deaths per round and the share of round ends at the cap. The evidence here says the mirror stalemate is replacement-driven (unaffected by champions, terrain or extra cards), so this is the smallest test of the actual cause; success would be a mirror where the decisive-game rate rises without the player's decisions at the cap disappearing. Keep and champion numbers (the 16-v-16 cliff) are a separate, independent second experiment.
