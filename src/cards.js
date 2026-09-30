import {UPGRADE_MAX_STARS,UPGRADE_POPULATION_BY_STARS} from './upgrades.js';
/** Prototype card economy rules. Pure data helpers; rendering and board occupancy stay in callers. */

export const DEFAULT_CARD_LIMITS = Object.freeze({
  hand: 8,
  cyclesPerRound: 1,
  openingHand: 5,
  laterDraw: 3,
  initialSupply: 3,
  supplyPerRound: 3,
  maxSupply: 6,
  reserveCapacity: 8,
  populationCap: 10,
});
// The values the rules read. Always the defaults in the game; economy experiments (experiments/economy) override
// them per process with setCardLimits() and put the result in the log header.
export const CARD_LIMITS = { ...DEFAULT_CARD_LIMITS };
export const setCardLimits = (overrides = {}) => Object.assign(CARD_LIMITS, DEFAULT_CARD_LIMITS, overrides);
export const resetCardLimits = () => setCardLimits();

/** Stable recruitment identities correspond to RECRUIT in src/units.js. */
export const UNIT_CARDS = Object.freeze({
  pikeman: Object.freeze({ id: 'unit-pikeman', type: 'unit', rarity: 'common', unitId: 'pikeman', name: 'Pikeman', cost: 1, class: 'Foot', stars: 1, range: 1, defaultStance: 'advance', ability: 'Advances into melee to hold the frontline; proposed anti-cavalry specialist.', population: 1 }),
  archer: Object.freeze({ id: 'unit-archer', type: 'unit', rarity: 'common', unitId: 'archer', name: 'Archer', cost: 2, class: 'Foot', stars: 1, range: 2, defaultStance: 'hold', ability: 'Ranged support; cannot counter adjacent attackers.', population: 1 }),
  cavalier: Object.freeze({ id: 'unit-cavalier', type: 'unit', rarity: 'common', unitId: 'cavalier', name: 'Cavalier', cost: 3, typeLabel: 'Mounted', class: 'Mounted', stars: 1, range: 1, defaultStance: 'advance', ability: 'Mobile mounted unit; presses reinforcement points.', population: 1 }),
});

export const SPELL_CARDS = Object.freeze({
  mend: Object.freeze({ id: 'spell-mend', type: 'spell', rarity: 'common', name: 'Mend', cost: 1, target: 'friendly-unit', duration: 'instant', effect: 'Restore 8 HP, up to maximum HP.' }),
  ward: Object.freeze({ id: 'spell-ward', type: 'spell', rarity: 'common', name: 'Ward', cost: 1, target: 'friendly-unit', duration: 'upcoming-battle', effect: 'Protect one friendly unit during the upcoming battle.' }),
  fireburst: Object.freeze({ id: 'spell-fireburst', type: 'spell', rarity: 'common', name: 'Fireburst', cost: 2, target: 'enemy-area', duration: 'instant', effect: 'Deal 6 damage to enemies in the selected area.' }),
});

// First transferable type-wide skill prototype. Its timing/value are explicit and tunable.
export const SKILL_CARDS = Object.freeze({
  barrier: Object.freeze({ id: 'skill-barrier', type: 'skill', rarity: 'common', skillId: 'barrier', name: 'Barrier', cost: 2, target: 'unit-type', duration: 'persistent', blockDamage: 2, effect: 'All friendly units of this type reduce incoming damage by 2 per battle.' }),
});

// Repeated entries represent relative weights in the shared pool.
export const RECRUITMENT_POOL = Object.freeze([
  'pikeman', 'pikeman', 'pikeman', 'archer', 'archer', 'cavalier',
  'mend', 'ward', 'fireburst', 'barrier',
]);

/** Small deterministic xorshift generator. Same seed produces the same stream. */
export function seededRandom(seed = 1) {
  let state = Number(seed) >>> 0;
  if (!state) state = 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

const copy = (value) => structuredClone(value);
// Experiments (experiments/candidates) register extra cards and swap the draw pool; the game never does.
const CANDIDATE_CARDS = {};
let ACTIVE_POOL = RECRUITMENT_POOL;
export const registerCandidateCards = (cards) => Object.assign(CANDIDATE_CARDS, cards);
export const setRecruitmentPool = (keys) => { ACTIVE_POOL = keys ? Object.freeze([...keys]) : RECRUITMENT_POOL; };
export const resetCandidateCards = () => { for (const k of Object.keys(CANDIDATE_CARDS)) delete CANDIDATE_CARDS[k]; ACTIVE_POOL = RECRUITMENT_POOL; };
export const cardFor = (key) => UNIT_CARDS[key] ?? SPELL_CARDS[key] ?? SKILL_CARDS[key] ?? CANDIDATE_CARDS[key] ?? null;
export const skillCardFor = (skillId) => SKILL_CARDS[skillId] ?? Object.values(CANDIDATE_CARDS).find((c) => c.skillId === skillId) ?? null;

/** Create a fresh match inventory. `cards` defaults to an empty hand. */
export function createCardState({ cyclesRemaining = CARD_LIMITS.cyclesPerRound, supply = CARD_LIMITS.initialSupply, hand = [], reserves = [], population = 0 } = {}) {
  return { cyclesRemaining, supply: Math.max(0, Math.min(CARD_LIMITS.maxSupply, supply)), hand: copy(hand), reserves: copy(reserves), population, cardSequence: hand.length };
}

/** Draw into free hand slots without removing retained cards; opening draw defaults to five. */
export function drawCards(state, rng = seededRandom(1), count = CARD_LIMITS.openingHand) {
  const next = copy(state);
  const requested = Math.max(0, Math.floor(count));
  const slots = Math.max(0, CARD_LIMITS.hand - next.hand.length);
  const POOL = ACTIVE_POOL;
  const drawn = [];
  for (let i = 0; i < Math.min(requested, slots); i += 1) {
    const index = Math.min(POOL.length - 1, Math.floor(rng() * POOL.length));
    const key = POOL[index];
    const card = copy(cardFor(key));
    next.cardSequence = (next.cardSequence ?? next.hand.length) + 1;
    card.instanceId = `card-${next.cardSequence}-${index}`;
    drawn.push(card);
  }
  next.hand.push(...drawn);
  return { state: next, drawn, requested, blocked: requested - drawn.length, handFull: next.hand.length >= CARD_LIMITS.hand && requested > drawn.length };
}

/** Opening draw helper (five); later round helper grants Supply and requests three draws. */
export function drawOpeningHand(state, rng = seededRandom(1)) { return drawCards(state, rng, CARD_LIMITS.openingHand); }
export function refreshRound(state, rng = seededRandom(1)) {
  const refreshed = { ...copy(state), cyclesRemaining: CARD_LIMITS.cyclesPerRound, supply: state.supply + Math.max(0,Math.min(CARD_LIMITS.supplyPerRound,CARD_LIMITS.maxSupply-state.supply)) };
  return { ...drawCards(refreshed, rng, CARD_LIMITS.laterDraw), supplyGranted: refreshed.supply - state.supply };
}

export function canAfford(state, cardOrCost) {
  const cost = typeof cardOrCost === 'number' ? cardOrCost : cardOrCost?.cost;
  return Number.isFinite(cost) && cost >= 0 && state.supply >= cost;
}

/** Buy a unit card from hand into the paid reserve bench; failure returns original state unchanged. */
export function recruitUnit(state, cardInstanceId, { populationCap = CARD_LIMITS.populationCap, reserveCapacity = CARD_LIMITS.reserveCapacity } = {}) {
  const index = state.hand.findIndex((card) => card.instanceId === cardInstanceId);
  const card = index >= 0 ? state.hand[index] : null;
  const definition = card?.type === 'unit' ? UNIT_CARDS[card.unitId] : null;
  const fail = (reason) => ({ ok: false, reason, state });
  if (!definition) return fail('unit-card-not-found');
  const stars=card?.stars??1;
  if(!Number.isInteger(stars)||stars<1||stars>UPGRADE_MAX_STARS) return fail('invalid-star-grade');
  const population=UPGRADE_POPULATION_BY_STARS[stars];
  if (!canAfford(state, card.cost)) return fail('insufficient-supply');
  if (state.reserves.length >= reserveCapacity) return fail('reserve-capacity');
  if (state.population + population > populationCap) return fail('population-cap');
  const next = copy(state);
  next.hand.splice(index, 1);
  next.supply -= card.cost;
  const reserve = { id: `reserve-${card.instanceId}`, unitId: definition.unitId, classId: definition.unitId, variantId: definition.unitId, faction: 'blue', rarity: card.rarity??definition.rarity, stars, costPaid: card.cost, population, state: 'reserve', hp: null, maxHp: null };
  next.reserves.push(reserve);
  next.population += population;
  return { ok: true, state: next, reserve: copy(reserve), supplySpent: card.cost, populationDelta: population };
}

/** Validate a reserve deployment. `location` is controlled and `tile` describes the proposed board tile. */
export function canDeployReserve(state, reserveId, { location = false, tile = {} } = {}) {
  const reserve = state.reserves.find((unit) => unit.id === reserveId);
  if (!reserve) return { ok: false, reason: 'reserve-not-found' };
  if (!location) return { ok: false, reason: 'outside-controlled-deployment-area' };
  if (tile.occupied) return { ok: false, reason: 'occupied-tile' };
  if (tile.traversable === false || tile.terrain === 'water') return { ok: false, reason: 'impassable-tile' };
  return { ok: true, reserve: copy(reserve), supplyCost: 0, populationDelta: 0 };
}

/** Report expected population changes without committing recruitment/deployment. */
export function projectPopulation(state, action, reserveId) {
  if (action === 'recruit') {
    const unitId = typeof reserveId === 'string' ? reserveId : reserveId?.unitId;
    const definition = UNIT_CARDS[unitId];
    return { current: state.population, delta: definition?.population ?? 0, projected: state.population + (definition?.population ?? 0), cap: CARD_LIMITS.populationCap };
  }
  if (action === 'deploy') return { current: state.population, delta: 0, projected: state.population, cap: CARD_LIMITS.populationCap };
  return { current: state.population, delta: 0, projected: state.population, cap: CARD_LIMITS.populationCap };
}

/** Preview does not touch inventory or RNG. A full hand blocks bench cycling without losing value. */
export function previewCycle(state,{source,id}) {
  const fail=reason=>({ok:false,reason});
  if((state.cyclesRemaining??0)<=0) return fail('cycle-used');
  if(!['hand','bench'].includes(source)) return fail('invalid-cycle-source');
  const item=source==='hand'?state.hand.find(c=>c.instanceId===id):state.reserves.find(u=>u.id===id);
  if(!item) return fail(source==='hand'?'card-not-found':'reserve-not-found');
  if(source==='bench'&&state.hand.length>=CARD_LIMITS.hand) return fail('hand-full');
  const type=source==='bench'?'unit':item.type;
  const rarity=item.rarity??(source==='bench'?UNIT_CARDS[item.unitId]?.rarity:'common');
  const stars=type==='unit'?(item.stars??1):null;
  if(type==='unit'&&(!Number.isInteger(stars)||stars<1||stars>UPGRADE_MAX_STARS)) return fail('invalid-star-grade');
  const pool=ACTIVE_POOL.filter(key=>cardFor(key)?.type===type&&cardFor(key)?.rarity===rarity);
  if(!pool.length) return fail('no-matching-pool');
  return {ok:true,type,rarity,stars,pool,refund:source==='bench'?(item.costPaid??0):0,
    populationFreed:source==='bench'?(item.population??1):0};
}
/** One seeded replacement, same type/rarity/grade. Same identity may be drawn again. */
export function cycleCard(state,action,rng) {
  const preview=previewCycle(state,action);
  if(!preview.ok) return {...preview,state};
  const next=copy(state);
  const index=Math.min(preview.pool.length-1,Math.floor(rng()*preview.pool.length));
  const replacement=copy(cardFor(preview.pool[index]));
  if(preview.type==='unit') {
    replacement.stars=preview.stars;
    replacement.population=UPGRADE_POPULATION_BY_STARS[preview.stars];
    replacement.cost*=3**(preview.stars-1);
  }
  next.cardSequence=(next.cardSequence??next.hand.length)+1;
  replacement.instanceId=`card-${next.cardSequence}-cycle`;
  if(action.source==='hand') next.hand[next.hand.findIndex(c=>c.instanceId===action.id)]=replacement;
  else {
    next.reserves=next.reserves.filter(u=>u.id!==action.id);
    next.hand.push(replacement);next.supply+=preview.refund;next.population-=preview.populationFreed;
  }
  next.cyclesRemaining-=1;
  return {ok:true,state:next,replacement,refund:preview.refund,populationFreed:preview.populationFreed};
}
