// Weapon table and the weapon triangle.
//
/**
 * @typedef {Object} Weapon
 * @property {number} mt        might, added to Str (or Mag for magic weapons)
 * @property {number} hit       base hit chance
 * @property {number} crit      base crit chance
 * @property {number[]} rng     [minRange, maxRange] in Manhattan tiles
 * @property {string} kind      sword | lance | axe | bow | tome, or a neutral kind such as 'claw'
 * @property {boolean} [magic]  uses Mag against Res and ignores Def
 */

/** @type {Readonly<Record<string, Weapon>>} */
export const WEAPONS = Object.freeze({
  'Silver Rapier': { mt: 7, hit: 90, crit: 10, rng: [1, 1], kind: 'sword' },
  'Iron Sword': { mt: 6, hit: 90, crit: 0, rng: [1, 1], kind: 'sword' },
  'Iron Pike': { mt: 8, hit: 75, crit: 0, rng: [1, 1], kind: 'lance' },
  'Iron Lance': { mt: 7, hit: 80, crit: 0, rng: [1, 1], kind: 'lance' },
  'Steel Lance': { mt: 9, hit: 75, crit: 0, rng: [1, 1], kind: 'lance' },
  Longbow: { mt: 6, hit: 75, crit: 0, rng: [2, 2], kind: 'bow' },
  'Steel Bow': { mt: 8, hit: 70, crit: 0, rng: [2, 2], kind: 'bow' },
  'Fire Staff': { mt: 5, hit: 90, crit: 0, rng: [1, 2], kind: 'tome', magic: true },
  Flux: { mt: 7, hit: 80, crit: 0, rng: [1, 2], kind: 'tome', magic: true },
  'Great Axe': { mt: 12, hit: 65, crit: 5, rng: [1, 1], kind: 'axe' },
  'Hand Axe': { mt: 7, hit: 60, crit: 0, rng: [1, 1], kind: 'axe' },
  'Steel Axe': { mt: 9, hit: 70, crit: 0, rng: [1, 1], kind: 'axe' },
});

/** What a unit with an unknown weapon name fights with. */
export const FALLBACK_WEAPON = Object.freeze({ mt: 5, hit: 70, crit: 0, rng: [1, 1], kind: 'none' });

/** Sword beats axe, axe beats lance, lance beats sword. Any other kind is neutral. */
export const WEAPON_TRIANGLE = Object.freeze({ sword: 'axe', axe: 'lance', lance: 'sword' });

/** Damage bonus and malus per triangle result; the hit modifier is `TRIANGLE_HIT` per point. */
export const TRIANGLE_HIT = 15;

/**
 * Triangle result for an attacker weapon kind against a defender weapon kind.
 * @returns {1 | 0 | -1} 1 when the attacker has the advantage, -1 when at a disadvantage
 */
export function triangleBonus(attackerKind, defenderKind) {
  if (WEAPON_TRIANGLE[attackerKind] === defenderKind) return 1;
  if (WEAPON_TRIANGLE[defenderKind] === attackerKind) return -1;
  return 0;
}
