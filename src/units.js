import * as THREE from 'three';
import { toWorld, tileTop, FACTION_COLORS } from './map.js';
import { buildModel } from './models.js';
import { buildSprite, hasSprite } from './sprites.js';

// `cls` picks the 3D model and portrait gear (models.js MODEL_SPECS); `title` is what the UI
// shows. Brenna and Dreg are the two named heroes. Everything else is an unnamed recruit: a class
// template (RECRUIT) plus a per-unit look, so more can be recruited in play the same way.
const RECRUIT = {
  pikeman: { name: 'Pikeman', title: 'Recruit', lv: 2, hp: 24, str: 8, mag: 0, skl: 5, spd: 4, def: 9, res: 1, mov: 4, weapon: 'Iron Pike' },
  archer: { name: 'Archer', title: 'Recruit', lv: 2, hp: 18, str: 6, mag: 0, skl: 8, spd: 7, def: 3, res: 1, mov: 5, weapon: 'Longbow' },
  cavalier: { name: 'Cavalier', title: 'Recruit', lv: 3, hp: 24, str: 8, mag: 0, skl: 5, spd: 8, def: 7, res: 1, mov: 7, weapon: 'Iron Lance' },
};
const recruit = (cls, id, faction, c, r, look, over = {}) => {
  const t = { ...RECRUIT[cls], ...over };
  return { id, cls, faction, c, r, name: t.name, title: t.title, lv: t.lv, hp: t.hp, maxHp: t.hp, str: t.str, mag: t.mag, skl: t.skl,
    spd: t.spd, def: t.def, res: t.res, mov: t.mov, weapon: t.weapon, look };
};

export const UNITS = [
  { id: 'brenna', name: 'Brenna', title: 'Paladin', cls: 'paladin', faction: 'blue', c: 5, r: 9, lv: 4,
    hp: 28, maxHp: 28, str: 9, mag: 0, skl: 5, spd: 3, def: 13, res: 1, mov: 4, weapon: 'Iron Sword',
    look: { skin: '#f0cdb4', hair: '#c9b6e6', eyes: '#5a64c8', style: 'long' } },
  recruit('pikeman', 'pike_b1', 'blue', 3, 9, { skin: '#e8b995', hair: '#6b4226', eyes: '#4a6a9a', style: 'short' }),
  recruit('pikeman', 'pike_b2', 'blue', 4, 10, { skin: '#c68f63', hair: '#2b2018', eyes: '#4a3524', style: 'short' }),
  recruit('archer', 'archer_b1', 'blue', 1, 9, { skin: '#f0cdb4', hair: '#b5462b', eyes: '#3f7a4a', style: 'short' }),
  recruit('cavalier', 'cav_b1', 'blue', 3, 7, { skin: '#d9a57c', hair: '#3a2a1e', eyes: '#5a7a3a', style: 'short' }),

  { id: 'dreg', name: 'Dreg', title: 'Barbarian', cls: 'barbarian', faction: 'red', c: 10, r: 3, lv: 5,
    hp: 27, maxHp: 27, str: 9, mag: 0, skl: 4, spd: 2, def: 12, res: 0, mov: 4, weapon: 'Steel Axe',
    look: { skin: '#d8a98a', hair: '#9c4722', eyes: '#5b7088', style: 'long', beard: true } },
  recruit('pikeman', 'pike_r1', 'red', 9, 6, { skin: '#d8a98a', hair: '#2b2b2b', eyes: '#5a4a3a', style: 'short' }, { lv: 3 }),
  recruit('archer', 'archer_r1', 'red', 12, 4, { skin: '#e9c2a0', hair: '#1f1a24', eyes: '#8a2f3a', style: 'long' }, { weapon: 'Steel Bow' }),
  recruit('archer', 'archer_r2', 'red', 11, 1, { skin: '#c98d62', hair: '#7a5a3a', eyes: '#3a2a1a', style: 'short' }),
  recruit('cavalier', 'cav_r1', 'red', 12, 2, { skin: '#e0b090', hair: '#5a3820', eyes: '#6a4a2a', style: 'short' }, { weapon: 'Steel Lance', lv: 4 }),
];

const matCache = new Map();
function mat(color, opts = {}) {
  const key = String(color) + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.62, ...opts }));
  }
  return matCache.get(key);
}
const metal = () => mat(0xb9bec8, { metalness: 0.65, roughness: 0.35 });
const darkMetal = () => mat(0x4a4650, { metalness: 0.6, roughness: 0.45 });
const gold = () => mat(0xd4a93c, { metalness: 0.8, roughness: 0.3 });
const wood = () => mat(0x6b4526);
const leather = () => mat(0x5a3a22);

function add(parent, geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

const cyl = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);
const sphere = (r, w = 24, h = 18) => new THREE.SphereGeometry(r, w, h);
const boxG = (x, y, z) => new THREE.BoxGeometry(x, y, z);

function humanoid(g, { torso, legs, arms, skin, hair, bulk = 1, noLegs = false, hairStyle }) {
  if (!noLegs) {
    add(g, cyl(0.038, 0.045, 0.2), mat(legs), -0.055, 0.15, 0);
    add(g, cyl(0.038, 0.045, 0.2), mat(legs), 0.055, 0.15, 0);
    add(g, boxG(0.06, 0.04, 0.09), leather(), -0.055, 0.07, 0.015);
    add(g, boxG(0.06, 0.04, 0.09), leather(), 0.055, 0.07, 0.015);
  }
  add(g, cyl(0.1 * bulk, 0.12 * bulk, 0.24), mat(torso), 0, 0.37, 0);
  add(g, cyl(0.123 * bulk, 0.123 * bulk, 0.03), leather(), 0, 0.26, 0);
  add(g, sphere(0.048 * bulk), mat(torso), -0.12 * bulk, 0.47, 0);
  add(g, sphere(0.048 * bulk), mat(torso), 0.12 * bulk, 0.47, 0);
  add(g, cyl(0.03, 0.032, 0.2), mat(arms), -0.14 * bulk, 0.37, 0).rotation.z = -0.15;
  add(g, cyl(0.03, 0.032, 0.2), mat(arms), 0.14 * bulk, 0.37, 0).rotation.z = 0.15;
  add(g, sphere(0.034, 16, 12), mat(skin), -0.16 * bulk, 0.26, 0.02);
  add(g, sphere(0.034, 16, 12), mat(skin), 0.16 * bulk, 0.26, 0.02);
  add(g, sphere(0.08), mat(skin), 0, 0.58, 0);
  // eyes and nose so faces read when zoomed in
  add(g, sphere(0.012, 10, 8), mat(0x1a1410), -0.028, 0.595, 0.071);
  add(g, sphere(0.012, 10, 8), mat(0x1a1410), 0.028, 0.595, 0.071);
  add(g, sphere(0.013, 10, 8), mat(skin), 0, 0.575, 0.08);
  if (hair) {
    const cap = add(g, new THREE.SphereGeometry(0.086, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(hair), 0, 0.59, -0.01);
    cap.rotation.x = -0.35;
    if (hairStyle === 'long') add(g, boxG(0.15, 0.18, 0.05), mat(hair), 0, 0.52, -0.06);
  }
  return { right: new THREE.Vector3(0.16 * bulk, 0.26, 0.02), left: new THREE.Vector3(-0.16 * bulk, 0.26, 0.02) };
}

function sword(g, at) {
  const s = new THREE.Group();
  s.position.copy(at);
  s.rotation.x = 0.5;
  add(s, boxG(0.022, 0.3, 0.008), mat(0xe6ebf2, { metalness: 0.9, roughness: 0.2 }), 0, 0.17, 0);
  add(s, boxG(0.1, 0.018, 0.02), gold(), 0, 0.02, 0);
  add(s, cyl(0.012, 0.012, 0.06, 5), leather(), 0, -0.02, 0);
  g.add(s);
}

function lance(g, at, color) {
  const s = new THREE.Group();
  s.position.copy(at);
  s.rotation.x = 0.35;
  add(s, cyl(0.012, 0.014, 0.9, 5), wood(), 0, 0.3, 0);
  add(s, new THREE.ConeGeometry(0.028, 0.12, 5), metal(), 0, 0.8, 0);
  const pennant = add(s, boxG(0.005, 0.08, 0.1), mat(color), 0, 0.68, -0.05);
  pennant.rotation.x = 0.1;
  g.add(s);
}

function axe(g, at, big = false) {
  const k = big ? 1.4 : 1;
  const s = new THREE.Group();
  s.position.copy(at);
  s.rotation.x = 0.3;
  add(s, cyl(0.014, 0.016, 0.45 * k, 5), wood(), 0, 0.12 * k, 0);
  add(s, boxG(0.02, 0.12 * k, 0.13 * k), metal(), 0, 0.3 * k, 0.07 * k);
  if (big) add(s, boxG(0.02, 0.12 * k, 0.13 * k), metal(), 0, 0.3 * k, -0.07 * k);
  g.add(s);
}

function bow(g, at) {
  const s = new THREE.Group();
  s.position.copy(at).add(new THREE.Vector3(-0.02, 0.1, 0.04));
  const arc = add(s, new THREE.TorusGeometry(0.2, 0.012, 5, 20, Math.PI), wood(), 0, 0, 0);
  arc.rotation.z = Math.PI / 2;
  add(s, cyl(0.002, 0.002, 0.4, 3), mat(0xeeeeee), 0.0, 0, 0);
  s.rotation.y = Math.PI / 2;
  g.add(s);
}

function staff(g, at, orbColor) {
  const s = new THREE.Group();
  s.position.copy(at);
  add(s, cyl(0.013, 0.016, 0.72, 5), wood(), 0, 0.2, 0);
  add(s, sphere(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: orbColor, emissive: orbColor, emissiveIntensity: 1.6 }), 0, 0.6, 0);
  add(s, new THREE.TorusGeometry(0.05, 0.01, 5, 12), gold(), 0, 0.6, 0).rotation.x = Math.PI / 2;
  g.add(s);
}

function shield(g, at, color) {
  const s = new THREE.Group();
  s.position.copy(at).add(new THREE.Vector3(-0.04, 0.1, 0.04));
  add(s, boxG(0.03, 0.24, 0.18), mat(color), 0, 0, 0);
  add(s, boxG(0.035, 0.26, 0.03), gold(), 0, 0, 0);
  add(s, boxG(0.035, 0.03, 0.2), gold(), 0, 0.03, 0);
  s.rotation.y = 0.4;
  g.add(s);
}

function cape(g, color, y = 0.34, h = 0.34) {
  const c = add(g, boxG(0.24, h, 0.02), mat(color), 0, y, -0.11);
  c.rotation.x = 0.12;
}

function buildFigure(u) {
  const fc = FACTION_COLORS[u.faction];
  const L = u.look;
  const g = new THREE.Group();

  switch (u.cls) {
    case 'lord': {
      const h = humanoid(g, { torso: fc, legs: 0xe8e0cc, arms: fc, skin: L.skin, hair: L.hair, hairStyle: L.style });
      cape(g, 0xf2ead8);
      add(g, new THREE.TorusGeometry(0.083, 0.012, 5, 16), gold(), 0, 0.62, 0).rotation.x = Math.PI / 2 - 0.2;
      add(g, cyl(0.126, 0.126, 0.02), gold(), 0, 0.3, 0);
      sword(g, h.right);
      break;
    }
    case 'paladin': {
      const h = humanoid(g, { torso: 0xeae4d6, legs: 0xb9bec8, arms: 0xb9bec8, skin: L.skin, hair: L.hair, hairStyle: 'long', bulk: 1.2 });
      cape(g, fc);
      add(g, cyl(0.146, 0.146, 0.04), gold(), 0, 0.3, 0);
      sword(g, h.right);
      break;
    }
    case 'barbarian': {
      const h = humanoid(g, { torso: 0x6f6a66, legs: 0x4a3a2a, arms: L.skin, skin: L.skin, hair: L.hair, hairStyle: 'long', bulk: 1.25 });
      add(g, new THREE.TorusGeometry(0.13, 0.05, 6, 14), mat(0xd6c3a0), 0, 0.47, 0).rotation.x = Math.PI / 2;
      add(g, boxG(0.12, 0.08, 0.05), mat(L.hair), 0, 0.53, 0.06);
      axe(g, h.right, true);
      break;
    }
    case 'pikeman':
    case 'knight': {
      const h = humanoid(g, { torso: 0xb9bec8, legs: 0x8d929c, arms: 0xb9bec8, skin: L.skin, bulk: 1.3 });
      add(g, sphere(0.095), metal(), 0, 0.6, 0);
      add(g, boxG(0.12, 0.018, 0.02), mat(0x1a1a1a), 0, 0.6, 0.087);
      add(g, boxG(0.02, 0.12, 0.14), mat(fc), 0, 0.72, -0.01);
      add(g, cyl(0.158, 0.158, 0.06), mat(fc), 0, 0.33, 0);
      shield(g, h.left, fc);
      lance(g, h.right, fc);
      break;
    }
    case 'archer': {
      const cloak = u.faction === 'blue' ? 0x3f6b3a : 0x4a2a2a;
      const h = humanoid(g, { torso: cloak, legs: 0x5a4632, arms: 0x7a5a3a, skin: L.skin, hair: L.hair });
      add(g, new THREE.ConeGeometry(0.105, 0.2, 8), mat(cloak), 0, 0.66, -0.01);
      add(g, cyl(0.126, 0.126, 0.03), mat(fc), 0, 0.3, 0);
      add(g, cyl(0.035, 0.03, 0.24, 6), leather(), 0.06, 0.45, -0.12).rotation.z = -0.4;
      bow(g, h.left);
      break;
    }
    case 'mage': {
      const robe = fc;
      add(g, new THREE.ConeGeometry(0.17, 0.46, 10), mat(robe), 0, 0.28, 0);
      const h = humanoid(g, { torso: robe, legs: robe, arms: robe, skin: L.skin, hair: L.hair, noLegs: true, hairStyle: 'long' });
      add(g, cyl(0.16, 0.16, 0.012, 16), mat(0x2a2338), 0, 0.64, 0);
      const hat = add(g, new THREE.ConeGeometry(0.085, 0.26, 10), mat(0x2a2338), 0, 0.77, -0.01);
      hat.rotation.x = -0.25;
      add(g, cyl(0.088, 0.088, 0.025, 12), gold(), 0, 0.655, 0);
      staff(g, h.right, u.faction === 'blue' ? 0xff8a3a : 0xb04aff);
      break;
    }
    case 'cavalier': {
      const horse = new THREE.Group();
      const coat = mat(0x6b4a33);
      const body = add(horse, new THREE.CapsuleGeometry(0.11, 0.28, 4, 8), coat, 0, 0.34, 0);
      body.rotation.x = Math.PI / 2;
      for (const [x, z] of [[-0.07, 0.15], [0.07, 0.15], [-0.07, -0.15], [0.07, -0.15]]) {
        add(horse, cyl(0.03, 0.024, 0.26, 6), coat, x, 0.15, z);
        add(horse, cyl(0.03, 0.03, 0.03, 6), mat(0x2a1c12), x, 0.03, z);
      }
      add(horse, cyl(0.05, 0.07, 0.24, 7), coat, 0, 0.47, 0.22).rotation.x = 0.6;
      add(horse, boxG(0.08, 0.09, 0.2), coat, 0, 0.56, 0.31).rotation.x = 0.35;
      add(horse, boxG(0.02, 0.1, 0.16), mat(0x2a1c12), 0, 0.58, 0.2).rotation.x = 0.6;
      add(horse, new THREE.ConeGeometry(0.035, 0.22, 5), mat(0x2a1c12), 0, 0.34, -0.27).rotation.x = -2.4;
      add(horse, boxG(0.25, 0.1, 0.34), mat(fc), 0, 0.33, 0);
      add(horse, boxG(0.255, 0.02, 0.345), gold(), 0, 0.28, 0);
      g.add(horse);
      const rider = new THREE.Group();
      rider.position.set(0, 0.2, -0.02);
      const h = humanoid(rider, { torso: 0xb9bec8, legs: fc, arms: fc, skin: L.skin, hair: L.hair, noLegs: true });
      add(rider, new THREE.SphereGeometry(0.09, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), metal(), 0, 0.6, 0);
      lance(rider, h.right, fc);
      g.add(rider);
      g.scale.setScalar(1.05);
      break;
    }
    case 'brigand': {
      const h = humanoid(g, { torso: 0x6a4a2e, legs: 0x4a3a2a, arms: L.skin, skin: L.skin, bulk: 1.15 });
      add(g, sphere(0.058, 8, 6), mat(0xd9ccb0), -0.14, 0.49, 0);
      add(g, new THREE.SphereGeometry(0.086, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), mat(fc), 0, 0.6, 0);
      add(g, boxG(0.12, 0.06, 0.05), mat(L.hair), 0, 0.53, 0.06);
      axe(g, h.right);
      break;
    }
    case 'warlord': {
      const h = humanoid(g, { torso: 0x4a4650, legs: 0x2e2a30, arms: 0x4a4650, skin: L.skin, bulk: 1.35 });
      cape(g, fc, 0.33, 0.4);
      add(g, sphere(0.095), darkMetal(), 0, 0.61, 0);
      for (const side of [-1, 1]) {
        const horn = add(g, new THREE.ConeGeometry(0.028, 0.18, 6), mat(0xe8dcc0), side * 0.11, 0.7, 0);
        horn.rotation.z = -side * 1.0;
      }
      add(g, boxG(0.11, 0.08, 0.05), mat(L.hair), 0, 0.53, 0.06);
      add(g, new THREE.ConeGeometry(0.06, 0.1, 5), darkMetal(), -0.17, 0.52, 0).rotation.z = 0.6;
      add(g, new THREE.ConeGeometry(0.06, 0.1, 5), darkMetal(), 0.17, 0.52, 0).rotation.z = -0.6;
      axe(g, h.right, true);
      g.scale.setScalar(1.1);
      break;
    }
  }
  return g;
}

// HP bar floating just in front of the unit's base, always facing the camera: gold frame,
// dark navy track, faction-coloured fill (blue #4fb3ff / red #ff5a4a). Bars live in a
// separate overlay scene that main.js draws after post-processing, so ambient occlusion
// never darkens them and they stay readable over scenery.
const HP_W = 0.5;
const HP_OFFSET = new THREE.Vector3(0, 0.07, 0.43);
function hpBar(overlay, data) {
  const bar = new THREE.Group();
  const sprite = (color, w, h, anchorLeft = false) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ color, depthTest: false, depthWrite: false, toneMapped: false }));
    s.scale.set(w, h, 1);
    if (anchorLeft) { s.center.set(0, 0.5); s.position.x = -w / 2; }
    s.renderOrder = 6;
    bar.add(s);
    return s;
  };
  sprite(0xc9a24a, HP_W + 0.035, 0.075);
  sprite(0x0d1526, HP_W + 0.015, 0.055);
  const fill = sprite(data.faction === 'blue' ? 0x4fb3ff : 0xff5a4a, HP_W, 0.04, true);
  fill.renderOrder = 7;
  overlay.add(bar);
  return {
    bar,
    set(ratio) { fill.scale.x = HP_W * THREE.MathUtils.clamp(ratio, 0, 1); },
  };
}

const STEP_TIME = 0.16; // seconds per tile walked

export function createUnits(scene) {
  // Tiny tween runner driven by update(): fn(k) with k running 0..1 over `duration` seconds.
  const tweens = [];
  const tween = (duration, fn) => new Promise((resolve) => tweens.push({ duration, fn, t: 0, resolve }));
  const overlay = new THREE.Scene();
  const list = UNITS.map((data, i) => {
    const group = new THREE.Group();
    const p = toWorld(data.c, data.r);
    group.position.set(p.x, tileTop(data.c, data.r), p.z);

    // No pedestal: units stand on the terrain over a faint faction-tinted pool and a thin
    // glowing ring (radius 0.34), like the reference art.
    const fc = FACTION_COLORS[data.faction];
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.34, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: fc, transparent: true, opacity: 0.22, depthWrite: false }));
    pool.position.y = 0.012;
    pool.renderOrder = 1;
    group.add(pool);
    const ring = add(group, new THREE.TorusGeometry(0.34, 0.012, 8, 64),
      new THREE.MeshStandardMaterial({ color: fc, emissive: fc, emissiveIntensity: 0.5 }), 0, 0.014, 0);
    ring.rotation.x = Math.PI / 2;
    ring.castShadow = false;

    const figure = buildFigure(data);
    figure.position.y = 0.05;
    // Figures face the camera, turned slightly toward the enemy side.
    const facing = data.faction === 'blue' ? 0.45 : -0.45;
    figure.rotation.y = facing;
    figure.scale.multiplyScalar(1.6);
    group.add(figure);

    const hp = hpBar(overlay, data);

    group.traverse((o) => { o.userData.unitId = data.id; });
    scene.add(group);
    const u = { data, group, figure, ring, hp, phase: i * 0.9, model: null };

    // Swap in the illustrated model once it loads; the procedural figure stays as the fallback.
    // Every class is an illustrated 2D sprite (src/sprites.js); `?sprites=0` keeps the 3D models
    // for comparison. Sprites face screen-right, so red mirrors to face the blue army.
    const asSprite = hasSprite(data.cls) && new URLSearchParams(location.search).get('sprites') !== '0';
    (asSprite ? buildSprite(data.cls, data.faction, { flip: data.faction === 'red' }) : buildModel(data.id, data.faction)).then((m) => {
      m.root.position.y = 0.01;
      if (!m.billboard) m.root.rotation.y = facing;
      m.root.traverse((o) => { o.userData.unitId = data.id; });
      group.add(m.root);
      u.model = m;
      applyStyle(u);
    }).catch((err) => console.warn(`model for ${data.id} failed, keeping procedural figure`, err));
    return u;
  });

  // M flips between the illustrated models and the original procedural figures.
  let useModels = true;
  function applyStyle(u) {
    const on = useModels && !!u.model;
    if (u.model) u.model.root.visible = on;
    u.figure.visible = !on;
  }

  const byId = new Map(list.map((u) => [u.data.id, u]));
  let lastT = 0;

  return {
    list,
    byId,
    overlay,
    unitAt: (c, r) => list.find((u) => u.data.hp > 0 && u.data.c === c && u.data.r === r),
    alive: (faction) => list.filter((u) => u.data.hp > 0 && (!faction || u.data.faction === faction)),

    // ---- animation: each returns a promise that resolves when it finishes ----
    /** Walk along tiles [[c, r], ...] (excluding the start), hopping between them. */
    async moveAlong(id, tiles) {
      const u = byId.get(id);
      const at = (c, r) => { const p = toWorld(c, r); return new THREE.Vector3(p.x, tileTop(c, r), p.z); };
      let from = u.group.position.clone();
      for (const [c, r] of tiles) {
        const to = at(c, r);
        const start = from;
        await tween(STEP_TIME, (k) => {
          u.group.position.lerpVectors(start, to, k);
          u.group.position.y += Math.sin(Math.PI * k) * 0.05;
        });
        from = to;
        u.data.c = c; u.data.r = r;
      }
      u.group.position.copy(from);
    },
    /** Lunge toward a tile and back (an attack swing). */
    async lunge(id, [c, r]) {
      const u = byId.get(id);
      const base = u.group.position.clone();
      const p = toWorld(c, r);
      const dir = new THREE.Vector3(p.x - base.x, 0, p.z - base.z).normalize().multiplyScalar(0.28);
      await tween(0.26, (k) => u.group.position.copy(base).addScaledVector(dir, Math.sin(Math.PI * k)));
      u.group.position.copy(base);
    },
    /** Recoil shake when struck. */
    async shake(id) {
      const u = byId.get(id);
      const base = u.group.position.clone();
      await tween(0.22, (k) => { u.group.position.x = base.x + Math.sin(k * 40) * 0.05 * (1 - k); });
      u.group.position.copy(base);
    },
    /** Shrink away when defeated. */
    async die(id) {
      const u = byId.get(id);
      await tween(0.5, (k) => u.group.scale.setScalar(Math.max(0.001, 1 - k * k)));
      u.group.visible = false;
    },
    /** World position above a unit's head, for floating text. */
    headPos: (id) => byId.get(id).group.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
    // Sprite quads are rectangles to the depth/normal pass; the ambient-occlusion pass hides them
    // (main.js) so the terrain around a sprite is not left as an un-occluded rectangle.
    spriteMeshes: () => list.filter((u) => u.model?.mesh).map((u) => u.model.mesh),
    toggleModels() {
      useModels = !useModels;
      list.forEach(applyStyle);
      return useModels;
    },
    update(t, activeId) {
      const dt = Math.min(t - lastT, 0.1);
      lastT = t;
      for (const tw of [...tweens]) {
        tw.t += dt;
        const k = Math.min(1, tw.t / tw.duration);
        tw.fn(k);
        if (k >= 1) { tweens.splice(tweens.indexOf(tw), 1); tw.resolve(); }
      }
      for (const u of list) {
        const active = u.data.id === activeId;
        if (u.model) {
          u.model.setActive(active);
          u.model.setDone?.(!!u.data.done);
          u.model.update(dt, t);
        }
        u.hp.set(u.data.hp / u.data.maxHp);
        u.hp.bar.position.copy(u.group.position).add(HP_OFFSET);
        u.hp.bar.visible = u.group.visible;
        const amp = active ? 0.05 : 0.012;
        const speed = active ? 5 : 2;
        u.figure.position.y = 0.05 + Math.abs(Math.sin(t * speed + u.phase)) * amp;
        u.ring.material.emissiveIntensity = active ? 1.2 + Math.sin(t * 6) * 0.4 : 0.5;
      }
    },
  };
}
