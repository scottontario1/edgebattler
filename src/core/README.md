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

Implemented here: faction and class catalogues, map and terrain data, unit constructors, movement/range/path lookup, legacy combat forecasts, and data-driven passive evaluation. The combat forecast is a preview formula; it does not resolve a battle. State-in/state-out economy helpers now cover draws, Supply, recruitment, cycling, Shards and unit upgrades. Active match resolution, continuous combat timing, campaign transitions, AI decisions, save/replay, and Phaser app integration are later systems. Ability and spell records are retained as inert catalogue data. Shards and mission definitions are data only at this stage.

The current movement profiles cover foot, armor, and mounted classes. Custom terrain and board dimensions are supported through board data; authoring tools and procedural map generation are not part of this core slice. Future rule modules should take a board, content context, and plain snapshots as arguments, and should return values/events rather than mutate shared definitions.
