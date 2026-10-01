// Hollow Court scenarios (run with run-scenarios.mjs). Blue = Court, Red = shipped classes on a fixed script. Steps carry a `tag`
// naming the skill; the "S-x" variants drop the steps with that tag, and the "D" variants keep the plan but remove death mechanics
// from the culture (same stats). Units are placed by hand; no reinforcements, no champions (the champion kits are rule-checked in
// tests/faction-hollow-court.test.mjs).
const u = (id, faction, cls, c, r, extra = {}) => ({ id, faction, cls, c, r, ...extra });
const step = (tag, round, faction, extra) => ({ tag, round, faction, ...extra });
const all = (tag, round, faction, cls, extra) => step(tag, round, faction, { cls, ...extra });
const NAMES = { graveRally: 'Grave Rally', consumeRemains: 'Consume Remains', unquietStep: 'Unquiet Step', withering: 'Withering Grip', charge: 'Charge', secondWind: 'Second Wind', brace: 'Brace', rally: 'Rally' };
const without = (plan, id) => plan.map((s) => (s.abilities ? { ...s, abilities: s.abilities.filter((x) => x !== id) } : s));
const SHIPPED_ROLE = { graveguard: 'pikeman', feralGhoul: 'pikeman', wight: 'pikeman', necromancer: 'archer', mourningKnight: 'cavalier' };
const DEFAULT_STANCE = { graveguard: 'hold', feralGhoul: 'advance', wight: 'advance', necromancer: 'hold', mourningKnight: 'advance' };

function suite({ id, title, question, map, maxRounds = 14, blue, red, redScript = [], plan, skills = [], extra = [], blueUnits = blue.length, note = '' }) {
  // `plan` = scripted stances, manoeuvres and shipped-kit picks; Court skills (`skills`) are chosen each round by courtSkillPicks
  // (adaptive), so a removed skill is banned there. Shipped-kit picks in the plan are removed by id as in levels.mjs.
  const abilityIds = [...new Set(plan.flatMap((s) => s.abilities || []))];
  const tags = [...new Set(plan.filter((s) => s.tag && !s.abilities).map((s) => s.tag))];
  const base = { id, map, maxRounds };
  const naiveBlue = blue.map((x) => ({ ...x, stance: DEFAULT_STANCE[x.cls] || 'advance', objective: undefined }));
  // B keeps the plan's placement and stances (only the class changes), so S v B isolates the units themselves; `role` lets plan steps still find them
  const shipped = blue.map((x) => ({ ...x, role: x.cls, cls: SHIPPED_ROLE[x.cls] }));
  const shippedPlan = plan.map((s) => (s.abilities ? { ...s, abilities: s.abilities.filter((id) => ['charge', 'secondWind', 'brace', 'rally'].includes(id)) } : s));
  const v = (label, def, vs) => ({ label, ...(vs ? { vs } : {}), def: { ...base, culture: 'full', ...def } });
  const variants = [
    v('N naive: default stances, no skill picks, no spells', { units: [...naiveBlue, ...red], script: [...redScript] }),
    v('S skilled: the scenario plan', { adaptive: { ban: [] }, units: [...blue, ...red], script: [...plan, ...redScript] }, 'N'),
    ...abilityIds.map((ab) => v(`S-${NAMES[ab] || ab} skilled without ${NAMES[ab] || ab}`, { adaptive: { ban: [] }, units: [...blue, ...red], script: [...without(plan, ab), ...redScript] }, 'S')),
    ...skills.map((ab) => v(`S-${NAMES[ab] || ab} skilled without ${NAMES[ab] || ab}`, { adaptive: { ban: [ab] }, units: [...blue, ...red], script: [...plan, ...redScript] }, 'S')),
    ...tags.map((t) => v(`S-${t} skilled without ${t}`, { units: [...blue, ...red], script: [...plan.filter((s) => s.tag !== t), ...redScript], adaptive: { ban: [] } }, 'S')),
    v('D skilled, same army, ALL death mechanics removed', { culture: 'noDeath', adaptive: { ban: [] }, units: [...blue, ...red], script: [...plan, ...redScript] }, 'S'),
    v('D-corpse skilled, no corpses (nothing to eat or feed on)', { culture: 'noCorpses', adaptive: { ban: [] }, units: [...blue, ...red], script: [...plan, ...redScript] }, 'S'),
    v('D-revenant skilled, no Revenant Vow', { culture: 'noRevenant', adaptive: { ban: [] }, units: [...blue, ...red], script: [...plan, ...redScript] }, 'S'),
    v('D-consume skilled, no corpse-eating skills', { culture: 'noConsume', adaptive: { ban: [] }, units: [...blue, ...red], script: [...plan, ...redScript] }, 'S'),
    v('D-passive skilled, no corpse-reading passives', { culture: 'noPassives', adaptive: { ban: [] }, units: [...blue, ...red], script: [...plan, ...redScript] }, 'S'),
    ...extra.map((x) => v(x.label, { culture: x.culture || 'full', adaptive: { ban: [] }, units: [...x.blue, ...red], script: [...plan, ...redScript] }, x.vs || 'S')),
    v('B same roles and plan, shipped classes, no skill picks (no culture)', { culture: null, units: [...shipped, ...red], script: [...shippedPlan, ...redScript] }, 'S'),
  ];
  return { id, title, question, blueUnits, variants, note };
}

const red = (cls, id, c, r, extra = {}) => u(id, 'red', cls, c, r, { stance: 'advance', facing: 'west', ...extra });

// ---------- 1. The Ossuary Line: corpses as fuel ----------
// Two ghouls hold the ground in front of the Graveguards and die on their doorstep; the Necromancer and Graveguards eat what they leave. Six Red units
// (five Pikemen, one Archer) come down the field. The claim: the same Court army holds better when its dead are worth something.
const S1 = suite({
  id: 'court-1', title: 'Scenario 1: The Ossuary Line (corpses as fuel)', map: 'flat_open', maxRounds: 16,
  question: 'Does the line hold longer when its fallen can be eaten and fed on than the identical army with no corpses?',
  blue: [u('g1', 'blue', 'feralGhoul', 7, 4, { stance: 'hold', facing: 'east' }), u('g2', 'blue', 'feralGhoul', 7, 6, { stance: 'hold', facing: 'east' }),
    u('gg1', 'blue', 'graveguard', 6, 4, { stance: 'hold', facing: 'east' }), u('gg2', 'blue', 'graveguard', 6, 5, { stance: 'hold', facing: 'east' }), u('gg3', 'blue', 'graveguard', 6, 6, { stance: 'hold', facing: 'east' }),
    u('w1', 'blue', 'wight', 5, 6, { stance: 'hold', facing: 'east' }), u('n1', 'blue', 'necromancer', 5, 5, { stance: 'hold', facing: 'east' })],
  red: [red('pikeman', 'rp1', 11, 4), red('pikeman', 'rp2', 11, 5), red('pikeman', 'rp3', 11, 6), red('pikeman', 'rp4', 12, 4), red('pikeman', 'rp5', 12, 6), red('archer', 'ra1', 12, 5)],
  plan: [
    // once the first wave has broken on the line, everyone goes forward to finish it
    ...['graveguard', 'wight', 'feralGhoul'].map((cls) => all(null, 5, 'blue', cls, { stance: 'advance' })),
    all(null, 5, 'blue', 'necromancer', { stance: 'advance' }),
  ],
  skills: ['graveRally', 'consumeRemains', 'withering'],
});

// ---------- 2. The Knight Who Would Not Fall: Revenant ----------
// A Mourning Knight holds the centre of a small Court line against a Red push aimed at whatever is nearest (the Knight). It is
// killed once and returns; the Necromancer heals it back into the fight. The claim: one lethal blow does not remove it.
const S2 = suite({
  id: 'court-2', title: 'Scenario 2: The Knight Who Would Not Fall (Revenant Vow)', map: 'flat_open', maxRounds: 14,
  question: 'How often is the Knight really gone, and what does it still do after it was killed?',
  blue: [u('k1', 'blue', 'mourningKnight', 7, 5, { stance: 'hold', facing: 'east' }), u('gg1', 'blue', 'graveguard', 7, 4, { stance: 'hold', facing: 'east' }), u('gg2', 'blue', 'graveguard', 7, 6, { stance: 'hold', facing: 'east' }),
    u('g1', 'blue', 'feralGhoul', 8, 5, { stance: 'advance', facing: 'east' }), u('n1', 'blue', 'necromancer', 6, 5, { stance: 'hold', facing: 'east' })],
  red: [red('pikeman', 'rp1', 11, 4), red('pikeman', 'rp2', 11, 5), red('pikeman', 'rp3', 11, 6), red('pikeman', 'rp4', 12, 5), red('cavalier', 'rc1', 13, 5), red('cavalier', 'rc2', 13, 4)],
  plan: [
    step(null, 2, 'blue', { unit: 'k1', stance: 'advance', abilities: ['charge'] }),
    step(null, 3, 'blue', { unit: 'k1', abilities: ['secondWind'] }),
    step(null, 4, 'blue', { unit: 'k1', stance: 'hold' }),
  ],
  skills: ['graveRally', 'consumeRemains'],
});

// ---------- 3. Feast at the Breach: corpses as offence ----------
// Four ghouls and two Wights march on a held line (two Pikemen and two Archers, the Pikemen Bracing). Ghouls fall first;
// the Wights hit harder standing among them, and the Necromancer keeps the wounded up. The claim: a costly assault gets cheaper
// as it goes.
const S3 = suite({
  id: 'court-3', title: 'Scenario 3: Feast at the Breach (corpses as offence)', map: 'flat_open', maxRounds: 14,
  question: 'Does an assault that leaves corpses behind hit harder than the same assault with no corpses?',
  blue: [u('g1', 'blue', 'feralGhoul', 4, 4, { stance: 'advance', facing: 'east' }), u('g2', 'blue', 'feralGhoul', 4, 5, { stance: 'advance', facing: 'east' }), u('g3', 'blue', 'feralGhoul', 4, 6, { stance: 'advance', facing: 'east' }), u('g4', 'blue', 'feralGhoul', 4, 7, { stance: 'advance', facing: 'east' }),
    u('w1', 'blue', 'wight', 3, 5, { stance: 'advance', facing: 'east' }), u('w2', 'blue', 'wight', 3, 6, { stance: 'advance', facing: 'east' }), u('n1', 'blue', 'necromancer', 2, 5, { stance: 'advance', facing: 'east' })],
  red: [red('pikeman', 'rp1', 10, 4, { stance: 'hold' }), red('pikeman', 'rp2', 10, 6, { stance: 'hold' }),
    red('archer', 'ra1', 11, 4, { stance: 'hold' }), red('archer', 'ra2', 11, 6, { stance: 'hold' })],
  redScript: [step(null, 2, 'red', { cls: 'pikeman', abilities: ['brace'] })],
  plan: [],
  skills: ['consumeRemains', 'unquietStep', 'withering'],
});

// ---------- 4. The Keep Race: the limit of the idea ----------
// Two Red Cavaliers and two Pikemen march on the Court's keep while the Court's slow line is a long way from it. Corpses and Revenant convert
// value only where the fighting is; they cannot stop a keep capture. Reported as a weakness (FACTIONS.md: "weak to fast keep
// capture"): the death mechanics should change little here.
const S4 = suite({
  id: 'court-4', title: 'Scenario 4: The Keep Race (the limit of the idea)', map: 'flat_open', maxRounds: 12,
  question: 'Do the death mechanics help when the enemy simply rides for the keep?',
  blue: [u('gg1', 'blue', 'graveguard', 6, 6, { stance: 'hold', facing: 'east' }), u('gg2', 'blue', 'graveguard', 6, 7, { stance: 'hold', facing: 'east' }), u('g1', 'blue', 'feralGhoul', 5, 8, { stance: 'advance', facing: 'east' }), u('g2', 'blue', 'feralGhoul', 4, 9, { stance: 'advance', facing: 'east' }),
    u('n1', 'blue', 'necromancer', 4, 7, { stance: 'hold', facing: 'east' }), u('k1', 'blue', 'mourningKnight', 7, 6, { stance: 'advance', facing: 'east' })],
  red: [red('cavalier', 'rc1', 12, 4, { objective: [2, 10] }), red('cavalier', 'rc2', 12, 6, { objective: [2, 10] }), red('pikeman', 'rp1', 11, 5, { objective: [2, 10] }), red('pikeman', 'rp2', 12, 5, { objective: [2, 10] })],
  plan: [
    step('Screen', 1, 'blue', { cls: 'feralGhoul', stance: 'advance', tile: [8, 7] }),
    step('Screen', 2, 'blue', { cls: 'feralGhoul', stance: 'advance' }),
  ],
  skills: ['graveRally', 'consumeRemains', 'unquietStep'],
  // The same army, but a Graveguard stands on the keep tile itself and the Necromancer beside it, so the keep cannot simply be walked onto.
  extra: [
    { label: 'G garrison: a Graveguard on the keep tile, Necromancer beside it', vs: 'S', blue: [u('gg1', 'blue', 'graveguard', 2, 10, { stance: 'hold', facing: 'east' }), u('gg2', 'blue', 'graveguard', 3, 10, { stance: 'hold', facing: 'east' }), u('g1', 'blue', 'feralGhoul', 3, 9, { stance: 'hold', facing: 'east' }), u('g2', 'blue', 'feralGhoul', 4, 10, { stance: 'hold', facing: 'east' }),
      u('n1', 'blue', 'necromancer', 2, 9, { stance: 'hold', facing: 'east' }), u('k1', 'blue', 'mourningKnight', 4, 9, { stance: 'hold', facing: 'east' })] },
    { label: 'G-D the same garrison with ALL death mechanics removed', vs: 'G', culture: 'noDeath', blue: [u('gg1', 'blue', 'graveguard', 2, 10, { stance: 'hold', facing: 'east' }), u('gg2', 'blue', 'graveguard', 3, 10, { stance: 'hold', facing: 'east' }), u('g1', 'blue', 'feralGhoul', 3, 9, { stance: 'hold', facing: 'east' }), u('g2', 'blue', 'feralGhoul', 4, 10, { stance: 'hold', facing: 'east' }),
      u('n1', 'blue', 'necromancer', 2, 9, { stance: 'hold', facing: 'east' }), u('k1', 'blue', 'mourningKnight', 4, 9, { stance: 'hold', facing: 'east' })] },
  ],
});

export const SUITES = [S1, S2, S3, S4];
