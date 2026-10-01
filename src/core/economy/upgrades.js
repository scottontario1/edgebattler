// Explicit three-of-a-kind unit upgrades. Hand cards are never ingredients.
import { STAR_STAT_GROWTH, UPGRADE_MAX_STARS, UPGRADE_POPULATION_BY_STARS } from '../content/grades.js';
import { clone, finite } from './common.js';

const identity = (unit) => [unit.classId ?? unit.unitId ?? unit.cls, unit.variantId ?? unit.variant ?? '', unit.faction ?? '', unit.rarity ?? 'common']
  .map(String).join('\u0000');
const isEligible = (unit, content) => unit && unit.type !== 'spell' && unit.type !== 'unit-card'
  && unit.state !== 'hand' && unit.state !== 'card'
  && !unit.isHero && !unit.hero && !unit.commander && !unit.champion
  && !content.championTemplates[unit.id] && !content.championTemplates[unit.unitId]
  && !['brenna', 'dreg', 'paladin', 'barbarian'].includes(String(unit.unitId ?? unit.cls ?? unit.classId).toLowerCase())
  && finite(unit.stars ?? 1) && (unit.stars ?? 1) >= 1 && (unit.stars ?? 1) < UPGRADE_MAX_STARS;

/** Candidate groups by exact class/variant/faction/rarity identity and star grade. */
export function findUpgradeMatches(records = [], content) {
  if (!content?.championTemplates) throw new TypeError('findUpgradeMatches requires a content context');
  const groups = new Map();
  for (const unit of records) {
    if (!isEligible(unit, content)) continue;
    const key = `${identity(unit)}\u0000${unit.stars ?? 1}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(unit.id);
  }
  return [...groups.values()].filter((ids) => ids.length >= 3).map((ids) => ids.slice(0, 3));
}

function validate(records, selectedIds, content) {
  if (!Array.isArray(records) || !Array.isArray(selectedIds) || selectedIds.length !== 3
    || new Set(selectedIds).size !== 3) return { ok: false, reason: 'select-exactly-three-distinct-units' };
  const selected = selectedIds.map((id) => records.find((unit) => unit.id === id));
  if (selected.some((unit) => !isEligible(unit, content))) return { ok: false, reason: 'ineligible-upgrade-ingredient' };
  const [first, ...rest] = selected;
  if (rest.some((unit) => identity(unit) !== identity(first) || (unit.stars ?? 1) !== (first.stars ?? 1))) {
    return { ok: false, reason: 'units-must-match-identity-faction-and-stars' };
  }
  return { ok: true, selected, stars: first.stars ?? 1 };
}

function makeResult(selected, stars, survivorId, destination) {
  const survivor = selected.find((unit) => unit.id === survivorId);
  const result = clone(survivor);
  result.costPaid = selected.reduce((sum, unit) => sum + (unit.costPaid ?? 0), 0);
  result.stars = stars + 1;
  const oldMax = selected.reduce((sum, unit) => sum + (finite(unit.maxHp) && unit.maxHp > 0 ? unit.maxHp : 0), 0);
  const oldHp = selected.reduce((sum, unit) => sum + (finite(unit.hp)
    ? Math.max(0, unit.hp)
    : (finite(unit.maxHp) ? unit.maxHp : 0)), 0);
  for (const [stat, growth] of Object.entries(STAR_STAT_GROWTH)) {
    if (stat !== 'hp' && stat !== 'maxHp' && finite(survivor[stat])) result[stat] = survivor[stat] + growth;
  }
  if (finite(survivor.maxHp)) {
    result.maxHp = survivor.maxHp + STAR_STAT_GROWTH.maxHp;
    const ratio = oldMax > 0 ? Math.max(0, Math.min(1, oldHp / oldMax)) : 1;
    result.hp = Math.min(result.maxHp, Math.max(0, Math.round(result.maxHp * ratio)));
  }
  const energies = selected.map((unit) => unit.energy).filter(finite);
  if (energies.length) result.energy = Math.min(...energies);
  const cooldowns = selected.map((unit) => unit.cooldowns).filter((value) => value && typeof value === 'object');
  if (cooldowns.length) {
    result.cooldowns = {};
    for (const key of new Set(cooldowns.flatMap((value) => Object.keys(value)))) {
      result.cooldowns[key] = Math.max(...cooldowns.map((value) => finite(value[key]) ? value[key] : 0));
    }
  }
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
  if (destination === 'reserve') {
    result.state = 'reserve';
    delete result.c;
    delete result.r;
  }
  return result;
}

/** Validate and preview an upgrade without changing records. */
export function previewUpgrade(records, selectedIds, content, {
  survivorId, destination, populationByStars = UPGRADE_POPULATION_BY_STARS,
} = {}) {
  if (!content?.championTemplates) throw new TypeError('previewUpgrade requires a content context');
  const checked = validate(records, selectedIds, content);
  if (!checked.ok) return checked;
  if (!survivorId || !destination) return { ok: false, reason: 'survivor-and-destination-choice-required' };
  if (!checked.selected.some((unit) => unit.id === survivorId)) return { ok: false, reason: 'survivor-must-be-selected' };
  if (!['reserve', 'field'].includes(destination)) return { ok: false, reason: 'invalid-destination' };
  const unit = makeResult(checked.selected, checked.stars, survivorId, destination);
  const populationBefore = checked.selected.reduce((sum, item) => sum + (finite(item.population) ? item.population : 1), 0);
  const populationAfter = finite(populationByStars?.[unit.stars]) ? populationByStars[unit.stars] : unit.stars;
  unit.population = populationAfter;
  return {
    ok: true,
    consumedIds: [...selectedIds],
    survivorId,
    destination,
    unit,
    stars: { from: checked.stars, to: checked.stars + 1 },
    population: { before: populationBefore, after: populationAfter, delta: populationAfter - populationBefore },
    supplyCost: 0,
  };
}

/** Apply a confirmed upgrade to a new records array; invalid selections are no-ops. */
export function combineUnits(records, selectedIds, content, choices = {}) {
  const preview = previewUpgrade(records, selectedIds, content, choices);
  if (!preview.ok) return { ok: false, reason: preview.reason, records };
  const consumed = new Set(preview.consumedIds);
  const next = records.filter((unit) => !consumed.has(unit.id)).map(clone);
  next.push(clone(preview.unit));
  return {
    ok: true,
    records: next,
    unit: clone(preview.unit),
    consumedIds: preview.consumedIds,
    populationDelta: preview.population.delta,
    supplyCost: 0,
  };
}
