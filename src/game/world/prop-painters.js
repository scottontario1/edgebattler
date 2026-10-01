// Procedural prop art: each painter draws one prop into its own canvas (browser-only, no Phaser).
// Style: flat cel colours with a lit side, a dark side and a thin ink outline, matching the sprites'
// ink-and-wash look. Painters return { canvas, w, h, ax, ay } in logical pixels; canvases are drawn at
// RES x so props stay crisp when the camera zooms in. (ax, ay) is the foot anchor.

export const RES = 2;
const INK = '#1d1a24';

function makeProp(w, h, ax, ay) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * RES);
  canvas.height = Math.ceil(h * RES);
  const ctx = canvas.getContext('2d');
  ctx.scale(RES, RES);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return { canvas, ctx, w, h, ax, ay };
}

const shadowEllipse = (ctx, x, y, rx, ry, alpha = 0.3) => {
  ctx.fillStyle = `rgba(14,18,10,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
};

const outline = (ctx, width = 1.5) => {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.stroke();
};

/** Left-lit gradient: light on the left, dark on the right. */
function sideGradient(ctx, x0, x1, light, dark) {
  const gradient = ctx.createLinearGradient(x0, 0, x1, 0);
  gradient.addColorStop(0, light);
  gradient.addColorStop(0.55, light);
  gradient.addColorStop(1, dark);
  return gradient;
}

export function paintPine(rand, variant = 0) {
  const w = 44;
  const h = 66 + (variant % 3) * 4;
  const prop = makeProp(w, h, w / 2, h - 5);
  const { ctx } = prop;
  const cx = w / 2;
  shadowEllipse(ctx, cx + 3, h - 5, 15, 5);
  ctx.fillStyle = '#4a3320';
  ctx.fillRect(cx - 3, h - 14, 6, 10);
  const greens = [['#4f9a52', '#2a6a3c'], ['#3f8a4a', '#235c36'], ['#5aa457', '#2e6e40']][variant % 3];
  const tiers = 4;
  for (let i = tiers - 1; i >= 0; i -= 1) {
    const top = 4 + i * ((h - 24) / tiers) - (i === 0 ? 0 : 2);
    const bottom = top + 22 + i * 2;
    const half = 8 + i * 5 + rand() * 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx + half, bottom - 2);
    ctx.lineTo(cx + half * 0.45, bottom - 4 + rand() * 2);
    ctx.lineTo(cx, bottom);
    ctx.lineTo(cx - half * 0.45, bottom - 4 + rand() * 2);
    ctx.lineTo(cx - half, bottom - 2);
    ctx.closePath();
    ctx.fillStyle = sideGradient(ctx, cx - half, cx + half, greens[0], greens[1]);
    ctx.fill();
    outline(ctx, 1.4);
  }
  return prop;
}

export function paintOak(rand, variant = 0) {
  const w = 52;
  const h = 56;
  const prop = makeProp(w, h, w / 2, h - 5);
  const { ctx } = prop;
  const cx = w / 2;
  shadowEllipse(ctx, cx + 3, h - 5, 18, 5.5);
  ctx.fillStyle = '#5c3d22';
  ctx.beginPath();
  ctx.moveTo(cx - 4, h - 4);
  ctx.lineTo(cx - 2.5, h - 22);
  ctx.lineTo(cx + 2.5, h - 22);
  ctx.lineTo(cx + 4, h - 4);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 1.2);
  const palette = [['#7cb35a', '#4a8a3e'], ['#6fa84f', '#3f7d38']][variant % 2];
  const blobs = [[cx - 10, h - 30, 12], [cx + 10, h - 31, 12], [cx, h - 40, 14], [cx - 2, h - 26, 13]];
  for (const [bx, by, br] of blobs) {
    const gradient = ctx.createRadialGradient(bx - br * 0.4, by - br * 0.45, 1, bx, by, br * 1.05);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(1, palette[1]);
    ctx.beginPath();
    ctx.arc(bx + (rand() - 0.5) * 2, by, br, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    outline(ctx, 1.4);
  }
  return prop;
}

export function paintBush(rand, flowers = false) {
  const w = 26;
  const h = 18;
  const prop = makeProp(w, h, w / 2, h - 3);
  const { ctx } = prop;
  shadowEllipse(ctx, w / 2 + 2, h - 3, 10, 3, 0.25);
  for (const [bx, by, br] of [[8, h - 8, 6.5], [17, h - 8, 7], [12.5, h - 11, 6.5]]) {
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = '#5f9a47';
    ctx.fill();
    outline(ctx, 1.2);
  }
  if (flowers) {
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = ['#f4d35e', '#f6f1e3', '#e98fa8'][i % 3];
      ctx.beginPath();
      ctx.arc(6 + rand() * 14, h - 14 + rand() * 7, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return prop;
}

/**
 * Rock outcrop: a jagged silhouette split along a ridge into a lit west facet and a shaded east facet,
 * with cracks and a pale edge light. `size` scales the whole stone; low sizes read as boulders.
 */
export function paintCrag(rand, size = 1) {
  const w = Math.round(62 * size);
  const h = Math.round(54 * size);
  const prop = makeProp(w, h, w / 2, h - 4);
  const { ctx } = prop;
  const cx = w / 2;
  const base = h - 4;
  const half = w / 2 - 3;
  shadowEllipse(ctx, cx + 4, base, half * 0.95, 6, 0.3);

  // Silhouette: walk up the west flank to a blunt summit and down the east flank.
  const peakX = cx + (rand() - 0.5) * half * 0.5;
  const peakY = 4 + rand() * h * 0.14;
  const west = [[cx - half, base - 1]];
  const east = [];
  const steps = 3;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / (steps + 1);
    const jitter = () => (rand() - 0.5) * 7;
    west.push([cx - half + (peakX - 6 - (cx - half)) * t + jitter(), base - (base - peakY) * Math.pow(t, 0.8) + jitter() * 0.6]);
    east.push([cx + half - (cx + half - peakX - 6) * t + jitter(), base - (base - peakY) * Math.pow(t, 0.8) + jitter() * 0.6]);
  }
  east.reverse();
  const summitL = [peakX - 5, peakY + 1];
  const summitR = [peakX + 6, peakY + 2 + rand() * 3];
  const ridgeBottom = [peakX + (rand() - 0.5) * 8, base];

  const trace = (points) => points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.beginPath(); // lit west facet
  trace([...west, summitL, summitR, ridgeBottom]);
  ctx.closePath();
  const lit = ctx.createLinearGradient(0, peakY, 0, base);
  lit.addColorStop(0, '#b9b09c');
  lit.addColorStop(1, '#8f8777');
  ctx.fillStyle = lit;
  ctx.fill();
  ctx.beginPath(); // shaded east facet
  trace([summitR, ...east, [cx + half, base - 1], ridgeBottom]);
  ctx.closePath();
  const shade = ctx.createLinearGradient(0, peakY, 0, base);
  shade.addColorStop(0, '#7d766a');
  shade.addColorStop(1, '#575145');
  ctx.fillStyle = shade;
  ctx.fill();
  // One outline over the union.
  ctx.beginPath();
  trace([...west, summitL, summitR, ...east, [cx + half, base - 1]]);
  ctx.closePath();
  outline(ctx, 1.6);
  // Facet edge and cracks.
  ctx.strokeStyle = 'rgba(29,26,36,0.7)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(summitR[0], summitR[1]);
  ctx.lineTo(ridgeBottom[0], ridgeBottom[1]);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(29,26,36,0.4)';
  for (let i = 0; i < 3; i += 1) {
    const x = cx - half * 0.7 + rand() * half * 1.2;
    const y = base - 6 - rand() * (base - peakY) * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 8, y + 5 + rand() * 6);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(240,232,214,0.6)'; // edge light on the summit
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  trace([west[west.length - 1], summitL, summitR]);
  ctx.stroke();
  return prop;
}

const ROOFS = ['#a9502f', '#8f6a3a', '#b9893a', '#7a4a38'];

export function paintCottage(rand, variant = 0) {
  const w = 66;
  const h = 62;
  const prop = makeProp(w, h, w / 2, h - 5);
  const { ctx } = prop;
  const cx = w / 2;
  shadowEllipse(ctx, cx + 4, h - 6, 28, 6, 0.3);
  const wallTop = h - 30;
  const wall = ctx.createLinearGradient(8, 0, w - 8, 0);
  wall.addColorStop(0, '#efe3c6');
  wall.addColorStop(0.7, '#e2d1ab');
  wall.addColorStop(1, '#bfa97e');
  ctx.fillStyle = wall;
  ctx.fillRect(9, wallTop, w - 18, 25);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(9, wallTop, w - 18, 25);
  ctx.fillStyle = '#5c4129'; // timber frame
  for (const x of [9, cx - 1, w - 11]) ctx.fillRect(x, wallTop, 2, 25);
  ctx.fillStyle = '#4a3320';
  ctx.fillRect(cx + 4, wallTop + 9, 9, 16); // door
  ctx.fillStyle = '#e8c36a';
  ctx.fillRect(14, wallTop + 7, 8, 8); // lit window
  ctx.strokeStyle = INK;
  ctx.strokeRect(14, wallTop + 7, 8, 8);
  const roof = ROOFS[variant % ROOFS.length];
  ctx.beginPath(); // roof slab
  ctx.moveTo(3, wallTop + 2);
  ctx.lineTo(14, 8);
  ctx.lineTo(w - 14, 8);
  ctx.lineTo(w - 3, wallTop + 2);
  ctx.closePath();
  ctx.fillStyle = roof;
  ctx.fill();
  outline(ctx, 1.6);
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 1;
  for (let y = 14; y < wallTop; y += 6) {
    ctx.beginPath();
    ctx.moveTo(8 + (y - 8) * 0.1, y);
    ctx.lineTo(w - 8 - (y - 8) * 0.1, y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,240,210,0.28)'; // lit left half of the roof
  ctx.beginPath();
  ctx.moveTo(3, wallTop + 2);
  ctx.lineTo(14, 8);
  ctx.lineTo(cx - 6, 8);
  ctx.lineTo(cx - 12, wallTop + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7d756a'; // chimney
  ctx.fillRect(w - 24, 1, 7, 10);
  ctx.strokeStyle = INK;
  ctx.strokeRect(w - 24, 1, 7, 10);
  return prop;
}

/** Castle keep: curtain wall, two round towers with cone roofs in the faction colour, central donjon. */
export function paintKeep(faction) {
  const cloth = faction === 'red' ? ['#d6473b', '#8f2420'] : ['#3f78d6', '#1f4a9a'];
  const w = 112;
  const h = 96;
  const prop = makeProp(w, h, w / 2, h - 6);
  const { ctx } = prop;
  const cx = w / 2;
  shadowEllipse(ctx, cx + 4, h - 7, 46, 8, 0.32);
  const stone = (x, y, ww, hh) => {
    ctx.fillStyle = sideGradient(ctx, x, x + ww, '#cfc8b8', '#8f897e');
    ctx.fillRect(x, y, ww, hh);
    ctx.strokeStyle = 'rgba(40,36,30,0.28)';
    ctx.lineWidth = 0.8;
    for (let yy = y + 7; yy < y + hh; yy += 7) {
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x + ww, yy);
      ctx.stroke();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(x, y, ww, hh);
  };
  const battlements = (x, y, ww) => {
    const merlon = 6;
    for (let m = x; m < x + ww - 1; m += merlon * 2) {
      ctx.fillStyle = '#c4bdad';
      ctx.fillRect(m, y - 5, merlon, 6);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(m, y - 5, merlon, 6);
    }
  };
  const tower = (x, topY) => {
    stone(x, topY, 22, h - 9 - topY);
    ctx.beginPath(); // cone roof
    ctx.moveTo(x - 3, topY + 1);
    ctx.lineTo(x + 11, topY - 20);
    ctx.lineTo(x + 25, topY + 1);
    ctx.closePath();
    ctx.fillStyle = sideGradient(ctx, x - 3, x + 25, cloth[0], cloth[1]);
    ctx.fill();
    outline(ctx, 1.6);
    ctx.fillStyle = '#2a2430';
    ctx.fillRect(x + 8, topY + 12, 5, 9); // arrow slit
  };
  stone(6, h - 38, w - 12, 29); // curtain wall
  battlements(6, h - 38, w - 12);
  tower(2, 28);
  tower(w - 24, 28);
  stone(cx - 19, 18, 38, h - 27); // donjon
  battlements(cx - 19, 18, 38);
  ctx.fillStyle = '#2a2430'; // gate
  ctx.beginPath();
  ctx.moveTo(cx - 9, h - 9);
  ctx.lineTo(cx - 9, h - 25);
  ctx.arc(cx, h - 25, 9, Math.PI, 0);
  ctx.lineTo(cx + 9, h - 9);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 1.4);
  ctx.fillStyle = '#e8c36a';
  ctx.fillRect(cx - 3, 34, 6, 9);
  ctx.strokeStyle = INK;
  ctx.strokeRect(cx - 3, 34, 6, 9);
  ctx.fillStyle = '#f0b830'; // gold finial under the banner
  ctx.beginPath();
  ctx.arc(cx, 17, 2.5, 0, Math.PI * 2);
  ctx.fill();
  return prop;
}

/** White pennant (tinted at runtime by owner) and its pole, as two images so only the cloth is tinted. */
export function paintPennantCloth() {
  const prop = makeProp(26, 16, 0, 8);
  const { ctx } = prop;
  ctx.beginPath();
  ctx.moveTo(1, 1);
  ctx.quadraticCurveTo(13, 5, 25, 8);
  ctx.quadraticCurveTo(13, 11, 1, 15);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  outline(ctx, 1.2);
  return prop;
}

export function paintPole() {
  const prop = makeProp(4, 34, 2, 32);
  const { ctx } = prop;
  ctx.fillStyle = '#5c4129';
  ctx.fillRect(0.5, 0, 3, 34);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0, 3, 34);
  return prop;
}

/** Soft ripple streak for the river shimmer. */
export function paintStreak() {
  const prop = makeProp(40, 8, 20, 4);
  const { ctx } = prop;
  const gradient = ctx.createRadialGradient(20, 4, 0, 20, 4, 20);
  gradient.addColorStop(0, 'rgba(235,250,250,0.9)');
  gradient.addColorStop(1, 'rgba(235,250,250,0)');
  ctx.save();
  ctx.scale(1, 0.2);
  ctx.translate(0, 16);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, -16, 40, 40);
  ctx.restore();
  return prop;
}
