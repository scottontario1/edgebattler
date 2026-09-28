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
    g.fillStyle = '#26361f';
    g.fillRect(0, 0, s, s);
    blotches(g, s, rand, 60, 'rgba(70,100,50,0.25)', 'rgba(10,20,8,0.35)');
    for (let i = 0; i < 12000; i++) {
      g.fillStyle = hsl(90 + rand() * 20, 30, 12 + rand() * 18, 0.7);
      g.fillRect(rand() * s, rand() * s, 1.2, 3);
    }
  }, { repeat: 12 });
}
