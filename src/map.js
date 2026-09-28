import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  grassTexture, dirtTexture, rockTexture, stoneTexture, woodTexture, riverbedTexture,
  waterNormalTexture, floorTexture, cliffTexture, waterfallTexture,
} from './textures.js';

// 16 x 12 battlefield. Row 0 is the far (north) edge, row 11 the near edge.
// G plains, F forest, M mountain, W river, B bridge, R road, V village,
// C blue castle, K red castle.
export const LAYOUT = [
  'MMMFGGGWGGGFFMMM',
  'MMFFGGGWGGRRKGMM',
  'MFFGGVGWGGRGGGFM',
  'FFGGGGGWWGRGFFFM',
  'FGGGFFGGWGRGGVFF',
  'GGRRRRRRBRRGGGFF',
  'GGRGFFGGWGGGFFGG',
  'FGRGGGGWWGGMMGGF',
  'FGRGVGGWGGGMMMGF',
  'MGRRGGWWGGFFGGFM',
  'MMCRGGWGGFFFGGMM',
  'MMMGGFWGGFFGMMMM',
];

export const W = 16;
export const H = 12;

LAYOUT.forEach((row, r) => {
  if (row.length !== W) throw new Error(`map row ${r} has ${row.length} tiles, expected ${W}`);
});

export const TERRAIN = {
  G: { name: 'Plains', def: 0, avo: 0, h: 0.22 },
  F: { name: 'Forest', def: 1, avo: 20, h: 0.22 },
  M: { name: 'Mountain', def: 2, avo: 30, h: 0.3 },
  W: { name: 'River', def: 0, avo: 0, h: 0.05 },
  R: { name: 'Road', def: 0, avo: 0, h: 0.22 },
  B: { name: 'Bridge', def: 0, avo: 0, h: 0.05 },
  V: { name: 'Village', def: 0, avo: 10, h: 0.22 },
  C: { name: 'Castle', def: 3, avo: 30, h: 0.24 },
  K: { name: 'Castle', def: 3, avo: 30, h: 0.24 },
};

export const FACTION_COLORS = { blue: 0x2f62c4, red: 0xc0392b };

export const inBounds = (c, r) => c >= 0 && r >= 0 && c < W && r < H;
export const terrainAt = (c, r) => LAYOUT[r][c];

export function toWorld(c, r) {
  return new THREE.Vector3(c - (W - 1) / 2, 0, r - (H - 1) / 2);
}

// Elevation: the river runs in a gorge (level 0), land sits at level 1, and mountains
// plus a few wooded hills rise to level 2. Each level adds LEVEL world units of height.
export const LEVEL = 0.3;
const HILLS = new Set(['1,2', '2,2', '1,3', '2,1', '10,9', '11,9', '9,10', '10,10', '11,10']);
export const LAND_TOP = TERRAIN.G.h + LEVEL; // 0.52; tools/blender/build_env.py matches this
export const WATER_Y = 0.16;

export function levelAt(c, r) {
  const t = terrainAt(c, r);
  if (t === 'W' || t === 'B') return 0;
  if (t === 'M' || HILLS.has(`${c},${r}`)) return 2;
  return 1;
}

// Top surface of the tile block itself.
function groundTop(c, r) {
  const t = terrainAt(c, r);
  return t === 'W' || t === 'B' ? TERRAIN[t].h : TERRAIN[t].h + levelAt(c, r) * LEVEL;
}

// Height a unit (or overlay) stands at on this tile.
export function tileTop(c, r) {
  const t = terrainAt(c, r);
  if (t === 'B') return LAND_TOP + 0.01; // bridge deck
  if (t === 'W') return WATER_Y - 0.04;
  return groundTop(c, r);
}

export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...opts }));
  }
  return matCache.get(key);
}

// Three texture variants per terrain so neighbouring tiles don't repeat.
const variants = (make) => [0, 1, 2].map((i) => make(i));
const TILE_MATS = {
  G: variants((i) => new THREE.MeshStandardMaterial({ map: grassTexture(10 + i, 86), roughness: 0.95 })),
  V: variants((i) => new THREE.MeshStandardMaterial({ map: grassTexture(20 + i, 80), roughness: 0.95 })),
  F: variants((i) => new THREE.MeshStandardMaterial({ map: grassTexture(30 + i, 104), color: 0xb8c8a8, roughness: 0.95 })),
  R: variants((i) => new THREE.MeshStandardMaterial({ map: dirtTexture(40 + i), roughness: 1 })),
  M: variants((i) => new THREE.MeshStandardMaterial({ map: rockTexture(50 + i), roughness: 1 })),
  C: variants((i) => new THREE.MeshStandardMaterial({ map: stoneTexture(60 + i), roughness: 0.9 })),
  W: variants((i) => new THREE.MeshStandardMaterial({ map: riverbedTexture(70 + i), roughness: 1 })),
};
TILE_MATS.K = TILE_MATS.C;
TILE_MATS.B = TILE_MATS.W;

// Tile blocks use the terrain texture on top and rock strata on the sides
// (BoxGeometry face order: +x, -x, +y, -y, +z, -z).
const cliffMats = variants((i) => new THREE.MeshStandardMaterial({ map: cliffTexture(90 + i), roughness: 1 }));
const blockMats = (top, rand) => {
  const side = cliffMats[Math.floor(rand() * cliffMats.length)];
  return [side, side, top, side, side, side];
};

const rockMat = new THREE.MeshStandardMaterial({ map: rockTexture(80), roughness: 0.95, flatShading: true });
const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTexture(81), color: 0xe8e2d0, roughness: 0.9 });
const woodMat = new THREE.MeshStandardMaterial({ map: woodTexture(82), roughness: 0.8 });

const tileGeoCache = new Map();
function tileGeo(h) {
  if (!tileGeoCache.has(h)) tileGeoCache.set(h, new RoundedBoxGeometry(0.96, h, 0.96, 3, 0.035));
  return tileGeoCache.get(h);
}

function add(parent, geo, material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

const box = new THREE.BoxGeometry(1, 1, 1);

function jitterHex(hex, rand, amount = 0.06) {
  const c = new THREE.Color(hex);
  c.offsetHSL((rand() - 0.5) * 0.03, (rand() - 0.5) * amount, (rand() - 0.5) * amount);
  return c.getHex();
}

// Deterministic bumpiness so seam vertices move together (no cracks).
function roughen(geo, seed, amount) {
  const pos = geo.attributes.position;
  const top = Math.max(...Array.from({ length: pos.count }, (_, i) => pos.getY(i)));
  const bottom = Math.min(...Array.from({ length: pos.count }, (_, i) => pos.getY(i)));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.3) * 43758.5453;
    const f = (n - Math.floor(n) - 0.5) * amount * (1 - (y - bottom) / (top - bottom));
    pos.setXYZ(i, x * (1 + f), y + f * 0.1, z * (1 + f));
  }
  geo.computeVertexNormals();
  return geo;
}

function pine(parent, x, z, y, rand, scale = 1) {
  const s = scale * (0.8 + rand() * 0.45);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(s);
  add(g, new THREE.CylinderGeometry(0.022, 0.035, 0.14, 6), mat(0x5b3a1e), 0, 0.07, 0);
  const green = jitterHex(0x2d5f2a, rand, 0.12);
  add(g, new THREE.ConeGeometry(0.19, 0.24, 9), mat(green), 0, 0.2, 0);
  add(g, new THREE.ConeGeometry(0.15, 0.22, 9), mat(jitterHex(green, rand)), 0, 0.31, 0);
  add(g, new THREE.ConeGeometry(0.1, 0.18, 9), mat(jitterHex(green, rand)), 0, 0.42, 0);
  g.rotation.y = rand() * Math.PI;
  parent.add(g);
}

function oak(parent, x, z, y, rand, scale = 1) {
  const s = scale * (0.8 + rand() * 0.4);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(s);
  add(g, new THREE.CylinderGeometry(0.025, 0.04, 0.18, 6), mat(0x5b3a1e), 0, 0.09, 0);
  const palette = [0x4f7f30, 0x5b8a34, 0x467a2c, 0x6f8f2e, 0xb0772a];
  const base = palette[Math.floor(rand() * (rand() < 0.12 ? 5 : 4))];
  for (let i = 0; i < 4; i++) {
    const r = 0.1 + rand() * 0.05;
    add(g, new THREE.IcosahedronGeometry(r, 1), mat(jitterHex(base, rand, 0.1)),
      (rand() - 0.5) * 0.12, 0.24 + rand() * 0.1, (rand() - 0.5) * 0.12);
  }
  parent.add(g);
}

function tree(parent, x, z, y, rand, scale) {
  (rand() < 0.55 ? pine : oak)(parent, x, z, y, rand, scale);
}

function house(parent, x, z, y, rand) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = (rand() - 0.5) * 0.6;
  const plaster = mat(0xeee3c8, { flatShading: false });
  const beam = mat(0x3e2616);
  add(g, box, stoneMat, 0, 0.03, 0).scale.set(0.37, 0.06, 0.31);
  add(g, box, plaster, 0, 0.15, 0).scale.set(0.34, 0.2, 0.28);
  // Timber framing
  for (const sx of [-0.165, 0, 0.165]) add(g, box, beam, sx, 0.15, 0.142).scale.set(0.02, 0.2, 0.01);
  add(g, box, beam, 0, 0.18, 0.142).scale.set(0.34, 0.018, 0.01);
  add(g, box, beam, 0.172, 0.15, 0).scale.set(0.01, 0.2, 0.28);
  const roof = add(g, new THREE.ConeGeometry(0.3, 0.22, 4), mat(0x8e3f26), 0, 0.36, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.85);
  add(g, box, mat(0x4a2e1a), -0.07, 0.1, 0.142).scale.set(0.07, 0.12, 0.012);
  add(g, box, mat(0xf2c86a, { emissive: 0xf2a040, emissiveIntensity: 0.6 }), 0.08, 0.16, 0.143).scale.set(0.05, 0.05, 0.01);
  add(g, box, stoneMat, 0.1, 0.42, -0.04).scale.set(0.05, 0.14, 0.05);
  parent.add(g);

  // Low fence along the front edge of the tile.
  for (let i = 0; i < 5; i++) add(parent, box, woodMat, x - 0.36 + i * 0.18, y + 0.04, z + 0.4).scale.set(0.02, 0.08, 0.02);
  add(parent, box, woodMat, x, y + 0.06, z + 0.4).scale.set(0.74, 0.015, 0.015);
}

function castle(parent, x, z, y, faction) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const roofMat = mat(FACTION_COLORS[faction], { flatShading: false, roughness: 0.6 });
  // Curtain walls with crenellations
  for (const [wx, wz, sx, sz] of [[0, 0.34, 0.7, 0.06], [0, -0.34, 0.7, 0.06], [0.34, 0, 0.06, 0.7], [-0.34, 0, 0.06, 0.7]]) {
    add(g, box, stoneMat, wx, 0.09, wz).scale.set(sx, 0.18, sz);
    const along = sx > sz;
    for (let i = -3; i <= 3; i++) {
      add(g, box, stoneMat, wx + (along ? i * 0.09 : 0), 0.2, wz + (along ? 0 : i * 0.09)).scale.set(0.045, 0.04, 0.045);
    }
  }
  for (const [tx, tz] of [[-0.34, -0.34], [0.34, -0.34], [-0.34, 0.34], [0.34, 0.34]]) {
    add(g, new THREE.CylinderGeometry(0.09, 0.1, 0.34, 14), stoneMat, tx, 0.17, tz);
    add(g, new THREE.ConeGeometry(0.125, 0.2, 14), roofMat, tx, 0.44, tz);
  }
  add(g, box, stoneMat, 0, 0.24, -0.02).scale.set(0.36, 0.48, 0.36);
  const roof = add(g, new THREE.ConeGeometry(0.3, 0.28, 4), roofMat, 0, 0.62, -0.02);
  roof.rotation.y = Math.PI / 4;
  add(g, box, mat(0x2a1d12), 0, 0.08, 0.372).scale.set(0.14, 0.15, 0.02);
  add(g, box, mat(0xd4a93c, { metalness: 0.8, roughness: 0.3 }), 0, 0.3, 0.162).scale.set(0.08, 0.08, 0.01);
  add(g, new THREE.CylinderGeometry(0.008, 0.008, 0.36, 5), mat(0x3b2a1a), 0, 0.9, -0.02);
  parent.add(g);
}

// The flag animates, so it stays out of the merged static geometry.
function makeFlag(x, y, z, faction, flags) {
  const flagGeo = new THREE.PlaneGeometry(0.24, 0.13, 16, 4);
  flagGeo.translate(0.12, 0, 0);
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color: FACTION_COLORS[faction], side: THREE.DoubleSide, roughness: 0.7 }));
  flag.position.set(x, y, z);
  flag.castShadow = true;
  flags.push({ mesh: flag, base: flagGeo.attributes.position.array.slice() });
}

function mountain(parent, x, z, y, rand, seed) {
  const peakGeo = roughen(new THREE.ConeGeometry(0.42, 0.66, 9, 5), seed, 0.35);
  const peak = add(parent, peakGeo, rockMat, x, y + 0.33, z);
  peak.rotation.y = rand() * Math.PI;
  const snow = add(parent, roughen(new THREE.ConeGeometry(0.15, 0.22, 9, 2), seed + 1, 0.2), mat(0xf6f4ee, { roughness: 0.6 }), x, y + 0.56, z);
  snow.rotation.y = peak.rotation.y;
  const small = add(parent, roughen(new THREE.ConeGeometry(0.22, 0.34, 7, 3), seed + 2, 0.35), rockMat,
    x + (rand() - 0.5) * 0.4, y + 0.17, z + 0.22);
  small.rotation.y = rand() * Math.PI;
  for (let i = 0; i < 3; i++) {
    add(parent, new THREE.DodecahedronGeometry(0.035 + rand() * 0.03, 0), rockMat,
      x + (rand() - 0.5) * 0.8, y + 0.02, z + (rand() - 0.5) * 0.8);
  }
}

function sliceGeometry(geo, start, count) {
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(geo.attributes)) {
    const n = attr.itemSize;
    out.setAttribute(name, new THREE.BufferAttribute(attr.array.slice(start * n, (start + count) * n), n));
  }
  return out;
}

// Collapse every static mesh into one mesh per material: ~2000 draw calls become ~40.
function mergeStatics(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
    for (const name of Object.keys(geo.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    }
    // Multi-material meshes are split into one piece per material group.
    const parts = Array.isArray(o.material)
      ? geo.groups.map((g) => [o.material[g.materialIndex], sliceGeometry(geo, g.start, g.count)])
      : [[o.material, geo]];
    for (const [material, part] of parts) {
      const key = `${material.uuid}|${o.castShadow}`;
      if (!buckets.has(key)) buckets.set(key, { material, cast: o.castShadow, geos: [] });
      buckets.get(key).geos.push(part);
    }
  });
  const out = new THREE.Group();
  for (const { material, cast, geos } of buckets.values()) {
    const m = new THREE.Mesh(mergeGeometries(geos), material);
    m.castShadow = cast;
    m.receiveShadow = true;
    out.add(m);
  }
  return out;
}

function grassBlades(tiles, rand, time) {
  const geo = new THREE.ConeGeometry(0.011, 0.085, 3, 1).translate(0, 0.0425, 0);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float h = position.y / 0.085;
       float sway = sin(uTime * 1.7 + instanceMatrix[3].x * 1.9 + instanceMatrix[3].z * 1.3) * h * h;
       transformed.x += sway * 0.02;
       transformed.z += sway * 0.01;`,
    );
  };
  const perTile = { G: 55, V: 30, F: 25 };
  const total = tiles.reduce((n, t) => n + (perTile[t.t] || 0), 0);
  const mesh = new THREE.InstancedMesh(geo, material, total);
  mesh.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const color = new THREE.Color();
  let i = 0;
  for (const { t, x, z, h } of tiles) {
    for (let k = 0; k < (perTile[t] || 0); k++) {
      p.set(x + (rand() - 0.5) * 0.9, h, z + (rand() - 0.5) * 0.9);
      e.set((rand() - 0.5) * 0.5, rand() * Math.PI, (rand() - 0.5) * 0.5);
      q.setFromEuler(e);
      const k2 = 0.7 + rand() * 0.8;
      s.set(k2, k2 * (0.8 + rand() * 0.6), k2);
      mesh.setMatrixAt(i, m.compose(p, q, s));
      mesh.setColorAt(i, color.setHSL(0.24 + rand() * 0.06, 0.45 + rand() * 0.2, 0.28 + rand() * 0.18));
      i++;
    }
  }
  return mesh;
}

// Blender-built models (tools/blender/build_env.py). If a file is missing, the map falls
// back to procedural pieces so the game still runs.
const gltfLoader = new GLTFLoader();
const ENV = 'models/env/';

function woodenBridge(scene, p) {
  const g = new THREE.Group();
  add(g, box, woodMat, p.x, LAND_TOP - 0.02, p.z).scale.set(1.3, 0.05, 0.62);
  for (const side of [-1, 1]) {
    add(g, box, woodMat, p.x, LAND_TOP + 0.08, p.z + side * 0.29).scale.set(1.3, 0.03, 0.03);
    for (let i = 0; i < 5; i++) add(g, box, woodMat, p.x - 0.6 + i * 0.3, LAND_TOP + 0.04, p.z + side * 0.29).scale.set(0.03, 0.08, 0.03);
  }
  scene.add(g);
}

function loadEnvironment(scene, bridgeTiles) {
  gltfLoader.loadAsync(ENV + 'stone_bridge.glb').then((gltf) => {
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.material = stoneMat;
      o.castShadow = o.receiveShadow = true;
    });
    for (const p of bridgeTiles) {
      const b = gltf.scene.clone();
      b.position.set(p.x, LAND_TOP, p.z);
      scene.add(b);
    }
  }).catch((err) => {
    console.warn('stone bridge missing, using wooden bridge', err);
    bridgeTiles.forEach((p) => woodenBridge(scene, p));
  });

  return gltfLoader.loadAsync(ENV + 'cliff_backdrop.glb').then((gltf) => {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.material = material;
      o.castShadow = o.receiveShadow = true;
    });
    gltf.scene.position.z = -H / 2;
    scene.add(gltf.scene);
    scene.add(plateauTrees(gltf.scene));
    return gltf.scene;
  }).catch((err) => console.warn('cliff backdrop missing', err));
}

// Pine woods on the backdrop plateau: drop a ray onto the terrain and plant only on gentle
// grassy ground (below the snow line, away from the river channel and cliff lip).
function plateauTrees(backdrop) {
  backdrop.updateMatrixWorld(true);
  const rand = rng(33);
  const trees = new THREE.Group();
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const riverX = toWorld(7, 0).x;
  for (let i = 0; i < 900 && trees.children.length < 260; i++) {
    const x = (rand() - 0.5) * 21;
    const z = -H / 2 - 0.9 - rand() * 4.5;
    if (Math.abs(x - riverX) < 0.5) continue;
    ray.set(new THREE.Vector3(x, 20, z), down);
    const hit = ray.intersectObject(backdrop, true)[0];
    if (!hit || hit.point.y > 3.1) continue;
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (n.y < 0.85) continue;
    pine(trees, x, z, hit.point.y - 0.02, rand, 1.1 + rand() * 0.4);
  }
  return mergeStatics(trees);
}

// Castles and cottages (tools/blender/build_buildings.py). Blender material names map to
// game materials here, so faction colours and shared textures stay in one place.
export const KEEP_POLE_TOP = 1.16; // matches build_buildings.py

function buildingMaterials(faction) {
  const fc = FACTION_COLORS[faction ?? 'blue'];
  return {
    stone: stoneMat,
    wood: woodMat,
    beam: mat(0x3e2616),
    plaster: mat(0xeee3c8, { flatShading: false, side: THREE.DoubleSide }),
    roof: mat(0x9a4a2c, { roughness: 0.8 }),
    thatch: mat(0xc49a4c, { roughness: 1 }),
    roof_faction: mat(fc, { flatShading: false, roughness: 0.55 }),
    banner: mat(fc, { side: THREE.DoubleSide, roughness: 0.75 }),
    gold: mat(0xd4a93c, { metalness: 0.8, roughness: 0.3 }),
    window: mat(0xf2c86a, { emissive: 0xf2a040, emissiveIntensity: 0.9 }),
  };
}

function placeModel(group, source, faction, x, y, z, turn = 0, scale = 1) {
  const m = source.clone();
  const mats = buildingMaterials(faction);
  m.traverse((o) => {
    if (!o.isMesh) return;
    o.material = mats[o.material.name] ?? stoneMat;
    o.castShadow = true;
  });
  m.position.set(x, y, z);
  m.rotation.y = turn;
  m.scale.setScalar(scale);
  group.add(m);
}

// Village tile: two cottages along the back, wheat in the front corners, a fence along
// the front edge, leaving the centre clear for a unit.
function villageFence(group, v) {
  for (let i = 0; i < 6; i++) add(group, box, woodMat, v.x - 0.44 + i * 0.176, v.y + 0.04, v.z + 0.45).scale.set(0.022, 0.08, 0.022);
  for (const h of [0.035, 0.065]) add(group, box, woodMat, v.x, v.y + h, v.z + 0.45).scale.set(0.9, 0.014, 0.012);
}

function loadBuildings(scene, castles, villages) {
  const load = (f) => gltfLoader.loadAsync(ENV + f).then((g) => g.scene);
  Promise.all([load('castle.glb'), load('cottage_a.glb'), load('cottage_b.glb')]).then(([castleM, cotA, cotB]) => {
    const group = new THREE.Group();
    for (const c of castles) placeModel(group, castleM, c.faction, c.x, c.y, c.z);
    for (const v of villages) {
      placeModel(group, cotA, null, v.x - 0.2, v.y, v.z - 0.24, v.turn + 0.1, 0.95);
      placeModel(group, cotB, null, v.x + 0.21, v.y, v.z - 0.2, v.turn - 0.12, 0.85);
      villageFence(group, v);
    }
    scene.add(mergeStatics(group));
  }).catch((err) => {
    console.warn('building models missing, using procedural buildings', err);
    const group = new THREE.Group();
    const rand = rng(5);
    for (const c of castles) castle(group, c.x, c.z, c.y, c.faction);
    for (const v of villages) house(group, v.x - 0.06, v.z - 0.08, v.y, rand);
    scene.add(mergeStatics(group));
  });
}

// Swaying wheat in the village's front corners (instanced, same wind as the grass).
function wheatPatches(villages, rand, time) {
  const geo = new THREE.CylinderGeometry(0.004, 0.006, 0.12, 3, 1).translate(0, 0.06, 0);
  const head = new THREE.ConeGeometry(0.012, 0.04, 4).translate(0, 0.13, 0);
  const stalk = mergeGeometries([geo.toNonIndexed(), head.toNonIndexed()]);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float h = position.y / 0.15;
       transformed.x += sin(uTime * 1.5 + instanceMatrix[3].x * 3.0 + instanceMatrix[3].z * 2.0) * h * h * 0.025;`,
    );
  };
  const perPatch = 70;
  const mesh = new THREE.InstancedMesh(stalk, material, villages.length * 2 * perPatch);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const color = new THREE.Color();
  let i = 0;
  for (const v of villages) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < perPatch; k++) {
        p.set(v.x + side * (0.25 + rand() * 0.18), v.y, v.z + 0.08 + rand() * 0.3);
        e.set((rand() - 0.5) * 0.25, rand() * Math.PI, (rand() - 0.5) * 0.25);
        const k2 = 0.85 + rand() * 0.35;
        mesh.setMatrixAt(i, m.compose(p, q.setFromEuler(e), s.set(k2, k2, k2)));
        mesh.setColorAt(i, color.setHSL(0.11 + rand() * 0.03, 0.65 + rand() * 0.2, 0.5 + rand() * 0.15));
        i++;
      }
    }
  }
  return mesh;
}

// The river enters over the north cliff (column 7). The fall arcs out from the lip like a
// thrown stream: horizontal travel grows with the square root of the drop.
function buildWaterfall(scene, riverMat) {
  const x = toWorld(7, 0).x;
  const zTop = -H / 2 - 0.62, zBottom = -H / 2 + 0.06;
  const yTop = 1.3, yBottom = WATER_Y;
  const tex = waterfallTexture();
  tex.repeat.set(1.5, 1.2);
  const fallMat = new THREE.MeshStandardMaterial({
    map: tex, transparent: true, opacity: 0.92, roughness: 0.2, emissive: 0x4a88b0, emissiveIntensity: 0.25,
  });
  const segs = 16;
  const geo = new THREE.PlaneGeometry(0.66, 1, 6, segs);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const s = 0.5 - pos.getY(i); // 0 at the lip, 1 at the pool
    pos.setY(i, yTop + (yBottom - yTop) * s);
    pos.setZ(i, zTop + (zBottom - zTop) * Math.sqrt(s));
    pos.setX(i, pos.getX(i) * (1 + s * 0.25));
  }
  geo.computeVertexNormals();
  const fall = new THREE.Mesh(geo, fallMat);
  fall.position.x = x;
  scene.add(fall);

  // Channel water on the plateau feeding the fall.
  const channel = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 3).rotateX(-Math.PI / 2), riverMat);
  channel.position.set(x, yTop + 0.01, zTop - 1.5);
  scene.add(channel);

  // Foam at the base: soft white puffs that swell and fade on a loop.
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.55, depthWrite: false });
  const puffs = [];
  const rand = rng(21);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), foamMat.clone());
    m.userData = { ox: (rand() - 0.5) * 0.7, oz: rand() * 0.35, phase: rand() };
    m.scale.y = 0.5;
    scene.add(m);
    puffs.push(m);
  }
  return {
    animate(t) {
      tex.offset.y = t * 1.4;
      for (const m of puffs) {
        const k = (t * 0.6 + m.userData.phase) % 1;
        m.position.set(x + m.userData.ox * (0.7 + k * 0.4), WATER_Y + 0.02 + k * 0.05, zBottom + m.userData.oz * k);
        m.scale.setScalar(0.6 + k * 1.1).y *= 0.5;
        m.material.opacity = 0.6 * (1 - k);
      }
    },
  };
}

export function buildMap(scene) {
  const rand = rng(7);
  const flags = [];
  const statics = new THREE.Group();
  const time = { value: 0 };
  const grassTiles = [];

  const floorTex = floorTexture();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const waterGeos = [];
  const bridgeTiles = [];
  const villages = [];
  const castles = [];
  let mountainSeed = 0;

  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const t = terrainAt(c, r);
      const info = TERRAIN[t];
      const p = toWorld(c, r);
      const materials = TILE_MATS[t];
      const top = groundTop(c, r);
      add(statics, tileGeo(top), blockMats(materials[Math.floor(rand() * materials.length)], rand), p.x, top / 2, p.z, false);

      if (t === 'G' || t === 'V' || t === 'F') grassTiles.push({ t, x: p.x, z: p.z, h: top });
      if (t === 'W' || t === 'B') waterGeos.push(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(p.x, WATER_Y, p.z));
      if (t === 'F') {
        const n = 3 + Math.floor(rand() * 2);
        for (let i = 0; i < n; i++) tree(statics, p.x + (rand() - 0.5) * 0.6, p.z + (rand() - 0.5) * 0.6, top, rand);
      }
      if (t === 'M') mountain(statics, p.x, p.z, top, rand, mountainSeed++);
      if (t === 'V') villages.push({ x: p.x, z: p.z, y: top, turn: (rand() - 0.5) * 0.3 });
      if (t === 'C' || t === 'K') {
        const faction = t === 'C' ? 'blue' : 'red';
        castles.push({ x: p.x, z: p.z, y: top, faction });
        makeFlag(p.x, top + KEEP_POLE_TOP - 0.07, p.z - 0.08, faction, flags);
      }
      if (t === 'B') bridgeTiles.push(p);
      if ((t === 'G' || t === 'R') && rand() < 0.25) {
        add(statics, new THREE.DodecahedronGeometry(0.03 + rand() * 0.025, 0), rockMat,
          p.x + (rand() - 0.5) * 0.8, top + 0.01, p.z + (rand() - 0.5) * 0.8);
      }
    }
  }

  // Decorative woods around the battlefield edge.
  for (let i = 0; i < 420; i++) {
    const x = (rand() - 0.5) * 38;
    const z = (rand() - 0.5) * 30;
    if (Math.abs(x) < W / 2 + 0.4 && Math.abs(z) < H / 2 + 0.4) continue;
    tree(statics, x, z, 0, rand, 1.25);
  }

  scene.add(mergeStatics(statics));
  scene.add(grassBlades(grassTiles, rand, time));
  scene.add(wheatPatches(villages, rand, time));
  for (const f of flags) scene.add(f.mesh);
  loadBuildings(scene, castles, villages);

  const waterNormal = waterNormalTexture();
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x1b5f8c, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.9, envMapIntensity: 0.5,
    normalMap: waterNormal, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 1, clearcoatRoughness: 0.05,
  });
  const water = new THREE.Mesh(mergeGeometries(waterGeos), waterMat);
  water.receiveShadow = true;
  scene.add(water);

  loadEnvironment(scene, bridgeTiles);
  const waterfall = buildWaterfall(scene, waterMat);

  return {
    animate(t) {
      time.value = t;
      waterNormal.offset.set(t * 0.02, t * 0.035);
      waterfall.animate(t);
      for (const f of flags) {
        const pos = f.mesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const bx = f.base[i * 3];
          pos.array[i * 3 + 2] = Math.sin(t * 4 + bx * 25) * 0.025 * (bx / 0.24);
        }
        pos.needsUpdate = true;
        f.mesh.geometry.computeVertexNormals();
      }
    },
  };
}
