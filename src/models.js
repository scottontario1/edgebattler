import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
// Circular import (units.js imports buildModel); UNITS is only read inside buildModel, after
// both modules have finished evaluating. It supplies each unit's hair colour so the model's
// hair matches the portrait.
import { UNITS } from './units.js';

// KayKit Adventurers (CC0, Kay Lousberg — see public/models/kaykit/LICENSE-*.txt).
// Each GLB carries every weapon for its class; `show` picks which ones stay visible.
// Both armies use the same human models; their cloth is repainted in faction colours and the
// hair swatch in each unit's `look.hair`, so a unit's model and portrait agree.
// `gear` adds procedural props the KayKit packs lack (lances, bows, plume, bandana) so the
// battlefield weapon matches the one on the unit card. `mount` seats the rider on the
// Blender-built horse (tools/blender/build_units.py).
//
// Silhouette language at normal zoom: lances = infantry/cavalry knights, tall bows = archers,
// pointed hats + staff/wand = casters, horse = cavalry, oversized horned barbarian = boss.
const BASE = 'models/kaykit/';
const HORSE = 'models/env/horse.glb';

// KayKit's idle holds the staff point-down at the feet; this leans it ~35° out from the body
// so the crystal clears the mage's wide hat brim (solved against the idle pose).
const STAFF_OUT = { q: [-0.302, 0.699, 0.553, 0.338], scale: 1.35 };

export const MODEL_SPECS = {
  aldric:  { file: 'Knight.glb', show: ['1H_Sword', 'Badge_Shield'], hide: ['Knight_Helmet'] },
  brenna:  { file: 'Knight.glb', show: ['Rectangle_Shield'], gear: ['lance'] },
  wren:    { file: 'Rogue_Hooded.glb', show: [], gear: ['bow', 'quiver'] },
  elowen:  { file: 'Mage.glb', show: ['2H_Staff'], pose: { '2H_Staff': STAFF_OUT } },
  garrick: { file: 'Knight.glb', show: ['Round_Shield'], gear: ['lance', 'plume'], mount: true },

  morvath: { file: 'Barbarian.glb', show: ['2H_Axe'], scale: 1.32 },
  dreg:    { file: 'Knight.glb', show: ['Spike_Shield'], gear: ['lance'] },
  sable:   { file: 'Rogue_Hooded.glb', show: [], gear: ['bow', 'quiver'] },
  vex:     { file: 'Mage.glb', show: ['1H_Wand', 'Spellbook_open'] },
  grisk:   { file: 'Barbarian.glb', show: ['1H_Axe'], hide: ['Barbarian_Hat', 'Barbarian_Cape'], gear: ['bandana'] },
};

// Mesh names ending in these are the character's body; everything else is optional gear.
const BODY = /_(Head|Head_Hooded|Body|ArmLeft|ArmRight|LegLeft|LegRight|Cape|Cloak|Eyes|Jaw|Skull|Hat|Helmet|Hood)$/;

// KayKit characters are ~2.4 units tall; this brings them to ~1.1 tiles.
const BASE_SCALE = 0.46;

// Faction cloth colours as HSL hue (0–1) and minimum saturation, plus the matching
// accents shared with portraits.js: cool rim light and dark outline.
const FACTION_HUE = { blue: { h: 0.6, s: 0.62 }, red: { h: 0.985, s: 0.7 } };
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

// KayKit atlases are 1024² but hold only 8 x 4 flat gradient swatches, so 256² loses nothing
// visible and keeps ten per-unit copies at ~0.3 MB of GPU memory each (phones).
const ATLAS = 256;
const CELL_W = ATLAS / 8, CELL_H = ATLAS / 4;
// Swatch (col 1, row 0) is the hair/beard on every KayKit head and is used by nothing else.
const HAIR_CELL = [1, 0];

// Repaint the palette atlas for one unit: every saturated swatch outside the warm
// skin/leather/gold band (hue 10°–60°) is cloth or trim and takes the faction hue at its own
// lightness; the hair swatch takes the unit's hair colour, keeping its shading gradient.
const texCache = new Map();
function unitTexture(tex, faction, hair) {
  const key = `${tex.uuid}|${faction}|${hair}`;
  if (texCache.has(key)) return texCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ATLAS;
  const g = canvas.getContext('2d');
  g.drawImage(tex.image, 0, 0, ATLAS, ATLAS);
  const data = g.getImageData(0, 0, ATLAS, ATLAS);
  const px = data.data;
  const c = new THREE.Color();
  const hsl = {};
  const target = FACTION_HUE[faction];
  const hairHSL = hair ? new THREE.Color(hair).getHSL({}, THREE.SRGBColorSpace) : null;

  // mean lightness of the hair swatch, so its gradient can be re-centred on the new colour
  let hairMean = 0.5;
  if (hairHSL) {
    let sum = 0, n = 0;
    for (let y = HAIR_CELL[1] * CELL_H; y < (HAIR_CELL[1] + 1) * CELL_H; y++) {
      for (let x = HAIR_CELL[0] * CELL_W; x < (HAIR_CELL[0] + 1) * CELL_W; x++) {
        const i = (y * ATLAS + x) * 4;
        c.setRGB(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, THREE.SRGBColorSpace).getHSL(hsl, THREE.SRGBColorSpace);
        sum += hsl.l; n++;
      }
    }
    hairMean = sum / n || 0.5;
  }

  for (let i = 0; i < px.length; i += 4) {
    const p = i / 4, x = p % ATLAS, y = (p - x) / ATLAS;
    c.setRGB(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, THREE.SRGBColorSpace);
    c.getHSL(hsl, THREE.SRGBColorSpace);
    if (hairHSL && Math.floor(x / CELL_W) === HAIR_CELL[0] && Math.floor(y / CELL_H) === HAIR_CELL[1]) {
      // keep ±lightness variation of the painted gradient, scaled for very dark/light hair
      const l = THREE.MathUtils.clamp(hairHSL.l + (hsl.l - hairMean) * (0.35 + hairHSL.l * 0.6), 0.04, 0.92);
      c.setHSL(hairHSL.h, hairHSL.s, l, THREE.SRGBColorSpace);
    } else {
      const deg = hsl.h * 360;
      if (hsl.s < 0.16 || (deg >= 10 && deg <= 60)) continue;
      c.setHSL(target.h, Math.max(hsl.s, target.s), THREE.MathUtils.clamp(hsl.l, 0.16, 0.62), THREE.SRGBColorSpace);
    }
    const rgb = c.getRGB({}, THREE.SRGBColorSpace);
    px[i] = rgb.r * 255;
    px[i + 1] = rgb.g * 255;
    px[i + 2] = rgb.b * 255;
  }
  g.putImageData(data, 0, 0);
  const out = new THREE.CanvasTexture(canvas);
  out.flipY = tex.flipY;
  out.colorSpace = THREE.SRGBColorSpace;
  out.magFilter = THREE.LinearFilter;
  out.minFilter = THREE.LinearMipmapLinearFilter;
  texCache.set(key, out);
  return out;
}

// Cool rim light on the side facing away from the sun (screen right), in the faction's rim
// colour — the same lighting the SVG portraits use (warm key upper-left, cool rim right).
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

const materialCache = new Map();
function unitMaterial(material, faction, hair) {
  const key = `${material.uuid}|${faction}|${hair}`;
  if (!materialCache.has(key)) {
    const m = material.clone();
    if (m.map) m.map = unitTexture(m.map, faction, hair);
    materialCache.set(key, addRim(m, faction));
  }
  return materialCache.get(key);
}

const gearMats = new Map();
function gearMaterial(kind, faction) {
  const key = `${kind}|${faction}`;
  if (!gearMats.has(key)) {
    const fc = FACTION_ACCENT[faction].cloth;
    const spec = {
      wood: { color: 0x6b4526, roughness: 0.75 },
      darkwood: { color: 0x3e2716, roughness: 0.7 },
      steel: { color: 0xc9d0da, roughness: 0.3, metalness: 0.75 },
      gold: { color: 0xd4a93c, roughness: 0.3, metalness: 0.8 },
      string: { color: 0xeee6d2, roughness: 0.9 },
      leather: { color: 0x5a3a22, roughness: 0.8 },
      cloth: { color: fc, roughness: 0.7 },
      feather: { color: 0xf2ead8, roughness: 0.8 },
    }[kind];
    gearMats.set(key, addRim(new THREE.MeshStandardMaterial(spec), faction));
  }
  return gearMats.get(key);
}

function part(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// Procedural props in the character's model units (a KayKit figure is ~2.4 tall). Weapons go
// on the hand slots (GLTFLoader strips the '.' from 'handslot.r'), which point +Y down the
// forearm in the idle pose, so they follow the idle animations.
// Hand-slot rotation (solved against the idle pose) that stands a +Y-along-the-shaft weapon
// upright, leaning ~17° out and back from the body.
const UPRIGHT = new THREE.Quaternion(-0.521, 0.554, 0.571, 0.308);

const GEAR = {
  // Knight's lance: ~3.4 units (~1.5 tiles) — the tallest silhouette on the field.
  lance(character, faction) {
    const slot = character.getObjectByName('handslotr');
    if (!slot) return;
    const g = new THREE.Group();
    g.name = 'gear_lance';
    g.quaternion.copy(UPRIGHT);
    g.position.set(0, 0.03, 0);
    part(g, new THREE.CylinderGeometry(0.045, 0.055, 3.1, 6), gearMaterial('wood', faction), 0, 0.75, 0);
    part(g, new THREE.ConeGeometry(0.19, 0.5, 8, 1, true), gearMaterial('steel', faction), 0, 0.42, 0);
    part(g, new THREE.ConeGeometry(0.085, 0.55, 6), gearMaterial('steel', faction), 0, 2.55, 0);
    part(g, new THREE.TorusGeometry(0.07, 0.025, 4, 8), gearMaterial('gold', faction), 0, 2.26, 0).rotation.x = Math.PI / 2;
    const pennant = part(g, new THREE.BoxGeometry(0.02, 0.32, 0.5), gearMaterial('cloth', faction), 0, 2.02, 0.28);
    pennant.rotation.x = -0.08;
    slot.add(g);
  },
  // Longbow in the left hand: a ~2.6-unit stave, from the knee to above the hood.
  bow(character, faction) {
    const slot = character.getObjectByName('handslotl');
    if (!slot) return;
    const g = new THREE.Group();
    g.name = 'gear_bow';
    const R = 2.1, arc = 1.35;
    const stave = part(g, new THREE.TorusGeometry(R, 0.06, 5, 18, arc), gearMaterial('darkwood', faction));
    stave.rotation.z = Math.PI - arc / 2; // arc centred on -X, bulging away from the string
    stave.position.x = R;
    const tipY = Math.sin(arc / 2) * R, tipX = R - Math.cos(arc / 2) * R;
    part(g, new THREE.CylinderGeometry(0.012, 0.012, tipY * 2, 3), gearMaterial('string', faction), tipX, 0, 0);
    part(g, new THREE.CylinderGeometry(0.075, 0.075, 0.26, 6), gearMaterial('leather', faction));
    for (const s of [-1, 1]) part(g, new THREE.SphereGeometry(0.06, 6, 4), gearMaterial('gold', faction), tipX, s * tipY, 0);
    // Solved against the idle pose: stave upright beside the archer, facing the camera, tips
    // curving away from the body so the body never hides them.
    g.quaternion.set(-0.542, -0.686, -0.369, 0.315);
    g.position.set(0, 0.05, 0);
    slot.add(g);
  },
  quiver(character, faction) {
    const chest = character.getObjectByName('chest') || character.getObjectByName('spine');
    if (!chest) return;
    const g = new THREE.Group();
    g.name = 'gear_quiver';
    part(g, new THREE.CylinderGeometry(0.13, 0.1, 0.75, 7), gearMaterial('leather', faction));
    part(g, new THREE.CylinderGeometry(0.135, 0.135, 0.06, 7), gearMaterial('cloth', faction), 0, 0.3, 0);
    for (let i = 0; i < 4; i++) {
      const f = part(g, new THREE.ConeGeometry(0.05, 0.22, 4), gearMaterial('feather', faction), -0.05 + (i % 2) * 0.1, 0.5 + (i >> 1) * 0.05, -0.04 + (i >> 1) * 0.08);
      f.rotation.x = Math.PI;
    }
    g.position.set(0.22, 0.2, -0.42);
    g.rotation.set(0.25, 0, -0.5);
    chest.add(g);
  },
  // Cavalier's crest: a faction-coloured plume sweeping back off the helmet.
  plume(character, faction) {
    const head = character.getObjectByName('head');
    if (!head) return;
    const g = new THREE.Group();
    g.name = 'gear_plume';
    for (let i = 0; i < 4; i++) {
      const p = part(g, new THREE.SphereGeometry(0.16 - i * 0.02, 8, 6), gearMaterial('cloth', faction), 0, 1.3 - i * 0.07, -0.08 - i * 0.2);
      p.scale.set(0.55, 1, 1.4);
    }
    part(g, new THREE.CylinderGeometry(0.06, 0.08, 0.12, 6), gearMaterial('gold', faction), 0, 1.24, 0);
    head.add(g);
  },
  // Brigand's bandana: faction cloth over a bald head, knot and tails at the back.
  bandana(character, faction) {
    const head = character.getObjectByName('head');
    if (!head) return;
    const g = new THREE.Group();
    g.name = 'gear_bandana';
    const cloth = gearMaterial('cloth', faction);
    const cap = part(g, new THREE.SphereGeometry(0.56, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.36), cloth, 0, 0.5, -0.03);
    cap.rotation.x = -0.22;
    part(g, new THREE.SphereGeometry(0.09, 6, 4), cloth, 0, 0.62, -0.56);
    for (const s of [-1, 1]) {
      const t = part(g, new THREE.BoxGeometry(0.14, 0.34, 0.035), cloth, s * 0.08, 0.44, -0.6);
      t.rotation.set(0.35, 0, s * 0.35);
    }
    head.add(g);
  },
};

// Inverted-hull outline: a back-face copy of each visible mesh pushed out along its normals
// in a dark faction tint. Costs one extra draw per mesh; no post pass, so it works with the
// EffectComposer stack and on phones with HD off.
const OUTLINE_W = 0.022; // character model units (~0.01 world units)
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
  root.traverse((o) => { if (o.isMesh && o.visible && !o.userData.outline) meshes.push(o); });
  for (const o of meshes) {
    const mat = outlineMaterial(faction, width);
    let hull;
    if (o.isSkinnedMesh) {
      hull = new THREE.SkinnedMesh(o.geometry, mat);
      hull.bind(o.skeleton, o.bindMatrix);
    } else {
      hull = new THREE.Mesh(o.geometry, mat);
    }
    hull.userData.outline = true;
    hull.castShadow = false;
    hull.receiveShadow = false;
    hull.frustumCulled = o.frustumCulled;
    hull.raycast = () => {}; // picking uses the real mesh; skip re-skinning the hull
    o.add(hull); // identity transform: follows the mesh, its bones and its visibility
  }
}

function prepareCharacter(gltf, spec, faction, hair, { hideLegs = false } = {}) {
  const root = SkeletonUtils.clone(gltf.scene);
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const keep = spec.show?.includes(o.name) || (BODY.test(o.name) && !spec.hide?.includes(o.name));
    o.visible = keep && !(hideLegs && /Leg(Left|Right)$/.test(o.name));
    o.material = unitMaterial(o.material, faction, hair);
  });
  for (const [name, p] of Object.entries(spec.pose ?? {})) {
    const o = root.getObjectByName(name);
    if (!o) continue;
    o.quaternion.fromArray(p.q);
    o.scale.setScalar(p.scale ?? 1);
  }
  for (const g of spec.gear ?? []) GEAR[g]?.(root, faction);
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
    const fc = FACTION_ACCENT[faction].cloth;
    const colors = { coat: 0x8a5a36, mane: 0x2a1c14, hoof: 0x2b2522, leather: 0x5a3a22, caparison: fc, trim: 0xd4a93c, steel: 0xb8bec6 };
    const shiny = name === 'steel' || name === 'trim';
    horseMats.set(key, addRim(new THREE.MeshStandardMaterial({
      color: colors[name] ?? 0x888888, roughness: shiny ? 0.35 : 0.8, metalness: shiny ? 0.7 : 0, flatShading: true,
    }), faction));
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
  addOutlines(horse, faction, 0.006);
  horse.scale.setScalar(HORSE_SCALE);
  return { root: horse, neck: horse.getObjectByName('neck'), tail: horse.getObjectByName('tail') };
}

export async function buildModel(id, faction) {
  const spec = MODEL_SPECS[id];
  const hair = UNITS.find((u) => u.id === id)?.look?.hair ?? null;
  const gltf = await load(BASE + spec.file);
  const character = prepareCharacter(gltf, spec, faction, hair, { hideLegs: !!spec.mount });
  addOutlines(character, faction, OUTLINE_W / (spec.scale ?? 1));
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
