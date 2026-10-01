import test from 'node:test';
import assert from 'node:assert/strict';
import { attackInterval, resolveTimedBattle, TIMED_COMBAT_DEFAULTS } from '../src/timed-battle.js';

const config = (overrides = {}) => ({ ...TIMED_COMBAT_DEFAULTS, duration: 8, skillTimes: [], ...overrides });
const unit = (id, faction, c, r, over = {}) => ({
  id, faction, c, r, cls: 'pikeman', hp: 100, maxHp: 100, str: 10, def: 0, spd: 4,
  range: [1, 1], stance: 'hold', statuses: {}, ...over,
});
const hold = (...units) => Object.fromEntries(units.map((u) => [u.id, { stance: 'hold' }]));
const forecast = (a, d, from) => {
  const dist = Math.abs(from.c - d.c) + Math.abs(from.r - d.r);
  const [min, max] = a.range || [1, 1];
  return { atk: { can: dist >= min && dist <= max, dmg: a.damage ?? a.str, hit: 100, crit: 0 } };
};
const run = (units, { config: overrides = {}, orders = hold(...units), ...rest } = {}) => resolveTimedBattle({
  units, orders, seed: 42, forecastAttack: forecast, ...rest, config: config({ damageScale: 1, ...overrides }),
});
const events = (result) => result.batches.flatMap((batch) => (batch.events || []).map((event) => ({ ...event, time: batch.time })));
const strikes = (result) => events(result).filter((event) => event.type === 'strike');

test('faster units build a shorter attack cadence and land more attacks', () => {
  const slow = unit('slow', 'blue', 0, 0, { spd: 2 });
  const quick = unit('quick', 'blue', 0, 1, { spd: 9 });
  const slowTarget = unit('slow-target', 'red', 1, 0, { damage: 0 });
  const quickTarget = unit('quick-target', 'red', 1, 1, { damage: 0 });
  assert.ok(attackInterval(quick) < attackInterval(slow));
  const result = run([slow, slowTarget, quick, quickTarget], { config: { duration: 14 } });
  const count = (id) => strikes(result).filter((event) => event.attackerId === id).length;
  assert.ok(count(quick.id) > count(slow.id), `quick=${count(quick.id)}, slow=${count(slow.id)}`);
});

test('same-timestamp lethal strikes resolve together', () => {
  const blue = unit('blue', 'blue', 0, 0, { hp: 10, damage: 20 });
  const red = unit('red', 'red', 1, 0, { hp: 10, damage: 20 });
  const result = run([blue, red], { config: { duration: 2 } });
  const firstTick = result.batches.filter((batch) => batch.type === 'combat' && batch.time === 0.75).flatMap((batch) => batch.events);
  assert.deepEqual(firstTick.filter((event) => event.type === 'strike').map((event) => event.attackerId).sort(), ['blue', 'red']);
  assert.deepEqual(result.units.map((u) => [u.id, u.hp]).sort(), [['blue', 0], ['red', 0]]);
  assert.deepEqual(firstTick.filter((event) => event.type === 'death').map((event) => event.unitId).sort(), ['blue', 'red']);
});

test('a unit killed at one tick never attacks in a later tick', () => {
  const killer = unit('killer', 'blue', 0, 0, { damage: 200 });
  const victim = unit('victim', 'red', 1, 0, { hp: 10, damage: 5 });
  const survivor = unit('survivor', 'red', 9, 0, { damage: 0 });
  const result = run([killer, victim, survivor], { config: { duration: 5 } });
  const victimHits = strikes(result).filter((event) => event.attackerId === 'victim');
  assert.equal(result.units.find((u) => u.id === 'victim').hp, 0);
  assert.deepEqual(victimHits.map((event) => event.time), [0.75]);
});

test('an attacker retargets a legal enemy after its requested target dies', () => {
  const archer = unit('archer', 'blue', 0, 0, { range: [1, 2], damage: 50, str: 50 });
  const requested = unit('requested', 'red', 2, 0, { hp: 10, damage: 0 });
  const alternate = unit('alternate', 'red', 1, 0, { hp: 100, damage: 0 });
  const result = run([archer, requested, alternate], {
    config: { duration: 5 }, orders: { ...hold(archer, requested, alternate), archer: { stance: 'hold', targetId: 'requested' } },
  });
  const archerHits = strikes(result).filter((event) => event.attackerId === 'archer');
  assert.equal(archerHits[0].targetId, 'requested');
  assert.ok(archerHits.some((event) => event.targetId === 'alternate'));
});

test('contested movement never places two units on one tile', () => {
  const left = unit('left', 'blue', 1, 1, { stance: 'advance' });
  const right = unit('right', 'blue', 3, 1, { stance: 'advance' });
  const enemy = unit('enemy', 'red', 2, 3, { stance: 'hold' });
  const result = run([left, right, enemy], { config: { duration: 1 }, orders: {} });
  const move = result.batches.find((batch) => batch.type === 'movement' && batch.time === 0);
  const destinations = move.events.filter((event) => event.type === 'move').map((event) => `${event.to.c},${event.to.r}`);
  assert.equal(new Set(destinations).size, destinations.length);
  assert.equal(destinations.filter((tile) => tile === '2,1').length, 1);
});

test('Barrier is a finite pool shared across hits and later attack ticks', () => {
  const warded = unit('warded', 'blue', 0, 0, { statuses: { barrier: 5 } });
  const ally = unit('ally', 'blue', 0, 2, { damage: 0 });
  const attackers = [[1, 0], [0, 1], [1, 1]].map(([c, r], i) => unit(`enemy-${i}`, 'red', c, r, { damage: 10, range: [1, 2] }));
  const orders = { ...hold(warded, ally, ...attackers), ...Object.fromEntries(attackers.map((u) => [u.id, { stance: 'hold', targetId: 'warded' }])) };
  const result = run([warded, ally, ...attackers], { config: { duration: 4 }, orders });
  const incoming = strikes(result).filter((event) => event.targetId === 'warded');
  assert.equal(incoming.reduce((n, event) => n + event.barrierReduction, 0), 5);
  assert.equal(result.units.find((u) => u.id === 'warded').statuses.barrier, undefined);
  assert.ok(incoming.some((event) => event.time > 0.75 && event.barrierReduction === 0));
});

test('fixed seed and input produce identical events and final units', () => {
  const units = [unit('blue', 'blue', 0, 0), unit('red', 'red', 1, 0)];
  assert.deepEqual(run(units, { config: { duration: 5 } }), run(units, { config: { duration: 5 } }));
});

test('frequent small strikes scale after flat passive mitigation instead of granting accidental immunity',()=>{
 const a=unit('a','blue',0,0,{damage:7}),b=unit('b','red',1,0,{damage:0});
 const result=run([a,b],{config:{duration:2,damageScale:0.35},passives:()=>new Map([['b',{damageTaken:2}]])});
 assert.equal(strikes(result).find(e=>e.attackerId==='a').damage,2);
});
