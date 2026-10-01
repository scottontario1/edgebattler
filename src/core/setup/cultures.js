// Culture registration as a pure function. Legacy registered cultures into process-wide tables
// (`registerCulture`); here `buildCultureTables` folds a list of culture definitions into fresh
// tables that one content context owns, so two contexts never interfere.
//
// A culture definition is plain data (see the faction modules in src/core/content/factions/):
//
//   id         culture id, e.g. 'crown'
//   classes    { key: { name, title?, category?, aiStance?, stats, weapon?, weaponDef?, moveType?, spriteBase,
//                       tint, label?, passives?, onDeath?, description?, card: { rarity, cost, class, range, defaultStance } } }
//   variants   { key: { base, name, title?, delta?, stats?, weapon?, passives?, onDeath?, category?, aiStance?,
//                       tint?, description?, card } }
//   champions  { id: { name, title?, cls, stats, weapon?, look, passives?, tint?, spriteBase?, faction? } }
//   championTemplates  { id: <complete champion template> } registered as given
//   abilities  inert catalogue records (skills are archived in this pass)
//   spells     { key: { spell: {...}, card: { rarity, effect } } } inert catalogue records
//   skills     { key: <type-wide equipment card> }
//   pool       card keys the culture draws from (repeats are weights)
import { clone } from '../util/geometry.js';
import { CATEGORIES } from '../content/categories.js';
import { RECRUIT_CLASSES, BASE_MOVE_TYPES, BASE_CLASS_META } from '../content/classes.js';
import { SHIPPED_ABILITIES, SHIPPED_SPELLS } from '../content/abilities.js';
import { WEAPONS } from '../content/weapons.js';
import { UNIT_CARDS, SPELL_CARDS, SKILL_CARDS } from '../content/cards.js';
import { SHARD_CARDS } from '../content/shards.js';

/** Classes whose abilities stay inside their culture (the shipped classes everyone shares). */
const SHIPPED_CLASS_KEYS = ['pikeman', 'archer', 'cavalier'];

function emptyTables() {
  return {
    recruitClasses: clone(RECRUIT_CLASSES),
    variants: {},
    championTemplates: {},
    weapons: clone(WEAPONS),
    moveTypes: { ...BASE_MOVE_TYPES },
    classMeta: clone(BASE_CLASS_META),
    /** Culture-registered cards (legacy "candidate" cards), by key. */
    cultureCards: {},
    abilities: clone(SHIPPED_ABILITIES),
    spells: clone(SHIPPED_SPELLS),
    spriteFallback: {},
    cultures: {},
    cultureOrder: [],
  };
}

function setClassMeta(tables, key, meta) {
  if (meta.category && !CATEGORIES[meta.category]) throw new Error(`unknown category ${meta.category} for ${key}`);
  tables.classMeta[key] = { ...meta };
}

function registerClasses(tables, def, record, cards) {
  for (const [key, c] of Object.entries(def.classes || {})) {
    if (tables.recruitClasses[key] || UNIT_CARDS[key] || cards[key]) {
      throw new Error(`class ${key} collides with an existing class or card`);
    }
    const weaponName = c.weapon || `${c.name} weapon`;
    if (c.weaponDef) {
      tables.weapons[weaponName] = clone(c.weaponDef);
      record.weapons.push(weaponName);
    }
    tables.recruitClasses[key] = {
      name: c.name,
      title: c.title || 'Recruit',
      lv: 2,
      mag: 0,
      res: 1,
      ...c.stats,
      weapon: weaponName,
      culture: def.id,
      ...(c.card?.defaultStance ? { stance: c.card.defaultStance } : {}),
      ...(c.passives ? { passives: clone(c.passives) } : {}),
      ...(c.onDeath ? { onDeath: clone(c.onDeath) } : {}),
    };
    if (c.moveType) {
      tables.moveTypes[key] = c.moveType;
      record.moveTypes.push(key);
    }
    tables.spriteFallback[key] = { base: c.spriteBase, tint: c.tint, label: c.label || c.name };
    setClassMeta(tables, key, {
      category: c.category || (c.weaponDef?.magic ? 'caster' : 'melee'),
      ...(c.aiStance ? { aiStance: c.aiStance } : {}),
    });
    cards[key] = {
      id: `unit-${key}`,
      type: 'unit',
      rarity: 'common',
      unitId: key,
      name: c.name,
      cost: 2,
      class: 'Foot',
      stars: 1,
      range: 1,
      defaultStance: 'advance',
      ability: c.description || c.name,
      culture: def.id,
      ...clone(c.card || {}),
    };
    record.classes.push(key);
  }
}

function registerVariants(tables, def, record, cards) {
  const variants = {};
  for (const [key, v] of Object.entries(def.variants || {})) {
    if (!UNIT_CARDS[v.base] && !cards[v.base]) throw new Error(`variant ${key}: unknown base class ${v.base}`);
    if (UNIT_CARDS[key]) throw new Error(`variant ${key} collides with a shipped unit`);
    // A variant card's default stance must reach the recruit template, or the reserve keeps the base class's stance.
    variants[key] = {
      ...clone(v),
      culture: def.id,
      ...(v.card?.defaultStance ? { stats: { ...(v.stats || {}), stance: v.card.defaultStance } } : {}),
    };
    const base = UNIT_CARDS[v.base] ?? cards[v.base];
    cards[key] = {
      id: `unit-${key}`,
      type: 'unit',
      rarity: 'common',
      unitId: key,
      base: v.base,
      name: v.name,
      cost: base.cost,
      class: base.class,
      typeLabel: base.typeLabel,
      stars: 1,
      range: base.range,
      defaultStance: base.defaultStance,
      ability: v.description || base.ability,
      culture: def.id,
      ...clone(v.card || {}),
    };
    if (v.category || v.aiStance) {
      setClassMeta(tables, key, {
        ...(v.category ? { category: v.category } : {}),
        ...(v.aiStance ? { aiStance: v.aiStance } : {}),
      });
    }
    record.variants.push(key);
  }
  for (const [key, v] of Object.entries(def.variants || {})) {
    if (v.tint) tables.spriteFallback[key] = { base: v.base, tint: v.tint, label: v.name };
  }
  Object.assign(tables.variants, variants);
}

function registerChampions(tables, def, record) {
  const champions = {};
  for (const [id, ch] of Object.entries(def.champions || {})) {
    const t = { ...tables.recruitClasses[ch.cls], ...ch.stats };
    champions[id] = {
      id,
      name: ch.name,
      title: ch.title || 'Champion',
      cls: ch.cls,
      lv: t.lv ?? 4,
      hp: t.hp,
      maxHp: t.hp,
      str: t.str,
      mag: t.mag ?? 0,
      skl: t.skl,
      spd: t.spd,
      def: t.def,
      res: t.res ?? 1,
      mov: t.mov,
      weapon: ch.weapon || t.weapon,
      look: clone(ch.look),
      culture: def.id,
      champion: true,
      faction: ch.faction,
      ...(ch.passives ? { passives: clone(ch.passives) } : {}),
    };
    if (ch.tint || ch.spriteBase) tables.spriteFallback[id] = { base: ch.spriteBase || ch.cls, tint: ch.tint, label: ch.name };
    record.champions.push(id);
  }
  Object.assign(tables.championTemplates, champions);
  // Templates registered as given (the White Fang's blue copy of Dreg); not tied to the record's cleanup list.
  for (const [id, template] of Object.entries(def.championTemplates || {})) {
    tables.championTemplates[id] = clone(template);
  }
}

function registerCatalogue(tables, def, record, cards) {
  const abilities = (def.abilities || []).map((a) => {
    const stayInCulture = !a.culture && !a.anyUnit && a.classes?.some((c) => SHIPPED_CLASS_KEYS.includes(c));
    return clone(stayInCulture ? { ...a, culture: def.id } : a);
  });
  for (const ability of abilities) tables.abilities[ability.id] = ability;
  record.abilities = abilities.map((a) => a.id);

  const spells = [];
  for (const [key, entry] of Object.entries(def.spells || {})) {
    spells.push(clone(entry.spell));
    cards[key] = {
      id: `spell-${entry.spell.id}`,
      type: 'spell',
      rarity: 'common',
      name: entry.spell.name,
      cost: entry.spell.cost,
      target: entry.spell.target,
      duration: entry.spell.duration,
      culture: def.id,
      ...clone(entry.card || {}),
    };
  }
  for (const spell of spells) tables.spells[spell.id] = spell;
  record.spells = spells.map((s) => s.id);

  for (const [key, card] of Object.entries(def.skills || {})) cards[key] = { culture: def.id, ...clone(card) };
}

/** Fold one culture definition into the tables. */
function registerCulture(tables, def) {
  if (!def?.id) throw new Error('culture needs an id');
  if (tables.cultures[def.id]) throw new Error(`culture ${def.id} registered twice`);
  const record = { def: clone(def), cards: [], abilities: [], spells: [], variants: [], classes: [], weapons: [], moveTypes: [], champions: [] };
  const cards = {};
  registerClasses(tables, def, record, cards);
  registerVariants(tables, def, record, cards);
  registerChampions(tables, def, record);
  registerCatalogue(tables, def, record, cards);
  Object.assign(tables.cultureCards, cards);
  record.cards = Object.keys(cards);
  tables.cultures[def.id] = record;
  tables.cultureOrder.push(def.id);
}

/**
 * Register the given culture definitions, in order, into fresh tables.
 * @param {object[]} cultureDefs
 */
export function buildCultureTables(cultureDefs = []) {
  const tables = emptyTables();
  for (const def of cultureDefs) registerCulture(tables, def);
  return tables;
}

/** Card lookup priority of the legacy `cardFor`: unit, spell, shard, skill, then culture cards. */
export function lookupCard(cultureCards, key) {
  return UNIT_CARDS[key] ?? SPELL_CARDS[key] ?? SHARD_CARDS[key] ?? SKILL_CARDS[key] ?? cultureCards[key] ?? null;
}
