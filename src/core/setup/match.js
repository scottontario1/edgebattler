// Match setup factories. They assemble immutable map/content contexts and delegate all mutable state
// to the match controller. Creating another match never changes a process-wide registry.
import { createContentForFactions } from './content.js';
import { createBoard } from '../rules/board.js';
import { RIVER_FORD, CAMPAIGN_MAPS } from '../content/maps/index.js';
import { createMatch } from '../match/controller.js';

function requireFaction(content, id) {
  const faction = content.factions[id];
  if (!faction) throw new Error(`Unknown faction: ${id}`);
  return faction;
}

/** Create a seeded two-faction match on River Ford. Same-faction culture mirrors remain unsupported. */
export function createSkirmish({ blue = 'classic', red = 'classic', seed = 0x415348,
  maxRounds = 30, combat, meta = {}, log = null } = {}) {
  const content = createContentForFactions([blue, red]);
  const blueData = requireFaction(content, blue), redData = requireFaction(content, red);
  if (blue === red && blue !== 'classic') throw new Error('both sides cannot use the same faction yet (mirror matches need a second champion)');
  const roster = [...content.armyRoster(blue, 'blue'), ...content.armyRoster(red, 'red')];
  const pools = {};
  if (blueData.culture) pools.blue = content.poolFor(blueData.culture);
  if (redData.culture) pools.red = content.poolFor(redData.culture);
  return createMatch({
    content, board: createBoard(RIVER_FORD), roster, seed, maxRounds, combat,
    champions: { blue: content.championFor(blue, 'blue'), red: content.championFor(red, 'red') },
    pools, meta: { ...meta, blueFaction: blue, redFaction: red }, log,
  });
}

/** Create a fixed-wave south-to-north campaign. Red receives encounter waves and cannot recruit. */
export function createCampaign({ level = 'road', faction = 'classic', seed = 0x415348,
  combat, meta = {}, log = null, enemyFactions = null, encounters = null } = {}) {
  const content = createContentForFactions([faction]);
  const player = requireFaction(content, faction);
  const mission = typeof level === 'string' ? content.campaignById[level] : level;
  if (!mission) throw new Error(`Unknown campaign level: ${level}`);
  const foes = enemyFactions || content.campaignEnemyFactions(mission, faction, seed);
  if (foes.length !== 3 || new Set(foes).size !== 3 || foes.some((id) => !content.factions[id] || id === faction || id === 'classic')) {
    throw new Error('Campaign enemies must be three distinct other cultures');
  }
  const enemyContent = createContentForFactions([faction, ...foes]);
  const setup = enemyContent.campaignSetup;
  const roster = enemyContent.armyRoster(faction, 'blue').map((unit, index) => ({
    ...unit, c: setup.playerSlots[index][0], r: setup.playerSlots[index][1], facing: 'north',
    stance: 'advance', objective: { ...setup.playerObjective },
  }));
  const stages = encounters || mission.groups.map((waves, stageIndex) => ({
    name: setup.stageNames[stageIndex],
    enemyFaction: foes[stageIndex],
    checkpoint: [...setup.checkpoints[stageIndex]],
    waves: waves.map((classes, waveIndex) => classes.map((classKey, index) => {
      const enemy = enemyContent.factions[foes[stageIndex]];
      const unitKey = classKey === 'hound' ? (enemy.culture === 'court' ? 'corpsehound' : 'monsterWerewolf') : classKey;
      const id = `enc-${stageIndex}-${waveIndex}-${index}`;
      const c = setup.enemyColumns[index] ?? setup.enemyColumns[setup.enemyColumns.length - 1];
      const r = setup.enemyRows[stageIndex] - (classKey === 'archer' ? 1 : 0);
      const unit = unitKey.startsWith('monster') || unitKey === 'corpsehound'
        ? enemyContent.createMonsterUnit(unitKey, id, 'red', c, r)
        : enemyContent.createRecruitUnit(enemy.core?.[unitKey] || unitKey, id, 'red', c, r);
      if (!unit.monster) unit.enemyFaction = enemy.id;
      return { ...unit, facing: 'south', stance: 'hold' };
    })),
  }));
  return createMatch({
    content: enemyContent, board: createBoard(CAMPAIGN_MAPS[mission.number - 1]), roster,
    seed, maxRounds: setup.maxRounds, combat,
    champions: { blue: enemyContent.championFor(faction, 'blue'), red: null },
    pools: player.culture ? { blue: enemyContent.poolFor(player.culture) } : {},
    campaign: { id: mission.id, faction, enemyFactions: [...foes], exit: [...setup.exit], stages },
    meta: { ...meta, source: 'campaign', campaignLevel: mission.id, playerFaction: faction }, log,
  });
}

export const createCampaignMatch = createCampaign;
