// Deterministic fixed-step combat clock. Playback timing never changes simulation state or dice.
import { resolveBattleRound } from './round.js';
import { computeRange, occupancyFromRecords } from '../rules/movement.js';
import { evaluatePassives } from '../rules/passives.js';

export const TIMED_COMBAT_DEFAULTS = Object.freeze({
  duration: 18, skillMode: 'slots', timelineScope: 'type', tick: 0.25,
  skillTimes: [3, 9, 15], damageScale: 0.35, moveInterval: 0.8,
  attackBase: 2.8, speedFactor: 0.12, acceleration: 0,
});
const CLASS_DELAY = Object.freeze({ pikeman: 0.1, archer: 0, cavalier: -0.15, berserker: 0.3, knight: 0.3 });
const TRANSIENT = ['brace', 'attackBonus', 'hitBonus', 'setSpears', 'equipStr', 'equipDef',
  'damageTaken', 'damageDealt', 'ignoreDefense', 'offTargetPenalty', 'energyWhenStruck',
  'barrier', 'ward', 'thorns'];

export function attackInterval(unit, config = TIMED_COMBAT_DEFAULTS) {
  const raw = Number.isFinite(unit.attackInterval) ? unit.attackInterval
    : (config.attackBase ?? 2.8) - (config.speedFactor ?? 0.12) * ((unit.spd ?? 4) - 4)
      + (CLASS_DELAY[unit.cls] || 0);
  return Math.max(1.2, Math.min(3.5, raw));
}

export function timedCombatConfig(options = {}) {
  const config = { ...TIMED_COMBAT_DEFAULTS, ...options };
  if (!Number.isFinite(config.duration) || config.duration < 1 || config.duration > 60) {
    throw new Error('Invalid combat duration');
  }
  if (config.tick !== 0.25) throw new Error('Timed combat uses a fixed 0.25s simulation tick');
  if (!Array.isArray(config.skillTimes)) throw new Error('skillTimes must be an array');
  config.skillTimes = [...new Set(config.skillTimes.filter((time) => Number.isFinite(time)
    && time >= 0 && time < config.duration).map((time) => {
    if (Math.abs(time / config.tick - Math.round(time / config.tick)) > 1e-8) {
      throw new Error('skillTimes must align to the 0.25s simulation tick');
    }
    return time;
  }))].sort((a, b) => a - b);
  return config;
}

/**
 * Run a continuous battle as deterministic 0.25s ticks.
 * Required: units and forecastAttack. Movement may be supplied as legalMoves/pathForMove, or built
 * from board/content. Optional callbacks are pure rule hooks for a future match adapter.
 */
export function resolveTimedBattle({
  units, orders = {}, seed = 1, forecastAttack, legalMoves, pathForMove,
  skillWindow = null, passives = null, board = null, content = null,
  movementAllowance = (unit, order) => (order.stance || unit.stance) === 'hold' ? 0 : unit.mov,
  config: options = {},
} = {}) {
  if (!Array.isArray(units)) throw new TypeError('units must be an array');
  if (typeof forecastAttack !== 'function') throw new TypeError('forecastAttack must be a function');
  let activeOrders = {};
  if (!legalMoves) {
    if (!board || !content) throw new Error('provide legalMoves or both board and content');
    legalMoves = (unit, snapshot) => {
      const order = activeOrders[unit.id] || {};
      const range = computeRange(unit, board, occupancyFromRecords(snapshot), {
        content, mov: movementAllowance(unit, order), blockAllies: true,
      });
      return range.move.filter(([c, r]) => Math.abs(c - unit.c) + Math.abs(r - unit.r) <= 1)
        .map(([c, r]) => ({ c, r }));
    };
  }
  if (!pathForMove && board && content) {
    pathForMove = (unit, destination, snapshot) => computeRange(unit, board, occupancyFromRecords(snapshot), {
      content, mov: movementAllowance(unit, activeOrders[unit.id] || {}), blockAllies: true,
    }).pathTo(destination.c, destination.r);
  }
  const evaluate = passives || ((records, moved) => evaluatePassives(records, { moved }));
  const config = timedCombatConfig(options);
  let current = structuredClone(units);
  const batches = [];
  const nextAttack = new Map(current.map((unit) => [unit.id, 0.75]));
  const nextMove = new Map(current.map((unit) => [unit.id, 0]));
  const movedHistory = new Map();
  const interval = (unit) => attackInterval(unit, config);
  let duration = config.duration;
  const contestedAtStart = ['blue', 'red'].every((side) => current.some((unit) => unit.hp > 0
    && unit.kind !== 'object' && unit.faction === side));
  let lastMovement = 0;
  const keep = (batch) => { if (batch.events.length) batches.push(batch); };

  for (let step = 0; step <= Math.floor(config.duration / config.tick); step += 1) {
    const time = Number((step * config.tick).toFixed(3));
    if (time >= config.duration) break;
    if (contestedAtStart && !['blue', 'red'].every((side) => current.some((unit) => unit.hp > 0
      && unit.kind !== 'object' && unit.faction === side))) {
      duration = time;
      break;
    }
    if (config.skillTimes.includes(time)) {
      const skill = skillWindow?.(current, [...movedHistory.values()], time);
      if (skill) {
        current = skill.units;
        keep({ type: 'abilities', time, events: skill.events });
      }
      keep({ type: 'timeline', time, events: [{ type: 'skillWindow', time }] });
    }

    activeOrders = typeof orders === 'function' ? orders(current) : orders;
    const due = new Set(current.filter((unit) => unit.hp > 0 && time + 1e-6 >= nextAttack.get(unit.id))
      .map((unit) => unit.id));
    const persistent = new Map(current.map((unit) => [unit.id, { ...(unit.statuses || {}) }]));
    let effects = new Map();
    const result = resolveBattleRound({
      units: current, orders: activeOrders, seed: (seed + Math.imul(step + 1, 2654435761)) >>> 0,
      forecastAttack, legalMoves: (unit, snapshot) => time + 1e-6 < (nextMove.get(unit.id) ?? 0)
        ? [] : legalMoves(unit, snapshot),
      pathForMove, canAttack: (unit) => due.has(unit.id), preserveStatuses: true,
      damageScale: config.damageScale,
      beforeCombat: (records, moveEvents) => {
        for (const event of moveEvents) {
          if (event.type !== 'move') continue;
          const previous = movedHistory.get(event.unitId);
          const path = event.path || [[event.to.c, event.to.r]];
          movedHistory.set(event.unitId, {
            ...event, from: previous?.from || event.from, path: [...(previous?.path || []), ...path],
          });
          const unit = records.find((record) => record.id === event.unitId);
          unit.facing = facingFromPath([[event.from.c, event.from.r], ...path], unit.facing);
        }
        effects = evaluate(records, new Set(movedHistory.keys())) || new Map();
        for (const unit of records) {
          unit.statuses = { ...(unit.statuses || {}) };
          for (const [key, value] of Object.entries(effects.get(unit.id) || {})) {
            unit.statuses[key] = (unit.statuses[key] || 0) + value;
          }
        }
        return records;
      },
    });
    const moves = result.batches[0].events.filter((event) => event.type === 'move');
    const combat = result.batches[1].events;
    if (moves.length) lastMovement = time;
    if (!contestedAtStart && time - lastMovement >= 2) {
      duration = time;
      break;
    }
    for (const event of moves) nextMove.set(event.unitId, time + config.moveInterval);
    const struck = new Set(combat.filter((event) => event.type === 'strike').map((event) => event.attackerId));
    for (const unit of result.units) {
      if (struck.has(unit.id)) {
        nextAttack.set(unit.id, time + interval(unit) * Math.max(0.7, 1 - config.acceleration * time / config.duration));
      }
    }
    current = result.units.map((unit) => {
      const statuses = { ...(unit.statuses || {}) };
      const base = persistent.get(unit.id) || {};
      for (const key of Object.keys(effects.get(unit.id) || {})) {
        if (base[key] !== undefined) statuses[key] = base[key];
        else delete statuses[key];
      }
      if (struck.has(unit.id)) {
        delete statuses.attackBonus;
        delete statuses.hitBonus;
      }
      const gain = effects.get(unit.id)?.energyWhenStruck || 0;
      if (gain && combat.some((event) => event.type === 'strike' && event.targetId === unit.id && event.damage > 0)) {
        unit.energy = Math.min(unit.maxEnergy, (unit.energy || 0) + gain);
      }
      return { ...unit, statuses };
    });
    keep({ type: 'movement', time, events: moves });
    keep({ type: 'combat', time, events: combat });
  }

  batches.push({ type: 'timeline', time: duration, events: [{ type: 'combatEnd', duration }] });
  for (const unit of current) {
    unit.statuses = { ...(unit.statuses || {}) };
    for (const key of TRANSIENT) delete unit.statuses[key];
  }
  return { units: current, batches, duration };
}

function facingFromPath(path, fallback = 'north') {
  if (path.length < 2) return fallback;
  const a = path[path.length - 2];
  const b = path[path.length - 1];
  const dx = Math.sign(b[0] - a[0]);
  const dy = Math.sign(b[1] - a[1]);
  const directions = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
  return Object.keys(directions).find((key) => directions[key][0] === dx && directions[key][1] === dy) || fallback;
}
