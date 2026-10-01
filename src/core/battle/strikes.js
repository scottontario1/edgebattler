// Simultaneous strike rolls, mitigation, retaliation, and event creation.
import { manhattan } from '../util/geometry.js';
import { makeRng } from '../util/rng.js';
import { selectAttackTarget } from './targeting.js';
const FACING = Object.freeze({ north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] });
export const FLANK_DAMAGE = 4;

function flankSide(attacker, target) {
  if (Math.abs(attacker.c - target.c) + Math.abs(attacker.r - target.r) !== 1) return null;
  const [fc, fr] = FACING[target.facing] || FACING[target.faction === 'red' ? 'south' : 'north'];
  const dot = (attacker.c - target.c) * fc + (attacker.r - target.r) * fr;
  return dot > 0 ? 'front' : dot < 0 ? 'back' : 'side';
}
function barrierAmount(status) {
  const amount = typeof status === 'number' ? status : status?.amount;
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

/** Resolve one simultaneous strike batch without mutating input records. */
export function resolveStrikes(units, {
  rand = makeRng(1), forecastAttack, orders = {}, canAttack = () => true, damageScale = 1, preserveStatuses = false,
} = {}) {
  const snapshot = units.map((unit) => ({ ...unit }));
  const strikes = [];
  for (const attacker of snapshot.filter((unit) => unit.hp > 0 && unit.kind !== 'object' && canAttack(unit))) {
    const order = orders[attacker.id] || {};
    const target = selectAttackTarget(attacker, snapshot, forecastAttack, order.targetId);
    if (!target) continue;
    const forecast = forecastAttack(attacker, target, { c: attacker.c, r: attacker.r });
    const hit = rand() * 100 < Math.min(100, (forecast.atk.hit ?? 100) + (attacker.statuses?.hitBonus || 0));
    const crit = hit && rand() * 100 < (forecast.atk.crit ?? 0);
    const flank = attacker.cls === 'cavalier' ? flankSide(attacker, target) : null;
    const mountedGuard = attacker.cls === 'cavalier' && target.statuses?.setSpears > 0;
    const spearBonus = target.cls === 'cavalier' ? (attacker.statuses?.setSpears || 0) : 0;
    const flankBonus = flank && flank !== 'front' && !mountedGuard ? FLANK_DAMAGE : 0;
    const offTarget = order.targetId !== undefined && order.targetId !== target.id
      ? (attacker.statuses?.offTargetPenalty || 0) : 0;
    const cultureBonus = (attacker.statuses?.damageDealt || 0)
      + Math.min(attacker.statuses?.ignoreDefense || 0, target.def || 0) - offTarget;
    const base = hit
      ? Math.max(0, (forecast.atk.dmg ?? 0) + (mountedGuard ? 0 : (attacker.statuses?.attackBonus || 0))
        + flankBonus + spearBonus + cultureBonus) * (crit ? 3 : 1)
      : 0;
    const raw = preserveStatuses ? base : damageScale === 1 ? base : Math.round(base * damageScale);
    const warded = target.statuses?.ward === 'upcoming-battle';
    const wardDamage = warded ? Math.floor(raw / 2) : raw;
    const reduced = hit && wardDamage > 0 && target.statuses?.damageTaken
      ? Math.max(0, wardDamage - target.statuses.damageTaken) : wardDamage;
    const damage = preserveStatuses ? Math.round(reduced * damageScale) : reduced;
    strikes.push({ flank, flankBonus, attackBonus: attacker.statuses?.attackBonus || 0,
      ...(spearBonus ? { spearBonus } : {}), ...(mountedGuard ? { mountedGuard: true } : {}),
      attackerId: attacker.id, targetId: target.id, hit, crit, damage, warded,
      barrierAmount: barrierAmount(target.statuses?.barrier), barrierReduction: 0 });
  }

  absorbIncoming(strikes, snapshot);
  const thornEvents = makeThorns(strikes, snapshot);
  const totals = new Map();
  for (const strike of strikes) addDamage(totals, strike.targetId, strike.damage);
  for (const event of thornEvents) addDamage(totals, event.targetId, event.amount);
  const result = snapshot.map((unit) => applyDamage(unit, totals.get(unit.id) || 0,
    strikes.filter((strike) => strike.targetId === unit.id), preserveStatuses));
  const events = [...strikes.map((strike) => ({ type: 'strike', ...strike })), ...thornEvents];
  const before = new Map(snapshot.map((unit) => [unit.id, unit.hp]));
  for (const unit of result) {
    if (unit.hp <= 0 && (before.get(unit.id) || 0) > 0) {
      events.push({ type: unit.kind === 'object' ? 'objectDestroyed' : 'death', unitId: unit.id });
    }
  }
  return { units: result, events };
}

function absorbIncoming(strikes, snapshot) {
  for (const target of snapshot) {
    let barrierLeft = barrierAmount(target.statuses?.barrier);
    let braceLeft = Math.max(0, target.statuses?.brace || 0);
    const incoming = strikes.filter((strike) => strike.targetId === target.id && strike.hit)
      .sort((a, b) => b.damage - a.damage || String(a.attackerId).localeCompare(String(b.attackerId)));
    for (const strike of incoming) {
      strike.braceReduction = Math.min(strike.damage, braceLeft);
      braceLeft -= strike.braceReduction;
      strike.damage -= strike.braceReduction;
      strike.barrierReduction = Math.min(strike.damage, barrierLeft);
      barrierLeft -= strike.barrierReduction;
      strike.damage -= strike.barrierReduction;
    }
  }
}
function makeThorns(strikes, snapshot) {
  const byId = new Map(snapshot.map((unit) => [unit.id, unit]));
  const events = [];
  for (const strike of strikes) {
    if (!strike.hit || strike.damage <= 0) continue;
    const target = byId.get(strike.targetId);
    const attacker = byId.get(strike.attackerId);
    const amount = target?.statuses?.thorns || 0;
    if (amount > 0 && attacker && manhattan(attacker, target) === 1) {
      strike.thorns = amount;
      events.push({ type: 'thorns', unitId: target.id, targetId: attacker.id, amount });
    }
  }
  return events;
}
function applyDamage(unit, amount, incoming, preserveStatuses) {
  const next = { ...unit, hp: Math.max(0, unit.hp - amount) };
  if (preserveStatuses) {
    next.statuses = { ...(unit.statuses || {}) };
    if (incoming.some((strike) => strike.hit)) delete next.statuses.ward;
    if (next.statuses.barrier !== undefined) {
      const left = Math.max(0, barrierAmount(next.statuses.barrier)
        - incoming.reduce((sum, strike) => sum + strike.barrierReduction, 0));
      if (left) next.statuses.barrier = left;
      else delete next.statuses.barrier;
    }
    if (next.statuses.brace !== undefined) {
      next.statuses.brace = Math.max(0, next.statuses.brace
        - incoming.reduce((sum, strike) => sum + (strike.braceReduction || 0), 0));
    }
    return next;
  }
  next.statuses = { ...(unit.statuses || {}) };
  if (next.statuses.ward === 'upcoming-battle') delete next.statuses.ward;
  delete next.statuses.barrier;
  for (const key of ['brace', 'attackBonus', 'hitBonus', 'setSpears', 'equipStr', 'equipDef', 'thorns',
    'damageTaken', 'damageDealt', 'ignoreDefense', 'offTargetPenalty', 'energyWhenStruck']) delete next.statuses[key];
  return next;
}
function addDamage(totals, id, amount) {
  totals.set(id, (totals.get(id) || 0) + amount);
}
