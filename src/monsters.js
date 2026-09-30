// Enemy-only campaign encounters. These records borrow the ordinary recruit stat envelope and
// movement defaults, while their own cls keeps player-class abilities and cards from applying.
import { createRecruitUnit } from './roster.js';

const def = (base, name, title, description, spriteKey, stats, weapon = 'Iron Sword', culture = 'monsters') =>
  Object.freeze({ base, name, title, description, spriteKey, stats: Object.freeze(stats), weapon, culture });

export const MONSTERS = Object.freeze({
  monsterRat: def('cavalier', 'Ashvale Rat', 'Vermin', 'A quick scavenger that darts into exposed ranks.', 'monsterRat',
    { lv: 1, hp: 16, str: 6, mag: 0, skl: 6, spd: 8, def: 2, res: 1, mov: 5 }),
  monsterSpider: def('archer', 'Cave Spider', 'Ambusher', 'A fragile, swift melee ambusher.', 'monsterSpider',
    { lv: 1, hp: 17, str: 6, mag: 0, skl: 7, spd: 7, def: 2, res: 2, mov: 5 }),
  monsterHyenaGoblin: def('pikeman', 'Hyena Goblin', 'Raider', 'A lightly armored raider that presses the front.', 'monsterHyenaGoblin',
    { lv: 2, hp: 20, str: 7, mag: 0, skl: 5, spd: 5, def: 4, res: 1, mov: 4 }),
  monsterBogGolem: def('pikeman', 'Bog Golem', 'Guardian', 'A slow, sturdy guardian with modest striking power.', 'monsterBogGolem',
    { lv: 2, hp: 26, str: 7, mag: 0, skl: 3, spd: 2, def: 8, res: 2, mov: 3 }),
  monsterOgre: def('pikeman', 'Ogre', 'Brute', 'A hard-hitting brute with enough bulk to hold a lane.', 'monsterOgre',
    { lv: 3, hp: 28, str: 9, mag: 0, skl: 4, spd: 2, def: 7, res: 1, mov: 3 }, 'Steel Axe'),
  monsterWerewolf: def('cavalier', 'Werewolf', 'Hunter', 'A fast hunter that can punish isolated units.', 'monsterWerewolf',
    { lv: 2, hp: 22, str: 8, mag: 0, skl: 6, spd: 7, def: 4, res: 2, mov: 5 }),
  monsterMothBear: def('pikeman', 'Moth Bear', 'Beast', 'A broad, resilient beast with a steady melee attack.', 'monsterMothBear',
    { lv: 2, hp: 25, str: 8, mag: 0, skl: 4, spd: 3, def: 6, res: 2, mov: 4 }),
  corpsehound: def('cavalier', 'Corpsehound', 'Hollow Court Beast', 'A swift hound sent ahead of the Hollow Court host.', 'corpsehound',
    { lv: 2, hp: 21, str: 7, mag: 0, skl: 6, spd: 7, def: 4, res: 2, mov: 5 }, 'Iron Sword', 'court'),
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
    selectedAbilities: [],
    stance: 'advance',
  };
}
