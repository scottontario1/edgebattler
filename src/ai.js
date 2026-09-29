import { computeRange, dist } from './rules.js';
import { forecast } from './combat.js';
import { TERRAIN, terrainAt } from './board.js';

// Enemy behaviour, one unit at a time: strike the best target it can reach this turn, otherwise walk
// toward the nearest player unit. Returns { path, attack } where `path` is the tiles to walk
// (possibly empty) and `attack` the defender's unit data, or null to stand still. Pure decision
// logic: the caller animates and applies it (src/ui.js `enemyPhase`).
export function chooseAction(unit, units) {
  const range = computeRange(unit, units);
  const foes = units.list.filter((o) => o.data.faction !== unit.faction && o.data.hp > 0).map((o) => o.data);
  if (!foes.length) return null;

  // 1. Best strike: expected damage, with a large bonus for a kill.
  let best = null;
  for (const [id, from] of range.targets) {
    const d = units.byId.get(id).data;
    const f = forecast(unit, d, from).atk;
    const score = (f.dmg * f.hit) / 100 + (f.dmg >= d.hp ? 50 : 0) + TERRAIN[terrainAt(...from)].def;
    if (!best || score > best.score) best = { score, from, d };
  }
  if (best) return { path: range.pathTo(...best.from), attack: best.d };

  // 2. Advance: the reachable free tile closest to the nearest foe (ties go to better cover).
  const nearest = (t) => Math.min(...foes.map((f) => dist(t, [f.c, f.r])));
  const free = range.move.filter(([c, r]) => {
    const o = units.unitAt(c, r);
    return !o || o.data === unit;
  });
  free.sort((a, b) => nearest(a) - nearest(b) || TERRAIN[terrainAt(...b)].def - TERRAIN[terrainAt(...a)].def);
  const to = free[0];
  if (!to || (to[0] === unit.c && to[1] === unit.r)) return null;
  return { path: range.pathTo(...to), attack: null };
}
