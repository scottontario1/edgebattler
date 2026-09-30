// The Hollow Court (FACTIONS.md section 7): a functioning dead civilisation. Its identity is that killing a Court unit does not
// fully remove its battlefield value ("did I actually get rid of it?"): the fallen leave Corpses that living Court units consume
// for healing or feed on for damage, and one Mourning Knight per match refuses to fall. Individual units are modest; the lever is
// attrition and recovery, not stat quality.
//
// This is a culture module for src/cultures.js `registerCulture`. NOTHING here registers in the game: tests, experiments and
// simulators call registerCulture(HOLLOW_COURT) themselves. Only existing hooks are used (docs/CULTURE_HOOKS.md).
//
// Every number is a named constant below. All values are PROTOTYPE defaults for paired-seed experiments, not tuned balance;
// Scott chooses the shipped values.
//
// Exports
//   default            the full culture definition (id 'court')
//   buildHollowCourt   builds a definition with parts switched off, for ablation experiments (see `options`)
//   COURT              the numeric constants
//   COURT_CHAMPIONS    ids of the three proposed champions; DEFAULT_CHAMPION is the provisional default (open question)
//   courtRoster        the Court's starting force in the shape of the shipped roster (for createMatch({ roster }))

// ---------- numbers (named, commented) ----------
export const COURT = Object.freeze({
  // Corpse: a tile object left where a Court unit falls. Non-blocking (hook default), 3-round decay (Scott, FACTIONS.md 1b).
  corpseDecay: 3,
  corpseHp: 1,                    // objects need hp > 0 to exist; a corpse is a marker, never attacked (it does not block)

  // Feral Ghoul: cheap, fast, fragile. Spec delta from Pikeman: HP -8, Str -1, Def -6, Mov +2; recruit cost one lower.
  ghoul: { hp: 16, str: 7, skl: 4, spd: 5, def: 3, mov: 6, cost: 0, mt: 8, hit: 75,  // claws hit like a Pike (mt 8, hit 75): Str 7 + 8 = 15
    hungerEnergy: 1,              // Hunger: +1 energy the first time it is struck in a battle (energyWhenStruck)
    unquietDamage: 2, unquietCost: 1, unquietCooldown: 2 },  // Unquiet Step: +2 damage when it advanced and has a target

  // Graveguard: a Pikeman with +2 HP that stands better among the dead (spec: HP +2, Def 0). Cost 2 (a Pikeman is 1).
  graveguard: { hp: 26, str: 8, skl: 5, spd: 4, def: 9, mov: 4, cost: 2, mt: 8, hit: 75,
    dutyRadius: 2, dutyReduction: 1,        // Duty Beyond Death: takes 1 less damage per strike while a Corpse lies within 2 tiles
    graveRallyRadius: 1, graveRallyCost: 0, graveRallyCooldown: 2, graveRallyHeal: 6 },  // Grave Rally: eat an adjacent Corpse, heal 6 (self and friends within 1)

  // Wight: mid-tier. Hits harder near the dead and can strip armour. Earns its place as the offensive use of Corpses.
  wight: { hp: 20, str: 7, skl: 6, spd: 5, def: 6, mov: 4, cost: 2, mt: 6, hit: 85,
    feedRadius: 2, feedDamage: 2,           // Feeds on the Fallen: +2 damage per strike while a Corpse lies within 2 tiles
    gripIgnoreDef: 3, gripCost: 1, gripCooldown: 2 },   // Withering Grip: strike ignores 3 Defense

  // Mourning Knight: Cavalier variant (keeps Charge, Second Wind and the flank bonus, which key on cls 'cavalier').
  mourningKnight: { hp: 2, def: 2, cost: 4,          // deltas from Cavalier (24 HP, Def 7); card cost = Cavalier 3 + 1
    standReduction: 2 },                            // Deathless Stand: while on Hold, takes 2 less damage per strike (passive)

  // Necromancer: frail support. The staff ignores Defense (magic, hits RES) but is weak.
  necromancer: { hp: 16, mag: 2, skl: 6, spd: 4, def: 2, res: 2, mov: 4, cost: 3, mt: 3, hit: 80,
    consumeRadius: 3, consumeCount: 1, healRadius: 2, healAmount: 6, consumeCost: 1, consumeCooldown: 1 },  // Consume Remains

  // Spells (existing shapes only).
  graveChillDamage: 3, graveChillCost: 1,            // enemy-area, radius 0 (one tile). "loses 1 energy" is NOT supported: engine request
  mendBoneHeal: 6, mendBoneCost: 0,                  // weaker than Mend (8 for 1 Supply) but free

  // Champions (proposed options; DEFAULT_CHAMPION is the provisional choice).
  regent: { hp: 30, str: 8, skl: 5, spd: 3, def: 11, mov: 4,     // just under Brenna (28 HP, Str 9, Def 13, Iron Sword)
    decreeRadius: 4, decreeCount: 2, decreeHealRadius: 3, decreeHeal: 6, decreeCost: 2, decreeCooldown: 3,
    standReduction: 2, standCost: 1, standCooldown: 2 },
  chancellor: { hp: 22, mag: 4, skl: 6, spd: 4, def: 4, res: 3, mov: 4,
    ledgerRadius: 5, ledgerCount: 3, ledgerHealRadius: 3, ledgerHeal: 4, ledgerCost: 2, ledgerCooldown: 3,
    auditDamage: 3, auditCost: 1, auditCooldown: 2 },   // Audit is a flat +3: `ignoreDefense` would double count on a magic staff (engine note)
  marshal: { hp: 32, str: 8, skl: 5, spd: 3, def: 10, mov: 4,
    holdReduction: 3, holdCost: 1, holdCooldown: 2 },
});
const N = COURT;

// Rarity tags (round-step time gate: uncommon from round 3, rare from round 6). Kept in one table so Scott can move a card.
export const COURT_RARITY = Object.freeze({
  feralGhoul: 'common', graveguard: 'uncommon', wight: 'uncommon', necromancer: 'uncommon', wraith: 'uncommon', mourningKnight: 'rare',
  graveChill: 'common', mendBone: 'uncommon',
});

// Draw pool: repeated entries are weights (as in RECRUITMENT_POOL). Shared spells Mend, Ward and Fireburst stay in (Scott, 1b).
export const COURT_POOL = Object.freeze([
  'feralGhoul', 'feralGhoul', 'feralGhoul', 'graveguard', 'graveguard', 'wight', 'necromancer', 'wraith', 'mourningKnight',
  'graveChill', 'mendBone', 'mend', 'ward', 'fireburst',
]);

export const COURT_CHAMPIONS = Object.freeze(['hollowRegent', 'chancellor', 'marshal']);
/** PROVISIONAL default champion; the choice among the three is an open question for Scott. */
export const DEFAULT_CHAMPION = 'hollowRegent';

// Placeholder tints (multiplied over the borrowed base sprite) follow design_assets/factions/hollow_court/README.md: black, ash grey and
// steel with purple and pale gold; blue-white spectral glow for the undead, candle amber for the living court.
//   feral_ghoul_sprite.png -> Feral Ghoul (pale grey skin, brown rags)   mourning_knight_sprite.png -> Mourning Knight (steel, purple)
//   necromancer_sprite.png -> Necromancer (black velvet, grey silk, lantern staff)   Graveguard, Wight, champions: no reference art yet
const TINT = { wraith: '#8FB8C8', ghoul: '#a5a396', guard: '#7f8794', wight: '#9db4c8', knight: '#6a5a9a', necro: '#4a4656', noble: '#5a3a70' };
const CORPSE = { spawn: { kind: 'corpse', hp: N.corpseHp, blocks: false, decay: N.corpseDecay, name: 'Corpse' } };
const consume = (radius, count, healRadius, amount) => ({ kind: 'corpse', radius, count, heal: { radius: healRadius, amount } });
const nearCorpse = (radius) => ({ objectNear: { kind: 'corpse', radius } });

/**
 * Build a Court culture definition.
 * options (all default true; false removes that part while every stat stays the same, for ablations):
 *   corpses         units leave a Corpse where they fall (onDeath)
 *   revenant        Mourning Knight's Revenant Vow
 *   consume         the abilities that consume Corpses (Grave Rally, Consume Remains, champion consume kits)
 *   corpsePassives  Duty Beyond Death and Feeds on the Fallen (passives that read nearby Corpses)
 *   rarity          override { key: rarity } (sensitivity runs)
 */
export function buildHollowCourt(options = {}) {
  const o = { corpses: true, revenant: true, consume: true, corpsePassives: true, rarity: {}, ...options };
  const rar = (k) => ({ ...COURT_RARITY, ...o.rarity })[k];
  const onDeath = o.corpses ? { onDeath: CORPSE } : {};
  const g = N.ghoul, gg = N.graveguard, w = N.wight, mk = N.mourningKnight, nc = N.necromancer;

  const classes = {
    feralGhoul: {
      name: 'Feral Ghoul', title: 'Ghoul', label: 'Feral Ghoul',
      stats: { hp: g.hp, str: g.str, skl: g.skl, spd: g.spd, def: g.def, mov: g.mov },
      weapon: 'Ghoul Claws', weaponDef: { mt: g.mt, hit: g.hit, crit: 0, rng: [1, 1], kind: 'claw' }, // 'claw' sits outside the weapon triangle
      spriteBase: 'pikeman', tint: TINT.ghoul, ...onDeath,
      passives: [{ id: 'hunger', effect: { energyWhenStruck: g.hungerEnergy } }],
      description: 'A hunched, feral servant of the dead: cheap, fast and fragile. Leaves a Corpse. Gains 1 energy when struck.',
      card: { rarity: rar('feralGhoul'), cost: g.cost, class: 'Foot', range: 1, defaultStance: 'advance' },
    },
    graveguard: {
      name: 'Graveguard', title: 'Graveguard', label: 'Graveguard',
      stats: { hp: gg.hp, str: gg.str, skl: gg.skl, spd: gg.spd, def: gg.def, mov: gg.mov },
      weapon: 'Grave Halberd', weaponDef: { mt: gg.mt, hit: gg.hit, crit: 0, rng: [1, 1], kind: 'lance' },
      spriteBase: 'pikeman', tint: TINT.guard, ...onDeath,
      passives: o.corpsePassives ? [{ id: 'dutyBeyondDeath', when: nearCorpse(gg.dutyRadius), effect: { damageTaken: gg.dutyReduction } }] : [],
      description: 'Holds the line. Takes less damage while a Corpse lies within 2 tiles; Grave Rally eats an adjacent Corpse to heal.',
      card: { rarity: rar('graveguard'), cost: gg.cost, class: 'Foot', range: 1, defaultStance: 'hold' },
    },
    wight: {
      name: 'Wight', title: 'Wight', label: 'Wight',
      stats: { hp: w.hp, str: w.str, skl: w.skl, spd: w.spd, def: w.def, mov: w.mov },
      weapon: 'Wight Blade', weaponDef: { mt: w.mt, hit: w.hit, crit: 0, rng: [1, 1], kind: 'sword' },
      spriteBase: 'pikeman', tint: TINT.wight, ...onDeath,
      passives: o.corpsePassives ? [{ id: 'feedsOnTheFallen', when: nearCorpse(w.feedRadius), effect: { damageDealt: w.feedDamage } }] : [],
      description: 'Deals more damage while a Corpse lies within 2 tiles. Withering Grip ignores 3 Defense.',
      card: { rarity: rar('wight'), cost: w.cost, class: 'Foot', range: 1, defaultStance: 'advance' },
    },
    necromancer: {
      category: 'support', name: 'Necromancer', title: 'Court Necromancer', label: 'Necromancer',
      stats: { hp: nc.hp, str: 0, mag: nc.mag, skl: nc.skl, spd: nc.spd, def: nc.def, res: nc.res, mov: nc.mov },
      weapon: 'Lantern Staff', weaponDef: { mt: nc.mt, hit: nc.hit, crit: 0, rng: [1, 2], kind: 'tome', magic: true },
      spriteBase: 'archer', tint: TINT.necro, ...onDeath,
      description: 'A living court official: frail support with a weak Defense-ignoring lantern staff. Consume Remains eats a Corpse and heals friends nearby.',
      card: { rarity: rar('necromancer'), cost: nc.cost, class: 'Foot', range: 2, defaultStance: 'hold' },
    },
    // Wraith (NEW class, caster): a pale spectre with a Defense-ignoring touch at range 2. Fragile, fast, hard to hit (Ethereal).
    wraith: {
      category: 'caster', name: 'Wraith', title: 'Court Wraith', label: 'Wraith',
      stats: { hp: 14, str: 3, mag: 8, skl: 6, spd: 8, def: 1, res: 6, mov: 5 },
      weapon: 'Grave Touch', weaponDef: { mt: 5, hit: 80, crit: 0, rng: [1, 2], kind: 'tome', magic: true },
      spriteBase: 'archer', tint: TINT.wraith, ...onDeath,
      passives: [{ id: 'ethereal', effect: { damageTaken: 1 } }],
      description: 'A fragile, fast spectre. Ethereal: takes 1 less damage per strike. Withering Touch adds damage.',
      card: { rarity: rar('wraith'), cost: 3, class: 'Foot', range: 2, defaultStance: 'advance' },
    },
  };

  const variants = {
    mourningKnight: {
      base: 'cavalier', name: 'Mourning Knight', title: 'Mourning Knight', tint: TINT.knight,
      delta: { hp: mk.hp, def: mk.def }, ...onDeath,
      passives: [
        ...(o.revenant ? [{ id: 'revenantVow', effect: { revenant: 1 } }] : []),
        { id: 'deathlessStand', when: { stance: ['hold'] }, effect: { damageTaken: mk.standReduction } },
      ],
      description: 'Mounted, in polished steel and a purple mourning scarf. Revenant Vow: once per match, when killed it stays on its tile with 1 HP. Takes less damage while holding.',
      card: { rarity: rar('mourningKnight'), cost: mk.cost },
    },
  };

  const kit = (a) => ({ ...a });
  const abilities = [
    kit({ id: 'witheringTouch', name: 'Withering Touch', classes: ['wraith'], cost: 2, cooldown: 3, phase: 'enhancement', requires: { target: true }, effect: { damageDealt: 3 },
      description: 'Requires a target: the touch gains +3 damage.' }),
    kit({ id: 'unquietStep', name: 'Unquiet Step', classes: ['feralGhoul'], cost: g.unquietCost, cooldown: g.unquietCooldown, phase: 'enhancement',
      requires: { stance: 'advance', moved: 1, target: true }, effect: { damageDealt: g.unquietDamage },
      description: `Requires Advance, movement and a target: strike gains +${g.unquietDamage} damage.` }),
    kit({ id: 'withering', name: 'Withering Grip', classes: ['wight'], cost: w.gripCost, cooldown: w.gripCooldown, phase: 'enhancement',
      requires: { target: true }, effect: { ignoreDefense: w.gripIgnoreDef },
      description: `Requires a target: the strike ignores ${w.gripIgnoreDef} Defense.` }),
    // Champion kits are keyed by unit id (`units`) with no classes, so they never leak to Brenna or other units of a shared class.
    kit({ id: 'sovereignStand', name: 'Sovereign Stand', units: ['hollowRegent'], classes: [], cost: N.regent.standCost, cooldown: N.regent.standCooldown, phase: 'defense',
      requires: { stance: 'hold' }, effect: { damageTaken: N.regent.standReduction },
      description: `Requires Hold: take ${N.regent.standReduction} less damage per strike this battle.` }),
    kit({ id: 'chancelleryAudit', name: 'Chancellery Audit', units: ['chancellor'], classes: [], cost: N.chancellor.auditCost, cooldown: N.chancellor.auditCooldown, phase: 'enhancement',
      requires: { target: true }, effect: { damageDealt: N.chancellor.auditDamage },
      description: `Requires a target: the strike gains +${N.chancellor.auditDamage} damage.` }),
    kit({ id: 'holdBeyondDeath', name: 'Hold Beyond Death', units: ['marshal'], classes: [], cost: N.marshal.holdCost, cooldown: N.marshal.holdCooldown, phase: 'defense',
      requires: { stance: 'hold' }, effect: { damageTaken: N.marshal.holdReduction },
      description: `Requires Hold: take ${N.marshal.holdReduction} less damage per strike this battle.` }),
  ];
  if (o.consume) {
    abilities.push(
      kit({ id: 'graveRally', name: 'Grave Rally', classes: ['graveguard'], cost: gg.graveRallyCost, cooldown: gg.graveRallyCooldown, phase: 'recovery',
        requires: nearCorpse(gg.graveRallyRadius), consume: consume(gg.graveRallyRadius, 1, gg.graveRallyRadius, gg.graveRallyHeal),
        description: `Eat an adjacent Corpse: heal ${gg.graveRallyHeal} HP to itself and friends within ${gg.graveRallyRadius}.` }),
      kit({ id: 'consumeRemains', name: 'Consume Remains', classes: ['necromancer'], cost: nc.consumeCost, cooldown: nc.consumeCooldown, phase: 'recovery',
        requires: nearCorpse(nc.consumeRadius), consume: consume(nc.consumeRadius, nc.consumeCount, nc.healRadius, nc.healAmount),
        description: `Eat the nearest Corpse within ${nc.consumeRadius}: heal ${nc.healAmount} HP to itself and friends within ${nc.healRadius}.` }),
      kit({ id: 'decreeOfAttendance', name: 'Decree of Attendance', units: ['hollowRegent'], classes: [], cost: N.regent.decreeCost, cooldown: N.regent.decreeCooldown, phase: 'recovery',
        requires: nearCorpse(N.regent.decreeRadius), consume: consume(N.regent.decreeRadius, N.regent.decreeCount, N.regent.decreeHealRadius, N.regent.decreeHeal),
        description: `Eat up to ${N.regent.decreeCount} Corpses within ${N.regent.decreeRadius}: heal ${N.regent.decreeHeal} HP to friends within ${N.regent.decreeHealRadius}.` }),
      kit({ id: 'ledgerOfTheDead', name: 'Ledger of the Dead', units: ['chancellor'], classes: [], cost: N.chancellor.ledgerCost, cooldown: N.chancellor.ledgerCooldown, phase: 'recovery',
        requires: nearCorpse(N.chancellor.ledgerRadius), consume: consume(N.chancellor.ledgerRadius, N.chancellor.ledgerCount, N.chancellor.ledgerHealRadius, N.chancellor.ledgerHeal),
        description: `Eat up to ${N.chancellor.ledgerCount} Corpses within ${N.chancellor.ledgerRadius}: heal ${N.chancellor.ledgerHeal} HP to friends within ${N.chancellor.ledgerHealRadius}.` }),
    );
  }

  const spells = {
    graveChill: { spell: { id: 'graveChill', name: 'Grave Chill', type: 'spell', cost: N.graveChillCost, target: 'enemy-area', duration: 'instant', radius: 0,
      effect: { type: 'damage', amount: N.graveChillDamage } },
      card: { rarity: rar('graveChill'), effect: `Deal ${N.graveChillDamage} damage to one enemy tile (Defense ignored). The energy drain of the design is not supported yet.` } },
    mendBone: { spell: { id: 'mendBone', name: 'Mend Bone', type: 'spell', cost: N.mendBoneCost, target: 'friendly-unit', duration: 'instant', effect: { type: 'heal', amount: N.mendBoneHeal } },
      card: { rarity: rar('mendBone'), effect: `Restore ${N.mendBoneHeal} HP for free (Mend restores 8 for 1 Supply).` } },
  };

  const champions = {
    hollowRegent: { name: 'The Hollow Regent', title: 'Deathless Noble', cls: 'paladin', tint: TINT.noble, spriteBase: 'paladin',
      stats: { hp: N.regent.hp, str: N.regent.str, skl: N.regent.skl, spd: N.regent.spd, def: N.regent.def, mov: N.regent.mov },
      weapon: 'Iron Sword', look: { skin: '#cfc6c0', hair: '#1c1420', eyes: '#a02840', style: 'long' } },
    chancellor: { name: 'Chancellor Vael', title: 'Necromancer-Chancellor', cls: 'necromancer', tint: TINT.necro,
      stats: { hp: N.chancellor.hp, mag: N.chancellor.mag, skl: N.chancellor.skl, spd: N.chancellor.spd, def: N.chancellor.def, res: N.chancellor.res, mov: N.chancellor.mov },
      look: { skin: '#c9c2bd', hair: '#e8e2d6', eyes: '#6a9a80', style: 'long' } },
    marshal: { name: 'Marshal Ossian', title: 'Deathless Marshal', cls: 'graveguard', tint: TINT.guard,
      stats: { hp: N.marshal.hp, str: N.marshal.str, skl: N.marshal.skl, spd: N.marshal.spd, def: N.marshal.def, mov: N.marshal.mov },
      look: { skin: '#b9b4ab', hair: '#3a3a44', eyes: '#c8a040', style: 'short', beard: true } },
  };

  return { id: 'court', classes, variants, champions, abilities, spells, pool: [...COURT_POOL] };
}

const HOLLOW_COURT = buildHollowCourt();
export default HOLLOW_COURT;

/**
 * The Court's starting force, in the shape of the shipped roster: the shipped side's champion becomes `champion`, and each
 * recruit is swapped by role (Pikeman -> Graveguard, Archer -> Necromancer, Cavalier -> Mourning Knight). LABELLED DEFAULT: the
 * mapping is an experiment choice, not a rule. Requires the culture to be registered (uses createRecruitUnit/createChampionUnit).
 */
export function courtRoster(units, faction, createRecruitUnit, createChampionUnit, champion = DEFAULT_CHAMPION, map = { pikeman: 'graveguard', archer: 'necromancer', cavalier: 'mourningKnight' }) {
  return units.map((u) => {
    if (u.faction !== faction) return structuredClone(u);
    if (u.cls === 'paladin' || u.cls === 'barbarian') return createChampionUnit(champion, faction, u.c, u.r);
    return { ...createRecruitUnit(map[u.cls], u.id, faction, u.c, u.r), look: u.look };
  });
}
