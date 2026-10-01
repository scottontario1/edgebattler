// flat_open with a chain of villages along the diagonal between the keeps at (6,7), (8,5) and (10,3), so a side
// that pushes forward can move its reinforcement point with it (tests the supply-line hypothesis).
import { grid, VILLAGES } from './_grid.js';
export default { id: 'village_chain', name: 'Flat field, village chain', hills: [], layout: grid({ villages: [...VILLAGES, [6, 7], [8, 5], [10, 3]] }) };
