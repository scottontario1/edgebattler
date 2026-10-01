import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveArt, drawMetrics, textureKeyFor } from '../../src/game/world/unit-art.js';

const classic = JSON.parse(readFileSync('public/sprites/manifest.json', 'utf8'));
const factions = JSON.parse(readFileSync('public/sprites/factions-manifest.json', 'utf8')).units;
const manifests = { classic, factions };

test('recruits resolve through their class and use _red for the red army', () => {
  const blue = resolveArt({ id: 'pike_b1', cls: 'pikeman', variantId: 'pikeman', faction: 'blue' }, manifests);
  const red = resolveArt({ id: 'pike_r1', cls: 'pikeman', variantId: 'pikeman', faction: 'red' }, manifests);
  assert.equal(blue.key, 'pikeman');
  assert.equal(blue.textureKey, 'art:classic:pikeman:blue');
  assert.equal(red.textureKey, 'art:classic:pikeman:red');
  assert.equal(red.native, false);
});

test('heroes resolve by id or class and have one drawing for both sides', () => {
  assert.equal(resolveArt({ id: 'brenna', cls: 'paladin', faction: 'blue' }, manifests).key, 'brenna');
  assert.equal(resolveArt({ id: 'x1', cls: 'barbarian', faction: 'red' }, manifests).textureKey, 'art:classic:dreg:blue');
});

test('spriteKey beats variantId beats id beats class', () => {
  const unit = { spriteKey: 'crownGuard', variantId: 'pikeman', id: 'brenna', cls: 'archer', faction: 'red' };
  assert.equal(resolveArt(unit, manifests).key, 'crownGuard');
  assert.equal(resolveArt({ ...unit, spriteKey: undefined }, manifests).key, 'pikeman');
  assert.equal(resolveArt({ ...unit, spriteKey: undefined, variantId: undefined }, manifests).key, 'brenna');
});

test('faction and monster art keep native colours (no red variant)', () => {
  const ogre = resolveArt({ id: 'ogre1', spriteKey: 'monsterOgre', cls: 'pikeman', faction: 'red' }, manifests);
  assert.equal(ogre.source, 'faction');
  assert.equal(ogre.native, true);
  assert.equal(ogre.textureKey, textureKeyFor('faction', 'monsterOgre'));
});

test('unknown identities and missing manifests resolve to null instead of throwing', () => {
  assert.equal(resolveArt({ id: 'zz', cls: 'wizard' }, manifests), null);
  assert.equal(resolveArt({ id: 'brenna', cls: 'paladin' }, {}), null);
  assert.equal(resolveArt(null, manifests), null);
});

test('every manifest drawing yields sane metrics', () => {
  for (const info of [...Object.values(classic), ...Object.values(factions)]) {
    const m = drawMetrics(info);
    assert.ok(m.scale > 0 && m.scale < 2, 'scale');
    assert.ok(m.height > 30 && m.height < 400, `height ${m.height}`);
    assert.ok(m.anchorX > 0 && m.anchorX < 1 && m.anchorY > 0.8 && m.anchorY <= 1);
  }
});
