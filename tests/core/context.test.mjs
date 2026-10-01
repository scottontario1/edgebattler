// The content context: isolation between contexts, immutability, culture hooks, error cases and the
// ported legacy culture/category/monster rule checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createContent, createContentForFactions } from '../../src/core/setup/content.js';
import { CATEGORY_IDS } from '../../src/core/content/categories.js';
import { MONSTERS } from '../../src/core/content/monsters.js';
import { computeRange, occupancyFromRecords } from '../../src/core/rules/movement.js';
import { forecast } from '../../src/core/rules/forecast.js';
import { createBoard } from '../../src/core/rules/board.js';
import { RIVER_FORD } from '../../src/core/content/maps/index.js';
import { seededRandom } from '../../src/core/util/rng.js';

const FIXTURE = {
  id: 'fixture',
  classes: {
    sysSapper: {
      name: 'Sys Sapper', title: 'Digger', stats: { hp: 20, str: 6, skl: 5, spd: 5, def: 6, mov: 4 }, weapon: 'Sys Pick',
      weaponDef: { mt: 6, hit: 70, crit: 0, rng: [1, 1], kind: 'pick' }, spriteBase: 'pikeman', tint: '#4E7C6A', category: 'support',
      card: { rarity: 'uncommon', cost: 2, class: 'Foot', range: 1, defaultStance: 'hold' },
    },
    sysBow: {
      name: 'Sys Bow', stats: { hp: 16, str: 5, skl: 7, spd: 6, def: 3, mov: 6 }, weapon: 'Sys Bow',
      weaponDef: { mt: 5, hit: 80, crit: 0, rng: [2, 3], kind: 'bow' }, moveType: 'mounted', spriteBase: 'archer',
      card: { rarity: 'common', cost: 3, defaultStance: 'hold' },
    },
    sysMage: {
      name: 'Sys Mage', stats: { hp: 12, str: 1, mag: 9, skl: 6, spd: 5, def: 1, res: 5, mov: 4 }, weapon: 'Sys Staff',
      weaponDef: { mt: 4, hit: 85, crit: 0, rng: [1, 2], kind: 'tome', magic: true }, spriteBase: 'archer',
    },
  },
  variants: {
    fxGuard: { base: 'pikeman', name: 'Fixture Guard', delta: { hp: 2, def: 1, mov: -1 }, passives: [{ id: 'wall', effect: { damageTaken: 2 } }], card: { rarity: 'uncommon' } },
    fxOnSys: { base: 'sysSapper', name: 'Fixture On Sys', delta: { hp: 1 } },
  },
  abilities: [
    { id: 'sysDig', name: 'Sys Dig', classes: ['sysSapper'], cost: 1, cooldown: 2, phase: 'defense', description: 'x' },
    { id: 'fxLow', name: 'Fixture Low', classes: ['pikeman'], anyUnit: true, cost: 0, cooldown: 1, phase: 'recovery', description: 'x' },
    { id: 'fxCulture', name: 'Fixture Culture', classes: ['archer'], cost: 0, cooldown: 1, phase: 'recovery', description: 'x' },
  ],
  spells: { fxCry: { spell: { id: 'fxCry', name: 'Fixture Cry', type: 'spell', cost: 1, target: 'friendly-unit', duration: 'upcoming-battle', effect: { type: 'status', status: 'damageDealt', duration: 2 } }, card: { rarity: 'common', effect: 'test' } } },
  pool: ['fxGuard', 'sysSapper', 'fxCry'],
};

test('two contexts with different cultures coexist without interference', () => {
  const crown = createContentForFactions(['crown']);
  const court = createContentForFactions(['court']);
  const plain = createContent();
  const both = createContentForFactions(['crown', 'court']);

  assert.deepEqual(crown.cultureIds, ['crown']);
  assert.deepEqual(court.cultureIds, ['court']);
  assert.deepEqual(plain.cultureIds, []);
  assert.deepEqual(both.cultureIds, ['crown', 'court']);

  // Each context knows only its own classes, variants, cards, weapons and champions.
  assert.ok(crown.recruitClasses.bannerman && !crown.recruitClasses.feralGhoul);
  assert.ok(court.recruitClasses.feralGhoul && !court.recruitClasses.bannerman);
  assert.equal(plain.recruitClasses.bannerman, undefined);
  assert.equal(crown.cardFor('feralGhoul'), null);
  assert.ok(court.cardFor('feralGhoul'));
  assert.equal(plain.weapons['Ghoul Claws'], undefined);
  assert.ok(court.weapons['Ghoul Claws']);
  assert.throws(() => crown.createRecruitUnit('feralGhoul', 'g', 'red', 0, 0), /Unknown recruit class/);
  assert.ok(court.createRecruitUnit('feralGhoul', 'g', 'red', 0, 0));
  assert.throws(() => court.createChampionUnit('brennaCrown', 'blue', 0, 0), /Unknown champion/);
  assert.deepEqual(plain.rarityGate, {});
  assert.deepEqual(crown.rarityGate, { uncommon: 3, rare: 6 });
  assert.equal(crown.moveTypeOf('relicWalker'), 'foot');
  assert.equal(createContentForFactions(['league']).moveTypeOf('relicWalker'), 'armor');

  // Interleaved use: the same unit record forecast in two contexts with different weapon tables.
  const board = createBoard(RIVER_FORD);
  const striker = { ...court.createRecruitUnit('feralGhoul', 'g', 'blue', 4, 4) };
  const target = { ...plain.createRecruitUnit('pikeman', 'p', 'red', 5, 4) };
  const withCourt = forecast(striker, target, [4, 4], { board, content: court });
  const withPlain = forecast(striker, target, [4, 4], { board, content: plain });
  assert.equal(withCourt.atk.dmg, 7 + 8 - target.def - board.tile(5, 4).def);
  assert.equal(withPlain.atk.dmg, 7 + 5 - target.def - board.tile(5, 4).def, 'an unknown weapon falls back to the plain weapon');

  // Ranges use each context's own movement types.
  const league = createContentForFactions(['league']);
  const forestBoard = createBoard({ id: 'forest', layout: ['GFFFG', 'GMMMG', 'GFFFG'] });
  const rider = league.createRecruitUnit('dragoon', 'd', 'blue', 0, 0);
  const occupancy = occupancyFromRecords([rider]);
  const mounted = computeRange(rider, forestBoard, occupancy, { content: league });
  const asFoot = computeRange(rider, forestBoard, occupancy, { content: plain });
  assert.notDeepEqual(mounted.move, asFoot.move, 'mounted and foot movement differ in one process');

  // Building and discarding contexts leaves the others untouched.
  const before = JSON.stringify(crown.recruitClasses);
  createContentForFactions(['fang', 'league']);
  createContent({ cultures: [FIXTURE] });
  assert.equal(JSON.stringify(crown.recruitClasses), before);
  assert.equal(JSON.stringify(createContent().recruitClasses), JSON.stringify(plain.recruitClasses));
});

test('contexts are immutable and records built from them are independent', () => {
  const content = createContentForFactions(['crown', 'fang', 'league', 'court']);
  assert.ok(Object.isFrozen(content));
  assert.throws(() => { content.weapons['Iron Pike'].mt = 99; }, TypeError);
  assert.throws(() => { content.recruitClasses.pikeman.hp = 99; }, TypeError);
  assert.throws(() => { content.variants.crownGuard.passives.push({}); }, TypeError);
  assert.throws(() => { content.rarityGate.rare = 1; }, TypeError);
  assert.throws(() => { content.cardFor('pikeman').cost = 9; }, TypeError);
  assert.throws(() => { content.cardFor('crownGuard').cost = 9; }, TypeError);
  assert.throws(() => { content.classMeta.pikeman.category = 'caster'; }, TypeError);
  assert.throws(() => { content.cardLimits.hand = 1; }, TypeError);
  const unit = content.createRecruitUnit('pikeman', 'a', 'blue', 0, 0);
  unit.hp = 1;
  assert.equal(content.createRecruitUnit('pikeman', 'b', 'blue', 0, 0).hp, 24, 'records are fresh plain data');
  assert.equal(content.poolFor('crown').push('x') > 0, true, 'pools are returned as copies');
  assert.equal(content.poolFor('crown').includes('x'), false);
});

test('building the same context twice yields equal, unshared content', () => {
  const a = createContentForFactions(['crown', 'court']);
  const b = createContentForFactions(['crown', 'court']);
  assert.deepEqual(a.recruitClasses, b.recruitClasses);
  assert.deepEqual(a.cultureCards, b.cultureCards);
  assert.notEqual(a.recruitClasses, b.recruitClasses);
  assert.notEqual(a.weapons, b.weapons);
});

test('card limits and the rarity gate are per context', () => {
  const tight = createContent({ cardLimits: { hand: 3, populationCap: 6 }, rarityGate: { rare: 4 } });
  const normal = createContent();
  assert.equal(tight.cardLimits.hand, 3);
  assert.equal(tight.cardLimits.populationCap, 6);
  assert.equal(tight.cardLimits.openingHand, 5, 'unlisted limits keep their defaults');
  assert.equal(normal.cardLimits.hand, 8);
  assert.equal(tight.rarityOpen('rare', 3), false);
  assert.equal(tight.rarityOpen('rare', 4), true);
  assert.equal(tight.rarityOpen('uncommon', 1), true);
  assert.equal(normal.rarityOpen('rare', 1), true);
});

test('culture hooks (ported): classes, variants, cards, weapons, movement, kits and pools register and stay in their context', () => {
  const content = createContent({ cultures: [FIXTURE] });
  const plain = createContent();
  const sapper = content.createRecruitUnit('sysSapper', 's', 'blue', 3, 3);
  assert.deepEqual([sapper.cls, sapper.maxHp, sapper.weapon, sapper.culture, sapper.stance, sapper.title], ['sysSapper', 20, 'Sys Pick', 'fixture', 'hold', 'Digger']);
  assert.equal(content.unitCardFor('sysSapper').rarity, 'uncommon');
  assert.equal(content.unitCardFor('sysBow').defaultStance, 'hold');
  assert.equal(content.unitCardFor('sysBow').cost, 3);
  assert.equal(content.moveTypes.sysBow, 'mounted');
  assert.deepEqual(content.spriteFallback.sysSapper, { base: 'pikeman', tint: '#4E7C6A', label: 'Sys Sapper' });
  assert.equal(content.categoryOf('sysSapper'), 'support');
  assert.equal(content.categoryOf('sysMage'), 'caster', 'the default for a magic weapon is caster');
  assert.equal(content.categoryOf('sysBow'), 'melee', 'any other class defaults to melee');
  assert.equal(content.weapons['Sys Bow'].rng[1], 3);
  assert.deepEqual(content.poolFor('fixture'), FIXTURE.pool);
  assert.equal(content.cardFor('fxGuard').culture, 'fixture');
  assert.equal(content.cardFor('fxGuard').rarity, 'uncommon');
  assert.equal(content.cardFor('fxCry').id, 'spell-fxCry');
  assert.ok(content.spells.fxCry);
  assert.ok(content.kitFor(sapper).some((a) => a.id === 'sysDig'));
  assert.equal(content.kitFor(sapper).some((a) => a.id === 'rally'), false);
  // An ability on a shipped class stays inside its culture unless it says anyUnit.
  assert.equal(content.abilities.fxCulture.culture, 'fixture');
  assert.equal(content.abilities.fxLow.culture, undefined);
  assert.equal(content.kitFor(content.createRecruitUnit('archer', 'a', 'blue', 1, 1)).some((a) => a.id === 'fxCulture'), false);
  assert.ok(content.kitFor(plain.createRecruitUnit('pikeman', 'p', 'blue', 1, 1)).some((a) => a.id === 'fxLow'), 'anyUnit reaches plain pikemen');
  // Nothing leaked into the plain context.
  assert.equal(plain.recruitClasses.sysSapper, undefined);
  assert.equal(plain.cardFor('fxGuard'), null);
  assert.equal(plain.abilities.sysDig, undefined);
  assert.equal(plain.spells.fxCry, undefined);
  assert.equal(plain.weapons['Sys Pick'], undefined);
  assert.equal(plain.moveTypes.sysBow, undefined);
  assert.deepEqual(plain.spriteFallback, {});
  assert.deepEqual(plain.championTemplates, {});
  assert.deepEqual(plain.variants, {});
});

test('a variant recruits as its base class with the stat delta, culture and passives (ported)', () => {
  const content = createContent({ cultures: [FIXTURE] });
  const base = content.createRecruitUnit('pikeman', 'a', 'blue', 1, 1);
  const guard = content.createRecruitUnit('fxGuard', 'g', 'blue', 1, 1);
  assert.deepEqual([guard.cls, guard.variantId, guard.culture, guard.name], ['pikeman', 'fxGuard', 'fixture', 'Fixture Guard']);
  assert.equal(guard.maxHp, base.maxHp + 2);
  assert.equal(guard.hp, guard.maxHp);
  assert.equal(guard.def, base.def + 1);
  assert.equal(guard.mov, base.mov - 1);
  assert.equal(guard.passives[0].id, 'wall');
  assert.equal(base.culture, undefined, 'plain classes are untouched');
  const onClass = content.createRecruitUnit('fxOnSys', 'x', 'blue', 1, 1);
  assert.deepEqual([onClass.cls, onClass.variantId, onClass.maxHp], ['sysSapper', 'fxOnSys', 21], 'a variant may sit on a culture class');
});

test('a variant card default stance reaches the recruit template (stats.stance)', () => {
  const content = createContent({
    cultures: [{
      id: 'gap',
      variants: { gapHold: { base: 'pikeman', name: 'Gap Hold', card: { defaultStance: 'hold' } }, gapAdvance: { base: 'archer', name: 'Gap Advance', stats: { stance: 'advance' } } },
    }],
  });
  assert.equal(content.createRecruitUnit('gapHold', 'x', 'blue', 1, 1).stance, 'hold');
  assert.equal(content.createRecruitUnit('gapAdvance', 'y', 'blue', 1, 1).stance, 'advance');
  assert.equal(content.createRecruitUnit('archer', 'z', 'blue', 1, 1).stance, 'hold');
});

test('registration errors: collisions, unknown bases, unknown categories, duplicates, missing ids', () => {
  assert.throws(() => createContent({ cultures: [{ id: 'bad', classes: { pikeman: { name: 'x', stats: {} } } }] }), /collides/);
  assert.throws(() => createContent({ cultures: [{ id: 'bad', classes: { mend2: { name: 'x', stats: {} }, } }, { id: 'worse', classes: { mend2: { name: 'y', stats: {} } } }] }), /collides/);
  assert.throws(() => createContent({ cultures: [{ id: 'bad', variants: { v: { base: 'nothing', name: 'v' } } }] }), /unknown base class nothing/);
  assert.throws(() => createContent({ cultures: [{ id: 'bad', variants: { pikeman: { base: 'archer', name: 'v' } } }] }), /collides with a shipped unit/);
  assert.throws(() => createContent({ cultures: [{ id: 'bad', classes: { odd: { name: 'x', stats: {}, category: 'wizard' } } }] }), /unknown category wizard/);
  assert.throws(() => createContent({ cultures: [FIXTURE, FIXTURE] }), /registered twice/);
  assert.throws(() => createContent({ cultures: [{ classes: {} }] }), /needs an id/);
});

test('categories (ported): the five shipped classes are pre-assigned, variants inherit, unknown keys default to melee', () => {
  const content = createContentForFactions(['court']);
  assert.deepEqual([...CATEGORY_IDS], ['melee', 'ranged', 'mounted', 'caster', 'support']);
  for (const id of content.categoryIds) assert.ok(content.categories[id].name && content.categories[id].role);
  assert.deepEqual(['pikeman', 'archer', 'cavalier', 'paladin', 'barbarian'].map((k) => content.categoryOf(k)), ['melee', 'ranged', 'mounted', 'melee', 'melee']);
  assert.equal(content.categoryOf({ cls: 'archer', variantId: 'archer' }), 'ranged');
  assert.equal(content.categoryOf('nothing'), 'melee');
  assert.equal(content.categoryName('cavalier'), 'Mounted');
  assert.equal(content.categoryOf({ cls: 'cavalier', variantId: 'mourningKnight' }), 'mounted');
});

test('categories (ported): mages use Mag against Res and ignore Defense; range comes from the weapon', () => {
  const content = createContentForFactions(['league']);
  const board = createBoard(RIVER_FORD);
  const env = { board, content };
  const rec = (key, id, faction, c, r, extra = {}) => ({ ...content.createRecruitUnit(key, id, faction, c, r), ...extra });
  const artificer = rec('artificer', 'a', 'blue', 5, 5);
  const heavy = rec('pavise', 'p', 'red', 8, 5, { def: 30 });
  const reach3 = forecast(artificer, heavy, [5, 5], env);
  assert.equal(reach3.atk.can, true, 'range 3 reaches');
  assert.ok(reach3.atk.dmg > 0, 'magic gets through Defense 30');
  assert.equal(forecast(artificer, rec('pavise', 'q', 'red', 6, 5), [5, 5], env).atk.can, false, 'minimum range 2');
  const melee = rec('leaguePike', 'l', 'blue', 5, 5);
  assert.equal(forecast(melee, heavy, [5, 6], env).atk.dmg, 0, 'a Pikeman cannot hurt a Pavise Guard');
});

test('monsters (ported): complete enemy-only melee records without culture or card registration', () => {
  const content = createContent();
  const culturesBefore = [...content.cultureIds];
  for (const [index, key] of Object.keys(MONSTERS).entries()) {
    const def = MONSTERS[key];
    const unit = content.createMonsterUnit(key, `monster-${index}`, 'red', index, 0);
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
    assert.deepEqual(unit.selectedAbilities, []);
    assert.deepEqual([unit.energy, unit.maxEnergy], [0, 4]);
    assert.deepEqual([unit.cooldowns, unit.statuses], [{}, {}]);
    assert.equal(content.weaponOf(unit).rng[1], 1);
    assert.deepEqual(content.kitFor(unit), []);
    assert.equal(content.unitCardFor(key), null);
    assert.equal(content.cardFor(key), null);
  }
  assert.deepEqual([...content.cultureIds], culturesBefore);
  assert.throws(() => content.createMonsterUnit('dragon', 'bad', 'red', 0, 0), /Unknown monster: dragon/);
  assert.equal(Object.keys(content.monsters).length, 8);
});

test('graded recruits grow by star and cost population', () => {
  const content = createContent();
  const one = content.createGradedRecruitUnit('pikeman', 'a', 'blue', 1);
  const three = content.createGradedRecruitUnit('pikeman', 'b', 'blue', 3);
  assert.deepEqual([one.stars, one.population, one.maxHp, one.str, one.def], [1, 1, 24, 8, 9]);
  assert.deepEqual([three.stars, three.population, three.maxHp, three.hp, three.str, three.def, three.skl, three.mov], [3, 3, 40, 40, 12, 13, 7, 4]);
});

test('campaign helpers on the context', () => {
  const content = createContent();
  assert.equal(content.campaignLevels.length, 3);
  assert.equal(content.campaignById.woods.number, 2);
  assert.deepEqual(content.campaignEnemyFactions(content.campaignById.road, 'crown', 7), ['league', 'court', 'fang']);
  for (const faction of content.factionList.map((f) => f.id)) {
    for (const level of content.campaignLevels) {
      const foes = content.campaignEnemyFactions(level, faction, 19);
      assert.equal(new Set(foes).size, 3, 'three different foes');
      assert.equal(foes.includes(faction), false);
      assert.equal(foes.includes('classic'), false);
    }
  }
  assert.deepEqual(content.campaignSetup.checkpoints, [[5, 11], [5, 6], [5, 1]]);
});

test('RNG helpers are factories: separate streams do not share state', () => {
  const a = seededRandom(3);
  const b = seededRandom(3);
  assert.equal(a(), b());
});
