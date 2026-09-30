// Registers the experiment maps for the level loader (Vite glob; Node tests call registerMaps themselves).
import { registerMaps } from './levels.js';

const found = import.meta.glob('../experiments/maps/*.js', { eager: true });
const maps = {};
for (const [path, mod] of Object.entries(found)) {
  const name = path.split('/').pop().replace(/\.js$/, '');
  if (name.startsWith('_') || !mod.default?.layout) continue;
  maps[name] = mod.default;
}
registerMaps(maps);
