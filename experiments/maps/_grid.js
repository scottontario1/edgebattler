// Helper for experiment maps: a 16 x 12 grid of plains with the two keeps and three village plots at the
// river_ford coordinates, plus whatever the map paints over it. Not a map itself (leading underscore).
export const KEEPS = { C: [2, 10], K: [12, 1] };
export const VILLAGES = [[5, 2], [13, 4], [4, 8]];
export function grid({ villages = VILLAGES, paint = () => null } = {}) {
  const rows = Array.from({ length: 12 }, (_, r) => Array.from({ length: 16 }, (_, c) => paint(c, r) ?? 'G'));
  for (const [c, r] of villages) rows[r][c] = 'V';
  rows[KEEPS.C[1]][KEEPS.C[0]] = 'C';
  rows[KEEPS.K[1]][KEEPS.K[0]] = 'K';
  return rows.map((row) => row.join(''));
}
