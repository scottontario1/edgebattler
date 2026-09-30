// Entry point: preload assets the terrain painters need, then start the game. The game module is
// imported dynamically so its top-level scene setup (map painting) sees the loaded textures.
// New preloads (tilesets, sprite atlases, map data) belong in this list.
// The start menu (src/menu.js) shows first when the URL has no game flags, or with ?menu=1; ?nomenu=1 (or any flag) starts the game directly.
import { loadPaint } from './paint.js';

const q = new URLSearchParams(location.search);
const menuWanted = q.get('menu') === '1' || (![...q.keys()].length);

bootstrap();

async function bootstrap() {
  if (menuWanted) {
    const { showMenu } = await import('./menu.js');
    await import('./level-maps.js');
    showMenu();
    return;
  }
  try {
    await Promise.all([loadPaint()]);
  } catch (err) {
    console.warn('asset preload failed, starting with procedural terrain only', err);
  }
  await import('./game.js');
}
