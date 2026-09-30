// A mountain ridge down columns 7-8 with two one-tile passes (rows 3 and 8; mountains cost 3 to cross on foot and
// stop cavalry), a forest beside each pass, and villages behind each side's pass: blue 4,8 and 6,10 plus 5,2;
// red 13,4, 9,1 and 10,8. Keeps stay at C 2,10 / K 12,1.
import { grid } from './_grid.js';
const ridge = (c, r) => (c === 7 && r !== 3 && r !== 8) || (c === 8 && r >= 4 && r <= 6);
const wood = (c, r) => (c === 6 && (r === 3 || r === 8)) || (c === 9 && (r === 3 || r === 8));
export default { id: 'ridge_line', name: 'Ridge line', hills: [], layout: grid({
  villages: [[4, 8], [6, 10], [5, 2], [13, 4], [9, 1], [10, 8]],
  paint: (c, r) => (ridge(c, r) ? 'M' : wood(c, r) ? 'F' : null) }) };
