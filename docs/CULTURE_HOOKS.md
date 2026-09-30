# Culture hooks (shared engine support for factions)

Built 2026-09-30 on `ccr-d70cb868-ob7chg` for the faction sub-agents (first batch, then the second batch after Scott's answers) (see [FACTIONS.md](../FACTIONS.md) section 2). **Terminology:** the engine's `faction` already means the side (`'blue'` / `'red'`), so FACTIONS.md's factions are called **cultures** in code (`culture: 'crown' | 'fang' | 'league' | 'court'`).

**Status: implemented and verified, nothing registered in the game.** With no culture registered the shipped rules are unchanged: `npm test` 60/60 (12 checks in `tests/cultures.test.mjs`, 11 in `tests/culture-systems.test.mjs`), and a 60-game side-swapped heuristic v greedy simulation (30 seeds, `--verify`) gives a byte-identical `summary.csv` and byte-identical game logs (the only difference is the header's git commit hash), before and after both batches. Tile objects were also checked in the browser (barricades and a corpse render on the map, no console errors; objects have no interaction of their own).

## Entry point

`src/cultures.js`: `registerCulture(def)` / `unregisterCulture(id)` / `resetCultures()` / `culturePool(id)`. A culture supplies variants, abilities, spells, skills and a pool (the `def` shape is documented at the top of the file). Play with it through `createMatch({ pools: { blue: culturePool('crown'), red: ... } })`; the log header records `cultures` and `pools` only when set, and `replay()` rebuilds `pools` from the header (the culture itself must be re-registered first). Registration is per process and removable, so cultures and `experiments/candidates` do not collide.

## The hooks

| hook | where | how a culture uses it |
|---|---|---|
| Variant units and cards | `src/roster.js` (`VARIANTS`, `variantOver`), `src/cards.js` (`unitCardFor`) | `variants: { key: { base: 'pikeman'\|'archer'\|'cavalier', delta, stats, passives, card } }`. A variant recruits as its base class (`cls`), so kits, sprites, movement and stance defaults follow the class; `variantId`, `culture` and `passives` are set on the unit and carried through recruit, bench and deploy. Combining follows the existing class/variant/faction/rarity identity. |
| Per-side draw pool | `src/cards.js` (`createCardState({ pool })`, `drawCards`, `previewCycle`), `src/match.js` (`pools`) | Each side draws and cycles from its own card keys. Absent, both sides use the shared pool. |
| Ability requires `hpBelow`, `hpAbove`, `onControlled` | `src/abilities.js` `activatePhase`, `src/match.js` | Fractions are strict comparisons of HP with max HP; `onControlled` means standing on an owned keep or village. Skip reasons: `hp-trigger-unmet`, `location-trigger-unmet`. |
| Passives (adjacency, aura, stance, moved, HP, controlled) | `src/passives.js`, evaluated in `beforeCombat` in `src/match.js` on post-movement positions | Data-only, described at the top of the file. Effects are numeric battle statuses added for that battle. |
| Numeric battle statuses | `src/battle.js` | `damageTaken` (less per strike, applied after Ward, never below 0, never turns a miss into damage), `damageDealt`, `ignoreDefense` (adds up to the target's Defense), `offTargetPenalty` (when the unit has an explicit target and strikes someone else), `energyWhenStruck` (match, once per battle if it took damage). All cleared after each battle; strike events gain no new fields. |
| Marked target | `src/match.js` | Setting `unit.markTargetId` makes that living enemy the unit's explicit target for the battle (movement and strike selection already honoured `order.targetId`); cleared at the end of the round. No planning action sets it yet: Blood Challenge's agent adds it. |
| Revenant | `src/passives.js` (`hasRevenant`), `src/match.js` | Passive `effect: { revenant: 1 }`: once per match, when killed (including by spells) the unit stays with 1 HP on its own tile, emits a `return` result and a note, and is not counted as lost. Never applies to champions. Simplified from "pending return": there is no interval in which the unit is off the board. |
| Spells | `src/abilities.js` (`SPELL_CATALOG`, `registerSpells`), `src/match.js` | Extra spells of the existing shapes (`friendly-unit`, `enemy-area`; heal, damage, status). The match now decides area vs unit targeting from the spell's `target`, not the id `fireburst`. |

## Second batch (Scott's answers, 2026-09-30)

| hook | where | how a culture uses it |
|---|---|---|
| Rarity time gate | `src/cards.js` (`RARITY_GATE`, `setRarityGate`, `createCardState({ round })`), `src/match.js` | `setRarityGate({ uncommon: 3, rare: 6 })`: a card is drawable only from its rarity's unlock round, for both sides, from the shared or per-side pool. Off (empty) by default. The match passes the round in; the header records `rarityGate`, and a replay must call `setRarityGate(header.rarityGate)` in its `create`. Card rarity comes from `card: { rarity }` on a class or variant, or `card.rarity` on a spell or skill. |
| New classes | `src/cultures.js` (`classes`), `src/roster.js` (`RECRUIT`), `src/rules.js` (`MOVE_TYPE`), `src/combat.js` (`WEAPONS`), `src/sprites.js`, `src/models.js` | `classes: { key: { name, stats, weapon, weaponDef, moveType, spriteBase, tint, passives, onDeath, card } }`. A class gets its own `cls`, template, weapon, movement type, unit card, kit (abilities with `classes: [key]`) and a placeholder sprite: the `spriteBase` class's sprite multiplied by `tint` (the 3D fallback also uses it). No binary assets. Variants may also carry `tint`. |
| Champions | `src/roster.js` (`CHAMPION_TEMPLATES`, `createChampionUnit`), `src/cultures.js` (`champions`), `src/match.js` (`champions` option), `src/abilities.js` (`abilityApplies`) | `champions: { id: { name, cls, stats, look, faction } }`, then `createMatch({ roster: [..., createChampionUnit(id, side, c, r)], champions: { blue: id } })`. A registered champion respawns as itself, never combines, and is skipped by revenant. Kits: an ability applies to a class (`classes`) or to named units (`units: ['dreg']`); `classes: ['paladin', 'barbarian']` gives Brenna and Dreg kits with no other change. |
| Mark action | `src/match.js` (`mark` action, defense-phase hook), `src/abilities.js` | Kit ability with `mark: { radius }`, phase `defense`, and `effect: { damageDealt: 4, offTargetPenalty: 8 }` = +4 against the mark and -4 against others. `{ type: 'mark', faction, unitId, targetId }` aims it (checks range and that the unit has such an ability); it takes effect only if the ability activates, and defaults to the nearest enemy in radius. Cleared at the end of the round. No UI or AI yet. |
| Tile objects | `src/match.js` (`match.objects`, `addObject`, `objectAt`, `objectsNear`, `consumeObject`), `src/battle.js`, `src/rules.js`, `src/objects.js` (render), `src/ui.js` | Objects: `{ objectKind, faction (owner), c, r, hp, blocks, decay }`. A blocking object (barricade) stops **enemy** movement (friends walk through but cannot stop on it) and is struck only when no real enemy is in reach; a non-blocking one (corpse) is a marker. `decay` counts rounds down (null = until destroyed). Spawn ability: `spawn: { kind, hp, blocks, decay, at: 'front' or 'self' }` on a `defense`-phase ability puts one in front of (or under) the unit if the tile is free. `onDeath: { spawn: { kind: 'corpse', decay: 3 } }` on a class or variant leaves an object where the unit died. Objects appear in log summaries only when present; results report `objectDestroyed` and `objectExpired`. |

## Not built (deliberately)

Summoning or reviving units mid-match, aura visuals, UI for the mark action, object interaction in the UI (objects are draw-only), object HP bars, real sprites for new classes, and AI behaviour for any culture (the AI does not yet place objects, mark targets or deliberately play new-class cards). Those belong to the faction branches or to a decision by Scott.

## Using it in a branch

1. Put the culture in its own module and call `registerCulture` in the tests, scenarios and simulators that need it (not in the game).
2. Give each new rule a check in `tests/`, like `tests/cultures.test.mjs`.
3. Prove the default is untouched: `node tools/sim/run.mjs --games 30 --blue heuristic --red greedy --swap --seed 1 --out <dir> --verify` before and after, then `cmp` `summary.csv` and the logs.
