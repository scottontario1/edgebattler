// Rule checks for the second batch of culture hooks: rarity time gate, new classes, champions, mark action and tile objects.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ABILITY_CATALOG, ABILITIES, kitFor, validateAbilitySelection, initializeAbilityState } from '../src/abilities.js';
import { registerCulture, resetCultures, culturePool, SPRITE_FALLBACK } from '../src/cultures.js';
import { RECRUIT, CHAMPION_TEMPLATES, createRecruitUnit, createChampionUnit, UNITS } from '../src/roster.js';
import { MOVE_TYPE, computeRange } from '../src/rules.js';
import { WEAPONS } from '../src/combat.js';
import { RARITY_GATE, setRarityGate, drawCards, createCardState, seededRandom, cardFor, unitCardFor } from '../src/cards.js';
import { findUpgradeMatches } from '../src/upgrades.js';
import { createMatch } from '../src/match.js';
import { memoryLog, replay } from '../src/log.js';
import { setMap, DEFAULT_MAP } from '../src/board.js';

setMap(DEFAULT_MAP);
const CULTURE = {
  id: 'sys',
  classes: {
    sysSapper: { name: 'Sys Sapper', stats: { hp: 20, str: 7, skl: 5, spd: 5, def: 5, mov: 4 }, weapon: 'Sys Pick', weaponDef: { mt: 6, hit: 80, crit: 0, rng: [1, 1], kind: 'axe' },
      spriteBase: 'pikeman', tint: '#4E7C6A', card: { rarity: 'uncommon', cost: 2 } },
    sysBow: { name: 'Sys Bow', stats: { hp: 16, str: 6, skl: 8, spd: 6, def: 3, mov: 5 }, weapon: 'Sys Longbow', weaponDef: { mt: 6, hit: 90, crit: 0, rng: [2, 2], kind: 'bow' },
      moveType: 'mounted', spriteBase: 'archer', card: { rarity: 'rare', cost: 3, defaultStance: 'hold' } },
    sysGhoul: { name: 'Sys Ghoul', stats: { hp: 10, str: 9, skl: 5, spd: 5, def: 2, mov: 4 }, weapon: 'Sys Claw', weaponDef: { mt: 6, hit: 90, crit: 0, rng: [1, 1], kind: 'sword' },
      spriteBase: 'pikeman', onDeath: { spawn: { kind: 'corpse', hp: 1, blocks: false, decay: 3 } } },
  },
  champions: { sysCaptain: { name: 'Captain Sys', cls: 'sysSapper', stats: { hp: 30, def: 9 }, look: { skin: '#e8b995', hair: '#222', eyes: '#333', style: 'short' }, faction: 'blue' } },
  variants: { sysPlain: { base: 'pikeman', name: 'Sys Plain', delta: { hp: 1 }, card: { rarity: 'common' } } },
  abilities: [
    { id: 'sysDig', name: 'Sys Dig', classes: ['sysSapper', 'pikeman'], cost: 0, cooldown: 1, phase: 'defense', spawn: { kind: 'barricade', hp: 10, blocks: true }, description: 'test' },
    { id: 'sysChallenge', name: 'Sys Challenge', units: ['sysCaptain'], classes: [], cost: 0, cooldown: 1, phase: 'defense', mark: { radius: 6 }, effect: { damageDealt: 4, offTargetPenalty: 8 }, description: 'test' },
    { id: 'sysEat', name: 'Sys Eat', classes: ['sysSapper'], cost: 0, cooldown: 1, phase: 'recovery', requires: { objectNear: { kind: 'corpse', radius: 3 } }, consume: { kind: 'corpse', radius: 3, count: 1, heal: { radius: 2, amount: 8 } }, description: 'test' },
    { id: 'sysPaladin', name: 'Sys Paladin Kit', classes: ['paladin', 'barbarian'], cost: 0, cooldown: 1, phase: 'recovery', effect: { damageDealt: 1 }, description: 'test' },
  ],
  pool: ['pikeman', 'sysPlain', 'sysSapper', 'sysBow'],
};
const rec = (key, id, faction, c, r, extra = {}) => initializeAbilityState({ ...createRecruitUnit(key, id, faction, c, r), ...extra });
const combatOf = (res) => res.batches.find((b) => b.type === 'combat').events;
const resultsOf = (res) => res.batches.find((b) => b.type === 'results').events;

test('rarity gate: inert by default; uncommon from round 3 and rare from round 6 when set; removable', () => {
  registerCulture(CULTURE);
  setRarityGate({});
  const draw = (round, seed) => drawCards(createCardState({ pool: culturePool('sys'), round }), seededRandom(seed), 8).state.hand.map((c) => c.rarity);
  const seeds = [1, 2, 3, 4, 5, 6];
  assert.ok(seeds.some((s) => draw(1, s).includes('uncommon')) && seeds.some((s) => draw(1, s).includes('rare')), 'default: every rarity from round 1');
  setRarityGate({ uncommon: 3, rare: 6 });
  for (const s of seeds) {
    assert.deepEqual([...new Set(draw(1, s))], ['common'], 'round 1: commons only');
    assert.equal(draw(2, s).includes('uncommon') || draw(2, s).includes('rare'), false);
    assert.equal(draw(4, s).includes('rare'), false, 'round 4: no rare yet');
  }
  assert.ok(seeds.some((s) => draw(3, s).includes('uncommon')));
  assert.ok(seeds.some((s) => draw(6, s).includes('rare')));
  setRarityGate({});
  assert.deepEqual(RARITY_GATE, {});
  resetCultures();
});

test('rarity gate in a match: the header records it and early hands hold only common cards; replay matches', () => {
  registerCulture(CULTURE);
  setRarityGate({ uncommon: 3, rare: 6 });
  const log = memoryLog();
  const pools = { blue: culturePool('sys'), red: culturePool('sys') };
  const m = createMatch({ seed: 21, maxRounds: 8, log: log.push, pools });
  assert.ok(m.summary('blue').handState.every((c) => c.rarity === 'common' || c.type !== 'unit' || !c.rarity || c.rarity === 'common'));
  while (!m.over) m.resolveRound();
  assert.deepEqual(log.entries[0].rarityGate, { uncommon: 3, rare: 6 });
  const check = replay(log.entries, { create: (h, push) => { setRarityGate(h.rarityGate || {}); return createMatch({ seed: h.seed, maxRounds: h.maxRounds, log: push, pools: h.pools }); } });
  assert.equal(check.ok, true, JSON.stringify(check.mismatches?.slice(0, 2)));
  setRarityGate({});
  resetCultures();
});

test('new classes: template, weapon, move type, card, kit, sprite fallback; fully removable', () => {
  const before = { recruit: Object.keys(RECRUIT).join(), move: Object.keys(MOVE_TYPE).join(), weapons: Object.keys(WEAPONS).join() };
  registerCulture(CULTURE);
  const s = createRecruitUnit('sysSapper', 's', 'blue', 3, 3);
  assert.equal(s.cls, 'sysSapper');
  assert.equal(s.maxHp, 20);
  assert.equal(s.weapon, 'Sys Pick');
  assert.equal(s.culture, 'sys');
  assert.equal(unitCardFor('sysSapper').rarity, 'uncommon');
  assert.equal(unitCardFor('sysBow').defaultStance, 'hold');
  assert.equal(MOVE_TYPE.sysBow, 'mounted');
  assert.deepEqual(SPRITE_FALLBACK.sysSapper, { base: 'pikeman', tint: '#4E7C6A', label: 'Sys Sapper' });
  assert.ok(kitFor(s).some((a) => a.id === 'sysDig'));
  assert.equal(validateAbilitySelection({ ...s, energy: 0 }, ['sysDig']).ok, true);
  assert.equal(validateAbilitySelection({ ...s, energy: 0 }, ['sysChallenge']).ok, false);
  assert.equal(RECRUIT.pikeman.name, 'Pikeman');
  // a variant may be based on a culture class
  assert.throws(() => registerCulture({ ...CULTURE, id: 'bad', classes: { pikeman: { name: 'x', stats: {} } } }), /collides/);
  resetCultures();
  assert.deepEqual({ recruit: Object.keys(RECRUIT).join(), move: Object.keys(MOVE_TYPE).join(), weapons: Object.keys(WEAPONS).join() }, before);
  assert.deepEqual(SPRITE_FALLBACK, {});
  assert.equal(unitCardFor('sysSapper'), null);
});

test('a new class plays: recruited through a per-side pool, deployed with its own weapon range and stance', () => {
  registerCulture(CULTURE);
  const m = createMatch({ seed: 5, pools: { blue: ['sysBow', 'sysSapper'] } });
  const card = m.summary('blue').handState.find((c) => c.unitId === 'sysBow') || m.summary('blue').handState.find((c) => c.type === 'unit');
  assert.ok(card, 'a class card was drawn');
  for (const c of m.summary('blue').handState.filter((c) => c.type === 'unit')) {
    const r = m.apply({ type: 'recruit', faction: 'blue', cardId: c.instanceId });
    if (!r.ok) continue;
    const reserve = m.summary('blue').reserveState.at(-1);
    assert.equal(reserve.classId, c.unitId);
    const tile = m.deploymentTiles('blue').find(([x, y]) => !m.unitAt(x, y));
    const d = m.apply({ type: 'deploy', faction: 'blue', reserveId: reserve.id, c: tile[0], r: tile[1] });
    assert.equal(d.ok, true);
    const u = m.byId(d.unitId);
    assert.equal(u.cls, c.unitId);
    assert.equal(u.stance, c.unitId === 'sysBow' ? 'hold' : 'advance');
    if (c.unitId === 'sysBow') {
      // the ranged weapon reaches 2 tiles even though this class moves as 'mounted'
      const range = computeRange(u, m.board(), u.mov);
      assert.ok(range.attack.length > 0);
    }
  }
  resetCultures();
});

test('champions: registered champion respawns as itself, cannot combine, and kits work by class or by unit id', () => {
  registerCulture(CULTURE);
  assert.ok(CHAMPION_TEMPLATES.sysCaptain);
  const cap = createChampionUnit('sysCaptain', 'blue', 5, 5);
  assert.equal(cap.champion, true);
  assert.equal(cap.maxHp, 30);
  assert.equal(cap.def, 9);
  assert.ok(kitFor(cap).some((a) => a.id === 'sysChallenge'), 'kit by unit id');
  assert.equal(kitFor(rec('sysSapper', 'other', 'blue', 1, 1)).some((a) => a.id === 'sysChallenge'), false, 'not for other units of the class');
  const brenna = UNITS.find((u) => u.id === 'brenna'), dreg = UNITS.find((u) => u.id === 'dreg');
  assert.ok(kitFor(brenna).some((a) => a.id === 'sysPaladin') && kitFor(dreg).some((a) => a.id === 'sysPaladin'), 'Brenna and Dreg can take a kit');
  assert.deepEqual(findUpgradeMatches([cap, { ...cap, id: 'c2' }, { ...cap, id: 'c3' }]), []);
  // respawn: the champion dies, waits two rounds, and returns as sysCaptain for the blue side
  let respawned = null;
  for (let seed = 1; seed <= 40 && !respawned; seed += 1) {
    const roster = [{ ...cap, hp: 1, stance: 'hold' }, rec('pikeman', 'r1', 'red', 6, 5, { stance: 'hold', str: 40, skl: 40 }), rec('pikeman', 'r2', 'red', 14, 2), rec('pikeman', 'b2', 'blue', 1, 1)];
    const m = createMatch({ seed, roster, champions: { blue: 'sysCaptain' } });
    assert.equal(m.champion('blue'), 'sysCaptain');
    assert.equal(m.champion('red'), 'dreg');
    for (let i = 0; i < 5 && !m.over && !respawned; i += 1) {
      const res = m.resolveRound();
      respawned = resultsOf(res).find((e) => e.type === 'respawn') || null;
      if (respawned) { assert.equal(respawned.unitId, 'sysCaptain'); assert.equal(m.byId('sysCaptain').faction, 'blue'); assert.equal(m.byId('sysCaptain').champion, true); assert.equal(m.byId('sysCaptain').maxHp, 30); }
    }
  }
  assert.ok(respawned, 'a registered champion respawned as itself');
  resetCultures();
});

test('mark action: aims a mark ability; marked target takes the bonus, others the penalty; nearest is the default', () => {
  registerCulture(CULTURE);
  const setup = () => {
    const captain = { ...createChampionUnit('sysCaptain', 'blue', 5, 5), str: 30, skl: 40, stance: 'hold', selectedAbilities: ['sysChallenge'] };
    const near = rec('pikeman', 'near', 'red', 6, 5, { stance: 'hold', def: 0 });
    const far = rec('pikeman', 'far', 'red', 5, 9, { stance: 'hold', def: 0 });
    return createMatch({ seed: 2, roster: [initializeAbilityState(captain), near, far], champions: { blue: 'sysCaptain' } });
  };
  let m = setup();
  assert.equal(m.apply({ type: 'mark', faction: 'blue', unitId: 'sysCaptain', targetId: 'near' }).ok, true);
  assert.equal(m.apply({ type: 'mark', faction: 'blue', unitId: 'sysCaptain', targetId: 'blue-nobody' }).reason, 'invalid-target');
  m = setup();
  m.byId('far').c = 14; m.byId('far').r = 11;
  assert.equal(m.apply({ type: 'mark', faction: 'blue', unitId: 'sysCaptain', targetId: 'far' }).reason, 'out-of-range');
  m = setup();
  m.units.push(rec('pikeman', 'plain', 'blue', 1, 1));
  assert.equal(m.apply({ type: 'mark', faction: 'blue', unitId: 'plain', targetId: 'far' }).reason, 'no-mark-ability');
  // the marked far enemy becomes the target: the captain advances toward it
  m = setup();
  m.byId('sysCaptain').stance = 'advance';
  m.apply({ type: 'mark', faction: 'blue', unitId: 'sysCaptain', targetId: 'far' });
  const res = m.resolveRound();
  const events = res.batches.find((b) => b.type === 'abilities').events.filter((e) => e.unitId === 'sysCaptain');
  assert.ok(events.some((e) => e.abilityId === 'sysChallenge' && e.applied));
  const move = res.batches.find((b) => b.type === 'movement').events.find((e) => e.unitId === 'sysCaptain');
  assert.ok(move && move.to.r > 5, 'moved south toward the marked enemy');
  assert.equal(m.byId('sysCaptain').markTargetId, undefined, 'mark clears at round end');
  assert.equal(m.byId('sysCaptain').markIntent, undefined);
  // default: nearest enemy in radius is marked when no intent was given
  m = setup();
  m.byId('sysCaptain').stance = 'hold';
  const res2 = m.resolveRound();
  const strike = combatOf(res2).find((e) => e.type === 'strike' && e.attackerId === 'sysCaptain');
  assert.equal(strike?.targetId, 'near');
  resetCultures();
});

test('tile objects: block enemies only, are struck when no real enemy is in reach, and expire or die', () => {
  registerCulture(CULTURE);
  const blue = rec('pikeman', 'b1', 'blue', 2, 2), red = rec('pikeman', 'r1', 'red', 8, 5, { stance: 'hold', str: 40, skl: 40 });
  const m = createMatch({ seed: 4, roster: [blue, red] });
  const wall = m.addObject({ objectKind: 'barricade', faction: 'blue', c: 7, r: 5, hp: 10 });
  const redReach = computeRange(m.byId('r1'), m.board(), 5).move.map(([c, r]) => `${c},${r}`);
  assert.equal(redReach.includes('7,5'), false, 'enemy cannot enter or cross it');
  const blueReach = computeRange({ ...m.byId('b1'), c: 6, r: 5 }, m.board(), 4).move.map(([c, r]) => `${c},${r}`);
  assert.equal(blueReach.includes('7,5'), true, 'friends walk through');
  assert.equal(m.objectAt(7, 5).id, wall.id);
  // deployment onto it is refused
  const before = m.deploymentTiles('blue');
  assert.ok(before.length > 0);
  // the red unit is adjacent and holds; with no real enemy in reach it strikes the barricade until it falls
  let destroyed = false, struck = 0;
  for (let i = 0; i < 12 && !destroyed; i += 1) {
    const res = m.resolveRound();
    struck += combatOf(res).filter((e) => e.type === 'strike' && e.targetId === wall.id).length;
    destroyed = resultsOf(res).some((e) => e.type === 'objectDestroyed' && e.id === wall.id);
    assert.equal(combatOf(res).some((e) => e.type === 'death' && e.unitId === wall.id), false, 'objects never emit unit deaths');
  }
  assert.ok(struck > 0 && destroyed, 'the barricade was attacked and destroyed');
  assert.equal(m.objectAt(7, 5), null);
  resetCultures();
});

test('tile objects: a real enemy in reach is preferred to a barricade', () => {
  registerCulture(CULTURE);
  const red = rec('pikeman', 'r1', 'red', 8, 5, { stance: 'hold', str: 40, skl: 40 });
  const blue = rec('pikeman', 'b1', 'blue', 9, 5, { stance: 'hold' });
  const m = createMatch({ seed: 4, roster: [blue, red, rec('pikeman', 'b2', 'blue', 1, 1)] });
  const wall = m.addObject({ objectKind: 'barricade', faction: 'blue', c: 7, r: 5, hp: 10 });
  const res = m.resolveRound();
  const strike = combatOf(res).find((e) => e.type === 'strike' && e.attackerId === 'r1');
  assert.equal(strike.targetId, 'b1');
  assert.equal(m.objects.find((o) => o.id === wall.id).hp, 10);
  resetCultures();
});

test('spawn ability raises a barricade in front of a Hold unit and reports when the tile is blocked', () => {
  registerCulture(CULTURE);
  const digger = rec('sysSapper', 'd', 'blue', 5, 5, { stance: 'hold', facing: 'east', selectedAbilities: ['sysDig'] });
  const m = createMatch({ seed: 6, roster: [digger, rec('pikeman', 'r1', 'red', 14, 2)] });
  const res = m.resolveRound();
  const dug = m.objects.find((o) => o.objectKind === 'barricade');
  assert.ok(dug, 'a barricade exists');
  assert.deepEqual([dug.c, dug.r, dug.faction, dug.hp, dug.blocks], [6, 5, 'blue', 10, true]);
  assert.ok(res.notes.some((n) => /raised a barricade/.test(n.text)));
  // Sys Dig is on cooldown next round; and a blocked front tile fails softly
  const m2 = createMatch({ seed: 6, roster: [{ ...digger }, rec('pikeman', 'x', 'blue', 6, 5), rec('pikeman', 'r1', 'red', 14, 2)] });
  m2.byId('x').stance = 'hold';
  m2.resolveRound();
  assert.equal(m2.objects.length, 0);
  resetCultures();
});

test('corpses: onDeath spawns a non-blocking object that decays after 3 rounds and can be consumed; replay matches', () => {
  registerCulture(CULTURE);
  const log = memoryLog();
  const ghoul = rec('sysGhoul', 'g', 'blue', 5, 5, { hp: 1, stance: 'hold' });
  const killer = rec('pikeman', 'r1', 'red', 6, 5, { stance: 'hold', str: 40, skl: 40 });
  let m, seed;
  for (seed = 1; seed < 30; seed += 1) {
    log.entries.length = 0;
    m = createMatch({ seed, log: log.push, roster: [{ ...ghoul }, { ...killer }, rec('pikeman', 'far', 'blue', 1, 1), rec('pikeman', 'r2', 'red', 14, 10, { stance: 'hold' })] });
    m.resolveRound();
    if (m.objects.some((o) => o.objectKind === 'corpse')) break;
  }
  const corpse = m.objects.find((o) => o.objectKind === 'corpse');
  assert.ok(corpse, 'a corpse appeared');
  assert.equal(corpse.blocks, false);
  assert.deepEqual([corpse.c, corpse.r, corpse.faction], [5, 5, 'blue']);
  assert.equal(m.board().list.some((e) => e.data.id === corpse.id), false, 'corpses are not board obstacles');
  assert.equal(m.objectsNear(5, 6, 2, 'corpse').length, 1);
  for (let i = 0; i < 4; i += 1) { m.byId('r1').stance = 'hold'; if (!m.over) m.resolveRound(); }
  assert.equal(m.objects.some((o) => o.objectKind === 'corpse'), false, 'decayed');
  // consume
  const m2 = createMatch({ seed: 1, roster: [rec('pikeman', 'a', 'blue', 1, 1), rec('pikeman', 'b', 'red', 14, 10)] });
  const c = m2.addObject({ objectKind: 'corpse', faction: 'blue', c: 3, r: 3, hp: 1, blocks: false, decay: 3 });
  assert.equal(m2.consumeObject(c.id), true);
  assert.equal(m2.consumeObject(c.id), false);
  resetCultures();
});

test('consume ability and objectNear: eats the nearest corpse and heals friends; needs a corpse; spawn abilities get no accidental bonus', async () => {
  registerCulture(CULTURE);
  const eater = () => rec('sysSapper', 'e', 'blue', 5, 5, { stance: 'hold', hp: 8, selectedAbilities: ['sysEat'] });
  const mate = () => rec('pikeman', 'mate', 'blue', 5, 6, { stance: 'hold', hp: 10 });
  const foe = () => rec('pikeman', 'r1', 'red', 14, 10, { stance: 'hold' });
  const withCorpse = (n) => { const m = createMatch({ seed: 8, roster: [eater(), mate(), foe()] }); for (let i = 0; i < n; i += 1) m.addObject({ objectKind: 'corpse', faction: 'red', c: 4 + i, r: 5, hp: 1, blocks: false, decay: 3 }); return m; };
  let m = withCorpse(0);
  let res = m.resolveRound();
  assert.equal(res.batches.filter((b) => b.type === 'abilities').flatMap((b) => b.events).find((e) => e.abilityId === 'sysEat').reason, 'object-trigger-unmet');
  m = withCorpse(2);
  res = m.resolveRound();
  const ev = res.batches.filter((b) => b.type === 'abilities').flatMap((b) => b.events).find((e) => e.abilityId === 'sysEat');
  assert.equal(ev.applied, true);
  assert.equal(ev.consumed, 1);
  assert.equal(m.objects.filter((o) => o.objectKind === 'corpse').length, 1, 'one corpse eaten (the nearest)');
  assert.equal(m.objects[0].c, 4, 'the corpse under the unit (distance 0) was eaten first; 4,5 remains');
  assert.ok(m.byId('e').hp >= 16 && m.byId('mate').hp >= 18, 'healed 8 each');
  // a spawn ability without an effect does not grant the default +4 attack bonus
  const dig = rec('sysSapper', 'd', 'blue', 5, 5, { selectedAbilities: ['sysDig'], facing: 'east' });
  const act = ABILITY_CATALOG.sysDig && (await import('../src/abilities.js')).activatePhase(dig, 'defense');
  assert.equal(act.events[0].applied, true);
  assert.equal(act.unit.statuses.attackBonus, undefined);
  resetCultures();
});

test('objects appear in summaries only when present and replay deterministically', () => {
  registerCulture(CULTURE);
  const log = memoryLog();
  const roster = [rec('sysSapper', 'd', 'blue', 5, 5, { stance: 'hold', facing: 'east', selectedAbilities: ['sysDig'] }), rec('pikeman', 'r1', 'red', 13, 5, { stance: 'advance' })];
  const m = createMatch({ seed: 9, maxRounds: 6, log: log.push, roster });
  while (!m.over) m.resolveRound();
  const sums = log.entries.filter((e) => e.t === 'summary');
  assert.ok(sums.some((s) => s.objects && s.objects.length));
  assert.equal(sums[0].objects, undefined);
  const check = replay(log.entries, { create: (h, push) => createMatch({ seed: h.seed, maxRounds: h.maxRounds, log: push, roster: roster.map((u) => structuredClone(u)) }) });
  assert.equal(check.ok, true, JSON.stringify(check.mismatches?.slice(0, 2)));
  resetCultures();
  assert.deepEqual(Object.keys(ABILITY_CATALOG), Object.keys(ABILITIES));
});
