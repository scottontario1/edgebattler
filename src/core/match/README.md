# Match controller

createMatch({ content, board, roster, seed, maxRounds, combat, champions, pools, campaign, meta, log }) creates one isolated match. Campaign and skirmish entry points live in src/core/setup/match.js:

- createSkirmish({ blue, red, seed, maxRounds, combat, meta, log })
- createCampaign({ level, faction, seed, combat, meta, log, enemyFactions, encounters }) (also exported as createCampaignMatch)

Current campaign/skirmish factories remove archived spell and skill entries from the normal recruitment draw pool; they remain in the content catalogue. The Shards economy offers shards through its own offer path.

The returned object is { context, getState, apply, resolveRound, summary, stats, unitStats, deploymentTiles, canDeploy, alive, byId, objectsNear, addObject, consumeObject }. getState() returns a detached snapshot with round, phase, over, winner, reason, units, territory, sides, objects, meta, rewards, and optional campaign. context contains immutable content and board plus normalized combat settings. Queries return copies; the match retains ownership of every mutable record.

Actions are plain objects and include a faction field:

- { type:'recruit', faction, cardId }
- { type:'cycle', faction, source:'hand'|'bench', id }
- { type:'deploy', faction, reserveId, c, r } and { type:'withdraw', faction, unitId }
- { type:'move', faction, unitId, c, r }
- { type:'stance', faction, unitId, stance, targetId?, tile? }
- { type:'campaignOrder'|'campaignRally'|'campaignContinue', faction }
- Shard and upgrade actions: buyShard(cardId), grantShard(shardId,tier?), applyShard(shardInstanceId,unitType), removeShard(unitType,index), combineShards(shardId,tier), combine(ids,survivorId,destination,tile?)

Actions return { ok:true, ...result } or { ok:false, reason }. Action logs use schema-4 t:'action' entries. The actor label is optional and defaults to human.

resolveRound() accepts only the planning phase, resolves a complete discrete exchange when combat:null or the normal fixed-step 18-second battle otherwise, then processes deaths, revenants, spawned/decaying objects, village capture, campaign wave/checkpoint/exit state, draws and Supply, reserve healing and champion respawn. It returns { batches, notes, over }; the app plays batches and reads final state after playback. Campaign snapshot fields are id,faction,enemyFactions,exit,stages,stage,wave,phase,rallied; phases are engage, regroup and exit. Current campaign reward data is an empty hook because reward economy remains undecided.

## Parity boundary and known gaps

The controller composes core battle and economy helpers and retains legacy action/event names for implemented actions. It is not yet a golden-replay parity implementation. Active abilities/spells and their queues/energy windows are not ported; AI and log/replay transports are separate slices. Discrete mode currently uses shared-snapshot strikes rather than the legacy counter/follow-up duel. Several legacy experiment-only actions (muster, skill slots, equip/transfer, spells) intentionally have no handler. Kill/loss counters are recorded, but kills do not award Supply/cards because campaign rewards are still a design decision. Statistics track combat strike events and remain lifetime-scoped. createMatch defaults to timed combat; factories use the same default unless combat:null is passed.
