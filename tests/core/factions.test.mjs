// Rule checks for the faction content (ported from the data assertions of the legacy faction tests):
// unit sheets, cards, rarities, pools, champions, ablation options and kit scoping.
import test from 'node:test';
import assert from 'node:assert/strict';
import { kitFor as legacyKitFor } from '../../legacy/src/abilities.js';
import { RECRUIT } from '../../legacy/src/roster.js';
import { createContentForFactions, createContent } from '../../src/core/setup/content.js';
import ARGENT_CROWN from '../../src/core/content/factions/argent-crown.js';
import { buildWhiteFang, WAR_CRY, BLOOD_OATH, HUNT } from '../../src/core/content/factions/white-fang.js';
import IRON_LEAGUE, { DEFAULT_LEAGUE_CHAMPION } from '../../src/core/content/factions/iron-league.js';
import { buildHollowCourt, COURT, COURT_POOL, COURT_RARITY, COURT_CHAMPIONS, DEFAULT_CHAMPION } from '../../src/core/content/factions/hollow-court.js';
import { forecast } from '../../src/core/rules/forecast.js';
import { createBoard } from '../../src/core/rules/board.js';
import { RIVER_FORD } from '../../src/core/content/maps/index.js';
import { forEachFactionSet } from './legacy.mjs';

const P = RECRUIT.pikeman;
const A = RECRUIT.archer;
const at = (content, key, id = key) => content.createRecruitUnit(key, id, 'blue', 4, 4);
const ids = (list) => list.map((a) => a.id).sort();

test('kitFor equals legacy kitFor for every unit of every faction set', () => {
  forEachFactionSet((setIds, content) => {
    const units = [
      ...content.startingUnits,
      ...Object.keys(content.recruitClasses).map((key) => at(content, key)),
      ...Object.keys(content.variants).map((key) => at(content, key)),
      ...Object.keys(content.championTemplates).map((id) => content.createChampionUnit(id, 'blue', 1, 1)),
    ];
    for (const unit of units) {
      assert.deepEqual(content.kitFor(unit).map((a) => a.id), legacyKitFor(unit).map((a) => a.id), `[${setIds}] ${unit.id} ${unit.cls}`);
    }
  });
});

test('Argent Crown: definition shape, cards, pool, rarity and unit templates', () => {
  const content = createContentForFactions(['crown']);
  assert.equal(ARGENT_CROWN.id, 'crown');
  assert.deepEqual(Object.keys(ARGENT_CROWN.classes).sort(), ['bannerman', 'battleCleric', 'oathsworn']);
  assert.deepEqual(Object.keys(ARGENT_CROWN.variants).sort(), ['crownArcher', 'crownCavalier', 'crownGuard', 'crownPike']);
  assert.deepEqual(Object.keys(ARGENT_CROWN.champions).sort(), ['brennaCrown', 'brennaCrownB']);
  const expected = {
    crownPike: ['common', 1], crownArcher: ['common', 2], crownCavalier: ['common', 3], crownGuard: ['common', 2],
    bannerman: ['uncommon', 2], oathsworn: ['rare', 3], battleCleric: ['uncommon', 3], rallyBanner: ['common', 1],
  };
  for (const [key, [rarity, cost]] of Object.entries(expected)) {
    const card = content.cardFor(key);
    assert.deepEqual([card.rarity, card.cost, card.culture], [rarity, cost, 'crown'], key);
  }
  const pool = content.poolFor('crown');
  assert.deepEqual([...new Set(pool)].filter((k) => !expected[k]).sort(), ['fireburst', 'mend', 'ward'], 'only the shared spells are non-Crown');
  assert.equal(pool.includes('barrier'), false);
  assert.equal(pool.filter((k) => k === 'oathsworn').length, 1);
  assert.ok(pool.filter((k) => k === 'crownPike').length > pool.filter((k) => k === 'crownCavalier').length);
  assert.equal(content.unitCardFor('crownGuard').defaultStance, 'hold');
  assert.equal(content.unitCardFor('crownArcher').defaultStance, 'hold', 'the archer variant keeps the archer default');
  assert.equal(content.unitCardFor('crownCavalier').defaultStance, 'advance');

  for (const [key, baseKey] of [['crownPike', 'pikeman'], ['crownArcher', 'archer'], ['crownCavalier', 'cavalier']]) {
    const unit = at(content, key);
    const base = at(content, baseKey);
    assert.equal(unit.cls, baseKey);
    assert.equal(unit.variantId, key);
    for (const stat of ['maxHp', 'str', 'skl', 'spd', 'def', 'mov', 'weapon']) assert.equal(unit[stat], base[stat], `${key} ${stat}`);
    assert.deepEqual(unit.passives.map((p) => p.id), ['lineDoctrine']);
    assert.equal(base.passives, undefined, 'plain classes are untouched');
  }
  const guard = at(content, 'crownGuard');
  const banner = at(content, 'bannerman');
  const oath = at(content, 'oathsworn');
  assert.deepEqual([guard.cls, guard.maxHp, guard.str, guard.def, guard.mov, guard.stance], ['pikeman', P.hp + 2, P.str, P.def + 1, P.mov - 1, 'hold']);
  assert.deepEqual([banner.cls, banner.maxHp, banner.str, banner.stance], ['bannerman', P.hp - 4, P.str - 3, 'hold']);
  assert.deepEqual([oath.cls, oath.maxHp, oath.def], ['oathsworn', P.hp + 4, P.def + 3]);
  assert.deepEqual(guard.passives.map((p) => p.id), ['lineDoctrine', 'shieldwall']);
  assert.deepEqual(oath.passives.map((p) => p.id), ['lineDoctrine', 'swornGuard', 'swornGuardCost']);
  for (const key of ['crownGuard', 'bannerman', 'oathsworn']) assert.equal(content.spriteFallback[key].base, 'pikeman');
  assert.ok(ids(content.kitFor(guard)).includes('rally'), 'a Crown Guard keeps the Pikeman kit');
  assert.equal(content.kitFor(banner).some((a) => a.id === 'rally'), false, 'new classes have no Rally');
});

test('Argent Crown champion: shipped body, passives, kit scoping and respawn on either side', () => {
  const content = createContentForFactions(['crown']);
  const shipped = content.startingUnits.find((u) => u.id === 'brenna');
  const brenna = content.createChampionUnit('brennaCrown', 'blue', 5, 9);
  for (const stat of ['maxHp', 'str', 'skl', 'spd', 'def', 'mov', 'weapon', 'cls']) assert.equal(brenna[stat], shipped[stat], stat);
  assert.equal(brenna.champion, true);
  assert.deepEqual(brenna.passives.map((p) => p.id), ['lineDoctrine', 'crownPresence']);
  for (const id of ['brenna', 'brennaCrown', 'brennaCrownB']) {
    assert.deepEqual(ids(content.kitFor({ id, cls: 'paladin' })), ['bulwarkOfTheRealm', 'oathkeepersStrike'], id);
  }
  assert.equal(content.kitFor({ id: 'dreg', cls: 'barbarian' }).length, 0, 'Dreg is unaffected');
  assert.deepEqual(content.createHeroRespawnData('brennaCrown', 5, 9).passives.map((p) => p.id), ['lineDoctrine', 'crownPresence']);
  assert.equal(content.createChampionUnit('brennaCrownB', 'red', 5, 5).faction, 'red');
  assert.equal(content.championTemplates.brennaCrown.passives.length, 2);
});

test('White Fang: units, weapons, cards, pool and the blue Dreg', () => {
  const content = createContentForFactions(['fang']);
  const [reaver, axeguard, berserker, hunter] = ['fangReaver', 'fangAxeguard', 'fangBerserker', 'fangHunter'].map((key) => at(content, key));
  assert.deepEqual([reaver.cls, reaver.maxHp, reaver.str, reaver.def, reaver.mov], ['fangReaver', P.hp, P.str + 1, P.def - 2, P.mov + 1]);
  assert.deepEqual([axeguard.maxHp, axeguard.str, axeguard.def, axeguard.mov], [P.hp + 4, P.str, P.def + 1, P.mov]);
  assert.deepEqual([berserker.maxHp, berserker.str, berserker.def], [P.hp + 2, P.str + 2, P.def - 4]);
  assert.deepEqual([hunter.cls, hunter.variantId, hunter.maxHp, hunter.str, hunter.stance], ['archer', 'fangHunter', A.hp - 2, A.str + 1, 'advance']);
  for (const unit of [reaver, axeguard, berserker, hunter]) assert.equal(unit.culture, 'fang');
  for (const name of ['Fang Axe', 'Wolf-Crest Axe', 'Scarred Great Axe']) {
    assert.deepEqual(content.weapons[name], { mt: 8, hit: 75, crit: 0, rng: [1, 1], kind: 'fang' });
  }
  const board = createBoard(RIVER_FORD);
  const foe = content.createRecruitUnit('pikeman', 'p', 'red', 5, 4);
  assert.equal(forecast(reaver, foe, [4, 4], { board, content }).atk.tri, 0, 'clan axes sit outside the weapon triangle');
  assert.equal(content.moveTypeOf('fangReaver'), 'foot');
  assert.equal(content.moveTypeOf('wolfRider'), 'mounted');
  assert.deepEqual(content.spriteFallback.fangReaver, { base: 'pikeman', tint: '#B4B2AC', label: 'White Fang Reaver' });
  assert.deepEqual(content.spriteFallback.fangHunter, { base: 'archer', tint: '#8C6B4F', label: 'Fang Hunter' });

  const pool = content.poolFor('fang');
  const count = (key) => pool.filter((x) => x === key).length;
  assert.deepEqual(['fangReaver', 'fangHunter', 'cavalier', 'fangAxeguard', 'fangBerserker', 'warCry', 'bloodOath', 'hunt', 'mend', 'ward', 'fireburst'].map(count),
    [3, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(['fangReaver', 'fangHunter', 'fangAxeguard', 'fangBerserker', 'warCry', 'bloodOath', 'hunt'].map((k) => content.cardFor(k).rarity),
    ['common', 'common', 'uncommon', 'rare', 'common', 'common', 'uncommon']);
  assert.deepEqual(['fangReaver', 'fangAxeguard', 'fangBerserker', 'fangHunter'].map((k) => content.cardFor(k).cost), [1, 2, 2, 2]);
  for (const key of pool) assert.ok(content.cardFor(key), key);

  assert.deepEqual(ids(content.kitFor(reaver)), ['reavingRush']);
  assert.deepEqual(ids(content.kitFor(axeguard)), ['ironSkin']);
  assert.deepEqual(ids(content.kitFor(hunter)), ['focusedShot'], 'the Hunter keeps the archer kit');
  assert.deepEqual(ids(content.kitFor(at(content, 'pikeman'))), ['brace', 'rally'], 'plain pikemen are unchanged');
  for (const id of ['dreg', 'dregBlue']) assert.deepEqual(ids(content.kitFor({ id, cls: 'barbarian' })), ['bloodChallenge', 'warlordsRush'], id);
  assert.equal(content.kitFor({ id: 'brenna', cls: 'paladin' }).length, 0);

  const blueDreg = content.createChampionUnit('dregBlue', 'blue', 5, 9);
  assert.deepEqual([blueDreg.faction, blueDreg.cls, blueDreg.culture, blueDreg.champion], ['blue', 'barbarian', 'fang', true]);
  assert.equal(content.championFor('fang', 'blue'), 'dregBlue');
  assert.equal(content.championFor('fang', 'red'), 'dreg');

  assert.deepEqual([WAR_CRY.hit, BLOOD_OATH.damage, HUNT.ignoreDefense], [15, 3, 2]);
  const spell = (id) => content.spells[id];
  assert.deepEqual(['warCry', 'bloodOath', 'hunt'].map((id) => [spell(id).cost, spell(id).target, spell(id).effect.type]),
    [[1, 'friendly-unit', 'status'], [2, 'friendly-unit', 'status'], [1, 'friendly-unit', 'status']]);
  assert.equal(Object.keys(content.spells).some((k) => /fury|ancestor/i.test(k)), false);
});

test('White Fang sensitivity option: the axe weapon triangle can be switched on', () => {
  const content = createContent({ cultures: [buildWhiteFang({ weaponKind: 'axe' })] });
  const board = createBoard(RIVER_FORD);
  const reaver = content.createRecruitUnit('fangReaver', 'r', 'blue', 4, 4);
  const pike = content.createRecruitUnit('pikeman', 'p', 'red', 5, 4);
  assert.equal(forecast(reaver, pike, [4, 4], { board, content }).atk.tri, 1, "axe beats the Pikeman's lance");
});

test('Iron League: variants, new classes, weapons, kits, spells and champions', () => {
  const content = createContentForFactions(['league']);
  const pike = at(content, 'pikeman');
  const leaguePike = at(content, 'leaguePike');
  assert.deepEqual([leaguePike.cls, leaguePike.variantId, leaguePike.culture, leaguePike.hp, leaguePike.def, leaguePike.stance], ['pikeman', 'leaguePike', 'league', pike.hp, pike.def, 'hold']);
  const pavise = at(content, 'pavise');
  assert.deepEqual([pavise.hp, pavise.def, pavise.str, pavise.mov], [pike.hp + 1, pike.def + 2, pike.str - 2, pike.mov - 1]);
  const coil = at(content, 'coil');
  assert.deepEqual([coil.cls, coil.weapon, coil.stance], ['archer', 'Longbow', 'hold']);
  for (const key of ['leaguePike', 'pavise', 'coil', 'sapper', 'relicWalker']) assert.equal(content.unitCardFor(key).defaultStance, 'hold', key);
  assert.deepEqual(['leaguePike', 'pavise', 'coil', 'sapper', 'relicWalker'].map((k) => content.cardFor(k).rarity), ['common', 'common', 'uncommon', 'uncommon', 'rare']);
  assert.deepEqual(['fieldRepair', 'flare'].map((k) => content.cardFor(k).rarity), ['common', 'common']);
  assert.deepEqual(['setPosition', 'preparedPosition', 'arcBurst', 'digIn'].map((id) => content.abilities[id].rarity), ['common', 'uncommon', 'rare', 'uncommon']);

  const walker = at(content, 'relicWalker');
  assert.deepEqual([walker.cls, walker.hp, walker.str, walker.skl, walker.spd, walker.def, walker.mov, walker.weapon], ['relicWalker', 30, 7, 4, 2, 10, 3, 'Relic Coil']);
  assert.deepEqual(content.weapons['Relic Coil'].rng, [1, 2]);
  assert.equal(content.moveTypeOf('relicWalker'), 'armor');
  assert.deepEqual(ids(content.kitFor(walker)), ['arcBurst']);
  const sapper = at(content, 'sapper');
  assert.deepEqual([sapper.hp, sapper.stance, sapper.weapon], [20, 'hold', 'League Sapper Pick']);
  assert.equal(content.weapons['League Sapper Pick'].kind, 'pick');
  assert.deepEqual(ids(content.kitFor(sapper)), ['digIn']);
  assert.equal(content.abilities.digIn.spawn.hp, 10, 'barricade is 10 HP');

  assert.equal(DEFAULT_LEAGUE_CHAMPION, 'ilseVoss');
  assert.deepEqual(Object.keys(IRON_LEAGUE.champions), ['ilseVoss', 'tobiahKettle', 'oldSixty']);
  const kits = { ilseVoss: 'fieldWorks', tobiahKettle: 'overcharge', oldSixty: 'ironbound' };
  for (const [id, kit] of Object.entries(kits)) {
    const champion = content.createChampionUnit(id, 'blue', 5, 5);
    assert.deepEqual([champion.champion, champion.culture], [true, 'league']);
    assert.ok(champion.look?.skin);
    assert.ok(content.kitFor(champion).some((a) => a.id === kit));
    for (const other of Object.values(kits).filter((k) => k !== kit)) assert.equal(content.kitFor(champion).some((a) => a.id === other), false);
  }
  const captain = content.createChampionUnit('ilseVoss', 'blue', 5, 5);
  assert.deepEqual([captain.name, captain.cls, captain.maxHp, captain.str, captain.def, captain.mov], ['Captain Ilse Voss', 'pikeman', 30, 9, 12, 4]);
  assert.deepEqual(content.kitFor(captain).map((a) => a.id), ['rally', 'brace', 'setPosition', 'fieldWorks']);
  assert.equal(content.createChampionUnit('tobiahKettle', 'blue', 5, 5).weapon, 'Steel Bow');
  assert.equal(content.createChampionUnit('oldSixty', 'blue', 5, 5).weapon, 'Relic Coil');
  assert.deepEqual(content.kitFor(content.createChampionUnit('oldSixty', 'blue', 5, 5)).map((a) => a.id), ['arcBurst', 'ironbound']);
});

test('Hollow Court: unit sheet, cards, pool, champions and kit scoping', () => {
  const content = createContentForFactions(['court']);
  const ghoul = at(content, 'feralGhoul');
  assert.deepEqual([ghoul.cls, ghoul.name, ghoul.maxHp, ghoul.str, ghoul.def, ghoul.mov, ghoul.weapon, ghoul.culture], ['feralGhoul', 'Feral Ghoul', 16, 7, 3, 6, 'Ghoul Claws', 'court']);
  assert.deepEqual([ghoul.maxHp - P.hp, ghoul.str - P.str, ghoul.def - P.def, ghoul.mov - P.mov], [-8, -1, -6, 2]);
  assert.equal(content.unitCardFor('feralGhoul').cost, content.cardFor('pikeman').cost - 1, 'one cheaper than a Pikeman');
  const guard = at(content, 'graveguard');
  assert.deepEqual([guard.maxHp - P.hp, guard.mov, guard.weapon], [2, P.mov, 'Grave Halberd']);
  assert.equal(content.weapons['Grave Halberd'].kind, 'lance');
  const necro = at(content, 'necromancer');
  assert.deepEqual([necro.maxHp, necro.mag, necro.def, necro.weapon], [16, 2, 2, 'Lantern Staff']);
  assert.deepEqual(content.weapons['Lantern Staff'].rng, [1, 2]);
  assert.equal(content.weapons['Lantern Staff'].magic, true);
  const knight = at(content, 'mourningKnight');
  assert.deepEqual([knight.cls, knight.variantId, knight.maxHp - RECRUIT.cavalier.hp, knight.def - RECRUIT.cavalier.def], ['cavalier', 'mourningKnight', 2, 2]);
  assert.equal(content.moveTypes.mourningKnight, undefined, 'the knight rides as a plain cavalier');
  for (const [key, rarity] of Object.entries(COURT_RARITY)) assert.equal(content.cardFor(key).rarity, rarity, key);
  assert.deepEqual(content.spriteFallback.feralGhoul, { base: 'pikeman', tint: '#a5a396', label: 'Feral Ghoul' });

  const pool = content.poolFor('court');
  assert.deepEqual(pool, [...COURT_POOL]);
  for (const key of pool) assert.ok(content.cardFor(key), key);
  for (const shipped of ['pikeman', 'archer', 'cavalier', 'barrier']) assert.equal(pool.includes(shipped), false);
  assert.equal(pool.filter((k) => k === 'feralGhoul').length, 3);

  // The knight keeps the shipped cavalier kit and only that; court kits never reach shipped units.
  assert.deepEqual(ids(content.kitFor(knight)), ['charge', 'secondWind']);
  const courtKits = ['unquietStep', 'withering', 'graveRally', 'consumeRemains', 'sovereignStand', 'chancelleryAudit', 'holdBeyondDeath', 'decreeOfAttendance', 'ledgerOfTheDead'];
  for (const unit of [{ cls: 'pikeman' }, { cls: 'archer' }, { cls: 'cavalier' }, { id: 'brenna', cls: 'paladin' }, { id: 'dreg', cls: 'barbarian' }]) {
    assert.equal(content.kitFor(unit).some((a) => courtKits.includes(a.id)), false);
  }

  assert.deepEqual([...COURT_CHAMPIONS], ['hollowRegent', 'chancellor', 'marshal']);
  assert.equal(DEFAULT_CHAMPION, 'hollowRegent');
  const regent = content.createChampionUnit('hollowRegent', 'blue', 5, 5);
  assert.deepEqual([regent.champion, regent.maxHp, regent.def, regent.weapon, regent.cls], [true, COURT.regent.hp, COURT.regent.def, 'Iron Sword', 'paladin']);
  assert.deepEqual(ids(content.kitFor(regent)), ['decreeOfAttendance', 'sovereignStand']);
  const chancellor = content.createChampionUnit('chancellor', 'blue', 5, 5);
  assert.deepEqual([chancellor.cls, chancellor.weapon, chancellor.mag, chancellor.maxHp], ['necromancer', 'Lantern Staff', COURT.chancellor.mag, COURT.chancellor.hp]);
  assert.deepEqual(ids(content.kitFor(chancellor)), ['chancelleryAudit', 'consumeRemains', 'ledgerOfTheDead']);
  assert.deepEqual(ids(content.kitFor(content.createChampionUnit('marshal', 'blue', 5, 5))), ['graveRally', 'holdBeyondDeath']);
});

test('Hollow Court ablation switches keep the stats and remove exactly the death mechanics', () => {
  const off = buildHollowCourt({ corpses: false, revenant: false, consume: false, corpsePassives: false });
  const content = createContent({ cultures: [off] });
  const ghoul = at(content, 'feralGhoul');
  const knight = at(content, 'mourningKnight');
  const guard = at(content, 'graveguard');
  assert.equal(ghoul.onDeath, undefined);
  assert.equal(knight.onDeath, undefined);
  assert.deepEqual(knight.passives.map((p) => p.id), ['deathlessStand'], 'no revenant');
  assert.deepEqual(guard.passives, []);
  assert.deepEqual([ghoul.maxHp, guard.maxHp, knight.maxHp], [16, 26, 26], 'same stats');
  for (const id of ['graveRally', 'consumeRemains', 'decreeOfAttendance', 'ledgerOfTheDead']) assert.equal(content.abilities[id], undefined, id);
  assert.ok(content.abilities.unquietStep && content.abilities.withering, 'non-death skills stay');
  const regated = createContent({ cultures: [buildHollowCourt({ rarity: { graveguard: 'common' } })] });
  assert.equal(regated.cardFor('graveguard').rarity, 'common');
});

test('rarity gate: commons only before round 3, uncommon from 3, rare from 6', () => {
  const gated = createContentForFactions(['court']);
  const open = (round) => [...new Set(gated.poolFor('court'))].filter((key) => gated.rarityOpen(gated.cardFor(key)?.rarity, round));
  assert.ok(open(1).every((key) => gated.cardFor(key).rarity === 'common'));
  assert.ok(open(2).every((key) => gated.cardFor(key).rarity === 'common'));
  assert.ok(open(3).includes('graveguard') && open(3).includes('wight'));
  assert.equal(open(5).includes('mourningKnight'), false);
  assert.ok(open(6).includes('mourningKnight'));
  const classic = createContentForFactions(['classic']);
  assert.equal(classic.rarityGateActive(), false);
  assert.equal(classic.rarityOpen('rare', 1), true, 'no gate: every rarity from round 1');
  assert.equal(createContentForFactions(['court'], { gate: false }).rarityGateActive(), false);
  assert.equal(createContent({ rarityGate: { uncommon: 3 } }).rarityOpen(undefined, undefined), true, 'a missing rarity counts as common in round 1');
});
