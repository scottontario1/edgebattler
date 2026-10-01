// Shard shop/dock and class-wide shard arithmetic. Unit-record stat synchronization is a match concern.
import { clone, randomIndex } from './common.js';

const fail = (reason, state) => ({ ok: false, reason, ...(state ? { state } : {}) });
const zeroBonus = () => ({ str: 0, def: 0, maxHp: 0, spd: 0, skl: 0, block: 0, regen: 0, thorns: 0 });

/** Sum applied shard records ({ shardId, tier }) using the caller's content catalogue. */
export function shardBonus(applied = [], content) {
  const result = zeroBonus();
  for (const shard of applied || []) {
    const definition = content?.shards?.[shard.shardId];
    const value = definition?.values[(shard.tier ?? 1) - 1] ?? 0;
    if (definition) result[definition.key] += value;
  }
  return result;
}

/** Groups of three matching dock shards, preserving dock order. Tier III has no further combine. */
export function findShardCombos(dock = [], content) {
  const groups = new Map();
  for (const shard of dock) {
    const tier = shard.tier ?? 1;
    if (tier >= content.shardRules.maxTier) continue;
    const key = `${shard.shardId}:${tier}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(shard.id);
  }
  return [...groups.entries()].filter(([, ids]) => ids.length >= 3).map(([key, ids]) => {
    const [shardId, tier] = key.split(':');
    return { shardId, tier: Number(tier), ids: ids.slice(0, 3) };
  });
}

/** Combine three matching dock shards into the next tier. The input dock is never mutated. */
export function combineShards(dock, shardId, tier, newId, content) {
  if (!content?.shards?.[shardId] || !Number.isInteger(tier) || tier < 1) return { ok: false, reason: 'no-combo', dock };
  if (tier >= content.shardRules.maxTier) return { ok: false, reason: 'max-tier', dock };
  const matching = dock.filter((shard) => shard.shardId === shardId && (shard.tier ?? 1) === tier);
  if (matching.length < 3) return { ok: false, reason: 'no-combo', dock };
  const consumed = matching.slice(0, 3).map((shard) => shard.id);
  const shard = { id: newId, shardId, tier: tier + 1 };
  return { ok: true, dock: [...dock.filter((item) => !consumed.includes(item.id)), shard], consumed, shard };
}

/** Buy a shard offer from hand into the bounded dock. */
export function buyShard(state, cardInstanceId, content) {
  const index = state.hand.findIndex((card) => card.instanceId === cardInstanceId);
  const card = index >= 0 ? state.hand[index] : null;
  if (!card || card.type !== 'shard' || !content.shards[card.shardId]) return fail('card-not-found', state);
  if (state.shardDock.length >= content.shardRules.dockSlots) return fail('dock-full', state);
  if (state.supply < card.cost) return fail('insufficient-supply', state);
  const next = clone(state);
  const shard = { id: `shard-${next.shardSeq + 1}`, shardId: card.shardId, tier: card.tier ?? 1 };
  next.shardSeq += 1;
  next.shardDock.push(shard);
  next.hand.splice(index, 1);
  next.supply -= card.cost;
  return { ok: true, state: next, shardInstanceId: shard.id, shardId: shard.shardId, tier: shard.tier, supplySpent: card.cost };
}

/** Scenario helper: place a shard in the dock without spending Supply. */
export function grantShard(state, shardId, content, tier = 1) {
  if (!content.shards[shardId] || !Number.isInteger(tier) || tier < 1 || tier > content.shardRules.maxTier) return fail('invalid-shard', state);
  if (state.shardDock.length >= content.shardRules.dockSlots) return fail('dock-full', state);
  const next = clone(state);
  const shard = { id: `shard-${next.shardSeq + 1}`, shardId, tier };
  next.shardSeq += 1;
  next.shardDock.push(shard);
  return { ok: true, state: next, shardInstanceId: shard.id, shardId, tier };
}

/** Move a dock shard to the selected class. The match supplies eligible owned class keys. */
export function applyShard(state, shardInstanceId, unitType, content, validUnitTypes = Object.keys(content.recruitClasses)) {
  const index = state.shardDock.findIndex((shard) => shard.id === shardInstanceId);
  if (index < 0) return fail('shard-not-found', state);
  if (!validUnitTypes.includes(unitType)) return fail('invalid-unit-type', state);
  const applied = state.shards[unitType] || [];
  if (applied.length >= content.shardRules.classSlots) return fail('class-full', state);
  const next = clone(state);
  const [shard] = next.shardDock.splice(index, 1);
  next.shards[unitType] = [...applied, { shardId: shard.shardId, tier: shard.tier }];
  return { ok: true, state: next, unitType, shardId: shard.shardId, tier: shard.tier };
}

/** Remove an applied shard back to the dock; class stat resynchronization belongs to the match. */
export function removeShard(state, unitType, index, content) {
  const applied = state.shards[unitType] || [];
  if (!Number.isInteger(index) || index < 0 || index >= applied.length) return fail('shard-not-found', state);
  if (state.shardDock.length >= content.shardRules.dockSlots) return fail('dock-full', state);
  const next = clone(state);
  const [shard] = next.shards[unitType].splice(index, 1);
  if (!next.shards[unitType].length) delete next.shards[unitType];
  const returned = { id: `shard-${next.shardSeq + 1}`, shardId: shard.shardId, tier: shard.tier };
  next.shardSeq += 1;
  next.shardDock.push(returned);
  return { ok: true, state: next, unitType, shardInstanceId: returned.id, shardId: returned.shardId, tier: returned.tier };
}

/** Merge three same-type/tier dock shards, returning action-compatible details. */
export function combineDockShards(state, shardId, tier, content) {
  const merged = combineShards(state.shardDock, shardId, tier, `shard-${state.shardSeq + 1}`, content);
  if (!merged.ok) return fail(merged.reason, state);
  const next = { ...clone(state), shardDock: merged.dock, shardSeq: state.shardSeq + 1 };
  return { ok: true, state: next, shardInstanceId: merged.shard.id, shardId, tier: merged.shard.tier, consumed: merged.consumed };
}

/** Seeded four-type subset used by the Shard offer pool; values match legacy pickShardSubset. */
export function pickShardSubset(seed, count = 4, content) {
  const ids = content?.shardIds;
  if (!ids) throw new TypeError('pickShardSubset requires a content context');
  if (!count || count >= ids.length) return [...ids];
  let state = (Number(seed) ^ 0x9e3779b9) >>> 0 || 1;
  const nextRandom = () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
  for (let i = 0; i < 4; i += 1) nextRandom();
  const shuffled = [...ids];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = randomIndex(nextRandom, i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const selected = new Set(shuffled.slice(0, count));
  return ids.filter((id) => selected.has(id));
}
