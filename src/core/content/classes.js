// Unit class templates and the starting roster. Plain data only; the constructors that turn a
// template into a unit record live in src/core/setup/units.js.

/**
 * @typedef {Object} ClassTemplate
 * @property {string} name
 * @property {string} title
 * @property {number} lv
 * @property {number} hp
 * @property {number} str
 * @property {number} mag
 * @property {number} skl
 * @property {number} spd
 * @property {number} def
 * @property {number} res
 * @property {number} mov
 * @property {string} weapon        key of the weapon table
 * @property {string} [culture]     culture that registered the class
 * @property {string} [stance]      default stance when it differs from the class rule
 * @property {object[]} [passives]
 * @property {object} [onDeath]
 */

/** The three shipped recruit classes. Cultures add their own on top (see setup/cultures.js). */
export const RECRUIT_CLASSES = Object.freeze({
  pikeman: { name: 'Pikeman', title: 'Recruit', lv: 2, hp: 24, str: 8, mag: 0, skl: 5, spd: 4, def: 9, res: 1, mov: 4, weapon: 'Iron Pike' },
  archer: { name: 'Archer', title: 'Recruit', lv: 2, hp: 18, str: 6, mag: 0, skl: 8, spd: 7, def: 3, res: 1, mov: 5, weapon: 'Longbow' },
  cavalier: { name: 'Cavalier', title: 'Recruit', lv: 3, hp: 24, str: 8, mag: 0, skl: 5, spd: 8, def: 7, res: 1, mov: 7, weapon: 'Iron Lance' },
});

/** Class keys of the two named heroes. They are not recruitable. */
export const HERO_CLASSES = Object.freeze(['paladin', 'barbarian']);

/** Movement type by class key. Any class missing here moves as 'foot'. */
export const BASE_MOVE_TYPES = Object.freeze({
  knight: 'armor',
  paladin: 'armor',
  barbarian: 'armor',
  warlord: 'armor',
  cavalier: 'mounted',
});

/** Pre-assigned unit categories (src/core/content/categories.js) of the shipped classes. */
export const BASE_CLASS_META = Object.freeze({
  pikeman: { category: 'melee' },
  archer: { category: 'ranged' },
  cavalier: { category: 'mounted' },
  paladin: { category: 'melee' },
  barbarian: { category: 'melee' },
});

/** The named heroes, as the legacy roster defined them. */
export const HEROES = Object.freeze({
  brenna: {
    id: 'brenna', name: 'Brenna', title: 'Paladin', cls: 'paladin', faction: 'blue', c: 5, r: 9, lv: 4,
    hp: 28, maxHp: 28, str: 9, mag: 0, skl: 5, spd: 3, def: 13, res: 1, mov: 4, weapon: 'Iron Sword',
    look: { skin: '#f0cdb4', hair: '#c9b6e6', eyes: '#5a64c8', style: 'long' },
  },
  dreg: {
    id: 'dreg', name: 'Dreg', title: 'Barbarian', cls: 'barbarian', faction: 'red', c: 10, r: 3, lv: 5,
    hp: 27, maxHp: 27, str: 9, mag: 0, skl: 4, spd: 2, def: 12, res: 0, mov: 4, weapon: 'Steel Axe',
    look: { skin: '#d8a98a', hair: '#9c4722', eyes: '#5b7088', style: 'long', beard: true },
  },
});

/** Look used when a class has no starting unit of its own to borrow one from. */
export const FALLBACK_LOOK = Object.freeze({ skin: '#d8a98a', hair: '#4a3524', eyes: '#3f7a4a', style: 'short' });

/**
 * The starting forces, in roster order. A `hero` entry names a HEROES key; a `recruit` entry is built
 * from its class template with `over` applied on top.
 * @type {ReadonlyArray<object>}
 */
export const STARTING_ROSTER = Object.freeze([
  { hero: 'brenna' },
  { cls: 'pikeman', id: 'pike_b1', faction: 'blue', c: 3, r: 9, look: { skin: '#e8b995', hair: '#6b4226', eyes: '#4a6a9a', style: 'short' } },
  { cls: 'pikeman', id: 'pike_b2', faction: 'blue', c: 4, r: 10, look: { skin: '#c68f63', hair: '#2b2018', eyes: '#4a3524', style: 'short' } },
  { cls: 'archer', id: 'archer_b1', faction: 'blue', c: 1, r: 9, look: { skin: '#f0cdb4', hair: '#b5462b', eyes: '#3f7a4a', style: 'short' } },
  { cls: 'cavalier', id: 'cav_b1', faction: 'blue', c: 3, r: 7, look: { skin: '#d9a57c', hair: '#3a2a1e', eyes: '#5a7a3a', style: 'short' } },
  { hero: 'dreg' },
  { cls: 'pikeman', id: 'pike_r1', faction: 'red', c: 9, r: 6, look: { skin: '#d8a98a', hair: '#2b2b2b', eyes: '#5a4a3a', style: 'short' }, over: { lv: 3 } },
  { cls: 'archer', id: 'archer_r1', faction: 'red', c: 12, r: 4, look: { skin: '#e9c2a0', hair: '#1f1a24', eyes: '#8a2f3a', style: 'long' }, over: { weapon: 'Steel Bow' } },
  { cls: 'archer', id: 'archer_r2', faction: 'red', c: 11, r: 1, look: { skin: '#c98d62', hair: '#7a5a3a', eyes: '#3a2a1a', style: 'short' } },
  { cls: 'cavalier', id: 'cav_r1', faction: 'red', c: 12, r: 2, look: { skin: '#e0b090', hair: '#5a3820', eyes: '#6a4a2a', style: 'short' }, over: { weapon: 'Steel Lance', lv: 4 } },
]);
