// Differential tests for culture registration: after legacy `prepareFactions(ids)` the legacy globals
// must hold exactly what `createContentForFactions(ids)` holds in its context.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RECRUIT, VARIANTS, CHAMPION_TEMPLATES } from '../../legacy/src/roster.js';
import { WEAPONS } from '../../legacy/src/combat.js';
import { MOVE_TYPE } from '../../legacy/src/rules.js';
import { CLASS_META, categoryOf as legacyCategoryOf, metaOf as legacyMetaOf, categoryName as legacyCategoryName } from '../../legacy/src/categories.js';
import { CULTURES, SPRITE_FALLBACK, culturePool } from '../../legacy/src/cultures.js';
import { cardFor, unitCardFor, skillCardFor, RARITY_GATE, rarityGateActive } from '../../legacy/src/cards.js';
import { ABILITY_CATALOG, SPELL_CATALOG } from '../../legacy/src/abilities.js';
import { FACTIONS } from '../../legacy/src/setup.js';
import { forEachFactionSet } from './legacy.mjs';

test('registered tables equal the legacy globals for every faction set', () => {
  forEachFactionSet((ids, content) => {
    const label = `[${ids}]`;
    assert.deepEqual(content.recruitClasses, RECRUIT, `${label} recruit classes`);
    assert.deepEqual(content.variants, VARIANTS, `${label} variants`);
    assert.deepEqual(content.championTemplates, CHAMPION_TEMPLATES, `${label} champion templates`);
    assert.deepEqual(content.weapons, WEAPONS, `${label} weapons`);
    assert.deepEqual(content.moveTypes, MOVE_TYPE, `${label} move types`);
    assert.deepEqual(content.classMeta, CLASS_META, `${label} class meta`);
    assert.deepEqual(content.spriteFallback, SPRITE_FALLBACK, `${label} sprite fallback`);
    assert.deepEqual(content.abilities, ABILITY_CATALOG, `${label} abilities`);
    assert.deepEqual(content.spells, SPELL_CATALOG, `${label} spells`);
    assert.deepEqual(content.rarityGate, { ...RARITY_GATE }, `${label} rarity gate`);
    assert.equal(content.rarityGateActive(), rarityGateActive(), `${label} gate active`);
    assert.deepEqual(content.cultureIds, Object.keys(CULTURES), `${label} culture ids`);
  });
});

test('culture records, cards and pools equal legacy', () => {
  forEachFactionSet((ids, content) => {
    for (const [id, legacyRecord] of Object.entries(CULTURES)) {
      const { def, ...legacyIds } = legacyRecord;
      const { def: myDef, ...myIds } = content.cultures[id];
      assert.deepEqual(myIds, legacyIds, `${id} record`);
      assert.deepEqual(content.poolFor(id), culturePool(id), `${id} pool`);
      assert.equal(myDef.id, def.id);
      for (const key of legacyRecord.cards) {
        assert.deepEqual(content.cardFor(key), cardFor(key), `${id} card ${key}`);
        assert.deepEqual(content.unitCardFor(key), unitCardFor(key), `${id} unit card ${key}`);
      }
      // Every key a culture pool names resolves to the same card (or none) in both.
      for (const key of content.poolFor(id)) assert.deepEqual(content.cardFor(key), cardFor(key), `${id} pool ${key}`);
    }
    assert.deepEqual(content.poolFor('missing'), culturePool('missing'));
    assert.equal(content.skillCardFor('barrier')?.id, skillCardFor('barrier')?.id);
    assert.equal(content.skillCardFor('nothing'), skillCardFor('nothing'));
  });
});

test('category and weapon lookups agree for every class, variant and champion', () => {
  forEachFactionSet((ids, content) => {
    const keys = [...Object.keys(content.recruitClasses), ...Object.keys(content.variants), ...Object.keys(content.championTemplates), 'nothing'];
    for (const key of keys) {
      assert.equal(content.categoryOf(key), legacyCategoryOf(key), `${key} category`);
      assert.deepEqual(content.metaOf(key), legacyMetaOf(key), `${key} meta`);
      assert.equal(content.categoryName(key), legacyCategoryName(key), `${key} category name`);
    }
    for (const id of ['brenna', 'dreg', ...Object.keys(content.championTemplates)]) {
      const unit = content.championTemplates[id] ?? content.startingUnits.find((u) => u.id === id);
      assert.equal(content.categoryOf(unit), legacyCategoryOf(unit), `${id} unit category`);
    }
    for (const [key, template] of Object.entries(content.recruitClasses)) {
      assert.equal(content.categoryOf({ cls: key, variantId: key }), legacyCategoryOf({ cls: key, variantId: key }), key);
      assert.deepEqual(content.weaponOf({ weapon: template.weapon }), WEAPONS[template.weapon], `${key} weapon`);
    }
    assert.equal(content.categoryOf({ cls: 'cavalier', variantId: 'mourningKnight' }), legacyCategoryOf({ cls: 'cavalier', variantId: 'mourningKnight' }));
  });
});

test('class and weapon facts the legacy tests assert', () => {
  const crown = FACTIONS.find((f) => f.id === 'crown');
  assert.equal(crown.culture, 'crown');
  forEachFactionSet((ids, content) => {
    if (ids.length !== 4) return;
    assert.equal(content.categoryOf('battleCleric'), 'support');
    assert.equal(content.categoryOf('fangShaman'), 'caster');
    assert.equal(content.categoryOf('wolfRider'), 'mounted');
    assert.equal(content.categoryOf('artificer'), 'caster');
    assert.equal(content.categoryOf('dragoon'), 'mounted');
    assert.equal(content.categoryOf('sapper'), 'support');
    assert.equal(content.categoryOf('necromancer'), 'support');
    assert.equal(content.categoryOf('wraith'), 'caster');
    assert.equal(content.categoryOf({ cls: 'cavalier', variantId: 'mourningKnight' }), 'mounted', 'a variant inherits its base class category');
    assert.equal(content.moveTypeOf('relicWalker'), 'armor');
    assert.equal(content.moveTypeOf('dragoon'), 'mounted');
    assert.equal(content.moveTypeOf('wolfRider'), 'mounted');
    assert.equal(content.moveTypeOf({ cls: 'fangReaver' }), 'foot');
    assert.equal(content.moveTypeOf({ cls: 'paladin' }), 'armor');
    assert.equal(content.moveTypeOf('nothing'), 'foot');
  });
});
