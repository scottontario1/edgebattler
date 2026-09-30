import {FACING} from '../abilities.js';
// In-world markers for the persistent-state mechanics: a small plate above each unit (stars,
// stance, energy, statuses) and a pennant on every village / camp / keep showing who holds it.
// Plain DOM nodes projected from the 3D scene each frame; nothing here reads or changes game rules.
import * as THREE from 'three';
import { toWorld, tileTop, terrainAt } from '../map.js';
import { stanceIcon, starPips, energyPips, statusIcon } from './icons.js';
import { uiFlags } from './util.js';
import './plates.css';

const HEAD = { paladin: 1.6, barbarian: 1.6 };   // world units above the feet to just over the head
const HEAD_DEFAULT = 1.32;
const LIFT_PX = 6;                               // screen gap between head and plate
const OVERLAP_EVERY = 4;                         // frames between overlap passes

const FLAG = '<svg viewBox="0 0 18 22" width="18" height="22" aria-hidden="true"><path d="M3 1v20" stroke="#f3ead6" stroke-width="1.6" stroke-linecap="round"/><path class="cloth" d="M4 2h11l-3.2 4.2L15 10.4H4z"/></svg>';
const CROWN = '<svg viewBox="0 0 18 22" width="18" height="22" aria-hidden="true"><path class="cloth" d="M2 15.5 1.2 6l4.3 3.6L9 3.5l3.5 6.1L16.8 6 16 15.5z"/><rect class="cloth" x="2" y="16.6" width="14" height="2.4" rx="1"/></svg>';

/** deps: { camera, scene, units, territory: Map('c,r' -> 'blue' | 'red' | null), container: HTMLElement } */
export function createPlates({ camera, units, territory, container }) {
  const layer = document.createElement('div');
  layer.className = 'plates';
  layer.setAttribute('aria-hidden', 'true');
  // First child of the HUD so every panel paints above it.
  (container || document.body).prepend(layer);

  const unitNodes = new Map();   // unit id -> { el, sig, x, y, hidden, faded }
  const flagNodes = new Map();   // 'c,r' -> { el, sig, x, y, hidden }
  const v = new THREE.Vector3();
  let ui = { selectedId: null, hoverId: null };
  let frame = 0;

  const signature = (d) => [d.stars || 1, d.stance, d.energy, d.maxEnergy, d.faction,d.facing,
    Object.keys(d.statuses || {}).filter((k) => d.statuses[k]).join('+')].join('|');

  function plateHTML(d) {
    const parts = [`<span class="pl-facing" title="Facing ${d.facing}"><span class="pl-arrow">↑</span></span>`];
    if ((d.stars || 1) >= 2) parts.push(`<span class="pl-stars">${starPips(d.stars, d.stars, 10)}</span>`);
    if (d.faction === 'blue' || ui.selectedId === d.id || ui.hoverId === d.id) parts.push(`<span class="pl-stance" title="${d.stance || 'advance'}">${stanceIcon(d.stance || 'advance', 11)}</span>`);
    if (uiFlags.abilities && d.faction === 'blue' && d.maxEnergy > 0) parts.push(`<span class="pl-energy">${energyPips(d.energy || 0, Math.min(4, d.maxEnergy), 11)}</span>`);
    for (const [name, value] of Object.entries(d.statuses || {})) if (value) parts.push(`<span class="pl-status ${name}" title="${name}">${statusIcon(name, 11)}</span>`);
    return parts.join('');
  }

  function unitNode(u) {
    let n = unitNodes.get(u.data.id);
    if (!n) {
      const el = document.createElement('div');
      el.className = 'plate';
      el.style.display = 'none';
      layer.appendChild(el);
      n = { el, sig: null, x: NaN, y: NaN, hidden: true, faded: false };
      unitNodes.set(u.data.id, n);
    }
    return n;
  }

  function flagNode(key) {
    let n = flagNodes.get(key);
    if (!n) {
      const el = document.createElement('div');
      el.className = 'pennant';
      el.style.display = 'none';
      layer.appendChild(el);
      n = { el, sig: null, x: NaN, y: NaN, hidden: true };
      flagNodes.set(key, n);
    }
    return n;
  }

  function place(n, x, y, visible) {
    if (visible === n.hidden) { n.hidden = !visible; n.el.style.display = visible ? '' : 'none'; }
    if (!visible) return;
    const rx = Math.round(x), ry = Math.round(y);
    if (rx !== n.x || ry !== n.y) { n.x = rx; n.y = ry; n.el.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -100%)`; }
  }

  // Projects world point v to CSS pixels; returns false when off screen or behind the camera.
  function project(out) {
    v.project(camera);
    out.x = (v.x * 0.5 + 0.5) * innerWidth;
    out.y = (-v.y * 0.5 + 0.5) * innerHeight;
    return v.z < 1 && out.x > -40 && out.x < innerWidth + 40 && out.y > -40 && out.y < innerHeight + 40;
  }
  const px = { x: 0, y: 0 };

  function update() {
    frame += 1;
    const seen = new Set();
    for (const u of units.list) {
      const d = u.data;
      if (d.hp <= 0) continue;
      seen.add(d.id);
      const n = unitNode(u);
      const sig = `${signature(d)}|${ui.selectedId === d.id}|${ui.hoverId === d.id}`;
      if (sig !== n.sig) {
        n.sig = sig;
        n.el.innerHTML = plateHTML(d);
        n.el.dataset.faction = d.faction;
        n.el.classList.toggle('empty', !n.el.innerHTML);
        n.el.classList.toggle('selected', ui.selectedId === d.id);
        n.el.dataset.priority = ui.selectedId === d.id ? '3' : d.faction === 'blue' ? '2' : '1';
      }
      const empty = n.el.classList.contains('empty');
      v.copy(u.group.position);
      v.y += HEAD[d.cls] ?? HEAD_DEFAULT;
      const ok = project(px) && !empty && u.group.visible !== false;
      place(n, px.x, px.y - LIFT_PX, ok);
      const arrow=n.el.querySelector('.pl-arrow');
      if(arrow&&ok) {
        const origin={x:px.x,y:px.y};const [dc,dr]=FACING[d.facing]||FACING.north;
        const at=toWorld(d.c+dc,d.r+dr),here=toWorld(d.c,d.r);
        v.copy(u.group.position);v.y+=HEAD[d.cls]??HEAD_DEFAULT;v.x+=at.x-here.x;v.z+=at.z-here.z;project(px);
        arrow.style.transform=`rotate(${Math.atan2(px.y-origin.y,px.x-origin.x)*180/Math.PI+90}deg)`;
      }
    }
    for (const [id, n] of unitNodes) if (!seen.has(id)) { n.el.remove(); unitNodes.delete(id); }

    for (const [key, owner] of territory) {
      const n = flagNode(key);
      const [c, r] = key.split(',').map(Number);
      const sig = String(owner);
      if (sig !== n.sig) {
        const first = n.sig === null;
        n.sig = sig;
        n.el.className = `pennant ${owner || 'neutral'}`;
        n.el.dataset.kind = terrainAt(c, r) === 'V' ? 'flag' : 'crown';
        n.el.innerHTML = n.el.dataset.kind === 'crown' ? CROWN : FLAG;
        if (!first) { n.el.classList.add('changed'); setTimeout(() => n.el.classList.remove('changed'), 450); }
      }
      const w = toWorld(c, r);
      v.set(w.x, tileTop(c, r) + 0.55, w.z);
      place(n, ...(project(px) ? [px.x, px.y, !units.unitAt(c, r)] : [0, 0, false]));
    }

    if (frame % OVERLAP_EVERY === 0) fadeOverlaps();
  }

  // Fade the lower-priority plate of any pair that overlaps by more than 30% of the smaller one.
  function fadeOverlaps() {
    const list = [];
    for (const n of unitNodes.values()) {
      if (n.hidden) continue;
      const r = n.el.getBoundingClientRect();
      list.push({ n, r, p: Number(n.el.dataset.priority) || 1 });
      n.want = false;
    }
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i].r, b = list[j].r;
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox <= 0 || oy <= 0) continue;
      const small = Math.min(a.width * a.height, b.width * b.height) || 1;
      if ((ox * oy) / small > 0.3) (list[i].p >= list[j].p ? list[j] : list[i]).n.want = true;
    }
    for (const { n } of list) if (n.want !== n.faded) { n.faded = n.want; n.el.classList.toggle('faded', n.want); }
  }

  return {
    /** Called every frame from ui.update(t). */
    update,
    /** Called after ui refresh(): selection and hover decide which plates show extra detail. */
    sync(state) {
      ui = { selectedId: state.selectedId, hoverId: state.hoverId };
    },
  };
}
