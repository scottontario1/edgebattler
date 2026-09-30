// Match controller: the authoritative state of one game and the only code that changes it.
// Pure data (no DOM, no Three.js), so the browser UI (src/ui.js) and the Node simulator
// (tools/sim/) run exactly the same rules. Every change goes through `apply(action)` during
// planning or `resolveRound()` for the battle, and each is reported to the optional `log` hook
// (src/log.js), which makes games replayable from their seed plus the logged actions.
//
// Actions (plain objects, identical for humans and AI):
//   { type: 'recruit', faction, cardId }                     buy a unit card onto the reserve bench
//   { type: 'deploy', faction, reserveId, c, r }             reserve -> controlled deployment tile
//   { type: 'muster', faction, unitId, reserveId, c, r }      experimental: unit spends energy to place a bench unit on an adjacent tile
//   { type: 'withdraw', faction, unitId }                    field unit on a controlled tile -> bench
//   { type: 'move', faction, unitId, c, r }                  one planning move within MOV
//   { type: 'stance', faction, unitId, stance, targetId?, tile? }  advance | hold | protect (targetId);
//                                                            advance + tile [c, r] marches on that tile
//   { type: 'spell', faction, cardId, c, r, unitId? }        queue a spell (unit target or area centre)
//   { type: 'cancelSpell', faction, queueId }
//   { type: 'equip', faction, cardId, unitType }             type-wide skill card
//   { type: 'transfer', faction, skillId, from, to }
//   { type: 'combine', faction, ids, survivorId, destination }
import { MAP, W, H, LAYOUT, inBounds, terrainAt } from './board.js';
import { MOVE_COST, MOVE_TYPE, computeRange } from './rules.js';
import { forecast, weaponOf } from './combat.js';
import { CARD_LIMITS, UNIT_CARDS, unitCardFor, RARITY_GATE, rarityGateActive, skillCardFor, createCardState, drawOpeningHand, refreshRound, recruitUnit, canDeployReserve, seededRandom, cycleCard } from './cards.js';
import { SPELL_CATALOG, kitFor, advanceAbilityRound, initializeAbilityState, queueSpell, cancelSpell, activatePhase, paidBundleReady, validateAbilitySelection, facingFromPath, FACING, battleMovement, ABILITY_RULES, ABILITIES, resolveQueuedSpells, equipTypeSkill, transferTypeSkill, skillsForUnitType } from './abilities.js';
import { previewUpgrade, combineUnits } from './upgrades.js';
import { resolveBattleRound, selectAttackTarget, BATTLE_TUNING } from './battle.js';
import { evaluatePassives, hasRevenant } from './passives.js';
import { ACTIVE_CULTURES } from './cultures.js';
import { UNITS, createRecruitUnit, createHeroRespawnData, createGradedRecruitUnit } from './roster.js';

export const SCHEMA = 3;
// Prototype pacing values (GAME.md "Decisions to tune"). Logged in every header.
export const RULES = Object.freeze({
  heroRespawnDelay: 2, // rounds after the champion's death before it can return
  heroRespawnCost: 1,  // Supply paid on return
  reserveHeal: 4,      // HP a benched unit recovers per round
  reserveEnergy: 1,    // extra energy a benched unit gains per round
});
// Experiments only (experiments/economy): deployOnKeep false forbids deploying or respawning onto the keep tile itself.
// deployRangeKeep / deployRangeVillage: Manhattan radius of the deployment area around an owned keep / village (shipped: 1).
// muster: null, or { cost, cooldown, classes } enabling the Muster planning action (bench unit onto an adjacent empty tile).
export const DEFAULT_EXPERIMENT_RULES = Object.freeze({ deployOnKeep: true, deployRangeKeep: 1, deployRangeVillage: 1, muster: null });
export const EXPERIMENT_RULES = { ...DEFAULT_EXPERIMENT_RULES };
export const setExperimentRules = (o = {}) => Object.assign(EXPERIMENT_RULES, DEFAULT_EXPERIMENT_RULES, o);
// Offsets by ring: the shipped five first (order matters for ties), then wider rings.
const OFFSETS = (() => { const out = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]; for (let d = 2; d <= 8; d += 1) for (let dc = -d; dc <= d; dc += 1) for (const dr of [d - Math.abs(dc), -(d - Math.abs(dc))]) if (dr !== 0 || Math.abs(dc) === d) { if (!out.some(([a, b]) => a === dc && b === dr)) out.push([dc, dr]); } return out; })();
export const FACTIONS = ['blue', 'red'];
// Candidate equipment adds to Str/Def for one battle's forecasts only (no-op unless statuses.equip* is set).
const withEquip = (u) => (u.statuses?.equipStr || u.statuses?.equipDef ? { ...u, str: u.str + (u.statuses.equipStr || 0), def: u.def + (u.statuses.equipDef || 0) } : u);
const DEFAULT_CHAMPION = { blue: 'brenna', red: 'dreg' };
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
// pools: optional { blue: [cardKeys], red: [cardKeys] } per-side draw pools (cultures); absent = the shared pool.
// champions: optional { blue: id, red: id } (cultures with their own champion); default Brenna and Dreg.
export function createMatch({ seed = 0x415348, maxRounds = null, log = null, meta = {}, roster = UNITS, pools = null, champions = null, campaign = null } = {}) {
  const CHAMPION = { ...DEFAULT_CHAMPION, ...(champions || {}) };
  const emit = (entry) => { if (log) log(entry); };
  const units = clone(roster).map((u) => {const next=prepare(u);next.energy=Math.min(next.maxEnergy,next.energy+1);return next;});
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
    const cards = drawOpeningHand(createCardState({ population: 0, pool: pools?.[f] }), rng).state;
    sides[f] = { cards, rng, loadouts: {}, queuedSpellCards: {}, heroRespawnAt: null,
      stats: { recruited: {}, spells: {}, skills: 0, deployed: 0, withdrawn: 0, combined: 0, lost: {}, killed: {}, supplySpent: 0, captures: 0, respawns: 0, blockedDraws: 0, abilities: {}, abilitySkips: {}, energySpent: 0, energyCapped: 0, cycles: {hand:0,bench:0}, supplyRefunded: 0 } };
  }
  const m = { seed, maxRounds, round: 1, phase: 'planning', over: false, winner: null, reason: null, units, territory, sides, seq: 0, objects: [] };

  if (campaign) {
    m.campaign = { ...clone(campaign), stage: 0, wave: 0, phase: 'engage', rallied: false };
    sides.red.cards.hand = [];
    sides.red.cards.supply = 0;
  }

  // Authored waves are match state, not AI recruitment. Reserve future units until their
  // encounter starts, and search nearby legal tiles if a player occupies the spawn point.
  function spawnCampaignWave() {
    const state = m.campaign;
    const wave = state.stages[state.stage].waves[state.wave];
    for (const record of wave) {
      const candidates = [];
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        if (Math.abs(r-record.r)<=2 && Math.abs(c-record.c)<=3 && !unitAt(c,r) && !objectAt(c,r) && MOVE_COST[MOVE_TYPE[record.cls] || 'foot'][terrainAt(c,r)] !== undefined)
          candidates.push([c,r]);
      }
      candidates.sort((a,b) => (Math.abs(a[0]-record.c)+Math.abs(a[1]-record.r))-(Math.abs(b[0]-record.c)+Math.abs(b[1]-record.r)) || a[1]-b[1] || a[0]-b[0]);
      if (!candidates.length) throw new Error('Campaign wave has no legal spawn tile');
      const [c,r] = candidates[0];
      m.units.push(prepare({ ...clone(record), c, r }));
    }
    state.phase = 'engage';
  }

  // ---------- tile objects (culture hook: barricades, corpses; none exist in the game) ----------
  // { id, kind: 'object', objectKind, faction (owner), c, r, hp, maxHp, blocks, decay }. A blocking object stops enemy movement
  // (friends walk through but cannot stop on it) and is struck only when no real enemy is in reach; a non-blocking one (corpse)
  // is just a marker. `decay` counts rounds down and removes it at 0; null lasts until destroyed or consumed.
  const objectAt = (c, r) => m.objects.find((o) => o.hp > 0 && o.c === c && o.r === r) || null;
  const blockingObjects = () => m.objects.filter((o) => o.hp > 0 && o.blocks);
  function addObject({ objectKind, faction, c, r, hp = 10, blocks = true, decay = null, name }) {
    const o = { id: `obj-${++m.seq}`, kind: 'object', objectKind, name: name || objectKind, cls: 'object', faction, c, r, hp, maxHp: hp, blocks, decay,
      str: 0, mag: 0, skl: 0, spd: 0, def: 0, res: 0, mov: 0, weapon: null, statuses: {} };
    m.objects.push(o);
    return o;
  }
  const consumeObject = (id) => { const i = m.objects.findIndex((o) => o.id === id); if (i < 0) return false; m.objects.splice(i, 1); return true; };
  const objectsNear = (c, r, n, objectKind) => m.objects.filter((o) => o.hp > 0 && Math.abs(o.c - c) + Math.abs(o.r - r) <= n && (!objectKind || o.objectKind === objectKind));
  // Where a spawn ability puts its object: 'front' = the adjacent tile the unit faces, 'self' = its own tile.
  function spawnFor(u, spawn) {
    let [c, r] = [u.c, u.r];
    if (spawn.at !== 'self') { const f = FACING[u.facing] || FACING[u.faction === 'red' ? 'south' : 'north']; c += f[0]; r += f[1]; }
    const free = inBounds(c, r) && MOVE_COST.foot[terrainAt(c, r)] !== undefined && !unitAt(c, r) && !objectAt(c, r);
    if (!free) return null;
    return addObject({ objectKind: spawn.kind, faction: u.faction, c, r, hp: spawn.hp, blocks: spawn.blocks, decay: spawn.decay, name: spawn.name });
  }

  function prepare(u) {
    Object.assign(u, initializeAbilityState(u, {
      stance: u.stance || unitCardFor(u.cls)?.defaultStance || (u.cls === 'archer' ? 'hold' : 'advance'),
      selectedAbilities: u.selectedAbilities || [],
    }));
    u.costPaid=u.costPaid??0;
    u.rarity=u.rarity??unitCardFor(u.variantId ?? u.cls)?.rarity??'common';
    u.state = 'field';
    u.population = u.population ?? 1;
    u.planningMoved = false;
    return u;
  }

  // ---------- queries ----------
  const alive = (f) => m.units.filter((u) => u.hp > 0 && (!f || u.faction === f));
  const byId = (id) => m.units.find((u) => u.id === id) || null;
  // Standing on a keep or village its side owns (culture ability/passive condition `onControlled`).
  const onOwnedTile = (u) => territory.get(`${u.c},${u.r}`) === u.faction;
  const unitAt = (c, r) => m.units.find((u) => u.hp > 0 && u.c === c && u.r === r) || null;
  /** A computeRange-compatible board over plain records. */
  const board = (records = alive()) => {
    const ids = new Set(records.map((d) => d.id));
    const list = [...records, ...blockingObjects().filter((o) => !ids.has(o.id))].map((d) => ({ data: d }));
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
      const range = 'CK'.includes(terrainAt(c, r)) ? EXPERIMENT_RULES.deployRangeKeep : EXPERIMENT_RULES.deployRangeVillage;
      for (const [dc, dr] of OFFSETS) {
        if (Math.abs(dc) + Math.abs(dr) > range) continue;
        if (!EXPERIMENT_RULES.deployOnKeep && 'CK'.includes(terrainAt(c + dc, r + dr) ?? '')) continue;
        if (inBounds(c + dc, r + dr)) out.set(`${c + dc},${r + dr}`, [c + dc, r + dr]);
      }
    }
    return [...out.values()];
  }
  function canDeployAt(f, reserveId, c, r) {
    const cs = sides[f].cards;
    const reserve = cs.reserves.find((u) => u.id === reserveId);
    const moveType = MOVE_TYPE[reserve?.classId || reserve?.unitId] || 'foot';
    return canDeployReserve(cs, reserveId, {
      location: deploymentTiles(f).some(([x, y]) => x === c && y === r),
      tile: { occupied: !!unitAt(c, r) || !!blockingObjects().some((o) => o.c === c && o.r === r), traversable: MOVE_COST[moveType][terrainAt(c, r)] !== undefined, terrain: terrainAt(c, r) === 'W' ? 'water' : terrainAt(c, r) },
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
        selectedAbilities: reserve.selectedAbilities ?? t.selectedAbilities, stance: reserve.stance ?? t.stance, faction: f, state: 'reserve' };
      delete rec.c; delete rec.r;
      return rec;
    });
    return [...reserves, ...alive(f)];
  }

  // ---------- planning actions ----------
  const fail = (reason) => ({ ok: false, reason });
  const planning = (f) => (m.over ? 'match-over' : m.phase !== 'planning' ? 'not-planning' : !sides[f] ? 'unknown-faction' : null);

  const handlers = {
    campaignOrder({ faction: f }) {
      if (!m.campaign || f !== 'blue') return fail('not-campaign');
      const tile = m.campaign.stages[m.campaign.stage].checkpoint;
      for (const u of alive('blue')) { u.stance = 'advance'; u.objective = { type: 'tile', c: tile[0], r: tile[1] }; }
      return { ok: true, tile };
    },
    campaignRally({ faction: f }) {
      const state = m.campaign;
      if (!state || f !== 'blue' || state.phase !== 'regroup' || state.rallied) return fail('rally-unavailable');
      const [c,r] = state.stages[state.stage].checkpoint;
      if (!alive('blue').some(u => Math.abs(u.c-c)+Math.abs(u.r-r)<=2)) return fail('reach-rally-point');
      // One modest recovery at a cleared checkpoint; casualties stay permanent.
      const restored = [];
      for (const u of alive('blue').filter(u => Math.abs(u.c-c)+Math.abs(u.r-r)<=2)) {
        const amount = Math.min(RULES.reserveHeal, u.maxHp-u.hp); u.hp += amount;
        restored.push({ unitId: u.id, amount });
      }
      state.rallied = true;
      return { ok: true, restored };
    },
    campaignContinue({ faction: f }) {
      const state = m.campaign;
      if (!state || f !== 'blue' || (state.phase !== 'regroup' || state.stage+1 >= state.stages.length)) return fail('encounter-not-cleared');
      const [c,r] = state.stages[state.stage].checkpoint;
      if (!alive('blue').some(u => Math.abs(u.c-c)+Math.abs(u.r-r)<=2)) return fail('reach-rally-point');
      state.stage += 1; state.wave = 0; state.rallied = false;
      spawnCampaignWave();
      return { ok: true, stage: state.stage };
    },
    recruit({ faction: f, cardId }) {
      const side = sides[f];
      side.cards.population = population(f);
      const res = recruitUnit(side.cards, cardId);
      if (!res.ok) return fail(res.reason);
      const id=`${f}-r${++m.seq}-${res.reserve.unitId}`;
      const graded=createGradedRecruitUnit(res.reserve.unitId,id,f,res.reserve.stars);
      const reserve={...graded,...res.reserve,id,faction:f,state:'reserve',hp:graded.maxHp,maxHp:graded.maxHp};delete reserve.c;delete reserve.r;
      side.cards = { ...res.state, reserves: [...res.state.reserves.slice(0, -1), reserve] };
      side.stats.recruited[reserve.unitId] = (side.stats.recruited[reserve.unitId] || 0) + 1;
      side.stats.supplySpent += res.supplySpent;
      return { ok: true, reserveId: reserve.id, unitId: reserve.unitId };
    },
    cycle({faction:f,source,id}) {
      const side=sides[f];
      side.cards.population=population(f);
      const result=cycleCard(side.cards,{source,id},side.rng);
      if(!result.ok) return fail(result.reason);
      side.cards=result.state;
      side.stats.cycles[source]+=1;side.stats.supplyRefunded+=result.refund;
      return {ok:true,replacement:result.replacement,refund:result.refund,populationFreed:result.populationFreed};
    },
    deploy({ faction: f, reserveId, c, r, free = false }) {
      const side = sides[f];
      const reserve = side.cards.reserves.find((u) => u.id === reserveId);
      if (!reserve) return fail('reserve-not-found');
      const legal = free ? canDeployReserve(side.cards, reserveId, { location: true, tile: { occupied: !!unitAt(c, r), traversable: MOVE_COST[MOVE_TYPE[reserve.classId || reserve.unitId] || 'foot'][terrainAt(c, r)] !== undefined, terrain: terrainAt(c, r) === 'W' ? 'water' : terrainAt(c, r) } }) : canDeployAt(f, reserveId, c, r);
      if (!legal.ok) return fail(legal.reason);
      const id = reserve.fieldId && !byId(reserve.fieldId) ? reserve.fieldId : `${f}-u${++m.seq}-${reserve.unitId}`;
      const unit = createRecruitUnit(reserve.unitId, id, f, c, r, { stance: unitCardFor(reserve.unitId)?.defaultStance });
      // A reserve may carry more than the class template: combined stars and stats, hurt HP, stored energy.
      const carried = Object.fromEntries(Object.entries(reserve).filter(([k, v]) => v != null && !['id', 'fieldId', 'state', 'faction', 'c', 'r', 'unitId'].includes(k)));
      Object.assign(unit, carried);
      Object.assign(unit, initializeAbilityState(unit));
      unit.id = id; unit.faction = f; unit.c = c; unit.r = r; unit.state = 'field'; unit.planningMoved = false;
      side.cards = { ...side.cards, reserves: side.cards.reserves.filter((u) => u.id !== reserveId) };
      m.units = m.units.filter((u) => u.id !== id); // a fallen copy with the same id
      m.units.push(unit);
      side.stats.deployed += 1;
      return { ok: true, unitId: id };
    },
    // Experimental Muster: a field unit spends energy to put a bench unit on an empty tile next to it.
    muster({ faction: f, unitId, reserveId, c, r }) {
      const cfg = EXPERIMENT_RULES.muster;
      if (!cfg) return fail('muster-unavailable');
      const u = byId(unitId);
      if (!u || u.faction !== f || u.hp <= 0) return fail('unit-not-found');
      if (cfg.classes && !cfg.classes.includes(u.cls)) return fail('class-cannot-muster');
      if ((u.cooldowns?.muster || 0) > 0) return fail('cooldown');
      if ((u.energy || 0) < cfg.cost) return fail('insufficient-energy');
      if (Math.abs(u.c - c) + Math.abs(u.r - r) !== 1) return fail('not-adjacent');
      const res = handlers.deploy({ faction: f, reserveId, c, r, free: true });
      if (!res.ok) return res;
      u.energy -= cfg.cost;
      u.cooldowns = { ...(u.cooldowns || {}), muster: cfg.cooldown };
      sides[f].stats.mustered = (sides[f].stats.mustered || 0) + 1;
      return { ok: true, unitId: res.unitId, by: u.id };
    },
    withdraw({ faction: f, unitId }) {
      const u = byId(unitId);
      if (!canWithdraw(f, u)) return fail(u?.id === CHAMPION[f] ? 'champion-cannot-bench' : 'not-on-controlled-tile');
      const reserve = { ...clone(u), id: `${f}-r${++m.seq}-${u.variantId ?? u.cls}`, fieldId: u.id, unitId: u.variantId ?? u.cls, faction: f, state: 'reserve' };
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
      u.facing = facingFromPath([[u.c,u.r],...path],u.facing);
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
    abilities({faction:f,unitId,unitIds,abilityIds}) {
      const ids=unitIds??[unitId];
      if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length) return fail('invalid-group');
      const targets=ids.map(byId);
      for(const u of targets) {
        if(!u||u.hp<=0||u.faction!==f) return fail('unit-not-found');
        const check=validateAbilitySelection(u,abilityIds);
        if(!check.ok) return {...check,unitId:u.id};
      }
      for(const u of targets) u.selectedAbilities=[...new Set(abilityIds)];
      return {ok:true,unitIds:ids};
    },
    facing({faction:f,unitId,facing}) {
      const u=byId(unitId);
      if(!u||u.hp<=0||u.faction!==f) return fail('unit-not-found');
      if(!FACING[facing]) return fail('invalid-facing');
      u.facing=facing; return {ok:true};
    },
    // Culture hook: aim a mark ability (kit ability with `mark: { radius }`, e.g. Blood Challenge) at an enemy. It only takes
    // effect if the ability is selected and activates this round; without an intent the nearest enemy in radius is marked.
    mark({ faction: f, unitId, targetId }) {
      const u = byId(unitId);
      if (!u || u.hp <= 0 || u.faction !== f) return fail('unit-not-found');
      const def = kitFor(u).find((a) => a.mark);
      if (!def) return fail('no-mark-ability');
      const t = byId(targetId);
      if (!t || t.hp <= 0 || t.faction === f || t.kind === 'object') return fail('invalid-target');
      if (Math.abs(t.c - u.c) + Math.abs(t.r - u.r) > def.mark.radius) return fail('out-of-range');
      u.markIntent = targetId;
      return { ok: true };
    },
    spell({ faction: f, cardId, c, r, unitId }) {
      const side = sides[f];
      const card = side.cards.hand.find((x) => x.instanceId === cardId);
      if (!card || card.type !== 'spell') return fail('spell-card-not-found');
      const spellId = card.id.replace('spell-', '');
      let target;
      if (SPELL_CATALOG[spellId]?.target === 'enemy-area') target = { kind: 'area', x: c, y: r };
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
      const res = equipTypeSkill(side.loadouts, unitType, { ...skillCardFor(card.skillId), id: card.skillId }, { slots: 2 });
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
    const blocked = planning(action.faction) || (m.campaign && action.faction === 'red' ? 'fixed-encounter-enemy' : null);
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

    // Freeze paid-bundle eligibility before recovery so support cannot fund this round's picks.
    const paid=new Map(alive().map(u=>[u.id,paidBundleReady(u)]));
    const recordAbilities=events=>{
      for(const e of events) {
        const stats=sides[byId(e.unitId).faction].stats;
        const bucket=e.applied?stats.abilities:stats.abilitySkips;
        const key=e.applied?e.abilityId:e.reason;
        bucket[key]=(bucket[key]||0)+1;
        if(e.applied) {stats.energySpent+=e.cost;stats.energyCapped+=e.energyCapped||0;}
      }
    };
    const defenseEvents=[];
    for(const u of alive()) {
      const act=activatePhase(u,'defense',{paid:paid.get(u.id),onControlled:onOwnedTile(u),objectCount:(k,r)=>objectsNear(u.c,u.r,r,k).length});
      Object.assign(u,act.unit);defenseEvents.push(...act.events);
      // Spawn abilities (phase 'defense', before movement): put a tile object (barricade...) in front of or under the unit.
      for(const e of act.events) if(e.applied&&e.spawn) {
        const o=spawnFor(u,e.spawn);
        if(o) notes.push({faction:u.faction,text:`${u.name} raised a ${o.name}`});
        else e.spawned=false;
      }
      // Grant abilities (phase 'defense'): numeric battle statuses for friendly units within a radius (Blood Cry, Sanctuary...).
      for(const e of act.events) if(e.applied&&e.grant) {
        const g=e.grant;
        for(const o of alive(u.faction)) {
          if(o.id===u.id?!g.self:Math.abs(o.c-u.c)+Math.abs(o.r-u.r)>g.radius) continue;
          if(g.classes&&!g.classes.includes(o.cls)) continue;
          o.statuses={...(o.statuses||{})};
          for(const [k,v] of Object.entries(g.statuses||{})) o.statuses[k]=(o.statuses[k]||0)+v;
        }
      }
      // Mark abilities (phase 'defense', before movement): the chosen or nearest enemy in radius becomes the unit's target.
      for(const e of act.events) if(e.applied&&e.mark) {
        const foes=alive().filter(o=>o.faction!==u.faction&&Math.abs(o.c-u.c)+Math.abs(o.r-u.r)<=e.mark.radius);
        const chosen=foes.find(o=>o.id===u.markIntent)||foes.sort((a,b)=>Math.abs(a.c-u.c)+Math.abs(a.r-u.r)-Math.abs(b.c-u.c)-Math.abs(b.r-u.r)||String(a.id).localeCompare(String(b.id)))[0];
        if(chosen) u.markTargetId=chosen.id;
      }
    }
    recordAbilities(defenseEvents);
    batches.push({type:'abilities',events:defenseEvents});

    // 3. Simultaneous movement and combat from one shared snapshot.
    const snapshot = alive().map((u) => ({ ...u, statuses: { ...(u.statuses || {}) } }));
    for (const u of snapshot) {
      const barrier = skillsForUnitType(sides[u.faction].loadouts, u.cls).find((s) => s.id === 'barrier');
      if (barrier) u.statuses.barrier = { amount: barrier.blockDamage, duration: 'upcoming-battle' };
      // Candidate passive equipment (statMods) applies for this battle only, through statuses that battle.js clears.
      for (const skill of skillsForUnitType(sides[u.faction].loadouts, u.cls)) {
        if (skill.statMods?.str) u.statuses.equipStr = (u.statuses.equipStr || 0) + skill.statMods.str;
        if (skill.statMods?.def) u.statuses.equipDef = (u.statuses.equipDef || 0) + skill.statMods.def;
      }
    }
    const objectSnap = blockingObjects().map((o) => ({ ...o }));
    const ids = new Set(snapshot.map((u) => u.id));
    const orders = Object.fromEntries(snapshot.map((u) => {
      let stance = u.statuses?.brace || u.statuses?.setSpears ? 'hold' : u.stance || 'advance';
      // A Protect order whose subject has fallen reverts to the class default (GAME.md, Stances).
      if (stance === 'protect' && !(u.objective?.type === 'protect' && ids.has(u.objective.targetId))) stance = unitCardFor(u.cls)?.defaultStance || 'advance';
      const order = { stance, range: weaponOf(u).rng, objective: u.objective };
      // Culture hook: a marked enemy becomes the unit's explicit target (set by a culture ability/action; absent in the game).
      const marked = u.markTargetId ? snapshot.find((o) => o.id === u.markTargetId && o.faction !== u.faction) : null;
      if (marked) order.targetId = marked.id;
      // Tile objective (march on a keep or village): head for it unless a foe is already in weapon range.
      if (stance === 'advance' && u.objective?.type === 'tile') {
        const [lo, hi] = weaponOf(u).rng;
        const engaged = snapshot.some((o) => o.faction !== u.faction && Math.abs(o.c - u.c) + Math.abs(o.r - u.r) >= lo && Math.abs(o.c - u.c) + Math.abs(o.r - u.r) <= hi);
        if (!engaged) {
          const goal = u.objective;
          const d = (p) => Math.abs(p[0] - goal.c) + Math.abs(p[1] - goal.r);
          const occupied = new Set(snapshot.map((o) => `${o.c},${o.r}`));
          const best = computeRange(u, board(snapshot), battleMovement({...u,stance})).move
            .filter(([c, r]) => !occupied.has(`${c},${r}`) || (c === u.c && r === u.r))
            .sort((a, b) => d(a) - d(b) || a[1] - b[1] || a[0] - b[0])[0];
          if (best && d(best) < d([u.c, u.r])) order.destination = { c: best[0], r: best[1] };
        }
      }
      return [u.id, order];
    }));
    const recoveryEvents=[];
    const struckEnergy=new Map(); // unit id -> energy gained if it takes damage this battle (passive energyWhenStruck)
    const battle = resolveBattleRound({
      units: [...snapshot, ...objectSnap], orders, seed: (m.seed + m.round) >>> 0,
      legalMoves: (u, shared) => computeRange(u, board(shared), battleMovement({...u,stance:orders[u.id].stance})).move.map(([c, r]) => ({ c, r })),
      forecastAttack: (a, d, from) => forecast(withEquip(a), withEquip(d), [from.c, from.r]),
      pathForMove:(u,to,shared)=>computeRange(u,board(shared),battleMovement({...u,stance:orders[u.id].stance})).pathTo(to.c,to.r),
      beforeCombat:(moved,events)=>{
        for(const u of moved) {
          if(u.kind==='object') continue;
          const e=events.find(e=>e.unitId===u.id&&e.type==='move');
          if(e) u.facing=facingFromPath([[e.from.c,e.from.r],...e.path],u.facing);
          const act=activatePhase(u,'recovery',{paid:paid.get(u.id),onControlled:onOwnedTile(u),objectCount:(k,r)=>objectsNear(u.c,u.r,r,k).length});
          Object.assign(u,act.unit);recoveryEvents.push(...act.events);
          // Heal-allies ability (recovery phase): heal friendly units within a radius (the healer itself only with `self`).
          for(const e of act.events) if(e.applied&&e.healAllies) {
            const h=e.healAllies;
            e.healed=0;
            for(const o of moved) {
              if(o.kind==='object'||o.faction!==u.faction||o.hp<=0) continue;
              if(o.id===u.id?!h.self:Math.abs(o.c-u.c)+Math.abs(o.r-u.r)>h.radius) continue;
              const before=o.hp;o.hp=Math.min(o.maxHp,o.hp+h.amount);e.healed+=o.hp-before;
            }
          }
          // Consume ability (recovery phase): eat the nearest tile objects of a kind and heal friends around the unit.
          for(const e of act.events) if(e.applied&&e.consume) {
            const c=e.consume;
            const eaten=objectsNear(u.c,u.r,c.radius,c.kind).sort((a,b)=>Math.abs(a.c-u.c)+Math.abs(a.r-u.r)-Math.abs(b.c-u.c)-Math.abs(b.r-u.r)||String(a.id).localeCompare(String(b.id))).slice(0,c.count??1);
            for(const o of eaten) consumeObject(o.id);
            e.consumed=eaten.length;
            if(c.heal&&eaten.length) for(const o of moved) if(o.kind!=='object'&&o.faction===u.faction&&o.hp>0&&Math.abs(o.c-u.c)+Math.abs(o.r-u.r)<=(c.heal.radius??0)) o.hp=Math.min(o.maxHp,o.hp+c.heal.amount);
          }
        }
        // Target eligibility comes from the shared post-move snapshot, never presentation direction.
        for(const u of moved) {
          if(u.kind==='object') continue;
          const act=activatePhase(u,'enhancement',{paid:paid.get(u.id),onControlled:onOwnedTile(u),
            moved:events.some(e=>e.unitId===u.id&&e.type==='move'),
            movedTiles:events.find(e=>e.unitId===u.id&&e.type==='move')?.path?.length||0,
            hasTarget:Boolean(selectAttackTarget(u,moved,(a,d,from)=>forecast(withEquip(a),withEquip(d),[from.c,from.r])))});
          Object.assign(u,act.unit);recoveryEvents.push(...act.events);
        }
        // Culture passives (src/passives.js): evaluated on post-movement positions, before strikes. No-op without `passives`.
        if(moved.some(u=>u.passives?.length)) {
          const movedIds=new Set(events.filter(e=>e.type==='move').map(e=>e.unitId));
          const fx=evaluatePassives(moved,{moved:movedIds,stanceOf:u=>orders[u.id]?.stance||u.stance,controlled:onOwnedTile,objectCount:(u,k,r)=>objectsNear(u.c,u.r,r,k).length});
          for(const u of moved) {
            const add=fx.get(u.id);
            if(!add) continue;
            u.statuses={...(u.statuses||{})};
            for(const [k,v] of Object.entries(add)) {
              if(k==='energyWhenStruck') struckEnergy.set(u.id,(struckEnergy.get(u.id)||0)+v);
              else u.statuses[k]=(u.statuses[k]||0)+v;
            }
          }
        }
        return moved;
      },
    });
    batches.push({type:'movement',events:battle.batches[0].events});
    recordAbilities(recoveryEvents);
    batches.push({type:'abilities',events:recoveryEvents});
    batches.push({ type: 'combat', events: battle.batches[1].events });
    for (const rec of battle.units) {
      if (rec.kind === 'object') { const o = m.objects.find((x) => x.id === rec.id); if (o) o.hp = rec.hp; } else Object.assign(byId(rec.id), rec);
    }
    for (const [id, gain] of struckEnergy) {
      const u = byId(id);
      if (u && u.hp > 0 && battle.batches[1].events.some((e) => e.type === 'strike' && e.targetId === id && e.damage > 0)) u.energy = Math.min(u.maxEnergy, (u.energy || 0) + gain);
    }

    // 4. Deaths (spell deaths included), champions, captures, end check.
    const results = [];
    let deaths = [...spellDeaths, ...battle.batches[1].events.filter((e) => e.type === 'death').map((e) => e.unitId)];
    // Culture hook (revenant passive): once per match a fallen unit returns at the end of the battle with 1 HP on its own tile.
    // Champions never use it (they have their own respawn).
    deaths = deaths.filter((id) => {
      const u = byId(id);
      if (id === CHAMPION[u.faction] || !hasRevenant(u)) return true;
      u.hp = 1; u.revenantUsed = true; u.statuses = {};
      results.push({ type: 'return', faction: u.faction, unitId: id, c: u.c, r: u.r, hp: 1 });
      notes.push({ faction: u.faction, text: `${u.name} returned from death with 1 HP` });
      return false;
    });
    const killerOf = new Map();
    for (const e of battle.batches[1].events) if (e.type === 'strike' && e.damage > 0) killerOf.set(e.targetId, e.attackerId);
    for (const e of battle.batches[1].events) if (e.type === 'objectDestroyed') {
      const o = m.objects.find((x) => x.id === e.unitId);
      if (o) { results.push({ type: 'objectDestroyed', id: o.id, objectKind: o.objectKind, c: o.c, r: o.r }); notes.push({ faction: o.faction, text: `${o.name} destroyed` }); }
    }
    m.objects = m.objects.filter((o) => o.hp > 0);
    for (const id of deaths) {
      const u = byId(id);
      const side = sides[u.faction];
      // Culture hook (`onDeath: { spawn }` on a class or variant): a fallen unit leaves a tile object (a corpse).
      if (u.onDeath?.spawn && id !== CHAMPION[u.faction] && !objectAt(u.c, u.r)) addObject({ objectKind: u.onDeath.spawn.kind, faction: u.faction, c: u.c, r: u.r, hp: u.onDeath.spawn.hp, blocks: u.onDeath.spawn.blocks ?? false, decay: u.onDeath.spawn.decay ?? null, name: u.onDeath.spawn.name });
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

    for (const o of m.objects) if (o.decay !== null && o.decay !== undefined) o.decay -= 1;
    for (const o of m.objects.filter((x) => x.decay !== null && x.decay !== undefined && x.decay <= 0)) results.push({ type: 'objectExpired', id: o.id, objectKind: o.objectKind, c: o.c, r: o.r });
    m.objects = m.objects.filter((o) => o.decay === null || o.decay === undefined || o.decay > 0);

    // 5. Next round: draws, ability upkeep, reserve recovery, champion respawn.
    const finished = m.round;
    m.round += 1;
    for (const f of FACTIONS) {
      const side = sides[f];
      side.cards.population = population(f);
      if (rarityGateActive()) side.cards = { ...side.cards, round: m.round };
      const res = m.campaign && f === 'red' ? { state: side.cards, blocked: 0, drawn: [] } : refreshRound(side.cards, side.rng);
      side.cards = res.state;
      if (res.blocked) {
        side.stats.blockedDraws += res.blocked;
        notes.push({ faction: f, text: `Hand full: ${res.blocked} draw${res.blocked === 1 ? '' : 's'} blocked.` });
      }
      results.push({ type: 'draw', faction: f, drawn: res.drawn.map((c) => c.id), blocked: res.blocked, supply: side.cards.supply });
      side.cards.reserves = side.cards.reserves.map((reserve) => {
        const input={...reserve,energy:reserve.energy??0,maxEnergy:reserve.maxEnergy??4};
        const rested=advanceAbilityRound(input,RULES.reserveEnergy);
        side.stats.energyCapped+=Math.max(0,input.energy+1+RULES.reserveEnergy+(input.energyGainNextTurn||0)-rested.maxEnergy);
        return {...reserve,cooldowns:rested.cooldowns,energy:rested.energy,maxEnergy:rested.maxEnergy,energyGainNextTurn:0,
          hp:reserve.hp==null?null:Math.min(reserve.maxHp,reserve.hp+RULES.reserveHeal)};
      });
    }
    for (const u of m.units) {
      if (u.hp <= 0) continue;
      sides[u.faction].stats.energyCapped+=Math.max(0,u.energy+1+(u.energyGainNextTurn||0)-u.maxEnergy);
      Object.assign(u, advanceAbilityRound(u));
      u.planningMoved = false;
      if (u.markTargetId) delete u.markTargetId;
      if (u.markIntent) delete u.markIntent;
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
    const hero = advanceAbilityRound(prepare({ ...createHeroRespawnData(CHAMPION[f], tile[0], tile[1]), faction: f }));
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
    if (m.campaign) {
      const state = m.campaign;
      if (!alive('blue').length && !sides.blue.cards.reserves.length && sides.blue.heroRespawnAt === null) return end('red','army-destroyed');
      if (alive('red').length) return null;
      const stage = state.stages[state.stage];
      if (state.wave + 1 < stage.waves.length) {
        state.wave += 1; spawnCampaignWave();
      } else if (state.stage + 1 < state.stages.length) {
        state.phase = 'regroup';
      } else {
        state.phase = 'exit';
        if (alive('blue').some(u => u.c === state.exit[0] && u.r === state.exit[1])) return end('blue','campaign-complete');
      }
      return null;
    }
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
      cyclesRemaining:side.cards.cyclesRemaining, handState:clone(side.cards.hand), supply: side.cards.supply, population: population(f), hand: side.cards.hand.map((c) => c.id),
      reserves: side.cards.reserves.map((u) => u.unitId), field: byClass, units: field.length,
      hp: field.reduce((s, u) => s + u.hp, 0), maxHp: field.reduce((s, u) => s + u.maxHp, 0),
      energy: field.reduce((s, u) => s + (u.energy || 0), 0),
      territory: [...territory.values()].filter((o) => o === f).length,
      championDown: side.heroRespawnAt !== null,
      unitState:field.map(u=>({id:u.id,c:u.c,r:u.r,hp:u.hp,energy:u.energy,facing:u.facing,stance:u.stance,objective:u.objective,
        selectedAbilities:u.selectedAbilities,cooldowns:u.cooldowns,energyGainNextTurn:u.energyGainNextTurn})),
      reserveState:clone(side.cards.reserves),
    };
  }
  const summaryEntry = (round = m.round) => ({ t: 'summary', round, ...(m.campaign ? { campaign: { stage: m.campaign.stage, wave: m.campaign.wave, phase: m.campaign.phase, rallied: m.campaign.rallied } } : {}), blue: sideSummary('blue'), red: sideSummary('red'),
    ...(m.objects.length ? { objects: m.objects.map((o) => ({ id: o.id, objectKind: o.objectKind, faction: o.faction, c: o.c, r: o.r, hp: o.hp, blocks: o.blocks, decay: o.decay })) } : {}) });
  const statsEntry = () => ({ blue: clone(sides.blue.stats), red: clone(sides.red.stats) });

  for (const f of FACTIONS) sides[f].cards.population = population(f);
  if (m.campaign) spawnCampaignWave();
  emit({ t: 'header', schema: SCHEMA, seed, maxRounds, map: MAP.id, rules: RULES, abilityRules: ABILITY_RULES, abilities: ABILITIES, cardLimits: { ...CARD_LIMITS }, ...(BATTLE_TUNING.damageScale !== 1 ? { battleTuning: { ...BATTLE_TUNING } } : {}), ...(JSON.stringify(EXPERIMENT_RULES) === JSON.stringify(DEFAULT_EXPERIMENT_RULES) ? {} : { experimentRules: { ...EXPERIMENT_RULES } }), ...(ACTIVE_CULTURES.length ? { cultures: [...ACTIVE_CULTURES] } : {}), ...(rarityGateActive() ? { rarityGate: { ...RARITY_GATE } } : {}), ...(champions ? { champions } : {}), ...(pools ? { pools } : {}), ...(campaign ? { campaign: clone(campaign) } : {}), ...meta });
  emit(summaryEntry(0));

  Object.assign(m, {
    alive, byId, unitAt, objectAt, addObject, consumeObject, objectsNear, board, population, deploymentTiles, canDeployAt, canWithdraw, armyRecords,
    apply, resolveRound, summary: sideSummary, stats: statsEntry, champion: (f) => CHAMPION[f], home: (f) => HOME[f],
  });
  return m;
}

