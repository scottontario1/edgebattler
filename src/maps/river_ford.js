// Chapter I map data. A map is plain data: an ASCII layout over the terrain registry (src/terrain.js)
// plus per-map features. src/map.js builds geometry and painting from whichever map it is given.
//
// Layout: row 0 is the far (north) edge, row 11 the near edge.
// G plains, F forest, M mountain, W river, B bridge, R road, V village, C blue castle, K red castle.
export default {
  id: 'river_ford',
  name: 'The River Ford',
  layout: [
    'MMMFGGGWGGGFFMMM',
    'MMFFGGGWGGRRKGMM',
    'MFFGGVGWGGRGGGFM',
    'FFGGGGGWWGRGFFFM',
    'FGGGFFGGWGRGGVFF',
    'GGRRRRRRBRRGGGFF',
    'GGRGFFGGWGGGFFGG',
    'FGRGGGGWWGGMMGGF',
    'FGRGVGGWGGGMMMGF',
    'MGRRGGWWGGFFGGFM',
    'MMCRGGWGGFFFGGMM',
    'MMMGGFWGGFFGMMMM',
  ],
  // Wooded hills that rise to level 2 like mountains, as [column, row].
  hills: [[1, 2], [2, 2], [1, 3], [2, 1], [10, 9], [11, 9], [9, 10], [10, 10], [11, 10]],
};
