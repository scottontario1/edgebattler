// The content context. Legacy registered weapons, classes, cards, passives and the rarity gate into
// module globals; here `createContent` builds one immutable context from a list of culture
// definitions and everything else is read through it. Two contexts with different cultures can live
// side by side in one process.
import { deepFreeze } from '../util/geometry.js';
import { WEAPONS, FALLBACK_WEAPON, WEAPON_TRIANGLE } from '../content/weapons.js';
import { CATEGORIES, CATEGORY_IDS, createCategoryLookup } from '../content/categories.js';
import { MONSTERS } from '../content/monsters.js';
import { SHARDS, SHARD_IDS, SHARD_RULES } from '../content/shards.js';
import { DEFAULT_CARD_LIMITS, RECRUITMENT_POOL, UNIT_CARDS, SPELL_CARDS, SKILL_CARDS } from '../content/cards.js';
import { SHARD_CARDS } from '../content/shards.js';
import { CAMPAIGN_LEVELS, CAMPAIGN_BY_ID, CAMPAIGN_SETUP, campaignEnemyFactions } from '../content/missions.js';
import { FACTIONS, FACTION_BY_ID, FACTION_IDS, RARITY_GATE } from '../content/factions/index.js';
import { abilityApplies } from '../content/abilities.js';
import { buildCultureTables, lookupCard } from './cultures.js';
import { createUnitConstructors } from './units.js';

/**
 * @typedef {Object} ContentOptions
 * @property {object[]} [cultures]    culture definitions to register, in order (both sides' cultures)
 * @property {Record<string, number>} [rarityGate]  { uncommon: 3, rare: 6 }: round from which that rarity is drawable
 * @property {Partial<typeof DEFAULT_CARD_LIMITS>} [cardLimits]  economy overrides (experiments only)
 */

/**
 * Build the frozen content context.
 * @param {ContentOptions} [options]
 */
export function createContent({ cultures = [], rarityGate = {}, cardLimits = {} } = {}) {
  const tables = buildCultureTables(cultures);
  const limits = Object.freeze({ ...DEFAULT_CARD_LIMITS, ...cardLimits });
  const gate = Object.freeze({ ...rarityGate });
  const categories = createCategoryLookup(tables.classMeta);
  const constructors = createUnitConstructors({
    recruitClasses: tables.recruitClasses,
    variants: tables.variants,
    championTemplates: tables.championTemplates,
    factions: FACTION_BY_ID,
  });

  const cardFor = (key) => lookupCard(tables.cultureCards, key);
  const unitCardFor = (key) => UNIT_CARDS[key] ?? (tables.cultureCards[key]?.type === 'unit' ? tables.cultureCards[key] : null);
  const skillCardFor = (skillId) => SKILL_CARDS[skillId] ?? Object.values(tables.cultureCards).find((c) => c.skillId === skillId) ?? null;

  const context = {
    // Weapons
    weapons: tables.weapons,
    weaponTriangle: WEAPON_TRIANGLE,
    /** Weapon record of a unit; unknown weapon names fall back to a plain weapon. */
    weaponOf: (unit) => tables.weapons[unit.weapon] || FALLBACK_WEAPON,

    // Classes, variants, champions and movement
    recruitClasses: tables.recruitClasses,
    variants: tables.variants,
    championTemplates: tables.championTemplates,
    monsters: MONSTERS,
    moveTypes: tables.moveTypes,
    /** Movement type name ('foot' | 'armor' | 'mounted') of a class key or unit record. */
    moveTypeOf: (unitOrKey) => tables.moveTypes[typeof unitOrKey === 'string' ? unitOrKey : unitOrKey.cls] || 'foot',
    spriteFallback: tables.spriteFallback,

    // Categories
    categories: CATEGORIES,
    categoryIds: CATEGORY_IDS,
    classMeta: tables.classMeta,
    ...categories,

    // Cards, pools, limits and the rarity gate
    cardLimits: limits,
    unitCards: UNIT_CARDS,
    spellCards: SPELL_CARDS,
    skillCards: SKILL_CARDS,
    shardCards: SHARD_CARDS,
    cultureCards: tables.cultureCards,
    cardFor,
    unitCardFor,
    skillCardFor,
    recruitmentPool: RECRUITMENT_POOL,
    /** Draw pool a culture asks for (a copy); the shared pool for unknown ids. */
    poolFor: (cultureId) => (tables.cultures[cultureId] ? [...(tables.cultures[cultureId].def.pool || [])] : []),
    rarityGate: gate,
    rarityGateActive: () => Object.keys(gate).length > 0,
    /** Is a card of this rarity drawable in `round`? Always true when no gate is set. */
    rarityOpen: (rarity, round) => !(gate[rarity ?? 'common'] > (round ?? 1)),

    // Shards, campaign, factions
    shards: SHARDS,
    shardIds: SHARD_IDS,
    shardRules: SHARD_RULES,
    campaignLevels: CAMPAIGN_LEVELS,
    campaignById: CAMPAIGN_BY_ID,
    campaignSetup: CAMPAIGN_SETUP,
    campaignEnemyFactions: (level, faction, seed) => campaignEnemyFactions(level, faction, seed, FACTION_IDS),
    factions: FACTION_BY_ID,
    factionList: FACTIONS,

    // Cultures and the inert ability/spell catalogue
    cultureIds: tables.cultureOrder,
    cultures: tables.cultures,
    abilities: tables.abilities,
    spells: tables.spells,
    /** Catalogue abilities that belong to a unit's kit (inert in this pass: nothing activates them). */
    kitFor: (unit) => Object.values(tables.abilities).filter((ability) => abilityApplies(ability, unit)),

    // Unit constructors and rosters
    ...constructors,
  };
  return deepFreezeContext(context);
}

/** Freeze the data tables; functions and the shared module constants are already immutable. */
function deepFreezeContext(context) {
  return deepFreeze(context);
}

/**
 * Context for a set of faction ids (menu ids: classic, crown, fang, league, court). Mirrors the legacy
 * `prepareFactions`: ids without a culture are ignored, duplicates collapse, and the uncommon/rare
 * rarity gate applies whenever at least one culture is in play (unless `gate` is false).
 * @param {string[]} factionIds
 * @param {{gate?: boolean, cardLimits?: object}} [options]
 */
export function createContentForFactions(factionIds, { gate = true, cardLimits = {} } = {}) {
  const factions = [...new Set(factionIds.map((id) => FACTION_BY_ID[id]).filter((faction) => faction?.culture))];
  return createContent({
    cultures: factions.map((faction) => faction.def),
    rarityGate: factions.length && gate ? { ...RARITY_GATE } : {},
    cardLimits,
  });
}
