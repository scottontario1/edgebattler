# The White Fang Clans: implementation spec and results

Branch `faction/white-fang`, built on `ccr-d70cb868-ob7chg` @ 7e9d663 (2026-09-30). Culture id `fang` (`src/factions/white-fang.js`). **Nothing registers in the game**: only tests, experiments and simulators call `registerCulture`. Every number is a **prototype default** (FACTIONS.md section 5 where it gives one, otherwise labelled below); Scott chooses balance. No shared engine file, no binary asset and no default value was changed.

Principle (FACTIONS.md): once momentum starts, keep it going. The clans want Advance, melee contact and aggressive positioning; they are mediocre at sitting on an objective (no Brace, no Rally, no healing, nothing that pays for holding).

## 1. Files

| file | what |
|---|---|
| `src/factions/white-fang.js` | the culture definition (`default` export; `buildWhiteFang(options)` for sensitivity runs) and every constant, each commented |
| `tests/faction-white-fang.test.mjs` | 24 rule checks (unit deltas, each passive, skill, spell, Dreg's kit, pool, rarity gate, recruit/deploy/withdraw, respawn, replay, two engine findings) |
| `experiments/factions/white-fang/armies.mjs` | starting armies per side, mirror champion, `createMatch` options |
| `experiments/factions/white-fang/commander.mjs` | the clan commander (wraps the shipped heuristic; section 8) |
| `experiments/factions/white-fang/scenario.mjs`, `levels.mjs`, `run-levels.mjs` | five single-player levels (own scenario engine, see Engine request 6), 400 seeds |
| `experiments/factions/white-fang/sim.mjs` | paired, side-swapped simulations with replay checks |
| `docs/experiments/results/factions/white-fang/` | `level-1..5.{md,json}`, `sim-river_ford.*`, `sim-village_chain-dvil-5.*` |

`npm test`: 85 checks pass (61 shipped + 24 here). With the culture unregistered the default simulation is byte-identical to 7e9d663 (section 9.3).

## 2. Units

Reference art (supplied on `ccr-d70cb868-ob7chg`, `design_assets/factions/white_fang/`, not copied into this branch): the placeholder tint and the flavour text follow it. Placeholder sprite = the base class sprite multiplied by the tint (`SPRITE_FALLBACK`); no new binary asset.

| unit (card key) | rarity | cost | kind, and why | HP / Str / Skl / Spd / Def / Mov | passive | kit | art, tint |
|---|---|---|---|---|---|---|---|
| **White Fang Reaver** (`fangReaver`) | common | 1 | **new class** (Pikeman base). A variant would inherit Rally and Brace (kits are keyed by class) | 24 / 9 / 5 / 4 / 7 / 5 (Str +1, Def -2, Mov +1) | **Momentum:** +2 damage on every strike if it moved this battle | Reaving Rush | `reaver_sprite.png` wolf-pelt cloak over riveted plate, bearded axe; `#B4B2AC` iron grey and fur |
| **Axeguard** (`fangAxeguard`) | uncommon | 2 | **new class**: no Brace, its own guard skill | 28 / 8 / 5 / 4 / 10 / 4 (HP +4, Def +1) | **Bloodied Grit:** +1 energy after a battle in which it took damage (once per round) | Iron Skin | `axeguard_sprite.png` full plate, nasal helm, wolf-emblem shield; `#7A828C` |
| **Berserker** (`fangBerserker`) | rare | 2 | **new class**: no Rally, its own kit; FACTIONS.md had it as a Pikeman variant | 26 / 10 / 5 / 4 / 5 / 4 (HP +2, Str +2, Def -4) | **Last Fang:** below 50% HP (strict), +2 Str (as +2 damage) | Frenzy | `berserker_sprite.png` bare-chested, scarred, crimson war paint, great axe; `#B5382C` crimson (only crimson in the faction) |
| **Fang Hunter** (`fangHunter`) | common | 2 | **variant of Archer** (Focused Shot is a fine archer kit, so no class needed). Numbers are a prototype default: FACTIONS.md only names it | 16 / 7 / 8 / 7 / 3 / 5 (HP -2, Str +1) | **Running Shot:** if it moved, +1 damage and +10 hit | Archer's Focused Shot | `fang_hunter_sprite.png` fur and leather, antler-and-bone bow (cosmetic: it shoots as a Longbow), wolf-skull shoulder; `#8C6B4F` brown leather |
| plain **Cavalier** (`cavalier`) | common | 3 | shared card, no clan version: Charge already is a momentum kit | shipped | shipped | Charge, Second Wind | shipped sprite |
| **Dreg** | champion | free | shipped champion (stats unchanged: 27 / 9 / 4 / 2 / 12 / 4, Steel Axe), kit added by `units: ['dreg']` | | | Blood Challenge, Warlord's Rush | shipped sprite |

Weapons: `Fang Axe` (Reaver), `Wolf-Crest Axe` (Axeguard), `Scarred Great Axe` (Berserker) all have the Iron Pike's numbers (Might 8, Hit 75, Crit 0, range 1) and a weapon kind outside the triangle, so the only differences from the base class are the deltas above (`NEUTRAL_WEAPON_KIND`, open question 1). Costs of Axeguard, Berserker and Hunter are prototype defaults (Reaver = Pikeman 1, Hunter = Archer 2). All clan classes move as `foot` and default to Advance.

## 3. Skills (kit abilities; rarity follows the owning unit)

| skill | who | energy / cooldown | phase | requires | effect (numbers) |
|---|---|---|---|---|---|
| **Reaving Rush** (common) | Reaver | 1 / 2 | enhancement | Advance, moved >= 1 tile, a target | +2 damage and ignore 2 Defense (`damageDealt`, `ignoreDefense`; ignore adds at most the target's Def) |
| **Iron Skin** (uncommon) | Axeguard | 1 / 2 | defense | - | 3 less damage per strike this battle (`damageTaken` 3, per strike); does not force Hold |
| **Frenzy** (rare) | Berserker | 2 / 3 | enhancement | HP below 50% | +4 damage per strike and 2 **more** damage taken per strike (`damageDealt` 4, `damageTaken` -2). Stacks with Last Fang |
| **Blood Challenge** | Dreg | 2 / 3 | defense (before movement) | - | `mark: { radius: 6 }`; `damageDealt` +4 and `offTargetPenalty` 8: +4 on the mark, **-4 on anything else** (Scott's decision: mark plus penalty, not a lock) |
| **Warlord's Rush** | Dreg (prototype default) | 1 / 2 | enhancement | Advance, moved >= 1, a target | +3 damage, ignore 3 Defense |

Blood Challenge is aimed with `{ type: 'mark', faction, unitId, targetId }` (shared hook); with no aim the nearest enemy in radius is marked. The mark lasts one round. Bundle rule to remember: `paidBundleReady` needs energy >= the **sum** of all selected costs, or none is paid (Dreg can pick Blood Challenge 2 or Warlord's Rush 1 when energy is 2, not both).

## 4. Spells (existing shapes only: `friendly-unit` status)

| spell | rarity | Supply | implemented as | FACTIONS.md wanted | gap |
|---|---|---|---|---|---|
| **War Cry** | common | 1 | one friendly unit gets `hitBonus` +15 for the battle | Advance units get +1 Mov | no movement status (Engine request 1) |
| **Blood Oath** | common | **2** | one friendly unit gets `damageDealt` +3 | 4 damage now (cannot kill) for +3 damage | spells cannot hurt a friendly unit; the extra Supply stands in for the HP cost (Engine request 2) |
| **Hunt** | uncommon | 1 | one friendly unit ignores 2 Defense (`ignoreDefense` 2) | mark an enemy; Advance units within 4 get +2 hit against it | spells cannot put a status on an enemy (Engine request 3) |

Shared Mend, Ward and Fireburst stay in the pool. Ancestors' Fury was rejected in the spec and is not built (a test asserts it is absent).

## 5. Pool and rarity time gate

Pool weights (repeated keys): Reaver 3, Hunter 2, Cavalier 1, Axeguard 2, Berserker 1, War Cry 1, Blood Oath 1, Hunt 1, Mend 1, Ward 1, Fireburst 1 (15 entries). `setRarityGate({ uncommon: 3, rare: 6 })`: rounds 1-2 draw only Reaver, Hunter, Cavalier, War Cry, Blood Oath, Mend, Ward, Fireburst (6 of 11 weights are units); Axeguard and Hunt from round 3; Berserker from round 6 (tested). The pool has no Barrier card (the clans stay a glass cannon); weights are prototype defaults.

## 6. Constants

All in `src/factions/white-fang.js` with comments: `REAVER`, `MOMENTUM_DAMAGE`, `AXEGUARD`, `GRIT_ENERGY`, `BERSERKER`, `LAST_FANG_BELOW/_DAMAGE`, `HUNTER`, `RUNNING_SHOT_DAMAGE/_HIT`, `REAVING_RUSH`, `IRON_SKIN`, `FRENZY`, `BLOOD_CHALLENGE`, `WARLORDS_RUSH`, `WAR_CRY`, `BLOOD_OATH`, `HUNT`, `POOL`, `CLAN_AXE`, `NEUTRAL_WEAPON_KIND`.

## 7. Engine observations (behaviour of the shared rules that shaped the design)

1. **Reaver Mov +1 does nothing under Advance.** Battle movement is `round(mov x 2/3)` (`battleMovement`): Pikeman 4 -> 3, Reaver 5 -> 3, Mov 6 -> 4. It only matters for planning moves (`move` action, max `mov` tiles). Tested. Sensitivity cell `fang-mov2` (Mov +2) is in section 9.2.
2. **Variant `defaultStance` is ignored at deploy** (bug, Engine request 4). The Fang Hunter carries `stats: { stance: 'advance' }` as a workaround; a test pins the buggy behaviour so it flags when the engine is fixed.
3. Marked-target movement picks the reachable tile with the smallest Manhattan distance to the mark and breaks ties by lowest row, so a mark 6 tiles away can send Dreg to the same tile as another mark.
4. `damageTaken` accepts a negative value (Frenzy's extra damage taken); it is applied after Ward and only when the strike deals damage.

## 8. The clan commander (AI)

`src/ai/commander.js` (shared, not edited) knows only the three shipped classes: it counts only them toward its recruit mix, cycles unknown cards away as "unwanted", puts Archers on Hold and hurt units on Protect, picks only Rally, Brace, Focused Shot, Charge, Second Wind, and never plays the mark action or a clan spell. `experiments/factions/white-fang/commander.mjs` wraps it: (1) casts at most one clan spell on a unit that will make contact (Blood Oath, then Hunt, then War Cry); (2) runs the shipped heuristic for recruiting, shared spells, withdrawing and stances with cycling off and a mix that names the clan classes; (3) puts everything back on Advance; (4) picks Reaving Rush, Iron Skin, Frenzy, Blood Challenge (marking the enemy in range that is cheapest to finish: hp + 2 x distance) or Warlord's Rush. Limits: it does not plan flanks or facing, does not choose Hold for objectives, and its mark scoring and spell targeting are one-line heuristics, not tuned. The gap between the wrapped and the unaware AI is a result in itself (section 9.2).

## 9. Results

### 9.1 Single-player levels (400 seeds per variant; 340 logs replayed from headers, 0 mismatches)

Blue = the clan with a scripted plan; Red = a fixed script of shipped units. Files: `results/factions/white-fang/level-N.md`. "Net damage" is Blue damage dealt minus Red damage dealt per game with a 95% interval.

**Level 1, Momentum** (4 Reavers v 4 Pikemen, both Advance, open ground). The same units are stronger when they move and make contact:

| variant | Blue win | damage per landed hit (after moving / held) | net damage b - r | contact-round damage b / r |
|---|---|---|---|---|
| N Advance, no picks | 47% | 10.16 / 8.16 | -3.3 +/- 3.0 | 31.3 / 28.0 |
| S Advance + Reaving Rush | 49% (ns) | 14.17 / 8.16 | **+11.8 +/- 3.3** | 43.8 / 28.0 |
| H the same Reavers on Hold | 42% (ns) | - / 8.18 | **-15.1 +/- 2.4** | 25.0 / 28.1 |
| X Advance, Momentum stripped | 47% | 8.13 / 8.16 | -10.8 +/- 2.8 | 25.0 / 28.0 |
| XH Hold, Momentum stripped | 42% | - / 8.18 | -15.1 +/- 2.4 | 25.0 / 28.1 |
| P plain Pikemen, Advance | 48% | 7.16 | +0.9 +/- 2.8 | 21.9 / 21.8 |

Momentum is exactly +2 per moving strike (10.16 v 8.13, 0 on Hold; XH = H), worth about +7.5 net damage a game, and Advance beats Hold by about 12 net damage (N v H). **Win rate does not move significantly** (all within 5 points, ns): a Reaver's Def -2 costs about what Str +1 and Momentum earn in an even melee, so a Reaver here is a Pikeman with a different shape (P ~ N). Momentum only decides the contact round; nothing keeps it going in a lock. With Reaving Rush (+6 on a moving strike: +2 Momentum, +2, +2 ignored Def) the net margin turns positive (+11.8).

**Level 2, Blood Challenge on a field** (Dreg + 2 Reavers v 2 Pikemen + 3 Archers): naive 78%, skilled 93% (+15pp). Removing Blood Challenge: 92% (ns) but net damage 96.6 -> 89.9 (-6.7); without Reaving Rush 89% (-4pp, ns); without Warlord's Rush 91% (ns). Marking the nearest Pikeman instead of the exposed Archer: 95% (+2, ns), so **where the mark goes matters little in this geometry**; the benefit is the +4 per Dreg hit.

**Level 3, The Pair** (one round, Dreg beside two identical Pikemen; numbers of the mark). Dreg's damage per landed hit: no mark 10.41 (hits rp1, the tie-break); mark rp2 **14.57** (hits rp2, +4, crits lift the mean slightly above 14.41); default mark 14.57 (hits the nearest, rp1); mark rp1 14.57; mark an Archer he cannot reach on Hold **6.24** (hits rp1 at -4). Blood Challenge steers his target but does not lock it, and a wrong mark costs him 4 per hit.

**Level 4, The Reaving Line** (whole clan, 13 Supply v 9 Pikemen + 5 Archers, 19 Supply, Braced from round 2): naive 59%, skilled **89% (+29pp)**. Ablations: without Reaving Rush 82% (-7pp), without Iron Skin 83% (-6pp), without Blood Challenge 86% (-3pp, ns), Warlord's Rush 87% (-2, ns), Frenzy 88% (ns), and **none of the three spells is measurable** (Blood Oath 89%, War Cry 89%, Hunt 88%; one-shot buffs to a single unit in a 14-unit fight). Frenzy is used 0.16 times a game (HP below 50% while holding 2 energy is rare). Blood Challenge is **not clearly worth its 2 energy at this scale**: without it the win rate drops 3 points (ns) but net damage rises 280.8 -> 291.7 (+10.9 +/- 7): the mark sends Dreg after an Archer behind a nine-Pikeman line, which spends his strikes at +4 on fewer targets. It pays where the mark is reachable (Level 2, Level 3).

**Level 5, Sitting Still** (3 units hold a village against 5 Advancing Pikemen): clan Axeguards on Hold with no picks 21%, **with Iron Skin 83%** (6 Supply); baseline Pikemen on Hold with Rally and Brace **97%** (3 Supply); baseline Pikemen with no picks 3%; Reavers on Hold 3%. Holding is the clan's weak side: the baseline holds better at half the price, because the clan has no Rally or Brace to convert a held tile into value.

### 9.2 Paired, side-swapped simulations (100 seeds x 2 sides per cell, 30 rounds, rarity gate 3 / 6, replay checks 70/70 per configuration)

Subject = the clan; opponent = baseline (plain classes, Brenna) played by the shipped heuristic, except the mirror (clan commander on both sides, Dreg's twin `dreg2` as second champion) and `control` (plain classes with Dreg v plain classes with Brenna: what the champion swap alone does). Start rosters are the shipped ones with Pikemen -> Reavers and Archers -> Hunters. Draw = round limit. Intervals are 95% Wilson.

**Shipped rules, River Ford** (the default game): 95-100% draws in every cell.

| cell | subject win | opponent win | draw (95%) | rounds (decided games) | units lost subject / opponent | villages captured s / o |
|---|---|---|---|---|---|---|
| clan commander v baseline | 0.0% | 0.5% | 99.5% (97.2-99.9) | 30.0 (27.0) | 7.9 / 5.7 | 0.79 / 0.69 |
| shipped heuristic on clan v baseline | 0.5% | 4.5% | 95.0% (91.0-97.3) | 29.6 (22.5) | 7.4 / 3.5 | 0.65 / 0.59 |
| mirror | 0.0% | 0.0% | 100.0% (98.1-100) | 30.0 | 11.3 / 11.3 | 0.81 / 0.81 |
| control (Dreg v Brenna, plain cards) | 1.0% | 1.0% | 98.0% (95.0-99.2) | 29.7 (14.3) | 3.8 / 4.0 | 0.58 / 0.57 |

Win rates cannot separate anything here: the known stalemate (docs/CURRENT_GAPS.md: 89-100% draws) swamps the faction. The clan loses more units than it kills (7.9 v 5.7) and ends with about the same HP (155 v 158). No draw-rate claim is made for the clan; it is the shipped rate.

**Experiment overlay `village_chain` + village deployment radius 5** (`EXPERIMENT_RULES.deployRangeVillage = 5`, from docs/experiments/DEPLOY_AND_MUSTER.md; off in the game; the map is not symmetric, so both orientations are played):

| cell | subject win | opponent win | draw (95%) | rounds all / decided | keep wins | villages captured s / o | units lost s / o | final field HP s / o |
|---|---|---|---|---|---|---|---|---|
| **clan commander v baseline** | 9.5% (6.2-14.4) | 14.0% | 76.5% (70.2-81.8) | 25.9 / 12.7 | 19 | 2.11 / 1.74 | 13.1 / 12.3 | 88 / 122 |
| shipped heuristic on clan v baseline | 11.0% (7.4-16.1) | **34.0%** | 55.0% (48.1-61.7) | 25.0 / 19.0 | 22 | 1.92 / 1.69 | 13.2 / 7.8 | 61 / 143 |
| **mirror** (clan commander both sides) | 17.5% (12.9-23.4) | 17.5% | 65.0% (58.2-71.3) | 23.6 / 11.8 | 35 | 2.04 / 2.04 | 16.1 / 16.1 | 91 / 91 |
| control (plain cards, Dreg v Brenna) | 15.0% (10.7-20.6) | 17.5% | 67.5% (60.7-73.6) | 23.1 / 8.8 | 30 | 1.50 / 1.63 | 6.4 / 7.6 | 135 / 129 |
| sens.: clan axes use the axe triangle | 11.5% | 12.0% | 76.5% | 25.8 / 12.1 | 23 | 2.13 / 1.80 | 11.2 / 13.8 | 98 / 118 |
| sens.: Reaver Mov +2 | 6.5% | 9.5% | 84.0% | 27.9 / 16.7 | 13 | 1.61 / 1.75 | 14.5 / 13.0 | 98 / 127 |
| sens.: clan start roster and Dreg, shared card pool | 17.0% | 19.5% | 63.5% | 22.9 / 10.6 | 34 | 1.76 / 1.75 | 11.5 / 11.3 | 96 / 121 |

Reading (differences of under about 8 points at 200 games are noise):
- **With the shipped commander the clan is clearly worse** (11% v 34%): it Holds Archers, Protects with hurt units, cycles clan cards away and never marks or picks clan skills. **The clan commander recovers most of that** (loss 34% -> 14%, final HP 61 -> 88), but the clan still ends with less field HP than the baseline (88 v 122) and does not win more (9.5% v 14.0%, intervals overlap). On these numbers the clan is **not stronger than the baseline**; it trades HP for tempo. The AI limits (section 8) mean this is a lower bound for a human player, not a verdict.
- The mirror decides no more often than the control (70 of 200 games decided v 65 of 200) but is far bloodier (each side loses 16.1 units v 6.4-7.6 in the control): the clan makes fights costlier without making them more decisive.
- Captures: the clan captures 2.11 villages a game v 1.74 for the baseline on the same map and seeds, a modest lead consistent with Advance; not tested for significance. Keep wins: clan 19, baseline 28 (the 14.0% above).
- Neither sensitivity change helps: the axe triangle (+1 damage, +15 hit against Pikemen) makes the clan about level (11.5% v 12.0%); Reaver Mov +2 raises draws (84%).
- The orientation effect is large (control: 1% as Blue v 29% as Red); every cell is paired for it.

### 9.3 The default is untouched

`node tools/sim/run.mjs --games 30 --blue heuristic --red greedy --swap --seed 1 --out <dir> --verify` on this branch v 7e9d663: `summary.csv` identical (`cmp`), all 60 game logs identical except the header `commit` field, 0 replay failures. Nothing in `src/` outside `src/factions/white-fang.js` changed, and that file is imported by nothing shipped.

## 10. Rejected or simplified

| item | decision |
|---|---|
| Ancestors' Fury | not built (rejected in the spec) |
| War Cry "+1 Mov to Advance units", Blood Oath "4 damage cannot kill", Hunt "mark an enemy" | closest existing spell shapes (section 4); requests below |
| Berserker / Axeguard as Pikeman variants (FACTIONS.md) | real classes, so they do not inherit Rally and Brace |
| Barrier card, any healing | not in the pool (Mend stays as a shared spell per Scott) |
| Clan Cavalier | none: plain Cavalier and Charge cover it |
| Frenzy "takes 2 more damage" | a negative `damageTaken` status |
| Iron Skin "3 less damage this battle" | per strike, like Close Ranks in the Crown spec |
| Hard target lock | replaced by mark plus -4 (Scott's decision) |
| Weapon triangle for clan axes | off (neutral kind); `buildWhiteFang({ weaponKind: 'axe' })` switches it on |

## 11. Engine requests (none applied; other agents own the shared files)

1. **Movement status.** Add a numeric status `movBonus` read by `battleMovement` in `src/abilities.js`: `Math.max(1, Math.round((unit.mov + (unit.statuses?.movBonus || 0)) * ABILITY_RULES.advanceFraction))` (callers already pass the snapshot unit, which carries `statuses`); add `'movBonus'` to the cleared keys in `src/battle.js` and `STATUS_EFFECT_KEYS`. Then War Cry becomes `status: 'movBonus'` (duration 1) as designed, and Reaver Mov +1 can be replaced by it.
2. **Self-damage spell.** Spell effect `{ type: 'damage', amount: 4, floor: 1 }` on a `friendly-unit` target (`hp = Math.max(floor, hp - amount)`), plus a list form `effects: [ ... ]` so one spell can hurt and buff: Blood Oath = `[ damage 4 floor 1, status damageDealt 3 ]`; then its Supply cost returns to 1.
3. **Enemy-target spell status.** Target kind `enemy-unit` in `spellTargetValid` / `resolveSpellEffect` (`src/abilities.js`, `src/match.js` spell handler) applying `statuses.hunted = 2` to an enemy, and in `src/battle.js` `hit` chance `+ (target.statuses?.hunted ? 10 : 0) * (attacker.stance === 'advance')` (or the spec's "+2 hit to Advance units within 4": needs the caster's faction and radius on the status). Then Hunt is as designed.
4. **Variant `defaultStance` bug.** In `src/match.js` `recruit` handler, `reserve = { ...graded, ...res.reserve }` carries the graded base-class template's `stance` (Archer: hold) and `deploy` copies it over the unit, so `card.defaultStance` of a variant is lost. Fix: set `stance: unitCardFor(res.reserve.unitId)?.defaultStance ?? graded.stance` on the reserve (or drop `stance` from `carried` when it equals the template's). Pinned by `tests/faction-white-fang.test.mjs` (ENGINE ISSUE 1); then remove `stats: { stance: 'advance' }` from the Fang Hunter.
5. **Advance movement rounding** (observation, 7.1): consider whether `+1 Mov` should be able to matter; `Math.ceil` would change the shipped Archer (5 -> 4), so a status (request 1) or a bigger delta is safer.
6. **`experiments/candidates` and `experiments/combat/scenario.mjs` wipe cultures.** `enableCandidates()` / `disableCandidates()` call `resetAbilities()` and `resetCandidateCards()`, which delete every registered culture ability and card, and `scenario.mjs` builds units only from `UNIT_CARDS`. Any culture level suite must bring its own scenario engine (`experiments/factions/white-fang/scenario.mjs`). Suggested fix: candidates track and remove only the keys they registered.
7. **AI hooks.** `runCommander` has a fixed policy table. A per-culture policy (registered like the culture) and a recruit mix that reads `cardFor(key)` instead of `UNIT_CARDS` would remove the need for wrappers.

## 12. Open questions for Scott

1. **Clan weapon kind:** neutral (default here) or axe? Axe gives the clan +1 damage and +15 hit against Pikemen and -1 / -15 against swords; measured impact is small (sim `fang-axe`) but it changes matchups with Brenna.
2. **Reaver Mov:** keep +1 (invisible under Advance) or +2, or fund Engine request 1? `fang-mov2` did not help.
3. **Reaver strength:** a Reaver only equals a Pikeman in an even melee (Level 1). Is "same stat weight, different shape" intended, or should Momentum/Str be higher?
4. **Blood Oath price:** 2 Supply now (stands in for the HP cost). Build the HP cost (Engine request 2) or keep a Supply price?
5. **War Cry / Hunt:** accept the +15 hit and ignore-2-Defense versions, or wait for Engine requests 1 and 3?
6. **Costs** (Axeguard 2, Berserker 2, Hunter 2), **pool weights**, and **Dreg's second ability** (Warlord's Rush) are my defaults: confirm or change.
7. **Baseline comparison:** on the shipped map everything draws; the clan cannot be evaluated there. Which rule overlay (if any) should balance work be judged on (village_chain + radius 5 was used here)?
8. Should the Berserker's Frenzy be reachable more often (it fired 0.16 times a game in Level 4; needs HP below 50% and 2 energy)?

## 13. How to reproduce

```
npm test                                                             # 85 checks
node experiments/factions/white-fang/run-levels.mjs --seeds 400 --replay 10 --out docs/experiments/results/factions/white-fang
node experiments/factions/white-fang/sim.mjs --seeds 100 --replay 5 --map river_ford
node experiments/factions/white-fang/sim.mjs --seeds 100 --replay 5 --map village_chain --rules dvil=5
node tools/sim/run.mjs --games 30 --blue heuristic --red greedy --swap --seed 1 --out <dir> --verify   # default untouched
```
