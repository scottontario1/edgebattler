// Framework-independent public surface for later game clients (including Phaser).
// Rendering and input code should adapt to these plain data and rule APIs rather than import legacy modules.
export { createContent, createContentForFactions } from './setup/content.js';
export { createBoard } from './rules/board.js';
export { MOVE_COST, computeRange, moveCostsFor, occupancyFromRecords } from './rules/movement.js';
export { forecast, forecastAttackFor } from './rules/forecast.js';
export { STATUS_EFFECT_KEYS, evaluatePassives, hasRevenant, objectsNear, passiveHolds } from './rules/passives.js';
export { MAPS, RIVER_FORD, CAMPAIGN_MAPS } from './content/maps/index.js';
export { TERRAIN } from './content/terrain.js';
export * from './economy/index.js';

// Portable battle resolution and fixed-step simulation.
export { BATTLE_TUNING, resolveBattleRound } from './battle/round.js';
export { FLANK_DAMAGE, resolveStrikes } from './battle/strikes.js';
export { resolveMovement, selectAttackTarget, legalMovesFor } from './battle/targeting.js';
export { TIMED_COMBAT_DEFAULTS, attackInterval, timedCombatConfig, resolveTimedBattle } from './battle/timed.js';

// Framework-independent commanders plan ordinary actions against match snapshots.
export { COMMANDERS, passiveCommander, greedyCommander, heuristicCommander, planCommander, runCommander } from './ai/commanders.js';
