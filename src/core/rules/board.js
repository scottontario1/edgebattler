// A board is one map's grid as an immutable value. Every rule that needs terrain takes a board
// argument; there is no "active map" global, so several matches (or a replay next to a live game)
// can coexist in one process.
import { TERRAIN } from '../content/terrain.js';

/**
 * Validate a map definition ({ id, name?, layout: string[], hills? }) and build its board.
 * Throws with the offending row/column so a typo in a map file is easy to find.
 */
export function createBoard(map, terrain = TERRAIN) {
  const rows = map?.layout;
  if (!Array.isArray(rows) || !rows.length) throw new Error(`map ${map?.id ?? '?'} has no layout`);
  const width = rows[0].length;
  rows.forEach((row, r) => {
    if (row.length !== width) throw new Error(`map ${map.id} row ${r} has ${row.length} tiles, expected ${width}`);
    for (let c = 0; c < width; c += 1) {
      if (!terrain[row[c]]) throw new Error(`map ${map.id} tile (${c}, ${r}) uses unknown terrain '${row[c]}'`);
    }
  });
  const height = rows.length;
  const inBounds = (c, r) => c >= 0 && r >= 0 && c < width && r < height;
  const terrainAt = (c, r) => rows[r][c];
  return Object.freeze({
    id: map.id,
    name: map.name ?? map.id,
    width,
    height,
    rows: Object.freeze([...rows]),
    hills: Object.freeze((map.hills ?? []).map(([c, r]) => Object.freeze([c, r]))),
    inBounds,
    terrainAt,
    /** Terrain rules record of a tile ({ name, def, avo, ... }). */
    tile: (c, r) => terrain[rows[r][c]],
    /** [c, r] of the first tile with this letter (scanning rows north to south), or null. */
    findTile(letter) {
      for (let r = 0; r < height; r += 1) { const c = rows[r].indexOf(letter); if (c >= 0) return [c, r]; }
      return null;
    },
    /** Every tile in row-major order as { c, r, letter }. */
    *tiles() { for (let r = 0; r < height; r += 1) for (let c = 0; c < width; c += 1) yield { c, r, letter: rows[r][c] }; },
  });
}
