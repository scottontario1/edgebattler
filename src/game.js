import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { PainterlyPass } from './painterly.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './style.css';
import { buildMap } from './map.js';
import { createUnits } from './units.js';
import { createCamera } from './camera.js';
import { createUI } from './ui.js';
import { mountLevelPanel } from './ui/levelpanel.js';
import { createMatch } from './match.js';
import { playLog } from './log.js';
import { CAMPAIGN_BY_ID, createCampaignMatch } from './campaign.js';
import { createSkirmish, isFaction } from './setup.js';
import './level-maps.js';
import { LEVEL_BY_ID, createLevelMatch, redScriptPolicy } from './levels.js';

// Render one pixel per CSS pixel; SMAA handles edges without supersampling every pass.
const MAX_RENDER_PIXELS = 1_600_000;
const renderScaleFor = (width, height) => Math.min(1, Math.sqrt(MAX_RENDER_PIXELS / Math.max(1, width * height)));
let renderScale = renderScaleFor(innerWidth, innerHeight);
const FRAME_INTERVAL = 1000 / 60;

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(renderScale);
renderer.setSize(innerWidth, innerHeight);
renderer.info.autoReset = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Refresh once per displayed frame, then reuse for the AO scene pass.
renderer.shadowMap.autoUpdate = false;
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
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 9, bottom: -9, near: 1, far: 40 });
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.015;
sun.shadow.radius = 3;
scene.add(sun);

// The match is built BEFORE the map so a level or faction can pick its map (setMap) first.
// One match per page load. ?seed=N picks the card/battle seed; ?red=greedy|heuristic|passive picks the
// enemy commander; ?blue=<policy> (or ?auto=<policy>) lets an AI play blue too; ?speed=4 shortens playback.
// The menu (src/menu.js) starts a game through the URL: ?level=<id> plays a level as Blue (Red follows the level's script), and
// ?you=<faction>&foe=<faction> starts a skirmish with those factions (crown, fang, league, court; default classic).
const params = new URLSearchParams(location.search);
const combat=params.get('combat')==='classic'?null:{duration:18};
const policies = { red: params.get('red') || 'greedy', blue: params.get('blue') || params.get('auto') || null, speed: params.get('speed') };
// Dev builds stream every game to logs/play/ through the vite.config.js /__log endpoint.
const gameLog = import.meta.env.DEV ? playLog() : null;
const seed = Number(params.get('seed')) || 0x415348;
const commit = typeof __COMMIT__ !== 'undefined' ? __COMMIT__ : null;
const level = LEVEL_BY_ID[params.get('level')] || null;
const you = isFaction(params.get('you')) ? params.get('you') : 'classic';
const foe = isFaction(params.get('foe')) ? params.get('foe') : 'classic';
const campaignLevel = CAMPAIGN_BY_ID[params.get('campaign')] || null;
let match;
if (campaignLevel) {
  match = createCampaignMatch(campaignLevel, { faction: you, seed, combat, log: gameLog?.push, meta: { commit } });
  policies.red = () => {};
  policies.blue = null;
} else if (level) {
  match = createLevelMatch(level, { seed, combat, log: gameLog?.push, meta: { source: 'browser', blue: 'human', red: 'level-script', commit } });
  policies.red = redScriptPolicy(level); // Red has no commander in a level: only its scripted picks
  policies.blue = null;
} else if (you !== 'classic' || foe !== 'classic') {
  match = createSkirmish({ blue: you, red: foe === you ? 'classic' : foe, seed, combat, log: gameLog?.push,
    meta: { source: 'browser', blue: policies.blue ? `ai:${policies.blue}` : 'human', red: `ai:${policies.red}`, commit } });
} else {
  match = createMatch({
    seed, combat,
    log: gameLog?.push,
    meta: { source: 'browser', blue: policies.blue ? `ai:${policies.blue}` : 'human', red: `ai:${policies.red}`, commit },
  });
}
const map = buildMap(scene);
const units = createUnits(scene, match.units);
const view = createCamera(renderer.domElement);
const { camera, resize } = view;
const ui = createUI({ renderer, camera, scene, units, view, match, policies });
mountLevelPanel({ level, you, foe, campaignLevel, match });
if (import.meta.env.DEV) window.__game = { THREE, scene, camera, renderer, units, match, log: gameLog };

const composer = new EffectComposer(renderer);
composer.setPixelRatio(renderScale);
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
// Eight AO samples retain broad contact shading while reducing per-pixel post-processing work.
gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1, thickness: 1, scale: 1.2, samples: 8 });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 8 });
gtao.blendIntensity = 0.85;
composer.addPass(gtao);
// The AO pass sees every sprite as a solid rectangle (its depth/normal override ignores alpha),
// leaving an un-occluded box of ground around each unit. Hide the quads for that pass only.
const gtaoRender = gtao.render.bind(gtao);
gtao.render = (...args) => {
  const quads = units.spriteMeshes();
  quads.forEach((m) => { m.visible = false; });
  gtaoRender(...args);
  quads.forEach((m) => { m.visible = true; });
};
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.5, 1.0);
composer.addPass(bloom);
// Painterly filter on everything but the sprites; P toggles it, ?paint=0 starts with it off.
const painterly = new PainterlyPass({ scene, camera, maskObjects: () => units.spriteMeshes() });
painterly.strength = new URLSearchParams(location.search).get('paint') === '0' ? 0 : 1;
painterly.enabled = painterly.strength > 0;
composer.addPass(painterly);
composer.addPass(new OutputPass());
const smaa = new SMAAPass(innerWidth * renderScale, innerHeight * renderScale);
composer.addPass(smaa);

// CPU submission stats support DevTools comparisons; they do not measure GPU execution time.
const renderStats = { frames: 0, drawCalls: 0, triangles: 0, cpuRenderMs: 0, pixelRatio: renderScale, pixelBudget: MAX_RENDER_PIXELS };
if (import.meta.env.DEV) window.__game.renderStats = renderStats;

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
  if (e.key.toLowerCase() === 'p') {
    painterly.strength = painterly.strength > 0 ? 0 : 1;
    painterly.enabled = painterly.strength > 0;
    return;
  }
  if (e.key.toLowerCase() !== 'h') return;
  hd = !hd;
  hdLabel.textContent = hd ? 'HD on' : 'HD off';
});

addEventListener('resize', () => {
  renderScale = renderScaleFor(innerWidth, innerHeight);
  renderer.setPixelRatio(renderScale);
  renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(renderScale);
  composer.setSize(innerWidth, innerHeight);
  if (import.meta.env.DEV) renderStats.pixelRatio = renderScale;
  resize();
});

let lastFrame = null;
let lastAnimationTime = null;
let t = 0;
function renderFrame(now) {
  if (document.hidden || !innerWidth || !innerHeight) return;
  const interval = !ui.isBusy() && !view.isDragging() ? 1000 / 30 : FRAME_INTERVAL;
  const elapsed = lastFrame === null ? 0 : now - lastFrame;
  // Allow for timestamp rounding; retain the remainder on faster displays.
  if (lastFrame !== null && elapsed < interval - 0.1) return;
  lastFrame = now - (Math.max(0, elapsed - interval) % interval);
  const renderStarted = performance.now();
  renderer.info.reset();
  // Pause animation time while hidden and avoid large jumps after a stalled frame.
  if (lastAnimationTime !== null) t += Math.min((now - lastAnimationTime) / 1000, 0.1);
  lastAnimationTime = now;
  map.animate(t);
  units.update(t, ui.activeId());
  ui.update(t);
  renderer.shadowMap.needsUpdate = true;
  if (hd) composer.render();
  else renderer.render(scene, camera);
  // HUD-style overlay (unit HP bars) drawn on top, untouched by AO/bloom.
  renderer.autoClear = false;
  renderer.render(units.overlay, camera);
  renderer.autoClear = true;
  if (import.meta.env.DEV) {
    renderStats.frames++;
    renderStats.drawCalls += renderer.info.render.calls;
    renderStats.triangles += renderer.info.render.triangles;
    renderStats.cpuRenderMs += performance.now() - renderStarted;
  }
}

function updateVisibility() {
  lastFrame = null;
  lastAnimationTime = null;
  renderer.setAnimationLoop(document.hidden ? null : renderFrame);
}
document.addEventListener('visibilitychange', updateVisibility);
updateVisibility();
