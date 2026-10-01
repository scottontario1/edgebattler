// Oblique top-down projection shared by every world module (docs/PHASER_PORT.md "Projection").
//
// Tile (c, r) covers the world rectangle [c*TILE_W, (c+1)*TILE_W) x [r*TILE_H, (r+1)*TILE_H).
// One world unit of art ("a tile") is TILE_W pixels wide; rows are foreshortened to TILE_H like the
// legacy 40-degree camera, so a upright sprite is drawn at its natural proportions (never squashed).
// Everything that stands on the ground sorts by its foot y: depth = y.

export const TILE_W = 96;
export const TILE_H = 72;

/** Feet rest slightly below the tile centre so a tall sprite reads as standing in its tile. */
export const FOOT_DROP = 10;

/** Fixed depth bands for things that are not sorted by foot y. Foot depths are < 5000 on any board. */
export const DEPTH = Object.freeze({
  GROUND: -10000,
  GROUND_DECOR: -9500,
  OVERLAY: -9000,
  ABOVE_UNITS: 20000,
  FLOATING: 30000,
});

export const tileCenterX = (c) => (c + 0.5) * TILE_W;
export const tileCenterY = (r) => (r + 0.5) * TILE_H;

/** World position of a tile's centre. Pass `out` to avoid an allocation in hot paths. */
export function tileToWorld(c, r, out = { x: 0, y: 0 }) {
  out.x = tileCenterX(c);
  out.y = tileCenterY(r);
  return out;
}

/** World position where a unit's feet rest on a tile. */
export function tileFoot(c, r, out = { x: 0, y: 0 }) {
  out.x = tileCenterX(c);
  out.y = tileCenterY(r) + FOOT_DROP;
  return out;
}

/** Tile containing a world point (may be out of bounds; callers check with board.inBounds). */
export function worldToTile(x, y, out = { c: 0, r: 0 }) {
  out.c = Math.floor(x / TILE_W);
  out.r = Math.floor(y / TILE_H);
  return out;
}

/** Pixel size of a board in world units. */
export const boardPixels = (cols, rows) => ({ w: cols * TILE_W, h: rows * TILE_H });

/** Depth of anything standing at world y. */
export const depthOf = (y) => y;

/** Read a tile given either `{c, r}` or `[c, r]` (the core uses both shapes). */
export const tileC = (t) => (Array.isArray(t) ? t[0] : t.c);
export const tileR = (t) => (Array.isArray(t) ? t[1] : t.r);
