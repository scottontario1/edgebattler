// The White Fang Clans (FACTIONS.md section 5): heavily armoured northern clans, Dreg's culture. Iron, fur, animal teeth, axes and
// monster trophies. Principle: once momentum starts, keep it going. The clans want Advance stances, melee contact and aggressive
// positioning, and are mediocre at sitting on an objective (no Brace, no Rally, no healing, no bonus for holding).
//
// This module is data only: `registerCulture(whiteFang)` plugs it into the shared engine hooks (docs/CULTURE_HOOKS.md). Nothing here
// registers itself, so the shipped game is unchanged. Only tests, experiments and simulators register it.
//
// Every number below is a named constant with a comment. All values are PROTOTYPE DEFAULTS taken from FACTIONS.md section 5 where
// it gives one, and labelled "prototype default" where this module had to choose. Scott owns balance; nothing here is tuned.
//
//   import whiteFang from './factions/white-fang.js';           // the default definition
//   import { buildWhiteFang } from './factions/white-fang.js';  // the same with sensitivity options (experiments only)
//   registerCulture(whiteFang);  createMatch({ pools: { blue: culturePool('fang') }, champions: { blue: 'dreg' }, roster });
//
// Why real classes and not Pikeman variants: kits are keyed by class (`classes: [...]` in src/abilities.js). A Pikeman variant would
// inherit Rally (heal 10) and Brace (Hold and absorb 4), which the clans must not have. Reaver, Axeguard and Berserker are therefore
// classes with their own kit and their own placeholder sprite (the pikeman sprite, tinted). The Fang Hunter has no such conflict
// (Focused Shot is a fine archer skill), so it is a plain archer variant.
import { RECRUIT } from '../roster.js';

export const CULTURE_ID = 'fang';

// ---------- shared ----------
/** Weapon kind of the clan axes. It is NOT in the weapon triangle (BEATS in src/combat.js), so triangle bonuses are 0 and the only
 *  differences between a clan unit and its base class are the numbers below (prototype default; 'axe' would make the clans beat
 *  Pikemen +1 damage / +15 hit and lose to swords, an open question for Scott). */
export const NEUTRAL_WEAPON_KIND = 'fang';
/** Might, hit and crit of the clan axes: identical to the Iron Pike they replace. */
export const CLAN_AXE = Object.freeze({ mt: 8, hit: 75, crit: 0 });

// ---------- units (FACTIONS.md section 5 deltas against the Pikeman / Archer templates in src/roster.js) ----------
// White Fang Reaver (common): Str +1, Def -2, Mov +1.
export const REAVER = Object.freeze({ cost: 1 /* same as Pikeman */, hp: 0, str: +1, def: -2, mov: +1 });
/** Momentum: +2 damage on every strike if the Reaver moved this battle before attacking. */
export const MOMENTUM_DAMAGE = 2;
// Axeguard (uncommon): HP +4, Str 0, Def +1.
export const AXEGUARD = Object.freeze({ cost: 2 /* prototype default */, hp: +4, str: 0, def: +1, mov: 0 });
/** Bloodied Grit: +1 energy at the end of a battle in which the unit took damage (at most once per round). */
export const GRIT_ENERGY = 1;
// Berserker (rare): HP +2, Str +2, Def -4.
export const BERSERKER = Object.freeze({ cost: 2 /* prototype default */, hp: +2, str: +2, def: -4, mov: 0 });
/** Last Fang: below 50% HP (strictly), +2 Str, applied as +2 damage on every strike. */
export const LAST_FANG_BELOW = 0.5;
export const LAST_FANG_DAMAGE = 2;
// Fang Hunter (common archer variant; prototype default numbers, FACTIONS.md gives none): a glass archer that shoots on the run.
export const HUNTER = Object.freeze({ cost: 2 /* same as Archer */, hp: -2, str: +1, def: 0, mov: 0 });
/** Running Shot: if the Hunter moved this battle, +1 damage and +10 hit. */
export const RUNNING_SHOT_DAMAGE = 1;
export const RUNNING_SHOT_HIT = 10;

// ---------- skills (kit abilities, chosen in planning; rarity follows the unit that owns them) ----------
/** Reaving Rush (Reaver, common): 1 energy, cooldown 2, enhancement phase; needs Advance, movement and a target. */
export const REAVING_RUSH = Object.freeze({ cost: 1, cooldown: 2, damage: 2, ignoreDefense: 2 });
/** Iron Skin (Axeguard, uncommon): 1 energy, cooldown 2; takes 3 less damage per strike this battle; does not force Hold. */
export const IRON_SKIN = Object.freeze({ cost: 1, cooldown: 2, damageTaken: 3 });
/** Frenzy (Berserker, rare): 2 energy, cooldown 3; only below 50% HP: +4 damage per strike, and 2 more damage taken per strike
 *  (a negative damageTaken status). */
export const FRENZY = Object.freeze({ cost: 2, cooldown: 3, below: 0.5, damage: 4, extraTaken: 2 });

// ---------- Dreg's kit (champion; prototype default beyond Blood Challenge) ----------
/** Blood Challenge: 2 energy, cooldown 3, defense phase (before movement). Marks one enemy within 6 tiles: Dreg heads for it, deals +4
 *  against it and 4 LESS against anything else (Scott, 2026-09-30: mark plus penalty, not a hard lock). The engine adds `damageDealt` to
 *  every strike and subtracts `offTargetPenalty` from strikes on someone else, so the off-target penalty is bonus + 4 = 8. */
export const BLOOD_CHALLENGE = Object.freeze({ cost: 2, cooldown: 3, radius: 6, bonus: 4, offTargetNet: -4 });
/** Warlord's Rush (Dreg's second ability; prototype default): Reaving Rush for the champion, a little stronger. */
export const WARLORDS_RUSH = Object.freeze({ cost: 1, cooldown: 2, damage: 3, ignoreDefense: 3 });

// ---------- spells (existing shapes only: friendly-unit status; see docs/factions/WHITE_FANG.md, Engine requests) ----------
/** War Cry (common): FACTIONS.md wants +1 movement for Advance units; no movement status exists, so the closest shape is +15 hit
 *  (the same status Focused Shot uses) on one friendly unit. */
export const WAR_CRY = Object.freeze({ cost: 1, hit: 15 });
/** Blood Oath (common): FACTIONS.md wants 4 damage to the caster's target (cannot kill) for +3 damage; no spell can hurt a friendly
 *  unit, so it is +3 damage only, priced at 2 Supply instead of 1 to stand in for the missing HP cost (prototype default). */
export const BLOOD_OATH = Object.freeze({ cost: 2, damage: 3 });
/** Hunt (uncommon): FACTIONS.md wants an enemy mark giving nearby Advance units +2 hit against it; spells cannot target an enemy
 *  with a status, so the closest shape is: one friendly unit ignores 2 Defense this battle. */
export const HUNT = Object.freeze({ cost: 1, ignoreDefense: 2 });

// ---------- pool (repeated entries are draw weights; the shared spells Mend, Ward and Fireburst stay, Barrier does not) ----------
export const POOL = Object.freeze([
  'fangReaver', 'fangReaver', 'fangReaver', // common, the backbone
  'fangHunter', 'fangHunter',               // common
  'cavalier',                               // the plain Cavalier: Charge already is a momentum kit
  'fangAxeguard', 'fangAxeguard',           // uncommon (drawable from round 3)
  'wolfRider', 'fangShaman',                // uncommon: mounted flanker and caster (category system)
  'fangBerserker',                          // rare (from round 6)
  'warCry', 'bloodOath', 'hunt',
  'mend', 'ward', 'fireburst',
]);

// Placeholder tints multiplied onto the base sprite (the pikeman or archer sprite) until the supplied reference art (design_assets/factions/
// white_fang/*_sprite.png on the root branch) becomes runtime sprites. Palette from that art: iron grey plate, off-white wolf fur, brown
// leather, crimson only on the Berserker.
const TINT = Object.freeze({ reaver: '#B4B2AC' /* iron grey and wolf fur */, axeguard: '#7A828C' /* full iron plate */, berserker: '#B5382C' /* crimson war paint */, hunter: '#8C6B4F' /* brown leather */, rider: '#8A8F99' /* grey wolf-pelted mount */, shaman: '#6F8FA8' /* cold spirit-blue */ });

/**
 * Build the culture definition. `options` exist only for sensitivity experiments; the default export uses the defaults.
 *   weaponKind      weapon kind of the clan axes (default NEUTRAL_WEAPON_KIND; 'axe' switches the weapon triangle on)
 *   reaverMovDelta  Reaver Mov delta (default REAVER.mov = +1; note +1 does not change Advance movement, see WHITE_FANG.md)
 */
export function buildWhiteFang({ weaponKind = NEUTRAL_WEAPON_KIND, reaverMovDelta = REAVER.mov } = {}) {
  const P = RECRUIT.pikeman;
  const axe = (name) => ({ weapon: name, weaponDef: { mt: CLAN_AXE.mt, hit: CLAN_AXE.hit, crit: CLAN_AXE.crit, rng: [1, 1], kind: weaponKind } });
  const stats = (base, d) => ({ hp: base.hp + d.hp, str: base.str + d.str, skl: base.skl, spd: base.spd, def: base.def + d.def, mov: base.mov + d.mov });
  return {
    id: CULTURE_ID,
    classes: {
      fangReaver: { name: 'White Fang Reaver', title: 'Wolf-Pelt Raider', stats: stats(P, { ...REAVER, mov: reaverMovDelta }), ...axe('Fang Axe'), moveType: 'foot', spriteBase: 'pikeman', tint: TINT.reaver,
        passives: [{ id: 'momentum', when: { moved: true }, effect: { damageDealt: MOMENTUM_DAMAGE } }],
        card: { rarity: 'common', cost: REAVER.cost, class: 'Foot', range: 1, defaultStance: 'advance' },
        description: `Wolf-pelt cloak over riveted plate, bearded axe. Momentum: +${MOMENTUM_DAMAGE} damage if it moved before attacking. No Brace, no Rally.` },
      fangAxeguard: { name: 'Axeguard', title: 'Wolf Shield', stats: stats(P, AXEGUARD), ...axe('Wolf-Crest Axe'), moveType: 'foot', spriteBase: 'pikeman', tint: TINT.axeguard,
        passives: [{ id: 'bloodiedGrit', effect: { energyWhenStruck: GRIT_ENERGY } }],
        card: { rarity: 'uncommon', cost: AXEGUARD.cost, class: 'Foot', range: 1, defaultStance: 'advance' },
        description: `Bloodied Grit: +${GRIT_ENERGY} energy in a battle where it takes damage. Braces behind the wolf shield (Iron Skin) instead of Brace.` },
      fangBerserker: { name: 'Berserker', title: 'Scarred Veteran', stats: stats(P, BERSERKER), ...axe('Scarred Great Axe'), moveType: 'foot', spriteBase: 'pikeman', tint: TINT.berserker,
        passives: [{ id: 'lastFang', when: { hpBelow: LAST_FANG_BELOW }, effect: { damageDealt: LAST_FANG_DAMAGE } }],
        card: { rarity: 'rare', cost: BERSERKER.cost, class: 'Foot', range: 1, defaultStance: 'advance' },
        description: `Bare-chested glass cannon. Last Fang: below ${LAST_FANG_BELOW * 100}% HP, +${LAST_FANG_DAMAGE} Str. Frenzy when hurt.` },
      // Wolf Rider (NEW class, mounted): a raider on a shaggy northern warhorse. Momentum on horseback.
      wolfRider: { category: 'mounted', aiStance: 'advance', name: 'Wolf Rider', title: 'Fang Outrider', label: 'Wolf Rider',
        stats: { hp: 22, str: 8, skl: 5, spd: 8, def: 5, mov: 7 }, ...axe('Fang Spear'), moveType: 'mounted', spriteBase: 'cavalier', tint: TINT.rider,
        passives: [{ id: 'packCharge', when: { moved: true }, effect: { damageDealt: MOMENTUM_DAMAGE } }],
        card: { rarity: 'uncommon', cost: 3, class: 'Mounted', typeLabel: 'Mounted', range: 1, defaultStance: 'advance' },
        description: `Fast flanker. Pack Charge: +${MOMENTUM_DAMAGE} damage if it moved before attacking. Howling Charge adds a Charge-style bonus.` },
      // Fang Shaman (NEW class, caster): a spirit-caller with a totem staff (Mag against Res, reach 2). Wolf Spirit buffs the pack.
      fangShaman: { category: 'caster', name: 'Fang Shaman', title: 'Spirit-Caller', label: 'Fang Shaman',
        stats: { hp: 18, str: 3, mag: 8, skl: 5, spd: 5, def: 2, res: 5, mov: 4 }, weapon: 'Spirit Totem',
        weaponDef: { mt: 4, hit: 85, crit: 0, rng: [1, 2], kind: 'tome', magic: true }, spriteBase: 'archer', tint: TINT.shaman,
        card: { rarity: 'uncommon', cost: 3, class: 'Foot', range: 2, defaultStance: 'hold' },
        description: 'Frail spirit-caller. Wolf Spirit: friendly units within 2 tiles (and the Shaman) deal +2 damage this battle.' },
    },
    variants: {
      fangHunter: { base: 'archer', name: 'Fang Hunter', title: 'Trophy Hunter', delta: { hp: HUNTER.hp, str: HUNTER.str, def: HUNTER.def }, tint: TINT.hunter,
        // Workaround for engine issue 1 (docs/factions/WHITE_FANG.md): the recruit reserve carries the base class's stance (Archer: hold) and
        // overrides the card's defaultStance at deploy, so the variant template itself must say 'advance'.
        stats: { stance: 'advance' },
        passives: [{ id: 'runningShot', when: { moved: true }, effect: { damageDealt: RUNNING_SHOT_DAMAGE, hitBonus: RUNNING_SHOT_HIT } }],
        card: { rarity: 'common', cost: HUNTER.cost, defaultStance: 'advance' },
        description: `Antler-and-bone bow (cosmetic: it shoots as a Longbow). Running Shot: +${RUNNING_SHOT_DAMAGE} damage and +${RUNNING_SHOT_HIT} hit if it moved before shooting. Advances by default.` },
    },
    abilities: [
      { id: 'reavingRush', name: 'Reaving Rush', classes: ['fangReaver'], cost: REAVING_RUSH.cost, cooldown: REAVING_RUSH.cooldown, phase: 'enhancement',
        requires: { stance: 'advance', moved: 1, target: true }, effect: { damageDealt: REAVING_RUSH.damage, ignoreDefense: REAVING_RUSH.ignoreDefense },
        description: `Requires Advance, movement and a target: the strike gains +${REAVING_RUSH.damage} damage and ignores ${REAVING_RUSH.ignoreDefense} Defense.` },
      { id: 'ironSkin', name: 'Iron Skin', classes: ['fangAxeguard'], cost: IRON_SKIN.cost, cooldown: IRON_SKIN.cooldown, phase: 'defense',
        effect: { damageTaken: IRON_SKIN.damageTaken }, description: `Take ${IRON_SKIN.damageTaken} less damage from every strike this battle. Does not force Hold.` },
      { id: 'frenzy', name: 'Frenzy', classes: ['fangBerserker'], cost: FRENZY.cost, cooldown: FRENZY.cooldown, phase: 'enhancement',
        requires: { hpBelow: FRENZY.below }, effect: { damageDealt: FRENZY.damage, damageTaken: -FRENZY.extraTaken },
        description: `Only below ${FRENZY.below * 100}% HP: strikes gain +${FRENZY.damage} damage and the unit takes ${FRENZY.extraTaken} more damage per strike.` },
      { id: 'howlingCharge', name: 'Howling Charge', classes: ['wolfRider'], cost: 2, cooldown: 2, phase: 'enhancement',
        requires: { stance: 'advance', moved: 2, target: true }, effect: { damageDealt: 3 },
        description: 'Requires Advance, 2+ tiles of movement and a target: the strike gains +3 damage.' },
      { id: 'wolfSpirit', name: 'Wolf Spirit', classes: ['fangShaman'], cost: 2, cooldown: 3, phase: 'defense',
        grant: { radius: 2, self: true, statuses: { damageDealt: 2 } },
        description: 'Friendly units within 2 tiles, and the Shaman, deal +2 damage on every strike this battle.' },
      { id: 'bloodChallenge', name: 'Blood Challenge', units: ['dreg'], classes: [], cost: BLOOD_CHALLENGE.cost, cooldown: BLOOD_CHALLENGE.cooldown, phase: 'defense',
        mark: { radius: BLOOD_CHALLENGE.radius }, effect: { damageDealt: BLOOD_CHALLENGE.bonus, offTargetPenalty: BLOOD_CHALLENGE.bonus - BLOOD_CHALLENGE.offTargetNet },
        description: `Mark one enemy within ${BLOOD_CHALLENGE.radius} tiles: Dreg heads for it, deals +${BLOOD_CHALLENGE.bonus} damage to it and ${-BLOOD_CHALLENGE.offTargetNet} less to anything else. Not a hard lock.` },
      { id: 'warlordsRush', name: "Warlord's Rush", units: ['dreg'], classes: [], cost: WARLORDS_RUSH.cost, cooldown: WARLORDS_RUSH.cooldown, phase: 'enhancement',
        requires: { stance: 'advance', moved: 1, target: true }, effect: { damageDealt: WARLORDS_RUSH.damage, ignoreDefense: WARLORDS_RUSH.ignoreDefense },
        description: `Requires Advance, movement and a target: the strike gains +${WARLORDS_RUSH.damage} damage and ignores ${WARLORDS_RUSH.ignoreDefense} Defense.` },
    ],
    spells: {
      warCry: { spell: { id: 'warCry', name: 'War Cry', type: 'spell', cost: WAR_CRY.cost, target: 'friendly-unit', duration: 'upcoming-battle', effect: { type: 'status', status: 'hitBonus', duration: WAR_CRY.hit } },
        card: { rarity: 'common', effect: `A friendly unit gets +${WAR_CRY.hit} hit in the upcoming battle.` } },
      bloodOath: { spell: { id: 'bloodOath', name: 'Blood Oath', type: 'spell', cost: BLOOD_OATH.cost, target: 'friendly-unit', duration: 'upcoming-battle', effect: { type: 'status', status: 'damageDealt', duration: BLOOD_OATH.damage } },
        card: { rarity: 'common', effect: `A friendly unit deals +${BLOOD_OATH.damage} damage on every strike in the upcoming battle.` } },
      hunt: { spell: { id: 'hunt', name: 'Hunt', type: 'spell', cost: HUNT.cost, target: 'friendly-unit', duration: 'upcoming-battle', effect: { type: 'status', status: 'ignoreDefense', duration: HUNT.ignoreDefense } },
        card: { rarity: 'uncommon', effect: `A friendly unit ignores ${HUNT.ignoreDefense} Defense in the upcoming battle.` } },
    },
    pool: [...POOL],
  };
}

export default buildWhiteFang();
