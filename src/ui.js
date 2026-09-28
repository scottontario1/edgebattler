import * as THREE from 'three';
import { W, H, TERRAIN, inBounds, terrainAt, toWorld, tileTop } from './map.js';
import { portraitSVG } from './portraits.js';
import { forecast, weaponOf } from './combat.js';

const MOVE_COST = {
  foot: { G: 1, R: 1, B: 1, V: 1, C: 1, K: 1, F: 2, M: 3 },
  armor: { G: 1, R: 1, B: 1, V: 1, C: 1, K: 1, F: 2 },
  mounted: { G: 1, R: 1, B: 1, V: 1, C: 1, K: 1, F: 3 },
};
const MOVE_TYPE = { knight: 'armor', warlord: 'armor', cavalier: 'mounted' };
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const key = (c, r) => r * W + c;
const unkey = (k) => [k % W, Math.floor(k / W)];
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

// Overlay palette (hex). Reachable = cyan, attack = warm orange-red, enemy threat = amber.
const COL = { move: 0x5fd4ff, moveEnemy: 0xb48cff, attack: 0xff6a3d, danger: 0xffa13d, grid: 0xf3ead6 };

// Fire Emblem style range: tiles you can reach, tiles you can hit from there, and the
// enemies you could actually strike (from an unoccupied reachable tile).
function computeRange(unit, units) {
  const costs = MOVE_COST[MOVE_TYPE[unit.cls] || 'foot'];
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
  const move = [...best.keys()].map(unkey);
  const [minR, maxR] = weaponOf(unit).rng;
  const attack = new Set();
  const stand = move.filter(([c, r]) => {
    const o = units.unitAt(c, r);
    return !o || o.data === unit;
  });
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
  // For each enemy in reach, the stand tile with the best terrain defence (then closest).
  const targets = new Map();
  for (const o of units.list) {
    if (o.data.faction === unit.faction) continue;
    const pos = [o.data.c, o.data.r];
    const from = stand
      .filter((t) => { const d = dist(t, pos); return d >= minR && d <= maxR; })
      .sort((a, b) => TERRAIN[terrainAt(...b)].def - TERRAIN[terrainAt(...a)].def
        || dist(a, [unit.c, unit.r]) - dist(b, [unit.c, unit.r]))[0];
    if (from) targets.set(o.data.id, from);
  }
  return { move, attack: [...attack].map(unkey), targets };
}

// ---------- Overlay art: crisp canvas-drawn cells so terrain stays visible underneath ----------

function cellTexture(style) {
  const s = 128, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const rr = (inset, rad) => {
    g.beginPath();
    g.roundRect(inset, inset, s - inset * 2, s - inset * 2, rad);
  };
  // Translucent body: low enough that grass, road and water read through.
  rr(6, 14);
  g.fillStyle = `rgba(255,255,255,${style === 'danger' ? 0.16 : 0.24})`;
  g.fill();
  if (style !== 'move') {
    // Diagonal hatching: attack/threat read differently from movement even without colour.
    g.save();
    rr(6, 14);
    g.clip();
    g.strokeStyle = `rgba(255,255,255,${style === 'danger' ? 0.3 : 0.42})`;
    g.lineWidth = style === 'danger' ? 5 : 7;
    for (let x = -s; x < s * 2; x += 22) {
      g.beginPath();
      g.moveTo(x, s);
      g.lineTo(x + s, 0);
      g.stroke();
    }
    g.restore();
  }
  // Inner border = the grid, strongest while a unit is being commanded.
  rr(7, 13);
  g.strokeStyle = `rgba(255,255,255,${style === 'danger' ? 0.55 : 0.9})`;
  g.lineWidth = style === 'danger' ? 3 : 4;
  g.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function overlayMaterial(map, color, opacity) {
  return new THREE.MeshBasicMaterial({
    map, color, transparent: true, opacity, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
}

function cellLayer(scene, style, color, opacity, lift) {
  const geo = new THREE.PlaneGeometry(0.98, 0.98).rotateX(-Math.PI / 2);
  const material = overlayMaterial(cellTexture(style), color, opacity);
  const mesh = new THREE.InstancedMesh(geo, material, W * H);
  mesh.count = 0;
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  scene.add(mesh);
  const m = new THREE.Matrix4();
  return {
    mesh,
    set(tiles) {
      tiles.forEach(([c, r], i) => {
        const p = toWorld(c, r);
        m.makeTranslation(p.x, tileTop(c, r) + lift, p.z);
        mesh.setMatrixAt(i, m);
      });
      mesh.count = tiles.length;
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// Bright outline around the outer boundary of a set of tiles.
function regionOutline(scene, color, lift) {
  const material = new THREE.MeshBasicMaterial({ color, toneMapped: false, depthWrite: false, transparent: true, opacity: 0.95 });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;
  scene.add(mesh);
  const T = 0.035; // line width in world units
  return {
    mesh,
    set(tiles) {
      const inSet = new Set(tiles.map(([c, r]) => key(c, r)));
      const pos = [];
      const quad = (x0, z0, x1, z1, y) => {
        pos.push(x0, y, z0, x0, y, z1, x1, y, z0, x1, y, z0, x0, y, z1, x1, y, z1);
      };
      for (const [c, r] of tiles) {
        const p = toWorld(c, r), y = tileTop(c, r) + lift, h = 0.49;
        if (!inSet.has(key(c, r - 1))) quad(p.x - h, p.z - h, p.x + h, p.z - h + T, y);
        if (!inSet.has(key(c, r + 1))) quad(p.x - h, p.z + h - T, p.x + h, p.z + h, y);
        if (c === 0 || !inSet.has(key(c - 1, r))) quad(p.x - h, p.z - h, p.x - h + T, p.z + h, y);
        if (c === W - 1 || !inSet.has(key(c + 1, r))) quad(p.x + h - T, p.z - h, p.x + h, p.z + h, y);
      }
      mesh.geometry.dispose();
      mesh.geometry = new THREE.BufferGeometry();
      mesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    },
  };
}

// Faint full grid, only on demand (G) — the map reads as continuous land by default.
function gridLines(scene) {
  const pos = [];
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const p = toWorld(c, r), y = tileTop(c, r) + 0.02, h = 0.5;
      pos.push(p.x - h, y, p.z - h, p.x + h, y, p.z - h, p.x - h, y, p.z - h, p.x - h, y, p.z + h);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    color: COL.grid, transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false,
  }));
  lines.renderOrder = 2;
  lines.visible = false;
  scene.add(lines);
  return lines;
}

// Corner brackets. Hover cursor = thin ivory; selection = heavier gold.
function brackets(scene, color, thick, arm) {
  const g = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color, toneMapped: false, depthTest: false, transparent: true });
  const a = new THREE.BoxGeometry(arm, thick, thick * 1.6);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const h = new THREE.Mesh(a, material);
    h.position.set(sx * (0.48 - arm / 2), 0, sz * 0.48);
    const v = new THREE.Mesh(a, material);
    v.rotation.y = Math.PI / 2;
    v.position.set(sx * 0.48, 0, sz * (0.48 - arm / 2));
    g.add(h, v);
  }
  g.renderOrder = 4;
  g.visible = false;
  scene.add(g);
  return g;
}

// Target reticle: ring + four ticks, warm, placed on attackable enemies while targeting.
function reticles(scene) {
  const ring = new THREE.RingGeometry(0.3, 0.345, 40).rotateX(-Math.PI / 2);
  const tick = new THREE.PlaneGeometry(0.05, 0.14).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: COL.attack, toneMapped: false, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const pool = [];
  return {
    set(tiles, focus) {
      while (pool.length < tiles.length) {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(ring, material));
        for (let i = 0; i < 4; i++) {
          const t = new THREE.Mesh(tick, material);
          const a = (i * Math.PI) / 2;
          t.position.set(Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4);
          t.rotation.y = a;
          g.add(t);
        }
        g.renderOrder = 4;
        scene.add(g);
        pool.push(g);
      }
      pool.forEach((g, i) => {
        g.visible = i < tiles.length;
        if (!g.visible) return;
        const [c, r] = tiles[i], p = toWorld(c, r);
        g.position.set(p.x, tileTop(c, r) + 0.04, p.z);
        g.userData.focus = focus && focus[0] === c && focus[1] === r;
      });
    },
    update(t) {
      for (const g of pool) {
        if (!g.visible) continue;
        g.rotation.y = t * 0.8;
        const s = g.userData.focus ? 1.12 + Math.sin(t * 6) * 0.05 : 0.95;
        g.scale.set(s, 1, s);
      }
    },
  };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

export function createUI({ renderer, camera, scene, units, view }) {
  const card = document.getElementById('card');
  const terrainChip = document.getElementById('terrain');
  const roster = document.getElementById('roster');
  const actions = document.getElementById('actions');
  const sheet = document.getElementById('sheet');

  const layers = {
    danger: cellLayer(scene, 'danger', COL.danger, 0.45, 0.012),
    move: cellLayer(scene, 'move', COL.move, 0.85, 0.016),
    attack: cellLayer(scene, 'attack', COL.attack, 0.85, 0.016),
  };
  const moveEdge = regionOutline(scene, COL.move, 0.02);
  const dangerEdge = regionOutline(scene, COL.danger, 0.018);
  const grid = gridLines(scene);
  const cursor = brackets(scene, 0xf3ead6, 0.022, 0.2);
  const selMark = brackets(scene, 0xf2cf6b, 0.04, 0.26);
  const marks = reticles(scene);

  const state = {
    hoverId: null,
    selectedId: 'aldric',
    cursorTile: [3, 9],
    mode: 'idle', // 'idle' | 'target'
    targetId: null,
    danger: false,
    sheet: false,
    selectedAt: 0,
  };
  let range = null;

  const portraits = new Map(units.list.map((u) => [u.data.id, portraitSVG(u.data)]));
  const data = (id) => units.byId.get(id).data;
  const selected = () => (state.selectedId ? data(state.selectedId) : null);

  // ---------- Panels ----------

  function unitCard(u) {
    const side = u.faction === 'blue' ? 'Ally' : 'Enemy';
    return `
      <div class="face">${portraits.get(u.id)}</div>
      <div class="info">
        <div class="name-row"><span class="name">${esc(u.name)}</span>${u.boss ? '<span class="tag boss">BOSS</span>' : ''}<span class="tag side">${side}</span></div>
        <div class="cls">${esc(u.title)} · Lv ${u.lv}</div>
        <div class="hp"><span>HP</span><div class="bar"><i style="width:${(u.hp / u.maxHp) * 100}%"></i></div><b>${u.hp}/${u.maxHp}</b></div>
        <div class="facts"><span>MOV <b>${u.mov}</b></span><span>⚔ <b>${esc(u.weapon)}</b></span></div>
      </div>`;
  }

  function forecastCard(a, d) {
    const f = forecast(a, d, range.targets.get(d.id));
    const val = (s, cls = '') => (s.can
      ? `<div class="v ${cls}">${s.dmg}${s.double ? '<small>×2</small>' : ''}</div>`
      : `<div class="v none ${cls}">–</div>`);
    const pct = (s, k, cls = '') => `<div class="v ${cls}${s.can ? '' : ' none'}">${s.can ? s[k] : '–'}</div>`;
    const after = (hp, s) => Math.max(0, hp - (s.can ? s.dmg * (s.double ? 2 : 1) : 0));
    const hpBar = (u, s, cls) => {
      const left = after(u.hp, s);
      const n = left === u.hp ? `${u.hp}` : `${u.hp}<span>→</span>${left}`;
      return `<div class="fc-hp ${cls}"><div class="bar"><em style="width:${(u.hp / u.maxHp) * 100}%"></em><i style="width:${(left / u.maxHp) * 100}%"></i></div><b>${n}</b></div>`;
    };
    const tri = f.atk.tri > 0 ? 'Weapon advantage' : f.atk.tri < 0 ? 'Weapon disadvantage' : '';
    const counter = f.def.can ? '' : `${esc(d.name)} can't counter at range ${f.dist}`;
    const terr = TERRAIN[terrainAt(d.c, d.r)];
    return `
      <div class="eyebrow">Combat forecast</div>
      <div class="fc-grid">
        <div class="fc-name blue">${esc(a.name)}</div><div></div><div class="fc-name red">${esc(d.name)}</div>
        ${hpBar(a, f.def, 'b')}<div class="l">HP</div>${hpBar(d, f.atk, 'r')}
        ${val(f.atk)}<div class="l">DMG</div>${val(f.def, 'r')}
        ${pct(f.atk, 'hit')}<div class="l">HIT</div>${pct(f.def, 'hit', 'r')}
        ${pct(f.atk, 'crit')}<div class="l">CRIT</div>${pct(f.def, 'crit', 'r')}
      </div>
      <div class="fc-note">${[tri, counter, terr.def || terr.avo ? `${terr.name}: <b>+${terr.def} DEF +${terr.avo} AVO</b>` : ''].filter(Boolean).join(' · ') || `${esc(a.weapon)} vs ${esc(d.weapon)}`}</div>`;
  }

  function renderCard() {
    let html = '', cls = '';
    if (state.mode === 'target') {
      const tId = state.hoverId && range.targets.has(state.hoverId) ? state.hoverId : state.targetId;
      if (tId) { html = forecastCard(selected(), data(tId)); cls = 'panel forecast'; }
      else {
        html = `<div class="eyebrow">Choose a target</div><div class="fc-note">${range.targets.size} ${range.targets.size === 1 ? 'enemy' : 'enemies'} in reach · hover or tap a marked enemy</div>`;
        cls = 'panel forecast';
      }
    } else {
      const id = state.hoverId || state.selectedId;
      if (id) { const u = data(id); html = unitCard(u); cls = `panel card ${u.faction}`; }
    }
    card.hidden = !html || state.sheet;
    card.className = cls;
    card.innerHTML = html;
  }

  function renderSheet() {
    sheet.hidden = !state.sheet;
    if (!state.sheet) return;
    const u = selected();
    const w = weaponOf(u), t = TERRAIN[terrainAt(u.c, u.r)];
    const stat = (label, v) => `<div class="stat"><span>${label}</span><b>${v}</b></div>`;
    const moveType = { armor: 'Armored', mounted: 'Mounted', foot: 'Foot' }[MOVE_TYPE[u.cls] || 'foot'];
    sheet.className = `panel sheet ${u.faction}`;
    sheet.innerHTML = `
      <button class="btn close" data-act="close" aria-label="Close">×</button>
      <div class="top">
        <div class="face">${portraitSVG(u)}</div>
        <div class="info">
          <div class="eyebrow">${u.faction === 'blue' ? 'Ally' : 'Enemy'}${u.boss ? ' · Boss' : ''}</div>
          <div class="name">${esc(u.name)}</div>
          <div class="cls">${esc(u.title)} · Lv ${u.lv} · ${moveType}</div>
          <div class="hp"><span>HP</span><div class="bar"><i style="width:${(u.hp / u.maxHp) * 100}%"></i></div><b>${u.hp}/${u.maxHp}</b></div>
          <div class="facts"><span>MOV <b>${u.mov}</b></span><span>On <b>${t.name}</b></span></div>
        </div>
      </div>
      <div class="stats">
        ${stat('Str', u.str)}${stat('Mag', u.mag)}${stat('Skl', u.skl)}${stat('Spd', u.spd)}
        ${stat('Def', u.def)}${stat('Res', u.res)}${stat('Ter Def', `+${t.def}`)}${stat('Ter Avo', `+${t.avo}`)}
      </div>
      <div class="weapon-row"><span>⚔ <b>${esc(u.weapon)}</b></span><span>Mt <b>${w.mt}</b> · Hit <b>${w.hit}</b> · Crt <b>${w.crit}</b> · Rng <b>${w.rng[0] === w.rng[1] ? w.rng[0] : w.rng.join('–')}</b></span></div>`;
  }

  function renderActions() {
    const btn = (act, label, ico, k, extra = '', disabled = false) =>
      `<button class="btn ${extra}" data-act="${act}"${disabled ? ' disabled' : ''}><span class="ico">${ico}</span>${label}<span class="key">${k}</span></button>`;
    const u = selected();
    let html = '';
    if (state.sheet) html = btn('close', 'Back', '‹', 'Esc');
    else if (state.mode === 'target') html = btn('cancel', 'Cancel', '‹', 'Esc');
    else {
      if (u && u.faction === 'blue') {
        const n = range ? range.targets.size : 0;
        html += btn('attack', n ? `Attack · ${n}` : 'Attack', '⚔', 'A', 'primary attack', !n);
      }
      if (u) html += btn('inspect', 'Inspect', 'ⓘ', 'I');
      html += btn('danger', 'Danger zone', '◈', 'D', state.danger ? 'on' : '');
    }
    actions.innerHTML = html;
  }

  function showTerrain(c, r) {
    const t = TERRAIN[terrainAt(c, r)];
    const cost = MOVE_COST.foot[terrainAt(c, r)];
    terrainChip.innerHTML = `<span class="tname">${t.name}</span>`
      + (cost === undefined ? '<span class="blocked">Impassable</span>'
        : `<span>DEF <b>+${t.def}</b></span><span>AVO <b>+${t.avo}</b></span>${cost > 1 ? `<span>Move <b>×${cost}</b></span>` : ''}`);
  }

  // ---------- Overlays ----------

  function dangerTiles() {
    const set = new Set();
    for (const o of units.list) {
      if (o.data.faction !== 'red') continue;
      const rr = computeRange(o.data, units);
      for (const [c, r] of [...rr.move, ...rr.attack]) set.add(key(c, r));
    }
    return [...set].map(unkey);
  }

  function renderOverlays() {
    // Ranges follow the selected unit; with nothing selected, the hovered one (preview).
    const id = state.selectedId || state.hoverId;
    range = id ? computeRange(data(id), units) : null;
    const u = id ? data(id) : null;
    layers.move.set(range ? range.move : []);
    layers.move.mesh.material.color.set(u && u.faction === 'red' ? COL.moveEnemy : COL.move);
    moveEdge.set(range && state.mode !== 'target' ? range.move : []);
    moveEdge.mesh.material.color.set(u && u.faction === 'red' ? COL.moveEnemy : COL.move);
    layers.attack.set(range ? range.attack : []);
    layers.move.mesh.material.opacity = state.mode === 'target' ? 0.35 : 0.85;
    const d = state.danger ? dangerTiles() : [];
    layers.danger.set(d);
    dangerEdge.set(d);
    const tiles = state.mode === 'target' ? [...range.targets.keys()].map((t) => [data(t).c, data(t).r]) : [];
    const focusId = state.hoverId && range && range.targets.has(state.hoverId) ? state.hoverId : state.targetId;
    marks.set(tiles, focusId ? [data(focusId).c, data(focusId).r] : null);
    const s = selected();
    selMark.visible = !!s;
    if (s) {
      const p = toWorld(s.c, s.r);
      selMark.position.set(p.x, tileTop(s.c, s.r) + 0.03, p.z);
    }
  }

  function refresh() {
    renderOverlays();
    renderCard();
    renderSheet();
    renderActions();
    for (const el of roster.children) el.classList.toggle('active', el.dataset.id === state.selectedId);
  }

  // ---------- Commands ----------

  function select(id) {
    if (state.selectedId !== id) state.selectedAt = performance.now();
    state.selectedId = id;
    state.mode = 'idle';
    state.targetId = null;
    if (!id) state.sheet = false;
    refresh();
  }

  const commands = {
    attack() {
      const u = selected();
      if (!u || u.faction !== 'blue' || !range || !range.targets.size) return;
      state.mode = 'target';
      state.targetId = range.targets.size === 1 ? [...range.targets.keys()][0] : null;
      refresh();
    },
    inspect() { if (selected()) { state.sheet = true; refresh(); } },
    close() { state.sheet = false; refresh(); },
    cancel() { state.mode = 'idle'; state.targetId = null; refresh(); },
    danger() { state.danger = !state.danger; refresh(); },
    grid() { grid.visible = !grid.visible; },
    back() {
      if (state.sheet) commands.close();
      else if (state.mode === 'target') commands.cancel();
      else if (state.selectedId) select(null);
    },
  };

  const onAction = (e) => {
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) commands[b.dataset.act]();
  };
  actions.addEventListener('click', onAction);
  sheet.addEventListener('click', onAction);

  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') commands.back();
    else if (k === 'a') commands.attack();
    else if (k === 'i') (state.sheet ? commands.close : commands.inspect)();
    else if (k === 'd') commands.danger();
    else if (k === 'g') commands.grid();
  });

  function setCursor(c, r) {
    state.cursorTile = [c, r];
    const p = toWorld(c, r);
    cursor.position.set(p.x, tileTop(c, r) + 0.03, p.z);
    cursor.visible = true;
    showTerrain(c, r);
  }

  for (const u of units.list) {
    const b = document.createElement('button');
    b.className = `mini ${u.data.faction}`;
    b.dataset.id = u.data.id;
    b.title = `${u.data.name}, ${u.data.title}`;
    b.setAttribute('aria-label', b.title);
    b.innerHTML = portraits.get(u.data.id);
    b.addEventListener('mouseenter', () => { state.hoverId = u.data.id; setCursor(u.data.c, u.data.r); refresh(); });
    b.addEventListener('mouseleave', () => { state.hoverId = null; refresh(); });
    b.addEventListener('click', () => {
      if (state.mode === 'target' && range.targets.has(u.data.id)) { state.targetId = u.data.id; refresh(); return; }
      select(u.data.id);
    });
    roster.appendChild(b);
  }

  // ---------- Picking ----------

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

  const canvas = renderer.domElement;
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || view.isDragging()) return; // touch has no hover
    const tile = pick(e);
    if (!tile) return;
    if (tile[0] !== state.cursorTile[0] || tile[1] !== state.cursorTile[1]) setCursor(...tile);
    const u = units.unitAt(...tile);
    const id = u ? u.data.id : null;
    if (id !== state.hoverId) { state.hoverId = id; refresh(); }
  });
  canvas.addEventListener('pointerleave', () => {
    if (state.hoverId) { state.hoverId = null; refresh(); }
    cursor.visible = false;
  });
  canvas.addEventListener('click', (e) => {
    if (view.consumeDrag()) return; // that press was a pan
    const tile = pick(e);
    if (!tile) return;
    setCursor(...tile);
    const u = units.unitAt(...tile);
    if (state.mode === 'target') {
      if (u && range.targets.has(u.data.id)) { state.targetId = u.data.id; refresh(); }
      return;
    }
    if (e.pointerType === 'touch' || e.pointerType === 'pen') state.hoverId = null;
    select(u ? u.data.id : null);
  });

  setCursor(...state.cursorTile);
  cursor.visible = false;
  // ?select=garrick&act=attack|inspect|danger|grid — reproducible states for screenshots.
  const q = new URLSearchParams(location.search);
  for (const spec of (q.get('place') || '').split(';').filter(Boolean)) { // place=grisk:7,6
    const [id, at] = spec.split(':'), u = units.byId.get(id);
    if (!u || !at) continue;
    [u.data.c, u.data.r] = at.split(',').map(Number);
    const p = toWorld(u.data.c, u.data.r);
    u.group.position.set(p.x, tileTop(u.data.c, u.data.r), p.z);
  }
  if (q.has('select')) state.selectedId = q.get('select') || null;
  refresh();
  for (const a of (q.get('act') || '').split(',').filter((x) => commands[x])) commands[a]();
  if (q.has('target') && state.mode === 'target') { state.targetId = q.get('target'); refresh(); }

  return {
    activeId: () => state.hoverId || state.selectedId,
    update(t) {
      const s = 1 + Math.sin(t * 5) * 0.04;
      cursor.scale.set(s, 1, s);
      // Selection snaps in from 1.35x over ~180 ms, then breathes gently.
      const k = Math.min(1, (performance.now() - state.selectedAt) / 180);
      const sel = 1 + (1 - k) * 0.35 + Math.sin(t * 3) * 0.025;
      selMark.scale.set(sel, 1, sel);
      marks.update(t);
    },
  };
}
