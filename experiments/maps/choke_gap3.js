// Same river, crossing three tiles wide (rows 4-6): the chokepoint width is the only difference from choke_gap1.
import { grid } from './_grid.js';
export default { id: 'choke_gap3', name: 'River with three-tile crossing', hills: [], layout: grid({ paint: (c, r) => ((c === 7 || c === 8) && (r < 4 || r > 6) ? 'W' : null) }) };
