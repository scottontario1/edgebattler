// Rule checks for the shared culture hooks (src/cultures.js, src/passives.js and the hooks they use). Every hook must be
// inert unless a culture registers it; the shipped-output equivalence is also checked with `cmp` on simulator logs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBattleRound } from '../src/battle.js';
import { ABILITY_CATALOG, ABILITIES, SPELL_CATALOG, SPELLS, activatePhase, initializeAbilityState, kitFor } from '../src/abilities.js';
import { registerCulture, resetCultures, culturePool, ACTIVE_CULTURES } from '../src/cultures.js';
import { evaluatePassives } from '../src/passives.js';
import { createRecruitUnit, VARIANTS } from '../src/roster.js';
import { cardFor, RECRUITMENT_POOL } from '../src/cards.js';
import { createMatch } from '../src/match.js';
import { memoryLog, replay } from '../src/log.js';
import { setMap, DEFAULT_MAP } from '../src/board.js';

setMap(DEFAULT_MAP);
const FIXTURE = {
  id: 'fixture',
  variants: {
    fxGuard: { base: 'pikeman', name: 'Fixture Guard', delta: { hp: 2, def: 1, mov: -1 },
      passives: [{ id: 'wall', when: { adjacentAlly: { classes: ['pikeman'], min: 1 } }, perAdjacent: true, cap: 2, effect: { damageTaken: 2 } }],
      card: { rarity: 'uncommon' } },
    fxBanner: { base: 'pikeman', name: 'Fixture Banner', delta: { hp: -4 },
      passives: [{ id: 'banner', aura: { radius: 2, stance: ['hold', 'protect'] }, effect: { damageTaken: 1 } }] },
    fxRevenant: { base: 'pikeman', name: 'Fixture Revenant', passives: [{ id: 'vow', effect: { revenant: 1 } }] },
    fxGrit: { base: 'pikeman', name: 'Fixture Grit', passives: [{ id: 'grit', effect: { energyWhenStruck: 1 } }] },
  },
  abilities: [
    { id: 'fxLow', name: 'Fixture Low', classes: ['pikeman'], anyUnit: true, cost: 0, cooldown: 1, phase: 'recovery', requires: { hpBelow: 0.5 }, effect: { damageDealt: 3 } },
    { id: 'fxHigh', name: 'Fixture High', classes: ['pikeman'], anyUnit: true, cost: 0, cooldown: 1, phase: 'recovery', requires: { hpAbove: 0.5 }, effect: { damageDealt: 1 } },
    { id: 'fxHome', name: 'Fixture Home', classes: ['pikeman'], anyUnit: true, cost: 0, cooldown: 1, phase: 'defense', requires: { onControlled: true }, effect: { damageTaken: 1 } },
  ],
  spells: { fxCry: { spell: { id: 'fxCry', name: 'Fixture Cry', type: 'spell', cost: 1, target: 'friendly-unit', duration: 'upcoming-battle', effect: { type: 'status', status: 'damageDealt', duration: 2 } }, card: { rarity: 'common', effect: 'test' } } },
  pool: ['fxGuard', 'fxBanner', 'fxCry'],
};
const rec = (key, id, faction, c, r, extra = {}) => initializeAbilityState({ ...createRecruitUnit(key, id, faction, c, r), ...extra });
const strikeOf = (res, attackerId) => res.batches[1].events.find((e) => e.type === 'strike' && e.attackerId === attackerId);
const hold = (units) => Object.fromEntries(units.map((u) => [u.id, { stance: 'hold' }]));
const sure = (a, d) => ({ dist: 1, atk: { can: true, dmg: Math.max(0, a.str - d.def), hit: 100, crit: 0 }, def: { can: false } });

test('culture hooks are inert until a culture registers, and fully removable', () => {
  resetCultures();
  assert.deepEqual(Object.keys(ABILITY_CATALOG), Object.keys(ABILITIES));
  assert.deepEqual(Object.keys(SPELL_CATALOG), Object.keys(SPELLS));
  assert.deepEqual(VARIANTS, {});
  registerCulture(FIXTURE);
  assert.deepEqual(ACTIVE_CULTURES, ['fixture']);
  assert.ok(kitFor({ cls: 'pikeman' }).some((a) => a.id === 'fxLow'));
  assert.ok(SPELL_CATALOG.fxCry);
  assert.equal(cardFor('fxGuard').culture, 'fixture');
  assert.equal(cardFor('fxGuard').rarity, 'uncommon');
  assert.deepEqual(culturePool('fixture'), FIXTURE.pool);
  resetCultures();
  assert.deepEqual(Object.keys(ABILITY_CATALOG), Object.keys(ABILITIES));
  assert.deepEqual(Object.keys(SPELL_CATALOG), Object.keys(SPELLS));
  assert.deepEqual(VARIANTS, {});
  assert.equal(cardFor('fxGuard'), null);
  assert.equal(ACTIVE_CULTURES.length, 0);
  assert.ok(RECRUITMENT_POOL.length === 26);
});

test('a variant recruits as its base class with the stat delta, culture and passives', () => {
  registerCulture(FIXTURE);
  const base = createRecruitUnit('pikeman', 'a', 'blue', 1, 1);
  const g = createRecruitUnit('fxGuard', 'g', 'blue', 1, 1);
  assert.equal(g.cls, 'pikeman');
  assert.equal(g.variantId, 'fxGuard');
  assert.equal(g.culture, 'fixture');
  assert.equal(g.name, 'Fixture Guard');
  assert.equal(g.maxHp, base.maxHp + 2);
  assert.equal(g.hp, g.maxHp);
  assert.equal(g.def, base.def + 1);
  assert.equal(g.mov, base.mov - 1);
  assert.equal(g.passives[0].id, 'wall');
  assert.equal(base.culture, undefined, 'plain classes are untouched');
  resetCultures();
});

test('ability requires: hpBelow, hpAbove and onControlled', () => {
  registerCulture(FIXTURE);
  const u = (hp, ids) => rec('pikeman', 'u', 'blue', 4, 4, { hp, selectedAbilities: ids });
  const low = activatePhase(u(10, ['fxLow']), 'recovery');
  assert.equal(low.events[0].applied, true);
  assert.equal(low.unit.statuses.damageDealt, 3);
  assert.equal(activatePhase(u(20, ['fxLow']), 'recovery').events[0].reason, 'hp-trigger-unmet');
  assert.equal(activatePhase(u(12, ['fxLow']), 'recovery').events[0].reason, 'hp-trigger-unmet', 'strictly below half');
  assert.equal(activatePhase(u(20, ['fxHigh']), 'recovery').events[0].applied, true);
  assert.equal(activatePhase(u(5, ['fxHigh']), 'recovery').events[0].reason, 'hp-trigger-unmet');
  assert.equal(activatePhase(u(24, ['fxHome']), 'defense', { onControlled: true }).events[0].applied, true);
  assert.equal(activatePhase(u(24, ['fxHome']), 'defense').events[0].reason, 'location-trigger-unmet');
  resetCultures();
});

test('passives: adjacency (capped, per ally), stance/moved conditions and auras', () => {
  registerCulture(FIXTURE);
  const g = rec('fxGuard', 'g', 'blue', 5, 5);
  const allies = [rec('pikeman', 'p1', 'blue', 4, 5), rec('pikeman', 'p2', 'blue', 6, 5), rec('pikeman', 'p3', 'blue', 5, 4)];
  const foe = rec('pikeman', 'e', 'red', 5, 6);
  const at = (units) => evaluatePassives(units, { moved: new Set(), stanceOf: (x) => x.stance });
  assert.equal(at([g, foe]).get('g'), undefined, 'no adjacent ally, no effect');
  assert.equal(at([g, allies[0], foe]).get('g').damageTaken, 2);
  assert.equal(at([g, ...allies, foe]).get('g').damageTaken, 4, 'cap 2 allies');
  const archer = rec('archer', 'a', 'blue', 4, 5);
  assert.equal(at([g, archer]).get('g'), undefined, 'class filter');
  // Aura: friendly Hold/Protect units within 2 tiles, not the source, not enemies, not out of range.
  const b = rec('fxBanner', 'b', 'blue', 5, 5);
  const holdU = rec('pikeman', 'h', 'blue', 5, 7, { stance: 'hold' });
  const advU = rec('pikeman', 'v', 'blue', 5, 3, { stance: 'advance' });
  const farU = rec('pikeman', 'f', 'blue', 5, 9, { stance: 'hold' });
  const enemy = rec('pikeman', 'x', 'red', 5, 6, { stance: 'hold' });
  const fx = at([b, holdU, advU, farU, enemy]);
  assert.equal(fx.get('h').damageTaken, 1);
  assert.equal(fx.get('v'), undefined);
  assert.equal(fx.get('f'), undefined);
  assert.equal(fx.get('x'), undefined);
  assert.equal(fx.get('b'), undefined);
  // moved / unmoved conditions
  const mover = { ...rec('pikeman', 'm', 'blue', 2, 2), passives: [{ id: 'mo', when: { moved: true }, effect: { damageDealt: 2 } }, { id: 'st', when: { moved: false }, effect: { damageTaken: 1 } }] };
  assert.deepEqual(evaluatePassives([mover], { moved: new Set(['m']) }).get('m'), { damageDealt: 2 });
  assert.deepEqual(evaluatePassives([mover], { moved: new Set() }).get('m'), { damageTaken: 1 });
  resetCultures();
});

test('battle statuses: damageTaken, damageDealt, ignoreDefense, offTargetPenalty; cleared after the battle', () => {
  const a = rec('pikeman', 'a', 'blue', 5, 5, { statuses: { damageDealt: 2 } });
  const t = rec('pikeman', 't', 'red', 6, 5, { statuses: { damageTaken: 1 } });
  const base = sure(a, t).atk.dmg;
  const res = resolveBattleRound({ units: [a, t], orders: hold([a, t]), forecastAttack: sure, seed: 3 });
  assert.equal(strikeOf(res, 'a').damage, base + 2 - 1);
  for (const u of res.units) for (const k of ['damageTaken', 'damageDealt', 'ignoreDefense', 'offTargetPenalty', 'energyWhenStruck']) assert.equal(u.statuses[k], undefined, `${k} cleared`);
  // ignoreDefense adds at most the target's Defense
  const i2 = rec('pikeman', 'a', 'blue', 5, 5, { statuses: { ignoreDefense: 99 } });
  const t2 = rec('pikeman', 't', 'red', 6, 5);
  assert.equal(strikeOf(resolveBattleRound({ units: [i2, t2], orders: hold([i2, t2]), forecastAttack: sure, seed: 3 }), 'a').damage, sure(i2, t2).atk.dmg + t2.def);
  // damageTaken never pushes damage below 0 and does not turn a miss into damage
  const t3 = rec('pikeman', 't', 'red', 6, 5, { statuses: { damageTaken: 99 } });
  assert.equal(strikeOf(resolveBattleRound({ units: [a, t3], orders: hold([a, t3]), forecastAttack: sure, seed: 3 }), 'a').damage, 0);
  // offTargetPenalty: the strike lands on someone other than the explicit target (which is out of reach) and is reduced
  const near = rec('pikeman', 'near', 'red', 6, 5), far = rec('pikeman', 'far', 'red', 12, 10);
  const marked = rec('pikeman', 'a', 'blue', 5, 5, { str: 16, statuses: { offTargetPenalty: 2 } });
  const run = (targetId) => strikeOf(resolveBattleRound({ units: [marked, near, far], orders: { a: { stance: 'hold', targetId }, near: { stance: 'hold' }, far: { stance: 'hold' } }, forecastAttack: (x, y) => (y.id === 'far' ? { dist: 9, atk: { can: false }, def: { can: false } } : sure(x, y)), seed: 3 }), 'a');
  assert.equal(run('far').damage, sure(marked, near).atk.dmg - 2, 'off-target strike is reduced');
  assert.equal(run('near').damage, sure(marked, near).atk.dmg, 'the marked target takes the normal strike');
  assert.equal(run(undefined).damage, sure(marked, near).atk.dmg, 'no explicit target: no penalty');
});

test('shipped strike events gain no new fields', () => {
  const a = rec('pikeman', 'a', 'blue', 5, 5), t = rec('pikeman', 't', 'red', 6, 5);
  const s = strikeOf(resolveBattleRound({ units: [a, t], orders: hold([a, t]), forecastAttack: sure, seed: 3 }), 'a');
  for (const k of ['damageTaken', 'damageDealt', 'ignoreDefense', 'offTargetPenalty']) assert.equal(k in s, false, k);
  assert.deepEqual(Object.keys(s), ['type', 'flank', 'flankBonus', 'attackBonus', 'attackerId', 'targetId', 'hit', 'crit', 'damage', 'warded', 'barrierAmount', 'barrierReduction', 'braceReduction']);
});

test('match: markTargetId makes the marked enemy the explicit target and clears afterwards', () => {
  const roster = [rec('pikeman', 'b1', 'blue', 5, 5), rec('pikeman', 'r1', 'red', 6, 5), rec('pikeman', 'r2', 'red', 5, 6)];
  const m = createMatch({ seed: 7, roster });
  m.byId('b1').markTargetId = 'r2';
  m.byId('b1').stance = 'hold';
  m.resolveRound();
  assert.equal(m.byId('b1').markTargetId, undefined);
  const log = memoryLog();
  const m2 = createMatch({ seed: 7, roster, log: log.push });
  m2.byId('b1').markTargetId = 'r2';
  m2.byId('b1').stance = 'hold';
  const res = m2.resolveRound();
  const strike = res.batches.find((b) => b.type === 'combat').events.find((e) => e.type === 'strike' && e.attackerId === 'b1');
  assert.equal(strike.targetId, 'r2');
});

test('match: energyWhenStruck gives energy only when damaged', () => {
  registerCulture(FIXTURE);
  let struckSeen = false;
  for (let seed = 1; seed <= 12; seed += 1) {
    const roster = [rec('fxGrit', 'b1', 'blue', 5, 5, { stance: 'hold' }), rec('pikeman', 'r1', 'red', 6, 5, { stance: 'advance' })];
    const m = createMatch({ seed, roster });
    const before = m.byId('b1').energy;
    const res = m.resolveRound();
    const hurt = res.batches.find((b) => b.type === 'combat').events.some((e) => e.type === 'strike' && e.targetId === 'b1' && e.damage > 0);
    const after = m.round === 2 ? m.byId('b1').energy : null;
    // the round refresh adds 1 energy to every field unit; the passive adds 1 more when struck
    assert.equal(after, Math.min(4, before + 1 + (hurt ? 1 : 0)), `seed ${seed}`);
    struckSeen ||= hurt;
  }
  assert.ok(struckSeen);
  resetCultures();
});

test('match: revenant returns once per match with 1 HP, keeps the unit, and is permanent the second time', () => {
  registerCulture(FIXTURE);
  let seen = 0;
  for (let seed = 1; seed <= 20 && !seen; seed += 1) {
    const roster = [rec('fxRevenant', 'b1', 'blue', 5, 5, { hp: 1, stance: 'hold' }), rec('pikeman', 'r1', 'red', 6, 5), rec('pikeman', 'b2', 'blue', 1, 1), rec('pikeman', 'r2', 'red', 14, 10)];
    const m = createMatch({ seed, roster });
    const res = m.resolveRound();
    const ret = res.batches.find((b) => b.type === 'results').events.find((e) => e.type === 'return');
    if (!ret) continue;
    seen += 1;
    assert.equal(ret.unitId, 'b1');
    assert.equal(m.byId('b1').hp, 1);
    assert.equal(m.byId('b1').revenantUsed, true);
    assert.ok(m.alive('blue').some((u) => u.id === 'b1'));
    assert.equal(m.stats().blue.lost.pikeman ?? 0, 0, 'a returned unit is not counted as lost');
    // second death is permanent
    for (let r2 = 0; r2 < 6 && m.byId('b1').hp > 0 && !m.over; r2 += 1) { m.byId('b1').hp = 1; m.byId('b1').stance = 'hold'; m.resolveRound(); }
    if (m.byId('b1').hp <= 0) assert.equal(m.stats().blue.lost.pikeman, 1);
  }
  assert.ok(seen, 'a revenant return happened in the seed sweep');
  resetCultures();
});

test('match: onControlled ability applies on an owned keep tile and not elsewhere', () => {
  registerCulture(FIXTURE);
  const roster = [rec('pikeman', 'b1', 'blue', 2, 10, { selectedAbilities: ['fxHome'] }), rec('pikeman', 'b2', 'blue', 5, 5, { selectedAbilities: ['fxHome'] }), rec('pikeman', 'r1', 'red', 14, 2)];
  const m = createMatch({ seed: 3, roster });
  for (const id of ['b1', 'b2']) m.byId(id).stance = 'hold';
  const res = m.resolveRound();
  const ev = res.batches.filter((b) => b.type === 'abilities').flatMap((b) => b.events);
  assert.equal(ev.find((e) => e.unitId === 'b1').applied, true);
  assert.equal(ev.find((e) => e.unitId === 'b2').reason, 'location-trigger-unmet');
  resetCultures();
});

test('per-side pools: a culture draws only its cards, the other side keeps the shared pool; logs replay', () => {
  registerCulture(FIXTURE);
  const pools = { blue: culturePool('fixture') };
  const log = memoryLog();
  const m = createMatch({ seed: 11, maxRounds: 4, log: log.push, pools });
  const hand = m.summary('blue').hand;
  assert.ok(hand.length > 0);
  assert.ok(hand.every((id) => ['unit-fxGuard', 'unit-fxBanner', 'spell-fxCry'].includes(id)), `blue hand ${hand}`);
  assert.ok(m.summary('red').hand.every((id) => RECRUITMENT_POOL.some((k) => id.endsWith(k))), 'red keeps the shared pool');
  // Play blue's culture cards to the bench and through a few rounds, then replay from the header.
  const card = m.summary('blue').handState.find((c) => c.type === 'unit');
  if (card) {
    const r = m.apply({ type: 'recruit', faction: 'blue', cardId: card.instanceId });
    assert.equal(r.ok, true);
    const reserve = m.summary('blue').reserveState[0];
    assert.equal(reserve.classId, 'pikeman');
    assert.equal(reserve.variantId, card.unitId);
    const tile = m.deploymentTiles('blue').find(([c, rr]) => !m.unitAt(c, rr));
    const d = m.apply({ type: 'deploy', faction: 'blue', reserveId: reserve.id, c: tile[0], r: tile[1] });
    assert.equal(d.ok, true);
    const deployed = m.byId(d.unitId);
    assert.equal(deployed.cls, 'pikeman');
    assert.equal(deployed.variantId, card.unitId);
    assert.equal(deployed.culture, 'fixture');
  }
  while (!m.over) m.resolveRound();
  const header = log.entries[0];
  assert.deepEqual(header.cultures, ['fixture']);
  assert.deepEqual(header.pools, pools);
  const check = replay(log.entries);
  assert.equal(check.ok, true, JSON.stringify(check.mismatches?.slice(0, 2)));
  resetCultures();
});

test('the game header is unchanged with no culture registered', () => {
  resetCultures();
  const log = memoryLog();
  createMatch({ seed: 5, log: log.push });
  assert.equal(log.entries[0].cultures, undefined);
  assert.equal(log.entries[0].pools, undefined);
});

// Ability kits are off in the shipped game (Shards replaced them); this file exercises the kits, so it opts in.
import { setAbilitiesEnabled } from '../src/abilities.js';
setAbilitiesEnabled(true);
