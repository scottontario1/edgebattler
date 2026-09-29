// Painted detail maps: the asset side of the hand-painted terrain look.
//
// tools/assets/prep_terrain_textures.py turns the CC0 watercolor pack into neutral-grey detail maps
// (public/textures/painted/<set>_<n>.jpg). `loadPaint()` fetches them before the game starts
// (src/main.js), and the terrain painters (src/textures.js) blend them over procedural colour with
// `soft-light`/`overlay`, so the map keeps its own layout, palette and lighting and gains brush-like
// variation. A set that fails to load is simply absent: every consumer treats `null` as "skip".
//
// To add a material family: drop sources in art/textures/<pack>/, add the set to PAINT_SETS with the
// number of variants, rerun the prep script, and reference it by name from a terrain layer.

/** set name -> number of variants (files are `<set>_<1..n>.jpg`). */
export const PAINT_SETS = { grass: 4, dirt: 4, stone: 4, water: 4 };

const tiles = new Map(); // 'grass_1' -> canvas

const loadImage = (url) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(`paint texture failed: ${url}`));
  img.src = url;
});

/** Fetch every detail map. Never rejects: missing files just leave that variant unavailable. */
export async function loadPaint(base = `${import.meta.env.BASE_URL}textures/painted/`) {
  const jobs = [];
  for (const [set, count] of Object.entries(PAINT_SETS)) {
    for (let i = 1; i <= count; i++) {
      const key = `${set}_${i}`;
      jobs.push(loadImage(`${base}${key}.jpg`).then((img) => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        tiles.set(key, c);
      }).catch((err) => console.warn(err.message)));
    }
  }
  await Promise.all(jobs);
  return tiles.size;
}

/** A tileable detail-map canvas, or null when it is not loaded. `n` wraps around the variants. */
export function paintTile(set, n = 1) {
  const count = PAINT_SETS[set];
  if (!count) return null;
  return tiles.get(`${set}_${((((n - 1) % count) + count) % count) + 1}`) ?? null;
}
