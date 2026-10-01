// Differential tests for the static catalogues: weapons, classes, heroes, categories, monsters,
// shards, cards, missions and faction menu metadata must equal the legacy modules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS as LEGACY_WEAPONS } from '../../legacy/src/combat.js';
import { RECRUIT, UNITS } from '../../legacy/src/roster.js';
import { MOVE_TYPE } from '../../legacy/src/rules.js';
import { CATEGORIES as LEGACY_CATEGORIES, CATEGORY_IDS as LEGACY_CATEGORY_IDS, CLASS_META } from '../../legacy/src/categories.js';
import { MONSTERS as LEGACY_MONSTERS } from '../../legacy/src/monsters.js';
import * as legacyShards from '../../legacy/src/shards.js';
import {
  UNIT_CARDS as LEGACY_UNIT_CARDS, SPELL_CARDS as LEGACY_SPELL_CARDS, SKILL_CARDS as LEGACY_SKILL_CARDS,
  RECRUITMENT_POOL as LEGACY_POOL, DEFAULT_CARD_LIMITS as LEGACY_LIMITS,
} from '../../legacy/src/cards.js';
import { CAMPAIGN_LEVELS as LEGACY_LEVELS, campaignEnemyFactions as legacyEnemyFactions } from '../../legacy/src/campaign.js';
import { FACTIONS as LEGACY_FACTIONS, RARITY_GATE as LEGACY_GATE } from '../../legacy/src/setup.js';
import { STAR_STAT_GROWTH as LEGACY_GROWTH, UPGRADE_POPULATION_BY_STARS as LEGACY_POPULATION, UPGRADE_MAX_STARS as LEGACY_MAX } from '../../legacy/src/upgrades.js';
import { ABILITIES as LEGACY_ABILITIES, SPELLS as LEGACY_SPELLS } from '../../legacy/src/abilities.js';

import { WEAPONS, WEAPON_TRIANGLE, triangleBonus, FALLBACK_WEAPON } from '../../src/core/content/weapons.js';
import { RECRUIT_CLASSES, BASE_MOVE_TYPES, BASE_CLASS_META } from '../../src/core/content/classes.js';
import { CATEGORIES, CATEGORY_IDS } from '../../src/core/content/categories.js';
import { MONSTERS } from '../../src/core/content/monsters.js';
import * as shards from '../../src/core/content/shards.js';
import { UNIT_CARDS, SPELL_CARDS, SKILL_CARDS, RECRUITMENT_POOL, DEFAULT_CARD_LIMITS } from '../../src/core/content/cards.js';
import { CAMPAIGN_LEVELS, CAMPAIGN_BY_ID, campaignEnemyFactions } from '../../src/core/content/missions.js';
import { FACTIONS, FACTION_IDS, RARITY_GATE } from '../../src/core/content/factions/index.js';
import { STAR_STAT_GROWTH, UPGRADE_POPULATION_BY_STARS, UPGRADE_MAX_STARS } from '../../src/core/content/grades.js';
import { SHIPPED_ABILITIES, SHIPPED_SPELLS } from '../../src/core/content/abilities.js';
import { createContent } from '../../src/core/setup/content.js';

test('weapons and the weapon triangle', () => {
  assert.deepEqual(WEAPONS, LEGACY_WEAPONS);
  assert.equal(triangleBonus('sword', 'axe'), 1);
  assert.equal(triangleBonus('axe', 'sword'), -1);
  assert.equal(triangleBonus('axe', 'lance'), 1);
  assert.equal(triangleBonus('lance', 'sword'), 1);
  assert.equal(triangleBonus('bow', 'sword'), 0);
  assert.equal(triangleBonus('fang', 'fang'), 0, 'neutral kinds bypass the triangle');
  assert.deepEqual(WEAPON_TRIANGLE, { sword: 'axe', axe: 'lance', lance: 'sword' });
  assert.deepEqual(FALLBACK_WEAPON, { mt: 5, hit: 70, crit: 0, rng: [1, 1], kind: 'none' });
});

test('recruit classes, movement types and class metadata', () => {
  assert.deepEqual(RECRUIT_CLASSES, RECRUIT);
  assert.deepEqual(BASE_MOVE_TYPES, MOVE_TYPE);
  assert.deepEqual(BASE_CLASS_META, CLASS_META);
});

test('categories', () => {
  assert.deepEqual(CATEGORIES, LEGACY_CATEGORIES);
  assert.deepEqual([...CATEGORY_IDS], [...LEGACY_CATEGORY_IDS]);
});

test('starting roster equals the legacy UNITS list', () => {
  const content = createContent();
  assert.deepEqual(content.startingUnits, UNITS);
});

test('monsters', () => {
  assert.deepEqual(MONSTERS, LEGACY_MONSTERS);
  assert.deepEqual(Object.keys(MONSTERS), Object.keys(LEGACY_MONSTERS));
});

test('shard catalogue, rules and text helpers', () => {
  assert.deepEqual(shards.SHARDS, legacyShards.SHARDS);
  assert.deepEqual(shards.SHARD_RULES, legacyShards.SHARD_RULES);
  assert.deepEqual([...shards.SHARD_IDS], [...legacyShards.SHARD_IDS]);
  assert.deepEqual(shards.SHARD_CARDS, legacyShards.SHARD_CARDS);
  assert.deepEqual([...shards.SHARD_TIER_LABELS], [...legacyShards.SHARD_TIER_LABELS]);
  assert.deepEqual([...shards.SHARD_STAT_KEYS], [...legacyShards.SHARD_STAT_KEYS]);
  assert.deepEqual([...shards.SHARD_EFFECT_KEYS], [...legacyShards.SHARD_EFFECT_KEYS]);
  for (const id of [...shards.SHARD_IDS, 'nope']) {
    for (const tier of [0, 1, 2, 3, 4]) {
      assert.equal(shards.shardValue(id, tier), legacyShards.shardValue(id, tier));
      assert.equal(shards.shardLabel(id, tier), legacyShards.shardLabel(id, tier));
      assert.equal(shards.shardEffectText(id, tier), legacyShards.shardEffectText(id, tier));
    }
  }
});

test('card catalogue, shared pool and economy limits', () => {
  assert.deepEqual(UNIT_CARDS, LEGACY_UNIT_CARDS);
  assert.deepEqual(SPELL_CARDS, LEGACY_SPELL_CARDS);
  assert.deepEqual(SKILL_CARDS, LEGACY_SKILL_CARDS);
  assert.deepEqual([...RECRUITMENT_POOL], [...LEGACY_POOL]);
  assert.deepEqual(DEFAULT_CARD_LIMITS, LEGACY_LIMITS);
  assert.equal(RECRUITMENT_POOL.length, 20);
});

test('card lookup priority: unit, spell, shard, skill', () => {
  const content = createContent();
  for (const key of ['pikeman', 'archer', 'cavalier', 'mend', 'ward', 'fireburst', 'ruby', 'onyx', 'barrier', 'nothing']) {
    const expected = LEGACY_UNIT_CARDS[key] ?? LEGACY_SPELL_CARDS[key] ?? legacyShards.SHARD_CARDS[key] ?? LEGACY_SKILL_CARDS[key] ?? null;
    assert.deepEqual(content.cardFor(key), expected, key);
  }
  assert.equal(content.unitCardFor('mend'), null);
  assert.equal(content.skillCardFor('barrier').id, 'skill-barrier');
});

test('star grades', () => {
  assert.deepEqual(STAR_STAT_GROWTH, LEGACY_GROWTH);
  assert.deepEqual(UPGRADE_POPULATION_BY_STARS, LEGACY_POPULATION);
  assert.equal(UPGRADE_MAX_STARS, LEGACY_MAX);
});

test('shipped ability and spell catalogue records', () => {
  for (const [id, ability] of Object.entries(LEGACY_ABILITIES)) assert.deepEqual(SHIPPED_ABILITIES[id], ability);
  assert.deepEqual(Object.keys(SHIPPED_ABILITIES), Object.keys(LEGACY_ABILITIES));
  assert.deepEqual(SHIPPED_SPELLS, LEGACY_SPELLS);
});

test('missions and the seeded foe selection', () => {
  assert.deepEqual(CAMPAIGN_LEVELS, LEGACY_LEVELS);
  assert.deepEqual(Object.keys(CAMPAIGN_BY_ID), ['road', 'woods', 'pass']);
  for (const level of LEGACY_LEVELS) {
    for (const faction of FACTION_IDS) {
      for (const seed of [0, 1, 2, 3, 7, 11, 19, 100, 0x415348, 0xffffffff]) {
        assert.deepEqual(
          campaignEnemyFactions(CAMPAIGN_BY_ID[level.id], faction, seed, FACTION_IDS),
          legacyEnemyFactions(level, faction, seed),
          `${level.id} ${faction} ${seed}`,
        );
      }
    }
  }
});

test('faction menu metadata equals legacy setup.js FACTIONS', () => {
  assert.deepEqual(RARITY_GATE, LEGACY_GATE);
  assert.deepEqual(FACTIONS.map((f) => f.id), LEGACY_FACTIONS.map((f) => f.id));
  for (const legacy of LEGACY_FACTIONS) {
    const mine = FACTIONS.find((f) => f.id === legacy.id);
    for (const field of ['name', 'tagline', 'traits', 'color', 'accent', 'culture', 'core', 'champion']) {
      assert.deepEqual(mine[field], legacy[field], `${legacy.id}.${field}`);
    }
  }
});
