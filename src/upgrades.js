/** Pure rules for explicit three-of-a-kind unit upgrades.
 * Records are paid reserves or deployed units. Hand cards are never ingredients.
 */

export const UPGRADE_MAX_STARS = 3;
/** Prototype population costs by star tier. Callers may override this table per match. */
export const UPGRADE_POPULATION_BY_STARS = Object.freeze({ 1: 1, 2: 2, 3: 3 });
export const STAR_STAT_GROWTH = Object.freeze({
  // A focused improvement: upgrades do not triple every class statistic.
  maxHp: 8,
  hp: 8,
  str: 2,
  mag: 1,
  skl: 1,
  spd: 1,
  def: 2,
  res: 1,
  mov: 0,
});

const clone = (value) => globalThis.structuredClone
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));
const finite = (value) => Number.isFinite(value);
const identity = (unit) => [unit.classId ?? unit.unitId ?? unit.cls, unit.variantId ?? unit.variant ?? '', unit.faction ?? '']
  .map(String).join('\u0000');
const isEligible = (unit) => unit && unit.type !== 'spell' && unit.type !== 'unit-card'
  && unit.state !== 'hand' && unit.state !== 'card'
  && !unit.isHero && !unit.hero && !unit.commander
  && !['brenna', 'dreg', 'paladin', 'barbarian'].includes(String(unit.unitId ?? unit.cls ?? unit.classId).toLowerCase())
  && finite(unit.stars ?? 1) && (unit.stars ?? 1) >= 1 && (unit.stars ?? 1) < UPGRADE_MAX_STARS;

/** Return candidate groups keyed by exact unit identity and star level. */
export function findUpgradeMatches(records = []) {
  const groups = new Map();
  for (const unit of records) {
    if (!isEligible(unit)) continue;
    const key = `${identity(unit)}\u0000${unit.stars ?? 1}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(unit.id);
  }
  return [...groups.values()].filter((ids) => ids.length >= 3).map((ids) => ids.slice(0, 3));
}

function validate(records, selectedIds) {
  if (!Array.isArray(records) || !Array.isArray(selectedIds) || selectedIds.length !== 3
    || new Set(selectedIds).size !== 3) return { ok: false, reason: 'select-exactly-three-distinct-units' };
  const selected = selectedIds.map((id) => records.find((unit) => unit.id === id));
  if (selected.some((unit) => !isEligible(unit))) return { ok: false, reason: 'ineligible-upgrade-ingredient' };
  const [first, ...rest] = selected;
  if (rest.some((unit) => identity(unit) !== identity(first) || (unit.stars ?? 1) !== (first.stars ?? 1))) {
    return { ok: false, reason: 'units-must-match-identity-faction-and-stars' };
  }
  return { ok: true, selected, stars: first.stars ?? 1 };
}

function makeResult(selected, stars, survivorId, destination) {
  const survivor = selected.find((unit) => unit.id === survivorId);
  const result = clone(survivor);
  result.stars = stars + 1;
  const oldMax = selected.reduce((sum, unit) => sum + (finite(unit.maxHp) && unit.maxHp > 0 ? unit.maxHp : 0), 0);
  const oldHp = selected.reduce((sum, unit) => sum + (finite(unit.hp) ? Math.max(0, unit.hp) : (finite(unit.maxHp) ? unit.maxHp : 0)), 0);
  for (const [stat, growth] of Object.entries(STAR_STAT_GROWTH)) {
    if (stat === 'hp' || stat === 'maxHp') continue;
    if (finite(survivor[stat])) result[stat] = survivor[stat] + growth;
  }
  if (finite(survivor.maxHp)) {
    result.maxHp = survivor.maxHp + STAR_STAT_GROWTH.maxHp;
    const ratio = oldMax > 0 ? Math.max(0, Math.min(1, oldHp / oldMax)) : 1;
    result.hp = Math.min(result.maxHp, Math.max(0, Math.round(result.maxHp * ratio)));
  }
  // Carry the most conservative shared state forward; no energy refill/cooldown reset.
  const energies = selected.map((unit) => unit.energy).filter(finite);
  if (energies.length) result.energy = Math.min(...energies);
  const cooldowns = selected.map((unit) => unit.cooldowns).filter((value) => value && typeof value === 'object');
  if (cooldowns.length) {
    result.cooldowns = {};
    for (const key of new Set(cooldowns.flatMap((value) => Object.keys(value)))) {
      result.cooldowns[key] = Math.max(...cooldowns.map((value) => finite(value[key]) ? value[key] : 0));
    }
  }
  // Runtime unit records use a status map (for example { ward: 'upcoming-battle' }).
  // Older/plain records may provide a list, so accept both shapes while retaining
  // the longest numeric duration and any distinct named status.
  const statuses = {};
  for (const unit of selected) {
    const source = unit.statuses;
    const entries = Array.isArray(source)
      ? source.map((status) => typeof status === 'string' ? [status, true] : [status?.id ?? status?.type, status])
      : Object.entries(source || {});
    for (const [key, value] of entries) {
      if (!key) continue;
      const current = statuses[key];
      statuses[key] = finite(current) && finite(value) ? Math.max(current, value) : (current ?? clone(value));
    }
  }
  result.statuses = statuses;
  // The chosen survivor retains stance, objective, orders, and its board location unless
  // the caller explicitly directs the upgraded record to the reserve bench.
  if (destination === 'reserve') {
    result.state = 'reserve';
    delete result.c;
    delete result.r;
  }
  return result;
}

/** Preview a proposed combination. This never mutates the supplied records. */
export function previewUpgrade(records, selectedIds, {
  survivorId, destination, populationByStars = UPGRADE_POPULATION_BY_STARS,
} = {}) {
  const checked = validate(records, selectedIds);
  if (!checked.ok) return checked;
  if (!survivorId || !destination) return { ok: false, reason: 'survivor-and-destination-choice-required' };
  if (!checked.selected.some((unit) => unit.id === survivorId)) return { ok: false, reason: 'survivor-must-be-selected' };
  if (destination !== undefined && !['reserve', 'field'].includes(destination)) return { ok: false, reason: 'invalid-destination' };
  const next = makeResult(checked.selected, checked.stars, survivorId, destination);
  const populationBefore = checked.selected.reduce((sum, unit) => sum + (finite(unit.population) ? unit.population : 1), 0);
  // Population is defined by resulting star tier, not inherited from the chosen survivor.
  // This deliberately allows different tiers to produce different net population changes.
  const populationAfter = finite(populationByStars?.[next.stars])
    ? populationByStars[next.stars]
    : next.stars;
  next.population = populationAfter;
  return {
    ok: true,
    consumedIds: [...selectedIds],
    survivorId,
    destination,
    unit: next,
    stars: { from: checked.stars, to: checked.stars + 1 },
    population: { before: populationBefore, after: populationAfter, delta: populationAfter - populationBefore },
    supplyCost: 0,
  };
}

/** Apply an explicitly confirmed preview to a new records array. Invalid requests are no-ops. */
export function combineUnits(records, selectedIds, choices = {}) {
  const preview = previewUpgrade(records, selectedIds, choices);
  if (!preview.ok) return { ok: false, reason: preview.reason, records };
  const consumed = new Set(preview.consumedIds);
  const next = records.filter((unit) => !consumed.has(unit.id)).map(clone);
  next.push(clone(preview.unit));
  return { ok: true, records: next, unit: clone(preview.unit), consumedIds: preview.consumedIds,
    populationDelta: preview.population.delta, supplyCost: 0 };
}
