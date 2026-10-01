// The Argent Crown: blue and silver, Brenna's faction. A culture definition (schema: src/core/setup/cultures.js).
//
// Core idea, LINE DOCTRINE: +1 Defense per adjacent friendly infantry unit, up to +2. It is a real
// Defense bonus (the `equipDef` battle status), so it behaves exactly like +Defense. Every other
// reduction here uses the `damageTaken` status: "take N less damage per strike", applied after the
// crit multiplier. All numbers are prototype defaults for paired-seed experiments, not balance
// decisions. Design: docs/factions/ARGENT_CROWN.md and FACTIONS.md.
//
// The ability and spell records below are inert catalogue data in this pass (skills and spells are
// archived); the effect interpreter would plug in where the match applies them.
import { RECRUIT_CLASSES } from '../classes.js';

export const CULTURE_ID = 'crown';

// ---------------------------------------------------------------- Line Doctrine
export const LINE_DEFENSE_PER_ADJACENT = 1;
export const LINE_CAP = 2;
/** "Infantry" for Line Doctrine: every foot class (Brenna counts). Cavalry does not count but can benefit. */
export const INFANTRY = ['pikeman', 'archer', 'bannerman', 'oathsworn', 'paladin'];

// ---------------------------------------------------------------- units (deltas against the shipped classes)
export const GUARD_DELTA = { hp: +2, def: +1, mov: -1 };
export const GUARD_COST = 2;
export const GUARD_STANCE = 'hold';
export const SHIELDWALL_REDUCTION = 2;
export const BANNERMAN_DELTA = { hp: -4, str: -3 };
export const BANNERMAN_COST = 2;
export const BANNERMAN_STANCE = 'hold';
export const BANNER_RADIUS = 2;
export const BANNER_REDUCTION = 1;
export const BANNER_STANCES = ['hold', 'protect'];
export const OATHSWORN_DELTA = { hp: +4, str: 0, def: +3 };
export const OATHSWORN_COST = 3;
export const OATHSWORN_STANCE = 'hold';
export const SWORN_RADIUS = 1;
export const SWORN_ALLY_REDUCTION = 2;
export const SWORN_SELF_PENALTY = 2;
export const CLERIC = { hp: 20, mag: 7, staffMight: 4, cost: 3, healAmount: 6, healRadius: 2, sanctuaryCost: 2, sanctuaryCooldown: 2 };
export const CROWN_PIKE_COST = 1;
export const CROWN_ARCHER_COST = 2;
export const CROWN_CAVALIER_COST = 3;

// ---------------------------------------------------------------- skills and spell
export const CLOSE_RANKS = { cost: 1, cooldown: 2, reduction: 2 };
export const HOLD_STANDARD = { cost: 2, cooldown: 3, reduction: 2 };
export const INTERPOSE = { cost: 2, cooldown: 2, reduction: 4 };
export const RALLY_BANNER = { cost: 1, reduction: 3 };

// ---------------------------------------------------------------- champion: Brenna
export const BRENNA_BULWARK = { cost: 2, cooldown: 3, reduction: 3 };
export const BRENNA_JUDGMENT = { cost: 1, cooldown: 2, bonus: 3, hit: 10 };
export const BRENNA_PRESENCE = { radius: 2, reduction: 1 };
/** The shipped id, the Crown champion, and a second copy for mirror matches. */
export const BRENNA_IDS = ['brenna', 'brennaCrown', 'brennaCrownB'];

/** Per-side draw pool; repeats are weights. Uncommon from round 3 and rare from round 6 under the rarity gate. */
export const POOL = [
  'crownPike', 'crownPike', 'crownPike', 'crownGuard', 'crownGuard', 'crownArcher', 'crownArcher', 'crownCavalier',
  'bannerman', 'oathsworn', 'battleCleric',
  'mend', 'ward', 'fireburst', 'rallyBanner',
];

/** Placeholder art tints (multiplied over the borrowed base sprite). */
export const TINTS = {
  crownPike: '#9db8ea',
  crownArcher: '#9db8ea',
  crownCavalier: '#9db8ea',
  crownGuard: '#7f9fd6',
  bannerman: '#d7deef',
  oathsworn: '#eef1f8',
  battleCleric: '#f4f1e2',
  brenna: '#ffffff',
};

// ---------------------------------------------------------------- passives
export const LINE_DOCTRINE = Object.freeze({
  id: 'lineDoctrine',
  when: { adjacentAlly: { classes: INFANTRY, min: 1 } },
  perAdjacent: true,
  cap: LINE_CAP,
  effect: { equipDef: LINE_DEFENSE_PER_ADJACENT },
});
export const SHIELDWALL = Object.freeze({
  id: 'shieldwall',
  when: { adjacentAlly: { classes: INFANTRY, min: 1 } },
  effect: { damageTaken: SHIELDWALL_REDUCTION },
});
export const BANNER = Object.freeze({
  id: 'banner',
  aura: { radius: BANNER_RADIUS, stance: BANNER_STANCES },
  effect: { damageTaken: BANNER_REDUCTION },
});
// Sworn Guard is two passives: the ring of allies next to a Protecting Oathsworn are shielded, and the
// Oathsworn pays for it (a negative damageTaken is extra damage per strike). Both need an adjacent ally.
export const SWORN_GUARD_ALLIES = Object.freeze({
  id: 'swornGuard',
  when: { stance: ['protect'], adjacentAlly: { min: 1 } },
  aura: { radius: SWORN_RADIUS },
  effect: { damageTaken: SWORN_ALLY_REDUCTION },
});
export const SWORN_GUARD_SELF = Object.freeze({
  id: 'swornGuardCost',
  when: { stance: ['protect'], adjacentAlly: { min: 1 } },
  effect: { damageTaken: -SWORN_SELF_PENALTY },
});
export const BRENNA_AURA = Object.freeze({
  id: 'crownPresence',
  aura: { radius: BRENNA_PRESENCE.radius, classes: INFANTRY },
  effect: { damageTaken: BRENNA_PRESENCE.reduction },
});
/** Passives carried by Brenna as the Crown champion. */
export const BRENNA_PASSIVES = [LINE_DOCTRINE, BRENNA_AURA];

function templateWithDelta(className, delta) {
  const template = { ...RECRUIT_CLASSES[className] };
  for (const [stat, change] of Object.entries(delta)) template[stat] += change;
  return template;
}

function statBlock(t) {
  return { hp: t.hp, str: t.str, skl: t.skl, spd: t.spd, def: t.def, res: t.res, mov: t.mov, lv: t.lv };
}

const bannerman = templateWithDelta('pikeman', BANNERMAN_DELTA);
const oathsworn = templateWithDelta('pikeman', OATHSWORN_DELTA);
const SHIELD_DESCRIPTION = 'Line Doctrine: +1 Defense per adjacent friendly infantry (max +2).';
const BRENNA_STATS = { hp: 28, str: 9, skl: 5, spd: 3, def: 13, res: 1, mov: 4, lv: 4 };
const BRENNA_LOOK = { skin: '#f0cdb4', hair: '#c9b6e6', eyes: '#5a64c8', style: 'long' };

const ARGENT_CROWN = {
  id: CULTURE_ID,

  // New classes: they reuse the Iron Pike weapon and move as foot.
  classes: {
    bannerman: {
      category: 'support', aiStance: 'hold', name: 'Bannerman', title: 'Standard-bearer', label: 'Bannerman',
      stats: statBlock(bannerman), weapon: 'Iron Pike', spriteBase: 'pikeman', tint: TINTS.bannerman,
      passives: [LINE_DOCTRINE, BANNER],
      description: 'Banner: friendly Hold/Protect units within 2 tiles take 1 less damage per strike.',
      card: { rarity: 'uncommon', cost: BANNERMAN_COST, class: 'Foot', range: 1, defaultStance: BANNERMAN_STANCE, population: 1 },
    },
    oathsworn: {
      aiStance: 'hold', name: 'Oathsworn', title: 'Sworn Guard', label: 'Oathsworn',
      stats: statBlock(oathsworn), weapon: 'Iron Pike', spriteBase: 'pikeman', tint: TINTS.oathsworn,
      passives: [LINE_DOCTRINE, SWORN_GUARD_ALLIES, SWORN_GUARD_SELF],
      description: 'Sworn Guard: while Protecting, the allies beside it take 2 less damage per strike and it takes 2 more.',
      card: { rarity: 'rare', cost: OATHSWORN_COST, class: 'Foot', range: 1, defaultStance: OATHSWORN_STANCE, population: 1 },
    },
    // Support caster with a blessed staff (magic: Mag against Res, reach 2). Frail in melee.
    battleCleric: {
      category: 'support', aiStance: 'hold', name: 'Battle Cleric', title: 'Field priest', label: 'Battle Cleric',
      stats: { hp: CLERIC.hp, str: 3, mag: CLERIC.mag, skl: 6, spd: 5, def: 4, res: 4, mov: 4 },
      weapon: 'Blessed Staff',
      weaponDef: { mt: CLERIC.staffMight, hit: 85, crit: 0, rng: [1, 2], kind: 'tome', magic: true },
      spriteBase: 'archer', tint: TINTS.battleCleric, passives: [LINE_DOCTRINE],
      description: `Sanctuary: heals ${CLERIC.healAmount} HP to itself and friendly units within ${CLERIC.healRadius} tiles each round it is chosen. `
        + 'Weak in melee, so keep it behind the line.',
      card: { rarity: 'uncommon', cost: CLERIC.cost, class: 'Foot', range: 2, defaultStance: 'hold', population: 1 },
    },
  },

  // Brenna as a registered champion so she works on either side, respawns as herself and carries passives.
  champions: {
    brennaCrown: {
      name: 'Brenna', title: 'Paladin', cls: 'paladin', faction: 'blue', tint: TINTS.brenna,
      stats: BRENNA_STATS, weapon: 'Iron Sword', look: BRENNA_LOOK, passives: BRENNA_PASSIVES,
    },
    brennaCrownB: {
      name: 'Brenna', title: 'Paladin', cls: 'paladin', faction: 'red', tint: TINTS.brenna,
      stats: BRENNA_STATS, weapon: 'Iron Sword', look: BRENNA_LOOK, passives: BRENNA_PASSIVES,
    },
  },

  // Variants of the shipped classes: identical stats, Line Doctrine only (plus the Guard's changes).
  variants: {
    crownGuard: {
      aiStance: 'hold', base: 'pikeman', name: 'Crown Guard', title: 'Line Infantry', delta: GUARD_DELTA,
      // stats.stance sets the default stance on the unit itself; the card alone is not enough.
      stats: { stance: GUARD_STANCE },
      tint: TINTS.crownGuard, passives: [LINE_DOCTRINE, SHIELDWALL],
      description: 'Holds the line. Shieldwall: takes 2 less damage per strike beside friendly infantry.',
      card: { rarity: 'common', cost: GUARD_COST, defaultStance: GUARD_STANCE },
    },
    crownPike: {
      base: 'pikeman', name: 'Crown Pikeman', title: 'Levy', tint: TINTS.crownPike, passives: [LINE_DOCTRINE],
      description: SHIELD_DESCRIPTION, card: { rarity: 'common', cost: CROWN_PIKE_COST },
    },
    crownArcher: {
      base: 'archer', name: 'Levy Archer', title: 'Levy', tint: TINTS.crownArcher, passives: [LINE_DOCTRINE],
      description: SHIELD_DESCRIPTION, card: { rarity: 'common', cost: CROWN_ARCHER_COST },
    },
    crownCavalier: {
      base: 'cavalier', name: 'Crown Knight', title: 'Nobility', tint: TINTS.crownCavalier, passives: [LINE_DOCTRINE],
      description: SHIELD_DESCRIPTION, card: { rarity: 'common', cost: CROWN_CAVALIER_COST },
    },
  },

  abilities: [
    {
      id: 'closeRanks', name: 'Close Ranks', classes: ['pikeman'], cost: CLOSE_RANKS.cost, cooldown: CLOSE_RANKS.cooldown, phase: 'defense',
      effect: { damageTaken: CLOSE_RANKS.reduction },
      description: `Pikeman class (Crown Pikeman, Crown Guard). Take ${CLOSE_RANKS.reduction} less damage per strike this battle. `
        + 'Does not force Hold. (Simplified: the design gives this to adjacent friendly infantry too.)',
    },
    {
      id: 'sanctuary', name: 'Sanctuary', classes: ['battleCleric'], cost: CLERIC.sanctuaryCost, cooldown: CLERIC.sanctuaryCooldown, phase: 'recovery',
      healAllies: { radius: CLERIC.healRadius, amount: CLERIC.healAmount, self: true },
      description: `Heal ${CLERIC.healAmount} HP to the Cleric and every friendly unit within ${CLERIC.healRadius} tiles.`,
    },
    {
      id: 'holdTheStandard', name: 'Hold the Standard', classes: ['bannerman'], cost: HOLD_STANDARD.cost, cooldown: HOLD_STANDARD.cooldown,
      phase: 'defense', requires: { stance: 'hold' }, effect: { damageTaken: HOLD_STANDARD.reduction },
      description: `Requires Hold. Take ${HOLD_STANDARD.reduction} less damage per strike this battle. `
        + '(Simplified: the design heals friendly units within 2 tiles by 6.)',
    },
    {
      id: 'interpose', name: 'Interpose', classes: ['oathsworn'], cost: INTERPOSE.cost, cooldown: INTERPOSE.cooldown, phase: 'defense',
      requires: { stance: 'protect' }, effect: { damageTaken: INTERPOSE.reduction },
      description: `Requires Protect. Take ${INTERPOSE.reduction} less damage per strike this battle. `
        + "(Simplified: the design moves up to 4 of the subject's damage onto the Oathsworn.)",
    },
    {
      id: 'bulwarkOfTheRealm', name: 'Bulwark of the Realm', units: BRENNA_IDS, classes: [], cost: BRENNA_BULWARK.cost,
      cooldown: BRENNA_BULWARK.cooldown, phase: 'defense', requires: { stance: 'hold' }, effect: { damageTaken: BRENNA_BULWARK.reduction },
      description: `Brenna. Requires Hold. Take ${BRENNA_BULWARK.reduction} less damage per strike this battle.`,
    },
    {
      id: 'oathkeepersStrike', name: "Oathkeeper's Strike", units: BRENNA_IDS, classes: [], cost: BRENNA_JUDGMENT.cost,
      cooldown: BRENNA_JUDGMENT.cooldown, phase: 'enhancement', requires: { target: true },
      effect: { damageDealt: BRENNA_JUDGMENT.bonus, hitBonus: BRENNA_JUDGMENT.hit },
      description: `Brenna. Requires a legal target. Her strike gains +${BRENNA_JUDGMENT.bonus} damage and +${BRENNA_JUDGMENT.hit} hit.`,
    },
  ],

  spells: {
    rallyBanner: {
      spell: {
        id: 'rallyBanner', name: 'Rally Banner', type: 'spell', cost: RALLY_BANNER.cost, target: 'friendly-unit', duration: 'upcoming-battle',
        // A spell status stores its `duration` as its value.
        effect: { type: 'status', status: 'damageTaken', duration: RALLY_BANNER.reduction },
      },
      card: {
        rarity: 'common',
        effect: `A friendly unit takes ${RALLY_BANNER.reduction} less damage per strike in the upcoming battle. `
          + '(Simplified: the design covers every friendly unit within 2 tiles.)',
      },
    },
  },

  pool: POOL,
};

export default ARGENT_CROWN;
