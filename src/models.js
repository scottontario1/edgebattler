import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// KayKit Adventurers (CC0, Kay Lousberg — see public/models/kaykit/LICENSE-*.txt).
// Each GLB carries every weapon for its class; `show` picks which ones stay visible.
// Both armies use the same human models; `recolor` repaints their cloth in faction colours.
// `mount` seats the rider on the Blender-built horse (tools/blender/build_units.py).
const BASE = 'models/kaykit/';
const HORSE = 'models/env/horse.glb';

export const MODEL_SPECS = {
  aldric:  { file: 'Knight.glb', show: ['1H_Sword', 'Badge_Shield'], hide: ['Knight_Helmet'] },
  brenna:  { file: 'Knight.glb', show: ['1H_Sword', 'Rectangle_Shield'] },
  wren:    { file: 'Rogue_Hooded.glb', show: ['2H_Crossbow'] },
  elowen:  { file: 'Mage.glb', show: ['2H_Staff'] },
  garrick: { file: 'Knight.glb', show: ['1H_Sword', 'Round_Shield'], mount: true },

  morvath: { file: 'Barbarian.glb', show: ['2H_Axe'], scale: 1.18 },
  dreg:    { file: 'Knight.glb', show: ['1H_Sword', 'Spike_Shield'] },
  sable:   { file: 'Rogue_Hooded.glb', show: ['2H_Crossbow'] },
  vex:     { file: 'Mage.glb', show: ['1H_Wand', 'Spellbook_open'] },
  grisk:   { file: 'Rogue.glb', show: ['Knife', 'Knife_Offhand'], hide: ['Rogue_Cape'] },
};

// Mesh names ending in these are the character's body; everything else is optional gear.
const BODY = /_(Head|Head_Hooded|Body|ArmLeft|ArmRight|LegLeft|LegRight|Cape|Cloak|Eyes|Jaw|Skull|Hat|Helmet|Hood)$/;

// KayKit characters are ~2.4 units tall; this brings them to ~1.1 tiles.
const BASE_SCALE = 0.46;

// Faction cloth colours as HSL hue (0–1) and minimum saturation.
const FACTION_HUE = { blue: { h: 0.6, s: 0.62 }, red: { h: 0.985, s: 0.7 } };

const loader = new GLTFLoader();
const cache = new Map();
function load(url) {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url));
  return cache.get(url);
}

// Repaint the KayKit palette atlas: every saturated swatch outside the warm skin/leather/gold
// band (hue 10°–60°) is cloth or trim, so it takes the faction hue at its own lightness.
const recolorCache = new Map();
function recolorTexture(tex, faction) {
  const key = `${tex.uuid}|${faction}`;
  if (recolorCache.has(key)) return recolorCache.get(key);
  const img = tex.image;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const g = canvas.getContext('2d');
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  const c = new THREE.Color();
  const hsl = {};
  const target = FACTION_HUE[faction];
  for (let i = 0; i < px.length; i += 4) {
    c.setRGB(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, THREE.SRGBColorSpace);
    c.getHSL(hsl, THREE.SRGBColorSpace);
    const deg = hsl.h * 360;
    if (hsl.s < 0.16 || (deg >= 10 && deg <= 60)) continue;
    c.setHSL(target.h, Math.max(hsl.s, target.s), THREE.MathUtils.clamp(hsl.l, 0.16, 0.62), THREE.SRGBColorSpace);
    const rgb = c.getRGB({}, THREE.SRGBColorSpace);
    px[i] = rgb.r * 255;
    px[i + 1] = rgb.g * 255;
    px[i + 2] = rgb.b * 255;
  }
  g.putImageData(data, 0, 0);
  const out = new THREE.CanvasTexture(canvas);
  out.flipY = tex.flipY;
  out.colorSpace = THREE.SRGBColorSpace;
  out.magFilter = tex.magFilter;
  out.minFilter = tex.minFilter;
  recolorCache.set(key, out);
  return out;
}

const materialCache = new Map();
function factionMaterial(material, faction) {
  const key = `${material.uuid}|${faction}`;
  if (!materialCache.has(key)) {
    const m = material.clone();
    if (m.map) m.map = recolorTexture(m.map, faction);
    materialCache.set(key, m);
  }
  return materialCache.get(key);
}

function prepareCharacter(gltf, spec, faction, { hideLegs = false } = {}) {
  const root = SkeletonUtils.clone(gltf.scene);
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const keep = spec.show?.includes(o.name) || (BODY.test(o.name) && !spec.hide?.includes(o.name));
    o.visible = keep && !(hideLegs && /Leg(Left|Right)$/.test(o.name));
    o.material = factionMaterial(o.material, faction);
  });
  return root;
}

// Horse (Blender-built, see tools/blender/build_units.py). Its caparison takes the
// faction colour; the neck and tail are separate nodes animated in setActive/update.
const HORSE_SADDLE_Y = 0.4; // at scale 1, keep in sync with build_units.py
const HORSE_SCALE = 1.6; // chibi riders have huge heads; a true-to-life horse looks like a pony
const horseMats = new Map();
function horseMaterial(name, faction) {
  const key = `${name}|${faction}`;
  if (!horseMats.has(key)) {
    const fc = faction === 'red' ? 0xa8322a : 0x2f5fb8;
    const colors = { coat: 0x8a5a36, mane: 0x2a1c14, hoof: 0x2b2522, leather: 0x5a3a22, caparison: fc, trim: 0xd4a93c, steel: 0xb8bec6 };
    horseMats.set(key, new THREE.MeshStandardMaterial({
      color: colors[name] ?? 0x888888, roughness: name === 'steel' || name === 'trim' ? 0.35 : 0.8,
      metalness: name === 'steel' || name === 'trim' ? 0.7 : 0, flatShading: true,
    }));
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

export async function buildModel(id, faction) {
  const spec = MODEL_SPECS[id];
  const gltf = await load(BASE + spec.file);
  const character = prepareCharacter(gltf, spec, faction, { hideLegs: !!spec.mount });
  const root = new THREE.Group();

  let horse = null;
  if (spec.mount) {
    horse = await buildHorse(faction).catch((err) => {
      console.warn('horse model missing, cavalry fights on foot', err);
      return null;
    });
  }
  if (horse) {
    root.add(horse.root);
    // Seat the rider: put its hips at saddle height.
    character.updateMatrixWorld(true);
    const hips = character.getObjectByName('hips');
    const hipY = hips ? hips.getWorldPosition(new THREE.Vector3()).y : 0.9;
    const riderScale = BASE_SCALE * 0.85;
    character.scale.setScalar(riderScale);
    character.position.set(0, HORSE_SADDLE_Y * HORSE_SCALE - hipY * riderScale + 0.03, -0.02);
  } else {
    character.scale.setScalar(BASE_SCALE * (spec.scale ?? 1));
  }
  root.add(character);

  const mixer = new THREE.AnimationMixer(character);
  const clips = new Map(gltf.animations.map((c) => [c.name, c]));
  const actions = new Map();
  const action = (name) => {
    if (!actions.has(name)) actions.set(name, mixer.clipAction(clips.get(name)));
    return actions.get(name);
  };
  const idleName = 'Idle';
  const readyName = clips.has('Idle_Combat') ? 'Idle_Combat' : '2H_Melee_Idle';
  let current = action(idleName);
  current.time = Math.random() * current.getClip().duration; // desync the idles
  current.play();
  const phase = Math.random() * 10;

  return {
    root,
    mixer,
    // Crossfade between the calm idle and the combat-ready idle when a unit is selected.
    setActive(active) {
      const next = action(active && !horse ? readyName : idleName);
      if (next === current) return;
      next.reset().play();
      current.crossFadeTo(next, 0.25, false);
      current = next;
    },
    update(dt, t) {
      mixer.update(dt);
      if (!horse) return;
      // Idle horse: slow breathing, occasional head toss, swishing tail.
      const toss = Math.max(0, Math.sin(t * 0.7 + phase) - 0.8) * 2.5;
      if (horse.neck) horse.neck.rotation.x = Math.sin(t * 1.3 + phase) * 0.04 - toss * 0.25;
      if (horse.tail) horse.tail.rotation.z = Math.sin(t * 2.1 + phase) * 0.25;
      horse.root.position.y = Math.sin(t * 1.3 + phase) * 0.004;
    },
  };
}
