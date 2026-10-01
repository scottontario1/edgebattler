// Data-driven unit passives. Pure functions over plain unit and object records; nothing here runs
// unless a unit carries `passives` (culture variants, champions and monsters do).
//
// A passive is plain data: { id, when?, effect, perAdjacent?, cap?, aura? }
//   when    all listed conditions must hold for the unit that owns the passive:
//             moved: true|false          it did / did not move this battle
//             stance: ['hold', ...]      its effective stance
//             hpBelow / hpAbove: 0..1    fraction of max HP (strict)
//             onControlled: true         it stands on an owned keep or village
//             objectNear: { kind, radius, min? }   at least `min` (1) tile objects of that kind within radius
//             adjacentAlly: { classes?: [...], min?: n }   at least n adjacent friendly units (of those classes)
//   effect  numeric statuses added for this battle: damageTaken, damageDealt, hitBonus, ignoreDefense,
//           offTargetPenalty, energyWhenStruck, plus any custom numeric key
//   perAdjacent  multiply the effect by the number of matching adjacent allies, at most `cap`
//   aura    { radius, includeSelf?, stance?: [...], classes?: [...] }: instead of the owner, every living
//           friendly unit within `radius` tiles (Manhattan) that matches the filters gets the effect.
//   effect.revenant is not a status: the match reads it when the unit dies (once per unit).
import { manhattan } from '../util/geometry.js';

export const STATUS_EFFECT_KEYS = Object.freeze([
  'damageTaken', 'damageDealt', 'hitBonus', 'ignoreDefense', 'offTargetPenalty', 'energyWhenStruck',
]);

/**
 * @typedef {Object} PassiveContext
 * @property {Set<string>} [moved]                 ids of units that moved this battle
 * @property {(unit: object) => string} [stanceOf] effective stance (default: unit.stance)
 * @property {(unit: object) => boolean} [controlled]  does the unit stand on a tile its side owns
 * @property {object[]} [objects]                  tile objects (corpses, barricades) with objectKind, c, r, hp
 * @property {(unit: object, kind: string, radius: number) => number} [objectCount]
 *           overrides the count derived from `objects`
 */

/** Living tile objects of `kind` within `radius` tiles of the unit (Manhattan). */
export function objectsNear(unit, objects, kind, radius) {
  return objects.filter((o) => o.hp > 0 && manhattan(unit, o) <= radius && (!kind || o.objectKind === kind));
}

function adjacentAllies(unit, units, classes) {
  return units.filter((other) => other.hp > 0 && other.id !== unit.id && other.faction === unit.faction
    && manhattan(unit, other) === 1 && (!classes || classes.includes(other.cls)));
}

function countObjects(unit, ctx, kind, radius) {
  if (ctx.objectCount) return ctx.objectCount(unit, kind, radius);
  return ctx.objects ? objectsNear(unit, ctx.objects, kind, radius).length : 0;
}

/**
 * Does the owner satisfy the passive's `when`?
 * @returns {number} the matching adjacent-ally count (0 if none is required), or -1 if unmet
 */
export function passiveHolds(unit, passive, ctx) {
  const when = passive.when || {};
  if (when.moved !== undefined && Boolean(ctx.moved?.has(unit.id)) !== when.moved) return -1;
  if (when.stance && !when.stance.includes(ctx.stanceOf ? ctx.stanceOf(unit) : unit.stance)) return -1;
  if (when.hpBelow !== undefined && !(unit.hp < unit.maxHp * when.hpBelow)) return -1;
  if (when.hpAbove !== undefined && !(unit.hp > unit.maxHp * when.hpAbove)) return -1;
  if (when.onControlled && !(ctx.controlled && ctx.controlled(unit))) return -1;
  if (when.objectNear) {
    const found = countObjects(unit, ctx, when.objectNear.kind, when.objectNear.radius);
    if (found < (when.objectNear.min ?? 1)) return -1;
  }
  let count = 0;
  if (when.adjacentAlly || passive.perAdjacent) {
    count = adjacentAllies(unit, ctx.units, when.adjacentAlly?.classes).length;
    if (count < (when.adjacentAlly?.min ?? 1)) return -1;
  }
  return count;
}

/**
 * Passive effects for every living unit in `units` (the post-movement snapshot).
 * @param {object[]} units
 * @param {PassiveContext} [ctx]
 * @returns {Map<string, Object<string, number>>} unit id -> { statusKey: amount }
 */
export function evaluatePassives(units, ctx = {}) {
  const out = new Map();
  const add = (id, effect, times = 1) => {
    const into = out.get(id) || {};
    for (const [key, value] of Object.entries(effect)) {
      if (key !== 'revenant' && typeof value === 'number') into[key] = (into[key] || 0) + value * times;
    }
    out.set(id, into);
  };
  const full = { ...ctx, units };
  for (const unit of units) {
    if (unit.hp <= 0 || !unit.passives?.length) continue;
    for (const passive of unit.passives) {
      const held = passiveHolds(unit, passive, full);
      if (held < 0) continue;
      const times = passive.perAdjacent ? Math.min(held, passive.cap ?? held) : 1;
      if (!passive.aura) {
        add(unit.id, passive.effect, times);
        continue;
      }
      const aura = passive.aura;
      for (const other of units) {
        if (other.hp <= 0 || other.faction !== unit.faction) continue;
        if (other.id === unit.id && !aura.includeSelf) continue;
        if (manhattan(unit, other) > aura.radius) continue;
        if (aura.classes && !aura.classes.includes(other.cls)) continue;
        if (aura.stance && !aura.stance.includes(ctx.stanceOf ? ctx.stanceOf(other) : other.stance)) continue;
        add(other.id, passive.effect, times);
      }
    }
  }
  return out;
}

/** True when a unit carries an unused revenant passive (once per unit). */
export function hasRevenant(unit) {
  return !unit.revenantUsed && (unit.passives || []).some((passive) => passive.effect?.revenant);
}
