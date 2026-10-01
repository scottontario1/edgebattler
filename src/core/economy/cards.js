// State-in/state-out card, Supply, reserve bench, recruitment and cycling rules.
import { UPGRADE_MAX_STARS, UPGRADE_POPULATION_BY_STARS } from '../content/grades.js';
import { clone, randomIndex } from './common.js';

const limitsFor = (content) => content?.cardLimits;
const fail = (reason, state) => ({ ok: false, reason, ...(state ? { state } : {}) });

/**
 * Create a plain economy record. Match state owns this value and may store it directly.
 * @param {object} content immutable content context
 * @param {object} options initial inventory, pool, round and Supply
 */
export function createEconomyState(content, {
  shardPool = null, cyclesRemaining, supply, hand = [], reserves = [], population = 0, pool = null,
  round, shardDock = [], shards = {}, shardSeq = 0, cardSequence,
} = {}) {
  if (!content?.cardLimits) throw new TypeError('createEconomyState requires a content context');
  const limits = limitsFor(content);
  return {
    ...(pool ? { pool: [...pool] } : {}),
    ...(shardPool ? { shardPool: [...shardPool] } : {}),
    ...(round !== undefined ? { round } : {}),
    cyclesRemaining: cyclesRemaining ?? limits.cyclesPerRound,
    supply: Math.max(0, Math.min(limits.maxSupply, supply ?? limits.initialSupply)),
    hand: clone(hand),
    reserves: clone(reserves),
    population,
    cardSequence: cardSequence ?? hand.length,
    shardDock: clone(shardDock),
    shards: clone(shards),
    shardSeq,
  };
}

function drawPool(state, content) {
  const pool = state.pool ?? content.recruitmentPool;
  let keys = pool.filter((key) => content.cardFor(key)?.type !== 'shard');
  if (content.rarityGateActive()) {
    const open = keys.filter((key) => content.rarityOpen(content.cardFor(key)?.rarity, state.round));
    if (open.length) keys = open;
  }
  return keys;
}

/** Draw cards into free hand slots without removing retained cards. Shard offers use dealShardOffers. */
export function drawCards(state, content, rng, count = content.cardLimits.openingHand) {
  if (!content?.cardFor) throw new TypeError('drawCards requires a content context');
  const next = clone(state);
  const requested = Math.max(0, Math.floor(count));
  const slots = Math.max(0, content.cardLimits.hand - next.hand.length);
  const pool = drawPool(next, content);
  const drawn = [];
  for (let i = 0; i < Math.min(requested, slots) && pool.length; i += 1) {
    const index = randomIndex(rng, pool.length);
    const card = clone(content.cardFor(pool[index]));
    if (!card) continue;
    next.cardSequence = (next.cardSequence ?? next.hand.length) + 1;
    card.instanceId = `card-${next.cardSequence}-${index}`;
    drawn.push(card);
  }
  next.hand.push(...drawn);
  return {
    state: next,
    drawn,
    requested,
    blocked: requested - drawn.length,
    handFull: next.hand.length >= content.cardLimits.hand && requested > drawn.length,
  };
}

/** Replace old offers and deal fresh shards at the left of the hand; offers ignore the normal hand cap. */
export function dealShardOffers(state, content, rng, min = content.cardLimits.shardsMin, max = content.cardLimits.shardsMax) {
  const next = clone(state);
  const keys = [...new Set(next.shardPool ?? (next.pool ?? content.recruitmentPool)
    .filter((key) => content.cardFor(key)?.type === 'shard'))];
  next.hand = next.hand.filter((card) => card.type !== 'shard');
  const dealt = [];
  if (keys.length) {
    const count = min + randomIndex(rng, Math.max(0, max - min + 1));
    for (let i = 0; i < count; i += 1) {
      const index = randomIndex(rng, keys.length);
      const card = clone(content.cardFor(keys[index]));
      if (!card) continue;
      next.cardSequence = (next.cardSequence ?? next.hand.length) + 1;
      card.instanceId = `card-${next.cardSequence}-shard`;
      dealt.push(card);
    }
  }
  next.hand.unshift(...dealt);
  return { state: next, dealt };
}

/** Five normal cards, then 2–3 shard offers on top of the standard hand cap. */
export function drawOpeningHand(state, content, rng) {
  const draw = drawCards(state, content, rng, content.cardLimits.openingHand);
  const offers = dealShardOffers(draw.state, content, rng);
  return { ...draw, state: offers.state, shardOffers: offers.dealt };
}

/** Grant round Supply, refresh ordinary cards and replace the prior round's shard offers. */
export function refreshRound(state, content, rng) {
  const limits = content.cardLimits;
  const refreshed = {
    ...clone(state),
    cyclesRemaining: limits.cyclesPerRound,
    supply: state.supply + Math.max(0, Math.min(limits.supplyPerRound, limits.maxSupply - state.supply)),
  };
  refreshed.hand = refreshed.hand.filter((card) => card.type !== 'shard');
  const draw = drawCards(refreshed, content, rng, limits.laterDraw);
  const offers = dealShardOffers(draw.state, content, rng);
  return { ...draw, state: offers.state, shardOffers: offers.dealt, supplyGranted: refreshed.supply - state.supply };
}

export function canAfford(state, cardOrCost) {
  const cost = typeof cardOrCost === 'number' ? cardOrCost : cardOrCost?.cost;
  return Number.isFinite(cost) && cost >= 0 && state.supply >= cost;
}

/** Buy a unit card from hand into the paid reserve bench. Failure preserves the input state. */
export function recruitUnit(state, cardInstanceId, content, {
  faction = 'blue', populationCap = content.cardLimits.populationCap,
  reserveCapacity = content.cardLimits.reserveCapacity,
} = {}) {
  const index = state.hand.findIndex((card) => card.instanceId === cardInstanceId);
  const card = index >= 0 ? state.hand[index] : null;
  const definition = card?.type === 'unit' ? content.unitCardFor(card.unitId) : null;
  if (!definition) return fail('unit-card-not-found', state);
  const stars = card.stars ?? 1;
  if (!Number.isInteger(stars) || stars < 1 || stars > UPGRADE_MAX_STARS) return fail('invalid-star-grade', state);
  const population = UPGRADE_POPULATION_BY_STARS[stars];
  if (!canAfford(state, card.cost)) return fail('insufficient-supply', state);
  if (state.reserves.length >= reserveCapacity) return fail('reserve-capacity', state);
  if (state.population + population > populationCap) return fail('population-cap', state);
  const next = clone(state);
  next.hand.splice(index, 1);
  next.supply -= card.cost;
  const reserve = {
    id: `reserve-${card.instanceId}`,
    unitId: definition.unitId,
    classId: definition.base ?? definition.unitId,
    variantId: definition.unitId,
    faction,
    rarity: card.rarity ?? definition.rarity,
    stars,
    costPaid: card.cost,
    population,
    state: 'reserve',
    hp: null,
    maxHp: null,
  };
  next.reserves.push(reserve);
  next.population += population;
  return { ok: true, state: next, reserve: clone(reserve), supplySpent: card.cost, populationDelta: population };
}

/** Deployment occupancy/location checks are supplied by the match so this module stays board-agnostic. */
export function canDeployReserve(state, reserveId, { location = false, tile = {} } = {}) {
  const reserve = state.reserves.find((unit) => unit.id === reserveId);
  if (!reserve) return { ok: false, reason: 'reserve-not-found' };
  if (!location) return { ok: false, reason: 'outside-controlled-deployment-area' };
  if (tile.occupied) return { ok: false, reason: 'occupied-tile' };
  if (tile.traversable === false || tile.terrain === 'water') return { ok: false, reason: 'impassable-tile' };
  return { ok: true, reserve: clone(reserve), supplyCost: 0, populationDelta: 0 };
}

export function projectPopulation(state, action, reserveId, content) {
  if (action !== 'recruit') return { current: state.population, delta: 0, projected: state.population, cap: content.cardLimits.populationCap };
  const unitId = typeof reserveId === 'string' ? reserveId : reserveId?.unitId;
  const definition = content.unitCardFor(unitId);
  const delta = definition?.population ?? 0;
  return { current: state.population, delta, projected: state.population + delta, cap: content.cardLimits.populationCap };
}

/** Validate a card/bench reroll without consuming Supply or randomness. */
export function previewCycle(state, { source, id }, content) {
  if ((state.cyclesRemaining ?? 0) <= 0) return { ok: false, reason: 'cycle-used' };
  if (!['hand', 'bench'].includes(source)) return { ok: false, reason: 'invalid-cycle-source' };
  const item = source === 'hand'
    ? state.hand.find((card) => card.instanceId === id)
    : state.reserves.find((unit) => unit.id === id);
  if (!item) return { ok: false, reason: source === 'hand' ? 'card-not-found' : 'reserve-not-found' };
  // Legacy counts shard offers against this limit, although they were dealt outside the regular hand cap.
  if (source === 'bench' && state.hand.length >= content.cardLimits.hand) return { ok: false, reason: 'hand-full' };
  const type = source === 'bench' ? 'unit' : item.type;
  const rarity = item.rarity ?? (source === 'bench' ? content.unitCardFor(item.unitId)?.rarity : 'common');
  const stars = type === 'unit' ? (item.stars ?? 1) : null;
  if (type === 'unit' && (!Number.isInteger(stars) || stars < 1 || stars > UPGRADE_MAX_STARS)) return { ok: false, reason: 'invalid-star-grade' };
  // Rarity gates govern draws, not the cycle pool, matching legacy behavior.
  const pool = (state.pool ?? content.recruitmentPool)
    .filter((key) => content.cardFor(key)?.type === type && content.cardFor(key)?.rarity === rarity);
  if (!pool.length) return { ok: false, reason: 'no-matching-pool' };
  return {
    ok: true,
    type,
    rarity,
    stars,
    pool,
    refund: source === 'bench' ? (item.costPaid ?? 0) : 0,
    populationFreed: source === 'bench' ? (item.population ?? 1) : 0,
  };
}

/** One seeded replacement of the same type and rarity; upgraded unit cards retain star grade. */
export function cycleCard(state, action, content, rng) {
  const preview = previewCycle(state, action, content);
  if (!preview.ok) return { ...preview, state };
  const next = clone(state);
  const index = randomIndex(rng, preview.pool.length);
  const replacement = clone(content.cardFor(preview.pool[index]));
  if (preview.type === 'unit') {
    replacement.stars = preview.stars;
    replacement.population = UPGRADE_POPULATION_BY_STARS[preview.stars];
    replacement.cost *= 3 ** (preview.stars - 1);
  }
  next.cardSequence = (next.cardSequence ?? next.hand.length) + 1;
  replacement.instanceId = `card-${next.cardSequence}-cycle`;
  if (action.source === 'hand') {
    next.hand[next.hand.findIndex((card) => card.instanceId === action.id)] = replacement;
  } else {
    next.reserves = next.reserves.filter((unit) => unit.id !== action.id);
    next.hand.push(replacement);
    next.supply += preview.refund;
    next.population -= preview.populationFreed;
  }
  next.cyclesRemaining -= 1;
  return { ok: true, state: next, replacement: clone(replacement), refund: preview.refund, populationFreed: preview.populationFreed };
}
