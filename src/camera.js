import * as THREE from 'three';
import { W, H } from './map.js';
import { trayInset } from './ui/tray.js';

// Orthographic camera tilted 40° from horizontal so cliffs, the river gorge and the
// backdrop read as terrain height, while unit models still face the viewer.
// Portrait screens tilt steeper (52°) so the map's depth uses the extra height.
const TILT_LANDSCAPE = THREE.MathUtils.degToRad(40);
const TILT_PORTRAIT = THREE.MathUtils.degToRad(52);
const DIST = 30;
let SIN = Math.sin(TILT_LANDSCAPE), COS = Math.cos(TILT_LANDSCAPE);
const ZOOM_MIN = 0.55, ZOOM_MAX = 2.6;
const DRAG_PX = 8; // movement before a press becomes a pan instead of a click/tap

// The playable map in view space: 16 wide, 12 deep foreshortened by the tilt, plus ~0.9
// world units of height (castle, trees, units) poking above the far row.
const MAP_U = W + 0.4;
const mapV = () => (H + 0.4) * SIN + 0.9 * COS;
const mapVC = () => 0.45 * COS; // centre of that box, in view-space v, relative to the map centre

// HUD space to keep clear of the map (CSS px). Landscape: small top panels sit over the
// corner mountains, so only the lower-left card and lower-right actions need room.
// Portrait: a top bar + roster strip and a bottom dock. Keep in sync with style.css.
// Short landscape (phone on its side): the card is a left column and the actions an icon
// column on the right, so the map takes the full height between them.
export const isPortrait = () => innerWidth <= 820 && innerHeight >= innerWidth || innerWidth <= 560;
const isShort = () => !isPortrait() && innerHeight <= 500;
// The bottom inset follows the measured planning tray (src/ui/tray.js), so collapsing it gives the
// map the space back. Portrait adds the unit card and terrain chip that sit above the tray.
function insets() {
  const tray = trayInset();
  if (isPortrait()) return { top: 126, bottom: (tray || 142) + 118, left: 8, right: 8 };
  if (isShort()) return { top: 40, bottom: (tray || 0) + 6, left: 206, right: 60 };
  return { top: 24, bottom: (tray || 118) + 8, left: 16, right: 16 };
}

export function createCamera(dom) {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const target = new THREE.Vector3();
  const offset = new THREE.Vector3();
  let base = new THREE.Vector3(); // framed map position; pans are clamped around it

  function place() {
    target.x = THREE.MathUtils.clamp(target.x, -W / 2, W / 2);
    target.z = THREE.MathUtils.clamp(target.z, -H / 2 - 1, H / 2 + 1);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
  }

  // Frame the battlefield inside the space the HUD leaves free. Landscape shows the whole
  // map (both armies, the ford and the keep). Portrait can't fit 16 columns legibly, so it
  // shows ~7.5 columns (allied camp to the bridge) from the allied camp to the bridge and the first enemies; pan or
  // pinch for the rest.
  function resize() {
    const w = innerWidth, h = innerHeight, ins = insets();
    const aw = w - ins.left - ins.right, ah = h - ins.top - ins.bottom;
    const portrait = isPortrait();
    const tilt = portrait ? TILT_PORTRAIT : TILT_LANDSCAPE;
    SIN = Math.sin(tilt);
    COS = Math.cos(tilt);
    offset.set(0, SIN * DIST, COS * DIST);
    const spanU = portrait ? 7.6 : MAP_U;
    const px = Math.min(aw / spanU, ah / mapV()); // screen px per world unit at zoom 1
    const viewH = h / px;
    const aspect = w / h;
    camera.left = (-viewH * aspect) / 2;
    camera.right = (viewH * aspect) / 2;
    camera.top = viewH / 2;
    camera.bottom = -viewH / 2;
    camera.updateProjectionMatrix();
    // Put the map centre (or, in portrait, column ~5.5) in the middle of the free area.
    const uc = portrait ? 5.2 - (W - 1) / 2 : 0;
    const u = uc - (ins.left - ins.right) / (2 * px);
    const v = mapVC() - (ins.bottom - ins.top) / (2 * px);
    base = new THREE.Vector3(u, 0, -v / SIN);
    target.copy(base);
    place();
  }

  function setZoom(z) {
    camera.zoom = THREE.MathUtils.clamp(z, ZOOM_MIN, ZOOM_MAX);
    camera.updateProjectionMatrix();
  }

  function panPx(dx, dy) {
    const worldPerPx = (camera.top - camera.bottom) / camera.zoom / innerHeight;
    target.x -= dx * worldPerPx;
    target.z -= (dy * worldPerPx) / SIN;
    place();
  }

  dom.addEventListener('wheel', (e) => {
    e.preventDefault();
    setZoom(camera.zoom * (e.deltaY > 0 ? 0.9 : 1.1));
  }, { passive: false });

  // Pointer gestures: drag (any button) pans, two fingers pinch-zoom, a press that barely
  // moves stays a click/tap for the UI. `consumeDrag()` tells the UI to ignore the click
  // that ends a pan.
  const pointers = new Map();
  let dragged = false, pinch = null;
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  dom.addEventListener('pointerdown', (e) => {
    dom.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    if (pointers.size === 1) dragged = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: camera.zoom };
      dragged = true;
    }
  });
  dom.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      setZoom(pinch.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.d)));
      panPx(dx / 2, dy / 2);
      return;
    }
    if (!dragged && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < DRAG_PX) return;
    dragged = true;
    panPx(dx, dy);
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
  };
  dom.addEventListener('pointerup', release);
  dom.addEventListener('pointercancel', release);

  resize();
  // Re-frame when the tray changes height (collapse, layout switch).
  const trayEl = document.getElementById('planning');
  if (trayEl && typeof ResizeObserver !== 'undefined') {
    let lastH = trayEl.offsetHeight;
    new ResizeObserver(() => { if (trayEl.offsetHeight !== lastH) { lastH = trayEl.offsetHeight; resize(); } }).observe(trayEl);
  }
  // ?zoom=2&focus=12,2 for screenshots and debugging.
  const q = new URLSearchParams(location.search);
  if (q.has('zoom')) setZoom(+q.get('zoom'));
  if (q.has('focus')) {
    const [c, r] = q.get('focus').split(',').map(Number);
    target.set(c - (W - 1) / 2, 0, r - (H - 1) / 2);
    place();
  }

  return {
    camera,
    resize,
    isDragging: () => dragged && pointers.size > 0,
    consumeDrag() { const d = dragged; dragged = false; return d; },
  };
}
