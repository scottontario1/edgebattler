// Phaser 4 bootstrap. Launch options come from the URL (launch.js); scenes are registered here and
// stay reusable: the integration layer starts 'Battle' with its own data instead of the demo.
import Phaser from 'phaser';
import { parseLaunch } from './launch.js';
import { BootScene } from './scenes/BootScene.js';
import { BattleScene } from './scenes/BattleScene.js';

const launch = parseLaunch(window.location.search);
for (const warning of launch.warnings) console.warn(`[launch] ${warning}`);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b1222',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  // Sprites are drawn at ~1/3 of their pixel size; mipmaps keep them smooth instead of shimmering.
  mipmapFilter: 'LINEAR_MIPMAP_LINEAR',
  render: { antialias: true, roundPixels: false },
  input: { windowEvents: true },
  scene: [BootScene, BattleScene],
  callbacks: { preBoot: (g) => g.registry.set('launch', launch) },
});

// Dev hook for screenshots and console inspection.
window.__phaser = game;
