import { W, H, TERRAIN, inBounds, terrainAt } from './board.js';
import { weaponOf } from './combat.js';

// Movement and range rules, shared by the player UI (src/ui.js) and the enemy AI (src/ai.js).
export const MOVE_COST = {
  foot: { G: 1, R: 1, B: 1, V: 1, C: 1, K: 1, F: 2, M: 3 },
  armor: { G: 1, R: 1, B: 1, V: 1, C: 1, K: 1, F: 2 },
  mounted: { G: 1, R: 1, B: 1, V: 1, C: 1, K: 1, F: 3 },
};
export const MOVE_TYPE = { knight: 'armor', paladin: 'armor', barbarian: 'armor', warlord: 'armor', cavalier: 'mounted' };
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const key = (c, r) => r * W + c;
export const unkey = (k) => [k % W, Math.floor(k / W)];
export const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);


// Fire Emblem style range: tiles you can reach, tiles you can hit from there, and the
// enemies you could actually strike (from an unoccupied reachable tile).
export function computeRange(unit, units, mov = unit.mov) {
  const costs = MOVE_COST[MOVE_TYPE[unit.cls] || 'foot'];
  const best = new Map([[key(unit.c, unit.r), 0]]);
  const prev = new Map(); // tile -> tile it was reached from, for path reconstruction
  const queue = [[unit.c, unit.r, 0]];
  while (queue.length) {
    queue.sort((a, b) => a[2] - b[2]);
    const [c, r, spent] = queue.shift();
    for (const [dc, dr] of DIRS) {
      const nc = c + dc, nr = r + dr;
      if (!inBounds(nc, nr)) continue;
      const cost = costs[terrainAt(nc, nr)];
      if (cost === undefined) continue;
      const occupant = units.unitAt(nc, nr);
      if (occupant && occupant.data.faction !== unit.faction) continue;
      const total = spent + cost;
      if (total > mov) continue;
      const k = key(nc, nr);
      if (best.has(k) && best.get(k) <= total) continue;
      best.set(k, total);
      prev.set(k, key(c, r));
      queue.push([nc, nr, total]);
    }
  }
  const move = [...best.keys()].map(unkey);
  const [minR, maxR] = weaponOf(unit).rng;
  const attack = new Set();
  const stand = move.filter(([c, r]) => {
    const o = units.unitAt(c, r);
    return !o || o.data === unit;
  });
  for (const [c, r] of move) {
    for (let dc = -maxR; dc <= maxR; dc++) {
      for (let dr = -maxR; dr <= maxR; dr++) {
        const d = Math.abs(dc) + Math.abs(dr);
        if (d < minR || d > maxR) continue;
        const nc = c + dc, nr = r + dr;
        if (inBounds(nc, nr) && !best.has(key(nc, nr))) attack.add(key(nc, nr));
      }
    }
  }
  // For each enemy in reach, the stand tile with the best terrain defence (then closest).
  const targets = new Map();
  for (const o of units.list) {
    if (o.data.faction === unit.faction || o.data.hp <= 0) continue;
    const pos = [o.data.c, o.data.r];
    const from = stand
      .filter((t) => { const d = dist(t, pos); return d >= minR && d <= maxR; })
      .sort((a, b) => TERRAIN[terrainAt(...b)].def - TERRAIN[terrainAt(...a)].def
        || dist(a, [unit.c, unit.r]) - dist(b, [unit.c, unit.r]))[0];
    if (from) targets.set(o.data.id, from);
  }
  // Tiles to walk (excluding the start) to reach (c, r); empty when unreachable or already there.
  const pathTo = (c, r) => {
    const out = [], start = key(unit.c, unit.r);
    for (let k = key(c, r); k !== start; k = prev.get(k)) {
      if (!prev.has(k)) return [];
      out.push(unkey(k));
    }
    return out.reverse();
  };
  return { move, attack: [...attack].map(unkey), targets, pathTo };
}

