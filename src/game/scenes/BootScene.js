// Preloads everything the world needs: both sprite manifests, every sprite PNG they name, and the
// painted terrain detail maps. All art is optional at runtime: a missing file logs a warning and the
// game falls back (placeholder pawns, plain paint) instead of crashing.
import Phaser from 'phaser';
import { artFile, textureKeyFor } from '../world/unit-art.js';

const BASE = import.meta.env?.BASE_URL ?? '/';
export const PAINT_SETS = { grass: 4, dirt: 4, stone: 4, water: 4 };

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.#progressBar();
    this.load.on('loaderror', (file) => console.warn(`[boot] missing optional art: ${file.src}`));
    this.load.setPath(BASE);

    this.load.json('manifest:classic', 'sprites/manifest.json');
    this.load.json('manifest:factions', 'sprites/factions-manifest.json');
    // The PNG lists come from the manifests, so queue them as soon as each manifest arrives.
    this.load.on('filecomplete-json-manifest:classic', (key, type, data) => {
      for (const [name, info] of Object.entries(data)) {
        for (const side of Object.keys(info.files ?? {})) {
          this.load.image(textureKeyFor('classic', name, side), artFile('classic', info, side));
        }
      }
    });
    this.load.on('filecomplete-json-manifest:factions', (key, type, data) => {
      for (const [name, info] of Object.entries(data.units ?? {})) {
        this.load.image(textureKeyFor('faction', name), artFile('faction', info));
      }
    });

    for (const [set, count] of Object.entries(PAINT_SETS)) {
      for (let i = 1; i <= count; i += 1) this.load.image(`paint:${set}_${i}`, `textures/painted/${set}_${i}.jpg`);
    }
  }

  create() {
    const cache = this.cache.json;
    const classic = cache.get('manifest:classic') ?? {};
    const factions = cache.get('manifest:factions')?.units ?? {};
    // Painted detail maps as ready-to-draw images, grouped by set.
    const paint = {};
    for (const [set, count] of Object.entries(PAINT_SETS)) {
      paint[set] = [];
      for (let i = 1; i <= count; i += 1) {
        const key = `paint:${set}_${i}`;
        if (this.textures.exists(key)) paint[set].push(this.textures.get(key).getSourceImage());
      }
    }
    this.registry.set('art', { classic, factions });
    this.registry.set('paint', paint);
    this.scene.start('Battle', this.registry.get('launch'));
  }

  #progressBar() {
    const { width, height } = this.scale;
    const frame = this.add.graphics();
    const bar = this.add.graphics();
    const label = this.add.text(width / 2, height / 2 - 28, 'Loading', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#cfd8ea',
    }).setOrigin(0.5);
    const w = Math.min(320, width * 0.7);
    const x = (width - w) / 2;
    const y = height / 2;
    frame.fillStyle(0x1b2540, 1).fillRoundedRect(x - 3, y - 3, w + 6, 18, 6);
    this.load.on('progress', (value) => {
      bar.clear().fillStyle(0xf0b830, 1).fillRoundedRect(x, y, w * value, 12, 4);
    });
    this.load.once('complete', () => { frame.destroy(); bar.destroy(); label.destroy(); });
  }
}
