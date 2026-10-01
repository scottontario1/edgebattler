// Movement and range rules, shared by the planning UI, the AI and the match controller.
//
// Nothing here reads a global: the grid is a board (src/core/rules/board.js), unit positions come
// through an occupancy adapter, and weapons and movement types come from a content context.
import { tileDistance } from '../util/geometry.js';

/**
 * Movement cost per terrain letter, by movement type. A letter missing from a table is impassable
 * for that type; that is how rivers block everyone and mountains block armour and cavalry.
 */
export const MOVE_COST = Object.freeze({
  foot: Object.freeze({ G: 1, R: 1, B: 1, V: 1, C: 1, K: 1, F: 2, M: 3 }),
  armor: Object.freeze({ G: 1, R: 1, B: 1, V: 1, C: 1, K: 1, F: 2 }),
  mounted: Object.freeze({ G: 1, R: 1, B: 1, V: 1, C: 1, K: 1, F: 3 }),
});

const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * @typedef {Object} Occupancy
 * @property {(c: number, r: number) => (object|null|undefined)} unitAt  the living record or object on a tile
 * @property {object[]} list  every record that can block or be targeted (units, then blocking objects)
 */

/**
 * Occupancy over a list of plain records (units, and objects such as barricades). `unitAt` returns the
 * first record with hp > 0 on the tile, like the legacy match board adapter.
 * @param {object[]} records
 * @returns {Occupancy}
 */
export function occupancyFromRecords(records) {
  const list = [...records];
  return {
    list,
    unitAt: (c, r) => list.find((record) => record.hp > 0 && record.c === c && record.r === r),
  };
}

/** Movement cost table of a unit (by class). */
export function moveCostsFor(unit, content) {
  return MOVE_COST[content.moveTypeOf(unit)];
}

/**
 * Tiles a unit can reach, tiles it can hit from there, the enemies it could actually strike (from an
 * unoccupied reachable tile) and a path finder.
 *
 * Search order matches the legacy implementation exactly (a cost-sorted frontier, ties kept in
 * insertion order) because `pathTo` and the AI's tile choices depend on it.
 *
 * @param {object} unit
 * @param {import('./board.js').Board} board
 * @param {Occupancy} occupancy
 * @param {object} options
 * @param {object} options.content         content context (weapons and movement types)
 * @param {number} [options.mov]           movement allowance (default: the unit's Mov)
 * @param {boolean} [options.blockAllies]  allies block movement too (timed battle pursuit)
 * @returns {{ move: number[][], attack: number[][], targets: Map<string, number[]>, pathTo: (c: number, r: number) => number[][] }}
 */
export function computeRange(unit, board, occupancy, { content, mov = unit.mov, blockAllies = false } = {}) {
  if (!content) throw new Error('computeRange needs options.content');
  const costs = moveCostsFor(unit, content);
  const width = board.width;
  const key = (c, r) => r * width + c;
  const unkey = (k) => [k % width, Math.floor(k / width)];

  const bestCost = new Map([[key(unit.c, unit.r), 0]]);
  const cameFrom = new Map();
  const frontier = [[unit.c, unit.r, 0]];

  while (frontier.length) {
    frontier.sort((a, b) => a[2] - b[2]);
    const [c, r, spent] = frontier.shift();
    for (const [dc, dr] of DIRECTIONS) {
      const nc = c + dc;
      const nr = r + dr;
      if (!board.inBounds(nc, nr)) continue;
      const cost = costs[board.terrainAt(nc, nr)];
      if (cost === undefined) continue;
      const occupant = occupancy.unitAt(nc, nr);
      if (occupant && (occupant.faction !== unit.faction || (blockAllies && occupant.id !== unit.id))) continue;
      const total = spent + cost;
      if (total > mov) continue;
      const k = key(nc, nr);
      if (bestCost.has(k) && bestCost.get(k) <= total) continue;
      bestCost.set(k, total);
      cameFrom.set(k, key(c, r));
      frontier.push([nc, nr, total]);
    }
  }

  const move = [...bestCost.keys()].map(unkey);
  const [minRange, maxRange] = content.weaponOf(unit).rng;

  // Tiles in weapon reach of any reachable tile that are not themselves reachable.
  const attack = new Set();
  for (const [c, r] of move) {
    for (let dc = -maxRange; dc <= maxRange; dc += 1) {
      for (let dr = -maxRange; dr <= maxRange; dr += 1) {
        const distance = Math.abs(dc) + Math.abs(dr);
        if (distance < minRange || distance > maxRange) continue;
        const nc = c + dc;
        const nr = r + dr;
        if (board.inBounds(nc, nr) && !bestCost.has(key(nc, nr))) attack.add(key(nc, nr));
      }
    }
  }

  // Reachable tiles the unit may end on: free, or its own.
  const stand = move.filter(([c, r]) => {
    const occupant = occupancy.unitAt(c, r);
    return !occupant || occupant === unit || occupant.id === unit.id;
  });

  // For each enemy in reach, the stand tile with the best terrain defence (then closest to the unit).
  const targets = new Map();
  const origin = [unit.c, unit.r];
  for (const other of occupancy.list) {
    if (other.faction === unit.faction || other.hp <= 0 || other.kind === 'object') continue;
    const position = [other.c, other.r];
    const from = stand
      .filter((tile) => {
        const distance = tileDistance(tile, position);
        return distance >= minRange && distance <= maxRange;
      })
      .sort((a, b) => board.tile(...b).def - board.tile(...a).def || tileDistance(a, origin) - tileDistance(b, origin))[0];
    if (from) targets.set(other.id, from);
  }

  /** Tiles to walk (excluding the start) to reach (c, r); empty when unreachable or already there. */
  function pathTo(c, r) {
    const path = [];
    const start = key(unit.c, unit.r);
    for (let k = key(c, r); k !== start; k = cameFrom.get(k)) {
      if (!cameFrom.has(k)) return [];
      path.push(unkey(k));
    }
    return path.reverse();
  }

  return { move, attack: [...attack].map(unkey), targets, pathTo };
}
