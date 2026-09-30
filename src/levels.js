// Playable levels: the scenario suites written for the experiments (experiments/levels, experiments/factions/*/), played by a human as
// Blue. Each level is the suite's "skilled" variant with Blue's scripted plan removed (it is shown as a hint) and Red's script kept: Red has
// no commander, it only follows its scripted picks and its units' stances. Nothing here changes the shipped game; the menu (src/menu.js)
// starts a level through the URL (?level=<id>), see src/game.js.
import { setMap, DEFAULT_MAP } from './board.js';
import { createMatch, setExperimentRules } from './match.js';
import { UNITS, createRecruitUnit, createGradedRecruitUnit, CHAMPION_TEMPLATES, createChampionUnit } from './roster.js';
import { cardFor, setRarityGate } from './cards.js';
import { resetCultures } from './cultures.js';
import { prepareFactions } from './setup.js';
import { enableCandidates, disableCandidates } from '../experiments/candidates/index.mjs';
import { SUITES as CLASSIC } from '../experiments/levels/levels.mjs';
import { LEVELS as CROWN } from '../experiments/factions/argent-crown/scenarios.mjs';
import { SUITES as FANG } from '../experiments/factions/white-fang/levels.mjs';
import { SUITES as LEAGUE } from '../experiments/factions/iron-league/scenarios.mjs';
import { SUITES as COURT } from '../experiments/factions/hollow-court/scenarios.mjs';

const GROUPS = [
  { id: 'classic', name: 'Ashvale (classic rules)', faction: 'classic', suites: CLASSIC },
  { id: 'crown', name: 'The Argent Crown', faction: 'crown', suites: CROWN },
  { id: 'fang', name: 'The White Fang Clans', faction: 'fang', suites: FANG },
  { id: 'league', name: 'The Iron League', faction: 'league', suites: LEAGUE },
  { id: 'court', name: 'The Hollow Court', faction: 'court', suites: COURT },
];

// Maps are plain data in experiments/maps/*.js. The browser registers them (src/level-maps.js, a Vite glob); Node tests call registerMaps.
const MAPS = { river_ford: DEFAULT_MAP };
export const registerMaps = (maps) => Object.assign(MAPS, maps);

const shorten = (s = '') => s.replace(/\s+/g, ' ').trim();
const human = (t) => String(t).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
const who = (s, def) => {
  const unit = s.unit && def?.units.find((u) => u.id === s.unit);
  return human(unit ? (unit.key ?? unit.cls) : (s.cls ?? s.key ?? s.unit ?? 'all units')) + (s.unit && unit ? ` (${s.unit})` : '');
};
/** One readable line per Blue step of the level's skilled plan: the hint shown to the player. */
export function describeStep(s, def = null) {
  const tag = s.tag ? ` (${s.tag})` : '';
  const at = (t) => (t ? ` at ${t[0]},${t[1]}` : '');
  if (s.deploy) return `Round ${s.round}: recruit the reinforcement card and deploy it${at(s.deploy)}${tag}`;
  if (s.muster) return `Round ${s.round}: muster the reinforcement card${at(s.muster)} with ${who(s, def)}${tag}`;
  if (s.spell) return `Round ${s.round}: cast ${human(s.spell)}${s.unit ? ` on ${who({ unit: s.unit }, def)}` : at(s.c != null ? [s.c, s.r] : null)}${tag}`;
  if (s.equip) return `Round ${s.round}: apply a Garnet (Bulwark) II shard to ${human(s.unitType)}${tag}`;
  const parts = [];
  if (s.stance) parts.push(`${s.stance}${s.tile ? ` toward ${s.tile[0]},${s.tile[1]}` : ''}`);
  if (s.facing) parts.push(`face ${s.facing}`);
  if (!parts.length) return null; // ability picks are gone (Shards replaced skills); a step with nothing else is not a hint
  return `Round ${s.round}: ${who(s, def)} ${parts.join(', ')}${tag}`;
}

export const LEVELS = GROUPS.flatMap((g) => g.suites.map((suite, i) => {
  const def = suite.variants.find((v) => v.evidence && /^S\b/.test(v.label))?.def ?? suite.variants[1].def;
  const steps = def.script || [];
  return {
    id: suite.id.startsWith(g.id) ? suite.id : `${g.id}-${suite.id}`,
    group: g.id, groupName: g.name, faction: g.faction, number: i + 1,
    title: suite.title, question: shorten(suite.question), setup: shorten(suite.setup || ''), def,
    maxRounds: def.maxRounds ?? 14,
    hints: steps.filter((s) => s.faction === 'blue').sort((a, b) => a.round - b.round).map((s) => describeStep(s, def)).filter(Boolean),
  };
}));
export const LEVEL_BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));

const isChampionKey = (key) => Boolean(CHAMPION_TEMPLATES[key]) || UNITS.some((x) => x.id === key);
function rosterUnit(u) {
  const key = u.key ?? u.cls;
  let rec;
  if (CHAMPION_TEMPLATES[key]) rec = createChampionUnit(key, u.faction, u.c, u.r);
  else if (UNITS.some((x) => x.id === key)) rec = structuredClone(UNITS.find((x) => x.id === key));
  else rec = (u.stars || 1) > 1 ? createGradedRecruitUnit(key, u.id, u.faction, u.stars) : createRecruitUnit(key, u.id, u.faction, u.c, u.r);
  rec.id = isChampionKey(key) ? key : u.id;
  rec.faction = u.faction; rec.c = u.c; rec.r = u.r;
  if (u.stance) rec.stance = u.stance;
  if (u.facing) rec.facing = u.facing;
  if (u.hp != null) rec.hp = u.hp;
  if (u.objective) rec.objective = { type: 'tile', c: u.objective[0], r: u.objective[1] };
  return rec;
}

const targets = (m, s) => (s.unit ? [m.byId(s.unit)] : m.alive(s.faction).filter((u) => (s.cls ?? s.key) == null || u.cls === (s.cls ?? s.key) || u.variantId === (s.cls ?? s.key))).filter(Boolean);
/** Apply one scripted planning step through match.apply (logged like any action). */
function applyStep(m, s) {
  const f = s.faction, actor = `script:${s.round}`;
  if (s.muster || s.deploy) {
    const res = m.apply({ type: 'recruit', faction: f, cardId: s.card }, actor);
    if (!res.ok) return;
    if (s.muster) m.apply({ type: 'muster', faction: f, unitId: s.unit, reserveId: res.reserveId, c: s.muster[0], r: s.muster[1] }, actor);
    else m.apply({ type: 'deploy', faction: f, reserveId: res.reserveId, c: s.deploy[0], r: s.deploy[1] }, actor);
    return;
  }
  if (s.equip) {
    // The old Barrier skill is now a Garnet (Bulwark) tier II shard (block 2): scripted grant, then a normal apply.
    const g = m.apply({ type: 'grantShard', faction: f, shardId: 'garnet', tier: 2 }, actor);
    if (g.ok) m.apply({ type: 'applyShard', faction: f, shardInstanceId: g.shardInstanceId, unitType: s.unitType }, actor);
    return;
  }
  if (s.spell) {
    const id = `spell-${s.spell}`;
    const card = m.sides[f].cards.hand.find((c) => c.id === id);
    if (!card) return;
    m.apply({ type: 'spell', faction: f, cardId: card.instanceId, ...(s.unit ? { unitId: s.unit } : { c: s.c, r: s.r }) }, actor);
    return;
  }
  for (const u of targets(m, s)) {
    if (s.stance) m.apply({ type: 'stance', faction: f, unitId: u.id, stance: s.stance, ...(s.tile ? { tile: s.tile } : {}), ...(s.targetId ? { targetId: s.targetId } : {}) }, actor);
    if (s.facing) m.apply({ type: 'facing', faction: f, unitId: u.id, facing: s.facing }, actor);
    if (s.abilities && m.abilitiesEnabled) m.apply({ type: 'abilities', faction: f, unitId: u.id, abilityIds: s.abilities }, actor);
  }
}

/** Red's "commander" for a level: the scripted steps of the current round, nothing else. Pass as the red policy (src/ui.js runAI). */
export const redScriptPolicy = (level) => (m) => {
  for (const s of (level.def.script || []).filter((x) => x.faction === 'red' && x.round === m.round)) applyStep(m, s);
};

/** Build the match for a level. Registers the level's faction and rules in this process (call before the scene is built). */
export function createLevelMatch(level, { seed, log = null, meta = {} } = {}) {
  const def = level.def;
  const map = MAPS[def.map || 'river_ford'];
  if (!map) throw new Error(`map ${def.map} is not registered (registerMaps)`);
  setMap(map);
  resetCultures();
  disableCandidates();
  enableCandidates(def.candidates || []);
  setExperimentRules({ ...(def.rules || {}), muster: (def.candidates || []).includes('muster') ? { cost: 2, cooldown: 2, classes: ['pikeman', 'archer', 'cavalier'], ...(def.rules?.muster || {}) } : null });
  if (level.faction !== 'classic') prepareFactions([level.faction], { gate: false });
  setRarityGate({});
  const champions = {};
  for (const u of def.units) if (isChampionKey(u.key ?? u.cls)) champions[u.faction] = u.key ?? u.cls;
  const m = createMatch({ ...(seed !== undefined ? { seed } : {}), maxRounds: def.maxRounds ?? 14, log, roster: def.units.map(rosterUnit),
    ...(Object.keys(champions).length ? { champions } : {}), meta: { ...meta, source: 'level', level: level.id, scenario: def } });
  for (const u of def.units) {
    const rec = m.byId(isChampionKey(u.key ?? u.cls) ? (u.key ?? u.cls) : u.id);
    if (u.energy != null) rec.energy = Math.min(rec.maxEnergy, u.energy);
    if (u.abilities && m.abilitiesEnabled) rec.selectedAbilities = [...u.abilities]; // free initial picks (energy is not re-validated)
  }
  for (const [side, byType] of Object.entries(def.loadouts || {})) {
    for (const [type, ids] of Object.entries(byType)) {
      // Old Barrier loadouts became Garnet (Bulwark) II shards on the same class (block 2); other skill ids no longer exist.
      for (const id of ids) if (id === 'barrier') m.seedShard(side, type, 'garnet', 2);
    }
  }
  for (const h of def.hand || []) {
    for (let i = 0; i < (h.n || 1); i += 1) {
      const card = structuredClone(cardFor(h.key));
      card.instanceId = `card-hand-${h.faction}-${h.key}-${i}`;
      m.sides[h.faction].cards.hand.push(card);
    }
  }
  let n = 0;
  for (const r of def.reinforce || []) {
    const card = structuredClone(cardFor(r.cls));
    card.instanceId = r.id || `card-inj-${++n}`;
    m.sides[r.faction].cards.hand.push(card);
  }
  return m;
}
