import * as THREE from 'three';

// High-res procedural textures painted on canvases at startup.

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(size, seed, draw, { color = true, repeat = 1 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  draw(g, size, rng(seed));
  const tex = new THREE.CanvasTexture(canvas);
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  return tex;
}

const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

// Soft light/dark blotches break up flat color.
function blotches(g, s, rand, count, light, dark) {
  for (let i = 0; i < count; i++) {
    const x = rand() * s, y = rand() * s, r = s * (0.08 + rand() * 0.25);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, rand() < 0.5 ? light : dark);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    // Draw wrapped copies so the texture tiles without seams.
    for (const ox of [-s, 0, s]) {
      for (const oy of [-s, 0, s]) {
        g.save(); g.translate(ox, oy); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
      }
    }
  }
}

function speckle(g, s, rand, count, pick) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = pick(rand);
    const r = 0.6 + rand() * 1.8;
    g.fillRect(rand() * s, rand() * s, r, r);
  }
}

export function grassTexture(seed, hue = 88) {
  return canvasTexture(512, seed, (g, s, rand) => {
    g.fillStyle = hsl(hue, 42, 40);
    g.fillRect(0, 0, s, s);
    blotches(g, s, rand, 26, hsl(hue - 8, 50, 52, 0.35), hsl(hue + 12, 45, 26, 0.3));
    g.lineCap = 'round';
    for (let i = 0; i < 5200; i++) {
      const x = rand() * s, y = rand() * s, len = 3 + rand() * 7;
      const a = -Math.PI / 2 + (rand() - 0.5) * 0.9;
      g.strokeStyle = hsl(hue + (rand() - 0.5) * 24, 38 + rand() * 22, 28 + rand() * 28, 0.8);
      g.lineWidth = 0.8 + rand() * 1.2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
    speckle(g, s, rand, 60, (r) => (r() < 0.5 ? '#f3e37a' : '#f1eef8'));
  });
}

export function dirtTexture(seed) {
  return canvasTexture(512, seed, (g, s, rand) => {
    g.fillStyle = '#b89a66';
    g.fillRect(0, 0, s, s);
    blotches(g, s, rand, 30, 'rgba(226,200,150,0.35)', 'rgba(110,84,50,0.3)');
    speckle(g, s, rand, 4000, (r) => hsl(32 + r() * 10, 25 + r() * 20, 35 + r() * 30, 0.7));
    for (let i = 0; i < 70; i++) {
      const x = rand() * s, y = rand() * s, rx = 3 + rand() * 7, ry = 2 + rand() * 5;
      g.fillStyle = 'rgba(40,30,20,0.35)';
      g.beginPath(); g.ellipse(x + 1.5, y + 2, rx, ry, rand() * 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = hsl(30 + rand() * 20, 8 + rand() * 12, 55 + rand() * 20);
      g.beginPath(); g.ellipse(x, y, rx, ry, rand() * 3, 0, Math.PI * 2); g.fill();
    }
  });
}

export function rockTexture(seed) {
  return canvasTexture(512, seed, (g, s, rand) => {
    g.fillStyle = '#8a8068';
    g.fillRect(0, 0, s, s);
    blotches(g, s, rand, 40, 'rgba(200,190,170,0.3)', 'rgba(50,44,36,0.35)');
    speckle(g, s, rand, 5000, (r) => hsl(40, 8 + r() * 10, 30 + r() * 40, 0.6));
    g.strokeStyle = 'rgba(40,34,28,0.5)';
    for (let i = 0; i < 40; i++) {
      let x = rand() * s, y = rand() * s;
      g.lineWidth = 0.8 + rand() * 1.5;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (rand() - 0.5) * 40; y += (rand() - 0.5) * 40; g.lineTo(x, y); }
      g.stroke();
    }
  });
}

// Cliff walls, world-scaled (1 texture = 1 world unit): a grass lip with hanging tufts over
// blocky grey-tan rock courses. `moss` (0..1) adds moss patches and drips for river banks.
export function cliffTexture(seed, moss = 0, lip = true) {
  return canvasTexture(512, seed, (g, s, rand) => {
    const lip = s * 0.06;
    g.fillStyle = '#6d6556';
    g.fillRect(0, 0, s, s);
    // Irregular block courses, drawn twice across the wrap so the texture tiles horizontally.
    let y = lip;
    while (y < s) {
      const rowH = 34 + rand() * 46;
      let x = -rand() * 60;
      while (x < s) {
        const w = 46 + rand() * 90;
        const l = 44 + rand() * 18, hue = 32 + rand() * 14, sat = 8 + rand() * 10;
        const inset = 2 + rand() * 2;
        const skew = (rand() - 0.5) * 10;
        const j = [(rand() - 0.5) * 6, (rand() - 0.5) * 6];
        for (const ox of [-s, 0, s]) {
          const x0 = x + ox;
          const pts = [[x0 + inset + skew, y + inset], [x0 + w - inset, y + inset + j[0]],
            [x0 + w - inset - skew * 0.5, y + rowH - inset], [x0 + inset, y + rowH - inset + j[1]]];
          g.fillStyle = hsl(hue, sat, l);
          g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.fill();
          // Sunlit top face and shaded underside give each block a chiselled look.
          g.fillStyle = hsl(hue, sat, l + 14, 0.8);
          g.fillRect(pts[0][0], pts[0][1], w - inset * 2, 5);
          g.fillStyle = 'rgba(25,20,15,0.45)';
          g.fillRect(pts[3][0], pts[3][1] - 5, w - inset * 2, 5);
        }
        x += w;
      }
      y += rowH;
    }
    blotches(g, s, rand, 26, 'rgba(220,210,190,0.18)', 'rgba(30,26,20,0.28)');
    speckle(g, s, rand, 2600, (r) => hsl(40, 8 + r() * 10, 30 + r() * 40, 0.45));
    // Moss: soft green blotches concentrated near the top, with drips running down.
    const mossCount = Math.round(10 + moss * 50);
    for (let i = 0; i < mossCount; i++) {
      const x = rand() * s, yy = lip + Math.pow(rand(), 1.6 - moss * 0.6) * s * 0.9, r = s * (0.03 + rand() * 0.07);
      for (const ox of [-s, 0, s]) {
        const grad = g.createRadialGradient(x + ox, yy, 0, x + ox, yy, r);
        grad.addColorStop(0, hsl(85 + rand() * 20, 45, 30 + rand() * 10, 0.85));
        grad.addColorStop(1, 'rgba(60,90,30,0)');
        g.fillStyle = grad;
        g.fillRect(x + ox - r, yy - r, r * 2, r * 2);
      }
    }
    for (let i = 0; i < 40 + moss * 120; i++) {
      const x = rand() * s, len = s * (0.03 + rand() * (0.1 + moss * 0.25));
      g.strokeStyle = hsl(88 + rand() * 18, 40 + rand() * 15, 22 + rand() * 14, 0.7);
      g.lineWidth = 2 + rand() * 5;
      g.beginPath(); g.moveTo(x, lip); g.lineTo(x + (rand() - 0.5) * 8, lip + len); g.stroke();
    }
    if (!lip) return;
    // Grass lip and tufts hanging over the edge.
    g.fillStyle = hsl(86, 52, 40);
    g.fillRect(0, 0, s, lip);
    g.lineCap = 'round';
    for (let i = 0; i < 260; i++) {
      const x = rand() * s, len = s * (0.015 + rand() * 0.06);
      g.strokeStyle = hsl(80 + rand() * 20, 45 + rand() * 20, 26 + rand() * 22, 0.95);
      g.lineWidth = 2 + rand() * 4;
      g.beginPath(); g.moveTo(x, lip * 0.5); g.lineTo(x + (rand() - 0.5) * 8, lip + len); g.stroke();
    }
  });
}

// Falling water: bright vertical streaks, scrolled downward at runtime.
export function waterfallTexture() {
  return canvasTexture(256, 5, (g, s, rand) => {
    g.fillStyle = '#5f9fc8';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 220; i++) {
      const x = rand() * s, y = rand() * s, len = 20 + rand() * 90;
      g.strokeStyle = `rgba(235,248,255,${0.25 + rand() * 0.6})`;
      g.lineWidth = 1 + rand() * 3;
      for (const oy of [-s, 0]) {
        g.beginPath(); g.moveTo(x, y + oy); g.lineTo(x + (rand() - 0.5) * 2, y + oy + len); g.stroke();
      }
    }
  });
}

export function stoneTexture(seed) {
  return canvasTexture(512, seed, (g, s, rand) => {
    g.fillStyle = '#6f6a5e';
    g.fillRect(0, 0, s, s);
    const rows = 10, h = s / rows;
    for (let r = 0; r < rows; r++) {
      let x = r % 2 ? -h : 0;
      while (x < s) {
        const w = h * (1.4 + rand() * 0.8);
        const l = 58 + rand() * 16;
        g.fillStyle = hsl(40 + rand() * 10, 8, l);
        g.fillRect(x + 2, r * h + 2, w - 4, h - 4);
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fillRect(x + 2, r * h + 2, w - 4, 3);
        x += w;
      }
    }
    speckle(g, s, rand, 3000, (r) => `rgba(0,0,0,${r() * 0.15})`);
  });
}

export function woodTexture(seed) {
  return canvasTexture(256, seed, (g, s, rand) => {
    const planks = 6, w = s / planks;
    for (let i = 0; i < planks; i++) {
      g.fillStyle = hsl(26 + rand() * 6, 45, 30 + rand() * 10);
      g.fillRect(i * w, 0, w, s);
      g.strokeStyle = 'rgba(40,20,8,0.35)';
      for (let k = 0; k < 8; k++) {
        const x = i * w + rand() * w;
        g.lineWidth = 0.6;
        g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 3, s / 3, x - 3, (2 * s) / 3, x, s); g.stroke();
      }
      g.fillStyle = 'rgba(20,10,4,0.6)';
      g.fillRect(i * w, 0, 2, s);
    }
  });
}

export function riverbedTexture(seed) {
  return canvasTexture(256, seed, (g, s, rand) => {
    g.fillStyle = '#243a3c';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 160; i++) {
      g.fillStyle = hsl(30 + rand() * 40, 12, 22 + rand() * 25);
      g.beginPath(); g.ellipse(rand() * s, rand() * s, 2 + rand() * 5, 2 + rand() * 4, rand() * 3, 0, Math.PI * 2); g.fill();
    }
  });
}

// Tileable normal map for rippling water: height from integer-period sines.
export function waterNormalTexture() {
  const size = 256;
  const rand = rng(99);
  const waves = Array.from({ length: 10 }, () => ({
    fx: Math.floor(rand() * 6) + 1, fy: Math.floor(rand() * 6) - 3, p: rand() * 6.28, a: 0.3 + rand() * 0.7,
  }));
  const height = (x, y) => waves.reduce((h, w) => h + w.a * Math.sin(((w.fx * x + w.fy * y) / size) * Math.PI * 2 + w.p), 0);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = height(x + 1, y) - height(x - 1, y);
      const dy = height(x, y + 1) - height(x, y - 1);
      const n = new THREE.Vector3(-dx * 2, -dy * 2, 1).normalize();
      const i = (y * size + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

export function floorTexture() {
  return canvasTexture(1024, 5, (g, s, rand) => {
    g.fillStyle = hsl(100, 38, 20);
    g.fillRect(0, 0, s, s);
    blotches(g, s, rand, 60, hsl(88, 45, 30, 0.35), hsl(120, 40, 10, 0.35));
    for (let i = 0; i < 14000; i++) {
      g.fillStyle = hsl(85 + rand() * 30, 35, 14 + rand() * 16, 0.7);
      g.fillRect(rand() * s, rand() * s, 1.2, 3);
    }
  }, { repeat: 12 });
}

// ------------------------------------------------------------------ whole-map painting
// The ground of the whole battlefield is painted into one atlas so roads, forest floor and
// meadow drifts run continuously across tile borders instead of stopping at each tile.

const makeCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};

function paintCanvas(size, seed, draw) {
  const c = makeCanvas(size, size);
  draw(c.getContext('2d'), size, rng(seed));
  return c;
}

function finishTexture(canvas, color = true) {
  const tex = new THREE.CanvasTexture(canvas);
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function hash3(x, y, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683) ^ Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Smooth 3D value noise in [0, 1].
export function vnoise(x, y, z = 0, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const f = (t) => t * t * (3 - 2 * t);
  const u = f(x - xi), v = f(y - yi), w = f(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, seed);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

export const fbm = (x, y, seed = 0) =>
  vnoise(x, y, 0, seed) * 0.55 + vnoise(x * 2.1, y * 2.1, 0, seed + 1) * 0.3 + vnoise(x * 4.3, y * 4.3, 0, seed + 2) * 0.15;

// Smooth noise over a w x h canvas (random lattices upscaled and blurred, several octaves).
// Returns the RGBA pixel array; noise at pixel j is data[j * 4] / 255.
function noiseField(w, h, rand, octaves) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  octaves.forEach(([cells, weight], k) => {
    const nx = Math.max(2, Math.round(cells)), ny = Math.max(2, Math.round((cells * h) / w));
    const small = makeCanvas(nx, ny), sg = small.getContext('2d');
    const img = sg.createImageData(nx, ny);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = img.data[i + 1] = img.data[i + 2] = rand() * 255;
      img.data[i + 3] = 255;
    }
    sg.putImageData(img, 0, 0);
    const blur = (w / nx) * 0.3, m = blur * 3;
    g.globalAlpha = k === 0 ? 1 : weight;
    g.filter = `blur(${blur}px)`;
    g.drawImage(small, -m, -m, w + 2 * m, h + 2 * m);
  });
  g.filter = 'none';
  g.globalAlpha = 1;
  return g.getImageData(0, 0, w, h).data;
}

// Paint shapes in white, blur them, then shape each pixel's coverage with fn(coverage, noise).
function makeMask(w, h, noise, draw, blur, fn) {
  const t = makeCanvas(w, h), tg = t.getContext('2d');
  tg.fillStyle = tg.strokeStyle = '#fff';
  draw(tg);
  const c = makeCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
  g.filter = blur > 0 ? `blur(${blur}px)` : 'none';
  g.drawImage(t, 0, 0);
  const img = g.getImageData(0, 0, w, h), d = img.data;
  const alpha = new Uint8ClampedArray(w * h);
  for (let j = 0, i = 0; j < w * h; j++, i += 4) {
    const a = Math.max(0, Math.min(1, fn(d[i + 3] / 255, noise[i] / 255)));
    alpha[j] = a * 255;
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = alpha[j];
  }
  g.filter = 'none';
  g.putImageData(img, 0, 0);
  return { canvas: c, alpha };
}

function paintThrough(g, mask, fill, opacity = 1) {
  const { width: w, height: h } = g.canvas;
  const l = makeCanvas(w, h), lg = l.getContext('2d');
  fill(lg, w, h);
  lg.globalCompositeOperation = 'destination-in';
  lg.drawImage(mask.canvas, 0, 0);
  g.globalAlpha = opacity;
  g.drawImage(l, 0, 0);
  g.globalAlpha = 1;
}

const fillWith = (style) => (g, w, h) => {
  g.fillStyle = typeof style === 'string' ? style : g.createPattern(style, 'repeat');
  g.fillRect(0, 0, w, h);
};

// Short blade strokes, wrapped at the edges so the tile repeats seamlessly.
function strokes(g, s, rand, count, color, len, width) {
  g.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = rand() * s, y = rand() * s, l = len[0] + rand() * len[1];
    const a = -Math.PI / 2 + (rand() - 0.5) * 1.1;
    g.strokeStyle = color(rand);
    g.lineWidth = width[0] + rand() * width[1];
    for (const [ox, oy] of [[0, 0], [-s, 0], [0, -s], [s, 0], [0, s]]) {
      g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke();
    }
  }
}

// Seamless pattern tiles (512 px = 4 tiles in the atlas).
const meadowTile = (seed) => paintCanvas(512, seed, (g, s, rand) => {
  g.fillStyle = hsl(92, 40, 40);
  g.fillRect(0, 0, s, s);
  blotches(g, s, rand, 30, hsl(84, 46, 48, 0.24), hsl(104, 42, 30, 0.2));
  strokes(g, s, rand, 2600, (r) => hsl(86 + r() * 16, 38 + r() * 10, 34 + r() * 9, 0.42), [3, 5], [1, 1]);
  strokes(g, s, rand, 260, (r) => hsl(80 + r() * 10, 46, 47 + r() * 6, 0.3), [2, 3], [0.8, 0.6]);
  speckle(g, s, rand, 70, (r) => (r() < 0.45 ? '#f6e27a' : r() < 0.6 ? '#f0f0ff' : '#e6a0c8'));
});

const forestFloorTile = (seed) => paintCanvas(512, seed, (g, s, rand) => {
  g.fillStyle = hsl(104, 40, 23);
  g.fillRect(0, 0, s, s);
  blotches(g, s, rand, 34, hsl(90, 45, 32, 0.35), hsl(120, 40, 12, 0.35));
  strokes(g, s, rand, 3800, (r) => hsl(92 + r() * 30, 35 + r() * 20, 16 + r() * 18, 0.8), [3, 6], [1, 1.4]);
  speckle(g, s, rand, 1400, (r) => hsl(26 + r() * 12, 40, 18 + r() * 14, 0.8));
});

const dirtTile = (seed) => paintCanvas(512, seed, (g, s, rand) => {
  g.fillStyle = hsl(37, 44, 57);
  g.fillRect(0, 0, s, s);
  blotches(g, s, rand, 34, hsl(40, 50, 70, 0.35), hsl(30, 35, 38, 0.28));
  speckle(g, s, rand, 5000, (r) => hsl(30 + r() * 12, 25 + r() * 20, 38 + r() * 30, 0.6));
  for (let i = 0; i < 90; i++) {
    const x = rand() * s, y = rand() * s, rx = 1.5 + rand() * 3.5, ry = 1 + rand() * 2.5, a = rand() * 3;
    g.fillStyle = 'rgba(60,40,20,0.35)';
    g.beginPath(); g.ellipse(x + 1, y + 1.2, rx, ry, a, 0, Math.PI * 2); g.fill();
    g.fillStyle = hsl(34 + rand() * 12, 10 + rand() * 12, 62 + rand() * 18);
    g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); g.fill();
  }
});

const rockyTile = (seed) => paintCanvas(512, seed, (g, s, rand) => {
  g.fillStyle = hsl(38, 14, 46);
  g.fillRect(0, 0, s, s);
  blotches(g, s, rand, 40, 'rgba(210,200,180,0.3)', 'rgba(50,44,36,0.35)');
  speckle(g, s, rand, 4000, (r) => hsl(40, 8 + r() * 10, 30 + r() * 40, 0.6));
  strokes(g, s, rand, 1200, (r) => hsl(80 + r() * 20, 40, 30 + r() * 14, 0.8), [3, 5], [1, 1.2]);
});

const pavingTile = (seed) => paintCanvas(512, seed, (g, s, rand) => {
  g.fillStyle = '#6a655a';
  g.fillRect(0, 0, s, s);
  const n = 12, cs = s / n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      g.fillStyle = hsl(38 + rand() * 10, 8 + rand() * 6, 56 + rand() * 14);
      const x = c * cs + (r % 2) * cs * 0.5;
      g.fillRect(x + 2, r * cs + 2, cs - 4, cs - 4);
      if (x + cs > s) g.fillRect(x - s + 2, r * cs + 2, cs - 4, cs - 4);
    }
  }
  speckle(g, s, rand, 3000, (r) => `rgba(0,0,0,${r() * 0.15})`);
});

// Small rounded cobbles set in packed dirt, for road approaches.
const cobbleTile = (seed) => paintCanvas(512, seed, (g, s, rand) => {
  g.fillStyle = hsl(34, 30, 42);
  g.fillRect(0, 0, s, s);
  const n = 22, cs = s / n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const x = (c + (r % 2) * 0.5 + (rand() - 0.5) * 0.2) * cs, y = (r + 0.5 + (rand() - 0.5) * 0.2) * cs;
      const rx = cs * (0.38 + rand() * 0.08), ry = cs * (0.34 + rand() * 0.08), a = rand() * 3;
      const l = 40 + rand() * 14;
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
        g.fillStyle = 'rgba(40,30,20,0.4)';
        g.beginPath(); g.ellipse(x + ox + 1, y + oy + 1.5, rx, ry, a, 0, Math.PI * 2); g.fill();
        g.fillStyle = hsl(36 + rand() * 8, 12 + rand() * 8, l);
        g.beginPath(); g.ellipse(x + ox, y + oy, rx, ry, a, 0, Math.PI * 2); g.fill();
        g.fillStyle = hsl(40, 20, l + 12, 0.5);
        g.beginPath(); g.ellipse(x + ox - rx * 0.2, y + oy - ry * 0.3, rx * 0.5, ry * 0.35, a, 0, Math.PI * 2); g.fill();
      }
    }
  }
});

const bedTile = (seed) => paintCanvas(256, seed, (g, s, rand) => {
  g.fillStyle = '#2b4640';
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 160; i++) {
    g.fillStyle = hsl(30 + rand() * 40, 12, 26 + rand() * 25);
    g.beginPath(); g.ellipse(rand() * s, rand() * s, 2 + rand() * 5, 2 + rand() * 4, rand() * 3, 0, Math.PI * 2); g.fill();
  }
});

// Smooth curve through points (Catmull-Rom as cubic Beziers).
function curvePath(g, pts) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    g.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
      p2[0], p2[1],
    );
  }
}

/**
 * Paint the battlefield ground.
 *  cellClass(c, r): 'grass' | 'forest' | 'village' | 'rock' | 'stone' | 'bed'
 *  roads:  polylines in tile units (x = column, y = row; cell centres at +0.5)
 *  fields: rectangles [x0, y0, x1, y1] in tile units, painted as tilled soil
 *  yards:  ellipses [x, y, rx, ry] in tile units, painted as trodden dirt
 * Row 0 is the top of the canvas (v = 1 with the default flipY).
 */
export function terrainAtlas({ cols, rows, px = 128, cellClass, roads = [], fields = [], yards = [], paved = [], seed = 1 }) {
  const w = cols * px, h = rows * px;
  const rand = rng(seed);
  const canvas = makeCanvas(w, h), g = canvas.getContext('2d');
  const noise = noiseField(w, h, rand, [[cols * 0.7, 1], [cols * 2.2, 0.5], [cols * 7, 0.35]]);
  const cellsOf = (...classes) => (tg) => {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (classes.includes(cellClass(c, r))) tg.fillRect(c * px, r * px, px, px);
    }
  };
  const everywhere = (tg) => tg.fillRect(0, 0, w, h);
  const ragged = (spread, lo = 0.42, hi = 0.58) => (a, n) => smooth(lo, hi, a + (n - 0.5) * spread);

  // Meadow with broad sunny and shady drifts.
  fillWith(meadowTile(seed + 1))(g, w, h);
  paintThrough(g, makeMask(w, h, noise, everywhere, 0, (a, n) => smooth(0.56, 0.76, n) * 0.26), fillWith(hsl(76, 60, 58)));
  paintThrough(g, makeMask(w, h, noise, everywhere, 0, (a, n) => smooth(0.44, 0.24, n) * 0.28), fillWith(hsl(112, 46, 28)));

  // Macro variation: broad warm (sunlit, golden) and cool (lush, blue-green) regions a few tiles
  // across, so the meadow pattern never reads as a repeat.
  const macro = noiseField(w, h, rand, [[cols * 0.28, 1], [cols * 0.6, 0.4]]);
  paintThrough(g, makeMask(w, h, macro, everywhere, 0, (a, n) => smooth(0.55, 0.8, n) * 0.18), fillWith(hsl(56, 58, 60)));
  paintThrough(g, makeMask(w, h, macro, everywhere, 0, (a, n) => smooth(0.45, 0.2, n) * 0.2), fillWith(hsl(128, 38, 30)));

  // Canopy shade and leaf litter spill a little beyond the forest edge, and damp, lusher grass
  // lines the river gorge, so the boundaries blend over neighbouring tiles.
  paintThrough(g, makeMask(w, h, noise, cellsOf('forest'), px * 0.6, (a, n) => smooth(0.05, 0.7, a + (n - 0.5) * 0.5) * 0.32), fillWith(hsl(112, 40, 20)));
  paintThrough(g, makeMask(w, h, noise, cellsOf('bed'), px * 0.3, (a, n) => smooth(0.02, 0.4, a + (n - 0.5) * 0.2) * 0.35), fillWith(hsl(120, 50, 24)));
  paintThrough(g, makeMask(w, h, noise, cellsOf('rock'), px * 0.3, (a, n) => smooth(0.1, 0.5, a + (n - 0.5) * 0.5) * 0.5), fillWith(rockyTile(seed + 8)));

  paintThrough(g, makeMask(w, h, noise, cellsOf('forest'), px * 0.26, ragged(1.0, 0.38, 0.62)), fillWith(forestFloorTile(seed + 2)));
  paintThrough(g, makeMask(w, h, noise, cellsOf('rock'), px * 0.2, ragged(0.7, 0.45, 0.62)), fillWith(rockyTile(seed + 3)));
  paintThrough(g, makeMask(w, h, noise, cellsOf('stone'), px * 0.05, ragged(0.3)), fillWith(pavingTile(seed + 4)));

  // Village yards and tilled plots under the wheat.
  const dirt = dirtTile(seed + 5);
  const yardShapes = (tg) => {
    for (const [x, y, rx, ry] of yards) { tg.beginPath(); tg.ellipse(x * px, y * px, rx * px, ry * px, 0, 0, Math.PI * 2); tg.fill(); }
  };
  paintThrough(g, makeMask(w, h, noise, yardShapes, px * 0.08, ragged(0.8, 0.35, 0.55)), fillWith(dirt), 0.85);
  const plots = (tg) => fields.forEach(([x0, y0, x1, y1]) => tg.fillRect(x0 * px, y0 * px, (x1 - x0) * px, (y1 - y0) * px));
  paintThrough(g, makeMask(w, h, noise, plots, px * 0.03, ragged(0.3)), (lg, lw, lh) => {
    lg.fillStyle = hsl(30, 42, 30); lg.fillRect(0, 0, lw, lh);
    lg.fillStyle = hsl(34, 40, 42);
    for (let y = 0; y < lh; y += px * 0.07) lg.fillRect(0, y, lw, px * 0.03);
  });

  // Roads: worn verge, dirt, lighter trodden centre, then grass tufts over the ragged edge.
  const roadShape = (width) => (tg) => {
    tg.lineWidth = width * px; tg.lineCap = tg.lineJoin = 'round';
    for (const road of roads) { curvePath(tg, road.map(([x, y]) => [x * px, y * px])); tg.stroke(); }
  };
  paintThrough(g, makeMask(w, h, noise, roadShape(0.74), px * 0.1, (a, n) => smooth(0.3, 0.6, a + (n - 0.5) * 0.6) * 0.5), fillWith(hsl(48, 38, 36)));
  const road = makeMask(w, h, noise, roadShape(0.52), px * 0.06, ragged(0.55));
  paintThrough(g, road, fillWith(dirt));
  paintThrough(g, makeMask(w, h, noise, roadShape(0.22), px * 0.08, (a, n) => a * (0.2 + n * 0.3)), fillWith(hsl(40, 50, 74)));
  // Cobbled approaches where the road meets a bridge or gate (paved: circles { x, y, r }).
  if (paved.length) {
    const clipped = (tg) => {
      tg.beginPath();
      for (const { x, y, r } of paved) { tg.moveTo(x * px + r * px, y * px); tg.arc(x * px, y * px, r * px, 0, Math.PI * 2); }
      tg.clip();
      roadShape(0.5)(tg);
    };
    paintThrough(g, makeMask(w, h, noise, clipped, px * 0.06, ragged(0.9, 0.3, 0.6)), fillWith(cobbleTile(seed + 7)), 0.85);
  }
  g.lineCap = 'round';
  for (let i = 0; i < w * h * 0.006; i++) {
    const x = rand() * w, y = rand() * h;
    const a = road.alpha[Math.floor(y) * w + Math.floor(x)];
    if (a < 20 || a > 170) continue;
    const l = 3 + rand() * 6, ang = -Math.PI / 2 + (rand() - 0.5) * 1.2;
    g.strokeStyle = hsl(78 + rand() * 20, 48 + rand() * 16, 30 + rand() * 18, 0.9);
    g.lineWidth = 1 + rand() * 1.4;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * l, y + Math.sin(ang) * l); g.stroke();
  }

  // Riverbed under the water (hard edge: it sits at the foot of the gorge walls).
  paintThrough(g, makeMask(w, h, noise, cellsOf('bed'), 0, (a) => a), fillWith(bedTile(seed + 6)));

  return finishTexture(canvas);
}

/**
 * River surface colour (turquoise shallows to a deep blue channel) and a foam mask (white with
 * alpha) for bank lines, rocks, their downstream wakes and extra spots such as waterfall pools.
 *  isWater(c, r): true for river/bridge cells; beyond the top and bottom map edge counts as
 *  water (the river enters and leaves there).
 *  rocks / spots: { x, y, r } in tile units.
 */
export function riverTextures({ cols, rows, px = 64, isWater, rocks = [], spots = [], seed = 3, share = null }) {
  const w = cols * px, h = rows * px;
  const water = (c, r) => (c < 0 || c >= cols ? false : r < 0 || r >= rows ? true : isWater(c, r));
  const colorC = makeCanvas(w, h), foamC = makeCanvas(w, h);
  const cg = colorC.getContext('2d'), fg = foamC.getContext('2d');
  const ci = cg.createImageData(w, h), fi = fg.createImageData(w, h);
  const near = new Map();
  for (const k of [...rocks.map((o) => ({ ...o, wake: true })), ...spots]) {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const key = `${Math.floor(k.x) + dc},${Math.floor(k.y) + dr}`;
      if (!near.has(key)) near.set(key, []);
      near.get(key).push(k);
    }
  }
  const shallow = [52, 146, 186], mid = [30, 104, 178], deep = [16, 60, 136];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const tx = (x + 0.5) / px, ty = (y + 0.5) / px, c = Math.floor(tx), r = Math.floor(ty);
      let d = 9;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (water(c + dc, r + dr)) continue;
        const dx = Math.max(c + dc - tx, 0, tx - (c + dc + 1)), dy = Math.max(r + dr - ty, 0, ty - (r + dr + 1));
        d = Math.min(d, Math.hypot(dx, dy));
      }
      if (!water(c, r)) d = 0;
      // Rounded banks: distance from the bank contour (share = 0.5), which is where the land ends.
      if (share && d < 0.7) {
        const sh = share(tx, ty);
        const ds = (sh - 0.5) / 1.25;
        d = sh > 0.97 ? Math.max(d, ds) : Math.max(0, ds);
      }
      const n = fbm(tx * 2.5, ty * 2.5, seed), n2 = fbm(tx * 9, ty * 9, seed + 7);
      const depth = smooth(0.02, 0.5, d + (n - 0.5) * 0.2);
      const k1 = smooth(0, 0.5, depth), k2 = smooth(0.5, 1, depth);
      const streak = (vnoise(tx * 16, ty * 2.5, 0, seed + 3) - 0.5) * 4;
      for (let ch = 0; ch < 3; ch++) {
        ci.data[i + ch] = shallow[ch] + (mid[ch] - shallow[ch]) * k1 + (deep[ch] - mid[ch]) * k2 + streak;
      }
      ci.data[i + 3] = 255;

      let f = 1 - smooth(0.012, 0.06 + n2 * 0.08, d);
      for (const k of near.get(`${c},${r}`) ?? []) {
        const dx = tx - k.x, dy = ty - k.y, rd = Math.hypot(dx, dy) - k.r;
        f = Math.max(f, (1 - smooth(0, 0.03 + n2 * 0.04 + (k.wake ? 0 : k.r * 0.6), rd)) * (k.wake ? 0.6 : 1));
        if (k.wake && dy > 0 && dy < 0.45) {
          const spread = k.r * (0.9 + dy * 1.6);
          const wake = (1 - smooth(spread * 0.5, spread, Math.abs(dx))) * (1 - dy / 0.45);
          f = Math.max(f, wake * 0.45 * smooth(0.3, 0.7, vnoise(tx * 30, ty * 8, 0, seed + 5)));
        }
      }
      f *= 0.6 + 0.4 * n2;
      fi.data[i] = 244; fi.data[i + 1] = 250; fi.data[i + 2] = 255;
      fi.data[i + 3] = Math.min(1, f) * 255;
    }
  }
  cg.putImageData(ci, 0, 0);
  fg.putImageData(fi, 0, 0);
  return { color: finishTexture(colorC), foam: finishTexture(foamC) };
}

// Tileable bubbly foam breakup, scrolled at runtime and used as the foam's alpha map.
export function foamNoiseTexture() {
  const c = paintCanvas(256, 17, (g, s, rand) => {
    g.fillStyle = '#303030';
    g.fillRect(0, 0, s, s);
    blotches(g, s, rand, 70, 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0.3)');
    for (let i = 0; i < 500; i++) {
      const x = rand() * s, y = rand() * s, r = 1.5 + rand() * 4;
      g.fillStyle = `rgba(255,255,255,${0.4 + rand() * 0.5})`;
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
        g.beginPath(); g.arc(x + ox, y + oy, r, 0, Math.PI * 2); g.fill();
      }
    }
  });
  const tex = finishTexture(c, false);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  return tex;
}
