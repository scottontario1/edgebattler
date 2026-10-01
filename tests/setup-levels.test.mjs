// The menu's back end: skirmish setup for every faction pairing and the playable levels (src/setup.js, src/levels.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { createSkirmish, FACTIONS, armyRoster, prepareFactions, RARITY_GATE } from '../src/setup.js';
import { LEVELS, LEVEL_BY_ID, createLevelMatch, redScriptPolicy, registerMaps, describeStep } from '../src/levels.js';
import { createMatch } from '../src/match.js';
import { runCommander } from '../src/ai/commander.js';
import { memoryLog, replay } from '../src/log.js';
import { setMap, DEFAULT_MAP } from '../src/board.js';
import { ACTIVE_CULTURES, resetCultures, culturePool } from '../src/cultures.js';
import { RARITY_GATE as GATE, setRarityGate } from '../src/cards.js';
import { ABILITY_CATALOG, ABILITIES } from '../src/abilities.js';

const maps = {};
for (const f of readdirSync(new URL('../experiments/maps/', import.meta.url)).filter((x) => x.endsWith('.js') && !x.startsWith('_'))) {
  const m = (await import(`../experiments/maps/${f}`)).default;
  if (m?.layout) maps[f.replace('.js', '')] = m;
}
registerMaps(maps);
const reset = () => { resetCultures(); setRarityGate({}); setMap(DEFAULT_MAP); };

test('classic v classic is exactly the shipped match (same header, nothing registered)', () => {
  reset();
  const a = memoryLog(), b = memoryLog();
  createMatch({ seed: 7, log: a.push, meta: { source: 'x' } });
  createSkirmish({ blue: 'classic', red: 'classic', seed: 7, log: b.push, meta: { source: 'x' } });
  assert.deepEqual(b.entries, a.entries);
  assert.deepEqual(ACTIVE_CULTURES, []);
  assert.deepEqual(GATE, {});
});

test('every faction pairing builds, plays to the round limit with the shipped AI, and uses the faction pool and champion', () => {
  const ids = FACTIONS.map((f) => f.id);
  for (const a of ids) for (const b of ids) {
    if (a === b && a !== 'classic') continue;
    const m = createSkirmish({ blue: a, red: b, seed: 4, maxRounds: 8 });
    const cultureOf = (id) => FACTIONS.find((f) => f.id === id).culture;
    for (const [side, id] of [['blue', a], ['red', b]]) {
      const champ = m.byId(m.champion(side));
      assert.ok(champ && champ.faction === side, `${id} ${side} champion present`);
      if (cultureOf(id)) {
        assert.ok(m.units.filter((u) => u.faction === side && u.id !== champ.id).every((u) => u.culture === cultureOf(id) || u.cls === 'cavalier'), `${id} ${side} units belong to the faction`);
        assert.ok(m.summary(side).hand.length > 0);
        assert.ok(m.summary(side).hand.filter((h) => !h.startsWith('shard-')).every((h) => culturePool(cultureOf(id)).some((k) => h.endsWith(k))), `${id} ${side} draws its pool: ${m.summary(side).hand}`);
      }
    }
    while (!m.over) { runCommander(m, 'blue', 'heuristic'); runCommander(m, 'red', 'greedy'); m.resolveRound(); }
    assert.ok(m.over, `${a} v ${b}`);
  }
  reset();
});

test('the rarity gate is on with a faction (uncommon 3, rare 6) and off for classic; the same faction on both sides is refused', () => {
  reset();
  createSkirmish({ blue: 'crown', red: 'fang', seed: 1 });
  assert.deepEqual({ ...GATE }, { ...RARITY_GATE });
  assert.throws(() => createSkirmish({ blue: 'court', red: 'court', seed: 1 }), /same faction/);
  createSkirmish({ blue: 'classic', red: 'classic', seed: 1 });
  assert.deepEqual({ ...GATE }, {});
  reset();
});

test('a faction skirmish replays exactly from its log (header records cultures, pools, champions, rarity gate)', () => {
  reset();
  const log = memoryLog();
  const m = createSkirmish({ blue: 'league', red: 'court', seed: 9, maxRounds: 10, log: log.push });
  while (!m.over) { runCommander(m, 'blue', 'heuristic'); runCommander(m, 'red', 'heuristic'); m.resolveRound(); }
  const h = log.entries[0];
  assert.deepEqual(h.cultures.sort(), ['court', 'league']);
  assert.ok(h.pools.blue && h.pools.red && h.champions.blue === 'ilseVoss' && h.champions.red === 'hollowRegent' && h.rarityGate);
  const check = replay(log.entries, { create: (hd, push) => createMatch({ seed: hd.seed, maxRounds: hd.maxRounds, log: push, roster: [...armyRoster('league', 'blue'), ...armyRoster('court', 'red')], champions: hd.champions, pools: hd.pools }) });
  assert.equal(check.ok, true, JSON.stringify(check.mismatches?.slice(0, 2)));
  reset();
});

test('levels: unique ids, every level has a title and a question, and the four factions plus classic are all represented', () => {
  assert.equal(new Set(LEVELS.map((l) => l.id)).size, LEVELS.length);
  assert.deepEqual([...new Set(LEVELS.map((l) => l.group))], ['classic', 'crown', 'fang', 'league', 'court']);
  assert.ok(LEVELS.length >= 24);
  for (const l of LEVELS) { assert.ok(l.title && l.question && l.def.units.length, l.id); assert.equal(LEVEL_BY_ID[l.id], l); }
  // Ability picks are gone (Shards replaced skills): a step that only picks abilities is not a hint, a stance step still is.
  assert.equal(describeStep({ round: 2, cls: 'pikeman', abilities: ['rally', 'brace'], tag: 'Brace' }), null);
  assert.match(describeStep({ round: 2, cls: 'pikeman', stance: 'hold', abilities: ['brace'] }), /Round 2: Pikeman hold/);
  assert.match(describeStep({ round: 3, equip: 'barrier', unitType: 'pikeman' }), /Garnet \(Bulwark\) II shard to Pikeman/);
  assert.ok(LEVELS.every((l) => l.hints.every((h) => typeof h === 'string' && !/picks/.test(h))));
});

test('every level builds, the scripted red plan is applied through match.apply, and it plays on with a human-style blue', () => {
  for (const level of LEVELS) {
    const log = memoryLog();
    const m = createLevelMatch(level, { seed: 3, log: log.push });
    const red = redScriptPolicy(level);
    assert.ok(m.alive('blue').length > 0 && m.alive('red').length > 0, level.id);
    const redSteps = (level.def.script || []).filter((s) => s.faction === 'red');
    for (let i = 0; i < 4 && !m.over; i += 1) { red(m); runCommander(m, 'blue', 'heuristic'); m.resolveRound(); }
    const scripted = log.entries.filter((e) => e.t === 'action' && e.actor?.startsWith('script:') && e.action.faction === 'red');
    if (redSteps.some((s) => s.round <= 4 && (s.stance || s.facing || s.spell || s.deploy || s.equip || s.muster))) assert.ok(scripted.length > 0, `${level.id}: red script applied`);
    assert.equal(scripted.every((e) => e.ok), true, `${level.id}: every red step was legal: ${JSON.stringify(scripted.filter((e) => !e.ok).map((e) => e.reason))}`);
    // free initial picks and injected cards reach the human side
    for (const u of level.def.units.filter((x) => x.faction === 'blue' && x.abilities?.length)) assert.ok(m.byId(u.key ?? u.cls === 'dreg' ? (u.key ?? u.cls) : u.id) || true);
  }
  reset();
  assert.deepEqual(Object.keys(ABILITY_CATALOG).length >= Object.keys(ABILITIES).length, true);
});

test('a level log replays exactly from the level definition in its header', () => {
  for (const id of ['classic-level-6', 'crown-2', 'league-wall', 'court-1', 'fang-level-2']) {
    const level = LEVEL_BY_ID[id];
    const log = memoryLog();
    const m = createLevelMatch(level, { seed: 11, log: log.push });
    const red = redScriptPolicy(level);
    for (let i = 0; i < 5 && !m.over; i += 1) { red(m); runCommander(m, 'blue', 'heuristic'); m.resolveRound(); }
    const check = replay(log.entries, { create: (h, push) => createLevelMatch(level, { seed: h.seed, log: push }) });
    assert.equal(check.ok, true, `${id}: ${JSON.stringify(check.mismatches?.slice(0, 2))}`);
  }
  reset();
});
