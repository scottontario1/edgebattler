// Rule checks for the Argent Crown culture (src/factions/argent-crown.js): every unit, passive, skill, spell and the champion kit,
// plus registration hygiene, rarity gating and replay. The culture is registered per test and removed again, so nothing leaks.
import test from 'node:test';
import assert from 'node:assert/strict';
import ARGENT_CROWN, * as C from '../src/factions/argent-crown.js';
import { registerArgentCrown } from '../src/factions/argent-crown.js';
import { ABILITY_CATALOG, ABILITIES, SPELL_CATALOG, SPELLS, activatePhase, initializeAbilityState, kitFor, validateAbilitySelection } from '../src/abilities.js';
import { resetCultures, registerCulture, culturePool, SPRITE_FALLBACK, ACTIVE_CULTURES } from '../src/cultures.js';
import { evaluatePassives } from '../src/passives.js';
import { RECRUIT, VARIANTS, CHAMPION_TEMPLATES, createRecruitUnit, createChampionUnit, createHeroRespawnData, UNITS } from '../src/roster.js';
import { cardFor, unitCardFor, setRarityGate, drawCards, createCardState, seededRandom, RECRUITMENT_POOL } from '../src/cards.js';
import { findUpgradeMatches } from '../src/upgrades.js';
import { forecast } from '../src/combat.js';
import { MOVE_TYPE } from '../src/rules.js';
import { createMatch } from '../src/match.js';
import { memoryLog, replay } from '../src/log.js';
import { setMap } from '../src/board.js';
import FLAT_OPEN from '../experiments/maps/flat_open.js';

setMap(FLAT_OPEN); // plains only: terrain adds no defence, so damage arithmetic is exact
const rec = (key, id, faction, c, r, extra = {}) => initializeAbilityState({ ...createRecruitUnit(key, id, faction, c, r), ...extra });
const hold = { stance: 'hold' };
const at = (units) => evaluatePassives(units, { moved: new Set(), stanceOf: (u) => u.stance });
const reg = () => { resetCultures(); registerArgentCrown(); };

/**
 * Play round 1 for seeds 1..N until the red attacker `atk` (a plain Pikeman on Hold at 7,5) lands a clean hit (no crit, no ward)
 * on `targetId`; return the strike damage and the forecast damage (Defense only, no statuses) so the difference is the reduction.
 */
function cleanHit(blueUnits, targetId, { extraRed = [], attackerStats = {}, spells = [], champions = null } = {}) {
  for (let seed = 1; seed <= 120; seed += 1) {
    const roster = [...blueUnits.map((u) => structuredClone(u)), rec('pikeman', 'atk', 'red', 7, 5, { ...hold, ...attackerStats }), rec('pikeman', 'far', 'red', 15, 1, hold), ...extraRed];
    const m = createMatch({ seed, roster, ...(champions ? { champions } : {}) });
    for (const sp of spells) {
      const card = { ...structuredClone(cardFor(sp.key)), instanceId: `card-test-${sp.key}` };
      m.sides.blue.cards.hand.push(card);
      m.sides.blue.cards.supply = 6;
      assert.equal(m.apply({ type: 'spell', faction: 'blue', cardId: card.instanceId, unitId: sp.unitId }).ok, true);
    }
    const base = forecast(m.byId('atk'), m.byId(targetId), [7, 5]).atk.dmg;
    const res = m.resolveRound();
    const s = res.batches.find((b) => b.type === 'combat').events.find((e) => e.type === 'strike' && e.attackerId === 'atk' && e.targetId === targetId);
    if (s && s.hit && !s.crit && !s.warded) return { damage: s.damage, base, seed, match: m };
  }
  throw new Error(`no clean hit on ${targetId}`);
}
const reduction = (r) => r.base - r.damage;

// ---------------------------------------------------------------- registration
test('registration is explicit and fully removable; nothing registers by importing the module', () => {
  resetCultures();
  const snap = () => JSON.stringify([Object.keys(RECRUIT), Object.keys(VARIANTS), Object.keys(CHAMPION_TEMPLATES), Object.keys(ABILITY_CATALOG), Object.keys(SPELL_CATALOG), Object.keys(SPRITE_FALLBACK), Object.keys(MOVE_TYPE), ACTIVE_CULTURES]);
  const before = snap();
  assert.deepEqual(ACTIVE_CULTURES, [], 'importing the module registers nothing');
  assert.equal(cardFor('crownGuard'), null);
  const rec1 = registerArgentCrown();
  assert.deepEqual(ACTIVE_CULTURES, ['crown']);
  assert.deepEqual(rec1.classes.sort(), ['bannerman', 'oathsworn']);
  assert.deepEqual(rec1.variants.sort(), ['crownArcher', 'crownCavalier', 'crownGuard', 'crownPike']);
  assert.deepEqual(rec1.abilities.sort(), ['bulwarkOfTheRealm', 'closeRanks', 'holdTheStandard', 'interpose', 'oathkeepersStrike']);
  resetCultures();
  assert.equal(snap(), before, 'every registry is back to the shipped contents');
  assert.deepEqual(Object.keys(ABILITY_CATALOG), Object.keys(ABILITIES));
  assert.deepEqual(Object.keys(SPELL_CATALOG), Object.keys(SPELLS));
  assert.equal(cardFor('rallyBanner'), null);
  // registering twice replaces rather than duplicates
  registerArgentCrown(); registerArgentCrown();
  assert.deepEqual(ACTIVE_CULTURES, ['crown']);
  resetCultures();
});

test('the culture definition has the shape registerCulture documents and one entry per FACTIONS.md item', () => {
  assert.equal(ARGENT_CROWN.id, 'crown');
  assert.deepEqual(Object.keys(ARGENT_CROWN.classes).sort(), ['bannerman', 'oathsworn']);
  assert.deepEqual(Object.keys(ARGENT_CROWN.variants).sort(), ['crownArcher', 'crownCavalier', 'crownGuard', 'crownPike']);
  assert.deepEqual(ARGENT_CROWN.abilities.map((a) => a.id).sort(), ['bulwarkOfTheRealm', 'closeRanks', 'holdTheStandard', 'interpose', 'oathkeepersStrike']);
  assert.deepEqual(Object.keys(ARGENT_CROWN.spells), ['rallyBanner']);
  assert.deepEqual(Object.keys(ARGENT_CROWN.champions).sort(), ['brennaCrown', 'brennaCrownB']);
});

// ---------------------------------------------------------------- cards, rarity, pool
test('every card has a rarity, a cost and a culture; the pool is Crown cards plus the shared spells', () => {
  reg();
  const expect = { crownPike: ['common', 1], crownArcher: ['common', 2], crownCavalier: ['common', 3], crownGuard: ['common', 2], bannerman: ['uncommon', 2], oathsworn: ['rare', 3], rallyBanner: ['common', 1] };
  for (const [key, [rarity, cost]] of Object.entries(expect)) {
    const card = cardFor(key);
    assert.equal(card.rarity, rarity, `${key} rarity`);
    assert.equal(card.cost, cost, `${key} cost`);
    assert.equal(card.culture, 'crown', `${key} culture`);
  }
  const pool = culturePool('crown');
  assert.deepEqual([...new Set(pool)].filter((k) => !expect[k]).sort(), ['fireburst', 'mend', 'ward'], 'the only non-Crown cards are the shared spells');
  for (const key of pool) { const c = cardFor(key); assert.ok(c, key); assert.ok(['common', 'uncommon', 'rare'].includes(c.rarity), `${key} rarity tag`); }
  assert.equal(pool.includes('barrier'), false, 'Barrier is not in the Crown pool');
  assert.equal(pool.filter((k) => k === 'oathsworn').length, 1);
  assert.ok(pool.filter((k) => k === 'crownPike').length > pool.filter((k) => k === 'crownCavalier').length, 'cheap infantry is drawn more often');
  assert.equal(unitCardFor('crownGuard').defaultStance, 'hold');
  assert.equal(unitCardFor('crownArcher').defaultStance, 'hold', 'the archer variant keeps the archer default');
  assert.equal(unitCardFor('crownCavalier').defaultStance, 'advance');
  resetCultures();
});

test('rarity gate: with uncommon from round 3 and rare from round 6, Bannerman and Oathsworn cannot be drawn earlier', () => {
  reg();
  setRarityGate({ uncommon: 3, rare: 6 });
  const draw = (round, seed) => drawCards(createCardState({ pool: culturePool('crown'), round }), seededRandom(seed), 8).state.hand.map((c) => c.unitId).filter(Boolean);
  const seen = { 1: new Set(), 3: new Set(), 6: new Set() };
  for (let s = 1; s <= 80; s += 1) for (const r of [1, 3, 6]) for (const id of draw(r, s)) seen[r].add(id);
  assert.equal(seen[1].has('bannerman') || seen[1].has('oathsworn'), false, 'round 1: commons only');
  assert.equal(seen[3].has('bannerman'), true, 'round 3: Bannerman appears');
  assert.equal(seen[3].has('oathsworn'), false, 'round 3: no Oathsworn yet');
  assert.equal(seen[6].has('oathsworn'), true, 'round 6: Oathsworn appears');
  setRarityGate({});
  resetCultures();
});

// ---------------------------------------------------------------- units
test('unit templates: Crown variants keep the base stats; Crown Guard, Bannerman and Oathsworn use the documented deltas', () => {
  reg();
  const pk = RECRUIT.pikeman;
  for (const [key, baseKey] of [['crownPike', 'pikeman'], ['crownArcher', 'archer'], ['crownCavalier', 'cavalier']]) {
    const u = createRecruitUnit(key, 'u', 'blue', 1, 1), b = createRecruitUnit(baseKey, 'b', 'blue', 1, 1);
    assert.equal(u.cls, baseKey, `${key} is a ${baseKey}`);
    assert.equal(u.variantId, key);
    for (const s of ['maxHp', 'str', 'skl', 'spd', 'def', 'mov', 'weapon']) assert.equal(u[s], b[s], `${key} ${s}`);
    assert.deepEqual(u.passives.map((p) => p.id), ['lineDoctrine']);
    assert.equal(b.passives, undefined, 'plain classes are untouched');
  }
  const g = createRecruitUnit('crownGuard', 'g', 'blue', 1, 1), bn = createRecruitUnit('bannerman', 'b', 'blue', 1, 1), o = createRecruitUnit('oathsworn', 'o', 'blue', 1, 1);
  assert.deepEqual([g.cls, g.variantId, g.maxHp, g.str, g.def, g.mov, g.weapon, g.stance], ['pikeman', 'crownGuard', pk.hp + 2, pk.str, pk.def + 1, pk.mov - 1, 'Iron Pike', 'hold']);
  assert.deepEqual([bn.cls, bn.maxHp, bn.str, bn.def, bn.mov, bn.stance], ['bannerman', pk.hp - 4, pk.str - 3, pk.def, pk.mov, 'hold']);
  assert.deepEqual([o.cls, o.maxHp, o.str, o.def, o.mov, o.stance], ['oathsworn', pk.hp + 4, pk.str, pk.def + 3, pk.mov, 'hold']);
  assert.deepEqual(g.passives.map((p) => p.id), ['lineDoctrine', 'shieldwall']);
  assert.deepEqual(bn.passives.map((p) => p.id), ['lineDoctrine', 'banner']);
  assert.deepEqual(o.passives.map((p) => p.id), ['lineDoctrine', 'swornGuard', 'swornGuardCost']);
  for (const key of ['crownGuard', 'bannerman', 'oathsworn']) assert.deepEqual(SPRITE_FALLBACK[key].base, 'pikeman', 'placeholder art borrows the pikeman sprite');
  assert.ok(kitFor(g).some((a) => a.id === 'rally') && kitFor(g).some((a) => a.id === 'brace'), 'a Crown Guard keeps the Pikeman kit');
  assert.equal(kitFor(bn).some((a) => a.id === 'rally'), false, 'the new classes have no Rally or Brace (engine request: kit inheritance)');
  assert.equal(SPRITE_FALLBACK.crownArcher.base, 'archer');
  resetCultures();
});

test('a Crown card recruits, deploys and keeps its identity, passives and star upgrades; only same-variant units combine', () => {
  reg();
  const m = createMatch({ seed: 3, pools: { blue: ['crownGuard', 'oathsworn', 'crownPike'] } });
  const card = m.summary('blue').handState.find((c) => c.type === 'unit');
  assert.ok(card);
  const r = m.apply({ type: 'recruit', faction: 'blue', cardId: card.instanceId });
  assert.equal(r.ok, true);
  const reserve = m.summary('blue').reserveState.at(-1);
  assert.equal(reserve.unitId, card.unitId);
  const tile = m.deploymentTiles('blue').find(([c, rr]) => !m.unitAt(c, rr));
  const d = m.apply({ type: 'deploy', faction: 'blue', reserveId: reserve.id, c: tile[0], r: tile[1] });
  assert.equal(d.ok, true);
  const u = m.byId(d.unitId);
  assert.equal(u.culture, 'crown');
  assert.ok(u.passives.some((p) => p.id === 'lineDoctrine'));
  assert.equal(u.stance, card.defaultStance, 'the deployed unit starts on its card\'s default stance');
  // combining: three of one identity yes; a Crown Pikeman with two plain Pikemen no
  const three = ['a', 'b', 'c'].map((n) => ({ ...rec('crownPike', n, 'blue', 1, 1), stars: 1, faction: 'blue' }));
  assert.equal(findUpgradeMatches(three).length, 1);
  const mixed = [three[0], three[1], { ...rec('pikeman', 'p', 'blue', 1, 1), stars: 1 }];
  assert.deepEqual(findUpgradeMatches(mixed), [], 'a Crown Pikeman does not combine with a plain Pikeman');
  resetCultures();
});

// ---------------------------------------------------------------- Line Doctrine
test('Line Doctrine: -1 damage per adjacent friendly infantry, at most -2; nothing when alone; cavalry give nothing but receive it', () => {
  reg();
  const x = rec('crownPike', 'x', 'blue', 5, 5, hold);
  const ally = (id, c, r, key = 'pikeman') => rec(key, id, 'blue', c, r, hold);
  assert.equal(at([x]).get('x'), undefined, 'alone: no bonus and no penalty');
  assert.equal(at([x, ally('a', 4, 5)]).get('x').damageTaken, 1);
  assert.equal(at([x, ally('a', 4, 5), ally('b', 6, 5)]).get('x').damageTaken, 2);
  assert.equal(at([x, ally('a', 4, 5), ally('b', 6, 5), ally('c', 5, 4)]).get('x').damageTaken, 2, 'capped at 2');
  assert.equal(at([x, ally('a', 4, 5, 'archer')]).get('x').damageTaken, 1, 'archers count as infantry');
  assert.equal(at([x, ally('a', 4, 5, 'crownGuard')]).get('x').damageTaken, 1, 'a Crown Guard neighbour counts (its own Shieldwall is on the Guard)');
  assert.equal(at([x, ally('a', 4, 4)]).get('x'), undefined, 'diagonal is not adjacent');
  assert.equal(at([x, ally('a', 3, 5)]).get('x'), undefined, 'two tiles away is not adjacent');
  assert.equal(at([x, rec('cavalier', 'k', 'blue', 4, 5, hold)]).get('x'), undefined, 'a cavalier is not infantry');
  assert.equal(at([x, rec('pikeman', 'e', 'red', 4, 5, hold)]).get('x'), undefined, 'an enemy is not an ally');
  const knight = rec('crownCavalier', 'kn', 'blue', 5, 5, hold);
  assert.equal(at([knight, ally('a', 4, 5)]).get('kn').damageTaken, 1, 'mounted nobility benefits from adjacent infantry');
  assert.equal(at([knight, rec('cavalier', 'k2', 'blue', 4, 5, hold)]).get('kn'), undefined);
  const brenna = { ...createChampionUnit('brennaCrown', 'blue', 5, 4), stance: 'hold' };
  assert.equal(at([x, brenna]).get('x').damageTaken, 1 + C.BRENNA_PRESENCE.reduction, 'Brenna is infantry: Line Doctrine 1 plus her Presence');
  // the plain (baseline) Pikeman carries nothing
  assert.equal(at([ally('a', 4, 5), ally('b', 5, 5)]).get('a'), undefined);
  resetCultures();
});

test('Line Doctrine in a real battle: a Crown Pikeman takes 0 / 1 / 2 / 2 less damage with 0 / 1 / 2 / 3 adjacent infantry', () => {
  reg();
  const x = rec('crownPike', 'x', 'blue', 6, 5, hold);
  const nb = (id, c, r) => rec('pikeman', id, 'blue', c, r, hold);
  const cases = [[[], 0], [[nb('a', 5, 5)], 1], [[nb('a', 5, 5), nb('b', 6, 4)], 2], [[nb('a', 5, 5), nb('b', 6, 4), nb('c', 6, 6)], 2]];
  for (const [friends, want] of cases) {
    const r = cleanHit([x, ...friends], 'x');
    assert.equal(reduction(r), want, `${friends.length} adjacent`);
  }
  // the same unit and the same friends, scattered two tiles apart: full damage
  const scattered = cleanHit([x, nb('a', 4, 5), nb('b', 6, 3), nb('c', 6, 7)], 'x');
  assert.equal(reduction(scattered), 0, 'scattered units get no doctrine');
  // a plain Pikeman with the same friends gets nothing (the doctrine belongs to Crown units)
  const plain = cleanHit([rec('pikeman', 'x', 'blue', 6, 5, hold), nb('a', 5, 5), nb('b', 6, 4)], 'x');
  assert.equal(reduction(plain), 0);
  // the statuses are cleared after the battle
  assert.deepEqual(cleanHit([x, nb('a', 5, 5)], 'x').match.byId('x').statuses.damageTaken, undefined);
  resetCultures();
});

// ---------------------------------------------------------------- Crown Guard: Shieldwall and Close Ranks
test('Shieldwall: a Crown Guard beside friendly infantry takes 2 more off (3 with one neighbour, 4 with two), and nothing when alone', () => {
  reg();
  const x = rec('crownGuard', 'x', 'blue', 6, 5, hold);
  const nb = (id, c, r) => rec('pikeman', id, 'blue', c, r, hold);
  assert.equal(reduction(cleanHit([x], 'x')), 0, 'alone');
  assert.equal(reduction(cleanHit([x, nb('a', 5, 5)], 'x')), C.LINE_REDUCTION_PER_ADJACENT + C.SHIELDWALL_REDUCTION);
  assert.equal(reduction(cleanHit([x, nb('a', 5, 5), nb('b', 6, 4)], 'x')), 2 * C.LINE_REDUCTION_PER_ADJACENT + C.SHIELDWALL_REDUCTION);
  assert.equal(reduction(cleanHit([x, rec('cavalier', 'k', 'blue', 5, 5, hold)], 'x')), 0, 'cavalry do not count as infantry for Shieldwall');
  resetCultures();
});

test('Close Ranks: Pikeman class (Crown Pikeman and Crown Guard), 1 energy / cooldown 2, defense phase, 2 less damage per strike; cleared after the battle', () => {
  reg();
  const cr = ABILITY_CATALOG.closeRanks;
  assert.deepEqual([cr.cost, cr.cooldown, cr.phase, cr.effect.damageTaken], [1, 2, 'defense', 2]);
  const g = rec('crownGuard', 'g', 'blue', 6, 5, { ...hold, energy: 2 });
  assert.ok(kitFor(g).some((a) => a.id === 'closeRanks'));
  for (const key of ['bannerman', 'oathsworn', 'archer', 'cavalier']) assert.equal(kitFor(rec(key, 'z', 'blue', 1, 1)).some((a) => a.id === 'closeRanks'), false, `${key} has no Close Ranks`);
  for (const key of ['crownGuard', 'crownPike']) assert.equal(kitFor(rec(key, 'z', 'blue', 1, 1)).some((a) => a.id === 'closeRanks'), true, `${key} has Close Ranks`);
  assert.equal(kitFor(rec('pikeman', 'z', 'blue', 1, 1)).some((a) => a.id === 'closeRanks'), true, 'KNOWN LIMITATION: kits are class-keyed, so a plain Pikeman could select it too (engine request: kits by variant)');
  assert.equal(validateAbilitySelection(g, ['closeRanks']).ok, true);
  assert.equal(validateAbilitySelection({ ...g, energy: 0 }, ['closeRanks']).reason, 'insufficient-energy');
  assert.equal(validateAbilitySelection(rec('archer', 'p', 'blue', 1, 1, { energy: 4 }), ['closeRanks']).reason, 'invalid-ability');
  const act = activatePhase({ ...g, selectedAbilities: ['closeRanks'] }, 'defense');
  assert.equal(act.events[0].applied, true);
  assert.equal(act.unit.statuses.damageTaken, 2);
  assert.equal(act.unit.cooldowns.closeRanks, 2);
  assert.equal(act.unit.energy, g.energy - 1);
  assert.equal(activatePhase({ ...act.unit, selectedAbilities: ['closeRanks'] }, 'defense').events[0].reason, 'cooldown');
  // in a battle: Guard alone with Close Ranks takes exactly 2 less; it does not force Hold (stance untouched)
  const picked = { ...g, selectedAbilities: ['closeRanks'], stance: 'hold' };
  assert.equal(reduction(cleanHit([picked], 'g')), 2);
  assert.equal(reduction(cleanHit([{ ...picked, stance: 'advance' }], 'g')) >= 0, true, 'selectable while advancing');
  resetCultures();
});

// ---------------------------------------------------------------- Bannerman: Banner and Hold the Standard
test('Banner: friendly Hold/Protect units within 2 tiles take 1 less per strike; not Advance, not out of range, not enemies, not the Bannerman', () => {
  reg();
  const b = rec('bannerman', 'b', 'blue', 5, 5, hold);
  const holdU = rec('pikeman', 'h', 'blue', 5, 7, hold), advU = rec('pikeman', 'v', 'blue', 5, 3, { stance: 'advance' }), far = rec('pikeman', 'f', 'blue', 5, 9, hold);
  const prot = rec('pikeman', 'p', 'blue', 7, 5, { stance: 'protect' }), foe = rec('pikeman', 'x', 'red', 5, 6, hold);
  const fx = at([b, holdU, advU, far, prot, foe]);
  assert.equal(fx.get('h').damageTaken, 1);
  assert.equal(fx.get('p').damageTaken, 1, 'Protect counts');
  assert.equal(fx.get('v'), undefined, 'Advance does not');
  assert.equal(fx.get('f'), undefined, 'three tiles or more does not');
  assert.equal(fx.get('x'), undefined);
  assert.equal(fx.get('b'), undefined, 'the source is not in its own aura');
  // in a battle: a Holding Pikeman two tiles from the Bannerman takes 1 less
  const r = cleanHit([rec('pikeman', 'x', 'blue', 6, 5, hold), rec('bannerman', 'b', 'blue', 5, 6, hold)], 'x');
  assert.equal(reduction(r), 1);
  resetCultures();
});

test('Hold the Standard: Bannerman only, 2 energy / cooldown 3, defense phase, requires Hold (simplified to 2 less damage on the Bannerman)', () => {
  reg();
  const hs = ABILITY_CATALOG.holdTheStandard;
  assert.deepEqual([hs.cost, hs.cooldown, hs.phase, hs.requires.stance, hs.effect.damageTaken], [2, 3, 'defense', 'hold', 2]);
  const b = (stance) => ({ ...rec('bannerman', 'b', 'blue', 5, 5, { stance, energy: 3 }), selectedAbilities: ['holdTheStandard'] });
  assert.equal(activatePhase(b('hold'), 'defense').events[0].applied, true);
  assert.equal(activatePhase(b('hold'), 'defense').unit.statuses.damageTaken, 2);
  assert.equal(activatePhase(b('advance'), 'defense').events[0].reason, 'stance-trigger-unmet');
  for (const key of ['pikeman', 'crownGuard', 'oathsworn']) assert.equal(kitFor(rec(key, 'z', 'blue', 1, 1)).some((a) => a.id === 'holdTheStandard'), false);
  assert.equal(validateAbilitySelection({ ...b('hold'), energy: 1 }, ['holdTheStandard']).reason, 'insufficient-energy');
  assert.equal(reduction(cleanHit([b('hold')].map((u) => ({ ...u, id: 'x', c: 6 })), 'x')), 2);
  resetCultures();
});

// ---------------------------------------------------------------- Oathsworn: Sworn Guard and Interpose
test('Sworn Guard: while Protecting with a neighbour, adjacent allies take 2 less and the Oathsworn takes 2 more; nothing otherwise', () => {
  reg();
  const o = (stance) => rec('oathsworn', 'o', 'blue', 5, 5, { stance });
  const ally = rec('pikeman', 'a', 'blue', 4, 5, hold), far = rec('pikeman', 'f', 'blue', 5, 8, hold);
  const prot = at([o('protect'), ally, far]);
  assert.equal(prot.get('a').damageTaken, C.SWORN_ALLY_REDUCTION, 'the neighbour is shielded');
  assert.equal(prot.get('f'), undefined, 'a distant unit is not');
  // the Oathsworn: Line Doctrine for its one neighbour (+1) and the Sworn Guard cost (-2) net to -1
  assert.equal(prot.get('o').damageTaken, C.LINE_REDUCTION_PER_ADJACENT - C.SWORN_SELF_PENALTY);
  assert.equal(at([o('hold'), ally]).get('a'), undefined, 'not Protecting: no Sworn Guard');
  assert.equal(at([o('hold'), ally]).get('o').damageTaken, C.LINE_REDUCTION_PER_ADJACENT, 'not Protecting: Line Doctrine only');
  assert.equal(at([o('protect')]).get('o'), undefined, 'a lone Oathsworn is not penalised');
  assert.equal(at([o('protect'), rec('cavalier', 'k', 'blue', 4, 5, hold)]).get('k').damageTaken, C.SWORN_ALLY_REDUCTION, 'any adjacent ally is shielded (known simplification: should be the subject only)');
  resetCultures();
});

test('Sworn Guard in battle: the neighbour of a Protecting Oathsworn takes 2 less; the Oathsworn takes 2 more (net 1 more with Line Doctrine)', () => {
  reg();
  const subject = rec('pikeman', 'x', 'blue', 6, 5, hold);
  const withOath = (stance) => rec('oathsworn', 'o', 'blue', 5, 5, { stance, ...(stance === 'protect' ? { objective: { type: 'protect', targetId: 'x' } } : {}) });
  assert.equal(reduction(cleanHit([subject, withOath('protect')], 'x')), C.SWORN_ALLY_REDUCTION);
  assert.equal(reduction(cleanHit([subject, withOath('hold')], 'x')), 0);
  // the Oathsworn as the target: it stands at 6,5 next to a subject at 5,5 and is struck by the attacker at 7,5
  const oath = (stance) => rec('oathsworn', 'x', 'blue', 6, 5, { stance, ...(stance === 'protect' ? { objective: { type: 'protect', targetId: 's' } } : {}) });
  const s = rec('pikeman', 's', 'blue', 5, 5, hold);
  assert.equal(reduction(cleanHit([oath('protect'), s], 'x')), C.LINE_REDUCTION_PER_ADJACENT - C.SWORN_SELF_PENALTY, 'Line Doctrine 1 less, Sworn Guard 2 more: -1');
  assert.equal(reduction(cleanHit([oath('hold'), s], 'x')), C.LINE_REDUCTION_PER_ADJACENT, 'not Protecting: Line Doctrine only');
  resetCultures();
});

test('Interpose: Oathsworn only, 2 energy / cooldown 2, defense phase, requires Protect (simplified to 4 less damage on the Oathsworn)', () => {
  reg();
  const ip = ABILITY_CATALOG.interpose;
  assert.deepEqual([ip.cost, ip.cooldown, ip.phase, ip.requires.stance, ip.effect.damageTaken], [2, 2, 'defense', 'protect', 4]);
  const o = (stance) => ({ ...rec('oathsworn', 'o', 'blue', 5, 5, { stance, energy: 3 }), selectedAbilities: ['interpose'] });
  assert.equal(activatePhase(o('protect'), 'defense').events[0].applied, true);
  assert.equal(activatePhase(o('protect'), 'defense').unit.statuses.damageTaken, 4);
  assert.equal(activatePhase(o('hold'), 'defense').events[0].reason, 'stance-trigger-unmet');
  for (const key of ['pikeman', 'crownGuard', 'bannerman']) assert.equal(kitFor(rec(key, 'z', 'blue', 1, 1)).some((a) => a.id === 'interpose'), false);
  resetCultures();
});

// ---------------------------------------------------------------- Rally Banner
test('Rally Banner: 1 Supply, friendly unit, upcoming battle; the target takes 3 less per strike this battle and it is gone afterwards', () => {
  reg();
  const sp = SPELL_CATALOG.rallyBanner;
  assert.deepEqual([sp.cost, sp.target, sp.duration, sp.effect.status, sp.effect.duration], [1, 'friendly-unit', 'upcoming-battle', 'damageTaken', 3]);
  assert.equal(cardFor('rallyBanner').rarity, 'common');
  const x = rec('pikeman', 'x', 'blue', 6, 5, hold);
  const r = cleanHit([x], 'x', { spells: [{ key: 'rallyBanner', unitId: 'x' }] });
  assert.equal(reduction(r), 3);
  assert.equal(r.match.byId('x').statuses.damageTaken, undefined, 'expires with the battle');
  assert.equal(r.match.sides.blue.cards.queuedSpells.length, 0);
  // it stacks with Line Doctrine
  const both = cleanHit([rec('crownPike', 'x', 'blue', 6, 5, hold), rec('pikeman', 'a', 'blue', 5, 5, hold)], 'x', { spells: [{ key: 'rallyBanner', unitId: 'x' }] });
  assert.equal(reduction(both), 3 + 1);
  // it costs 1 Supply and can be cancelled for a refund
  const m = createMatch({ seed: 1, roster: [x, rec('pikeman', 'atk', 'red', 9, 5, hold)] });
  const card = { ...structuredClone(cardFor('rallyBanner')), instanceId: 'card-rb' };
  m.sides.blue.cards.hand.push(card);
  const supply = m.sides.blue.cards.supply;
  const q = m.apply({ type: 'spell', faction: 'blue', cardId: 'card-rb', unitId: 'x' });
  assert.equal(q.ok, true);
  assert.equal(m.sides.blue.cards.supply, supply - 1);
  assert.equal(m.apply({ type: 'cancelSpell', faction: 'blue', queueId: q.queueId }).ok, true);
  assert.equal(m.sides.blue.cards.supply, supply);
  // an enemy unit is not a legal target
  const bad = m.apply({ type: 'spell', faction: 'blue', cardId: 'card-rb', unitId: 'atk' });
  assert.equal(bad.ok, false);
  resetCultures();
});

// ---------------------------------------------------------------- Brenna
test('Brenna: the Crown champion has the shipped body, Line Doctrine, Crown\'s Presence and a two-ability kit; kit is not shared with recruits', () => {
  reg();
  const shipped = UNITS.find((u) => u.id === 'brenna');
  const b = createChampionUnit('brennaCrown', 'blue', 5, 9);
  for (const s of ['maxHp', 'str', 'skl', 'spd', 'def', 'mov', 'weapon', 'cls']) assert.equal(b[s], shipped[s], s);
  assert.equal(b.champion, true);
  assert.deepEqual(b.passives.map((p) => p.id), ['lineDoctrine', 'crownPresence']);
  for (const id of ['brenna', 'brennaCrown', 'brennaCrownB']) {
    const ids = kitFor({ id, cls: 'paladin' }).map((a) => a.id).sort();
    assert.deepEqual(ids, ['bulwarkOfTheRealm', 'oathkeepersStrike'], id);
  }
  assert.equal(kitFor(rec('pikeman', 'p', 'blue', 1, 1)).some((a) => a.id === 'bulwarkOfTheRealm'), false);
  assert.equal(kitFor({ id: 'dreg', cls: 'barbarian' }).length, 0, 'Dreg is unaffected');
  // respawn keeps her passives and her identity, on either side
  const back = createHeroRespawnData('brennaCrown', 5, 9);
  assert.deepEqual(back.passives.map((p) => p.id), ['lineDoctrine', 'crownPresence']);
  assert.equal(createChampionUnit('brennaCrownB', 'red', 5, 5).faction, 'red');
  // Bulwark of the Realm: Hold, 2 energy, 3 less
  const bw = ABILITY_CATALOG.bulwarkOfTheRealm;
  assert.deepEqual([bw.cost, bw.cooldown, bw.phase, bw.requires.stance, bw.effect.damageTaken], [2, 3, 'defense', 'hold', 3]);
  const brenna = (stance) => ({ ...initializeAbilityState({ ...b, stance, energy: 3 }), selectedAbilities: ['bulwarkOfTheRealm'] });
  assert.equal(activatePhase(brenna('hold'), 'defense').unit.statuses.damageTaken, 3);
  assert.equal(activatePhase(brenna('advance'), 'defense').events[0].reason, 'stance-trigger-unmet');
  // Oathkeeper's Strike: needs a target, +3 damage, +10 hit
  const ok = ABILITY_CATALOG.oathkeepersStrike;
  assert.deepEqual([ok.cost, ok.cooldown, ok.phase, ok.requires.target, ok.effect.damageDealt, ok.effect.hitBonus], [1, 2, 'enhancement', true, 3, 10]);
  const strike = { ...initializeAbilityState({ ...b, energy: 3 }), selectedAbilities: ['oathkeepersStrike'] };
  assert.equal(activatePhase(strike, 'enhancement', { hasTarget: true }).unit.statuses.damageDealt, 3);
  assert.equal(activatePhase(strike, 'enhancement', { hasTarget: false }).events[0].reason, 'no-legal-target');
  resetCultures();
});

test('Crown\'s Presence: friendly infantry within 2 tiles of Brenna take 1 less per strike; Brenna herself has Line Doctrine', () => {
  reg();
  const brenna = { ...createChampionUnit('brennaCrown', 'blue', 5, 5), stance: 'hold' };
  const near = rec('pikeman', 'n', 'blue', 5, 7, hold), far = rec('pikeman', 'f', 'blue', 5, 8, hold), horse = rec('cavalier', 'k', 'blue', 5, 3, hold);
  const fx = at([brenna, near, far, horse]);
  assert.equal(fx.get('n').damageTaken, 1);
  assert.equal(fx.get('f'), undefined);
  assert.equal(fx.get('k'), undefined, 'cavalry are not infantry');
  assert.equal(at([brenna, rec('pikeman', 'a', 'blue', 4, 5, hold)]).get('brennaCrown').damageTaken, 1, 'Line Doctrine on Brenna');
  // battle: a Holding Pikeman one tile off Brenna (adjacent: Presence only, the pikeman has no doctrine) takes 1 less
  const r = cleanHit([rec('pikeman', 'x', 'blue', 6, 5, hold), { ...createChampionUnit('brennaCrown', 'blue', 5, 5), stance: 'hold' }], 'x', { champions: { blue: 'brennaCrown' } });
  assert.equal(reduction(r), 1);
  resetCultures();
});

test('a match with the Crown champion on either side plays, respawns her with her passives, and the mirror needs two champion ids', () => {
  reg();
  const mk = (b, r) => [createChampionUnit(b, 'blue', 5, 9), createChampionUnit(r, 'red', 10, 3), rec('crownPike', 'p1', 'blue', 4, 9), rec('crownPike', 'p2', 'red', 9, 3)];
  const m = createMatch({ seed: 4, maxRounds: 8, roster: mk('brennaCrown', 'brennaCrownB'), champions: { blue: 'brennaCrown', red: 'brennaCrownB' } });
  assert.equal(m.champion('blue'), 'brennaCrown');
  assert.equal(m.champion('red'), 'brennaCrownB');
  while (!m.over) m.resolveRound();
  assert.ok(m.round >= 1);
  // she dies, waits two rounds and returns as herself with her passives
  let back = null;
  for (let seed = 1; seed <= 60 && !back; seed += 1) {
    const roster = [{ ...createChampionUnit('brennaCrown', 'blue', 5, 5), hp: 1, stance: 'hold' }, rec('pikeman', 'k1', 'red', 6, 5, { ...hold, str: 40, skl: 40 }), rec('pikeman', 'k2', 'red', 14, 2), rec('pikeman', 'b2', 'blue', 1, 1)];
    const mm = createMatch({ seed, roster, champions: { blue: 'brennaCrown' } });
    for (let i = 0; i < 5 && !mm.over && !back; i += 1) {
      const res = mm.resolveRound();
      const ev = res.batches.find((b) => b.type === 'results').events.find((e) => e.type === 'respawn');
      if (ev) back = mm.byId('brennaCrown');
    }
  }
  assert.ok(back, 'Brenna respawned');
  assert.deepEqual(back.passives.map((p) => p.id), ['lineDoctrine', 'crownPresence']);
  assert.equal(back.faction, 'blue');
  resetCultures();
});

test('gap check: registerCulture alone leaves a champion without passives (the engine copies none); registerArgentCrown finishes it', () => {
  resetCultures();
  registerCulture(ARGENT_CROWN);
  assert.equal(CHAMPION_TEMPLATES.brennaCrown.passives, undefined, 'if this starts failing the engine copies champion passives and registerArgentCrown can drop its patch');
  resetCultures();
  registerArgentCrown();
  assert.equal(CHAMPION_TEMPLATES.brennaCrown.passives.length, 2);
  resetCultures();
});

test('gap check: a variant card\'s defaultStance alone does not set the unit\'s stance (stats.stance does); kits are class-keyed, so a plain Pikeman sees Close Ranks', () => {
  resetCultures();
  registerCulture({ id: 'gapfix', variants: { gapHold: { base: 'pikeman', name: 'Gap Hold', card: { defaultStance: 'hold' } }, gapHold2: { base: 'pikeman', name: 'Gap Hold 2', stats: { stance: 'hold' }, card: { defaultStance: 'hold' } } }, pool: ['gapHold', 'gapHold2'] });
  const m = createMatch({ seed: 2, pools: { blue: ['gapHold'] } });
  const card = m.summary('blue').handState.find((c) => c.type === 'unit');
  assert.equal(card.defaultStance, 'hold', 'the card says Hold');
  m.apply({ type: 'recruit', faction: 'blue', cardId: card.instanceId });
  const reserve = m.summary('blue').reserveState.at(-1);
  const tile = m.deploymentTiles('blue').find(([c, r]) => !m.unitAt(c, r));
  const unit = m.byId(m.apply({ type: 'deploy', faction: 'blue', reserveId: reserve.id, c: tile[0], r: tile[1] }).unitId);
  assert.equal(unit.stance, 'advance', 'ENGINE GAP: the deployed unit ignores its card\'s default stance (if this fails, the engine fixed it and `stats.stance` in the Crown Guard variant can go)');
  assert.equal(createRecruitUnit('gapHold2', 'x', 'blue', 1, 1).stance, 'hold', 'stats.stance is the workaround');
  resetCultures();
});

// ---------------------------------------------------------------- whole games
test('Crown v Crown and Crown v baseline games run to the end and replay exactly (header records cultures, pools, rarity gate)', () => {
  reg();
  setRarityGate({ uncommon: 3, rare: 6 });
  const pools = { blue: culturePool('crown'), red: [...RECRUITMENT_POOL] };
  const log = memoryLog();
  const build = (h, push) => { if (h.rarityGate) setRarityGate(h.rarityGate); return createMatch({ seed: h.seed, maxRounds: h.maxRounds, log: push, pools: h.pools, roster: [createChampionUnit('brennaCrown', 'blue', 5, 9), rec('crownPike', 'cp', 'blue', 4, 9), rec('crownArcher', 'ca', 'blue', 3, 9), UNITS.find((u) => u.id === 'dreg'), rec('pikeman', 'rp', 'red', 9, 6), rec('archer', 'ra', 'red', 12, 4)].map((u) => structuredClone(u)), champions: { blue: 'brennaCrown' } }); };
  const m = build({ seed: 9, maxRounds: 14, pools }, log.push);
  while (!m.over) {
    for (const u of m.alive('blue')) if (u.cls === 'crownGuard') m.apply({ type: 'abilities', faction: 'blue', unitId: u.id, abilityIds: ['closeRanks'] });
    m.resolveRound();
  }
  assert.deepEqual(log.entries[0].cultures, ['crown']);
  assert.deepEqual(log.entries[0].rarityGate, { uncommon: 3, rare: 6 });
  const check = replay(log.entries, { create: build });
  assert.equal(check.ok, true, JSON.stringify(check.mismatches?.slice(0, 2)));
  setRarityGate({});
  resetCultures();
});

test('with the culture unregistered the shipped registries and headers are unchanged', () => {
  resetCultures();
  assert.deepEqual(Object.keys(ABILITY_CATALOG), Object.keys(ABILITIES));
  assert.deepEqual(Object.keys(SPELL_CATALOG), Object.keys(SPELLS));
  assert.deepEqual(Object.keys(RECRUIT), ['pikeman', 'archer', 'cavalier']);
  assert.deepEqual(VARIANTS, {});
  assert.deepEqual(CHAMPION_TEMPLATES, {});
  const log = memoryLog();
  createMatch({ seed: 5, log: log.push });
  assert.equal(log.entries[0].cultures, undefined);
  assert.equal(log.entries[0].pools, undefined);
});
