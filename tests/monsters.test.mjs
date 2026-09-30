import test from 'node:test';
import assert from 'node:assert/strict';
import { MONSTERS, createMonsterUnit } from '../src/monsters.js';
import { createMatch } from '../src/match.js';
import { kitFor } from '../src/abilities.js';
import { WEAPONS } from '../src/combat.js';
import { ACTIVE_CULTURES, CULTURES } from '../src/cultures.js';
import { cardFor, unitCardFor } from '../src/cards.js';
import { H, W } from '../src/board.js';
import { createRecruitUnit } from '../src/roster.js';
import { evaluatePassives } from '../src/passives.js';

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

test('monster passive trigger edges use the shared passive evaluator', () => {
  const make = (key, overrides = {}) => ({ ...createMonsterUnit(key, key, 'red', 5, 5), ...overrides });
  const rat = make('monsterRat');
  const ally = { id: 'ally', faction: 'red', cls: 'pikeman', hp: 10, c: 6, r: 5 };
  assert.deepEqual(evaluatePassives([rat, ally], { moved: new Set() }).get(rat.id), { hitBonus: 10 });
  ally.c = 7;
  assert.equal(evaluatePassives([rat, ally], { moved: new Set() }).has(rat.id), false);

  const spider = make('monsterSpider');
  assert.deepEqual(evaluatePassives([spider], { moved: new Set() }).get(spider.id), { hitBonus: 10 });
  assert.equal(evaluatePassives([spider], { moved: new Set([spider.id]) }).has(spider.id), false);

  const goblin = make('monsterHyenaGoblin');
  const goblinAlly = { ...ally, c: 6 };
  assert.deepEqual(evaluatePassives([goblin, goblinAlly], { moved: new Set() }).get(goblin.id), { damageDealt: 1 });
  assert.equal(evaluatePassives([goblin], { moved: new Set() }).has(goblin.id), false);

  const golem = make('monsterBogGolem', { stance: 'hold' });
  assert.deepEqual(evaluatePassives([golem], { moved: new Set() }).get(golem.id), { damageTaken: 2 });
  assert.equal(evaluatePassives([make('monsterBogGolem', { stance: 'advance' })], { moved: new Set() }).has(golem.id), false);

  assert.deepEqual(evaluatePassives([make('monsterOgre')], { moved: new Set() }).get('monsterOgre'), { ignoreDefense: 1 });
  const wolf = make('monsterWerewolf');
  assert.equal(evaluatePassives([{ ...wolf, hp: 11 }], { moved: new Set() }).has(wolf.id), false, 'half HP is not below half');
  assert.deepEqual(evaluatePassives([{ ...wolf, hp: 10 }], { moved: new Set() }).get(wolf.id), { damageDealt: 2 });
  const bear = make('monsterMothBear');
  assert.equal(evaluatePassives([{ ...bear, hp: 12.5 }], { moved: new Set() }).has(bear.id), false, 'half HP is not below half');
  assert.deepEqual(evaluatePassives([{ ...bear, hp: 12 }], { moved: new Set() }).get(bear.id), { damageTaken: 1 });

  const hound = make('corpsehound');
  assert.deepEqual(evaluatePassives([hound], { moved: new Set(), objectCount: (_u, kind, radius) => kind === 'corpse' && radius === 2 ? 1 : 0 }).get(hound.id), { damageDealt: 2 });
  assert.equal(evaluatePassives([hound], { moved: new Set(), objectCount: () => 0 }).has(hound.id), false);
});

test('Ogre Crushing Blows changes actual seeded match strike damage', () => {
  const run = (withPassive, seed = 91) => {
    const ogre = { ...createMonsterUnit('monsterOgre', 'ogre', 'red', 5, 5), str: 30, skl: 0 };
    const defender = { ...createRecruitUnit('pikeman', 'target', 'blue', 6, 5), hp: 200, maxHp: 200 };
    ogre.stance = 'hold';
    defender.stance = 'hold';
    if (!withPassive) ogre.passives = [];
    const match = createMatch({ seed, roster: [ogre, defender] });
    const result = match.resolveRound();
    const strike = result.batches.flatMap((b) => b.events || []).find((e) => e.type === 'strike' && e.attackerId === 'ogre');
    assert.ok(strike, 'Ogre produced a strike');
    return strike;
  };
  let seed = 1;
  let active;
  for (; seed < 200; seed += 1) {
    active = run(true, seed);
    if (active.hit && !active.crit) break;
  }
  assert.ok(seed < 200, 'found a seeded noncritical hit');
  const baseline = run(false, seed);
  assert.equal(baseline.hit, true);
  assert.equal(baseline.crit, false);
  assert.equal(active.damage, baseline.damage + 1);
});
