// Three authored playtest missions. Player faction changes the army and recruitment pool;
// Blue remains the human team so every army marches from south (high rows) to north.
import { CAMPAIGN_MAPS } from './maps/campaign.js';
import { setMap } from './board.js';
import { prepareFactions, armyRoster, FACTION_BY_ID, championFor } from './setup.js';
import { culturePool } from './cultures.js';
import { createMatch, setExperimentRules } from './match.js';
import { createRecruitUnit } from './roster.js';
import { createMonsterUnit } from './monsters.js';
import { disableCandidates } from '../experiments/candidates/index.mjs';

export const CAMPAIGN_LEVELS = [
  { id: 'road', number: 1, title: 'The North Road', teaches: 'Screen your ranged units, clear a patrol, and rally before advancing.',
    groups: [[['monsterRat','pikeman']], [['monsterSpider','archer']], [['monsterHyenaGoblin','pikeman']]] },
  { id: 'woods', number: 2, title: 'The Wooded Approach', teaches: 'Use cover and protect your flanks. A second wave follows the first at each position.',
    groups: [[['monsterSpider','pikeman'], ['monsterWerewolf']], [['monsterHyenaGoblin','archer'], ['hound']], [['monsterBogGolem','archer'], ['cavalier']]] },
  { id: 'pass', number: 3, title: 'The Northern Pass', teaches: 'Choose a route through the pass and preserve your formation through mixed waves.',
    groups: [[['monsterOgre','archer'], ['monsterRat','pikeman']], [['monsterBogGolem','pikeman'], ['monsterSpider','archer']], [['monsterMothBear','archer'], ['monsterWerewolf','cavalier']]] },
];
export const CAMPAIGN_BY_ID = Object.fromEntries(CAMPAIGN_LEVELS.map((l) => [l.id, l]));
export const campaignURL = (id, faction, seed) => `?${new URLSearchParams({ campaign: id, you: faction, seed: String(seed) })}`;

// Foe selection is independent of card/battle RNG. Each position uses a different
// foreign faction; native art does not turn an enemy into the player's culture.
export function campaignEnemyFactions(level, faction, seed) {
  const choices = Object.keys(FACTION_BY_ID).filter(id => id !== faction && id !== 'classic');
  const offset = ((Number(seed) >>> 0) + level.number - 1) % choices.length;
  return [0,1,2].map(stage => choices[(offset+stage)%choices.length]);
}

export function createCampaignMatch(level, { faction = 'classic', seed = 0x415348, log = null, meta = {}, enemyFactions = null, encounters = null, combat = null, abilities } = {}) {
  if (!level || !FACTION_BY_ID[faction]) throw new Error('Unknown campaign or faction');
  disableCandidates();
  setExperimentRules();
  const foes = enemyFactions || campaignEnemyFactions(level,faction,seed);
  if (foes.length !== 3 || new Set(foes).size !== 3 || foes.some(id => !FACTION_BY_ID[id] || id === faction)) throw new Error('Campaign enemies must use other factions');
  prepareFactions([faction,...foes]);
  setMap(CAMPAIGN_MAPS[level.number - 1]);
  const slots = [[5,16],[4,15],[6,15],[5,15],[6,16]];
  const roster = armyRoster(faction, 'blue').map((u,i) => ({ ...u, c: slots[i][0], r: slots[i][1], facing: 'north', stance: 'advance',
    objective: { type: 'tile', c: 5, r: 11 } }));
  const stages = encounters || level.groups.map((waves, stage) => ({
    name: ['South patrol', 'Middle line', 'North guard'][stage], enemyFaction: foes[stage], checkpoint: [5, [11,6,1][stage]],
    waves: waves.map((classes, wave) => classes.map((cls,i) => {
      const enemy = FACTION_BY_ID[foes[stage]];
      const key = cls === 'hound' ? (enemy.id === 'court' ? 'corpsehound' : 'monsterWerewolf') : cls;
      const id = `enc-${stage}-${wave}-${i}`;
      const c = [5,6,4][i], r = [12,7,2][stage] - (cls === 'archer' ? 1 : 0);
      const u = key.startsWith('monster') || key === 'corpsehound' ? createMonsterUnit(key,id,'red',c,r)
        : createRecruitUnit(enemy.core?.[key] || key,id,'red',c,r);
      if (!u.monster) u.enemyFaction = enemy.id;
      return { ...u, facing: 'south', stance: 'hold' };
    })),
  }));
  const culture = FACTION_BY_ID[faction].culture;
  return createMatch({ seed, maxRounds: 90, log, roster, combat, ...(abilities!==undefined?{abilities}:{}),
    champions: { blue: championFor(faction,'blue'), red: null },
    pools: culture ? { blue: culturePool(culture) } : null,
    campaign: { id: level.id, faction, enemyFactions: foes, exit: [5,1], stages },
    meta: { ...meta, source: 'campaign', campaignLevel: level.id, playerFaction: faction },
  });
}
