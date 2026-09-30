// Unit categories (src/categories.js), the faction classes that use them (mages, support, mounted) and the data-driven AI for faction kits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, CATEGORY_IDS, CLASS_META, categoryOf, categoryName, metaOf } from '../src/categories.js';
import { registerCulture, resetCultures } from '../src/cultures.js';
import { createRecruitUnit, createChampionUnit } from '../src/roster.js';
import { kitFor, initializeAbilityState } from '../src/abilities.js';
import { createMatch } from '../src/match.js';
import { createSkirmish, prepareFactions, FACTIONS } from '../src/setup.js';
import { runCommander } from '../src/ai/commander.js';
import { resolveBattleRound } from '../src/battle.js';
import { forecast } from '../src/combat.js';
import { setMap, DEFAULT_MAP } from '../src/board.js';
import { setRarityGate } from '../src/cards.js';
import { memoryLog, replay } from '../src/log.js';

setMap(DEFAULT_MAP);
const reset = () => { resetCultures(); setRarityGate({}); };
const rec = (key, id, faction, c, r, extra = {}) => initializeAbilityState({ ...createRecruitUnit(key, id, faction, c, r), ...extra });

test('categories: the five shipped classes are pre-assigned, variants inherit, unknown keys default to melee', () => {
  reset();
  assert.deepEqual([...CATEGORY_IDS], ['melee', 'ranged', 'mounted', 'caster', 'support']);
  for (const id of CATEGORY_IDS) assert.ok(CATEGORIES[id].name && CATEGORIES[id].role);
  assert.deepEqual(['pikeman', 'archer', 'cavalier', 'paladin', 'barbarian'].map(categoryOf), ['melee', 'ranged', 'mounted', 'melee', 'melee']);
  assert.equal(categoryOf({ cls: 'archer', variantId: 'archer' }), 'ranged');
  assert.equal(categoryOf('nothing'), 'melee');
  assert.equal(categoryName('cavalier'), 'Mounted');
});

test('faction classes carry categories, the default for a magic weapon is caster, and unregistering removes them', () => {
  prepareFactions(['crown', 'fang', 'league', 'court'].slice(0, 1));
  reset();
  const before = Object.keys(CLASS_META).join();
  const got = {};
  for (const id of ['crown', 'fang', 'league', 'court']) {
    prepareFactions([id]);
    for (const [cls, meta] of Object.entries(CLASS_META)) if (!['pikeman', 'archer', 'cavalier', 'paladin', 'barbarian'].includes(cls)) got[cls] = meta.category ?? categoryOf(cls);
  }
  assert.equal(got.battleCleric, 'support');
  assert.equal(got.fangShaman, 'caster');
  assert.equal(got.wolfRider, 'mounted');
  assert.equal(got.artificer, 'caster');
  assert.equal(got.dragoon, 'mounted');
  assert.equal(got.sapper, 'support');
  assert.equal(got.necromancer, 'support');
  assert.equal(got.wraith, 'caster');
  prepareFactions(['court']);
  assert.equal(categoryOf({ cls: 'cavalier', variantId: 'mourningKnight' }), 'mounted', 'a variant inherits its base class category');
  reset();
  assert.equal(Object.keys(CLASS_META).join(), before);
});

test('mages use Mag against Res and ignore Defense; range comes from the weapon', () => {
  prepareFactions(['league']);
  const art = rec('artificer', 'a', 'blue', 5, 5);
  const heavy = rec('pavise', 'p', 'red', 8, 5, { def: 30 }); // Def 30: a physical hit would do nothing
  const f3 = forecast(art, heavy, [5, 5]);
  assert.equal(f3.atk.can, true, 'range 3 reaches');
  assert.ok(f3.atk.dmg > 0, 'magic gets through Defense 30');
  assert.equal(forecast(art, rec('pavise', 'q', 'red', 6, 5), [5, 5]).atk.can, false, 'minimum range 2');
  const mele = rec('leaguePike', 'l', 'blue', 5, 5);
  assert.equal(forecast(mele, heavy, [5, 6]).atk.dmg, 0, 'a Pikeman cannot hurt a Pavise Guard');
  reset();
});

test('healAllies heals the caster and friends in radius, once, and grant gives friends battle statuses (both cleared afterwards)', () => {
  prepareFactions(['crown']);
  const m = createMatch({ seed: 5, roster: [rec('battleCleric', 'c', 'blue', 5, 5, { stance: 'hold', selectedAbilities: ['sanctuary'], energy: 3, hp: 10 }), rec('pikeman', 'near', 'blue', 5, 6, { hp: 10, stance: 'hold' }), rec('pikeman', 'far', 'blue', 5, 10, { hp: 10, stance: 'hold' }), rec('pikeman', 'r1', 'red', 14, 1, { stance: 'hold' })] });
  const res = m.resolveRound();
  const ev = res.batches.filter((b) => b.type === 'abilities').flatMap((b) => b.events).find((e) => e.abilityId === 'sanctuary');
  assert.equal(ev.applied, true);
  assert.equal(ev.healed, 12, '6 to the Cleric and 6 to the adjacent Pikeman');
  assert.equal(m.byId('c').hp, 16); assert.equal(m.byId('near').hp, 16); assert.equal(m.byId('far').hp, 10);
  reset();
  prepareFactions(['fang']);
  const m2 = createMatch({ seed: 5, roster: [rec('fangShaman', 's', 'blue', 5, 5, { stance: 'hold', selectedAbilities: ['wolfSpirit'], energy: 3 }), rec('pikeman', 'near', 'blue', 5, 6, { stance: 'hold' }), rec('pikeman', 'far', 'blue', 5, 10, { stance: 'hold' }), rec('pikeman', 'r1', 'red', 6, 6, { stance: 'hold' })] });
  const strikes = m2.resolveRound().batches.find((b) => b.type === 'combat').events.filter((e) => e.type === 'strike');
  assert.equal(m2.byId('near').statuses.damageDealt, undefined, 'statuses are cleared after the battle');
  reset();
});

test('the AI picks faction abilities from kit data: mark, heal, grant, corpse eating, barricades', () => {
  prepareFactions(['court']);
  const m = createMatch({ seed: 4, roster: [rec('necromancer', 'n', 'blue', 5, 5, { energy: 3, hp: 8 }), rec('feralGhoul', 'g', 'blue', 5, 6, { hp: 3 }), rec('pikeman', 'r1', 'red', 10, 5)] });
  m.addObject({ objectKind: 'corpse', faction: 'red', c: 5, r: 5, hp: 1, blocks: false, decay: 3 });
  runCommander(m, 'blue', 'heuristic');
  assert.ok(m.byId('n').selectedAbilities.includes('consumeRemains'), `Necromancer eats the corpse: ${m.byId('n').selectedAbilities}`);
  reset();
  prepareFactions(['fang']);
  const m2 = createMatch({ seed: 4, champions: { blue: 'dregBlue' }, roster: [createChampionUnit('dregBlue', 'blue', 5, 5), rec('fangShaman', 's', 'blue', 4, 5, { energy: 3 }), rec('pikeman', 'r1', 'red', 8, 5), rec('pikeman', 'r2', 'red', 14, 10)] });
  m2.byId('dregBlue').energy = 3;
  runCommander(m2, 'blue', 'heuristic');
  assert.ok(m2.byId('dregBlue').selectedAbilities.includes('bloodChallenge'), 'Dreg picks Blood Challenge');
  assert.ok(m2.byId('dregBlue').markIntent, 'and aims the mark');
  assert.ok(m2.byId('s').selectedAbilities.includes('wolfSpirit'), 'the Shaman grants the pack its spirit when a foe is near');
  reset();
  prepareFactions(['league']);
  const m3 = createMatch({ seed: 4, roster: [rec('sapper', 'sp', 'blue', 5, 5, { energy: 3, facing: 'east' }), rec('pikeman', 'r1', 'red', 9, 5)] });
  runCommander(m3, 'blue', 'heuristic');
  assert.equal(m3.byId('sp').stance, 'hold', 'League classes hold');
  assert.ok(m3.byId('sp').selectedAbilities.includes('digIn'), 'Sapper digs in while holding with a foe near');
  reset();
});

test('the AI recruits faction classes by category weight (variants and new classes counted), and every pairing still plays through', () => {
  prepareFactions(['court']);
  const m = createSkirmish({ blue: 'court', red: 'classic', seed: 6, maxRounds: 10 });
  let recruited = new Set();
  while (!m.over) { runCommander(m, 'blue', 'heuristic'); runCommander(m, 'red', 'greedy'); m.resolveRound(); for (const u of m.units) if (u.faction === 'blue' && u.culture) recruited.add(u.cls); }
  assert.ok(recruited.size >= 3, `several Court classes fielded: ${[...recruited]}`);
  reset();
  for (const a of FACTIONS.filter((f) => f.culture)) for (const b of FACTIONS.filter((f) => f.culture && f.id !== a.id)) {
    const g = createSkirmish({ blue: a.id, red: b.id, seed: 2, maxRounds: 8 });
    while (!g.over) { runCommander(g, 'blue', 'heuristic'); runCommander(g, 'red', 'heuristic'); g.resolveRound(); }
    assert.ok(g.over);
  }
  reset();
});

test('a skirmish with the new classes replays exactly', () => {
  reset();
  const log = memoryLog();
  const m = createSkirmish({ blue: 'fang', red: 'league', seed: 13, maxRounds: 10, log: log.push });
  while (!m.over) { runCommander(m, 'blue', 'heuristic'); runCommander(m, 'red', 'heuristic'); m.resolveRound(); }
  const check = replay(log.entries, { create: (h, push) => createSkirmish({ blue: 'fang', red: 'league', seed: h.seed, maxRounds: h.maxRounds, log: push }) });
  assert.equal(check.ok, true, JSON.stringify(check.mismatches?.slice(0, 2)));
  reset();
});
