import * as THREE from 'three';
import { W, H, TERRAIN, inBounds, terrainAt, toWorld, tileTop } from './map.js';
import { portraitSVG } from './portraits.js';
import { forecast, resolve, weaponOf } from './combat.js';
import { MOVE_COST, MOVE_TYPE, key, unkey, computeRange } from './rules.js';
import { chooseAction } from './ai.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Overlay palette (hex). Reachable = cyan, attack = warm orange-red, enemy threat = amber.
const COL = { move: 0x5fd4ff, moveEnemy: 0xb48cff, attack: 0xff6a3d, danger: 0xffa13d, grid: 0xf3ead6 };

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

// Each inserted copy of a portrait SVG needs its own ids: duplicate gradient/clip ids resolve
// to the first copy in the document, which breaks when that copy is hidden (display:none).
let svgSeq = 0;
function uniqueIds(svg) {
  const n = ++svgSeq;
  return svg.replace(/id="([^"]+)"/g, `id="$1_${n}"`)
    .replace(/url\(#([^)]+)\)/g, `url(#$1_${n})`)
    .replace(/href="#([^"]+)"/g, `href="#$1_${n}"`);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

export function createUI({ renderer, camera, scene, units, view }) {
  const card = document.getElementById('card');
  const terrainChip = document.getElementById('terrain');
  const roster = document.getElementById('roster');
  const actions = document.getElementById('actions');
  const sheet = document.getElementById('sheet');
  const turnNo = document.getElementById('turn-no');
  const phaseEl = document.getElementById('phase');

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
    selectedId: 'brenna',
    cursorTile: [3, 9],
    mode: 'idle', // 'idle' | 'target'
    targetId: null,
    danger: false,
    sheet: false,
    selectedAt: 0,
    phase: 'player', // 'player' | 'enemy'
    turn: 1,
    busy: false, // an animation or the enemy phase is running: input is ignored
    over: false, // victory or defeat reached
  };
  let range = null;

  const portraits = new Map(units.list.map((u) => [u.data.id, portraitSVG(u.data)]));
  const data = (id) => units.byId.get(id).data;
  const selected = () => (state.selectedId ? data(state.selectedId) : null);
  // A player unit that can still act this turn.
  const canAct = (u) => !!u && u.faction === 'blue' && !u.done && u.hp > 0 && state.phase === 'player' && !state.busy && !state.over;

  // ---------- Panels ----------

  function unitCard(u) {
    const side = u.faction === 'blue' ? 'Ally' : 'Enemy';
    return `
      <div class="face">${uniqueIds(portraits.get(u.id))}</div>
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
    // Ease in only when the subject changes, not on every hover refresh.
    const subject = `${state.mode}:${state.mode === 'target' ? state.hoverId || state.targetId : state.hoverId || state.selectedId}`;
    if (subject !== lastSubject) {
      lastSubject = subject;
      card.classList.remove('enter');
      void card.offsetWidth;
      card.classList.add('enter');
    }
  }
  let lastSubject = '';

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
        <div class="face">${uniqueIds(portraitSVG(u))}</div>
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
      `<button class="btn ${extra}" data-act="${act}" title="${label}" aria-label="${label}"${disabled ? ' disabled' : ''}><span class="ico">${ico}</span><span class="lbl">${label}</span><span class="key">${k}</span></button>`;
    const u = selected();
    let html = '';
    if (state.sheet) html = btn('close', 'Back', '‹', 'Esc');
    else if (state.busy || state.over) html = '';
    else if (state.mode === 'target') {
      html = btn('cancel', 'Cancel', '‹', 'Esc');
      if (state.targetId) html += btn('confirm', 'Attack', '⚔', '↵', 'primary attack');
    } else {
      if (canAct(u)) {
        const n = range ? range.targets.size : 0;
        html += btn('attack', n ? `Attack · ${n}` : 'Attack', '⚔', 'A', 'primary attack', !n);
        html += btn('wait', 'Wait', '⏳', 'W');
      }
      if (u) html += btn('inspect', 'Inspect', 'ⓘ', 'I');
      html += btn('danger', 'Danger zone', '◈', 'D', state.danger ? 'on' : '');
      html += btn('endTurn', 'End turn', '⏭', 'E');
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
      if (o.data.faction !== 'red' || o.data.hp <= 0) continue;
      const rr = computeRange(o.data, units);
      for (const [c, r] of [...rr.move, ...rr.attack]) set.add(key(c, r));
    }
    return [...set].map(unkey);
  }

  function renderOverlays() {
    // Ranges follow the selected unit; with nothing selected, the hovered one (preview).
    const id = state.selectedId || state.hoverId;
    // A unit that has already moved or acted can no longer walk: only its attack reach remains.
    range = id && !state.busy ? computeRange(data(id), units, data(id).moved || data(id).done ? 0 : data(id).mov) : null;
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
    for (const el of roster.children) {
      const d = data(el.dataset.id);
      el.classList.toggle('active', el.dataset.id === state.selectedId);
      el.classList.toggle('done', !!d.done);
      el.classList.toggle('dead', d.hp <= 0);
    }
    turnNo.textContent = state.turn;
    phaseEl.textContent = state.phase === 'player' ? 'Player Phase' : 'Enemy Phase';
    phaseEl.className = `phase ${state.phase === 'player' ? 'blue' : 'red'}`;
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

  // ---------- Turn flow: move, act, enemy phase ----------

  // Floating text over a unit (damage numbers, MISS).
  function pop(text, id, cls = '') {
    const v = units.headPos(id).project(camera);
    const el = document.createElement('div');
    el.className = `pop ${cls}`;
    el.textContent = text;
    el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  // Big centred message; resolves after `ms` (use ms = 0 for one that stays).
  let bannerEl = null;
  async function banner(text, sub = '', ms = 1100) {
    bannerEl?.remove();
    bannerEl = document.createElement('div');
    bannerEl.className = 'banner';
    bannerEl.innerHTML = `<b>${esc(text)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}`;
    document.body.appendChild(bannerEl);
    if (!ms) return;
    await sleep(ms);
    bannerEl.remove();
    bannerEl = null;
  }

  // Victory: the enemy is routed or a player unit holds the keep. Defeat: Brenna or the whole army falls.
  function checkEnd() {
    if (state.over) return true;
    const won = !units.alive('red').length || units.alive('blue').some((u) => terrainAt(u.data.c, u.data.r) === 'K');
    const lost = data('brenna').hp <= 0 || !units.alive('blue').length;
    if (!won && !lost) return false;
    state.over = true;
    state.busy = false;
    state.mode = 'idle';
    refresh();
    banner(won ? 'Victory' : 'Defeat', 'Press R to play again', 0);
    return true;
  }

  // One exchange of blows, animated strike by strike; damage lands as each hit connects.
  async function runCombat(a, d) {
    for (const s of resolve(a, d, [a.c, a.r])) {
      const att = s.by === 'a' ? a : d, def = s.by === 'a' ? d : a;
      await units.lunge(att.id, [def.c, def.r]);
      if (s.hit) {
        def.hp -= s.dmg;
        pop(s.crit ? `${s.dmg}!` : `${s.dmg}`, def.id, s.crit ? 'crit' : '');
        refresh();
        if (s.dmg) await units.shake(def.id);
        if (def.hp <= 0) { await units.die(def.id); refresh(); break; }
      } else {
        pop('MISS', def.id, 'miss');
      }
      await sleep(140);
    }
  }

  async function doMove(u, [c, r]) {
    const path = range.pathTo(c, r);
    if (!path.length) return;
    state.busy = true;
    state.mode = 'idle';
    refresh();
    await units.moveAlong(u.id, path);
    u.moved = true;
    state.busy = false;
    refresh();
  }

  function finish(u) {
    u.done = true;
    u.moved = true;
    state.busy = false;
    state.mode = 'idle';
    state.targetId = null;
    select(null);
    if (checkEnd()) return;
    if (units.alive('blue').every((b) => b.data.done)) enemyPhase();
  }

  async function confirmAttack() {
    const a = selected(), d = state.targetId && data(state.targetId);
    if (!canAct(a) || !d || !range.targets.has(d.id)) return;
    const from = range.targets.get(d.id);
    const path = range.pathTo(...from);
    state.busy = true;
    state.mode = 'idle';
    refresh();
    if (path.length) await units.moveAlong(a.id, path);
    await runCombat(a, d);
    finish(a);
  }

  async function enemyPhase() {
    state.busy = true;
    state.phase = 'enemy';
    state.selectedId = null;
    state.mode = 'idle';
    refresh();
    await banner('Enemy Phase');
    for (const u of units.alive('red')) {
      if (u.data.hp <= 0) continue;
      const act = chooseAction(u.data, units);
      if (act?.path.length) await units.moveAlong(u.data.id, act.path);
      if (act?.attack && act.attack.hp > 0) await runCombat(u.data, act.attack);
      if (checkEnd()) return;
      await sleep(160);
    }
    if (checkEnd()) return;
    state.turn++;
    state.phase = 'player';
    for (const u of units.list) { u.data.done = false; u.data.moved = false; }
    refresh();
    await banner('Player Phase');
    state.busy = false;
    refresh();
  }

  const commands = {
    wait() {
      const u = selected();
      if (canAct(u)) finish(u);
    },
    endTurn() { if (state.phase === 'player' && !state.busy && !state.over) enemyPhase(); },
    confirm() { if (state.mode === 'target') confirmAttack(); },
    attack() {
      const u = selected();
      if (!canAct(u) || !range || !range.targets.size) return;
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
    if (state.over && k === 'r') location.reload();
    else if (state.busy) return;
    else if (k === 'w') commands.wait();
    else if (k === 'e') commands.endTurn();
    else if (k === 'enter') commands.confirm();
    else if (k === 'escape') commands.back();
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
    b.innerHTML = uniqueIds(portraits.get(u.data.id));
    b.addEventListener('mouseenter', () => { state.hoverId = u.data.id; setCursor(u.data.c, u.data.r); refresh(); });
    b.addEventListener('mouseleave', () => { state.hoverId = null; refresh(); });
    b.addEventListener('click', () => {
      if (state.busy) return;
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
    if (state.busy) return;
    const tile = pick(e);
    if (!tile) return;
    setCursor(...tile);
    const u = units.unitAt(...tile);
    if (state.mode === 'target') {
      // First click on a marked enemy shows its forecast; clicking it again attacks.
      if (u && range.targets.has(u.data.id)) {
        if (state.targetId === u.data.id) confirmAttack();
        else { state.targetId = u.data.id; refresh(); }
      }
      return;
    }
    // A free tile inside the selected unit's move range: walk there.
    const s = selected();
    if (!u && canAct(s) && !s.moved && range?.move.some(([c, r]) => c === tile[0] && r === tile[1])) {
      doMove(s, tile);
      return;
    }
    if (e.pointerType === 'touch' || e.pointerType === 'pen') state.hoverId = null;
    select(u ? u.data.id : null);
  });

  setCursor(...state.cursorTile);
  cursor.visible = false;
  // ?select=brenna&act=attack|inspect|danger|grid — reproducible states for screenshots.
  const q = new URLSearchParams(location.search);
  for (const spec of (q.get('place') || '').split(';').filter(Boolean)) { // place=pike_r1:7,6
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
