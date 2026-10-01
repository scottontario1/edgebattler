// Skirmish map. Row 0 is the north edge; columns increase east.
// G plains, F forest, M mountain, W river, B bridge, R road, V village, C blue keep, K red keep.
// `hills` is presentation metadata ([column, row] tiles drawn raised); only letters affect rules.
export default Object.freeze({
  id: 'river_ford',
  name: 'The River Ford',
  layout: Object.freeze([
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
  ]),
  hills: Object.freeze([[1, 2], [2, 2], [1, 3], [2, 1], [10, 9], [11, 9], [9, 10], [10, 10], [11, 10]]),
});
