/**
 * Presentation-independent resolver for one automatic round.
 *
 * resolveBattleRound({ units, legalMoves, seed, forecastAttack }) accepts plain
 * records with id/faction/c/r/hp fields. legalMoves(unit, snapshot) may return
 * any legal destination coordinates for that unit's full automatic movement
 * allowance. forecastAttack(attacker, defender, from) may adapt combat.js;
 * absent it, a simple Manhattan-range attack is used. Returns copied unit
 * records and immutable-style event data grouped into movement and combat
 * batches. Events are descriptions only and never mutate returned state.
 */
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const manhattan = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
const positionKey = (p) => `${p.c},${p.r}`;

function makeRng(seed) {
  let state = (Number(seed) >>> 0) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function defaultMoves(unit, snapshot) {
  const occupied = new Set(snapshot.filter((u) => u.hp > 0 && u.id !== unit.id).map(positionKey));
  return DIRECTIONS.map(([dc, dr]) => ({ c: unit.c + dc, r: unit.r + dr }))
    .filter((p) => !occupied.has(positionKey(p)));
}

function defaultForecast(a, d, from) {
  const distance = Math.abs(from.c - d.c) + Math.abs(from.r - d.r);
  const range = Array.isArray(a.range) ? a.range : [1, 1];
  const can = distance >= (range[0] ?? 1) && distance <= (range[1] ?? range[0] ?? 1);
  return { dist: distance, atk: { can, dmg: Math.max(0, (a.str ?? 1) - (d.def ?? 0)), hit: 100, crit: 0 }, def: { can: false } };
}

function nearestOpponent(unit, snapshot) {
  return snapshot.filter((u) => u.hp > 0 && u.faction !== unit.faction)
    .sort((a, b) => manhattan(unit, a) - manhattan(unit, b) || String(a.id).localeCompare(String(b.id)))[0];
}

function attackRange(unit, order) {
  const range = order.range ?? unit.range;
  if (Array.isArray(range)) return [range[0] ?? 1, range[1] ?? range[0] ?? 1];
  if (Number.isFinite(range)) return [range, range];
  return null;
}

function protectSubject(unit, order, snapshot) {
  const objective = order.objective;
  const requestedId = order.protectId
    ?? (typeof objective === 'object' && objective?.type === 'protect' ? objective.targetId : null);
  const subject = requestedId == null ? null : snapshot.find((u) => u.id === requestedId);
  return subject && subject.hp > 0 && subject.faction === unit.faction && subject.id !== unit.id
    ? subject : null;
}

/** Resolve both sides' planned movement and combat from shared snapshots. */
export function resolveBattleRound({
  units, legalMoves = defaultMoves, orders = {}, seed = 1,
  forecastAttack = defaultForecast,
} = {}) {
  if (!Array.isArray(units)) throw new TypeError('units must be an array');
  const rand = makeRng(seed);
  const start = units.map((u) => ({ ...u }));
  const byId = new Map(start.map((u) => [u.id, u]));
  const movementEvents = [];
  const intentions = [];

  // Intents are computed exclusively from the starting snapshot.
  for (const unit of start.filter((u) => u.hp > 0)) {
    const order = orders[unit.id] || {};
    const stance = order.stance || 'advance';
    const protect = stance === 'protect' ? protectSubject(unit, order, start) : null;
    const target = stance === 'protect' ? protect : (order.targetId ? byId.get(order.targetId) : nearestOpponent(unit, start));
    const candidates = (legalMoves(unit, start) || []).map((p) => ({ c: p.c, r: p.r }));
    const current = { c: unit.c, r: unit.r };
    const eligible = candidates.filter((p) => p.c !== current.c || p.r !== current.r);
    const range = attackRange(unit, order);
    const currentDistance = target ? manhattan(current, target) : Infinity;
    const alreadyInRange = target && range && stance === 'advance'
      && currentDistance >= range[0] && currentDistance <= range[1];
    let destination = current;
    let reason = 'no legal movement';
    if (stance === 'hold') {
      reason = 'hold stance';
    } else if (stance === 'protect' && !protect) {
      reason = 'invalid protect subject';
    } else if (order.destination && stance !== 'protect') {
      destination = order.destination;
      reason = 'explicit destination';
    } else if (stance === 'advance' && target && !alreadyInRange && eligible.length) {
      const distanceScore = (p) => {
        const d = manhattan(p, target);
        if (!range) return d;
        return d < range[0] ? range[0] - d : d > range[1] ? d - range[1] : 0;
      };
      eligible.sort((a, b) => distanceScore(a) - distanceScore(b) || a.r - b.r || a.c - b.c);
      if (distanceScore(eligible[0]) < (range ? Math.abs(currentDistance < range[0] ? range[0] - currentDistance : currentDistance > range[1] ? currentDistance - range[1] : 0) : currentDistance)) {
        destination = eligible[0];
        reason = 'advanced toward useful attack range';
      } else reason = 'no movement improves attack range';
    } else if (stance === 'protect' && protect) {
      // Protect only repositions to an adjacent tile, and only when currently
      // farther than one tile from its living friendly subject.
      if (currentDistance > 1 && eligible.length) {
        eligible.sort((a, b) => manhattan(a, protect) - manhattan(b, protect) || a.r - b.r || a.c - b.c);
        if (manhattan(eligible[0], protect) < currentDistance) {
          destination = eligible[0];
          reason = 'closing to protect subject';
        } else reason = 'no legal move closer to protect subject';
      } else reason = protect ? 'protect subject is already adjacent' : 'invalid protect subject';
    }
    intentions.push({ unit, from: current, to: { c: destination.c, r: destination.r }, reason });
  }

  // Contested destinations are awarded by deterministic seeded priority, with
  // original occupants blocking movement even when they intend to leave.
  const priority = intentions.map((intent) => ({ intent, tie: rand() }))
    .sort((a, b) => a.tie - b.tie || String(a.intent.unit.id).localeCompare(String(b.intent.unit.id)));
  const originalOccupants = new Set(start.filter((u) => u.hp > 0).map(positionKey));
  const claimed = new Set();
  const accepted = new Map();
  for (const { intent } of priority) {
    const { unit, from, to } = intent;
    const key = positionKey(to);
    const stays = from.c === to.c && from.r === to.r;
    const blockedByOriginal = !stays && originalOccupants.has(key);
    if (stays || blockedByOriginal || claimed.has(key)) {
      accepted.set(unit.id, stays ? to : from);
      movementEvents.push({ type: 'hold', unitId: unit.id, from, to: stays ? to : from,
        reason: stays ? intent.reason : blockedByOriginal ? 'destination occupied in shared snapshot' : 'destination contested' });
    } else {
      claimed.add(key);
      accepted.set(unit.id, to);
      movementEvents.push({ type: 'move', unitId: unit.id, from, to, reason: intent.reason });
    }
  }
  const moved = start.map((u) => ({ ...u, ...(accepted.get(u.id) || {}) }));

  // Every living unit declares at most one strike against the same post-move
  // snapshot; hits and damage are computed before any HP is committed.
  const combatSnapshot = moved.map((u) => ({ ...u }));
  const strikes = [];
  for (const attacker of combatSnapshot.filter((u) => u.hp > 0)) {
    const order = orders[attacker.id] || {};
    const target = (order.targetId ? combatSnapshot.find((u) => u.id === order.targetId) : null)
      || combatSnapshot.filter((u) => u.hp > 0 && u.faction !== attacker.faction)
        .sort((a, b) => manhattan(attacker, a) - manhattan(attacker, b) || String(a.id).localeCompare(String(b.id)))[0];
    if (!target || target.hp <= 0) continue;
    const f = forecastAttack(attacker, target, { c: attacker.c, r: attacker.r });
    if (!f?.atk?.can) continue;
    const hit = rand() * 100 < (f.atk.hit ?? 100);
    const crit = hit && rand() * 100 < (f.atk.crit ?? 0);
    const rawDamage = hit ? Math.max(0, f.atk.dmg ?? 0) * (crit ? 3 : 1) : 0;
    const warded = target.statuses?.ward === 'upcoming-battle';
    const mitigatedDamage = warded ? Math.floor(rawDamage / 2) : rawDamage;
    const barrier = target.statuses?.barrier;
    const barrierAmount = typeof barrier === 'number' ? barrier : barrier?.amount;
    const damage = Math.min(target.hp, mitigatedDamage);
    strikes.push({ attackerId: attacker.id, targetId: target.id, hit, crit, damage, warded,
      barrierAmount: Number.isFinite(barrierAmount) ? Math.max(0, barrierAmount) : 0, barrierReduction: 0 });
  }
  // Apply Barrier once to the target's battle-wide incoming total. Attribute that
  // reduction to the strongest landed strike, breaking ties by attacker ID so
  // simultaneous combat never depends on unit-array iteration order.
  for (const target of combatSnapshot) {
    const incoming = strikes.filter((strike) => strike.targetId === target.id && strike.hit && strike.damage > 0 && strike.barrierAmount > 0);
    if (!incoming.length) continue;
    incoming.sort((a, b) => b.damage - a.damage || String(a.attackerId).localeCompare(String(b.attackerId)));
    const chosen = incoming[0];
    chosen.barrierReduction = Math.min(chosen.damage, chosen.barrierAmount);
    chosen.damage -= chosen.barrierReduction;
  }
  const damageById = new Map();
  for (const strike of strikes) damageById.set(strike.targetId, (damageById.get(strike.targetId) || 0) + strike.damage);
  const result = combatSnapshot.map((u) => {
    const next = { ...u, hp: Math.max(0, u.hp - (damageById.get(u.id) || 0)) };
    if (next.statuses?.ward === 'upcoming-battle') {
      next.statuses = { ...next.statuses };
      delete next.statuses.ward;
    }
    // Type-wide Barrier is one first-hit reduction for the upcoming battle, then expires.
    if (next.statuses?.barrier !== undefined) {
      next.statuses = { ...next.statuses };
      delete next.statuses.barrier;
    }
    if (next.statuses && Object.keys(next.statuses).length === 0) delete next.statuses;
    return next;
  });
  const combatEvents = strikes.map((s) => ({ type: 'strike', ...s }));
  for (const u of result) {
    if (u.hp <= 0 && (byId.get(u.id)?.hp ?? 0) > 0) combatEvents.push({ type: 'death', unitId: u.id });
  }
  return {
    units: result,
    batches: [
      { type: 'movement', events: movementEvents },
      { type: 'combat', events: combatEvents },
    ],
  };
}
