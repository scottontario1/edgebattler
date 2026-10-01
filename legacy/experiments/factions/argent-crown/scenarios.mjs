// Three single-player levels for the Argent Crown, in the style of experiments/levels/levels.mjs. Blue = the Crown player with a
// scripted plan; Red = a fixed script of plain (baseline) units that advance and use their own free or affordable picks. Each level is
// played naive (units scattered as deployed, default stances, no picks or spells), skilled (a formation plus the level's picks), then
// with one thing removed at a time:
//   - each Crown skill or spell the plan uses (the step or pick is dropped, the unit keeps its place),
//   - Line Doctrine (the same units in the same places with the passive stripped, so nothing but the doctrine changes),
//   - the unit passives (Shieldwall, Banner, Sworn Guard),
//   - the formation itself (the same units, plan and passives, but scattered positions).
// "Formation v scattered" and "Line Doctrine removed" are the two measurements of the faction's core idea.
//   node experiments/factions/argent-crown/run-scenarios.mjs --seeds 400 --replay 10 --out docs/experiments/results/factions/argent-crown
// Numbers here are prototype defaults for measurement, like every number in the culture module.

const u = (id, faction, key, c, r, extra = {}) => ({ id, faction, key, c, r, ...extra });
const step = (tag, round, faction, extra) => ({ tag, round, faction, ...extra });
const NAMES = { rally: 'Rally', brace: 'Brace', focusedShot: 'Focused Shot', charge: 'Charge', closeRanks: 'Close Ranks', holdTheStandard: 'Hold the Standard', interpose: 'Interpose',
  bulwarkOfTheRealm: 'Bulwark of the Realm', oathkeepersStrike: "Oathkeeper's Strike", rallyBanner: 'Rally Banner' };
const without = (plan, id) => plan.map((s) => (s.abilities ? { ...s, abilities: s.abilities.filter((x) => x !== id) } : s));
const adjacentPairs = (units) => units.reduce((n, a, i) => n + units.slice(i + 1).filter((b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r) === 1).length, 0);

/** Build the variant list for one level. `scatter` maps unit id -> [c, r] for the scattered arrangement. */
function level({ id, title, question, setup, map = 'flat_open', maxRounds = 14, blue, scatter, red, hand = [], redScript = [], plan, unitPassives = [], extra = [] }) {
  for (const b of blue) if (!scatter[b.id]) throw new Error(`${id}: no scattered tile for ${b.id}`);
  const scattered = blue.map((b) => ({ ...b, c: scatter[b.id][0], r: scatter[b.id][1] }));
  const abilityIds = [...new Set(plan.flatMap((s) => s.abilities || []))].filter((a) => NAMES[a]);
  const tags = [...new Set(plan.filter((s) => s.tag && !s.abilities).map((s) => s.tag))];
  const base = { id, map, maxRounds, hand };
  const naiveUnits = scattered.map((b) => ({ ...b, stance: undefined, objective: undefined }));
  const strip = (units, ids) => units.map((b) => ({ ...b, dropPassives: ids }));
  const variants = [
    { label: 'N naive: scattered as deployed, default stances, no picks, no spells', def: { ...base, units: [...naiveUnits, ...red], script: [...redScript] } },
    { vs: 'N', label: 'S skilled: formation, Hold, the level\'s picks', def: { ...base, units: [...blue, ...red], script: [...plan, ...redScript] } },
    { vs: 'S', label: 'S-Scattered skilled plan but the units scattered (no formation)', def: { ...base, units: [...scattered.map((b, i) => ({ ...b, stance: blue[i].stance })), ...red], script: [...plan, ...redScript] } },
    { vs: 'S', label: 'S-Doctrine skilled without Line Doctrine (passive stripped, same places)', def: { ...base, units: [...strip(blue, ['lineDoctrine']), ...red], script: [...plan, ...redScript] } },
    ...(unitPassives.length ? [{ vs: 'S', label: `S-Unit passives skilled without ${unitPassives.join(' / ')}`, def: { ...base, units: [...strip(blue, unitPassives), ...red], script: [...plan, ...redScript] } }] : []),
    { vs: 'S', label: 'S-AllPassives skilled with every Crown passive stripped (skills and spells kept)', def: { ...base, units: [...strip(blue, ['lineDoctrine', ...unitPassives]), ...red], script: [...plan, ...redScript] } },
    ...abilityIds.map((ab) => ({ vs: 'S', label: `S-${NAMES[ab]} skilled without ${NAMES[ab]}`, def: { ...base, units: [...blue, ...red], script: [...without(plan, ab), ...redScript] } })),
    ...tags.map((tag) => ({ vs: 'S', label: `S-${tag} skilled without ${tag}`, def: { ...base, units: [...blue, ...red], script: [...plan.filter((s) => s.tag !== tag), ...redScript] } })),
    ...extra.map((x) => ({ vs: 'S', label: x.label, def: { ...base, ...x.def, units: x.units || [...blue, ...red], script: [...(x.plan || plan), ...redScript] } })),
  ];
  return { id, title, question, setup: `${setup} Blue adjacent pairs in formation / scattered: ${adjacentPairs(blue)} / ${adjacentPairs(scattered)}.`, variants };
}

// ---------- Level 1: Shield Wall (Crown Guard: Line Doctrine, Shieldwall, Close Ranks) ----------
// Three Crown Guards form a column on the open field with two Levy Archers and a Crown Pikeman packed behind them, against eleven plain units
// (six Pikemen, two Archers, three Cavaliers) coming from the east. Red Pikemen use Rally, Archers Focused Shot, Cavaliers Charge.
const L1 = level({
  id: 'crown-1', maxRounds: 18, title: 'Level 1: Shield Wall (Crown Guard: Line Doctrine, Shieldwall, Close Ranks)',
  question: 'How much stronger is the same Crown army in a block than scattered, and what do Line Doctrine, Shieldwall and Close Ranks each add?',
  setup: 'Blue: 3 Crown Guards (6,4-6), 2 Levy Archers (5,4) (5,6), 1 Crown Pikeman (5,5). Red: 6 Pikemen, 2 Archers, 3 Cavaliers from the east; from round 5 Blue advances to finish.',
  blue: [
    u('bg1', 'blue', 'crownGuard', 6, 4, { stance: 'hold', facing: 'east' }), u('bg2', 'blue', 'crownGuard', 6, 5, { stance: 'hold', facing: 'east' }), u('bg3', 'blue', 'crownGuard', 6, 6, { stance: 'hold', facing: 'east' }),
    u('ba1', 'blue', 'crownArcher', 5, 4, { stance: 'hold', facing: 'east' }), u('ba2', 'blue', 'crownArcher', 5, 6, { stance: 'hold', facing: 'east' }), u('bp1', 'blue', 'crownPike', 5, 5, { stance: 'hold', facing: 'east' }),
  ],
  scatter: { bg1: [6, 3], bg2: [7, 6], bg3: [5, 8], ba1: [4, 4], ba2: [3, 7], bp1: [4, 1] },
  red: [
    u('rp1', 'red', 'pikeman', 11, 3, { stance: 'advance', facing: 'west' }), u('rp2', 'red', 'pikeman', 11, 4, { stance: 'advance', facing: 'west' }), u('rp3', 'red', 'pikeman', 11, 5, { stance: 'advance', facing: 'west' }),
    u('rp4', 'red', 'pikeman', 11, 6, { stance: 'advance', facing: 'west' }), u('rp5', 'red', 'pikeman', 11, 7, { stance: 'advance', facing: 'west' }),
    u('ra1', 'red', 'archer', 12, 4, { stance: 'advance', facing: 'west' }), u('ra2', 'red', 'archer', 12, 6, { stance: 'advance', facing: 'west' }),
    u('rc1', 'red', 'cavalier', 12, 3, { stance: 'advance', facing: 'west' }), u('rc2', 'red', 'cavalier', 12, 7, { stance: 'advance', facing: 'west' }),
    u('rp6', 'red', 'pikeman', 12, 5, { stance: 'advance', facing: 'west' }), u('rc3', 'red', 'cavalier', 13, 5, { stance: 'advance', facing: 'west' }),
  ],
  redScript: [step(null, 1, 'red', { key: 'pikeman', abilities: ['rally'] }), step(null, 2, 'red', { key: 'archer', abilities: ['focusedShot'] }), step(null, 2, 'red', { key: 'cavalier', abilities: ['charge'] })],
  plan: [
    step(null, 1, 'blue', { key: 'crownPike', abilities: ['rally'] }),
    step(null, 1, 'blue', { key: 'crownGuard', abilities: ['rally', 'closeRanks'] }),
    step(null, 2, 'blue', { key: 'crownArcher', abilities: ['focusedShot'] }),
    step('Mop-up', 5, 'blue', { stance: 'advance' }),
  ],
  unitPassives: ['shieldwall'],
});

// ---------- Level 2: The Standard and the Oath (Bannerman, Oathsworn, Brenna) ----------
// A six-unit block around Brenna: an Oathsworn Protects her, a Bannerman raises the standard behind the front, two Crown Pikemen and a Levy
// Archer fill the block. Red brings Dreg, four Pikemen, two Archers and a Cavalier. Picks are timed to the energy Blue actually has.
const L2 = level({
  id: 'crown-2', maxRounds: 20, title: 'Level 2: The Standard and the Oath (Bannerman, Oathsworn, Brenna)',
  question: 'What do the Banner aura, Sworn Guard, Interpose, Hold the Standard and Brenna\'s kit add to a block, and how much of it needs the block?',
  setup: 'Blue: Brenna (6,5) with an Oathsworn (5,5) Protecting her, a Bannerman (5,4), Crown Pikemen (6,4) (6,6), a Levy Archer (5,6). Red: 4 Pikemen, 2 Archers, 2 Cavaliers from the east (no Dreg: a champion respawns, so a match with one cannot end by wipe-out); from round 5 the Pikemen, Archer and Bannerman advance to finish while Brenna holds with her Oathsworn.',
  blue: [
    u('brennaCrown', 'blue', 'brennaCrown', 6, 5, { stance: 'hold', facing: 'east' }), u('bo', 'blue', 'oathsworn', 5, 5, { stance: 'hold', facing: 'east' }), u('bb', 'blue', 'bannerman', 5, 4, { stance: 'hold', facing: 'east' }),
    u('bp1', 'blue', 'crownPike', 6, 4, { stance: 'hold', facing: 'east' }), u('bp2', 'blue', 'crownPike', 6, 6, { stance: 'hold', facing: 'east' }), u('ba1', 'blue', 'crownArcher', 5, 6, { stance: 'hold', facing: 'east' }),
  ],
  scatter: { brennaCrown: [7, 5], bo: [4, 8], bb: [3, 3], bp1: [6, 2], bp2: [6, 8], ba1: [4, 5] },
  red: [
    u('rp1', 'red', 'pikeman', 11, 3, { stance: 'advance', facing: 'west' }), u('rp2', 'red', 'pikeman', 11, 4, { stance: 'advance', facing: 'west' }), u('rp3', 'red', 'pikeman', 11, 5, { stance: 'advance', facing: 'west' }), u('rp4', 'red', 'pikeman', 11, 6, { stance: 'advance', facing: 'west' }),
    u('ra1', 'red', 'archer', 12, 4, { stance: 'advance', facing: 'west' }), u('ra2', 'red', 'archer', 12, 6, { stance: 'advance', facing: 'west' }), u('rc1', 'red', 'cavalier', 12, 7, { stance: 'advance', facing: 'west' }), u('rc2', 'red', 'cavalier', 12, 3, { stance: 'advance', facing: 'west' }),
  ],
  redScript: [step(null, 2, 'red', { key: 'archer', abilities: ['focusedShot'] }), step(null, 2, 'red', { key: 'cavalier', abilities: ['charge'] })],
  plan: [
    step(null, 1, 'blue', { key: 'crownPike', abilities: ['rally'] }),
    step('Protect', 1, 'blue', { unit: 'bo', stance: 'protect', targetId: 'brennaCrown' }),
    step(null, 1, 'blue', { unit: 'brennaCrown', abilities: ['oathkeepersStrike'] }),
    step(null, 2, 'blue', { key: 'bannerman', abilities: ['holdTheStandard'] }),
    step(null, 2, 'blue', { key: 'oathsworn', abilities: ['interpose'] }),
    step(null, 2, 'blue', { key: 'crownArcher', abilities: ['focusedShot'] }),
    step('Mop-up', 5, 'blue', { key: 'crownPike', stance: 'advance' }), step('Mop-up', 5, 'blue', { key: 'crownArcher', stance: 'advance' }),
    step('Mop-up', 5, 'blue', { key: 'bannerman', stance: 'advance' }),
  ],
  unitPassives: ['banner', 'swornGuard', 'swornGuardCost', 'crownPresence'],
  extra: [{ label: 'S+Bulwark Brenna picks Bulwark of the Realm (round 2) instead of Oathkeeper\'s Strike', plan: [
    step('Protect', 1, 'blue', { unit: 'bo', stance: 'protect', targetId: 'brennaCrown' }),
    step(null, 1, 'blue', { key: 'crownPike', abilities: ['rally'] }),
    step(null, 2, 'blue', { unit: 'brennaCrown', abilities: ['bulwarkOfTheRealm'] }),
    step(null, 2, 'blue', { key: 'bannerman', abilities: ['holdTheStandard'] }), step(null, 2, 'blue', { key: 'oathsworn', abilities: ['interpose'] }), step(null, 2, 'blue', { key: 'crownArcher', abilities: ['focusedShot'] }),
    step('Mop-up', 5, 'blue', { key: 'crownPike', stance: 'advance' }), step('Mop-up', 5, 'blue', { key: 'crownArcher', stance: 'advance' }),
    step('Mop-up', 5, 'blue', { key: 'bannerman', stance: 'advance' }),
  ] }],
});

// ---------- Level 3: Rally and Ride (Crown Knights, Rally Banner, Brenna's Presence) ----------
// The Crown block from the field manual: Brenna and Pikemen in front, the two Crown Knights held in reserve INSIDE the block (they draw
// Line Doctrine from the Pikemen beside them). When the enemy has committed, the Knights charge out. Two Rally Banners protect the front.
const L3 = level({
  id: 'crown-3', maxRounds: 22, title: 'Level 3: Rally and Ride (Crown Knights, Rally Banner, Charge from the block)',
  question: 'What does a Crown army gain by holding a block first and riding second, and what do Rally Banner and Charge add?',
  setup: 'Blue: Brenna (6,5), Crown Pikemen (6,4) (6,6) (5,5), Crown Knights (5,4) (5,6) in reserve; 2 Rally Banners in hand. Red: 5 Pikemen, 2 Archers, 2 Cavaliers from the east. Knights hold rounds 1-2, then Advance and Charge.',
  blue: [
    u('brennaCrown', 'blue', 'brennaCrown', 6, 5, { stance: 'hold', facing: 'east' }), u('bp1', 'blue', 'crownPike', 6, 4, { stance: 'hold', facing: 'east' }), u('bp2', 'blue', 'crownPike', 6, 6, { stance: 'hold', facing: 'east' }),
    u('bp3', 'blue', 'crownPike', 5, 5, { stance: 'hold', facing: 'east' }), u('bk1', 'blue', 'crownCavalier', 5, 4, { stance: 'hold', facing: 'east' }), u('bk2', 'blue', 'crownCavalier', 5, 6, { stance: 'hold', facing: 'east' }),
  ],
  scatter: { brennaCrown: [7, 5], bp1: [6, 2], bp2: [6, 8], bp3: [4, 5], bk1: [3, 3], bk2: [3, 7] },
  hand: [{ faction: 'blue', key: 'rallyBanner', n: 2 }],
  red: [
    u('rp1', 'red', 'pikeman', 11, 3, { stance: 'advance', facing: 'west' }), u('rp2', 'red', 'pikeman', 11, 4, { stance: 'advance', facing: 'west' }), u('rp3', 'red', 'pikeman', 11, 5, { stance: 'advance', facing: 'west' }), u('rp4', 'red', 'pikeman', 11, 6, { stance: 'advance', facing: 'west' }), u('rp5', 'red', 'pikeman', 11, 7, { stance: 'advance', facing: 'west' }),
    u('ra1', 'red', 'archer', 12, 4, { stance: 'advance', facing: 'west' }), u('ra2', 'red', 'archer', 12, 6, { stance: 'advance', facing: 'west' }),
    u('rc1', 'red', 'cavalier', 12, 3, { stance: 'advance', facing: 'west' }), u('rc2', 'red', 'cavalier', 12, 7, { stance: 'advance', facing: 'west' }),
  ],
  redScript: [step(null, 2, 'red', { key: 'archer', abilities: ['focusedShot'] }), step(null, 2, 'red', { key: 'cavalier', abilities: ['charge'] })],
  plan: [
    step(null, 1, 'blue', { key: 'crownPike', abilities: ['rally'] }),
    step('Rally Banner', 2, 'blue', { spell: 'rallyBanner', unit: 'bp1' }), step('Rally Banner', 2, 'blue', { spell: 'rallyBanner', unit: 'bp2' }),
    step('Ride', 3, 'blue', { key: 'crownCavalier', stance: 'advance' }),
    step('Ride', 3, 'blue', { key: 'crownCavalier', abilities: ['charge'] }),
    step('Mop-up', 5, 'blue', { key: 'crownPike', stance: 'advance' }), step('Mop-up', 5, 'blue', { key: 'paladin', stance: 'advance' }),
  ],
  unitPassives: ['crownPresence'],
});

export const LEVELS = [L1, L2, L3];
