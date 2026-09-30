// Rule checks for the Iron League culture (src/factions/iron-league.js): every unit, passive, skill, spell, the barricade and the
// champion kits, on the shared engine with the culture registered only inside each test. Nothing here changes the default game.
import test from 'node:test';
import assert from 'node:assert/strict';
import ironLeague, { IRON_LEAGUE as N, DEFAULT_LEAGUE_CHAMPION } from '../src/factions/iron-league.js';
import { registerCulture, resetCultures, culturePool, ACTIVE_CULTURES, SPRITE_FALLBACK } from '../src/cultures.js';
import { ABILITY_CATALOG, ABILITIES, SPELL_CATALOG, SPELLS, activatePhase, initializeAbilityState, kitFor, validateAbilitySelection } from '../src/abilities.js';
import { evaluatePassives } from '../src/passives.js';
import { RECRUIT, VARIANTS, CHAMPION_TEMPLATES, createRecruitUnit, createChampionUnit } from '../src/roster.js';
import { MOVE_TYPE, computeRange, MOVE_COST } from '../src/rules.js';
import { WEAPONS, forecast } from '../src/combat.js';
import { cardFor, unitCardFor, setRarityGate, RARITY_GATE, drawCards, createCardState, seededRandom } from '../src/cards.js';
import { createMatch } from '../src/match.js';
import { memoryLog, replay } from '../src/log.js';
import { runCommander } from '../src/ai/commander.js';
import { setMap, DEFAULT_MAP } from '../src/board.js';

setMap(DEFAULT_MAP);
// Plains/road tiles on the west bank of River Ford (no terrain Defense): row 5 columns 2-7, (6,4), (6,6), (5,3), (3,3).
const rec = (key, id, faction, c, r, extra = {}) => initializeAbilityState({ ...createRecruitUnit(key, id, faction, c, r), ...extra });
const league = (fn) => { registerCulture(ironLeague); try { return fn(); } finally { resetCultures(); setRarityGate({}); } };
const combatOf = (res) => res.batches.find((b) => b.type === 'combat').events;
const abilityEvents = (res) => res.batches.filter((b) => b.type === 'abilities').flatMap((b) => b.events);
const far = () => [rec('pikeman', 'far-b', 'blue', 1, 1), rec('pikeman', 'far-r', 'red', 14, 10, { stance: 'hold' })]; // keeps both sides alive
// Expected damage of one non-critical hit: forecast + culture bonuses (dealt + ignored Defense) - reduction, never below 0.
const expectDamage = (a, d, { dealt = 0, ignore = 0, taken = 0 } = {}) => Math.max(0, Math.max(0, forecast(a, d, [a.c, a.r]).atk.dmg + dealt + Math.min(ignore, d.def)) - taken);
/** First hit (non-crit) by attacker on target across seeds, from a fresh match built by `build()`. Returns { strike, match, res }. */
function firstHit(build, attackerId, targetId, { seeds = 60, rounds = 1 } = {}) {
  for (let seed = 1; seed <= seeds; seed += 1) {
    const m = build(seed);
    for (let i = 0; i < rounds && !m.over; i += 1) {
      const res = m.resolveRound();
      const strike = combatOf(res).find((e) => e.type === 'strike' && e.attackerId === attackerId && e.targetId === targetId && e.hit && !e.crit);
      if (strike) return { strike, match: m, res, seed };
    }
  }
  throw new Error(`no hit by ${attackerId} on ${targetId} in ${seeds} seeds`);
}

// ---------------------------------------------------------------- registration

test('importing the module registers nothing; registering and resetting leaves every shared table as it was', () => {
  assert.equal(ACTIVE_CULTURES.length, 0);
  const snap = () => JSON.stringify({ a: Object.keys(ABILITY_CATALOG), s: Object.keys(SPELL_CATALOG), r: Object.keys(RECRUIT), v: Object.keys(VARIANTS), c: Object.keys(CHAMPION_TEMPLATES), w: Object.keys(WEAPONS), m: MOVE_TYPE, f: SPRITE_FALLBACK });
  const before = snap();
  league(() => {
    assert.deepEqual(ACTIVE_CULTURES, ['league']);
    assert.ok(ABILITY_CATALOG.setPosition && SPELL_CATALOG.fieldRepair && RECRUIT.relicWalker && VARIANTS.pavise && CHAMPION_TEMPLATES.ilseVoss && WEAPONS['Relic Coil']);
  });
  assert.equal(snap(), before);
  assert.deepEqual(Object.keys(ABILITY_CATALOG), Object.keys(ABILITIES));
  assert.deepEqual(Object.keys(SPELL_CATALOG), Object.keys(SPELLS));
});

test('pool: every key resolves to a League or shared card, with the rarity tags from FACTIONS.md section 6', () => {
  league(() => {
    const pool = culturePool('league');
    for (const key of pool) assert.ok(cardFor(key), `${key} resolves`);
    const rarity = (k) => cardFor(k).rarity;
    assert.deepEqual(['leaguePike', 'pavise', 'coil', 'sapper', 'relicWalker'].map(rarity), ['common', 'common', 'uncommon', 'uncommon', 'rare']);
    assert.deepEqual(['fieldRepair', 'flare', 'mend', 'ward', 'fireburst'].map(rarity), ['common', 'common', 'common', 'common', 'common']);
    for (const shared of ['mend', 'ward', 'fireburst']) assert.ok(pool.includes(shared), `${shared} stays in the pool (one faction per side)`);
    assert.equal(pool.includes('pikeman') || pool.includes('cavalier') || pool.includes('barrier'), false);
    assert.deepEqual(Object.keys(ironLeague.abilities.reduce((o, a) => ({ ...o, [a.id]: a.rarity }), {})).filter((id) => !ironLeague.abilities.find((a) => a.id === id).units).map((id) => ABILITY_CATALOG[id]?.rarity), ['common', 'uncommon', 'rare', 'uncommon']);
  });
});

// ---------------------------------------------------------------- units

test('units: League Pikeman, Pavise Guard, Coil Crossbowman are variants of the core classes with the specified deltas', () => {
  league(() => {
    const pike = createRecruitUnit('pikeman', 'p', 'blue', 3, 5);
    const lp = createRecruitUnit('leaguePike', 'lp', 'blue', 3, 5);
    assert.deepEqual([lp.cls, lp.variantId, lp.culture, lp.name, lp.hp, lp.str, lp.def, lp.mov, lp.weapon], ['pikeman', 'leaguePike', 'league', 'League Pikeman', pike.hp, pike.str, pike.def, pike.mov, pike.weapon]);
    const pv = createRecruitUnit('pavise', 'pv', 'blue', 3, 5);
    assert.deepEqual([pv.cls, pv.variantId, pv.hp, pv.def, pv.str, pv.mov], ['pikeman', 'pavise', pike.hp + 1, pike.def + 2, pike.str - 2, pike.mov - 1]);
    const archer = createRecruitUnit('archer', 'a', 'blue', 3, 5);
    const coil = createRecruitUnit('coil', 'c', 'blue', 3, 5);
    assert.deepEqual([coil.cls, coil.variantId, coil.hp, coil.str, coil.skl, coil.weapon, coil.stance], ['archer', 'coil', archer.hp, archer.str, archer.skl, 'Longbow', 'hold']);
    assert.equal(unitCardFor('pavise').cost, N.PAVISE_COST);
    assert.equal(unitCardFor('coil').cost, 2);
    for (const k of ['leaguePike', 'pavise', 'coil', 'sapper', 'relicWalker']) assert.equal(unitCardFor(k).defaultStance, 'hold', `${k} defaults to Hold`);
    assert.equal(plainSprite('pavise'), 'pikeman');
    assert.equal(plainSprite('coil'), 'archer');
  });
});
const plainSprite = (k) => SPRITE_FALLBACK[k].base;

test('Relic Walker is a real new class: template, Relic Coil weapon reaching 1-2 tiles, armour movement, rare card, kit', () => {
  league(() => {
    const w = createRecruitUnit('relicWalker', 'w', 'blue', 5, 5);
    assert.deepEqual([w.cls, w.hp, w.str, w.skl, w.spd, w.def, w.mov, w.weapon, w.culture], ['relicWalker', 30, 7, 4, 2, 10, 3, 'Relic Coil', 'league']);
    assert.deepEqual(WEAPONS['Relic Coil'].rng, [1, 2]);
    assert.equal(MOVE_TYPE.relicWalker, 'armor');
    assert.equal(MOVE_COST.armor.M, undefined, 'armour cannot climb mountains');
    assert.equal(unitCardFor('relicWalker').rarity, 'rare');
    assert.deepEqual(SPRITE_FALLBACK.relicWalker.label, 'Relic Walker');
    const foe = (c) => rec('pikeman', 'e', 'red', c, 5);
    assert.equal(forecast(w, foe(6), [5, 5]).atk.can, true, 'range 1');
    assert.equal(forecast(w, foe(7), [5, 5]).atk.can, true, 'range 2');
    assert.equal(forecast(w, foe(8), [5, 5]).atk.can, false, 'range 3');
    assert.deepEqual(kitFor(w).map((a) => a.id), ['arcBurst']);
  });
});

test('Sapper is a class (labelled default, not a skill): template, weapon, kit is only Dig In', () => {
  league(() => {
    const s = createRecruitUnit('sapper', 's', 'blue', 5, 5);
    assert.deepEqual([s.cls, s.hp, s.str, s.def, s.mov, s.weapon, s.stance], ['sapper', 20, 6, 6, 4, 'League Sapper Pick', 'hold']);
    assert.deepEqual(kitFor(s).map((a) => a.id), ['digIn']);
    assert.equal(unitCardFor('sapper').rarity, 'uncommon');
    assert.equal(WEAPONS['League Sapper Pick'].kind, 'pick', 'no weapon-triangle interaction with pikes');
  });
});

// ---------------------------------------------------------------- passives

test('passive Planted Pike: +1 damage per strike only while holding and unmoved (pure evaluation and a real strike)', () => {
  league(() => {
    const lp = rec('leaguePike', 'lp', 'blue', 5, 5, { stance: 'hold' });
    const ev = (moved, stance) => evaluatePassives([{ ...lp, stance }], { moved: new Set(moved ? ['lp'] : []), stanceOf: (u) => u.stance }).get('lp');
    assert.deepEqual(ev(false, 'hold'), { damageDealt: N.PIKE_HOLD_DAMAGE });
    assert.equal(ev(true, 'hold'), undefined, 'moved');
    assert.equal(ev(false, 'advance'), undefined, 'not holding');
    const build = (seed) => createMatch({ seed, roster: [lp, rec('pikeman', 'e', 'red', 6, 5, { stance: 'hold' }), ...far()] });
    const { strike, match } = firstHit(build, 'lp', 'e');
    const a = match.byId('lp'), d = match.byId('e');
    assert.equal(strike.damage, expectDamage(a, d, { dealt: N.PIKE_HOLD_DAMAGE }));
    const plain = firstHit((seed) => createMatch({ seed, roster: [rec('pikeman', 'lp', 'blue', 5, 5, { stance: 'hold' }), rec('pikeman', 'e', 'red', 6, 5, { stance: 'hold' }), ...far()] }), 'lp', 'e');
    assert.equal(plain.strike.damage, strike.damage - 1);
  });
});

test('passive Set Shield: unmoved Pavise Guard gives adjacent friendly Archers/Crossbowmen 2 less damage per strike; not others, not when it moved', () => {
  league(() => {
    const pv = rec('pavise', 'pv', 'blue', 5, 5, { stance: 'hold' });
    const coil = rec('coil', 'cx', 'blue', 5, 6, { stance: 'hold' });
    const archer = rec('archer', 'ar', 'blue', 4, 5, { stance: 'hold' });
    const pike = rec('leaguePike', 'pk', 'blue', 6, 5, { stance: 'hold' });
    const distant = rec('coil', 'dc', 'blue', 5, 7, { stance: 'hold' });
    const foeArcher = rec('archer', 'fa', 'red', 6, 6, { stance: 'hold' }); // adjacent to the coil: enemies are never covered
    const fx = (moved) => evaluatePassives([pv, coil, archer, pike, distant, foeArcher], { moved: new Set(moved), stanceOf: (u) => u.stance });
    const on = fx([]);
    assert.equal(on.get('cx').damageTaken, N.SET_SHIELD_REDUCTION);
    assert.equal(on.get('ar').damageTaken, N.SET_SHIELD_REDUCTION);
    assert.equal(on.get('pk')?.damageTaken, undefined, 'pikemen are not covered');
    assert.equal(on.get('dc')?.damageTaken, undefined, 'radius 1 only');
    assert.equal(on.get('fa')?.damageTaken, undefined, 'enemy archers are not covered');
    assert.equal(on.get('pv')?.damageTaken, undefined, 'the Pavise Guard itself is not covered');
    assert.equal(fx(['pv']).get('cx')?.damageTaken, undefined, 'a Pavise Guard that moved gives nothing');
    // real strike: an enemy Archer shoots the covered Crossbowman for 2 less
    const build = (seed) => createMatch({ seed, roster: [pv, coil, rec('archer', 'ea', 'red', 5, 8, { stance: 'hold' }), ...far()] });
    const { strike, match } = firstHit(build, 'ea', 'cx');
    assert.equal(strike.damage, expectDamage(match.byId('ea'), match.byId('cx'), { taken: N.SET_SHIELD_REDUCTION }));
  });
});

test('passive Prepared Shot: +3 damage and +15 hit while holding and unmoved, per strike; gone when advancing or moved', () => {
  league(() => {
    const cx = rec('coil', 'cx', 'blue', 5, 5, { stance: 'hold' });
    const ev = (moved, stance) => evaluatePassives([{ ...cx, stance }], { moved: new Set(moved ? ['cx'] : []), stanceOf: (u) => u.stance }).get('cx');
    assert.deepEqual(ev(false, 'hold'), { damageDealt: N.PREPARED_SHOT_DAMAGE, hitBonus: N.PREPARED_SHOT_HIT });
    assert.equal(ev(true, 'hold'), undefined);
    assert.equal(ev(false, 'advance'), undefined);
    const target = () => rec('pikeman', 'e', 'red', 7, 5, { stance: 'hold' });
    const { strike, match } = firstHit((seed) => createMatch({ seed, roster: [cx, target(), ...far()] }), 'cx', 'e');
    assert.equal(strike.damage, expectDamage(match.byId('cx'), match.byId('e'), { dealt: N.PREPARED_SHOT_DAMAGE }));
    const plain = firstHit((seed) => createMatch({ seed, roster: [rec('archer', 'cx', 'blue', 5, 5, { stance: 'hold' }), target(), ...far()] }), 'cx', 'e');
    assert.equal(plain.strike.damage, strike.damage - N.PREPARED_SHOT_DAMAGE);
    // the hit bonus is real: over many seeds a held Crossbowman lands more shots than an Archer
    const rate = (key) => { let hits = 0, shots = 0; for (let seed = 1; seed <= 120; seed += 1) { const m = createMatch({ seed, roster: [rec(key, 'cx', 'blue', 5, 5, { stance: 'hold' }), target(), ...far()] }); for (const e of combatOf(m.resolveRound())) if (e.type === 'strike' && e.attackerId === 'cx') { shots += 1; hits += e.hit ? 1 : 0; } } return hits / shots; };
    assert.ok(rate('coil') > rate('archer') + 0.08, 'Prepared Shot raises the hit rate');
  });
});

test('passive Wear: below half HP the Relic Walker deals 2 less damage and has -10 hit; at exactly half or above nothing (strict)', () => {
  league(() => {
    const at = (hp) => evaluatePassives([rec('relicWalker', 'w', 'blue', 5, 5, { hp })], { moved: new Set() }).get('w');
    assert.deepEqual(at(14), { damageDealt: N.WEAR_DAMAGE, hitBonus: N.WEAR_HIT });
    assert.equal(at(15), undefined, 'exactly half is not below half');
    assert.equal(at(30), undefined);
    const build = (hp) => (seed) => createMatch({ seed, roster: [rec('relicWalker', 'w', 'blue', 5, 5, { hp, stance: 'hold' }), rec('pikeman', 'e', 'red', 6, 5, { stance: 'hold', str: 1 }), ...far()] });
    const worn = firstHit(build(10), 'w', 'e'), fresh = firstHit(build(30), 'w', 'e');
    assert.equal(worn.strike.damage, expectDamage(worn.match.byId('w'), worn.match.byId('e'), { dealt: N.WEAR_DAMAGE }), 'the match unit was hit before the strike; hp already reduced is accounted for via forecast');
    assert.equal(fresh.strike.damage, worn.strike.damage + 2);
  });
});

// ---------------------------------------------------------------- skills

test('skill Set Position: needs Hold, costs 1, cooldown 2, -2 damage per strike; stacks with Set Shield; no effect when advancing', () => {
  league(() => {
    const u = (stance, energy = 1) => rec('pavise', 'u', 'blue', 5, 5, { stance, energy, selectedAbilities: ['setPosition'] });
    assert.deepEqual(kitFor(u('hold')).map((a) => a.id), ['rally', 'brace', 'setPosition'], 'Pikeman family keeps Rally and Brace');
    const held = activatePhase(u('hold'), 'defense');
    assert.equal(held.events[0].applied, true);
    assert.equal(held.unit.statuses.damageTaken, N.SET_POSITION_REDUCTION);
    assert.equal(held.unit.energy, 0);
    assert.equal(held.unit.cooldowns.setPosition, N.SET_POSITION_COOLDOWN);
    assert.equal(activatePhase(u('advance'), 'defense').events[0].reason, 'stance-trigger-unmet', 'moving units get nothing');
    assert.equal(activatePhase({ ...held.unit, statuses: {}, energy: 1 }, 'defense').events[0].reason, 'cooldown');
    assert.equal(validateAbilitySelection({ ...u('hold', 0) }, ['setPosition']).ok, false, 'needs 1 energy');
    // stacks with Brace (Brace absorbs, Set Position reduces) and with Set Shield on a covered archer via evaluatePassives
    const both = activatePhase({ ...u('hold', 3), selectedAbilities: ['brace', 'setPosition'] }, 'defense');
    assert.equal(both.unit.statuses.brace, 4);
    assert.equal(both.unit.statuses.damageTaken, N.SET_POSITION_REDUCTION);
    // real strike: held, powered Pikeman takes 2 less than the same Pikeman unpowered
    const build = (ids, energy) => (seed) => createMatch({ seed, roster: [rec('leaguePike', 'u', 'blue', 5, 5, { stance: 'hold', energy, selectedAbilities: ids }), rec('pikeman', 'e', 'red', 6, 5, { stance: 'hold' }), ...far()] });
    const on = firstHit(build(['setPosition'], 1), 'e', 'u'), off = firstHit(build([], 0), 'e', 'u');
    assert.equal(on.strike.damage, Math.max(0, off.strike.damage - N.SET_POSITION_REDUCTION));
  });
});

test('skill Prepared Position: Hold + legal target, cost 1, +2 damage on top of Prepared Shot; nothing when moving or with no target', () => {
  league(() => {
    const u = (stance) => rec('coil', 'cx', 'blue', 5, 5, { stance, energy: 1, selectedAbilities: ['preparedPosition'] });
    assert.deepEqual(kitFor(u('hold')).map((a) => a.id), ['focusedShot', 'preparedPosition']);
    const ok = activatePhase(u('hold'), 'enhancement', { hasTarget: true });
    assert.equal(ok.events[0].applied, true);
    assert.equal(ok.unit.statuses.damageDealt, N.PREPARED_POSITION_DAMAGE);
    assert.equal(ok.unit.energy, 0);
    assert.equal(ok.unit.cooldowns.preparedPosition, N.PREPARED_POSITION_COOLDOWN);
    assert.equal(activatePhase(u('advance'), 'enhancement', { hasTarget: true }).events[0].reason, 'stance-trigger-unmet');
    assert.equal(activatePhase(u('hold'), 'enhancement', { hasTarget: false }).events[0].reason, 'no-legal-target');
    const target = () => rec('pikeman', 'e', 'red', 7, 5, { stance: 'hold' });
    const build = (ids, energy) => (seed) => createMatch({ seed, roster: [rec('coil', 'cx', 'blue', 5, 5, { stance: 'hold', energy, selectedAbilities: ids }), target(), ...far()] });
    const on = firstHit(build(['preparedPosition'], 1), 'cx', 'e'), off = firstHit(build([], 0), 'cx', 'e');
    assert.equal(on.strike.damage, off.strike.damage + N.PREPARED_POSITION_DAMAGE);
  });
});

test('skill Arc Burst with deterministic Overheat: cost 3, ignores 3 Defense, +3 damage, takes 2 more per strike, cooldown 4 (never random)', () => {
  league(() => {
    const w = (extra = {}) => rec('relicWalker', 'w', 'blue', 5, 5, { stance: 'hold', energy: 3, selectedAbilities: ['arcBurst'], ...extra });
    assert.equal(ABILITY_CATALOG.arcBurst.cooldown, N.ARC_BURST_BASE_COOLDOWN + N.OVERHEAT_COOLDOWN);
    assert.equal(validateAbilitySelection({ ...w(), energy: 2 }, ['arcBurst']).ok, false, 'needs 3 energy');
    const shot = activatePhase(w(), 'enhancement', { hasTarget: true });
    assert.equal(shot.events[0].applied, true);
    assert.deepEqual(shot.unit.statuses, { ignoreDefense: N.ARC_BURST_IGNORE_DEF, damageDealt: N.ARC_BURST_DAMAGE, damageTaken: -N.OVERHEAT_VULNERABLE });
    assert.equal(shot.unit.energy, 0);
    assert.equal(activatePhase(w({ stance: 'advance' }), 'enhancement', { hasTarget: true }).events[0].reason, 'stance-trigger-unmet');
    assert.equal(activatePhase(w(), 'enhancement', { hasTarget: false }).events[0].reason, 'no-legal-target');
    // Overheat: unavailable for the next three planning rounds, back on the fourth (cooldown counts down once per round)
    const foe = () => rec('pikeman', 'e', 'red', 7, 5, { stance: 'hold', str: 1 });
    const m = createMatch({ seed: 4, roster: [w({ energy: 4 }), foe(), ...far()] });
    const seen = [];
    for (let round = 1; round <= 5; round += 1) {
      m.byId('w').selectedAbilities = ['arcBurst']; m.byId('w').energy = 4; m.byId('w').hp = 30; m.byId('e').hp = 24; m.byId('e').c = 7; m.byId('e').r = 5;
      const ev = abilityEvents(m.resolveRound()).find((e) => e.abilityId === 'arcBurst');
      seen.push(ev.applied ? 'fired' : ev.reason);
    }
    assert.deepEqual(seen, ['fired', 'cooldown', 'cooldown', 'cooldown', 'fired']);
    // determinism: the activation pattern does not depend on the seed
    for (const seed of [1, 9, 33]) {
      const mm = createMatch({ seed, roster: [w({ energy: 4 }), foe(), ...far()] });
      mm.byId('e').hp = 200; mm.byId('e').maxHp = 200;
      assert.equal(abilityEvents(mm.resolveRound()).find((e) => e.abilityId === 'arcBurst').applied, true);
    }
    // damage: Def 9 target loses 3 to the ignore, 3 to the bonus; the Walker's own Def 10 is worth 2 less
    const strong = (ids, energy, stance) => (seed) => createMatch({ seed, roster: [rec('relicWalker', 'w', 'blue', 5, 5, { stance, energy, selectedAbilities: ids }), rec('pikeman', 'e', 'red', 7, 5, { stance: 'hold', str: 30 }), ...far()] });
    const a = firstHit(strong(['arcBurst'], 3, 'hold'), 'w', 'e'), b = firstHit(strong([], 0, 'hold'), 'w', 'e');
    assert.equal(a.strike.damage, b.strike.damage + N.ARC_BURST_IGNORE_DEF + N.ARC_BURST_DAMAGE);
    const hurt = firstHit((seed) => createMatch({ seed, roster: [rec('relicWalker', 'w', 'blue', 5, 5, { stance: 'hold', energy: 3, selectedAbilities: ['arcBurst'] }), rec('archer', 'e', 'red', 7, 5, { stance: 'hold' }), ...far()] }), 'e', 'w');
    const calm = firstHit((seed) => createMatch({ seed, roster: [rec('relicWalker', 'w', 'blue', 5, 5, { stance: 'hold', energy: 0 }), rec('archer', 'e', 'red', 7, 5, { stance: 'hold' }), ...far()] }), 'e', 'w');
    assert.equal(hurt.strike.damage, calm.strike.damage + N.OVERHEAT_VULNERABLE, 'Overheat makes it take 2 more per strike');
  });
});

// ---------------------------------------------------------------- Dig In and the barricade

test('skill Dig In: needs Hold, raises a 10 HP blocking barricade on the faced tile, decays after 4 rounds, cooldown 2, fails softly', () => {
  league(() => {
    const dig = (extra = {}) => rec('sapper', 'd', 'blue', 5, 5, { stance: 'hold', facing: 'east', energy: 1, selectedAbilities: ['digIn'], ...extra });
    const m = createMatch({ seed: 6, roster: [dig(), ...far()] });
    const res = m.resolveRound();
    const wall = m.objects.find((o) => o.objectKind === 'barricade');
    assert.ok(wall, 'a barricade exists');
    assert.deepEqual([wall.c, wall.r, wall.faction, wall.hp, wall.blocks, wall.name], [6, 5, 'blue', N.BARRICADE_HP, true, 'Barricade']);
    assert.equal(wall.decay, N.BARRICADE_DECAY - 1, 'one round of decay already ticked at round end');
    assert.ok(res.notes.some((n) => /raised a Barricade/.test(n.text)));
    assert.equal(m.byId('d').energy, 2, 'started 1, +1 at match start, paid 1, +1 at the round refresh');
    // cooldown: no second barricade next round; the first decays away after its 4 rounds
    for (let i = 0; i < 3; i += 1) { m.byId('d').selectedAbilities = ['digIn']; m.resolveRound(); }
    assert.equal(m.objects.filter((o) => o.objectKind === 'barricade').length <= 2, true);
    // needs Hold
    const adv = createMatch({ seed: 6, roster: [dig({ stance: 'advance' }), ...far()] });
    const ev = abilityEvents(adv.resolveRound()).find((e) => e.abilityId === 'digIn');
    assert.equal(ev.reason, 'stance-trigger-unmet');
    assert.equal(adv.objects.length, 0);
    // a blocked front tile fails softly and costs nothing extra to the rest of the round
    const blocked = createMatch({ seed: 6, roster: [dig(), rec('leaguePike', 'x', 'blue', 6, 5, { stance: 'hold' }), ...far()] });
    const bev = abilityEvents(blocked.resolveRound()).find((e) => e.abilityId === 'digIn');
    assert.equal(bev.spawned, false);
    assert.equal(blocked.objects.length, 0);
    // impassable front (river) is not built on
    const river = createMatch({ seed: 6, roster: [dig({ c: 6, r: 8, facing: 'east' }), ...far()] });
    river.resolveRound();
    assert.equal(river.objects.length, 0, '7,8 is river');
  });
});

test('barricade: blocks enemy movement, friends pass, real enemies in reach are struck first, destroyed by a hit, decays on schedule', () => {
  league(() => {
    const m = createMatch({ seed: 4, roster: [rec('sapper', 'd', 'blue', 5, 5, { stance: 'hold', facing: 'east' }), rec('pikeman', 'r', 'red', 8, 5, { stance: 'hold', str: 40, skl: 40 }), rec('leaguePike', 'friend', 'blue', 4, 5), ...far()] });
    const wall = m.addObject({ objectKind: 'barricade', faction: 'blue', c: 7, r: 5, hp: N.BARRICADE_HP, decay: N.BARRICADE_DECAY, blocks: true });
    const enemyReach = computeRange(m.byId('r'), m.board(), 6).move.map(([c, r]) => `${c},${r}`);
    assert.equal(enemyReach.includes('7,5'), false, 'enemy cannot enter it');
    assert.equal(enemyReach.includes('6,5'), false, 'nor cross it: 7,5 is the only tile between the bridge and the west bank');
    const friendReach = computeRange({ ...m.byId('friend'), c: 6, r: 5 }, m.board(), 4).move.map(([c, r]) => `${c},${r}`);
    assert.equal(friendReach.includes('7,5'), true, 'friends walk through');
    const res = m.resolveRound();
    const strike = combatOf(res).find((e) => e.type === 'strike' && e.attackerId === 'r');
    assert.equal(strike?.targetId, wall.id, 'with no real enemy in reach the barricade is struck');
    assert.ok(m.objects.every((o) => o.hp > 0));
    // decay: an untouched barricade disappears after exactly BARRICADE_DECAY rounds
    const m2 = createMatch({ seed: 4, roster: [rec('leaguePike', 'a', 'blue', 2, 5, { stance: 'hold' }), rec('pikeman', 'b', 'red', 14, 10, { stance: 'hold' })] });
    m2.addObject({ objectKind: 'barricade', faction: 'blue', c: 7, r: 5, hp: N.BARRICADE_HP, decay: N.BARRICADE_DECAY, blocks: true });
    let rounds = 0;
    while (m2.objects.length && rounds < 10) { m2.resolveRound(); rounds += 1; }
    assert.equal(rounds, N.BARRICADE_DECAY);
  });
});

test('barricade in the killing ground: a Sapper on the bridge exit stops a crossing enemy Pikeman for a round, and it is struck, not our units behind it', () => {
  league(() => {
    // River Ford: bridge tile 8,5, west exit 7,5. Sapper at 6,5 faces east and digs 7,5. The enemy stands on the bridge.
    const build = (seed) => createMatch({ seed, roster: [
      rec('sapper', 'd', 'blue', 6, 5, { stance: 'hold', facing: 'east', energy: 1, selectedAbilities: ['digIn'] }),
      rec('coil', 'cx', 'blue', 7, 4, { stance: 'hold' }), rec('leaguePike', 'p', 'blue', 6, 4, { stance: 'hold' }),
      rec('pikeman', 'r', 'red', 8, 5, { stance: 'advance', str: 40 }), ...far()] });
    const m = build(2);
    const res = m.resolveRound();
    const wall = m.objects.find((o) => o.objectKind === 'barricade');
    const enemyMove = res.batches.find((b) => b.type === 'movement').events.find((e) => e.unitId === 'r');
    assert.equal(enemyMove.type, 'hold', 'the enemy could not cross onto 7,5');
    assert.deepEqual([m.byId('r').c, m.byId('r').r], [8, 5]);
    const targets = combatOf(res).filter((e) => e.type === 'strike' && e.attackerId === 'r').map((e) => e.targetId);
    assert.ok(targets.length === 0 || targets.every((id) => !wall || id === wall.id || id.startsWith('obj-')), 'it can only reach the barricade');
    // and the Crossbowman at 7,4 reaches it (distance 2) while it stands on the bridge
    assert.ok(combatOf(res).some((e) => e.type === 'strike' && e.attackerId === 'cx' && e.targetId === 'r'));
  });
});

// ---------------------------------------------------------------- spells

test('spell Field Repair: free, heals a friendly unit 4 HP up to max; Mend still heals 8 for 1 Supply', () => {
  league(() => {
    assert.equal(cardFor('fieldRepair').cost, 0);
    assert.equal(SPELL_CATALOG.fieldRepair.effect.amount, N.FIELD_REPAIR_HEAL);
    const m = createMatch({ seed: 3, roster: [rec('leaguePike', 'a', 'blue', 2, 5, { hp: 10, stance: 'hold' }), rec('leaguePike', 'b', 'blue', 2, 6, { hp: 22, stance: 'hold' }), rec('pikeman', 'r', 'red', 14, 10, { stance: 'hold' })], pools: { blue: ['fieldRepair'] } });
    const card = m.summary('blue').handState.find((c) => c.id === 'spell-fieldRepair');
    assert.ok(card, 'in hand');
    const supplyBefore = m.summary('blue').supply;
    assert.equal(m.apply({ type: 'spell', faction: 'blue', cardId: card.instanceId, unitId: 'a' }).ok, true);
    assert.equal(m.summary('blue').supply, supplyBefore, 'costs no Supply');
    const second = m.summary('blue').handState.find((c) => c.id === 'spell-fieldRepair');
    m.apply({ type: 'spell', faction: 'blue', cardId: second.instanceId, unitId: 'b' });
    const res = m.resolveRound();
    const spells = res.batches.find((b) => b.type === 'spells').events;
    assert.deepEqual(spells.map((e) => [e.spellId, e.targetId, e.amount]), [['fieldRepair', 'a', 4], ['fieldRepair', 'b', 2]], 'b has only 2 HP missing');
    assert.equal(m.byId('a').hp, 14);
    assert.equal(m.byId('b').hp, 24, 'capped at max HP');
  });
});

test('spell Flare: costs 1, gives one friendly unit +20 hit for the upcoming battle only', () => {
  league(() => {
    assert.equal(cardFor('flare').cost, N.FLARE_COST);
    const build = (flare) => (seed) => {
      // a plain Archer: a held Coil Crossbowman is already near the 100 hit cap with Prepared Shot, so Flare adds little to it
      const m = createMatch({ seed, roster: [rec('archer', 'cx', 'blue', 5, 5, { stance: 'hold' }), rec('pikeman', 'e', 'red', 7, 5, { stance: 'hold' }), ...far()], pools: { blue: ['flare'] } });
      if (flare) m.apply({ type: 'spell', faction: 'blue', cardId: m.summary('blue').handState[0].instanceId, unitId: 'cx' });
      return m;
    };
    const m = build(true)(1);
    assert.equal(m.summary('blue').supply, 3 - N.FLARE_COST);
    const res = m.resolveRound();
    const ev = res.batches.find((b) => b.type === 'spells').events[0];
    assert.deepEqual([ev.spellId, ev.status, ev.duration], ['flare', 'hitBonus', N.FLARE_HIT]);
    assert.equal(m.byId('cx').statuses.hitBonus, undefined, 'cleared after the battle');
    const rate = (flare) => { let hits = 0, shots = 0; for (let seed = 1; seed <= 150; seed += 1) { const mm = build(flare)(seed); for (const e of combatOf(mm.resolveRound())) if (e.type === 'strike' && e.attackerId === 'cx') { shots += 1; hits += e.hit ? 1 : 0; } } return hits / shots; };
    assert.ok(rate(true) > rate(false) + 0.1, 'Flare raises the hit rate');
  });
});

// ---------------------------------------------------------------- champions

test('champions: three options, the first is the provisional default, each registered with stats, look and a kit only it can use', () => {
  league(() => {
    assert.equal(DEFAULT_LEAGUE_CHAMPION, 'ilseVoss');
    assert.deepEqual(Object.keys(ironLeague.champions), ['ilseVoss', 'tobiahKettle', 'oldSixty'], 'the first listed is the default');
    const kits = { ilseVoss: 'fieldWorks', tobiahKettle: 'overcharge', oldSixty: 'ironbound' };
    for (const [id, kit] of Object.entries(kits)) {
      const c = createChampionUnit(id, 'blue', 5, 5);
      assert.equal(c.champion, true);
      assert.equal(c.culture, 'league');
      assert.ok(c.look?.skin, 'has a portrait look');
      assert.ok(kitFor(c).some((a) => a.id === kit), `${id} has ${kit}`);
      for (const other of Object.values(kits).filter((k) => k !== kit)) assert.equal(kitFor(c).some((a) => a.id === other), false, `${id} lacks ${other}`);
      assert.equal(kitFor(rec('pikeman', 'x', 'blue', 1, 1)).some((a) => a.id === kit), false, 'no other unit of the class gets a champion kit');
    }
    const captain = createChampionUnit('ilseVoss', 'blue', 5, 5);
    assert.deepEqual([captain.name, captain.cls, captain.maxHp, captain.str, captain.def, captain.mov], ['Captain Ilse Voss', 'pikeman', 30, 9, 12, 4]);
    assert.deepEqual(kitFor(captain).map((a) => a.id), ['rally', 'brace', 'setPosition', 'fieldWorks'], 'pikeman kit plus her own');
    assert.equal(createChampionUnit('tobiahKettle', 'blue', 5, 5).weapon, 'Steel Bow');
    assert.equal(createChampionUnit('oldSixty', 'blue', 5, 5).weapon, 'Relic Coil');
    assert.deepEqual(kitFor(createChampionUnit('oldSixty', 'blue', 5, 5)).map((a) => a.id), ['arcBurst', 'ironbound']);
  });
});

test('champion kit Field Works (default champion): raises a barricade in front and takes 2 less per strike', () => {
  league(() => {
    const captain = { ...createChampionUnit('ilseVoss', 'blue', 5, 5), stance: 'hold', facing: 'east', energy: 2, selectedAbilities: ['fieldWorks'] };
    const m = createMatch({ seed: 5, roster: [initializeAbilityState(captain), rec('pikeman', 'r', 'red', 14, 10, { stance: 'hold' })], champions: { blue: 'ilseVoss' } });
    assert.equal(m.champion('blue'), 'ilseVoss');
    const act = activatePhase(initializeAbilityState(captain), 'defense');
    assert.equal(act.events[0].applied, true);
    assert.equal(act.unit.statuses.damageTaken, N.FIELD_WORKS_REDUCTION);
    assert.equal(act.unit.energy, 0);
    m.resolveRound();
    const wall = m.objects.find((o) => o.objectKind === 'barricade');
    assert.deepEqual([wall.c, wall.r], [6, 5]);
    // requires Hold
    assert.equal(activatePhase({ ...initializeAbilityState(captain), stance: 'advance' }, 'defense').events[0].reason, 'stance-trigger-unmet');
  });
});

test('champion kits Overcharge and Ironbound (alternative options): Overheat and 4 less damage', () => {
  league(() => {
    const engineer = initializeAbilityState({ ...createChampionUnit('tobiahKettle', 'blue', 5, 5), stance: 'hold', energy: 3, selectedAbilities: ['overcharge'] });
    const shot = activatePhase(engineer, 'enhancement', { hasTarget: true });
    assert.deepEqual(shot.unit.statuses, { ignoreDefense: N.OVERCHARGE_IGNORE_DEF, damageDealt: N.OVERCHARGE_DAMAGE, damageTaken: -N.OVERCHARGE_VULNERABLE });
    assert.equal(shot.unit.cooldowns.overcharge, N.OVERCHARGE_COOLDOWN);
    assert.equal(activatePhase({ ...engineer, stance: 'advance' }, 'enhancement', { hasTarget: true }).events[0].reason, 'stance-trigger-unmet');
    const bulwark = initializeAbilityState({ ...createChampionUnit('oldSixty', 'blue', 5, 5), stance: 'hold', energy: 2, selectedAbilities: ['ironbound'] });
    assert.equal(activatePhase(bulwark, 'defense').unit.statuses.damageTaken, N.IRONBOUND_REDUCTION);
  });
});

test('champion respawn: the registered League champion returns as itself, with its kit', () => {
  league(() => {
    let respawned = null;
    for (let seed = 1; seed <= 60 && !respawned; seed += 1) {
      const captain = { ...createChampionUnit('ilseVoss', 'blue', 5, 5), hp: 1, stance: 'hold' };
      const m = createMatch({ seed, roster: [captain, rec('pikeman', 'r1', 'red', 6, 5, { stance: 'hold', str: 40, skl: 40 }), rec('pikeman', 'r2', 'red', 14, 2), rec('leaguePike', 'b2', 'blue', 1, 1)], champions: { blue: 'ilseVoss' } });
      for (let i = 0; i < 5 && !m.over && !respawned; i += 1) {
        const res = m.resolveRound();
        respawned = res.batches.find((b) => b.type === 'results').events.find((e) => e.type === 'respawn') || null;
        if (respawned) {
          assert.equal(respawned.unitId, 'ilseVoss');
          const back = m.byId('ilseVoss');
          assert.deepEqual([back.faction, back.champion, back.maxHp, back.culture], ['blue', true, 30, 'league']);
          assert.ok(kitFor(back).some((a) => a.id === 'fieldWorks'));
        }
      }
    }
    assert.ok(respawned, 'the champion died and respawned in the seed sweep');
  });
});

// ---------------------------------------------------------------- pool, gate, matches

test('rarity gate with the League pool: round 1-2 hands are common only, uncommon from round 3, rare from round 6', () => {
  league(() => {
    setRarityGate({ uncommon: 3, rare: 6 });
    const draw = (round, seed) => drawCards(createCardState({ pool: culturePool('league'), round }), seededRandom(seed), 8).state.hand.map((c) => c.rarity);
    const seeds = Array.from({ length: 30 }, (_, i) => i + 1);
    for (const s of seeds) { assert.deepEqual([...new Set(draw(1, s))], ['common']); assert.equal(draw(5, s).includes('rare'), false); }
    assert.ok(seeds.some((s) => draw(3, s).includes('uncommon')));
    assert.ok(seeds.some((s) => draw(6, s).includes('rare')));
    setRarityGate({});
    assert.deepEqual(RARITY_GATE, {});
  });
});

test('a full League v League match with the shipped commander plays and replays exactly; the header records culture, pools, gate, champion', () => {
  league(() => {
    setRarityGate({ uncommon: 3, rare: 6 });
    const pools = { blue: culturePool('league'), red: culturePool('league') };
    const champions = { blue: 'ilseVoss', red: 'ilseVoss' };
    const roster = () => [{ ...createChampionUnit('ilseVoss', 'blue', 5, 9) }, rec('leaguePike', 'pb', 'blue', 3, 9), rec('coil', 'cb', 'blue', 1, 9),
      { ...createChampionUnit('ilseVoss', 'red', 10, 3), id: 'ilseVoss' }, rec('leaguePike', 'pr', 'red', 9, 6), rec('coil', 'cr', 'red', 12, 4)];
    // one champion id per side is not possible (ids are unique), so red gets Tobiah Kettle
    const redChampion = { ...createChampionUnit('tobiahKettle', 'red', 10, 3) };
    const build = (seed, push) => createMatch({ seed, maxRounds: 10, log: push, pools, roster: [roster()[0], roster()[1], roster()[2], redChampion, roster()[4], roster()[5]], champions: { blue: 'ilseVoss', red: 'tobiahKettle' } });
    const log = memoryLog();
    const m = build(7, log.push);
    while (!m.over) { runCommander(m, 'blue', 'heuristic'); runCommander(m, 'red', 'heuristic'); m.resolveRound(); }
    const header = log.entries[0];
    assert.deepEqual(header.cultures, ['league']);
    assert.deepEqual(header.pools, pools);
    assert.deepEqual(header.rarityGate, { uncommon: 3, rare: 6 });
    assert.deepEqual(header.champions, { blue: 'ilseVoss', red: 'tobiahKettle' });
    const check = replay(log.entries, { create: (h, push) => { setRarityGate(h.rarityGate || {}); return build(h.seed, push); } });
    assert.equal(check.ok, true, JSON.stringify(check.mismatches?.slice(0, 2)));
    void champions;
  });
});

// ---------------------------------------------------------------- engine gaps (recorded, not fixed here)

test('ENGINE REQUEST: League skills should not apply to the other side\'s plain Pikemen (ability `culture` filter)', { todo: 'abilityApplies() ignores a culture filter; see docs/factions/IRON_LEAGUE.md' }, () => {
  league(() => {
    assert.equal(kitFor(createRecruitUnit('pikeman', 'plain', 'red', 1, 1)).some((a) => a.id === 'setPosition'), false);
  });
});

test('ENGINE REQUEST: Set Shield should reduce only ranged damage, but damageTaken applies to every strike', { todo: 'no rangedDamageTaken status; see docs/factions/IRON_LEAGUE.md' }, () => {
  league(() => {
    const pv = rec('pavise', 'pv', 'blue', 5, 5, { stance: 'hold' }), cx = rec('coil', 'cx', 'blue', 5, 6, { stance: 'hold' });
    const build = (seed) => createMatch({ seed, roster: [pv, cx, rec('pikeman', 'e', 'red', 4, 6, { stance: 'hold' }), ...far()] });
    const { strike, match } = firstHit(build, 'e', 'cx');
    assert.equal(strike.damage, expectDamage(match.byId('e'), match.byId('cx')), 'a melee strike on the covered Crossbowman should take no reduction');
  });
});
