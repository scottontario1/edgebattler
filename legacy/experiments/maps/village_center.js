// flat_open with two extra villages at the centre (7,4) and (8,7), one either side of the diagonal between the
// keeps. Capturing one gives its owner a forward deployment area (reinforcement location).
import { grid, VILLAGES } from './_grid.js';
export default { id: 'village_center', name: 'Flat field, central villages', hills: [], layout: grid({ villages: [...VILLAGES, [7, 4], [8, 7]] }) };
