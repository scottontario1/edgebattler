import { TERRAIN, terrainAt } from './map.js';

// Weapon stats: might, hit, crit, min/max range, kind (weapon triangle) and whether it hits RES.
export const WEAPONS = {
  'Silver Rapier': { mt: 7, hit: 90, crit: 10, rng: [1, 1], kind: 'sword' },
  'Iron Lance': { mt: 7, hit: 80, crit: 0, rng: [1, 1], kind: 'lance' },
  'Steel Lance': { mt: 9, hit: 75, crit: 0, rng: [1, 1], kind: 'lance' },
  Longbow: { mt: 6, hit: 75, crit: 0, rng: [2, 2], kind: 'bow' },
  'Steel Bow': { mt: 8, hit: 70, crit: 0, rng: [2, 2], kind: 'bow' },
  'Fire Staff': { mt: 5, hit: 90, crit: 0, rng: [1, 2], kind: 'tome', magic: true },
  Flux: { mt: 7, hit: 80, crit: 0, rng: [1, 2], kind: 'tome', magic: true },
  'Great Axe': { mt: 12, hit: 65, crit: 5, rng: [1, 1], kind: 'axe' },
  'Hand Axe': { mt: 7, hit: 60, crit: 0, rng: [1, 1], kind: 'axe' },
};

// Sword beats axe, axe beats lance, lance beats sword: +1 damage, +15 hit.
const BEATS = { sword: 'axe', axe: 'lance', lance: 'sword' };
const triangle = (a, b) => (BEATS[a] === b ? 1 : BEATS[b] === a ? -1 : 0);

export const weaponOf = (u) => WEAPONS[u.weapon] || { mt: 5, hit: 70, crit: 0, rng: [1, 1], kind: 'none' };

// One side of a Fire Emblem style forecast: `a` attacks `d` from tile `from` at `dist`.
function side(a, d, dist, aTile, dTile) {
  const w = weaponOf(a), wd = weaponOf(d);
  const ter = TERRAIN[terrainAt(...dTile)];
  const tri = triangle(w.kind, wd.kind);
  const inRange = dist >= w.rng[0] && dist <= w.rng[1];
  const power = (w.magic ? a.mag : a.str) + w.mt + tri;
  const guard = (w.magic ? d.res : d.def) + ter.def;
  const hit = w.hit + a.skl * 2 + tri * 15 - (d.spd * 2 + ter.avo);
  return {
    can: inRange,
    dmg: Math.max(0, power - guard),
    hit: Math.max(0, Math.min(100, Math.round(hit))),
    crit: Math.max(0, Math.min(100, Math.round(w.crit + a.skl / 2 - d.skl / 4))),
    double: a.spd - d.spd >= 4,
    tri,
    tile: aTile,
  };
}

// Forecast for attacker `a` striking `d` from tile `from`.
export function forecast(a, d, from) {
  const dist = Math.abs(from[0] - d.c) + Math.abs(from[1] - d.r);
  return {
    dist,
    from,
    atk: side(a, d, dist, from, [d.c, d.r]),
    def: side(d, a, dist, [d.c, d.r], from),
  };
}
