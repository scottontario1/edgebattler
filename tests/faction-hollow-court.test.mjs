// Rule checks for the Hollow Court (src/factions/hollow-court.js): every unit, passive, skill, spell, corpse behaviour, the
// revenant and the champion kits. Each test registers the culture itself and resets it, so nothing leaks between checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerAbilities, unregisterAbilities, ABILITY_CATALOG, ABILITIES, SPELL_CATALOG, SPELLS, kitFor, validateAbilitySelection, initializeAbilityState } from '../src/abilities.js';
import { registerCulture, resetCultures, culturePool, SPRITE_FALLBACK, ACTIVE_CULTURES } from '../src/cultures.js';
import { RECRUIT, VARIANTS, CHAMPION_TEMPLATES, createRecruitUnit, createChampionUnit, UNITS } from '../src/roster.js';
import { MOVE_TYPE } from '../src/rules.js';
import { WEAPONS } from '../src/combat.js';
import { setRarityGate, drawCards, createCardState, seededRandom, unitCardFor, cardFor, RARITY_GATE } from '../src/cards.js';
import { findUpgradeMatches, combineUnits } from '../src/upgrades.js';
import { createMatch } from '../src/match.js';
import { memoryLog, replay } from '../src/log.js';
import { setMap, DEFAULT_MAP } from '../src/board.js';
import flatOpen from '../experiments/maps/flat_open.js';
import HOLLOW_COURT, { buildHollowCourt, COURT, COURT_POOL, COURT_RARITY, COURT_CHAMPIONS, DEFAULT_CHAMPION, courtRoster } from '../src/factions/hollow-court.js';

setMap(flatOpen); // plain ground so terrain never changes a number
const court = () => registerCulture(HOLLOW_COURT);
const done = () => { setRarityGate({}); resetCultures(); };
// A unit that always hits and cannot be dodged, so strike damage is exact.
const sure = { skl: 60 };
const rec = (key, id, faction, c, r, extra = {}) => initializeAbilityState({ ...createRecruitUnit(key, id, faction, c, r), ...extra });
const combatOf = (res) => res.batches.find((b) => b.type === 'combat').events;
const resultsOf = (res) => res.batches.find((b) => b.type === 'results').events;
const abilityEvents = (res) => res.batches.filter((b) => b.type === 'abilities').flatMap((b) => b.events);
// A crit triples the whole strike before flat reductions, so a bonus of n is worth 3n on a crit. Comparisons run on the same seed
// (same dice), so both strikes crit or neither does; `bonus` checks that and returns the difference in units of n.
const bonus = (a, b) => { assert.equal(a.crit, b.crit, 'same dice'); return (a.damage - b.damage) / (a.crit ? 3 : 1); };
const strike = (res, attackerId) => combatOf(res).find((e) => e.type === 'strike' && e.attackerId === attackerId);
const far = () => rec('pikeman', 'far-red', 'red', 15, 11, { stance: 'hold' }); // keeps the match alive, out of everything
const farBlue = () => rec('pikeman', 'far-blue', 'blue', 0, 0, { stance: 'hold' });
const corpse = (m, c, r, faction = 'blue') => m.addObject({ objectKind: 'corpse', faction, c, r, hp: 1, blocks: false, decay: 3 });
/** A red pikeman that always hits hard, standing next to `target` and holding. */
const hitter = (id, c, r, extra = {}) => rec('pikeman', id, 'red', c, r, { stance: 'hold', str: 30, ...sure, ...extra });
const round1 = (roster, seed = 3, setup = () => {}) => { const m = createMatch({ seed, roster }); setup(m); return { m, res: m.resolveRound() }; };

test('importing the module registers nothing; register and reset leave every shared table as it was', () => {
  const before = { recruit: Object.keys(RECRUIT).join(), move: Object.keys(MOVE_TYPE).join(), weapons: Object.keys(WEAPONS).join(), variants: Object.keys(VARIANTS).join() };
  assert.equal(ACTIVE_CULTURES.length, 0);
  assert.equal(unitCardFor('feralGhoul'), null);
  court();
  assert.deepEqual(ACTIVE_CULTURES, ['court']);
  for (const id of ['unquietStep', 'withering', 'graveRally', 'consumeRemains', 'sovereignStand', 'decreeOfAttendance']) assert.ok(ABILITY_CATALOG[id], id);
  assert.ok(SPELL_CATALOG.graveChill && SPELL_CATALOG.mendBone);
  done();
  assert.deepEqual({ recruit: Object.keys(RECRUIT).join(), move: Object.keys(MOVE_TYPE).join(), weapons: Object.keys(WEAPONS).join(), variants: Object.keys(VARIANTS).join() }, before);
  assert.deepEqual(Object.keys(ABILITY_CATALOG), Object.keys(ABILITIES));
  assert.deepEqual(Object.keys(SPELL_CATALOG), Object.keys(SPELLS));
  assert.deepEqual(SPRITE_FALLBACK, {});
  assert.equal(Object.keys(CHAMPION_TEMPLATES).length, 0);
  assert.equal(unitCardFor('feralGhoul'), null);
});

test('court kits never leak to the shipped classes or to Brenna and Dreg', () => {
  court();
  const courtIds = ['unquietStep', 'withering', 'graveRally', 'consumeRemains', 'sovereignStand', 'chancelleryAudit', 'holdBeyondDeath', 'decreeOfAttendance', 'ledgerOfTheDead'];
  for (const u of [{ cls: 'pikeman' }, { cls: 'archer' }, { cls: 'cavalier' }, UNITS.find((x) => x.id === 'brenna'), UNITS.find((x) => x.id === 'dreg')]) {
    assert.equal(kitFor(u).some((a) => courtIds.includes(a.id)), false, `${u.cls} has no court ability`);
  }
  // the Mourning Knight is a cavalier variant, so it keeps the shipped cavalier kit and only that
  const knight = createRecruitUnit('mourningKnight', 'k', 'blue', 5, 5);
  assert.deepEqual(kitFor(knight).map((a) => a.id).sort(), ['charge', 'secondWind']);
  done();
});

test('unit sheet: stats, weapons, move types, cards, rarities and placeholder art', () => {
  court();
  const N = COURT;
  const ghoul = createRecruitUnit('feralGhoul', 'g', 'blue', 1, 1);
  assert.deepEqual([ghoul.cls, ghoul.name, ghoul.maxHp, ghoul.str, ghoul.def, ghoul.mov, ghoul.weapon, ghoul.culture], ['feralGhoul', 'Feral Ghoul', 16, 7, 3, 6, 'Ghoul Claws', 'court']);
  // spec deltas from the Pikeman: HP -8, Str -1, Def -6, Mov +2
  const pike = RECRUIT.pikeman;
  assert.deepEqual([ghoul.maxHp - pike.hp, ghoul.str - pike.str, ghoul.def - pike.def, ghoul.mov - pike.mov], [-8, -1, -6, 2]);
  assert.equal(unitCardFor('feralGhoul').cost, N.ghoul.cost);
  assert.equal(unitCardFor('feralGhoul').cost, cardFor('pikeman').cost - 1, 'one cheaper than a Pikeman');
  const guard = createRecruitUnit('graveguard', 'gg', 'blue', 1, 1);
  assert.deepEqual([guard.maxHp - pike.hp, guard.mov, guard.weapon], [2, pike.mov, 'Grave Halberd']);
  assert.equal(WEAPONS['Grave Halberd'].kind, 'lance');
  assert.equal(unitCardFor('graveguard').defaultStance, 'hold');
  const wight = createRecruitUnit('wight', 'w', 'blue', 1, 1);
  assert.deepEqual([wight.maxHp, wight.def, wight.weapon], [20, 6, 'Wight Blade']);
  const necro = createRecruitUnit('necromancer', 'n', 'blue', 1, 1);
  assert.deepEqual([necro.maxHp, necro.mag, necro.def, necro.weapon], [16, 2, 2, 'Lantern Staff']);
  assert.deepEqual(WEAPONS['Lantern Staff'].rng, [1, 2]);
  assert.equal(WEAPONS['Lantern Staff'].magic, true);
  assert.equal(unitCardFor('necromancer').defaultStance, 'hold');
  assert.equal(unitCardFor('necromancer').range, 2);
  const knight = createRecruitUnit('mourningKnight', 'k', 'blue', 1, 1);
  assert.deepEqual([knight.cls, knight.variantId, knight.maxHp - RECRUIT.cavalier.hp, knight.def - RECRUIT.cavalier.def, knight.mov], ['cavalier', 'mourningKnight', 2, 2, RECRUIT.cavalier.mov]);
  assert.equal(MOVE_TYPE.mourningKnight, undefined, 'the knight rides as a plain cavalier');
  // every unit is modest: nothing out-stats a Pikeman on both HP and Defense, and no Court recruit hits harder than a Pikeman
  for (const u of [ghoul, guard, wight, necro, knight]) assert.ok(u.str <= RECRUIT.cavalier.str && u.maxHp <= RECRUIT.cavalier.hp + 2, `${u.name} is modest`);
  for (const [key, rarity] of Object.entries(COURT_RARITY)) assert.equal(cardFor(key).rarity, rarity, key);
  assert.equal(cardFor('feralGhoul').rarity, 'common');
  assert.equal(cardFor('mourningKnight').rarity, 'rare');
  assert.deepEqual(SPRITE_FALLBACK.feralGhoul, { base: 'pikeman', tint: '#a5a396', label: 'Feral Ghoul' });
  assert.equal(SPRITE_FALLBACK.necromancer.base, 'archer');
  assert.equal(SPRITE_FALLBACK.mourningKnight.base, 'cavalier');
  done();
});

test('pool: Court cards plus the shared spells only, weights as listed, and every key resolves to a card', () => {
  court();
  const pool = culturePool('court');
  assert.deepEqual(pool, [...COURT_POOL]);
  for (const key of pool) assert.ok(cardFor(key), key);
  for (const shared of ['mend', 'ward', 'fireburst']) assert.ok(pool.includes(shared));
  for (const shipped of ['pikeman', 'archer', 'cavalier', 'barrier']) assert.equal(pool.includes(shipped), false, `${shipped} is not a Court card`);
  assert.equal(pool.filter((k) => k === 'feralGhoul').length, 3, 'the ghoul is the common front');
  done();
});

test('rarity gate: only common Court cards before round 3; uncommon from 3; the rare Knight from 6', () => {
  court();
  const draw = (round, seed) => drawCards(createCardState({ pool: culturePool('court'), round }), seededRandom(seed), 8).state.hand.map((c) => c.id);
  const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
  setRarityGate({ uncommon: 3, rare: 6 });
  const commons = new Set(['unit-feralGhoul', 'spell-graveChill', 'spell-mend', 'spell-ward', 'spell-fireburst']);
  for (const s of seeds) for (const id of draw(1, s)) assert.ok(commons.has(id), `round 1 draws ${id}`);
  assert.ok(seeds.some((s) => draw(3, s).includes('unit-graveguard')) && seeds.some((s) => draw(3, s).includes('unit-wight')));
  for (const s of seeds) assert.equal(draw(5, s).includes('unit-mourningKnight'), false, 'no Knight before round 6');
  assert.ok(seeds.some((s) => draw(6, s).includes('unit-mourningKnight')));
  setRarityGate({});
  assert.deepEqual(RARITY_GATE, {});
  done();
});

test('Feral Ghoul: leaves a non-blocking Corpse that decays after 3 rounds; the front does not block or heal on its own', () => {
  court();
  const ghoul = rec('feralGhoul', 'g', 'blue', 5, 5, { hp: 1, stance: 'hold' });
  let m = null, seed;
  for (seed = 1; seed < 40; seed += 1) {
    m = createMatch({ seed, roster: [ghoul, hitter('r1', 6, 5), farBlue(), far()] });
    m.resolveRound();
    if (m.objects.some((o) => o.objectKind === 'corpse')) break;
  }
  const dead = m.objects.find((o) => o.objectKind === 'corpse');
  assert.ok(dead, 'a corpse appeared where the ghoul fell');
  assert.deepEqual([dead.c, dead.r, dead.faction, dead.blocks, dead.decay], [5, 5, 'blue', false, COURT.corpseDecay - 1]);
  assert.equal(m.alive('blue').some((u) => u.id === 'g'), false);
  for (let i = 0; i < 2; i += 1) m.resolveRound();
  assert.equal(m.objects.some((o) => o.objectKind === 'corpse'), false, 'gone after the 3-round decay');
  done();
});

test('Hunger: a struck ghoul gains 1 energy in that battle, once; a plain pikeman does not', () => {
  court();
  const energyAfter = (key) => {
    const target = rec(key, 't', 'blue', 5, 5, { stance: 'hold', hp: 40, maxHp: 40 });
    const { m } = round1([target, hitter('r1', 6, 5, { str: 4 }), hitter('r2', 4, 5, { str: 4 }), farBlue(), far()]);
    assert.ok(m.byId('t').hp > 0 && m.byId('t').hp < 40, 'struck but alive');
    return m.byId('t').energy;
  };
  assert.equal(energyAfter('feralGhoul') - energyAfter('pikeman'), COURT.ghoul.hungerEnergy, 'one extra, although two enemies struck it');
  done();
});

test('Unquiet Step: +2 damage when it advanced and has a target; wasted energy is refused; needs Advance', () => {
  court();
  const play = (abilities, stance = 'advance') => {
    const g = rec('feralGhoul', 'g', 'blue', 5, 5, { stance, ...sure, selectedAbilities: abilities });
    const foe = rec('pikeman', 'f', 'red', 9, 5, { stance: 'hold', spd: 0, def: 0 }); // 4 tiles away: the ghoul walks 4 and strikes
    return round1([g, foe, farBlue(), far()]);
  };
  const plain = play([]), skilled = play(['unquietStep']);
  assert.ok(strike(plain.res, 'g') && strike(skilled.res, 'g'), 'both strike after moving');
  assert.equal(bonus(strike(skilled.res, 'g'), strike(plain.res, 'g')), COURT.ghoul.unquietDamage);
  assert.ok(abilityEvents(skilled.res).some((e) => e.abilityId === 'unquietStep' && e.applied));
  // no movement: the trigger is unmet and energy is not spent
  const g = rec('feralGhoul', 'g', 'blue', 5, 5, { stance: 'advance', ...sure, selectedAbilities: ['unquietStep'] });
  const still = round1([g, rec('pikeman', 'f', 'red', 6, 5, { stance: 'hold', spd: 0 }), farBlue(), far()]);
  assert.equal(abilityEvents(still.res).find((e) => e.abilityId === 'unquietStep').reason, 'movement-trigger-unmet');
  assert.equal(validateAbilitySelection({ ...g, energy: 0 }, ['unquietStep']).ok, false, 'costs 1 energy');
  assert.equal(validateAbilitySelection({ ...g, energy: 1 }, ['unquietStep']).ok, true);
  const held = round1([{ ...g, stance: 'hold' }, rec('pikeman', 'f', 'red', 9, 5, { stance: 'hold' }), farBlue(), far()]);
  assert.equal(abilityEvents(held.res).find((e) => e.abilityId === 'unquietStep').reason, 'stance-trigger-unmet');
  done();
});

test('Graveguard Duty Beyond Death: takes 1 less damage per strike only while a Corpse lies within 2 tiles', () => {
  court();
  const dmg = (corpseAt) => {
    const gg = rec('graveguard', 'gg', 'blue', 5, 5, { stance: 'hold' });
    const { res } = round1([gg, hitter('r1', 6, 5), farBlue(), far()], 3, (m) => { if (corpseAt) corpse(m, ...corpseAt); });
    return strike(res, 'r1').damage;
  };
  const none = dmg(null), near = dmg([5, 7]), edge = dmg([3, 5]), tooFar = dmg([5, 8]);
  assert.equal(none - near, COURT.graveguard.dutyReduction);
  assert.equal(none - edge, COURT.graveguard.dutyReduction, 'distance 2 counts');
  assert.equal(tooFar, none, 'distance 3 does not');
  done();
});

test('Grave Rally: eats an adjacent Corpse and heals itself and friends within 1 by 6; nothing without a Corpse', () => {
  court();
  const play = (corpses) => {
    const gg = rec('graveguard', 'gg', 'blue', 5, 5, { stance: 'hold', hp: 10, selectedAbilities: ['graveRally'] });
    const mate = rec('pikeman', 'mate', 'blue', 5, 6, { stance: 'hold', hp: 10 });
    const distant = rec('pikeman', 'distant', 'blue', 5, 8, { stance: 'hold', hp: 10 });
    return round1([gg, mate, distant, far()], 3, (m) => { for (const p of corpses) corpse(m, ...p); });
  };
  const fed = play([[5, 4], [1, 1]]);
  const ev = abilityEvents(fed.res).find((e) => e.abilityId === 'graveRally');
  assert.equal(ev.applied, true);
  assert.equal(ev.consumed, 1);
  assert.equal(fed.m.byId('gg').hp, 10 + COURT.graveguard.graveRallyHeal);
  assert.equal(fed.m.byId('mate').hp, 10 + COURT.graveguard.graveRallyHeal);
  assert.equal(fed.m.byId('distant').hp, 10, 'outside the heal radius');
  assert.equal(fed.m.objects.filter((o) => o.objectKind === 'corpse').length, 1, 'only the adjacent corpse was eaten');
  const hungry = play([[1, 1]]); // corpse exists but not within 1
  assert.equal(abilityEvents(hungry.res).find((e) => e.abilityId === 'graveRally').reason, 'object-trigger-unmet');
  assert.equal(hungry.m.byId('gg').hp, 10);
  assert.equal(validateAbilitySelection({ ...hungry.m.byId('gg'), energy: 0 }, ['graveRally']).ok, true, 'costs no energy');
  done();
});

test('Wight: Feeds on the Fallen adds 2 damage near a Corpse; Withering Grip ignores 3 Defense', () => {
  court();
  const dmg = (corpseAt, abilities = []) => {
    const w = rec('wight', 'w', 'blue', 5, 5, { stance: 'hold', ...sure, selectedAbilities: abilities });
    const foe = rec('pikeman', 'f', 'red', 6, 5, { stance: 'hold', def: 9, spd: 0, str: 0 });
    const { res } = round1([w, foe, farBlue(), far()], 3, (m) => { if (corpseAt) corpse(m, ...corpseAt); });
    return strike(res, 'w');
  };
  const base = dmg(null);
  assert.equal(bonus(dmg([5, 7]), base), COURT.wight.feedDamage);
  assert.equal(bonus(dmg([5, 8]), base), 0, 'a Corpse 3 tiles away does nothing');
  assert.equal(bonus(dmg(null, ['withering']), base), COURT.wight.gripIgnoreDef);
  assert.equal(bonus(dmg([5, 7], ['withering']), base), COURT.wight.feedDamage + COURT.wight.gripIgnoreDef, 'the two stack');
  const w = rec('wight', 'w', 'blue', 5, 5);
  assert.equal(validateAbilitySelection({ ...w, energy: 1 }, ['withering']).ok, true);
  assert.equal(validateAbilitySelection({ ...w, energy: 0 }, ['withering']).ok, false);
  done();
});

test('Necromancer: Consume Remains eats the nearest Corpse within 3 and heals itself and friends within 2; needs a Corpse and 1 energy', () => {
  court();
  const play = (corpses, hp = 6) => {
    const n = rec('necromancer', 'n', 'blue', 5, 5, { stance: 'hold', hp: 6, selectedAbilities: ['consumeRemains'] });
    const mate = rec('pikeman', 'mate', 'blue', 6, 6, { stance: 'hold', hp });
    const distant = rec('pikeman', 'distant', 'blue', 5, 9, { stance: 'hold', hp });
    return round1([n, mate, distant, far()], 3, (m) => { for (const p of corpses) corpse(m, ...p, 'red'); });
  };
  const fed = play([[5, 8], [7, 5]]); // distances 3 and 2: the nearer (7,5) goes first
  const ev = abilityEvents(fed.res).find((e) => e.abilityId === 'consumeRemains');
  assert.deepEqual([ev.applied, ev.consumed], [true, 1]);
  assert.equal(fed.m.objects.length, 1);
  assert.deepEqual([fed.m.objects[0].c, fed.m.objects[0].r], [5, 8], 'the nearest corpse was eaten');
  assert.equal(fed.m.byId('n').hp, 6 + COURT.necromancer.healAmount);
  assert.equal(fed.m.byId('mate').hp, 6 + COURT.necromancer.healAmount);
  assert.equal(fed.m.byId('distant').hp, 6, 'distance 4 is outside the heal radius');
  // it eats ANY corpse, an enemy's included (engine: objectsNear does not filter by owner); recorded in the spec
  assert.equal(fed.m.objects.every((o) => o.faction === 'red'), true);
  const hungry = play([[5, 9]]); // distance 4
  assert.equal(abilityEvents(hungry.res).find((e) => e.abilityId === 'consumeRemains').reason, 'object-trigger-unmet');
  assert.equal(validateAbilitySelection({ ...hungry.m.byId('n'), energy: 0 }, ['consumeRemains']).ok, false, 'costs 1 energy');
  // heals never exceed max HP
  const full = play([[5, 8]], 30);
  assert.equal(full.m.byId('mate').hp, full.m.byId('mate').maxHp);
  done();
});

test('Necromancer staff: magic, range 2, ignores Defense (uses RES) and is weak', () => {
  court();
  const n = rec('necromancer', 'n', 'blue', 5, 5, { stance: 'hold', ...sure });
  const armoured = rec('pikeman', 'f', 'red', 7, 5, { stance: 'hold', def: 30, spd: 0, str: 0 });
  const { res } = round1([n, armoured, farBlue(), far()]);
  const s = strike(res, 'n');
  assert.ok(s, 'strikes from 2 tiles');
  assert.equal(s.damage, COURT.necromancer.mag + COURT.necromancer.mt - RECRUIT.pikeman.res, 'Def 30 is irrelevant');
  assert.ok(s.damage <= 4, 'weak');
  done();
});

test('Mourning Knight Revenant Vow: once per match a killed Knight stays with 1 HP, leaves no corpse, is not a loss; the second death is real and leaves a Corpse', () => {
  court();
  const roster = () => [rec('mourningKnight', 'k', 'blue', 5, 5, { hp: 1, stance: 'hold' }), hitter('r1', 6, 5), farBlue(), far()];
  let m = null, first = null;
  for (let seed = 1; seed <= 40 && !first; seed += 1) {
    m = createMatch({ seed, roster: roster() });
    const res = m.resolveRound();
    if (combatOf(res).some((e) => e.type === 'death' && e.unitId === 'k')) first = res;
  }
  assert.ok(first, 'the knight was struck down');
  assert.deepEqual(resultsOf(first).find((e) => e.type === 'return'), { type: 'return', faction: 'blue', unitId: 'k', c: 5, r: 5, hp: 1 });
  assert.equal(m.byId('k').hp, 1);
  assert.equal(m.byId('k').revenantUsed, true);
  assert.equal(m.objects.length, 0, 'a returned knight leaves no corpse');
  assert.equal(m.sides.blue.stats.lost.cavalier, undefined, 'not counted as lost');
  assert.ok(first.notes.some((n) => /returned from death/.test(n.text)));
  // second time: it really falls and now leaves a Corpse
  m.byId('r1').stance = 'hold';
  let fell = false;
  for (let i = 0; i < 6 && !fell; i += 1) { m.byId('r1').stance = 'hold'; fell = combatOf(m.resolveRound()).some((e) => e.type === 'death' && e.unitId === 'k'); }
  assert.equal(fell, true);
  assert.equal(m.alive('blue').some((u) => u.id === 'k'), false, 'dead the second time');
  assert.ok(m.objects.some((o) => o.objectKind === 'corpse' && o.c === 5 && o.r === 5));
  assert.equal(m.sides.blue.stats.lost.cavalier, 1);
  done();
});

test('Revenant also saves a Knight killed by a spell, and only Knights have it (a Graveguard falls for good)', () => {
  court();
  const m = createMatch({ seed: 2, roster: [rec('mourningKnight', 'k', 'blue', 5, 5, { hp: 2, stance: 'hold' }), rec('graveguard', 'g', 'blue', 5, 6, { hp: 2, stance: 'hold' }), far(), farBlue()] });
  const [card] = [{ id: 'spell-fireburst', type: 'spell', cost: 0, instanceId: 'fb-1', target: 'enemy-area' }];
  m.sides.red.cards.hand.push(card); // red casts Fireburst on the blue pair
  m.sides.red.cards.supply = 6;
  assert.equal(m.apply({ type: 'spell', faction: 'red', cardId: 'fb-1', c: 5, r: 5 }).ok, true);
  const res = m.resolveRound();
  assert.ok(resultsOf(res).some((e) => e.type === 'return' && e.unitId === 'k'));
  assert.equal(m.byId('k').hp, 1);
  assert.equal(m.byId('g').hp, 0, 'Graveguard: no revenant');
  assert.ok(m.objects.some((o) => o.objectKind === 'corpse' && o.c === 5 && o.r === 6), 'and it leaves a corpse');
  done();
});

test('Deathless Stand: a Knight on Hold takes 2 less damage per strike; not while advancing', () => {
  court();
  const dmg = (stance) => {
    const k = rec('mourningKnight', 'k', 'blue', 5, 5, { stance });
    const foe = hitter('r1', 5, 6, { spd: 0 });
    const m = createMatch({ seed: 3, roster: [k, { ...foe, stance: 'hold' }, farBlue(), far()] });
    return strike(m.resolveRound(), 'r1').damage;
  };
  assert.equal(dmg('advance') - dmg('hold'), COURT.mourningKnight.standReduction);
  done();
});

test('Mourning Knight keeps the shipped cavalier kit: Charge works', () => {
  court();
  const play = (abilities) => {
    const k = rec('mourningKnight', 'k', 'blue', 4, 5, { stance: 'advance', energy: 3, ...sure, selectedAbilities: abilities });
    return round1([k, rec('pikeman', 'f', 'red', 9, 5, { stance: 'hold', spd: 0, def: 0 }), farBlue(), far()]);
  };
  assert.equal(bonus(strike(play(['charge']).res, 'k'), strike(play([]).res, 'k')), 4);
  done();
});

test('Grave Chill: 3 damage to the one enemy tile chosen, costs 1 Supply; Mend Bone heals 6 for free', () => {
  court();
  const m = createMatch({ seed: 4, roster: [rec('pikeman', 'b', 'blue', 2, 2, { hp: 10 }), rec('pikeman', 'r', 'red', 10, 5, { stance: 'hold', def: 9 }), rec('pikeman', 'r2', 'red', 11, 5, { stance: 'hold' })] });
  const put = (key) => { const card = { ...structuredClone(cardFor(key)), instanceId: `t-${key}` }; m.sides.blue.cards.hand.push(card); return card; };
  const chill = put('graveChill'), bone = put('mendBone');
  assert.deepEqual([chill.cost, bone.cost, chill.target, bone.target], [1, 0, 'enemy-area', 'friendly-unit']);
  const supply = m.sides.blue.cards.supply;
  assert.equal(m.apply({ type: 'spell', faction: 'blue', cardId: chill.instanceId, c: 10, r: 5 }).ok, true);
  assert.equal(m.apply({ type: 'spell', faction: 'blue', cardId: bone.instanceId, unitId: 'b' }).ok, true);
  assert.equal(m.sides.blue.cards.supply, supply - 1, 'only Grave Chill is paid');
  const hp = { r: m.byId('r').hp, r2: m.byId('r2').hp };
  const spells = m.resolveRound().batches.find((b) => b.type === 'spells').events;
  assert.equal(spells.find((e) => e.spellId === 'graveChill').events.length, 1, 'radius 0 hits one tile');
  assert.equal(spells.find((e) => e.spellId === 'graveChill').events[0].amount, COURT.graveChillDamage, 'Def 9 is ignored');
  assert.ok(m.byId('r').hp <= hp.r - COURT.graveChillDamage, 'the chosen unit lost at least the spell damage');
  assert.equal(spells.find((e) => e.spellId === 'mendBone').amount, COURT.mendBoneHeal);
  done();
});

test('champions: three options, provisional default is the Hollow Regent, each with its own kit and none leaking', () => {
  court();
  assert.deepEqual([...COURT_CHAMPIONS], ['hollowRegent', 'chancellor', 'marshal']);
  assert.equal(DEFAULT_CHAMPION, 'hollowRegent');
  for (const id of COURT_CHAMPIONS) { assert.ok(CHAMPION_TEMPLATES[id], id); assert.ok(SPRITE_FALLBACK[id] || id === 'chancellor' || id === 'marshal'); }
  const regent = createChampionUnit('hollowRegent', 'blue', 5, 5);
  assert.deepEqual([regent.champion, regent.maxHp, regent.def, regent.weapon, regent.cls], [true, COURT.regent.hp, COURT.regent.def, 'Iron Sword', 'paladin']);
  const brenna = UNITS.find((u) => u.id === 'brenna');
  assert.ok(regent.maxHp >= brenna.maxHp - 2 && regent.maxHp <= brenna.maxHp + 4 && regent.def <= brenna.def, 'comparable to Brenna, not above her');
  assert.deepEqual(kitFor(regent).map((a) => a.id).sort(), ['decreeOfAttendance', 'sovereignStand']);
  const chancellor = createChampionUnit('chancellor', 'blue', 5, 5);
  assert.deepEqual([chancellor.cls, chancellor.weapon, chancellor.mag, chancellor.maxHp], ['necromancer', 'Lantern Staff', COURT.chancellor.mag, COURT.chancellor.hp]);
  assert.deepEqual(kitFor(chancellor).map((a) => a.id).sort(), ['chancelleryAudit', 'consumeRemains', 'ledgerOfTheDead']);
  const marshal = createChampionUnit('marshal', 'blue', 5, 5);
  assert.deepEqual(kitFor(marshal).map((a) => a.id).sort(), ['graveRally', 'holdBeyondDeath']);
  // champions never get a court kit as a plain recruit of the same class
  assert.equal(kitFor(rec('necromancer', 'n2', 'blue', 1, 1)).some((a) => a.id === 'ledgerOfTheDead'), false);
  assert.equal(kitFor(brenna).some((a) => a.id === 'sovereignStand'), false);
  // no combining, no combining-eligible identity
  assert.deepEqual(findUpgradeMatches([regent, { ...regent, id: 'c2' }, { ...regent, id: 'c3' }]), []);
  done();
});

test('champion kits work: Decree eats 2 Corpses, Ledger eats 3, stands reduce damage, Audit ignores 4 Defense', () => {
  court();
  const withChamp = (id, abilities, corpses, extra = {}, mates = []) => {
    const champ = { ...createChampionUnit(id, 'blue', 5, 5), stance: 'hold', hp: 10, energy: 4, selectedAbilities: abilities, ...extra };
    return round1([initializeAbilityState(champ), ...mates, far()], 4, (m) => { m.champions; for (const p of corpses) corpse(m, ...p, 'red'); });
  };
  const near = [[5, 6], [4, 5], [6, 5], [5, 4]];
  const decree = withChamp('hollowRegent', ['decreeOfAttendance'], near, {}, [rec('pikeman', 'mate', 'blue', 6, 6, { stance: 'hold', hp: 10 })]);
  assert.equal(abilityEvents(decree.res).find((e) => e.abilityId === 'decreeOfAttendance').consumed, 2);
  assert.equal(decree.m.objects.length, 2);
  assert.equal(decree.m.byId('mate').hp, 10 + COURT.regent.decreeHeal, 'one heal of 6, not per corpse');
  const ledger = withChamp('chancellor', ['ledgerOfTheDead'], near, {});
  assert.equal(abilityEvents(ledger.res).find((e) => e.abilityId === 'ledgerOfTheDead').consumed, 3);
  assert.equal(ledger.m.byId('chancellor').hp, 10 + COURT.chancellor.ledgerHeal);
  assert.equal(withChamp('hollowRegent', ['decreeOfAttendance'], []).m.objects.length, 0);
  assert.equal(abilityEvents(withChamp('hollowRegent', ['decreeOfAttendance'], []).res).find((e) => e.abilityId === 'decreeOfAttendance').reason, 'object-trigger-unmet');
  // Sovereign Stand and Hold Beyond Death
  const taken = (id, abilities) => { const t = withChamp(id, abilities, [], { hp: 30, maxHp: 40 }, [hitter('r1', 5, 6, { spd: 0 })]); return strike(t.res, 'r1').damage; };
  assert.equal(taken('hollowRegent', []) - taken('hollowRegent', ['sovereignStand']), COURT.regent.standReduction);
  assert.equal(taken('marshal', []) - taken('marshal', ['holdBeyondDeath']), COURT.marshal.holdReduction);
  // Chancellery Audit: a flat +3 (ignoreDefense would double count on a magic staff, see the next test)
  const audit = (abilities) => strike(withChamp('chancellor', abilities, [], { ...sure }, [rec('pikeman', 'f', 'red', 6, 5, { stance: 'hold', def: 30, spd: 0, str: 0 })]).res, 'chancellor');
  assert.equal(bonus(audit(['chancelleryAudit']), audit([])), COURT.chancellor.auditDamage);
  done();
});

test('engine note (documents current behaviour): ignoreDefense stacks on top of a magic weapon that already ignores Defense', () => {
  court();
  registerAbilities([{ id: 'tmpIgnore', name: 'Tmp', classes: ['necromancer'], cost: 0, cooldown: 1, phase: 'enhancement', requires: { target: true }, effect: { ignoreDefense: 4 } }]);
  const dmg = (abilities) => strike(round1([rec('necromancer', 'n', 'blue', 5, 5, { stance: 'hold', ...sure, selectedAbilities: abilities }),
    rec('pikeman', 'f', 'red', 6, 5, { stance: 'hold', def: 9, spd: 0, str: 0 }), farBlue(), far()]).res, 'n');
  assert.equal(bonus(dmg(['tmpIgnore']), dmg([])), 4, 'a magic strike already ignores Def, yet ignoreDefense still adds min(4, Def): this is why Chancellery Audit is a flat +3');
  unregisterAbilities(['tmpIgnore']);
  done();
});

test('a registered champion respawns as itself for either side (Court on red too)', () => {
  court();
  for (const side of ['blue', 'red']) {
    const other = side === 'blue' ? 'red' : 'blue';
    let back = null;
    for (let seed = 1; seed <= 60 && !back; seed += 1) {
      const regent = { ...createChampionUnit('hollowRegent', side, 5, 5), hp: 1, stance: 'hold' };
      const killer = rec('pikeman', 'k', other, 6, 5, { stance: 'hold', str: 40, ...sure });
      const m = createMatch({ seed, roster: [regent, killer, rec('pikeman', 'x', side, 1, 1), rec('pikeman', 'y', other, 14, 10, { stance: 'hold' })], champions: { [side]: 'hollowRegent' } });
      for (let i = 0; i < 5 && !m.over && !back; i += 1) back = resultsOf(m.resolveRound()).find((e) => e.type === 'respawn') || null;
      if (back) { assert.equal(back.unitId, 'hollowRegent'); assert.equal(m.byId('hollowRegent').faction, side); assert.equal(m.byId('hollowRegent').maxHp, COURT.regent.hp); }
    }
    assert.ok(back, `${side}: the Regent came back`);
  }
  done();
});

test('a champion never leaves a Corpse or uses Revenant', () => {
  court();
  const regent = { ...createChampionUnit('hollowRegent', 'blue', 5, 5), hp: 1, stance: 'hold', passives: [{ id: 'vow', effect: { revenant: 1 } }] };
  let died = false;
  for (let seed = 1; seed <= 40 && !died; seed += 1) {
    const m = createMatch({ seed, roster: [regent, hitter('r1', 6, 5), farBlue(), far()], champions: { blue: 'hollowRegent' } });
    died = combatOf(m.resolveRound()).some((e) => e.type === 'death' && e.unitId === 'hollowRegent');
    if (died) { assert.equal(m.objects.length, 0); assert.equal(m.byId('hollowRegent').hp, 0); }
  }
  assert.ok(died);
  done();
});

test('combining keeps the Court identity: three ghouls make a 2-star ghoul that still leaves a Corpse and has Hunger', () => {
  court();
  const ids = ['a', 'b', 'c'];
  const records = ids.map((id) => ({ ...createRecruitUnit('feralGhoul', id, 'blue', 1, 1), state: 'field' }));
  assert.equal(findUpgradeMatches(records).length, 1);
  const res = combineUnits(records, ids, { survivorId: 'a', destination: 'field' });
  assert.equal(res.ok, true);
  assert.equal(res.unit.stars, 2);
  assert.deepEqual(res.unit.passives.map((p) => p.id), ['hunger']);
  assert.equal(res.unit.onDeath.spawn.kind, 'corpse');
  done();
});

test('ablation switches keep the stats and remove exactly the death mechanics', () => {
  const off = buildHollowCourt({ corpses: false, revenant: false, consume: false, corpsePassives: false });
  resetCultures();
  registerCulture(off);
  const g = createRecruitUnit('feralGhoul', 'g', 'blue', 1, 1), k = createRecruitUnit('mourningKnight', 'k', 'blue', 1, 1), gg = createRecruitUnit('graveguard', 'gg', 'blue', 1, 1);
  assert.equal(g.onDeath, undefined);
  assert.equal(k.onDeath, undefined);
  assert.deepEqual(k.passives.map((p) => p.id), ['deathlessStand'], 'no revenant');
  assert.deepEqual(gg.passives, []);
  assert.deepEqual([g.maxHp, gg.maxHp, k.maxHp], [16, 26, 26], 'same stats');
  for (const id of ['graveRally', 'consumeRemains', 'decreeOfAttendance', 'ledgerOfTheDead']) assert.equal(ABILITY_CATALOG[id], undefined, id);
  assert.ok(ABILITY_CATALOG.unquietStep && ABILITY_CATALOG.withering, 'non-death skills stay');
  resetCultures();
  registerCulture(buildHollowCourt({ rarity: { graveguard: 'common' } }));
  assert.equal(cardFor('graveguard').rarity, 'common');
  done();
});

test('full matches with the Court on either side play out, log the culture and replay exactly', () => {
  court();
  const play = (side, seed, champion = DEFAULT_CHAMPION) => {
    setRarityGate({ uncommon: 3, rare: 6 });
    const log = memoryLog();
    const roster = courtRoster(UNITS, side, createRecruitUnit, createChampionUnit, champion);
    const champions = { [side]: champion };
    const pools = { [side]: culturePool('court') };
    const m = createMatch({ seed, maxRounds: 10, log: log.push, roster, champions, pools });
    while (!m.over) {
      m.resolveRound();
    }
    assert.deepEqual(log.entries[0].cultures, ['court']);
    assert.deepEqual(log.entries[0].champions, champions);
    const check = replay(log.entries, { create: (h, push) => { setRarityGate(h.rarityGate || {}); return createMatch({ seed: h.seed, maxRounds: h.maxRounds, log: push, roster: courtRoster(UNITS, side, createRecruitUnit, createChampionUnit, champion), champions: h.champions, pools: h.pools }); } });
    assert.equal(check.ok, true, JSON.stringify(check.mismatches?.slice(0, 1)));
    return m;
  };
  for (const side of ['blue', 'red']) for (const champion of COURT_CHAMPIONS) play(side, 11, champion);
  done();
});
