import { SPRITE_FALLBACK } from './cultures.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// Circular import (units.js imports buildModel); UNITS is only read inside buildModel, after
// both modules have finished evaluating. It supplies each unit's class and look (skin, hair,
// iris colours) so a model and its portrait agree.
import { UNITS } from './units.js';

// Every unit is built on the universal humanoid (tools/blender/humanoid.py). Class -> model:
// the named heroes (paladin = Brenna, barbarian = Dreg) come from build_heroes.py and the
// neutral recruitable troops (pikeman, archer, cavalier) from build_recruits.py. Recruits are
// unnamed and shared: the faction colour comes from the `cloth` materials, the rest from each
// unit's `look`. `mount` seats the rider on the Blender-built horse. Faces (anime eyes, brows, mouth) are
// flat decal polygons and the ink outline is a baked inverted hull, both built into the GLBs.
const HORSE = 'models/env/horse.glb';
export const MODEL_SPECS = {
  paladin: { hero: 'models/env/brenna.glb' },
  barbarian: { hero: 'models/env/dreg.glb' },
  pikeman: { hero: 'models/env/pikeman.glb' },
  archer: { hero: 'models/env/archer.glb' },
  cavalier: { hero: 'models/env/cavalier.glb', mount: true },
};

// Faction cloth colours plus the matching accents shared with portraits.js: cool rim light and
// a dark ink outline.
const FACTION_ACCENT = {
  blue: { cloth: 0x1a4fa0, rim: 0xa9d0ff, outline: 0x050912 },
  red: { cloth: 0xa8231c, rim: 0xffb592, outline: 0x120404 },
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

// Horse (Blender-built, see tools/blender/build_units.py): smooth skin-modifier body, dagged
// barding and bridle (reins run from the bit to the rider's hand). Its caparison takes the faction colour; the neck and tail are separate
// nodes animated in update(). Matte like the rest of the cast; only tack metal is cel-shaded.
const HORSE_SADDLE_Y = 0.4; // at scale 1, keep in sync with build_units.py
const HORSE_SCALE = 1.7; // sized for the ~1.18-tall riders of the humanoid standard
const RIDER_CROTCH = 0.44; // rider pelvis underside in model space (build_recruits.py)
const horseMats = new Map();
function horseMaterial(name, faction) {
  const key = `${name}|${faction}`;
  if (!horseMats.has(key)) {
    const fc = FACTION_ACCENT[faction].cloth;
    if (name === 'ink') {
      horseMats.set(key, new THREE.MeshBasicMaterial({ color: FACTION_ACCENT[faction].outline }));
      return horseMats.get(key);
    }
    const colors = { coat: 0x8a5a36, mane: 0x2a1c14, blaze: 0xeee6d6, hoof: 0x2b2522, leather: 0x5c381e, caparison: fc, trim: 0xf0b830, steel: 0xb8c4d6 };
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
  horse.scale.setScalar(HORSE_SCALE);
  return { root: horse, neck: horse.getObjectByName('neck'), tail: horse.getObjectByName('tail') };
}

// Heroes built from scratch on the universal humanoid (tools/blender/humanoid.py): a node
// hierarchy hips > torso > head / arm > fore, hips > thigh > shin, torso > cape. There is no
// skeleton or clip; the idle (breathing, head sway, cape flutter, weight shift) and the
// selected "ready" pose are driven here. Illustrated look: matte cloth/fur/skin
// (roughness 0.9+), cel-shaded polished metals with hard light/shadow borders, flat anime face
// decals and a baked inverted-hull ink outline (both built into the GLBs).
// The humanoid standard is ~1.18 tall (3.75 heads) with slender limbs, which reads a little small
// on the map; this is the one place the whole cast is scaled up to match the terrain.
const HERO_SCALE = 1.1;
const STEP_HARD = [0.4, 0.4, 0.9, 0.9, 1.25]; // polished metal: two hard tones and a bright band // metals: two hard tones + a bright band
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
const HERO_METAL = { steel: 0xb8c4d6, gold: 0xf0b830, iron: 0x5a5866, brass: 0xd9a441 };
const HERO_MATTE = { white: 0xf2ede0, leather: 0x5c381e, furdark: 0x5a3820, bone: 0xefe4c8, darkwood: 0x4a2c18 };
// Face decals (tools/blender/humanoid.py face_decals): flat unlit shapes layered a millimetre apart.
const DECAL_LAYER = { sclera: 1, blush: 1, iris: 2, lip: 2, nose: 2, brow: 3, pupil: 3, lash: 5, shine: 4 };
const heroMats = new Map();
function heroMaterial(name, faction, look) {
  const key = `${name}|${faction}|${look.skin}|${look.hair}|${look.eyes}`;
  if (heroMats.has(key)) return heroMats.get(key);
  const dark = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
  let m;
  if (name === 'ink') {
    m = new THREE.MeshBasicMaterial({ color: FACTION_ACCENT[faction].outline });
    heroMats.set(key, m);
    return m;
  }
  if (name in DECAL_LAYER) {
    const colors = { sclera: 0xf7f1ea, iris: look.eyes, pupil: 0x120b16, shine: 0xffffff, lash: 0x1c1218,
      brow: dark(look.hair, 0.6), lip: 0xc86a6a, blush: 0xf09a96, nose: dark(look.skin, 0.78) };
    m = new THREE.MeshBasicMaterial({ color: colors[name], vertexColors: name === 'iris', polygonOffset: true,
      polygonOffsetFactor: -DECAL_LAYER[name], polygonOffsetUnits: -DECAL_LAYER[name] });
    heroMats.set(key, m);
    return m;
  }
  if (name in HERO_METAL) {
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
    if (name === 'clothdark') c.multiplyScalar(0.5);
    m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
  } else {
    m = new THREE.MeshStandardMaterial({ color: HERO_MATTE[name] ?? 0x888888, roughness: 0.92 });
  }
  addRim(m, faction);
  heroMats.set(key, m);
  return m;
}

async function buildHero(spec, unit, faction) {
  const gltf = await load(spec.hero);
  const root = gltf.scene.clone(true);
  const look = unit.look ?? {};
  root.traverse((o) => {
    if (!o.isMesh) return;
    const name = o.material.name;
    o.material = heroMaterial(name, faction, look);
    if (o.material.vertexColors && !o.geometry.attributes.color) {
      o.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(o.geometry.attributes.position.count * 3).fill(1), 3));
    }
    const flat = name === 'ink' || name in DECAL_LAYER;
    o.castShadow = !flat;
    o.receiveShadow = !flat;
  });
  root.scale.setScalar(HERO_SCALE);
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

export async function buildModel(value, faction) {
  const unit = typeof value === 'string' ? UNITS.find((u) => u.id === value) : value;
  const spec = unit.monster ? MODEL_SPECS.pikeman : (MODEL_SPECS[unit.cls] ?? MODEL_SPECS[SPRITE_FALLBACK[unit.cls]?.base] ?? MODEL_SPECS[unit.classId] ?? MODEL_SPECS.pikeman);
  const hero = await buildHero(spec, unit, faction);
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
