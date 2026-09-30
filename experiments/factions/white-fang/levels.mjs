// Five single-player White Fang levels in the style of experiments/levels/levels.mjs. Blue = the White Fang player with a scripted plan,
// Red = a fixed script of shipped units (the enemy never plays cards or clan kits). Each level is played "naive" (default stances, no
// picks, no spells) and "skilled" (the level's plan); then variants isolate one mechanic at a time. Run:
//   node experiments/factions/white-fang/run-levels.mjs --seeds 400 --replay 10 --out docs/experiments/results/factions/white-fang
//
// Level 1  Momentum         the same four Reavers on Advance (contact) v on Hold; with and without the Momentum passive; Reaving Rush
// Level 2  Blood Challenge  Dreg and two Reavers v a Pikeman screen with Archers behind it; each of Dreg's abilities removed in turn
// Level 3  The Pair         Dreg beside two identical Pikemen for one round: +4 on the mark, -4 on anything else, not a lock
// Level 4  The Reaving Line the whole clan army (every unit, skill and spell) v a Braced Pikeman-and-Archer line; each mechanic removed in turn
// Level 5  Sitting Still    the clan's weakness: the same enemy attack against clan units on Hold v baseline Pikemen on Hold with Rally and Brace
// Steps carry a `tag` naming the mechanic; ablations drop the steps with that tag (the units keep their placement).

const u = (id, faction, cls, c, r, extra = {}) => ({ id, faction, cls, c, r, ...extra });
const step = (tag, round, faction, extra) => ({ tag, round, faction, ...extra });
const all = (tag, round, faction, cls, extra) => step(tag, round, faction, { cls, ...extra });
const DEFAULT_STANCE = { pikeman: 'advance', archer: 'hold', cavalier: 'advance', fangReaver: 'advance', fangAxeguard: 'advance', fangBerserker: 'advance', fangHunter: 'advance', dreg: 'advance' };
const NAMES = { reavingRush: 'Reaving Rush', ironSkin: 'Iron Skin', frenzy: 'Frenzy', bloodChallenge: 'Blood Challenge', warlordsRush: "Warlord's Rush", rally: 'Rally', brace: 'Brace' };
const without = (plan, id) => plan.map((s) => (s.abilities ? { ...s, abilities: s.abilities.filter((x) => x !== id) } : s));
const redLine = (ids, c, r0, cls, stance, facing = 'west') => ids.map((id, i) => u(id, 'red', cls, c, r0 + i, { stance, facing }));

/** Variant list for one level. `plan` steps feed the skilled run; abilities and tags are ablated one at a time; `extra` adds hand-made variants. */
function level({ id, title, teaches, map = 'flat_open', maxRounds = 14, blue, red, hand = [], redScript = [], plan, extra = [], naivePlan = [], track, ablate = true, fallback = {} }) {
  // A step tagged with a mechanic's name (abilities and marks together) is ablated by tag; untagged ability picks are ablated by id.
  const tags = ablate ? [...new Set(plan.filter((s) => s.tag).map((s) => s.tag))] : [];
  const abilityIds = ablate ? [...new Set(plan.filter((s) => s.abilities && !s.tag).flatMap((s) => s.abilities))] : [];
  const base = { id, map, maxRounds, hand, ...(track ? { track } : {}) };
  const skilledUnits = [...blue, ...red];
  const naiveUnits = [...blue.map((x) => ({ ...x, stance: DEFAULT_STANCE[x.cls] || x.stance, objective: undefined })), ...red];
  const variants = [
    { evidence: true, label: 'N naive: default stances, no picks, no spells', def: { ...base, units: naiveUnits, script: [...naivePlan, ...redScript] } },
    { evidence: true, vs: 'N', label: `S skilled: ${teaches}`, def: { ...base, units: skilledUnits, script: [...plan, ...redScript] } },
    ...abilityIds.map((ab) => ({ vs: 'S', label: `S-${NAMES[ab] || ab} skilled without ${NAMES[ab] || ab}`, def: { ...base, units: skilledUnits, script: [...without(plan, ab), ...redScript] } })),
    ...tags.map((tag) => ({ vs: 'S', label: `S-${tag} skilled without ${tag}`, def: { ...base, units: skilledUnits, script: [...plan.filter((s) => s.tag !== tag), ...(fallback[tag] || []), ...redScript] } })),
    ...extra.map((x) => ({ vs: x.vs ?? 'S', label: x.label, def: { ...base, ...x.def, units: x.units || skilledUnits, script: [...(x.plan || plan), ...redScript] } })),
  ];
  return { id, title, question: `What does ${teaches} change?`, variants };
}
const mapAll = (units, over, faction = 'blue') => units.map((x) => (x.faction === faction ? { ...x, ...over } : x));

// ---------- Level 1: Momentum ----------
// Four Reavers (start x=3) meet four Pikemen (start x=10) on open ground. Both sides advance. The Reavers' Momentum pays +2 on every
// strike after a move; a Reaver that holds never gets it. Same units, same enemy: the only thing that changes is whether they move.
const L1_BLUE = [4, 5, 6, 7].map((r, i) => u(`bf${i + 1}`, 'blue', 'fangReaver', 3, r, { stance: 'advance', facing: 'east' }));
const L1_RED = redLine(['rp1', 'rp2', 'rp3', 'rp4'], 10, 4, 'pikeman', 'advance');
const L1 = level({
  id: 'level-1', title: 'Level 1: Momentum (Reaver: Advance, contact, Reaving Rush)', maxRounds: 12,
  teaches: 'Reavers advancing into contact with Reaving Rush from round 1',
  blue: L1_BLUE, red: L1_RED,
  plan: [all('Reaving Rush', 1, 'blue', 'fangReaver', { abilities: ['reavingRush'] })],
  ablate: false,
  extra: [
    { label: 'H hold: the same Reavers on Hold, no picks', vs: 'N', def: {}, units: [...mapAll(L1_BLUE, { stance: 'hold' }), ...L1_RED], plan: [] },
    { label: 'X no Momentum: Advance with the passive stripped', vs: 'N', def: {}, units: [...mapAll(L1_BLUE, { passives: [] }), ...L1_RED], plan: [] },
    { label: 'XH no Momentum, Hold (control: equals H if Momentum does nothing on Hold)', vs: 'H', def: {}, units: [...mapAll(L1_BLUE, { passives: [], stance: 'hold' }), ...L1_RED], plan: [] },
    { label: 'P plain Pikemen on Advance (the base unit: Str 8, Def 9)', vs: 'N', def: {}, units: [...L1_BLUE.map((x) => ({ ...x, cls: 'pikeman' })), ...L1_RED], plan: [] },
    { label: 'PH plain Pikemen on Hold (the base unit held)', vs: 'P', def: {}, units: [...L1_BLUE.map((x) => ({ ...x, cls: 'pikeman', stance: 'hold' })), ...L1_RED], plan: [] },
  ],
});

// ---------- Level 2: Blood Challenge on a field ----------
// Dreg and two Reavers (west) advance on two Pikemen holding forward and three Archers holding behind them. Dreg starts with 2 energy, so
// Blood Challenge (2 energy, cooldown 3) is ready in round 1 and again in round 4, with Warlord's Rush between. The mark goes on an
// Archer 6 tiles from Dreg (ra1). Ablations remove Dreg's two abilities and the Reavers' Rush in turn; M-Pikeman marks the nearest Pikeman.
const L2_BLUE = [u('dreg', 'blue', 'dreg', 4, 6, { stance: 'advance', facing: 'east', energy: 2 }), u('bf1', 'blue', 'fangReaver', 3, 5, { stance: 'advance', facing: 'east' }), u('bf2', 'blue', 'fangReaver', 3, 7, { stance: 'advance', facing: 'east' })];
const L2_RED = [u('rp1', 'red', 'pikeman', 8, 5, { stance: 'hold', facing: 'west' }), u('rp2', 'red', 'pikeman', 8, 7, { stance: 'hold', facing: 'west' }),
  u('ra1', 'red', 'archer', 7, 9, { stance: 'hold', facing: 'west' }), u('ra2', 'red', 'archer', 9, 6, { stance: 'hold', facing: 'west' }), u('ra3', 'red', 'archer', 9, 8, { stance: 'hold', facing: 'west' })];
const l2plan = (mark) => [
  step('Blood Challenge', 1, 'blue', { unit: 'dreg', abilities: ['bloodChallenge'] }),
  step('Blood Challenge', 1, 'blue', { unit: 'dreg', mark }),
  step("Warlord's Rush", 2, 'blue', { unit: 'dreg', abilities: ['warlordsRush'] }),
  step('Blood Challenge', 4, 'blue', { unit: 'dreg', abilities: ['bloodChallenge'] }),
  step('Blood Challenge', 4, 'blue', { unit: 'dreg', mark: 'ra2' }),
  all('Reaving Rush', 1, 'blue', 'fangReaver', { abilities: ['reavingRush'] }),
];
const L2 = level({
  id: 'level-2', title: "Level 2: Blood Challenge (Dreg: mark, Warlord's Rush)", maxRounds: 14, track: 'dreg',
  teaches: 'Dreg marking the exposed Archer (Blood Challenge) with the Reavers advancing beside him',
  blue: L2_BLUE, red: L2_RED,
  plan: l2plan('ra1'),
  extra: [
    { label: 'M-Pikeman mark the nearest Pikeman (rp1) instead of the Archer', vs: 'S', def: {}, plan: l2plan('rp1') },
  ],
});

// ---------- Level 3: The Pair (the numbers of Blood Challenge) ----------
// Dreg holds beside two identical Pikemen (north rp1, south rp2) and an Archer three tiles behind. Nothing moves, so every strike is
// one of Dreg's on a fixed pair, and the level lasts one round (Blood Challenge is ready in round 1 and on cooldown after): the damage per
// landed hit shows +4 on the mark and -4 on anything else, and which Pikeman he hits shows that the mark steers his target but does not
// lock it (an unreachable mark leaves him hitting the nearest at -4).
const L3_BLUE = [u('dreg', 'blue', 'dreg', 6, 6, { stance: 'hold', facing: 'east', energy: 2 }), u('bf1', 'blue', 'fangReaver', 4, 6, { stance: 'hold', facing: 'east' })];
const L3_RED = [u('rp1', 'red', 'pikeman', 6, 5, { stance: 'hold', facing: 'west' }), u('rp2', 'red', 'pikeman', 6, 7, { stance: 'hold', facing: 'west' }), u('ra1', 'red', 'archer', 9, 6, { stance: 'hold', facing: 'west' })];
const bc = (mark) => [step(null, 1, 'blue', { unit: 'dreg', abilities: ['bloodChallenge'] }), ...(mark ? [step(null, 1, 'blue', { unit: 'dreg', mark })] : [])];
const L3 = level({
  id: 'level-3', title: 'Level 3: The Pair (Blood Challenge: +4 on the mark, -4 on anything else)', maxRounds: 1, track: 'dreg',
  teaches: 'Blood Challenge marking the south Pikeman',
  blue: L3_BLUE, red: L3_RED, plan: bc('rp2'), ablate: false,
  extra: [
    { label: 'U no Blood Challenge (Dreg strikes the nearest: ties go to rp1)', def: {}, plan: [] },
    { label: 'D default mark: Blood Challenge with no aim (the nearest enemy is marked)', def: {}, plan: bc(null) },
    { label: 'A mark the north Pikeman', def: {}, plan: bc('rp1') },
    { label: 'F mark the Archer he cannot reach on Hold (off-target strikes take -4)', def: {}, plan: bc('ra1') },
  ],
});

// ---------- Level 4: The Reaving Line (every unit, skill and spell) ----------
// The clan army (Dreg, 3 Reavers, 2 Axeguards, a Berserker, 2 Hunters: 13 Supply) attacks a line of nine Pikemen and five Archers (19 Supply)
// that Brace from round 2 (as in the shipped level 5, but with the line in the open); the odds are set so the naive plan is close to even.
// Spells come from the hand: Blood Oath and War Cry in round 1, Hunt in round 2. The ablations remove each skill and each spell in turn.
const L4_BLUE = [u('dreg', 'blue', 'dreg', 4, 6, { stance: 'advance', facing: 'east', energy: 3 }),
  u('bf1', 'blue', 'fangReaver', 3, 4, { stance: 'advance', facing: 'east' }), u('bf2', 'blue', 'fangReaver', 3, 6, { stance: 'advance', facing: 'east' }), u('bf3', 'blue', 'fangReaver', 3, 8, { stance: 'advance', facing: 'east' }),
  u('ag1', 'blue', 'fangAxeguard', 4, 5, { stance: 'advance', facing: 'east', energy: 2 }), u('ag2', 'blue', 'fangAxeguard', 4, 7, { stance: 'advance', facing: 'east', energy: 2 }),
  u('bz1', 'blue', 'fangBerserker', 4, 4, { stance: 'advance', facing: 'east', energy: 2 }),
  u('fh1', 'blue', 'fangHunter', 2, 5, { stance: 'advance', facing: 'east' }), u('fh2', 'blue', 'fangHunter', 2, 7, { stance: 'advance', facing: 'east' })];
const L4_RED = [...Array.from({ length: 9 }, (_, i) => u(`rp${i + 1}`, 'red', 'pikeman', 9 + (i % 2), 3 + i, { stance: 'hold', facing: 'west' })),
  ...Array.from({ length: 5 }, (_, i) => u(`ra${i + 1}`, 'red', 'archer', 11 + (i % 2), 4 + i, { stance: 'hold', facing: 'west' }))];
const L4 = level({
  id: 'level-4', title: 'Level 4: The Reaving Line (the whole clan v a Braced line)', maxRounds: 20, track: 'dreg',
  teaches: 'every clan skill and spell together',
  hand: [{ faction: 'blue', key: 'bloodOath', n: 1 }, { faction: 'blue', key: 'warCry', n: 1 }, { faction: 'blue', key: 'hunt', n: 1 }],
  blue: L4_BLUE, red: L4_RED,
  redScript: [step(null, 2, 'red', { cls: 'pikeman', abilities: ['brace'] })],
  plan: [
    all('Reaving Rush', 1, 'blue', 'fangReaver', { abilities: ['reavingRush'] }),
    all('Iron Skin', 1, 'blue', 'fangAxeguard', { abilities: ['ironSkin'] }),
    step('Frenzy', 1, 'blue', { unit: 'bz1', abilities: ['frenzy'] }),
    step('Blood Challenge', 1, 'blue', { unit: 'dreg', abilities: ['bloodChallenge'] }),
    step('Blood Challenge', 1, 'blue', { unit: 'dreg', mark: 'ra1' }),
    step("Warlord's Rush", 2, 'blue', { unit: 'dreg', abilities: ['warlordsRush'] }),
    step('Blood Challenge', 4, 'blue', { unit: 'dreg', abilities: ['bloodChallenge'] }),
    step('Blood Challenge', 4, 'blue', { unit: 'dreg', mark: 'ra2' }),
    step('Blood Oath', 1, 'blue', { spell: 'bloodOath', unit: 'bf2' }),
    step('War Cry', 1, 'blue', { spell: 'warCry', unit: 'bz1' }),
    step('Hunt', 2, 'blue', { spell: 'hunt', unit: 'bf1' }),
  ],
});

// ---------- Level 5: Sitting Still (the clan's weakness) ----------
// Three units hold the village at 5,2 (north-west) against five Pikemen advancing from the east. The baseline holds with Rally and Brace;
// the clan has neither, so holding gives it nothing beyond Iron Skin. Note the clan side costs twice the Supply (Axeguard 2 v Pikeman 1).
const L5_RED = [[10, 1], [10, 2], [10, 3], [11, 2], [12, 2]].map(([c, r], i) => u(`rp${i + 1}`, 'red', 'pikeman', c, r, { stance: 'advance', facing: 'west' }));
const hold3 = (cls, extra = {}) => [[5, 2], [6, 1], [6, 3]].map(([c, r], i) => u(`bh${i + 1}`, 'blue', cls, c, r, { stance: 'hold', facing: 'east', ...extra }));
const L5 = level({
  id: 'level-5', title: 'Level 5: Sitting Still (clan on Hold v baseline Pikemen on Hold)', maxRounds: 14,
  teaches: 'Axeguards holding the village with Iron Skin',
  blue: hold3('fangAxeguard', { energy: 2 }), red: L5_RED,
  plan: [all('Iron Skin', 1, 'blue', 'fangAxeguard', { abilities: ['ironSkin'] })],
  naivePlan: [all(null, 1, 'blue', 'fangAxeguard', { stance: 'hold' })],
  ablate: false,
  extra: [
    { label: 'B baseline: plain Pikemen on Hold with Rally and Brace', vs: 'N', def: {}, units: [...hold3('pikeman'), ...L5_RED], plan: [all('Rally', 1, 'blue', 'pikeman', { abilities: ['rally'] }), all('Brace', 2, 'blue', 'pikeman', { abilities: ['rally', 'brace'] })] },
    { label: 'B0 baseline: plain Pikemen on Hold, no picks', vs: 'N', def: {}, units: [...hold3('pikeman'), ...L5_RED], plan: [] },
    { label: 'R Reavers on Hold (the same holding job, cheaper unit)', vs: 'N', def: {}, units: [...hold3('fangReaver'), ...L5_RED], plan: [] },
  ],
});

export const SUITES = [L1, L2, L3, L4, L5];
