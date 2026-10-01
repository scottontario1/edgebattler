# Shards (replaces skills)

Requested 2026-09-30 by Tisha. Merged from `feature/shards` into main, 2026-09-30.

Skills leave the gameplay: the planning-selected ability kits (energy, Rally/Brace/Focused Shot/Charge/Second Wind and
the culture kits) and the type-wide Barrier skill card. Shards replace them: passive stat boosts bought from the shop
(the hand), stored in a shard dock between rounds, and applied to a unit class so every unit of that class gets the bonus.

## Rules

- Shard cards are a new card type `shard` in the draw pool. Buying one costs its Supply cost and moves it from the hand
  into the side's **shard dock** (12 slots, `SHARD_RULES.dockSlots`). No free slot: the buy fails (`dock-full`).
- The dock persists between rounds. Shards in it do nothing until applied.
- **Apply**: during planning, a dock shard is applied to a unit class (`cls`, e.g. `pikeman`, `archer`, `cavalier`, a
  hero class). Every unit of that class on that side, on the field, on the bench and recruited or respawned later,
  gets the bonus. Each class holds up to 3 applied shards (`SHARD_RULES.classSlots`). Duplicates of the same shard type
  on one class stack.
- **Remove**: an applied shard can be returned to the dock during planning if the dock has a free slot. Stats revert.
- **Combine**: three dock shards of the same type and tier merge into one shard of the next tier (I -> II -> III).
  Tier III is the maximum. Combining is an explicit planning action and frees two dock slots.
- Stat invariant: a unit's stats always equal its own base stats plus the summed bonus of the shards applied to its
  class. Raising max HP also raises current HP by the same amount; lowering it clamps current HP.

## The eight shards

| Shard | Effect | I | II | III |
|---|---|---|---|---|
| Ruby (Might) | Strength | +1 | +2 | +4 |
| Sapphire (Guard) | Defence | +1 | +2 | +4 |
| Emerald (Vigor) | Max HP | +3 | +6 | +12 |
| Topaz (Swiftness) | Speed | +1 | +2 | +4 |
| Amethyst (Focus) | Skill (hit and crit) | +2 | +4 | +8 |
| Garnet (Bulwark) | Blocks damage each battle | 1 | 2 | 4 |
| Pearl (Renewal) | Heals at the start of each round | 2 | 4 | 8 |
| Onyx (Thorns) | Damage back to a melee attacker per hit taken | 1 | 2 | 4 |

A tier I shard card costs 1 Supply. Pool weights: each shard type appears once in the recruitment pool; normal unit draws retain their weights; the active shop offers 2–3 shard cards each round outside the normal hand cap. Spells are archived by default.

## Engine API (SHARD-01, implemented)

Modules: `src/shards.js` (tables and pure helpers), `src/cards.js` (shard cards, pool), `src/match.js` (state, actions, effects),
`src/battle.js` (thorns), `src/ai/commander.js` (heuristic buys/applies/combines), `src/log.js` (schema 4).

### `src/shards.js`
`SHARD_RULES {dockSlots:12, classSlots:3, maxTier:3}`, `SHARDS[id] = {id, name, title, color, kind:'stat'|'effect', key, values:[I,II,III], label}`
(ids `ruby sapphire emerald topaz amethyst garnet pearl onyx`; `key` is the bonus key: str, def, maxHp, spd, skl, block, regen, thorns),
`SHARD_IDS`, `SHARD_TIER_LABELS`, `shardValue(id, tier)`, `shardLabel(id, tier)` ("Ruby II"), `shardEffectText(id, tier)`,
`SHARD_CARDS[id]` (tier I card: `{id:'shard-ruby', type:'shard', rarity:'common', shardId, tier:1, name:'Ruby Shard', title, cost:1, effect}`),
`shardBonus(appliedList)` -> `{str,def,maxHp,spd,skl,block,regen,thorns}`, `findShardCombos(dock)` -> `[{shardId, tier, ids:[3]}]`,
`combineShards(dock, shardId, tier, newId)` (pure).
`cardFor('ruby')` resolves the card (key = shard id); hand entries are copies with an `instanceId`. The recruitment pool has 26 entries:
6 pikeman, 4 archer, 2 cavalier, 2 mend, 2 ward, 2 fireburst, 1 of each shard. `barrier` is not in the pool (`SKILL_CARDS` is still exported).
Cycling works for shard cards (same type and rarity replacement).

### State (per side, `match.sides[f]`)
- `shardDock: [{ id:'shard-<n>', shardId, tier }]` (max 10; ids come from `side.shardSeq`).
- `shards: { [cls]: [{ shardId, tier }] }` applied shards per unit class (max 3 each; keys are unit `cls`, e.g. `pikeman`, `paladin`).
- Units and bench records carry `shardBonus: {str,def,maxHp,spd,skl}` = the stat bonus currently folded into their stats (undefined until
  the class first gets a shard). `match.summary(f)` (the `sideSummary`, also in log summaries) exposes `shardDock` and `shards`.
- Helpers on the match: `m.shardBonusFor(f, cls)`, `m.classOf(record)`, `m.syncShards(record)`, `m.abilitiesEnabled`.

### Actions (`match.apply({type, faction, ...})`, all logged; planning phase only)
| type | fields | result | failures |
|---|---|---|---|
| `buyShard` | `cardId` (hand instanceId) | `{shardInstanceId, shardId, tier}`; pays `card.cost` Supply, card leaves the hand | `card-not-found`, `dock-full`, `insufficient-supply` |
| `applyShard` | `shardInstanceId`, `unitType` | `{unitType, shardId, tier}`; dock -> class, all units/bench of that class re-synced | `shard-not-found`, `invalid-unit-type`, `class-full` |
| `removeShard` | `unitType`, `index` (into `shards[unitType]`) | `{unitType, shardInstanceId, shardId, tier}`; class -> dock | `shard-not-found`, `dock-full` |
| `combineShards` | `shardId`, `tier` | `{shardInstanceId, shardId, tier: tier+1, consumed:[3 ids]}`; merged shard goes to the end of the dock | `no-combo`, `max-tier` |
| `grantShard` | `shardId`, `tier` | scripted levels only: dock entry without a card or Supply | `invalid-shard`, `dock-full` |
`unitType` is valid when the side has a unit of that class on the field or bench, or it is a `RECRUIT` class (pikeman, archer, cavalier).
Sync rule: after every apply/remove and on deploy, recruit, combine (stars) and hero respawn the unit's stats change by the difference
between the class bonus and `unit.shardBonus`. Max HP moves current HP by the same delta (HP is clamped to 1..maxHp on decrease).

### Battle effects and events
- Garnet (block): added to the `statuses.barrier` amount at battle start (stacks with other barrier sources); shows as `barrierReduction` on strikes.
- Pearl (regen): healed at the START of `resolveRound()`, before spells. If any unit heals, `result.batches[0]` is
  `{type:'shards', events:[{type:'regen', unitId, amount}]}` (capped at max HP; absent when nothing healed). Unknown batch types are ignored by the current UI.
- Onyx (thorns): in the combat batch, after the strikes, `{type:'thorns', unitId (the thorned unit), targetId (the attacker), amount}` for every
  damaging hit (damage > 0 after ward/barrier) taken from a distance-1 attacker. The matching strike also has `thorns: amount`. Damage is simultaneous;
  a thorns kill produces the normal `death` event. Thorns are not reduced by ward or barrier.

### Abilities are off
`createMatch({abilities})` defaults to `ABILITY_SWITCH.enabled` (false; `setAbilitiesEnabled(true)` from `src/abilities.js` flips the process default).
Off: the `abilities` and `mark` actions fail with `abilities-disabled`, units never hold `selectedAbilities`, nothing costs energy, the AI picks none.
Stance and facing are unchanged; monster/culture passives (`src/passives.js`) still work. The log header records `abilitiesEnabled`; replay passes it on.
Tests that exercise kits call `setAbilitiesEnabled(true)` at the bottom of the file.

### Levels
`equip:'barrier'` level steps and `loadouts.barrier` become a Garnet (Bulwark) tier II shard (block 2) on that class (`grantShard` + `applyShard`, or
unlogged `m.seedShard(...)` for starting loadouts). Ability-only steps are dropped from hints and do nothing while abilities are off.

### AI (`heuristic`)
After recruiting: combine triples, buy shard cards while the dock keeps `shardDockReserve` slots free and Supply stays above `shardKeepSupply`,
combine again, then apply each dock shard (highest tier first) to the most numerous class whose preference list contains it (else any class with a free slot).
Weights in `DEFAULT_PARAMS`: `shards` (true), `shardKeepSupply` (0), `shardDockReserve` (1). Greedy never touches shards.

### Log schema 4
Header `schema: 4`, `abilitiesEnabled`, `shardRules`. Schema 1-3 logs are rejected by `replay()`.

## Current integrated default

The continuous combat merge retains these Shards rules. Skills and spells are archived, not deleted. All faction pools are filtered at match creation so a culture's older spell entries cannot leak into normal hands; spell actions are also rejected while disabled. The engine records `abilitiesEnabled`, `spellsEnabled`, `combat` and `shardSubset` for deterministic replay. Archived skills/spells can be restored independently through documented flags in ARCHIVED_COMBAT.md. Unit identity passives and monster kits remain active; Shards replaces the selectable active-skill/spell systems.
