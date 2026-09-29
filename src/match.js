// Match controller: the authoritative state of one game and the only code that changes it.
// Pure data (no DOM, no Three.js), so the browser UI (src/ui.js) and the Node simulator
// (tools/sim/) run exactly the same rules. Every change goes through `apply(action)` during
// planning or `resolveRound()` for the battle, and each is reported to the optional `log` hook
// (src/log.js), which makes games replayable from their seed plus the logged actions.
//
// Actions (plain objects, identical for humans and AI):
//   { type: 'recruit', faction, cardId }                     buy a unit card onto the reserve bench
//   { type: 'deploy', faction, reserveId, c, r }             reserve -> controlled deployment tile
//   { type: 'withdraw', faction, unitId }                    field unit on a controlled tile -> bench
//   { type: 'move', faction, unitId, c, r }                  one planning move within MOV
//   { type: 'stance', faction, unitId, stance, targetId?, tile? }  advance | hold | protect (targetId);
//                                                            advance + tile [c, r] marches on that tile
//   { type: 'spell', faction, cardId, c, r, unitId? }        queue a spell (unit target or area centre)
//   { type: 'cancelSpell', faction, queueId }
//   { type: 'equip', faction, cardId, unitType }             type-wide skill card
//   { type: 'transfer', faction, skillId, from, to }
//   { type: 'combine', faction, ids, survivorId, destination }
import { W, H, LAYOUT, inBounds, terrainAt } from './board.js';
import { MOVE_COST, MOVE_TYPE, computeRange } from './rules.js';
import { forecast, weaponOf } from './combat.js';
import { CARD_LIMITS, UNIT_CARDS, SKILL_CARDS, createCardState, drawOpeningHand, refreshRound, recruitUnit, canDeployReserve, seededRandom } from './cards.js';
import { advanceAbilityRound, initializeAbilityState, queueSpell, cancelSpell, resolveAbilityActivation, resolveQueuedSpells, equipTypeSkill, transferTypeSkill, skillsForUnitType } from './abilities.js';
import { previewUpgrade, combineUnits } from './upgrades.js';
import { resolveBattleRound } from './battle.js';
import { UNITS, createRecruitUnit, createHeroRespawnData } from './roster.js';

export const SCHEMA = 1;
// Prototype pacing values (GAME.md "Decisions to tune"). Logged in every header.
export const RULES = Object.freeze({
  heroRespawnDelay: 2, // rounds after the champion's death before it can return
  heroRespawnCost: 1,  // Supply paid on return
  reserveHeal: 4,      // HP a benched unit recovers per round
  reserveEnergy: 1,    // extra energy a benched unit gains per round
});
export const FACTIONS = ['blue', 'red'];
const CHAMPION = { blue: 'brenna', red: 'dreg' };
const HOME = { blue: 'C', red: 'K' };     // own keep tile
const TARGET = { blue: 'K', red: 'C' };   // keep to seize
const other = (f) => (f === 'blue' ? 'red' : 'blue');
const clone = (v) => structuredClone(v);

/**
 * seed      one number drives every random stream (card draws per side, battle dice).
 * maxRounds optional round cap; reaching it ends the match as a draw ('round-limit').
 * log       optional (entry) => void; receives header, action, round, summary and result entries.
 * meta      extra header fields (policies, git commit, ...).
 */
export function createMatch({ seed = 0x415348, maxRounds = null, log = null, meta = {}, roster = UNITS } = {}) {
  const emit = (entry) => { if (log) log(entry); };
  const units = clone(roster).map((u) => prepare(u));
  const territory = new Map();
  for (let r = 0; r < H; r += 1) for (let c = 0; c < W; c += 1) {
    const t = LAYOUT[r][c];
    if (t === 'C') territory.set(`${c},${r}`, 'blue');
    else if (t === 'K') territory.set(`${c},${r}`, 'red');
    else if (t === 'V') territory.set(`${c},${r}`, null);
  }
  const sides = {};
  for (const f of FACTIONS) {
    // Blue keeps the original UI seed so existing seeded games are unchanged.
    const rng = seededRandom(f === 'blue' ? seed : (seed ^ 0x5a5a5a5a) + 0x1057b11);
    const cards = drawOpeningHand(createCardState({ population: 0 }), rng).state;
    sides[f] = { cards, rng, loadouts: {}, queuedSpellCards: {}, heroRespawnAt: null,
      stats: { recruited: {}, spells: {}, skills: 0, deployed: 0, withdrawn: 0, combined: 0, lost: {}, killed: {}, supplySpent: 0, captures: 0, respawns: 0, blockedDraws: 0 } };
  }
  const m = { seed, maxRounds, round: 1, phase: 'planning', over: false, winner: null, reason: null, units, territory, sides, seq: 0 };

  function prepare(u) {
    Object.assign(u, initializeAbilityState(u, {
      stance: u.stance || UNIT_CARDS[u.cls]?.defaultStance || (u.cls === 'archer' ? 'hold' : 'advance'),
      abilityOrder: u.abilityOrder || (u.cls === 'pikeman' ? ['rally'] : []),
    }));
    u.state = 'field';
    u.population = u.population ?? 1;
    u.planningMoved = false;
    return u;
  }

  // ---------- queries ----------
  const alive = (f) => m.units.filter((u) => u.hp > 0 && (!f || u.faction === f));
  const byId = (id) => m.units.find((u) => u.id === id) || null;
  const unitAt = (c, r) => m.units.find((u) => u.hp > 0 && u.c === c && u.r === r) || null;
  /** A computeRange-compatible board over plain records. */
  const board = (records = alive()) => {
    const list = records.map((d) => ({ data: d }));
    return { list, byId: new Map(list.map((e) => [e.data.id, e])), unitAt: (c, r) => list.find((e) => e.data.hp > 0 && e.data.c === c && e.data.r === r) };
  };
  function population(f) {
    const side = sides[f];
    return alive(f).reduce((s, u) => s + (u.population || 1), 0)
      + (side ? side.cards.reserves.reduce((s, u) => s + (u.population || 1), 0) : 0);
  }
  function deploymentTiles(f) {
    const out = new Map();
    for (const [loc, owner] of territory) {
      if (owner !== f) continue;
      const [c, r] = loc.split(',').map(Number);
      for (const [dc, dr] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (inBounds(c + dc, r + dr)) out.set(`${c + dc},${r + dr}`, [c + dc, r + dr]);
    }
    return [...out.values()];
  }
  function canDeployAt(f, reserveId, c, r) {
    const cs = sides[f].cards;
    const reserve = cs.reserves.find((u) => u.id === reserveId);
    const moveType = MOVE_TYPE[reserve?.unitId] || 'foot';
    return canDeployReserve(cs, reserveId, {
      location: deploymentTiles(f).some(([x, y]) => x === c && y === r),
      tile: { occupied: !!unitAt(c, r), traversable: MOVE_COST[moveType][terrainAt(c, r)] !== undefined, terrain: terrainAt(c, r) === 'W' ? 'water' : terrainAt(c, r) },
    });
  }
  function canWithdraw(f, u) {
    return !!u && u.faction === f && u.hp > 0 && u.id !== CHAMPION[f] && m.phase === 'planning' && !m.over
      && sides[f].cards.reserves.length < CARD_LIMITS.reserveCapacity
      && deploymentTiles(f).some(([c, r]) => c === u.c && r === u.r);
  }
  /** Reserves (filled out from their class template) plus the living field army: combine candidates. */
  function armyRecords(f) {
    const reserves = sides[f].cards.reserves.map((reserve) => {
      const t = createRecruitUnit(reserve.unitId, reserve.id, f, 0, 0);
      const rec = { ...t, ...reserve, hp: reserve.hp ?? t.hp, maxHp: reserve.maxHp ?? t.maxHp, energy: reserve.energy ?? 0,
        maxEnergy: reserve.maxEnergy ?? t.maxEnergy, cooldowns: reserve.cooldowns ?? {}, statuses: reserve.statuses ?? {},
        abilityOrder: reserve.abilityOrder ?? t.abilityOrder, stance: reserve.stance ?? t.stance, faction: f, state: 'reserve' };
      delete rec.c; delete rec.r;
      return rec;
    });
    return [...reserves, ...alive(f)];
  }

  // ---------- planning actions ----------
  const fail = (reason) => ({ ok: false, reason });
  const planning = (f) => (m.over ? 'match-over' : m.phase !== 'planning' ? 'not-planning' : !sides[f] ? 'unknown-faction' : null);

  const handlers = {
    recruit({ faction: f, cardId }) {
      const side = sides[f];
      side.cards.population = population(f);
      const res = recruitUnit(side.cards, cardId);
      if (!res.ok) return fail(res.reason);
      const reserve = { ...res.reserve, faction: f, id: `${f}-r${++m.seq}-${res.reserve.unitId}` };
      side.cards = { ...res.state, reserves: [...res.state.reserves.slice(0, -1), reserve] };
      side.stats.recruited[reserve.unitId] = (side.stats.recruited[reserve.unitId] || 0) + 1;
      side.stats.supplySpent += res.supplySpent;
      return { ok: true, reserveId: reserve.id, unitId: reserve.unitId };
    },
    deploy({ faction: f, reserveId, c, r }) {
      const side = sides[f];
      const reserve = side.cards.reserves.find((u) => u.id === reserveId);
      if (!reserve) return fail('reserve-not-found');
      const legal = canDeployAt(f, reserveId, c, r);
      if (!legal.ok) return fail(legal.reason);
      const id = reserve.fieldId && !byId(reserve.fieldId) ? reserve.fieldId : `${f}-u${++m.seq}-${reserve.unitId}`;
      const unit = createRecruitUnit(reserve.unitId, id, f, c, r, { stance: UNIT_CARDS[reserve.unitId]?.defaultStance });
      // A reserve may carry more than the class template: combined stars and stats, hurt HP, stored energy.
      const carried = Object.fromEntries(Object.entries(reserve).filter(([k, v]) => v != null && !['id', 'fieldId', 'state', 'faction', 'c', 'r', 'costPaid', 'unitId'].includes(k)));
      Object.assign(unit, carried);
      Object.assign(unit, initializeAbilityState(unit));
      unit.id = id; unit.faction = f; unit.c = c; unit.r = r; unit.state = 'field'; unit.planningMoved = false;
      side.cards = { ...side.cards, reserves: side.cards.reserves.filter((u) => u.id !== reserveId) };
      m.units = m.units.filter((u) => u.id !== id); // a fallen copy with the same id
      m.units.push(unit);
      side.stats.deployed += 1;
      return { ok: true, unitId: id };
    },
    withdraw({ faction: f, unitId }) {
      const u = byId(unitId);
      if (!canWithdraw(f, u)) return fail(u?.id === CHAMPION[f] ? 'champion-cannot-bench' : 'not-on-controlled-tile');
      const reserve = { ...clone(u), id: `${f}-r${++m.seq}-${u.cls}`, fieldId: u.id, unitId: u.cls, faction: f, state: 'reserve' };
      for (const k of ['c', 'r', 'planningMoved', 'done', 'moved']) delete reserve[k];
      m.units = m.units.filter((x) => x !== u);
      sides[f].cards = { ...sides[f].cards, reserves: [...sides[f].cards.reserves, reserve] };
      sides[f].stats.withdrawn += 1;
      return { ok: true, reserveId: reserve.id };
    },
    move({ faction: f, unitId, c, r }) {
      const u = byId(unitId);
      if (!u || u.faction !== f || u.hp <= 0) return fail('unit-not-found');
      if (u.planningMoved) return fail('already-moved');
      const path = computeRange(u, board(), u.mov).pathTo(c, r);
      if (!path.length || unitAt(c, r)) return fail('unreachable');
      u.c = c; u.r = r; u.planningMoved = true;
      return { ok: true, path };
    },
    stance({ faction: f, unitId, stance, targetId, tile }) {
      const u = byId(unitId);
      if (!u || u.faction !== f || u.hp <= 0) return fail('unit-not-found');
      if (!['advance', 'hold', 'protect'].includes(stance)) return fail('unknown-stance');
      if (stance === 'protect') {
        const subject = byId(targetId);
        if (!subject || subject.faction !== f || subject.id === u.id || subject.hp <= 0) return fail('invalid-protect-subject');
        u.objective = { type: 'protect', targetId };
      } else if (stance === 'advance' && Array.isArray(tile) && inBounds(tile[0], tile[1])) {
        u.objective = { type: 'tile', c: tile[0], r: tile[1] };
      } else delete u.objective;
      u.stance = stance;
      return { ok: true };
    },
    spell({ faction: f, cardId, c, r, unitId }) {
      const side = sides[f];
      const card = side.cards.hand.find((x) => x.instanceId === cardId);
      if (!card || card.type !== 'spell') return fail('spell-card-not-found');
      const spellId = card.id.replace('spell-', '');
      let target;
      if (spellId === 'fireburst') target = { kind: 'area', x: c, y: r };
      else {
        const u = byId(unitId) || unitAt(c, r);
        if (!u || u.faction !== f || u.hp <= 0) return fail('invalid-target');
        target = { kind: 'unit', faction: 'friendly', unitId: u.id };
      }
      const queueId = `queued-${card.instanceId}`;
      const res = queueSpell(side.cards, spellId, target, { queueId });
      if (!res.ok) return fail(res.reason);
      side.cards = { ...res.state, hand: side.cards.hand.filter((x) => x.instanceId !== cardId) };
      side.queuedSpellCards[queueId] = card;
      side.stats.spells[spellId] = (side.stats.spells[spellId] || 0) + 1;
      side.stats.supplySpent += card.cost;
      return { ok: true, queueId };
    },
    cancelSpell({ faction: f, queueId }) {
      const side = sides[f];
      const res = cancelSpell(side.cards, queueId);
      if (!res.ok) return fail(res.reason);
      const card = side.queuedSpellCards[queueId];
      side.cards = { ...res.state, hand: card ? [...res.state.hand, card] : res.state.hand };
      delete side.queuedSpellCards[queueId];
      if (card) {
        const id = card.id.replace('spell-', '');
        side.stats.spells[id] -= 1;
        side.stats.supplySpent -= card.cost;
      }
      return { ok: true };
    },
    equip({ faction: f, cardId, unitType }) {
      const side = sides[f];
      const card = side.cards.hand.find((x) => x.instanceId === cardId);
      if (!card || card.type !== 'skill') return fail('skill-card-not-found');
      if (side.cards.supply < card.cost) return fail('insufficient-supply');
      if ((side.loadouts[unitType] || []).some((s) => s.id === card.skillId)) return fail('already-equipped');
      const res = equipTypeSkill(side.loadouts, unitType, { ...SKILL_CARDS[card.skillId], id: card.skillId }, { slots: 2 });
      if (!res.ok) return fail(res.reason);
      side.loadouts = res.loadouts;
      side.cards = { ...side.cards, supply: side.cards.supply - card.cost, hand: side.cards.hand.filter((x) => x.instanceId !== cardId) };
      side.stats.skills += 1;
      side.stats.supplySpent += card.cost;
      return { ok: true };
    },
    transfer({ faction: f, skillId, from, to }) {
      const res = transferTypeSkill(sides[f].loadouts, from, to, skillId, { slots: 2 });
      if (!res.ok) return fail(res.reason);
      sides[f].loadouts = res.loadouts;
      return { ok: true };
    },
    combine({ faction: f, ids, survivorId, destination }) {
      const side = sides[f];
      const records = armyRecords(f);
      const choice = { survivorId, destination };
      const preview = previewUpgrade(records, ids, choice);
      if (!preview.ok) return fail(preview.reason);
      if (destination === 'field' && preview.unit.c === undefined) return fail('survivor-not-on-field');
      const res = combineUnits(records, ids, choice);
      if (!res.ok) return fail(res.reason);
      const consumed = new Set(ids);
      m.units = m.units.filter((u) => !consumed.has(u.id));
      side.cards = { ...side.cards, reserves: side.cards.reserves.filter((u) => !consumed.has(u.id)) };
      if (res.unit.state === 'reserve') side.cards.reserves.push({ ...res.unit, unitId: res.unit.unitId || res.unit.cls, faction: f });
      else m.units.push(res.unit);
      side.stats.combined += 1;
      return { ok: true, unitId: res.unit.id, stars: res.unit.stars, populationDelta: res.populationDelta };
    },
  };

  /** Apply one planning action. `actor` is 'human' or 'ai:<policy>' (for the log only). */
  function apply(action, actor = 'human') {
    const blocked = planning(action.faction);
    const handler = handlers[action.type];
    const result = blocked ? fail(blocked) : handler ? handler(action) : fail('unknown-action');
    if (sides[action.faction]) sides[action.faction].cards.population = population(action.faction);
    emit({ t: 'action', round: m.round, actor, action, ok: result.ok, reason: result.reason, result: result.ok ? stripOk(result) : undefined });
    return result;
  }
  const stripOk = ({ ok, reason, path, ...rest }) => (Object.keys(rest).length ? rest : undefined);

  // ---------- battle ----------
  /**
   * Resolve the round: queued spells, ability activations, simultaneous movement and combat, deaths,
   * captures, the end check, then (if the match continues) the next round's refresh. Returns
   * { batches, notes, over } where batches are ordered presentation groups:
   *   spells   [{ faction, spellId, targetId?, amount?, events? }]
   *   abilities [{ unitId, abilityId, name, effect }]
   *   movement [{ type: 'move' | 'hold', unitId, from, to, path? }]
   *   combat   [{ type: 'strike' ... } | { type: 'death', unitId }]
   *   results  [{ type: 'capture' | 'respawn' | 'draw' | 'end', ... }]
   */
  function resolveRound() {
    if (m.over || m.phase !== 'planning') return { batches: [], notes: [], over: m.over };
    m.phase = 'battle';
    const batches = [];
    const notes = [];
    const before = new Map(alive().map((u) => [u.id, u.hp]));

    // 1. Spells, each side against its own friendly faction.
    const spellEvents = [];
    for (const f of FACTIONS) {
      const side = sides[f];
      if (!(side.cards.queuedSpells || []).length) continue;
      const res = resolveQueuedSpells(side.cards, alive(), { friendlyFaction: f });
      for (const rec of res.units) Object.assign(byId(rec.id), rec);
      side.cards = { ...res.state };
      side.queuedSpellCards = {};
      for (const e of res.events) spellEvents.push({ faction: f, ...e });
    }
    batches.push({ type: 'spells', events: spellEvents });
    const spellDeaths = [...before].filter(([id, hp]) => hp > 0 && byId(id).hp <= 0).map(([id]) => id);

    // 2. Ability activations (Rally, ...).
    const abilityEvents = [];
    for (const u of alive()) {
      const act = resolveAbilityActivation(u);
      Object.assign(u, act.unit);
      for (const fired of act.fired) abilityEvents.push({ unitId: u.id, ...fired });
    }
    batches.push({ type: 'abilities', events: abilityEvents });

    // 3. Simultaneous movement and combat from one shared snapshot.
    const snapshot = alive().map((u) => ({ ...u, statuses: { ...(u.statuses || {}) } }));
    for (const u of snapshot) {
      const barrier = skillsForUnitType(sides[u.faction].loadouts, u.cls).find((s) => s.id === 'barrier');
      if (barrier) u.statuses.barrier = { amount: barrier.blockDamage, duration: 'upcoming-battle' };
    }
    const ids = new Set(snapshot.map((u) => u.id));
    const orders = Object.fromEntries(snapshot.map((u) => {
      let stance = u.stance || 'advance';
      // A Protect order whose subject has fallen reverts to the class default (GAME.md, Stances).
      if (stance === 'protect' && !(u.objective?.type === 'protect' && ids.has(u.objective.targetId))) stance = UNIT_CARDS[u.cls]?.defaultStance || 'advance';
      const order = { stance, range: weaponOf(u).rng, objective: u.objective };
      // Tile objective (march on a keep or village): head for it unless a foe is already in weapon range.
      if (stance === 'advance' && u.objective?.type === 'tile') {
        const [lo, hi] = weaponOf(u).rng;
        const engaged = snapshot.some((o) => o.faction !== u.faction && Math.abs(o.c - u.c) + Math.abs(o.r - u.r) >= lo && Math.abs(o.c - u.c) + Math.abs(o.r - u.r) <= hi);
        if (!engaged) {
          const goal = u.objective;
          const d = (p) => Math.abs(p[0] - goal.c) + Math.abs(p[1] - goal.r);
          const occupied = new Set(snapshot.map((o) => `${o.c},${o.r}`));
          const best = computeRange(u, board(snapshot), u.mov).move
            .filter(([c, r]) => !occupied.has(`${c},${r}`) || (c === u.c && r === u.r))
            .sort((a, b) => d(a) - d(b) || a[1] - b[1] || a[0] - b[0])[0];
          if (best && d(best) < d([u.c, u.r])) order.destination = { c: best[0], r: best[1] };
        }
      }
      return [u.id, order];
    }));
    const battle = resolveBattleRound({
      units: snapshot, orders, seed: (m.seed + m.round) >>> 0,
      legalMoves: (u, shared) => computeRange(u, board(shared), u.mov).move.map(([c, r]) => ({ c, r })),
      forecastAttack: (a, d, from) => forecast(a, d, [from.c, from.r]),
    });
    const preBoard = board(snapshot);
    const movement = battle.batches[0].events.map((e) => {
      if (e.type !== 'move') return e;
      const start = snapshot.find((u) => u.id === e.unitId);
      return { ...e, path: computeRange(start, preBoard, start.mov).pathTo(e.to.c, e.to.r) };
    });
    batches.push({ type: 'movement', events: movement });
    batches.push({ type: 'combat', events: battle.batches[1].events });
    for (const rec of battle.units) Object.assign(byId(rec.id), rec);

    // 4. Deaths (spell deaths included), champions, captures, end check.
    const results = [];
    const deaths = [...spellDeaths, ...battle.batches[1].events.filter((e) => e.type === 'death').map((e) => e.unitId)];
    const killerOf = new Map();
    for (const e of battle.batches[1].events) if (e.type === 'strike' && e.damage > 0) killerOf.set(e.targetId, e.attackerId);
    for (const id of deaths) {
      const u = byId(id);
      const side = sides[u.faction];
      side.stats.lost[u.cls] = (side.stats.lost[u.cls] || 0) + 1;
      const killer = byId(killerOf.get(id));
      if (killer) sides[killer.faction].stats.killed[u.cls] = (sides[killer.faction].stats.killed[u.cls] || 0) + 1;
      if (id === CHAMPION[u.faction]) {
        side.heroRespawnAt = m.round + RULES.heroRespawnDelay;
        notes.push({ faction: u.faction, text: `${u.name} returns in round ${side.heroRespawnAt} for ${RULES.heroRespawnCost} Supply` });
      }
      notes.push({ faction: u.faction, text: `${u.name} fallen` });
    }
    for (const loc of territory.keys()) {
      const [c, r] = loc.split(',').map(Number);
      const occ = unitAt(c, r);
      if (terrainAt(c, r) === 'V' && occ && territory.get(loc) !== occ.faction) {
        const lostBy = territory.get(loc);
        territory.set(loc, occ.faction);
        sides[occ.faction].stats.captures += 1;
        results.push({ type: 'capture', c, r, faction: occ.faction, from: lostBy });
        notes.push({ faction: occ.faction, text: `Captured village at ${c},${r}` });
        if (lostBy) notes.push({ faction: lostBy, text: `Lost village at ${c},${r}` });
      }
    }
    checkEnd();
    if (m.over) {
      results.push({ type: 'end', winner: m.winner, reason: m.reason });
      batches.push({ type: 'results', events: results });
      emit({ t: 'round', round: m.round, batches });
      emit(summaryEntry());
      emit({ t: 'result', round: m.round, winner: m.winner, reason: m.reason, stats: statsEntry() });
      return { batches, notes, over: true };
    }

    // 5. Next round: draws, ability upkeep, reserve recovery, champion respawn.
    const finished = m.round;
    m.round += 1;
    for (const f of FACTIONS) {
      const side = sides[f];
      side.cards.population = population(f);
      const res = refreshRound(side.cards, side.rng);
      side.cards = res.state;
      if (res.blocked) {
        side.stats.blockedDraws += res.blocked;
        notes.push({ faction: f, text: `Hand full: ${res.blocked} draw${res.blocked === 1 ? '' : 's'} blocked.` });
      }
      results.push({ type: 'draw', faction: f, drawn: res.drawn.map((c) => c.id), blocked: res.blocked, supply: side.cards.supply });
      side.cards.reserves = side.cards.reserves.map((reserve) => {
        const rested = advanceAbilityRound({ ...reserve, energy: reserve.energy ?? 0, maxEnergy: reserve.maxEnergy ?? 4 });
        return { ...reserve, cooldowns: rested.cooldowns, energy: Math.min(rested.maxEnergy, rested.energy + RULES.reserveEnergy), maxEnergy: rested.maxEnergy,
          hp: reserve.hp == null ? null : Math.min(reserve.maxHp, reserve.hp + RULES.reserveHeal) };
      });
    }
    for (const u of m.units) {
      if (u.hp <= 0) continue;
      Object.assign(u, advanceAbilityRound(u));
      u.planningMoved = false;
    }
    for (const f of FACTIONS) {
      const back = tryRespawn(f);
      if (back) { results.push(back); notes.push({ faction: f, text: back.text }); }
    }
    for (const f of FACTIONS) sides[f].cards.population = population(f);
    m.phase = 'planning';
    if (m.maxRounds && m.round > m.maxRounds) { end(null, 'round-limit'); results.push({ type: 'end', winner: null, reason: 'round-limit' }); }
    batches.push({ type: 'results', events: results });
    emit({ t: 'round', round: finished, batches });
    emit(summaryEntry(finished));
    if (m.over) emit({ t: 'result', round: finished, winner: m.winner, reason: m.reason, stats: statsEntry() });
    return { batches, notes, over: m.over };
  }

  function tryRespawn(f) {
    const side = sides[f];
    if (side.heroRespawnAt === null || m.round < side.heroRespawnAt) return null;
    if (side.cards.supply < RULES.heroRespawnCost) return null;
    const tile = deploymentTiles(f).find(([c, r]) => !unitAt(c, r) && MOVE_COST.armor[terrainAt(c, r)] !== undefined);
    if (!tile) return null;
    const hero = prepare(createHeroRespawnData(CHAMPION[f], tile[0], tile[1]));
    m.units = m.units.filter((u) => u.id !== hero.id);
    m.units.push(hero);
    side.cards = { ...side.cards, supply: side.cards.supply - RULES.heroRespawnCost };
    side.heroRespawnAt = null;
    side.stats.respawns += 1;
    return { type: 'respawn', faction: f, unitId: hero.id, c: tile[0], r: tile[1], text: `${hero.name} returned at the base for ${RULES.heroRespawnCost} Supply.` };
  }

  function end(winner, reason) { m.over = true; m.phase = 'over'; m.winner = winner; m.reason = reason; }

  // A side wins by holding the other side's keep at the end of a battle, or when the other side has
  // no units, reserves or pending champion left.
  function checkEnd() {
    for (const f of FACTIONS) {
      if (alive(f).some((u) => terrainAt(u.c, u.r) === TARGET[f])) return end(f, 'keep-captured');
    }
    for (const f of FACTIONS) {
      const gone = !alive(f).length && !sides[f].cards.reserves.length && sides[f].heroRespawnAt === null;
      if (gone) return end(other(f), 'army-destroyed');
    }
    return null;
  }

  // ---------- reporting ----------
  function sideSummary(f) {
    const side = sides[f];
    const field = alive(f);
    const byClass = {};
    for (const u of field) byClass[`${u.cls}${(u.stars || 1) > 1 ? `*${u.stars}` : ''}`] = (byClass[`${u.cls}${(u.stars || 1) > 1 ? `*${u.stars}` : ''}`] || 0) + 1;
    return {
      supply: side.cards.supply, population: population(f), hand: side.cards.hand.map((c) => c.id),
      reserves: side.cards.reserves.map((u) => u.unitId), field: byClass, units: field.length,
      hp: field.reduce((s, u) => s + u.hp, 0), maxHp: field.reduce((s, u) => s + u.maxHp, 0),
      energy: field.reduce((s, u) => s + (u.energy || 0), 0),
      territory: [...territory.values()].filter((o) => o === f).length,
      championDown: side.heroRespawnAt !== null,
    };
  }
  const summaryEntry = (round = m.round) => ({ t: 'summary', round, blue: sideSummary('blue'), red: sideSummary('red') });
  const statsEntry = () => ({ blue: clone(sides.blue.stats), red: clone(sides.red.stats) });

  for (const f of FACTIONS) sides[f].cards.population = population(f);
  emit({ t: 'header', schema: SCHEMA, seed, maxRounds, map: MAP_ID, rules: RULES, cardLimits: CARD_LIMITS, ...meta });
  emit(summaryEntry(0));

  Object.assign(m, {
    alive, byId, unitAt, board, population, deploymentTiles, canDeployAt, canWithdraw, armyRecords,
    apply, resolveRound, summary: sideSummary, stats: statsEntry, champion: (f) => CHAMPION[f], home: (f) => HOME[f],
  });
  return m;
}

const MAP_ID = 'river_ford';
