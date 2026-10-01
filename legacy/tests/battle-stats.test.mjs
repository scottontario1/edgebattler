import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattleStats, reportFromLog } from '../src/battle-stats.js';

const roster = [
  { id: 'blue-a', name: 'A', faction: 'blue', cls: 'pikeman', variantId: 'crown-pike' },
  { id: 'red-b', name: 'B', faction: 'red', cls: 'archer' },
  { id: 'wall', name: 'Wall', faction: 'red', kind: 'object' },
];

test('records attempts, hits, crits, and logged post-mitigation unit damage', () => {
  const stats = createBattleStats();
  stats.register(roster);
  stats.record([{ type: 'combat', events: [
    { type: 'strike', attackerId: 'blue-a', targetId: 'red-b', hit: false, crit: false, damage: 0 },
    { type: 'strike', attackerId: 'blue-a', targetId: 'red-b', hit: true, crit: true, damage: 4 },
    { type: 'strike', attackerId: 'red-b', targetId: 'wall', hit: true, crit: false, damage: 9 },
  ] }]);
  assert.deepEqual(stats.forUnit('blue-a'), {
    id: 'blue-a', name: 'A', faction: 'blue', variantId: 'crown-pike', type: 'pikeman', kind: 'unit',
    damageDealt: 4, damageTaken: 0, attacks: 2, hits: 1, criticals: 1, abilityUses: {},
  });
  assert.equal(stats.forUnit('red-b').damageDealt, 9);
  assert.equal(stats.forUnit('red-b').damageTaken, 4);
  assert.equal(stats.snapshot().leaders.damageDealt.id, 'red-b');
  assert.equal(stats.snapshot().leaders.damageTaken.id, 'red-b');
  assert.equal(stats.forUnit('wall'), null);
});

test('counts successful ability activations and ignores skipped events', () => {
  const stats = createBattleStats();
  stats.register(roster);
  stats.record([{ type: 'abilities', events: [
    { unitId: 'blue-a', abilityId: 'brace', applied: false, reason: 'no-energy' },
    { unitId: 'blue-a', abilityId: 'brace', applied: true },
    { unitId: 'red-b', abilityId: 'charge', applied: true },
    { unitId: 'red-b', abilityId: 'charge', applied: true },
  ] }]);
  assert.deepEqual(stats.forUnit('blue-a').abilityUses, { brace: 1 });
  assert.deepEqual(stats.snapshot().abilities, { brace: 1, charge: 2 });
  assert.deepEqual(stats.snapshot().leaders.ability, { id: 'charge', count: 2 });
});

test('preserves fallen and reserve stats, updates metadata, and resolves ties by id', () => {
  const stats = createBattleStats();
  stats.register([{ id: 'z', faction: 'blue', name: 'Z', cls: 'pikeman' }, { id: 'a', faction: 'blue', name: 'A', cls: 'pikeman' }]);
  stats.record([{ type: 'combat', events: [
    { type: 'strike', attackerId: 'z', targetId: 'a', hit: true, damage: 5 },
    { type: 'strike', attackerId: 'a', targetId: 'z', hit: true, damage: 5 },
  ] }]);
  stats.register([{ id: 'z', faction: 'blue', name: 'Z', cls: 'pikeman', state: 'reserve' }]);
  assert.equal(stats.snapshot().leaders.damageDealt.id, 'a');
  assert.equal(stats.snapshot().leaders.damageTaken.id, 'a');
  assert.equal(stats.forUnit('z').damageDealt, 5);
  assert.equal(stats.forUnit('z').faction, 'blue');
});

test('returns detached snapshots', () => {
  const stats = createBattleStats();
  stats.register(roster);
  stats.record([{ type: 'abilities', events: [{ unitId: 'blue-a', abilityId: 'brace', applied: true }] }]);
  const first = stats.snapshot();
  first.units[0].name = 'changed';
  first.units[0].abilityUses.brace = 99;
  first.abilities.brace = 99;
  assert.equal(stats.forUnit('blue-a').name, 'A');
  assert.deepEqual(stats.forUnit('blue-a').abilityUses, { brace: 1 });
  assert.deepEqual(stats.snapshot().abilities, { brace: 1 });
});

test('reconstructs campaign units and late recruits from round logs', () => {
  const entries = [
    { t: 'header', campaign: { stages: [{ waves: [[{ id: 'enc-0-0-0', name: 'Rat', faction: 'red', cls: 'monsterRat' }]] }] } },
    { t: 'summary', blue: { unitState: [{ id: 'brenna' }], reserveState: [{ id: 'reserve-1', unitId: 'archer' }] }, red: { unitState: [{ id: 'enc-0-0-0' }] } },
    { t: 'round', batches: [{ type: 'combat', events: [{ type: 'strike', attackerId: 'brenna', targetId: 'enc-0-0-0', hit: true, damage: 6 }] }] },
  ];
  const report = reportFromLog(entries, [{ id: 'brenna', name: 'Brenna', faction: 'blue', cls: 'paladin' }]);
  assert.equal(report.units.find((unit) => unit.id === 'enc-0-0-0').name, 'Rat');
  assert.equal(report.units.find((unit) => unit.id === 'reserve-1').faction, 'blue');
  assert.equal(report.leaders.damageDealt.id, 'brenna');
  assert.equal(report.leaders.damageTaken.id, 'enc-0-0-0');
});
