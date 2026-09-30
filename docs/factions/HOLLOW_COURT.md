# The Hollow Court: technical spec and results

Branch `faction/hollow-court` (from `ccr-d70cb868-ob7chg` at 7e9d663). Status: **implemented as a culture module and verified by rule checks, scenarios and paired simulations; nothing is registered in the game.** Every number is a prototype default named in `src/factions/hollow-court.js` (`COURT`); Scott chooses the shipped values. Design source: [FACTIONS.md](../../FACTIONS.md) sections 1b, 7, 8, 9; hooks used: [CULTURE_HOOKS.md](../CULTURE_HOOKS.md) (no shared engine file was edited).

| what | where |
|---|---|
| culture module (`registerCulture` definition, `buildHollowCourt(options)` for ablations, `courtRoster`) | `src/factions/hollow-court.js` |
| rule checks (26; `npm test` is 87/87) | `tests/faction-hollow-court.test.mjs` |
| scenarios, Court commander, paired simulation | `experiments/factions/hollow-court/` (`scenarios.mjs`, `run-scenarios.mjs`, `commander.mjs`, `armies.mjs`, `sim.mjs`) |
| results | `docs/experiments/results/factions/hollow-court/` |

Reproduce: `node experiments/factions/hollow-court/run-scenarios.mjs --seeds 400 --replay 10`; `node experiments/factions/hollow-court/sim.mjs --seeds 200 [--map village_chain --dvil 5]`; register in your own process with `registerCulture(HOLLOW_COURT)` then `createMatch({ pools: { blue: culturePool('court') }, roster, champions })` and `setRarityGate({ uncommon: 3, rare: 6 })`.

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
