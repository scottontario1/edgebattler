// Culture registry: the one entry point a faction module uses to plug into the shared engine hooks. A "culture" is what
// FACTIONS.md calls a faction (Argent Crown, White Fang Clans, ...); in the engine `faction` already means the side ('blue'|'red').
//
// Nothing is registered in the game, so the shipped rules, cards and simulations are unchanged. Register in a process
// (test, experiment, sim) with registerCulture(def), give each side its pool through createMatch({ pools }), and undo with
// resetCultures(). The header of every log records the registered culture ids and pools, so a replay can re-register them.
//
// def = {
//   id: 'crown',
//   classes:   { key: { name, title?, category: 'melee'|'ranged'|'mounted'|'caster'|'support' (src/categories.js; default caster for a magic weapon), aiStance?: 'hold'|'advance', stats: { hp, str, skl, spd, def, res, mov, lv? }, weapon: 'Coil Crossbow',
//                       weaponDef?: { mt, hit, crit, rng: [1, 1], kind }, moveType?: 'foot'|'armor'|'mounted',
//                       spriteBase: 'pikeman', tint: '#4E7C6A', label?, passives?, onDeath?, card: { rarity, cost, class, range, defaultStance } } },
//   champions: { id: { name, title, cls, stats, weapon, look, tint?, spriteBase? } },        // a champion per culture; kits via ability `units: [id]`
//   variants: { crownGuard: { base: 'pikeman', name, title?, delta: { hp, str, def, mov ... }, stats?, weapon?, passives: [...],
//                             card: { rarity, cost? } } },
//   abilities: [ { id, name, classes, cost, cooldown, phase, requires?, effect?, description } ],   // src/abilities.js shape
//   spells:    { key: { spell: { id, name, type: 'spell', cost, target, duration, radius?, effect }, card: { rarity, effect } } },
//   skills:    { key: <type-wide equipment card as in SKILL_CARDS> },
//   pool: ['pikeman', 'crownGuard', 'mend', ...]        // card keys this culture draws from (per-side pool)
// }
// Hooks a culture can use (all inert without registration): variant recruits (src/roster.js), per-side pools (src/cards.js),
// ability `requires` hpBelow / hpAbove / onControlled (src/abilities.js), passives with adjacency, stance, HP, movement and
// aura conditions (src/passives.js), numeric battle statuses damageTaken / damageDealt / ignoreDefense / offTargetPenalty /
// energyWhenStruck (src/battle.js), `markTargetId` on a unit (preferred target for the battle), and the revenant passive
// (`effect: { revenant: 1 }`, once per match). See docs/CULTURE_HOOKS.md.
import { registerAbilities, unregisterAbilities, registerSpells, unregisterSpells } from './abilities.js';
import { registerCandidateCards, unregisterCandidateCards, UNIT_CARDS } from './cards.js';
import { registerVariants, resetVariants, VARIANTS, RECRUIT, registerChampions, CHAMPION_TEMPLATES } from './roster.js';
import { MOVE_TYPE } from './rules.js';
import { registerClassMeta, unregisterClassMeta } from './categories.js';
import { WEAPONS } from './combat.js';

// Placeholder art until sprites exist: class or variant key -> { base: existing class whose sprite/model is borrowed, tint, label }.
// Read by src/sprites.js and src/models.js; empty in the game.
export const SPRITE_FALLBACK = {};

export const CULTURES = {};
export const ACTIVE_CULTURES = [];

export function registerCulture(def) {
  if (!def?.id) throw new Error('culture needs an id');
  if (CULTURES[def.id]) unregisterCulture(def.id);
  const record = { def, cards: [], abilities: [], spells: [], variants: [], classes: [], weapons: [], moveTypes: [], champions: [] };
  const variants = {};
  const cards = {};
  for (const [key, c] of Object.entries(def.classes || {})) {
    if (RECRUIT[key] || UNIT_CARDS[key] || cards[key]) throw new Error(`class ${key} collides with an existing class or card`);
    const wname = c.weapon || `${c.name} weapon`;
    if (c.weaponDef) { WEAPONS[wname] = c.weaponDef; record.weapons.push(wname); }
    RECRUIT[key] = { name: c.name, title: c.title || 'Recruit', lv: 2, mag: 0, res: 1, ...c.stats, weapon: wname, culture: def.id, ...(c.card?.defaultStance ? { stance: c.card.defaultStance } : {}),
      ...(c.passives ? { passives: c.passives } : {}), ...(c.onDeath ? { onDeath: c.onDeath } : {}) };
    if (c.moveType) { MOVE_TYPE[key] = c.moveType; record.moveTypes.push(key); }
    SPRITE_FALLBACK[key] = { base: c.spriteBase, tint: c.tint, label: c.label || c.name };
    registerClassMeta(key, { category: c.category || (c.weaponDef?.magic ? 'caster' : 'melee'), ...(c.aiStance ? { aiStance: c.aiStance } : {}) });
    cards[key] = { id: `unit-${key}`, type: 'unit', rarity: 'common', unitId: key, name: c.name, cost: 2, class: 'Foot', stars: 1, range: 1,
      defaultStance: 'advance', ability: c.description || c.name, culture: def.id, ...(c.card || {}) };
    record.classes.push(key);
  }
  for (const [key, v] of Object.entries(def.variants || {})) {
    if (!UNIT_CARDS[v.base] && !cards[v.base]) throw new Error(`variant ${key}: unknown base class ${v.base}`);
    if (UNIT_CARDS[key]) throw new Error(`variant ${key} collides with a shipped unit`);
    // A variant card's default stance must reach the recruit template, or the reserve keeps the base class's stance.
    variants[key] = { ...v, culture: def.id, ...(v.card?.defaultStance ? { stats: { ...(v.stats || {}), stance: v.card.defaultStance } } : {}) };
    const base = UNIT_CARDS[v.base] ?? cards[v.base];
    cards[key] = { id: `unit-${key}`, type: 'unit', rarity: 'common', unitId: key, base: v.base, name: v.name, cost: base.cost, class: base.class,
      typeLabel: base.typeLabel, stars: 1, range: base.range, defaultStance: base.defaultStance, ability: v.description || base.ability,
      culture: def.id, ...(v.card || {}) };
    if (v.category || v.aiStance) registerClassMeta(key, { ...(v.category ? { category: v.category } : {}), ...(v.aiStance ? { aiStance: v.aiStance } : {}) });
    record.variants.push(key);
  }
  for (const [key, v] of Object.entries(def.variants || {})) if (v.tint) SPRITE_FALLBACK[key] = { base: v.base, tint: v.tint, label: v.name };
  const champs = {};
  for (const [id, ch] of Object.entries(def.champions || {})) {
    const t = { ...RECRUIT[ch.cls], ...ch.stats };
    champs[id] = { id, name: ch.name, title: ch.title || 'Champion', cls: ch.cls, lv: t.lv ?? 4, hp: t.hp, maxHp: t.hp, str: t.str, mag: t.mag ?? 0, skl: t.skl,
      spd: t.spd, def: t.def, res: t.res ?? 1, mov: t.mov, weapon: ch.weapon || t.weapon, look: ch.look, culture: def.id, champion: true, faction: ch.faction };
    if (ch.tint || ch.spriteBase) SPRITE_FALLBACK[id] = { base: ch.spriteBase || ch.cls, tint: ch.tint, label: ch.name };
    record.champions.push(id);
  }
  registerChampions(champs);
  registerVariants(variants);
  const SHIPPED = ['pikeman', 'archer', 'cavalier'];
  // Abilities on a shipped class stay inside their culture (abilityApplies); abilities on the culture's own classes need no tag.
  registerAbilities((def.abilities || []).map((a) => (!a.culture && !a.anyUnit && a.classes?.some((c) => SHIPPED.includes(c)) ? { ...a, culture: def.id } : a)));
  record.abilities = (def.abilities || []).map((a) => a.id);
  const spells = [];
  for (const [key, sp] of Object.entries(def.spells || {})) {
    spells.push(sp.spell);
    cards[key] = { id: `spell-${sp.spell.id}`, type: 'spell', rarity: 'common', name: sp.spell.name, cost: sp.spell.cost, target: sp.spell.target,
      duration: sp.spell.duration, culture: def.id, ...(sp.card || {}) };
  }
  registerSpells(spells);
  record.spells = spells.map((sp) => sp.id);
  for (const [key, card] of Object.entries(def.skills || {})) cards[key] = { culture: def.id, ...card };
  registerCandidateCards(cards);
  record.cards = Object.keys(cards);
  CULTURES[def.id] = record;
  ACTIVE_CULTURES.push(def.id);
  return record;
}

export function unregisterCulture(id) {
  const rec = CULTURES[id];
  if (!rec) return;
  unregisterCandidateCards(rec.cards);
  unregisterAbilities(rec.abilities);
  unregisterSpells(rec.spells);
  for (const key of rec.variants) { delete VARIANTS[key]; delete SPRITE_FALLBACK[key]; unregisterClassMeta(key); }
  for (const key of rec.classes) { delete RECRUIT[key]; delete SPRITE_FALLBACK[key]; unregisterClassMeta(key); }
  for (const w of rec.weapons) delete WEAPONS[w];
  for (const key of rec.moveTypes) delete MOVE_TYPE[key];
  for (const id of rec.champions) { delete CHAMPION_TEMPLATES[id]; delete SPRITE_FALLBACK[id]; }
  delete CULTURES[id];
  ACTIVE_CULTURES.splice(ACTIVE_CULTURES.indexOf(id), 1);
}

export function resetCultures() {
  for (const id of [...ACTIVE_CULTURES]) unregisterCulture(id);
  resetVariants();
}

/** The draw pool a culture asks for; pass as createMatch({ pools: { blue: culturePool('crown') } }). */
export const culturePool = (id) => [...(CULTURES[id]?.def.pool || [])];
