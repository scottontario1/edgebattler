// Authoritative framework-neutral match controller. The match owns mutable records.
// Clients submit actions and read detached snapshots; presentation never mutates game state.
import { computeRange, MOVE_COST, occupancyFromRecords } from '../rules/movement.js';
import { forecastAttackFor } from '../rules/forecast.js';
import { evaluatePassives, hasRevenant } from '../rules/passives.js';
import { resolveBattleRound } from '../battle/round.js';
import { resolveTimedBattle, timedCombatConfig, TIMED_COMBAT_DEFAULTS } from '../battle/timed.js';
import { createEconomyState, drawOpeningHand, refreshRound, recruitUnit, canDeployReserve, cycleCard,
  buyShard, applyShard, removeShard, combineDockShards, grantShard, combineUnits } from '../economy/index.js';
import { shardBonus } from '../economy/shards.js';
import { UPGRADE_POPULATION_BY_STARS } from '../content/grades.js';
import { seededRandom } from '../util/rng.js';
import { clone, manhattan } from '../util/geometry.js';
import { createBattleStats } from './battle-stats.js';

const SIDES = ['blue', 'red'];
const OTHER = { blue: 'red', red: 'blue' };
const TARGET_KEEP = { blue: 'K', red: 'C' };
const DIRECTIONS = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
const fail = (reason) => ({ ok: false, reason });
const locKey = (c, r) => `${c},${r}`;

/**
 * Create an isolated match. getState() returns a detached snapshot; apply(action, actor) returns
 * {ok:true,...} or {ok:false,reason}; resolveRound() returns event batches and advances one round.
 * All inputs and events are plain data; no framework references cross this boundary.
 */
export function createMatch({ content, board, roster = content?.startingUnits, seed = 0x415348,
  maxRounds = null, combat = TIMED_COMBAT_DEFAULTS, champions = {}, pools = {}, campaign = null,
  meta = {}, log = null } = {}) {
  if (!content?.createRecruitUnit || !board?.inBounds) throw new TypeError('createMatch requires content and board');
  const clock = combat ? timedCombatConfig(combat) : null;
  const rng = Object.fromEntries(SIDES.map((side) => [side, seededRandom(side === 'blue' ? seed : ((seed ^ 0x5a5a5a5a) + 0x1057b11))]));
  let seq = 0;
  let objects = [];
  let units = clone(roster).map((unit) => prepare(unit, content));
  const territory = new Map([...board.tiles()].flatMap(({ c, r, letter }) =>
    letter === 'C' ? [[locKey(c, r), 'blue']] : letter === 'K' ? [[locKey(c, r), 'red']] : letter === 'V' ? [[locKey(c, r), null]] : []));
  const sides = Object.fromEntries(SIDES.map((faction) => {
    const factionId = meta[`${faction}Faction`];
    const cultureId = content.factions[factionId]?.culture;
    const pool = pools[faction] ?? content.poolFor(cultureId);
    const cards = drawOpeningHand(createEconomyState(content, { shardPool: content.shardIds,
      ...(pool?.length ? { pool } : {}), supply: content.cardLimits.initialSupply, round: 1 }), content, rng[faction]).state;
    return [faction, { cards, championId: champions[faction] ?? null, heroRespawnAt: null,
      stats: { recruited: {}, deployed: 0, withdrawn: 0, combined: 0, shardsBought: 0, shardsCombined: 0,
        lost: {}, killed: {}, supplySpent: 0, captures: 0, respawns: 0, blockedDraws: 0,
        cycles: { hand: 0, bench: 0 }, supplyRefunded: 0 } }];
  }));
  const state = { seed, maxRounds, round: 1, phase: 'planning', over: false, winner: null, reason: null,
    meta: clone(meta), rewards: [], ...(campaign ? { campaign: { ...clone(campaign), stage: 0, wave: 0, phase: 'engage', rallied: false } } : {}) };
  const tracker = createBattleStats();
  const emit = (entry) => { if (typeof log === 'function') log(clone(entry)); };
  const alive = (faction) => units.filter((unit) => unit.hp > 0 && (!faction || unit.faction === faction));
  const byId = (id) => units.find((unit) => unit.id === id) ?? null;
  const unitAt = (c, r) => units.find((unit) => unit.hp > 0 && unit.c === c && unit.r === r) ?? null;
  const objectAt = (c, r) => objects.find((object) => object.hp > 0 && object.c === c && object.r === r) ?? null;
  const blocking = () => objects.filter((object) => object.hp > 0 && object.blocks);
  const population = (faction) => alive(faction).reduce((sum, unit) => sum + (unit.population || 1), 0)
    + sides[faction].cards.reserves.reduce((sum, unit) => sum + (unit.population || 1), 0);
  const records = () => [...units.filter((unit) => unit.hp > 0), ...blocking()];
  const findRange = (unit, snapshot = records(), mov = unit.mov, blockAllies = false) =>
    computeRange(unit, board, occupancyFromRecords(snapshot), { content, mov, blockAllies });
  const deploymentTiles = (faction) => {
    const tiles = new Map();
    for (const [position, owner] of territory) {
      if (owner !== faction) continue;
      const [c, r] = position.split(',').map(Number);
      for (let dc = -1; dc <= 1; dc += 1) for (let dr = -1; dr <= 1; dr += 1) {
        if (Math.abs(dc) + Math.abs(dr) > 1 || !board.inBounds(c + dc, r + dr)) continue;
        if (['C', 'K'].includes(board.terrainAt(c + dc, r + dr))) continue;
        tiles.set(locKey(c + dc, r + dr), [c + dc, r + dr]);
      }
    }
    return [...tiles.values()];
  };
  const canDeploy = (faction, reserveId, c, r) => {
    if (!sides[faction]) return fail('unknown-faction');
    const reserve = sides[faction].cards.reserves.find((unit) => unit.id === reserveId);
    const costs = reserve ? MOVE_COST[content.moveTypeOf(reserve.classId || reserve.unitId)] : null;
    return canDeployReserve(sides[faction].cards, reserveId, {
      location: deploymentTiles(faction).some(([x, y]) => x === c && y === r),
      tile: { occupied: Boolean(unitAt(c, r) || blocking().some((object) => object.c === c && object.r === r)),
        traversable: Boolean(costs?.[board.terrainAt(c, r)] !== undefined), terrain: board.terrainAt(c, r) },
    });
  };
  const controlled = (unit) => territory.get(locKey(unit.c, unit.r)) === unit.faction;
  const addObject = ({ objectKind, faction, c, r, hp = 10, blocks = false, decay = null, name }) => {
    const object = { id: `obj-${++seq}`, kind: 'object', objectKind, name: name || objectKind, cls: 'object',
      faction, c, r, hp, maxHp: hp, blocks, decay, str: 0, mag: 0, skl: 0, spd: 0, def: 0,
      res: 0, mov: 0, weapon: null, statuses: {} };
    objects.push(object); return object;
  };
  function syncShards(unit) {
    const cls = unit.cls ?? unit.classId ?? unit.unitId;
    const bonus = shardBonus(sides[unit.faction]?.cards.shards?.[cls] || [], content);
    const previous = unit.shardBonus || {};
    for (const stat of ['str', 'def', 'spd', 'skl']) unit[stat] = (unit[stat] || 0) + bonus[stat] - (previous[stat] || 0);
    const delta = bonus.maxHp - (previous.maxHp || 0);
    if (delta && Number.isFinite(unit.maxHp)) {
      unit.maxHp += delta;
      if (unit.hp > 0) unit.hp = Math.max(1, Math.min(unit.maxHp, unit.hp + delta));
    }
    unit.shardBonus = Object.fromEntries(['str', 'def', 'spd', 'skl', 'maxHp'].map((stat) => [stat, bonus[stat]]));
  }
  function syncClass(faction, classId) {
    for (const unit of units) if (unit.faction === faction && (unit.cls ?? unit.classId) === classId) syncShards(unit);
    for (const unit of sides[faction].cards.reserves) if ((unit.cls ?? unit.classId ?? unit.unitId) === classId) syncShards(unit);
  }
  function spawnWave() {
    const campaign = state.campaign;
    const wave = campaign.stages[campaign.stage]?.waves[campaign.wave];
    if (!wave) throw new Error('Campaign wave is missing');
    for (const source of wave) {
      const candidates = [];
      for (let r = 0; r < board.height; r += 1) for (let c = 0; c < board.width; c += 1) {
        if (Math.abs(r - source.r) > 2 || Math.abs(c - source.c) > 3 || unitAt(c, r) || objectAt(c, r)) continue;
        const costs = MOVE_COST[content.moveTypeOf(source)] || MOVE_COST.foot;
        if (costs[board.terrainAt(c, r)] !== undefined) candidates.push([c, r]);
      }
      candidates.sort((a, b) => manhattan({ c: a[0], r: a[1] }, source) - manhattan({ c: b[0], r: b[1] }, source)
        || a[1] - b[1] || a[0] - b[0]);
      if (!candidates.length) throw new Error('Campaign wave has no legal spawn tile');
      const [c, r] = candidates[0]; units.push(prepare({ ...clone(source), c, r }, content, false));
    }
    campaign.phase = 'engage';
  }
  function apply(action, actor = 'human') {
    if (!action || typeof action !== 'object') return fail('invalid-action');
    const f = action.faction;
    if (state.over) return fail('match-over');
    if (state.phase !== 'planning') return fail('not-planning');
    if (!SIDES.includes(f)) return fail('unknown-faction');
    if (state.campaign && f === 'red') return fail('fixed-encounter-enemy');
    const side = sides[f];
    let result;
    switch (action.type) {
      case 'recruit': {
        side.cards.population = population(f);
        const bought = recruitUnit(side.cards, action.cardId, content, { faction: f });
        if (!bought.ok) return fail(bought.reason);
        const id = `${f}-r${++seq}-${bought.reserve.unitId}`;
        const unit = content.createGradedRecruitUnit(bought.reserve.unitId, id, f, bought.reserve.stars);
        Object.assign(unit, bought.reserve, { id, faction: f, state: 'reserve', hp: unit.maxHp, maxHp: unit.maxHp });
        delete unit.c; delete unit.r;
        side.cards = { ...bought.state, reserves: [...bought.state.reserves.slice(0, -1), unit] };
        side.stats.recruited[unit.unitId] = (side.stats.recruited[unit.unitId] || 0) + 1;
        side.stats.supplySpent += bought.supplySpent;
        result = { ok: true, reserveId: id, unitId: unit.unitId };
        break;
      }
      case 'cycle': {
        side.cards.population = population(f);
        const cycled = cycleCard(side.cards, { source: action.source, id: action.id }, content, rng[f]);
        if (!cycled.ok) return fail(cycled.reason);
        side.cards = cycled.state; side.stats.cycles[action.source] += 1;
        side.stats.supplyRefunded += cycled.refund;
        result = { ok: true, replacement: cycled.replacement, refund: cycled.refund, populationFreed: cycled.populationFreed };
        break;
      }
      case 'deploy': {
        const legal = canDeploy(f, action.reserveId, action.c, action.r);
        if (!legal.ok) return legal;
        const reserve = side.cards.reserves.find((unit) => unit.id === action.reserveId);
        const id = reserve.fieldId && !byId(reserve.fieldId) ? reserve.fieldId : `${f}-u${++seq}-${reserve.unitId}`;
        const unit = { ...content.createRecruitUnit(reserve.unitId, id, f, action.c, action.r), ...clone(reserve),
          id, faction: f, c: action.c, r: action.r, state: 'field', planningMoved: false };
        delete unit.fieldId;
        syncShards(unit);
        units = units.filter((item) => item.id !== id); units.push(unit);
        side.cards.reserves = side.cards.reserves.filter((item) => item.id !== action.reserveId);
        side.stats.deployed += 1;
        result = { ok: true, unitId: id };
        break;
      }
      case 'withdraw': {
        const unit = byId(action.unitId);
        if (!unit || unit.faction !== f || unit.hp <= 0) return fail('unit-not-found');
        if (unit.id === side.championId || unit.champion) return fail('champion-cannot-bench');
        if (side.cards.reserves.length >= content.cardLimits.reserveCapacity
          || !deploymentTiles(f).some(([c, r]) => c === unit.c && r === unit.r)) return fail('not-on-controlled-tile');
        const reserve = { ...clone(unit), id: `${f}-r${++seq}-${unit.variantId ?? unit.cls}`,
          fieldId: unit.id, unitId: unit.variantId ?? unit.cls, faction: f, state: 'reserve' };
        for (const field of ['c', 'r', 'planningMoved']) delete reserve[field];
        units = units.filter((item) => item.id !== unit.id); side.cards.reserves.push(reserve);
        side.stats.withdrawn += 1; result = { ok: true, reserveId: reserve.id };
        break;
      }
      case 'move': {
        const unit = byId(action.unitId);
        if (!unit || unit.faction !== f || unit.hp <= 0) return fail('unit-not-found');
        if (unit.planningMoved) return fail('already-moved');
        const path = findRange(unit).pathTo(action.c, action.r);
        if (!path.length || unitAt(action.c, action.r) || objectAt(action.c, action.r)) return fail('unreachable');
        const from = [unit.c, unit.r];
        unit.c = action.c; unit.r = action.r; unit.facing = face([[...from], ...path], unit.facing);
        unit.planningMoved = true; result = { ok: true, path };
        break;
      }
      case 'stance': {
        const unit = byId(action.unitId);
        if (!unit || unit.faction !== f || unit.hp <= 0) return fail('unit-not-found');
        if (!['advance', 'hold', 'protect'].includes(action.stance)) return fail('unknown-stance');
        if (action.stance === 'protect') {
          const target = byId(action.targetId);
          if (!target || target.faction !== f || target.id === unit.id || target.hp <= 0) return fail('invalid-protect-subject');
          unit.objective = { type: 'protect', targetId: target.id };
        } else if (action.stance === 'advance' && Array.isArray(action.tile) && board.inBounds(...action.tile)) {
          unit.objective = { type: 'tile', c: action.tile[0], r: action.tile[1] };
        } else delete unit.objective;
        unit.stance = action.stance; result = { ok: true };
        break;
      }
      case 'campaignOrder': {
        if (!state.campaign || f !== 'blue') return fail('not-campaign');
        const tile = state.campaign.phase === 'exit' ? state.campaign.exit
          : state.campaign.stages[state.campaign.stage].checkpoint;
        for (const unit of alive(f)) { unit.stance = 'advance'; unit.objective = { type: 'tile', c: tile[0], r: tile[1] }; }
        result = { ok: true, tile: [...tile] };
        break;
      }
      case 'campaignRally': {
        const campaign = state.campaign;
        if (!campaign || f !== 'blue' || campaign.phase !== 'regroup' || campaign.rallied) return fail('rally-unavailable');
        const [c, r] = campaign.stages[campaign.stage].checkpoint;
        if (!alive(f).some((unit) => manhattan(unit, { c, r }) <= 2)) return fail('reach-rally-point');
        const restored = [];
        for (const unit of alive(f).filter((item) => manhattan(item, { c, r }) <= 2)) {
          const amount = Math.min(4, unit.maxHp - unit.hp); unit.hp += amount; restored.push({ unitId: unit.id, amount });
        }
        campaign.rallied = true; result = { ok: true, restored };
        break;
      }
      case 'campaignContinue': {
        const campaign = state.campaign;
        if (!campaign || f !== 'blue' || campaign.phase !== 'regroup' || campaign.stage + 1 >= campaign.stages.length) return fail('encounter-not-cleared');
        const [c, r] = campaign.stages[campaign.stage].checkpoint;
        if (!alive(f).some((unit) => manhattan(unit, { c, r }) <= 2)) return fail('reach-rally-point');
        campaign.stage += 1; campaign.wave = 0; campaign.rallied = false;
        const [nextC, nextR] = campaign.stages[campaign.stage].checkpoint;
        for (const unit of alive('blue')) {
          unit.stance = 'advance';
          unit.objective = { type: 'tile', c: nextC, r: nextR };
        }
        spawnWave();
        result = { ok: true, stage: campaign.stage };
        break;
      }
      case 'buyShard': {
        const bought = buyShard(side.cards, action.cardId, content);
        if (!bought.ok) return fail(bought.reason);
        side.cards = bought.state; side.stats.shardsBought += 1; side.stats.supplySpent += bought.supplySpent;
        result = { ok: true, shardInstanceId: bought.shardInstanceId, shardId: bought.shardId, tier: bought.tier };
        break;
      }
      case 'grantShard': {
        const granted = grantShard(side.cards, action.shardId, content, action.tier ?? 1);
        if (!granted.ok) return fail(granted.reason);
        side.cards = granted.state;
        result = { ok: true, shardInstanceId: granted.shardInstanceId, shardId: granted.shardId, tier: granted.tier };
        break;
      }
      case 'applyShard': {
        const ownedTypes = [...new Set([...Object.keys(content.recruitClasses),
          ...units.filter((unit) => unit.faction === f).map((unit) => unit.cls)])];
        const applied = applyShard(side.cards, action.shardInstanceId, action.unitType, content, ownedTypes);
        if (!applied.ok) return fail(applied.reason);
        side.cards = applied.state; syncClass(f, action.unitType);
        result = { ok: true, unitType: action.unitType, shardId: applied.shardId, tier: applied.tier };
        break;
      }
      case 'removeShard': {
        const removed = removeShard(side.cards, action.unitType, action.index, content);
        if (!removed.ok) return fail(removed.reason);
        side.cards = removed.state; syncClass(f, action.unitType);
        result = { ok: true, unitType: action.unitType, shardInstanceId: removed.shardInstanceId,
          shardId: removed.shardId, tier: removed.tier };
        break;
      }
      case 'combineShards': {
        const merged = combineDockShards(side.cards, action.shardId, action.tier, content);
        if (!merged.ok) return fail(merged.reason);
        side.cards = merged.state; side.stats.shardsCombined += 1;
        result = { ok: true, shardInstanceId: merged.shardInstanceId, shardId: merged.shardId,
          tier: merged.tier, consumed: merged.consumed };
        break;
      }
      case 'combine': {
        const army = [...side.cards.reserves, ...alive(f)];
        const merged = combineUnits(army, action.ids, content, { survivorId: action.survivorId, destination: action.destination });
        if (!merged.ok) return fail(merged.reason);
        const consumed = new Set(action.ids);
        const tile = action.destination === 'field' ? (action.tile || [merged.unit.c, merged.unit.r]) : null;
        if (action.destination === 'field' && (!tile || !Number.isInteger(tile[0]) || !Number.isInteger(tile[1])
          || !board.inBounds(tile[0], tile[1]) || objectAt(tile[0], tile[1])
          || (unitAt(tile[0], tile[1]) && !consumed.has(unitAt(tile[0], tile[1]).id)))) return fail('occupied-tile');
        units = units.filter((unit) => !consumed.has(unit.id));
        side.cards.reserves = side.cards.reserves.filter((unit) => !consumed.has(unit.id));
        if (action.destination === 'field') {
          merged.unit.c = tile[0]; merged.unit.r = tile[1]; merged.unit.state = 'field'; units.push(merged.unit);
        } else {
          delete merged.unit.c; delete merged.unit.r; merged.unit.state = 'reserve'; side.cards.reserves.push(merged.unit);
        }
        side.cards.population = population(f); side.stats.combined += 1;
        result = { ok: true, unitId: merged.unit.id, stars: merged.unit.stars, destination: action.destination };
        break;
      }
      default: return fail('unknown-action');
    }
    tracker.register([...units, ...sides.blue.cards.reserves, ...sides.red.cards.reserves]);
    emit({ t: 'action', round: state.round, actor, action: clone(action), ...result });
    return result;
  }

  function ordersFor(snapshot) {
    return Object.fromEntries(snapshot.filter((unit) => unit.kind !== 'object' && unit.hp > 0).map((unit) => {
      const order = { stance: unit.stance || 'advance', targetId: unit.objective?.targetId,
        protectId: unit.objective?.targetId, objective: unit.objective };
      const foes = snapshot.filter((other) => other.kind !== 'object' && other.hp > 0 && other.faction !== unit.faction)
        .sort((a, b) => manhattan(unit, a) - manhattan(unit, b) || String(a.id).localeCompare(String(b.id)));
      if (foes[0]) order.targetId = foes[0].id;
      else if (unit.objective?.type === 'tile' && unit.stance === 'advance') {
        const goal = unit.objective;
        const candidates = findRange(unit, snapshot, unit.mov, true).move
          .filter(([c, r]) => !snapshot.some((other) => other.hp > 0 && other.c === c && other.r === r))
          .sort((a, b) => manhattan({ c: a[0], r: a[1] }, goal) - manhattan({ c: b[0], r: b[1] }, goal)
            || a[1] - b[1] || a[0] - b[0]);
        if (candidates[0] && manhattan({ c: candidates[0][0], r: candidates[0][1] }, goal) < manhattan(unit, goal)) {
          order.destination = { c: candidates[0][0], r: candidates[0][1] };
        }
      }
      return [unit.id, order];
    }));
  }
  function resolveRound() {
    if (state.over) return { batches: [], notes: [], over: true };
    if (state.phase !== 'planning') throw new Error('match is not in planning phase');
    state.phase = 'resolving';
    const notes = [];
    const batches = [];
    const round = state.round;
    const snapshot = records().map(clone);
    const shardEvents = prepareShardEffects(snapshot);
    if (shardEvents.length) batches.push({ type: 'shards', events: shardEvents });
    const orders = ordersFor(snapshot);
    const forecastAttack = forecastAttackFor({ board, content });
    let battle;
    if (clock) {
      battle = resolveTimedBattle({ units: snapshot, orders: ordersFor, seed: (seed + round) >>> 0,
        forecastAttack, board, content,
        legalMoves: (unit, current) => {
          const order = ordersFor(current)[unit.id] || {};
          if (order.stance === 'hold') return [];
          return findRange(unit, current, unit.mov, true).move
            .filter(([c, r]) => manhattan(unit, { c, r }) <= 1).map(([c, r]) => ({ c, r }));
        },
        pathForMove: (unit, to, current) => findRange(unit, current, unit.mov, true).pathTo(to.c, to.r),
        passives: (current, moved) => evaluatePassives(current, { moved, objects, controlled,
          stanceOf: (unit) => ordersFor(current)[unit.id]?.stance || unit.stance }),
        config: clock });
      batches.push(...battle.batches);
    } else {
      battle = resolveBattleRound({ units: snapshot, orders, seed: (seed + round) >>> 0, forecastAttack,
        legalMoves: (unit, current) => {
          const order = orders[unit.id] || {};
          const mov = order.stance === 'hold' ? 0 : order.stance === 'protect' ? unit.mov : Math.max(1, Math.round(unit.mov * 2 / 3));
          return findRange(unit, current, mov).move.map(([c, r]) => ({ c, r }));
        },
        pathForMove: (unit, to, current) => findRange(unit, current).pathTo(to.c, to.r),
        beforeCombat: (current, moves) => prepareBattle(current, moves) });
      batches.push(...battle.batches);
    }
    for (const record of battle.units) {
      if (record.kind === 'object') {
        const object = objects.find((item) => item.id === record.id);
        if (object) Object.assign(object, record);
      } else {
        const unit = byId(record.id);
        if (unit) Object.assign(unit, record);
      }
    }
    const combatEvents = batches.filter((batch) => batch.type === 'combat').flatMap((batch) => batch.events);
    const deaths = combatEvents.filter((event) => event.type === 'death').map((event) => event.unitId);
    const killerOf = new Map();
    const results = [];
    for (const event of combatEvents) {
      if (event.type === 'strike' && event.damage > 0) killerOf.set(event.targetId, event.attackerId);
      if (event.type === 'thorns' && event.amount > 0) killerOf.set(event.targetId, event.unitId);
      if (event.type === 'objectDestroyed') {
        const object = objects.find((item) => item.id === event.unitId);
        if (object) results.push({ type: 'objectDestroyed', id: object.id, objectKind: object.objectKind, c: object.c, r: object.r });
      }
    }
    objects = objects.filter((object) => object.hp > 0);
    for (const id of deaths) {
      const unit = byId(id);
      if (!unit) continue;
      const side = sides[unit.faction];
      const champion = unit.id === side.championId || unit.champion;
      if (!champion && hasRevenant(unit)) {
        unit.hp = 1; unit.revenantUsed = true; unit.statuses = {};
        results.push({ type: 'return', faction: unit.faction, unitId: id, c: unit.c, r: unit.r, hp: 1 });
        continue;
      }
      if (unit.onDeath?.spawn && !champion && !objectAt(unit.c, unit.r)) {
        const spawn = unit.onDeath.spawn;
        addObject({ objectKind: spawn.kind, faction: unit.faction, c: unit.c, r: unit.r, hp: spawn.hp,
          blocks: spawn.blocks ?? false, decay: spawn.decay ?? null, name: spawn.name });
      }
      side.stats.lost[unit.cls] = (side.stats.lost[unit.cls] || 0) + 1;
      const killer = byId(killerOf.get(id));
      if (killer) sides[killer.faction].stats.killed[unit.cls] = (sides[killer.faction].stats.killed[unit.cls] || 0) + 1;
      if (champion) side.heroRespawnAt = round + 2;
    }
    for (const [position] of territory) {
      const [c, r] = position.split(',').map(Number);
      const occupant = unitAt(c, r);
      if (board.terrainAt(c, r) === 'V' && occupant && territory.get(position) !== occupant.faction) {
        const previous = territory.get(position);
        territory.set(position, occupant.faction);
        sides[occupant.faction].stats.captures += 1;
        results.push({ type: 'capture', c, r, faction: occupant.faction, from: previous });
      }
    }
    checkEnd(results);
    if (!state.over) {
      for (const object of objects) if (Number.isFinite(object.decay)) object.decay -= 1;
      for (const object of objects.filter((item) => item.decay !== null && item.decay <= 0)) {
        results.push({ type: 'objectExpired', id: object.id, objectKind: object.objectKind, c: object.c, r: object.r });
      }
      objects = objects.filter((object) => object.decay === null || object.decay === undefined || object.decay > 0);
      state.round += 1;
      for (const faction of SIDES) {
        const side = sides[faction];
        side.cards.population = population(faction);
        const draw = state.campaign && faction === 'red'
          ? { state: side.cards, blocked: 0, drawn: [] } : refreshRound(side.cards, content, rng[faction]);
        side.cards = draw.state;
        if (draw.blocked) side.stats.blockedDraws += draw.blocked;
        results.push({ type: 'draw', faction, drawn: draw.drawn.map((card) => card.id),
          blocked: draw.blocked || 0, supply: side.cards.supply });
        side.cards.reserves = side.cards.reserves.map((unit) => ({ ...unit,
          hp: unit.hp == null ? null : Math.min(unit.maxHp, unit.hp + 2) }));
      }
      for (const unit of units) if (unit.hp > 0) {
        unit.planningMoved = false;
        unit.energy = Math.min(unit.maxEnergy || 4, (unit.energy || 0) + 1);
      }
      for (const faction of SIDES) tryRespawn(faction, results);
      if (state.maxRounds && state.round > state.maxRounds) end(null, 'round-limit');
    }
    state.phase = state.over ? 'over' : 'planning';
    batches.push({ type: 'results', events: [...results, ...(state.over ? [{ type: 'end', winner: state.winner, reason: state.reason }] : [])] });
    tracker.register([...units, ...sides.blue.cards.reserves, ...sides.red.cards.reserves]);
    tracker.record(batches);
    emit({ t: 'round', round, batches: clone(batches) });
    emit(summary(round));
    if (state.over) emit({ t: 'result', round, winner: state.winner, reason: state.reason, stats: stats() });
    return { batches, notes, over: state.over };
  }
  function prepareShardEffects(current) {
    const events = [];
    for (const unit of current) {
      if (unit.kind === 'object' || unit.hp <= 0) continue;
      const shard = shardBonus(sides[unit.faction].cards.shards?.[unit.cls] || [], content);
      if (shard.regen) {
        const amount = Math.min(shard.regen, unit.maxHp - unit.hp);
        unit.hp += amount;
        if (amount > 0) events.push({ type: 'regen', unitId: unit.id, amount });
      }
      unit.statuses = { ...(unit.statuses || {}) };
      if (shard.block) unit.statuses.barrier = (unit.statuses.barrier || 0) + shard.block;
      if (shard.thorns) unit.statuses.thorns = (unit.statuses.thorns || 0) + shard.thorns;
    }
    return events;
  }
  function prepareBattle(current, moves) {
    const moved = new Set(moves.filter((event) => event.type === 'move').map((event) => event.unitId));
    const effects = evaluatePassives(current, { moved, objects, controlled });
    for (const unit of current) for (const [name, value] of Object.entries(effects.get(unit.id) || {})) {
      unit.statuses[name] = (unit.statuses[name] || 0) + value;
    }
    return current;
  }
  function checkEnd(results) {
    if (state.campaign) {
      const campaign = state.campaign;
      if (!alive('blue').length && !sides.blue.cards.reserves.length && sides.blue.heroRespawnAt === null) {
        end('red', 'army-destroyed'); return;
      }
      if (alive('red').length) return;
      const stage = campaign.stages[campaign.stage];
      if (campaign.wave + 1 < stage.waves.length) {
        campaign.wave += 1; spawnWave(); results.push({ type: 'wave', stage: campaign.stage, wave: campaign.wave });
      } else if (campaign.stage + 1 < campaign.stages.length) {
        campaign.phase = 'regroup';
      } else {
        campaign.phase = 'exit';
        for (const unit of alive('blue')) {
          unit.stance = 'advance';
          unit.objective = { type: 'tile', c: campaign.exit[0], r: campaign.exit[1] };
        }
        if (alive('blue').some((unit) => unit.c === campaign.exit[0] && unit.r === campaign.exit[1])) {
          state.rewards = clone(campaign.rewards || []); end('blue', 'campaign-complete');
        }
      }
      return;
    }
    for (const faction of SIDES) {
      if (alive(faction).some((unit) => board.terrainAt(unit.c, unit.r) === TARGET_KEEP[faction])) {
        end(faction, 'keep-captured'); return;
      }
    }
    for (const faction of SIDES) if (!alive(faction).length && !sides[faction].cards.reserves.length
      && sides[faction].heroRespawnAt === null) { end(OTHER[faction], 'army-destroyed'); return; }
  }
  function tryRespawn(faction, results) {
    const side = sides[faction];
    if (!side.championId || side.heroRespawnAt == null || state.round < side.heroRespawnAt || side.cards.supply < 1) return;
    const tile = deploymentTiles(faction).find(([c, r]) => !unitAt(c, r) && !objectAt(c, r));
    if (!tile) return;
    const hero = content.createHeroRespawnData(side.championId, tile[0], tile[1]);
    hero.faction = faction; prepare(hero, content);
    units = units.filter((unit) => unit.id !== hero.id); units.push(hero);
    side.cards.supply -= 1; side.heroRespawnAt = null; side.stats.respawns += 1;
    results.push({ type: 'respawn', faction, unitId: hero.id, c: tile[0], r: tile[1] });
  }
  function end(winner, reason) { state.over = true; state.phase = 'over'; state.winner = winner; state.reason = reason; }
  function summary(round = state.round) {
    const sideSummary = (faction) => {
      const side = sides[faction]; const field = alive(faction); const counts = {};
      for (const unit of field) {
        const label = `${unit.cls}${(unit.stars || 1) > 1 ? `*${unit.stars}` : ''}`;
        counts[label] = (counts[label] || 0) + 1;
      }
      return { cyclesRemaining: side.cards.cyclesRemaining, handState: clone(side.cards.hand),
        supply: side.cards.supply, population: population(faction), hand: side.cards.hand.map((card) => card.id),
        reserves: side.cards.reserves.map((unit) => unit.unitId), field: counts, units: field.length,
        hp: field.reduce((sum, unit) => sum + unit.hp, 0), maxHp: field.reduce((sum, unit) => sum + unit.maxHp, 0),
        energy: field.reduce((sum, unit) => sum + (unit.energy || 0), 0),
        territory: [...territory.values()].filter((owner) => owner === faction).length,
        championDown: side.heroRespawnAt !== null,
        unitState: field.map((unit) => ({ id: unit.id, c: unit.c, r: unit.r, hp: unit.hp, energy: unit.energy,
          facing: unit.facing, stance: unit.stance, objective: unit.objective })),
        reserveState: clone(side.cards.reserves), shardDock: clone(side.cards.shardDock), shards: clone(side.cards.shards) };
    };
    return { t: 'summary', round, ...(state.campaign ? { campaign: {
      stage: state.campaign.stage, wave: state.campaign.wave, phase: state.campaign.phase, rallied: state.campaign.rallied } } : {}),
      blue: sideSummary('blue'), red: sideSummary('red'), ...(objects.length ? { objects: clone(objects) } : {}) };
  }
  function stats() { return Object.fromEntries(SIDES.map((f) => [f, clone(sides[f].stats)])); }
  function getState() {
    return clone({ ...state, units, territory: Object.fromEntries(territory), sides, objects });
  }

  for (const faction of SIDES) sides[faction].cards.population = population(faction);
  if (state.campaign) {
    sides.red.cards.hand = []; sides.red.cards.supply = 0;
    spawnWave();
  }
  tracker.register([...units, ...sides.blue.cards.reserves, ...sides.red.cards.reserves]);
  emit({ t: 'header', schema: 4, seed, maxRounds, map: board.id, ...(clock ? { combat: clock } : {}),
    shardSubset: content.shardIds, cardLimits: content.cardLimits, ...(state.campaign ? { campaign: clone(state.campaign) } : {}), ...clone(meta) });
  emit(summary(0));
  return Object.freeze({
    context: Object.freeze({ content, board, combat: clock }),
    getState, apply, resolveRound, summary, stats, unitStats: tracker.forUnit,
    deploymentTiles: (f) => clone(deploymentTiles(f)), canDeploy: (f, id, c, r) => clone(canDeploy(f, id, c, r)),
    alive: (f) => clone(alive(f)), byId: (id) => clone(byId(id)),
    objectsNear: (c, r, radius, kind) => clone(objects.filter((obj) => obj.hp > 0
      && manhattan({ c, r }, obj) <= radius && (!kind || obj.objectKind === kind))),
    addObject: (options) => clone(addObject(options)),
    consumeObject(id) { const length = objects.length; objects = objects.filter((obj) => obj.id !== id); return length !== objects.length; },
  });
}

function prepare(unit, content, gainEnergy = true) {
  const next = clone(unit);
  next.maxHp ??= next.hp; next.hp ??= next.maxHp;
  next.classId ??= next.cls; next.variantId ??= next.cls;
  next.population ??= UPGRADE_POPULATION_BY_STARS[next.stars || 1] || 1;
  next.state = next.state === 'reserve' ? 'reserve' : 'field';
  next.maxEnergy ??= 4;
  if (gainEnergy) next.energy = Math.min(next.maxEnergy, (next.energy || 0) + 1);
  next.stance ??= content.unitCardFor(next.variantId)?.defaultStance ?? (next.cls === 'archer' ? 'hold' : 'advance');
  next.statuses = clone(next.statuses || {}); next.cooldowns = clone(next.cooldowns || {});
  next.planningMoved = false; next.costPaid ??= 0;
  next.rarity ??= content.unitCardFor(next.variantId)?.rarity ?? 'common';
  return next;
}
function face(path, fallback = 'north') {
  if (path.length < 2) return fallback;
  const a = path[path.length - 2], b = path[path.length - 1];
  const dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]);
  return Object.keys(DIRECTIONS).find((dir) => DIRECTIONS[dir][0] === dx && DIRECTIONS[dir][1] === dy) || fallback;
}
