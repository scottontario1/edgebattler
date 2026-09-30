# The Argent Crown: implementation spec and results

Branch `faction/argent-crown`, built on `7e9d663` (the shared culture hooks). Status: **implemented, tested, measured; not registered in the game.** Every number below is a **prototype default** for paired-seed experiments, not a balance decision (`docs/DEVELOPMENT.md`): Scott chooses. Source design: `FACTIONS.md` sections 1b and 4. Hooks used: `docs/CULTURE_HOOKS.md`.

## 1. What was built

| file | what |
|---|---|
| `src/factions/argent-crown.js` | the culture definition (default export, for `registerCulture`), every tunable number as an exported named constant, and `registerArgentCrown()` (registers it and finishes Brenna's passives, see Engine requests E1) |
| `tests/faction-argent-crown.test.mjs` | 23 rule checks (84 in the whole suite, all passing) |
| `experiments/factions/argent-crown/scenario.mjs`, `scenarios.mjs`, `run-scenarios.mjs` | the three single-player levels, the scenario engine and runner |
| `experiments/factions/argent-crown/crown-commander.mjs`, `sim.mjs` | a thin culture-aware commander over the shipped heuristic, and the paired side-swapped simulation runner |
| `docs/experiments/results/factions/argent-crown/` | `crown-1..3.md/.json` (400 seeds per variant) and `sim-summary*.md/.json`, `sim-games*.csv` (200 seeds x 2 sides per cell, two maps) |

Nothing registers in the game: the module only exports data and a function; tests, experiments and the simulators call `registerArgentCrown()`. With it unregistered `npm test` and the shipped simulator output are byte-identical to `7e9d663` (section 6).

## 2. The faction

**Line Doctrine** (the simple version Scott confirmed): a unit gains **+1 Defense per adjacent friendly infantry unit, at most +2**, and loses nothing when alone. It is a real Defense bonus: the passive adds the existing `equipDef` battle status, which the combat forecast reads, so a crit is reduced by 3 per point exactly as Defense would. "Infantry" = Pikeman, Archer, Bannerman, Oathsworn and Brenna (`INFANTRY`); cavalry do not count as neighbours but do receive the bonus. Every Crown unit carries it.

### Units

| unit | rarity | cost (Supply) | implemented as | change from base | passives | default stance |
|---|---|---|---|---|---|---|
| Crown Pikeman | common | 1 | variant of Pikeman | none | Line Doctrine | advance |
| Levy Archer | common | 2 | variant of Archer | none | Line Doctrine | hold |
| Crown Knight | common | 3 | variant of Cavalier | none | Line Doctrine | advance |
| Crown Guard | common | 2 | variant of Pikeman | HP +2, Def +1, Mov -1 (26 / 8 / 10 / 3) | Line Doctrine; **Shieldwall**: beside friendly infantry, 2 less damage per strike | hold |
| Bannerman | uncommon | 2 | **new class** (Pikeman body) | HP -4, Str -3 (20 / 5 / 9 / 4) | Line Doctrine; **Banner**: friendly Hold or Protect units within 2 tiles take 1 less damage per strike | hold |
| Oathsworn | rare | 3 | **new class** (Pikeman body) | HP +4, Def +3 (28 / 8 / 12 / 4) | Line Doctrine; **Sworn Guard**: while Protecting with a neighbour, the adjacent allies take 2 less and it takes 2 more | hold (set Protect after recruiting) |

Stat order is HP / Str / Def / Mov. Costs, deltas and radii are the constants at the top of the module (`GUARD_DELTA`, `GUARD_COST`, `SHIELDWALL_REDUCTION`, `BANNER_*`, `SWORN_*`, ...). Placeholder art: the base class sprite times a blue-silver tint (`TINTS`); no binary assets.

**Why Bannerman and Oathsworn are real classes and the Guard is not.** Kits are keyed by class (`abilityApplies`). Hold the Standard and Interpose must not reach every Pikeman, so those two units need their own `cls`. The cost is that they lose the Pikeman kit (Rally, Brace). Crown Guard has no unit-only skill, so it stays a Pikeman variant and keeps Rally and Brace (this mattered: in an exploratory 60-seed run, with the Guard as a real class the Crown ended 12 +/- 7 field HP behind the baseline; as a variant it ends 7 to 18 ahead, section 4.2). Engine request E3 (kits by variant) removes the trade-off.

### Skills (kit abilities, planning-selected)

| skill | rarity | who | cost / cooldown | phase | as designed | as implemented |
|---|---|---|---|---|---|---|
| Close Ranks | common | Pikeman class (Crown Pikeman, Crown Guard) | 1 / 2 | defense | adjacent friendly infantry take 2 less damage per strike | **the unit itself** takes 2 less damage per strike; does not force Hold |
| Hold the Standard | uncommon | Bannerman | 2 / 3 | defense | requires Hold; friendly units within 2 tiles heal 6 | requires Hold; **the Bannerman itself** takes 2 less damage per strike (no heal) |
| Interpose | rare | Oathsworn | 2 / 2 | defense | requires Protect; up to 4 of the subject's damage goes to the Oathsworn | requires Protect; **the Oathsworn itself** takes 4 less damage per strike (no redirection) |

A kit ability can only set a status on its own unit and heal only through the ids `rally` / `secondWind`, so the three "on other units" effects are simplified (E4, E5). Skills use phase `defense` because the design says so; all three are statuses cleared after the battle.

### Spell

| spell | rarity | cost | shape | as designed | as implemented |
|---|---|---|---|---|---|
| Rally Banner | common | 1 Supply | friendly unit, upcoming battle | every friendly unit within 2 tiles gains Ward | **one** friendly unit takes **3 less damage per strike** this battle (`RALLY_BANNER.reduction`); stacks with Line Doctrine and Ward. Not Ward itself: Ward halves damage, and a 3-point cut is what a Ward-sized spell that suits many small hits looks like |

Mend, Ward and Fireburst stay in the pool as shared spells (FACTIONS.md 1b).

### Champion: Brenna (proposed kit; Scott chooses)

Same body as the shipped Brenna (HP 28, Str 9, Def 13, Mov 4, Iron Sword). Registered as champions `brennaCrown` (either side) and `brennaCrownB` (a second copy, needed only for a Crown mirror: two units cannot share an id). The kit applies to `units: ['brenna', 'brennaCrown', 'brennaCrownB']`, so it also reaches the shipped Brenna when the culture is registered. Dreg is unaffected.

| ability / passive | cost / cooldown | phase | effect |
|---|---|---|---|
| **Bulwark of the Realm** | 2 / 3 | defense | requires Hold; she takes 3 less damage per strike |
| **Oathkeeper's Strike** | 1 / 2 | enhancement | requires a legal target; her strike gains +3 damage and +10 hit |
| **Crown's Presence** (passive) | 0 | always | friendly infantry within 2 tiles take 1 less damage per strike |
| Line Doctrine (passive) | 0 | always | as every Crown unit |

### Draw pool

`POOL` (repeats are weights): Crown Pikeman x3, Crown Guard x2, Levy Archer x2, Crown Knight x1, Bannerman x1, Oathsworn x1, Mend, Ward, Fireburst, Rally Banner (14 entries). The weights and the absence of Barrier are prototype choices. With the rarity gate (`setRarityGate({ uncommon: 3, rare: 6 })`) Bannerman is drawable from round 3 and Oathsworn from round 6 (tested).

## 3. Rule checks (`tests/faction-argent-crown.test.mjs`, 23 tests)

Registration inert and fully removable; definition shape; every card has a rarity, cost and culture and the pool is Crown cards plus Mend / Ward / Fireburst; rarity gate (Bannerman not before round 3, Oathsworn not before round 6); unit templates and deltas; recruit / deploy keeps identity, passives and default stance, combining by identity; Line Doctrine passive (0/1/2/3 neighbours, cap, class filter, cavalry, enemies, diagonals, distance) and in real battles (exact damage with 0 / 1 / 2 / 3 neighbours, scattered gets nothing, a plain Pikeman gets nothing, statuses cleared); Shieldwall (0 / 3 / 4 reduction); Close Ranks (kit, cost, cooldown, energy validation, cooldown skip, exact reduction); Banner aura (stance, range, enemies, self); Hold the Standard and Interpose (stance requirements, kit exclusivity); Sworn Guard passive and in battle (ally -2, Oathsworn +2 taken, lone Oathsworn unpenalised); Rally Banner (cost, target, exact reduction, stacking, expiry, cancel refund, enemy target refused); Brenna (body, kit on both ids, Dreg unaffected, respawn keeps passives, Bulwark and Strike); Crown's Presence; whole games that replay exactly (header records culture, pools, rarity gate); three gap checks that pin engine limitations and will fail loudly if the engine fixes them (E1, E2, E3).

## 4. Results

All runs use the shipped rules, no default changed. Every scenario log is replayed from its header (350 logs, 0 mismatches); one simulated game per cell and side assignment is replayed (10 per map, 10/10 ok).

### 4.1 Single-player levels (400 seeds per variant; `docs/experiments/results/factions/argent-crown/crown-N.md`)

Blue = the Crown with a scripted plan, Red = fixed plain (baseline) units that advance. **N** naive = units scattered as deployed, default stances, no picks or spells. **S** skilled = a block on the field, Hold, the level's picks. Each other row removes one thing from S. "Doctrine off" strips Line Doctrine from every Blue unit and changes nothing else. "Scattered" keeps the units, plan and passives but places them apart. Blue win % (95% interval); the other outcomes are Red wins and time-outs at the round limit (18, 20 and 22 rounds).

**The core idea holds: the same units win 63-79% in formation and 0-13% scattered.**

| variant | L1 Shield Wall | L2 Standard and Oath | L3 Rally and Ride |
|---|---|---|---|
| N naive | 0% (0-1) | 6% (4-9) | 2% (1-4) |
| **S skilled (block)** | **72% (67-76)** | **79% (75-83)** | **63% (58-68)** |
| S scattered | 0% (0-1), -72pp | 51% (46-56), -29pp | 13% (10-17), -50pp |
| S with Line Doctrine stripped, same places | 40% (36-45), -31pp | 61% (56-66), -18pp | 43% (38-48), -20pp |
| S with every Crown passive stripped (skills and spells kept) | 1% (1-3), -70pp | 51% (46-55), -29pp | 31% (26-35), -32pp |
| S without the unit passives (Shieldwall / Banner + Sworn Guard + Presence / Presence) | 41% (37-46), -31pp | 69% (64-73), -10pp | 47% (42-52), -16pp |

Skills and spells (change in Blue win against S; ns = not significant at 95%):

| skill or spell | level | S without it | Δ | comment |
|---|---|---|---|---|
| Close Ranks | L1 | 66% (61-70) | -6pp (ns) | but Blue HP left falls 81% to 74% and damage dealt by Red rises 113 to 166: it protects, it does not decide |
| Hold the Standard | L2 | 79% | 0pp (ns) | simplified to self-protection; not measurable |
| Interpose | L2 | 79% | 0pp (ns) | simplified to self-protection; not measurable |
| Bulwark of the Realm (swapped for Oathkeeper's Strike) | L2 | 77% | -3pp (ns) | |
| Oathkeeper's Strike | L2 | 78% | -2pp (ns) | |
| Oathsworn Protect order | L2 | **88%** | **+9pp** | removing Protect **helps**: as implemented the Oathsworn pays 2 damage per strike and the benefit spreads to every adjacent ally (see 5) |
| Rally Banner (two casts, round 2) | L3 | 62% (57-67) | -1pp (ns) | one unit, 3 less per strike, one battle: too small to decide a level |
| Charge from the block | L3 | 56% (51-60) | -8pp | |
| Riding out at round 3 (without it the Knights stay in the block and never Charge) | L3 | 26% (22-31) | -37pp | the Charge pick alone is worth 8pp, so most of this is the Knights joining the fight at all |
| Pikeman Rally (shipped) | L1 / L2 / L3 | 26% / 40% / 19% | -46 / -39 / -44pp | included to show how much sustain matters; it is not a Crown card |

### 4.2 Paired side-swapped simulation (`sim.mjs`; 200 seeds x 2 sides per cell, 400 games; mirrors 200)

Armies: **base** = the shipped starting units, the shipped draw pool, plain classes, champion `paladinPlain` (Brenna's body, no kit). **crown** = the same starting units turned into their Crown versions (identical stats and weapons, plus Line Doctrine), champion `brennaCrown`, the Crown pool. Rarity gate uncommon round 3 / rare round 6 for both. 30 rounds max. The map is not symmetric, so every seed is played with the Crown on both sides. AIs: **heuristic** = `src/ai/commander.js` unchanged; **crown AI** = `crown-commander.mjs` (section 4.4).

**Read this first: whole games are almost all draws.** The shipped simulation already draws 89-100% (`docs/experiments/BASELINE.md`, CORE-02): two heuristic armies lock in contact and Rally, Mend, Ward and Brace absorb the damage. The Crown does not change that (the win-rate columns below are 0-4% for every cell), so **win rate is not informative here** and the honest measures are the units lost and the living field HP at round 30. A/B in each row is the first-named army.

River Ford (the shipped map; keeps at 2,10 and 12,1):

| cell | A win | B win | draw | mean rounds | keep captured | B units lost minus A units lost (95%) | A field HP minus B field HP (95%) | formation index A / B |
|---|---|---|---|---|---|---|---|---|
| Crown (crown AI) v baseline | 0.0% (0-1.0) | 0.5% (0.1-1.8) | 99.5% (98.2-99.9) | 29.9 | 0.5% | +0.16 +/- 0.21 (ns) | **+7.1 +/- 2.7** | 1.39 / 0.88 |
| Crown (plain heuristic) v baseline | 0.3% (0-1.4) | 0.5% (0.1-1.8) | 99.3% (97.8-99.7) | 29.9 | 0.8% | -0.42 +/- 0.22 | **+6.8 +/- 2.8** | 0.90 / 0.91 |
| Crown (crown AI) v Crown (plain heuristic) | 0.0% (0-1.0) | 0.5% (0.1-1.8) | 99.5% (98.2-99.9) | 29.9 | 0.5% | **+1.12 +/- 0.25** | -2.9 +/- 2.9 (ns) | 1.41 / 0.92 |
| Crown v Crown with Line Doctrine stripped (both crown AI) | 0.5% (0.1-1.8) | 0.0% (0-1.0) | 99.5% (98.2-99.9) | 30.0 | 0.5% | **+0.59 +/- 0.25** | +3.2 +/- 2.7 | 1.35 / 1.36 |
| Mirror, crown AI both sides (A = Blue) | 0.5% (0.1-2.8) | 0.0% (0-1.9) | 99.5% (97.2-99.9) | 30.0 | 0.5% | +1.29 +/- 0.28 | -3.5 +/- 4.1 (ns) | 1.45 / 1.27 |
| Control: baseline v baseline (A = Blue) | 0.0% (0-1.9) | 0.0% (0-1.9) | 100.0% (98.1-100) | 30.0 | 0.0% | +0.21 +/- 0.27 | -1.2 +/- 4.1 | 0.87 / 0.90 |

Flat Open (`experiments/maps/flat_open.js`: the same keeps and villages with no terrain; a second map because River Ford's terrain and roads add noise, and it has a few more decisive games):

| cell | A win | B win | draw | mean rounds | keep captured | B units lost minus A units lost (95%) | A field HP minus B field HP (95%) | formation index A / B |
|---|---|---|---|---|---|---|---|---|
| Crown (crown AI) v baseline | 0.0% (0-1.0) | 1.8% (0.9-3.6) | 98.3% (96.4-99.1) | 29.7 | 1.8% | **+1.72 +/- 0.30** | **+18.5 +/- 3.2** | 1.32 / 0.78 |
| Crown (plain heuristic) v baseline | 2.0% (1.0-3.9) | 1.5% (0.7-3.2) | 96.5% (94.2-97.9) | 29.3 | 3.5% | -0.05 +/- 0.35 (ns) | **+6.0 +/- 3.5** | 0.79 / 0.71 |
| Crown (crown AI) v Crown (plain heuristic) | 0.0% (0-1.0) | 3.3% (1.9-5.5) | 96.8% (94.5-98.1) | 29.5 | 3.3% | **+1.99 +/- 0.31** | +6.2 +/- 3.2 | 1.36 / 0.91 |
| Crown v Crown with Line Doctrine stripped | 0.0% (0-1.0) | 0.3% (0-1.4) | 99.8% (98.6-100) | 30.0 | 0.3% | **+1.07 +/- 0.26** | +3.8 +/- 3.1 (ns) | 1.41 / 1.40 |
| Mirror, crown AI both sides (A = Blue) | 0.0% (0-1.9) | 0.0% (0-1.9) | 100.0% (98.1-100) | 30.0 | 0.0% | +0.62 +/- 0.35 | -3.8 +/- 4.0 (ns) | 1.44 / 1.42 |
| Control: baseline v baseline (A = Blue) | 0.5% (0.1-2.8) | 2.0% (0.8-5.0) | 97.5% (94.3-98.9) | 29.5 | 2.5% | +0.62 +/- 0.42 | -6.3 +/- 5.1 | 0.65 / 0.69 |

Army destroyed never happens (0.0% in every cell: a champion respawns, so a wipe-out cannot end a game with a champion), and village captures are 1.0-1.2 per game on River Ford and 1.8-2.3 on Flat Open for every cell, including the control. Full tables, side split and per-game CSVs are in `docs/experiments/results/factions/argent-crown/sim-*`.

What the simulation shows:

- **Line Doctrine measurably saves units in a whole game**: with the crown AI, an army with the doctrine loses 0.6 (River Ford) to 1.1 (Flat Open) fewer units per game than the same army without it (95% intervals exclude zero).
- **The plain heuristic already gets most of the doctrine's HP edge for free** (+6-7 field HP vs the baseline on both maps, no unit-loss gain), because Crown units are strictly no worse than base units; the formation-aware commander adds units saved (1.1-2.0 fewer lost than the plain heuristic on the same Crown army) and, on Flat Open, +18.5 HP vs the baseline.
- **None of that turns into wins**, because the game rarely ends. The crown AI is *worse* at the keep: it wins 0.0% of games against baseline while the baseline wins 0.5% / 1.8%, and the plain heuristic beats the crown AI 3.3% to 0.0% on Flat Open. It holds early and keeps Knights in reserve, so it trades well and does not push (limits in 4.4).
- **Mirror**: Blue loses 1.3 (River Ford) fewer units than Red with the same army and AI, a side/map bias larger than the baseline control (0.2), probably because the crown AI's hold posture suits the Blue start. Cells against a different army swap sides, so this bias cancels in them.

### 4.3 What a Crown card is worth (per-card view)

Crown Pikeman, Levy Archer and Crown Knight are the base units plus a free passive; they are strictly better than their base at the same price. That is the design ("loses nothing when alone") but it means the Crown needs its identity to be paid for elsewhere (cost, pool, or a cap on the doctrine) once Scott sets balance; the numbers above are the evidence for how big the free part is. The pool gives the Crown 14 entries against the shipped 10 (Barrier, a shipped skill card, is not in the Crown pool; Rally Banner is never played by the shipped heuristic, so a plain-heuristic Crown wastes that slot).

### 4.4 AI limitations, reported honestly

- The shipped heuristic plays Crown cards as three plain classes: it never casts Rally Banner, never picks Close Ranks / Hold the Standard / Interpose / Brenna's kit, never sets Protect for an Oathsworn, never closes up, and its recruiting `mix` weights are keyed by card key but its counts by class, so variant weights do not steer the mix.
- `crown-commander.mjs` wraps it: Rally Banner (cast before the heuristic spends the Supply), one planning move per foot unit to stand beside friendly infantry, infantry Hold until an enemy is within 7 tiles or round 5, Knights Hold until an enemy is within 6 tiles of any friendly infantry, Oathsworn Protect Brenna, and the Crown picks when an enemy is near and the energy is there. It raises the formation index (mean neighbours per unit, capped at 2) from about 0.9 to 1.4.
- It does not play for the keep, picks kit abilities only on "an enemy is near", and its parameters (`CROWN_PARAMS`) are untuned. A 40-seed probe (run before the Crown Guard became a variant, not repeated) found Hold-early and Knight reserve made little difference to units lost and HP.
- A better Crown commander would need Scott's decision on AI scope (`src/ai/*` was not edited).

## 5. Rejected or simplified, and why

| item | decision | reason |
|---|---|---|
| Close Ranks on adjacent allies | simplified to the unit itself | a kit ability can only set statuses on its own unit (E4) |
| Hold the Standard: heal 6 within 2 | simplified to 2 less damage on the Bannerman | heal exists only for the ids `rally` and `secondWind`; an object-based workaround (spawn a marker, consume it) needs two selections per round and clutters the log, so it was not used (E4) |
| Interpose: redirect up to 4 | simplified to 4 less damage on the Oathsworn | no redirection in the battle; statuses cannot name another unit (E5) |
| Sworn Guard applies to the Protect subject only | applies to **every adjacent ally** while Protecting | passive auras filter by class and stance, not by subject (E6). Consequence: the Oathsworn pays -2 for a benefit that goes to the whole ring, and in Level 2 removing the Protect order improves Blue by 9pp; recommend lowering `SWORN_SELF_PENALTY` to 1 or waiting for E6 |
| Rally Banner: Ward on every friendly unit within 2 tiles | one friendly unit, 3 less damage per strike | no friendly area spell shape (E7); the Ward status itself was kept out because it halves damage and a three-point cut is what suits many small hits |
| Bannerman and Oathsworn as Pikeman variants | real new classes | kits are class-keyed (E3); cost: no Rally or Brace |
| Crown Guard as a new class | Pikeman variant | keeps Rally and Brace; Close Ranks reaches it through the Pikeman class |
| Line Doctrine on cavalry as a giver | receives only | "friendly infantry" per the spec; Knights ride out of the line |
| Full formation-point system (screen, support, reserve) | not built | FACTIONS.md already deferred it |
| A "weak when scattered" penalty | not built | punishes baseline play (FACTIONS.md) |
| Barrier in the Crown pool | left out | prototype choice: the Crown's own defensive tools replace it |

## 6. Default game untouched

No shared file was edited (`git diff 7e9d663..HEAD --stat` touches only `src/factions/`, `tests/faction-argent-crown.test.mjs`, `experiments/factions/argent-crown/` and `docs/`). `node tools/sim/run.mjs --games 30 --blue heuristic --red greedy --swap --seed 1 --out <dir> --verify` on this branch and on a clean extract of `7e9d663`: `summary.csv` byte-identical (60 rows), all 60 game logs identical once the header `commit` field is removed, replay failures 0 on both. `npm test`: 84 of 84 pass (61 shipped checks plus 23 Crown checks).

## 7. Engine requests

None of these was implemented (shared files are off limits); each has a workaround in this branch or a labelled simplification. Proposed changes are exact so the root can apply them.

| id | gap | proposed change | used by |
|---|---|---|---|
| E1 | `registerCulture` copies no `passives` onto a champion template, so a champion cannot carry a passive or an aura | in `src/cultures.js`, when building `champs[id]` add `...(ch.passives ? { passives: ch.passives } : {})` (and `onDeath`) | Brenna's Line Doctrine and Crown's Presence; workaround `registerArgentCrown()` patches `CHAMPION_TEMPLATES` (gap test in the suite) |
| E2 | a variant card's `defaultStance` is not applied to the unit (the reserve is built from the class template, whose stance wins) | in `variantOver` (`src/roster.js`) set `stance: v.card?.defaultStance` unless `v.stats.stance` is given | Crown Guard; workaround `stats: { stance: 'hold' }` (gap test in the suite) |
| E3 | kits are keyed by class only, so a unit-specific skill needs a new class (which loses the Pikeman kit) and a Pikeman-class skill also reaches plain Pikemen | `abilityApplies = (a, u) => a.classes?.includes(u.cls) \|\| a.units?.includes(u.id) \|\| a.variants?.includes(u.variantId)`; then Bannerman and Oathsworn can be Pikeman variants keeping Rally and Brace, and Close Ranks is Crown-only. Known leak today: a plain Pikeman can select Close Ranks (test documents it) | Close Ranks, Hold the Standard, Interpose |
| E4 | an ability cannot affect other units or heal them | optional `aura: { radius, classes?, effect?, heal? }` on a kit ability, applied in `match.js` right after `activatePhase` for the ability's phase to every friendly unit within `radius` (numeric statuses added, `heal` amount capped at max HP), reported in the ability event | Close Ranks (radius 1, infantry), Hold the Standard (radius 2, heal 6) |
| E5 | no damage redirection | a status `interposedBy: { id, cap }` on the subject; in `battle.js` after Brace and Barrier, move `min(cap, incoming)` damage from the subject's strikes to the interposer (deterministic order, only while the interposer is alive and adjacent), with an `interposed` field on the strike event. The subject is the Oathsworn's `objective.targetId` | Interpose |
| E6 | a passive aura cannot target "the unit I am Protecting" | `aura.subject: 'protect'`: only the unit whose id is the owner's `objective.targetId` | Sworn Guard (also fixes the Oathsworn's net-negative trade) |
| E7 | no friendly area spell | spell `target: 'friendly-area'` with `radius`, resolved like `enemy-area` but over friendly units around the chosen unit (`resolveSpellEffect`, the `spell` handler, the UI target check) | Rally Banner as designed |
| E8 | passive and aura effects are invisible in the forecast and on unit cards | feed `evaluatePassives` output into the planning forecast (Defense already flows through `withEquip`) | UI legibility of Line Doctrine |
| E9 | a champion id is the unit id, so a mirror match needs two registered ids | allow `champions: { blue: 'brennaCrown', red: 'brennaCrown' }` with per-side instance ids | mirror matches (workaround: `brennaCrownB`) |

## 8. Open questions for Scott

1. **Simplified skills.** Accept Close Ranks / Hold the Standard / Interpose as self-protection for the prototype, or build E4 and E5 first? Measured effect today: Close Ranks saves HP but not wins; Hold the Standard and Interpose are not measurable.
2. **Oathsworn.** As implemented it is net negative (Level 2: removing Protect gives +9pp). Options: lower `SWORN_SELF_PENALTY` (2) to 1 or 0, or build E6. Which?
3. **Is a Crown card allowed to be strictly better than its base card?** Line Doctrine is free on every Crown unit; the simulation shows +6-7 field HP even for the plain heuristic. Candidates: a higher cost, a smaller cap, or fewer copies in the pool. (No defaults changed.)
4. **Crown Guard cost (2 v Pikeman 1), pool weights, Bannerman/Oathsworn costs and rarities** are all prototype defaults. The simulation has no signal for them (games do not end), so they need your call or a decisive-game mode first.
5. **Brenna's kit.** Two abilities plus an aura and Line Doctrine; is one active enough, and should the kit apply to the shipped `brenna` id for a player who picks the Crown (it does today) while the passives live only on `brennaCrown`?
6. **Who counts as infantry** for Line Doctrine: Pikeman, Archer, Bannerman, Oathsworn, Brenna today (`INFANTRY`). Should Knights count as givers? Should archers?
7. **Rally Banner**: one unit, 3 less per strike, 1 Supply. Keep, or wait for the area shape (E7)?
8. **AI scope.** Should `src/ai` learn culture play (Protect for Oathsworn, close-up, Rally Banner)? Today the Crown is only credible in the level scenarios and with the wrapper in `experiments/`.
9. **Game length.** Every simulated whole game draws (96-100%), so no faction can be balanced on win rate until CORE-02 is addressed; this document uses units lost and field HP instead.

## 9. Reproduce

```bash
npm test                                                                        # 84 checks
node experiments/factions/argent-crown/run-scenarios.mjs --seeds 400 --replay 10 --out docs/experiments/results/factions/argent-crown
node experiments/factions/argent-crown/sim.mjs --seeds 200 --map river_ford     # about 3.5 min on 3 workers
node experiments/factions/argent-crown/sim.mjs --seeds 200 --map flat_open
# sensitivity: --crown-params '{"holdEarly":false}'  --costs '{"crownGuard":1}'
node tools/sim/run.mjs --games 30 --blue heuristic --red greedy --swap --seed 1 --out <dir> --verify   # default-untouched check
```
