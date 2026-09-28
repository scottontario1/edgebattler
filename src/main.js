import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './style.css';
import { buildMap } from './map.js';
import { createUnits } from './units.js';
import { createCamera } from './camera.js';
import { createUI } from './ui.js';

// Supersample on standard-DPI screens; cap at 2x so 4K stays smooth.
const pixelRatio = () => Math.min(Math.max(devicePixelRatio, 1.5), 2);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelRatio());
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141c14);
// Soft studio reflections so metal armor and water have something to reflect.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

scene.add(new THREE.HemisphereLight(0xfff0d8, 0x3d4a2c, 1.0));
const sun = new THREE.DirectionalLight(0xffdcaa, 2.8);
sun.position.set(-7, 14, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 9, bottom: -9, near: 1, far: 40 });
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.015;
sun.shadow.radius = 3;
scene.add(sun);

const map = buildMap(scene);
const units = createUnits(scene);
const view = createCamera(renderer.domElement);
const { camera, resize } = view;
const ui = createUI({ renderer, camera, scene, units, view });
if (import.meta.env.DEV) window.__game = { THREE, scene, camera, renderer, units };

const composer = new EffectComposer(renderer);
composer.setPixelRatio(pixelRatio());
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1, thickness: 1, scale: 1.2, samples: 16 });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
gtao.blendIntensity = 0.85;
composer.addPass(gtao);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.5, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const smaa = new SMAAPass(innerWidth * pixelRatio(), innerHeight * pixelRatio());
composer.addPass(smaa);

// H toggles the post-processing stack for slower GPUs.
let hd = true;
const hdLabel = document.getElementById('hd');
const modelLabel = document.getElementById('models');
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key.toLowerCase() === 'm') {
    modelLabel.textContent = units.toggleModels() ? 'illustrated models' : 'procedural';
    return;
  }
  if (e.key.toLowerCase() !== 'h') return;
  hd = !hd;
  renderer.setPixelRatio(hd ? pixelRatio() : 1);
  hdLabel.textContent = hd ? 'HD on' : 'HD off';
});

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(pixelRatio());
  composer.setSize(innerWidth, innerHeight);
  resize();
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  if (!innerWidth || !innerHeight) return; // hidden tab / zero-size frame
  const t = clock.getElapsedTime();
  map.animate(t);
  units.update(t, ui.activeId());
  ui.update(t);
  if (hd) composer.render();
  else renderer.render(scene, camera);
  // HUD-style overlay (unit HP bars) drawn on top, untouched by AO/bloom.
  renderer.autoClear = false;
  renderer.render(units.overlay, camera);
  renderer.autoClear = true;
});
