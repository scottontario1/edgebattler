// flat_open plus one forest tile at 8,5 (defence +1, avoid +20), for single-unit terrain comparisons.
import { grid } from './_grid.js';
export default { id: 'flat_forest_tile', name: 'Flat field, one forest tile', hills: [], layout: grid({ paint: (c, r) => (c === 8 && r === 5 ? 'F' : null) }) };
