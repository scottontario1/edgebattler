// Paints a board's static ground into one canvas, once. Browser-only (2D canvas), no Phaser.
//
// Pipeline: (1) a coarse per-sample pass turns the smooth terrain fields into colour and class masks;
// (2) that small image is scaled up with smoothing, which gives soft painterly transitions for free;
// (3) the watercolour detail maps from public/textures/painted are blended over each class with
// soft-light; (4) full-resolution touches: brush strokes, flagstone courts, bridges, vignette.
import { TILE_W, TILE_H } from './projection.js';
import { artFor, GROUND_COLORS as COL } from './terrain-art.js';
import { buildFields, sampleField, bridgeAxis } from './ground-fields.js';
import { createRng, fbm, smoothstep } from './noise.js';
import { paintBridge, paintCourt, paintStrokes, paintFieldPatches, paintVignette } from './ground-details.js';

const STEP = 3; // world pixels per coarse sample
const MAX_SIDE = 4096;
const MAX_PIXELS = 9_000_000;

const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const C = Object.fromEntries(Object.entries(COL).map(([k, v]) => [k, rgb(v)]));
const mixInto = (out, a, b, t) => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
};

/** Canvas pixels per world pixel: sharp when zoomed in, capped by texture size limits. */
export function chooseScale(worldW, worldH, wanted = 1.5) {
  const bySide = MAX_SIDE / Math.max(worldW, worldH);
  const byArea = Math.sqrt(MAX_PIXELS / (worldW * worldH));
  return Math.max(0.5, Math.min(wanted, bySide, byArea));
}

const makeCanvas = (w, h) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return canvas;
};

/**
 * @param board result of createBoard()
 * @param {{ seed?: number, scale?: number, paint?: Record<string, CanvasImageSource[]> }} options
 *        paint: detail maps by set ('grass' | 'dirt' | 'stone' | 'water'); any may be missing
 * @returns {{ canvas: HTMLCanvasElement, scale: number }}
 */
export function paintGround(board, { seed = 1, scale, paint = {} } = {}) {
  const cols = board.width;
  const rows = board.height;
  const worldW = cols * TILE_W;
  const worldH = rows * TILE_H;
  const S = chooseScale(worldW, worldH, scale);
  const fields = buildFields(board);

  // ---- (1) coarse colour + class masks ------------------------------------------------------------
  const gw = Math.ceil(worldW / STEP);
  const gh = Math.ceil(worldH / STEP);
  const colour = new Uint8ClampedArray(gw * gh * 4);
  const maskNames = ['grass', 'dirt', 'stone', 'water'];
  const masks = Object.fromEntries(maskNames.map((n) => [n, new Uint8ClampedArray(gw * gh * 4)]));
  const dominant = new Uint8Array(gw * gh); // 0 grass 1 forest 2 rock 3 water 4 road 5 yard
  const tmp = [0, 0, 0];
  const s1 = seed * 31 + 1;
  const s2 = seed * 31 + 2;
  const s3 = seed * 31 + 3;
  const s4 = seed * 31 + 4;

  for (let gy = 0; gy < gh; gy += 1) {
    for (let gx = 0; gx < gw; gx += 1) {
      const x = (gx + 0.5) * STEP;
      const y = (gy + 0.5) * STEP;
      // Domain warp: boundaries between terrains wander by up to ~0.3 tile.
      const wx = (fbm(x / 80, y / 80, s1, 3) - 0.5) * 0.75;
      const wy = (fbm(x / 80, y / 80, s2, 3) - 0.5) * 0.75;
      const u = x / TILE_W - 0.5 + wx;
      const v = y / TILE_H - 0.5 + wy;
      const sample = (kind) => sampleField(fields[kind], cols, rows, u, v);

      const tone = fbm(x / 60, y / 60, s3, 3);
      const fine = fbm(x / 14, y / 14, s4, 2);
      const grass = [0, 0, 0];
      mixInto(grass, C.grassDark, C.grassLight, smoothstep(0.25, 0.75, tone) * 0.85 + (fine - 0.5) * 0.25);
      const px = [grass[0], grass[1], grass[2]];

      const wForest = smoothstep(0.38, 0.62, sample('forest'));
      if (wForest > 0) {
        mixInto(tmp, C.forestDark, C.forest, smoothstep(0.2, 0.8, tone));
        mixInto(px, px, tmp, wForest);
      }
      const wRock = smoothstep(0.4, 0.6, sample('rock'));
      if (wRock > 0) {
        mixInto(tmp, C.rockDark, C.rock, smoothstep(0.2, 0.8, fbm(x / 22, y / 30, s3 + 9, 3)));
        mixInto(px, px, tmp, wRock);
      }
      const roadField = sample('road');
      const wRoad = smoothstep(0.54, 0.7, roadField) * (1 - wRock);
      if (wRoad > 0) {
        mixInto(tmp, C.dirtDark, C.dirt, smoothstep(0.2, 0.8, fine));
        // Worn centre, darker rutted rim: reads as a trodden track.
        const rim = 1 - smoothstep(0.6, 0.8, roadField);
        mixInto(tmp, tmp, C.dirtDark, rim * 0.5);
        mixInto(px, px, tmp, wRoad);
      }
      const wYard = smoothstep(0.36, 0.62, sample('yard'));
      if (wYard > 0) {
        mixInto(tmp, C.yard, C.dirt, smoothstep(0.3, 0.7, fine));
        mixInto(px, px, tmp, wYard * 0.9);
      }
      const wPave = smoothstep(0.5, 0.62, sample('pave'));
      if (wPave > 0) {
        mixInto(tmp, C.paveDark, C.pave, smoothstep(0.3, 0.7, fine));
        mixInto(px, px, tmp, wPave);
      }

      // Hills: light from the north-west brightens the NW flank and darkens the SE one.
      const hillHere = smoothstep(0.3, 0.85, sampleField(fields.hill, cols, rows, u - wx, v - wy));
      const hillSE = smoothstep(0.3, 0.85, sampleField(fields.hill, cols, rows, u - wx + 0.22, v - wy + 0.28));
      const hillNW = smoothstep(0.3, 0.85, sampleField(fields.hill, cols, rows, u - wx - 0.22, v - wy - 0.28));
      const lit = (hillSE - hillNW) * 0.9 + hillHere * 0.08;
      if (lit !== 0) {
        const target = lit > 0 ? 255 : 0;
        const k = Math.min(0.45, Math.abs(lit) * (lit > 0 ? 0.32 : 0.5));
        px[0] += (target - px[0]) * k;
        px[1] += (target - px[1]) * k;
        px[2] += (target - px[2]) * k;
      }

      // Water with a muddy bank, foam line and depth.
      const waterField = sample('water');
      const wWater = smoothstep(0.46, 0.54, waterField);
      const bank = smoothstep(0.3, 0.47, waterField) * (1 - wWater);
      if (bank > 0) mixInto(px, px, C.mud, bank * 0.85);
      if (wWater > 0) {
        const depth = smoothstep(0.5, 1, waterField);
        mixInto(tmp, C.shallow, C.water, smoothstep(0, 0.55, depth));
        mixInto(tmp, tmp, C.deep, smoothstep(0.55, 1, depth) * 0.8);
        // Flow streaks run along the river (north-south stretch).
        const streak = fbm(x / 70, y / 14, s2 + 5, 3);
        mixInto(tmp, tmp, C.shallow, smoothstep(0.55, 0.8, streak) * 0.35);
        const foam = (1 - smoothstep(0.5, 0.6, waterField)) * smoothstep(0.45, 0.65, fbm(x / 9, y / 9, s1 + 7, 2));
        mixInto(tmp, tmp, C.foam, foam * 0.8);
        mixInto(px, px, tmp, wWater);
      }

      const idx = gy * gw + gx;
      const o = idx * 4;
      colour[o] = px[0];
      colour[o + 1] = px[1];
      colour[o + 2] = px[2];
      colour[o + 3] = 255;

      const landW = 1 - wWater;
      const w = {
        water: wWater,
        stone: landW * Math.min(1, wRock + wPave),
        dirt: landW * Math.min(1, wRoad + wYard * 0.8) * (1 - wRock),
      };
      w.grass = landW * (1 - Math.max(w.stone, w.dirt));
      for (const name of maskNames) {
        const m = masks[name];
        m[o] = 255;
        m[o + 1] = 255;
        m[o + 2] = 255;
        m[o + 3] = w[name] * 255;
      }
      dominant[idx] = wWater > 0.5 ? 3 : wRock > 0.5 ? 2 : wRoad > 0.5 ? 4 : wYard > 0.5 ? 5 : wForest > 0.5 ? 1 : 0;
    }
  }

  // ---- (2) upscale -------------------------------------------------------------------------------
  const canvas = makeCanvas(worldW * S, worldH * S);
  const ctx = canvas.getContext('2d');
  const toCanvas = (data) => {
    const small = makeCanvas(gw, gh);
    small.getContext('2d').putImageData(new ImageData(data, gw, gh), 0, 0);
    return small;
  };
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(toCanvas(colour), 0, 0, canvas.width, canvas.height);

  // ---- (3) painted detail maps -------------------------------------------------------------------
  const layer = makeCanvas(canvas.width, canvas.height);
  const lctx = layer.getContext('2d');
  const pick = (set, i) => paint[set]?.[i % (paint[set]?.length || 1)] ?? null;
  const detail = [
    ['grass', 0, 4.2, 0.85, [0, 0]],
    ['grass', 2, 2.6, 0.5, [0.37, 0.61]],
    ['dirt', 1, 3.2, 0.85, [0.2, 0.4]],
    ['stone', 0, 2.4, 0.9, [0, 0]],
    ['water', 0, 3.0, 0.8, [0.5, 0.1]],
  ];
  for (const [set, variant, span, opacity, offset] of detail) {
    const img = pick(set, variant + (seed % 2));
    if (!img) continue; // optional art: skip silently when it did not load
    const pattern = lctx.createPattern(img, 'repeat');
    const k = (span * TILE_W * S) / (img.width || img.naturalWidth);
    pattern.setTransform(new DOMMatrix([k, 0, 0, k, offset[0] * TILE_W * S, offset[1] * TILE_H * S]));
    lctx.globalCompositeOperation = 'source-over';
    lctx.globalAlpha = 1;
    lctx.clearRect(0, 0, layer.width, layer.height);
    lctx.fillStyle = pattern;
    lctx.fillRect(0, 0, layer.width, layer.height);
    lctx.globalCompositeOperation = 'destination-in';
    lctx.drawImage(toCanvas(masks[set]), 0, 0, layer.width, layer.height);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = opacity;
    ctx.drawImage(layer, 0, 0);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  layer.width = layer.height = 1; // release the scratch memory

  // ---- (4) full-resolution touches ---------------------------------------------------------------
  ctx.save();
  ctx.scale(S, S); // from here on, draw in world pixels
  const rand = createRng(seed * 977 + 13);
  const domAt = (x, y) => dominant[Math.min(gh - 1, Math.max(0, Math.floor(y / STEP))) * gw
    + Math.min(gw - 1, Math.max(0, Math.floor(x / STEP)))];
  paintStrokes(ctx, { worldW, worldH, rand, domAt });
  for (const { c, r, letter } of board.tiles()) {
    const art = artFor(letter);
    if (art.pave) paintCourt(ctx, c, r, rand);
    if (art.yard) paintFieldPatches(ctx, c, r, rand);
  }
  for (const { c, r, letter } of board.tiles()) {
    if (artFor(letter).bridge) paintBridge(ctx, c, r, bridgeAxis(board, c, r), rand);
  }
  paintVignette(ctx, worldW, worldH);
  ctx.restore();
  return { canvas, scale: S };
}
