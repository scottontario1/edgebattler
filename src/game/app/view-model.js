import { FACTIONS } from '../../core/content/factions/index.js';
import { CAMPAIGN_LEVELS } from '../../core/content/missions.js';
import { portraitFromManifest } from '../hud/portraits.js';
import { portraitSVG } from '../hud/portrait-svg.js';

const factionCards = FACTIONS.map(({ id, name, tagline, traits, color, accent }) =>
  ({ id, name, tagline, traits, color, accent }));
const missions = CAMPAIGN_LEVELS.map(({ id, number, title, teaches, groups }) =>
  ({ id, number, title, teaches, waves: groups.length }));
const typeOf = (unit) => unit.cls ?? unit.classId ?? unit.unitId ?? 'unit';
const displayName = (value) => String(value ?? 'Unit').replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

function portrait(unit, manifests) {
  const key = unit.spriteKey ?? unit.variantId ?? unit.unitId ?? typeOf(unit);
  return portraitFromManifest(key, { units: manifests?.factions }) ?? { kind: 'svg', svg: portraitSVG(unit) };
}

export function createMenuViewModel(error = '') {
  return {
    screen: 'menu',
    menu: {
      title: 'Chronicle of Ashvale',
      subtitle: 'Choose a faction, then lead your army north.',
      factions: factionCards,
      missions,
      ais: [{ id: 'greedy', label: 'Greedy' }, { id: 'heuristic', label: 'Heuristic' }, { id: 'passive', label: 'Passive' }],
      mirrorAllowed: ['classic'],
      defaults: { mode: 'campaign', you: 'crown', foe: 'fang', ai: 'heuristic' },
      ...(error ? { error } : {}),
    },
  };
}

function summaryReport(match, state) {
  const sides = {};
  for (const faction of ['blue', 'red']) {
    const rows = state.units.filter((unit) => unit.faction === faction).map((unit) => {
      const stats = match.unitStats?.(unit.id) ?? {};
      return {
        name: unit.name ?? displayName(typeOf(unit)),
        status: unit.hp <= 0 ? 'Fallen' : `Tile ${unit.c}, ${unit.r}`,
        dealt: stats.damageDealt ?? 0,
        taken: stats.damageTaken ?? 0,
      };
    });
    const leader = (field) => rows.slice().sort((a, b) => b[field] - a[field])[0];
    const dealt = leader('dealt');
    const taken = leader('taken');
    sides[faction] = {
      leaders: [
        { label: 'Most damage dealt', name: dealt?.name ?? '', value: dealt?.dealt ?? 0 },
        { label: 'Most damage taken', name: taken?.name ?? '', value: taken?.taken ?? 0 },
      ],
      rows,
    };
  }
  return { title: 'Battle statistics', sides };
}

export function buildGameViewModel(match, ui = {}) {
  const state = match.getState();
  const { content } = match.context;
  const cards = state.sides.blue.cards;
  const reserves = cards.reserves ?? [];
  const units = state.units;
  const groups = new Map();

  for (const unit of [...units.filter((u) => u.faction === 'blue' && u.hp > 0), ...reserves]) {
    const type = typeOf(unit);
    if (!groups.has(type)) groups.set(type, {
      type, name: unit.name ?? displayName(type), portrait: portrait(unit, ui.manifests),
      field: 0, bench: 0, stars: unit.stars ?? 1, hp: 0, maxHp: 0,
      selected: type === ui.selectedType, shards: [], shardSlots: 3, combine: null,
    });
    const group = groups.get(type);
    group[unit.state === 'reserve' || unit.c == null ? 'bench' : 'field'] += 1;
    group.hp += Math.max(0, unit.hp ?? 0);
    group.maxHp += unit.maxHp ?? 0;
  }

  const hand = (cards.hand ?? []).map((card) => {
    const unit = Boolean(card.unitId);
    const shard = Boolean(card.shardId);
    const def = content.cardFor(card.unitId ?? card.shardId) ?? content.unitCardFor(card.unitId) ?? {};
    const cost = card.cost ?? def.cost ?? 1;
    return {
      id: card.instanceId ?? card.id, kind: shard ? 'shard' : 'unit',
      name: card.name ?? def.name ?? displayName(card.unitId ?? card.shardId),
      cost, rarity: card.rarity ?? def.rarity ?? 'common', affordable: cards.supply >= cost,
      selected: (card.instanceId ?? card.id) === ui.selectedCard,
      ...(unit ? { portrait: portrait({ ...def, ...card, cls: card.unitId }, ui.manifests),
        stars: card.stars ?? 1, classLabel: def.class ?? 'Foot', range: def.range ?? 1 } : {}),
      ...(shard ? { shardId: card.shardId, tier: card.tier ?? 1, effect: card.effect ?? def.effect,
        color: content.shards[card.shardId]?.color ?? '#c9a24a' } : {}),
    };
  });

  const selectedCard = (cards.hand ?? []).find((card) =>
    (card.instanceId ?? card.id) === ui.selectedCard);
  const selectedReserve = reserves.find((unit) => unit.id === ui.selectedReserve);
  let detail = null;
  if (selectedCard) {
    const def = content.cardFor(selectedCard.unitId ?? selectedCard.shardId) ?? {};
    detail = {
      kind: selectedCard.shardId ? 'shard' : 'unit',
      title: selectedCard.name ?? displayName(selectedCard.unitId ?? selectedCard.shardId),
      text: def.effect ?? 'Army card',
      actions: [{ intent: selectedCard.shardId ? 'buyShard' : 'recruit',
        label: selectedCard.shardId ? 'Buy shard' : 'Recruit',
        enabled: cards.supply >= (selectedCard.cost ?? def.cost ?? 1), primary: true,
        cardId: selectedCard.instanceId ?? selectedCard.id }],
    };
  } else if (selectedReserve) {
    detail = { kind: 'reserve', title: selectedReserve.name ?? displayName(selectedReserve.unitId),
      text: 'Select a territory tile to deploy.',
      actions: [{ intent: 'deploy', label: 'Deploy on map', enabled: true,
        primary: true, unitId: selectedReserve.id }] };
  }

  const campaign = state.campaign;
  const stage = campaign?.stages[campaign.stage];
  const battle = state.phase === 'battle' || ui.playback === true;
  const over = state.over;
  const report = summaryReport(match, state);
  const outcome = state.winner === 'blue' ? 'victory' : state.winner === 'red' ? 'defeat' : 'draw';
  const sideStats = match.stats?.()?.blue ?? {};
  const end = over ? {
    outcome, title: outcome === 'victory' ? 'Victory' : outcome === 'defeat' ? 'Defeat' : 'Draw',
    reason: String(state.reason ?? 'Battle ended').replaceAll('-', ' '), round: state.round,
    summary: [{ label: 'Units lost', value: Object.values(sideStats.lost ?? {}).reduce((a, b) => a + b, 0) }],
    report,
    actions: [
      ...(campaign && state.winner === 'blue' && campaign.id !== 'pass'
        ? [{ intent: 'nextMission', mission: campaign.id === 'road' ? 'woods' : 'pass', label: 'Next mission', primary: true }] : []),
      { intent: 'restart', label: 'Play again' }, { intent: 'openMenu', label: 'Main menu' },
    ],
  } : null;

  const vm = {
    screen: 'game',
    top: {
      title: campaign ? content.campaignById[campaign.id]?.title ?? campaign.id : 'Skirmish: River Ford',
      objective: campaign ? 'Advance north, clear encounters, rally at villages.' : 'Defeat the opposing army.',
      round: state.round, maxRound: state.maxRounds,
      phase: { id: over ? outcome : battle ? 'battle' : 'planning', label: over ? outcome : battle ? 'Battle' : 'Planning' },
      supply: { current: cards.supply, bank: content.cardLimits.maxSupply, income: content.cardLimits.supplyPerRound },
      population: { current: cards.population ?? 0, cap: content.cardLimits.populationCap },
      bench: { current: reserves.length, cap: content.cardLimits.reserveCapacity },
      cycle: { remaining: cards.cyclesRemaining ?? 0, max: content.cardLimits.cyclesPerRound },
      canOpenMenu: true,
    },
    army: { locked: battle || over, canShowStats: true, groups: [...groups.values()] },
    tray: {
      prompt: 'Recruit and deploy, set stances, then start combat.', locked: battle || over, hand,
      handLimit: content.cardLimits.hand,
      cycle: { remaining: cards.cyclesRemaining ?? 0, max: content.cardLimits.cyclesPerRound },
      bench: reserves.map((unit) => ({
        id: unit.id, name: unit.name ?? displayName(unit.unitId), portrait: portrait(unit, ui.manifests),
        stars: unit.stars ?? 1, hp: unit.hp ?? 0, maxHp: unit.maxHp ?? 0, selected: unit.id === ui.selectedReserve,
      })),
      benchCap: content.cardLimits.reserveCapacity, detail,
      shards: { slots: content.shardRules.dockSlots, items: [], combos: [], apply: null },
    },
    resolve: { state: over ? 'over' : battle ? 'playback' : 'planning',
      label: 'Start combat', enabled: !battle && !over },
  };

  if (campaign) {
    vm.campaign = {
      mission: content.campaignById[campaign.id]?.title ?? campaign.id,
      stages: campaign.stages.map((item, i) => ({
        name: item.name, state: i < campaign.stage ? 'done' : i === campaign.stage ? 'current' : 'pending',
        waves: item.waves.length,
      })),
      phase: campaign.phase, phaseLabel: campaign.phase === 'regroup' ? 'Regroup at village' : 'Wave ' + (campaign.wave + 1),
      checkpoint: stage?.checkpoint ? { c: stage.checkpoint[0], r: stage.checkpoint[1] } : undefined,
      wave: campaign.wave + 1, waves: stage?.waves.length ?? 1,
      enemies: units.filter((unit) => unit.faction === 'red' && unit.hp > 0).length,
      orders: campaign.phase === 'regroup'
        ? [{ intent: 'campaignRally', label: campaign.rallied ? 'Rallied' : 'Rally', icon: 'rally', enabled: !campaign.rallied },
          { intent: 'campaignContinue', label: 'Continue north', icon: 'continue', primary: true, enabled: true }]
        : [{ intent: 'campaignOrder', label: 'March north', icon: 'march', enabled: true }],
    };
  }
  if (ui.selection?.unitId) {
    const unit = units.find((item) => item.id === ui.selection.unitId);
    if (unit) {
      const stats = match.unitStats?.(unit.id) ?? {};
      vm.inspect = {
        unitId: unit.id, portrait: portrait(unit, ui.manifests),
        name: unit.name ?? displayName(typeOf(unit)), side: unit.faction,
        title: (unit.title ?? displayName(typeOf(unit))) + ' - Lv ' + (unit.lv ?? 1),
        hp: unit.hp, maxHp: unit.maxHp, stars: unit.stars ?? 1,
        stats: ['str', 'mag', 'skl', 'spd', 'def', 'res', 'mov'].map((key) =>
          ({ label: key.toUpperCase(), value: unit[key] ?? 0 })),
        weapon: { name: unit.weapon ?? 'Basic attack', detail: '' },
        rows: [{ label: 'Combat', chips: [
          { text: (stats.damageDealt ?? 0) + ' dealt', tone: 'good' },
          { text: (stats.damageTaken ?? 0) + ' taken', tone: 'bad' },
          { text: (stats.attacks ?? 0) + ' attacks', tone: 'info' },
        ] }],
      };
    }
  }
  if (ui.showStats) vm.report = report;
  if (end) vm.end = end;
  return vm;
}
