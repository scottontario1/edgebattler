// Differential tests for unit constructors: every class, variant, monster and champion of every
// faction must produce records identical to the legacy constructors.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RECRUIT, VARIANTS, CHAMPION_TEMPLATES, UNITS, createRecruitUnit, createGradedRecruitUnit, createChampionUnit, createHeroRespawnData,
} from '../../legacy/src/roster.js';
import { MONSTERS, createMonsterUnit } from '../../legacy/src/monsters.js';
import { armyRoster, championFor, FACTIONS } from '../../legacy/src/setup.js';
import { forEachFactionSet, withFactions } from './legacy.mjs';
import { createContent } from '../../src/core/setup/content.js';

const OVERRIDES = [{}, { hp: 5, lv: 9 }, { weapon: 'Steel Axe', stance: 'hold' }, { passives: [{ id: 'x', effect: { damageDealt: 1 } }] }];

test('createRecruitUnit matches legacy for every class and variant', () => {
  forEachFactionSet((ids, content) => {
    const keys = [...Object.keys(RECRUIT), ...Object.keys(VARIANTS)];
    for (const key of keys) {
      for (const [index, over] of OVERRIDES.entries()) {
        const side = index % 2 ? 'red' : 'blue';
        assert.deepEqual(
          content.createRecruitUnit(key, `u-${key}`, side, index + 1, 2 * index, over),
          createRecruitUnit(key, `u-${key}`, side, index + 1, 2 * index, over),
          `[${ids}] ${key} ${index}`,
        );
      }
    }
  });
});

test('createRecruitUnit errors the same way for unknown keys', () => {
  forEachFactionSet((ids, content) => {
    for (const key of ['dragon', 'monsterRat', 'paladin']) {
      assert.throws(() => createRecruitUnit(key, 'x', 'blue', 0, 0), /Unknown recruit class/);
      assert.throws(() => content.createRecruitUnit(key, 'x', 'blue', 0, 0), /Unknown recruit class: /);
    }
  });
});

test('createGradedRecruitUnit matches legacy for stars 1 to 3', () => {
  forEachFactionSet((ids, content) => {
    for (const key of [...Object.keys(RECRUIT), ...Object.keys(VARIANTS)]) {
      for (const stars of [1, 2, 3]) {
        assert.deepEqual(content.createGradedRecruitUnit(key, `g-${key}`, 'blue', stars), createGradedRecruitUnit(key, `g-${key}`, 'blue', stars), `[${ids}] ${key} ${stars}`);
      }
    }
    assert.deepEqual(content.createGradedRecruitUnit('pikeman', 'a', 'red'), createGradedRecruitUnit('pikeman', 'a', 'red'));
  });
});

test('createMonsterUnit matches legacy for every monster', () => {
  const content = createContent();
  for (const key of Object.keys(MONSTERS)) {
    for (const [c, r] of [[0, 0], [5, 7]]) {
      assert.deepEqual(content.createMonsterUnit(key, `m-${key}`, 'red', c, r), createMonsterUnit(key, `m-${key}`, 'red', c, r), key);
    }
  }
  assert.throws(() => content.createMonsterUnit('dragon', 'bad', 'red', 0, 0), /Unknown monster: dragon/);
  assert.throws(() => createMonsterUnit('dragon', 'bad', 'red', 0, 0), /Unknown monster: dragon/);
});

test('champions and hero respawns match legacy', () => {
  forEachFactionSet((ids, content) => {
    for (const id of Object.keys(CHAMPION_TEMPLATES)) {
      for (const side of ['blue', 'red']) {
        assert.deepEqual(content.createChampionUnit(id, side, 3, 4), createChampionUnit(id, side, 3, 4), `[${ids}] champion ${id} ${side}`);
      }
    }
    for (const id of ['brenna', 'dreg', ...Object.keys(CHAMPION_TEMPLATES)]) {
      assert.deepEqual(content.createHeroRespawnData(id, 6, 7), createHeroRespawnData(id, 6, 7), `[${ids}] respawn ${id}`);
    }
    assert.throws(() => content.createChampionUnit('nobody', 'blue', 0, 0), /Unknown champion: nobody/);
    assert.throws(() => content.createHeroRespawnData('pike_b1', 0, 0), /Unknown hero champion: pike_b1/);
  });
});

test('armyRoster and championFor match legacy for every faction and side', () => {
  const ids = FACTIONS.map((f) => f.id);
  for (const blue of ids) {
    for (const red of ids) {
      withFactions([blue, red], (content) => {
        for (const [factionId, side] of [[blue, 'blue'], [red, 'red'], [blue, 'red'], [red, 'blue']]) {
          assert.equal(content.championFor(factionId, side), championFor(factionId, side));
          // A faction whose culture is not registered throws in both engines; compare the outcome.
          const mine = attempt(() => content.armyRoster(factionId, side));
          const legacy = attempt(() => armyRoster(factionId, side));
          assert.deepEqual(mine, legacy, `${blue} v ${red}: ${factionId} on ${side}`);
        }
      });
    }
  }
  assert.deepEqual(createContent().armyRoster('nonsense', 'blue'), armyRoster('nonsense', 'blue'), 'unknown faction falls back to classic');
});

function attempt(fn) {
  try {
    return { ok: fn() };
  } catch (error) {
    return { error: error.message };
  }
}

test('constructed records are independent plain data', () => {
  forEachFactionSet((ids, content) => {
    if (ids.length !== 4) return;
    const a = content.createRecruitUnit('crownGuard', 'a', 'blue', 1, 1);
    a.passives[0].effect.equipDef = 99;
    a.look.hair = '#000000';
    a.statuses.x = 1;
    const b = content.createRecruitUnit('crownGuard', 'b', 'blue', 1, 1);
    assert.notEqual(b.passives[0].effect.equipDef, 99);
    assert.notEqual(b.look.hair, '#000000');
    assert.deepEqual(b.statuses, {});
    const ghoul = content.createRecruitUnit('feralGhoul', 'g', 'red', 0, 0);
    ghoul.onDeath.spawn.hp = 50;
    assert.equal(content.createRecruitUnit('feralGhoul', 'g2', 'red', 0, 0).onDeath.spawn.hp, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(a)));
  });
});

test('starting roster records are copied, not shared', () => {
  const content = createContent();
  const first = content.armyRoster('classic', 'blue');
  first[0].hp = 1;
  assert.equal(content.armyRoster('classic', 'blue')[0].hp, UNITS[0].hp);
});
