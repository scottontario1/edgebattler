> Historical snapshot archived 2026-10-01. Earlier revisions/proposals, not current main. [Current docs index](../../../../README.md).

# The Iron League: technical spec and results

Branch `faction/iron-league`, built 2026-09-30 on `ccr-d70cb868-ob7chg` at 7e9d663. **Prototype, nothing registered in the game, nothing adopted.** Every number is a starting value in `src/factions/iron-league.js` (`IRON_LEAGUE`, one commented constant each); Scott chooses defaults. The ancient-technology theme is flavour, not a rule and not setting canon. Only existing hooks (`docs/CULTURE_HOOKS.md`) are used; shared engine files are untouched.

| what | where |
|---|---|
| culture definition (default export, plus `IRON_LEAGUE` numbers and `DEFAULT_LEAGUE_CHAMPION`) | `src/factions/iron-league.js` |
| rule checks (29 tests: 24 pass, 5 recorded engine gaps as `todo`) | `tests/faction-iron-league.test.mjs` |
| levels, League commander, simulation runner | `experiments/factions/iron-league/` |
| results | `docs/experiments/results/factions/iron-league/` |

Use it: `registerCulture(ironLeague)`, then `createMatch({ pools: { blue: culturePool('league') }, roster, champions: { blue: 'ilseVoss' } })` and `setRarityGate({ uncommon: 3, rare: 6 })`. `resetCultures()` removes it completely (checked in the first test).

## 1. What was built

### Units

Every unit is a Pikeman/Archer variant or a new class. New-class and variant art is the borrowed base sprite plus a tint (placeholder, no new assets). All League units default to **Hold** (labelled default: the faction holds ground).

| unit | rarity | cost (Supply) | build | HP / Str / Skl / Spd / Def / Mov | weapon | passive |
|---|---|---|---|---|---|---|
| League Pikeman | common | 1 | variant of Pikeman, stats unchanged | 24 / 8 / 5 / 4 / 9 / 4 | Iron Pike | **Planted Pike**: while holding and unmoved, +1 damage per strike |
| Pavise Guard | common | 2 | variant of Pikeman: HP +1, Def +2, Str -2, Mov -1 | 25 / 6 / 5 / 4 / 11 / 3 | Iron Pike | **Set Shield**: if it did not move, adjacent friendly Archers/Crossbowmen take 2 less damage per strike |
| Coil Crossbowman | uncommon | 2 | variant of Archer, stats unchanged | 18 / 6 / 8 / 7 / 3 / 5 | Longbow (range 2) | **Prepared Shot**: while holding and unmoved, +3 damage and +15 hit per strike |
| Relic Walker | rare | 4 | **new class**, armour movement | 30 / 7 / 4 / 2 / 10 / 3 | Relic Coil (mt 6, hit 70, range 1-2) | **Wear**: below half HP, -2 damage per strike and -10 hit |
| Sapper | uncommon | 2 | **new class** (chosen over "a skill any unit carries", labelled default) | 20 / 6 / 5 / 5 / 6 / 4 | League Sapper Pick (mt 6, hit 70, range 1) | none; kit is Dig In |

### Skills (kit abilities: cost is energy, cooldown counts the round of use)

| skill | rarity | who | cost / cd | phase | requires | effect |
|---|---|---|---|---|---|---|
| Set Position | common | every Pikeman-class unit (League Pikeman, Pavise Guard, the Captain; see Engine request 1) | 1 / 2 | defense | Hold | take 2 less damage per strike; stacks with Brace and Set Shield |
| Prepared Position | uncommon | every Archer-class unit (Coil Crossbowman, the Engineer) | 1 / 2 | enhancement | Hold, a legal target | +2 damage on top of Prepared Shot; nothing if the unit is not holding |
| Arc Burst | rare | Relic Walker | 3 / **4** | enhancement | Hold, a legal target | strike ignores 3 Defense and gains +3 damage. **Overheat, fixed**: cooldown 3+1 and the Walker takes 2 more damage per strike this battle |
| Dig In | uncommon | Sapper | 1 / 2 | defense | Hold | raise a barricade (10 HP, blocks enemy movement, decays after 4 rounds) on the free tile it faces |

Overheat is a fixed cooldown extension plus a fixed vulnerability (`damageTaken: -2`, i.e. 2 more per strike). It is never a chance. The pool also contains the shared skills (Rally, Brace, Focused Shot) through the base classes.

### Spells (deliberately mediocre, existing shapes and statuses only)

| spell | rarity | cost | effect |
|---|---|---|---|
| Field Repair | common | **0** | heal one friendly unit 4 HP (Mend: 1 Supply for 8) |
| Flare | common | 1 | one friendly unit gets +20 hit in the upcoming battle (a plain Archer goes from 83% to 100%; a held Crossbowman is already near the cap, so it is best on Pikemen) |

Mend, Ward and Fireburst stay in the pool (Scott: one faction per side, shared spells stay).

### Champion options (Scott's decision, proposal only)

The first is the **provisional default** (`DEFAULT_LEAGUE_CHAMPION = 'ilseVoss'`); all three are registered, each with a kit only that champion can use (`units: [id]`). Champions cannot carry passives (the champion registry has no `passives` field), so their identity is the kit.

| id | champion | class | HP / Str / Skl / Spd / Def / Mov | kit | note |
|---|---|---|---|---|---|
| **ilseVoss (default)** | Captain Ilse Voss, Condottiera (mercenary captain) | Pikeman | 30 / 9 / 6 / 4 / 12 / 4 | **Field Works**, 2 energy, cd 3, defense, Hold: raise a barricade in front and take 2 less damage per strike | she also has Rally, Brace, Set Position |
| tobiahKettle | Master Tobiah Kettle (guild engineer) | Archer | 22 / 7 / 8 / 5 / 6 / 4 | **Overcharge**, 3 energy, cd 4, enhancement, Hold: ignore 4 Defense, +4 damage; Overheat: takes 2 more per strike | glass cannon, has Prepared Position |
| oldSixty | Old Sixty (the city's walking bulwark) | Relic Walker | 36 / 8 / 4 / 2 / 12 / 3 | **Ironbound**, 2 energy, cd 3, defense, Hold: take 4 less damage per strike | slow wall, has Arc Burst |

### Pool and rarity gate

`pool` (repeats are weights): League Pikeman x3, Pavise Guard x3, Coil Crossbowman x3, Sapper x2, Relic Walker x1, Field Repair, Flare, Mend, Ward, Fireburst. With `setRarityGate({ uncommon: 3, rare: 6 })` the first two rounds offer only League Pikemen, Pavise Guards and spells: **no Crossbowman before round 3 and no Relic Walker before round 6**, so the starting army carries the first Crossbowman (tested).

## 2. Mapping to FACTIONS.md section 6, and what was simplified

| spec | built | difference and why |
|---|---|---|
| Set Shield: 2 less **ranged** damage for adjacent Archers | 2 less damage per strike of any kind | no ranged-only status exists (Engine request 2); Crossbowmen behind the plug are rarely meleed |
| Prepared Shot: "on Hold and unmoved **last round**, the next ranged strike gets +4/+20" | while holding and unmoved **this battle**: +3 damage, +15 hit per strike | passives see only this battle's movement; a cross-round "held for a round" state needs an engine counter (Engine request 5). Reduced because it is always on while Hold |
| Prepared Position: +2 more damage | same | the passive already gives Prepared Shot while Hold, so the skill is a pure +2 |
| Relic Guard variant, Wear: loses 1 Mov below 50% HP | **Relic Walker** class (as briefed); Wear = -2 damage, -10 hit | passives cannot change Mov (Engine request 3) |
| Arc Burst: range 2, ignores 3 Def, Overheat 3 self-damage | Walker's weapon reaches 1-2; +3 damage added; Overheat = cooldown 4 and 2 more damage taken per strike | abilities cannot change range or hurt their user (Engine request 4); the +3 damage is my addition because a 3-energy skill with a 4-round cooldown needs a payoff |
| Dig In as a barricade | Sapper class, `spawn` ability, 10 HP | as specified; the 4-round decay is a labelled default |
| Flare: mark an enemy, Prepared Shot units get +2 hit | friendly-unit status, +20 hit | no enemy-unit spell shape (Engine request 6) |
| Field Repair: heal 4 | heal 4 at **0** Supply | at 1 Supply it would be strictly worse than Mend and never played; free makes it a real trade-off |
| Garrison Doctrine | not built | removed by Scott |
| Random Malfunction | not built | Overheat is deterministic (Scott) |

## 3. Results

### 3.1 Single-player levels (400 seeds per variant)

Five levels in the style of `experiments/levels/levels.mjs` (`experiments/factions/iron-league/scenarios.mjs`, run with `run-scenarios.mjs --seeds 400 --replay 10`): Blue = the League player with a scripted plan, Red = a fixed script of shipped classes marching on the tile the League defends. Every variant is played for seeds 1-400; 10 seeds of every variant are rebuilt from their log headers (scenario definition plus logged actions): **600 replayed logs, 0 mismatches**. Full tables with survivors, HP, damage, ability use and barricade counts are in `docs/experiments/results/factions/iron-league/scenario-*.md` (and `.json`). "Win" = the Red army destroyed or its keep taken; "none" = neither by the round limit (the plug holds but Red is not finished, 40 rounds). Δ in the ablation rows is against the skilled variant S (ns = not significant at 95%).

Variants: **N** naive (every unit Advances, no picks) | **M** moving (Advance, with the skill picks: skills that need Hold fail, Hold passives never fire) | **H** held (Hold, Rally only: the League passives without League skills) | **S** skilled (Hold and the League skill picks) | **S-x** S minus one skill, passive or spell | **P** plain (the same formation of plain Pikemen and Archers, Hold, Rally). Every holding variant releases the lines' Pikemen to hunt stragglers at a fixed round, because Red archers standing out of reach otherwise turn every level into a stalemate.

| level (map) | Blue v Red (Supply, units) | N naive | M moving | H held | **S skilled** | P plain |
|---|---|---|---|---|---|---|
| A. The Bridge (River Ford): Pavise plug on the bridge exit, 3 Crossbowmen at range 2 of the bridge | 8 v 22 (5 v 18 units) | 0% | 1% | 65% | **73%** | 2% |
| B. The Gap (choke_gap1): Pavise plug at the lane mouth, 3 Crossbowmen | 10 v 26 (6 v 18) | 0% | 0% | 36% | **57%** | 3% |
| C. The Ridge Pass (ridge_line): Sapper barricade in the pass, Crossbowmen on the ridge, Relic Walker | 14 v 13 (6 v 9) | 0% | 18% | 21% | **61%** | 47% (8 v 13: swaps Sapper and Walker for Pikemen) |
| D. The Wall (River Ford): Sapper barricade on the bridge exit | 11 v 18 (6 v 15) | 0% | 4% | 23% | **30%** | 37% (8 v 18) |
| E. The Captain's Bridge (River Ford): champion kit Field Works | 9 v 18 (6 v 15) | 18% | 27% | 89% | **82%** | 83% |

**Preparation is measurably stronger than the same units moving**: in A, B and C the held-and-skilled line wins 73% / 57% / 61% against 1% / 0% / 18% for the same units and picks moving (M), and 0% for naive Advance. The plain-class formation (P) loses A and B (2% and 3%). The League's edge in A and B comes from the passives, not the picks: removing Prepared Shot costs 61 and 44 points, Set Shield 36 (A) and 0 (B, no ranged threat reaches the Crossbowmen behind the plug). Where the defenders are only the plug and its shooters (A, B) the Red army arrives one unit at a time and loses about one unit a round.

Ablations (Δ Blue win against S, points; ns = not significant):

| removed | A Bridge | B Gap | C Ridge Pass | D Wall | E Captain |
|---|---|---|---|---|---|
| Rally (shipped Pikeman skill, for scale) | -73 | -37 | -55 | -29 | -26 |
| **Prepared Shot** (passive) | **-61** | **-44** | **-19** | -7 | -6 |
| **Set Shield** (passive) | **-36** | -1 ns | **-10** | +1 ns | -1 ns |
| Planted Pike (passive) | 0 | 0 | not in level | not in level | not in level |
| Wear (passive) | | | +1 ns | | |
| **Set Position** (skill) | -1 ns | 0 ns | **-33** | -5 ns | 0 ns |
| **Prepared Position** (skill) | -8 | **-21** | -6 ns | -1 ns | +2 ns |
| Arc Burst (skill, Overheat) | | | -13 | | |
| Dig In (skill, 10 HP barricade) | | | +4 ns | -1 ns | |
| Field Works (champion kit) | | | | | **+7** (removing it helps) |
| Field Repair (spell) | | 0 ns | | | |
| barricade HP 20 / 30 instead of 10 (sensitivity, not a proposal) | | | | **+11 / +10** | |

Reading:

- **The two passives that fire while Hold carry the faction** (Prepared Shot, Set Shield). Set Position and Prepared Position add little where the plug is not under pressure (A, B, D, E) and a lot where it is (C: Set Position -33 points, Arc Burst -13).
- **The barricade at its confirmed 10 HP does not pay.** One Pikeman hit is 16 damage against a 0-Defense tile object with 10 HP, so a barricade buys about one enemy strike and one movement step per Dig In (Red dealt 42.7 damage to barricades per game in C and 22.3 in D, and destroyed 2.5 and 1.3 of them). With 20 or 30 HP (sensitivity variants X20, X30 in level D) the same plan gains 10-11 points. On a one-tile bridge the Pavise plug already does what the barricade would; the wall also stops Red stepping into the pocket the Crossbowmen cover, so Field Works (E) slightly lowers the win rate (+7 when removed).
- **The Sapper and the champion kit did not show a benefit against a plain unit in the same slot** (D: plain 37% v skilled 30%; E: 83% v 82%). Level E's champion is a strong body (Def 12, 30 HP), so E mostly measures the champion.
- **Overheat works as a deterministic cost**: Arc Burst fires on rounds 1, 5, 9 ... of a continuous plan (checked in the rule test), and removing it costs 13 points in C.
- Rally is the largest single effect in every level, which is a property of the shipped kit, not of the League.

### 3.2 Paired, side-swapped simulations (100 seeds x 2 sides)

`experiments/factions/iron-league/run-sim.mjs --seeds 100 --replay 3` on the real rules: seeds 1-100, the League plays both banks (every seed is also played with the armies swapped; the mirror is played once with blue first), 30-round limit, rarity gate `{ uncommon: 3, rare: 6 }`. League army: the Captain (default champion), 2 League Pikemen, 1 Coil Crossbowman and 1 Pavise Guard in the shipped starting positions, League pool, and the League commander below. Baseline: the shipped starting army, shared pool, shipped heuristic. **34/34 games replayed from their log headers, 0 mismatches** (3 per cell in the main run: 24; 1 per cell in the five parameter runs below: 10). Data: `league-sim.{md,csv,json}`.

| map | matchup | games | first army wins | second army wins | draws | rounds | keep captures | League losses / kills per game |
|---|---|---|---|---|---|---|---|---|
| River Ford | League v baseline | 200 | 0.0% (0.0-1.9) | 0.0% (0.0-1.9) | **100%** (98.1-100) | 30.0 | 0% | 1.6 / 3.3 |
| River Ford | League, shipped AI v baseline | 200 | 0.0% (0.0-1.9) | 0.5% (0.1-2.8) | 99.5% (97.2-99.9) | 30.0 | 0.5% | 2.4 / 2.6 |
| River Ford | League v League | 100 | 0.0% | 0.0% | 100% (96.3-100) | 30.0 | 0% | 6.1 / 5.3 (blue) |
| River Ford | baseline v baseline (reference) | 100 | 1.0% (0.2-5.4) | 2.0% (0.6-7.0) | 97.0% (91.5-99.0) | 29.5 | 3.0% | 4.5 / 4.2 (blue) |
| choke_gap1 | League v baseline | 200 | 0.0% (0.0-1.9) | 0.0% (0.0-1.9) | **100%** (98.1-100) | 30.0 | 0% | 1.7 / 6.9 |
| choke_gap1 | League, shipped AI v baseline | 200 | 0.0% | 0.0% | 100% | 30.0 | 0% | 1.9 / 2.3 |
| choke_gap1 | League v League | 100 | 0.0% | 0.0% | 100% (96.3-100) | 30.0 | 0% | 0.0 / 0.0 |
| choke_gap1 | baseline v baseline (reference) | 100 | 0.0% | 0.0% | 100% (96.3-100) | 30.0 | 0% | 2.9 / 3.6 (blue) |

Villages captured per game are in the CSV (League v baseline: 0.05 / 0.43 on River Ford and 0.05 / 0.55 on choke_gap1, first / second army; baseline mirror 1.1 and 1.3).

**What this shows and does not show.**

- **No decisive result, for the League or the baseline.** All League cells are 99.5-100% draws, the same stalemate the shipped rules already produce (baseline mirror 97-100%, `docs/experiments/BASELINE.md`). The League neither breaks nor worsens it. I do not recommend any number from these draw rates.
- **The League does hold and does trade well.** Against the baseline army on choke_gap1 it kills 6.9 units for 1.7 lost per game (4.1 : 1) and on River Ford 3.3 for 1.6 (2.1 : 1); the baseline mirror trades about 1 : 1 (0.9 and 1.2).
- **The same League units played by the shipped heuristic trade 1.1-1.2 : 1**: it Advances everything, buys by the shipped mix, and overwrites the picks, so it activates none of Set Position, Prepared Position or Arc Burst (0.0 per game in `league-sim.md`) and plays no Field Repair or Flare. Culture-specific play is what carries the numbers above.
- **The League cannot convert holding into a win.** The League commander marches on the enemy keep once its field HP reaches `seizeRatio` times the enemy's. The sweep below shows that marching earlier loses about as often as it wins: preparation bonuses do not fire while moving (as designed), and the baseline's champion (Def 12) is a wall for League damage (a held Crossbowman does 6+6+3-12 = 3 damage per hit before Prepared Position).

League v baseline, League commander parameters (200 games per cell, seeds 1-100 both sides; `league-sim-*.{md,csv,json}`):

| commander variant | River Ford: League / baseline wins, draws | League losses / kills | choke_gap1: League / baseline wins, draws | League losses / kills |
|---|---|---|---|---|
| march on the keep at HP ratio 1.0 | 1.5% / 0.0%, 98.5% | 2.6 / 3.1 | 0.0% / 1.0%, 99.0% | 3.1 / 3.0 |
| 1.3 | 2.0% / 0.0%, 98.0% | 2.1 / 3.0 | 0.0% / 1.0%, 99.0% | 2.7 / 4.2 |
| 1.6 | 0.0% / 0.0%, 100% | 1.7 / 3.3 | 0.0% / 0.5%, 99.5% | 2.1 / 6.1 |
| **2.0 (default)** | 0.0% / 0.0%, 100% | 1.6 / 3.3 | 0.0% / 0.0%, 100% | 1.7 / 6.9 |
| every unit Advances (no Hold, no formation) | 0.0% / 0.0%, 100% | 3.4 / 1.6 | 0.0% / 0.5%, 99.5% | 3.4 / 1.6 |
| formation without skills or spells (no Rally either) | 0.0% / 4.5%, 95.5% | 8.9 / 2.6 | 0.0% / 8.0%, 92.0% | 10.3 / 3.6 |

**The League commander** (`experiments/factions/iron-league/commander.mjs`, a thin culture-specific commander written because the shipped one cannot play the culture; it plans through `match.apply`, so its games log and replay): (1) buys the card that fills the next empty slot of a hand-drawn killing ground per map (River Ford: Pavise plug on 7,5, Crossbowmen on 7,4 / 7,6 / 6,5, Pavise Guards and Pikemen behind; choke_gap1: plug on 6,5, Crossbowmen on 5,5 / 6,4 / 6,6), spends leftover Supply on filler Pikemen while two population slots stay free for a Crossbowman, and cycles unwanted cards so the hand does not clog; (2) walks units to their slots (planning move, then Advance with a tile objective) and Holds; (3) picks Set Position / Prepared Position / Arc Burst; (4) casts Field Repair, Mend, Flare, Ward, Fireburst by simple rules; (5) marches on the keep at `seizeRatio`. **AI limitations, reported honestly**: hand-drawn formations for two maps only (the ridge map has none, so no simulation there), no flank handling, a single release rule, Sappers are never bought (no wall on these maps, see level D), no retreat or withdraw, and no use of the champion kit (Field Works would wall up the bridge tile the Crossbowmen shoot at).

### 3.3 Findings that go beyond the League

1. **Advance targeting stalls across rivers.** `selectAttackTarget`/`nearestOpponent` in `src/battle.js` picks the nearest enemy by Manhattan distance, so an Advancing unit on the far bank of the River Ford whose nearest enemy is across the water, with the bridge exit occupied, sees no tile that improves its range and holds forever ("no movement improves attack range"; test 29, `todo`). In the levels this left Red stragglers standing off for the whole game until I gave Red a tile objective, and it is a plausible contributor to the River Ford stalemate (97% draws in the baseline mirror). Proposed change under Engine requests.
2. **The hand clogs without cycling.** With a shared pool weight of 3/17 per unit card and a hand limit of 8, unwanted cards (Sappers, duplicate Pikemen) fill the hand and block draws: in an early commander version the hand sat at 8 cards of Sappers and duplicate Pikemen for 25+ rounds and no Crossbowman arrived. The commander now cycles one unwanted card a round.
3. **Population cap versus rare cards.** With the rarity gate the rare Relic Walker cannot be drawn before round 6 and filler units may already have used the population cap of 10; the commander keeps two slots free. Whether the gate and cap interact well is a question for the shared rules, not the League.
4. **A one-tile lane rewards a plug more than a wall.** A unit on the exit tile makes the enemy queue on the bridge under range-2 fire every round. A barricade on that tile does the same only while it stands: it falls to one hit and the Sapper's cooldown is 2, so on the rounds it is down the enemy steps into the pocket beside the Crossbowmen (who cannot shoot adjacent targets, range 2 only).

## 4. Rejected, simplified, and why

| item | decision |
|---|---|
| Garrison Doctrine, free Brace on controlled tiles | not built (removed by Scott). |
| Random Malfunction / 25% failure | not built; Overheat is a fixed cooldown extension and vulnerability. |
| "Pocket" formation (leave the exit tile empty, Pikemen on its flanks, Crossbowmen behind) | tried first. Red archers on the east bank out-ranged the flank Pikemen (Crossbowmen at 6,4 / 6,6 could not reach them), so Red survivors stood off and plinked; the plug formation replaced it. |
| Relic Guard variant (spec) | replaced by the Relic Walker class (as briefed); Wear as damage and hit instead of Mov. |
| Ranged-only Set Shield, cross-round Prepared Shot, enemy-marking Flare, self-damage Overheat | closest simpler mechanic built; each is an engine request below. |
| Sapper as a skill any unit carries | Sapper is a class (labelled default); a skill would need `classes` of every League unit and gain little. |
| Sapper walls in the simulations | not used by the League commander: level D shows no benefit at 10 HP. |
| Any change to shared engine files, default pool, default balance, binary assets | none. `git diff 7e9d663..HEAD --stat -- src` shows only `src/factions/iron-league.js`. |

## 5. Engine requests (exact proposals; none applied here)

Failing tests are in `tests/faction-iron-league.test.mjs` as `todo` (they report as `not ok ... # TODO` and do not fail `npm test`).

| # | request | proposed change | test |
|---|---|---|---|
| 1 | **Culture filter on abilities.** League skills (`classes: ['pikeman']`) currently also apply to the other side's plain Pikemen and Archers (no AI picks them, but a human or a future AI could). | `src/abilities.js`: `abilityApplies = (a, unit) => Boolean(a.classes?.includes(unit.cls) \|\| a.units?.includes(unit.id)) && (!a.culture \|\| a.culture === unit.culture)`. League abilities already carry `culture: 'league'`; variants, new classes and champions carry `culture`. | todo 25 |
| 2 | **`rangedDamageTaken` status** for a ranged-only Set Shield. | `src/battle.js`: after `damageTaken`, subtract `(f.dist > 1 ? target.statuses?.rangedDamageTaken : 0) \|\| 0`; add the key to `STATUS_EFFECT_KEYS` (`src/passives.js`) and to the cleared keys after the battle. Then Set Shield's effect becomes `{ rangedDamageTaken: 2 }`. | todo 26 |
| 3 | **Passive stat deltas / pre-movement passives** for Wear (-1 Mov). | evaluate passives with `when: { hpBelow }` before movement and let `battleMovement` read a `movement` status; or add `effect.stat: { mov: -1 }`. | none (design) |
| 4 | **Ability self-damage** for Overheat (3 damage). | `src/abilities.js` `activatePhase`: `if (a.selfDamage) next.hp = Math.max(1, next.hp - a.selfDamage)` and report it in the event. | none (design) |
| 5 | **Held-rounds counter** so Prepared Shot means "held last round". | `src/match.js` end-of-round loop: `u.heldRounds = movedIds.has(u.id) ? 0 : (u.heldRounds \|\| 0) + 1`; `src/passives.js` `passiveHolds`: `when: { heldRounds: n }`. Prepared Shot would then be `{ stance: ['hold'], heldRounds: 1 }` with the spec's +4 / +20. | none (design) |
| 6 | **Enemy-unit spell shape** for Flare (mark an enemy). | `SPELL_CATALOG` target `'enemy-unit'` with a status the battle reads (`markedBy`), plus a friendly `hitBonusVsMarked`. | none (design) |
| 7 | **Bug: withdrawing a variant** stores `unitId: u.cls`, so a benched Coil is an `archer` (cycling reads the common Archer card, combining sees the base identity). | `src/match.js` `withdraw`: `unitId: u.variantId \|\| u.cls`. | todo 27 |
| 8 | **Bug: `prepare()` reads the base class card for rarity**, so a Coil (or any variant) placed in a starting roster is `common`. | `src/match.js` `prepare`: `unitCardFor(u.variantId ?? u.cls)?.rarity`. | todo 28 |
| 9 | **Advance targeting by path, not Manhattan distance.** | `src/battle.js` `nearestOpponent`: rank by the cheapest movement path (a cost map per unit, or `computeRange().targets`), falling back to Manhattan when unreachable. Relevant to CORE-02. | todo 29 |

## 6. Open questions for Scott

1. **Champion**: Captain Ilse Voss (default, provisional), Master Tobiah Kettle, or Old Sixty. Level E shows Field Works slightly hurting a plug-and-pocket line (+7 points when removed); Ironbound or Overcharge may suit the doctrine better. The champion registry cannot carry passives, so all three are kit-only.
2. **Sapper**: keep the class (built), make Dig In a skill of every League unit, or drop the barricade? At 10 HP it is not measurably useful (levels C, D); at 20-30 HP it gained 10-11 points (level D). Barricade HP and the 4-round decay are labelled defaults.
3. **Prepared Shot** as an always-on Hold bonus (built: +3 damage, +15 hit) or a true "held last round" bonus (needs Engine request 5)? It is the strongest League effect by far (-61 / -44 points when removed in the two bridge levels), so its size matters most for balance.
4. **Set Shield** against all damage (built) or ranged only (Engine request 2).
5. **League win condition.** The League holds and out-trades the baseline but produced no decisive game; whether that is acceptable, and whether forward deployment, Muster or a keep-pressure card should help a holding faction, is a CORE-02 decision.
6. **Field Repair at 0 Supply** (built) or 1 Supply (never played, since Mend is better); Flare's shape (Engine request 6).
7. **Costs and pool weights**: Pavise Guard 2, Relic Walker 4, Sapper 2 Supply; pool weights are 3/3/3/2/1 plus 5 spell cards. Nothing here was tuned; a Crossbowman is uncommon and cannot be drawn before round 3.
8. Whether League skills should be tied to the League by the culture filter (Engine request 1) or stay class-wide.

## 7. Verification

| check | result |
|---|---|
| `npm test` | 90 tests: 85 pass, 5 `todo` (recorded engine gaps), 0 fail. 61 shipped checks unchanged; 29 League checks (24 pass) in `tests/faction-iron-league.test.mjs`: every unit, passive, skill, spell, the barricade, all three champions, registration and removal, the rarity gate with the League pool, a League v League match replayed exactly, the League commander replayed exactly. |
| default game untouched | `node tools/sim/run.mjs --games 30 --blue heuristic --red greedy --swap --seed 1 --verify` on this branch v commit 7e9d663: `summary.csv` byte-identical, all 60 game logs byte-identical except the header `commit` field, 0 replay failures (60 games). |
| level replays | 600 scenario logs replayed from their headers, 0 mismatches. |
| simulation replays | 34 League games replayed from their log headers, 0 mismatches. |
| nothing registers in the default game | the module only exports data; the first test asserts `ACTIVE_CULTURES` is empty after import and that every shared table returns to its previous keys after `resetCultures()`. |
| not done | no browser check (nothing visible changed; placeholder tint art is untested in the browser); no ridge_line simulation (no formation drawn); no tuning of any number. |
