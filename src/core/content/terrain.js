// Terrain rules: what each map letter means to the game. Presentation (heights, ground paint, props)
// lives with the renderer in src/game/world/, so the rules never depend on how a tile is drawn.
//
//   name     shown in the HUD
//   def/avo  combat bonuses for the unit standing on the tile (defence, avoid %)
//   keep     the side that starts owning this keep ('blue' | 'red')
//   village  a capturable village (neutral at the start)
//
// Movement costs per movement type live in src/core/rules/movement.js; a letter missing from a
// movement table is impassable for that type (that is how rivers block everyone).
export const TERRAIN = Object.freeze({
  G: Object.freeze({ id: 'G', name: 'Plains', def: 0, avo: 0 }),
  F: Object.freeze({ id: 'F', name: 'Forest', def: 1, avo: 20 }),
  M: Object.freeze({ id: 'M', name: 'Mountain', def: 2, avo: 30 }),
  W: Object.freeze({ id: 'W', name: 'River', def: 0, avo: 0 }),
  R: Object.freeze({ id: 'R', name: 'Road', def: 0, avo: 0 }),
  B: Object.freeze({ id: 'B', name: 'Bridge', def: 0, avo: 0 }),
  V: Object.freeze({ id: 'V', name: 'Village', def: 0, avo: 10, village: true }),
  C: Object.freeze({ id: 'C', name: 'Castle', def: 3, avo: 30, keep: 'blue' }),
  K: Object.freeze({ id: 'K', name: 'Castle', def: 3, avo: 30, keep: 'red' }),
});
