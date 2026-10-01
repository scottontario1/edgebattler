// Five single-player levels of rising difficulty. Each is a fixed battle (Blue = the player) that introduces a skill and
// shows what it does: the same level is played "naive" (default stances, no picks or spells) and "skilled" (the level's
// plan), and each skill is then removed from the skilled plan one at a time to isolate its effect. The enemy (Red)
// follows a fixed script, including its own energy preparation, and never plays cards. Shipped rules and cards only;
// level 5's last variant switches on candidate equipment. Run:
//   node experiments/combat/run.mjs --file experiments/levels/levels.mjs --suite all --seeds 400
//
// Steps carry a `tag` naming the skill; ablations drop the steps with that tag (the units keep their placement).

const u = (id, faction, cls, c, r, extra = {}) => ({ id, faction, cls, c, r, ...extra });
const DEFAULT_STANCE = { pikeman: 'advance', archer: 'hold', cavalier: 'advance' };
const step = (tag, round, faction, extra) => ({ tag, round, faction, ...extra });
const all = (tag, round, faction, cls, extra) => step(tag, round, faction, { cls, ...extra });

const NAMES = { rally: 'Rally', brace: 'Brace', focusedShot: 'Focused Shot', charge: 'Charge', secondWind: 'Second Wind' };
const without = (plan, id) => plan.map((s) => (s.abilities ? { ...s, abilities: s.abilities.filter((x) => x !== id) } : s));

/** Build the variant list for one level: naive, skilled, then skilled minus each ability everywhere, minus each spell or manoeuvre. */
function level({ id, title, teaches, map, maxRounds = 14, blue, red, hand = [], redScript = [], plan, extra = [], rules, candidates, reinforce, naivePlan = [], fallback = {} }) {
  const abilityIds = [...new Set(plan.flatMap((s) => s.abilities || []))];
  const tags = [...new Set(plan.filter((s) => s.tag && !s.abilities).map((s) => s.tag))];
  const base = { id, map, maxRounds, hand, ...(rules ? { rules } : {}), ...(candidates ? { candidates } : {}), ...(reinforce ? { reinforce } : {}) };
  const skilledUnits = [...blue, ...red];
  const naiveUnits = [...blue.map((x) => ({ ...x, stance: DEFAULT_STANCE[x.cls] || x.stance, objective: undefined })), ...red];
  const variants = [
    { evidence: true, label: 'N naive: default stances, no picks, no spells', def: { ...base, units: naiveUnits, script: [...naivePlan, ...redScript] } },
    { evidence: true, vs: 'N', label: `S skilled: ${teaches}`, def: { ...base, units: skilledUnits, script: [...plan, ...redScript] } },
    ...abilityIds.map((ab) => ({ vs: 'S', label: `S-${NAMES[ab]} skilled without ${NAMES[ab]}`, def: { ...base, units: skilledUnits, script: [...without(plan, ab), ...redScript] } })),
    ...tags.map((tag) => ({ vs: 'S', label: `S-${tag} skilled without ${tag}`, def: { ...base, units: skilledUnits, script: [...plan.filter((s) => s.tag !== tag), ...(fallback[tag] || []), ...redScript] } })),
    ...extra.map((x) => ({ vs: 'S', label: x.label, def: { ...base, ...x.def, units: x.units || skilledUnits, script: [...(x.plan || plan), ...redScript] } })),
  ];
  return { id, title, question: `What does ${teaches} change?`, variants };
}

// ---------- Level 1: Hold the Crossing (Hold, Rally, Brace) ----------
// Three Pikemen guard the west mouth of a one-tile river crossing against six Pikemen coming through it.
const L1 = level({
  id: 'level-1', title: 'Level 1: Hold the Crossing (Pikeman: Hold, Rally, Brace)', map: 'choke_gap1', maxRounds: 16,
  teaches: 'holding the crossing mouth with Rally every round and Brace when they arrive',
  blue: [u('bp1', 'blue', 'pikeman', 6, 4, { stance: 'hold', facing: 'east' }), u('bp2', 'blue', 'pikeman', 6, 6, { stance: 'hold', facing: 'east' }), u('bp3', 'blue', 'pikeman', 5, 5, { stance: 'hold', facing: 'east' })],
  red: [u('rp1', 'red', 'pikeman', 10, 4, { stance: 'advance', facing: 'west' }), u('rp2', 'red', 'pikeman', 10, 5, { stance: 'advance', facing: 'west' }), u('rp3', 'red', 'pikeman', 10, 6, { stance: 'advance', facing: 'west' }),
    u('rp4', 'red', 'pikeman', 11, 5, { stance: 'advance', facing: 'west' }), u('rp5', 'red', 'pikeman', 12, 5, { stance: 'advance', facing: 'west' }), u('rp6', 'red', 'pikeman', 13, 5, { stance: 'advance', facing: 'west' })],
  plan: [
    all('Rally', 1, 'blue', 'pikeman', { abilities: ['rally'] }),
    all('Brace', 2, 'blue', 'pikeman', { abilities: ['rally', 'brace'] }),
  ],
});

// ---------- Level 2: Arrow Rain (Archers: formation, Focused Shot) ----------
// Two Pikemen screen two Archers against three Pikemen (one arriving late) and a Cavalier. The Archers hold their fire a round to fund Focused Shot.
const L2 = level({
  id: 'level-2', title: 'Level 2: Arrow Rain (Archer: formation and Focused Shot)', map: 'flat_open', maxRounds: 14,
  teaches: 'a Pikeman screen with Archers behind it, Focused Shot from round 2 and Brace on the screen',
  blue: [u('bp1', 'blue', 'pikeman', 6, 5, { stance: 'hold', facing: 'east' }), u('bp2', 'blue', 'pikeman', 6, 6, { stance: 'hold', facing: 'east' }),
    u('ba1', 'blue', 'archer', 5, 5, { stance: 'hold', facing: 'east' }), u('ba2', 'blue', 'archer', 5, 6, { stance: 'hold', facing: 'east' })],
  red: [u('rp1', 'red', 'pikeman', 12, 4, { stance: 'advance', facing: 'west' }), u('rp2', 'red', 'pikeman', 12, 6, { stance: 'advance', facing: 'west' }), u('rp3', 'red', 'pikeman', 14, 5, { stance: 'advance', facing: 'west' }),
    u('rc1', 'red', 'cavalier', 13, 8, { stance: 'advance', facing: 'west' })],
  plan: [
    all('Focused Shot', 2, 'blue', 'archer', { abilities: ['focusedShot'] }),
    all('Brace', 2, 'blue', 'pikeman', { abilities: ['rally', 'brace'] }),
    all('Rally', 1, 'blue', 'pikeman', { abilities: ['rally'] }),
  ],
});

// ---------- Level 3: Ride Them Down (Cavalier: Charge, flank, Second Wind) ----------
// Two Cavaliers and two Pikemen attack a Pikeman-and-Archer line that faces west and Braces on contact.
const L3 = level({
  id: 'level-3', title: 'Level 3: Ride Them Down (Cavalier: Charge, flanking, Second Wind)', map: 'flat_open', maxRounds: 14,
  teaches: 'Pikemen pin the front while the Cavaliers wait a round, swing round the north end and Charge into the Archers\' side',
  blue: [u('bc1', 'blue', 'cavalier', 4, 1, { stance: 'advance', facing: 'east' }), u('bc2', 'blue', 'cavalier', 4, 2, { stance: 'advance', facing: 'east' }),
    u('bp1', 'blue', 'pikeman', 4, 5, { stance: 'advance', facing: 'east' }), u('bp2', 'blue', 'pikeman', 4, 6, { stance: 'advance', facing: 'east' })],
  red: [u('rp1', 'red', 'pikeman', 9, 4, { stance: 'hold', facing: 'west' }), u('rp2', 'red', 'pikeman', 9, 6, { stance: 'hold', facing: 'west' }),
    u('rp3', 'red', 'pikeman', 9, 5, { stance: 'hold', facing: 'west' }),
    u('ra1', 'red', 'archer', 10, 4, { stance: 'hold', facing: 'west' }), u('ra2', 'red', 'archer', 10, 5, { stance: 'hold', facing: 'west' }), u('ra3', 'red', 'archer', 10, 6, { stance: 'hold', facing: 'west' }), u('ra4', 'red', 'archer', 10, 3, { stance: 'hold', facing: 'west' })],
  redScript: [step(null, 2, 'red', { cls: 'pikeman', abilities: ['brace'] })],
  plan: [
    step('flank', 1, 'blue', { cls: 'cavalier', stance: 'hold' }),
    step('flank', 2, 'blue', { cls: 'cavalier', stance: 'advance', tile: [9, 1] }),
    step('flank', 3, 'blue', { cls: 'cavalier', stance: 'advance' }),
    step('Charge', 2, 'blue', { cls: 'cavalier', abilities: ['charge'] }),
    step('Second Wind', 3, 'blue', { cls: 'cavalier', abilities: ['charge', 'secondWind'] }),
    step('Rally', 1, 'blue', { cls: 'pikeman', abilities: ['rally'] }),
  ],
});

// ---------- Level 4: Cavalry Storm (spells: Fireburst, Ward, Mend; Brace) ----------
// Five Cavaliers stage for a Charge. Blue burns them while they stage, then Wards and Braces the line.
const L4 = level({
  id: 'level-4', title: 'Level 4: Cavalry Storm (Fireburst, Ward, Mend, Brace)', map: 'flat_open', maxRounds: 12,
  teaches: 'Fireburst on the staged Cavaliers, Ward on the centre, Brace on the line and Mend after',
  hand: [{ faction: 'blue', key: 'fireburst', n: 1 }, { faction: 'blue', key: 'ward', n: 2 }, { faction: 'blue', key: 'mend', n: 2 }],
  blue: [u('bp1', 'blue', 'pikeman', 6, 4, { stance: 'hold', facing: 'east' }), u('bp2', 'blue', 'pikeman', 6, 5, { stance: 'hold', facing: 'east' }), u('bp3', 'blue', 'pikeman', 6, 6, { stance: 'hold', facing: 'east' }),
    u('ba1', 'blue', 'archer', 5, 5, { stance: 'hold', facing: 'east' })],
  red: [u('rc1', 'red', 'cavalier', 12, 3, { stance: 'advance', facing: 'west' }), u('rc2', 'red', 'cavalier', 12, 4, { stance: 'advance', facing: 'west' }),
    u('rc3', 'red', 'cavalier', 12, 5, { stance: 'advance', facing: 'west' }), u('rc4', 'red', 'cavalier', 12, 6, { stance: 'advance', facing: 'west' }), u('rc5', 'red', 'cavalier', 12, 7, { stance: 'advance', facing: 'west' })],
  redScript: [step(null, 1, 'red', { cls: 'cavalier', stance: 'hold' }), step(null, 2, 'red', { cls: 'cavalier', stance: 'advance', abilities: ['charge'] })],
  plan: [
    step('Fireburst', 2, 'blue', { spell: 'fireburst', c: 12, r: 4 }),
    step('Ward', 2, 'blue', { spell: 'ward', unit: 'bp2' }),
    all('Brace', 2, 'blue', 'pikeman', { abilities: ['rally', 'brace'] }),
    all('Rally', 1, 'blue', 'pikeman', { abilities: ['rally'] }),
    step('Mend', 3, 'blue', { spell: 'mend', unit: 'bp2' }),
    step('Mend', 4, 'blue', { spell: 'mend', unit: 'bp1' }),
    all('Focused Shot', 3, 'blue', 'archer', { abilities: ['focusedShot'] }),
  ],
});

// ---------- Level 5: The Warlord's Keep (everything, plus the champion wall) ----------
// Two 2-star Pikemen, three Pikemen, two Archers and a Cavalier storm Dreg's keep (Dreg, six Pikemen with Brace,
// four Archers). Spells ignore Defense, which is the shipped way through the champion.
const L5_RED = [u('dreg', 'red', 'dreg', 12, 1, { stance: 'hold', facing: 'south' }), u('rp1', 'red', 'pikeman', 11, 1, { stance: 'hold', facing: 'west' }), u('rp2', 'red', 'pikeman', 12, 2, { stance: 'hold', facing: 'south' }), u('rp3', 'red', 'pikeman', 13, 1, { stance: 'hold', facing: 'south' }),
  u('ra1', 'red', 'archer', 11, 0, { stance: 'hold', facing: 'south' }), u('ra2', 'red', 'archer', 13, 2, { stance: 'hold', facing: 'south' }), u('ra3', 'red', 'archer', 12, 0, { stance: 'hold', facing: 'south' }), u('rp4', 'red', 'pikeman', 11, 2, { stance: 'hold', facing: 'west' }),
  u('rp5', 'red', 'pikeman', 13, 3, { stance: 'hold', facing: 'south' }), u('rp6', 'red', 'pikeman', 11, 3, { stance: 'hold', facing: 'west' }), u('ra4', 'red', 'archer', 12, 3, { stance: 'hold', facing: 'south' })];
const L5_BLUE = [u('bs1', 'blue', 'pikeman', 6, 6, { stance: 'advance', objective: [12, 1], facing: 'north', stars: 2 }), u('bs2', 'blue', 'pikeman', 6, 7, { stance: 'advance', objective: [12, 1], facing: 'north', stars: 2 }),
  u('bp1', 'blue', 'pikeman', 7, 5, { stance: 'advance', objective: [12, 1], facing: 'north' }), u('bp2', 'blue', 'pikeman', 7, 6, { stance: 'advance', objective: [12, 1], facing: 'north' }), u('bp3', 'blue', 'pikeman', 7, 7, { stance: 'advance', objective: [12, 1], facing: 'north' }),
  u('ba1', 'blue', 'archer', 5, 6, { stance: 'advance', objective: [12, 1], facing: 'north' }), u('ba2', 'blue', 'archer', 5, 7, { stance: 'advance', objective: [12, 1], facing: 'north' }),
  u('bc1', 'blue', 'cavalier', 5, 5, { stance: 'advance', objective: [12, 1], facing: 'north' })];
const L5 = level({
  id: 'level-5', title: "Level 5: The Warlord's Keep (all skills, champion wall)", map: 'flat_open', maxRounds: 20,
  teaches: 'a marching block with Rally (never Brace: it forces Hold), then Fireburst on the garrison and Ward on the front while Mend keeps the 2-stars up',
  hand: [{ faction: 'blue', key: 'fireburst', n: 1 }, { faction: 'blue', key: 'ward', n: 2 }, { faction: 'blue', key: 'mend', n: 2 }],
  blue: L5_BLUE, red: L5_RED,
  redScript: [step(null, 3, 'red', { cls: 'pikeman', abilities: ['brace'] })],
  plan: [
    all('Rally', 1, 'blue', 'pikeman', { abilities: ['rally'] }),
    all('Focused Shot', 4, 'blue', 'archer', { abilities: ['focusedShot'] }),
    step('Fireburst', 4, 'blue', { spell: 'fireburst', c: 12, r: 1 }),
    step('Ward', 4, 'blue', { spell: 'ward', unit: 'bs1' }),
    step('Ward', 5, 'blue', { spell: 'ward', unit: 'bs2' }),
    step('Mend', 6, 'blue', { spell: 'mend', unit: 'bs1' }),
  ],
  extra: [{ label: 'C candidate Whetstone (+2 Str) on all Pikemen and Archers (+4 Supply)', def: { candidates: ['whetstone'], loadouts: { blue: { pikeman: ['whetstone'], archer: ['whetstone'] } } } }],
});

// ---------- Level 6: Claim the Hamlet (villages extend the deployment area) ----------
// On the Hamlets map three Pikemen hold the east flank, nine tiles from Blue's keep, against six Pikemen arriving from the
// north-east. Blue claims the contested village at 10,9 in round 1 and, with village deployment range 4 (keep range 1), the
// three reserve Pikemen deploy beside it in round 2 and join the first clash. Deployed at the keep instead they need two more
// rounds to walk up while the line is ground down. The range itself is swept separately (docs/experiments/DEPLOY_AND_MUSTER.md).
const L6_KEEP = [[3, 10], [2, 9], [1, 10]];
const deployAt = (tag, round, ids, tiles) => ids.map((card, i) => step(tag, round, 'blue', { card, deploy: tiles[i] }));
const L6_CARDS = [{ faction: 'blue', cls: 'pikeman', id: 'rein1' }, { faction: 'blue', cls: 'pikeman', id: 'rein2' }, { faction: 'blue', cls: 'pikeman', id: 'rein3' }];
const L6_RED = [[13, 8], [13, 9], [13, 10], [14, 8], [14, 9], [14, 10]].map(([c, r], i) => u('rp' + (i + 1), 'red', 'pikeman', c, r, { stance: 'advance', facing: 'west' }));
const L6 = level({
  id: 'level-6', title: 'Level 6: Claim the Hamlet (village deployment range)', map: 'hamlets', maxRounds: 14,
  teaches: 'claiming the village at 10,9 in round 1 and deploying the reserves beside it in round 2',
  rules: { deployRangeKeep: 1, deployRangeVillage: 4 },
  reinforce: L6_CARDS,
  blue: [u('bp1', 'blue', 'pikeman', 9, 9, { stance: 'hold', facing: 'east' }), u('bp2', 'blue', 'pikeman', 9, 8, { stance: 'hold', facing: 'east' }), u('bp3', 'blue', 'pikeman', 9, 11, { stance: 'hold', facing: 'east' })],
  red: L6_RED,
  naivePlan: deployAt(null, 2, ['rein1', 'rein2', 'rein3'], L6_KEEP),
  plan: [
    step('claim', 1, 'blue', { unit: 'bp1', stance: 'advance', tile: [10, 9] }),
    step('claim', 2, 'blue', { unit: 'bp1', stance: 'hold' }),
    ...deployAt('forward', 2, ['rein1', 'rein2', 'rein3'], [[9, 9], [9, 10], [10, 10]]),
    all(null, 3, 'blue', 'pikeman', { stance: 'hold' }),
    all('Rally', 1, 'blue', 'pikeman', { abilities: ['rally'] }),
  ],
  fallback: { claim: [step(null, 1, 'blue', { unit: 'bp1', stance: 'advance' }), ...deployAt(null, 2, ['rein1', 'rein2', 'rein3'], L6_KEEP)], forward: deployAt(null, 2, ['rein1', 'rein2', 'rein3'], L6_KEEP) },
});

// ---------- Level 7: Muster the Line (candidate Muster action) ----------
// Five Pikemen advance on three holding Pikemen across open ground. With Muster (2 energy, cooldown 2) each front Pikeman
// puts a bench Archer on the empty tile behind it in round 2, in time to shoot over the line at the first clash; without it the bench deploys at
// the keep, nine tiles behind the line, and arrives after the first exchanges.
const L7_CARDS = [{ faction: 'blue', cls: 'archer', id: 'rein1' }, { faction: 'blue', cls: 'archer', id: 'rein2' }, { faction: 'blue', cls: 'archer', id: 'rein3' }];
const L7_RED = [[12, 4], [12, 5], [12, 6], [12, 7], [12, 8]].map(([c, r], i) => u('rp' + (i + 1), 'red', 'pikeman', c, r, { stance: 'advance', facing: 'west' }));
const musterAt = (tag, round) => [step(tag, round, 'blue', { card: 'rein1', unit: 'bp1', muster: [5, 5] }), step(tag, round, 'blue', { card: 'rein2', unit: 'bp2', muster: [5, 6] }), step(tag, round, 'blue', { card: 'rein3', unit: 'bp3', muster: [5, 7] })];
const L7 = level({
  id: 'level-7', title: 'Level 7: Muster the Line (candidate: Muster)', map: 'flat_open', maxRounds: 14,
  teaches: 'holding the line and mustering three bench Archers behind it in round 2',
  candidates: ['muster'], reinforce: L7_CARDS,
  blue: [u('bp1', 'blue', 'pikeman', 6, 5, { stance: 'hold', facing: 'east' }), u('bp2', 'blue', 'pikeman', 6, 6, { stance: 'hold', facing: 'east' }), u('bp3', 'blue', 'pikeman', 6, 7, { stance: 'hold', facing: 'east' })],
  red: L7_RED,
  naivePlan: deployAt(null, 2, ['rein1', 'rein2', 'rein3'], L6_KEEP),
  plan: [...musterAt('Muster', 2), all('Rally', 1, 'blue', 'pikeman', { abilities: ['rally'] })],
  fallback: { Muster: deployAt(null, 2, ['rein1', 'rein2', 'rein3'], L6_KEEP) },
});

export const SUITES = [L1, L2, L3, L4, L5, L6, L7];
