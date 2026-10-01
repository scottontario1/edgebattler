// The White Fang Clans (FACTIONS.md section 5): heavily armoured northern clans, Dreg's culture. Iron,
// fur, animal teeth, axes and monster trophies. Principle: once momentum starts, keep it going. The
// clans want Advance stances and melee contact, and are mediocre at sitting on an objective.
//
// A culture definition (schema: src/core/setup/cultures.js). Numbers are prototype defaults taken
// from FACTIONS.md section 5 where it gives one and labelled otherwise. Ability and spell records are
// inert catalogue data in this pass (skills and spells are archived).
//
// Reaver, Axeguard and Berserker are real classes, not Pikeman variants: kits are keyed by class and
// a variant would inherit Rally and Brace, which the clans must not have.
import { RECRUIT_CLASSES, HEROES } from '../classes.js';

export const CULTURE_ID = 'fang';

/** Dreg is the shipped Red champion. When the clans play Blue they need a second Dreg: this copy. */
export const DREG_BLUE = 'dregBlue';

// ---------- shared ----------
/** Weapon kind of the clan axes. It is NOT in the weapon triangle, so triangle bonuses are 0. */
export const NEUTRAL_WEAPON_KIND = 'fang';
/** Might, hit and crit of the clan axes: identical to the Iron Pike they replace. */
export const CLAN_AXE = Object.freeze({ mt: 8, hit: 75, crit: 0 });

// ---------- units (deltas against the Pikeman / Archer templates) ----------
export const REAVER = Object.freeze({ cost: 1, hp: 0, str: +1, def: -2, mov: +1 });
/** Momentum: +2 damage on every strike if the Reaver moved this battle before attacking. */
export const MOMENTUM_DAMAGE = 2;
export const AXEGUARD = Object.freeze({ cost: 2, hp: +4, str: 0, def: +1, mov: 0 });
/** Bloodied Grit: +1 energy at the end of a battle in which the unit took damage. */
export const GRIT_ENERGY = 1;
export const BERSERKER = Object.freeze({ cost: 2, hp: +2, str: +2, def: -4, mov: 0 });
/** Last Fang: below 50% HP (strictly), +2 damage on every strike. */
export const LAST_FANG_BELOW = 0.5;
export const LAST_FANG_DAMAGE = 2;
export const HUNTER = Object.freeze({ cost: 2, hp: -2, str: +1, def: 0, mov: 0 });
/** Running Shot: if the Hunter moved this battle, +1 damage and +10 hit. */
export const RUNNING_SHOT_DAMAGE = 1;
export const RUNNING_SHOT_HIT = 10;

// ---------- skills ----------
export const REAVING_RUSH = Object.freeze({ cost: 1, cooldown: 2, damage: 2, ignoreDefense: 2 });
export const IRON_SKIN = Object.freeze({ cost: 1, cooldown: 2, damageTaken: 3 });
export const FRENZY = Object.freeze({ cost: 2, cooldown: 3, below: 0.5, damage: 4, extraTaken: 2 });
/** Blood Challenge marks one enemy: Dreg deals +4 against it and 4 LESS against anything else (so the off-target penalty is 8). */
export const BLOOD_CHALLENGE = Object.freeze({ cost: 2, cooldown: 3, radius: 6, bonus: 4, offTargetNet: -4 });
export const WARLORDS_RUSH = Object.freeze({ cost: 1, cooldown: 2, damage: 3, ignoreDefense: 3 });

// ---------- spells ----------
export const WAR_CRY = Object.freeze({ cost: 1, hit: 15 });
export const BLOOD_OATH = Object.freeze({ cost: 2, damage: 3 });
export const HUNT = Object.freeze({ cost: 1, ignoreDefense: 2 });

/** Draw pool; repeated entries are weights. */
export const POOL = Object.freeze([
  'fangReaver', 'fangReaver', 'fangReaver',
  'fangHunter', 'fangHunter',
  'cavalier',
  'fangAxeguard', 'fangAxeguard',
  'wolfRider', 'fangShaman',
  'fangBerserker',
  'warCry', 'bloodOath', 'hunt',
  'mend', 'ward', 'fireburst',
]);

/** Placeholder tints multiplied onto the base sprite. */
export const TINT = Object.freeze({
  reaver: '#B4B2AC',
  axeguard: '#7A828C',
  berserker: '#B5382C',
  hunter: '#8C6B4F',
  rider: '#8A8F99',
  shaman: '#6F8FA8',
});

/**
 * Build the culture definition. `options` exist only for sensitivity experiments.
 * @param {object} [options]
 * @param {string} [options.weaponKind]      weapon kind of the clan axes ('axe' switches the triangle on)
 * @param {number} [options.reaverMovDelta]  Reaver Mov delta
 */
export function buildWhiteFang({ weaponKind = NEUTRAL_WEAPON_KIND, reaverMovDelta = REAVER.mov } = {}) {
  const pikeman = RECRUIT_CLASSES.pikeman;
  const axe = (name) => ({
    weapon: name,
    weaponDef: { mt: CLAN_AXE.mt, hit: CLAN_AXE.hit, crit: CLAN_AXE.crit, rng: [1, 1], kind: weaponKind },
  });
  const stats = (base, d) => ({
    hp: base.hp + d.hp, str: base.str + d.str, skl: base.skl, spd: base.spd, def: base.def + d.def, mov: base.mov + d.mov,
  });

  return {
    id: CULTURE_ID,

    classes: {
      fangReaver: {
        name: 'White Fang Reaver', title: 'Wolf-Pelt Raider', stats: stats(pikeman, { ...REAVER, mov: reaverMovDelta }), ...axe('Fang Axe'),
        moveType: 'foot', spriteBase: 'pikeman', tint: TINT.reaver,
        passives: [{ id: 'momentum', when: { moved: true }, effect: { damageDealt: MOMENTUM_DAMAGE } }],
        card: { rarity: 'common', cost: REAVER.cost, class: 'Foot', range: 1, defaultStance: 'advance' },
        description: `Wolf-pelt cloak over riveted plate, bearded axe. Momentum: +${MOMENTUM_DAMAGE} damage if it moved before attacking. No Brace, no Rally.`,
      },
      fangAxeguard: {
        name: 'Axeguard', title: 'Wolf Shield', stats: stats(pikeman, AXEGUARD), ...axe('Wolf-Crest Axe'),
        moveType: 'foot', spriteBase: 'pikeman', tint: TINT.axeguard,
        passives: [{ id: 'bloodiedGrit', effect: { energyWhenStruck: GRIT_ENERGY } }],
        card: { rarity: 'uncommon', cost: AXEGUARD.cost, class: 'Foot', range: 1, defaultStance: 'advance' },
        description: `Bloodied Grit: +${GRIT_ENERGY} energy in a battle where it takes damage. Braces behind the wolf shield (Iron Skin) instead of Brace.`,
      },
      fangBerserker: {
        name: 'Berserker', title: 'Scarred Veteran', stats: stats(pikeman, BERSERKER), ...axe('Scarred Great Axe'),
        moveType: 'foot', spriteBase: 'pikeman', tint: TINT.berserker,
        passives: [{ id: 'lastFang', when: { hpBelow: LAST_FANG_BELOW }, effect: { damageDealt: LAST_FANG_DAMAGE } }],
        card: { rarity: 'rare', cost: BERSERKER.cost, class: 'Foot', range: 1, defaultStance: 'advance' },
        description: `Bare-chested glass cannon. Last Fang: below ${LAST_FANG_BELOW * 100}% HP, +${LAST_FANG_DAMAGE} Str. Frenzy when hurt.`,
      },
      // A raider on a shaggy northern warhorse: momentum on horseback.
      wolfRider: {
        category: 'mounted', aiStance: 'advance', name: 'Wolf Rider', title: 'Fang Outrider', label: 'Wolf Rider',
        stats: { hp: 22, str: 8, skl: 5, spd: 8, def: 5, mov: 7 }, ...axe('Fang Spear'),
        moveType: 'mounted', spriteBase: 'cavalier', tint: TINT.rider,
        passives: [{ id: 'packCharge', when: { moved: true }, effect: { damageDealt: MOMENTUM_DAMAGE } }],
        card: { rarity: 'uncommon', cost: 3, class: 'Mounted', typeLabel: 'Mounted', range: 1, defaultStance: 'advance' },
        description: `Fast flanker. Pack Charge: +${MOMENTUM_DAMAGE} damage if it moved before attacking. Howling Charge adds a Charge-style bonus.`,
      },
      // A spirit-caller with a totem staff (Mag against Res, reach 2).
      fangShaman: {
        category: 'caster', name: 'Fang Shaman', title: 'Spirit-Caller', label: 'Fang Shaman',
        stats: { hp: 18, str: 3, mag: 8, skl: 5, spd: 5, def: 2, res: 5, mov: 4 }, weapon: 'Spirit Totem',
        weaponDef: { mt: 4, hit: 85, crit: 0, rng: [1, 2], kind: 'tome', magic: true }, spriteBase: 'archer', tint: TINT.shaman,
        card: { rarity: 'uncommon', cost: 3, class: 'Foot', range: 2, defaultStance: 'hold' },
        description: 'Frail spirit-caller. Wolf Spirit: friendly units within 2 tiles (and the Shaman) deal +2 damage this battle.',
      },
    },

    variants: {
      fangHunter: {
        base: 'archer', name: 'Fang Hunter', title: 'Trophy Hunter', delta: { hp: HUNTER.hp, str: HUNTER.str, def: HUNTER.def }, tint: TINT.hunter,
        // The recruit reserve carries the base class's stance (Archer: hold) and overrides the card's
        // defaultStance at deploy, so the variant template itself must say 'advance'.
        stats: { stance: 'advance' },
        passives: [{ id: 'runningShot', when: { moved: true }, effect: { damageDealt: RUNNING_SHOT_DAMAGE, hitBonus: RUNNING_SHOT_HIT } }],
        card: { rarity: 'common', cost: HUNTER.cost, defaultStance: 'advance' },
        description: `Antler-and-bone bow (cosmetic: it shoots as a Longbow). Running Shot: +${RUNNING_SHOT_DAMAGE} damage and +${RUNNING_SHOT_HIT} hit if it moved before shooting. Advances by default.`,
      },
    },

    // The blue copy of Dreg: a full unit template registered as-is (not built from stats), so both
    // sides can field a champion when the clans play Blue.
    championTemplates: {
      [DREG_BLUE]: { ...HEROES.dreg, id: DREG_BLUE, faction: 'blue', champion: true, culture: CULTURE_ID },
    },

    abilities: [
      {
        id: 'reavingRush', name: 'Reaving Rush', classes: ['fangReaver'], cost: REAVING_RUSH.cost, cooldown: REAVING_RUSH.cooldown, phase: 'enhancement',
        requires: { stance: 'advance', moved: 1, target: true }, effect: { damageDealt: REAVING_RUSH.damage, ignoreDefense: REAVING_RUSH.ignoreDefense },
        description: `Requires Advance, movement and a target: the strike gains +${REAVING_RUSH.damage} damage and ignores ${REAVING_RUSH.ignoreDefense} Defense.`,
      },
      {
        id: 'ironSkin', name: 'Iron Skin', classes: ['fangAxeguard'], cost: IRON_SKIN.cost, cooldown: IRON_SKIN.cooldown, phase: 'defense',
        effect: { damageTaken: IRON_SKIN.damageTaken },
        description: `Take ${IRON_SKIN.damageTaken} less damage from every strike this battle. Does not force Hold.`,
      },
      {
        id: 'frenzy', name: 'Frenzy', classes: ['fangBerserker'], cost: FRENZY.cost, cooldown: FRENZY.cooldown, phase: 'enhancement',
        requires: { hpBelow: FRENZY.below }, effect: { damageDealt: FRENZY.damage, damageTaken: -FRENZY.extraTaken },
        description: `Only below ${FRENZY.below * 100}% HP: strikes gain +${FRENZY.damage} damage and the unit takes ${FRENZY.extraTaken} more damage per strike.`,
      },
      {
        id: 'howlingCharge', name: 'Howling Charge', classes: ['wolfRider'], cost: 2, cooldown: 2, phase: 'enhancement',
        requires: { stance: 'advance', moved: 2, target: true }, effect: { damageDealt: 3 },
        description: 'Requires Advance, 2+ tiles of movement and a target: the strike gains +3 damage.',
      },
      {
        id: 'wolfSpirit', name: 'Wolf Spirit', classes: ['fangShaman'], cost: 2, cooldown: 3, phase: 'defense',
        grant: { radius: 2, self: true, statuses: { damageDealt: 2 } },
        description: 'Friendly units within 2 tiles, and the Shaman, deal +2 damage on every strike this battle.',
      },
      {
        id: 'bloodChallenge', name: 'Blood Challenge', units: ['dreg', DREG_BLUE], classes: [], cost: BLOOD_CHALLENGE.cost,
        cooldown: BLOOD_CHALLENGE.cooldown, phase: 'defense', mark: { radius: BLOOD_CHALLENGE.radius },
        effect: { damageDealt: BLOOD_CHALLENGE.bonus, offTargetPenalty: BLOOD_CHALLENGE.bonus - BLOOD_CHALLENGE.offTargetNet },
        description: `Mark one enemy within ${BLOOD_CHALLENGE.radius} tiles: Dreg heads for it, deals +${BLOOD_CHALLENGE.bonus} damage to it and ${-BLOOD_CHALLENGE.offTargetNet} less to anything else. Not a hard lock.`,
      },
      {
        id: 'warlordsRush', name: "Warlord's Rush", units: ['dreg', DREG_BLUE], classes: [], cost: WARLORDS_RUSH.cost, cooldown: WARLORDS_RUSH.cooldown,
        phase: 'enhancement', requires: { stance: 'advance', moved: 1, target: true },
        effect: { damageDealt: WARLORDS_RUSH.damage, ignoreDefense: WARLORDS_RUSH.ignoreDefense },
        description: `Requires Advance, movement and a target: the strike gains +${WARLORDS_RUSH.damage} damage and ignores ${WARLORDS_RUSH.ignoreDefense} Defense.`,
      },
    ],

    spells: {
      warCry: {
        spell: {
          id: 'warCry', name: 'War Cry', type: 'spell', cost: WAR_CRY.cost, target: 'friendly-unit', duration: 'upcoming-battle',
          effect: { type: 'status', status: 'hitBonus', duration: WAR_CRY.hit },
        },
        card: { rarity: 'common', effect: `A friendly unit gets +${WAR_CRY.hit} hit in the upcoming battle.` },
      },
      bloodOath: {
        spell: {
          id: 'bloodOath', name: 'Blood Oath', type: 'spell', cost: BLOOD_OATH.cost, target: 'friendly-unit', duration: 'upcoming-battle',
          effect: { type: 'status', status: 'damageDealt', duration: BLOOD_OATH.damage },
        },
        card: { rarity: 'common', effect: `A friendly unit deals +${BLOOD_OATH.damage} damage on every strike in the upcoming battle.` },
      },
      hunt: {
        spell: {
          id: 'hunt', name: 'Hunt', type: 'spell', cost: HUNT.cost, target: 'friendly-unit', duration: 'upcoming-battle',
          effect: { type: 'status', status: 'ignoreDefense', duration: HUNT.ignoreDefense },
        },
        card: { rarity: 'uncommon', effect: `A friendly unit ignores ${HUNT.ignoreDefense} Defense in the upcoming battle.` },
      },
    },

    pool: [...POOL],
  };
}

export default buildWhiteFang();
