// Rule checks for the experimental candidate hooks. The hooks must be inert unless a candidate is registered,
// and the candidates must do exactly what docs/experiments/CANDIDATES.md says.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBattleRound } from '../src/battle.js';
import { ABILITY_CATALOG, ABILITIES, activatePhase, initializeAbilityState, kitFor, validateAbilitySelection } from '../src/abilities.js';
import { enableCandidates, disableCandidates } from '../experiments/candidates/index.mjs';
import { loadMaps, buildMatch, playScenario, replayScenario } from '../experiments/combat/scenario.mjs';
import { createRecruitUnit } from '../src/roster.js';
import { RECRUITMENT_POOL, drawCards, createCardState, seededRandom } from '../src/cards.js';

await loadMaps(['flat_open']);
const rec = (id, cls, faction, c, r, extra = {}) => initializeAbilityState({ ...createRecruitUnit(cls, id, faction, c, r), ...extra });
const strikeAt = (result, attackerId) => result.batches[1].events.find((e) => e.type === 'strike' && e.attackerId === attackerId);
const hold = (units) => Object.fromEntries(units.map((u) => [u.id, { stance: 'hold' }]));

test('candidates are inert by default and removable', () => {
  disableCandidates();
  assert.deepEqual(Object.keys(ABILITY_CATALOG), Object.keys(ABILITIES));
  assert.equal(kitFor({ cls: 'cavalier' }).some((a) => a.id === 'momentum'), false);
  enableCandidates(['setSpears', 'momentum', 'whetstone'], { pool: true });
  assert.ok(kitFor({ cls: 'cavalier' }).some((a) => a.id === 'momentum'));
  assert.ok(kitFor({ cls: 'pikeman' }).some((a) => a.id === 'setSpears'));
  disableCandidates();
  assert.deepEqual(Object.keys(ABILITY_CATALOG), Object.keys(ABILITIES));
  const hand = drawCards(createCardState({}), seededRandom(9), 8).state.hand.map((c) => c.id);
  assert.ok(hand.every((id) => RECRUITMENT_POOL.some((k) => id.endsWith(k))), 'default pool only');
});

test('Set Spears: holds, ignores Cavalier flank/Charge bonuses, and adds 4 damage against a Cavalier', () => {
  enableCandidates(['setSpears']);
  const pike = rec('p', 'pikeman', 'blue', 5, 5, { energy: 2, facing: 'north', selectedAbilities: ['setSpears'] });
  const act = activatePhase(pike, 'defense');
  assert.equal(act.events[0].applied, true);
  assert.equal(act.unit.energy, 1);
  assert.equal(act.unit.cooldowns.setSpears, 2);
  assert.equal(act.unit.statuses.setSpears, 4);
  // Cavalier strikes the Pikeman's east flank with Charge (+4) and the flank bonus (+4).
  const guarded = { ...act.unit, statuses: { setSpears: 4 } };
  const cav = rec('c', 'cavalier', 'red', 6, 5, { statuses: { attackBonus: 4 } });
  const plain = { ...guarded, statuses: {} };
  const with_ = resolveBattleRound({ units: [guarded, cav], orders: hold([guarded, cav]), seed: 3, forecastAttack: undefined });
  const without = resolveBattleRound({ units: [plain, cav], orders: hold([plain, cav]), seed: 3, forecastAttack: undefined });
  assert.equal(strikeAt(with_, 'c').mountedGuard, true);
  assert.equal(strikeAt(with_, 'c').flankBonus, 0);
  assert.ok(strikeAt(without, 'c').flankBonus > 0);
  assert.equal(strikeAt(with_, 'p').spearBonus, 4);
  assert.equal(strikeAt(without, 'p').spearBonus, undefined);
  // Not against other classes.
  const foe = rec('f', 'pikeman', 'red', 6, 5);
  assert.equal(strikeAt(resolveBattleRound({ units: [guarded, foe], orders: hold([guarded, foe]), seed: 3 }), 'p').spearBonus, undefined);
  disableCandidates();
});

test('Momentum: needs Advance and 2+ tiles, grants +1 damage per tile up to 5, stacks with Charge', () => {
  enableCandidates(['momentum']);
  const cav = (over = {}) => rec('c', 'cavalier', 'blue', 5, 5, { energy: 4, stance: 'advance', selectedAbilities: ['momentum'], ...over });
  const run = (u, ctx) => activatePhase(u, 'enhancement', { moved: ctx.movedTiles > 0, hasTarget: true, ...ctx });
  assert.equal(run(cav(), { movedTiles: 1 }).events[0].reason, 'movement-trigger-unmet');
  assert.equal(run(cav({ stance: 'hold' }), { movedTiles: 4 }).events[0].reason, 'stance-trigger-unmet');
  assert.equal(run(cav(), { movedTiles: 4 }).unit.statuses.attackBonus, 4);
  assert.equal(run(cav(), { movedTiles: 7 }).unit.statuses.attackBonus, 5);
  assert.equal(run(cav(), { movedTiles: 3, hasTarget: false }).events[0].reason, 'no-legal-target');
  const both = activatePhase(cav({ selectedAbilities: ['charge', 'momentum'] }), 'enhancement', { moved: true, hasTarget: true, movedTiles: 5 });
  assert.equal(both.unit.statuses.attackBonus, 9);
  assert.equal(both.unit.energy, 1);
  assert.equal(validateAbilitySelection(cav({ energy: 1 }), ['momentum']).ok, true);
  disableCandidates();
  assert.equal(validateAbilitySelection(cav(), ['momentum']).reason, 'invalid-ability');
});

test('equipment adds Str/Def for the battle only and never changes the unit record', () => {
  const def = (loadouts) => ({ id: 't', map: 'flat_open', maxRounds: 3, candidates: ['whetstone', 'bulwark'], loadouts, units: [
    { id: 'a', faction: 'blue', cls: 'pikeman', c: 5, r: 5, stance: 'hold' }, { id: 'b', faction: 'red', cls: 'pikeman', c: 6, r: 5, stance: 'hold' }] });
  const damage = (loadouts) => {
    const m = buildMatch(def(loadouts), 4, null);
    const before = { str: m.byId('a').str, def: m.byId('b').def };
    const result = m.resolveRound();
    const strike = result.batches.find((b) => b.type === 'combat').events.find((e) => e.attackerId === 'a');
    assert.equal(m.byId('a').str, before.str);
    assert.equal(m.byId('b').def, before.def);
    assert.equal(m.byId('a').statuses.equipStr, undefined);
    return strike;
  };
  const base = damage({});
  assert.equal(damage({ blue: { pikeman: ['whetstone'] } }).damage, base.damage + 2);
  assert.equal(damage({ red: { pikeman: ['bulwark'] } }).damage, Math.max(0, base.damage - 2));
  disableCandidates();
});

test('scenario logs rebuild from their header and replay exactly', () => {
  const def = { id: 'r', map: 'flat_open', maxRounds: 6, candidates: ['setSpears', 'momentum'], units: [
    { id: 'p1', faction: 'blue', cls: 'pikeman', c: 6, r: 5, stance: 'hold', facing: 'east' },
    { id: 'c1', faction: 'red', cls: 'cavalier', c: 12, r: 5, stance: 'advance', facing: 'west' }],
  script: [{ round: 1, faction: 'blue', cls: 'pikeman', abilities: ['setSpears'] }, { round: 1, faction: 'red', cls: 'cavalier', abilities: ['momentum'] }] };
  for (const seed of [1, 2, 3]) {
    const res = playScenario(def, seed, { keepLog: true });
    assert.ok(res.strikes > 0);
    const check = replayScenario(res.log.entries);
    assert.deepEqual(check.mismatches, []);
  }
  disableCandidates();
});
