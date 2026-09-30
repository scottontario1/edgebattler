# Combat experiments, part 1: simulation baseline

Branch `sim/combat-experiments`, based on `codex/gamegaps` at dfe736f. Run 2026-09-30 with the shipped rules and no experimental code: 450 games, every one replayed from its log with 0 mismatches. Nothing here changes a default; it is evidence for CORE-02 (keep pressure and pacing).

## Reproduce

```bash
node experiments/baseline/run-matrix.mjs --games 50 --out logs/sim/base     # the table below, ~40 s
node tools/sim/inspect.mjs logs/sim/base/heuristic-greedy                    # engagement profile, keep and capacity pressure
node tools/sim/inspect.mjs logs/sim/base/heuristic-heuristic/game-00005.jsonl --board 8,30   # one game, round by round
node tools/sim/matchups.mjs                                                  # analytic strike table (no dice)
```

Seeds are 1..50. `heuristic v greedy` and `v passive` play every seed on both sides (the map is not symmetric: blue's keep is at 2,10, red's at 12,1). Same-policy pairings play each seed once. `maxRounds` is 30. Logs go to `logs/` (git-ignored).

## Results

| matchup (A v B) | games | A wins | B wins | draws (rate, 95%) | mean rounds | village captures / game | units lost / game (both) | blocked draws / game (both) |
|---|---|---|---|---|---|---|---|---|
| heuristic v greedy | 100 | 11 | 0 | 89 (89%, 81–94%) | 29.2 | 1.26 | 12.6 | 138 |
| heuristic v heuristic | 50 | 1 | 2 | 47 (94%, 84–98%) | 28.9 | 1.20 | 8.3 | 119 |
| greedy v greedy | 50 | 0 | 0 | 50 (100%, 93–100%) | 30.0 | 1.16 | 15.6 | 155 |
| heuristic v passive | 100 | 79 | 0 | 21 (21%, 14–30%) | 18.1 | 0.65 | 5.3 | 82 |
| greedy v passive | 100 | 8 | 0 | 92 (92%, 85–96%) | 29.2 | 0.82 | 11.9 | 160 |
| passive v passive | 50 | 2 | 0 | 48 (96%, 87–99%) | 29.5 | 0.14 | 7.3 | 171 |

- **Completion.** Only the heuristic converts: 79% against a passive opponent, 11% against greedy, 6% against itself. Every decisive game ends by keep capture (`army-destroyed` never happens); the rest hit the 30-round limit. The 89% draw figure in CURRENT_GAPS is reproduced exactly.
- **Duration.** Draws run all 30 rounds. Decisive games are long too: heuristic v passive takes 18 rounds on average (red's keep at 12,1 is far from the start), and the captures against greedy come around round 23.
- **Captures.** The "captures" column counts villages (about 1.2 per game, mostly the west village blue holds anyway). Keep captures are the wins in the table.
- **Losses.** 8–16 units die per game across both sides, roughly the size of one army. Fighting is real; the front line keeps refilling.

## Fighting does not stop; it balances

Engagement profile of the 100 heuristic-v-greedy games (`inspect.mjs`):

- The first strike lands in round 2 in every game. From round 15 on, 87% of rounds still contain at least one strike (3.7 strikes and 0.42 deaths per round, both armies together). The armies are locked in contact, not avoiding each other.
- Deaths (~0.4 a round) are below what the economy can replace. Both sides hold **Supply at the cap of 6 in 65–86% of round ends**, keep **8 hand cards in 91–94%**, and sit **at the population cap of 10 in 58–70%**. Blocked draws are 60–80 per side per game (of 90 offered).
- Two lock modes decide who can reinforce. In greedy v greedy, 56% of round ends have unit cards in hand but no population room (cap lock), and 16–20% have no unit card at all while there is room to recruit (dead hand: greedy never plays spells or Barrier, so they fill the eight slots; see game 3 below). The heuristic escapes the dead hand by playing everything, but still sits in the cap lock. Neither AI ever uses the bench (0.0 reserves at every round end).
- 82% of movement decisions are holds: stance hold 42%, "no movement improves attack range" 31%, no legal move 15%, contested destination 7%. Once both lines are in contact the geometry is fixed. In heuristic v heuristic seed 5 nothing moves from round 15 to 30: the same five strike pairs trade 13–22 damage a round for 16 rounds with zero deaths, because Rally, Mend, Ward and Brace absorb about what the strikes deal.
- Energy is largely wasted: about 200 energy per side per game hits the cap of 4 unspent, and abilities are skipped roughly five times for every use (`ability_skips` 140–170 vs `ability_uses` 30–50).

## Why a keep is hard to take

`node tools/sim/matchups.mjs` (one strike, dice removed):

| attacker → defender on castle | dmg on hit | hit | rounds for one attacker to kill |
|---|---|---|---|
| pikeman → Brenna | 1 | 64% | 43 |
| cavalier → Brenna | 0 | 69% | never |
| archer → Brenna | 0 | 55% | never |
| pikeman → Dreg | 0 | 36% | never |
| Dreg → pikeman | 7 | 55% | 6.1 |
| pikeman → pikeman | 4 | 47% | 12.5 |

- Recruits cannot hurt a champion standing on a keep (DEF 13 + castle 3 = 16 against pikeman power 16). A 2★ pikeman does 2 damage to Brenna there.
- The keep tile is also a deployment tile for its owner. A defender who loses the occupant can redeploy onto the keep in the next planning phase, before the attacker moves in, provided it has Supply and a unit card.
- Keeps are far from the fighting. Blue's keep has a defender on it in 4% of round ends (red's 43%), and an enemy unit is adjacent to a keep in about 1% of round ends. In the games that do capture, the defender was collapsing (game 3 below), not overwhelmed at the gate.

## Where the fighting happens

Of 10,218 located strikes: 81% melee on land, 9% archers on land, 7% melee involving the bridge, 3% archers shooting across the river, 0% at a keep. About 10% cross between banks; 63% happen with both units on the west (blue) bank. The map is a river with one bridge (8,5), so the contest is mostly one army crossing into the other's half. That is a chokepoint, and about a fifth of movement decisions are "no legal movement" or "contested", but it does not stop the fight because the crossing army keeps arriving. Whether this map is a good test bed is part of the map experiments (part 2).

## Representative games

- **Seed 3, heuristic (blue) v greedy (red), blue keep capture in round 23.** Strikes in every round except 1, 6 and 12–15. From round 10 red's hand is `spell-mend, skill-barrier` ×8 with Supply 6 and population 8, then 6, 5, 3: greedy plays neither, so it cannot reinforce and slowly loses units. Blue crosses the bridge in rounds 20–23 and Brenna steps onto 12,1 with red down to three units. Progress came from one side's economy dying, not from a tactic.
- **Seed 5, heuristic v heuristic, draw.** Rounds 1–14 have real exchange (13–43 damage a round, two deaths). From round 15 both lines lock at the bridge approaches: 0 moves, 5 strikes, 0 deaths for 16 rounds, 7 v 8 units, HP 159 v 146 at the end. Neither side has a card or a position that breaks the tie.
- **Heuristic v passive.** The passive army still fights (starting units default to Advance), so the heuristic wins 79% but needs about 18 rounds, and 21% end at the limit with the passive keep still held.

## Limitations

- These are AI policies at prototype numbers, not human play. Heuristic weights (`DEFAULT_PARAMS`) were not tuned here.
- The round limit of 30 defines "draw"; no scoring rule exists (CORE-03 remains open).
- Ordinary `--verify` replay covers matches on the default map and roster only.

## Flat open field (same keeps and villages, no river, forest, mountain or road)

Requested follow-up: the same matrix on `experiments/maps/flat_open.js`, a 16 × 12 grid of plains with only the two keeps and three village plots kept at their river_ford coordinates. `src/board.js` gained `setMap()` for this; the game never calls it and the default-map results above are byte-identical before and after (checked with `cmp` on the summary CSVs). All 450 games replay.

```bash
node experiments/baseline/run-matrix.mjs --games 50 --out logs/sim/flat --map experiments/maps/flat_open.js
node tools/sim/inspect.mjs logs/sim/flat/heuristic-heuristic --map experiments/maps/flat_open.js
```

| matchup (A v B) | games | A wins | B wins | draws (rate, 95%) | mean rounds | village captures / game | units lost / game (both) | blocked draws / game (both) |
|---|---|---|---|---|---|---|---|---|
| heuristic v greedy | 100 | 54 | 0 | 46 (46%, 37–56%) | 26.8 | 1.96 | 21.5 | 116 |
| heuristic v heuristic | 50 | 1 | 2 | 47 (94%, 84–98%) | 29.0 | 2.00 | 15.3 | 107 |
| greedy v greedy | 50 | 6 | 0 | 44 (88%, 76–94%) | 29.1 | 1.80 | 26.7 | 143 |
| heuristic v passive | 100 | 100 | 0 | 0 (0%, 0–4%) | 6.3 | 0.56 | 3.3 | 16 |
| greedy v passive | 100 | 30 | 0 | 70 (70%, 60–78%) | 24.6 | 0.75 | 11.6 | 132 |
| passive v passive | 50 | 31 | 0 | 19 (38%, 26–52%) | 19.7 | 0.12 | 8.3 | 109 |

- **Terrain was part of the stalemate, not all of it.** Removing the river lifts heuristic v greedy from 11% to 54% decisive, heuristic v passive to 100% (in 6 rounds, against 79% in 18), and greedy v passive from 8% to 30%. A stronger side can now convert an advantage.
- **The mirror stays stuck.** Heuristic v heuristic is 94% draws on flat ground, the same as with the river. Terrain does not fix the even match.
- **Contact is total, not sparse.** Every round of every game contains strikes, at 8 strikes a round (river map: 3.7), but still only 0.5 deaths a round. Population is 7 units per side at the end, steady, with 57% of round ends at the population cap and 91% with a full hand. Losses are replaced as fast as they occur; Supply income (3 a round, mostly 1-Supply pikemen) can buy several units a round against roughly 0.25 losses per side per round.
- **Crowding replaces the river.** 26% of movement decisions are "no legal movement" (blocked by friendly and enemy bodies) and 73% of decisions are holds. Both armies pile into one brawl in the north-west quarter (columns 2–8, rows 0–6), between the two keeps' line; neither keep is ever approached (blue keep has an enemy within 2 tiles in 2% of round ends, red's in 0%).
- **Keeps still hold.** Three keep captures in 50 mirror games. The same 0-damage arithmetic applies on flat ground.
- **Passive still fights.** Passive v passive is decisive 62% of games, all won by blue: the two starting armies (5 units each, no recruits) meet and brawl, and on level ground the outcome of that skirmish alone decides the keep. Blue wins them; red never does, so the starting rosters are not symmetric.

So a level board makes decisive play possible when strength differs, but for equal armies the stall is structural: even trades, healing and free replacement.
