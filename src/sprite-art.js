// Artwork identity is independent of combat class and team color. A variant or
// enemy monster can share rules without borrowing another character's illustration.
import manifest from './art/factions-manifest.json' with { type: 'json' };

export const FACTION_ART = manifest.units;
export function spriteArt(unitOrKey) {
  const keys = typeof unitOrKey === 'string' ? [unitOrKey]
    : [unitOrKey?.spriteKey, unitOrKey?.variantId, unitOrKey?.id, unitOrKey?.cls];
  for (const key of keys) if (key && FACTION_ART[key]) return { key, ...FACTION_ART[key], files: { blue: FACTION_ART[key].file, red: FACTION_ART[key].file } };
  return null;
}
export const spriteAssetURL = (path) => `${import.meta.env?.BASE_URL || '/'}${path}`;
