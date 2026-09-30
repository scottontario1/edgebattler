// The Iron League: a culture definition for registerCulture (src/cultures.js). Nothing here registers itself; tests,
// experiments and simulators call registerCulture(ironLeague) and hand each side its pool through createMatch({ pools }).
//
// Flavour (not a rule, not setting canon): free cities, merchant princes and mercenary companies fielding salvaged remnants
// of a fallen technological age. Brass, bronze and green patina, patched and hand-repaired, officially non-magical ("craft").
// Mechanical identity: PREPARATION (holding still converts into bonuses), a KILLING GROUND on a road or bridge (Pikemen in
// front, Pavise Guards behind, Crossbowmen at the rear), fantastic skills and deliberately mediocre spells.
//
// Only existing engine hooks are used (docs/CULTURE_HOOKS.md). Where a hook is missing the closest simpler mechanic is used and
// the gap is written up in docs/factions/IRON_LEAGUE.md under "Engine requests". Every number below is a named constant.
// All numbers are PROTOTYPE starting values for paired-seed experiments, not tuned defaults: Scott chooses.

// ---------- numbers (every one commented) ----------
export const IRON_LEAGUE = Object.freeze({
  id: 'league',

  // League Pikeman (variant of Pikeman): the front of the killing ground. Stats are the plain Pikeman's.
  PIKE_COST: 1,                     // Supply (same as Pikeman)
  PIKE_HOLD_DAMAGE: 1,              // Planted Pike: +1 damage per strike while holding and unmoved

  // Pavise Guard (variant of Pikeman; FACTIONS.md 6: HP +1, Def +2, Str -2, Mov -1)
  PAVISE_HP: 1, PAVISE_DEF: 2, PAVISE_STR: -2, PAVISE_MOV: -1,
  PAVISE_COST: 2,                   // Supply (a Pikeman is 1; the wall-with-a-shield-aura is worth a second point)
  SET_SHIELD_REDUCTION: 2,          // Set Shield: damage less per strike for adjacent friendly Archers/Crossbowmen (see ENGINE REQUEST: all strikes, not ranged only)
  SET_SHIELD_RADIUS: 1,             // adjacent tiles (Manhattan)

  // Coil Crossbowman (variant of Archer, uncommon). Stats are the plain Archer's.
  COIL_COST: 2,                     // Supply (same as Archer)
  PREPARED_SHOT_DAMAGE: 3,          // Prepared Shot passive, while holding: +3 damage per strike (spec 4; reduced because it is always on while Hold, see doc)
  PREPARED_SHOT_HIT: 15,            // ... and +15 hit (spec 20)

  // Relic Walker (NEW class, rare): slow armoured salvaged machine with a short-range coil weapon that reaches 2 tiles.
  WALKER_HP: 30, WALKER_STR: 7, WALKER_SKL: 4, WALKER_SPD: 2, WALKER_DEF: 10, WALKER_MOV: 3,
  WALKER_COST: 4,                   // Supply
  WALKER_WEAPON: { mt: 6, hit: 70, crit: 0, rng: [1, 2], kind: 'coil' }, // 'coil' is not in the weapon triangle: no triangle bonus either way
  WEAR_HP_FRACTION: 0.5,            // Wear: below this fraction of max HP ...
  WEAR_DAMAGE: -2,                  // ... it deals 2 less damage per strike (spec: loses 1 Mov; passives cannot change Mov, see doc)
  WEAR_HIT: -10,                    // ... and -10 hit

  // Sapper (NEW class, uncommon; chosen over "a skill any unit carries", labelled default): digs the barricade.
  SAPPER_HP: 20, SAPPER_STR: 6, SAPPER_SKL: 5, SAPPER_SPD: 5, SAPPER_DEF: 6, SAPPER_MOV: 4,
  SAPPER_COST: 2,                   // Supply
  SAPPER_WEAPON: { mt: 6, hit: 70, crit: 0, rng: [1, 1], kind: 'pick' },
  BARRICADE_HP: 10,                 // tile object (Scott 2026-09-30: 10 HP, no healing)
  BARRICADE_DECAY: 4,               // rounds a barricade lasts if nothing destroys it (labelled default; null would be until destroyed)

  // Skills (kit abilities: cost is energy, cooldown is rounds, counting the round of use)
  SET_POSITION_COST: 1, SET_POSITION_COOLDOWN: 2, SET_POSITION_REDUCTION: 2, // Pikeman family, Hold: take 2 less damage per strike (stacks with Brace and Set Shield)
  PREPARED_POSITION_COST: 1, PREPARED_POSITION_COOLDOWN: 2, PREPARED_POSITION_DAMAGE: 2, // Archer family, Hold: shot gains +2 more damage
  ARC_BURST_COST: 3, ARC_BURST_BASE_COOLDOWN: 3,
  OVERHEAT_COOLDOWN: 1,             // Overheat: Arc Burst's cooldown is extended by this (deterministic, never a chance)
  ARC_BURST_IGNORE_DEF: 3,          // ignores up to 3 Defense
  ARC_BURST_DAMAGE: 3,              // +3 damage (my addition to the spec, which had only the Defense ignore; 3 Energy and Overheat need a payoff)
  OVERHEAT_VULNERABLE: 2,           // Overheat drawback: takes 2 more damage per strike this battle (spec: 3 self-damage; no self-damage hook, see doc)
  DIG_IN_COST: 1, DIG_IN_COOLDOWN: 2,

  // Spells (mediocre by design; existing spell shapes and statuses only)
  FIELD_REPAIR_COST: 0, FIELD_REPAIR_HEAL: 4, // Field Repair: free, heals 4 (Mend is 1 Supply for 8)
  FLARE_COST: 1, FLARE_HIT: 20,     // Flare: one friendly unit gets +20 hit for the upcoming battle (spec: mark an enemy; no such shape, see doc)

  // Champion options (provisional; the first is the default, Scott chooses)
  CAPTAIN: { hp: 30, str: 9, skl: 6, spd: 4, def: 12, mov: 4 },
  FIELD_WORKS_COST: 2, FIELD_WORKS_COOLDOWN: 3, FIELD_WORKS_REDUCTION: 2,
  ENGINEER: { hp: 22, str: 7, skl: 8, spd: 5, def: 6, mov: 4 },
  OVERCHARGE_COST: 3, OVERCHARGE_COOLDOWN: 4, OVERCHARGE_IGNORE_DEF: 4, OVERCHARGE_DAMAGE: 4, OVERCHARGE_VULNERABLE: 2,
  BULWARK_CHAMPION: { hp: 36, str: 8, skl: 4, spd: 2, def: 12, mov: 3 },
  IRONBOUND_COST: 2, IRONBOUND_COOLDOWN: 3, IRONBOUND_REDUCTION: 4,
});
const N = IRON_LEAGUE;

// Placeholder art (tint over the borrowed base sprite; no new binary assets): brass, bronze, patina, rust.
const TINT = { pike: '#6F8F7A', pavise: '#8C7A4A', coil: '#4E8F7A', walker: '#B08A3C', sapper: '#9A6A3A', champion: '#C9A24A' };

export const DEFAULT_LEAGUE_CHAMPION = 'ilseVoss'; // PROVISIONAL default: Scott chooses among ilseVoss, tobiahKettle, oldSixty

const ironLeague = {
  id: N.id,

  classes: {
    relicWalker: {
      name: 'Relic Walker', title: 'Salvaged machine',
      stats: { hp: N.WALKER_HP, str: N.WALKER_STR, skl: N.WALKER_SKL, spd: N.WALKER_SPD, def: N.WALKER_DEF, mov: N.WALKER_MOV },
      weapon: 'Relic Coil', weaponDef: N.WALKER_WEAPON, moveType: 'armor', spriteBase: 'pikeman', tint: TINT.walker, label: 'Relic Walker',
      passives: [{ id: 'wear', when: { hpBelow: N.WEAR_HP_FRACTION }, effect: { damageDealt: N.WEAR_DAMAGE, hitBonus: N.WEAR_HIT } }],
      description: 'Slow, sturdy, reaches 2 tiles. Wear: below half HP it deals 2 less damage and -10 hit (Field Repair mends it).',
      card: { rarity: 'rare', cost: N.WALKER_COST, class: 'Armor', range: 2, defaultStance: 'hold' },
    },
    sapper: {
      name: 'Sapper', title: 'League engineer',
      stats: { hp: N.SAPPER_HP, str: N.SAPPER_STR, skl: N.SAPPER_SKL, spd: N.SAPPER_SPD, def: N.SAPPER_DEF, mov: N.SAPPER_MOV },
      weapon: 'League Sapper Pick', weaponDef: N.SAPPER_WEAPON, spriteBase: 'pikeman', tint: TINT.sapper, label: 'Sapper',
      description: 'Digs a barricade (10 HP, blocks enemy movement) on the tile it faces while holding.',
      card: { rarity: 'uncommon', cost: N.SAPPER_COST, class: 'Foot', range: 1, defaultStance: 'hold' },
    },
  },

  variants: {
    leaguePike: {
      base: 'pikeman', name: 'League Pikeman', title: 'Free-city pikeman', tint: TINT.pike,
      delta: {},
      passives: [{ id: 'plantedPike', when: { stance: ['hold'], moved: false }, effect: { damageDealt: N.PIKE_HOLD_DAMAGE } }],
      description: 'Planted Pike: +1 damage per strike while holding and unmoved.',
      card: { rarity: 'common', cost: N.PIKE_COST, defaultStance: 'hold' },
    },
    pavise: {
      base: 'pikeman', name: 'Pavise Guard', title: 'Shield-bearer', tint: TINT.pavise,
      delta: { hp: N.PAVISE_HP, def: N.PAVISE_DEF, str: N.PAVISE_STR, mov: N.PAVISE_MOV },
      // Set Shield: while it did not move, adjacent friendly Archers/Crossbowmen (cls archer) take less damage per strike.
      passives: [{ id: 'setShield', when: { moved: false }, aura: { radius: N.SET_SHIELD_RADIUS, classes: ['archer'] }, effect: { damageTaken: N.SET_SHIELD_REDUCTION } }],
      description: 'Set Shield: if it did not move, adjacent friendly Archers and Crossbowmen take 2 less damage per strike.',
      card: { rarity: 'common', cost: N.PAVISE_COST, defaultStance: 'hold' },
    },
    coil: {
      base: 'archer', name: 'Coil Crossbowman', title: 'Coil-crossbow', tint: TINT.coil,
      delta: {},
      passives: [{ id: 'preparedShot', when: { stance: ['hold'], moved: false }, effect: { damageDealt: N.PREPARED_SHOT_DAMAGE, hitBonus: N.PREPARED_SHOT_HIT } }],
      description: 'Prepared Shot: while holding and unmoved, +3 damage and +15 hit per strike.',
      card: { rarity: 'uncommon', cost: N.COIL_COST, defaultStance: 'hold' },
    },
  },

  champions: {
    // OPTION 1 (PROVISIONAL DEFAULT): a mercenary captain who fortifies where she stands.
    ilseVoss: { name: 'Captain Ilse Voss', title: 'Condottiera', cls: 'pikeman', stats: N.CAPTAIN, weapon: 'Steel Lance', tint: TINT.champion, spriteBase: 'pikeman',
      look: { skin: '#d9a57c', hair: '#3a2a1e', eyes: '#4a6a4a', style: 'short' } },
    // OPTION 2: a guild engineer who overcharges her coil (Overheat).
    tobiahKettle: { name: 'Master Tobiah Kettle', title: 'Guild engineer', cls: 'archer', stats: N.ENGINEER, weapon: 'Steel Bow', tint: TINT.champion, spriteBase: 'archer',
      look: { skin: '#e0b090', hair: '#7a5a3a', eyes: '#3a2a1a', style: 'short', beard: true } },
    // OPTION 3: the old walking bulwark of a free city, a Relic Walker champion.
    oldSixty: { name: 'Old Sixty', title: 'City bulwark', cls: 'relicWalker', stats: N.BULWARK_CHAMPION, tint: TINT.champion, spriteBase: 'pikeman',
      look: { skin: '#b08a3c', hair: '#4E8F7A', eyes: '#f0d070', style: 'short' } },
  },

  // `culture: 'league'` documents whose skill it is. abilityApplies() does not read it yet (ENGINE REQUEST: culture filter),
  // so League skills currently also apply to the plain Pikemen/Archers of the other side; no AI picks them.
  abilities: [
    { id: 'setPosition', name: 'Set Position', culture: N.id, rarity: 'common', classes: ['pikeman'], cost: N.SET_POSITION_COST, cooldown: N.SET_POSITION_COOLDOWN, phase: 'defense',
      requires: { stance: 'hold' }, effect: { damageTaken: N.SET_POSITION_REDUCTION },
      description: 'Requires Hold. Take 2 less damage per strike this battle; stacks with Brace and Set Shield.' },
    { id: 'preparedPosition', name: 'Prepared Position', culture: N.id, rarity: 'uncommon', classes: ['archer'], cost: N.PREPARED_POSITION_COST, cooldown: N.PREPARED_POSITION_COOLDOWN, phase: 'enhancement',
      requires: { stance: 'hold', target: true }, effect: { damageDealt: N.PREPARED_POSITION_DAMAGE },
      description: 'Requires Hold and a legal target. The shot gains +2 damage on top of Prepared Shot. Does nothing if the unit moved.' },
    { id: 'arcBurst', name: 'Arc Burst', culture: N.id, rarity: 'rare', classes: ['relicWalker'], cost: N.ARC_BURST_COST, cooldown: N.ARC_BURST_BASE_COOLDOWN + N.OVERHEAT_COOLDOWN, phase: 'enhancement',
      requires: { stance: 'hold', target: true }, effect: { ignoreDefense: N.ARC_BURST_IGNORE_DEF, damageDealt: N.ARC_BURST_DAMAGE, damageTaken: -N.OVERHEAT_VULNERABLE },
      description: 'Requires Hold. The strike ignores 3 Defense and gains +3 damage. Overheat (fixed): cooldown 4 and the unit takes 2 more damage per strike this battle.' },
    { id: 'digIn', name: 'Dig In', culture: N.id, rarity: 'uncommon', classes: ['sapper'], cost: N.DIG_IN_COST, cooldown: N.DIG_IN_COOLDOWN, phase: 'defense',
      requires: { stance: 'hold' }, spawn: { kind: 'barricade', name: 'Barricade', hp: N.BARRICADE_HP, blocks: true, decay: N.BARRICADE_DECAY, at: 'front' },
      description: 'Requires Hold. Raise a barricade (10 HP, blocks enemy movement, lasts 4 rounds) on the free tile it faces.' },
    // Champion kits (by unit id, so no other unit of the class gets them).
    { id: 'fieldWorks', name: 'Field Works', culture: N.id, units: ['ilseVoss'], classes: [], cost: N.FIELD_WORKS_COST, cooldown: N.FIELD_WORKS_COOLDOWN, phase: 'defense',
      requires: { stance: 'hold' }, effect: { damageTaken: N.FIELD_WORKS_REDUCTION }, spawn: { kind: 'barricade', name: 'Barricade', hp: N.BARRICADE_HP, blocks: true, decay: N.BARRICADE_DECAY, at: 'front' },
      description: 'Captain Voss. Requires Hold. Raise a barricade on the tile she faces and take 2 less damage per strike.' },
    { id: 'overcharge', name: 'Overcharge', culture: N.id, units: ['tobiahKettle'], classes: [], cost: N.OVERCHARGE_COST, cooldown: N.OVERCHARGE_COOLDOWN, phase: 'enhancement',
      requires: { stance: 'hold', target: true }, effect: { ignoreDefense: N.OVERCHARGE_IGNORE_DEF, damageDealt: N.OVERCHARGE_DAMAGE, damageTaken: -N.OVERCHARGE_VULNERABLE },
      description: 'Master Kettle. Requires Hold. The shot ignores 4 Defense and gains +4 damage. Overheat: cooldown 4, takes 2 more damage per strike this battle.' },
    { id: 'ironbound', name: 'Ironbound', culture: N.id, units: ['oldSixty'], classes: [], cost: N.IRONBOUND_COST, cooldown: N.IRONBOUND_COOLDOWN, phase: 'defense',
      requires: { stance: 'hold' }, effect: { damageTaken: N.IRONBOUND_REDUCTION },
      description: 'Old Sixty. Requires Hold. Take 4 less damage per strike this battle.' },
  ],

  spells: {
    fieldRepair: { spell: { id: 'fieldRepair', name: 'Field Repair', type: 'spell', cost: N.FIELD_REPAIR_COST, target: 'friendly-unit', duration: 'instant', effect: { type: 'heal', amount: N.FIELD_REPAIR_HEAL } },
      card: { rarity: 'common', effect: 'Free. Heal a friendly unit 4 HP (Mend heals 8 for 1 Supply).' } },
    // The engine sets the status VALUE to `duration`, so this gives +20 hit (status hitBonus) for the upcoming battle.
    flare: { spell: { id: 'flare', name: 'Flare', type: 'spell', cost: N.FLARE_COST, target: 'friendly-unit', duration: 'upcoming-battle', effect: { type: 'status', status: 'hitBonus', duration: N.FLARE_HIT } },
      card: { rarity: 'common', effect: 'One friendly unit gets +20 hit in the upcoming battle.' } },
  },

  // Card keys this culture draws from; repeats are weights. Shared spells (Mend, Ward, Fireburst) stay in the pool (one faction per side).
  pool: [
    'leaguePike', 'leaguePike', 'leaguePike',
    'pavise', 'pavise', 'pavise',
    'coil', 'coil', 'coil',
    'sapper', 'sapper',
    'relicWalker',
    'fieldRepair', 'flare', 'mend', 'ward', 'fireburst',
  ],
};

export default ironLeague;
