import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRandom as legacySeededRandom } from '../../legacy/src/cards.js';
import { seededRandom, makeRng } from '../../src/core/util/rng.js';
import { manhattan, tileDistance, clone, deepFreeze } from '../../src/core/util/geometry.js';

// The legacy battle generator is private to battle.js; this is its code verbatim.
function legacyMakeRng(seed) {
  let state = (Number(seed) >>> 0) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEEDS = [undefined, 0, 1, 2, 3, 7, 11, 19, 42, 0x415348, 0xffffffff, 0x100000001, -5, '17', 'abc', 1.5, 2 ** 40 + 3];

test('seededRandom reproduces the legacy xorshift stream bit for bit', () => {
  for (const seed of SEEDS) {
    const a = seed === undefined ? legacySeededRandom() : legacySeededRandom(seed);
    const b = seed === undefined ? seededRandom() : seededRandom(seed);
    for (let i = 0; i < 500; i += 1) assert.equal(b(), a(), `seed ${String(seed)} draw ${i}`);
  }
});

test('makeRng reproduces the legacy battle stream bit for bit', () => {
  for (const seed of SEEDS.filter((s) => s !== undefined)) {
    const a = legacyMakeRng(seed);
    const b = makeRng(seed);
    for (let i = 0; i < 500; i += 1) assert.equal(b(), a(), `seed ${String(seed)} draw ${i}`);
  }
});

test('streams are independent objects and stay in [0, 1)', () => {
  const first = seededRandom(5);
  const second = seededRandom(5);
  first();
  first();
  const expected = seededRandom(5);
  assert.equal(second(), expected(), 'a second stream is unaffected by the first');
  for (let i = 0; i < 1000; i += 1) {
    const x = makeRng(9)();
    assert.ok(x >= 0 && x < 1);
  }
});

test('geometry helpers', () => {
  assert.equal(manhattan({ c: 1, r: 2 }, { c: 4, r: -2 }), 7);
  assert.equal(tileDistance([1, 2], [4, -2]), 7);
  const source = { a: [1, { b: 2 }] };
  const copy = clone(source);
  copy.a[1].b = 3;
  assert.equal(source.a[1].b, 2);
  const frozen = deepFreeze({ a: [{ b: 1 }] });
  assert.throws(() => { 'use strict'; frozen.a[0].b = 2; });
});
