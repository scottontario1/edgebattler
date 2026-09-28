import * as THREE from 'three';

// Flat painted anime faces for the from-scratch heroes (tools/blender/humanoid.py). The head
// mesh's UVs are a planar front projection over FACE_UV, so the texture is drawn directly in
// head space (metres): x across, z up. No eye or pupil geometry exists on the model.
const FACE_UV = { x0: -0.13, x1: 0.13, z0: 0.85, z1: 1.19 }; // keep in sync with humanoid.FACE_UV
const SIZE = 1024;

const shade = (hex, amt) => {
  const c = new THREE.Color(hex);
  const hsl = c.getHSL({});
  return `#${c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amt, 0, 1)).getHexString()}`;
};

// One preset per gaze. Positions in head space; brow tilt > 0 raises the outer end.
const GAZE = {
  noble: { eyeX: 0.056, eyeZ: 0.998, w: 0.074, h: 0.05, brow: 0.014, browZ: 1.055, browW: 0.0075, lidLow: 0.2, mouth: 'calm', blush: 0.35 },
  fierce: { eyeX: 0.057, eyeZ: 0.993, w: 0.07, h: 0.036, brow: -0.02, browZ: 1.036, browW: 0.016, lidLow: 0.42, mouth: 'hidden', blush: 0 },
};

function eye(g, cx, cz, side, o, look) {
  const { w, h } = o;
  const x0 = cx - (w / 2) * side, x1 = cx + (w / 2) * side; // inner and outer corners
  const top = (t) => cz + h * (0.55 * Math.sin(Math.PI * t) + 0.12 * (1 - t) * 0);
  // sclera: almond with a sharp outer corner
  g.beginPath();
  g.moveTo(x0, cz - h * 0.05);
  g.bezierCurveTo(x0 + w * 0.2 * side, cz + h * 0.62, x1 - w * 0.25 * side, cz + h * 0.58, x1, cz + h * 0.1);
  g.bezierCurveTo(x1 - w * 0.22 * side, cz - h * 0.36, x0 + w * 0.3 * side, cz - h * 0.5, x0, cz - h * 0.05);
  g.closePath();
  g.fillStyle = '#f7f1ea';
  g.fill();
  g.save();
  g.clip();
  // iris: tall ellipse, dark at the lid fading to a bright lower half, then pupil and specular
  const ix = cx + side * w * 0.03, iz = cz + h * 0.02, ir = h * 0.5;
  const grad = g.createLinearGradient(0, iz + ir, 0, iz - ir);
  grad.addColorStop(0, shade(look.eyes, 0.28));
  grad.addColorStop(0.5, look.eyes);
  grad.addColorStop(1, shade(look.eyes, -0.42));
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(ix, iz, w * 0.27, ir, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#120b16';
  g.beginPath();
  g.ellipse(ix, iz - h * 0.02, w * 0.11, ir * 0.55, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)'; // lower iris glow ring
  g.beginPath();
  g.ellipse(ix, iz - ir * 0.55, w * 0.16, ir * 0.22, 0, 0, Math.PI * 2);
  g.fill();
  // lid shadow across the top of the eyeball
  g.fillStyle = 'rgba(70,40,60,0.28)';
  g.fillRect(cx - w, cz + h * o.lidLow * 0.5, w * 2, h);
  g.restore();
  g.fillStyle = '#ffffff'; // specular dots
  g.beginPath();
  g.ellipse(ix - side * w * 0.09, iz + ir * 0.34, w * 0.055, h * 0.1, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(ix + side * w * 0.08, iz - ir * 0.4, w * 0.026, h * 0.05, 0, 0, Math.PI * 2);
  g.fill();
  // upper lash: thick dark line, thickest at the outer end with a flick
  g.strokeStyle = shade(look.hair, -0.42);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = h * 0.2;
  g.beginPath();
  g.moveTo(x0 - side * w * 0.02, cz - h * 0.02);
  g.bezierCurveTo(x0 + w * 0.2 * side, cz + h * 0.64, x1 - w * 0.25 * side, cz + h * 0.62, x1 + side * w * 0.02, cz + h * 0.14);
  g.stroke();
  g.lineWidth = h * 0.14;
  g.beginPath();
  g.moveTo(x1 + side * w * 0.01, cz + h * 0.14);
  g.quadraticCurveTo(x1 + side * w * 0.14, cz + h * 0.2, x1 + side * w * 0.2, cz + h * 0.32);
  g.stroke();
  // lower lash line and eyelid crease
  g.lineWidth = h * 0.05;
  g.strokeStyle = shade(look.skin, -0.38);
  g.beginPath();
  g.moveTo(x0 + side * w * 0.12, cz - h * 0.36);
  g.bezierCurveTo(x0 + w * 0.3 * side, cz - h * 0.52, x1 - w * 0.3 * side, cz - h * 0.48, x1 - side * w * 0.05, cz - h * 0.1);
  g.stroke();
  g.beginPath();
  g.moveTo(x0 + side * w * 0.1, cz + h * 0.74);
  g.quadraticCurveTo(cx, cz + h * 0.98, x1, cz + h * 0.5);
  g.stroke();
}

function brow(g, cx, side, o, look) {
  const inner = { x: cx - side * o.w * 0.5, z: o.browZ - o.brow * 0.5 };
  const outer = { x: cx + side * o.w * 0.66, z: o.browZ + o.brow * 0.5 };
  const mid = { x: (inner.x + outer.x) / 2, z: Math.max(inner.z, outer.z) + Math.abs(o.brow) * 0.4 + 0.004 };
  g.fillStyle = shade(look.hair, -0.3);
  g.beginPath();
  g.moveTo(inner.x, inner.z - o.browW * 0.5);
  g.quadraticCurveTo(mid.x, mid.z - o.browW * 0.2, outer.x, outer.z - o.browW * 0.1);
  g.quadraticCurveTo(mid.x, mid.z + o.browW * 0.6, inner.x, inner.z + o.browW * 0.55);
  g.closePath();
  g.fill();
}

export function faceTexture(look, gaze = 'noble') {
  const o = GAZE[gaze] ?? GAZE.noble;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d');
  const sx = SIZE / (FACE_UV.x1 - FACE_UV.x0), sz = SIZE / (FACE_UV.z1 - FACE_UV.z0);
  g.setTransform(sx, 0, 0, -sz, -FACE_UV.x0 * sx, FACE_UV.z1 * sz); // head space, z up
  g.fillStyle = look.skin;
  g.fillRect(FACE_UV.x0 - 0.05, FACE_UV.z0 - 0.05, FACE_UV.x1 - FACE_UV.x0 + 0.1, FACE_UV.z1 - FACE_UV.z0 + 0.1);
  // hard cel shadows: down the far (screen-right) cheek and under the chin
  g.fillStyle = shade(look.skin, -0.09);
  g.beginPath();
  g.moveTo(0.075, 1.1);
  g.quadraticCurveTo(0.118, 1.0, 0.09, 0.92);
  g.lineTo(0.13, 0.92);
  g.lineTo(0.13, 1.1);
  g.closePath();
  g.fill();
  g.fillRect(-0.13, 0.85, 0.26, 0.05);
  if (o.blush) {
    for (const s of [-1, 1]) {
      const rg = g.createRadialGradient(s * 0.078, 0.955, 0, s * 0.078, 0.955, 0.028);
      rg.addColorStop(0, `rgba(238,120,120,${o.blush * 0.7})`);
      rg.addColorStop(1, 'rgba(238,120,120,0)');
      g.fillStyle = rg;
      g.fillRect(s * 0.078 - 0.03, 0.925, 0.06, 0.06);
    }
  }
  // nose: a small cel shadow and a highlight
  g.strokeStyle = shade(look.skin, -0.2);
  g.lineWidth = 0.0035;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0.006, 0.975);
  g.quadraticCurveTo(0.014, 0.955, 0.004, 0.949);
  g.stroke();
  for (const s of [-1, 1]) {
    eye(g, s * o.eyeX, o.eyeZ, s, o, look);
    brow(g, s * o.eyeX, s, o, look);
  }
  if (o.mouth === 'calm') {
    g.strokeStyle = shade(look.skin, -0.34);
    g.lineWidth = 0.0032;
    g.beginPath();
    g.moveTo(-0.02, 0.918);
    g.quadraticCurveTo(0, 0.912, 0.021, 0.92);
    g.stroke();
    g.strokeStyle = 'rgba(214,110,110,0.55)';
    g.lineWidth = 0.004;
    g.beginPath();
    g.moveTo(-0.012, 0.906);
    g.quadraticCurveTo(0.002, 0.902, 0.014, 0.908);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false; // glTF UVs have v down from the top; matches how the mesh was exported
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}
