// Campaign mission definitions: three authored playtest missions on south-to-north 12x18 maps. Blue is
// always the human army and marches from the high rows to the north exit. The transitions (spawning,
// regroup, rally, continue, victory) belong to the match controller; this module is data only.
import { deepFreeze } from '../util/geometry.js';

/**
 * @typedef {Object} CampaignLevel
 * @property {string} id
 * @property {number} number     1-based mission number; also the index into CAMPAIGN_MAPS
 * @property {string} title
 * @property {string} teaches
 * @property {string[][][]} groups  per stage, per wave: encounter class keys ('hound' is a faction-aware alias)
 */

/** @type {ReadonlyArray<CampaignLevel>} */
export const CAMPAIGN_LEVELS = deepFreeze([
  {
    id: 'road', number: 1, title: 'The North Road',
    teaches: 'Screen your ranged units, clear a patrol, and rally before advancing.',
    groups: [[['monsterRat', 'pikeman']], [['monsterSpider', 'archer']], [['monsterHyenaGoblin', 'pikeman']]],
  },
  {
    id: 'woods', number: 2, title: 'The Wooded Approach',
    teaches: 'Use cover and protect your flanks. A second wave follows the first at each position.',
    groups: [
      [['monsterSpider', 'pikeman'], ['monsterWerewolf']],
      [['monsterHyenaGoblin', 'archer'], ['hound']],
      [['monsterBogGolem', 'archer'], ['cavalier']],
    ],
  },
  {
    id: 'pass', number: 3, title: 'The Northern Pass',
    teaches: 'Choose a route through the pass and preserve your formation through mixed waves.',
    groups: [
      [['monsterOgre', 'archer'], ['monsterRat', 'pikeman']],
      [['monsterBogGolem', 'pikeman'], ['monsterSpider', 'archer']],
      [['monsterMothBear', 'archer'], ['monsterWerewolf', 'cavalier']],
    ],
  },
]);

export const CAMPAIGN_BY_ID = Object.freeze(Object.fromEntries(CAMPAIGN_LEVELS.map((level) => [level.id, level])));

/** Fixed numbers of the campaign setup (legacy createCampaignMatch). */
export const CAMPAIGN_SETUP = Object.freeze({
  maxRounds: 90,
  exit: Object.freeze([5, 1]),
  /** Blue's five starting tiles, in roster order. */
  playerSlots: Object.freeze([[5, 16], [4, 15], [6, 15], [5, 15], [6, 16]]),
  /** The tile Blue's army is first ordered to march to. */
  playerObjective: Object.freeze({ type: 'tile', c: 5, r: 11 }),
  stageNames: Object.freeze(['South patrol', 'Middle line', 'North guard']),
  /** Checkpoint tile [column, row] of each stage. */
  checkpoints: Object.freeze([[5, 11], [5, 6], [5, 1]]),
  /** Enemy spawn: column by unit index in a wave, row by stage (archers stand one row further north). */
  enemyColumns: Object.freeze([5, 6, 4]),
  enemyRows: Object.freeze([12, 7, 2]),
});

/**
 * The foreign faction each stage fights. Independent of card and battle RNG: each stage uses a
 * different faction other than the player's and never classic.
 * @param {CampaignLevel} level
 * @param {string} faction     the player's faction id
 * @param {number} seed
 * @param {string[]} factionIds  every faction id in menu order (classic included, it is skipped)
 * @returns {string[]} three faction ids
 */
export function campaignEnemyFactions(level, faction, seed, factionIds) {
  const choices = factionIds.filter((id) => id !== faction && id !== 'classic');
  const offset = ((Number(seed) >>> 0) + level.number - 1) % choices.length;
  return [0, 1, 2].map((stage) => choices[(offset + stage) % choices.length]);
}
