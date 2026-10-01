> Historical snapshot archived 2026-10-01. Earlier revisions/proposals, not current main. [Current docs index](../../README.md).

# Factions: technical spec (proposal)

Status: **design proposal, nothing implemented.** Default balance and strategy choices stay with Scott (`docs/DEVELOPMENT.md`). All numbers are starting values for paired-seed experiments, not tuned. Every faction is opt-in and must leave the shipped game (Blue Crown-like recruits v Red) byte-identical when off, as the experiment switches do (`docs/experiments/CANDIDATES.md`).

## 1. System constraints every faction is checked against

Items are graded against what the engine already does:

- **Tier A, data only.** Uses hooks that exist: kit abilities (`ABILITY_CATALOG`, `registerAbilities`) with cost 0–2 energy, cooldown, phase (`recovery`, `defense`, `enhancement`) and `requires` (`stance`, `moved`, `target`); type-wide passive equipment (2 slots per unit type, 2 Supply); spells of the existing shapes (`friendly-unit` or `enemy-area`, instant or upcoming-battle, heal / damage / status, cost 1–2 Supply); recruit templates in `src/roster.js` (HP, Str, Skl, Spd, Def, Res, Mov, weapon).
- **Tier B, small engine hook.** A new status the battle reads, an HP-threshold or controlled-tile condition on an ability, a faction card pool, or a preferred-target rule (`order.targetId` already exists). Each is one contained change in `src/abilities.js` / `src/battle.js` / `src/match.js` and needs a rule check.
- **Tier C, rejected or deferred.** New persistent tile objects, summoning or reviving units mid-battle, random ability failure, per-unit auras over the whole map, new unit classes, changes to economy or victory rules. Reasons are listed under each faction.
- **Fixed facts:** energy max 4, +1 per round (+1 on the bench); Rally, Brace, Focused Shot, Charge, Second Wind are the shipped kits; champions (Brenna, Dreg) have no kit; all cards are common (no rarity rates exist); combining needs the same class, faction and stars; new classes wait until the three recruit classes support a complete match. So faction units are **variants of Pikeman, Archer or Cavalier** (a template plus one passive) until Scott says otherwise. Rarity below is a proposed power label only.
- **Spec unit:** a unit entry = base class + stat delta + at most one passive + kit. A skill = a planning-selected ability. A spell = a one-shot card.

## 1b. Decisions recorded 2026-09-30 (answers from Scott)

These supersede the matching proposals and rejections below. Where a section still says otherwise, this section wins.

| topic | decision | effect on this spec |
|---|---|---|
| Rarity | A **simple time gate**: rarer cards become more likely after a few turns. Chosen form: **round steps** (common from round 1, uncommon drawable from round 3, rare from round 6; both numbers tunable). No draw rates beyond that. | New shared hook (below). Rarity is now a gameplay gate, not just a label. |
| Unit classes | **New classes** are approved (Bannerman, Relic Walker, Necromancer, Wight, etc.), not only variants. New classes borrow a base sprite with a faction tint and a name label until art is supplied (no new binary assets). | The Tier C rejection of new classes is lifted. Variants remain fine where a class is not needed. |
| Tile objects | **Implement**, simply: a tile object occupies a tile, has 10 HP and no healing, blocks **enemy** movement, is attackable when it blocks the path, and friends walk through. Corpses use the same object with no blocking and a 3-round decay. "Wacky is fine": a 10 HP sprite is acceptable. | League barricades (Dig In) and Court Corpses move from deferred to in scope. |
| Champions | **Both** Brenna and Dreg get active kits (Blood Challenge for Dreg), and the League and Hollow Court get champions too; agents propose a champion and kit for each for Scott to choose. | New shared hook (champion kits). |
| Blood Challenge | **Mark plus penalty on other targets** (+4 damage against the mark, -4 against anything else); not a hard lock. | As specified in section 5. |
| Argent Crown | **Simple Line Doctrine** first (+1 Defense per adjacent friendly infantry, up to +2). | As specified in section 4. |
| Iron League | **Garrison Doctrine is removed.** Ancient tech is **flavour only**, not setting canon. | Section 6 faction rule dropped. |
| Pools | **One faction per side.** Neutral cards may be added later. | `pools` hook is enough; shared spells (Mend, Ward, Fireburst) stay in each pool. |

## 2. Shared engine hooks

**Built and verified 2026-09-30; see [docs/CULTURE_HOOKS.md](../../CULTURE_HOOKS.md).** In code a faction is a *culture* (the engine's `faction` already means the side). Sub-agents on separate branches would conflict if each added these themselves, so the root built them first. The table records what each hook is for:

| hook | needed by | change |
|---|---|---|
| Faction on a card/unit and a per-faction recruitment pool (default off) | all | `src/cards.js`, `src/roster.js` |
| `requires.hpBelow` / `requires.hpAbove` on abilities | White Fang, Hollow Court | `src/abilities.js` |
| `requires.onControlled` (unit stands on an owned keep/village) | Iron League | `src/abilities.js`, `src/match.js` |
| Adjacent-ally and within-N-tiles passive check (read once per round) | Crown, Iron League | `src/battle.js` |
| Generic numeric statuses read by the battle (`damageTaken`, `damageDealt`, `preferredTarget`) | all | `src/battle.js` |
| Revenant: once per match a fallen unit stays with 1 HP (simplified from a pending return) | Hollow Court | `src/match.js`, `src/passives.js` |
| Marked target (`markTargetId`; no planning action yet) | White Fang | `src/match.js` |

Recorded in the log header like `experimentRules`, so replays reconstruct them.
### Additional hooks required by the 2026-09-30 decisions (built and verified 2026-09-30, see docs/CULTURE_HOOKS.md)

| hook | needed by | change |
|---|---|---|
| Rarity time gate: a card is drawable only from its rarity's unlock round (default off; uncommon round 3, rare round 6) | all | `src/cards.js` `drawCards` / `previewCycle`, `src/match.js` (round passed in), header records the gate |
| New class registration: a culture registers a class template (stats, weapon, movement type, kit, sprite fallback and tint) beyond `pikeman`/`archer`/`cavalier` | all | `src/roster.js`, `src/cards.js`, `src/rules.js` (`MOVE_TYPE`), `src/sprites.js`, `src/models.js` |
| Tile objects: `{ id, owner, c, r, hp, blocks, decay }`; blocks enemy movement, attackable when it blocks the path, decays; in the log and summaries | League, Court | `src/match.js`, `src/battle.js`, `src/rules.js`, `src/log.js`, UI overlay |
| Champion kits: an ability kit keyed by champion id (Brenna, Dreg, plus new champions) instead of by class | Crown, White Fang, League, Court | `src/abilities.js`, `src/match.js` |
| Mark action: a planning action that sets `markTargetId` (Blood Challenge) | White Fang | `src/match.js`, `src/ui.js`, AI commander |


## 3. Playstyle matrix

| faction | plan | strong against | weak against |
|---|---|---|---|
| Argent Crown | keep a formation; roles overlap | scattered or slow forces | flanks, Fireburst on a packed line |
| White Fang Clans | Advance, contact, keep momentum | passive or scattered armies | a Braced or Shieldwalled line, ranged attrition |
| Iron League | Hold a chokepoint, prepare, let them come | fixed objectives, bridges, fords | forced movement, flanks, Fireburst |
| Hollow Court | trade cheaply, recover value, outlast | armies that need a fast kill | keep capture before value converts, Fireburst on clumps |

---

## 4. The Argent Crown

**Flavour.** Blue and silver; the baseline Ashvale kingdom, Brenna's faction. A realm of valley lords who pooled their levies under one circlet and swore that no one holds a field alone.

**Key traits.**
1. **Formation over raw stats.** Units are ordinary alone and strong when roles overlap.
2. **Line Doctrine (Tier B).** A unit gains +1 Defense for each adjacent friendly infantry unit, up to +2, and loses nothing when alone. Simplified from the original three-role formation-point idea (screen, support, reserve), which needs role-distance queries the engine lacks; test the simple version first.

**Playstyle.** Hold or Protect early, screen Archers with Pikemen, keep Cavaliers in reserve until the enemy commits, then finish. Champion: Brenna (existing, no kit).

**Units** (variants of existing classes)

| rarity | unit | base | delta | passive | tier |
|---|---|---|---|---|---|
| common | Crown Guard | Pikeman | HP +2, Def +1, Mov −1 | **Shieldwall:** while adjacent to friendly infantry, take 2 less damage per strike | B |
| uncommon | Bannerman | Pikeman | HP −4, Str −3 | **Banner:** friendly Hold/Protect units within 2 tiles take 1 less damage per strike | B |
| rare | Oathsworn | Pikeman | HP +4, Str 0, Def +3 | **Sworn Guard:** while adjacent to its Protect subject, the subject takes 2 less damage and the Oathsworn takes 2 more | B |

**Skills** (kit abilities)

| rarity | skill | who | cost / cooldown | phase | effect | tier |
|---|---|---|---|---|---|---|
| common | Close Ranks | Pikeman, Crown Guard | 1 / 2 | defense | Adjacent friendly infantry take 2 less damage per strike this battle. Does not force Hold. | B |
| uncommon | Hold the Standard | Bannerman | 2 / 3 | recovery | Requires Hold. Friendly units within 2 tiles heal 6 HP. | B |
| rare | Interpose | Oathsworn | 2 / 2 | defense | Requires a Protect subject in range 1. Up to 4 of the subject's incoming damage this battle is taken by the Oathsworn instead. | B |

**Spells:** Mend (existing). Ward (existing). Suggested new: **Rally Banner** (common, 1 Supply): all friendly units within 2 tiles of the target gain the Ward effect. Tier A (status already exists), needs area targeting on friendly units, so treat as B.

**Rejected or deferred.**
- Full formation-point system with three roles and reserve distance: needs role and distance queries; too large for a first pass (replaced by adjacent-infantry Line Doctrine).
- Bannerman and Oathsworn as new classes: contradicts "new classes wait"; they are Pikeman variants.
- Oathsworn taking half of all damage: unbounded redirection interacts badly with simultaneous strikes; replaced by a fixed 2 / 4 cap.
- "Weak when scattered" penalty on lone units: punishes baseline play and makes the shipped Blue army worse; dropped.

---

## 5. The White Fang Clans

**Flavour.** Iron, fur and bone; heavily armoured northern clans with carved plate and monster trophies. Dreg's faction.

**Key traits.**
1. **Momentum.** Bonuses trigger on movement and contact: Advance into an enemy the same round.
2. **Intent modifiers.** The player changes what an automated unit wants (whom it hunts) with a planning pick.

**Playstyle.** Deploy forward, keep everything on Advance, mark one target, commit spells early. Mediocre at holding an objective (no Brace, no bonus while holding). Champion: Dreg (existing).

**Units**

| rarity | unit | base | delta | passive | tier |
|---|---|---|---|---|---|
| common | White Fang Reaver | Pikeman | Str +1, Def −2, Mov +1 | **Momentum:** +2 damage if it moved before attacking this battle | A (`requires.moved` exists) |
| uncommon | Axeguard | Pikeman | HP +4, Str 0, Def +1 | **Bloodied Grit:** +1 energy when struck, once per round | B |
| rare | Berserker | Pikeman | HP +2, Str +2, Def −4 | **Last Fang:** below 50% HP gains +2 Str | B (`hpBelow`) |

**Skills**

| rarity | skill | who | cost / cooldown | phase | effect | tier |
|---|---|---|---|---|---|---|
| common | Reaving Rush | Reaver | 1 / 2 | enhancement | Requires Advance, movement and a melee target: strike gains +2 damage and ignores 2 Defense. | A |
| uncommon | Iron Skin | Axeguard | 1 / 2 | defense | Take 3 less damage this battle; does not force Hold. | B |
| rare | Frenzy | Berserker | 2 / 3 | enhancement | Only below 50% HP. Strikes gain +4 damage; the unit takes 2 more damage per strike. | B |
| champion | Blood Challenge | Dreg | 2 / 3 | enhancement | Mark one enemy within 6 tiles. Dreg advances toward it and gains +4 damage against it; strikes on other targets are −4 damage. Ends when the target dies or at the end of the round. | B (`order.targetId`, new penalty status). Champion kits are a separate decision. |

**Spells**

| rarity | spell | effect | tier |
|---|---|---|---|
| common | War Cry | Chosen friendly Advance units gain +1 movement this battle. | B |
| common | Blood Oath | Chosen friendly unit takes 4 damage now (cannot kill) and gains +3 damage this battle. | B |
| uncommon | Hunt | Mark an enemy: friendly Advance units within 4 tiles gain +2 hit against it. | B |

**Rejected or deferred.**
- Ancestors' Fury (a dying unit passes 2 energy to its nearest ally): death-triggered transfers add event ordering under simultaneous death. Deferred; War Cry and Blood Oath cover commitment.
- Blood Challenge as a hard target lock across walls: replaced by the existing explicit target order plus a penalty on other targets; a pure lock would let the player paralyse Dreg.
- Berserker as a new class: kept as a Pikeman variant with a large Str spike.
- Any healing for the faction: none proposed; it should stay a glass cannon.

---

## 6. The Iron League

**Flavour.** Brass, bronze and rust; free cities and mercenary companies fielding salvaged remnants of a fallen technological age. Patched, decrepit, hand-repaired artifacts on pikes and crossbows. Officially non-magical: its engineers call it craft.

**Key traits.**
1. **Preparation.** Holding still converts into bonuses (Prepared Shot, Set Shield, Garrison Doctrine).
2. **Decrepit tech, deterministically.** Artifacts are strong but wear out: overuse costs the next round (cooldown or Overheat), never a random failure.

**Playstyle.** Hold a road, bridge or ford in the order Pikeman, Pavise Guard, Crossbowman; prepare a killing ground and let the enemy come. Skills are strong; spells are few and weak. Champion: not decided.

**Units**

| rarity | unit | base | delta | passive | tier |
|---|---|---|---|---|---|
| common | Pavise Guard | Pikeman | HP +1, Def +2, Str −2, Mov −1 | **Set Shield:** if it did not move, adjacent friendly Archers/Crossbowmen take 2 less ranged damage | B |
| uncommon | Coil Crossbowman | Archer | HP 0, Str 0, Skl 0 | **Prepared Shot:** on Hold and unmoved last round, the next ranged strike gains +4 damage and +20 hit | A (`requires.stance`, `moved`) |
| rare | Relic Guard | Pikeman | HP +6, Str +1, Def +3, Mov −2 | **Wear:** first time below 50% HP it loses 1 Mov | B |

**Skills**

| rarity | skill | who | cost / cooldown | phase | effect | tier |
|---|---|---|---|---|---|---|
| common | Set Position | Pikeman, Pavise Guard | 1 / 2 | defense | Requires Hold and no movement: take 2 less damage per strike; stacks with Brace. | A |
| uncommon | Prepared Position | Crossbowman, Archer | 1 / 2 | enhancement | Requires Hold. Gain Prepared Shot now; the shot gains +2 more damage. If the unit moved this round, this does nothing. | A |
| rare | Arc Burst | Relic Guard | 3 / 3 | enhancement | Requires Hold. One ranged strike (range 2) that ignores 3 Defense. **Overheat:** the unit cannot select it the next round (cooldown extended by 1) and takes 3 damage. | B |

**Garrison Doctrine (free Brace on controlled tiles): removed by Scott, 2026-09-30.** The `onControlled` hook stays available for other uses.

**Spells (mediocre by design)**

| rarity | spell | effect | tier |
|---|---|---|---|
| common | Field Repair | Heal a chosen friendly unit 4 HP. | A |
| common | Flare | Mark one enemy: friendly units with Prepared Shot gain +2 hit against it. | B |

**Rejected or deferred.**
- Sapper barricades (persistent tile objects): needs a tile-object system; the same engine cost as Hollow Court Corpses. Decide once, for both.
- Relic Walker as a new class with Mov 2 and piercing beam: new class and a line-area attack shape. Replaced by the Relic Guard variant and a single-target Arc Burst.
- Random Malfunction chance: undermines legibility and makes results harder to explain in the forecast. Replaced by deterministic Overheat.
- Static Discharge with a 25% failure chance: same reason.
- The Foundry Age lore as an established fact: a worldbuilding claim not in GAME.md; treat as flavour until approved.

---

## 7. The Hollow Court

**Flavour.** Bone, black velvet and candlelight; a dead civilization governing the same provinces for centuries. Sees mortality as a barbaric condition to be phased out. Units are ghouls, Graveguards, Wights, Mourning Knights and Necromancers.

**Key traits.**
1. **Death retains value.** Defeating a unit does not necessarily remove its battlefield value.
2. **Modest individual units.** The faction wins by attrition and recovery, not by stat quality.

**Playstyle.** Cheap ghoul front, Graveguards holding a line, recover value from the dead, let one elite return. Slow and inevitable; weak to fast keep capture and to burst on clumps. Champion: not decided.

**Units**

| rarity | unit | base | delta | passive | tier |
|---|---|---|---|---|---|
| common | Feral Ghoul | Pikeman | HP −8, Str −1, Def −6, Mov +2 | **Cheap:** recruit cost one lower (population weight unchanged). | A (cost data) |
| uncommon | Graveguard | Pikeman | HP +2, Def 0 | **Duty Beyond Death:** heals 2 HP at refresh while any friendly unit died within 2 tiles last round. | B |
| rare | Mourning Knight | Cavalier | HP +2, Str 0, Def +2 | **Revenant Vow:** once per match, when killed it returns at the end of battle with 1 HP on its own tile (or nearest free tile), keeping stars and equipment. | B (reuse the champion respawn path) |

**Skills**

| rarity | skill | who | cost / cooldown | phase | effect | tier |
|---|---|---|---|---|---|---|
| common | Grave Rally | Pikeman, Graveguard | 0 / 2 | recovery | Heal 6 HP (Rally is 10). A cheaper, weaker Rally. | A |
| uncommon | Unquiet Step | Ghoul | 1 / 2 | enhancement | Requires Advance and movement: +2 damage. | A |
| rare | Deathless Stand | Mourning Knight | 2 / 3 | defense | Requires Hold. If the unit would die this battle it survives with 1 HP once. Not usable with Revenant Vow in the same match. | B |

**Spells**

| rarity | spell | effect | tier |
|---|---|---|---|
| common | Grave Chill | One enemy in range takes 3 damage and loses 1 energy. | B (energy loss) |
| uncommon | Mend Bone | Heal a chosen friendly unit 6 HP. | A |

**Rejected or deferred.**
- Corpse tokens (persistent tile objects): needs a tile-object system, movement/capture rules and log support. Deferred with the League barricades; decide once. Duty Beyond Death substitutes a stateless "recent death nearby" rule.
- Necromancer class, Raise Ghoul and Writ of Recall (summoning or reviving mid-match): touches population cap, reserve rules and the end check. Deferred.
- Wight and Hollow Noble units: no new classes yet; kept as flavour.
- Assize of the Dead: depends on Corpse tokens.
- Revenant on any 2★ unit: too strong at rarity common; kept to one rare unit and an explicit "once per match".
- Cross-faction "death as a resource" menu (kill bounties, memorial tiles, graveyard pile, salvage): economy or persistent-state changes. Only Revenant, "recent death nearby" and Blood Oath survive from it. Caution recorded: anything that replaces losses can worsen CORE-02 draws; every death-related item must be tested for draw rate.

---

## 8. Handoff for faction sub-agents

Proposed contract (each faction on its own branch, e.g. `faction/argent-crown`, `faction/white-fang`, `faction/iron-league`, `faction/hollow-court`):

- **Order:** the root builds the shared hooks in section 2 first and merges them; then one agent per faction.
- **Ownership per branch:** its own data module (`src/factions/<id>.js`, proposed), its own experiments folder (`experiments/factions/<id>/`), its own rule checks in `tests/`, and its own section of this file. No branch edits another faction's files or the default pool.
- **Acceptance per faction:** (1) every switch off leaves `npm test` (37+ checks) and the shipped simulation summaries byte-identical (`cmp`); (2) each Tier A/B item has a rule check; (3) a level or scenario that shows each unit and skill working (as levels 1–7 do); (4) 200 paired, side-swapped simulations against the baseline army with replay verification, reporting win rate, draw rate, game length and captures; (5) the section of this file updated with results; (6) no default balance change.
- **Report, do not adopt:** balance defaults, rarity rates and champion kits are Scott's choice.

## 9. Open questions

Answered on 2026-09-30 (see section 1b): rarity, new classes, tile objects, champion kits, Blood Challenge, Crown Line Doctrine, Garrison Doctrine, pool mixing, League/Court champions, ancient-tech lore. Still open:

1. Iron League: deterministic **Overheat** instead of random Malfunction (assumed; say if you want a random chance back).
2. Is the League's **Sapper** a class (now allowed) or a skill any League unit carries?
3. Hollow Court: **Revenant** on Mourning Knights only (proposed), or on any 2★+ Court unit?
4. Champions for the League and the Hollow Court: agents propose options; pick from them.
5. Timing of Corpse decay (3 rounds proposed) and whether Corpses can be occupied for capture.
6. The time-gate numbers (uncommon round 3, rare round 6) are proposals to tune by simulation.
7. Neutral cards later: shared spells only for now (Mend, Ward, Fireburst).

## 10. Defaults chosen for playtesting (2026-09-30, provisional)

Scott asked for sane defaults so playtesting can start. These are the values the four faction branches chose and `faction_overhaul` merged; every one is a prototype default, listed so it can be changed. The full per-faction specs are in `docs/factions/`.

| topic | default |
|---|---|
| Champions | Crown: Brenna (`brennaCrown`, kit Bulwark of the Realm + Oathkeeper's Strike). Fang: Dreg (`dreg`, or a copy `dregBlue` when the clans play Blue; kit Blood Challenge + Warlord's Rush). League: Captain Ilse Voss (Field Works). Court: the Hollow Regent. |
| Unit types | Real new classes: Bannerman, Oathsworn, Reaver, Axeguard, Berserker, Relic Walker, Sapper, Ghoul, Graveguard, Wight, Necromancer. Variants: Crown Pikeman/Archer/Knight/Guard, Fang Hunter, League Pike/Pavise/Coil, Mourning Knight. |
| Rarity | Time gate on whenever a faction plays: uncommon from round 3, rare from round 6. Off for the classic game and for levels (levels inject their own cards). |
| Line Doctrine | Simple version: +1 Defense per adjacent friendly infantry, up to +2 (a Crown card may be strictly better than its base card). |
| Blood Challenge | Mark plus penalty: +4 damage on the mark, -4 on other targets. |
| League | Deterministic Overheat instead of random Malfunction; Sapper is a class; no Garrison Doctrine; ancient tech is flavour. |
| Court | Revenant Vow on Mourning Knights only, once per match; Corpses decay after 3 rounds; a Necromancer may eat corpses of either side (owner filter is an engine request). |
| Pools | One faction per side plus the shared spells (Mend, Ward, Fireburst). The same faction on both sides is refused for now (a mirror needs a second champion). |
| Skirmish army | The shipped starting slots with each unit swapped by role: Pikeman/Archer/Cavalier become the faction's front, ranged and mounted-or-heavy unit (`FACTIONS[].core` in `src/setup.js`). |
| AI | The shipped `greedy`/`heuristic` commanders play any faction (they do not understand faction cards); the culture-aware commanders in `experiments/factions/*/` are not wired into the game. Levels use a scripted enemy only. |

Engine fixes made while merging (all inert for the classic game, checked byte-identical): a variant card's default stance now reaches the deployed unit; withdrawing a variant keeps its variant identity; roster variants read their own rarity; abilities tagged for a culture no longer apply to other units of the same base class.

## 11. Menu and levels (playtesting)

- **Menu** (`src/menu.js`): opens when the URL has no game flags (or `?menu=1`). Skirmish: pick your faction and the opponent's (classic Ashvale or the four factions), the opponent AI and an optional seed. Levels: the 24 scenario levels, grouped by faction. `?nomenu=1` (or any game flag) skips it, so existing tooling keeps working (`tools/shot.mjs` adds it).
- **URL flags:** `?you=<faction>&foe=<faction>&red=<ai>&seed=N` for a skirmish (`crown`, `fang`, `league`, `court`, default `classic`), `?level=<id>` for a level.
- **Levels** (`src/levels.js`): the suites written for the experiments (7 classic, 3 Crown, 5 Fang, 5 League, 4 Court) played as Blue by a human. Red follows the level's script and its units' stances. The panel under the objective ("About this level") shows the question, the setup and the suggested plan (the skilled variant's Blue steps).
- **In game:** a "Menu" link in the objective panel returns to the menu.

## 12. Unit categories and more classes (2026-09-30)

Scott asked for room for mages and other roles and for more character diversity. `src/categories.js` adds five categories; a category never changes combat rules by itself, it drives display, AI defaults and design of new classes.

| category | role | shipped | faction classes added |
|---|---|---|---|
| melee | front line, holds ground | Pikeman, Paladin, Barbarian | Crown Guard, Oathsworn, Reaver, Axeguard, Berserker, Relic Walker, Ghoul, Graveguard, Wight |
| ranged | shoots from behind the line | Archer | Levy Archer, Fang Hunter, Coil Crossbowman |
| mounted | fast shock and flank | Cavalier | Crown Knight, **Wolf Rider** (Fang), **Dragoon** (League), Mourning Knight |
| caster | magic damage (Mag against Res, ignores Defense), fragile | none | **Fang Shaman**, **Artificer** (League, range 2-3), **Wraith** (Court) |
| support | heals, buffs, auras | none | Bannerman, **Battle Cleric** (Crown), Sapper, Necromancer |

New this pass (prototype numbers, all in the faction modules): Battle Cleric (Sanctuary heals 6 HP to itself and friends within 2), Fang Shaman (Wolf Spirit: +2 damage for friends within 2), Wolf Rider (Pack Charge, Howling Charge), Artificer (Overload: +4 damage, Overheat), Dragoon (Ironclad), Wraith (Ethereal, Withering Touch). A class picks its category with `category` (default caster for a magic weapon) and may set `aiStance: 'hold' | 'advance'`. The League's classes now prefer to hold. New engine hooks: kit abilities can `healAllies: { radius, amount, self }` and `grant: { radius, statuses, self }`.

**AI.** The shipped heuristic commander now reads class data: it counts and recruits faction classes by category (variants and new classes included), holds or advances by category and `aiStance`, picks faction abilities from each unit's kit by what the ability data says it needs (affordable, off cooldown, requirements met, something to act on), aims mark abilities, and casts faction spells. Classic games are unchanged (byte-identical simulations).
