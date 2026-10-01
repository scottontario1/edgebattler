// Shared-snapshot targeting and movement intents for automatic battles.
import { manhattan } from '../util/geometry.js';
import { computeRange, occupancyFromRecords } from '../rules/movement.js';
import { makeRng } from '../util/rng.js';
const positionKey = (p) => String(p.c) + ',' + String(p.r);
const alive = (units) => units.filter((unit) => unit.hp > 0 && unit.kind !== 'object');

function rangeOf(order) {
  const range = order.range;
  if (Array.isArray(range)) return [range[0] ?? 1, range[1] ?? range[0] ?? 1];
  if (Number.isFinite(range)) return [range, range];
  return null;
}
function rangeDistance(distance, range) {
  if (!range) return distance;
  return distance < range[0] ? range[0] - distance : distance > range[1] ? distance - range[1] : 0;
}
function nearestOpponent(unit, snapshot) {
  return snapshot.filter((other) => other.hp > 0 && other.faction !== unit.faction && other.kind !== 'object')
    .sort((a, b) => manhattan(unit, a) - manhattan(unit, b)
      || String(a.id).localeCompare(String(b.id)))[0];
}
function protectSubject(unit, order, snapshot) {
  const id = order.protectId ?? (order.objective?.type === 'protect' ? order.objective.targetId : null);
  const subject = snapshot.find((other) => other.id === id);
  return subject && subject.hp > 0 && subject.faction === unit.faction && subject.id !== unit.id ? subject : null;
}

/** Requested legal target first; otherwise nearest legal enemy. Real units outrank objects. */
export function selectAttackTarget(attacker, snapshot, forecastAttack, targetId) {
  const foes = snapshot.filter((unit) => unit.hp > 0 && unit.faction !== attacker.faction
    && forecastAttack(attacker, unit, { c: attacker.c, r: attacker.r })?.atk?.can);
  const real = foes.filter((unit) => unit.kind !== 'object');
  const eligible = real.length ? real : foes;
  return eligible.find((unit) => unit.id === targetId)
    || eligible.sort((a, b) => manhattan(attacker, a) - manhattan(attacker, b)
      || String(a.id).localeCompare(String(b.id)))[0];
}

/** One movement opportunity from a shared snapshot. Callbacks provide legal candidates and paths. */
export function resolveMovement(units, { orders = {}, legalMoves = () => [], pathForMove = null, rand = makeRng(1) } = {}) {
  const start = units.map((unit) => ({ ...unit }));
  const byId = new Map(start.map((unit) => [unit.id, unit]));
  const occupied = new Set(start.filter((unit) => unit.hp > 0).map(positionKey));
  const intentions = [];
  const events = [];
  for (const unit of alive(start)) {
    const order = orders[unit.id] || {};
    const stance = order.stance || 'advance';
    const protect = stance === 'protect' ? protectSubject(unit, order, start) : null;
    const target = stance === 'protect' ? protect
      : (order.targetId ? byId.get(order.targetId) : nearestOpponent(unit, start));
    const candidates = (legalMoves(unit, start) || []).map(({ c, r }) => ({ c, r }));
    const current = { c: unit.c, r: unit.r };
    const eligible = candidates.filter((p) => (p.c !== current.c || p.r !== current.r) && !occupied.has(positionKey(p)));
    const range = rangeOf(order);
    const distance = target ? manhattan(current, target) : Infinity;
    const alreadyInRange = target && range && stance === 'advance' && distance >= range[0] && distance <= range[1];
    let destination = current;
    let reason = 'no legal movement';
    if (stance === 'hold') reason = 'hold stance';
    else if (stance === 'protect' && !protect) reason = 'invalid protect subject';
    else if (order.destination && stance !== 'protect') {
      destination = order.destination;
      reason = 'explicit destination';
    } else if (stance === 'advance' && target && !alreadyInRange && eligible.length) {
      const score = (p) => rangeDistance(manhattan(p, target), range);
      eligible.sort((a, b) => score(a) - score(b) || a.r - b.r || a.c - b.c);
      if (score(eligible[0]) < rangeDistance(distance, range)) {
        destination = eligible[0];
        reason = 'advanced toward useful attack range';
      } else reason = 'no movement improves attack range';
    } else if (stance === 'protect' && protect) {
      if (distance > 1 && eligible.length) {
        eligible.sort((a, b) => manhattan(a, protect) - manhattan(b, protect) || a.r - b.r || a.c - b.c);
        if (manhattan(eligible[0], protect) < distance) {
          destination = eligible[0];
          reason = 'closing to protect subject';
        } else reason = 'no legal move closer to protect subject';
      } else reason = 'protect subject is already adjacent';
    }
    intentions.push({ unit, from: current, to: { c: destination.c, r: destination.r }, reason });
  }
  // Consume a tie-break value per living combatant, even when it stays.
  const priority = intentions.map((intent) => ({ intent, tie: rand() }))
    .sort((a, b) => a.tie - b.tie || String(a.intent.unit.id).localeCompare(String(b.intent.unit.id)));
  const claimed = new Set();
  const accepted = new Map();
  for (const { intent } of priority) {
    const { unit, from, to } = intent;
    const staying = from.c === to.c && from.r === to.r;
    const blocked = !staying && occupied.has(positionKey(to));
    if (staying || blocked || claimed.has(positionKey(to))) {
      accepted.set(unit.id, staying ? to : from);
      events.push({ type: 'hold', unitId: unit.id, from, to: staying ? to : from,
        reason: staying ? intent.reason : blocked ? 'destination occupied in shared snapshot' : 'destination contested' });
    } else {
      claimed.add(positionKey(to));
      accepted.set(unit.id, to);
      const event = { type: 'move', unitId: unit.id, from, to, reason: intent.reason };
      if (pathForMove) event.path = pathForMove(byId.get(unit.id), to, start);
      events.push(event);
    }
  }
  const moved = start.map((unit) => ({ ...unit, statuses: { ...(unit.statuses || {}) }, ...(accepted.get(unit.id) || {}) }));
  return { units: moved, events };
}

/** Adapt the core pathfinder to battle candidates and an explicit movement allowance. */
export function legalMovesFor({ board, content, movementAllowance = (unit) => unit.mov, blockAllies = false }) {
  if (!board || !content) throw new Error('legalMovesFor needs board and content');
  return (unit, snapshot) => computeRange(unit, board, occupancyFromRecords(snapshot), {
    content, mov: movementAllowance(unit), blockAllies,
  }).move.map(([c, r]) => ({ c, r }));
}
