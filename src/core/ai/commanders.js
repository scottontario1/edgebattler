// Pure planning policies. A commander reads a detached match snapshot and emits ordinary match
// actions; only the match controller may accept actions or change authoritative state.
const DEFAULTS = Object.freeze({
  mix: Object.freeze({ melee: 0.5, ranged: 0.3, mounted: 0.2, caster: 0.15, support: 0.1 }),
  archerHoldRange: 5, seizeRatio: 1.3, retreatBelow: 0.3,
});
const otherFaction = (faction) => faction === 'blue' ? 'red' : 'blue';
const distance = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
const alive = (unit) => unit && unit.hp > 0 && unit.state !== 'reserve';
const fieldUnits = (state, faction) => (state.units ?? []).filter((unit) => unit.faction === faction && alive(unit));
const sideFor = (state, faction) => state.sides?.[faction] ?? null;
function nearestEnemy(unit, enemies) {
  return enemies.reduce((best, enemy) => Math.min(best, distance(unit, enemy)), Infinity);
}
function deploymentTiles(faction, reserve, context) {
  return (context.deploymentTiles?.(faction) ?? [])
    .filter(([c, r]) => context.canDeploy?.(faction, reserve.id, c, r)?.ok !== false)
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
function nearestFrontTile(faction, reserve, enemies, context) {
  return deploymentTiles(faction, reserve, context).sort((a, b) => {
    const da = nearestEnemy({ c: a[0], r: a[1] }, enemies);
    const db = nearestEnemy({ c: b[0], r: b[1] }, enemies);
    return da - db || a[1] - b[1] || a[0] - b[0];
  })[0] ?? null;
}
function createPlanner(state, faction, context) {
  const side = sideFor(state, faction);
  if (!side?.cards) return null;
  const cards = side.cards;
  const actions = [];
  const enemies = fieldUnits(state, otherFaction(faction));
  let supply = cards.supply ?? 0;
  let population = cards.population ?? 0;
  let hand = [...(cards.hand ?? [])];
  let reserves = [...(cards.reserves ?? [])];
  const emit = (action) => actions.push({ ...action, faction });
  const deploy = (reserve) => {
    if (!reserve) return false;
    const tile = nearestFrontTile(faction, reserve, enemies, context);
    if (!tile) return false;
    emit({ type: 'deploy', reserveId: reserve.id, c: tile[0], r: tile[1] });
    reserves = reserves.filter((unit) => unit.id !== reserve.id);
    return true;
  };
  return {
    actions, side, cards, enemies,
    get supply() { return supply; },
    get population() { return population; },
    get hand() { return hand; },
    get reserves() { return reserves; },
    emit, deploy,
    addRecruit(card, definition) {
      emit({ type: 'recruit', cardId: card.instanceId });
      supply -= card.cost;
      population += definition.population ?? 1;
      hand = hand.filter((candidate) => candidate.instanceId !== card.instanceId);
      const reserve = {
        id: 'reserve-' + card.instanceId, unitId: definition.unitId,
        classId: definition.base ?? definition.unitId, variantId: definition.unitId,
        faction, rarity: card.rarity ?? definition.rarity, stars: card.stars ?? 1,
        state: 'reserve', hp: null, maxHp: null,
      };
      reserves.push(reserve);
    },
  };
}
/** Baseline policy: make no planning actions. */
export function passiveCommander() { return []; }
/** Legacy-style simple policy: prioritize cavalry, then archers, then infantry. */
export function greedyCommander(state, faction, { context = {} } = {}) {
  const planner = createPlanner(state, faction, context);
  if (!planner) return [];
  for (const reserve of [...planner.reserves]) planner.deploy(reserve);
  const preference = ['cavalier', 'archer', 'pikeman'];
  const cap = context.content?.cardLimits?.populationCap ?? 10;
  for (let attempts = 0; attempts < 20; attempts += 1) {
    if (planner.population >= cap) break;
    const card = preference.map((unitId) => planner.hand.find((item) => item.type === 'unit'
      && item.unitId === unitId && item.cost <= planner.supply)).find(Boolean);
    const definition = card && context.content?.unitCardFor?.(card.unitId);
    if (!card || !definition || planner.population + (definition.population ?? 1) > cap) break;
    planner.addRecruit(card, definition);
  }
  return planner.actions;
}
/**
 * Faction-aware general policy. It recruits toward a category mix, deploys toward the enemy, and sets
 * simple frontline stances. Campaign wave control remains the match's responsibility.
 * @param {object} state detached match snapshot
 * @param {'blue'|'red'} faction
 * @param {{context?: object, params?: object}} options
 * @returns {object[]} ordered match actions
 */
export function heuristicCommander(state, faction, { context = {}, params = {} } = {}) {
  const planner = createPlanner(state, faction, context);
  if (!planner) return [];
  const defaults = { mix: { melee: 0.5, ranged: 0.3, mounted: 0.2, caster: 0.15, support: 0.1 },
    archerHoldRange: 5, seizeRatio: 1.3, retreatBelow: 0.3 };
  const config = { ...defaults, ...params, mix: { ...defaults.mix, ...(params.mix ?? {}) } };
  const own = fieldUnits(state, faction);
  const enemies = planner.enemies;
  for (const reserve of [...planner.reserves]) planner.deploy(reserve);
  const category = (unit) => context.content?.categoryOf?.(unit) ?? 'melee';
  const counts = new Map();
  let total = 0;
  for (const unit of [...own, ...planner.cards.reserves]) {
    const key = category(unit);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    total += 1;
  }
  const cap = context.content?.cardLimits?.populationCap ?? 10;
  for (let attempts = 0; attempts < 20; attempts += 1) {
    const room = cap - planner.population;
    if (room <= 0) break;
    const candidates = planner.hand.filter((card) => {
      const definition = card.type === 'unit' && context.content?.unitCardFor?.(card.unitId);
      return definition && card.cost <= planner.supply && (definition.population ?? 1) <= room;
    });
    if (!candidates.length) break;
    candidates.sort((a, b) => {
      const ca = category(a.unitId);
      const cb = category(b.unitId);
      const da = (config.mix[a.unitId] ?? config.mix[ca] ?? 0) - (counts.get(ca) ?? 0) / Math.max(1, total + 1);
      const db = (config.mix[b.unitId] ?? config.mix[cb] ?? 0) - (counts.get(cb) ?? 0) / Math.max(1, total + 1);
      return db - da || b.cost - a.cost || String(a.instanceId).localeCompare(String(b.instanceId));
    });
    const card = candidates[0];
    const definition = context.content.unitCardFor(card.unitId);
    planner.addRecruit(card, definition);
    const key = category(card.unitId);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    total += 1;
  }
  const ownHp = own.reduce((sum, unit) => sum + unit.hp, 0);
  const enemyHp = enemies.reduce((sum, unit) => sum + unit.hp, 0);
  const seize = ownHp >= enemyHp * config.seizeRatio;
  const enemyKeep = context.board?.findTile?.(faction === 'blue' ? 'K' : 'C');
  const championId = planner.side.championId ?? planner.side.champion?.id;
  const champion = own.find((unit) => unit.id === championId || unit.champion || unit.isHero || unit.hero);
  for (const unit of own) {
    const nearest = nearestEnemy(unit, enemies);
    let stance = 'advance';
    let tile;
    let targetId;
    const role = category(unit);
    if (champion && unit.id !== champion.id && unit.hp / Math.max(1, unit.maxHp) < config.retreatBelow) {
      stance = 'protect';
      targetId = champion.id;
    } else if (['ranged', 'caster', 'support'].includes(role) && nearest <= config.archerHoldRange) {
      stance = 'hold';
    } else if ((seize || role === 'mounted') && enemyKeep && nearest > 3) {
      tile = enemyKeep;
    } else if (context.content?.metaOf?.(unit)?.aiStance === 'hold') {
      stance = 'hold';
    }
    const same = unit.stance === stance
      && (!targetId || unit.objective?.targetId === targetId)
      && (tile ? unit.objective?.type === 'tile' && unit.objective.c === tile[0] && unit.objective.r === tile[1]
        : stance !== 'advance' || !unit.objective);
    if (!same) planner.emit({ type: 'stance', unitId: unit.id, stance,
      ...(targetId ? { targetId } : {}), ...(tile ? { tile } : {}) });
  }
  return planner.actions;
}
export const COMMANDERS = Object.freeze({ passive: passiveCommander, greedy: greedyCommander, heuristic: heuristicCommander });
/** Return actions without applying them; the match validates/logs each action as usual. */
export function planCommander(name, state, faction, options = {}) {
  const commander = COMMANDERS[name];
  if (!commander) throw new Error('Unknown commander: ' + name);
  return commander(state, faction, options);
}

/** Apply a commander one accepted action at a time, refreshing the snapshot after every action. */
export function runCommander(match, faction, name, { context = {}, contextFor, params = {}, maxActions = 30 } = {}) {
  if (!match?.getState || !match?.apply) throw new TypeError('runCommander requires match.getState() and match.apply()');
  let accepted = 0;
  for (let attempt = 0; attempt < maxActions; attempt += 1) {
    const state = match.getState();
    const actionContext = contextFor ? contextFor(state, match) : context;
    const action = planCommander(name, state, faction, { context: actionContext, params })[0];
    if (!action) break;
    const result = match.apply(action, 'ai:' + name);
    if (!result?.ok) break;
    accepted += 1;
  }
  return accepted;
}
