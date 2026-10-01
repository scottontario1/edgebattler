// Smooth "membership fields" over the tile grid. Painting tile by tile gives debug-square maps; here
// every terrain kind is a 0..1 value per tile that is bilinearly interpolated between tile centres
// and warped by noise, so rivers meander, forests have ragged edges and roads curve softly.
// Pure (no canvas) so the field maths stays testable.
import { artFor } from './terrain-art.js';

export const FIELD_KINDS = ['water', 'road', 'rock', 'forest', 'yard', 'pave', 'hill'];

/** One Float32Array (cols * rows) of 0/1 per kind. */
export function buildFields(board) {
  const { width: cols, height: rows } = board;
  const fields = Object.fromEntries(FIELD_KINDS.map((kind) => [kind, new Float32Array(cols * rows)]));
  for (const { c, r, letter } of board.tiles()) {
    const art = artFor(letter);
    const i = r * cols + c;
    if (art.ground === 'water') fields.water[i] = 1;
    if (art.ground === 'rock') fields.rock[i] = 1;
    if (art.ground === 'forest') fields.forest[i] = 1;
    if (art.road) fields.road[i] = 1;
    if (art.yard) fields.yard[i] = 1;
    if (art.pave) fields.pave[i] = 1;
  }
  for (const [c, r] of board.hills) fields.hill[r * cols + c] = 1;
  return fields;
}

/**
 * Bilinear sample of a field at (u, v) in tile units where integer coordinates are tile centres.
 * Tiles outside the board repeat the nearest edge tile so rivers run off the map instead of ending.
 */
export function sampleField(field, cols, rows, u, v) {
  const i0 = Math.floor(u);
  const j0 = Math.floor(v);
  const fu = u - i0;
  const fv = v - j0;
  const ia = i0 < 0 ? 0 : i0 >= cols ? cols - 1 : i0;
  const ib = i0 + 1 < 0 ? 0 : i0 + 1 >= cols ? cols - 1 : i0 + 1;
  const ja = j0 < 0 ? 0 : j0 >= rows ? rows - 1 : j0;
  const jb = j0 + 1 < 0 ? 0 : j0 + 1 >= rows ? rows - 1 : j0 + 1;
  const a = field[ja * cols + ia];
  const b = field[ja * cols + ib];
  const c = field[jb * cols + ia];
  const d = field[jb * cols + ib];
  return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
}

/**
 * Which way a bridge tile carries traffic: 'ns' when water lies to its east or west (a river running
 * east-west is crossed north-south), otherwise 'ew'.
 */
export function bridgeAxis(board, c, r) {
  const isWater = (cc, rr) => board.inBounds(cc, rr) && artFor(board.terrainAt(cc, rr)).ground === 'water'
    && !artFor(board.terrainAt(cc, rr)).bridge;
  return isWater(c - 1, r) || isWater(c + 1, r) ? 'ns' : 'ew';
}
