// Terrain registry: the single source of truth for what each map character means. Gameplay (defence,
// avoidance), geometry (block height) and painting (which ground class the atlas paints it as) all
// read from here, so adding a terrain type is one entry plus, if it needs new visuals, a ground class
// in src/textures.js `terrainAtlas`.
//
//   name    shown in the HUD
//   def/avo combat bonuses (src/combat.js, src/ui.js)
//   h       height of the tile block above its level base, in world units
//   ground  ground class the atlas paints: 'grass' | 'forest' | 'village' | 'rock' | 'stone' | 'bed'
//   props   what src/map.js scatters on the tile ('trees', 'crags', 'village', 'castle', ...)
//   water   true for tiles the river surface covers (river, bridge)
export const TERRAIN = {
  G: { name: 'Plains', def: 0, avo: 0, h: 0.22, ground: 'grass' },
  F: { name: 'Forest', def: 1, avo: 20, h: 0.22, ground: 'forest', props: 'trees' },
  M: { name: 'Mountain', def: 2, avo: 30, h: 0.3, ground: 'rock', props: 'crags' },
  W: { name: 'River', def: 0, avo: 0, h: 0.05, ground: 'bed', water: true },
  R: { name: 'Road', def: 0, avo: 0, h: 0.22, ground: 'grass' },
  B: { name: 'Bridge', def: 0, avo: 0, h: 0.05, ground: 'bed', water: true },
  V: { name: 'Village', def: 0, avo: 10, h: 0.22, ground: 'village', props: 'village' },
  C: { name: 'Castle', def: 3, avo: 30, h: 0.24, ground: 'stone', props: 'castle' },
  K: { name: 'Castle', def: 3, avo: 30, h: 0.24, ground: 'stone', props: 'castle' },
};

/**
 * Validate an ASCII layout (row 0 = far/north edge) against the registry and return its size.
 * Throws with the offending row/column so a typo in a map file is easy to find.
 */
export function parseLayout(rows, terrain = TERRAIN) {
  const w = rows[0]?.length ?? 0;
  rows.forEach((row, r) => {
    if (row.length !== w) throw new Error(`map row ${r} has ${row.length} tiles, expected ${w}`);
    [...row].forEach((ch, c) => {
      if (!terrain[ch]) throw new Error(`map tile (${c}, ${r}) uses unknown terrain '${ch}'`);
    });
  });
  return { w, h: rows.length, rows };
}
