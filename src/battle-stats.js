/**
 * Presentation-independent lifetime statistics for a battle.
 *
 * Feed current field units and reserves to register before a round, then feed
 * that round's authoritative presentation batches once to record. Counters
 * live for the lifetime of this tracker, so removing a fallen unit from the
 * current roster does not erase its contribution.
 */
const copy = (value) => JSON.parse(JSON.stringify(value));
const idKey = (id) => String(id);

function unitMetadata(unit = {}) {
  const id = unit.id;
  if (id == null) return null;
  const cls = unit.cls ?? unit.classId ?? unit.unitId ?? unit.type ?? null;
  return {
    id,
    name: unit.name ?? String(id),
    faction: unit.faction ?? null,
    variantId: unit.variantId ?? null,
    type: cls,
    kind: unit.kind ?? 'unit',
    ...(Number.isFinite(unit.c)?{c:unit.c}:{}),...(Number.isFinite(unit.r)?{r:unit.r}:{}),
    ...(Number.isFinite(unit.hp)?{hp:unit.hp}:{}),...(unit.state?{state:unit.state}:{}),
  };
}

function makeUnit(unit) {
  return {
    ...unitMetadata(unit),
    damageDealt: 0,
    damageTaken: 0,
    attacks: 0,
    hits: 0,
    criticals: 0,
    abilityUses: {},
  };
}

function refreshMetadata(record, unit) {
  const meta = unitMetadata(unit);
  if (!meta) return;
  for (const key of ['name', 'faction', 'variantId', 'type', 'kind','c','r','hp','state']) {
    // Sparse summary metadata should not erase richer roster data.
    if (key === 'name' && unit.name == null) continue;
    if (meta[key] != null && meta[key] !== '') record[key] = meta[key];
  }
}

const isCombatUnit = (unit) => unit && unit.kind !== 'object';
const compareId = (a, b) => idKey(a.id).localeCompare(idKey(b.id));

/** Create an in-memory stats tracker. No game state or log entries are mutated. */
export function createBattleStats() {
  const units = new Map();
  const abilityCounts = new Map();

  function register(records = []) {
    if (!Array.isArray(records)) throw new TypeError('units must be an array');
    for (const unit of records) {
      const meta = unitMetadata(unit);
      if (!meta) continue;
      const key = idKey(meta.id);
      const existing = units.get(key);
      if (existing) refreshMetadata(existing, unit);
      else units.set(key, makeUnit(unit));
    }
    return snapshot();
  }

  function ensure(id, faction = null) {
    if (id == null) return null;
    const key = idKey(id);
    let unit = units.get(key);
    if (!unit) {
      // Combat batches normally arrive after register(). This fallback preserves
      // identifiable participants from logs when a summary omitted them.
      unit = makeUnit({ id, faction, name: String(id) });
      units.set(key, unit);
    } else if (!unit.faction && faction) unit.faction = faction;
    return unit;
  }

  function record(batches = []) {
    if (!Array.isArray(batches)) throw new TypeError('batches must be an array');
    for (const batch of batches) {
      if (!batch || !Array.isArray(batch.events)) continue;
      if (batch.type === 'combat') {
        for (const event of batch.events) {
          if (event?.type !== 'strike' || event.attackerId == null) continue;
          const attacker = ensure(event.attackerId);
          if (!isCombatUnit(attacker)) continue;
          attacker.attacks += 1;
          if (event.hit) attacker.hits += 1;
          if (event.hit && event.crit) attacker.criticals += 1;
          if (Number.isFinite(event.damage) && event.damage > 0) {
            attacker.damageDealt += event.damage;
            // Objects can be struck, but do not appear in unit damage-taken
            // rankings. Only count targets known as living units/reserves.
            const target = units.get(idKey(event.targetId));
            if (target && isCombatUnit(target)) target.damageTaken += event.damage;
          }
        }
      } else if (batch.type === 'abilities') {
        for (const event of batch.events) {
          if (event?.applied !== true || event.unitId == null || event.abilityId == null) continue;
          const unit = ensure(event.unitId);
          if (!isCombatUnit(unit)) continue;
          unit.abilityUses[event.abilityId] = (unit.abilityUses[event.abilityId] || 0) + 1;
          abilityCounts.set(event.abilityId, (abilityCounts.get(event.abilityId) || 0) + 1);
        }
      }
    }
    return snapshot();
  }

  function snapshot() {
    const list = [...units.values()].filter(isCombatUnit).sort(compareId);
    const best = (field) => list.filter((unit) => unit[field] > 0)
      .sort((a, b) => b[field] - a[field] || compareId(a, b))[0] ?? null;
    const topAbility = [...abilityCounts.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count || idKey(a.id).localeCompare(idKey(b.id)))[0] ?? null;
    const abilities = Object.fromEntries([...abilityCounts.entries()]
      .sort(([a], [b]) => idKey(a).localeCompare(idKey(b))));
    return copy({
      units: list,
      leaders: {
        damageDealt: best('damageDealt'),
        damageTaken: best('damageTaken'),
        ability: topAbility,
      },
      abilities,
    });
  }

  function forUnit(id) {
    const unit = units.get(idKey(id));
    return unit && isCombatUnit(unit) ? copy(unit) : null;
  }

  return { register, record, snapshot, forUnit };
}

/**
 * Rebuild battle stats from saved JSONL entries. Supply known starting/current
 * units when available; summaries also provide faction and IDs for units that
 * joined during play. Campaign headers carry every authored wave's metadata.
 */
export function reportFromLog(entries, units = []) {
  const tracker = createBattleStats();
  tracker.register(units);
  const list = Array.isArray(entries) ? entries : [];
  for (const entry of list) {
    if (entry?.t === 'header' && Array.isArray(entry.campaign?.stages)) {
      const waves = entry.campaign.stages.flatMap((stage) => stage.waves || []).flat();
      tracker.register(waves);
    }
    if (entry?.t === 'summary') {
      for (const faction of ['blue', 'red']) {
        const side = entry[faction];
        if (!side) continue;
        if (Array.isArray(side.unitState)) tracker.register(side.unitState.map((unit) => ({
          ...unit, faction, kind: 'unit',
        })));
        if (Array.isArray(side.reserveState)) tracker.register(side.reserveState.map((unit) => ({
          ...unit, faction, type: unit.cls ?? unit.classId ?? unit.unitId,
          kind: 'unit',
        })));
      }
    }
    if (entry?.t === 'round') tracker.record(entry.batches || []);
  }
  return tracker.snapshot();
}
