// Shard catalogue: passive class-wide boosts bought from the hand into a shard dock, then applied to
// a unit class. This module is data plus the text helpers the cards print; the dock, apply and combine
// mechanics belong to src/core/economy/.

export const SHARD_RULES = Object.freeze({ dockSlots: 12, classSlots: 3, maxTier: 3, poolTypes: 4 });
export const SHARD_TIER_LABELS = Object.freeze(['I', 'II', 'III']);

/** Stat keys that change unit records directly (tracked per unit in `unit.shardBonus`). */
export const SHARD_STAT_KEYS = Object.freeze(['str', 'def', 'maxHp', 'spd', 'skl']);
/** Effect keys read at battle or round time from the class's applied list. */
export const SHARD_EFFECT_KEYS = Object.freeze(['block', 'regen', 'thorns']);

/**
 * `key` is the bonus key; `kind` is 'stat' (folded into unit stats) or 'effect' (battle/round effect).
 * `values` are the tier I, II and III amounts.
 */
export const SHARDS = Object.freeze({
  ruby: Object.freeze({ id: 'ruby', name: 'Ruby', title: 'Might', color: '#d6334a', kind: 'stat', key: 'str', values: Object.freeze([1, 2, 4]), label: 'Strength' }),
  sapphire: Object.freeze({ id: 'sapphire', name: 'Sapphire', title: 'Guard', color: '#2f6fe0', kind: 'stat', key: 'def', values: Object.freeze([1, 2, 4]), label: 'Defence' }),
  emerald: Object.freeze({ id: 'emerald', name: 'Emerald', title: 'Vigor', color: '#2fae5c', kind: 'stat', key: 'maxHp', values: Object.freeze([3, 6, 12]), label: 'Max HP' }),
  topaz: Object.freeze({ id: 'topaz', name: 'Topaz', title: 'Swiftness', color: '#f0b429', kind: 'stat', key: 'spd', values: Object.freeze([1, 2, 4]), label: 'Speed' }),
  amethyst: Object.freeze({ id: 'amethyst', name: 'Amethyst', title: 'Focus', color: '#9b59d0', kind: 'stat', key: 'skl', values: Object.freeze([2, 4, 8]), label: 'Skill (hit and crit)' }),
  garnet: Object.freeze({ id: 'garnet', name: 'Garnet', title: 'Bulwark', color: '#a8401f', kind: 'effect', key: 'block', values: Object.freeze([1, 2, 4]), label: 'Blocks damage each battle' }),
  pearl: Object.freeze({ id: 'pearl', name: 'Pearl', title: 'Renewal', color: '#e8e2d4', kind: 'effect', key: 'regen', values: Object.freeze([2, 4, 8]), label: 'Heals at the start of each round' }),
  onyx: Object.freeze({ id: 'onyx', name: 'Onyx', title: 'Thorns', color: '#3a3a4a', kind: 'effect', key: 'thorns', values: Object.freeze([1, 2, 4]), label: 'Damage back to an adjacent attacker per hit taken' }),
});

export const SHARD_IDS = Object.freeze(Object.keys(SHARDS));

/** Amount a shard gives at a tier (1 to 3); 0 for an unknown shard or tier. */
export function shardValue(shardId, tier) {
  return SHARDS[shardId]?.values[tier - 1] ?? 0;
}

/** "Ruby II" style label. */
export function shardLabel(shardId, tier) {
  return `${SHARDS[shardId]?.name ?? shardId} ${SHARD_TIER_LABELS[tier - 1] ?? tier}`;
}

/** "+2 Strength" for stat shards, "Blocks damage each battle: 2" for effect shards. */
export function shardEffectText(shardId, tier) {
  const shard = SHARDS[shardId];
  if (!shard) return '';
  const value = shardValue(shardId, tier);
  return shard.kind === 'stat' ? `+${value} ${shard.label}` : `${shard.label}: ${value}`;
}

/** Tier I shard cards, one per type. The card key is the shard id. */
export const SHARD_CARDS = Object.freeze(Object.fromEntries(SHARD_IDS.map((id) => [id, Object.freeze({
  id: `shard-${id}`,
  type: 'shard',
  rarity: 'common',
  shardId: id,
  tier: 1,
  name: `${SHARDS[id].name} Shard`,
  title: SHARDS[id].title,
  cost: 1,
  target: 'unit-class',
  duration: 'persistent',
  effect: `${shardEffectText(id, 1)} for every unit of the class it is applied to.`,
})])));
