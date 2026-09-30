// Culture registry: the one entry point a faction module uses to plug into the shared engine hooks. A "culture" is what
// FACTIONS.md calls a faction (Argent Crown, White Fang Clans, ...); in the engine `faction` already means the side ('blue'|'red').
//
// Nothing is registered in the game, so the shipped rules, cards and simulations are unchanged. Register in a process
// (test, experiment, sim) with registerCulture(def), give each side its pool through createMatch({ pools }), and undo with
// resetCultures(). The header of every log records the registered culture ids and pools, so a replay can re-register them.
//
// def = {
//   id: 'crown',
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
import { registerVariants, resetVariants, VARIANTS } from './roster.js';

export const CULTURES = {};
export const ACTIVE_CULTURES = [];

export function registerCulture(def) {
  if (!def?.id) throw new Error('culture needs an id');
  if (CULTURES[def.id]) unregisterCulture(def.id);
  const record = { def, cards: [], abilities: [], spells: [], variants: [] };
  const variants = {};
  const cards = {};
  for (const [key, v] of Object.entries(def.variants || {})) {
    if (!UNIT_CARDS[v.base]) throw new Error(`variant ${key}: unknown base class ${v.base}`);
    if (UNIT_CARDS[key]) throw new Error(`variant ${key} collides with a shipped unit`);
    variants[key] = { ...v, culture: def.id };
    const base = UNIT_CARDS[v.base];
    cards[key] = { id: `unit-${key}`, type: 'unit', rarity: 'common', unitId: key, base: v.base, name: v.name, cost: base.cost, class: base.class,
      typeLabel: base.typeLabel, stars: 1, range: base.range, defaultStance: base.defaultStance, ability: v.description || base.ability,
      culture: def.id, ...(v.card || {}) };
    record.variants.push(key);
  }
  registerVariants(variants);
  registerAbilities(def.abilities || []);
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
  for (const key of rec.variants) delete VARIANTS[key];
  delete CULTURES[id];
  ACTIVE_CULTURES.splice(ACTIVE_CULTURES.indexOf(id), 1);
}

export function resetCultures() {
  for (const id of [...ACTIVE_CULTURES]) unregisterCulture(id);
  resetVariants();
}

/** The draw pool a culture asks for; pass as createMatch({ pools: { blue: culturePool('crown') } }). */
export const culturePool = (id) => [...(CULTURES[id]?.def.pool || [])];
