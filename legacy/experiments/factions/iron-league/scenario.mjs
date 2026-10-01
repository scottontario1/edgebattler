// Scenario engine for the Iron League levels: experiments/combat/scenario.mjs adapted so the culture is registered for the
// scenario (after the candidate reset, which would otherwise remove its abilities and cards) and League classes, variants and
// champions can be placed on the map. A scenario is plain JSON-able data (it is written into the log header, so any log can be
// rebuilt from it by replayScenario):
//
//   { id, map, maxRounds, culture: { without: [feature ids] }, rarityGate?, champions?, units, hand, script }
//
//   units    [{ id, faction, cls, c, r, facing, stance, energy, hp, abilities: [], objective: [c, r] }]; cls is a shipped class (pikeman | archer |
//            cavalier), a League key (leaguePike | pavise | coil | relicWalker | sapper), a registered champion id, brenna or dreg
//   hand     [{ faction, key, n }] extra cards in a side's hand (fieldRepair | flare | mend | ward | fireburst ...)
//   script   planning steps applied at the start of `round` through match.apply (so they are logged and replayed):
//            { round, faction, unit | cls | variant, stance, tile: [c, r], abilities: [...], facing }
//            { round, faction, spell: 'fieldRepair' | 'flare' | 'mend' | 'ward', unit } | { round, faction, spell: 'fireburst', c, r }
import { createMatch, setExperimentRules } from '../../../src/match.js';
import { setMap } from '../../../src/board.js';
import { UNITS, createRecruitUnit, createChampionUnit, CHAMPION_TEMPLATES } from '../../../src/roster.js';
import { cardFor, unitCardFor, setRarityGate } from '../../../src/cards.js';
import { registerCulture, resetCultures } from '../../../src/cultures.js';
import { memoryLog, replay } from '../../../src/log.js';
import { enableCandidates, disableCandidates } from '../../candidates/index.mjs';
import { leagueDef, mapByName } from './common.mjs';

export { loadMaps } from './common.mjs';

/** Supply and population a side would pay to field its units (champions are free). */
export function budget(def, faction) {
  let supply = 0, pop = 0;
  for (const u of def.units.filter((x) => x.faction === faction)) {
    const card = unitCardFor(u.cls);
    if (card) { supply += card.cost; pop += 1; } else pop += 1;
  }
  return { supply, pop };
}

/** Build the match for one seed; the process-wide map, candidates and culture are set to this scenario's. */
export function buildMatch(def, seed, log = null) {
  setMap(mapByName(def.map));
  disableCandidates();
  enableCandidates(def.candidates || []);
  setExperimentRules({});
  resetCultures();
  registerCulture(leagueDef(def.culture || {}));
  setRarityGate(def.rarityGate || {});
  const rosterUnit = (u) => {
    let rec;
    if (CHAMPION_TEMPLATES[u.cls]) rec = createChampionUnit(u.cls, u.faction, u.c, u.r);
    else if (unitCardFor(u.cls)) rec = createRecruitUnit(u.cls, u.id, u.faction, u.c, u.r);
    else rec = { ...structuredClone(UNITS.find((x) => x.id === u.cls)) };
    rec.id = u.id; rec.faction = u.faction; rec.c = u.c; rec.r = u.r;
    if (u.stance) rec.stance = u.stance;
    if (u.facing) rec.facing = u.facing;
    if (u.hp != null) rec.hp = u.hp;
    if (u.energy != null) rec.energy = u.energy;
    if (u.abilities) rec.selectedAbilities = [...u.abilities];
    if (u.objective) rec.objective = { type: 'tile', c: u.objective[0], r: u.objective[1] };
    return rec;
  };
  const m = createMatch({ seed, maxRounds: def.maxRounds ?? 14, log, roster: def.units.map(rosterUnit), champions: def.champions || null, meta: { source: 'scenario', scenario: def } });
  let n = 0;
  for (const h of def.hand || []) {
    for (let i = 0; i < (h.n || 1); i += 1) {
      const card = structuredClone(cardFor(h.key));
      card.instanceId = `card-hand-${h.faction}-${h.key}-${n++}`;
      m.sides[h.faction].cards.hand.push(card);
    }
  }
  return m;
}

const targetsOf = (m, step) => (step.unit ? [m.byId(step.unit)] : m.alive(step.faction).filter((u) => (!step.cls || u.cls === step.cls) && (!step.variant || u.variantId === step.variant))).filter(Boolean);

function applyStep(m, step) {
  const f = step.faction;
  const actor = `script:${step.round}`;
  if (step.spell) {
    const card = m.sides[f].cards.hand.find((c) => c.id === `spell-${step.spell}`);
    if (!card) return;
    m.apply({ type: 'spell', faction: f, cardId: card.instanceId, ...(step.unit ? { unitId: step.unit } : { c: step.c, r: step.r }) }, actor);
    return;
  }
  for (const u of targetsOf(m, step)) {
    if (step.stance) m.apply({ type: 'stance', faction: f, unitId: u.id, stance: step.stance, ...(step.tile ? { tile: step.tile } : {}) }, actor);
    if (step.facing) m.apply({ type: 'facing', faction: f, unitId: u.id, facing: step.facing }, actor);
    if (step.abilities) m.apply({ type: 'abilities', faction: f, unitId: u.id, abilityIds: step.abilities }, actor);
  }
}

/** Play a scenario for one seed and summarise it. */
export function playScenario(def, seed, { keepLog = false } = {}) {
  const log = memoryLog();
  const m = buildMatch(def, seed, log.push);
  const startHp = { blue: m.alive('blue').reduce((s, u) => s + u.hp, 0), red: m.alive('red').reduce((s, u) => s + u.hp, 0) };
  const startN = { blue: m.alive('blue').length, red: m.alive('red').length };
  const factionOf = Object.fromEntries(def.units.map((u) => [u.id, u.faction]));
  const steps = def.script || [];
  while (!m.over) {
    for (const step of steps.filter((s) => s.round === m.round)) applyStep(m, step);
    m.resolveRound();
  }
  const rounds = log.entries.filter((e) => e.t === 'round');
  const hits = rounds.flatMap((r) => r.batches.filter((b) => b.type === 'combat').flatMap((b) => b.events.filter((e) => e.type === 'strike').map((e) => ({ ...e, round: r.round }))));
  const dealt = { blue: 0, red: 0 };
  const objectDamage = { blue: 0, red: 0 };
  for (const s of hits) {
    const f = factionOf[s.attackerId] || (String(s.attackerId).startsWith('obj') ? null : null);
    if (!f) continue;
    if (String(s.targetId).startsWith('obj-')) objectDamage[f] += s.damage; else dealt[f] += s.damage;
  }
  const alive = { blue: m.alive('blue'), red: m.alive('red') };
  let winner = m.winner || 'none';
  if (m.reason === 'army-destroyed' && !alive.blue.length && !alive.red.length) winner = 'mutual';
  const abilityEvents = rounds.flatMap((r) => r.batches.filter((b) => b.type === 'abilities').flatMap((b) => b.events));
  const used = abilityEvents.filter((e) => e.applied);
  const usedBy = {};
  for (const e of used) usedBy[e.abilityId] = (usedBy[e.abilityId] || 0) + 1;
  const moves = rounds.flatMap((r) => r.batches.filter((b) => b.type === 'movement').flatMap((b) => b.events));
  const results = rounds.flatMap((r) => r.batches.filter((b) => b.type === 'results').flatMap((b) => b.events));
  const out = {
    seed, winner, reason: m.reason, rounds: rounds.length,
    survivors: { blue: alive.blue.length, red: alive.red.length }, startN,
    hp: { blue: alive.blue.reduce((s, u) => s + u.hp, 0), red: alive.red.reduce((s, u) => s + u.hp, 0) },
    startHp, dealt, objectDamage, strikes: hits.length, moves: moves.filter((e) => e.type === 'move').length,
    blockedHolds: moves.filter((e) => e.type === 'hold' && /occupied|no legal/.test(e.reason)).length,
    planFails: log.entries.filter((e) => e.t === 'action' && !e.ok && String(e.actor).startsWith('script')).length,
    abilityUses: used.length, usedBy, energySpent: used.reduce((s, e) => s + e.cost, 0),
    barricadesRaised: used.filter((e) => e.spawn && e.spawned !== false).length, barricadesDestroyed: results.filter((e) => e.type === 'objectDestroyed').length,
  };
  if (keepLog) out.log = log;
  return out;
}

/** Replay a scenario log from its header (definition + seed) and the logged actions. */
export function replayScenario(entries) {
  return replay(entries, { create: (header, push) => buildMatch(header.scenario, header.seed, push) });
}
