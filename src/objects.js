import * as THREE from 'three';
import { toWorld, tileTop } from './map.js';

// Tile objects in the scene (barricades, corpses; src/match.js `match.objects`): simple primitives, one group per object, kept in
// step with the match by sync(). Empty in the game, so nothing is drawn unless a culture spawns objects.
const WOOD = new THREE.MeshStandardMaterial({ color: '#7a5230', roughness: 0.95 });
const IRON = new THREE.MeshStandardMaterial({ color: '#5b6068', roughness: 0.7, metalness: 0.3 });
const BONE = new THREE.MeshStandardMaterial({ color: '#cfc7b2', roughness: 0.9 });

function build(o) {
  const g = new THREE.Group();
  if (o.objectKind === 'corpse') {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6), BONE);
    mound.scale.set(1, 0.28, 0.75);
    mound.position.y = 0.05;
    g.add(mound);
    for (const [x, z, r] of [[-0.12, 0.1, 0.4], [0.14, -0.08, -0.7]]) {
      const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 6), BONE);
      rib.rotation.set(Math.PI / 2, 0, r);
      rib.position.set(x, 0.09, z);
      g.add(rib);
    }
  } else {
    // Barricade: three crossed stakes on a low base.
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.16), WOOD);
    base.position.y = 0.05;
    g.add(base);
    for (const x of [-0.2, 0, 0.2]) {
      const stake = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 6), x === 0 ? IRON : WOOD);
      stake.position.set(x, 0.32, 0);
      stake.rotation.z = x * -1.2;
      g.add(stake);
    }
  }
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.userData.objectId = o.id; } });
  return g;
}

export function createObjectLayer(scene) {
  const views = new Map();
  return {
    views,
    sync(objects = []) {
      const live = new Set(objects.map((o) => o.id));
      for (const [id, v] of views) if (!live.has(id)) { scene.remove(v); views.delete(id); }
      for (const o of objects) {
        let v = views.get(o.id);
        if (!v) { v = build(o); scene.add(v); views.set(o.id, v); }
        const p = toWorld(o.c, o.r);
        v.position.set(p.x, tileTop(o.c, o.r), p.z);
        // Damage reads as shrinkage: 10 HP full size, 1 HP about a third.
        const k = 0.35 + 0.65 * Math.max(0, o.hp) / Math.max(1, o.maxHp);
        v.scale.setScalar(o.objectKind === 'corpse' ? 1 : k);
      }
    },
  };
}
