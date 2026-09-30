# Culture hooks (shared engine support for factions)

Built 2026-09-30 on `ccr-d70cb868-ob7chg` for the faction sub-agents (see [FACTIONS.md](../FACTIONS.md) section 2). **Terminology:** the engine's `faction` already means the side (`'blue'` / `'red'`), so FACTIONS.md's factions are called **cultures** in code (`culture: 'crown' | 'fang' | 'league' | 'court'`).

**Status: implemented and verified, nothing registered in the game.** With no culture registered the shipped rules are unchanged: `npm test` 49/49 (12 new checks in `tests/cultures.test.mjs`), and a 60-game side-swapped heuristic v greedy simulation (30 seeds, `--verify`) gives byte-identical `summary.csv` and byte-identical game logs (headers included) before and after the change.

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

## Not built (deliberately)

Persistent tile objects (League barricades, Court Corpses), summoning or reviving units mid-match, new planning actions (a mark action), new classes, aura visuals or UI, and AI behaviour for any culture. Those belong to the faction branches or to a decision by Scott.

## Using it in a branch

1. Put the culture in its own module and call `registerCulture` in the tests, scenarios and simulators that need it (not in the game).
2. Give each new rule a check in `tests/`, like `tests/cultures.test.mjs`.
3. Prove the default is untouched: `node tools/sim/run.mjs --games 30 --blue heuristic --red greedy --swap --seed 1 --out <dir> --verify` before and after, then `cmp` `summary.csv` and the logs.
