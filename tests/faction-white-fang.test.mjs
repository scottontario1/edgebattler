// Rule checks for the White Fang Clans (src/factions/white-fang.js): every unit, passive, skill, spell and Dreg's kit.
// The culture is registered per test and removed afterwards; with it unregistered the shipped rules are untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ABILITY_CATALOG, ABILITIES, SPELL_CATALOG, SPELLS, kitFor, activatePhase, battleMovement, initializeAbilityState, resolveQueuedSpells, validateAbilitySelection } from '../src/abilities.js';
import { registerCulture, resetCultures, culturePool, SPRITE_FALLBACK } from '../src/cultures.js';
import { RECRUIT, VARIANTS, UNITS, createRecruitUnit } from '../src/roster.js';
import { MOVE_TYPE } from '../src/rules.js';
import { WEAPONS, forecast } from '../src/combat.js';
import { RARITY_GATE, setRarityGate, drawCards, createCardState, seededRandom, cardFor, unitCardFor, RECRUITMENT_POOL } from '../src/cards.js';
import { createMatch } from '../src/match.js';
import { memoryLog, replay } from '../src/log.js';
import { setMap, DEFAULT_MAP } from '../src/board.js';
import { evaluatePassives } from '../src/passives.js';
import whiteFang, * as WF from '../src/factions/white-fang.js';
import { buildWhiteFang } from '../src/factions/white-fang.js';
import { matchOptions } from '../experiments/factions/white-fang/armies.mjs';
import { runFang } from '../experiments/factions/white-fang/commander.mjs';
import { runCommander } from '../src/ai/commander.js';

setMap(DEFAULT_MAP);
const P = RECRUIT.pikeman, A = RECRUIT.archer;
// A unit that always hits and never crits, so a strike's damage is exactly the forecast plus the statuses under test.
const SURE = { skl: 20 };
const rec = (key, id, faction, c, r, extra = {}) => initializeAbilityState({ ...createRecruitUnit(key, id, faction, c, r), ...extra });
// A defender whose Skl 40 keeps the attacker's crit chance at 0 (crit = weapon crit + Skl/2 - defender Skl/4).
const dummy = (id, faction, c, r, extra = {}) => rec('pikeman', id, faction, c, r, { stance: 'hold', skl: 40, spd: 0, ...extra });
const dreg = (faction, c, r, extra = {}) => initializeAbilityState({ ...structuredClone(UNITS.find((u) => u.id === 'dreg')), faction, c, r, ...extra });
const combatOf = (res) => res.batches.find((b) => b.type === 'combat').events;
const strikeBy = (res, id) => combatOf(res).find((e) => e.type === 'strike' && e.attackerId === id);
const abilityEvents = (res) => res.batches.filter((b) => b.type === 'abilities').flatMap((b) => b.events);
const far = (extra = {}) => rec('pikeman', 'far-blue', 'blue', 0, 0, { stance: 'hold', ...extra }); // keeps a side alive without taking part
const farRed = () => rec('pikeman', 'far-red', 'red', 15, 11, { stance: 'hold' });
const withFang = (fn) => { registerCulture(whiteFang); try { return fn(); } finally { resetCultures(); setRarityGate({}); } };
// The first seed whose run satisfies `fn` (returns a truthy result): used where a defender's own strike must hit and not crit.
const cleanSeed = (fn) => { for (let seed = 1; seed <= 80; seed += 1) { const out = fn(seed); if (out) return out; } throw new Error('no clean seed in 80'); };
const clean = (s) => s && s.hit && !s.crit;
const expected = (a, d, tile) => forecast(a, d, tile ?? [a.c, a.r]).atk.dmg;

test('registers cleanly, is fully removable, and leaves the shipped rules untouched', () => {
  const before = { recruit: Object.keys(RECRUIT).join(), move: Object.keys(MOVE_TYPE).join(), weapons: Object.keys(WEAPONS).join(), pool: RECRUITMENT_POOL.join() };
  withFang(() => {
    assert.equal(cardFor('fangReaver').culture, 'fang');
    assert.deepEqual(culturePool('fang'), WF.POOL.slice());
    assert.ok(SPELL_CATALOG.warCry && SPELL_CATALOG.bloodOath && SPELL_CATALOG.hunt);
    for (const id of ['reavingRush', 'ironSkin', 'frenzy', 'bloodChallenge', 'warlordsRush']) assert.ok(ABILITY_CATALOG[id], id);
  });
  assert.deepEqual(Object.keys(ABILITY_CATALOG), Object.keys(ABILITIES));
  assert.deepEqual(Object.keys(SPELL_CATALOG), Object.keys(SPELLS));
  assert.deepEqual(VARIANTS, {});
  assert.deepEqual(SPRITE_FALLBACK, {});
  assert.deepEqual({ recruit: Object.keys(RECRUIT).join(), move: Object.keys(MOVE_TYPE).join(), weapons: Object.keys(WEAPONS).join(), pool: RECRUITMENT_POOL.join() }, before);
  assert.equal(unitCardFor('fangReaver'), null);
  // The shipped pikeman kit is still Rally + Brace only, and nothing here gives Brenna or a plain pikeman a clan skill.
  assert.deepEqual(kitFor({ cls: 'pikeman', id: 'x' }).map((a) => a.id), ['rally', 'brace']);
});

test('pool: every key is a real card, weights and rarities are as documented, Ancestors\' Fury and Barrier are absent', () => {
  withFang(() => {
    const pool = culturePool('fang');
    for (const key of pool) assert.ok(cardFor(key), key);
    const count = (k) => pool.filter((x) => x === k).length;
    assert.deepEqual(['fangReaver', 'fangHunter', 'cavalier', 'fangAxeguard', 'fangBerserker', 'warCry', 'bloodOath', 'hunt', 'mend', 'ward', 'fireburst'].map(count), [3, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1]);
    assert.equal(pool.includes('barrier'), false, 'no Barrier card: the clans stay a glass cannon');
    assert.equal(Object.keys(SPELL_CATALOG).some((k) => /fury|ancestor/i.test(k)), false, "Ancestors' Fury was rejected in the spec");
    assert.deepEqual(['fangReaver', 'fangHunter', 'fangAxeguard', 'fangBerserker', 'warCry', 'bloodOath', 'hunt'].map((k) => cardFor(k).rarity), ['common', 'common', 'uncommon', 'rare', 'common', 'common', 'uncommon']);
    assert.deepEqual(['fangReaver', 'fangAxeguard', 'fangBerserker', 'fangHunter'].map((k) => cardFor(k).cost), [1, 2, 2, 2]);
    assert.ok(cardFor('fangReaver').culture === 'fang' && cardFor('hunt').culture === 'fang');
  });
});

test('units: real classes (Reaver, Axeguard, Berserker) and the Fang Hunter variant carry the FACTIONS.md deltas', () => {
  const beforeSprite = { ...SPRITE_FALLBACK };
  withFang(() => {
    const at = (key) => createRecruitUnit(key, key, 'blue', 4, 4);
    const r = at('fangReaver'), a = at('fangAxeguard'), b = at('fangBerserker'), h = at('fangHunter');
    // Reaver: Str +1, Def -2, Mov +1 on the Pikeman template.
    assert.deepEqual([r.cls, r.maxHp, r.str, r.def, r.mov, r.skl, r.spd], ['fangReaver', P.hp, P.str + 1, P.def - 2, P.mov + 1, P.skl, P.spd]);
    // Axeguard: HP +4, Str 0, Def +1.
    assert.deepEqual([a.cls, a.maxHp, a.str, a.def, a.mov], ['fangAxeguard', P.hp + 4, P.str, P.def + 1, P.mov]);
    // Berserker: HP +2, Str +2, Def -4.
    assert.deepEqual([b.cls, b.maxHp, b.str, b.def, b.mov], ['fangBerserker', P.hp + 2, P.str + 2, P.def - 4, P.mov]);
    // Hunter: a variant of the Archer (recruits as cls archer, keeps Focused Shot), HP -2, Str +1.
    assert.deepEqual([h.cls, h.variantId, h.maxHp, h.str, h.def, h.mov, h.range], ['archer', 'fangHunter', A.hp - 2, A.str + 1, A.def, A.mov, undefined]);
    assert.ok(kitFor(h).some((x) => x.id === 'focusedShot'));
    for (const u of [r, a, b, h]) assert.equal(u.culture, 'fang');
    // Weapons: the clan axes have the Iron Pike's numbers and a kind outside the weapon triangle.
    for (const name of ['Fang Axe', 'Wolf-Crest Axe', 'Scarred Great Axe']) assert.deepEqual(WEAPONS[name], { mt: 8, hit: 75, crit: 0, rng: [1, 1], kind: 'fang' });
    assert.equal(forecast(r, rec('pikeman', 'p', 'red', 5, 4), [4, 4]).atk.tri, 0, 'no triangle bonus against a Pikeman');
    // Movement, cards, sprites.
    assert.deepEqual(['fangReaver', 'fangAxeguard', 'fangBerserker'].map((k) => MOVE_TYPE[k]), ['foot', 'foot', 'foot']);
    assert.equal(unitCardFor('fangReaver').defaultStance, 'advance');
    assert.equal(unitCardFor('fangHunter').defaultStance, 'advance');
    assert.equal(unitCardFor('fangHunter').base, 'archer');
    assert.deepEqual(SPRITE_FALLBACK.fangReaver, { base: 'pikeman', tint: '#B4B2AC', label: 'White Fang Reaver' });
    assert.deepEqual(SPRITE_FALLBACK.fangHunter, { base: 'archer', tint: '#8C6B4F', label: 'Fang Hunter' });
  });
  assert.deepEqual(SPRITE_FALLBACK, beforeSprite);
});

test('classes, not variants: the clan Pikeman classes have no Rally or Brace, and clan kits belong to their own units only', () => {
  withFang(() => {
    const kit = (key) => kitFor(createRecruitUnit(key, 'k', 'blue', 1, 1)).map((a) => a.id).sort();
    assert.deepEqual(kit('fangReaver'), ['reavingRush']);
    assert.deepEqual(kit('fangAxeguard'), ['ironSkin']);
    assert.deepEqual(kit('fangBerserker'), ['frenzy']);
    assert.deepEqual(kit('fangHunter'), ['focusedShot'], 'the Hunter keeps the archer kit');
    assert.deepEqual(kit('pikeman'), ['brace', 'rally'], 'plain pikemen are unchanged');
    assert.equal(validateAbilitySelection({ ...rec('pikeman', 'p', 'blue', 1, 1), energy: 4 }, ['reavingRush']).ok, false);
    assert.equal(validateAbilitySelection({ ...rec('fangReaver', 'r', 'blue', 1, 1), energy: 4 }, ['brace']).ok, false);
  });
});

test('Momentum (Reaver): +2 damage on every strike only if it moved this battle; nothing while holding', () => {
  withFang(() => {
    const round = (reaverAt, stance) => {
      const reaver = rec('fangReaver', 'r', 'blue', ...reaverAt, { ...SURE, stance });
      const m = createMatch({ seed: 3, roster: [reaver, dummy('d', 'red', 7, 5), far(), farRed()] });
      const s = strikeBy(m.resolveRound(), 'r');
      return { s, base: expected(reaver, m.byId('d'), reaverAt) };
    };
    const moved = round([3, 5], 'advance'); // 3 tiles from an enemy 4 away: it walks into contact and strikes
    const held = round([6, 5], 'hold');    // already adjacent, does not move
    const stayed = round([6, 5], 'advance'); // already adjacent on Advance: alreadyInRange, no movement, no bonus
    assert.equal(moved.s.hit, true);
    assert.equal(moved.s.damage, moved.base + WF.MOMENTUM_DAMAGE);
    assert.equal(held.s.damage, held.base);
    assert.equal(stayed.s.damage, stayed.base);
    // The passive itself: evaluated from the moved set.
    const r = rec('fangReaver', 'r', 'blue', 4, 4);
    assert.deepEqual(evaluatePassives([r], { moved: new Set(['r']) }).get('r'), { damageDealt: 2 });
    assert.equal(evaluatePassives([r], { moved: new Set() }).get('r'), undefined);
  });
});

test('Bloodied Grit (Axeguard): +1 energy in a battle where it takes damage, none when it is not hurt', () => {
  withFang(() => {
    const play = (foeStr, seed) => {
      const guard = rec('fangAxeguard', 'g', 'blue', 6, 5, { stance: 'hold' });
      const foe = rec('pikeman', 'f', 'red', 7, 5, { stance: 'hold', skl: 40, str: foeStr });
      const m = createMatch({ seed, roster: [guard, foe, far(), farRed()] });
      const before = m.byId('g').energy;
      const res = m.resolveRound();
      const hurt = combatOf(res).some((e) => e.type === 'strike' && e.targetId === 'g' && e.damage > 0);
      return { hurt, gained: m.byId('g').energy - before };
    };
    // Every field unit gains +1 energy at the round refresh; Grit adds +1 more only if it was hurt.
    for (let seed = 1; seed <= 12; seed += 1) {
      const hurt = play(8, seed), spared = play(0, seed);
      assert.equal(hurt.hurt, true, `seed ${seed}: a Str 8 foe with Skl 40 always hits`);
      assert.equal(hurt.gained, 1 + WF.GRIT_ENERGY);
      assert.equal(spared.hurt, false);
      assert.equal(spared.gained, 1);
    }
  });
});

test('Last Fang (Berserker): +2 damage strictly below 50% HP, none at 50% or above', () => {
  withFang(() => {
    const dmg = (hp) => {
      const b = rec('fangBerserker', 'b', 'blue', 6, 5, { ...SURE, stance: 'hold', hp });
      const m = createMatch({ seed: 5, roster: [b, dummy('d', 'red', 7, 5), far(), farRed()] });
      return { s: strikeBy(m.resolveRound(), 'b'), base: expected(b, m.byId('d')) };
    };
    const maxHp = P.hp + 2;
    const below = dmg(maxHp / 2 - 1), half = dmg(maxHp / 2), full = dmg(maxHp);
    assert.equal(below.s.damage, below.base + WF.LAST_FANG_DAMAGE);
    assert.equal(half.s.damage, half.base, 'exactly 50% is not below');
    assert.equal(full.s.damage, full.base);
  });
});

test('Running Shot (Fang Hunter): +1 damage and +10 hit only when it moved before shooting', () => {
  withFang(() => {
    const h = createRecruitUnit('fangHunter', 'h', 'blue', 4, 5, { stance: 'advance' });
    const moved = evaluatePassives([h], { moved: new Set(['h']) }).get('h');
    assert.deepEqual(moved, { damageDealt: 1, hitBonus: 10 });
    assert.equal(evaluatePassives([h], { moved: new Set() }).get('h'), undefined);
    // In a match: the Hunter advances to range 2 and its strike carries +1.
    const hunter = { ...initializeAbilityState(h), ...SURE, stance: 'advance' };
    const m = createMatch({ seed: 4, roster: [hunter, dummy('d', 'red', 9, 5), far(), farRed()] });
    const s = strikeBy(m.resolveRound(), 'h');
    assert.equal(m.byId('h').c > 4, true, 'it moved');
    assert.equal(s.damage, expected(hunter, m.byId('d'), [m.byId('h').c, 5]) + WF.RUNNING_SHOT_DAMAGE);
  });
});

test('Reaving Rush: +2 damage and ignores 2 Defense, only on Advance with movement and a target; costs 1 energy, cooldown 2', () => {
  withFang(() => {
    const play = ({ at, stance, energy = 3 }) => {
      const reaver = rec('fangReaver', 'r', 'blue', ...at, { ...SURE, stance, energy, selectedAbilities: ['reavingRush'] });
      const m = createMatch({ seed: 3, roster: [reaver, dummy('d', 'red', 7, 5), far(), farRed()] });
      m.byId('r').energy = energy; // createMatch adds the round-1 energy; set it exactly
      const e0 = m.byId('r').energy;
      const res = m.resolveRound();
      return { m, res, ev: abilityEvents(res).find((e) => e.abilityId === 'reavingRush'), s: strikeBy(res, 'r'), base: expected(reaver, m.byId('d'), at), e0, reaver };
    };
    const ok = play({ at: [3, 5], stance: 'advance' });
    assert.equal(ok.ev.applied, true);
    assert.equal(ok.ev.cost, 1);
    assert.equal(ok.ev.cooldown, 2);
    assert.equal(ok.s.damage, ok.base + WF.MOMENTUM_DAMAGE + WF.REAVING_RUSH.damage + WF.REAVING_RUSH.ignoreDefense, 'momentum + rush + 2 ignored Defense');
    // Energy: paid 1 now, +1 at the refresh.
    assert.equal(ok.m.byId('r').energy, ok.e0 - 1 + 1);
    assert.equal(ok.m.byId('r').cooldowns.reavingRush, 1, 'cooldown 2 ticks once at the round refresh');
    assert.equal(play({ at: [6, 5], stance: 'advance' }).ev.reason, 'movement-trigger-unmet', 'already adjacent: no movement');
    assert.equal(play({ at: [3, 5], stance: 'hold' }).ev.reason, 'stance-trigger-unmet');
    assert.equal(play({ at: [3, 5], stance: 'advance', energy: 0 }).ev.reason, 'insufficient-energy');
    assert.equal(validateAbilitySelection({ ...rec('fangReaver', 'r', 'blue', 1, 1), energy: 0 }, ['reavingRush']).ok, false);
    // A red pikeman with Defense 4 loses 2 of it: the ignore is capped by the target's Defense.
    const lowDef = (def) => { const reaver = rec('fangReaver', 'r', 'blue', 3, 5, { ...SURE, energy: 3, selectedAbilities: ['reavingRush'] }); const m = createMatch({ seed: 3, roster: [reaver, dummy('d', 'red', 7, 5, { def }), far(), farRed()] }); return strikeBy(m.resolveRound(), 'r').damage - expected(reaver, m.byId('d'), [3, 5]); };
    assert.equal(lowDef(9), 2 + 2 + 2);
    assert.equal(lowDef(1), 2 + 2 + 1, 'ignoreDefense adds at most the target\'s Defense');
  });
});

test('Iron Skin (Axeguard): 3 less damage per strike, does not force Hold, costs 1 energy', () => {
  withFang(() => {
    const play = (skin) => cleanSeed((seed) => {
      const guard = rec('fangAxeguard', 'g', 'blue', 3, 5, { stance: 'advance', energy: 3, selectedAbilities: skin ? ['ironSkin'] : [] });
      const foe = rec('pikeman', 'f', 'red', 7, 5, { stance: 'hold', ...SURE });
      const m = createMatch({ seed, roster: [guard, foe, far(), farRed()] });
      const res = m.resolveRound();
      const hit = strikeBy(res, 'f');
      return clean(hit) && { m, hit, base: expected(foe, m.byId('g'), [7, 5]), ev: abilityEvents(res).find((e) => e.abilityId === 'ironSkin'), moved: res.batches.find((b) => b.type === 'movement').events.some((e) => e.type === 'move' && e.unitId === 'g') };
    });
    const skin = play(true), plain = play(false);
    assert.equal(skin.ev.applied, true);
    assert.equal(skin.ev.cost, 1);
    assert.equal(skin.hit.damage, Math.max(0, skin.base - WF.IRON_SKIN.damageTaken));
    assert.equal(plain.hit.damage, plain.base);
    assert.equal(skin.moved, true, 'the Axeguard still advanced: Iron Skin does not force Hold');
    assert.equal(skin.m.byId('g').statuses.damageTaken, undefined, 'cleared after the battle');
  });
});

test('Frenzy (Berserker): only below 50% HP; +4 damage per strike and 2 more damage taken per strike; costs 2 energy', () => {
  withFang(() => {
    const play = (hp) => cleanSeed((seed) => {
      const b = rec('fangBerserker', 'b', 'blue', 6, 5, { ...SURE, stance: 'hold', hp, energy: 4, selectedAbilities: ['frenzy'] });
      const foe = rec('pikeman', 'f', 'red', 7, 5, { stance: 'hold', skl: 40, spd: 0 });
      const m = createMatch({ seed, roster: [b, foe, far(), farRed()] });
      const res = m.resolveRound();
      const inn = strikeBy(res, 'f');
      return clean(inn) && clean(strikeBy(res, 'b')) && { ev: abilityEvents(res).find((e) => e.abilityId === 'frenzy'), out: strikeBy(res, 'b'), inn, outBase: expected(b, foe), inBase: expected(foe, b) };
    });
    const hurt = play(10);
    assert.equal(hurt.ev.applied, true);
    assert.equal(hurt.ev.cost, 2);
    assert.equal(hurt.out.damage, hurt.outBase + WF.LAST_FANG_DAMAGE + WF.FRENZY.damage, 'Last Fang and Frenzy stack');
    assert.equal(hurt.inn.damage, hurt.inBase + WF.FRENZY.extraTaken, 'takes 2 more per strike');
    const healthy = play(26);
    assert.equal(healthy.ev.reason, 'hp-trigger-unmet');
    assert.equal(healthy.out.damage, healthy.outBase);
    assert.equal(healthy.inn.damage, healthy.inBase);
    assert.equal(play(13).ev.reason, 'hp-trigger-unmet', 'exactly 50% is not below');
  });
});

test("Dreg's kit: Blood Challenge and Warlord's Rush belong to Dreg only (not Brenna, not other barbarian-class units)", () => {
  withFang(() => {
    const d = dreg('blue', 5, 5), brenna = UNITS.find((u) => u.id === 'brenna');
    assert.deepEqual(kitFor(d).map((a) => a.id).sort(), ['bloodChallenge', 'warlordsRush']);
    assert.deepEqual(kitFor(brenna), [], 'Brenna has no clan kit (her own kit is the Crown agent\'s job)');
    assert.deepEqual(kitFor({ ...d, id: 'someone-else' }), []);
    assert.deepEqual(kitFor(rec('fangReaver', 'r', 'blue', 1, 1)).map((a) => a.id), ['reavingRush']);
    const bc = ABILITY_CATALOG.bloodChallenge;
    assert.deepEqual([bc.cost, bc.cooldown, bc.phase, bc.mark.radius, bc.effect.damageDealt, bc.effect.offTargetPenalty], [2, 3, 'defense', 6, 4, 8]);
    assert.equal(bc.effect.damageDealt - bc.effect.offTargetPenalty, -4, 'net -4 against anything but the mark');
  });
});

test('Blood Challenge: +4 damage against the mark, -4 against anything else, default mark is the nearest enemy, range 6, not a lock', () => {
  withFang(() => {
    const setup = ({ stance = 'hold', energy = 4 } = {}) => {
      const d = dreg('blue', 5, 5, { ...SURE, stance, energy, selectedAbilities: ['bloodChallenge'] });
      return createMatch({ seed: 2, roster: [d, dummy('near', 'red', 6, 5), dummy('other', 'red', 5, 9), far(), farRed()], champions: { blue: 'dreg' } });
    };
    const vs = (m, id) => forecast(m.byId('dreg'), m.byId(id), [5, 5]).atk.dmg;
    // 1. Marking the adjacent enemy: +4.
    let m = setup();
    assert.equal(m.apply({ type: 'mark', faction: 'blue', unitId: 'dreg', targetId: 'near' }).ok, true);
    let res = m.resolveRound();
    assert.equal(abilityEvents(res).find((e) => e.abilityId === 'bloodChallenge').applied, true);
    assert.equal(strikeBy(res, 'dreg').targetId, 'near');
    assert.equal(strikeBy(res, 'dreg').damage, vs(m, 'near') + 4);
    // 2. Marking a far enemy that Dreg cannot reach while another is adjacent: the strike lands on the adjacent one at -4 (not a lock).
    m = setup();
    assert.equal(m.apply({ type: 'mark', faction: 'blue', unitId: 'dreg', targetId: 'other' }).ok, true);
    res = m.resolveRound();
    assert.equal(strikeBy(res, 'dreg').targetId, 'near');
    assert.equal(strikeBy(res, 'dreg').damage, Math.max(0, vs(m, 'near') - 4), 'off-target strike: +4 - 8 = -4');
    // 3. No mark aimed: the nearest enemy in radius is marked (+4).
    m = setup();
    res = m.resolveRound();
    assert.equal(strikeBy(res, 'dreg').damage, vs(m, 'near') + 4);
    // 4. Without the ability selected there is no bonus and no penalty.
    m = setup();
    m.byId('dreg').selectedAbilities = [];
    res = m.resolveRound();
    assert.equal(strikeBy(res, 'dreg').damage, vs(m, 'near'));
    // 5. Range 6: a target 7 tiles away is refused; the mark clears at the end of the round.
    m = setup();
    m.byId('other').c = 12; m.byId('other').r = 5;
    assert.equal(m.apply({ type: 'mark', faction: 'blue', unitId: 'dreg', targetId: 'other' }).reason, 'out-of-range');
    m.byId('other').c = 11;
    assert.equal(m.apply({ type: 'mark', faction: 'blue', unitId: 'dreg', targetId: 'other' }).ok, true, 'distance 6 is at the limit');
    m.resolveRound();
    assert.equal(m.byId('dreg').markTargetId, undefined);
    assert.equal(m.byId('dreg').markIntent, undefined);
    // 6. Cost and cooldown: 2 energy now, unavailable next round.
    m = setup({ energy: 2 });
    const e0 = m.byId('dreg').energy;
    m.resolveRound();
    assert.equal(m.byId('dreg').energy, Math.min(4, e0 - 2 + 1));
    assert.equal(m.byId('dreg').cooldowns.bloodChallenge, 2);
    // 7. Other units cannot mark.
    m = setup();
    m.units.push(rec('fangReaver', 'rv', 'blue', 1, 1));
    assert.equal(m.apply({ type: 'mark', faction: 'blue', unitId: 'rv', targetId: 'near' }).reason, 'no-mark-ability');
  });
});

test('Blood Challenge: an Advance Dreg heads for the marked enemy even when a nearer one exists', () => {
  withFang(() => {
    const d = dreg('blue', 5, 5, { ...SURE, stance: 'advance', energy: 4, selectedAbilities: ['bloodChallenge'] });
    const m = createMatch({ seed: 2, roster: [d, dummy('near', 'red', 5, 3), dummy('mark', 'red', 5, 9), far(), farRed()], champions: { blue: 'dreg' } });
    m.apply({ type: 'mark', faction: 'blue', unitId: 'dreg', targetId: 'mark' });
    const res = m.resolveRound();
    const move = res.batches.find((b) => b.type === 'movement').events.find((e) => e.unitId === 'dreg');
    assert.equal(move.type, 'move');
    assert.ok(move.to.r > 5, 'moved south toward the marked enemy, away from the nearer one');
  });
});

test("Warlord's Rush (Dreg): +3 damage, ignores 3 Defense; needs Advance, movement and a target", () => {
  withFang(() => {
    const play = (at, stance) => {
      const d = dreg('blue', at[0], at[1], { ...SURE, stance, energy: 4, selectedAbilities: ['warlordsRush'] });
      const m = createMatch({ seed: 3, roster: [d, dummy('d', 'red', 8, 5), far(), farRed()], champions: { blue: 'dreg' } });
      const res = m.resolveRound();
      return { ev: abilityEvents(res).find((e) => e.abilityId === 'warlordsRush'), s: strikeBy(res, 'dreg'), base: expected(d, m.byId('d'), [m.byId('dreg').c, m.byId('dreg').r]) };
    };
    const ok = play([5, 5], 'advance');
    assert.equal(ok.ev.applied, true);
    assert.equal(ok.s.damage, ok.base + WF.WARLORDS_RUSH.damage + WF.WARLORDS_RUSH.ignoreDefense);
    assert.equal(play([7, 5], 'advance').ev.reason, 'movement-trigger-unmet');
    assert.equal(play([5, 5], 'hold').ev.reason, 'stance-trigger-unmet');
  });
});

test('spells (existing shapes): War Cry +15 hit, Blood Oath +3 damage, Hunt ignores 2 Defense; priced and rarity-tagged', () => {
  withFang(() => {
    const spell = (id) => SPELL_CATALOG[id];
    assert.deepEqual(['warCry', 'bloodOath', 'hunt'].map((id) => [spell(id).cost, spell(id).target, spell(id).effect.type]), [[1, 'friendly-unit', 'status'], [2, 'friendly-unit', 'status'], [1, 'friendly-unit', 'status']]);
    const cast = (id) => {
      const u = rec('fangReaver', 'r', 'blue', 5, 5);
      const res = resolveQueuedSpells({ queuedSpells: [{ queueId: 'q', spellId: id, target: { kind: 'unit', faction: 'friendly', unitId: 'r' }, committed: true }] }, [u], { friendlyFaction: 'blue' });
      return { unit: res.units[0], event: res.events[0] };
    };
    assert.equal(cast('warCry').unit.statuses.hitBonus, 15);
    assert.equal(cast('bloodOath').unit.statuses.damageDealt, 3);
    assert.equal(cast('hunt').unit.statuses.ignoreDefense, 2);
    // End to end through the match: queued with a Supply payment, applied before the battle, cleared after it.
    const battle = (id) => {
      const reaver = rec('fangReaver', 'r', 'blue', 6, 5, { ...SURE, stance: 'hold' });
      const m = createMatch({ seed: 4, roster: [reaver, dummy('d', 'red', 7, 5), far(), farRed()] });
      const card = { ...structuredClone(cardFor(id)), instanceId: `card-test-${id}` };
      m.sides.blue.cards.hand.push(card);
      const supply = m.sides.blue.cards.supply;
      assert.equal(m.apply({ type: 'spell', faction: 'blue', cardId: card.instanceId, unitId: 'r' }).ok, true);
      assert.equal(m.sides.blue.cards.supply, supply - card.cost);
      const res = m.resolveRound();
      assert.equal(res.batches.find((b) => b.type === 'spells').events[0].applied, true);
      for (const k of ['hitBonus', 'damageDealt', 'ignoreDefense']) assert.equal(m.byId('r').statuses[k], undefined, `${k} cleared`);
      return { s: strikeBy(res, 'r'), base: expected(reaver, m.byId('d')) };
    };
    const oath = battle('bloodOath'), hunt = battle('hunt');
    assert.equal(oath.s.damage, oath.base + 3);
    assert.equal(hunt.s.damage, hunt.base + 2);
    // War Cry raises the hit chance: with the same seed a hit without it is still a hit with it, and some seeds turn a miss into a hit.
    let gained = 0;
    for (let seed = 1; seed <= 60; seed += 1) {
      const run = (cry) => {
        const a = rec('fangReaver', 'r', 'blue', 6, 5, { skl: 0, stance: 'hold' });
        const m = createMatch({ seed, roster: [a, dummy('d', 'red', 7, 5, { skl: 40, spd: 2 }), far(), farRed()] });
        if (cry) { const card = { ...structuredClone(cardFor('warCry')), instanceId: 'card-cry' }; m.sides.blue.cards.hand.push(card); m.apply({ type: 'spell', faction: 'blue', cardId: card.instanceId, unitId: 'r' }); }
        return strikeBy(m.resolveRound(), 'r').hit;
      };
      const [without, withCry] = [run(false), run(true)];
      assert.ok(withCry || !without, `seed ${seed}: War Cry never loses a hit`);
      if (withCry && !without) gained += 1;
    }
    assert.ok(gained > 0, 'War Cry turned at least one miss into a hit in 60 seeds');
    assert.equal(cardFor('warCry').rarity, 'common');
    assert.equal(cardFor('bloodOath').rarity, 'common');
    assert.equal(cardFor('hunt').rarity, 'uncommon');
  });
});

test('rarity gate: commons only before round 3, Axeguard and Hunt from round 3, Berserker from round 6', () => {
  withFang(() => {
    setRarityGate({ uncommon: 3, rare: 6 });
    const kinds = (round) => { const seen = new Set(); for (let seed = 1; seed <= 60; seed += 1) for (const c of drawCards(createCardState({ pool: culturePool('fang'), round }), seededRandom(seed), 8).state.hand) seen.add(c.unitId || c.id); return seen; };
    for (const round of [1, 2]) {
      const seen = kinds(round);
      for (const key of ['fangAxeguard', 'fangBerserker', 'spell-hunt']) assert.equal(seen.has(key), false, `${key} not drawable in round ${round}`);
      for (const key of ['fangReaver', 'fangHunter', 'cavalier', 'spell-warCry', 'spell-bloodOath']) assert.ok(seen.has(key), `${key} drawable in round ${round}`);
    }
    for (const round of [3, 4, 5]) { const seen = kinds(round); assert.ok(seen.has('fangAxeguard') && seen.has('spell-hunt'), `round ${round}`); assert.equal(seen.has('fangBerserker'), false, `no Berserker in round ${round}`); }
    assert.ok(kinds(6).has('fangBerserker'));
    setRarityGate({});
    assert.deepEqual(RARITY_GATE, {});
  });
});

test('engine observation: +1 Mov does not change a Reaver\'s Advance movement (2/3 rule); +2 does', () => {
  withFang(() => {
    const pike = createRecruitUnit('pikeman', 'p', 'blue', 1, 1, { stance: 'advance' });
    const reaver = createRecruitUnit('fangReaver', 'r', 'blue', 1, 1, { stance: 'advance' });
    assert.equal(reaver.mov, pike.mov + 1);
    assert.equal(battleMovement(reaver), battleMovement(pike), 'round(5 * 2/3) = round(4 * 2/3) = 3');
    assert.equal(battleMovement({ ...reaver, stance: 'hold' }), 0);
    assert.equal(battleMovement({ ...reaver, mov: pike.mov + 2 }), battleMovement(pike) + 1);
  });
  resetCultures();
  registerCulture(buildWhiteFang({ reaverMovDelta: 2 }));
  try { assert.equal(createRecruitUnit('fangReaver', 'r', 'blue', 1, 1).mov, P.mov + 2); } finally { resetCultures(); }
});

test('sensitivity option: the axe weapon triangle can be switched on and off', () => {
  registerCulture(buildWhiteFang({ weaponKind: 'axe' }));
  try {
    const reaver = createRecruitUnit('fangReaver', 'r', 'blue', 4, 4);
    const pike = createRecruitUnit('pikeman', 'p', 'red', 5, 4);
    assert.equal(forecast(reaver, pike, [4, 4]).atk.tri, 1, 'axe beats the Pikeman\'s lance');
  } finally { resetCultures(); }
});

test('a clan match plays end to end with per-side pools, recruits every clan card, and replays deterministically', () => {
  withFang(() => {
    setRarityGate({ uncommon: 3, rare: 6 });
    const log = memoryLog();
    const opts = matchOptions('fang', 'base');
    const m = createMatch({ seed: 7, maxRounds: 14, log: log.push, meta: { kinds: { blue: 'fang', red: 'base' } }, ...opts });
    assert.equal(m.champion('blue'), 'dreg');
    assert.equal(m.champion('red'), 'brenna');
    assert.deepEqual(m.alive('blue').map((u) => u.cls).sort(), ['archer', 'cavalier', 'fangReaver', 'fangReaver', 'barbarian'].sort());
    assert.ok(m.summary('blue').hand.filter((id) => !id.startsWith('shard-')).every((id) => ['unit-fangReaver', 'unit-fangHunter', 'unit-cavalier', 'spell-warCry', 'spell-bloodOath', 'spell-mend', 'spell-ward', 'spell-fireburst'].includes(id)), `round-1 hand ${m.summary('blue').hand}`);
    const seen = new Set();
    while (!m.over) {
      runFang(m, 'blue');
      runCommander(m, 'red', 'heuristic');
      for (const u of m.alive('blue')) seen.add(u.variantId ?? u.cls);
      m.resolveRound();
    }
    assert.ok(seen.has('fangReaver'));
    assert.deepEqual(log.entries[0].cultures, ['fang']);
    assert.deepEqual(log.entries[0].champions, { blue: 'dreg', red: 'brenna' });
    assert.deepEqual(log.entries[0].rarityGate, { uncommon: 3, rare: 6 });
    const check = replay(log.entries, { create: (h, push) => { setRarityGate(h.rarityGate || {}); return createMatch({ seed: h.seed, maxRounds: h.maxRounds, log: push, ...matchOptions(h.kinds.blue, h.kinds.red) }); } });
    assert.equal(check.ok, true, JSON.stringify(check.mismatches?.slice(0, 1)));
  });
});

test('every clan card can be recruited, deployed and keeps its identity; withdrawing a clan unit keeps its passives', () => {
  withFang(() => {
    const m = createMatch({ seed: 9, pools: { blue: culturePool('fang') } });
    const put = (key) => {
      const card = { ...structuredClone(cardFor(key)), instanceId: `card-x-${key}` };
      m.sides.blue.cards.hand.push(card);
      m.sides.blue.cards.supply = 6;
      const r = m.apply({ type: 'recruit', faction: 'blue', cardId: card.instanceId });
      assert.equal(r.ok, true, `${key}: ${r.reason}`);
      const tile = m.deploymentTiles('blue').find(([c, rr]) => !m.unitAt(c, rr));
      const d = m.apply({ type: 'deploy', faction: 'blue', reserveId: r.reserveId, c: tile[0], r: tile[1] });
      assert.equal(d.ok, true, `${key}: ${d.reason}`);
      return m.byId(d.unitId);
    };
    const reaver = put('fangReaver'), guard = put('fangAxeguard'), bers = put('fangBerserker'), hunter = put('fangHunter');
    assert.deepEqual([reaver.cls, guard.cls, bers.cls, hunter.cls], ['fangReaver', 'fangAxeguard', 'fangBerserker', 'archer']);
    assert.deepEqual([reaver.stance, guard.stance, bers.stance, hunter.stance], ['advance', 'advance', 'advance', 'advance']);
    assert.deepEqual([reaver.passives[0].id, guard.passives[0].id, bers.passives[0].id, hunter.passives[0].id], ['momentum', 'bloodiedGrit', 'lastFang', 'runningShot']);
    assert.equal(hunter.variantId, 'fangHunter');
    assert.equal(hunter.maxHp, A.hp - 2);
    // Withdraw and redeploy: identity, stats and passives survive the bench round trip.
    for (const u of [hunter, bers]) {
      const before = { cls: u.cls, maxHp: u.maxHp, str: u.str, passives: JSON.stringify(u.passives), variantId: u.variantId, weapon: u.weapon };
      const w = m.apply({ type: 'withdraw', faction: 'blue', unitId: u.id });
      assert.equal(w.ok, true, w.reason);
      const tile = m.deploymentTiles('blue').find(([c, rr]) => !m.unitAt(c, rr));
      const d = m.apply({ type: 'deploy', faction: 'blue', reserveId: w.reserveId, c: tile[0], r: tile[1] });
      assert.equal(d.ok, true, d.reason);
      const back = m.byId(d.unitId);
      assert.deepEqual({ cls: back.cls, maxHp: back.maxHp, str: back.str, passives: JSON.stringify(back.passives), variantId: back.variantId, weapon: back.weapon }, before);
    }
  });
});

test('the clan commander uses the kit: Reaving Rush, Blood Challenge with a mark, a clan spell, and never Hold', () => {
  withFang(() => {
    const m = createMatch({ seed: 12, ...matchOptions('fang', 'base') });
    // Put the armies near each other so every kit ability is in reach.
    m.byId('dreg').c = 6; m.byId('dreg').r = 5; m.byId('dreg').energy = 4;
    for (const u of m.alive('red')) { u.c = 10 + (u.c % 3); u.r = 4 + (u.r % 3); }
    const logged = [];
    const orig = m.apply;
    m.apply = (a, actor) => { logged.push(a); return orig(a, actor); };
    runFang(m, 'blue');
    assert.ok(logged.some((a) => a.type === 'mark' && a.unitId === 'dreg'), 'Dreg marks a target');
    assert.ok(m.byId('dreg').selectedAbilities.includes('bloodChallenge'));
    assert.ok(m.alive('blue').every((u) => u.stance === 'advance'), 'no Hold, no Protect');
    m.apply = orig;
  });
});

test('a variant card\'s defaultStance reaches the deployed unit (engine fixed on faction_overhaul; the Fang Hunter workaround is now redundant)', () => {
  const probe = { id: 'probe', variants: { probeArcher: { base: 'archer', name: 'Probe', delta: {}, card: { rarity: 'common', defaultStance: 'advance' } } } };
  const deploy = () => {
    const m = createMatch({ seed: 9, pools: { blue: ['probeArcher'] } });
    const card = { ...structuredClone(cardFor('probeArcher')), instanceId: 'card-probe' };
    m.sides.blue.cards.hand.push(card);
    const r = m.apply({ type: 'recruit', faction: 'blue', cardId: card.instanceId });
    const tile = m.deploymentTiles('blue').find(([c, rr]) => !m.unitAt(c, rr));
    return m.byId(m.apply({ type: 'deploy', faction: 'blue', reserveId: r.reserveId, c: tile[0], r: tile[1] }).unitId);
  };
  registerCulture(probe);
  try {
    assert.equal(unitCardFor('probeArcher').defaultStance, 'advance');
    // Expected 'advance'; the engine deploys 'hold' because the reserve record carries the graded Archer template's stance. If this
    // assertion starts failing the engine was fixed: delete `stats: { stance: 'advance' }` from the Fang Hunter and this test.
    assert.equal(deploy().stance, 'advance');
  } finally { resetCultures(); }
  registerCulture({ ...probe, variants: { probeArcher: { ...probe.variants.probeArcher, stats: { stance: 'advance' } } } });
  try { assert.equal(deploy().stance, 'advance', 'the workaround used by the Fang Hunter'); } finally { resetCultures(); }
});

test('Dreg fielded by the Blue side respawns as Blue Dreg (with his kit) two rounds after falling', () => {
  withFang(() => {
    let respawned = null;
    for (let seed = 1; seed <= 40 && !respawned; seed += 1) {
      const d = dreg('blue', 5, 5, { hp: 1, stance: 'hold' });
      const killer = rec('pikeman', 'k', 'red', 6, 5, { stance: 'hold', str: 40, skl: 40 });
      const m = createMatch({ seed, roster: [d, killer, rec('pikeman', 'b2', 'blue', 1, 1, { stance: 'hold' }), rec('pikeman', 'r2', 'red', 14, 10, { stance: 'hold' })], champions: { blue: 'dreg' } });
      for (let i = 0; i < 5 && !m.over && !respawned; i += 1) {
        const res = m.resolveRound();
        respawned = res.batches.find((b) => b.type === 'results').events.find((e) => e.type === 'respawn') || null;
        if (respawned) {
          assert.equal(respawned.unitId, 'dreg');
          assert.equal(m.byId('dreg').faction, 'blue');
          assert.equal(m.byId('dreg').hp, m.byId('dreg').maxHp);
          assert.deepEqual(kitFor(m.byId('dreg')).map((a) => a.id).sort(), ['bloodChallenge', 'warlordsRush']);
          assert.deepEqual(m.byId('dreg').selectedAbilities, [], 'a respawned champion has no picks');
        }
      }
    }
    assert.ok(respawned, 'Dreg respawned in the seed sweep');
  });
});

// Ability kits are off in the shipped game (Shards replaced them); this file exercises the kits, so it opts in.
import { setAbilitiesEnabled } from '../src/abilities.js';
setAbilitiesEnabled(true);
