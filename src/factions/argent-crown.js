// The Argent Crown: blue and silver, Brenna's faction. A culture definition for registerCulture (src/cultures.js).
// NOTHING here registers by itself: import the default export and call registerCulture(ARGENT_CROWN) (tests, experiments,
// simulators), or registerArgentCrown() which also finishes the champion (see below). Every number is a named constant so it
// can be tuned in one place; all of them are PROTOTYPE DEFAULTS for paired-seed experiments, not balance decisions (Scott chooses).
// Design and results: docs/factions/ARGENT_CROWN.md. Source design: FACTIONS.md sections 1b and 4.
//
// Core idea: LINE DOCTRINE (the simple version, confirmed 2026-09-30): +1 Defense per adjacent friendly infantry unit, up to +2.
// It is a real Defense bonus: the passive adds the `equipDef` battle status, which the combat forecast already reads (src/match.js
// withEquip), so it behaves exactly like +Defense (Defense is subtracted before the crit multiplier, so a crit is reduced by 3 per
// point). The forecast UI does not show it, because statuses exist only during a battle. Every other reduction in this module uses
// the `damageTaken` status: "take N less damage per strike", applied after the crit multiplier and after Ward.
import { RECRUIT, CHAMPION_TEMPLATES } from '../roster.js';
import { registerCulture } from '../cultures.js';

// ---------------------------------------------------------------- Line Doctrine
export const LINE_DEFENSE_PER_ADJACENT = 1; // Defense per adjacent friendly infantry unit
export const LINE_CAP = 2;                    // most adjacent units that count (so +2 Defense at most)
// "Infantry" for Line Doctrine: every foot class (Brenna counts). Cavalry and unit-less objects do not. Cavalry can BENEFIT.
export const INFANTRY = ['pikeman', 'archer', 'bannerman', 'oathsworn', 'paladin']; // (a Crown Guard is a pikeman variant, so its class is 'pikeman')

// ---------------------------------------------------------------- units (stat deltas are relative to the shipped classes)
// Crown Guard (common): a sturdier, slower Pikeman. A VARIANT of the pikeman, so it keeps Rally and Brace and, with the Crown Pikeman, is the
// holder of Close Ranks (the kit is class-keyed, so plain Pikemen could select it too; see Engine requests: kits by variant).
export const GUARD_DELTA = { hp: +2, def: +1, mov: -1 };
export const GUARD_COST = 2;                  // Supply (Pikeman 1, Archer 2, Cavalier 3)
export const GUARD_STANCE = 'hold';           // default stance (Pikeman: advance)
export const SHIELDWALL_REDUCTION = 2;        // Crown Guard: damage less per strike while adjacent to friendly infantry (>= 1)
// Bannerman (uncommon): frail, buffs the line around it. A real new class because Hold the Standard must not reach other Pikemen (kits are class-keyed);
// the price is that it has no Rally or Brace.
export const BANNERMAN_DELTA = { hp: -4, str: -3 };
export const BANNERMAN_COST = 2;
export const BANNERMAN_STANCE = 'hold';
export const BANNER_RADIUS = 2;               // tiles (Manhattan)
export const BANNER_REDUCTION = 1;            // damage less per strike for friendly units in the radius...
export const BANNER_STANCES = ['hold', 'protect']; // ...that are Holding or Protecting
// Oathsworn (rare): heavy guard sworn to one subject. A real new class for the same reason (Interpose); no Rally or Brace.
export const OATHSWORN_DELTA = { hp: +4, str: 0, def: +3 };
export const OATHSWORN_COST = 3;
export const OATHSWORN_STANCE = 'hold';       // the player (or commander) sets Protect <subject> after recruiting
export const SWORN_RADIUS = 1;                // adjacent
export const SWORN_ALLY_REDUCTION = 2;        // damage less per strike for the units next to a Protecting Oathsworn (see Engine requests: should be the subject only)
export const SWORN_SELF_PENALTY = 2;          // damage MORE per strike taken by the Oathsworn itself while that holds
// Variants of the shipped classes: same stats as the base class, plus Line Doctrine.
export const CROWN_PIKE_COST = 1, CROWN_ARCHER_COST = 2, CROWN_CAVALIER_COST = 3; // same as the base cards

// ---------------------------------------------------------------- skills (kit abilities)
export const CLOSE_RANKS = { cost: 1, cooldown: 2, reduction: 2 };      // Crown Guard, defense phase
export const HOLD_STANDARD = { cost: 2, cooldown: 3, reduction: 2 };    // Bannerman, defense phase, needs Hold
export const INTERPOSE = { cost: 2, cooldown: 2, reduction: 4 };        // Oathsworn, defense phase, needs Protect
// ---------------------------------------------------------------- spell
export const RALLY_BANNER = { cost: 1, reduction: 3 };                  // common; one friendly unit takes this much less per strike this battle
// ---------------------------------------------------------------- champion: Brenna
// Same body as the shipped Brenna (src/roster.js UNITS); the kit and passives are the Crown's additions.
export const BRENNA_BULWARK = { cost: 2, cooldown: 3, reduction: 3 };   // Bulwark of the Realm: defense phase, needs Hold
export const BRENNA_JUDGMENT = { cost: 1, cooldown: 2, bonus: 3, hit: 10 }; // Oathkeeper's Strike: enhancement, needs a target
export const BRENNA_PRESENCE = { radius: 2, reduction: 1 };             // passive aura: friendly infantry within radius take this much less per strike
export const BRENNA_IDS = ['brenna', 'brennaCrown', 'brennaCrownB'];    // shipped id, the Crown champion, and a second copy for mirror matches

// ---------------------------------------------------------------- pool (per-side draw pool; repeats are weights)
// Commons from round 1; uncommon (Bannerman) from round 3 and rare (Oathsworn) from round 6 when the rarity gate is set.
// The shared spells Mend, Ward and Fireburst stay in the pool (FACTIONS.md 1b, "One faction per side"). Barrier is not drawn.
export const POOL = [
  'crownPike', 'crownPike', 'crownPike', 'crownGuard', 'crownGuard', 'crownArcher', 'crownArcher', 'crownCavalier',
  'bannerman', 'oathsworn',
  'mend', 'ward', 'fireburst', 'rallyBanner',
];

// ---------------------------------------------------------------- placeholder art (no binary assets): base sprite x tint
export const TINTS = { crownPike: '#9db8ea', crownArcher: '#9db8ea', crownCavalier: '#9db8ea', crownGuard: '#7f9fd6', bannerman: '#d7deef', oathsworn: '#eef1f8', brenna: '#ffffff' };

// ---------------------------------------------------------------- passives
const base = (cls, delta) => { const t = { ...RECRUIT[cls] }; for (const [k, d] of Object.entries(delta)) t[k] += d; return t; };
export const LINE_DOCTRINE = Object.freeze({
  id: 'lineDoctrine', when: { adjacentAlly: { classes: INFANTRY, min: 1 } }, perAdjacent: true, cap: LINE_CAP, effect: { equipDef: LINE_DEFENSE_PER_ADJACENT },
});
export const SHIELDWALL = Object.freeze({ id: 'shieldwall', when: { adjacentAlly: { classes: INFANTRY, min: 1 } }, effect: { damageTaken: SHIELDWALL_REDUCTION } });
export const BANNER = Object.freeze({ id: 'banner', aura: { radius: BANNER_RADIUS, stance: BANNER_STANCES }, effect: { damageTaken: BANNER_REDUCTION } });
// Sworn Guard is two passives: the ring of allies next to a Protecting Oathsworn are shielded, and the Oathsworn pays for it
// (a negative damageTaken is extra damage per strike). Both need at least one adjacent ally, so a lone Oathsworn is not penalised.
export const SWORN_GUARD_ALLIES = Object.freeze({ id: 'swornGuard', when: { stance: ['protect'], adjacentAlly: { min: 1 } }, aura: { radius: SWORN_RADIUS }, effect: { damageTaken: SWORN_ALLY_REDUCTION } });
export const SWORN_GUARD_SELF = Object.freeze({ id: 'swornGuardCost', when: { stance: ['protect'], adjacentAlly: { min: 1 } }, effect: { damageTaken: -SWORN_SELF_PENALTY } });
export const BRENNA_AURA = Object.freeze({ id: 'crownPresence', aura: { radius: BRENNA_PRESENCE.radius, classes: INFANTRY }, effect: { damageTaken: BRENNA_PRESENCE.reduction } });
/** Passives carried by Brenna (applied by registerArgentCrown, see below). */
export const BRENNA_PASSIVES = [LINE_DOCTRINE, BRENNA_AURA];

const bannerman = base('pikeman', BANNERMAN_DELTA), oath = base('pikeman', OATHSWORN_DELTA);
const stats = (t) => ({ hp: t.hp, str: t.str, skl: t.skl, spd: t.spd, def: t.def, res: t.res, mov: t.mov, lv: t.lv });

const ARGENT_CROWN = {
  id: 'crown',
  // New classes (real classes because kits are keyed by class): they reuse the Iron Pike weapon and move as foot.
  classes: {
    bannerman: { name: 'Bannerman', title: 'Standard-bearer', stats: stats(bannerman), weapon: 'Iron Pike', spriteBase: 'pikeman', tint: TINTS.bannerman, label: 'Bannerman',
      passives: [LINE_DOCTRINE, BANNER], description: 'Banner: friendly Hold/Protect units within 2 tiles take 1 less damage per strike.',
      card: { rarity: 'uncommon', cost: BANNERMAN_COST, class: 'Foot', range: 1, defaultStance: BANNERMAN_STANCE, population: 1 } },
    oathsworn: { name: 'Oathsworn', title: 'Sworn Guard', stats: stats(oath), weapon: 'Iron Pike', spriteBase: 'pikeman', tint: TINTS.oathsworn, label: 'Oathsworn',
      passives: [LINE_DOCTRINE, SWORN_GUARD_ALLIES, SWORN_GUARD_SELF], description: 'Sworn Guard: while Protecting, the allies beside it take 2 less damage per strike and it takes 2 more.',
      card: { rarity: 'rare', cost: OATHSWORN_COST, class: 'Foot', range: 1, defaultStance: OATHSWORN_STANCE, population: 1 } },
  },
  // Brenna, as a registered champion so she works on either side, respawns as herself and can be given passives (see registerArgentCrown).
  champions: {
    brennaCrown: { name: 'Brenna', title: 'Paladin', cls: 'paladin', faction: 'blue', tint: TINTS.brenna,
      stats: { hp: 28, str: 9, skl: 5, spd: 3, def: 13, res: 1, mov: 4, lv: 4 }, weapon: 'Iron Sword', look: { skin: '#f0cdb4', hair: '#c9b6e6', eyes: '#5a64c8', style: 'long' } },
    brennaCrownB: { name: 'Brenna', title: 'Paladin', cls: 'paladin', faction: 'red', tint: TINTS.brenna,
      stats: { hp: 28, str: 9, skl: 5, spd: 3, def: 13, res: 1, mov: 4, lv: 4 }, weapon: 'Iron Sword', look: { skin: '#f0cdb4', hair: '#c9b6e6', eyes: '#5a64c8', style: 'long' } },
  },
  // Variants of the shipped classes: identical stats, Line Doctrine only.
  variants: {
    crownGuard: { base: 'pikeman', name: 'Crown Guard', title: 'Line Infantry', delta: GUARD_DELTA, stats: { stance: GUARD_STANCE }, // stats.stance: how a variant sets its default stance on the unit (the card alone is not enough)
      tint: TINTS.crownGuard, passives: [LINE_DOCTRINE, SHIELDWALL],
      description: 'Holds the line. Shieldwall: takes 2 less damage per strike beside friendly infantry.', card: { rarity: 'common', cost: GUARD_COST, defaultStance: GUARD_STANCE } },
    crownPike: { base: 'pikeman', name: 'Crown Pikeman', title: 'Levy', tint: TINTS.crownPike, passives: [LINE_DOCTRINE], description: 'Line Doctrine: +1 Defense per adjacent friendly infantry (max +2).',
      card: { rarity: 'common', cost: CROWN_PIKE_COST } },
    crownArcher: { base: 'archer', name: 'Levy Archer', title: 'Levy', tint: TINTS.crownArcher, passives: [LINE_DOCTRINE], description: 'Line Doctrine: +1 Defense per adjacent friendly infantry (max +2).',
      card: { rarity: 'common', cost: CROWN_ARCHER_COST } },
    crownCavalier: { base: 'cavalier', name: 'Crown Knight', title: 'Nobility', tint: TINTS.crownCavalier, passives: [LINE_DOCTRINE], description: 'Line Doctrine: +1 Defense per adjacent friendly infantry (max +2).',
      card: { rarity: 'common', cost: CROWN_CAVALIER_COST } },
  },
  abilities: [
    { id: 'closeRanks', name: 'Close Ranks', classes: ['pikeman'], cost: CLOSE_RANKS.cost, cooldown: CLOSE_RANKS.cooldown, phase: 'defense',
      effect: { damageTaken: CLOSE_RANKS.reduction },
      description: `Pikeman class (Crown Pikeman, Crown Guard). Take ${CLOSE_RANKS.reduction} less damage per strike this battle. Does not force Hold. (Simplified: the design gives this to adjacent friendly infantry too.)` },
    { id: 'holdTheStandard', name: 'Hold the Standard', classes: ['bannerman'], cost: HOLD_STANDARD.cost, cooldown: HOLD_STANDARD.cooldown, phase: 'defense', requires: { stance: 'hold' },
      effect: { damageTaken: HOLD_STANDARD.reduction },
      description: `Requires Hold. Take ${HOLD_STANDARD.reduction} less damage per strike this battle. (Simplified: the design heals friendly units within 2 tiles by 6.)` },
    { id: 'interpose', name: 'Interpose', classes: ['oathsworn'], cost: INTERPOSE.cost, cooldown: INTERPOSE.cooldown, phase: 'defense', requires: { stance: 'protect' },
      effect: { damageTaken: INTERPOSE.reduction },
      description: `Requires Protect. Take ${INTERPOSE.reduction} less damage per strike this battle. (Simplified: the design moves up to 4 of the subject's damage onto the Oathsworn.)` },
    { id: 'bulwarkOfTheRealm', name: 'Bulwark of the Realm', units: BRENNA_IDS, classes: [], cost: BRENNA_BULWARK.cost, cooldown: BRENNA_BULWARK.cooldown, phase: 'defense', requires: { stance: 'hold' },
      effect: { damageTaken: BRENNA_BULWARK.reduction }, description: `Brenna. Requires Hold. Take ${BRENNA_BULWARK.reduction} less damage per strike this battle.` },
    { id: 'oathkeepersStrike', name: "Oathkeeper's Strike", units: BRENNA_IDS, classes: [], cost: BRENNA_JUDGMENT.cost, cooldown: BRENNA_JUDGMENT.cooldown, phase: 'enhancement', requires: { target: true },
      effect: { damageDealt: BRENNA_JUDGMENT.bonus, hitBonus: BRENNA_JUDGMENT.hit }, description: `Brenna. Requires a legal target. Her strike gains +${BRENNA_JUDGMENT.bonus} damage and +${BRENNA_JUDGMENT.hit} hit.` },
  ],
  spells: {
    rallyBanner: {
      spell: { id: 'rallyBanner', name: 'Rally Banner', type: 'spell', cost: RALLY_BANNER.cost, target: 'friendly-unit', duration: 'upcoming-battle',
        effect: { type: 'status', status: 'damageTaken', duration: RALLY_BANNER.reduction } }, // a spell status stores its `duration` as its value
      card: { rarity: 'common', effect: `A friendly unit takes ${RALLY_BANNER.reduction} less damage per strike in the upcoming battle. (Simplified: the design covers every friendly unit within 2 tiles.)` },
    },
  },
  pool: POOL,
};

export default ARGENT_CROWN;

/**
 * Register the culture and finish what registerCulture cannot express: a champion's passives. registerCulture copies no
 * `passives` onto a champion template, so Brenna's Line Doctrine and Crown's Presence are set on the registered template here
 * (createChampionUnit and the respawn path both clone it). Returns the registration record. Undo with resetCultures().
 */
export function registerArgentCrown() {
  const record = registerCulture(ARGENT_CROWN);
  for (const id of ['brennaCrown', 'brennaCrownB']) CHAMPION_TEMPLATES[id].passives = structuredClone(BRENNA_PASSIVES);
  return record;
}
