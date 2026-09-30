// Enemy-only campaign encounters. These records borrow the ordinary recruit stat envelope and
// movement defaults, while their own cls keeps player-class abilities and cards from applying.
import { createRecruitUnit } from './roster.js';

const passive = (id, name, description, when, effect) => Object.freeze({ id, name, description, when: Object.freeze(when), effect: Object.freeze(effect) });
const def = (base, name, title, description, spriteKey, stats, weapon = 'Iron Sword', culture = 'monsters', passives = []) =>
  Object.freeze({ base, name, title, description, spriteKey, stats: Object.freeze(stats), weapon, culture, passives: Object.freeze(passives) });

export const MONSTERS = Object.freeze({
  monsterRat: def('cavalier', 'Ashvale Rat', 'Vermin', 'A quick scavenger that darts into exposed ranks.', 'monsterRat',
    { lv: 1, hp: 16, str: 6, mag: 0, skl: 6, spd: 8, def: 2, res: 1, mov: 5 }, 'Iron Sword', 'monsters', [passive('packScavenger', 'Pack Scavenger', 'Gains 10 Hit while adjacent to an ally.', { adjacentAlly: { min: 1 } }, { hitBonus: 10 })]),
  monsterSpider: def('archer', 'Cave Spider', 'Ambusher', 'A fragile, swift melee ambusher.', 'monsterSpider',
    { lv: 1, hp: 17, str: 6, mag: 0, skl: 7, spd: 7, def: 2, res: 2, mov: 5 }, 'Iron Sword', 'monsters', [passive('webAmbush', 'Web Ambush', 'Gains 10 Hit while holding position.', { moved: false }, { hitBonus: 10 })]),
  monsterHyenaGoblin: def('pikeman', 'Hyena Goblin', 'Raider', 'A lightly armored raider that presses the front.', 'monsterHyenaGoblin',
    { lv: 2, hp: 20, str: 7, mag: 0, skl: 5, spd: 5, def: 4, res: 1, mov: 4 }, 'Iron Sword', 'monsters', [passive('packTactics', 'Pack Tactics', 'Deals 1 extra damage while adjacent to an ally.', { adjacentAlly: { min: 1 } }, { damageDealt: 1 })]),
  monsterBogGolem: def('pikeman', 'Bog Golem', 'Guardian', 'A slow, sturdy guardian with modest striking power.', 'monsterBogGolem',
    { lv: 2, hp: 26, str: 7, mag: 0, skl: 3, spd: 2, def: 8, res: 2, mov: 3 }, 'Iron Sword', 'monsters', [passive('mudstoneGuard', 'Mudstone Guard', 'Takes 2 less damage per strike while holding.', { stance: ['hold'] }, { damageTaken: 2 })]),
  monsterOgre: def('pikeman', 'Ogre', 'Brute', 'A hard-hitting brute with enough bulk to hold a lane.', 'monsterOgre',
    { lv: 3, hp: 28, str: 9, mag: 0, skl: 4, spd: 2, def: 7, res: 1, mov: 3 }, 'Steel Axe', 'monsters', [passive('crushingBlows', 'Crushing Blows', 'Ignores 1 Defense on every strike.', {}, { ignoreDefense: 1 })]),
  monsterWerewolf: def('cavalier', 'Werewolf', 'Hunter', 'A fast hunter that can punish isolated units.', 'monsterWerewolf',
    { lv: 2, hp: 22, str: 8, mag: 0, skl: 6, spd: 7, def: 4, res: 2, mov: 5 }, 'Iron Sword', 'monsters', [passive('bloodFrenzy', 'Blood Frenzy', 'Deals 2 extra damage below half HP.', { hpBelow: 0.5 }, { damageDealt: 2 })]),
  monsterMothBear: def('pikeman', 'Moth Bear', 'Beast', 'A broad, resilient beast with a steady melee attack.', 'monsterMothBear',
    { lv: 2, hp: 25, str: 8, mag: 0, skl: 4, spd: 3, def: 6, res: 2, mov: 4 }, 'Iron Sword', 'monsters', [passive('thickHide', 'Thick Hide', 'Takes 1 less damage per strike below half HP.', { hpBelow: 0.5 }, { damageTaken: 1 })]),
  corpsehound: def('cavalier', 'Corpsehound', 'Hollow Court Beast', 'A swift hound sent ahead of the Hollow Court host.', 'corpsehound',
    { lv: 2, hp: 21, str: 7, mag: 0, skl: 6, spd: 7, def: 4, res: 2, mov: 5 }, 'Iron Sword', 'court', [passive('graveScent', 'Grave Scent', 'Deals 2 extra damage while a corpse lies within 2 tiles.', { objectNear: { kind: 'corpse', radius: 2 } }, { damageDealt: 2 })]),
});

/** Build a standard field record for a fixed campaign encounter; this does not register a culture or card. */
export function createMonsterUnit(key, id, faction, c, r) {
  const monster = MONSTERS[key];
  if (!monster) throw new Error(`Unknown monster: ${key}`);
  const unit = createRecruitUnit(monster.base, id, faction, c, r, {
    ...monster.stats,
    name: monster.name,
    title: monster.title,
    description: monster.description,
    weapon: monster.weapon,
  });
  return {
    ...unit,
    cls: key,
    classId: monster.base,
    variantId: key,
    name: monster.name,
    title: monster.title,
    description: monster.description,
    weapon: monster.weapon,
    spriteKey: monster.spriteKey,
    monster: true,
    culture: monster.culture,
    passives: monster.passives.map((p) => ({ ...p, when: { ...p.when, ...(p.when.adjacentAlly ? { adjacentAlly: { ...p.when.adjacentAlly } } : {}), ...(p.when.objectNear ? { objectNear: { ...p.when.objectNear } } : {}) }, effect: { ...p.effect } })),
    selectedAbilities: [],
    stance: 'advance',
  };
}
