# Portable economy contracts

All functions in this directory are framework-independent and return new state values. They never read
module-level match settings. Pass the immutable `content` context created by `createContent()` (or
`createContentForFactions()`) and the match-owned RNG function wherever randomness is needed. Do not
share one RNG stream between sides unless the match rules intentionally do so.

`createEconomyState(content, options)` returns the serializable side economy record:

```js
{
  pool: ['crownPike', 'battleCleric'], // optional weighted key list
  shardPool: ['ruby', 'pearl'],       // optional allowed shard key list
  round: 1,
  cyclesRemaining: 1,
  supply: 3,
  hand: [],
  reserves: [],
  population: 0,
  cardSequence: 0,
  shardDock: [],
  shards: {},                       // class key -> [{ shardId, tier }]
  shardSeq: 0
}
```

Omit optional keys to use shared content pool/limits. Card draws return `{ state, drawn, requested,
blocked, handFull }`; opening/round draws also return `shardOffers`, while round refresh reports
`supplyGranted`. Draws retain the legacy card instance IDs (`card-N-pool-index`, `card-N-shard`,
`card-N-cycle`) and pool order. Rarity gates filter the normal draw pool when at least one card is open;
cycle pools intentionally ignore the gate, matching legacy. Shard offers are additional to the normal
hand limit and unsold offers are replaced at refresh.

Recruitment and shard purchases return `{ ok, reason?, state, ... }`; failure state is the original input
reference and success state is a cloned value. `recruitUnit(state, cardId, content, { faction })` creates
a paid reserve record. Population/reserve limits are content-owned defaults with per-call overrides.
Deployment takes caller-supplied controlled-location and tile facts, so no board module is imported.
Cycle preview/apply uses `{ source: 'hand'|'bench', id }`; a bench cycle refunds the original paid cost,
removes that reserve and frees its population. It preserves the legacy quirk that hand-full checks count
Shard offers even though those offers bypass the normal hand cap.

Shard helpers cover offers, dock buys/grants, class apply/remove, bonuses and three-of-a-kind merges.
`applyShard` accepts an optional `validUnitTypes` array; the match must pass currently owned class keys
to match the old controller's ownership validation. Unit stat propagation and battle effects (Garnet,
Pearl, Onyx) remain match/battle responsibilities. `combineDockShards` returns the legacy action fields
including the consumed dock IDs. `pickShardSubset(seed, count, content)` reproduces the legacy seeded
subset algorithm and catalogue ordering.

Unit upgrades use the legacy record fields and formulas. `findUpgradeMatches(records, content)` groups by
class/variant/faction/rarity/stars. `previewUpgrade(records, ids, content, { survivorId, destination })` requires
exactly three eligible matching unit records, a chosen survivor and `field` or `reserve` destination;
it preserves survivor orders/location, accumulates `costPaid`, adds the focused star growth, scales HP
by combined current/maximum HP ratio, keeps the minimum energy and maximum cooldown, merges statuses,
and sets population to the new star tier. `combineUnits(records, ids, content, choices)` returns a new complete record array. The context is used to exclude registered champions by identity. Population
cap enforcement, replacing match field/reserve arrays, shard resynchronization, statistics and event/log
creation belong to the match controller.

Parity risks/gaps carried forward deliberately:

- The existing hand-full bench-cycle test is affected by extra Shard offers (the helper preserves it).
- Legacy cycle pools are not filtered by rarity-gate round, so a cycle can return a currently gated card.
- The shared pool/culture card keys and repeated weights must remain in their original order for seed parity.
- The legacy match fixes shard IDs as `shard-N`, card IDs as `card-N-*`, and reserve IDs as
  `reserve-card-N-*`; callers must keep per-side sequences isolated.
- Upgrades intentionally permit different prior paid costs for otherwise identical variants and keep the
  chosen survivor's identity. Fields/reserves, shard stat bookkeeping and result events are outside this
  pure helper.
