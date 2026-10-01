// Experiment switches (economy limits, damage scale, keep deployment) must be inert by default and reversible.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_LIMITS, DEFAULT_CARD_LIMITS, setCardLimits, resetCardLimits } from '../src/cards.js';
import { BATTLE_TUNING, resolveBattleRound } from '../src/battle.js';
import { createMatch, EXPERIMENT_RULES } from '../src/match.js';
import { memoryLog, replay } from '../src/log.js';
import { runCommander } from '../src/ai/commander.js';

test('card limits default to the shipped values and reset cleanly', () => {
  assert.deepEqual({ ...CARD_LIMITS }, { ...DEFAULT_CARD_LIMITS });
  setCardLimits({ populationCap: 28, supplyPerRound: 8, maxSupply: 16 });
  assert.equal(CARD_LIMITS.populationCap, 28);
  assert.equal(CARD_LIMITS.hand, 8, 'unlisted limits keep their defaults');
  resetCardLimits();
  assert.deepEqual({ ...CARD_LIMITS }, { ...DEFAULT_CARD_LIMITS });
});

test('overridden limits reach the match, its log header, and replay', () => {
  setCardLimits({ populationCap: 20, supplyPerRound: 6, maxSupply: 12 });
  const log = memoryLog();
  const m = createMatch({ seed: 7, maxRounds: 6, log: log.push });
  while (!m.over) { runCommander(m, 'blue', 'heuristic'); runCommander(m, 'red', 'greedy'); m.resolveRound(); }
  assert.equal(log.entries[0].cardLimits.populationCap, 20);
  const check = replay(log.entries, { create: (h, push) => { setCardLimits(h.cardLimits); return createMatch({ seed: h.seed, maxRounds: h.maxRounds, log: push }); } });
  assert.deepEqual(check.mismatches, []);
  resetCardLimits();
});

test('damage scale multiplies strikes and defaults to 1', () => {
  assert.equal(BATTLE_TUNING.damageScale, 1);
  const units = [{ id: 'a', faction: 'blue', c: 4, r: 4, hp: 40, maxHp: 40, str: 10, def: 0, range: [1, 1] }, { id: 'b', faction: 'red', c: 5, r: 4, hp: 40, maxHp: 40, str: 0, def: 0, range: [1, 1] }];
  const orders = { a: { stance: 'hold' }, b: { stance: 'hold' } };
  const dmg = () => resolveBattleRound({ units, orders, seed: 2 }).batches[1].events.find((e) => e.attackerId === 'a').damage;
  const base = dmg();
  BATTLE_TUNING.damageScale = 3;
  try { assert.equal(dmg(), base * 3); } finally { BATTLE_TUNING.damageScale = 1; }
});

test('forbidding keep deployment removes only the keep tile from the deployment area', () => {
  const m = createMatch();
  const all = m.deploymentTiles('red').map(([c, r]) => `${c},${r}`);
  assert.ok(all.includes('12,1'));
  EXPERIMENT_RULES.deployOnKeep = false;
  try {
    const some = m.deploymentTiles('red').map(([c, r]) => `${c},${r}`);
    assert.ok(!some.includes('12,1'));
    assert.equal(some.length, all.length - 1);
  } finally { EXPERIMENT_RULES.deployOnKeep = true; }
});
