// Shards (docs/SHARDS.md): shop cards -> dock -> class, stat invariant, battle effects, AI and replay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, SCHEMA } from '../src/match.js';
import { cardFor, RECRUITMENT_POOL, SKILL_CARDS, previewCycle, cycleCard, createCardState, seededRandom, drawCards } from '../src/cards.js';
import { SHARDS, SHARD_IDS, SHARD_RULES, SHARD_CARDS, pickShardSubset, shardBonus, findShardCombos, combineShards } from '../src/shards.js';
import { memoryLog, replay } from '../src/log.js';
import { runCommander } from '../src/ai/commander.js';

const STATS = ['str', 'def', 'spd', 'skl', 'maxHp', 'hp'];
const pick = (u) => Object.fromEntries(STATS.map((k) => [k, u[k]]));
let n = 0;
const giveCard = (m, f, key, over = {}) => {
  const card = { ...structuredClone(cardFor(key)), instanceId: `test-card-${++n}`, ...over };
  m.sides[f].cards.hand.push(card);
  return card.instanceId;
};
const grant = (m, f, shardId, tier = 1) => m.apply({ type: 'grantShard', faction: f, shardId, tier }).shardInstanceId;
const apply = (m, f, id, unitType) => m.apply({ type: 'applyShard', faction: f, shardInstanceId: id, unitType });

test('data: eight shards with three tier values, cards resolve, pool has each shard once and no skill cards', () => {
  assert.deepEqual(SHARD_IDS, ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'garnet', 'pearl', 'onyx']);
  assert.deepEqual(SHARD_RULES, { dockSlots: 10, classSlots: 3, maxTier: 3, poolTypes: 4 });
  assert.deepEqual(SHARDS.emerald.values, [3, 6, 12]);
  assert.deepEqual(SHARDS.amethyst.values, [2, 4, 8]);
  for (const id of SHARD_IDS) {
    assert.equal(cardFor(id), SHARD_CARDS[id]);
    assert.equal(cardFor(id).type, 'shard'); assert.equal(cardFor(id).cost, 1); assert.equal(cardFor(id).tier, 1);
    assert.equal(RECRUITMENT_POOL.filter((k) => k === id).length, 1);
  }
  assert.ok(!RECRUITMENT_POOL.includes('barrier'));
  assert.ok(SKILL_CARDS.barrier);
  assert.deepEqual(shardBonus([{ shardId: 'ruby', tier: 2 }, { shardId: 'ruby', tier: 1 }, { shardId: 'garnet', tier: 3 }]), { str: 3, def: 0, maxHp: 0, spd: 0, skl: 0, block: 4, regen: 0, thorns: 0 });
});

test('buy: pays Supply, moves the card into the dock; fails on dock-full, insufficient-supply, card-not-found', () => {
  const m = createMatch({ seed: 11 });
  const id = giveCard(m, 'blue', 'ruby');
  const supply = m.sides.blue.cards.supply;
  const res = m.apply({ type: 'buyShard', faction: 'blue', cardId: id });
  assert.ok(res.ok); assert.equal(res.shardId, 'ruby'); assert.equal(res.tier, 1);
  assert.equal(m.sides.blue.cards.supply, supply - 1);
  assert.ok(!m.sides.blue.cards.hand.some((c) => c.instanceId === id));
  assert.deepEqual(m.sides.blue.shardDock.map((s) => [s.shardId, s.tier]), [['ruby', 1]]);
  assert.equal(m.summary('blue').shardDock.length, 1);
  assert.equal(m.apply({ type: 'buyShard', faction: 'blue', cardId: 'nope' }).reason, 'card-not-found');
  assert.equal(m.apply({ type: 'buyShard', faction: 'blue', cardId: giveCard(m, 'blue', 'mend') }).reason, 'card-not-found');
  m.sides.blue.cards.supply = 0;
  assert.equal(m.apply({ type: 'buyShard', faction: 'blue', cardId: giveCard(m, 'blue', 'ruby') }).reason, 'insufficient-supply');
  m.sides.blue.cards.supply = 5;
  while (m.sides.blue.shardDock.length < SHARD_RULES.dockSlots) grant(m, 'blue', 'topaz');
  assert.equal(m.apply({ type: 'buyShard', faction: 'blue', cardId: giveCard(m, 'blue', 'ruby') }).reason, 'dock-full');
  assert.equal(m.sides.blue.cards.supply, 5);
  assert.equal(grant(m, 'blue', 'ruby'), undefined);
});

test('apply: bonus reaches field, bench and later recruits of the class only; class-full and invalid-unit-type', () => {
  const m = createMatch({ seed: 12 });
  m.sides.blue.cards.supply = 20;
  const rec = m.apply({ type: 'recruit', faction: 'blue', cardId: giveCard(m, 'blue', 'pikeman', { unitId: 'pikeman' }) });
  assert.ok(rec.ok);
  const bench = () => m.sides.blue.cards.reserves.find((r) => r.id === rec.reserveId);
  const field = m.alive('blue').filter((u) => u.cls === 'pikeman');
  const archerBefore = pick(m.byId('archer_b1'));
  const fieldBefore = field.map(pick), benchBefore = pick(bench());
  assert.ok(apply(m, 'blue', grant(m, 'blue', 'ruby', 2), 'pikeman').ok);
  assert.ok(apply(m, 'blue', grant(m, 'blue', 'sapphire', 1), 'pikeman').ok);
  field.forEach((u, i) => { assert.equal(u.str, fieldBefore[i].str + 2); assert.equal(u.def, fieldBefore[i].def + 1); });
  assert.equal(bench().str, benchBefore.str + 2); assert.equal(bench().def, benchBefore.def + 1);
  assert.deepEqual(pick(m.byId('archer_b1')), archerBefore);
  assert.deepEqual(pick(m.byId('pike_r1')).str, 8); // the other side is untouched
  // later recruit
  const rec2 = m.apply({ type: 'recruit', faction: 'blue', cardId: giveCard(m, 'blue', 'pikeman', { unitId: 'pikeman' }) });
  const later = m.sides.blue.cards.reserves.find((r) => r.id === rec2.reserveId);
  assert.equal(later.str, 8 + 2); assert.equal(later.def, 9 + 1);
  // deploying keeps the bonus exactly once
  const tile = m.deploymentTiles('blue').find(([c, r]) => m.canDeployAt('blue', later.id, c, r).ok);
  const dep = m.apply({ type: 'deploy', faction: 'blue', reserveId: later.id, c: tile[0], r: tile[1] });
  assert.ok(dep.ok, dep.reason);
  const deployed = m.byId(dep.unitId);
  assert.equal(deployed ? deployed.str : null, 10); assert.equal(deployed.def, 10);
  // class-full at three, invalid class
  assert.ok(apply(m, 'blue', grant(m, 'blue', 'topaz'), 'pikeman').ok);
  const extra = grant(m, 'blue', 'ruby');
  assert.equal(apply(m, 'blue', extra, 'pikeman').reason, 'class-full');
  assert.equal(apply(m, 'blue', extra, 'dragon').reason, 'invalid-unit-type');
  assert.equal(apply(m, 'blue', 'shard-999', 'archer').reason, 'shard-not-found');
  assert.ok(m.sides.blue.shardDock.some((s) => s.id === extra));
  // a class with no unit yet but a recruit template is allowed
  assert.ok(apply(m, 'blue', extra, 'cavalier').ok || m.alive('blue').some((u) => u.cls === 'cavalier'));
});

test('remove: reverts stats exactly, needs dock room, and apply/remove cycles never drift', () => {
  const m = createMatch({ seed: 13 });
  const base = m.alive('blue').map((u) => [u.id, pick(u)]);
  const ids = ['ruby', 'amethyst', 'topaz'].map((s) => grant(m, 'blue', s, 3));
  for (const id of ids) assert.ok(apply(m, 'blue', id, 'archer').ok);
  assert.equal(m.byId('archer_b1').str, base.find(([i]) => i === 'archer_b1')[1].str + 4);
  assert.equal(m.byId('archer_b1').skl, base.find(([i]) => i === 'archer_b1')[1].skl + 8);
  assert.equal(m.byId('archer_b1').spd, base.find(([i]) => i === 'archer_b1')[1].spd + 4);
  assert.equal(m.apply({ type: 'removeShard', faction: 'blue', unitType: 'archer', index: 7 }).reason, 'shard-not-found');
  for (let i = 0; i < 3; i += 1) assert.ok(m.apply({ type: 'removeShard', faction: 'blue', unitType: 'archer', index: 0 }).ok);
  assert.deepEqual(m.alive('blue').map((u) => [u.id, pick(u)]), base);
  assert.deepEqual(m.sides.blue.shards, {});
  assert.equal(m.sides.blue.shardDock.length, 3);
  // dock full blocks removal
  const id = m.sides.blue.shardDock[0].id;
  apply(m, 'blue', id, 'archer');
  while (m.sides.blue.shardDock.length < SHARD_RULES.dockSlots) grant(m, 'blue', 'onyx');
  assert.equal(m.apply({ type: 'removeShard', faction: 'blue', unitType: 'archer', index: 0 }).reason, 'dock-full');
});

test('max HP shard moves current HP by the same amount and never kills on removal', () => {
  const m = createMatch({ seed: 14 });
  const u = m.byId('pike_b1');
  u.hp = 10;
  const id = grant(m, 'blue', 'emerald', 2);
  assert.ok(apply(m, 'blue', id, 'pikeman').ok);
  assert.equal(u.maxHp, 24 + 6); assert.equal(u.hp, 16);
  u.hp = 3;
  assert.ok(m.apply({ type: 'removeShard', faction: 'blue', unitType: 'pikeman', index: 0 }).ok);
  assert.equal(u.maxHp, 24); assert.equal(u.hp, 1);
  u.hp = 24;
  apply(m, 'blue', grant(m, 'blue', 'emerald', 3), 'pikeman');
  assert.equal(u.hp, 36);
  m.apply({ type: 'removeShard', faction: 'blue', unitType: 'pikeman', index: 0 });
  assert.equal(u.hp, 24);
});

test('combine: three I become II, three II become III, III is the maximum', () => {
  const m = createMatch({ seed: 15 });
  assert.equal(m.apply({ type: 'combineShards', faction: 'blue', shardId: 'ruby', tier: 1 }).reason, 'no-combo');
  for (let i = 0; i < 9; i += 1) grant(m, 'blue', 'ruby');
  assert.deepEqual(findShardCombos(m.sides.blue.shardDock).map((c) => [c.shardId, c.tier, c.ids.length]), [['ruby', 1, 3]]);
  for (let i = 0; i < 3; i += 1) assert.ok(m.apply({ type: 'combineShards', faction: 'blue', shardId: 'ruby', tier: 1 }).ok);
  assert.deepEqual(m.sides.blue.shardDock.map((s) => s.tier), [2, 2, 2]);
  const r = m.apply({ type: 'combineShards', faction: 'blue', shardId: 'ruby', tier: 2 });
  assert.ok(r.ok); assert.equal(r.tier, 3); assert.equal(r.consumed.length, 3);
  assert.deepEqual(m.sides.blue.shardDock.map((s) => s.tier), [3]);
  assert.equal(m.apply({ type: 'combineShards', faction: 'blue', shardId: 'ruby', tier: 3 }).reason, 'max-tier');
  assert.equal(combineShards([], 'ruby', 3).reason, 'max-tier');
  assert.equal(combineShards([], 'nope', 1).reason, 'no-combo');
});

// A minimal fight: one blue unit next to one red unit, everything else removed.
const duel = (seed, blueId, redId, shards = []) => {
  const m = createMatch({ seed });
  m.units = m.units.filter((u) => [blueId, redId].includes(u.id));
  const b = m.byId(blueId), r = m.byId(redId);
  b.c = 5; b.r = 5; r.c = 5; r.r = 6;
  for (const [shardId, tier, type] of shards) apply(m, 'blue', grant(m, 'blue', shardId, tier), type);
  for (const u of m.units) m.apply({ type: 'stance', faction: u.faction, unitId: u.id, stance: 'hold' });
  return m;
};
const strikes = (res) => res.batches.find((b) => b.type === 'combat').events.filter((e) => e.type === 'strike');

test('block (Garnet) absorbs damage through the Barrier status for the battle', () => {
  let checked = 0;
  for (let seed = 1; seed <= 12; seed += 1) {
    const plain = duel(seed, 'archer_b1', 'pike_r1');
    const blocked = duel(seed, 'archer_b1', 'pike_r1', [['garnet', 2, 'archer']]);
    const a = plain.resolveRound(), b = blocked.resolveRound();
    const sB = strikes(b).find((e) => e.targetId === 'archer_b1');
    const sA = strikes(a).find((e) => e.targetId === 'archer_b1');
    if (!sA?.hit) continue;
    checked += 1;
    assert.equal(sB.barrierReduction, Math.min(2, sA.damage));
    assert.equal(sA.damage - sB.damage, sB.barrierReduction);
    assert.equal(blocked.byId('archer_b1').statuses.barrier, undefined);
  }
  assert.ok(checked > 0);
});

test('regen (Pearl) heals field units at the start of resolution and reports a shards batch', () => {
  const m = duel(3, 'pike_b1', 'archer_r1', [['pearl', 2, 'pikeman']]);
  m.units.find((u) => u.id === 'archer_r1').c = 12; m.byId('archer_r1').r = 1; // out of reach
  m.byId('pike_b1').hp = 10;
  const res = m.resolveRound();
  assert.equal(res.batches[0].type, 'shards');
  assert.deepEqual(res.batches[0].events, [{ type: 'regen', unitId: 'pike_b1', amount: 4 }]);
  m.byId('pike_b1').hp = m.byId('pike_b1').maxHp - 1;
  const m2 = duel(3, 'pike_b1', 'archer_r1', [['pearl', 3, 'pikeman']]);
  m2.byId('archer_r1').c = 12; m2.byId('archer_r1').r = 1;
  m2.byId('pike_b1').hp = m2.byId('pike_b1').maxHp - 3;
  assert.equal(m2.resolveRound().batches[0].events[0].amount, 3); // capped at max HP
});

test('thorns (Onyx) hurts an adjacent attacker for each hit taken, simultaneously', () => {
  let checked = 0;
  for (let seed = 1; seed <= 30 && !checked; seed += 1) {
    const m = duel(seed, 'archer_b1', 'pike_r1', [['onyx', 2, 'archer']]);
    const res = m.resolveRound();
    const hit = strikes(res).find((e) => e.attackerId === 'pike_r1' && e.hit && e.damage > 0);
    if (!hit) continue;
    checked += 1;
    const ev = res.batches.find((b) => b.type === 'combat').events.filter((e) => e.type === 'thorns');
    assert.deepEqual(ev, [{ type: 'thorns', unitId: 'archer_b1', targetId: 'pike_r1', amount: 2 }]);
    const archerHit = strikes(res).find((e) => e.attackerId === 'archer_b1' && e.hit && e.damage > 0);
    assert.equal(m.byId('pike_r1').hp, 24 - 2 - (archerHit ? archerHit.damage : 0));
    assert.equal(m.byId('archer_b1').statuses.thorns, undefined);
  }
  assert.equal(checked, 1);
});

test('thorns can kill the attacker through the normal death flow and never drops HP below zero', () => {
  const m = duel(5, 'archer_b1', 'pike_r1', [['onyx', 3, 'archer']]);
  m.byId('pike_r1').hp = 1;
  let res, seed = 5;
  res = m.resolveRound();
  const hit = strikes(res).find((e) => e.attackerId === 'pike_r1' && e.hit && e.damage > 0);
  if (hit) {
    assert.ok(res.batches.find((b) => b.type === 'combat').events.some((e) => e.type === 'death' && e.unitId === 'pike_r1'));
    assert.equal(m.byId('pike_r1').hp, 0);
  } else assert.ok(m.byId('pike_r1').hp >= 0, String(seed));
});

test('abilities are off by default: the action is refused; opting in restores kits', () => {
  const m = createMatch({ seed: 16 });
  assert.equal(m.abilitiesEnabled, false);
  assert.equal(m.apply({ type: 'abilities', faction: 'blue', unitId: 'pike_b1', abilityIds: ['rally'] }).reason, 'abilities-disabled');
  assert.equal(m.apply({ type: 'facing', faction: 'blue', unitId: 'pike_b1', facing: 'east' }).ok, true);
  assert.equal(m.apply({ type: 'stance', faction: 'blue', unitId: 'pike_b1', stance: 'hold' }).ok, true);
  const on = createMatch({ seed: 16, abilities: true });
  assert.equal(on.apply({ type: 'abilities', faction: 'blue', unitId: 'pike_b1', abilityIds: ['rally'] }).ok, true);
});

test('cycling works for shard cards and gives another shard card', () => {
  const card = { ...structuredClone(SHARD_CARDS.ruby), instanceId: 'sh1' };
  const state = createCardState({ hand: [card] });
  assert.ok(previewCycle(state, { source: 'hand', id: 'sh1' }).ok);
  const r = cycleCard(state, { source: 'hand', id: 'sh1' }, seededRandom(4));
  assert.ok(r.ok); assert.equal(r.replacement.type, 'shard'); assert.equal(r.replacement.rarity, 'common');
});

test('the heuristic AI buys, applies and combines shards through match.apply', () => {
  const log = memoryLog();
  const m = createMatch({ seed: 21, maxRounds: 10, log: log.push });
  for (let i = 0; i < 10 && !m.over; i += 1) { runCommander(m, 'blue', 'heuristic'); runCommander(m, 'red', 'greedy'); m.resolveRound(); }
  const acts = log.entries.filter((e) => e.t === 'action' && e.ok).map((e) => e.action.type);
  assert.ok(acts.includes('buyShard'), 'bought');
  assert.ok(acts.includes('applyShard'), 'applied');
  assert.ok(!log.entries.some((e) => e.t === 'action' && e.action.faction === 'red' && /Shard/.test(e.action.type)), 'greedy stays units only');
  assert.ok(Object.values(m.sides.blue.shards).flat().length > 0);
  assert.ok(m.sides.blue.shardDock.length <= SHARD_RULES.dockSlots);
  // the invariant holds for every blue unit at the end
  for (const u of m.alive('blue')) {
    const b = shardBonus(m.sides.blue.shards[u.cls]);
    assert.deepEqual(u.shardBonus ?? { str: 0, def: 0, maxHp: 0, spd: 0, skl: 0 }, { str: b.str, def: b.def, maxHp: b.maxHp, spd: b.spd, skl: b.skl });
  }
});

test('a seeded shard match replays exactly; schema is 4 and older schemas are rejected', () => {
  const log = memoryLog();
  const m = createMatch({ seed: 33, maxRounds: 12, log: log.push });
  while (!m.over) { runCommander(m, 'blue', 'heuristic'); runCommander(m, 'red', 'heuristic'); m.resolveRound(); }
  assert.equal(log.entries[0].schema, 4); assert.equal(SCHEMA, 4);
  assert.ok(log.entries.some((e) => e.t === 'action' && e.action.type === 'applyShard'));
  const check = replay(log.entries);
  assert.ok(check.ok, JSON.stringify(check.mismatches?.slice(0, 1)));
  const old = structuredClone(log.entries); old[0].schema = 3;
  assert.equal(replay(old).ok, false);
});

test('each match draws shards from a seeded subset of 4 types, shared by both sides, and replays', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 12; seed += 1) {
    const sub = pickShardSubset(seed);
    assert.equal(sub.length, 4); assert.deepEqual(sub, pickShardSubset(seed));
    sub.forEach((id) => seen.add(id));
    const m = createMatch({ seed, maxRounds: 4 });
    for (const f of ['blue', 'red']) {
      for (let i = 0; i < 6; i += 1) { m.sides[f].cards = drawCards(m.sides[f].cards, m.sides[f].rng, 8).state; }
      for (const c of m.sides[f].cards.hand.filter((x) => x.type === 'shard')) assert.ok(sub.includes(c.shardId));
    }
  }
  assert.ok(seen.size > 4, 'different seeds pick different subsets');
  assert.equal(pickShardSubset(1, 8).length, 8);
});

test('every round deals 2-3 shard cards on top of the draw, ignoring the hand cap; unbought ones are replaced', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const m = createMatch({ seed, maxRounds: 6 });
    const sub = pickShardSubset(seed);
    for (let round = 0; round < 5 && !m.over; round += 1) {
      const hand = m.sides.blue.cards.hand, shards = hand.filter((c) => c.type === 'shard');
      assert.ok(shards.length >= 2 && shards.length <= 3, `seed ${seed} round ${round}: ${shards.length} shards`);
      assert.ok(shards.every((c) => sub.includes(c.shardId)));
      assert.equal(hand.filter((c) => c.type !== 'shard').length <= 8, true);
      m.resolveRound();
    }
  }
});
