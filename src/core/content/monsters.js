// Enemy-only campaign encounters. These records borrow a recruit class's stat envelope and movement
// defaults, while their own `cls` keeps player-class cards from applying. They register no culture,
// card or kit: the context builds their unit records through createMonsterUnit.

/**
 * @typedef {Object} MonsterDef
 * @property {string} base         recruit class whose envelope and movement they borrow
 * @property {string} name
 * @property {string} title
 * @property {string} description
 * @property {string} spriteKey
 * @property {object} stats        lv, hp, str, mag, skl, spd, def, res, mov
 * @property {string} weapon
 * @property {string} culture      'monsters', or the culture the beast belongs to
 * @property {ReadonlyArray<object>} passives
 */

function passive(id, name, description, when, effect) {
  return Object.freeze({ id, name, description, when: Object.freeze(when), effect: Object.freeze(effect) });
}

function monster(spriteKey, base, name, title, description, stats, weapon, culture, passives) {
  return Object.freeze({
    base,
    name,
    title,
    description,
    spriteKey,
    stats: Object.freeze(stats),
    weapon,
    culture,
    passives: Object.freeze(passives),
  });
}

/** @type {Readonly<Record<string, MonsterDef>>} */
const DEFINITIONS = {
  monsterRat: monster('monsterRat', 'cavalier', 'Ashvale Rat', 'Vermin', 'A quick scavenger that darts into exposed ranks.',
    { lv: 1, hp: 16, str: 6, mag: 0, skl: 6, spd: 8, def: 2, res: 1, mov: 5 }, 'Iron Sword', 'monsters',
    [passive('packScavenger', 'Pack Scavenger', 'Gains 10 Hit while adjacent to an ally.', { adjacentAlly: { min: 1 } }, { hitBonus: 10 })]),
  monsterSpider: monster('monsterSpider', 'archer', 'Cave Spider', 'Ambusher', 'A fragile, swift melee ambusher.',
    { lv: 1, hp: 17, str: 6, mag: 0, skl: 7, spd: 7, def: 2, res: 2, mov: 5 }, 'Iron Sword', 'monsters',
    [passive('webAmbush', 'Web Ambush', 'Gains 10 Hit while holding position.', { moved: false }, { hitBonus: 10 })]),
  monsterHyenaGoblin: monster('monsterHyenaGoblin', 'pikeman', 'Hyena Goblin', 'Raider', 'A lightly armored raider that presses the front.',
    { lv: 2, hp: 20, str: 7, mag: 0, skl: 5, spd: 5, def: 4, res: 1, mov: 4 }, 'Iron Sword', 'monsters',
    [passive('packTactics', 'Pack Tactics', 'Deals 1 extra damage while adjacent to an ally.', { adjacentAlly: { min: 1 } }, { damageDealt: 1 })]),
  monsterBogGolem: monster('monsterBogGolem', 'pikeman', 'Bog Golem', 'Guardian', 'A slow, sturdy guardian with modest striking power.',
    { lv: 2, hp: 26, str: 7, mag: 0, skl: 3, spd: 2, def: 8, res: 2, mov: 3 }, 'Iron Sword', 'monsters',
    [passive('mudstoneGuard', 'Mudstone Guard', 'Takes 2 less damage per strike while holding.', { stance: ['hold'] }, { damageTaken: 2 })]),
  monsterOgre: monster('monsterOgre', 'pikeman', 'Ogre', 'Brute', 'A hard-hitting brute with enough bulk to hold a lane.',
    { lv: 3, hp: 28, str: 9, mag: 0, skl: 4, spd: 2, def: 7, res: 1, mov: 3 }, 'Steel Axe', 'monsters',
    [passive('crushingBlows', 'Crushing Blows', 'Ignores 1 Defense on every strike.', {}, { ignoreDefense: 1 })]),
  monsterWerewolf: monster('monsterWerewolf', 'cavalier', 'Werewolf', 'Hunter', 'A fast hunter that can punish isolated units.',
    { lv: 2, hp: 22, str: 8, mag: 0, skl: 6, spd: 7, def: 4, res: 2, mov: 5 }, 'Iron Sword', 'monsters',
    [passive('bloodFrenzy', 'Blood Frenzy', 'Deals 2 extra damage below half HP.', { hpBelow: 0.5 }, { damageDealt: 2 })]),
  monsterMothBear: monster('monsterMothBear', 'pikeman', 'Moth Bear', 'Beast', 'A broad, resilient beast with a steady melee attack.',
    { lv: 2, hp: 25, str: 8, mag: 0, skl: 4, spd: 3, def: 6, res: 2, mov: 4 }, 'Iron Sword', 'monsters',
    [passive('thickHide', 'Thick Hide', 'Takes 1 less damage per strike below half HP.', { hpBelow: 0.5 }, { damageTaken: 1 })]),
  corpsehound: monster('corpsehound', 'cavalier', 'Corpsehound', 'Hollow Court Beast', 'A swift hound sent ahead of the Hollow Court host.',
    { lv: 2, hp: 21, str: 7, mag: 0, skl: 6, spd: 7, def: 4, res: 2, mov: 5 }, 'Iron Sword', 'court',
    [passive('graveScent', 'Grave Scent', 'Deals 2 extra damage while a corpse lies within 2 tiles.', { objectNear: { kind: 'corpse', radius: 2 } }, { damageDealt: 2 })]),
};

// Every monster's sprite key is its own id.
export const MONSTERS = Object.freeze(DEFINITIONS);
