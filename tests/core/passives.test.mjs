// Differential and rule tests for passives: faction and monster passives, auras, conditions and revenant.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePassives as legacyEvaluate, hasRevenant as legacyHasRevenant, passiveHolds as legacyHolds, STATUS_EFFECT_KEYS as LEGACY_KEYS } from '../../legacy/src/passives.js';
import { MONSTERS } from '../../legacy/src/monsters.js';
import { evaluatePassives, hasRevenant, passiveHolds, objectsNear, STATUS_EFFECT_KEYS } from '../../src/core/rules/passives.js';
import { FACTION_SETS, withFactions, scenarioRandom } from './legacy.mjs';
import { createContent, createContentForFactions } from '../../src/core/setup/content.js';

const object = (id, kind, c, r, hp = 1) => ({ id, kind: 'object', objectKind: kind, c, r, hp });

function randomField(random, content) {
  const recruitKeys = [...Object.keys(content.recruitClasses), ...Object.keys(content.variants)];
  const monsterKeys = Object.keys(MONSTERS);
  const units = [];
  const count = 4 + random.int(9);
  const taken = new Set();
  for (let i = 0; i < count; i += 1) {
    let c;
    let r;
    do {
      c = 3 + random.int(5);
      r = 3 + random.int(5);
    } while (taken.has(`${c},${r}`));
    taken.add(`${c},${r}`);
    const faction = random.next() < 0.6 ? 'blue' : 'red';
    const unit = random.next() < 0.25
      ? content.createMonsterUnit(random.pick(monsterKeys), `u${i}`, faction, c, r)
      : content.createRecruitUnit(random.pick(recruitKeys), `u${i}`, faction, c, r);
    unit.stance = random.pick(['advance', 'hold', 'protect']);
    unit.hp = random.pick([unit.maxHp, unit.maxHp, Math.floor(unit.maxHp / 2), Math.ceil(unit.maxHp / 2), 1, 0]);
    units.push(unit);
  }
  const champions = Object.keys(content.championTemplates);
  if (champions.length) {
    const champ = content.createChampionUnit(random.pick(champions), 'blue', 1, 1);
    champ.id = 'champ';
    units.push(champ);
  }
  const objects = [];
  for (let i = 0; i < random.int(5); i += 1) objects.push(object(`o${i}`, random.pick(['corpse', 'barricade']), 3 + random.int(5), 3 + random.int(5), random.pick([1, 1, 0])));
  return { units, objects };
}

test('evaluatePassives equals legacy for random fields of every faction and monster', () => {
  let nonEmpty = 0;
  const seenPassives = new Set();
  for (const [setIndex, ids] of FACTION_SETS.entries()) {
    withFactions(ids, (content) => {
      const random = scenarioRandom(9000 + setIndex);
      for (let round = 0; round < 120; round += 1) {
        const { units, objects } = randomField(random, content);
        const moved = new Set(units.filter(() => random.next() < 0.5).map((u) => u.id));
        const owned = new Set(units.filter(() => random.next() < 0.3).map((u) => u.id));
        const stanceOf = (u) => u.stance;
        const objectCount = (u, kind, radius) => objectsNear(u, objects, kind, radius).length;
        const base = { moved, stanceOf, controlled: (u) => owned.has(u.id) };
        const expected = legacyEvaluate(units, { ...base, objectCount });
        const actual = evaluatePassives(units, { ...base, objects });
        assert.deepEqual([...actual.entries()], [...expected.entries()], `[${ids}] round ${round}`);
        const viaCallback = evaluatePassives(units, { ...base, objectCount });
        assert.deepEqual([...viaCallback.entries()], [...expected.entries()]);
        if (actual.size) nonEmpty += 1;
        for (const u of units) for (const p of u.passives ?? []) seenPassives.add(p.id);
        for (const u of units) assert.equal(hasRevenant(u), legacyHasRevenant(u));
      }
    });
  }
  assert.ok(nonEmpty > 200, `${nonEmpty} fields produced effects`);
  for (const id of ['lineDoctrine', 'shieldwall', 'banner', 'swornGuard', 'crownPresence', 'momentum', 'lastFang', 'runningShot', 'plantedPike', 'setShield',
    'preparedShot', 'wear', 'ironclad', 'dutyBeyondDeath', 'feedsOnTheFallen', 'revenantVow', 'deathlessStand', 'packScavenger', 'graveScent']) {
    assert.ok(seenPassives.has(id), `${id} was exercised`);
  }
});

test('passiveHolds returns the same codes as legacy for each condition', () => {
  withFactions(['crown', 'court', 'league'], (content) => {
    const random = scenarioRandom(31);
    for (let round = 0; round < 60; round += 1) {
      const { units, objects } = randomField(random, content);
      const ctx = { units, moved: new Set([units[0].id]), objects, objectCount: (u, k, r) => objectsNear(u, objects, k, r).length };
      for (const unit of units) {
        for (const passive of unit.passives ?? []) assert.equal(passiveHolds(unit, passive, ctx), legacyHolds(unit, passive, ctx));
      }
    }
  });
  assert.deepEqual([...STATUS_EFFECT_KEYS], [...LEGACY_KEYS]);
});

test('monster passive trigger edges (ported from legacy monsters tests)', () => {
  const content = createContent();
  const make = (key, overrides = {}) => ({ ...content.createMonsterUnit(key, key, 'red', 5, 5), ...overrides });
  const none = { moved: new Set() };
  const rat = make('monsterRat');
  const ally = { id: 'ally', faction: 'red', cls: 'pikeman', hp: 10, c: 6, r: 5 };
  assert.deepEqual(evaluatePassives([rat, ally], none).get(rat.id), { hitBonus: 10 });
  ally.c = 7;
  assert.equal(evaluatePassives([rat, ally], none).has(rat.id), false);

  const spider = make('monsterSpider');
  assert.deepEqual(evaluatePassives([spider], none).get(spider.id), { hitBonus: 10 });
  assert.equal(evaluatePassives([spider], { moved: new Set([spider.id]) }).has(spider.id), false);

  const goblin = make('monsterHyenaGoblin');
  assert.deepEqual(evaluatePassives([goblin, { ...ally, c: 6 }], none).get(goblin.id), { damageDealt: 1 });
  assert.equal(evaluatePassives([goblin], none).has(goblin.id), false);

  const golem = make('monsterBogGolem', { stance: 'hold' });
  assert.deepEqual(evaluatePassives([golem], none).get(golem.id), { damageTaken: 2 });
  assert.equal(evaluatePassives([make('monsterBogGolem', { stance: 'advance' })], none).has('monsterBogGolem'), false);

  assert.deepEqual(evaluatePassives([make('monsterOgre')], none).get('monsterOgre'), { ignoreDefense: 1 });
  const wolf = make('monsterWerewolf');
  assert.equal(evaluatePassives([{ ...wolf, hp: 11 }], none).has(wolf.id), false, 'half HP is not below half');
  assert.deepEqual(evaluatePassives([{ ...wolf, hp: 10 }], none).get(wolf.id), { damageDealt: 2 });
  const bear = make('monsterMothBear');
  assert.equal(evaluatePassives([{ ...bear, hp: 12.5 }], none).has(bear.id), false, 'half HP is not below half');
  assert.deepEqual(evaluatePassives([{ ...bear, hp: 12 }], none).get(bear.id), { damageTaken: 1 });

  const hound = make('corpsehound');
  const corpseNear = { ...none, objectCount: (_u, kind, radius) => (kind === 'corpse' && radius === 2 ? 1 : 0) };
  assert.deepEqual(evaluatePassives([hound], corpseNear).get(hound.id), { damageDealt: 2 });
  assert.equal(evaluatePassives([hound], { ...none, objectCount: () => 0 }).has(hound.id), false);
  const corpse = object('c', 'corpse', 6, 5);
  assert.deepEqual(evaluatePassives([hound], { ...none, objects: [corpse] }).get(hound.id), { damageDealt: 2 });
  assert.equal(evaluatePassives([hound], { ...none, objects: [object('c', 'corpse', 8, 5)] }).has(hound.id), false, 'out of radius');
  assert.equal(evaluatePassives([hound], { ...none, objects: [object('c', 'barricade', 6, 5)] }).has(hound.id), false, 'wrong kind');
  assert.equal(evaluatePassives([hound], { ...none, objects: [object('c', 'corpse', 6, 5, 0)] }).has(hound.id), false, 'spent corpse');
});

const FIXTURE = {
  id: 'fixture',
  variants: {
    fxGuard: {
      base: 'pikeman', name: 'Fixture Guard', delta: { hp: 2, def: 1, mov: -1 },
      passives: [{ id: 'wall', when: { adjacentAlly: { classes: ['pikeman'], min: 1 } }, perAdjacent: true, cap: 2, effect: { damageTaken: 2 } }],
    },
    fxBanner: {
      base: 'pikeman', name: 'Fixture Banner', delta: { hp: -4 },
      passives: [{ id: 'banner', aura: { radius: 2, stance: ['hold', 'protect'] }, effect: { damageTaken: 1 } }],
    },
    fxRevenant: { base: 'pikeman', name: 'Fixture Revenant', passives: [{ id: 'vow', effect: { revenant: 1 } }] },
  },
  pool: ['fxGuard', 'fxBanner'],
};

test('passives: adjacency (capped, per ally), stance/moved conditions and auras (ported from legacy culture tests)', () => {
  const content = createContent({ cultures: [FIXTURE] });
  const rec = (key, id, faction, c, r, extra = {}) => ({ ...content.createRecruitUnit(key, id, faction, c, r), ...extra });
  const at = (units) => evaluatePassives(units, { moved: new Set(), stanceOf: (x) => x.stance });
  const g = rec('fxGuard', 'g', 'blue', 5, 5);
  const allies = [rec('pikeman', 'p1', 'blue', 4, 5), rec('pikeman', 'p2', 'blue', 6, 5), rec('pikeman', 'p3', 'blue', 5, 4)];
  const foe = rec('pikeman', 'e', 'red', 5, 6);
  assert.equal(at([g, foe]).get('g'), undefined, 'no adjacent ally, no effect');
  assert.equal(at([g, allies[0], foe]).get('g').damageTaken, 2);
  assert.equal(at([g, ...allies, foe]).get('g').damageTaken, 4, 'cap 2 allies');
  assert.equal(at([g, rec('archer', 'a', 'blue', 4, 5)]).get('g'), undefined, 'class filter');

  const banner = rec('fxBanner', 'b', 'blue', 5, 5);
  const holdUnit = rec('pikeman', 'h', 'blue', 5, 7, { stance: 'hold' });
  const advanceUnit = rec('pikeman', 'v', 'blue', 5, 3, { stance: 'advance' });
  const farUnit = rec('pikeman', 'f', 'blue', 5, 9, { stance: 'hold' });
  const enemy = rec('pikeman', 'x', 'red', 5, 6, { stance: 'hold' });
  const effects = at([banner, holdUnit, advanceUnit, farUnit, enemy]);
  assert.equal(effects.get('h').damageTaken, 1);
  for (const id of ['v', 'f', 'x', 'b']) assert.equal(effects.get(id), undefined, id);

  const mover = { ...rec('pikeman', 'm', 'blue', 2, 2), passives: [{ id: 'mo', when: { moved: true }, effect: { damageDealt: 2 } }, { id: 'st', when: { moved: false }, effect: { damageTaken: 1 } }] };
  assert.deepEqual(evaluatePassives([mover], { moved: new Set(['m']) }).get('m'), { damageDealt: 2 });
  assert.deepEqual(evaluatePassives([mover], { moved: new Set() }).get('m'), { damageTaken: 1 });
});

test('hpBelow, hpAbove, onControlled and includeSelf auras', () => {
  const content = createContent();
  const base = content.createRecruitUnit('pikeman', 'u', 'blue', 4, 4);
  const withPassive = (when, extra = {}) => ({ ...base, passives: [{ id: 'p', when, effect: { damageDealt: 1 }, ...extra }] });
  const run = (unit, ctx = {}) => evaluatePassives([unit], { moved: new Set(), ...ctx }).get('u');
  assert.deepEqual(run({ ...withPassive({ hpBelow: 0.5 }), hp: 11 }), { damageDealt: 1 });
  assert.equal(run({ ...withPassive({ hpBelow: 0.5 }), hp: 12 }), undefined, 'strictly below');
  assert.deepEqual(run({ ...withPassive({ hpAbove: 0.5 }), hp: 13 }), { damageDealt: 1 });
  assert.equal(run({ ...withPassive({ hpAbove: 0.5 }), hp: 12 }), undefined, 'strictly above');
  assert.equal(run(withPassive({ onControlled: true })), undefined, 'no controlled() callback');
  assert.deepEqual(run(withPassive({ onControlled: true }), { controlled: () => true }), { damageDealt: 1 });
  const self = { ...base, passives: [{ id: 'a', aura: { radius: 1, includeSelf: true }, effect: { damageDealt: 3 } }] };
  assert.deepEqual(run(self), { damageDealt: 3 });
  const noSelf = { ...base, passives: [{ id: 'a', aura: { radius: 1 }, effect: { damageDealt: 3 } }] };
  assert.equal(run(noSelf), undefined);
  assert.equal(run({ ...withPassive({}), hp: 0 }), undefined, 'the dead have no effects');
});

test('revenant: once per unit, never after use', () => {
  const content = createContent({ cultures: [FIXTURE] });
  const knight = content.createRecruitUnit('fxRevenant', 'k', 'blue', 0, 0);
  assert.equal(hasRevenant(knight), true);
  assert.equal(hasRevenant({ ...knight, revenantUsed: true }), false);
  assert.equal(hasRevenant(content.createRecruitUnit('pikeman', 'p', 'blue', 0, 0)), false);
  const court = createContentForFactions(['court']);
  const mourning = court.createRecruitUnit('mourningKnight', 'm', 'red', 0, 0);
  assert.equal(hasRevenant(mourning), true);
  assert.deepEqual(evaluatePassives([mourning], { moved: new Set() }).get('m') ?? {}, {}, 'revenant is not a status');
});
