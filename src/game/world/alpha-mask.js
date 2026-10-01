// Alpha lookup for sprite picking: a click on a transparent pixel must fall through to whatever is
// behind. Sampled once per texture from its source image and cached per scene.

const cache = new WeakMap(); // textureManager -> Map(key -> mask)

/**
 * @returns {{ w: number, h: number, alphaAt: (x: number, y: number) => number } | null} x, y in texture
 *          pixels (0..w, 0..h); null when the texture has no readable source image
 */
export function alphaMaskFor(textures, key) {
  let perManager = cache.get(textures);
  if (!perManager) cache.set(textures, (perManager = new Map()));
  if (perManager.has(key)) return perManager.get(key);
  let mask = null;
  const image = textures.exists(key) ? textures.get(key).getSourceImage() : null;
  if (image && image.width) {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const w = canvas.width;
    const h = canvas.height;
    mask = {
      w,
      h,
      alphaAt(x, y) {
        const ix = x < 0 ? 0 : x >= w ? w - 1 : Math.floor(x);
        const iy = y < 0 ? 0 : y >= h ? h - 1 : Math.floor(y);
        return data[(iy * w + ix) * 4 + 3];
      },
    };
  }
  perManager.set(key, mask);
  return mask;
}
