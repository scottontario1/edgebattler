import test from 'node:test';
import assert from 'node:assert/strict';
import { MONSTERS, createMonsterUnit } from '../src/monsters.js';
import { createMatch } from '../src/match.js';
import { kitFor } from '../src/abilities.js';
import { WEAPONS } from '../src/combat.js';
import { ACTIVE_CULTURES, CULTURES } from '../src/cultures.js';
import { cardFor, unitCardFor } from '../src/cards.js';
import { H, W } from '../src/board.js';

const keys = Object.keys(MONSTERS);

test('monster definitions produce complete enemy-only melee records without culture or card registration', () => {
  const culturesBefore = [...ACTIVE_CULTURES];
  const registryBefore = Object.keys(CULTURES).sort();

  for (const [index, key] of keys.entries()) {
    const def = MONSTERS[key];
    const unit = createMonsterUnit(key, `monster-${index}`, 'red', index, 0);
    assert.equal(unit.monster, true);
    assert.equal(unit.culture, def.culture);
    assert.equal(unit.cls, key);
    assert.equal(unit.classId, def.base);
    assert.equal(unit.variantId, key);
    assert.equal(unit.spriteKey, def.spriteKey);
    assert.equal(unit.name, def.name);
    assert.equal(unit.description, def.description);
    assert.ok(def.description.length > 12);
    assert.equal(unit.hp, unit.maxHp);
    assert.equal(unit.selectedAbilities.length, 0);
    assert.equal(unit.energy, 0);
    assert.equal(unit.maxEnergy, 4);
    assert.deepEqual(unit.cooldowns, {});
    assert.deepEqual(unit.statuses, {});
    assert.equal(WEAPONS[unit.weapon].rng[1], 1);
    assert.deepEqual(kitFor(unit), []);
    assert.equal(unitCardFor(key), null);
    assert.equal(cardFor(key), null);
  }

  assert.deepEqual([...ACTIVE_CULTURES], culturesBefore);
  assert.deepEqual(Object.keys(CULTURES).sort(), registryBefore);
});

test('monster records pass through createMatch on the default board with ordinary match state', () => {
  const roster = keys.map((key, index) => createMonsterUnit(key, `monster-${index}`, index % 2 ? 'red' : 'blue', index, index % 2 ? 1 : H - 2));
  assert.ok(roster.every(unit => unit.c >= 0 && unit.c < W && unit.r >= 0 && unit.r < H));
  const match = createMatch({ seed: 23, roster });

  for (const source of roster) {
    const unit = match.byId(source.id);
    assert.ok(unit);
    assert.equal(unit.monster, true);
    assert.equal(unit.culture, source.culture);
    assert.equal(unit.spriteKey, source.spriteKey);
    assert.equal(unit.hp, unit.maxHp);
    assert.equal(unit.energy, 1); // createMatch grants its normal opening field energy.
    assert.equal(unit.state, 'field');
    assert.deepEqual(unit.selectedAbilities, []);
  }
  assert.equal(match.board().byId.size, roster.length);
});

test('unknown monster keys fail with a useful error', () => {
  assert.throws(() => createMonsterUnit('dragon', 'bad', 'red', 0, 0), /Unknown monster: dragon/);
});
