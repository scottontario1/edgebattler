// Combat forecast: a Fire Emblem style preview of one exchange (hit, crit, damage, doubling, weapon
// triangle, terrain). Pure: the board and the content context come in as arguments, and nothing is
// mutated. The timed battle (src/core/battle/) uses `forecast` through its `forecastAttack` hook.
import { triangleBonus, TRIANGLE_HIT } from '../content/weapons.js';

/**
 * @typedef {Object} ForecastEnv
 * @property {import('./board.js').Board} board
 * @property {object} content   content context (weapons)
 */

/**
 * @typedef {Object} ForecastSide
 * @property {boolean} can    the target is inside the weapon's range
 * @property {number} dmg     damage per strike before crit
 * @property {number} hit     0..100
 * @property {number} crit    0..100
 * @property {boolean} double speed advantage of 4 or more
 * @property {number} tri     weapon triangle result: 1, 0 or -1
 * @property {number[]} tile  the striker's tile
 */

/** One side of a forecast: `a` strikes `d` at `distance`; `dTile` is the defender's tile. */
function strikeSide(a, d, distance, aTile, dTile, env) {
  const weapon = env.content.weaponOf(a);
  const defenderWeapon = env.content.weaponOf(d);
  const terrain = env.board.tile(dTile[0], dTile[1]);
  const tri = triangleBonus(weapon.kind, defenderWeapon.kind);
  const inRange = distance >= weapon.rng[0] && distance <= weapon.rng[1];
  const power = (weapon.magic ? a.mag : a.str) + weapon.mt + tri;
  const guard = (weapon.magic ? d.res : d.def) + terrain.def;
  const hit = weapon.hit + a.skl * 2 + tri * TRIANGLE_HIT - (d.spd * 2 + terrain.avo);
  return {
    can: inRange,
    dmg: Math.max(0, power - guard),
    hit: Math.max(0, Math.min(100, Math.round(hit))),
    crit: Math.max(0, Math.min(100, Math.round(weapon.crit + a.skl / 2 - d.skl / 4))),
    double: a.spd - d.spd >= 4,
    tri,
    tile: aTile,
  };
}

/**
 * Forecast for attacker `a` striking `d` from tile `from` ([c, r]).
 * @param {object} a
 * @param {object} d
 * @param {number[]} from
 * @param {ForecastEnv} env
 * @returns {{ dist: number, from: number[], atk: ForecastSide, def: ForecastSide }}
 */
export function forecast(a, d, from, env) {
  const dist = Math.abs(from[0] - d.c) + Math.abs(from[1] - d.r);
  return {
    dist,
    from,
    atk: strikeSide(a, d, dist, from, [d.c, d.r], env),
    def: strikeSide(d, a, dist, [d.c, d.r], from, env),
  };
}

/**
 * Play out a duel with dice (the legacy discrete exchange; the timed battle does not use it).
 * Strikes come in Fire Emblem order: attacker, the defender's counter if in range, then a follow-up
 * by whoever is 4+ speed ahead. Stops as soon as either unit would fall. Nothing is mutated.
 * @param {object} a
 * @param {object} d
 * @param {number[]} from
 * @param {ForecastEnv} env
 * @param {() => number} rand  returns [0, 1)
 * @returns {Array<{ by: 'a'|'d', hit: boolean, crit: boolean, dmg: number }>}
 */
export function resolveCombat(a, d, from, env, rand) {
  const f = forecast(a, d, from, env);
  const order = ['a'];
  if (f.def.can) order.push('d');
  if (f.atk.double) order.push('a');
  else if (f.def.double && f.def.can) order.push('d');
  const hp = { a: a.hp, d: d.hp };
  const strikes = [];
  for (const who of order) {
    if (hp.a <= 0 || hp.d <= 0) break;
    const side = who === 'a' ? f.atk : f.def;
    const victim = who === 'a' ? 'd' : 'a';
    const hit = rand() * 100 < side.hit;
    const crit = hit && rand() * 100 < side.crit;
    const dmg = hit ? Math.min(hp[victim], side.dmg * (crit ? 3 : 1)) : 0;
    hp[victim] -= dmg;
    strikes.push({ by: who, hit, crit, dmg });
  }
  return strikes;
}

/**
 * A `forecastAttack(attacker, defender, from)` function bound to one environment, in the shape the
 * battle resolver expects (`from` is { c, r }).
 * @param {ForecastEnv} env
 */
export function forecastAttackFor(env) {
  return (attacker, defender, from) => forecast(attacker, defender, [from.c, from.r], env);
}
