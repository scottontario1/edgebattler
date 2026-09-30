// Iron League single-player levels, in the style of experiments/levels/levels.mjs. Blue = the League player with a scripted plan;
// Red = a fixed script of shipped classes (it advances and never plays cards). Each level is played:
//   N  naive          every League unit set to Advance, no skill picks (the same units, moving)
//   M  moving         Advance with the skill picks (skills that need Hold fail; passives that need Hold never fire)
//   H  held           Hold, no skill picks (passives only)
//   S  skilled        Hold plus the level's plan (picks, barricade, spells)
//   S- ablations      the skilled plan minus one skill, one passive or one spell
//   P  plain          the same formation and Hold, with plain Pikemen and Archers and no League features
// Run: node experiments/factions/iron-league/run-scenarios.mjs --seeds 400 --replay 10 --out docs/experiments/results/factions/iron-league
//
// Formations (blue, west bank): the "pocket". The one-tile lane exit is left empty; Pikemen stand on its flanks, the Pavise Guard
// behind, Crossbowmen at range 2 from the exit tile, so a single enemy that steps out is shot by three and struck by three.

const u = (id, faction, cls, c, r, extra = {}) => ({ id, faction, cls, c, r, ...extra });
const step = (tag, round, faction, extra) => ({ tag, round, faction, ...extra });
const stanceAll = (round, stance) => ({ round, faction: 'blue', stance });
const B = (id, cls, c, r, extra = {}) => u(id, 'blue', cls, c, r, { stance: 'hold', facing: 'east', energy: 1, ...extra });
const R = (id, cls, c, r, extra = {}) => u(id, 'red', cls, c, r, { stance: 'advance', facing: 'west', ...extra });

const PLAIN = { leaguePike: 'pikeman', pavise: 'pikeman', coil: 'archer', sapper: 'pikeman', relicWalker: 'pikeman', ilseVoss: 'pikeman' };
const NAMES = { rally: 'Rally', setPosition: 'Set Position', preparedPosition: 'Prepared Position', arcBurst: 'Arc Burst', digIn: 'Dig In', fieldWorks: 'Field Works', setShield: 'Set Shield (passive)', preparedShot: 'Prepared Shot (passive)', plantedPike: 'Planted Pike (passive)', wear: 'Wear (passive)', fieldRepair: 'Field Repair', flare: 'Flare' };
const withoutAbility = (plan, id) => plan.map((s) => (s.abilities ? { ...s, abilities: s.abilities.filter((x) => x !== id) } : s)).filter((s) => s.spell !== id);

/** Build the variants of one level. `plan` = skilled steps (abilities carry ids, spells `spell`), `passives` = passive ids to ablate. */
function level({ id, title, teaches, map, maxRounds = 14, finish = null, blue, red, hand = [], champions, plan, passives = [], plainSwap = PLAIN, extra = [] }) {
  const base = { id, map, maxRounds, hand, ...(champions ? { champions } : {}) };
  const setStance = (units, stance) => units.map((x) => ({ ...x, stance }));
  const abilityIds = [...new Set(plan.flatMap((s) => s.abilities || []))].filter((a) => NAMES[a]);
  const spellIds = [...new Set(plan.filter((s) => s.spell).map((s) => s.spell))];
  const noPicks = (steps) => steps.filter((s) => !s.abilities && !s.spell && !s.barricade);
  const plainUnits = blue.map((x) => ({ ...x, cls: plainSwap[x.cls] || x.cls, energy: 1 }));
  const RALLY = step(null, 1, 'blue', { cls: 'pikeman', abilities: ['rally'] }); // the shipped Pikeman skill, in every holding variant
  // Sortie: at round `finish` the units flagged `sortie` leave the line (Advance) to hunt what is standing off out of reach, e.g. archers
  // plinking the Pavise Guard for 0 damage. Every holding variant does the same.
  const tail = finish ? blue.filter((x) => x.sortie).map((x) => ({ round: finish, faction: 'blue', unit: x.id, stance: 'advance' })) : [];
  const variants = [
    { evidence: true, label: 'N naive: every unit Advances, no picks', def: { ...base, units: [...setStance(blue, 'advance'), ...red], script: [] } },
    { vs: 'N', label: 'M moving: Advance with the skill picks (skills need Hold)', def: { ...base, units: [...setStance(blue, 'advance'), ...red], script: [stanceAll(1, 'advance'), ...plan.filter((s) => s.abilities || s.spell)] } },
    { vs: 'N', label: 'H held: Hold with Rally only (League passives, no League skills)', def: { ...base, units: [...blue, ...red], script: [RALLY, ...tail] } },
    { evidence: true, vs: 'N', label: `S skilled: ${teaches}`, def: { ...base, units: [...blue, ...red], script: [...plan, ...tail] } },
    ...abilityIds.map((ab) => ({ vs: 'S', label: `S-${NAMES[ab]} skilled without ${NAMES[ab]}`, def: { ...base, units: [...blue, ...red], script: [...withoutAbility(plan, ab), ...tail] } })),
    ...spellIds.map((sp) => ({ vs: 'S', label: `S-${NAMES[sp]} skilled without ${NAMES[sp]}`, def: { ...base, units: [...blue, ...red], script: [...withoutAbility(plan, sp), ...tail] } })),
    ...passives.map((p) => ({ vs: 'S', label: `S-${NAMES[p]} skilled without ${NAMES[p]}`, def: { ...base, units: [...blue, ...red], culture: { without: [p] }, script: [...plan, ...tail] } })),
    { vs: 'S', label: 'P plain: the same formation with plain Pikemen and Archers, Hold, no League features, Rally only', def: { ...base, units: [...plainUnits, ...red], script: [RALLY, ...tail] } },
    ...extra.map((x) => ({ vs: 'S', label: x.label, def: { ...base, ...(x.def || {}), units: x.units || [...blue, ...red], script: [...(x.plan || plan), ...tail] } })),
  ];
  void noPicks;
  return { id, title, question: `What does preparation change: ${teaches}?`, variants };
}

// East-bank column of Red pikemen and archers, one per listed tile, all advancing west.
// Red marches on `goal` (the tile the League defends; greedy Manhattan pursuit of the nearest unit would stall units on the far bank of a river).
const redColumn = (goal, pikes, archers = [], cav = []) => [
  ...pikes.map(([c, r], i) => R(`rp${i + 1}`, 'pikeman', c, r, { objective: goal })),
  ...archers.map(([c, r], i) => R(`ra${i + 1}`, 'archer', c, r, { objective: goal })),
  ...cav.map(([c, r], i) => R(`rc${i + 1}`, 'cavalier', c, r, { objective: goal })),
];
const PIKE_PICKS = ['rally', 'setPosition'];
const HOLD_KIT = (cls, abilities) => step(null, 1, 'blue', { cls, abilities });

// ---------- Level A: The Bridge (River Ford, the bridge at 8,5) ----------
// Two League Pikemen flank the bridge exit at 7,5, a Pavise Guard stands behind it and three Crossbowmen sit at range 2 of the exit tile
// (6,4 / 6,6 / 5,5, all beside the Pavise Guard). Ten Red units cross a one-tile bridge one at a time.
const A_BLUE = [B('pv1', 'pavise', 7, 5), B('cx1', 'coil', 7, 4), B('cx2', 'coil', 7, 6), B('lp1', 'leaguePike', 6, 4, { sortie: true }), B('lp2', 'leaguePike', 6, 6, { sortie: true })];
const A_RED = redColumn([7, 5], [[9, 5], [9, 4], [9, 6], [10, 5], [10, 4], [10, 6], [11, 5], [11, 4], [11, 6], [12, 5], [12, 4], [12, 6], [13, 5], [13, 4]], [[10, 3], [11, 3], [12, 3], [10, 7]]);
const LA = level({
  id: 'bridge', title: 'A. The Bridge (River Ford): the plug at the bridge exit', map: 'river_ford', maxRounds: 40, finish: 18,
  teaches: 'holding the pocket with Set Position and Prepared Position',
  blue: A_BLUE, red: A_RED,
  plan: [
    HOLD_KIT('pikeman', PIKE_PICKS),
    HOLD_KIT('archer', ['preparedPosition']),
  ],
  passives: ['setShield', 'preparedShot', 'plantedPike'],
});

// ---------- Level B: The Gap (choke_gap1: a two-tile lane, no bridge) ----------
// The Pavise Guard plugs the lane exit at 6,5 and three Crossbowmen at 5,5 / 6,4 / 6,6 (all adjacent to it) cover the lane; two Pikemen back it.
// Field Repair mends the plug between waves.
const B_BLUE = [B('pv1', 'pavise', 6, 5), B('cx1', 'coil', 5, 5), B('cx2', 'coil', 6, 4), B('cx3', 'coil', 6, 6), B('lp1', 'leaguePike', 5, 4, { sortie: true }), B('lp2', 'leaguePike', 5, 6, { sortie: true })];
const B_RED = redColumn([6, 5], [[9, 5], [9, 4], [9, 6], [10, 5], [10, 4], [10, 6], [11, 5], [11, 4], [11, 6], [12, 5], [12, 4], [12, 6]], [[10, 3], [11, 3], [10, 7], [11, 7]], [[12, 3], [12, 7]]);
const LB = level({
  id: 'gap', title: 'B. The Gap (one-tile crossing): the Pavise plug', map: 'choke_gap1', maxRounds: 40, finish: 16,
  teaches: 'a Pavise Guard plug with Set Position, Prepared Position and Field Repair',
  hand: [{ faction: 'blue', key: 'fieldRepair', n: 3 }],
  blue: B_BLUE, red: B_RED,
  plan: [
    HOLD_KIT('pikeman', PIKE_PICKS),
    HOLD_KIT('archer', ['preparedPosition']),
    step('Field Repair', 3, 'blue', { spell: 'fieldRepair', unit: 'pv1' }),
    step('Field Repair', 5, 'blue', { spell: 'fieldRepair', unit: 'pv1' }),
    step('Field Repair', 7, 'blue', { spell: 'fieldRepair', unit: 'pv1' }),
  ],
  passives: ['setShield', 'preparedShot', 'plantedPike'],
});

// ---------- Level C: The Ridge Pass (ridge_line: pass 7,3, mountains either side) ----------
// A Sapper at 6,3 (forest) barricades the pass tile 7,3; two Crossbowmen on the mountain tiles 7,2 and 7,4 (Def +2, avoid +30) shoot
// the enemy at the wall (8,3); Pavise Guards behind them give Set Shield; a Relic Walker at 5,3 fires Arc Burst over the wall
// (range 2 reaches 7,3 only; it stands ready for whatever breaks through). Red is Pikemen, Archers and Cavaliers (who cannot climb the ridge).
const C_BLUE = [B('sp1', 'sapper', 6, 3, { energy: 2 }), B('cx1', 'coil', 7, 2), B('cx2', 'coil', 7, 4), B('pv1', 'pavise', 6, 2), B('pv2', 'pavise', 6, 4), B('rw1', 'relicWalker', 5, 3, { energy: 3, sortie: true })];
const C_RED = redColumn([6, 3], [[10, 3], [11, 3], [12, 3], [10, 2], [11, 2], [10, 4]], [[12, 2], [12, 4]], [[13, 3]]);
const LC = level({
  id: 'ridge-pass', title: 'C. The Ridge Pass (ridge_line): barricade, mountain crossbows and Arc Burst', map: 'ridge_line', maxRounds: 40, finish: 16,
  teaches: 'a barricade in the pass, Crossbowmen on the ridge and Arc Burst from behind',
  blue: C_BLUE, red: C_RED,
  plan: [
    HOLD_KIT('pikeman', PIKE_PICKS),
    HOLD_KIT('archer', ['preparedPosition']),
    step('Dig In', 1, 'blue', { cls: 'sapper', abilities: ['digIn'] }),
    step('Arc Burst', 2, 'blue', { cls: 'relicWalker', abilities: ['arcBurst'] }),
  ],
  passives: ['setShield', 'preparedShot', 'wear'],
});

// ---------- Level D: The Wall (River Ford): a Sapper's barricade on the bridge exit ----------
// The Sapper at 6,5 digs the exit tile 7,5, so the enemy on the bridge (8,5) can only strike the barricade while Crossbowmen at 7,4 and 7,6
// (range 2 of the bridge tile) shoot it; Pavise Guards at 6,4 and 6,6 shield them. Compare the same units without Dig In (the exit stays open).
const D_BLUE = [B('sp1', 'sapper', 6, 5, { energy: 2 }), B('cx1', 'coil', 7, 4), B('cx2', 'coil', 7, 6), B('pv1', 'pavise', 6, 4), B('pv2', 'pavise', 6, 6), B('lp1', 'leaguePike', 5, 5, { sortie: true })];
const D_RED = redColumn([7, 5], [[9, 5], [9, 4], [9, 6], [10, 5], [10, 4], [10, 6], [11, 5], [11, 4], [11, 6], [12, 5], [12, 4], [12, 6]], [[10, 3], [11, 3], [10, 7]]);
const LD = level({
  id: 'wall', title: "D. The Wall (River Ford): a Sapper's barricade at the bridge exit", map: 'river_ford', maxRounds: 40, finish: 18,
  teaches: 'a Sapper raising a barricade on the bridge exit under Crossbow fire',
  blue: D_BLUE, red: D_RED,
  plan: [
    HOLD_KIT('pikeman', PIKE_PICKS),
    HOLD_KIT('archer', ['preparedPosition']),
    step('Dig In', 1, 'blue', { cls: 'sapper', abilities: ['digIn'] }),
  ],
  passives: ['setShield', 'preparedShot'],
  // Sensitivity, not a proposal: the confirmed barricade has 10 HP and falls to one Pikeman hit (16 damage against 0 Defense).
  extra: [20, 30].map((hp) => ({ label: `X${hp} sensitivity: barricade with ${hp} HP`, def: { culture: { barricadeHp: hp } } })),
});

// ---------- Level E: The Captain's Bridge (River Ford, champion Captain Voss = PROVISIONAL default champion) ----------
// The same wall, raised by the champion's Field Works (2 energy, cooldown 3) instead of a Sapper; she also takes 2 less damage per strike while she holds.
const E_BLUE = [B('ilseVoss', 'ilseVoss', 6, 5, { energy: 2 }), B('cx1', 'coil', 7, 4), B('cx2', 'coil', 7, 6), B('pv1', 'pavise', 6, 4), B('pv2', 'pavise', 6, 6), B('lp1', 'leaguePike', 5, 5, { sortie: true })];
const LE = level({
  id: 'captain', title: "E. The Captain's Bridge (River Ford): champion kit Field Works", map: 'river_ford', maxRounds: 40, finish: 18, champions: { blue: 'ilseVoss' },
  teaches: 'Captain Voss fortifying the bridge exit with Field Works',
  blue: E_BLUE, red: D_RED,
  plan: [
    HOLD_KIT('pikeman', PIKE_PICKS),
    HOLD_KIT('archer', ['preparedPosition']),
    step('Field Works', 1, 'blue', { unit: 'ilseVoss', abilities: ['rally', 'setPosition', 'fieldWorks'] }),
  ],
  passives: ['setShield', 'preparedShot'],
});

export const SUITES = [LA, LB, LC, LD, LE];
