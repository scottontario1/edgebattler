// Scenario engine for the White Fang levels, modelled on experiments/combat/scenario.mjs (which cannot be reused: it builds units
// only from the three shipped classes, and its buildMatch() wipes every registered culture ability and card). A scenario is plain
// JSON-able data; the definition is written into the log header, so any scenario log can be rebuilt (replayScenario).
//
//   { id, map, maxRounds, units, hand, script, track, rules }
//   units   [{ id, faction, cls, c, r, stars, facing, stance, energy, hp, abilities, objective: [c, r], passives }]
//           cls: a recruit class (pikeman | archer | cavalier), a culture class (fangReaver...), a culture variant (fangHunter) or a
//           champion id (dreg | brenna). `passives: []` strips a unit's passives (used to isolate Momentum). `energy` is the starting
//           energy after the round-1 refresh; `abilities` are free initial selections.
//   hand    [{ faction, key, n }]  cards placed in that side's hand (spells: warCry | bloodOath | hunt | mend | ward | fireburst)
//   script  planning steps applied at the start of `round` through match.apply (logged and replayed):
//           { round, faction, unit | cls | variant, stance, tile, abilities, facing }
//           { round, faction, unit, mark: <enemy id> }                   aim a mark ability (Blood Challenge)
//           { round, faction, spell: 'bloodOath', unit } | { spell: 'fireburst', c, r }
//   track   id of one Blue attacker whose hits are broken down by target (Dreg in the Blood Challenge levels)
// The culture must be registered (registerCulture) before buildMatch is called; the runner does that.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createMatch, setExperimentRules } from '../../../src/match.js';
import { setMap, DEFAULT_MAP } from '../../../src/board.js';
import { UNITS, createRecruitUnit, createGradedRecruitUnit, RECRUIT, VARIANTS } from '../../../src/roster.js';
import { UNIT_CARDS, cardFor, setRarityGate } from '../../../src/cards.js';
import { UPGRADE_POPULATION_BY_STARS } from '../../../src/upgrades.js';
import { memoryLog, replay } from '../../../src/log.js';

const mapCache = new Map([['river_ford', DEFAULT_MAP]]);
export async function loadMaps(names) {
  for (const name of names) {
    if (!name || mapCache.has(name)) continue;
    mapCache.set(name, (await import(pathToFileURL(resolve('experiments/maps', `${name}.js`)).href)).default);
  }
}

/** Supply and population a side would have spent to field these units (recipe pricing: 2 stars = 3 copies). Champions are free. */
export function budget(def, faction) {
  let supply = 0, pop = 0;
  for (const u of def.units.filter((x) => x.faction === faction)) {
    const stars = u.stars || 1;
    const card = UNIT_CARDS[u.cls] ?? cardFor(u.cls);
    if (card?.type === 'unit') { supply += card.cost * 3 ** (stars - 1); pop += UPGRADE_POPULATION_BY_STARS[stars]; } else pop += 1;
  }
  return { supply, pop };
}

const isChampion = (cls) => UNITS.some((x) => x.id === cls && ['brenna', 'dreg'].includes(x.id));

function rosterUnit(u) {
  let rec;
  if (isChampion(u.cls)) rec = { ...structuredClone(UNITS.find((x) => x.id === u.cls)) };
  else if (RECRUIT[u.cls] || VARIANTS[u.cls]) rec = (u.stars || 1) > 1 ? createGradedRecruitUnit(u.cls, u.id, u.faction, u.stars) : createRecruitUnit(u.cls, u.id, u.faction, u.c, u.r);
  else throw new Error(`unknown unit class ${u.cls}`);
  rec.id = u.id; rec.faction = u.faction; rec.c = u.c; rec.r = u.r;
  if (u.stance) rec.stance = u.stance;
  if (u.facing) rec.facing = u.facing;
  if (u.hp != null) rec.hp = u.hp;
  if (u.passives) rec.passives = structuredClone(u.passives);
  if (u.objective) rec.objective = { type: 'tile', c: u.objective[0], r: u.objective[1] };
  return rec;
}

/** Build the match for one seed. Sets the process-wide map, experiment rules and rarity gate to this scenario's. */
export function buildMatch(def, seed, log = null) {
  const map = mapCache.get(def.map || 'river_ford');
  if (!map) throw new Error(`map ${def.map} not loaded; await loadMaps([...]) first`);
  setMap(map);
  setExperimentRules(def.rules || {});
  setRarityGate({});
  const champions = {};
  for (const u of def.units) if (isChampion(u.cls)) champions[u.faction] = u.cls;
  const m = createMatch({ seed, maxRounds: def.maxRounds ?? 14, log, roster: def.units.map(rosterUnit), champions, meta: { source: 'fang-scenario', scenario: def } });
  for (const u of def.units) {
    const rec = m.byId(u.id);
    if (u.energy != null) rec.energy = Math.min(rec.maxEnergy, u.energy);
    if (u.abilities) rec.selectedAbilities = [...u.abilities];
  }
  for (const h of def.hand || []) {
    for (let i = 0; i < (h.n || 1); i += 1) {
      const card = structuredClone(cardFor(h.key));
      card.instanceId = `card-hand-${h.faction}-${h.key}-${i}`;
      m.sides[h.faction].cards.hand.push(card);
    }
  }
  return m;
}

const targetsOf = (m, s) => (s.unit ? [m.byId(s.unit)] : m.alive(s.faction).filter((u) => (s.variant ? u.variantId === s.variant : u.cls === s.cls))).filter(Boolean);

function applyStep(m, s) {
  const f = s.faction, actor = `script:${s.round}`;
  if (s.spell) {
    const card = m.sides[f].cards.hand.find((c) => c.id === `spell-${s.spell}`);
    if (card) m.apply({ type: 'spell', faction: f, cardId: card.instanceId, ...(s.unit ? { unitId: s.unit } : { c: s.c, r: s.r }) }, actor);
    return;
  }
  if (s.mark) { m.apply({ type: 'mark', faction: f, unitId: s.unit, targetId: s.mark }, actor); return; }
  for (const u of targetsOf(m, s)) {
    if (s.stance) m.apply({ type: 'stance', faction: f, unitId: u.id, stance: s.stance, ...(s.tile ? { tile: s.tile } : {}) }, actor);
    if (s.facing) m.apply({ type: 'facing', faction: f, unitId: u.id, facing: s.facing }, actor);
    if (s.abilities) m.apply({ type: 'abilities', faction: f, unitId: u.id, abilityIds: s.abilities }, actor);
  }
}

/** Play a scenario for one seed and summarise it. */
export function playScenario(def, seed, { keepLog = false } = {}) {
  const log = memoryLog();
  const m = buildMatch(def, seed, log.push);
  const startHp = { blue: m.alive('blue').reduce((s, u) => s + u.hp, 0), red: m.alive('red').reduce((s, u) => s + u.hp, 0) };
  const factionOf = Object.fromEntries(def.units.map((u) => [u.id, u.faction]));
  const steps = def.script || [];
  while (!m.over) {
    for (const s of steps.filter((x) => x.round === m.round)) applyStep(m, s);
    m.resolveRound();
  }
  const rounds = log.entries.filter((e) => e.t === 'round');
  const strikes = [], died = {};
  for (const r of rounds) {
    const moved = new Set(r.batches.find((b) => b.type === 'movement')?.events.filter((e) => e.type === 'move').map((e) => e.unitId));
    for (const b of r.batches.filter((x) => x.type === 'combat')) for (const e of b.events) {
      if (e.type === 'strike') strikes.push({ ...e, round: r.round, moved: moved.has(e.attackerId), side: factionOf[e.attackerId] });
      else if (e.type === 'death') died[e.unitId] = r.round;
    }
  }
  const mine = strikes.filter((s) => s.side === 'blue');
  const landed = mine.filter((s) => s.hit && s.damage > 0);
  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b.damage, 0) / xs.length : null);
  // The first round in which any damage lands: the contact round, where Momentum matters most.
  const firstRound = strikes.some((x) => x.damage > 0) ? Math.min(...strikes.filter((x) => x.damage > 0).map((x) => x.round)) : null;
  const first = { round: firstRound, blue: 0, red: 0, blueHits: 0, redHits: 0 };
  for (const x of strikes.filter((y) => y.round === firstRound)) { first[x.side] += x.damage; if (x.hit && x.damage > 0) first[`${x.side}Hits`] += 1; }
  const alive = { blue: m.alive('blue'), red: m.alive('red') };
  let winner = m.winner || 'none';
  if (m.reason === 'army-destroyed' && !alive.blue.length && !alive.red.length) winner = 'mutual';
  const abilityEvents = rounds.flatMap((r) => r.batches.filter((b) => b.type === 'abilities').flatMap((b) => b.events));
  const used = abilityEvents.filter((e) => e.applied && factionOf[e.unitId] === 'blue');
  const out = {
    seed, winner, reason: m.reason, rounds: rounds.length,
    survivors: { blue: alive.blue.length, red: alive.red.length },
    hp: { blue: alive.blue.reduce((s, u) => s + u.hp, 0), red: alive.red.reduce((s, u) => s + u.hp, 0) },
    startHp,
    blueStrikes: mine.length, blueLanded: landed.length, blueDamage: mine.reduce((a, s) => a + s.damage, 0),
    redDamage: strikes.filter((s) => s.side === 'red').reduce((a, s) => a + s.damage, 0),
    movedStrikes: mine.filter((s) => s.moved).length,
    dmgPerHit: avg(landed), dmgPerHitMoved: avg(landed.filter((s) => s.moved)), dmgPerHitHeld: avg(landed.filter((s) => !s.moved)),
    abilityUses: used.length, energySpent: used.reduce((a, e) => a + e.cost, 0),
    abilityById: used.reduce((o, e) => ((o[e.abilityId] = (o[e.abilityId] || 0) + 1), o), {}),
    planFails: log.entries.filter((e) => e.t === 'action' && !e.ok && String(e.actor).startsWith('script')).length,
    died, first,
  };
  if (def.track) {
    const t = mine.filter((s) => s.attackerId === def.track && s.hit && s.damage > 0);
    out.tracked = { hits: {}, damage: {}, all: t.length, allDamage: t.reduce((a, s) => a + s.damage, 0) };
    for (const s of t) { out.tracked.hits[s.targetId] = (out.tracked.hits[s.targetId] || 0) + 1; out.tracked.damage[s.targetId] = (out.tracked.damage[s.targetId] || 0) + s.damage; }
  }
  if (keepLog) out.log = log;
  return out;
}

/** Replay a scenario log from its header (definition + seed) and the logged actions. */
export function replayScenario(entries) {
  return replay(entries, { create: (header, push) => buildMatch(header.scenario, header.seed, push) });
}
