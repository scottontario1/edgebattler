// Unit categories: a shared vocabulary for what a unit is FOR, independent of its faction, class name or movement type. A category drives
// display (unit card), AI defaults (stance and positioning, recruit mix) and new-class design; it never changes combat rules by itself.
//
//   melee    front line: holds ground and trades blows in contact
//   ranged   attacks from behind the line with a bow, crossbow or thrown weapon
//   mounted  fast shock and flank units (movement type 'mounted')
//   caster   magic damage (weapons with `magic: true` use Mag against Res and ignore Defense); fragile, short or medium reach
//   support  heals, buffs and auras for the line; weak in melee
//
// The five shipped classes are pre-assigned. A culture (src/cultures.js) gives its classes and variants a `category` (a variant inherits its
// base class's) and may add `aiStance` ('hold' | 'advance'), the stance the AI prefers for that class when nothing more urgent applies.
export const CATEGORIES = Object.freeze({
  melee: { name: 'Melee', role: 'Front line: holds ground and trades blows in contact.' },
  ranged: { name: 'Ranged', role: 'Shoots from behind the line; weak when caught.' },
  mounted: { name: 'Mounted', role: 'Fast shock and flank units; Charge and Momentum reward a run-up.' },
  caster: { name: 'Caster', role: 'Magic damage that ignores Defense; fragile.' },
  support: { name: 'Support', role: 'Heals, buffs and auras for the line; weak in melee.' },
});
export const CATEGORY_IDS = Object.freeze(Object.keys(CATEGORIES));

export const CLASS_META = { pikeman: { category: 'melee' }, archer: { category: 'ranged' }, cavalier: { category: 'mounted' }, paladin: { category: 'melee' }, barbarian: { category: 'melee' } };
const SHIPPED = Object.keys(CLASS_META);
export const registerClassMeta = (key, meta) => {
  if (meta.category && !CATEGORIES[meta.category]) throw new Error(`unknown category ${meta.category} for ${key}`);
  CLASS_META[key] = { ...meta };
};
export const unregisterClassMeta = (key) => { if (!SHIPPED.includes(key)) delete CLASS_META[key]; };

/** The class metadata of a unit record or class key: its variant first, then its class, then the plain melee default. */
export const metaOf = (unitOrKey) => {
  if (typeof unitOrKey === 'string') return CLASS_META[unitOrKey] ?? {};
  return CLASS_META[unitOrKey?.variantId] ?? CLASS_META[unitOrKey?.id] ?? CLASS_META[unitOrKey?.cls] ?? {};
};
/** One of CATEGORY_IDS; variants inherit the category of their base class unless they set their own. */
export const categoryOf = (unitOrKey) => {
  if (typeof unitOrKey !== 'string') {
    const own = CLASS_META[unitOrKey?.variantId]?.category ?? CLASS_META[unitOrKey?.id]?.category;
    if (own) return own;
  }
  return metaOf(typeof unitOrKey === 'string' ? unitOrKey : { cls: unitOrKey?.cls }).category ?? 'melee';
};
export const categoryName = (unitOrKey) => CATEGORIES[categoryOf(unitOrKey)].name;
