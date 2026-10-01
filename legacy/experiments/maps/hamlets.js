// Flat field with terrain and more villages. Each side has two villages near its keep (blue 4,8 and 7,10; red 13,4
// and 9,1) plus a contested one on each flank (5,2 and 10,9). Features: two forest clumps (5-6,6-7 and 9-10,4-5),
// a small lake in the centre (7-8,5 and 8,6) and two mountain outcrops (7,4 and 8,7). Keeps stay at C 2,10 / K 12,1.
import { grid } from './_grid.js';
const forest = (c, r) => (c >= 5 && c <= 6 && r >= 6 && r <= 7) || (c >= 9 && c <= 10 && r >= 4 && r <= 5);
const lake = (c, r) => (r === 5 && (c === 7 || c === 8)) || (c === 8 && r === 6);
const rock = (c, r) => (c === 7 && r === 4) || (c === 8 && r === 7);
export default { id: 'hamlets', name: 'Hamlets', hills: [], layout: grid({
  villages: [[4, 8], [7, 10], [5, 2], [13, 4], [9, 1], [10, 9]],
  paint: (c, r) => (lake(c, r) ? 'W' : rock(c, r) ? 'M' : forest(c, r) ? 'F' : null) }) };
