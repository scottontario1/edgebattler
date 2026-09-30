// Three authored playtest missions. Player faction changes the army and recruitment pool;
// Blue remains the human team so every army marches from south (high rows) to north.
import { CAMPAIGN_MAPS } from './maps/campaign.js';
import { setMap } from './board.js';
import { prepareFactions, armyRoster, FACTION_BY_ID, championFor } from './setup.js';
import { culturePool } from './cultures.js';
import { createMatch, setExperimentRules } from './match.js';
import { createRecruitUnit } from './roster.js';
import { disableCandidates } from '../experiments/candidates/index.mjs';

export const CAMPAIGN_LEVELS = [
  { id: 'road', number: 1, title: 'The North Road', teaches: 'Screen your ranged units, clear a patrol, and rally before advancing.',
    groups: [[['pikeman']], [['pikeman', 'archer']], [['pikeman', 'archer']]] },
  { id: 'woods', number: 2, title: 'The Wooded Approach', teaches: 'Use cover and protect your flanks. A second wave follows the first at each position.',
    groups: [[['pikeman', 'archer'], ['cavalier']], [['pikeman', 'archer'], ['archer']], [['pikeman', 'cavalier'], ['archer']]] },
  { id: 'pass', number: 3, title: 'The Northern Pass', teaches: 'Choose a route through the pass and preserve your formation through mixed waves.',
    groups: [[['pikeman', 'archer'], ['cavalier', 'archer']], [['pikeman', 'cavalier'], ['pikeman', 'archer']], [['pikeman', 'archer', 'cavalier'], ['cavalier', 'archer']]] },
];
export const CAMPAIGN_BY_ID = Object.fromEntries(CAMPAIGN_LEVELS.map((l) => [l.id, l]));
export const campaignURL = (id, faction, seed) => `?${new URLSearchParams({ campaign: id, you: faction, seed: String(seed) })}`;

export function createCampaignMatch(level, { faction = 'classic', seed = 0x415348, log = null, meta = {} } = {}) {
  if (!level || !FACTION_BY_ID[faction]) throw new Error('Unknown campaign or faction');
  disableCandidates();
  setExperimentRules();
  prepareFactions([faction]);
  setMap(CAMPAIGN_MAPS[level.number - 1]);
  const slots = [[5,16],[4,15],[6,15],[5,15],[6,16]];
  const roster = armyRoster(faction, 'blue').map((u,i) => ({ ...u, c: slots[i][0], r: slots[i][1], facing: 'north', stance: 'advance',
    objective: { type: 'tile', c: 5, r: 11 } }));
  const stages = level.groups.map((waves, stage) => ({
    name: ['South patrol', 'Middle line', 'North guard'][stage], checkpoint: [5, [11,6,1][stage]],
    waves: waves.map((classes, wave) => classes.map((cls,i) => {
      const u = createRecruitUnit(cls, `enc-${stage}-${wave}-${i}`, 'red', [5,6,4][i], [12,7,2][stage] - (cls === 'archer' ? 1 : 0));
      return { ...u, facing: 'south', stance: 'hold' };
    })),
  }));
  const culture = FACTION_BY_ID[faction].culture;
  return createMatch({ seed, maxRounds: 90, log, roster,
    champions: { blue: championFor(faction,'blue'), red: null },
    pools: culture ? { blue: culturePool(culture) } : null,
    campaign: { id: level.id, faction, exit: [5,1], stages },
    meta: { ...meta, source: 'campaign', campaignLevel: level.id, playerFaction: faction },
  });
}
