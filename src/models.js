import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// KayKit character packs (CC0, Kay Lousberg — see public/models/kaykit/LICENSE-*.txt).
// Each GLB carries every weapon for its class; `show` picks which ones stay visible.
// `attach` loads a loose weapon glTF onto the right-hand slot (skeletons ship without gear).
const BASE = 'models/kaykit/';
const WEAPONS = BASE + 'skeleton-weapons/';

export const MODEL_SPECS = {
  aldric:  { file: 'Knight.glb', show: ['1H_Sword', 'Badge_Shield'], hide: ['Knight_Helmet'] },
  brenna:  { file: 'Knight.glb', show: ['1H_Sword', 'Rectangle_Shield'] },
  wren:    { file: 'Rogue_Hooded.glb', show: ['2H_Crossbow'] },
  elowen:  { file: 'Mage.glb', show: ['2H_Staff'] },
  garrick: { file: 'Barbarian.glb', show: ['1H_Axe', 'Barbarian_Round_Shield'] },

  morvath: { file: 'Skeleton_Warrior.glb', attach: ['Skeleton_Axe'], scale: 1.15 },
  dreg:    { file: 'Skeleton_Warrior.glb', attach: ['Skeleton_Blade'], attachLeft: ['Skeleton_Shield_Small_A'] },
  sable:   { file: 'Skeleton_Rogue.glb', attach: ['Skeleton_Crossbow'] },
  vex:     { file: 'Skeleton_Mage.glb', attach: ['Skeleton_Staff'] },
  grisk:   { file: 'Skeleton_Minion.glb', attach: ['Skeleton_Axe'] },
};

// Mesh names ending in these are the character's body; everything else is optional gear.
const BODY = /_(Head|Head_Hooded|Body|ArmLeft|ArmRight|LegLeft|LegRight|Cape|Cloak|Eyes|Jaw|Skull|Hat|Helmet|Hood)$/;

// KayKit characters are ~2.4 units tall; this brings them to ~1.1 tiles, matching the old figures.
const BASE_SCALE = 0.46;

const loader = new GLTFLoader();
const cache = new Map();
function load(url) {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url));
  return cache.get(url);
}

export async function buildModel(id) {
  const spec = MODEL_SPECS[id];
  const gltf = await load(BASE + spec.file);
  const root = SkeletonUtils.clone(gltf.scene);

  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const keep = spec.show?.includes(o.name) || (BODY.test(o.name) && !spec.hide?.includes(o.name));
    o.visible = keep;
  });

  const hands = { r: root.getObjectByName('handslotr'), l: root.getObjectByName('handslotl') };
  for (const [side, names] of [['r', spec.attach], ['l', spec.attachLeft]]) {
    for (const name of names ?? []) {
      const w = (await load(WEAPONS + name + '.gltf')).scene.clone();
      w.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      hands[side].add(w);
    }
  }

  root.scale.setScalar(BASE_SCALE * (spec.scale ?? 1));

  const mixer = new THREE.AnimationMixer(root);
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

  return {
    root,
    mixer,
    // Crossfade between the calm idle and the combat-ready idle when a unit is selected.
    setActive(active) {
      const next = action(active ? readyName : idleName);
      if (next === current) return;
      next.reset().play();
      current.crossFadeTo(next, 0.25, false);
      current = next;
    },
  };
}
