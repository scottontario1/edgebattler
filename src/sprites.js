import * as THREE from 'three';
import { isPortrait } from './camera.js';

// Illustrated 2D sprites standing on the 3D map (docs/asset-pipeline-plan.md, milestone 1).
// The runtime PNGs and their foot anchors come from tools/assets/prep_sprites.py; the supplied
// source art in design_assets/ is never modified. Each sprite is an upright, camera-facing
// cutout: alpha-tested so it depth-sorts against trees, bridges and neighbours, and unlit so the
// painted colours and ink lines are what the player sees.

// Visible height of the drawn character (hair to boot sole) in world units. The old 3D
// models stood 1.3 tall; sprites keep that so map footprints and selection stay the same.
const SPRITE_HEIGHT = { brenna: 1.3, dreg: 1.34 };
// Tilt of the map camera (src/camera.js). An upright plane is foreshortened by cos(tilt), so it
// is stretched by 1/cos(tilt) to read at its drawn proportions instead of looking squashed.
const TILT = { landscape: THREE.MathUtils.degToRad(40), portrait: THREE.MathUtils.degToRad(52) };
// Tone mapping (ACES) in the post stack dulls unlit colours; a small gain keeps the painted palette.
const GAIN = 1.08;

const manifestP = fetch(`${import.meta.env.BASE_URL}sprites/manifest.json`).then((r) => r.json());
const textures = new Map();
function texture(url) {
  if (!textures.has(url)) {
    const t = new THREE.TextureLoader().loadAsync(url).then((tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      return tex;
    });
    textures.set(url, t);
  }
  return textures.get(url);
}

// Alpha lookup by UV, sampled once from the texture image.
function alphaMask(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  return (u, v) => {
    const x = Math.min(c.width - 1, Math.max(0, Math.floor(u * c.width)));
    const y = Math.min(c.height - 1, Math.max(0, Math.floor((1 - v) * c.height)));
    return d[(y * c.width + x) * 4 + 3] / 255;
  };
}

export const hasSprite = (id) => id in SPRITE_HEIGHT;

// Same interface as buildHero() in models.js: { root, setActive(bool), update(dt, t) }.
// `flip` mirrors the drawing so it faces the other way (sprites face screen-right).
export async function buildSprite(id, faction, { flip = false } = {}) {
  const manifest = await manifestP;
  const info = manifest[id];
  const tex = await texture(`${import.meta.env.BASE_URL}${info.file}`);

  // World size of the whole image: visibleHeight pixels correspond to SPRITE_HEIGHT.
  const ppu = info.visibleHeight / SPRITE_HEIGHT[id];
  const w = info.size[0] / ppu;
  const h = info.size[1] / ppu;
  const geo = new THREE.PlaneGeometry(w, h);
  // Pivot at the foot anchor: local origin = feet, x = 0 at the anchor column.
  const ax = flip ? 1 - info.anchor[0] : info.anchor[0];
  geo.translate((0.5 - ax) * w, h / 2 - (1 - info.anchor[1]) * h, 0);
  if (flip) {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  }
  const mat = new THREE.MeshBasicMaterial({
    map: tex, alphaTest: 0.5, side: THREE.DoubleSide, color: new THREE.Color(GAIN, GAIN, GAIN),
  });
  const mesh = new THREE.Mesh(geo, mat);
  // Picking follows the drawing, not its rectangle: a hit on a transparent pixel is ignored so
  // clicks fall through to the unit or tile behind the cape.
  const alpha = alphaMask(tex.image);
  const quadRaycast = THREE.Mesh.prototype.raycast;
  mesh.raycast = (raycaster, hits) => {
    const before = hits.length;
    quadRaycast.call(mesh, raycaster, hits);
    for (let i = hits.length - 1; i >= before; i--) {
      const uv = hits[i].uv;
      if (!uv || alpha(uv.x, uv.y) < 0.5) hits.splice(i, 1);
    }
  };
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const root = new THREE.Group();
  root.add(mesh);
  let active = 0;
  let target = 0;
  return {
    root,
    billboard: true,
    setActive(a) { target = a ? 1 : 0; },
    update(dt, t) {
      active += (target - active) * Math.min(1, dt * 8);
      const cos = Math.cos(isPortrait() ? TILT.portrait : TILT.landscape);
      // Foreshortening compensation, plus a slight breathing stretch anchored at the feet.
      mesh.scale.y = (1 / cos) * (1 + Math.sin(t * 1.9 + h * 7) * 0.006 + active * 0.008);
    },
  };
}
