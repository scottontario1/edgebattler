// Game setup: which factions (cultures) are playing, and the match they produce. The default (classic Ashvale v Dreg) goes through
// the same createMatch call as before, so nothing changes unless a faction is chosen (menu, or ?blue=<id>&red=<id> style URLs, see
// src/game.js). A "faction" here is what FACTIONS.md calls a faction; in the engine a culture (src/cultures.js).
import { registerCulture, resetCultures, culturePool } from './cultures.js';
import { setRarityGate } from './cards.js';
import { UNITS, createRecruitUnit, createChampionUnit, registerChampions, CHAMPION_TEMPLATES } from './roster.js';
import { ABILITY_CATALOG } from './abilities.js';
import { createMatch } from './match.js';
import CROWN, { registerArgentCrown } from './factions/argent-crown.js';
import FANG from './factions/white-fang.js';
import LEAGUE, { DEFAULT_LEAGUE_CHAMPION } from './factions/iron-league.js';
import COURT, { DEFAULT_CHAMPION as COURT_CHAMPION } from './factions/hollow-court.js';

// Rarity gate used whenever a faction is in play: uncommon cards from round 3, rare from round 6 (proposed values, Scott's approval pending).
export const RARITY_GATE = Object.freeze({ uncommon: 3, rare: 6 });

// `core` maps the three shipped roles to the faction's starting units (a labelled default, not a rule); `champion` is the id used for the
// side's champion. Colours are the faction palette used by the menu.
export const FACTIONS = [
  { id: 'classic', name: 'Ashvale (classic)', tagline: 'The shipped game: Brenna\'s kingdom against Dreg\'s raiders, plain Pikemen, Archers and Cavaliers.',
    traits: ['Baseline rules', 'Brenna (Paladin) or Dreg (Barbarian)'], color: '#3d5a80', accent: '#c9d6ea', champion: { blue: 'brenna', red: 'dreg' } },
  { id: 'crown', name: 'The Argent Crown', tagline: 'Blue and silver. A coherent line beats a strong unit: stand together and the wall holds.',
    traits: ['Line Doctrine: +1 Defense per adjacent infantry (max +2)', 'Bannerman auras, Oathsworn, Crown Guard'], color: '#1A4FA0', accent: '#B8C4D6',
    culture: 'crown', register: () => registerArgentCrown(), def: CROWN, core: { pikeman: 'crownPike', archer: 'crownArcher', cavalier: 'crownCavalier' }, champion: 'brennaCrown' },
  { id: 'fang', name: 'The White Fang Clans', tagline: 'Iron, fur and fangs. Once momentum starts, keep it going: Advance, make contact, never sit still.',
    traits: ['Momentum: +2 damage after moving', 'Blood Challenge (Dreg): hunt one enemy'], color: '#6B7280', accent: '#A8231C',
    culture: 'fang', register: () => registerFang(), def: FANG, core: { pikeman: 'fangReaver', archer: 'fangHunter', cavalier: 'cavalier' }, champion: { blue: 'dregBlue', red: 'dreg' } },
  { id: 'league', name: 'The Iron League', tagline: 'Brass, bronze and rust. Mercenaries with salvaged ancient machines: prepare a killing ground and let them come.',
    traits: ['Prepared Shot: hold still to hit harder', 'Barricades, Pavise shields, Relic Walkers'], color: '#B5843A', accent: '#4E7C6A',
    culture: 'league', def: LEAGUE, core: { pikeman: 'leaguePike', archer: 'coil', cavalier: 'pavise' }, champion: DEFAULT_LEAGUE_CHAMPION },
  { id: 'court', name: 'The Hollow Court', tagline: 'Bone, velvet and candlelight. A dead aristocracy: defeat their units and you still may not be rid of them.',
    traits: ['Corpses fuel healing', 'Revenant Vow: return once with 1 HP'], color: '#5B7A7A', accent: '#D9C27A',
    culture: 'court', def: COURT, core: { pikeman: 'graveguard', archer: 'necromancer', cavalier: 'mourningKnight' }, champion: COURT_CHAMPION },
];
// Dreg is the shipped Red champion (id 'dreg'). When the clans play Blue they need a second Dreg so both sides can have a champion;
// 'dregBlue' is a copy registered as a champion template, and Dreg's kit abilities (units: ['dreg']) are extended to apply to it.
const DREG_BLUE = 'dregBlue';
function registerFang() {
  const record = registerCulture(FANG);
  registerChampions({ [DREG_BLUE]: { ...structuredClone(UNITS.find((u) => u.id === 'dreg')), id: DREG_BLUE, faction: 'blue', champion: true, culture: 'fang' } });
  for (const [id, a] of Object.entries(ABILITY_CATALOG)) if (a.units?.includes('dreg') && !a.units.includes(DREG_BLUE)) ABILITY_CATALOG[id] = { ...a, units: [...a.units, DREG_BLUE] };
  return record;
}

export const FACTION_BY_ID = Object.fromEntries(FACTIONS.map((f) => [f.id, f]));
export const isFaction = (id) => Boolean(FACTION_BY_ID[id]);

/** Register the cultures of the given faction ids (ids without a culture are ignored) and set the rarity gate. Safe to call repeatedly. */
export function prepareFactions(ids, { gate = true } = {}) {
  resetCultures();
  delete CHAMPION_TEMPLATES[DREG_BLUE];
  const cultures = [...new Set(ids.map((id) => FACTION_BY_ID[id]).filter((f) => f?.culture))];
  for (const f of cultures) (f.register ? f.register() : registerCulture(f.def));
  setRarityGate(cultures.length && gate ? { ...RARITY_GATE } : {});
  return cultures.map((f) => f.culture);
}

const isChampion = (u) => u.cls === 'paladin' || u.cls === 'barbarian';
/** The shipped starting units of `side`, each swapped for the faction's equivalent by role; the champion becomes the faction champion. */
export function armyRoster(factionId, side) {
  const f = FACTION_BY_ID[factionId] || FACTION_BY_ID.classic;
  const shipped = UNITS.filter((u) => u.faction === side).map((u) => structuredClone(u));
  if (!f.culture) return shipped;
  return shipped.map((u) => {
    if (isChampion(u)) {
      const id = championFor(factionId, side);
      if (id === 'dreg') return { ...structuredClone(UNITS.find((x) => x.id === 'dreg')), faction: side, c: u.c, r: u.r };
      return createChampionUnit(id, side, u.c, u.r);
    }
    const key = f.core[u.cls];
    if (!key || key === u.cls) return u;
    return { ...createRecruitUnit(key, u.id, side, u.c, u.r), look: u.look };
  });
}

export const championFor = (factionId, side) => {
  const f = FACTION_BY_ID[factionId] || FACTION_BY_ID.classic;
  return typeof f.champion === 'string' ? f.champion : f.champion[side];
};

/** Skirmish: blue and red factions ('classic' for the shipped army). Classic v classic is exactly the shipped createMatch call. */
export function createSkirmish({ blue = 'classic', red = 'classic', seed, maxRounds = null, log = null, meta = {}, combat = null, abilities } = {}) {
  const cultures = prepareFactions([blue, red]);
  if (!cultures.length) return createMatch({ ...(seed !== undefined ? { seed } : {}), maxRounds, log, meta, combat, ...(abilities!==undefined?{abilities}:{}) });
  const opts = { ...(seed !== undefined ? { seed } : {}), maxRounds, log, combat, ...(abilities!==undefined?{abilities}:{}), meta: { ...meta, blueFaction: blue, redFaction: red } };
  if (blue === red) throw new Error('both sides cannot use the same faction yet (mirror matches need a second champion)');
  const pools = {};
  for (const side of ['blue', 'red']) { const f = FACTION_BY_ID[side === 'blue' ? blue : red]; if (f.culture) pools[side] = culturePool(f.culture); }
  return createMatch({ ...opts, roster: [...armyRoster(blue, 'blue'), ...armyRoster(red, 'red')], champions: { blue: championFor(blue, 'blue'), red: championFor(red, 'red') }, pools });
}
