import {abilityEditorHTML} from './ui/abilities.js';
import {selectedCost,FACING,flankSide} from './abilities.js';
import './ui/abilities.css';
import * as THREE from 'three';
import { W, H, TERRAIN, inBounds, terrainAt, toWorld, tileTop } from './map.js';
import { portraitSVG } from './portraits.js';
import { forecast, weaponOf } from './combat.js';
import { MOVE_COST, MOVE_TYPE, key, unkey, computeRange } from './rules.js';
import { CARD_LIMITS, UNIT_CARDS, SPELL_CARDS, SKILL_CARDS, canAfford } from './cards.js';
import { findUpgradeMatches, previewUpgrade } from './upgrades.js';
import { RULES } from './match.js';
import { stanceIcon, STANCE_LABEL, STANCE_HINT } from './ui/icons.js';
import { runCommander } from './ai/commander.js';
import { createRecruitUnit } from './units.js';
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

export function createUI({ renderer, camera, scene, units, view, match, policies = {} }) {
  const card = document.getElementById('card');
  const terrainChip = document.getElementById('terrain');
  const roster = document.getElementById('roster');
  const actions = document.getElementById('actions');
  const planning = document.getElementById('planning');
  const sheet = document.getElementById('sheet');
  const turnNo = document.getElementById('turn-no');
  const phaseEl = document.getElementById('phase');
  // Rules and state live in the match controller (src/match.js); this module is the view over it.
  const blue = () => match.sides.blue;
  const redPolicy = policies.red || 'greedy';
  const bluePolicy = policies.blue || null; // null = human
  const speed = Math.max(0.25, Number(policies.speed) || 1);
  const wait = (ms) => sleep(ms / speed);

  const feed = createFeed({ camera, units, phaseEl, turnEl: turnNo });
  const { pop, banner } = feed;

  const layers = {
    flank: cellLayer(scene, 'attack', 0xf2cf6b, 0.55, 0.023),
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
    abilityDraft:null, abilityTargets:[], abilityNotice:'', abilityGroupOpen:false, lastAbilityResults:{},
    selectedAt: 0,
    phase: 'player', // 'player' | 'enemy'
    turn: 1,
    busy: false, // an animation or the enemy phase is running: input is ignored
    over: false, // victory or defeat reached
    selectedCardId: null,
    selectedSkillType: 'pikeman',
    skillTransferTargets: {},
    selectedReserveId: null,
    upgradeChoice: null,
    // Short landscape (phone on its side) has no room for an open tray: start collapsed, one tap opens it.
    trayCollapsed: matchMedia('(max-height: 500px) and (min-aspect-ratio: 1/1) and (min-width: 561px)').matches,
    notice: '',
  };
  Object.defineProperty(state, 'turn', { get: () => match.round });
  Object.defineProperty(state, 'over', { get: () => match.over });
  const territory = match.territory;
  let range = null;
  const plates = createPlates({ camera, scene, units, territory, container: document.querySelector('.hud') });

  const portraits = new Map(units.list.map((u) => [u.data.id, portraitSVG(u.data)]));
  const data = (id) => units.byId.get(id).data;
  const selected = () => (state.selectedId ? data(state.selectedId) : null);
  // A player unit that can still act this turn.
  const canAct = (u) => !!u && u.faction === 'blue' && u.hp > 0 && state.phase === 'player' && !state.busy && !state.over;

  // ---------- Panels ----------

  const unitCard = (u) => unitCardHTML(u, { portrait: portraits.get(u.id) });

  function forecastCard(a, d) {
    const f = forecast(a, d, range.targets.get(d.id));
    return forecastHTML({ a, d, f, terrain: TERRAIN[terrainAt(d.c, d.r)] });
  }

  const armyRecords = () => match.armyRecords('blue');

  function renderPlanning() {
    const selectedCard = blue().cards.hand.find((item) => item.instanceId === state.selectedCardId);
    const affordable = (cost) => canAfford(blue().cards, cost);
    const queued = (blue().cards.queuedSpells || []).map((cast) => {
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
      supply: blue().cards.supply, population: blue().cards.population, populationCap: CARD_LIMITS.populationCap,
      reserveCount: blue().cards.reserves.length, reserveCapacity: CARD_LIMITS.reserveCapacity,
      locations: controlledCount, prompt, phase: state.phase, collapsed: state.trayCollapsed,
      hand: handHTML({
        hand: blue().cards.hand, selectedCardId: state.selectedCardId, canAfford: affordable,
        portraitFor: (item) => portraitSVG(units.list.find((entry) => entry.data.cls === item.unitId)?.data || createRecruitUnit(item.unitId, `preview-${item.unitId}`, 'blue', 0, 0)),
      }),
      reserves: reservesHTML({ reserves: blue().cards.reserves, selectedReserveId: state.selectedReserveId, definitions: UNIT_CARDS }),
      detail: detailHTML({ selectedCard, selectedSkillType: state.selectedSkillType, skillLoadouts: blue().loadouts, canAfford: affordable }),
      queued: queuedHTML({ queued }),
      upgrades: upgradePromptsHTML({ groups }),
      choice: upgradeChoiceHTML({ choice }),
      loadouts: loadoutsHTML({ skillLoadouts: blue().loadouts, skillTransferTargets: state.skillTransferTargets }),
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
    if(!u) {state.sheet=false;sheet.hidden=true;return;}
    sheet.className = `panel sheet ${u.faction}`;
    sheet.innerHTML = sheetHTML(u, {
      portrait: portraitSVG(u), weapon: weaponOf(u), terrain: TERRAIN[terrainAt(u.c, u.r)],
      moveType: { armor: 'Armored', mounted: 'Mounted', foot: 'Foot' }[MOVE_TYPE[u.cls] || 'foot'],
    });
    if(u.faction==='blue'&&!state.busy&&!state.over) {
      if(state.abilityDraft?.unitId!==u.id) {
        state.abilityDraft={unitId:u.id,ids:[...(u.selectedAbilities||[])]};state.abilityTargets=[u.id];state.abilityNotice='';state.abilityGroupOpen=false;
      }
      const stats=sheet.innerHTML.slice(sheet.innerHTML.indexOf('</button>')+9);
      sheet.innerHTML=`<button class="btn close" data-act="close" aria-label="Close">×</button><div class="eyebrow">Planning</div><div class="name">${esc(u.name)}</div>`+abilityEditorHTML(u,{draft:state.abilityDraft.ids,targets:state.abilityTargets,units:match.alive(),notice:state.abilityNotice,groupOpen:state.abilityGroupOpen,lastResults:state.lastAbilityResults[u.id]||[]})+`<details class="plan-stats"><summary>Unit stats and equipment</summary>${stats}</details>`;
    }

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
      const card = blue().cards.hand.find((item) => item.instanceId === state.selectedCardId);
      if (card?.type === 'unit') html += btn('recruit', `Recruit · ${card.cost}`, '✚', '↵', 'primary', !canAfford(blue().cards, card.cost));
      if (card?.type === 'spell') html += btn('targetSpell', 'Choose target', '✧', '↵', 'primary');
      html += btn('cancelCard', 'Clear card', '‹', 'Esc');
    } else {
      if (u) html += btn('inspect', u.faction==='blue'?'Plan abilities':'Inspect', 'ⓘ', 'I');
      if (canWithdraw(u)) html += btn('withdraw', 'Withdraw to reserve', '⇲', 'W');
      if (u?.faction === 'blue') {
        const st = u.stance || 'advance';
        html += btn('stance', `Stance · ${STANCE_LABEL[st] || st}${st === 'protect' ? ' Brenna' : ''}`, stanceIcon(st, 14), 'S', `stance-${st}`).replace('title="', `title="${STANCE_HINT[st] || ''} (S to change) · `);
      }
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
    const cav=selected();
    const flankTiles=cav?.cls==='cavalier'&&!state.busy?match.alive(cav.faction==='blue'?'red':'blue').flatMap(o=>
      Object.values(FACING).map(([dc,dr])=>[o.c+dc,o.r+dr]).filter(([c,r])=>inBounds(c,r)&&flankSide({c,r},o)!=='front')):[];
    layers.flank.set(flankTiles);

    if (state.mode === 'spellTarget') {
      const card = blue().cards.hand.find((item) => item.instanceId === state.selectedCardId);
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

  // End of match: banner with the reason.
  function showEnd() {
    state.busy = false;
    state.mode = 'idle';
    refresh();
    const won = match.winner === 'blue';
    const why = { 'keep-captured': won ? 'The enemy keep has fallen' : 'Your keep has fallen',
      'army-destroyed': won ? 'The enemy army is destroyed' : 'Your army has fallen', 'round-limit': 'The round limit was reached' }[match.reason] || '';
    banner(match.winner ? (won ? 'Victory' : 'Defeat') : 'Draw', why, 0);
  }

  const deploymentTiles = () => match.deploymentTiles('blue');
  const canDeployAt = (reserveId, c, r) => match.canDeployAt('blue', reserveId, c, r);
  function deploymentOptions() {
    return deploymentTiles().filter(([c, r]) => canDeployAt(state.selectedReserveId, c, r).ok);
  }

  // Scene units follow the match records: add new ones, drop removed or replaced ones, snap positions.
  function syncView({ snap = true } = {}) {
    for (const u of [...units.list]) if (match.byId(u.data.id) !== u.data) units.removeUnit(u.data.id);
    for (const rec of match.units) if (!units.byId.has(rec.id)) { units.addUnit(rec); portraits.set(rec.id, portraitSVG(rec)); }
    if (snap) for (const rec of match.units) if (rec.hp > 0) units.setPosition(rec.id, rec.c, rec.r);
  }

  const reason = (r) => String(r || '').replaceAll('-', ' ');
  /** Apply a human planning action; on failure show why. */
  function act(action) {
    const res = match.apply({ faction: 'blue', ...action }, 'human');
    if (!res.ok) state.notice = `Cannot ${action.type}: ${reason(res.reason)}.`;
    return res;
  }

  async function doPlanMove(unit, tile) {
    if (!canAct(unit) || unit.planningMoved) return;
    const from = [unit.c, unit.r];
    const res = act({ type: 'move', unitId: unit.id, c: tile[0], r: tile[1] });
    if (!res.ok) { refresh(); return; }
    units.setPosition(unit.id, ...from);
    state.busy = true;
    refresh();
    await units.moveAlong(unit.id, res.path);
    state.busy = false;
    refresh();
  }

  // An AI commander plans one side (red always; blue too in autoplay). Returns a feed notice.
  function runAI(faction, policy) {
    const before = new Set(match.alive(faction).map((u) => u.id));
    runCommander(match, faction, policy);
    syncView();
    const arrived = match.alive(faction).filter((u) => !before.has(u.id)).map((u) => u.name);
    if (!arrived.length) return '';
    return faction === 'red' ? `Enemy reinforcements: ${arrived.join(', ')}` : `Deployed: ${arrived.join(', ')}`;
  }

  // Withdraw: a deployed recruit on a controlled tile returns to the bench with its HP, energy,
  // cooldowns and statuses (src/match.js RULES for the recovery rates).
  const canWithdraw = (u) => !state.busy && match.canWithdraw('blue', u);
  function withdrawSelected() {
    const u = selected();
    const res = act({ type: 'withdraw', unitId: u?.id });
    if (res.ok) {
      state.selectedId = null;
      state.notice = `${u.name} withdrew to the reserve bench (recovers ${RULES.reserveHeal} HP and ${1 + RULES.reserveEnergy} energy per round).`;
    } else if (u?.id === match.champion('blue')) state.notice = 'Champions cannot be benched.';
    syncView();
    refresh();
  }

  function deployReserveAt(c, r) {
    const res = act({ type: 'deploy', reserveId: state.selectedReserveId, c, r });
    if (res.ok) {
      state.selectedReserveId = null;
      state.mode = 'idle';
      state.notice = `${match.byId(res.unitId).name} deployed. It will act in this battle.`;
    }
    syncView();
    refresh();
    return res.ok;
  }

  const unitBoard = (records) => match.board(records);

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
    const res = act({ type: 'combine', ids: choice.ids, survivorId: choice.survivorId, destination: choice.destination });
    if (res.ok) {
      if (choice.ids.includes(state.selectedId)) state.selectedId = null;
      state.upgradeChoice = null;
      state.notice = `Combined to ${res.stars} stars (${res.populationDelta >= 0 ? '+' : ''}${res.populationDelta} population).`;
    }
    syncView();
    refresh();
  }

  function recruitSelectedCard() {
    const res = act({ type: 'recruit', cardId: state.selectedCardId });
    if (res.ok) {
      state.selectedCardId = null;
      state.notice = `${UNIT_CARDS[res.unitId].name} joined the reserve bench.`;
    }
    refresh();
  }

  function equipSelectedSkill() {
    const card = blue().cards.hand.find((item) => item.instanceId === state.selectedCardId);
    if (!card || card.type !== 'skill') return false;
    const res = act({ type: 'equip', cardId: card.instanceId, unitType: state.selectedSkillType });
    if (res.ok) {
      state.selectedCardId = null;
      state.notice = `${card.name} now protects every ${state.selectedSkillType} in the next battle.`;
    }
    refresh();
    return res.ok;
  }

  function queueSelectedSpell(c, r, targetUnit) {
    const card = blue().cards.hand.find((item) => item.instanceId === state.selectedCardId);
    if (!card || card.type !== 'spell') return false;
    const res = act({ type: 'spell', cardId: card.instanceId, c, r, unitId: targetUnit?.id });
    if (res.ok) {
      state.selectedCardId = null;
      state.mode = 'idle';
      state.notice = `${card.name} queued for battle.`;
    }
    refresh();
    return res.ok;
  }

  // Resolve the round in the match, then play its event batches back. Playback order never changes
  // the outcome: every record already holds its final state; the HP bars show `displayHp` meanwhile.
  async function resolveBattle() {
    if (state.busy || state.over || state.phase !== 'player') return;
    state.busy = true;
    state.phase = 'battle';
    state.mode = 'idle';
    state.selectedCardId = null;
    state.selectedReserveId = null;
    state.selectedId = null;
    state.notice = '';
    const shown = new Map(match.alive().map((u) => [u.id, u.hp]));
    const from = new Map(match.alive().map((u) => [u.id, [u.c, u.r]]));
    const result = match.resolveRound();
    state.lastAbilityResults={};
    for(const e of result.batches.filter(b=>b.type==='abilities').flatMap(b=>b.events)) {
      (state.lastAbilityResults[e.unitId]??=[]).push(e);
    }
    // Authoritative end positions, taken before the sprites are rewound for playback.
    const final = new Map(match.units.map((u) => [u.id, [u.c, u.r]]));
    for (const [id, hp] of shown) { const u = units.byId.get(id); if (u) u.displayHp = hp; }
    // setPosition also writes the record (records are shared); restore() puts the end positions back.
    for (const [id, at] of from) if (units.byId.has(id)) units.setPosition(id, ...at);
    const restore = () => { for (const u of match.units) { const at = final.get(u.id); if (at) { u.c = at[0]; u.r = at[1]; } } };
    restore();
    refresh();
    await banner('Battle begins', '', 500 / speed);
    const show = (id, delta) => { const u = units.byId.get(id); if (u && u.displayHp != null) u.displayHp = Math.max(0, u.displayHp + delta); };
    const dying = async (id) => { if (units.byId.has(id) && (units.byId.get(id).displayHp ?? 1) <= 0) await units.die(id); };
    for (const batch of result.batches) {
      if (batch.type === 'spells') {
        for (const e of batch.events) {
          if (e.amount > 0 && e.targetId) { pop(`+${e.amount}`, e.targetId, 'heal'); show(e.targetId, e.amount); }
          if (e.status && e.targetId) pop(e.status === 'ward' ? 'Ward' : e.status, e.targetId, 'ward');
          for (const hit of e.events || []) { if (hit.amount > 0) { pop(`${hit.amount}`, hit.targetId); show(hit.targetId, -hit.amount); } await dying(hit.targetId); }
          await wait(120);
        }
      } else if (batch.type === 'abilities') {
        for (const e of batch.events) {
          if(!e.applied) continue;
          if(e.effect?.type!=='heal'||!e.effect.amount) pop(e.name,e.unitId,'ward');
          if (e.effect?.type === 'heal' && e.effect.amount) { pop(`${e.name || 'Rally'} +${e.effect.amount}`, e.unitId, 'heal'); show(e.unitId, e.effect.amount); }
          await wait(100);
        }
      } else if (batch.type === 'movement') {
        for (const e of batch.events) {
          if (e.type !== 'move' || !units.byId.has(e.unitId)) continue;
          if (e.path?.length) await units.moveAlong(e.unitId, e.path);
          else units.setPosition(e.unitId, e.to.c, e.to.r);
        }
        restore();
      } else if (batch.type === 'combat') {
        for (const e of batch.events) {
          if (e.type === 'strike') {
            const target = units.byId.get(e.targetId);
            if (!units.byId.has(e.attackerId) || !target) continue;
            await units.lunge(e.attackerId, [target.data.c, target.data.r]);
            if (e.hit) {
              if (e.damage) { pop(`${e.crit ? e.damage+'!' : e.damage}${e.flankBonus?' Flank':''}`, e.targetId, e.crit ? 'crit' : ''); show(e.targetId, -e.damage); await units.shake(e.targetId); }
              else if (e.barrierReduction||e.braceReduction) pop('Blocked', e.targetId, 'barrier');
            } else pop('MISS', e.targetId, 'miss');
            await wait(110);
          } else if (e.type === 'death') await units.die(e.unitId);
        }
      }
    }
    for (const u of units.list) u.displayHp = null;
    syncView();
    state.notice = result.notes.filter((n) => n.faction === 'blue' || /fallen|Captured|Lost/.test(n.text)).map((n) => n.text).join(' · ');
    if (match.over) { showEnd(); return; }
    refresh();
    await planningStage();
  }

  // Start of a planning stage: the AI side(s) plan, then the player (or blue AI in autoplay).
  async function planningStage(first = false) {
    const notes = [];
    const red = runAI('red', redPolicy);
    if (red) notes.push(red);
    if (bluePolicy) { const b = runAI('blue', bluePolicy); if (b) notes.push(b); }
    state.notice = [state.notice, ...notes].filter(Boolean).join(' · ');
    state.phase = 'player';
    refresh();
    if (!first) await banner('Planning', 'Cards, Supply, and unit state carry forward', 650 / speed);
    state.busy = false;
    refresh();
    if (bluePolicy && !match.over) { await wait(700); resolveBattle(); }
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
    // Advance -> Hold -> Protect (Brenna) -> Advance. Brenna herself has no one to protect.
    stance() {
      const u = selected();
      if (!u || u.faction !== 'blue' || state.busy || state.phase !== 'player') return;
      const champion = match.champion('blue');
      const cycle = u.id === champion || !match.byId(champion)?.hp ? ['advance', 'hold'] : ['advance', 'hold', 'protect'];
      const next = cycle[(cycle.indexOf(u.stance || 'advance') + 1) % cycle.length];
      if (!act({ type: 'stance', unitId: u.id, stance: next, targetId: next === 'protect' ? champion : undefined }).ok) { refresh(); return; }
      state.notice = `${u.name}: ${STANCE_LABEL[next]} — ${STANCE_HINT[next]}.`;
      refresh();
    },
    targetSpell() { if (state.selectedCardId) { state.mode = 'spellTarget'; state.notice = 'Click a valid unit or tile to queue the spell.'; refresh(); } },
    withdraw() { withdrawSelected(); },
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
    close() { state.sheet = false; state.abilityDraft=null; refresh(); },
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
      const result = act({ type: 'cancelSpell', queueId });
      if (result.ok) {
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
      const result = act({ type: 'transfer', skillId, from: fromType, to: targetType });
      if (result.ok) {
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
  sheet.addEventListener('click',e=>{
    if(state.busy||state.over||selected()?.faction!=='blue') return;
    const pick=e.target.closest('[data-ability]');
    if(pick) {
      const id=pick.dataset.ability,ids=state.abilityDraft.ids;
      state.abilityDraft.ids=ids.includes(id)?ids.filter(x=>x!==id):[...ids,id];state.abilityNotice='Unapplied picks';refresh();
    }
    if(e.target.closest('[data-plan-class]')) {state.abilityTargets=match.alive('blue').filter(u=>u.cls===selected().cls).map(u=>u.id);refresh();}
    if(e.target.closest('[data-plan-apply]')) {
      const result=act({type:'abilities',unitIds:state.abilityTargets,abilityIds:state.abilityDraft.ids});
      state.abilityNotice=result.ok?'Picks saved. They repeat when ready.':`Cannot apply: ${result.reason.replaceAll('-',' ')}. No units changed.`;refresh();
    }
    const facing=e.target.closest('[data-facing]');
    if(facing) {act({type:'facing',unitId:selected().id,facing:facing.dataset.facing});refresh();}
  });
  sheet.addEventListener('toggle',e=>{if(e.target.matches('.plan-group')) state.abilityGroupOpen=e.target.open;},true);
  sheet.addEventListener('change',e=>{
    if(e.target.matches('[data-plan-unit]')) {
      const id=e.target.dataset.planUnit;
      state.abilityTargets=e.target.checked?[...new Set([...state.abilityTargets,id])]:state.abilityTargets.filter(x=>x!==id);refresh();
    }
  });


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
        const card = blue().cards.hand.find((item) => item.instanceId === state.selectedCardId);
        if (card?.type === 'unit') commands.recruit();
        else if (card?.type === 'spell') commands.targetSpell();
        else if (card?.type === 'skill') commands.equipSkill();
      } else resolveBattle();
    }
    else if (k === 'escape') commands.back();
    else if (k === 'i') (state.sheet ? commands.close : commands.inspect)();
    else if (k === 's') commands.stance();
    else if (k === 'w') commands.withdraw();
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
      match,
      get cardState() { return blue().cards; }, set cardState(v) { blue().cards = v; },
      get skillLoadouts() { return blue().loadouts; }, set skillLoadouts(v) { blue().loadouts = v; },
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

  // Round 1 planning: the enemy (and an autoplaying blue) plan before the player acts.
  state.busy = true;
  planningStage(true);

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
