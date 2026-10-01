// Which illustration a unit record uses, and how big it is drawn. Pure data in, plain data out
// (no Phaser) so the identity rules can be tested.
//
// Identity order is spriteKey -> variantId -> unitId -> class (legacy src/sprite-art.js). At each
// step the faction/monster manifest wins over the original five-class manifest, because supplied
// faction art keeps its native colours and must never borrow a recruit's drawing.
import { TILE_W } from './projection.js';

/** Combat class -> drawing in public/sprites/manifest.json (heroes have class names of their own). */
export const CLASS_SPRITE = Object.freeze({
  paladin: 'brenna',
  barbarian: 'dreg',
  pikeman: 'pikeman',
  archer: 'archer',
  cavalier: 'cavalier',
});

/**
 * @param {object} unit plain unit record ({ spriteKey?, variantId?, id, cls, faction })
 * @param {{ classic?: object, factions?: object }} manifests parsed manifest.json and the `units`
 *        table of factions-manifest.json (either may be missing when the art failed to load)
 * @returns {null | { source: 'faction'|'classic', key: string, textureKey: string, native: boolean, info: object }}
 */
export function resolveArt(unit, { classic = {}, factions = {} } = {}) {
  const faction = unit?.faction === 'red' ? 'red' : 'blue';
  const keys = [unit?.spriteKey, unit?.variantId, unit?.id, unit?.cls];
  for (const key of keys) {
    if (!key) continue;
    if (factions[key]) return pick('faction', key, factions[key], faction);
    if (classic[key]) return pick('classic', key, classic[key], faction);
    const viaClass = CLASS_SPRITE[key];
    if (viaClass && classic[viaClass]) return pick('classic', viaClass, classic[viaClass], faction);
  }
  return null;
}

function pick(source, key, info, faction) {
  if (source === 'faction') {
    return { source, key, textureKey: textureKeyFor(source, key), native: true, info };
  }
  // Recruits ship a pre-tinted _red drawing; heroes have one drawing for both sides.
  const side = info.files?.[faction] ? faction : 'blue';
  return { source, key, textureKey: textureKeyFor(source, key, side), native: false, info };
}

/** Texture-cache key for a drawing; BootScene loads under the same names. */
export function textureKeyFor(source, key, side = 'blue') {
  return source === 'faction' ? `art:faction:${key}` : `art:classic:${key}:${side}`;
}

/** Image path (relative to the site base) for a manifest entry. */
export function artFile(source, info, side = 'blue') {
  return source === 'faction' ? info.file : (info.files[side] ?? info.files.blue);
}

/**
 * Draw metrics for a drawing: pixel scale, anchor and foot width in world pixels.
 * `info.height` is the foot-to-head world height in tile units and `visibleHeight` is that span in
 * image pixels, so one image pixel is drawn at TILE_W * height / visibleHeight screen pixels.
 */
export function drawMetrics(info) {
  const scale = (TILE_W * info.height) / info.visibleHeight;
  return {
    scale,
    anchorX: info.anchor[0],
    anchorY: info.anchor[1],
    width: info.size[0] * scale,
    height: info.size[1] * scale,
    footWidth: Math.max(0.55, info.footWidth * 1.35) * TILE_W * 0.62,
    headY: info.height * TILE_W, // head-top distance above the feet, for HP bars and float text
  };
}
