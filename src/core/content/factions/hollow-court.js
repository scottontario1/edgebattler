// The Hollow Court (FACTIONS.md section 7): a functioning dead civilisation. Killing a Court unit does
// not fully remove its battlefield value: the fallen leave Corpses that living Court units consume for
// healing or feed on for damage, and one Mourning Knight per unit refuses to fall. Individual units are
// modest; the lever is attrition and recovery.
//
// A culture definition (schema: src/core/setup/cultures.js). All numbers are named prototype defaults,
// not tuned balance. Ability and spell records are inert catalogue data in this pass.

export const CULTURE_ID = 'court';

export const COURT = Object.freeze({
  // Corpse: a tile object left where a Court unit falls. Non-blocking, 3-round decay.
  corpseDecay: 3,
  corpseHp: 1,                    // objects need hp > 0 to exist; a corpse is a marker, never attacked

  // Feral Ghoul: cheap, fast, fragile.
  ghoul: {
    hp: 16, str: 7, skl: 4, spd: 5, def: 3, mov: 6, cost: 0, mt: 8, hit: 75,
    hungerEnergy: 1,              // Hunger: +1 energy the first time it is struck in a battle
    unquietDamage: 2, unquietCost: 1, unquietCooldown: 2,
  },

  // Graveguard: a Pikeman with +2 HP that stands better among the dead.
  graveguard: {
    hp: 26, str: 8, skl: 5, spd: 4, def: 9, mov: 4, cost: 2, mt: 8, hit: 75,
    dutyRadius: 2, dutyReduction: 1,        // Duty Beyond Death: 1 less damage per strike while a Corpse lies within 2 tiles
    graveRallyRadius: 1, graveRallyCost: 0, graveRallyCooldown: 2, graveRallyHeal: 6,
  },

  // Wight: hits harder near the dead and can strip armour.
  wight: {
    hp: 20, str: 7, skl: 6, spd: 5, def: 6, mov: 4, cost: 2, mt: 6, hit: 85,
    feedRadius: 2, feedDamage: 2,           // Feeds on the Fallen: +2 damage per strike while a Corpse lies within 2 tiles
    gripIgnoreDef: 3, gripCost: 1, gripCooldown: 2,
  },

  // Mourning Knight: Cavalier variant (deltas from Cavalier).
  mourningKnight: { hp: 2, def: 2, cost: 4, standReduction: 2 },

  // Necromancer: frail support. The staff ignores Defense (magic, hits RES) but is weak.
  necromancer: {
    hp: 16, mag: 2, skl: 6, spd: 4, def: 2, res: 2, mov: 4, cost: 3, mt: 3, hit: 80,
    consumeRadius: 3, consumeCount: 1, healRadius: 2, healAmount: 6, consumeCost: 1, consumeCooldown: 1,
  },

  // Spells
  graveChillDamage: 3, graveChillCost: 1,
  mendBoneHeal: 6, mendBoneCost: 0,

  // Champions (proposed options; DEFAULT_CHAMPION is the provisional choice).
  regent: {
    hp: 30, str: 8, skl: 5, spd: 3, def: 11, mov: 4,
    decreeRadius: 4, decreeCount: 2, decreeHealRadius: 3, decreeHeal: 6, decreeCost: 2, decreeCooldown: 3,
    standReduction: 2, standCost: 1, standCooldown: 2,
  },
  chancellor: {
    hp: 22, mag: 4, skl: 6, spd: 4, def: 4, res: 3, mov: 4,
    ledgerRadius: 5, ledgerCount: 3, ledgerHealRadius: 3, ledgerHeal: 4, ledgerCost: 2, ledgerCooldown: 3,
    auditDamage: 3, auditCost: 1, auditCooldown: 2,
  },
  marshal: { hp: 32, str: 8, skl: 5, spd: 3, def: 10, mov: 4, holdReduction: 3, holdCost: 1, holdCooldown: 2 },
});
const N = COURT;

/** Rarity tags (round-step time gate: uncommon from round 3, rare from round 6). */
export const COURT_RARITY = Object.freeze({
  feralGhoul: 'common', graveguard: 'uncommon', wight: 'uncommon', necromancer: 'uncommon', wraith: 'uncommon', mourningKnight: 'rare',
  graveChill: 'common', mendBone: 'uncommon',
});

/** Draw pool; repeated entries are weights. */
export const COURT_POOL = Object.freeze([
  'feralGhoul', 'feralGhoul', 'feralGhoul', 'graveguard', 'graveguard', 'wight', 'necromancer', 'wraith', 'mourningKnight',
  'graveChill', 'mendBone', 'mend', 'ward', 'fireburst',
]);

export const COURT_CHAMPIONS = Object.freeze(['hollowRegent', 'chancellor', 'marshal']);
/** Provisional default champion among the three. */
export const DEFAULT_CHAMPION = 'hollowRegent';

/** Placeholder tints multiplied over the borrowed base sprite. */
const TINT = {
  wraith: '#8FB8C8', ghoul: '#a5a396', guard: '#7f8794', wight: '#9db4c8', knight: '#6a5a9a', necro: '#4a4656', noble: '#5a3a70',
};

const CORPSE_DEATH = { spawn: { kind: 'corpse', hp: N.corpseHp, blocks: false, decay: N.corpseDecay, name: 'Corpse' } };

function consume(radius, count, healRadius, amount) {
  return { kind: 'corpse', radius, count, heal: { radius: healRadius, amount } };
}

function nearCorpse(radius) {
  return { objectNear: { kind: 'corpse', radius } };
}

function classDefs(options, rarityOf) {
  const onDeath = options.corpses ? { onDeath: CORPSE_DEATH } : {};
  const ghoul = N.ghoul;
  const guard = N.graveguard;
  const wight = N.wight;
  const necro = N.necromancer;
  return {
    feralGhoul: {
      name: 'Feral Ghoul', title: 'Ghoul', label: 'Feral Ghoul',
      stats: { hp: ghoul.hp, str: ghoul.str, skl: ghoul.skl, spd: ghoul.spd, def: ghoul.def, mov: ghoul.mov },
      // 'claw' sits outside the weapon triangle.
      weapon: 'Ghoul Claws', weaponDef: { mt: ghoul.mt, hit: ghoul.hit, crit: 0, rng: [1, 1], kind: 'claw' },
      spriteBase: 'pikeman', tint: TINT.ghoul, ...onDeath,
      passives: [{ id: 'hunger', effect: { energyWhenStruck: ghoul.hungerEnergy } }],
      description: 'A hunched, feral servant of the dead: cheap, fast and fragile. Leaves a Corpse. Gains 1 energy when struck.',
      card: { rarity: rarityOf('feralGhoul'), cost: ghoul.cost, class: 'Foot', range: 1, defaultStance: 'advance' },
    },
    graveguard: {
      name: 'Graveguard', title: 'Graveguard', label: 'Graveguard',
      stats: { hp: guard.hp, str: guard.str, skl: guard.skl, spd: guard.spd, def: guard.def, mov: guard.mov },
      weapon: 'Grave Halberd', weaponDef: { mt: guard.mt, hit: guard.hit, crit: 0, rng: [1, 1], kind: 'lance' },
      spriteBase: 'pikeman', tint: TINT.guard, ...onDeath,
      passives: options.corpsePassives
        ? [{ id: 'dutyBeyondDeath', when: nearCorpse(guard.dutyRadius), effect: { damageTaken: guard.dutyReduction } }]
        : [],
      description: 'Holds the line. Takes less damage while a Corpse lies within 2 tiles; Grave Rally eats an adjacent Corpse to heal.',
      card: { rarity: rarityOf('graveguard'), cost: guard.cost, class: 'Foot', range: 1, defaultStance: 'hold' },
    },
    wight: {
      name: 'Wight', title: 'Wight', label: 'Wight',
      stats: { hp: wight.hp, str: wight.str, skl: wight.skl, spd: wight.spd, def: wight.def, mov: wight.mov },
      weapon: 'Wight Blade', weaponDef: { mt: wight.mt, hit: wight.hit, crit: 0, rng: [1, 1], kind: 'sword' },
      spriteBase: 'pikeman', tint: TINT.wight, ...onDeath,
      passives: options.corpsePassives
        ? [{ id: 'feedsOnTheFallen', when: nearCorpse(wight.feedRadius), effect: { damageDealt: wight.feedDamage } }]
        : [],
      description: 'Deals more damage while a Corpse lies within 2 tiles. Withering Grip ignores 3 Defense.',
      card: { rarity: rarityOf('wight'), cost: wight.cost, class: 'Foot', range: 1, defaultStance: 'advance' },
    },
    necromancer: {
      category: 'support', name: 'Necromancer', title: 'Court Necromancer', label: 'Necromancer',
      stats: { hp: necro.hp, str: 0, mag: necro.mag, skl: necro.skl, spd: necro.spd, def: necro.def, res: necro.res, mov: necro.mov },
      weapon: 'Lantern Staff', weaponDef: { mt: necro.mt, hit: necro.hit, crit: 0, rng: [1, 2], kind: 'tome', magic: true },
      spriteBase: 'archer', tint: TINT.necro, ...onDeath,
      description: 'A living court official: frail support with a weak Defense-ignoring lantern staff. Consume Remains eats a Corpse and heals friends nearby.',
      card: { rarity: rarityOf('necromancer'), cost: necro.cost, class: 'Foot', range: 2, defaultStance: 'hold' },
    },
    // A pale spectre with a Defense-ignoring touch at range 2. Fragile, fast, hard to hit (Ethereal).
    wraith: {
      category: 'caster', name: 'Wraith', title: 'Court Wraith', label: 'Wraith',
      stats: { hp: 14, str: 3, mag: 8, skl: 6, spd: 8, def: 1, res: 6, mov: 5 },
      weapon: 'Grave Touch', weaponDef: { mt: 5, hit: 80, crit: 0, rng: [1, 2], kind: 'tome', magic: true },
      spriteBase: 'archer', tint: TINT.wraith, ...onDeath,
      passives: [{ id: 'ethereal', effect: { damageTaken: 1 } }],
      description: 'A fragile, fast spectre. Ethereal: takes 1 less damage per strike. Withering Touch adds damage.',
      card: { rarity: rarityOf('wraith'), cost: 3, class: 'Foot', range: 2, defaultStance: 'advance' },
    },
  };
}

function variantDefs(options, rarityOf) {
  const onDeath = options.corpses ? { onDeath: CORPSE_DEATH } : {};
  const knight = N.mourningKnight;
  return {
    mourningKnight: {
      base: 'cavalier', name: 'Mourning Knight', title: 'Mourning Knight', tint: TINT.knight,
      delta: { hp: knight.hp, def: knight.def }, ...onDeath,
      passives: [
        ...(options.revenant ? [{ id: 'revenantVow', effect: { revenant: 1 } }] : []),
        { id: 'deathlessStand', when: { stance: ['hold'] }, effect: { damageTaken: knight.standReduction } },
      ],
      description: 'Mounted, in polished steel and a purple mourning scarf. Revenant Vow: once per match, when killed it stays on its tile with 1 HP. '
        + 'Takes less damage while holding.',
      card: { rarity: rarityOf('mourningKnight'), cost: knight.cost },
    },
  };
}

function abilityDefs(options) {
  const ghoul = N.ghoul;
  const guard = N.graveguard;
  const wight = N.wight;
  const necro = N.necromancer;
  // Champion kits are keyed by unit id (`units`) with no classes, so they never leak to other units of a shared class.
  const abilities = [
    {
      id: 'witheringTouch', name: 'Withering Touch', classes: ['wraith'], cost: 2, cooldown: 3, phase: 'enhancement',
      requires: { target: true }, effect: { damageDealt: 3 }, description: 'Requires a target: the touch gains +3 damage.',
    },
    {
      id: 'unquietStep', name: 'Unquiet Step', classes: ['feralGhoul'], cost: ghoul.unquietCost, cooldown: ghoul.unquietCooldown, phase: 'enhancement',
      requires: { stance: 'advance', moved: 1, target: true }, effect: { damageDealt: ghoul.unquietDamage },
      description: `Requires Advance, movement and a target: strike gains +${ghoul.unquietDamage} damage.`,
    },
    {
      id: 'withering', name: 'Withering Grip', classes: ['wight'], cost: wight.gripCost, cooldown: wight.gripCooldown, phase: 'enhancement',
      requires: { target: true }, effect: { ignoreDefense: wight.gripIgnoreDef },
      description: `Requires a target: the strike ignores ${wight.gripIgnoreDef} Defense.`,
    },
    {
      id: 'sovereignStand', name: 'Sovereign Stand', units: ['hollowRegent'], classes: [], cost: N.regent.standCost, cooldown: N.regent.standCooldown,
      phase: 'defense', requires: { stance: 'hold' }, effect: { damageTaken: N.regent.standReduction },
      description: `Requires Hold: take ${N.regent.standReduction} less damage per strike this battle.`,
    },
    {
      id: 'chancelleryAudit', name: 'Chancellery Audit', units: ['chancellor'], classes: [], cost: N.chancellor.auditCost,
      cooldown: N.chancellor.auditCooldown, phase: 'enhancement', requires: { target: true }, effect: { damageDealt: N.chancellor.auditDamage },
      description: `Requires a target: the strike gains +${N.chancellor.auditDamage} damage.`,
    },
    {
      id: 'holdBeyondDeath', name: 'Hold Beyond Death', units: ['marshal'], classes: [], cost: N.marshal.holdCost, cooldown: N.marshal.holdCooldown,
      phase: 'defense', requires: { stance: 'hold' }, effect: { damageTaken: N.marshal.holdReduction },
      description: `Requires Hold: take ${N.marshal.holdReduction} less damage per strike this battle.`,
    },
  ];
  if (options.consume) {
    abilities.push(
      {
        id: 'graveRally', name: 'Grave Rally', classes: ['graveguard'], cost: guard.graveRallyCost, cooldown: guard.graveRallyCooldown, phase: 'recovery',
        requires: nearCorpse(guard.graveRallyRadius), consume: consume(guard.graveRallyRadius, 1, guard.graveRallyRadius, guard.graveRallyHeal),
        description: `Eat an adjacent Corpse: heal ${guard.graveRallyHeal} HP to itself and friends within ${guard.graveRallyRadius}.`,
      },
      {
        id: 'consumeRemains', name: 'Consume Remains', classes: ['necromancer'], cost: necro.consumeCost, cooldown: necro.consumeCooldown, phase: 'recovery',
        requires: nearCorpse(necro.consumeRadius), consume: consume(necro.consumeRadius, necro.consumeCount, necro.healRadius, necro.healAmount),
        description: `Eat the nearest Corpse within ${necro.consumeRadius}: heal ${necro.healAmount} HP to itself and friends within ${necro.healRadius}.`,
      },
      {
        id: 'decreeOfAttendance', name: 'Decree of Attendance', units: ['hollowRegent'], classes: [], cost: N.regent.decreeCost,
        cooldown: N.regent.decreeCooldown, phase: 'recovery', requires: nearCorpse(N.regent.decreeRadius),
        consume: consume(N.regent.decreeRadius, N.regent.decreeCount, N.regent.decreeHealRadius, N.regent.decreeHeal),
        description: `Eat up to ${N.regent.decreeCount} Corpses within ${N.regent.decreeRadius}: heal ${N.regent.decreeHeal} HP to friends within ${N.regent.decreeHealRadius}.`,
      },
      {
        id: 'ledgerOfTheDead', name: 'Ledger of the Dead', units: ['chancellor'], classes: [], cost: N.chancellor.ledgerCost,
        cooldown: N.chancellor.ledgerCooldown, phase: 'recovery', requires: nearCorpse(N.chancellor.ledgerRadius),
        consume: consume(N.chancellor.ledgerRadius, N.chancellor.ledgerCount, N.chancellor.ledgerHealRadius, N.chancellor.ledgerHeal),
        description: `Eat up to ${N.chancellor.ledgerCount} Corpses within ${N.chancellor.ledgerRadius}: heal ${N.chancellor.ledgerHeal} HP to friends within ${N.chancellor.ledgerHealRadius}.`,
      },
    );
  }
  return abilities;
}

function spellDefs(rarityOf) {
  return {
    graveChill: {
      spell: {
        id: 'graveChill', name: 'Grave Chill', type: 'spell', cost: N.graveChillCost, target: 'enemy-area', duration: 'instant', radius: 0,
        effect: { type: 'damage', amount: N.graveChillDamage },
      },
      card: {
        rarity: rarityOf('graveChill'),
        effect: `Deal ${N.graveChillDamage} damage to one enemy tile (Defense ignored). The energy drain of the design is not supported yet.`,
      },
    },
    mendBone: {
      spell: {
        id: 'mendBone', name: 'Mend Bone', type: 'spell', cost: N.mendBoneCost, target: 'friendly-unit', duration: 'instant',
        effect: { type: 'heal', amount: N.mendBoneHeal },
      },
      card: { rarity: rarityOf('mendBone'), effect: `Restore ${N.mendBoneHeal} HP for free (Mend restores 8 for 1 Supply).` },
    },
  };
}

function championDefs() {
  return {
    hollowRegent: {
      name: 'The Hollow Regent', title: 'Deathless Noble', cls: 'paladin', tint: TINT.noble, spriteBase: 'paladin',
      stats: { hp: N.regent.hp, str: N.regent.str, skl: N.regent.skl, spd: N.regent.spd, def: N.regent.def, mov: N.regent.mov },
      weapon: 'Iron Sword', look: { skin: '#cfc6c0', hair: '#1c1420', eyes: '#a02840', style: 'long' },
    },
    chancellor: {
      name: 'Chancellor Vael', title: 'Necromancer-Chancellor', cls: 'necromancer', tint: TINT.necro,
      stats: {
        hp: N.chancellor.hp, mag: N.chancellor.mag, skl: N.chancellor.skl, spd: N.chancellor.spd,
        def: N.chancellor.def, res: N.chancellor.res, mov: N.chancellor.mov,
      },
      look: { skin: '#c9c2bd', hair: '#e8e2d6', eyes: '#6a9a80', style: 'long' },
    },
    marshal: {
      name: 'Marshal Ossian', title: 'Deathless Marshal', cls: 'graveguard', tint: TINT.guard,
      stats: { hp: N.marshal.hp, str: N.marshal.str, skl: N.marshal.skl, spd: N.marshal.spd, def: N.marshal.def, mov: N.marshal.mov },
      look: { skin: '#b9b4ab', hair: '#3a3a44', eyes: '#c8a040', style: 'short', beard: true },
    },
  };
}

/**
 * Build a Court culture definition. Every option defaults to true; false removes that part while every
 * stat stays the same, for ablation experiments.
 * @param {object} [options]
 * @param {boolean} [options.corpses]         units leave a Corpse where they fall (onDeath)
 * @param {boolean} [options.revenant]        Mourning Knight's Revenant Vow
 * @param {boolean} [options.consume]         the abilities that consume Corpses
 * @param {boolean} [options.corpsePassives]  Duty Beyond Death and Feeds on the Fallen
 * @param {Record<string, string>} [options.rarity]  override { key: rarity }
 */
export function buildHollowCourt(options = {}) {
  const settings = { corpses: true, revenant: true, consume: true, corpsePassives: true, rarity: {}, ...options };
  const rarityOf = (key) => ({ ...COURT_RARITY, ...settings.rarity })[key];
  return {
    id: CULTURE_ID,
    classes: classDefs(settings, rarityOf),
    variants: variantDefs(settings, rarityOf),
    champions: championDefs(),
    abilities: abilityDefs(settings),
    spells: spellDefs(rarityOf),
    pool: [...COURT_POOL],
  };
}

export default buildHollowCourt();
