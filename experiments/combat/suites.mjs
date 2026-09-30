// Combat case-study suites. Each suite is one fixed situation plus variants that change ONE factor from the
// baseline (the first variant) so a difference in outcome can be attributed to that factor. Definitions are plain
// data (see scenario.mjs); the shipped rules are used unless a variant names candidates.
//
// Coordinates: 16 x 12 grid, column c, row r. Blue is the side named first in each title unless noted.
// Every suite lists Supply/population per side (recipe pricing) so unequal armies are read as unequal.

const u = (id, faction, cls, c, r, extra = {}) => ({ id, faction, cls, c, r, ...extra });
const withUnits = (def, fn) => ({ ...def, units: def.units.map(fn) });
const only = (faction, cls, patch) => (unit) => (unit.faction === faction && unit.cls === cls ? { ...unit, ...(typeof patch === 'function' ? patch(unit) : patch) } : unit);
const step = (round, faction, cls, extra) => ({ round, faction, cls, ...extra });

// ---------- Suite 1: Three Pikemen v two Cavaliers ----------
// Pikemen (blue) stand in a column at c=6 and hold, facing east toward the cavaliers (red), who start 5 tiles
// from contact so both arrive in round 1. Energy is the engine's start value (1 in round 1, +1 per round).
const pikeColumn = (facing = 'east', ids = [5, 6, 7]) => ids.map((r, i) => u(`bp${i + 1}`, 'blue', 'pikeman', 6, r, { stance: 'hold', facing }));
const cavPair = (rows = [5, 7], c = 12) => rows.map((r, i) => u(`rc${i + 1}`, 'red', 'cavalier', c, r, { stance: 'advance', facing: 'west' }));
const S1_BASE = { id: 'pikes-v-cav', map: 'flat_open', maxRounds: 10, units: [...pikeColumn(), ...cavPair()] };
const cavCharge = [step(1, 'red', 'cavalier', { stance: 'hold' }), step(2, 'red', 'cavalier', { stance: 'advance', abilities: ['charge'] })];
const pikeBrace = step(2, 'blue', 'pikeman', { abilities: ['brace'] });

export const SUITE_PIKES_V_CAV = {
  id: 'pikes-v-cav',
  title: 'Three Pikemen (hold) v two Cavaliers (advance)',
  question: 'Do three cheap Pikemen stop two expensive Cavaliers, and which decisions change that: the angle of attack, waiting to charge energy, candidate abilities, equipment?',
  variants: [
    { label: 'A0 baseline: frontal, immediate, no abilities', def: S1_BASE },
    { label: 'A1 side attack (Pikemen face north)', def: withUnits(S1_BASE, only('blue', 'pikeman', { facing: 'north' })) },
    { label: 'A2 back attack (Pikemen face west)', def: withUnits(S1_BASE, only('blue', 'pikeman', { facing: 'west' })) },
    { label: 'B1 Cavaliers wait a round, then Charge (arrive round 2)', def: { ...S1_BASE, script: cavCharge } },
    { label: 'B2 both prepare: Cav Charge, Pikemen Brace (round 2)', def: { ...S1_BASE, script: [...cavCharge, pikeBrace] } },
    { evidence: true, label: 'B3 side attack + Cav wait/Charge', def: { ...withUnits(S1_BASE, only('blue', 'pikeman', { facing: 'north' })), script: cavCharge } },
    { label: 'C1 candidate Set Spears on Pikemen (round 1)', def: { ...S1_BASE, candidates: ['setSpears'], script: [step(1, 'blue', 'pikeman', { abilities: ['setSpears'] })] } },
    { label: 'C2 candidate Momentum on Cavaliers (round 1)', def: { ...S1_BASE, candidates: ['momentum'], script: [step(1, 'red', 'cavalier', { abilities: ['momentum'] })] } },
    { label: 'C3 Set Spears + Momentum, both round 1', def: { ...S1_BASE, candidates: ['setSpears', 'momentum'], script: [step(1, 'blue', 'pikeman', { abilities: ['setSpears'] }), step(1, 'red', 'cavalier', { abilities: ['momentum'] })] } },
    { evidence: true, label: 'C4 best case for Cav (side + wait/Charge) v Set Spears', def: { ...withUnits(S1_BASE, only('blue', 'pikeman', { facing: 'north' })), candidates: ['setSpears'], script: [...cavCharge, step(2, 'blue', 'pikeman', { abilities: ['setSpears'] })] } },
    { label: 'D1 candidate Whetstone (+2 Str) on the Cavaliers', def: { ...S1_BASE, candidates: ['whetstone'], loadouts: { red: { cavalier: ['whetstone'] } } } },
    { label: 'D2 candidate Bulwark (+2 Def) on the Pikemen', def: { ...S1_BASE, candidates: ['bulwark'], loadouts: { blue: { pikeman: ['bulwark'] } } } },
    { label: 'D3 candidate Whetstone on the Pikemen', def: { ...S1_BASE, candidates: ['whetstone'], loadouts: { blue: { pikeman: ['whetstone'] } } } },
    { label: 'E1 equal Supply: six Pikemen (6) v two Cavaliers (6)', def: { ...S1_BASE, units: [...pikeColumn('east', [3, 4, 5, 6, 7, 8]), ...cavPair()] } },
    { label: 'E2 Pikemen advance to meet the charge instead of holding', def: withUnits(S1_BASE, only('blue', 'pikeman', { stance: 'advance' })) },
  ],
};

// ---------- Suite 2: two Pikemen and an Archer v two Cavaliers ----------
const cavPair2 = () => cavPair([5, 6], 12);
const S2 = (over = {}) => ({ id: 'pike-archer-v-cav', map: 'flat_open', maxRounds: 10, units: [
  u('bp1', 'blue', 'pikeman', 6, 5, { stance: 'hold', facing: 'east' }), u('bp2', 'blue', 'pikeman', 6, 6, { stance: 'hold', facing: 'east' }),
  u('ba1', 'blue', 'archer', 5, 5, { stance: 'hold', facing: 'east' }), ...cavPair2()], ...over });
const S2_BASE = S2();
const moveArcher = (c, r) => (d) => withUnits(d, (x) => (x.id === 'ba1' ? { ...x, c, r } : x));
const movePike2 = (c, r) => (d) => withUnits(d, (x) => (x.id === 'bp2' ? { ...x, c, r } : x));

export const SUITE_PIKE_ARCHER_V_CAV = {
  id: 'pike-archer-v-cav',
  title: 'Two Pikemen and an Archer (hold) v two Cavaliers (advance)',
  question: 'What does adding an Archer to two Pikemen change against cavalry, and how much does formation (sheltered, gap, exposed) and preparation matter?',
  variants: [
    { label: 'A0 baseline: pikes (6,5),(6,6), Archer sheltered at (5,5)', def: S2_BASE },
    { label: 'F1 gap in the line: second Pike at (6,7), Archer (5,5) reachable through (6,6)', def: movePike2(6, 7)(S2_BASE) },
    { evidence: true, label: 'F2 Archer stands in the front line at (6,6) between Pikemen at (6,5) and (6,7)', def: withUnits(S2_BASE, (x) => (x.id === 'ba1' ? { ...x, c: 6, r: 6 } : x.id === 'bp2' ? { ...x, c: 6, r: 7 } : x)) },
    { label: 'A1 side attack (all face north)', def: withUnits(S2_BASE, only('blue', 'pikeman', { facing: 'north' })) },
    { label: 'B1 Cavaliers wait, then Charge (arrive round 2)', def: { ...S2_BASE, script: cavCharge } },
    { label: 'B2 wait round: Cav Charge v Archer Focused Shot (round 2)', def: { ...S2_BASE, script: [...cavCharge, step(2, 'blue', 'archer', { abilities: ['focusedShot'] })] } },
    { evidence: true, label: 'B3 wait round: Cav Charge v Focused Shot + Pike Brace', def: { ...S2_BASE, script: [...cavCharge, step(2, 'blue', 'archer', { abilities: ['focusedShot'] }), pikeBrace] } },
    { label: 'C1 candidate Set Spears on Pikemen (round 1)', def: { ...S2_BASE, candidates: ['setSpears'], script: [step(1, 'blue', 'pikeman', { abilities: ['setSpears'] })] } },
    { label: 'C2 candidate Momentum on Cavaliers (round 1)', def: { ...S2_BASE, candidates: ['momentum'], script: [step(1, 'red', 'cavalier', { abilities: ['momentum'] })] } },
    { label: 'D1 candidate Whetstone on the Archer', def: { ...S2_BASE, candidates: ['whetstone'], loadouts: { blue: { archer: ['whetstone'] } } } },
    { label: 'D2 candidate Bulwark on the Pikemen', def: { ...S2_BASE, candidates: ['bulwark'], loadouts: { blue: { pikeman: ['bulwark'] } } } },
    { label: 'E1 Archer swapped for a third Pikeman (three Pikemen, the Suite 1 line)', def: withUnits(S2_BASE, (x) => (x.id === 'ba1' ? { ...x, cls: 'pikeman', id: 'bp3', stance: 'hold' } : x)) },
  ],
};

// ---------- Suite 3: three separate Pikemen v one combined 2-star Pikeman ----------
// Both sides advance across open ground (8 tiles apart), so contact comes in round 2 or 3 and energy accrues
// on the way. Supply is equal (3 each: the 2-star is three 1-star recipes); population is 3 v 2.
const S3_BASE = { id: 'three-v-2star', map: 'flat_open', maxRounds: 14, units: [
  u('bp1', 'blue', 'pikeman', 4, 5, { stance: 'advance', facing: 'east' }), u('bp2', 'blue', 'pikeman', 4, 6, { stance: 'advance', facing: 'east' }), u('bp3', 'blue', 'pikeman', 4, 7, { stance: 'advance', facing: 'east' }),
  u('rp1', 'red', 'pikeman', 12, 6, { stance: 'advance', facing: 'west', stars: 2 })] };
const S3_HOLD = { ...S3_BASE, units: S3_BASE.units.map((x) => (x.id === 'rp1' ? { ...x, c: 8, r: 5, stance: 'hold' } : x)) };
const rallyAll = [step(1, 'blue', 'pikeman', { abilities: ['rally'] }), step(1, 'red', 'pikeman', { abilities: ['rally'] })];

export const SUITE_THREE_V_2STAR = {
  id: 'three-v-2star',
  title: 'Three 1-star Pikemen v one 2-star Pikeman (equal Supply, population 3 v 2)',
  question: 'Is combining three Pikemen worth the lost bodies? One strike per unit per round favours the three; what terrain, equipment or preparation lets the 2-star hold?',
  variants: [
    { label: 'A0 baseline: both advance on open ground', def: S3_BASE },
    { label: 'A1 2-star holds at (8,5) on open ground; Blue walks in', def: S3_HOLD },
    { evidence: true, label: 'T1 same, but (8,5) is a forest tile (+1 Def, +20 avoid)', def: { ...S3_HOLD, map: 'flat_forest_tile' } },
    { label: 'B1 both sides Rally (free, 10 HP, round 1 pick), both advance', def: { ...S3_BASE, script: rallyAll } },
    { evidence: true, label: 'B2 hold at (8,5): 2-star Rallies and Braces from round 2, Blue Rallies', def: { ...S3_HOLD, script: [step(1, 'red', 'pikeman', { abilities: ['rally'] }), step(2, 'red', 'pikeman', { abilities: ['rally', 'brace'] }), step(1, 'blue', 'pikeman', { abilities: ['rally'] })] } },
    { label: 'D1 candidate Bulwark (+2 Def) on the 2-star (+2 Supply)', def: { ...S3_BASE, candidates: ['bulwark'], loadouts: { red: { pikeman: ['bulwark'] } } } },
    { label: 'D2 candidate Whetstone (+2 Str) on the 2-star (+2 Supply)', def: { ...S3_BASE, candidates: ['whetstone'], loadouts: { red: { pikeman: ['whetstone'] } } } },
    { label: 'D3 candidate Whetstone on the three (+2 Supply)', def: { ...S3_BASE, candidates: ['whetstone'], loadouts: { blue: { pikeman: ['whetstone'] } } } },
    { label: 'D4 Barrier (shipped, 2 absorb per battle) on both', def: { ...S3_BASE, loadouts: { blue: { pikeman: ['barrier'] }, red: { pikeman: ['barrier'] } } } },
    { label: 'P1 equal population 3: Red is a 2-star plus a 1-star (Supply 4 v 3)', def: { ...S3_BASE, units: [...S3_BASE.units, u('rp2', 'red', 'pikeman', 12, 7, { stance: 'advance', facing: 'west' })] } },
    { label: 'P2 equal Supply 6: three 1-star + three 1-star v two 2-stars', def: { ...S3_BASE, units: [
      u('bp1', 'blue', 'pikeman', 4, 4, { stance: 'advance', facing: 'east' }), u('bp2', 'blue', 'pikeman', 4, 5, { stance: 'advance', facing: 'east' }), u('bp3', 'blue', 'pikeman', 4, 6, { stance: 'advance', facing: 'east' }),
      u('bp4', 'blue', 'pikeman', 4, 7, { stance: 'advance', facing: 'east' }), u('bp5', 'blue', 'pikeman', 4, 8, { stance: 'advance', facing: 'east' }), u('bp6', 'blue', 'pikeman', 4, 9, { stance: 'advance', facing: 'east' }),
      u('rp1', 'red', 'pikeman', 12, 5, { stance: 'advance', facing: 'west', stars: 2 }), u('rp2', 'red', 'pikeman', 12, 7, { stance: 'advance', facing: 'west', stars: 2 })] } },
  ],
};

// ---------- Suite 4: an attacking force v a defended keep ----------
// Red's keep is at 12,1. Blue advances with a tile objective on it from about 10 tiles away. Defenders hold.
// Attacker compositions all cost 6 Supply so only composition differs; the defender is Dreg on the keep with
// two Pikemen (Supply 2, population 3).
const defenders = (champion = true) => [
  ...(champion ? [u('dreg', 'red', 'dreg', 12, 1, { stance: 'hold', facing: 'south' })] : [u('rk', 'red', 'pikeman', 12, 1, { stance: 'hold', facing: 'south' })]),
  u('rp1', 'red', 'pikeman', 11, 1, { stance: 'hold', facing: 'west' }), u('rp2', 'red', 'pikeman', 12, 2, { stance: 'hold', facing: 'south' })];
const attackers = (cls, n, rowStart = 5) => Array.from({ length: n }, (_, i) => u(`b${cls[0]}${i + 1}`, 'blue', cls, 7 + (i % 2), rowStart + Math.floor(i / 2), { stance: 'advance', objective: [12, 1], facing: 'north' }));
const mixed = (list) => list.flatMap(([cls, n], k) => attackers(cls, n, 4 + k * 2).map((x, i) => ({ ...x, id: `b${cls[0]}${k}${i + 1}` })));
const S4 = (atk, over = {}) => ({ id: 'keep-assault', map: 'flat_open', maxRounds: 25, units: [...atk, ...defenders()], ...over });
const S4_BASE = S4(attackers('pikeman', 6));

export const SUITE_KEEP_ASSAULT = {
  id: 'keep-assault',
  title: 'Six Supply of attackers v a defended keep (Dreg on the keep, two holding Pikemen)',
  question: 'Which attacking composition, preparation or candidate card can take a keep held by a champion, and what does a reinforcement do?',
  variants: [
    { label: 'A0 baseline: six Pikemen (6 Supply, pop 6)', def: S4_BASE },
    { label: 'C1 two Cavaliers (6 Supply, pop 2)', def: S4(attackers('cavalier', 2)) },
    { label: 'C2 two Pikemen + two Archers (6 Supply, pop 4)', def: S4(mixed([['pikeman', 2], ['archer', 2]])) },
    { label: 'C3 three Pikemen + one Cavalier (6 Supply, pop 4)', def: S4(mixed([['pikeman', 3], ['cavalier', 1]])) },
    { label: 'C4 three Archers (6 Supply, pop 3)', def: S4(attackers('archer', 3)) },
    { evidence: true, label: 'G1 no champion: a third Pikeman holds the keep', def: { ...S4_BASE, units: [...attackers('pikeman', 6), ...defenders(false)] } },
    { evidence: true, label: 'R1 defender recruits a Pikeman and deploys it beside the keep in round 3', def: { ...S4_BASE, reinforce: [{ faction: 'red', cls: 'pikeman', id: 'rein1' }], script: [{ round: 3, faction: 'red', card: 'rein1', deploy: [13, 1] }] } },
    { label: 'R2 defender reinforces twice (rounds 2 and 4, tiles 13,1 and 12,0)', def: { ...S4_BASE, reinforce: [{ faction: 'red', cls: 'pikeman', id: 'rein1' }, { faction: 'red', cls: 'pikeman', id: 'rein2' }], script: [{ round: 2, faction: 'red', card: 'rein1', deploy: [13, 1] }, { round: 4, faction: 'red', card: 'rein2', deploy: [12, 0] }] } },
    { label: 'X1 large force: 4 Pikemen, 3 Archers, 1 Cavalier (13 Supply, pop 8)', def: S4(mixed([['pikeman', 4], ['archer', 3], ['cavalier', 1]])) },
    { label: 'X2 large force with Whetstone on Pikemen and Archers (+4 Supply)', def: { ...S4(mixed([['pikeman', 4], ['archer', 3], ['cavalier', 1]])), candidates: ['whetstone'], loadouts: { blue: { pikeman: ['whetstone'], archer: ['whetstone'] } } } },
    { evidence: true, label: 'D1 candidate Whetstone (+2 Str) on the six Pikemen (+2 Supply)', def: { ...S4_BASE, candidates: ['whetstone'], loadouts: { blue: { pikeman: ['whetstone'] } } } },
    { label: 'D2 Whetstone on the Cavaliers (2 Cav + 2 Supply)', def: { ...S4(attackers('cavalier', 2)), candidates: ['whetstone'], loadouts: { blue: { cavalier: ['whetstone'] } } } },
    { label: 'D3 candidate Bulwark (+2 Def) on the defending Pikemen', def: { ...S4_BASE, candidates: ['bulwark'], loadouts: { red: { pikeman: ['bulwark'] } } } },
    { label: 'M1 candidate Momentum + Charge on two Cavaliers (round 3 arrival)', def: { ...S4(attackers('cavalier', 2)), candidates: ['momentum'], script: [step(3, 'blue', 'cavalier', { abilities: ['charge', 'momentum'] })] } },
    { label: 'S1 two 2-star Pikemen (12 Supply, pop 4)', def: S4(Array.from({ length: 2 }, (_, i) => u(`bs${i + 1}`, 'blue', 'pikeman', 7 + i, 5, { stance: 'advance', objective: [12, 1], facing: 'north', stars: 2 }))) },
  ],
};

// ---------- Suite 5: the same assault across map shapes ----------
// Three Pikemen and an Archer (5 Supply, pop 4) advance on three Pikemen and an Archer (5 Supply, pop 4) holding
// the east side of a north-south river. Only the map changes. Nothing else is scripted.
const S5 = (map, over = {}) => ({ id: 'map-assault', map, maxRounds: 25, units: [
  u('bp1', 'blue', 'pikeman', 4, 4, { stance: 'advance', facing: 'east' }), u('bp2', 'blue', 'pikeman', 4, 5, { stance: 'advance', facing: 'east' }),
  u('bp3', 'blue', 'pikeman', 4, 6, { stance: 'advance', facing: 'east' }),
  u('ba1', 'blue', 'archer', 3, 5, { stance: 'advance', facing: 'east' }),
  u('rp1', 'red', 'pikeman', 9, 4, { stance: 'hold', facing: 'west' }), u('rp2', 'red', 'pikeman', 9, 6, { stance: 'hold', facing: 'west' }), u('rp3', 'red', 'pikeman', 10, 5, { stance: 'hold', facing: 'west' }),
  u('ra1', 'red', 'archer', 11, 5, { stance: 'hold', facing: 'west' })], ...over });

export const SUITE_MAP_ASSAULT = {
  id: 'map-assault',
  title: 'Three Pikemen and an Archer advance on three Pikemen and an Archer holding across a river, by map (equal Supply)',
  question: 'Do chokepoints, forest and the shipped river map help the defender, make the attack stall, or just add congestion?',
  variants: [
    { label: 'M0 flat open field', def: S5('flat_open') },
    { label: 'M1 river, three-tile crossing', def: S5('choke_gap3') },
    { label: 'M2 river, one-tile crossing', def: S5('choke_gap1') },
    { label: 'M3 forest belt, defenders at its far edge (attackers fight from the forest)', def: S5('forest_belt') },
    { label: 'M3b forest belt, defenders inside its west edge (attackers fight from open ground)', def: S5('forest_belt', { units: [
      u('bp1', 'blue', 'pikeman', 2, 4, { stance: 'advance', facing: 'east' }), u('bp2', 'blue', 'pikeman', 2, 5, { stance: 'advance', facing: 'east' }), u('bp3', 'blue', 'pikeman', 2, 6, { stance: 'advance', facing: 'east' }),
      u('ba1', 'blue', 'archer', 1, 5, { stance: 'advance', facing: 'east' }),
      u('rp1', 'red', 'pikeman', 6, 4, { stance: 'hold', facing: 'west' }), u('rp2', 'red', 'pikeman', 6, 6, { stance: 'hold', facing: 'west' }), u('rp3', 'red', 'pikeman', 7, 5, { stance: 'hold', facing: 'west' }),
      u('ra1', 'red', 'archer', 8, 5, { stance: 'hold', facing: 'west' })] }) },
    { label: 'M4 shipped River Ford (bridge, roads, forests)', def: S5('river_ford') },
    { label: 'M5 one-tile crossing, attackers carry Whetstone (+2 Str)', def: { ...S5('choke_gap1'), candidates: ['whetstone'], loadouts: { blue: { pikeman: ['whetstone'], archer: ['whetstone'] } } } },
    { label: 'M6 one-tile crossing, defenders are a 2-star at 9,5 plus the Archer (Supply 5 v 5, pop 4 v 3)', def: S5('choke_gap1', { units: S5('choke_gap1').units.filter((x) => !['rp2', 'rp3'].includes(x.id)).map((x) => (x.id === 'rp1' ? { ...x, stars: 2, r: 5 } : x)) }) },
  ],
};

export const SUITES = [SUITE_PIKES_V_CAV, SUITE_PIKE_ARCHER_V_CAV, SUITE_THREE_V_2STAR, SUITE_KEEP_ASSAULT, SUITE_MAP_ASSAULT];
