// Unit record constructors. A unit is a plain JSON-compatible record; these functions build the exact
// records the legacy roster built (same fields, same values), from the tables of one content context.
//
// Records never share structure with the context: passives, death hooks and looks are cloned, so a
// match can mutate its units without touching content.
import { clone } from '../util/geometry.js';
import { STAR_STAT_GROWTH, UPGRADE_POPULATION_BY_STARS } from '../content/grades.js';
import { RECRUIT_CLASSES, HEROES, FALLBACK_LOOK, HERO_CLASSES, STARTING_ROSTER } from '../content/classes.js';
import { MONSTERS } from '../content/monsters.js';

/**
 * @typedef {Object} Unit
 * @property {string} id
 * @property {string} cls          class key (movement, sprite base, kits)
 * @property {string} classId      recruit class the unit was built from
 * @property {string} variantId    culture variant, or the class key for plain recruits
 * @property {'blue'|'red'} faction
 * @property {number} c            column
 * @property {number} r            row
 * @property {string} name
 * @property {string} title
 * @property {number} lv
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} str
 * @property {number} mag
 * @property {number} skl
 * @property {number} spd
 * @property {number} def
 * @property {number} res
 * @property {number} mov
 * @property {string} weapon
 * @property {object} look         portrait appearance
 * @property {number} stars
 * @property {number} population
 * @property {'field'|'reserve'} state
 * @property {number} energy
 * @property {number} maxEnergy
 * @property {string[]} selectedAbilities
 * @property {'advance'|'hold'|'protect'} stance
 * @property {Object<string, number>} cooldowns
 * @property {Object<string, number>} statuses
 * @property {string} [culture]
 * @property {object[]} [passives]
 * @property {object} [onDeath]
 * @property {boolean} [champion]
 * @property {boolean} [monster]
 * @property {string} [spriteKey]
 */

/** Look of the first shipped unit of a class, or a plain fallback (legacy `defaultLook`). */
function defaultLookFor(cls, startingUnits) {
  const shipped = startingUnits.find((unit) => unit.cls === cls);
  return clone(shipped?.look ?? FALLBACK_LOOK);
}

/**
 * Build a recruit record from a class key and a template (the class template plus overrides).
 * Equivalent to the legacy private `recruit()`.
 */
function buildRecruit(cls, id, faction, c, r, look, template) {
  const stance = template.stance ?? (cls === 'archer' ? 'hold' : 'advance');
  const record = {
    id,
    cls,
    classId: cls,
    variantId: template.variantId ?? cls,
    faction,
    c,
    r,
    name: template.name,
    title: template.title,
    lv: template.lv,
    hp: template.hp,
    maxHp: template.hp,
    str: template.str,
    mag: template.mag,
    skl: template.skl,
    spd: template.spd,
    def: template.def,
    res: template.res,
    mov: template.mov,
    weapon: template.weapon,
    look: clone(look),
    stars: 1,
    population: 1,
    state: 'field',
    energy: 0,
    maxEnergy: 4,
    selectedAbilities: [],
    stance,
    cooldowns: {},
    statuses: {},
  };
  if (template.culture) record.culture = template.culture;
  if (template.passives) record.passives = clone(template.passives);
  if (template.onDeath) record.onDeath = clone(template.onDeath);
  return record;
}

/** The two heroes plus the shipped recruits, in legacy roster order (the starting forces of both sides). */
function buildStartingUnits() {
  const units = [];
  for (const entry of STARTING_ROSTER) {
    if (entry.hero) {
      units.push(clone(HEROES[entry.hero]));
      continue;
    }
    const template = { ...RECRUIT_CLASSES[entry.cls], ...(entry.over ?? {}) };
    units.push(buildRecruit(entry.cls, entry.id, entry.faction, entry.c, entry.r, entry.look, template));
  }
  return units;
}

/**
 * Constructors over one context's tables.
 * @param {object} tables
 * @param {Record<string, object>} tables.recruitClasses   shipped and culture class templates
 * @param {Record<string, object>} tables.variants         culture variants
 * @param {Record<string, object>} tables.championTemplates
 * @param {Record<string, object>} tables.factions         faction metadata by id (for armyRoster)
 */
export function createUnitConstructors({ recruitClasses, variants, championTemplates, factions }) {
  const startingUnits = buildStartingUnits();

  /** Template of a variant: its base class, explicit stat overrides, then deltas, then identity fields. */
  function variantTemplate(key) {
    const variant = variants[key];
    if (!variant) return null;
    const template = { ...recruitClasses[variant.base], ...(variant.stats || {}) };
    for (const [stat, delta] of Object.entries(variant.delta || {})) template[stat] = (template[stat] ?? 0) + delta;
    return {
      ...template,
      ...(variant.name ? { name: variant.name } : {}),
      ...(variant.title ? { title: variant.title } : {}),
      ...(variant.weapon ? { weapon: variant.weapon } : {}),
      variantId: key,
      ...(variant.culture ? { culture: variant.culture } : {}),
      ...(variant.passives ? { passives: variant.passives } : {}),
      ...(variant.onDeath ? { onDeath: variant.onDeath } : {}),
    };
  }

  /**
   * A persistent recruit record from a class or variant key.
   * @returns {Unit}
   */
  function createRecruitUnit(key, id, faction, c, r, overrides = {}) {
    const variant = variantTemplate(key);
    const cls = variant ? variants[key].base : key;
    if (!recruitClasses[cls]) throw new Error(`Unknown recruit class: ${key}`);
    const template = { ...recruitClasses[cls], ...(variant || {}), ...overrides };
    return buildRecruit(cls, id, faction, c, r, defaultLookFor(cls, startingUnits), template);
  }

  /** A champion unit for a registered champion template, placed at c, r for `faction`. */
  function createChampionUnit(id, faction, c, r) {
    const template = championTemplates[id];
    if (!template) throw new Error(`Unknown champion: ${id}`);
    return {
      ...clone(template),
      id,
      faction,
      c,
      r,
      hp: template.maxHp,
      stars: 1,
      population: 1,
      state: 'field',
      energy: 0,
      maxEnergy: 4,
      selectedAbilities: [],
      stance: 'advance',
      cooldowns: {},
      statuses: {},
      champion: true,
    };
  }

  /** A named hero rebuilt at full HP with empty combat resources, for the champion respawn. */
  function createHeroRespawnData(id, c, r) {
    if (championTemplates[id]) {
      const faction = championTemplates[id].faction ?? 'blue';
      return { ...createChampionUnit(id, faction, c, r), planningMoved: false, done: false, moved: false };
    }
    const hero = startingUnits.find((unit) => unit.id === id && HERO_CLASSES.includes(unit.cls));
    if (!hero) throw new Error(`Unknown hero champion: ${id}`);
    return {
      ...clone(hero),
      c,
      r,
      hp: hero.maxHp,
      energy: 0,
      maxEnergy: 4,
      cooldowns: {},
      statuses: {},
      selectedAbilities: [],
      stance: 'advance',
      state: 'field',
      population: 1,
      planningMoved: false,
      done: false,
      moved: false,
    };
  }

  /** A fresh recruit of the given star grade, including stat growth. No instance state is carried over. */
  function createGradedRecruitUnit(cls, id, faction, stars = 1) {
    const unit = createRecruitUnit(cls, id, faction, 0, 0);
    for (let tier = 1; tier < stars; tier += 1) {
      for (const [stat, growth] of Object.entries(STAR_STAT_GROWTH)) {
        if (stat !== 'hp' && Number.isFinite(unit[stat])) unit[stat] += growth;
      }
    }
    unit.hp = unit.maxHp;
    unit.stars = stars;
    unit.population = UPGRADE_POPULATION_BY_STARS[stars];
    return unit;
  }

  /** A standard field record for a fixed campaign encounter. Registers no culture or card. */
  function createMonsterUnit(key, id, faction, c, r) {
    const monster = MONSTERS[key];
    if (!monster) throw new Error(`Unknown monster: ${key}`);
    const unit = createRecruitUnit(monster.base, id, faction, c, r, {
      ...monster.stats,
      name: monster.name,
      title: monster.title,
      description: monster.description,
      weapon: monster.weapon,
    });
    return {
      ...unit,
      cls: key,
      classId: monster.base,
      variantId: key,
      name: monster.name,
      title: monster.title,
      description: monster.description,
      weapon: monster.weapon,
      spriteKey: monster.spriteKey,
      monster: true,
      culture: monster.culture,
      passives: clone(monster.passives),
      selectedAbilities: [],
      stance: 'advance',
    };
  }

  /** Champion id a faction fields on a side. Unknown faction ids fall back to classic. */
  function championFor(factionId, side) {
    const faction = factions[factionId] || factions.classic;
    return typeof faction.champion === 'string' ? faction.champion : faction.champion[side];
  }

  /**
   * The shipped starting units of `side`, each swapped for the faction's equivalent by role; the
   * champion becomes the faction champion. Classic (no culture) returns the shipped units unchanged.
   * The faction's culture must be registered in this context.
   */
  function armyRoster(factionId, side) {
    const faction = factions[factionId] || factions.classic;
    const shipped = startingUnits.filter((unit) => unit.faction === side).map((unit) => clone(unit));
    if (!faction.culture) return shipped;
    return shipped.map((unit) => {
      if (HERO_CLASSES.includes(unit.cls)) {
        const championId = championFor(factionId, side);
        if (championId === 'dreg') return { ...clone(startingUnits.find((u) => u.id === 'dreg')), faction: side, c: unit.c, r: unit.r };
        return createChampionUnit(championId, side, unit.c, unit.r);
      }
      const key = faction.core[unit.cls];
      if (!key || key === unit.cls) return unit;
      return { ...createRecruitUnit(key, unit.id, side, unit.c, unit.r), look: unit.look };
    });
  }

  return {
    startingUnits,
    createRecruitUnit,
    createChampionUnit,
    createHeroRespawnData,
    createGradedRecruitUnit,
    createMonsterUnit,
    championFor,
    armyRoster,
  };
}
