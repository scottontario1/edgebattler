// Portable economy surface. Every operation receives match-owned state and explicit content.
export {
  canAfford,
  canDeployReserve,
  createEconomyState,
  cycleCard,
  dealShardOffers,
  drawCards,
  drawOpeningHand,
  previewCycle,
  projectPopulation,
  recruitUnit,
  refreshRound,
} from './cards.js';
export {
  applyShard,
  buyShard,
  combineDockShards,
  combineShards,
  findShardCombos,
  grantShard,
  pickShardSubset,
  removeShard,
  shardBonus,
} from './shards.js';
export { combineUnits, findUpgradeMatches, previewUpgrade } from './upgrades.js';
