// The active map's grid as plain data: layout, size and terrain lookups. No Three.js, no DOM, so the
// rules (src/rules.js, src/combat.js), the match controller (src/match.js) and the Node simulator
// (tools/sim/) can all use it. src/map.js re-exports these and builds the 3D scene from them.
import { TERRAIN, parseLayout } from './terrain.js';
import MAP_DEFAULT from './maps/river_ford.js';

export { TERRAIN };
export const DEFAULT_MAP = MAP_DEFAULT;

// Live bindings: setMap() below swaps the grid in place for experiments (tools/sim, experiments/).
// The game itself never calls it, so the shipped map stays river_ford.
export let MAP = MAP_DEFAULT;
export let LAYOUT;
export let W;
export let H;

/** Make `map` (plain data: id + ASCII layout) the active grid. Returns the previous map. */
export function setMap(map = MAP_DEFAULT) {
  const previous = MAP;
  const grid = parseLayout(map.layout);
  MAP = map;
  LAYOUT = grid.rows;
  W = grid.w;
  H = grid.h;
  return previous;
}
setMap(MAP_DEFAULT);

export const inBounds = (c, r) => c >= 0 && r >= 0 && c < W && r < H;
export const terrainAt = (c, r) => LAYOUT[r][c];
/** [c, r] of the first tile with this map letter (C blue keep, K red keep), or null. */
export function findTile(letter) {
  for (let r = 0; r < H; r += 1) { const c = LAYOUT[r].indexOf(letter); if (c >= 0) return [c, r]; }
  return null;
}
