// A board is one map's grid as an immutable value. Every rule that needs terrain takes a board
// argument; there is no "active map" global, so several matches (or a replay next to a live game)
// can coexist in one process.
import { TERRAIN } from '../content/terrain.js';
import { clone, deepFreeze } from '../util/geometry.js';

/**
 * Validate a map definition ({ id, name?, layout: string[], hills? }) and build its board.
 * Throws with the offending row/column so a typo in a map file is easy to find.
 */
export function createBoard(map, terrain = TERRAIN) {
  const rows = map?.layout;
  const mapId = map?.id ?? '?';
  if (!Array.isArray(rows) || !rows.length) throw new Error(`map ${mapId} has no layout`);
  if (typeof rows[0] !== 'string' || rows[0].length === 0) throw new Error(`map ${mapId} row 0 must be a non-empty string`);
  if (!map?.id || typeof map.id !== 'string') throw new Error('map needs a string id');
  const width = rows[0].length;
  rows.forEach((row, r) => {
    if (typeof row !== 'string' || row.length !== width) {
      throw new Error(`map ${map.id} row ${r} has ${row?.length ?? 'invalid'} tiles, expected ${width}`);
    }
    for (let c = 0; c < width; c += 1) {
      if (!terrain[row[c]]) throw new Error(`map ${map.id} tile (${c}, ${r}) uses unknown terrain '${row[c]}'`);
    }
  });
  const height = rows.length;
  const terrainRules = deepFreeze(Object.fromEntries(Object.entries(terrain).map(([key, rule]) => [key, clone(rule)])));
  const inBounds = (c, r) => c >= 0 && r >= 0 && c < width && r < height;
  const terrainAt = (c, r) => (inBounds(c, r) ? rows[r][c] : undefined);
  const hills = (map.hills ?? []).map((position, index) => {
    if (!Array.isArray(position) || position.length !== 2 || !position.every(Number.isInteger)) {
      throw new Error(`map ${map.id} hill ${index} must be an integer [column, row] pair`);
    }
    const [c, r] = position;
    if (!inBounds(c, r)) throw new Error(`map ${map.id} hill (${c}, ${r}) is outside the board`);
    return Object.freeze([c, r]);
  });
  return Object.freeze({
    id: map.id,
    name: map.name ?? map.id,
    width,
    height,
    rows: Object.freeze([...rows]),
    hills: Object.freeze(hills),
    inBounds,
    terrainAt,
    /** Terrain rules record of a tile ({ name, def, avo, ... }). */
    tile: (c, r) => terrainRules[terrainAt(c, r)],
    /** [c, r] of the first tile with this letter (scanning rows north to south), or null. */
    findTile(letter) {
      for (let r = 0; r < height; r += 1) { const c = rows[r].indexOf(letter); if (c >= 0) return [c, r]; }
      return null;
    },
    /** Every tile in row-major order as { c, r, letter }. */
    *tiles() { for (let r = 0; r < height; r += 1) for (let c = 0; c < width; c += 1) yield { c, r, letter: rows[r][c] }; },
  });
}
