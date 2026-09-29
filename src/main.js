// Entry point: preload assets the terrain painters need, then start the game. The game module is
// imported dynamically so its top-level scene setup (map painting) sees the loaded textures.
// New preloads (tilesets, sprite atlases, map data) belong in this list.
import { loadPaint } from './paint.js';

bootstrap();

async function bootstrap() {
  try {
    await Promise.all([loadPaint()]);
  } catch (err) {
    console.warn('asset preload failed, starting with procedural terrain only', err);
  }
  await import('./game.js');
}
