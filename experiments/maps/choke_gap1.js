// Two-wide river along columns 7-8 with a single crossing lane (row 5, plains). Same geometry as river_ford's
// bridge without forests, mountains or the second bank features: a pure one-tile chokepoint.
import { grid } from './_grid.js';
export default { id: 'choke_gap1', name: 'River with one-tile crossing', hills: [], layout: grid({ paint: (c, r) => ((c === 7 || c === 8) && r !== 5 ? 'W' : null) }) };
