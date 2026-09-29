// The active map's grid as plain data: layout, size and terrain lookups. No Three.js, no DOM, so the
// rules (src/rules.js, src/combat.js), the match controller (src/match.js) and the Node simulator
// (tools/sim/) can all use it. src/map.js re-exports these and builds the 3D scene from them.
import { TERRAIN, parseLayout } from './terrain.js';
import MAP from './maps/river_ford.js';

export { MAP };
const GRID = parseLayout(MAP.layout);
export const LAYOUT = GRID.rows;
export const W = GRID.w;
export const H = GRID.h;
export { TERRAIN };

export const inBounds = (c, r) => c >= 0 && r >= 0 && c < W && r < H;
export const terrainAt = (c, r) => LAYOUT[r][c];
