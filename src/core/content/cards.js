// Card catalogue: every shipped card key with its type, rarity, cost and text. Card text is printed
// by the logs, so it must stay equal to the legacy strings. Culture cards are built on top of these in
// src/core/setup/cultures.js. The draw, cycle and recruit mechanics live in src/core/economy/.
import { SHARD_CARDS, SHARD_IDS } from './shards.js';

export { SHARD_CARDS };

/** Economy numbers the rules read. Experiments may override them through createContent({ cardLimits }). */
export const DEFAULT_CARD_LIMITS = Object.freeze({
  hand: 8,
  cyclesPerRound: 1,
  openingHand: 5,
  laterDraw: 3,
  initialSupply: 3,
  supplyPerRound: 3,
  maxSupply: 30,
  reserveCapacity: 8,
  populationCap: 10,
  shardsMin: 2,
  shardsMax: 3,
});

/** Unit cards for the shipped recruit classes; the card key equals the class key. */
export const UNIT_CARDS = Object.freeze({
  pikeman: Object.freeze({
    id: 'unit-pikeman', type: 'unit', rarity: 'common', unitId: 'pikeman', name: 'Pikeman', cost: 1, class: 'Foot', stars: 1, range: 1,
    defaultStance: 'advance', ability: 'Advances into melee to hold the frontline; proposed anti-cavalry specialist.', population: 1,
  }),
  archer: Object.freeze({
    id: 'unit-archer', type: 'unit', rarity: 'common', unitId: 'archer', name: 'Archer', cost: 2, class: 'Foot', stars: 1, range: 2,
    defaultStance: 'hold', ability: 'Ranged support; cannot counter adjacent attackers.', population: 1,
  }),
  cavalier: Object.freeze({
    id: 'unit-cavalier', type: 'unit', rarity: 'common', unitId: 'cavalier', name: 'Cavalier', cost: 3, typeLabel: 'Mounted', class: 'Mounted', stars: 1, range: 1,
    defaultStance: 'advance', ability: 'Mobile mounted unit; presses reinforcement points.', population: 1,
  }),
});

/** Spell cards. Spells are archived (off in normal play); the cards stay as inert catalogue entries. */
export const SPELL_CARDS = Object.freeze({
  mend: Object.freeze({ id: 'spell-mend', type: 'spell', rarity: 'common', name: 'Mend', cost: 1, target: 'friendly-unit', duration: 'instant', effect: 'Restore 8 HP, up to maximum HP.' }),
  ward: Object.freeze({ id: 'spell-ward', type: 'spell', rarity: 'common', name: 'Ward', cost: 1, target: 'friendly-unit', duration: 'upcoming-battle', effect: 'Protect one friendly unit during the upcoming battle.' }),
  fireburst: Object.freeze({ id: 'spell-fireburst', type: 'spell', rarity: 'common', name: 'Fireburst', cost: 2, target: 'enemy-area', duration: 'instant', effect: 'Deal 6 damage to enemies in the selected area.' }),
});

/** Type-wide skill cards. Shards replaced Barrier, so no skill card is drawable. */
export const SKILL_CARDS = Object.freeze({
  barrier: Object.freeze({
    id: 'skill-barrier', type: 'skill', rarity: 'common', skillId: 'barrier', name: 'Barrier', cost: 2, target: 'unit-type', duration: 'persistent',
    blockDamage: 2, effect: 'All friendly units of this type reduce incoming damage by 2 per battle.',
  }),
});

/**
 * The shared draw pool; repeated entries are weights. Spells and skills are not drawable by default;
 * the shard keys are dealt separately by the shard shop.
 */
export const RECRUITMENT_POOL = Object.freeze([
  'pikeman', 'pikeman', 'pikeman', 'pikeman', 'pikeman', 'pikeman',
  'archer', 'archer', 'archer', 'archer',
  'cavalier', 'cavalier',
  ...SHARD_IDS,
]);

/** Rarity names in tier order, used by culture rarity gates. */
export const RARITIES = Object.freeze(['common', 'uncommon', 'rare']);
