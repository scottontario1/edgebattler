// Full-resolution hand-painted touches drawn onto the baked ground (world-pixel coordinates).
import { TILE_W, TILE_H } from './projection.js';
import { GROUND_COLORS as COL } from './terrain-art.js';

const INK = 'rgba(29, 26, 36, 0.85)';

/** Short brush strokes: grass blades, leaf litter, rock cracks. Density follows the class under each stroke. */
export function paintStrokes(ctx, { worldW, worldH, rand, domAt }) {
  const palettes = [
    ['rgba(170,205,100,0.38)', 'rgba(60,100,40,0.34)', 'rgba(205,225,130,0.28)'], // grass
    ['rgba(90,150,80,0.30)', 'rgba(20,50,30,0.38)', 'rgba(130,170,90,0.22)'], // forest floor
    ['rgba(40,36,30,0.38)', 'rgba(190,180,160,0.30)', 'rgba(60,55,48,0.3)'], // rock
    null, // water has its own flow texture
    ['rgba(120,90,55,0.35)', 'rgba(210,185,140,0.3)', 'rgba(90,65,40,0.3)'], // road
    ['rgba(120,90,55,0.35)', 'rgba(210,185,140,0.3)', 'rgba(90,65,40,0.3)'], // yard
  ];
  const count = Math.floor((worldW * worldH) / 38);
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i += 1) {
    const x = rand() * worldW;
    const y = rand() * worldH;
    const palette = palettes[domAt(x, y)];
    if (!palette) continue;
    const dom = domAt(x, y);
    ctx.strokeStyle = palette[Math.floor(rand() * palette.length)];
    ctx.lineWidth = 0.9 + rand() * 1.1;
    ctx.beginPath();
    if (dom === 2) { // cracks wander
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 9, y + rand() * 5);
    } else { // blades lean up and a little sideways
      const lean = (rand() - 0.5) * 3;
      ctx.moveTo(x, y);
      ctx.lineTo(x + lean, y - 3 - rand() * 4);
    }
    ctx.stroke();
  }
}

/** Flagstone court under a keep. */
export function paintCourt(ctx, c, r, rand) {
  const cx = (c + 0.5) * TILE_W;
  const cy = (r + 0.5) * TILE_H;
  const w = TILE_W * 0.86;
  const h = TILE_H * 0.8;
  ctx.save();
  ctx.fillStyle = 'rgba(30,28,24,0.28)'; // soft contact shadow so the court sits on the grass
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4, w / 2 + 6, h / 2 + 5, 0, 0, Math.PI * 2);
  ctx.fill();
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  const slabW = 15;
  const slabH = 11;
  ctx.beginPath();
  ctx.roundRect(x0, y0, w, h, 7);
  ctx.clip();
  for (let y = y0, row = 0; y < y0 + h; y += slabH, row += 1) {
    for (let x = x0 - (row % 2) * (slabW / 2); x < x0 + w; x += slabW) {
      const tone = 0.82 + rand() * 0.3;
      ctx.fillStyle = `rgb(${Math.round(176 * tone)},${Math.round(170 * tone)},${Math.round(160 * tone)})`;
      ctx.fillRect(x + 0.5, y + 0.5, slabW - 1, slabH - 1);
    }
  }
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(x0, y0, w, h, 7);
  ctx.stroke();
}

/** A few wheat patches beside a village so a village reads as lived-in farmland. */
export function paintFieldPatches(ctx, c, r, rand) {
  const cx = (c + 0.5) * TILE_W;
  const cy = (r + 0.5) * TILE_H;
  const patches = [[-0.5, 0.2], [0.55, 0.3]];
  for (const [dx, dy] of patches) {
    const x = cx + dx * TILE_W;
    const y = cy + dy * TILE_H;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rand() - 0.5) * 0.2);
    ctx.fillStyle = 'rgba(205,176,82,0.75)';
    ctx.beginPath();
    ctx.roundRect(-17, -9, 34, 18, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,105,40,0.65)';
    ctx.lineWidth = 1.2;
    for (let i = -14; i <= 14; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, -7);
      ctx.lineTo(i + 1, 7);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Wooden bridge deck with side rails, drawn flat into the ground so it can never hide a unit. */
export function paintBridge(ctx, c, r, axis, rand) {
  const x0 = c * TILE_W;
  const y0 = r * TILE_H;
  const along = axis === 'ew'; // travel direction is x
  const reach = 10; // overlap onto the banks
  const dx = along ? reach : 0;
  const dy = along ? 0 : reach;
  const x = x0 - dx;
  const y = y0 - dy;
  const w = TILE_W + dx * 2;
  const h = TILE_H + dy * 2;
  // Deck inset from the sides a little so water shows around it, shadow cast onto the water.
  const inset = along ? 9 : 14;
  const dxs = along ? 0 : inset;
  const dys = along ? inset : 0;
  const deck = { x: x + dxs, y: y + dys, w: w - dxs * 2, h: h - dys * 2 };
  ctx.save();
  ctx.fillStyle = 'rgba(10,30,40,0.38)';
  ctx.fillRect(deck.x + 2, deck.y + 7, deck.w, deck.h);
  ctx.fillStyle = COL.plank;
  ctx.fillRect(deck.x, deck.y, deck.w, deck.h);
  ctx.beginPath();
  ctx.rect(deck.x, deck.y, deck.w, deck.h);
  ctx.clip();
  const plank = 8;
  for (let i = 0; i < (along ? deck.w : deck.h); i += plank) {
    const tone = 0.85 + rand() * 0.3;
    ctx.fillStyle = `rgba(${Math.round(150 * tone)},${Math.round(108 * tone)},${Math.round(60 * tone)},0.9)`;
    if (along) ctx.fillRect(deck.x + i + 0.7, deck.y, plank - 1.4, deck.h);
    else ctx.fillRect(deck.x, deck.y + i + 0.7, deck.w, plank - 1.4);
  }
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(deck.x, deck.y, deck.w, deck.h);
  // Rails: a lit top rail and a post at each end of both sides.
  ctx.fillStyle = COL.plankDark;
  const railT = 5;
  const posts = (px, py) => {
    ctx.fillStyle = '#6a4a28';
    ctx.fillRect(px - 3, py - 8, 6, 11);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(px - 3, py - 8, 6, 11);
  };
  if (along) {
    for (const ry of [deck.y - 1, deck.y + deck.h - railT + 1]) {
      ctx.fillStyle = '#7a5630';
      ctx.fillRect(deck.x, ry, deck.w, railT);
      ctx.strokeStyle = INK;
      ctx.strokeRect(deck.x, ry, deck.w, railT);
    }
    for (const px of [deck.x + 3, deck.x + deck.w / 2, deck.x + deck.w - 3]) {
      posts(px, deck.y + 3);
      posts(px, deck.y + deck.h - 1);
    }
  } else {
    for (const rx of [deck.x - 1, deck.x + deck.w - railT + 1]) {
      ctx.fillStyle = '#7a5630';
      ctx.fillRect(rx, deck.y, railT, deck.h);
      ctx.strokeStyle = INK;
      ctx.strokeRect(rx, deck.y, railT, deck.h);
    }
    for (const py of [deck.y + 6, deck.y + deck.h / 2, deck.y + deck.h - 2]) {
      posts(deck.x + 2, py);
      posts(deck.x + deck.w - 2, py);
    }
  }
}

/** Darken the board's outer edge slightly so the map sits in its frame. */
export function paintVignette(ctx, worldW, worldH) {
  const depth = 46;
  const edges = [
    [0, 0, 0, depth, 0, 0, worldW, depth],
    [0, worldH, 0, worldH - depth, 0, worldH - depth, worldW, depth],
    [0, 0, depth, 0, 0, 0, depth, worldH],
    [worldW, 0, worldW - depth, 0, worldW - depth, 0, depth, worldH],
  ];
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of edges) {
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    gradient.addColorStop(0, 'rgba(10,16,30,0.42)');
    gradient.addColorStop(1, 'rgba(10,16,30,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(rx, ry, rw, rh);
  }
}

/** Soft drop shadow plus the earthen south face that makes the board read as a slab of land. */
export function paintFrame(canvas, worldW, worldH, pad, skirt, rand) {
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.translate(pad, pad);
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, worldW, worldH + skirt);
  ctx.shadowColor = 'transparent';
  // Earth face with strata.
  const gradient = ctx.createLinearGradient(0, worldH, 0, worldH + skirt);
  gradient.addColorStop(0, '#6b5a40');
  gradient.addColorStop(1, '#3d3224');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, worldH - 2, worldW, skirt + 2);
  ctx.strokeStyle = 'rgba(20,14,8,0.35)';
  ctx.lineWidth = 1.4;
  for (let x = 0; x < worldW; x += 7 + rand() * 12) {
    ctx.beginPath();
    ctx.moveTo(x, worldH);
    ctx.lineTo(x + (rand() - 0.5) * 4, worldH + skirt);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(210,180,130,0.22)';
  for (let y = worldH + 7; y < worldH + skirt; y += 8) {
    ctx.beginPath();
    ctx.moveTo(0, y + rand() * 2);
    ctx.lineTo(worldW, y + rand() * 2);
    ctx.stroke();
  }
  ctx.restore();
}
