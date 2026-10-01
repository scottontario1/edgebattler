// Where props stand. Pure: board + seed in, a list of placements out, so layout is deterministic
// (the same map always plants the same trees) and testable without a canvas.
import { TILE_W, TILE_H, tileCenterX, tileCenterY } from './projection.js';
import { artFor } from './terrain-art.js';
import { createRng, hashString } from './noise.js';

/** Number of texture variants painted per prop kind (BattleScene/TerrainLayer create exactly these). */
export const VARIANTS = Object.freeze({ pine: 4, oak: 3, bush: 3, flower: 2, crag: 6, rubble: 3, cottage: 4, keep: 2 });

/** Kinds tall enough to hide a unit; they fade when one stands behind them. */
export const TALL_KINDS = new Set(['pine', 'oak', 'crag', 'cottage', 'keep']);

/**
 * @returns {{ kind: string, variant: number, x: number, footY: number, scale: number, c: number, r: number,
 *             owner?: 'blue'|'red' }[]} sorted by footY so depth ties break north to south
 */
export function layoutProps(board, seed = 1) {
  const rand = createRng(hashString(board.id) ^ (seed * 2654435761));
  const out = [];
  for (const { c, r, letter } of board.tiles()) {
    const art = artFor(letter);
    const cx = tileCenterX(c);
    const cy = tileCenterY(r);
    for (const [kind, density] of art.props) {
      if (kind === 'keep') {
        out.push({ kind, variant: letter === 'K' ? 1 : 0, x: cx, footY: cy - 6, scale: 1, c, r, owner: letter === 'K' ? 'red' : 'blue' });
        continue;
      }
      if (kind === 'cottage') {
        out.push({ kind, variant: (c * 7 + r * 3) % VARIANTS.cottage, x: cx - 15, footY: cy - 8, scale: 1.3, c, r });
        continue;
      }
      let count = Math.floor(density);
      if (rand() < density - count) count += 1;
      for (let i = 0; i < count; i += 1) {
        // Trees spill slightly over the tile edge so a forest reads as one canopy, not a grid.
        const spread = kind === 'pine' || kind === 'oak' || kind === 'crag' ? 1.1 : 0.9;
        // Clamped so nothing is planted outside the painted board.
        const x = Math.min(board.width * TILE_W - 10, Math.max(10, cx + (rand() - 0.5) * TILE_W * spread));
        const footY = Math.min(board.height * TILE_H - 4, Math.max(14, cy + (rand() - 0.5) * TILE_H * spread + 6));
        const crag = kind === 'crag';
        out.push({
          kind,
          variant: Math.floor(rand() * VARIANTS[kind]),
          x,
          footY,
          scale: crag ? 0.8 + rand() * 0.6 : 0.88 + rand() * 0.24,
          c,
          r,
        });
      }
    }
  }
  return out.sort((a, b) => a.footY - b.footY);
}
