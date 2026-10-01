// Faction registry: the five menu entries (classic plus the four cultures) as data. A faction's
// `def` is the culture definition a content context registers; `core` maps the three shipped
// roles to the faction's starting units (a labelled default, not a rule); `champion` is the champion
// id used for the side (a string, or one id per side).
import { deepFreeze } from '../../util/geometry.js';
import CROWN from './argent-crown.js';
import FANG from './white-fang.js';
import LEAGUE, { DEFAULT_LEAGUE_CHAMPION } from './iron-league.js';
import COURT, { DEFAULT_CHAMPION as COURT_CHAMPION } from './hollow-court.js';

/** Rarity gate used whenever a faction is in play: uncommon cards from round 3, rare from round 6. */
export const RARITY_GATE = Object.freeze({ uncommon: 3, rare: 6 });

/**
 * @typedef {Object} Faction
 * @property {string} id
 * @property {string} name
 * @property {string} tagline
 * @property {string[]} traits
 * @property {string} color
 * @property {string} accent
 * @property {string|{blue: string, red: string}} champion
 * @property {string} [culture]  culture id; absent for classic
 * @property {object} [def]      culture definition
 * @property {Record<string, string>} [core]  shipped class key -> this faction's equivalent
 */

/** @type {ReadonlyArray<Faction>} */
export const FACTIONS = deepFreeze([
  {
    id: 'classic', name: 'Ashvale (classic)',
    tagline: "The shipped game: Brenna's kingdom against Dreg's raiders, plain Pikemen, Archers and Cavaliers.",
    traits: ['Baseline rules', 'Brenna (Paladin) or Dreg (Barbarian)'],
    color: '#3d5a80', accent: '#c9d6ea', champion: { blue: 'brenna', red: 'dreg' },
  },
  {
    id: 'crown', name: 'The Argent Crown',
    tagline: 'Blue and silver. A coherent line beats a strong unit: stand together and the wall holds.',
    traits: ['Line Doctrine: +1 Defense per adjacent infantry (max +2)', 'Bannerman auras, Oathsworn, Crown Guard'],
    color: '#1A4FA0', accent: '#B8C4D6',
    culture: 'crown', def: CROWN, core: { pikeman: 'crownPike', archer: 'crownArcher', cavalier: 'crownCavalier' }, champion: 'brennaCrown',
  },
  {
    id: 'fang', name: 'The White Fang Clans',
    tagline: 'Iron, fur and fangs. Once momentum starts, keep it going: Advance, make contact, never sit still.',
    traits: ['Momentum: +2 damage after moving', 'Blood Challenge (Dreg): hunt one enemy'],
    color: '#6B7280', accent: '#A8231C',
    culture: 'fang', def: FANG, core: { pikeman: 'fangReaver', archer: 'fangHunter', cavalier: 'cavalier' }, champion: { blue: 'dregBlue', red: 'dreg' },
  },
  {
    id: 'league', name: 'The Iron League',
    tagline: 'Brass, bronze and rust. Mercenaries with salvaged ancient machines: prepare a killing ground and let them come.',
    traits: ['Prepared Shot: hold still to hit harder', 'Barricades, Pavise shields, Relic Walkers'],
    color: '#B5843A', accent: '#4E7C6A',
    culture: 'league', def: LEAGUE, core: { pikeman: 'leaguePike', archer: 'coil', cavalier: 'pavise' }, champion: DEFAULT_LEAGUE_CHAMPION,
  },
  {
    id: 'court', name: 'The Hollow Court',
    tagline: 'Bone, velvet and candlelight. A dead aristocracy: defeat their units and you still may not be rid of them.',
    traits: ['Corpses fuel healing', 'Revenant Vow: return once with 1 HP'],
    color: '#5B7A7A', accent: '#D9C27A',
    culture: 'court', def: COURT, core: { pikeman: 'graveguard', archer: 'necromancer', cavalier: 'mourningKnight' }, champion: COURT_CHAMPION,
  },
]);

export const FACTION_BY_ID = Object.freeze(Object.fromEntries(FACTIONS.map((faction) => [faction.id, faction])));
export const FACTION_IDS = Object.freeze(FACTIONS.map((faction) => faction.id));
export const isFaction = (id) => Boolean(FACTION_BY_ID[id]);
