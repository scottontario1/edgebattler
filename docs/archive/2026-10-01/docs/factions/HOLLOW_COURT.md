> Historical snapshot archived 2026-10-01. Earlier revisions/proposals, not current main. [Current docs index](../../../../README.md).

# The Hollow Court: technical spec and results

Branch `faction/hollow-court` (from `ccr-d70cb868-ob7chg` at 7e9d663). Status: **implemented as a culture module and verified by rule checks, scenarios and paired simulations; nothing is registered in the game.** Every number is a prototype default named in `src/factions/hollow-court.js` (`COURT`); Scott chooses the shipped values. Design source: [FACTIONS.md](../../../../../FACTIONS.md) sections 1b, 7, 8, 9; hooks used: [CULTURE_HOOKS.md](../../../../CULTURE_HOOKS.md) (no shared engine file was edited).

| what | where |
|---|---|
| culture module (`registerCulture` definition, `buildHollowCourt(options)` for ablations, `courtRoster`) | `src/factions/hollow-court.js` |
| rule checks (26; `npm test` is 87/87) | `tests/faction-hollow-court.test.mjs` |
| scenarios, Court commander, paired simulation, draw-rate comparison | `experiments/factions/hollow-court/` (`scenarios.mjs`, `run-scenarios.mjs`, `commander.mjs`, `armies.mjs`, `sim.mjs`, `compare.mjs`) |
| results | `docs/experiments/results/factions/hollow-court/` |

Reproduce: `node experiments/factions/hollow-court/run-scenarios.mjs --seeds 400 --replay 10`; `node experiments/factions/hollow-court/sim.mjs --seeds 200 [--map village_chain --dvil 5] [--only court:base,... --tag name]` (arms in `armies.mjs`); `node experiments/factions/hollow-court/compare.mjs`; register in your own process with `registerCulture(HOLLOW_COURT)` then `createMatch({ pools: { blue: culturePool('court') }, roster, champions })` and `setRarityGate({ uncommon: 3, rare: 6 })`.

## 1. The idea in one paragraph

Killing a Court unit does not remove all of its value. The fallen leave a **Corpse** (tile object, non-blocking, 3-round decay) that living Court units **consume to heal** (Graveguard, Necromancer, champions) or **feed on for damage or defence** (Wight, Graveguard passives), and one **Mourning Knight** per match stays on its tile with 1 HP instead of dying (Revenant). Individual units are deliberately weaker per population slot than the shipped classes; the sections below measure whether the death mechanics close that gap.

## 2. Units (all placeholder art: a borrowed base sprite times a tint; no binary assets)

| unit | rarity | cost | base / sprite | HP | Str | Skl | Spd | Def | Mov | weapon (mt / hit / rng) | passive | leaves Corpse |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Feral Ghoul (class) | common | 0 (Pikeman 1) | pikeman | 16 | 7 | 4 | 5 | 3 | 6 | Ghoul Claws (8 / 75 / 1), no triangle | **Hunger**: +1 energy when struck (once per battle) | yes |
| Graveguard (class) | uncommon | 2 | pikeman | 26 | 8 | 5 | 4 | 9 | 4 | Grave Halberd (8 / 75 / 1, lance) | **Duty Beyond Death**: 1 less damage per strike while a Corpse is within 2 | yes |
| Wight (class) | uncommon | 2 | pikeman | 20 | 7 | 6 | 5 | 6 | 4 | Wight Blade (6 / 85 / 1, sword) | **Feeds on the Fallen**: +2 damage per strike while a Corpse is within 2 | yes |
| Necromancer (class) | uncommon | 3 | archer | 16 | 0 (Mag 2) | 6 | 4 | 2 (Res 2) | 4 | Lantern Staff (3 / 80 / 1-2, magic: hits Res, ignores Def) | none (a skill user) | yes |
| Mourning Knight (variant of Cavalier) | rare | 4 (Cavalier 3) | cavalier | 26 (+2) | 8 | 5 | 8 | 9 (+2) | 7 | Iron Lance | **Revenant Vow** (once per match, stays with 1 HP; no Corpse when it does), **Deathless Stand**: 2 less damage per strike on Hold | only the second death |

Why classes and one variant: an ability applies by `cls` (or unit id), so a variant of Pikeman could not carry its own kit without giving it to every plain Pikeman while the culture is registered (checked in the tests: no Court ability leaks to Pikeman, Archer, Cavalier, Brenna or Dreg). The Mourning Knight is a Cavalier *variant* on purpose: it keeps Charge, Second Wind and the side/back flank bonus (`battle.js` keys the flank on `cls === 'cavalier'`), and its two features are passives, which need no class.

Feral Ghoul deltas from the Pikeman follow the spec (HP -8, Str -1, Def -6, Mov +2, cost one lower, population weight unchanged). **Wight** earns its place as the offensive use of Corpses; without it the dead would only heal.

Reference art (supplied in `design_assets/factions/hollow_court/` on `ccr-d70cb868-ob7chg`, not copied here): `feral_ghoul_sprite.png` = Feral Ghoul (tint pale ash `#a5a396`), `mourning_knight_sprite.png` = Mourning Knight (mounted, steel and purple; tint `#6a5a9a` over the Cavalier sprite), `necromancer_sprite.png` = Necromancer (a living court official with a lantern staff, black velvet and grey silk; tint `#4a4656` over the Archer sprite; its weapon is named Lantern Staff after the art). Graveguard (`#7f8794`, steel), Wight (`#9db4c8`, spectral blue-white) and the champions (`#5a3a70`, `#4a4656`, `#7f8794`) have no reference image yet.

## 3. Skills (kit abilities; picked in planning like the shipped kits)

| skill | who | energy / cooldown | phase | requires | effect |
|---|---|---|---|---|---|
| Unquiet Step | Feral Ghoul | 1 / 2 | enhancement | Advance, moved, a target | +2 damage |
| Grave Rally | Graveguard | 0 / 2 | recovery | a Corpse within 1 | consumes it (`consume`), heals the Graveguard and friends within 1 by 6 |
| Withering Grip | Wight | 1 / 2 | enhancement | a target | strike ignores 3 Defense |
| Consume Remains | Necromancer | 1 / 1 | recovery | a Corpse within 3 | consumes the nearest, heals the Necromancer and friends within 2 by 6 |
| Charge, Second Wind | Mourning Knight | shipped | | | shipped Cavalier kit |

Passives and Revenant are in section 2. Deathless Stand is a *passive* (Hold: 2 less damage per strike), not the spec's "survive with 1 HP" skill (see Engine requests).

## 4. Spells (existing shapes)

| spell | rarity | Supply | shape | effect |
|---|---|---|---|---|
| Grave Chill | common | 1 | `enemy-area`, radius 0 (one tile) | 3 damage, ignores Defense. **Energy loss is not supported** (Engine requests) |
| Mend Bone | uncommon | 0 | `friendly-unit` | heal 6 (Mend heals 8 for 1 Supply; this one is free and smaller) |

Shared Mend, Ward and Fireburst stay in the pool. Pool weights: ghoul 3, Graveguard 2, Wight 1, Necromancer 1, Mourning Knight 1, Grave Chill 1, Mend Bone 1, Mend 1, Ward 1, Fireburst 1.

**Rarity gate** (uncommon from round 3, rare from round 6): rounds 1-2 draw only Ghouls, Grave Chill, Mend, Ward and Fireburst, so the Court opens as a ghoul front, as the spec says. The Mourning Knight cannot be drawn before round 6. Rarities are one table (`COURT_RARITY`).

## 5. Champions (three options; the first is a labelled provisional default)

All three respawn as themselves (2 rounds, 1 Supply), never combine, never leave a Corpse and never use Revenant (engine rules). Kits are keyed by unit id (`units: [...]`, no classes), so they cannot leak to Brenna or other units.

| option | id | body | stats | kit |
|---|---|---|---|---|
| **1. The Hollow Regent (PROVISIONAL DEFAULT)** deathless noble | `hollowRegent` | paladin (armour move) | HP 30, Str 8, Skl 5, Spd 3, Def 11, Mov 4, Iron Sword (Brenna: 28 / 9 / 5 / 3 / 13) | **Decree of Attendance** (2 / 3, recovery): needs a Corpse within 4, consumes up to 2, heals friends within 3 by 6. **Sovereign Stand** (1 / 2, defense): needs Hold, 2 less damage per strike |
| 2. Chancellor Vael, necromancer-chancellor | `chancellor` | necromancer | HP 22, Mag 4, Skl 6, Spd 4, Def 4, Res 3, Mov 4, Lantern Staff | Consume Remains (class kit) and **Ledger of the Dead** (2 / 3, recovery): needs a Corpse within 5, consumes up to 3, heals friends within 3 by 4. **Chancellery Audit** (1 / 2, enhancement): +3 damage |
| 3. Marshal Ossian, deathless marshal | `marshal` | graveguard | HP 32, Str 8, Skl 5, Spd 3, Def 10, Mov 4, Grave Halberd | Grave Rally (class kit) and **Hold Beyond Death** (1 / 2, defense): needs Hold, 3 less damage per strike |

Recommendation for Scott (not adopted): the Regent is the safest first champion because it is a front-line body like Brenna and Dreg; the Chancellor is a frail caster and would make the champion the enemy's first target. No reference art exists for any of them.

## 6. Death as a resource: what was built, what was not

| mechanic | status | note |
|---|---|---|
| Corpses fuel healing (Grave Rally, Consume Remains, Decree, Ledger) | **built** | the core mechanic |
| Corpses fuel damage and defence (Feeds on the Fallen, Duty Beyond Death) | **built** | passives read a Corpse within 2 and cost nothing; a Corpse eaten in the recovery phase no longer feeds them that battle |
| Revenant (Mourning Knight) | **built** | once per match; also saves from spell damage; no Corpse the first time |
| Being hit is fuel (Ghoul Hunger) | **built** | +1 energy once per battle when struck |
| Kill bounty, Supply from deaths, memorial tiles, graveyard pile, salvage | rejected | economy or persistent-state changes; they replace losses, which is where CORE-02 draws worsen (FACTIONS.md section 7) |
| Raise Ghoul, Writ of Recall, any mid-match revival or summoning | not built | rejected in the spec |
| Assize of the Dead (Corpse-count scaling) | not built | would multiply the corpse effects; measure the current ones first |
| Corpses block or are captured | not built | open question 5 in FACTIONS.md |
| Corpse eaten by the enemy | **happens** | `consume` takes any Corpse in range regardless of owner (Engine requests) |

## 7. Rule checks (`tests/faction-hollow-court.test.mjs`, 26 checks; `npm test` 87/87, was 61)

| area | what is checked |
|---|---|
| registration | importing registers nothing; register then reset restores `RECRUIT`, `MOVE_TYPE`, `WEAPONS`, `VARIANTS`, abilities, spells, sprite fallbacks and champions; no Court kit reaches Pikeman, Archer, Cavalier, Brenna or Dreg; the Knight keeps exactly the shipped Cavalier kit |
| units | every stat, weapon, cost, rarity, default stance, range, tint and the spec deltas of the Ghoul; the whole roster is modest (nothing above Cavalier Str or Cavalier HP + 2) |
| pool and gate | Court pool contents and weights (no shipped unit cards); rounds 1-2 draw only common cards, uncommon from round 3, the Knight only from round 6 |
| Corpse | a fallen Ghoul leaves a non-blocking Corpse (owner, tile, decay 3 then 2 at the next round) that is gone after the 3-round decay |
| Hunger | a struck Ghoul gains exactly 1 energy, once, although two enemies hit it |
| Unquiet Step | +2 damage after advancing; refused without movement or on Hold; needs 1 energy |
| Duty Beyond Death | 1 less damage per strike with a Corpse within 2 (distance 2 counts, 3 does not) |
| Grave Rally | eats the adjacent Corpse only, heals self and friends within 1 by 6, needs a Corpse within 1, costs no energy |
| Wight | Feeds on the Fallen +2 within 2, nothing at 3; Withering Grip ignores 3 Defense; they stack |
| Necromancer | Consume Remains eats the nearest Corpse within 3, heals friends within 2 by 6, not beyond, capped at max HP, needs 1 energy; eats an enemy's Corpse too; staff is magic, range 2, ignores Def |
| Revenant | first death: stays with 1 HP, `return` result, no Corpse, not counted as lost; second death is real and leaves a Corpse; also saves from a spell; a Graveguard gets no Revenant; champions never use it |
| Deathless Stand, Charge | 2 less damage on Hold and not while advancing; the shipped Charge still works on the Knight |
| spells | Grave Chill hits exactly one tile for 3 ignoring Defense and costs 1; Mend Bone heals 6 for 0 |
| champions | three templates, default is the Regent, stats near Brenna, kits by unit id, no leak, Decree eats 2 and Ledger eats 3 with one heal, stands reduce damage, Audit +3, respawn as itself on either side, no Corpse, no combining |
| combine | three Ghouls make a 2-star Ghoul that keeps Hunger and the Corpse |
| ablation | `buildHollowCourt` switches keep every stat and remove exactly the named mechanics |
| full matches | Court on either side with each champion plays 10 rounds, logs `cultures`, `champions` and `pools`, and replays exactly |
| engine note | documents that `ignoreDefense` stacks on a magic weapon (Engine requests 5) |

## 8. Scenarios (single player; Blue = Court on a scripted plan, Red = fixed shipped units; 400 seeds per variant, 480 logs replayed from their headers, 0 mismatches)

Variants: **N** naive (default stances, no picks), **S** skilled, **D** = S on the *same army with every death mechanic removed* (stats unchanged), **D-corpse / D-revenant / D-consume / D-passive** = one mechanic removed, **B** = the same roles filled by shipped classes on the same placement and stances with no picks. The skilled plan is scripted stances plus state-aware skill picks (`courtSkillPicks`: a Corpse is eaten only when the heal is worth at least 6 HP, or 3 if it rots after this battle, so it can keep feeding the passives meanwhile). Scenario armies were sized so S sits mid-range; they are not balance claims. Full tables: `docs/experiments/results/factions/hollow-court/scenario-court-*.md`.

| scenario | Blue win: N | S (95%) | D (no death mechanics) | D-corpse | D-consume | D-passive | D-revenant | B (shipped classes) |
|---|---|---|---|---|---|---|---|---|
| 1 The Ossuary Line (7 Court v 5 Pikemen + 1 Archer; corpses as fuel) | 0% | **79%** (75-83) | **34%** (29-39) | 34% | 62% | 76% (ns) | n/a (no Knight) | 66% (61-71) |
| 2 The Knight Who Would Not Fall (5 Court v 4 Pikemen + 2 Cavaliers) | 2% | **26%** (22-30) | **13%** (10-16) | 19% | 20% | 26% (ns) | 19% | 1% |
| 3 Feast at the Breach (7 Court assault 2 Pikemen + 2 Archers, Braced) | 13% | **64%** (59-68) | **46%** (41-51) | 46% | 61% (ns) | 49% | n/a (no Knight) | 100% |
| 4 The Keep Race, forward army (2 Cavaliers + 2 Pikemen march on the keep) | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% |
| 4 garrison variant (a Graveguard on the keep tile) | | 14% (11-18) | 11% (8-14), ns | | | | | |

What the mechanics did (means per game, skilled variant):

| scenario | Court units lethally struck | Corpses made | eaten | HP recovered | Revenant returns | damage dealt after a return |
|---|---|---|---|---|---|---|
| 1 | 5.0 | 5.0 | 3.3 | 19.9 | 0 | - |
| 2 | 5.4 | 4.5 | 1.3 | 12.2 | 0.87 | 8.6 |
| 3 | 5.5 | 4.6 | 0.6 | 2.8 | 0 | - |
| 4 garrison | 3.6 | 3.6 | 1.1 | 7.0 | 0 | - |

Reading (all figures are 400-seed measurements in these authored fights):

- **Death keeps value.** With the mechanics removed the same army wins 34% instead of 79% (scenario 1), 13% instead of 26% (scenario 2) and 46% instead of 64% (scenario 3). Of the units that were lethally struck in scenario 2, 0.87 per game came back and dealt 8.6 further damage.
- **The heal is the biggest piece in the defensive fight, the passives in the assault.** Scenario 1: removing the corpse-eating skills costs 17 points, the passives only 3 (ns). Scenario 3 (the Corpses are far from the Necromancer): the passives cost 14 points, the eating skills 2 (ns).
- **Revenant matters through a synergy.** Removing Revenant costs 7 points in scenario 2; removing the shipped Second Wind from the Knight costs 12, because the returned Knight is at 1 HP.
- **The units are individually weaker.** With no death mechanics the Court army is far below the shipped-class control in scenarios 1 and 3 (34% v 66%, 46% v 100%); with them it is above it in scenario 1 (79% v 66%) and still below it in scenario 3. In scenario 2 the control has no Deathless Stand or Revenant and loses almost always.
- **The keep race is the weakness the spec predicted.** A forward army cannot stop cavalry riding for the keep: 0% in every variant including the shipped classes. A garrison on the keep changes the result modestly (14% v 11% without the mechanics, not significant).
- **Skill floor.** Naive Court play (default stances, no picks) loses 97-100% of scenarios 1, 2 and 4 and stalls in scenario 3; N to S mixes tactics (hold, then sortie) with skills, so it is not a skill-only measure. The removal rows separate the skills: Withering Grip is worth 20 points and Unquiet Step 15 in scenario 3; Consume Remains alone is ns in scenarios 1 and 3 because Grave Rally covers it.

## 9. Paired, side-swapped simulation and the draw rate (CORE-02)

Setup: `experiments/factions/hollow-court/sim.mjs`. Full matches on the default roster shape (a champion and four recruits; Court units mapped by role: Pikeman to Graveguard, Archer to Necromancer, Cavalier to Mourning Knight; the Regent as champion), the Court's own pool, `setRarityGate({ uncommon: 3, rare: 6 })`, 30 rounds. A matchup plays seeds 1-200 with the Court on blue and again on red (same dice, so map asymmetry cancels); a mirror has no sides, so it plays 400 distinct seeds once. Two regimes: **River Ford with shipped rules**, and **village_chain with village deployment radius 5** (the regime where the baseline mirror stops being a near-total stalemate: 67.5% draws). One game per matchup and side assignment is replayed from its log: every replay matched. Arms: **base** = shipped army under the shipped heuristic; **court** = full Court under the Court commander (section 10); **courtOff** = the same Court with every death mechanic removed (no corpses, no Revenant, no corpse-eating skills, no corpse passives; stats identical) under the same commander; **Plain** = the Court driven by the unmodified shipped heuristic.

Results (`docs/experiments/results/factions/hollow-court/sim-*.md`, `plain-*.md`; "A" is the first army of the matchup; keep-captured is the number of games ended by a keep capture):

| regime | matchup (A:B) | games | A wins | B wins | draws (95%) | mean rounds | keep-captured games | villages / game |
|---|---|---|---|---|---|---|---|---|
| River Ford | base:base | 400 | 2 | 8 | **97.5%** (95.5-98.6) | 29.6 | 10 | 1.23 |
| | court:base | 400 | 3 | 5 | 98.0% (96.1-99.0) | 29.8 | 8 | 1.15 |
| | courtOff:base | 400 | 4 | 4 | 98.0% (96.1-99.0) | 29.9 | 8 | 1.21 |
| | court:court | 400 | 0 | 8 | 98.0% (96.1-99.0) | 29.8 | 8 | 1.17 |
| | courtOff:courtOff | 400 | 0 | 10 | 97.5% (95.5-98.6) | 29.8 | 10 | 1.21 |
| | Plain: courtPlain:base | 400 | 7 | 15 | 94.5% (91.8-96.3) | 29.5 | 22 | 1.21 |
| | Plain mirror | 400 | 0 | 69 | 82.8% (78.7-86.1) | 28.4 | 65 (+4 wipes) | 1.13 |
| village_chain, radius 5 | base:base | 400 | 11 | 119 | **67.5%** (62.8-71.9) | 22.9 | 130 | 3.04 |
| | court:base | 400 | 41 | 17 | 85.5% (81.7-88.6) | 27.5 | 58 | 3.01 |
| | courtOff:base | 400 | 31 | 23 | 86.5% (82.8-89.5) | 27.9 | 54 | 2.92 |
| | court:court | 400 | 9 | 14 | 94.3% (91.5-96.1) | 29.4 | 23 | 3.24 |
| | courtOff:courtOff | 400 | 7 | 20 | 93.3% (90.4-95.3) | 29.4 | 27 | 3.27 |
| | Plain: courtPlain:base | 400 | 34 | 139 | 56.8% (51.9-61.5) | 24.4 | 173 | 3.24 |
| | Plain mirror | 400 | 75 | 144 | 45.3% (40.4-50.1) | 25.4 | 169 (+50 wipes) | 3.04 |

Units lost per game (A / B): River Ford court:base 7.9 / 2.7 (courtOff 9.5 / 2.9); village_chain court:base 18.2 / 7.8 (courtOff 21.3 / 7.6). **The Court loses about three times the units of the baseline**, with or without the mechanics: it trades cheap units. Death-mechanic counters per game (first 40 seeds): River Ford court:base 6.0 Corpses made, 4.2 eaten, 1.6 expired unused, 1.0 Revenant returns; village_chain court:base 14.2 made, 9.8 eaten, 1.3 returns; under the shipped heuristic Corpses are never eaten (6.5 made, 6.0 expired unused).

**Do the death mechanics change the draw rate?** With versus without (`draw-rate-comparison.md`, made by `compare.mjs`; difference in draw rate, 95% interval, normal approximation, independent samples):

| regime | driver / matchup | draws with | draws without | difference (pp) | keep-captured with / without |
|---|---|---|---|---|---|
| River Ford | Court commander v baseline | 98.0% | 98.0% | +0.0 +-1.9 | 2.0% / 2.0% |
| River Ford | Court commander mirror | 98.0% | 97.5% | +0.5 +-2.1 | 2.0% / 2.5% |
| River Ford | shipped heuristic v baseline | 94.5% | 94.8% | -0.3 +-3.1 | 5.5% / 5.3% |
| River Ford | shipped heuristic mirror | 82.8% | 84.8% | -2.0 +-5.1 | 16.3% / 13.0% |
| village_chain 5 | Court commander v baseline | 85.5% | 86.5% | -1.0 +-4.8 | 14.5% / 13.5% |
| village_chain 5 | Court commander mirror | 94.3% | 93.3% | +1.0 +-3.4 | 5.8% / 6.8% |
| village_chain 5 | shipped heuristic v baseline | 56.8% | 51.2% | +5.5 +-6.9 | 43.3% / 48.8% |
| village_chain 5 | shipped heuristic mirror (400 games) | 45.3% | 35.3% | +10.0 +-6.8 | 42.3% / 41.5% |
| village_chain 5 | shipped heuristic mirror (**1000 games**) | 44.5% | 35.4% | **+9.1 +-4.3** | 43.5% / 46.4% |

Which mechanic (mirror, shipped heuristic, village_chain radius 5, 1000 games each; Corpses are never eaten in this arm, so it isolates Revenant and the corpse-reading passives):

| Court build | draws | difference from "no death mechanics" (pp) | army-destroyed endings | keep-captured |
|---|---|---|---|---|
| no death mechanics (control) | 35.4% | - | 182 | 464 |
| all death mechanics | 44.5% | +9.1 +-4.3 | 120 | 435 |
| without Revenant | 37.2% | +1.8 +-4.2 | 146 | 482 |
| without corpse-reading passives | 41.8% | +6.4 +-4.3 | 132 | 450 |
| without corpses (Revenant only; passives inert) | 41.1% | +5.7 +-4.3 | 140 | 449 |

Reading (a report, not a recommendation to adopt anything):

- **The default map cannot show it.** At River Ford every cell, the baseline mirror included, is 94.5-98% draws; the differences with and without the mechanics are 0 to 2 points, inside the intervals. The stalemate is a floor (CORE-02), so this regime has no power to detect a worsening.
- **Under the Court commander (which eats Corpses, holds its line and keeps Necromancers behind) the mechanics do not measurably change draws** (-1.0 +-4.8 and +1.0 +-3.4 in the decisive regime). That commander plays a *drawier* game than the baseline whether or not the mechanics are on (85.5% against 67.5%): the AI's style moves the draw rate far more than the mechanics do.
- **Under the shipped heuristic (everything marches on the keep) the mechanics raise draws by about 9 points in the decisive mirror (significant at 1000 games) and about 5 against the baseline (not significant).** Keep captures barely change (435 v 464 of 1000); what falls is *army-destroyed* endings (182 to 120): units that do not die, or die less profitably, delay wipes. Revenant is the largest single piece (removing it leaves +1.8); the passives and corpses add smaller shares (+5.7 to +6.4 each when removed alone); none of the three is significant alone, the combination is.
- So the death-resource mechanics **can** worsen the draw rate in a decisive regime against an aggressive player, mainly through Revenant, and cannot be shown to do so in the shipped regime. If Scott wants a draw-rate gate, Revenant Vow is the first thing to vary (a later trigger, or a smaller share of the army) and the mirror above is the test to repeat.
- The Court armies are *more* decisive than the baseline under the shipped heuristic (River Ford mirror 82.8% draws against 97.5%), because it buys the dearest cards first, which for the Court means Mourning Knights and Necromancers marching on the keep. The Court's draw rate is therefore not a property of the faction alone.

## 10. AI limitation (stated plainly)

The shipped heuristic knows Pikeman, Archer and Cavalier only. It recruits by a mix table keyed on those classes (for the Court every card scores 0, so the dearest is bought first), never selects a Court skill, never casts Mend Bone or Grave Chill, and gives no Court unit a role. Under it Corpses are never eaten (6.0 of 6.5 expire unused per game) and the Court's healing does not exist, so **the Plain arm understates the faction, and its numbers are a lower bound on the mechanics' value**. `experiments/factions/hollow-court/commander.mjs` wraps it: the shipped code runs on a view of the match with no unit cards (spells, withdraw, combine, Cavalier picks and the stances of fielded units), then the wrapper recruits toward a target mix (Ghoul .35, Graveguard .30, Wight .15, Necromancer .10, Knight .10), sets Necromancers to Protect a friend and Graveguards to Hold when a foe is within 3, selects skills by state (`courtSkillPicks`), casts Mend Bone on a unit missing 5 HP and Grave Chill on a finishable enemy, and marches on the keep when well ahead, as the heuristic does. It is a competent but unimaginative scripted player: no lookahead, no timing play beyond a fixed "eat a Corpse only when the heal is worth 6 HP (3 if it rots)" rule, untuned, and never compared with human play. Every conclusion in sections 8 and 9 is about the Court under these two players. A culture AI hook (Engine request 8) is needed before the shipped AI can play any culture.

## 11. What was simplified or rejected, and why

| item | decision | reason |
|---|---|---|
| Grave Rally "heal 6 for free" (FACTIONS.md 7) | built as *eat an adjacent Corpse, heal 6 to self and friends within 1* | a data-only ability cannot heal (only the shipped ids `rally` and `secondWind` do); consume is the one healing hook. Engine request 1 |
| Grave Chill "loses 1 energy" | built as 3 damage to one tile, Defense ignored | no energy-loss effect and no single-enemy target; radius 0 on `enemy-area` is the closest shape. Engine request 2 |
| Deathless Stand "survive with 1 HP once" | built as a passive: 2 less damage per strike on Hold | no survive status; Revenant already covers "does not die once". Engine request 3 |
| Graveguard "heals 2 HP at refresh if a friend died within 2 last round" | replaced by Duty Beyond Death (defence near a Corpse) plus Grave Rally | stateless "recent death" needs per-round memory; a Corpse is the recorded death |
| Ghoul "Cheap: recruit cost one lower" | cost 0 | as specified. Note the cap: population (10) is the binding limit in play, not Supply, so a free unit is a weak use of a slot (open question 3) |
| Wight | built | it is the only unit that turns Corpses into damage |
| Mourning Knight as a new class | built as a Cavalier variant | keeps Charge, Second Wind and the flank bonus without a new engine rule; its Revenant and Stand are passives |
| Revenant scope | Mourning Knights only | Scott's default; wider scope is open question 2 |
| Necromancer, Raise Ghoul, Writ of Recall | Necromancer class built; Raise and Writ **not built** | summoning and reviving are rejected in the spec |
| Kill bounties, Supply refunds on death, memorial tiles, salvage | not built | economy or persistent-state changes; they replace losses, which is the CORE-02 risk |
| Assize of the Dead | not built | see section 6 |
| Court skill cards (type-wide equipment) | none | the culture definition allows them; no Court item was needed for the idea |
| Court AI | thin commander in `experiments/` only | the shipped AI does not know the cards (section 10) |

## 12. Engine requests (nothing was edited in shared files)

| # | request | exact proposed change | why |
|---|---|---|---|
| 1 | data-only heal for kit abilities | in `activatePhase` (`src/abilities.js`), when `a.effect.heal` is a number: `const before = next.hp; next.hp = Math.min(next.maxHp, next.hp + a.effect.heal);` and report `effect: { type: 'heal', amount }` (leave the numeric-status loop for the other keys) | the spec's Grave Rally (heal 6, 0 energy, no Corpse) and every other culture's healing skill |
| 2 | spell energy loss and single-enemy target | add `effect.energyLoss` to `resolveSpellEffect` for `enemy-area` damage (`unit.energy = Math.max(0, unit.energy - n)`), and an `enemy-unit` target shape that `spellTargetValid` and `match.js` `spell` accept | Grave Chill as specified; today a one-tile area is used |
| 3 | survive-once status | in `battle.js` after damage: if `statuses.surviveOnce` and the unit would fall, set hp 1 and clear it (numeric status set by an ability or passive) | Deathless Stand as specified |
| 4 | Corpse ownership on consume | add `owner: 'friendly' \| 'enemy' \| 'any'` (default `'any'` = today) to `consume` and filter `objectsNear` results in the recovery-phase consume code and in `activatePhase` `objectNear` | today a Necromancer eats any Corpse in range, the enemy's too (tested); in a Court mirror each side feeds on the other's dead. Whether that is wanted is open question 4 |
| 5 | `ignoreDefense` on magic weapons (behaviour to confirm) | `battle.js` `cultureBonus` adds `Math.min(ignoreDefense, target.def)` even when the weapon is magic and already ignores Def; skip it when the forecast used Res | a magic user given `ignoreDefense` gets a hidden extra bonus (tested in the "engine note" check); Chancellery Audit is a flat +3 to avoid it |
| 6 | per-card population weight | `recruitUnit` in `src/cards.js` takes population only from stars (`UPGRADE_POPULATION_BY_STARS`) and ignores `card.population`; honour it (default 1) | a Feral Ghoul could weigh less than 1 slot if Scott wants the cheap unit to be cheap in population too; FACTIONS.md says unchanged, so this is optional |
| 7 | variant-specific abilities | `abilityApplies` could accept `variants: [...]` (match `unit.variantId`) | lets a variant carry its own kit without a new class, so a Court Pikeman variant would not leak the kit to plain Pikemen |
| 8 | culture AI hook | `culture.ai = (match, faction, { act }) => ...` called by `runCommander` for a side with a registered culture pool, before or instead of the shipped heuristic | the shipped AI cannot play any culture's cards, kits or corpse economy (section 10) |
| 9 | Corpse timing (behaviour to confirm) | a Corpse spawned in round N is decremented in the same resolution, so `decay: 3` is usable in the battles of rounds N+1 and N+2 only | if three battles are intended, spawn with `decay + 1` or decrement before spawning |
| 10 | consume before passives (behaviour to confirm) | recovery-phase consume runs before passives are evaluated, so an eaten Corpse never feeds a passive in that battle | the design tension between healing and feeding is intended by the Court commander; a fixed order (passives first) would let a Corpse do both once |

## 13. Open questions for Scott

1. **Champion.** Regent (implemented as the provisional default), Chancellor or Marshal (section 5)? Any of them can be played by passing `champions: { side: id }` and the matching roster; the Regent is recommended as a front-line body.
2. **Revenant scope.** Mourning Knights only (built), or any 2-star Court unit? Not built wider: the sims show 1.0 returns per game on the shipped rules and about 3.2-3.7 in a decisive mirror already.
3. **Population.** The Ghoul is cost 0 but takes a full population slot, and the population cap (10) binds before Supply does. Keep as specified, or give it a lighter population weight (Engine request 6)?
4. **Corpse ownership.** Should a Necromancer eat the enemy's dead (today it does), or only its own (Engine request 4)?
5. **Corpse decay.** 3 rounds gives two battles of use (Engine request 9); 4 gives three. Can a Corpse be occupied or captured? (unchanged from FACTIONS.md 9.5)
6. **Rarities.** Ghoul common, Graveguard/Wight/Necromancer uncommon, Knight rare puts only Ghouls and spells in the first two hands. Move the Graveguard to common?
7. **Free Mend Bone.** Cost 0 makes it a free small heal; acceptable, or 1 Supply for 6 (dominated by Mend)?
8. **Court AI.** A culture AI hook (Engine request 8) is needed before any Court play by the shipped AI is meaningful.
9. **Death mechanics and draws.** Section 9 shows no significant change in most cells and a +10 point draw rate in one decisive-regime mirror; see the recommendation there before adopting Revenant or corpse passives.

## 14. Evidence and status

| item | label | evidence |
|---|---|---|
| culture module, kits, spells, champions, pool | **implemented, verified** | 26 rule checks, `npm test` 87/87 |
| default game untouched | **verified** | `default-untouched.md`: `summary.csv` identical, 60 of 60 logs identical, headers identical except `commit` |
| scenarios | **verified** | 4 scenarios, 400 seeds per variant, 480 logs replayed from their headers, 0 mismatches |
| paired simulations | **verified** | 400 games per matchup (200 seeds x 2 sides; mirrors 400 seeds), one replay per matchup and side assignment, 0 mismatches; the 1000-game mirror set replays too |
| numbers, rarities, pool weights, champion default | **provisional** | prototype defaults; scenario armies sized to land mid-range; Scott chooses |
| Court AI | **provisional, experiment only** | section 10 |
| art | **placeholder** | tinted base sprites; reference images mapped in section 2 |
| browser interaction and screenshots | **not done** | nothing here is registered in the game and the UI has no support for Court skills or objects; the Court is only reachable from tests and experiments. Grave Chill's radius-0 target is untested in the UI |
