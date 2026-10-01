// Fixture units and a toy range flood for the `?demo=world` screen. This is NOT the rules engine:
// movement costs here only exist so the move overlay has a believable shape to look at.

const COST = { G: 1, R: 1, B: 1, V: 1, C: 1, K: 1, F: 2, M: 3 }; // W is impassable

const unit = (id, cls, faction, c, r, extra = {}) => ({
  id, cls, faction, c, r, hp: 20, maxHp: 24, variantId: cls, ...extra,
});

const tooClose = (taken, c, r) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => taken.has(`${c + dc},${r + dr}`));

/** Tiles near `origin` that a demo unit can stand on, nearest first. */
function nearbyFree(board, origin, taken, count) {
  const found = [];
  for (let radius = 0; radius < 8 && found.length < count; radius += 1) {
    for (let dr = -radius; dr <= radius; dr += 1) {
      for (let dc = -radius; dc <= radius; dc += 1) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue;
        const c = origin[0] + dc;
        const r = origin[1] + dr;
        if (!board.inBounds(c, r) || !COST[board.terrainAt(c, r)] || taken.has(`${c},${r}`)) continue;
        if (board.terrainAt(c, r) === 'M') continue;
        if (tooClose(taken, c, r)) continue; // leave a gap so sprites do not overlap
        found.push([c, r]);
        taken.add(`${c},${r}`);
        if (found.length === count) return found;
      }
    }
  }
  return found;
}

/** Both armies around their keeps: heroes, recruits, a faction unit and a monster. */
export function buildDemoUnits(board) {
  const blueKeep = board.findTile('C') ?? [2, board.height - 2];
  const redKeep = board.findTile('K') ?? [board.width - 3, 1];
  const taken = new Set([`${blueKeep[0]},${blueKeep[1]}`, `${redKeep[0]},${redKeep[1]}`]);
  // Bring the front lines toward the middle so the screenshot shows contact.
  const mid = [Math.floor(board.width / 2), Math.floor(board.height / 2)];
  const toward = (keep, k) => [Math.round(keep[0] + (mid[0] - keep[0]) * k), Math.round(keep[1] + (mid[1] - keep[1]) * k)];
  const blueSpots = nearbyFree(board, toward(blueKeep, 0.45), taken, 6);
  const redSpots = nearbyFree(board, toward(redKeep, 0.45), taken, 6);
  const blue = [['brenna', 'paladin'], ['pike_b1', 'pikeman'], ['pike_b2', 'pikeman'], ['archer_b1', 'archer'], ['cav_b1', 'cavalier'], ['crown_b1', 'pikeman', { spriteKey: 'crownGuard' }]];
  const red = [['dreg', 'barbarian'], ['pike_r1', 'pikeman'], ['archer_r1', 'archer'], ['cav_r1', 'cavalier'], ['ogre_r1', 'pikeman', { spriteKey: 'monsterOgre', hp: 30, maxHp: 30 }], ['fang_r1', 'archer', { spriteKey: 'fangHunter' }]];
  const out = [];
  blue.forEach(([id, cls, extra], i) => blueSpots[i] && out.push(unit(id, cls, 'blue', blueSpots[i][0], blueSpots[i][1], { hp: 12 + ((i * 5) % 12), ...extra })));
  red.forEach(([id, cls, extra], i) => redSpots[i] && out.push(unit(id, cls, 'red', redSpots[i][0], redSpots[i][1], { hp: 10 + ((i * 7) % 14), ...extra })));
  return out;
}

/**
 * Flood fill from a unit: reachable tiles with their step cost, and the parent links for paths.
 * Other units block movement.
 */
export function demoReach(board, from, units, move = 5) {
  const blocked = new Set(units.filter((u) => u.id !== from.id).map((u) => `${u.c},${u.r}`));
  const best = new Map([[`${from.c},${from.r}`, 0]]);
  const parent = new Map();
  const queue = [[from.c, from.r]];
  while (queue.length) {
    queue.sort((a, b) => best.get(`${a[0]},${a[1]}`) - best.get(`${b[0]},${b[1]}`));
    const [c, r] = queue.shift();
    const cost = best.get(`${c},${r}`);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      const key = `${nc},${nr}`;
      if (!board.inBounds(nc, nr) || blocked.has(key)) continue;
      const step = COST[board.terrainAt(nc, nr)];
      if (!step || cost + step > move) continue;
      if (best.has(key) && best.get(key) <= cost + step) continue;
      best.set(key, cost + step);
      parent.set(key, [c, r]);
      queue.push([nc, nr]);
    }
  }
  const tiles = [...best.keys()].filter((k) => k !== `${from.c},${from.r}`).map((k) => k.split(',').map(Number));
  const pathTo = (c, r) => {
    const path = [[c, r]];
    let key = `${c},${r}`;
    while (parent.has(key)) {
      const p = parent.get(key);
      path.unshift(p);
      key = `${p[0]},${p[1]}`;
    }
    return path;
  };
  return { tiles, pathTo };
}
