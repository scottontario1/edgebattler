import * as THREE from 'three';
import { W, H, TERRAIN, inBounds, terrainAt, toWorld, tileTop } from './map.js';
import { portraitSVG } from './portraits.js';

const MOVE_COST = {
  foot: { G: 1, R: 1, B: 1, V: 1, C: 1, K: 1, F: 2, M: 3 },
  armor: { G: 1, R: 1, B: 1, V: 1, C: 1, K: 1, F: 2 },
  mounted: { G: 1, R: 1, B: 1, V: 1, C: 1, K: 1, F: 3 },
};
const MOVE_TYPE = { knight: 'armor', warlord: 'armor', cavalier: 'mounted' };
const ATTACK_RANGE = { archer: [2, 2], mage: [1, 2] };
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Fire Emblem style range: blue tiles you can reach, red tiles you can hit.
function computeRange(unit, units) {
  const costs = MOVE_COST[MOVE_TYPE[unit.cls] || 'foot'];
  const key = (c, r) => r * W + c;
  const best = new Map([[key(unit.c, unit.r), 0]]);
  const queue = [[unit.c, unit.r, 0]];
  while (queue.length) {
    queue.sort((a, b) => a[2] - b[2]);
    const [c, r, spent] = queue.shift();
    for (const [dc, dr] of DIRS) {
      const nc = c + dc, nr = r + dr;
      if (!inBounds(nc, nr)) continue;
      const cost = costs[terrainAt(nc, nr)];
      if (cost === undefined) continue;
      const occupant = units.unitAt(nc, nr);
      if (occupant && occupant.data.faction !== unit.faction) continue;
      const total = spent + cost;
      if (total > unit.mov) continue;
      const k = key(nc, nr);
      if (best.has(k) && best.get(k) <= total) continue;
      best.set(k, total);
      queue.push([nc, nr, total]);
    }
  }
  const move = [...best.keys()].map((k) => [k % W, Math.floor(k / W)]);
  const [minR, maxR] = ATTACK_RANGE[unit.cls] || [1, 1];
  const attack = new Set();
  for (const [c, r] of move) {
    for (let dc = -maxR; dc <= maxR; dc++) {
      for (let dr = -maxR; dr <= maxR; dr++) {
        const d = Math.abs(dc) + Math.abs(dr);
        if (d < minR || d > maxR) continue;
        const nc = c + dc, nr = r + dr;
        if (inBounds(nc, nr) && !best.has(key(nc, nr))) attack.add(key(nc, nr));
      }
    }
  }
  return { move, attack: [...attack].map((k) => [k % W, Math.floor(k / W)]) };
}

function overlay(scene, color, opacity) {
  const geo = new THREE.PlaneGeometry(0.92, 0.92).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, material, W * H);
  mesh.count = 0;
  mesh.renderOrder = 2;
  scene.add(mesh);
  const m = new THREE.Matrix4();
  return {
    mesh,
    set(tiles) {
      tiles.forEach(([c, r], i) => {
        const p = toWorld(c, r);
        m.makeTranslation(p.x, tileTop(c, r) + 0.015, p.z);
        mesh.setMatrixAt(i, m);
      });
      mesh.count = tiles.length;
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

function makeCursor(scene) {
  const g = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: 0xffd766 });
  const arm = new THREE.BoxGeometry(0.2, 0.03, 0.05);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const a = new THREE.Mesh(arm, material);
    a.position.set(sx * 0.38, 0, sz * 0.46);
    const b = new THREE.Mesh(arm, material);
    b.rotation.y = Math.PI / 2;
    b.position.set(sx * 0.46, 0, sz * 0.38);
    g.add(a, b);
  }
  g.renderOrder = 3;
  scene.add(g);
  return g;
}

export function createUI({ renderer, camera, scene, units }) {
  const card = document.getElementById('card');
  const terrainBox = document.getElementById('terrain');
  const roster = document.getElementById('roster');

  const moveOverlay = overlay(scene, 0x4f8dff, 0.45);
  const attackOverlay = overlay(scene, 0xff4a4a, 0.38);
  const cursor = makeCursor(scene);

  let hoverId = null;
  let selectedId = 'aldric';
  let cursorTile = [3, 9];

  const portraits = new Map(units.list.map((u) => [u.data.id, portraitSVG(u.data)]));

  function showCard(id) {
    const u = units.byId.get(id).data;
    const t = TERRAIN[terrainAt(u.c, u.r)];
    const stat = (label, v) => `<div class="stat"><span>${label}</span><b>${v}</b></div>`;
    card.className = `panel card ${u.faction}`;
    card.innerHTML = `
      <div class="portrait">${portraits.get(id)}</div>
      <div class="info">
        <div class="name">${u.name}${u.boss ? ' <span class="boss">BOSS</span>' : ''}</div>
        <div class="title">${u.title} · Lv ${u.lv}</div>
        <div class="hp"><span>HP</span><div class="bar"><i style="width:${(u.hp / u.maxHp) * 100}%"></i></div><b>${u.hp}/${u.maxHp}</b></div>
        <div class="stats">
          ${stat('Str', u.str)}${stat('Mag', u.mag)}${stat('Skl', u.skl)}${stat('Spd', u.spd)}
          ${stat('Def', u.def)}${stat('Res', u.res)}${stat('Mov', u.mov)}${stat('Ter', `+${t.def}`)}
        </div>
        <div class="weapon">⚔ ${u.weapon}</div>
      </div>`;
    const range = computeRange(u, units);
    moveOverlay.set(range.move);
    attackOverlay.set(range.attack);
    moveOverlay.mesh.material.color.set(u.faction === 'blue' ? 0x4f8dff : 0x8f6bff);
    for (const el of roster.children) el.classList.toggle('active', el.dataset.id === id);
  }

  function showTerrain(c, r) {
    const t = TERRAIN[terrainAt(c, r)];
    terrainBox.innerHTML = `<div class="tname">${t.name}</div>
      <div class="trow"><span>DEF</span><b>${t.def}</b></div>
      <div class="trow"><span>AVO</span><b>${t.avo}</b></div>`;
  }

  function setCursor(c, r) {
    cursorTile = [c, r];
    const p = toWorld(c, r);
    cursor.position.set(p.x, tileTop(c, r) + 0.04, p.z);
    showTerrain(c, r);
  }

  function refresh() {
    showCard(hoverId || selectedId);
  }

  for (const u of units.list) {
    const b = document.createElement('button');
    b.className = `mini ${u.data.faction}`;
    b.dataset.id = u.data.id;
    b.title = `${u.data.name}, ${u.data.title}`;
    b.innerHTML = portraits.get(u.data.id);
    b.addEventListener('mouseenter', () => { hoverId = u.data.id; setCursor(u.data.c, u.data.r); refresh(); });
    b.addEventListener('mouseleave', () => { hoverId = null; refresh(); });
    b.addEventListener('click', () => { selectedId = u.data.id; refresh(); });
    roster.appendChild(b);
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitPoint = new THREE.Vector3();
  const figures = units.list.map((u) => u.group);

  function pick(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(figures, true)[0];
    if (hit) {
      const u = units.byId.get(hit.object.userData.unitId).data;
      return [u.c, u.r];
    }
    // Tiles sit at different heights, so test each tile's top face and keep the nearest hit.
    let best = null, bestDist = Infinity;
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        ground.constant = -tileTop(c, r);
        if (!raycaster.ray.intersectPlane(ground, hitPoint)) continue;
        const p = toWorld(c, r);
        if (Math.abs(hitPoint.x - p.x) > 0.5 || Math.abs(hitPoint.z - p.z) > 0.5) continue;
        const d = hitPoint.distanceToSquared(raycaster.ray.origin);
        if (d < bestDist) { bestDist = d; best = [c, r]; }
      }
    }
    return best;
  }

  renderer.domElement.addEventListener('pointermove', (e) => {
    const tile = pick(e);
    if (!tile) return;
    if (tile[0] !== cursorTile[0] || tile[1] !== cursorTile[1]) setCursor(...tile);
    const u = units.unitAt(...tile);
    const id = u ? u.data.id : null;
    if (id !== hoverId) { hoverId = id; refresh(); }
  });
  renderer.domElement.addEventListener('click', (e) => {
    const tile = pick(e);
    const u = tile && units.unitAt(...tile);
    if (u) { selectedId = u.data.id; refresh(); }
  });

  setCursor(...cursorTile);
  refresh();

  return {
    activeId: () => hoverId || selectedId,
    update(t) {
      const s = 1 + Math.sin(t * 5) * 0.06;
      cursor.scale.set(s, 1, s);
    },
  };
}
