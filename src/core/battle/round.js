// One automatic movement and simultaneous strike opportunity.
import { makeRng } from '../util/rng.js';
import { resolveMovement } from './targeting.js';
import { resolveStrikes } from './strikes.js';

export const BATTLE_TUNING = Object.freeze({ damageScale: 1 });

/**
 * Resolve movement and attacks from shared snapshots. Events are descriptions only.
 * Supply forecastAttack and legalMoves from the match/content adapter.
 */
export function resolveBattleRound({
  units, seed = 1, orders = {}, forecastAttack, legalMoves = () => [], pathForMove = null,
  beforeCombat = null, canAttack = () => true, preserveStatuses = false,
  damageScale = BATTLE_TUNING.damageScale,
} = {}) {
  if (!Array.isArray(units)) throw new TypeError('units must be an array');
  if (typeof forecastAttack !== 'function') throw new TypeError('forecastAttack must be a function');
  const rand = makeRng(seed);
  const currentOrders = typeof orders === 'function' ? orders(units) : orders;
  const movement = resolveMovement(units, { orders: currentOrders, legalMoves, pathForMove, rand });
  const prepared = beforeCombat ? beforeCombat(movement.units, movement.events) : movement.units;
  const combat = resolveStrikes(prepared, {
    rand, forecastAttack, orders: currentOrders, canAttack, damageScale, preserveStatuses,
  });
  return {
    units: combat.units,
    batches: [
      { type: 'movement', events: movement.events },
      { type: 'combat', events: combat.events },
    ],
  };
}
