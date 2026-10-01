// Scenario engine for the Argent Crown levels. A scenario is plain data (like experiments/combat/scenario.mjs, which cannot be used
// here: it only knows the three shipped recruit classes and its disableCandidates() would strip the registered culture).
//
//   { id, map, maxRounds, units: [...], hand: [{ faction, key, n }], script: [...] }
//   unit    { id, faction, key, c, r, stance, facing, objective: [c, r], abilities: [], energy, hp, dropPassives: ['lineDoctrine'] }
//           `key` is a recruit class (pikeman), a Crown variant or class (crownPike, crownGuard, bannerman, oathsworn) or a champion:
//           brennaCrown / brennaCrownB (registered by the culture) or dreg / brenna (shipped). A champion unit's id is its key.
//   script  planning steps applied at the start of `round` through match.apply (logged and replayed):
//           { round, faction, unit | key, stance, targetId, tile, abilities, facing }   (`key` matches a unit's class or variant id)
//           { round, faction, spell: 'rallyBanner' | 'ward' | 'mend', unit }              (the card is injected through `hand`)
//   Steps may carry a `tag` naming the skill; ablations drop the steps with that tag.
// The definition is written into the log header so any scenario log rebuilds from it (replayScenario).
import { createMatch } from '../../../src/match.js';
import { setMap, DEFAULT_MAP } from '../../../src/board.js';
import { registerArgentCrown } from '../../../src/factions/argent-crown.js';
import { resetCultures, ACTIVE_CULTURES } from '../../../src/cultures.js';
import { setRarityGate, cardFor } from '../../../src/cards.js';
import { createRecruitUnit, createChampionUnit, CHAMPION_TEMPLATES, UNITS } from '../../../src/roster.js';
import { memoryLog, replay } from '../../../src/log.js';
import FLAT_OPEN from '../../maps/flat_open.js';

const MAPS = { flat_open: FLAT_OPEN, river_ford: DEFAULT_MAP };
/** Register the Crown once per process (idempotent) and clear the rarity gate: a level injects exactly the cards it needs. */
export function ensureCulture() {
  if (!ACTIVE_CULTURES.includes('crown')) { resetCultures(); registerArgentCrown(); }
  setRarityGate({});
}
const isChampionKey = (key) => Boolean(CHAMPION_TEMPLATES[key]) || UNITS.some((x) => x.id === key);

function rosterUnit(u) {
  let rec;
  if (CHAMPION_TEMPLATES[u.key]) rec = createChampionUnit(u.key, u.faction, u.c, u.r);
  else if (UNITS.some((x) => x.id === u.key)) rec = structuredClone(UNITS.find((x) => x.id === u.key));
  else rec = createRecruitUnit(u.key, u.id, u.faction, u.c, u.r);
  rec.id = isChampionKey(u.key) ? u.key : u.id;
  rec.faction = u.faction; rec.c = u.c; rec.r = u.r;
  if (u.stance) rec.stance = u.stance;
  if (u.facing) rec.facing = u.facing;
  if (u.hp != null) rec.hp = u.hp;
  if (u.objective) rec.objective = { type: 'tile', c: u.objective[0], r: u.objective[1] };
  if (u.dropPassives && rec.passives) rec.passives = rec.passives.filter((p) => !u.dropPassives.includes(p.id));
  return rec;
}
const unitIdOf = (u) => (isChampionKey(u.key) ? u.key : u.id);

export function buildMatch(def, seed, log = null) {
  ensureCulture();
  setMap(MAPS[def.map || 'flat_open']);
  const champions = {};
  for (const u of def.units) if (isChampionKey(u.key)) champions[u.faction] = u.key;
  const m = createMatch({ seed, maxRounds: def.maxRounds ?? 14, log, roster: def.units.map(rosterUnit), champions, meta: { source: 'crown-scenario', scenario: def } });
  for (const u of def.units) {
    const rec = m.byId(unitIdOf(u));
    if (u.energy != null) rec.energy = Math.min(rec.maxEnergy, u.energy);
    if (u.abilities) rec.selectedAbilities = [...u.abilities]; // free initial selections (energy is not re-validated)
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

const targets = (m, s) => (s.unit ? [m.byId(s.unit)] : m.alive(s.faction).filter((u) => (s.key ? u.cls === s.key || u.variantId === s.key : true))).filter(Boolean);
function applyStep(m, s) {
  const f = s.faction, actor = `script:${s.round}`;
  if (s.spell) {
    const card = m.sides[f].cards.hand.find((c) => c.id === `spell-${s.spell}`);
    if (card) m.apply({ type: 'spell', faction: f, cardId: card.instanceId, unitId: s.unit }, actor);
    return;
  }
  for (const u of targets(m, s)) {
    if (s.stance) m.apply({ type: 'stance', faction: f, unitId: u.id, stance: s.stance, ...(s.tile ? { tile: s.tile } : {}), ...(s.targetId ? { targetId: s.targetId } : {}) }, actor);
    if (s.facing) m.apply({ type: 'facing', faction: f, unitId: u.id, facing: s.facing }, actor);
    if (s.abilities) m.apply({ type: 'abilities', faction: f, unitId: u.id, abilityIds: s.abilities }, actor);
  }
}

/** Play one seed of a scenario and summarise it. */
export function playScenario(def, seed, { keepLog = false } = {}) {
  const log = memoryLog();
  const m = buildMatch(def, seed, log.push);
  const startHp = { blue: m.alive('blue').reduce((a, u) => a + u.hp, 0), red: m.alive('red').reduce((a, u) => a + u.hp, 0) };
  const factionOf = Object.fromEntries(m.units.map((u) => [u.id, u.faction]));
  const total = { blue: m.units.filter((u) => u.faction === 'blue').length, red: m.units.filter((u) => u.faction === 'red').length };
  const steps = def.script || [];
  while (!m.over) {
    for (const s of steps.filter((x) => x.round === m.round)) applyStep(m, s);
    m.resolveRound();
  }
  const rounds = log.entries.filter((e) => e.t === 'round');
  const hits = rounds.flatMap((r) => r.batches.filter((b) => b.type === 'combat').flatMap((b) => b.events.filter((e) => e.type === 'strike').map((e) => ({ ...e, round: r.round }))));
  const dealt = { blue: 0, red: 0 };
  for (const s of hits) if (factionOf[s.attackerId]) dealt[factionOf[s.attackerId]] += s.damage;
  const alive = { blue: m.alive('blue'), red: m.alive('red') };
  let winner = m.winner || 'none';
  if (m.reason === 'army-destroyed' && !alive.blue.length && !alive.red.length) winner = 'mutual'; // the engine reports red first (CORE-03)
  const used = rounds.flatMap((r) => r.batches.filter((b) => b.type === 'abilities').flatMap((b) => b.events)).filter((e) => e.applied);
  const out = {
    seed, winner, reason: m.reason, rounds: rounds.length, survivors: { blue: alive.blue.length, red: alive.red.length },
    hp: { blue: alive.blue.reduce((a, u) => a + u.hp, 0), red: alive.red.reduce((a, u) => a + u.hp, 0) }, startHp, dealt,
    lost: { blue: total.blue - alive.blue.length, red: total.red - alive.red.length }, strikes: hits.length,
    planFails: log.entries.filter((e) => e.t === 'action' && !e.ok && String(e.actor).startsWith('script')).length,
    abilityUses: used.length,
  };
  if (keepLog) out.log = log;
  return out;
}

export function replayScenario(entries) {
  return replay(entries, { create: (header, push) => buildMatch(header.scenario, header.seed, push) });
}
