// Shards (docs/SHARDS.md): passive class-wide boosts bought from the hand into a shard dock, then applied to a unit class.
// Pure data and helpers, no Three.js. The match (src/match.js) owns state; this module owns the tables and the arithmetic.

export const SHARD_RULES = Object.freeze({ dockSlots: 10, classSlots: 3, maxTier: 3 });
export const SHARD_TIER_LABELS = Object.freeze(['I', 'II', 'III']);
/** Stat keys that change unit records directly (and are tracked per unit in `unit.shardBonus`). */
export const SHARD_STAT_KEYS = Object.freeze(['str', 'def', 'maxHp', 'spd', 'skl']);
/** Effect keys that are read at battle time from the class's applied list. */
export const SHARD_EFFECT_KEYS = Object.freeze(['block', 'regen', 'thorns']);

// `key` is the bonus key in shardBonus(); `kind` is 'stat' (folded into unit stats) or 'effect' (battle/round effect).
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

export const shardValue = (shardId, tier) => SHARDS[shardId]?.values[tier - 1] ?? 0;
export const shardLabel = (shardId, tier) => `${SHARDS[shardId]?.name ?? shardId} ${SHARD_TIER_LABELS[tier - 1] ?? tier}`;
export const shardEffectText = (shardId, tier) => {
  const s = SHARDS[shardId];
  const v = shardValue(shardId, tier);
  if (!s) return '';
  return s.kind === 'stat' ? `+${v} ${s.label}` : `${s.label}: ${v}`;
};

/** Tier I shard cards, one per type. Keys are the shard ids; cardFor('ruby') resolves them. */
export const SHARD_CARDS = Object.freeze(Object.fromEntries(SHARD_IDS.map((id) => [id, Object.freeze({
  id: `shard-${id}`, type: 'shard', rarity: 'common', shardId: id, tier: 1, name: `${SHARDS[id].name} Shard`, title: SHARDS[id].title, cost: 1,
  target: 'unit-class', duration: 'persistent', effect: `${shardEffectText(id, 1)} for every unit of the class it is applied to.`,
})])));

const zeroBonus = () => ({ str: 0, def: 0, maxHp: 0, spd: 0, skl: 0, block: 0, regen: 0, thorns: 0 });

/** Sum a list of applied shards ({shardId, tier}) into { str, def, maxHp, spd, skl, block, regen, thorns }. */
export function shardBonus(applied = []) {
  const out = zeroBonus();
  for (const s of applied || []) {
    const def = SHARDS[s.shardId];
    if (def) out[def.key] += shardValue(s.shardId, s.tier ?? 1);
  }
  return out;
}

/** Groups of three matching (shardId, tier) dock shards that can merge: [{ shardId, tier, ids: [a, b, c] }]. Tier III never merges. */
export function findShardCombos(dock = []) {
  const groups = new Map();
  for (const s of dock) {
    if ((s.tier ?? 1) >= SHARD_RULES.maxTier) continue;
    const key = `${s.shardId}:${s.tier ?? 1}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s.id);
  }
  return [...groups.entries()].filter(([, ids]) => ids.length >= 3).map(([key, ids]) => {
    const [shardId, tier] = key.split(':');
    return { shardId, tier: Number(tier), ids: ids.slice(0, 3) };
  });
}

/**
 * Pure combine: three dock shards of (shardId, tier) become one of tier + 1, appended at the end of the dock.
 * `newId` is the id for the merged shard. Returns { ok, reason?, dock, consumed, shard }; the input is never mutated.
 */
export function combineShards(dock, shardId, tier, newId) {
  if (!SHARDS[shardId] || !Number.isInteger(tier) || tier < 1) return { ok: false, reason: 'no-combo', dock };
  if (tier >= SHARD_RULES.maxTier) return { ok: false, reason: 'max-tier', dock };
  const matching = dock.filter((s) => s.shardId === shardId && (s.tier ?? 1) === tier);
  if (matching.length < 3) return { ok: false, reason: 'no-combo', dock };
  const consumed = matching.slice(0, 3).map((s) => s.id);
  const shard = { id: newId, shardId, tier: tier + 1 };
  return { ok: true, dock: [...dock.filter((s) => !consumed.includes(s.id)), shard], consumed, shard };
}
