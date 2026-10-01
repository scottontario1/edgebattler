# Portable game core

This directory owns game data and deterministic grid rules. It has no Phaser, DOM, Three.js, browser, or audio imports. Client code can import the stable surface from `src/core/index.js`; `legacy/` is retained as reference during migration.

## Start from data

```js
import {
  CAMPAIGN_MAPS,
  computeRange,
  createBoard,
  createContentForFactions,
  evaluatePassives,
  forecast,
  occupancyFromRecords,
} from './src/core/index.js';

const content = createContentForFactions(['crown', 'fang']);
const board = createBoard(CAMPAIGN_MAPS[0]);
const pike = content.createRecruitUnit('crownPike', 'blue-pike-1', 'blue', 5, 16);
const raider = content.createMonsterUnit('monsterHyenaGoblin', 'raider-1', 'red', 5, 12);
const occupancy = occupancyFromRecords([pike, raider]);
const range = computeRange(pike, board, occupancy, { content });
const attackFrom = range.targets.get(raider.id);
const preview = attackFrom ? forecast(pike, raider, attackFrom, { board, content }) : null;
const passiveStatuses = evaluatePassives([pike, raider], { moved: new Set() });
```

Content is built per session with `createContent` or `createContentForFactions`; no rule depends on an active-map or active-faction global. A unit is a mutable plain record (`id`, `cls`, `faction`, `c`, `r`, `hp`, `maxHp`, combat stats, `weapon`, and optional passives). Constructors clone nested unit data so a match may mutate records without changing its source definitions. Boards validate authored row widths and terrain keys. Movement and attack range use cardinal steps and Manhattan weapon distance. A terrain letter missing from a movement profile is impassable; units may pass through allies unless `blockAllies` is enabled, but cannot end a move on an occupied tile. Living blocking objects stop movement, while corpses and other non-blocking objects remain passable.

## Scope boundary

Implemented here: faction and class catalogues, map and terrain data, unit constructors, movement/range/path lookup, legacy combat forecasts, data-driven passive evaluation, simultaneous battle resolution, a fixed-step timed combat simulator, and state-in/state-out helpers for draws, Supply, recruitment, cycling, Shards and unit upgrades. AI decisions, schema-4 save/replay orchestration, and Phaser app integration are separate systems. The replay adapter is at `src/core/log/adapter.js`; it rebuilds canonical skirmish/campaign matches from headers, while custom maps and experiment-only setup still need explicit adapters. Ability and spell records are retained as inert catalogue data; mission progression and skill activation are not implemented yet.

The current movement profiles cover foot, armor, and mounted classes. Custom terrain and board dimensions are supported through board data; authoring tools and procedural map generation are not part of this core slice. Future rule modules should take a board, content context, and plain snapshots as arguments, and should return values/events rather than mutate shared definitions.

## Battle API

resolveBattleRound({ units, seed, orders, forecastAttack, legalMoves, pathForMove, beforeCombat, canAttack, preserveStatuses, damageScale }) copies the records, resolves movement contention, runs the optional beforeCombat hook on the post-move snapshot, then resolves all strikes together. It returns updated plain records and movement/combat event batches. forecastAttack has the shape returned by forecastAttackFor({ board, content }); legalMoves(unit, snapshot) returns legal {c,r} destinations. legalMovesFor adapts the shared movement rules and occupancy helper.

resolveTimedBattle({ units, seed, orders, forecastAttack, legalMoves, pathForMove, passives, skillWindow, config }) runs those battle ticks on a fixed 0.25 second clock. If legalMoves is omitted, provide board and content and the simulator will use core pathfinding, a one-tile step, and the selected stance's movement allowance. orders may be a per-unit object or a callback evaluated against each current snapshot. passives(records, movedIds) returns a map from unit ID to temporary status effects. Results include final copied records, time-stamped event batches, and the actual duration. The optional skillWindow is only an integration hook; active skills/spells are not ported in this slice.

Both APIs preserve the legacy mulberry-style battle RNG, per-tick seed derivation, stable target ordering, shared-snapshot occupancy, finite Brace/Barrier absorption, simultaneous Thorns, and strike/move/death event shapes. The simulator does not implement match transitions, kills/rewards, object lifecycle, skill activation, or campaign wave progression. It expects the match adapter to provide its legal move policy and any stateful passive context. Custom skill times must lie on the 0.25 second grid; unlike legacy, invalid off-grid times are rejected rather than silently missed.


## AI commanders

planCommander(name, snapshot, faction, { context, params }) returns ordered match actions without applying them. Context may provide immutable content and board values, plus deploymentTiles(faction) and canDeploy(faction, reserveId, c, r) queries. The greedy commander prioritizes cavalry, archers and infantry. The heuristic recruits toward a configurable category mix, deploys reserves toward the nearest enemy, and sets advance/hold/protect stances. Skill selection, spells, shard management and campaign enemy scripting are outside this slice.

runCommander(match, faction, name, options) is the adapter for live play. It calls getState(), plans one action, applies it as ai:<name>, then replans from the new snapshot. This matters because the match controller assigns reserve IDs during recruitment. If an action is rejected, the runner stops rather than retrying a possibly invalid plan. Policies have stable tie-breaks and no random choices, keeping plans reproducible; card draws continue to use the match's explicit seeded RNG.
