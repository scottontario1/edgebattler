// Unit categories: a shared vocabulary for what a unit is FOR, independent of its faction, class name
// or movement type. A category drives display (unit card), AI defaults (stance, positioning, recruit
// mix) and new-class design; it never changes combat rules by itself.
//
//   melee    front line: holds ground and trades blows in contact
//   ranged   attacks from behind the line with a bow, crossbow or thrown weapon
//   mounted  fast shock and flank units (movement type 'mounted')
//   caster   magic damage (weapons with `magic: true` use Mag against Res and ignore Defense)
//   support  heals, buffs and auras for the line; weak in melee
//
// Cultures give their classes and variants a `category` (a variant inherits its base class's) and may
// add `aiStance` ('hold' | 'advance'), the stance the AI prefers for that class.

export const CATEGORIES = Object.freeze({
  melee: Object.freeze({ name: 'Melee', role: 'Front line: holds ground and trades blows in contact.' }),
  ranged: Object.freeze({ name: 'Ranged', role: 'Shoots from behind the line; weak when caught.' }),
  mounted: Object.freeze({ name: 'Mounted', role: 'Fast shock and flank units; Charge and Momentum reward a run-up.' }),
  caster: Object.freeze({ name: 'Caster', role: 'Magic damage that ignores Defense; fragile.' }),
  support: Object.freeze({ name: 'Support', role: 'Heals, buffs and auras for the line; weak in melee.' }),
});

export const CATEGORY_IDS = Object.freeze(Object.keys(CATEGORIES));

/**
 * Category lookups over one class-metadata table ({ classKey: { category?, aiStance? } }).
 * The table belongs to a content context, so two contexts never share metadata.
 * @param {Record<string, {category?: string, aiStance?: string}>} classMeta
 */
export function createCategoryLookup(classMeta) {
  /** Metadata of a class key, or of a unit record (variant first, then unit id, then class). */
  function metaOf(unitOrKey) {
    if (typeof unitOrKey === 'string') return classMeta[unitOrKey] ?? {};
    return classMeta[unitOrKey?.variantId] ?? classMeta[unitOrKey?.id] ?? classMeta[unitOrKey?.cls] ?? {};
  }

  /** One of CATEGORY_IDS; variants inherit their base class's category unless they set their own. */
  function categoryOf(unitOrKey) {
    if (typeof unitOrKey !== 'string') {
      const own = classMeta[unitOrKey?.variantId]?.category ?? classMeta[unitOrKey?.id]?.category;
      if (own) return own;
    }
    const key = typeof unitOrKey === 'string' ? unitOrKey : { cls: unitOrKey?.cls };
    return metaOf(key).category ?? 'melee';
  }

  function categoryName(unitOrKey) {
    return CATEGORIES[categoryOf(unitOrKey)].name;
  }

  return { metaOf, categoryOf, categoryName };
}
