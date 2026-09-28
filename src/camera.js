import * as THREE from 'three';

// Orthographic camera tilted 40° from horizontal so cliffs, the river gorge and the
// backdrop read as terrain height, while unit models still face the viewer.
const TILT = THREE.MathUtils.degToRad(40);
const DIST = 30;

export function createCamera(dom) {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const target = new THREE.Vector3(0, 0, 0.4);
  const offset = new THREE.Vector3(0, Math.sin(TILT) * DIST, Math.cos(TILT) * DIST);

  function place() {
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
  }

  function resize() {
    const aspect = innerWidth / innerHeight;
    // Fit the 16 x 12 map with room for the UI panels.
    const viewH = Math.max(10.5, 18.5 / aspect);
    camera.left = (-viewH * aspect) / 2;
    camera.right = (viewH * aspect) / 2;
    camera.top = viewH / 2;
    camera.bottom = -viewH / 2;
    camera.updateProjectionMatrix();
  }

  dom.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.zoom = THREE.MathUtils.clamp(camera.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 1, 2.6);
    camera.updateProjectionMatrix();
  }, { passive: false });

  // Right-drag pans across the map.
  let drag = null;
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  dom.addEventListener('pointerdown', (e) => {
    if (e.button === 2) drag = { x: e.clientX, y: e.clientY };
  });
  addEventListener('pointerup', () => { drag = null; });
  addEventListener('pointermove', (e) => {
    if (!drag) return;
    const worldPerPx = (camera.top - camera.bottom) / camera.zoom / innerHeight;
    target.x -= (e.clientX - drag.x) * worldPerPx;
    target.z -= ((e.clientY - drag.y) * worldPerPx) / Math.sin(TILT);
    target.x = THREE.MathUtils.clamp(target.x, -8, 8);
    target.z = THREE.MathUtils.clamp(target.z, -6, 6);
    drag = { x: e.clientX, y: e.clientY };
    place();
  });

  place();
  resize();
  return { camera, resize };
}
