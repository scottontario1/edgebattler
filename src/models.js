import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// Circular import (units.js imports buildModel); UNITS is only read inside buildModel, after
// both modules have finished evaluating. It supplies each unit's class and look (skin, hair,
// iris colours) so a model and its portrait agree.
import { UNITS } from './units.js';
import { faceTexture } from './faces.js';

// Every unit is built on the universal humanoid (tools/blender/humanoid.py). Class -> model:
// the named heroes (paladin = Brenna, barbarian = Dreg) come from build_heroes.py and the
// neutral recruitable troops (pikeman, archer, cavalier) from build_recruits.py. Recruits are
// unnamed and shared: the faction colour comes from the `cloth` materials, the rest from each
// unit's `look`. `gaze` picks the painted face preset (faces.js); `mount` seats the rider on the
// Blender-built horse.
const HORSE = 'models/env/horse.glb';
export const MODEL_SPECS = {
  paladin: { hero: 'models/env/brenna.glb', gaze: 'noble' },
  barbarian: { hero: 'models/env/dreg.glb', gaze: 'fierce' },
  pikeman: { hero: 'models/env/pikeman.glb', gaze: 'steady' },
  archer: { hero: 'models/env/archer.glb', gaze: 'keen' },
  cavalier: { hero: 'models/env/cavalier.glb', gaze: 'steady', mount: true },
};

// Faction cloth colours plus the matching accents shared with portraits.js: cool rim light and
// a dark ink outline.
const FACTION_ACCENT = {
  blue: { cloth: 0x2f62c4, rim: 0xa9d0ff, outline: 0x0c1426 },
  red: { cloth: 0xc0392b, rim: 0xffb592, outline: 0x240a0a },
};

const loader = new GLTFLoader();
const cache = new Map();
function load(url) {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url));
  return cache.get(url);
}

// Cool rim light on the side facing away from the sun (screen right), in the faction's rim
// colour, the same lighting the SVG portraits use (warm key upper-left, cool rim right).
function addRim(material, faction) {
  const rim = new THREE.Color(FACTION_ACCENT[faction].rim);
  material.onBeforeCompile = (s) => {
    s.uniforms.rimColor = { value: rim };
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 vd = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
          float fr = pow(1.0 - saturate(dot(normal, vd)), 2.6);
          float side = smoothstep(-0.35, 0.55, normal.x + normal.y * 0.35);
          totalEmissiveRadiance += rimColor * fr * side * 0.45;
        }`);
  };
  material.customProgramCacheKey = () => `rim-${faction}`;
  return material;
}

// Inverted-hull outline: a back-face copy of each visible mesh pushed out along its normals
// in a dark faction tint. Costs one extra draw per mesh; no post pass, so it works with the
// EffectComposer stack and on phones with HD off.
const outlineMats = new Map();
function outlineMaterial(faction, width) {
  const key = `${faction}|${width}`;
  if (!outlineMats.has(key)) {
    const m = new THREE.MeshBasicMaterial({ color: FACTION_ACCENT[faction].outline, side: THREE.BackSide });
    m.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>\ntransformed += normalize(normal) * ${width.toFixed(4)};`);
    };
    m.customProgramCacheKey = () => `outline-${width}`;
    outlineMats.set(key, m);
  }
  return outlineMats.get(key);
}

function addOutlines(root, faction, width) {
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && o.visible && !o.userData.outline && !o.userData.noOutline) meshes.push(o); });
  for (const o of meshes) {
    const hull = new THREE.Mesh(o.geometry, outlineMaterial(faction, width));
    hull.userData.outline = true;
    hull.castShadow = false;
    hull.receiveShadow = false;
    hull.raycast = () => {}; // picking uses the real mesh
    o.add(hull); // identity transform: follows the mesh and its visibility
  }
}

// Horse (Blender-built, see tools/blender/build_units.py): smooth skin-modifier body, dagged
// barding and bridle. Its caparison takes the faction colour; the neck and tail are separate
// nodes animated in update(). Matte like the rest of the cast; only tack metal is cel-shaded.
const HORSE_SADDLE_Y = 0.4; // at scale 1, keep in sync with build_units.py
const HORSE_SCALE = 1.7; // sized for the ~1.18-tall riders of the humanoid standard
const RIDER_CROTCH = 0.44; // rider pelvis underside in model space (build_recruits.py)
const horseMats = new Map();
function horseMaterial(name, faction) {
  const key = `${name}|${faction}`;
  if (!horseMats.has(key)) {
    const fc = FACTION_ACCENT[faction].cloth;
    const colors = { coat: 0x8a5a36, mane: 0x2a1c14, blaze: 0xeee6d6, hoof: 0x2b2522, leather: 0x5a3a22, caparison: fc, trim: 0xe0b040, steel: 0xc8d0da };
    const metal = name === 'steel' || name === 'trim';
    const m = metal
      ? new THREE.MeshToonMaterial({ color: colors[name], gradientMap: gradientMap(STEP_HARD) })
      : new THREE.MeshStandardMaterial({ color: colors[name] ?? 0x888888, roughness: 0.92 });
    horseMats.set(key, addRim(m, faction));
  }
  return horseMats.get(key);
}

async function buildHorse(faction) {
  const gltf = await load(HORSE);
  const horse = gltf.scene.clone();
  horse.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.material = horseMaterial(o.material.name, faction);
  });
  addOutlines(horse, faction, 0.0055);
  horse.scale.setScalar(HORSE_SCALE);
  return { root: horse, neck: horse.getObjectByName('neck'), tail: horse.getObjectByName('tail') };
}

// Heroes built from scratch on the universal humanoid (tools/blender/humanoid.py): a node
// hierarchy hips > torso > head / arm > fore, hips > thigh > shin, torso > cape. There is no
// skeleton or clip; the idle (breathing, head sway, cape flutter, weight shift) and the
// selected "ready" pose are driven here. Illustrated look: matte cloth/fur/skin
// (roughness 0.9+), cel-shaded metals with hard light/shadow borders, a painted face texture
// (faces.js) and the inverted-hull ink outline shared with the other units.
// The humanoid standard is ~1.18 tall (3.75 heads) with slender limbs, which reads a little small
// on the map; this is the one place the whole cast is scaled up to match the terrain.
const HERO_SCALE = 1.1;
const STEP_HARD = [0.4, 0.4, 0.86, 0.86, 1.2]; // metals: two hard tones + a bright band
const gradients = new Map();
function gradientMap(steps) {
  const key = steps.join();
  if (!gradients.has(key)) {
    const t = new THREE.DataTexture(new Uint8Array(steps.map((v) => Math.min(255, Math.round(v * 255)))), steps.length, 1, THREE.RedFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    gradients.set(key, t);
  }
  return gradients.get(key);
}
const HERO_METAL = { steel: 0x9fabbe, gold: 0xe6b73c, iron: 0x77757f, brass: 0xc79a48 };
const HERO_MATTE = { white: 0xf2ede0, leather: 0x6a4428, furdark: 0x6a4428, bone: 0xf0e6cc, darkwood: 0x4a2c18 };
const heroMats = new Map();
function heroMaterial(name, faction, look, gaze) {
  const key = `${name}|${faction}|${look.skin}|${look.hair}|${look.eyes}|${gaze}`;
  if (heroMats.has(key)) return heroMats.get(key);
  let m;
  if (name === 'face') {
    m = new THREE.MeshStandardMaterial({ map: faceTexture(look, gaze), roughness: 0.92 });
  } else if (name in HERO_METAL) {
    m = new THREE.MeshToonMaterial({ color: HERO_METAL[name], gradientMap: gradientMap(STEP_HARD) });
  } else if (name === 'gem') {
    m = new THREE.MeshStandardMaterial({ color: 0x3aa8ff, roughness: 0.55, emissive: 0x1a6cff, emissiveIntensity: 0.8 });
  } else if (name === 'skin') {
    m = new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.92 });
  } else if (name === 'hair') {
    m = new THREE.MeshStandardMaterial({ color: look.hair, roughness: 0.88, vertexColors: true });
  } else if (name === 'fur') {
    m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0, vertexColors: true });
  } else if (name === 'cloth' || name === 'clothdark') {
    const c = new THREE.Color(FACTION_ACCENT[faction].cloth);
    if (name === 'clothdark') c.multiplyScalar(0.45);
    m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
  } else {
    m = new THREE.MeshStandardMaterial({ color: HERO_MATTE[name] ?? 0x888888, roughness: 0.92 });
  }
  if (!(m instanceof THREE.MeshToonMaterial) || true) addRim(m, faction);
  heroMats.set(key, m);
  return m;
}

async function buildHero(spec, id, faction) {
  const gltf = await load(spec.hero);
  const root = gltf.scene.clone(true);
  const look = UNITS.find((u) => u.id === id)?.look ?? {};
  root.traverse((o) => {
    if (!o.isMesh) return;
    const name = o.material.name;
    o.material = heroMaterial(name, faction, look, spec.gaze);
    if (o.material.vertexColors && !o.geometry.attributes.color) {
      o.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(o.geometry.attributes.position.count * 3).fill(1), 3));
    }
    o.castShadow = true;
    o.receiveShadow = true;
  });
  root.scale.setScalar(HERO_SCALE);
  addOutlines(root, faction, 0.0055 / HERO_SCALE);
  const N = {};
  for (const n of ['hips', 'torso', 'head', 'arm_l', 'fore_l', 'arm_r', 'fore_r', 'cape', 'thigh_l', 'shin_l', 'thigh_r', 'shin_r']) N[n] = root.getObjectByName(n);
  const rest = new Map(Object.values(N).filter(Boolean).map((o) => [o, o.quaternion.clone()]));
  const restPos = N.hips ? N.hips.position.clone() : null;
  const e = new THREE.Euler(), q = new THREE.Quaternion();
  const pose = (n, x, y, z) => {
    const o = N[n];
    if (o) o.quaternion.copy(rest.get(o)).multiply(q.setFromEuler(e.set(x, y, z)));
  };
  const phase = Math.random() * 10;
  let ready = 0, target = 0;
  return {
    root,
    setActive(active) { target = active ? 1 : 0; },
    update(dt, t) {
      ready += (target - ready) * Math.min(1, dt * 8);
      const breath = Math.sin(t * 1.9 + phase);
      const sway = Math.sin(t * 0.7 + phase);
      if (N.hips) N.hips.position.y = restPos.y - 0.004 * (1 - breath) * 0.5 - ready * 0.006; // sink into the stance
      pose('torso', breath * 0.012 + ready * 0.05, sway * 0.02, 0);
      pose('head', -0.06 + Math.sin(t * 0.9 + phase) * 0.025 - ready * 0.05, Math.sin(t * 0.55 + phase) * 0.06, 0);
      // weapon arm lifts into the ready guard; the off hand tightens
      pose('arm_r', -ready * 0.32 + breath * 0.02, 0, -ready * 0.1);
      pose('fore_r', -ready * 0.42, 0, 0);
      pose('arm_l', -ready * 0.12 - breath * 0.02, 0, ready * 0.06);
      pose('fore_l', -ready * 0.16, 0, 0);
      pose('thigh_r', ready * 0.05, 0, 0);
      pose('cape', 0.03 + Math.max(0, Math.sin(t * 1.3 + phase)) * 0.06 + ready * 0.05, 0, Math.sin(t * 0.8 + phase) * 0.03);
    },
  };
}

export async function buildModel(id, faction) {
  const unit = UNITS.find((u) => u.id === id);
  const spec = MODEL_SPECS[unit.cls];
  const hero = await buildHero(spec, id, faction);
  if (!spec.mount) return hero;
  // Cavalry: seat the rider on the horse (crotch on the saddle) and animate both.
  const horse = await buildHorse(faction).catch((err) => {
    console.warn('horse model missing, cavalry fights on foot', err);
    return null;
  });
  if (!horse) return hero;
  const root = new THREE.Group();
  root.add(horse.root);
  hero.root.position.set(0, HORSE_SADDLE_Y * HORSE_SCALE - RIDER_CROTCH * HERO_SCALE, 0);
  root.add(hero.root);
  const phase = Math.random() * 10;
  return {
    root,
    setActive: hero.setActive,
    update(dt, t) {
      hero.update(dt, t);
      // Idle horse: slow breathing, occasional head toss, swishing tail.
      const toss = Math.max(0, Math.sin(t * 0.7 + phase) - 0.8) * 2.5;
      if (horse.neck) horse.neck.rotation.x = Math.sin(t * 1.3 + phase) * 0.04 - toss * 0.25;
      if (horse.tail) horse.tail.rotation.z = Math.sin(t * 2.1 + phase) * 0.25;
      horse.root.position.y = Math.sin(t * 1.3 + phase) * 0.004;
    },
  };
}
