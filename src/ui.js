import * as THREE from 'three';
import { W, H, LAYOUT, TERRAIN, inBounds, terrainAt, toWorld, tileTop } from './map.js';
import { portraitSVG } from './portraits.js';
import { forecast, resolve, weaponOf } from './combat.js';
import { MOVE_COST, MOVE_TYPE, key, unkey, computeRange } from './rules.js';
import { CARD_LIMITS, UNIT_CARDS, SPELL_CARDS, SKILL_CARDS, createCardState, drawOpeningHand, refreshRound, canAfford, recruitUnit, canDeployReserve, seededRandom } from './cards.js';
import { advanceAbilityRound, initializeAbilityState, queueSpell, cancelSpell, resolveAbilityActivation, resolveQueuedSpells, equipTypeSkill, transferTypeSkill, skillsForUnitType } from './abilities.js';
import { findUpgradeMatches, previewUpgrade, combineUnits } from './upgrades.js';
import { resolveBattleRound } from './battle.js';
import { createEnemyCards, refreshEnemyCards, planEnemyReinforcements } from './enemy.js';
import { createRecruitUnit, createHeroRespawnData } from './units.js';
import { esc } from './ui/util.js';
import { handHTML, reservesHTML, detailHTML, loadoutsHTML } from './ui/hand.js';
import { trayHTML, applyTrayState } from './ui/tray.js';
import { queuedHTML, upgradePromptsHTML, upgradeChoiceHTML } from './ui/upgrade.js';
import { unitCardHTML, forecastHTML, targetPromptHTML, sheetHTML, terrainChipHTML, rosterMiniHTML, decorateRoster } from './ui/unitpanels.js';
import { createFeed } from './ui/feed.js';
import { createPlates } from './ui/plates.js';
import './ui/tray.css';
import './ui/hand.css';
import './ui/upgrade.css';
import './ui/unitpanels.css';
import './ui/feed.css';

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

export function createUI({ renderer, camera, scene, units, view }) {
  const card = document.getElementById('card');
  const terrainChip = document.getElementById('terrain');
  const roster = document.getElementById('roster');
  const actions = document.getElementById('actions');
  const planning = document.getElementById('planning');
  const sheet = document.getElementById('sheet');
  const turnNo = document.getElementById('turn-no');
  const phaseEl = document.getElementById('phase');
  const HERO_RESPAWN_DELAY = 2; // A lost planning/battle cycle, then return at the next planning stage.
  const HERO_RESPAWN_COST = 1; // Explicit prototype default; tune after match pacing tests.

  const feed = createFeed({ camera, units, phaseEl, turnEl: turnNo });
  const { pop, banner } = feed;

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
    heroRespawnAt: null,
    selectedCardId: null,
    selectedSkillType: 'pikeman',
    skillTransferTargets: {},
    selectedReserveId: null,
    upgradeChoice: null,
    queuedSpellCards: {},
    // Short landscape (phone on its side) has no room for an open tray: start collapsed, one tap opens it.
    trayCollapsed: matchMedia('(max-height: 500px) and (min-aspect-ratio: 1/1) and (min-width: 561px)').matches,
    notice: '',
  };
  let cardState = createCardState({ population: units.alive('blue').length });
  let skillLoadouts = {};
  const cardRng = seededRandom(0x415348);
  cardState = drawOpeningHand(cardState, cardRng).state;
  const territory = new Map();
  for (let r = 0; r < H; r += 1) for (let c = 0; c < W; c += 1) {
    const tile = LAYOUT[r][c];
    if (tile === 'C') territory.set(`${c},${r}`, 'blue');
    else if (tile === 'K') territory.set(`${c},${r}`, 'red');
    else if (tile === 'V') territory.set(`${c},${r}`, null);
  }
  let range = null;
  const plates = createPlates({ camera, scene, units, territory, container: document.querySelector('.hud') });

  const portraits = new Map(units.list.map((u) => [u.data.id, portraitSVG(u.data)]));
  const data = (id) => units.byId.get(id).data;
  const selected = () => (state.selectedId ? data(state.selectedId) : null);
  // A player unit that can still act this turn.
  const canAct = (u) => !!u && u.faction === 'blue' && u.hp > 0 && state.phase === 'player' && !state.busy && !state.over;

  for (const { data: unit } of units.list) {
    Object.assign(unit, initializeAbilityState(unit, {
      stance: UNIT_CARDS[unit.cls]?.defaultStance || unit.stance || (unit.cls === 'archer' ? 'hold' : 'advance'),
      abilityOrder: unit.abilityOrder || (unit.cls === 'pikeman' ? ['rally'] : []),
    }));
    unit.state = 'field';
    unit.population = unit.population ?? (unit.boss ? 2 : 1);
    unit.planningMoved = false;
  }

  // ---------- Panels ----------

  const unitCard = (u) => unitCardHTML(u, { portrait: portraits.get(u.id) });

  function forecastCard(a, d) {
    const f = forecast(a, d, range.targets.get(d.id));
    return forecastHTML({ a, d, f, terrain: TERRAIN[terrainAt(d.c, d.r)] });
  }

  function armyRecords() {
    const reserves = cardState.reserves.map((reserve) => {
      const template = createRecruitUnit(reserve.unitId, reserve.id, 'blue', 0, 0);
      const record = { ...template, ...reserve,
        hp: reserve.hp ?? template.hp,
        maxHp: reserve.maxHp ?? template.maxHp,
        energy: reserve.energy ?? 0,
        maxEnergy: reserve.maxEnergy ?? template.maxEnergy,
        cooldowns: reserve.cooldowns ?? {},
        statuses: reserve.statuses ?? {},
        abilityOrder: reserve.abilityOrder ?? template.abilityOrder,
        stance: reserve.stance ?? template.stance,
        state: 'reserve' };
      delete record.c;
      delete record.r;
      return record;
    });
    return [...reserves, ...units.alive('blue').map((entry) => entry.data)];
  }

  function renderPlanning() {
    const selectedCard = cardState.hand.find((item) => item.instanceId === state.selectedCardId);
    const affordable = (cost) => canAfford(cardState, cost);
    const queued = (cardState.queuedSpells || []).map((cast) => {
      const spell = SPELL_CARDS[cast.spellId];
      return {
        queueId: cast.queueId,
        spellName: spell?.name || cast.spellId,
        targetText: cast.target.unitId ? (units.byId.get(cast.target.unitId)?.data.name || 'unit') : `tile ${cast.target.x}, ${cast.target.y}`,
      };
    });
    const groups = findUpgradeMatches(armyRecords()).map((ids) => {
      const first = armyRecords().find((item) => item.id === ids[0]);
      return { ids, label: UNIT_CARDS[first?.unitId || first?.cls]?.name || 'matching units' };
    });
    let choice = null;
    if (state.upgradeChoice) {
      const chosen = armyRecords().filter((unit) => state.upgradeChoice.ids.includes(unit.id));
      const upgradePreview = previewUpgrade(armyRecords(), state.upgradeChoice.ids, state.upgradeChoice);
      choice = {
        survivorId: state.upgradeChoice.survivorId,
        destination: state.upgradeChoice.destination,
        options: chosen.map((unit) => ({ id: unit.id, name: unit.name })),
        canReserve: chosen.some((unit) => unit.state === 'reserve'),
        canField: chosen.some((unit) => unit.state !== 'reserve'),
        records: chosen,
        preview: upgradePreview,
        ok: upgradePreview.ok,
        summary: upgradePreview.ok ? `${upgradePreview.stars.to}★ · HP ${upgradePreview.unit.hp}/${upgradePreview.unit.maxHp} · STR ${upgradePreview.unit.str} · Population ${upgradePreview.population.before} → ${upgradePreview.population.after}` : upgradePreview.reason,
      };
    }
    const controlledCount = [...territory.values()].filter((owner) => owner === 'blue').length;
    const prompt = state.notice || (state.selectedReserveId ? 'Choose an open tile by your keep or a captured village.'
      : selectedCard?.type === 'spell' ? 'Select this spell, then choose a legal battlefield target.'
        : selectedCard?.type === 'skill' ? 'Choose a unit type to equip this transferable skill for all its units.'
        : state.upgradeChoice ? 'Choose the surviving copy and destination, then confirm.'
          : 'Select a card to recruit or prepare a spell.');
    const m = {
      supply: cardState.supply, population: cardState.population, populationCap: CARD_LIMITS.populationCap,
      reserveCount: cardState.reserves.length, reserveCapacity: CARD_LIMITS.reserveCapacity,
      locations: controlledCount, prompt, phase: state.phase, collapsed: state.trayCollapsed,
      hand: handHTML({
        hand: cardState.hand, selectedCardId: state.selectedCardId, canAfford: affordable,
        portraitFor: (item) => portraitSVG(units.list.find((entry) => entry.data.cls === item.unitId)?.data || createRecruitUnit(item.unitId, `preview-${item.unitId}`, 'blue', 0, 0)),
      }),
      reserves: reservesHTML({ reserves: cardState.reserves, selectedReserveId: state.selectedReserveId, definitions: UNIT_CARDS }),
      detail: detailHTML({ selectedCard, selectedSkillType: state.selectedSkillType, skillLoadouts, canAfford: affordable }),
      queued: queuedHTML({ queued }),
      upgrades: upgradePromptsHTML({ groups }),
      choice: upgradeChoiceHTML({ choice }),
      loadouts: loadoutsHTML({ skillLoadouts, skillTransferTargets: state.skillTransferTargets }),
    };
    planning.innerHTML = trayHTML(m);
    applyTrayState(planning, m);
  }

  function renderCard() {
    let html = '', cls = '';
    if (state.mode === 'target') {
      const tId = state.hoverId && range.targets.has(state.hoverId) ? state.hoverId : state.targetId;
      if (tId) { html = forecastCard(selected(), data(tId)); cls = 'panel forecast'; }
      else {
        html = targetPromptHTML(range.targets.size);
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
    sheet.className = `panel sheet ${u.faction}`;
    sheet.innerHTML = sheetHTML(u, {
      portrait: portraitSVG(u), weapon: weaponOf(u), terrain: TERRAIN[terrainAt(u.c, u.r)],
      moveType: { armor: 'Armored', mounted: 'Mounted', foot: 'Foot' }[MOVE_TYPE[u.cls] || 'foot'],
    });
  }

  function renderActions() {
    const btn = (act, label, ico, k, extra = '', disabled = false) =>
      `<button class="btn ${extra}" data-act="${act}" title="${label}" aria-label="${label}"${disabled ? ' disabled' : ''}><span class="ico">${ico}</span><span class="lbl">${label}</span><span class="key">${k}</span></button>`;
    const u = selected();
    let html = '';
    if (state.over) html = btn('restart', 'Restart match', '↻', 'R', 'primary');
    else if (state.sheet) html = btn('close', 'Back', '‹', 'Esc');
    else if (state.busy) html = '';
    else if (state.mode === 'target') {
      html = btn('cancel', 'Cancel', '‹', 'Esc');
      if (state.targetId) html += btn('confirm', 'Attack', '⚔', '↵', 'primary attack');
    } else if (state.selectedReserveId) {
      html = btn('cancelDeploy', 'Cancel deploy', '‹', 'Esc');
    } else if (state.mode === 'spellTarget') {
      html = btn('cancelCard', 'Cancel card', '‹', 'Esc');
    } else if (state.selectedCardId) {
      const card = cardState.hand.find((item) => item.instanceId === state.selectedCardId);
      if (card?.type === 'unit') html += btn('recruit', `Recruit · ${card.cost}`, '✚', '↵', 'primary', !canAfford(cardState, card.cost));
      if (card?.type === 'spell') html += btn('targetSpell', 'Choose target', '✧', '↵', 'primary');
      html += btn('cancelCard', 'Clear card', '‹', 'Esc');
    } else {
      if (u) html += btn('inspect', 'Inspect', 'ⓘ', 'I');
      if (u?.faction === 'blue') html += btn('stance', `Stance · ${u.stance || 'advance'}`, '⚑', 'S');
      html += btn('danger', 'Danger zone', '◈', 'D', state.danger ? 'on' : '');
      html += btn('resolve', 'Resolve battle', '⚔', '↵', 'primary');
    }
    actions.innerHTML = html;
  }

  function showTerrain(c, r) {
    terrainChip.innerHTML = terrainChipHTML({ terrain: TERRAIN[terrainAt(c, r)], cost: MOVE_COST.foot[terrainAt(c, r)] });
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
    if (state.mode === 'spellTarget') {
      const card = cardState.hand.find((item) => item.instanceId === state.selectedCardId);
      let preview = [];
      if (card?.id === 'spell-fireburst') {
        for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
          const c = state.cursorTile[0] + dc, r = state.cursorTile[1] + dr;
          if (inBounds(c, r) && Math.abs(dc) + Math.abs(dr) <= 1) preview.push([c, r]);
        }
      } else preview = units.alive('blue').map((entry) => [entry.data.c, entry.data.r]);
      layers.move.set(preview);
      moveEdge.set(preview);
      layers.attack.set([]);
      marks.set(preview, null);
      selMark.visible = false;
      return;
    }
    if (state.selectedReserveId && state.mode === 'deploy') {
      const legal = deploymentOptions();
      layers.move.set(legal);
      moveEdge.set(legal);
      layers.attack.set([]);
      marks.set([], null);
      selMark.visible = false;
      return;
    }
    // Ranges follow the selected unit; with nothing selected, the hovered one (preview).
    const id = state.selectedId || state.hoverId;
    // A unit that has already moved or acted can no longer walk: only its attack reach remains.
    range = id && !state.busy ? computeRange(data(id), units, data(id).planningMoved ? 0 : data(id).mov) : null;
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
    renderPlanning();
    renderActions();
    for (const el of [...roster.children]) if (!units.byId.has(el.dataset.id)) el.remove();
    for (const entry of units.list) if (!roster.querySelector(`[data-id="${CSS.escape(entry.data.id)}"]`)) addRosterUnit(entry.data);
    for (const el of roster.children) {
      if (!units.byId.has(el.dataset.id)) continue;
      decorateRoster(el, data(el.dataset.id), { active: el.dataset.id === state.selectedId });
    }
    feed.sync({ phase: state.phase, turn: state.turn, notice: state.notice, busy: state.busy, over: state.over });
    plates.sync(state);
  }

  function addRosterUnit(unit) {
    portraits.set(unit.id, portraitSVG(unit));
    const b = document.createElement('button');
    b.className = `mini ${unit.faction}`;
    b.dataset.id = unit.id;
    b.title = `${unit.name}, ${unit.title}`;
    b.setAttribute('aria-label', b.title);
    b.innerHTML = rosterMiniHTML(unit, portraits.get(unit.id));
    b.addEventListener('mouseenter', () => { state.hoverId = unit.id; setCursor(unit.c, unit.r); refresh(); });
    b.addEventListener('mouseleave', () => { state.hoverId = null; refresh(); });
    b.addEventListener('click', () => {
      if (state.busy) return;
      if (state.mode === 'spellTarget' && unit.faction === 'blue') { queueSelectedSpell(unit.c, unit.r, unit); return; }
      select(unit.id);
    });
    roster.appendChild(b);
  }

  // ---------- Commands ----------

  function select(id) {
    if (state.selectedId !== id) state.selectedAt = performance.now();
    state.selectedId = id;
    if (id && state.selectedCardId) state.selectedCardId = null;
    if (id && state.selectedReserveId) state.selectedReserveId = null;
    state.mode = 'idle';
    state.targetId = null;
    if (!id) state.sheet = false;
    refresh();
  }

  // ---------- Planning, automatic resolution, and persistent match state ----------

  // Victory comes from occupying the enemy keep; ordinary and hero deaths persist.
  function checkEnd() {
    if (state.over) return true;
    const winner = units.alive('blue').some((u) => terrainAt(u.data.c, u.data.r) === 'K');
    const lost = !units.alive('blue').length && !cardState.reserves.length && state.heroRespawnAt === null;
    if (!winner && !lost) return false;
    state.over = true;
    state.busy = false;
    state.mode = 'idle';
    refresh();
    banner(winner ? 'Victory' : 'Defeat', winner ? 'The enemy keep has fallen' : 'Your army has fallen', 0);
    return true;
  }

  const deploymentTiles = () => {
    const out = [];
    for (const [location, owner] of territory) {
      if (owner !== 'blue') continue;
      const [c, r] = location.split(',').map(Number);
      out.push([c, r]);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inBounds(c + dc, r + dr)) out.push([c + dc, r + dr]);
    }
    return [...new Map(out.map(([c, r]) => [`${c},${r}`, [c, r]])).values()];
  };

  function canDeployAt(reserveId, c, r) {
    const reserve = cardState.reserves.find((unit) => unit.id === reserveId);
    const moveType = MOVE_TYPE[reserve?.unitId] || 'foot';
    return canDeployReserve(cardState, reserveId, {
      location: deploymentTiles().some(([x, y]) => x === c && y === r),
      tile: { occupied: !!units.unitAt(c, r), traversable: MOVE_COST[moveType][terrainAt(c, r)] !== undefined, terrain: terrainAt(c, r) === 'W' ? 'water' : terrainAt(c, r) },
    });
  }

  function deploymentOptions() {
    return deploymentTiles().filter(([c, r]) => canDeployAt(state.selectedReserveId, c, r).ok);
  }

  function tryHeroRespawn() {
    if (state.heroRespawnAt === null || state.turn < state.heroRespawnAt) return false;
    if (cardState.supply < HERO_RESPAWN_COST) {
      state.notice = `Brenna returns in round ${state.turn}, but needs ${HERO_RESPAWN_COST} Supply.`;
      return false;
    }
    const tile = deploymentTiles().find(([c, r]) => !units.unitAt(c, r) && MOVE_COST.armor[terrainAt(c, r)] !== undefined);
    if (!tile) {
      state.notice = 'Brenna is ready to return, but the base deployment tiles are occupied.';
      return false;
    }
    if (units.byId.has('brenna')) units.removeUnit('brenna');
    const hero = createHeroRespawnData('brenna', tile[0], tile[1]);
    Object.assign(hero, initializeAbilityState(hero));
    units.addUnit(hero);
    cardState.supply -= HERO_RESPAWN_COST;
    cardState.population += hero.population;
    state.heroRespawnAt = null;
    state.notice = `Brenna returned at the base for ${HERO_RESPAWN_COST} Supply.`;
    return true;
  }

  async function doPlanMove(unit, tile) {
    if (!canAct(unit) || unit.planningMoved) return;
    const moveRange = computeRange(unit, units, unit.mov);
    const path = moveRange.pathTo(tile[0], tile[1]);
    if (!path.length) return;
    state.busy = true;
    refresh();
    await units.moveAlong(unit.id, path);
    unit.planningMoved = true;
    state.busy = false;
    refresh();
  }

  // ---------- Enemy commander: recruits and deploys under the same card rules ----------
  let enemy = null;
  let enemySeq = 0;
  const redPopulation = () => units.alive('red').reduce((sum, entry) => sum + (entry.data.population || 1), 0);

  function enemyDeploymentTiles() {
    const out = new Map();
    for (const [location, owner] of territory) {
      if (owner !== 'red') continue;
      const [c, r] = location.split(',').map(Number);
      for (const [dc, dr] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (inBounds(c + dc, r + dr)) out.set(`${c + dc},${r + dr}`, [c + dc, r + dr]);
    }
    return [...out.values()];
  }

  /** Grant the enemy its round's Supply and cards (after round 1), then recruit and deploy. Returns a notice or ''. */
  function planEnemy(first = false) {
    enemy = first ? createEnemyCards({ population: redPopulation() }) : refreshEnemyCards(enemy, redPopulation());
    const foes = units.alive('blue').map((entry) => entry.data);
    const plan = planEnemyReinforcements(enemy, {
      tiles: enemyDeploymentTiles(),
      canStand: (unitId, c, r) => !units.unitAt(c, r) && MOVE_COST[MOVE_TYPE[unitId] || 'foot'][terrainAt(c, r)] !== undefined,
      threat: (c, r) => foes.reduce((best, f) => Math.min(best, Math.abs(f.c - c) + Math.abs(f.r - r)), 99),
    });
    enemy = plan.enemy;
    for (const d of plan.deployments) {
      enemySeq += 1;
      const unit = createRecruitUnit(d.unitId, `enemy-${enemySeq}-${d.unitId}`, 'red', d.c, d.r);
      Object.assign(unit, initializeAbilityState(unit, { stance: UNIT_CARDS[d.unitId]?.defaultStance }));
      unit.state = 'field';
      unit.planningMoved = false;
      units.addUnit(unit);
    }
    if (!plan.deployments.length) return '';
    const names = plan.deployments.map((d) => d.name);
    return `Enemy reinforcements: ${names.join(', ')}`;
  }

  function deployReserveAt(c, r) {
    const reserve = cardState.reserves.find((unit) => unit.id === state.selectedReserveId);
    if (!reserve) return false;
    const legal = canDeployAt(reserve.id, c, r);
    if (!legal.ok) { state.notice = `Cannot deploy here: ${legal.reason.replaceAll('-', ' ')}.`; refresh(); return false; }
    const unit = createRecruitUnit(reserve.unitId, `recruit-${reserve.id}`, 'blue', c, r, {
      stars: reserve.stars,
      population: reserve.population,
      state: 'field',
      energy: reserve.energy ?? 0,
      maxEnergy: reserve.maxEnergy ?? 4,
      cooldowns: reserve.cooldowns ?? {},
      statuses: reserve.statuses ?? {},
      abilityOrder: reserve.abilityOrder ?? (reserve.unitId === 'pikeman' ? ['rally'] : []),
      stance: reserve.stance ?? UNIT_CARDS[reserve.unitId]?.defaultStance,
    });
    Object.assign(unit, initializeAbilityState(unit));
    unit.planningMoved = false;
    cardState.reserves = cardState.reserves.filter((item) => item.id !== reserve.id);
    units.addUnit(unit);
    state.selectedReserveId = null;
    state.mode = 'idle';
    state.notice = `${unit.name} deployed. It will act in this battle.`;
    refresh();
    return true;
  }

  function unitBoard(records = units.alive().map((entry) => entry.data)) {
    const list = records.map((record) => ({ data: record }));
    return {
      list,
      byId: new Map(list.map((entry) => [entry.data.id, entry])),
      unitAt(c, r) { return list.find((entry) => entry.data.hp > 0 && entry.data.c === c && entry.data.r === r); },
    };
  }

  function updateTerritory() {
    const captured = [];
    for (const location of territory.keys()) {
      const [c, r] = location.split(',').map(Number);
      const occupant = units.unitAt(c, r);
      if (terrainAt(c, r) === 'V' && occupant && territory.get(location) !== occupant.data.faction) {
        territory.set(location, occupant.data.faction);
        captured.push({ c, r, faction: occupant.data.faction });
      }
    }
    return captured;
  }

  async function showSpellEvents(events) {
    for (const event of events) {
      if (event.amount > 0 && event.targetId) pop(`+${event.amount}`, event.targetId, 'heal');
      for (const hit of event.events || []) {
        if (hit.amount > 0) pop(`${hit.amount}`, hit.targetId);
        if (data(hit.targetId).hp <= 0) await units.die(hit.targetId);
      }
      if (event.targetId && units.byId.has(event.targetId) && data(event.targetId).hp <= 0) await units.die(event.targetId);
      await sleep(120);
    }
  }

  function makeUpgradeChoices(ids) {
    const records = armyRecords().filter((unit) => ids.includes(unit.id));
    const canReserve = records.some((unit) => unit.state === 'reserve');
    const canField = records.some((unit) => unit.state !== 'reserve');
    state.upgradeChoice = { ids, survivorId: ids[0], destination: canReserve ? 'reserve' : canField ? 'field' : 'reserve' };
    state.trayCollapsed = false; // the dialog lives in the tray body
    refresh();
  }

  function applyUpgrade() {
    const choice = state.upgradeChoice;
    if (!choice) return;
    const records = armyRecords();
    const preview = previewUpgrade(records, choice.ids, choice);
    if (!preview.ok) { state.notice = `Cannot combine: ${preview.reason}`; refresh(); return; }
    if (choice.destination === 'field' && preview.unit.c === undefined) {
      state.notice = 'Choose a field unit to keep the upgraded unit on its tile, or place the result on the reserve bench.';
      refresh();
      return;
    }
    const consumed = new Set(choice.ids);
    const result = combineUnits(records, choice.ids, choice);
    if (!result.ok) { state.notice = `Cannot combine: ${result.reason}`; refresh(); return; }
    for (const id of consumed) units.removeUnit(id);
    if (consumed.has(state.selectedId)) state.selectedId = null;
    cardState.reserves = cardState.reserves.filter((unit) => !consumed.has(unit.id));
    cardState.population = Math.max(0, cardState.population + result.populationDelta);
    if (result.unit.state === 'reserve') cardState.reserves.push(result.unit);
    else units.addUnit(result.unit);
    state.upgradeChoice = null;
    state.notice = `${result.unit.name} combined to ${result.unit.stars} stars (${result.populationDelta >= 0 ? '+' : ''}${result.populationDelta} population).`;
    refresh();
  }

  function recruitSelectedCard() {
    const result = recruitUnit(cardState, state.selectedCardId);
    if (!result.ok) { state.notice = `Recruit failed: ${result.reason}`; refresh(); return; }
    cardState = result.state;
    state.selectedCardId = null;
    state.notice = `${UNIT_CARDS[result.reserve.unitId].name} joined the reserve bench.`;
    refresh();
  }

  function equipSelectedSkill() {
    const card = cardState.hand.find((item) => item.instanceId === state.selectedCardId);
    if (!card || card.type !== 'skill') return false;
    if (cardState.supply < card.cost) {
      state.notice = `Barrier needs ${card.cost} Supply.`;
      refresh();
      return false;
    }
    if ((skillLoadouts[state.selectedSkillType] || []).some((skill) => skill.id === card.skillId)) {
      state.notice = `${card.name} is already equipped for ${state.selectedSkillType}.`;
      refresh();
      return false;
    }
    const skill = { ...SKILL_CARDS[card.skillId], id: card.skillId };
    const result = equipTypeSkill(skillLoadouts, state.selectedSkillType, skill, { slots: 2 });
    if (!result.ok) {
      state.notice = `Cannot equip skill: ${result.reason.replaceAll('-', ' ')}.`;
      refresh();
      return false;
    }
    skillLoadouts = result.loadouts;
    cardState.supply -= card.cost;
    cardState.hand = cardState.hand.filter((item) => item.instanceId !== card.instanceId);
    state.selectedCardId = null;
    state.notice = `${card.name} now protects every ${state.selectedSkillType} in the next battle.`;
    refresh();
    return true;
  }

  function queueSelectedSpell(c, r, targetUnit) {
    const card = cardState.hand.find((item) => item.instanceId === state.selectedCardId);
    if (!card || card.type !== 'spell') return false;
    const spellId = card.id.replace('spell-', '');
    const target = spellId === 'fireburst'
      ? { kind: 'area', x: c, y: r }
      : targetUnit && targetUnit.faction === 'blue'
        ? { kind: 'unit', faction: 'friendly', unitId: targetUnit.id } : null;
    if (!target) { state.notice = 'Choose a living friendly unit for this spell.'; refresh(); return false; }
    const queueId = `queued-${card.instanceId}`;
    const result = queueSpell(cardState, spellId, target, { queueId });
    if (!result.ok) { state.notice = `Spell unavailable: ${result.reason}`; refresh(); return false; }
    const hand = cardState.hand.filter((item) => item.instanceId !== card.instanceId);
    cardState = { ...result.state, hand };
    state.queuedSpellCards[queueId] = card;
    state.selectedCardId = null;
    state.mode = 'idle';
    state.notice = `${card.name} queued for battle.`;
    refresh();
    return true;
  }

  async function resolveBattle() {
    if (state.busy || state.over || state.phase !== 'player') return;
    state.busy = true;
    state.phase = 'battle';
    state.mode = 'idle';
    state.selectedCardId = null;
    state.selectedReserveId = null;
    state.selectedId = null;
    state.notice = '';
    refresh();
    await banner('Battle begins', '', 500);

    // Spells commit before movement. This is a single authoritative update; animations only read it.
    if ((cardState.queuedSpells || []).length) {
      const spellResult = resolveQueuedSpells(cardState, units.alive().map((entry) => entry.data));
      for (const record of spellResult.units) Object.assign(data(record.id), record);
      cardState = { ...spellResult.state };
      state.queuedSpellCards = {};
      await showSpellEvents(spellResult.events);
      refresh();
    }

    const abilityEvents = [];
    for (const entry of units.alive()) {
      const activation = resolveAbilityActivation(entry.data);
      Object.assign(entry.data, activation.unit);
      for (const fired of activation.fired) abilityEvents.push({ unitId: entry.data.id, ...fired });
    }
    for (const event of abilityEvents) {
      if (event.effect?.type === 'heal' && event.effect.amount) pop(`Rally +${event.effect.amount}`, event.unitId, 'heal');
      await sleep(100);
    }

    const snapshot = units.alive().map((entry) => entry.data).map((record) => ({ ...record, statuses: { ...(record.statuses || {}) } }));
    for (const unit of snapshot) {
      const sharedSkills = skillsForUnitType(skillLoadouts, unit.cls);
      const barrier = unit.faction === 'blue' && sharedSkills.find((skill) => skill.id === 'barrier');
      if (barrier) unit.statuses.barrier = { amount: barrier.blockDamage, duration: 'upcoming-battle' };
    }
    const legalMoves = (unit, shared) => computeRange(unit, unitBoard(shared), unit.mov).move.map(([c, r]) => ({ c, r }));
    const orders = Object.fromEntries(snapshot.map((unit) => [unit.id, { stance: unit.stance || 'advance', range: weaponOf(unit).rng, objective: unit.objective }]));
    const battle = resolveBattleRound({
      units: snapshot,
      orders,
      seed: 0x415348 + state.turn,
      legalMoves,
      forecastAttack: (attacker, defender, from) => forecast(attacker, defender, [from.c, from.r]),
    });
    const pathByUnit = new Map();
    const preMoveBoard = unitBoard(snapshot);
    for (const event of battle.batches[0].events) {
      if (event.type !== 'move') continue;
      const startUnit = snapshot.find((unit) => unit.id === event.unitId);
      const path = startUnit && computeRange(startUnit, preMoveBoard, startUnit.mov).pathTo(event.to.c, event.to.r);
      if (path?.length) pathByUnit.set(event.unitId, path);
    }
    for (const event of battle.batches[0].events) {
      if (event.type !== 'move') continue;
      const route = pathByUnit.get(event.unitId);
      if (route?.length) await units.moveAlong(event.unitId, route);
      else units.setPosition(event.unitId, event.to.c, event.to.r);
    }
    for (const event of battle.batches[1].events) {
      if (event.type !== 'strike') continue;
      const attacker = units.byId.get(event.attackerId), target = units.byId.get(event.targetId);
      if (!attacker || !target) continue;
      await units.lunge(event.attackerId, [target.data.c, target.data.r]);
      if (event.hit) {
        if (event.damage) pop(event.crit ? `${event.damage}!` : `${event.damage}`, event.targetId, event.crit ? 'crit' : '');
        if (event.damage) await units.shake(event.targetId);
      } else pop('MISS', event.targetId, 'miss');
      await sleep(110);
    }
    for (const record of battle.units) Object.assign(data(record.id), record);
    const blueLosses = battle.batches[1].events.filter((event) => event.type === 'death' && units.byId.get(event.unitId)?.data.faction === 'blue');
    cardState.population = Math.max(0, cardState.population - blueLosses.reduce((sum, event) => sum + (data(event.unitId).population || 1), 0));
    if (blueLosses.some((event) => event.unitId === 'brenna')) state.heroRespawnAt = state.turn + HERO_RESPAWN_DELAY;
    for (const event of battle.batches[1].events) if (event.type === 'death') {
      const dead = units.byId.get(event.unitId);
      if (dead) await units.die(event.unitId);
    }
    const captures = updateTerritory();
    const captureNote = captures.map(({ c, r, faction }) => `${faction === 'blue' ? 'Captured' : 'Lost'} village at ${c},${r}`).join(' · ');
    const lossNote = blueLosses.map((event) => `${data(event.unitId).name} fallen`).join(' · ');
    const respawnNote = blueLosses.some((event) => event.unitId === 'brenna') ? `Brenna returns in round ${state.heroRespawnAt} for ${HERO_RESPAWN_COST} Supply` : '';
    state.notice = [captureNote, lossNote, respawnNote].filter(Boolean).join(' · ');
    refresh();
    if (checkEnd()) return;

    state.turn += 1;
    state.phase = 'player';
    const refreshResult = refreshRound(cardState, cardRng);
    cardState = refreshResult.state;
    if (refreshResult.blocked) state.notice = `Hand full: ${refreshResult.blocked} draw${refreshResult.blocked === 1 ? '' : 's'} blocked.`;
    for (const entry of units.list) {
      Object.assign(entry.data, advanceAbilityRound(entry.data));
      entry.data.planningMoved = false;
      entry.data.done = false;
      entry.data.moved = false;
    }
    tryHeroRespawn();
    const reinforcements = planEnemy();
    if (reinforcements) state.notice = [state.notice, reinforcements].filter(Boolean).join(' · ');
    refresh();
    await banner('Planning', 'Cards, Supply, and unit state carry forward', 650);
    state.busy = false;
    refresh();
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
    state.busy = false;
    refresh();
  }

  const commands = {
    resolve() { resolveBattle(); },
    recruit() { recruitSelectedCard(); },
    equipSkill() { equipSelectedSkill(); },
    stance() { const u = selected(); if (u?.faction === 'blue') { u.stance = u.stance === 'hold' ? 'advance' : 'hold'; refresh(); } },
    targetSpell() { if (state.selectedCardId) { state.mode = 'spellTarget'; state.notice = 'Click a valid unit or tile to queue the spell.'; refresh(); } },
    toggleTray() { state.trayCollapsed = !state.trayCollapsed; refresh(); },
    cancelCard() { state.selectedCardId = null; state.mode = 'idle'; state.notice = ''; refresh(); },
    cancelDeploy() { state.selectedReserveId = null; state.mode = 'idle'; refresh(); },
    cancelUpgrade() { state.upgradeChoice = null; refresh(); },
    confirmUpgrade() { applyUpgrade(); },
    restart() { location.reload(); },
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
      else if (state.mode === 'spellTarget' || state.selectedCardId) commands.cancelCard();
      else if (state.selectedReserveId) commands.cancelDeploy();
      else if (state.upgradeChoice) commands.cancelUpgrade();
      else if (state.selectedId) select(null);
    },
  };

  planning.addEventListener('click', (e) => {
    if (state.busy || state.phase !== 'player') return;
    const cardButton = e.target.closest('[data-card-id]');
    if (cardButton) {
      state.selectedCardId = cardButton.dataset.cardId;
      state.selectedReserveId = null;
      state.mode = 'idle';
      state.notice = '';
      refresh();
      return;
    }
    const reserveButton = e.target.closest('[data-reserve-id]');
    if (reserveButton) {
      state.selectedReserveId = reserveButton.dataset.reserveId;
      state.selectedCardId = null;
      state.mode = 'deploy';
      state.notice = '';
      refresh();
      return;
    }
    const triple = e.target.closest('[data-upgrade-group]');
    if (triple) { makeUpgradeChoices(triple.dataset.upgradeGroup.split(',')); return; }
    const cancelQueued = e.target.closest('[data-cancel-spell]');
    if (cancelQueued) {
      const queueId = cancelQueued.dataset.cancelSpell;
      const result = cancelSpell(cardState, queueId);
      if (result.ok) {
        cardState = result.state;
        const card = state.queuedSpellCards[queueId];
        if (card) cardState.hand.push(card);
        delete state.queuedSpellCards[queueId];
        state.notice = 'Queued spell cancelled and its Supply returned.';
        refresh();
      }
      return;
    }
    const transfer = e.target.closest('[data-transfer-skill]');
    if (transfer) {
      const skillId = transfer.dataset.transferSkill;
      const fromType = transfer.dataset.fromType;
      const transferKey = `${fromType}:${skillId}`;
      const targetType = state.skillTransferTargets[transferKey]
        || ['pikeman', 'archer', 'cavalier'].find((type) => type !== fromType);
      const result = transferTypeSkill(skillLoadouts, fromType, targetType, skillId, { slots: 2 });
      if (result.ok) {
        skillLoadouts = result.loadouts;
        state.skillTransferTargets[`${targetType}:${skillId}`] = fromType;
        state.notice = `${SKILL_CARDS[skillId]?.name || skillId} moved to ${targetType}; the old type no longer inherits it.`;
      } else state.notice = `Cannot transfer skill: ${result.reason.replaceAll('-', ' ')}.`;
      refresh();
      return;
    }
    const action = e.target.closest('[data-act]');
    if (action && !action.disabled) commands[action.dataset.act]?.();
  });
  planning.addEventListener('change', (e) => {
    if (e.target.matches('[data-upgrade-survivor]')) state.upgradeChoice.survivorId = e.target.value;
    if (e.target.matches('[data-upgrade-destination]')) state.upgradeChoice.destination = e.target.value;
    if (e.target.matches('[data-skill-unit-type]')) state.selectedSkillType = e.target.value;
    if (e.target.matches('[data-skill-transfer-target]')) state.skillTransferTargets[e.target.dataset.skillTransferTarget] = e.target.value;
    if (e.target.matches('[data-upgrade-survivor], [data-upgrade-destination]')) refresh();
    if (e.target.matches('[data-skill-unit-type], [data-skill-transfer-target]')) refresh();
  });

  const onAction = (e) => {
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) commands[b.dataset.act]();
  };
  actions.addEventListener('click', onAction);
  sheet.addEventListener('click', onAction);

  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    // Keys typed into a form control, or Enter on a focused button, belong to that control.
    const t = e.target;
    if (t?.closest?.('select, input, textarea') || (k === 'enter' && t?.closest?.('button'))) return;
    if ((state.over && k === 'r') || (state.over && k === 'enter')) commands.restart();
    else if (state.busy) return;
    else if (k === 'enter') {
      if (state.sheet) return;
      if (state.mode === 'target') commands.confirm();
      else if (state.selectedCardId) {
        const card = cardState.hand.find((item) => item.instanceId === state.selectedCardId);
        if (card?.type === 'unit') commands.recruit();
        else if (card?.type === 'spell') commands.targetSpell();
        else if (card?.type === 'skill') commands.equipSkill();
      } else resolveBattle();
    }
    else if (k === 'escape') commands.back();
    else if (k === 'i') (state.sheet ? commands.close : commands.inspect)();
    else if (k === 's') commands.stance();
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

  units.list.forEach((entry) => addRosterUnit(entry.data));
  state.notice = planEnemy(true);

  // ---------- Picking ----------

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitPoint = new THREE.Vector3();
  function pickTile() {
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

  function pick(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (state.mode === 'deploy' || state.mode === 'spellTarget') {
      const tile = pickTile();
      if (tile) return tile;
    }
    const hit = raycaster.intersectObjects(units.list.map((unit) => unit.group), true)[0];
    if (hit) {
      const unit = units.byId.get(hit.object.userData.unitId);
      if (unit) return [unit.data.c, unit.data.r];
    }
    return pickTile();
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
    if (state.mode === 'deploy') { deployReserveAt(...tile); return; }
    if (state.mode === 'spellTarget') { queueSelectedSpell(tile[0], tile[1], u?.data); return; }
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
    if (!u && !state.selectedCardId && canAct(s) && !s.planningMoved && range?.move.some(([c, r]) => c === tile[0] && r === tile[1])) {
      doPlanMove(s, tile);
      return;
    }
    if (e.pointerType === 'touch' || e.pointerType === 'pen') state.hoverId = null;
    select(u ? u.data.id : null);
  });

  setCursor(...state.cursorTile);
  cursor.visible = false;
  // Dev only: lets design checks drive UI states without playing to them (see docs/design_overhaul/tasks).
  if (import.meta.env.DEV) {
    window.__ui = {
      state, feed, plates, commands, refresh, territory, units,
      get cardState() { return cardState; }, set cardState(v) { cardState = v; },
      get skillLoadouts() { return skillLoadouts; }, set skillLoadouts(v) { skillLoadouts = v; },
    };
  }
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
      plates.update(t);
    },
  };
}
