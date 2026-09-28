import * as THREE from 'three';
import { toWorld, tileTop, FACTION_COLORS } from './map.js';

// `cls` picks the 3D model and portrait gear; `title` is what the UI shows.
export const UNITS = [
  { id: 'aldric', name: 'Aldric', title: 'Lord', cls: 'lord', faction: 'blue', c: 3, r: 9, lv: 3,
    hp: 22, maxHp: 22, str: 7, mag: 1, skl: 8, spd: 9, def: 6, res: 3, mov: 5, weapon: 'Silver Rapier',
    look: { skin: '#f2cda9', hair: '#d9a441', eyes: '#3b6ea8', style: 'swept' } },
  { id: 'brenna', name: 'Brenna', title: 'Knight', cls: 'knight', faction: 'blue', c: 5, r: 9, lv: 4,
    hp: 28, maxHp: 28, str: 9, mag: 0, skl: 5, spd: 3, def: 13, res: 1, mov: 4, weapon: 'Iron Lance',
    look: { skin: '#e8b995', hair: '#b5462b', eyes: '#5a7a3a', style: 'short' } },
  { id: 'wren', name: 'Wren', title: 'Archer', cls: 'archer', faction: 'blue', c: 1, r: 9, lv: 2,
    hp: 18, maxHp: 19, str: 6, mag: 0, skl: 9, spd: 8, def: 4, res: 2, mov: 5, weapon: 'Longbow',
    look: { skin: '#d9a57c', hair: '#6b4226', eyes: '#3f7a4a', style: 'short' } },
  { id: 'elowen', name: 'Elowen', title: 'Mage', cls: 'mage', faction: 'blue', c: 4, r: 10, lv: 3,
    hp: 16, maxHp: 16, str: 1, mag: 9, skl: 6, spd: 7, def: 2, res: 8, mov: 5, weapon: 'Fire Tome',
    look: { skin: '#f6dcc4', hair: '#dfe3ec', eyes: '#7a4fb0', style: 'long' } },
  { id: 'garrick', name: 'Garrick', title: 'Cavalier', cls: 'cavalier', faction: 'blue', c: 3, r: 7, lv: 4,
    hp: 24, maxHp: 24, str: 8, mag: 0, skl: 6, spd: 7, def: 8, res: 2, mov: 7, weapon: 'Steel Lance',
    look: { skin: '#c68f63', hair: '#3a2a1e', eyes: '#4a3524', style: 'short', beard: true } },

  { id: 'morvath', name: 'Morvath', title: 'Warlord', cls: 'warlord', faction: 'red', c: 12, r: 2, lv: 10, boss: true,
    hp: 38, maxHp: 38, str: 14, mag: 0, skl: 9, spd: 7, def: 11, res: 4, mov: 5, weapon: 'Great Axe',
    look: { skin: '#cf9d78', hair: '#1c1714', eyes: '#b83a2a', style: 'none', beard: true } },
  { id: 'dreg', name: 'Dreg', title: 'Knight', cls: 'knight', faction: 'red', c: 10, r: 3, lv: 5,
    hp: 27, maxHp: 27, str: 9, mag: 0, skl: 4, spd: 2, def: 12, res: 0, mov: 4, weapon: 'Iron Lance',
    look: { skin: '#d8a98a', hair: '#2b2b2b', eyes: '#333', style: 'short' } },
  { id: 'sable', name: 'Sable', title: 'Archer', cls: 'archer', faction: 'red', c: 12, r: 4, lv: 4,
    hp: 19, maxHp: 19, str: 7, mag: 0, skl: 8, spd: 7, def: 4, res: 1, mov: 5, weapon: 'Steel Bow',
    look: { skin: '#e9c2a0', hair: '#1f1a24', eyes: '#8a2f3a', style: 'long' } },
  { id: 'vex', name: 'Vex', title: 'Shaman', cls: 'mage', faction: 'red', c: 11, r: 1, lv: 5,
    hp: 17, maxHp: 17, str: 0, mag: 8, skl: 5, spd: 6, def: 2, res: 7, mov: 5, weapon: 'Flux',
    look: { skin: '#d9c7b8', hair: '#5b2a7a', eyes: '#c9a24a', style: 'long' } },
  { id: 'grisk', name: 'Grisk', title: 'Brigand', cls: 'brigand', faction: 'red', c: 9, r: 6, lv: 4,
    hp: 26, maxHp: 26, str: 10, mag: 0, skl: 3, spd: 5, def: 4, res: 0, mov: 5, weapon: 'Hand Axe',
    look: { skin: '#c98d62', hair: '#b8552a', eyes: '#3a2a1a', style: 'none', beard: true } },
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

export function createUnits(scene) {
  const list = UNITS.map((data, i) => {
    const group = new THREE.Group();
    const p = toWorld(data.c, data.r);
    group.position.set(p.x, tileTop(data.c, data.r), p.z);

    const fc = FACTION_COLORS[data.faction];
    const base = add(group, cyl(0.34, 0.37, 0.05, 48), mat(0x2b2724, { roughness: 0.4, metalness: 0.3 }), 0, 0.025, 0);
    add(group, new THREE.TorusGeometry(0.37, 0.012, 8, 48), gold(), 0, 0.012, 0).rotation.x = Math.PI / 2;
    base.receiveShadow = true;
    const ring = add(group, new THREE.TorusGeometry(0.35, 0.02, 10, 64),
      new THREE.MeshStandardMaterial({ color: fc, emissive: fc, emissiveIntensity: 0.5 }), 0, 0.05, 0);
    ring.rotation.x = Math.PI / 2;

    const figure = buildFigure(data);
    figure.position.y = 0.05;
    // Figures face the camera, turned slightly toward the enemy side.
    figure.rotation.y = data.faction === 'blue' ? 0.45 : -0.45;
    figure.scale.multiplyScalar(1.6);
    group.add(figure);

    group.traverse((o) => { o.userData.unitId = data.id; });
    scene.add(group);
    return { data, group, figure, ring, phase: i * 0.9 };
  });

  const byId = new Map(list.map((u) => [u.data.id, u]));

  return {
    list,
    byId,
    unitAt: (c, r) => list.find((u) => u.data.c === c && u.data.r === r),
    update(t, activeId) {
      for (const u of list) {
        const active = u.data.id === activeId;
        const amp = active ? 0.05 : 0.012;
        const speed = active ? 5 : 2;
        u.figure.position.y = 0.05 + Math.abs(Math.sin(t * speed + u.phase)) * amp;
        u.ring.material.emissiveIntensity = active ? 1.2 + Math.sin(t * 6) * 0.4 : 0.5;
      }
    },
  };
}
