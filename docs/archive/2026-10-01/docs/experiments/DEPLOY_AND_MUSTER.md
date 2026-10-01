> Historical snapshot archived 2026-10-01. Earlier revisions/proposals, not current main. [Current docs index](../../../../README.md).

# Forward deployment and Muster experiments

Branch `sim/combat-experiments` work, 2026-09-30. Follows [ECONOMY_AND_LEVELS.md](../../../../experiments/ECONOMY_AND_LEVELS.md), whose finding was that the mirror stalemate comes from reinforcement geometry, not economy size. Provisional evidence only: **every switch below is off by default, nothing shipped changed, and choosing defaults is left to Scott.** No screenshots (simulation only).

## Switches under test

| switch | where | shipped | tested |
|---|---|---|---|
| `deployRangeVillage` (`dvil`) | `EXPERIMENT_RULES` in `src/match.js` | 1 | 1–6 |
| `deployRangeKeep` (`dkeep`) | same | 1 | 1, 2, 4, 6 |
| `muster` | same; a unit spends energy (cost 2, cooldown 2) to put a bench unit on an adjacent empty tile | off | on/off |

Deployment area = every tile within Manhattan distance N of a keep or **currently owned** village (villages are owned by holding them at the end of a round, so captured villages move the reinforcement point forward). Heuristic commanders use the enlarged area (`src/ai/commander.js`); greedy deploys as before.

## 1. Recommended experiment: village radius N (100 paired seeds per cell)

```bash
node experiments/economy/sweep.mjs --grid dvil=1,2,3,4,5,6 --games 100 --map <map> --pair <heuristic:heuristic | heuristic:greedy> --out docs/experiments/results/deploy/radius-<map>-<pair>.csv
```

Maps `village_chain`, `ridge_line`, `river_ford`; N = 1 is the shipped rule. Seeds 1–100 are the same in every cell (paired across N); against greedy every seed is also played side-swapped (200 games/cell). 30-round limit. One game per cell is replayed from its log header: 36/36 replay checks pass. Files: `results/deploy/radius-*.{md,csv}`.

**Draw rate** (100 games is about ±8 points at these rates, so single-cell differences under ~10 points are noise):

| map / matchup | N=1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| village_chain, heuristic mirror | 91% | 82% | 83% | 81% | **67%** | 76% |
| village_chain, heuristic v greedy | 26% | 24% | 22% | 24% | 22% | 24% |
| ridge_line, heuristic mirror | 88% | 84% | 88% | 85% | 90% | 89% |
| ridge_line, heuristic v greedy | 52% | 47% | 40% | 44% | **27%** | 30% |
| River Ford, heuristic mirror | 97% | 98% | 95% | 99% | 95% | 97% |
| River Ford, heuristic v greedy | 89% | 90% | 85% | 90% | **71%** | 76% |

Game length falls only slightly where draws fall (village_chain mirror 28.4 → 22.9 rounds; ridge_line v greedy 26.5 → 24.5; River Ford v greedy 29.3 → 28.1); deaths per round rise (ridge_line v greedy 0.65 → 0.81; ridge_line mirror 0.27 → 0.46 with no change in draws). All decisive games end by keep capture; none by wipe.

Reading:

- **A larger radius does not fix the equal-player stalemate.** The success test from the previous report (mirror draws well under 50% with games over 10 rounds) is met in none of the 18 mirror cells; the best is village_chain N=5 at 67%. River Ford mirror stays at 95–99% for every N.
- **It helps the stronger side against a weaker one**, mostly at N=5–6: ridge_line 52% → 27%, River Ford 89% → 71%. That is a small "a winning side finishes the job" effect, not a fix for mirror play.
- **Effect is non-monotonic and small below N=5.** N=2–4 is within noise almost everywhere, so a radius of 2 or 3 would change little; the shipped radius 1 is not clearly worse than 4.
- **Villages beside the front matter more than radius.** village_chain (extra villages on the diagonal) is the only mirror map that moves, and the earlier Hamlets/ridge sweeps agree.

## 2. Earlier deployment sweeps (Hamlets and Ridge line)

`results/deploy/range-*` (keep radius x village radius, 24 seeds, mirror) and `focus-*` (village radius x Muster x keep radius x aggression, 80 seeds, mirror). Highlights, mirror heuristic, 30 rounds:

| map | shipped (dvil 1, no Muster) | dvil 6 | dvil 6 + Muster | Muster alone (dvil 1) |
|---|---|---|---|---|
| Hamlets draws | 76% | 78% | 64% | 72% |
| Ridge line draws | 87% | 59% | 56% | 83% |
| Ridge line rounds / game | 28.4 | 22.9 | 22.8 | 28.1 |
| Ridge line deaths / round | 0.34 | 0.65 | 0.68 | 0.52 |

On Hamlets a bigger radius alone does nothing (76–78%); it only helps combined with Muster (60–65% at dvil 4–6). On the ridge map, radius alone is the main lever (87% → 59%), with Muster adding a few points. Keep radius 4–6 made things worse (draws up to 96%) because a large keep area lets the defender stack reinforcements behind its own wall. That result is a reason not to widen the keep radius.

## 3. Levels showing the mechanisms (single-player, skilled v naive)

`experiments/levels/levels.mjs`, 400 seeds per variant, 10 replayed from headers per variant.

| level | Blue v Red | skilled win | naive win | what removing a skill costs |
|---|---|---|---|---|
| 6 Claim the Hamlet (village range 4) | 3 Pikemen on the east flank, 9 tiles from the keep, claim village 10,9 in round 1, deploy 3 reserve Pikemen beside it in round 2; v 6 Pikemen | **33%** | 8% | forward deployment −32, claim −33, Rally −21 |
| 7 Muster the Line (candidate Muster) | 3 holding Pikemen + 3 bench Archers mustered behind the line in round 2 v 5 Pikemen | **67%** | 0% | Muster −59, Rally −61 |

Level 6 was re-tuned on this pass. Before, forward deployment scored −22 points (it made the level worse) because the fight was only four tiles from the keep, so keep-deployed reinforcements arrived on time, and the forward units were walking out in Advance stance and getting picked off. Now the front is nine tiles out, Red arrives in round 2, the forward reserves take Hold from round 3 and the claiming Pikeman holds after taking the village. Without the forward deployment the same reserves reach the fight two rounds late and the level is lost (1%). Without the claim step the deployment area never moves and the level cannot be won (0%). The village claim and the deployment radius are worth about a third of the win rate each, in a setting where the same units are otherwise identical.

## Conclusions for Scott (choices, not adopted)

1. **Village radius alone does not remove mirror stalemates**, but it is a real force multiplier: against a weaker side it turns 50–90% draws into 25–70% (N=5–6) and gives the claiming Pikemen a clear job (Level 6).
2. **Map design matters as much as the rule**: reinforcement villages beside the front (village_chain) moved the mirror; River Ford, whose villages sit far from the ford, did not move at all. If forward deployment is adopted, River Ford would need forward villages.
3. **Do not widen the keep radius** (worse on both maps tested).
4. **Muster** is worth a decision on its own: it lowers Hamlets draws only with a wide radius and is strong in Level 7 (the level exists to show it).
5. Still open: the recruit v champion keep cliff (attack 16 v Defense 13 + castle 3), the second experiment listed in ECONOMY_AND_LEVELS.md.

## Limits

- 100 seeds per cell; intervals are wide, and I flag only differences above about 10 points.
- Village count and radius were varied on separate maps, not crossed; each map also differs in terrain.
- Greedy comparisons mostly measure how a stronger AI exploits a weaker one, not equal-player play.
- The heuristic uses the bigger area with no tuning of its own; a smarter commander might exploit it more.
- The sweeps do not record who wins decided games (the CSV has draws and keep captures only).
