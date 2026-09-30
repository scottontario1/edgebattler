// Scenario engine for the combat case studies. A scenario definition is plain JSON-able data:
//
//   { id, map, maxRounds, candidates: [ids], units: [...], loadouts, reinforce, script }
//
//   map         'river_ford' or the name of experiments/maps/<name>.js
//   candidates  ids from experiments/candidates (abilities/cards); enabled for this scenario only
//   units       [{ id, faction, cls, c, r, stars=1, facing, stance, energy, hp, abilities: [], objective: [c, r] }]
//               cls is a recruit class (pikeman | archer | cavalier) or a champion (brenna | dreg)
//   loadouts    { blue: { pikeman: ['barrier', 'whetstone'] } }  type-wide equipment, installed before round 1
//   reinforce   [{ faction, cls, id }]  unit cards placed in that side's hand (recruit + deploy them via script steps)
//   script      planning steps applied at the start of `round` through match.apply, so they are logged and replayed:
//               { round, faction, unit | cls, stance, tile: [c, r], abilities: [...], facing }
//               { round, faction, card, deploy: [c, r] }  recruit the injected card and deploy it
//
// The definition is written into the log header, so any scenario log can be rebuilt from it
// (replayScenario below, which uses log.js replay({ create })). Ordinary `tools/sim/run.mjs --verify` cannot replay
// these logs: it assumes the shipped roster, hands, map and rules.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createMatch } from '../../src/match.js';
import { setMap, DEFAULT_MAP } from '../../src/board.js';
import { UNITS, createRecruitUnit, createGradedRecruitUnit } from '../../src/roster.js';
import { UNIT_CARDS, cardFor, skillCardFor } from '../../src/cards.js';
import { UPGRADE_POPULATION_BY_STARS } from '../../src/upgrades.js';
import { memoryLog, replay } from '../../src/log.js';
import { enableCandidates, disableCandidates } from '../candidates/index.mjs';

const mapCache = new Map([['river_ford', DEFAULT_MAP]]);
/** Maps are loaded once, up front, so buildMatch can stay synchronous (replay() needs a synchronous factory). */
export async function loadMaps(names) {
  for (const name of names) {
    if (!name || mapCache.has(name)) continue;
    mapCache.set(name, (await import(pathToFileURL(resolve('experiments/maps', `${name}.js`)).href)).default);
  }
}

/** Supply and population a side would have spent to field these units (recipe pricing: 2★ = 3 copies, 3★ = 9). */
export function budget(def, faction) {
  let supply = 0, pop = 0, equipment = 0;
  for (const u of def.units.filter((x) => x.faction === faction)) {
    const stars = u.stars || 1;
    if (UNIT_CARDS[u.cls]) { supply += UNIT_CARDS[u.cls].cost * 3 ** (stars - 1); pop += UPGRADE_POPULATION_BY_STARS[stars]; }
    else pop += 1; // champions: free, one population
  }
  for (const list of Object.values(def.loadouts?.[faction] || {})) equipment += list.length * 2;
  return { supply, equipment, total: supply + equipment, pop };
}

function rosterUnit(u) {
  const rec = UNIT_CARDS[u.cls]
    ? ((u.stars || 1) > 1 ? createGradedRecruitUnit(u.cls, u.id, u.faction, u.stars) : createRecruitUnit(u.cls, u.id, u.faction, u.c, u.r))
    : { ...structuredClone(UNITS.find((x) => x.id === u.cls)) };
  rec.id = u.id; rec.faction = u.faction; rec.c = u.c; rec.r = u.r;
  if (u.stance) rec.stance = u.stance;
  if (u.facing) rec.facing = u.facing;
  if (u.hp != null) rec.hp = u.hp;
  if (u.objective) rec.objective = { type: 'tile', c: u.objective[0], r: u.objective[1] };
  return rec;
}

/** Build the match for one seed. Sets the process-wide map and candidate registrations to this scenario's. */
export function buildMatch(def, seed, log = null) {
  const map = mapCache.get(def.map || 'river_ford');
  if (!map) throw new Error(`map ${def.map} not loaded; await loadMaps([...]) first`);
  setMap(map);
  disableCandidates();
  enableCandidates(def.candidates || []);
  const m = createMatch({ seed, maxRounds: def.maxRounds ?? 12, log, roster: def.units.map(rosterUnit), meta: { source: 'scenario', scenario: def } });
  for (const u of def.units) {
    const rec = m.byId(u.id);
    if (u.energy != null) rec.energy = Math.min(rec.maxEnergy, u.energy);
    if (u.abilities) rec.selectedAbilities = [...u.abilities]; // free initial selections (energy is not re-validated)
  }
  for (const [faction, byType] of Object.entries(def.loadouts || {})) {
    for (const [type, ids] of Object.entries(byType)) m.sides[faction].loadouts[type] = ids.map((id) => ({ ...skillCardFor(id), id }));
  }
  let n = 0;
  for (const r of def.reinforce || []) {
    const card = structuredClone(cardFor(r.cls));
    card.instanceId = r.id || `card-inj-${++n}`;
    m.sides[r.faction].cards.hand.push(card);
  }
  return m;
}

function resolveTargets(m, step) {
  return (step.unit ? [m.byId(step.unit)] : m.alive(step.faction).filter((u) => u.cls === step.cls)).filter(Boolean);
}

function applyStep(m, step) {
  const f = step.faction;
  const actor = `script:${step.round}`;
  if (step.deploy) {
    const res = m.apply({ type: 'recruit', faction: f, cardId: step.card }, actor);
    if (res.ok) m.apply({ type: 'deploy', faction: f, reserveId: res.reserveId, c: step.deploy[0], r: step.deploy[1] }, actor);
    return;
  }
  for (const u of resolveTargets(m, step)) {
    if (step.stance) m.apply({ type: 'stance', faction: f, unitId: u.id, stance: step.stance, ...(step.tile ? { tile: step.tile } : {}), ...(step.targetId ? { targetId: step.targetId } : {}) }, actor);
    if (step.facing) m.apply({ type: 'facing', faction: f, unitId: u.id, facing: step.facing }, actor);
    if (step.abilities) m.apply({ type: 'abilities', faction: f, unitId: u.id, abilityIds: step.abilities }, actor);
  }
}

/** Play a scenario for one seed and summarise it. */
export function playScenario(def, seed, { keepLog = false } = {}) {
  const log = memoryLog();
  const m = buildMatch(def, seed, log.push);
  const startHp = { blue: m.alive('blue').reduce((s, u) => s + u.hp, 0), red: m.alive('red').reduce((s, u) => s + u.hp, 0) };
  const factionOf = Object.fromEntries(def.units.map((u) => [u.id, u.faction]));
  const fac = (id) => factionOf[id] || (id.startsWith('blue') ? 'blue' : id.startsWith('red') ? 'red' : null);
  const steps = def.script || [];
  while (!m.over) {
    for (const step of steps.filter((s) => s.round === m.round)) applyStep(m, step);
    m.resolveRound();
  }
  const rounds = log.entries.filter((e) => e.t === 'round');
  const hits = rounds.flatMap((r) => r.batches.filter((b) => b.type === 'combat').flatMap((b) => b.events.filter((e) => e.type === 'strike').map((e) => ({ ...e, round: r.round }))));
  const dealt = { blue: 0, red: 0 };
  for (const s of hits) dealt[fac(s.attackerId)] += s.damage;
  const alive = { blue: m.alive('blue'), red: m.alive('red') };
  let winner = m.winner || 'none';
  if (m.reason === 'army-destroyed' && !alive.blue.length && !alive.red.length) winner = 'mutual'; // the engine reports red first (CORE-03)
  const abilityEvents = rounds.flatMap((r) => r.batches.filter((b) => b.type === 'abilities').flatMap((b) => b.events));
  const used = abilityEvents.filter((e) => e.applied);
  const moves = rounds.flatMap((r) => r.batches.filter((b) => b.type === 'movement').flatMap((b) => b.events));
  const holdBecause = (re) => moves.filter((e) => e.type === 'hold' && re.test(e.reason)).length;
  const out = {
    seed, winner, reason: m.reason, rounds: rounds.length,
    survivors: { blue: alive.blue.length, red: alive.red.length },
    hp: { blue: alive.blue.reduce((s, u) => s + u.hp, 0), red: alive.red.reduce((s, u) => s + u.hp, 0) },
    startHp, dealt, firstStrike: hits.length ? hits[0].round : null,
    strikes: hits.length, flankStrikes: hits.filter((s) => s.flank && s.flank !== 'front').length,
    spearBonus: hits.filter((s) => s.spearBonus).length, guarded: hits.filter((s) => s.mountedGuard).length,
    moves: moves.filter((e) => e.type === 'move').length, blocked: holdBecause(/no legal|occupied/), contested: holdBecause(/contested/),
    abilityUses: used.length, energySpent: used.reduce((s, e) => s + e.cost, 0),
  };
  if (keepLog) out.log = log;
  return out;
}

/** Replay a scenario log from its header (definition + seed) and the logged actions. */
export function replayScenario(entries) {
  return replay(entries, { create: (header, push) => buildMatch(header.scenario, header.seed, push) });
}
