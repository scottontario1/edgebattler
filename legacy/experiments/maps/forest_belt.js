// A 4-column forest belt (columns 6-9) across the whole middle: forest costs 2 (foot) / 3 (mounted) to enter,
// gives the defender +1 defence and +20 avoid. No river, so it is a slow, defensible zone rather than a wall.
import { grid } from './_grid.js';
export default { id: 'forest_belt', name: 'Forest belt', hills: [], layout: grid({ paint: (c) => (c >= 6 && c <= 9 ? 'F' : null) }) };
