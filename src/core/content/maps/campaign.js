// The three south-to-north campaign boards (12 x 18). Map ids differ from mission ids
// (road / woods / pass): mission N uses CAMPAIGN_MAPS[N - 1].
export const CAMPAIGN_MAPS = Object.freeze([
  Object.freeze({
    id: 'campaign-road', name: 'The North Road',
    layout: Object.freeze(['GGGGGGGGGGGG', 'GGGGGKGGGGGG', 'FFGGGGGGGGFF', 'FFGGGGGGGGFF', 'FFGGGGGGGGFF', 'FFGGGRRGGGFF', 'GGGGGVGGGGGG', 'GGGGGRRGGGGG', 'GGGGGRRGGGGG', 'GGGGGRRGGGGG', 'GGGGGRRGGGGG', 'GGGGGVGGGGGG', 'GGGGGRRGGGGG', 'FFGGGRRGGFFF', 'FFGGGGGGGGFF', 'FFGGGGGGGGFF', 'GGGGGCGGGGGG', 'GGGGGGGGGGGG']),
    hills: Object.freeze([[1, 2], [2, 2], [9, 14], [10, 14]]),
  }),
  Object.freeze({
    id: 'campaign-woodland', name: 'The Wooded Approach',
    layout: Object.freeze(['GGGGGGGGGGGG', 'GGGGGKGGGGGG', 'FFFGGGGGGFFF', 'FFFGGGGGGFFF', 'FFFGGGGGGFFF', 'FFFGGGGGGFFF', 'GGGGGVGGGGGG', 'FFFGGGGGGFFF', 'FFFGGGGGGFFF', 'FFFGGGGGGFFF', 'FFFGGGGGGFFF', 'GGGGGVGGGGGG', 'FFFGGGGGGFFF', 'FFFGGGGGGFFF', 'FFFGGGGGGFFF', 'FFFGGGGGGFFF', 'GGGGGCGGGGGG', 'GGGGGGGGGGGG']),
    hills: Object.freeze([[1, 2], [2, 3], [9, 3], [10, 2], [1, 13], [2, 14], [9, 14], [10, 13]]),
  }),
  Object.freeze({
    id: 'campaign-crossing', name: 'The Northern Pass',
    layout: Object.freeze(['GGGGGGGGGGGG', 'GGGGGKGGGGGG', 'GGFFGGGGFFGG', 'GGFFGGGGFFGG', 'GGFFGGGGFFGG', 'GGGGGRRGGGGG', 'GGGGGVGGGGGG', 'GGGGGRRGGGGG', 'GGGWWBWWGGGG', 'GGGWWBWWGGGG', 'GGGWWBWWGGGG', 'GGGGGVGGGGGG', 'GGGGGRRGGGGG', 'GGFFGGGGFFGG', 'GGFFGGGGFFGG', 'GGFFGGGGFFGG', 'GGGGGCGGGGGG', 'GGGGGGGGGGGG']),
    hills: Object.freeze([[2, 3], [9, 3], [2, 14], [9, 14]]),
  }),
]);
