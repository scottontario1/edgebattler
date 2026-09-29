// Plain-data combat abilities and planning-time spell rules. These functions return copies so the
// game-state owner can decide when to commit the resulting state.

export const DEFAULT_ABILITY_STATE = Object.freeze({
  energy: 0,
  maxEnergy: 4,
  cooldowns: {},
  abilityOrder: [],
  stance: 'advance',
  objective: null,
  energyGainNextTurn: 0,
  statuses: {},
});

export const ABILITIES = Object.freeze({
  rally: Object.freeze({
    id: 'rally', name: 'Rally', cost: 0, cooldown: 2, target: 'self',
    condition: 'always', effect: Object.freeze({ type: 'heal', amount: 10 }),
    energyNow: 1, energyNextTurn: 1,
  }),
});

export function initializeAbilityState(unit, options = {}) {
  const maxEnergy = Math.max(0, options.maxEnergy ?? unit.maxEnergy ?? 4);
  return {
    ...unit,
    energy: clamp(options.energy ?? unit.energy ?? 0, 0, maxEnergy),
    maxEnergy,
    cooldowns: { ...(unit.cooldowns || {}), ...(options.cooldowns || {}) },
    abilityOrder: [...(options.abilityOrder ?? unit.abilityOrder ?? [])],
    stance: options.stance ?? unit.stance ?? 'advance',
    objective: options.objective ?? unit.objective ?? null,
    energyGainNextTurn: options.energyGainNextTurn ?? unit.energyGainNextTurn ?? 0,
    statuses: { ...(unit.statuses || {}), ...(options.statuses || {}) },
  };
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v) || 0));

// Call once at the start of each new round. A two-round cooldown used in round 5 therefore
// remains at 1 throughout round 6 and reaches 0 at the start of round 7.
export function advanceAbilityRound(unit) {
  const next = initializeAbilityState(unit);
  next.cooldowns = Object.fromEntries(Object.entries(next.cooldowns)
    .map(([id, turns]) => [id, Math.max(0, turns - 1)]));
  next.energy = clamp(next.energy + next.energyGainNextTurn, 0, next.maxEnergy);
  next.energyGainNextTurn = 0;
  return next;
}

function conditionMet(ability, unit, context) {
  if (typeof ability.condition === 'function') return ability.condition(unit, context);
  if (ability.condition === 'always' || ability.condition == null) return true;
  if (ability.condition === 'target') return Boolean(context.target && context.target.hp > 0);
  if (ability.condition === 'injured') return Number(unit.hp) < Number(unit.maxHp);
  return false;
}

function targetIsValid(ability, unit, context) {
  if (typeof ability.isValidTarget === 'function') return ability.isValidTarget(unit, context.target, context);
  if (ability.target === 'self') return Number(unit.hp) > 0;
  if (ability.target === 'none') return true;
  return Boolean(context.target && context.target.hp > 0);
}

function applyEffect(unit, ability, context) {
  const target = ability.target === 'self' ? unit : context.target;
  const effect = ability.effect || {};
  if (effect.type === 'heal' && target) {
    const before = Number(target.hp) || 0;
    target.hp = Math.min(Number(target.maxHp) || before, before + Math.max(0, effect.amount || 0));
    return { type: 'heal', targetId: target.id ?? null, amount: target.hp - before };
  }
  if (effect.type === 'damage' && target) {
    const amount = Math.min(Number(target.hp) || 0, Math.max(0, effect.amount || 0));
    target.hp -= amount;
    return { type: 'damage', targetId: target.id ?? null, amount };
  }
  if (effect.type === 'status' && target) {
    target.statuses = { ...(target.statuses || {}), [effect.status]: effect.duration ?? 1 };
    return { type: 'status', targetId: target.id ?? null, status: effect.status, duration: effect.duration ?? 1 };
  }
  return { type: 'none', targetId: target?.id ?? null };
}

/** Evaluate an ordered activation once, with no repeated ability IDs and a hard action cap. */
export function resolveAbilityActivation(unit, context = {}, options = {}) {
  const actor = initializeAbilityState(unit);
  const registry = { ...ABILITIES, ...(options.abilities || {}) };
  const maxAbilities = Math.max(0, Math.floor(options.maxAbilities ?? 3));
  const fired = [];
  const seen = new Set();
  for (const id of actor.abilityOrder) {
    if (fired.length >= maxAbilities) break;
    if (seen.has(id)) continue;
    seen.add(id);
    const ability = registry[id];
    if (!ability || (actor.cooldowns[id] || 0) > 0) continue;
    if (actor.energy < (ability.cost || 0) || !conditionMet(ability, actor, context) || !targetIsValid(ability, actor, context)) continue;
    actor.energy -= ability.cost || 0;
    const effect = applyEffect(actor, ability, context);
    actor.energy = clamp(actor.energy + (ability.energyNow || 0), 0, actor.maxEnergy);
    actor.energyGainNextTurn = (actor.energyGainNextTurn || 0) + (ability.energyNextTurn || 0);
    if ((ability.cooldown || 0) > 0) actor.cooldowns[id] = ability.cooldown;
    fired.push({ abilityId: id, name: ability.name || id, effect, cooldown: ability.cooldown || 0 });
  }
  return { unit: actor, target: context.target, fired, remainingEnergy: actor.energy };
}

export const SPELLS = Object.freeze({
  mend: Object.freeze({ id: 'mend', name: 'Mend', type: 'spell', cost: 1, target: 'friendly-unit', duration: 'instant', effect: Object.freeze({ type: 'heal', amount: 8 }) }),
  ward: Object.freeze({ id: 'ward', name: 'Ward', type: 'spell', cost: 1, target: 'friendly-unit', duration: 'upcoming-battle', effect: Object.freeze({ type: 'status', status: 'ward', duration: 'upcoming-battle' }) }),
  fireburst: Object.freeze({ id: 'fireburst', name: 'Fireburst', type: 'spell', cost: 2, target: 'enemy-area', duration: 'instant', radius: 1, effect: Object.freeze({ type: 'damage', amount: 6 }) }),
});

function spellTargetValid(spell, target) {
  if (!target) return false;
  if (spell.target === 'friendly-unit') return target.kind === 'unit' && target.faction === 'friendly' && Boolean(target.unitId);
  if (spell.target === 'enemy-area') return target.kind === 'area' && Number.isFinite(target.x) && Number.isFinite(target.y);
  return false;
}

/** Queueing reserves Supply immediately; cancelling refunds it. Resolution never charges again. */
export function queueSpell(state, spellId, target, options = {}) {
  const spell = (options.spells || SPELLS)[spellId];
  if (!spell || spell.type !== 'spell') return { ok: false, reason: 'unknown-spell', state };
  if (!spellTargetValid(spell, target)) return { ok: false, reason: 'invalid-target', state };
  const supply = Number(state.supply) || 0;
  if (supply < spell.cost) return { ok: false, reason: 'unaffordable', state };
  const queuedSpells = [...(state.queuedSpells || [])];
  const queueId = options.queueId || `spell-${queuedSpells.length + 1}`;
  queuedSpells.push({ queueId, spellId, target: { ...target }, payment: spell.cost, committed: true });
  return { ok: true, state: { ...state, supply: supply - spell.cost, queuedSpells }, queued: queuedSpells.at(-1) };
}

export function cancelSpell(state, queueId) {
  const queuedSpells = [...(state.queuedSpells || [])];
  const index = queuedSpells.findIndex((cast) => cast.queueId === queueId);
  if (index < 0) return { ok: false, reason: 'not-queued', state };
  const [cast] = queuedSpells.splice(index, 1);
  return { ok: true, state: { ...state, supply: (Number(state.supply) || 0) + (cast.payment || 0), queuedSpells } };
}

export function retargetSpell(state, queueId, target, options = {}) {
  const queue = state.queuedSpells || [];
  const cast = queue.find((item) => item.queueId === queueId);
  const spell = cast && (options.spells || SPELLS)[cast.spellId];
  if (!cast) return { ok: false, reason: 'not-queued', state };
  if (!spellTargetValid(spell, target)) return { ok: false, reason: 'invalid-target', state };
  return { ok: true, state: { ...state, queuedSpells: queue.map((item) => item.queueId === queueId ? { ...item, target: { ...target } } : item) } };
}

function resolveSpellEffect(spell, cast, units, options) {
  const target = cast.target;
  if (spell.target === 'friendly-unit') {
    const unit = units.find((item) => item.id === target.unitId && item.faction === (options.friendlyFaction || 'blue') && item.hp > 0);
    if (!unit) return { queueId: cast.queueId, spellId: cast.spellId, applied: false, reason: 'target-unavailable' };
    if (spell.effect.type === 'heal') {
      const before = unit.hp;
      unit.hp = Math.min(unit.maxHp ?? unit.hp, unit.hp + spell.effect.amount);
      return { queueId: cast.queueId, spellId: cast.spellId, applied: true, targetId: unit.id, amount: unit.hp - before };
    }
    unit.statuses = { ...(unit.statuses || {}), [spell.effect.status]: spell.effect.duration };
    return { queueId: cast.queueId, spellId: cast.spellId, applied: true, targetId: unit.id, status: spell.effect.status, duration: spell.effect.duration };
  }
  const affected = units.filter((unit) => unit.faction !== (options.friendlyFaction || 'blue') && unit.hp > 0 && Math.abs(unit.c - target.x) + Math.abs(unit.r - target.y) <= (spell.radius || 0));
  const events = affected.map((unit) => {
    const amount = Math.min(unit.hp, spell.effect.amount);
    unit.hp -= amount;
    return { targetId: unit.id, amount };
  });
  return { queueId: cast.queueId, spellId: cast.spellId, applied: true, events };
}

/** Resolve the locked battle-start queue against a copied unit list and clear it exactly once. */
export function resolveQueuedSpells(state, units, options = {}) {
  const nextUnits = units.map((unit) => ({ ...unit, statuses: { ...(unit.statuses || {}) } }));
  const events = (state.queuedSpells || []).map((cast) => {
    const spell = (options.spells || SPELLS)[cast.spellId];
    if (!spell || !cast.committed) return { queueId: cast.queueId, spellId: cast.spellId, applied: false, reason: 'invalid-queue-entry' };
    return resolveSpellEffect(spell, cast, nextUnits, options);
  });
  return { state: { ...state, queuedSpells: [] }, units: nextUnits, events };
}

// Skill cards are persistent, transferable type-wide equipment and never enter the spell queue.
export function equipTypeSkill(loadouts, unitType, skill, options = {}) {
  if (!unitType || !skill?.id) return { ok: false, reason: 'invalid-skill', loadouts };
  const current = loadouts[unitType] || [];
  const slots = options.slots ?? 2;
  if (!current.some((item) => item.id === skill.id) && current.length >= slots) return { ok: false, reason: 'no-free-slot', loadouts };
  return { ok: true, loadouts: { ...loadouts, [unitType]: [...current.filter((item) => item.id !== skill.id), { ...skill }] } };
}

export function transferTypeSkill(loadouts, fromType, toType, skillId, options = {}) {
  const skill = (loadouts[fromType] || []).find((item) => item.id === skillId);
  if (!skill) return { ok: false, reason: 'skill-not-equipped', loadouts };
  const without = (loadouts[fromType] || []).filter((item) => item.id !== skillId);
  const removed = { ...loadouts, [fromType]: without };
  const placed = equipTypeSkill(removed, toType, skill, options);
  return placed.ok ? placed : { ok: false, reason: placed.reason, loadouts };
}

export function skillsForUnitType(loadouts, unitType) {
  return [...(loadouts[unitType] || [])].map((skill) => ({ ...skill }));
}
