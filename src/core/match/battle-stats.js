// Match-owned lifetime counters. These consume event batches, not render views.
import { clone } from '../util/geometry.js';

const keyOf = (id) => String(id);
const isUnit = (unit) => unit && unit.kind !== 'object';

function metadata(unit) {
  if (unit?.id == null) return null;
  return {
    id: unit.id, name: unit.name ?? String(unit.id), faction: unit.faction ?? null,
    variantId: unit.variantId ?? null, type: unit.cls ?? unit.classId ?? unit.unitId ?? null,
    kind: unit.kind ?? 'unit',
    ...(Number.isFinite(unit.c) ? { c: unit.c } : {}),
    ...(Number.isFinite(unit.r) ? { r: unit.r } : {}),
    ...(Number.isFinite(unit.hp) ? { hp: unit.hp } : {}),
    ...(unit.state ? { state: unit.state } : {}),
  };
}

/** Track attacks and applied ability events for every unit ever seen in the match. */
export function createBattleStats() {
  const units = new Map();
  const abilityCounts = new Map();
  const ensure = (id, faction = null) => {
    if (id == null) return null;
    const key = keyOf(id);
    let entry = units.get(key);
    if (!entry) {
      entry = { id, name: String(id), faction, variantId: null, type: null, kind: 'unit',
        damageDealt: 0, damageTaken: 0, attacks: 0, hits: 0, criticals: 0, abilityUses: {} };
      units.set(key, entry);
    }
    return entry;
  };
  const register = (records = []) => {
    for (const unit of records) {
      const meta = metadata(unit);
      if (!meta) continue;
      const entry = ensure(meta.id, meta.faction);
      for (const [key, value] of Object.entries(meta)) if (value != null) entry[key] = value;
    }
    return snapshot();
  };
  const record = (batches = []) => {
    for (const batch of batches) for (const event of batch?.events || []) {
      if (batch.type === 'combat' && event.type === 'strike' && event.attackerId != null) {
        const attacker = ensure(event.attackerId);
        attacker.attacks += 1;
        if (event.hit) attacker.hits += 1;
        if (event.hit && event.crit) attacker.criticals += 1;
        if (Number.isFinite(event.damage) && event.damage > 0) {
          attacker.damageDealt += event.damage;
          const target = units.get(keyOf(event.targetId));
          if (target && isUnit(target)) target.damageTaken += event.damage;
        }
      }
      if (batch.type === 'abilities' && event.applied === true && event.unitId != null && event.abilityId) {
        const unit = ensure(event.unitId);
        unit.abilityUses[event.abilityId] = (unit.abilityUses[event.abilityId] || 0) + 1;
        abilityCounts.set(event.abilityId, (abilityCounts.get(event.abilityId) || 0) + 1);
      }
    }
    return snapshot();
  };
  const snapshot = () => {
    const list = [...units.values()].filter(isUnit).sort((a, b) => keyOf(a.id).localeCompare(keyOf(b.id)));
    const leader = (field) => list.filter((unit) => unit[field] > 0)
      .sort((a, b) => b[field] - a[field] || keyOf(a.id).localeCompare(keyOf(b.id)))[0] ?? null;
    const topAbility = [...abilityCounts.entries()].map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count || keyOf(a.id).localeCompare(keyOf(b.id)))[0] ?? null;
    return clone({ units: list, leaders: { damageDealt: leader('damageDealt'), damageTaken: leader('damageTaken'), ability: topAbility },
      abilities: Object.fromEntries([...abilityCounts.entries()].sort(([a], [b]) => keyOf(a).localeCompare(keyOf(b)))) });
  };
  const forUnit = (id) => {
    const unit = units.get(keyOf(id));
    return unit && isUnit(unit) ? clone(unit) : null;
  };
  return Object.freeze({ register, record, snapshot, forUnit });
}
