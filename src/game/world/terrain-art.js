// Presentation table for terrain: what each map letter looks like. The rules' TERRAIN table in
// src/core/content/terrain.js says what a tile *does*; this says how it is painted. Adding a terrain
// type means one entry in each.
//
// ground  paint class of the base layer: grass | forest | rock | water | (road/yard/pave are overlays)
// road    the tile carries a dirt road
// yard    trampled village ground around the centre
// pave    flagstone court (keeps)
// props   what is planted on the tile: [kind, density] where density is a count per tile

export const GROUND_COLORS = Object.freeze({
  grassLight: '#7fa84a',
  grassDark: '#5c8a3a',
  forest: '#41703a',
  forestDark: '#2f5a33',
  rock: '#8d8576',
  rockDark: '#6c6559',
  dirt: '#b39466',
  dirtDark: '#8c6f48',
  yard: '#b9a070',
  pave: '#a9a39a',
  paveDark: '#827d76',
  mud: '#6f6246',
  shallow: '#5aa3a3',
  water: '#2d7a8c',
  deep: '#1d5671',
  foam: '#e4f2ee',
  plank: '#8d6a3f',
  plankDark: '#5e4426',
  ink: '#1d1a24',
});

export const TERRAIN_ART = Object.freeze({
  G: Object.freeze({ ground: 'grass', props: [['bush', 0.18], ['flower', 0.25]] }),
  F: Object.freeze({ ground: 'forest', props: [['pine', 2.4], ['oak', 1.4], ['bush', 0.4]] }),
  M: Object.freeze({ ground: 'rock', props: [['crag', 1.5], ['rubble', 1.6]] }),
  W: Object.freeze({ ground: 'water', props: [] }),
  R: Object.freeze({ ground: 'grass', road: true, props: [] }),
  B: Object.freeze({ ground: 'water', bridge: true, props: [] }),
  V: Object.freeze({ ground: 'grass', yard: true, props: [['cottage', 1]] }),
  C: Object.freeze({ ground: 'grass', pave: true, props: [['keep', 1]] }),
  K: Object.freeze({ ground: 'grass', pave: true, props: [['keep', 1]] }),
});

export const FACTION_COLORS = Object.freeze({
  blue: 0x2f62c4,
  red: 0xc0392b,
  neutral: 0xc9c2ae,
});

/** Art entry for a terrain letter; unknown letters paint as plain grass. */
export const artFor = (letter) => TERRAIN_ART[letter] ?? TERRAIN_ART.G;
