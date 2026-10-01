// The battlefield's static look. The ground is painted once into a single texture per board
// (ground-painter.js); on top sit a few hundred light prop images (trees, crags, cottages, keeps,
// pennants) and a handful of water shimmers. Nothing here knows about game rules.
import Phaser from 'phaser';
import { TILE_W, TILE_H, DEPTH, tileCenterX, tileCenterY } from './projection.js';
import { artFor, FACTION_COLORS } from './terrain-art.js';
import { paintGround } from './ground-painter.js';
import { paintFrame } from './ground-details.js';
import { layoutProps, TALL_KINDS, VARIANTS } from './prop-layout.js';
import * as painters from './prop-painters.js';
import { createRng, hashString } from './noise.js';

const FRAME_PAD = 48;
const FRAME_SKIRT = 26;
const FADE_ALPHA = 0.4;
const FADE_SPEED = 9; // per second

export class TerrainLayer {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.keys = []; // texture keys created for the current board, removed on destroy
    this.objects = [];
    this.props = []; // tall props that can fade: { image, x, footY, halfW, height, alpha }
    this.pennants = new Map(); // 'c,r' -> { cloth, phase }
    this.pennantList = []; // same entries as an array for the per-frame sway loop
    this.streaks = [];
    this.board = null;
  }

  /** Paint and place everything for a board. Replaces any previous board. */
  build(board, { paint = {}, seed = 1 } = {}) {
    this.destroy();
    this.board = board;
    const scene = this.scene;
    const id = board.id;
    const worldW = board.width * TILE_W;
    const worldH = board.height * TILE_H;

    // Ground texture.
    const ground = paintGround(board, { seed, paint });
    this.#registerCanvas(`terrain:${id}`, ground.canvas);
    this.#add(scene.add.image(0, 0, `terrain:${id}`).setOrigin(0, 0).setScale(1 / ground.scale).setDepth(DEPTH.GROUND));

    // Drop shadow and earth face behind the board.
    const frame = document.createElement('canvas');
    frame.width = worldW + FRAME_PAD * 2;
    frame.height = worldH + FRAME_PAD * 2 + FRAME_SKIRT;
    paintFrame(frame, worldW, worldH, FRAME_PAD, FRAME_SKIRT, createRng(hashString(id)));
    this.#registerCanvas(`terrain-frame:${id}`, frame);
    this.#add(scene.add.image(-FRAME_PAD, -FRAME_PAD, `terrain-frame:${id}`).setOrigin(0, 0).setDepth(DEPTH.GROUND - 1));

    this.#buildProps(board, seed);
    this.#buildWater(board, seed);
  }

  /** Recolour a village or keep pennant: faction name or null for neutral. */
  setOwner(c, r, faction) {
    const pennant = this.pennants.get(`${c},${r}`);
    if (pennant) pennant.cloth.setTint(FACTION_COLORS[faction] ?? FACTION_COLORS.neutral);
  }

  /**
   * Per-frame: sway pennants, shimmer water, fade tall props that hide a unit.
   * @param {number} time ms
   * @param {number} dt ms since last frame
   * @param {{ x: number, footY: number, halfW: number, height: number }[]} occluded unit boxes (world px)
   */
  update(time, dt, occluded = []) {
    const t = time / 1000;
    for (let i = 0; i < this.pennantList.length; i += 1) {
      const pennant = this.pennantList[i];
      pennant.cloth.scaleX = (1 + 0.1 * Math.sin(t * 3.1 + pennant.phase)) / painters.RES;
      pennant.cloth.rotation = 0.06 * Math.sin(t * 2.3 + pennant.phase);
    }
    for (const s of this.streaks) {
      const k = (Math.sin(t * s.speed + s.phase) + 1) / 2;
      s.image.alpha = 0.06 + 0.3 * k * k;
      s.image.x = s.x + Math.sin(t * 0.4 + s.phase) * 7;
    }
    const step = Math.min(1, (dt / 1000) * FADE_SPEED);
    for (const prop of this.props) {
      let blocking = false;
      for (let i = 0; i < occluded.length && !blocking; i += 1) {
        const u = occluded[i];
        // Only props standing in front of a unit (greater foot y) can hide it.
        if (prop.footY <= u.footY) continue;
        const overlapX = Math.min(prop.x + prop.halfW, u.x + u.halfW) - Math.max(prop.x - prop.halfW, u.x - u.halfW);
        const overlapY = Math.min(prop.footY, u.footY) - Math.max(prop.footY - prop.height, u.footY - u.height);
        blocking = overlapX > 8 && overlapY > 12;
      }
      const target = blocking ? FADE_ALPHA : 1;
      if (prop.alpha !== target) {
        prop.alpha += (target - prop.alpha) * step;
        if (Math.abs(prop.alpha - target) < 0.01) prop.alpha = target;
        prop.image.alpha = prop.alpha;
      }
    }
  }

  destroy() {
    for (const object of this.objects) object.destroy();
    for (const key of this.keys) if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.objects.length = 0;
    this.keys.length = 0;
    this.props.length = 0;
    this.streaks.length = 0;
    this.pennants.clear();
    this.pennantList.length = 0;
    this.board = null;
  }

  // ---- internals ---------------------------------------------------------------------------------

  #add(object) {
    this.objects.push(object);
    return object;
  }

  #registerCanvas(key, canvas) {
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.scene.textures.addCanvas(key, canvas);
    this.keys.push(key);
  }

  /** Paint every prop variant once and register it as a texture; returns key lookup by kind+variant. */
  #paintPropTextures(board, seed) {
    const rand = createRng(hashString(board.id) + seed * 7);
    const make = {
      pine: (v) => painters.paintPine(rand, v),
      oak: (v) => painters.paintOak(rand, v),
      bush: () => painters.paintBush(rand, false),
      flower: () => painters.paintBush(rand, true),
      crag: (v) => painters.paintCrag(rand, 0.95 + (v % 3) * 0.2),
      rubble: (v) => painters.paintCrag(rand, 0.4 + v * 0.1),
      cottage: (v) => painters.paintCottage(rand, v),
      keep: (v) => painters.paintKeep(v === 1 ? 'red' : 'blue'),
    };
    const table = {};
    for (const [kind, count] of Object.entries(VARIANTS)) {
      table[kind] = [];
      for (let v = 0; v < count; v += 1) {
        const prop = make[kind](v);
        const key = `prop:${board.id}:${kind}:${v}`;
        this.#registerCanvas(key, prop.canvas);
        table[kind].push({ key, ...prop });
      }
    }
    for (const [name, paint] of [['cloth', painters.paintPennantCloth], ['pole', painters.paintPole], ['streak', painters.paintStreak]]) {
      const prop = paint();
      const key = `prop:${board.id}:${name}`;
      this.#registerCanvas(key, prop.canvas);
      table[name] = { key, ...prop };
    }
    return table;
  }

  #buildProps(board, seed) {
    const scene = this.scene;
    const table = this.#paintPropTextures(board, seed);
    const R = painters.RES;
    this.textures = table;
    for (const placement of layoutProps(board, seed)) {
      const art = table[placement.kind][placement.variant];
      const flip = ((placement.c * 31 + placement.r * 17 + placement.variant) & 1) === 1 && placement.kind !== 'keep';
      const image = scene.add.image(placement.x, placement.footY, art.key)
        .setOrigin(art.ax / art.w, art.ay / art.h)
        .setScale((placement.scale / R) * (flip ? -1 : 1), placement.scale / R)
        .setDepth(placement.footY);
      this.#add(image);
      if (TALL_KINDS.has(placement.kind)) {
        this.props.push({
          image,
          x: placement.x,
          footY: placement.footY,
          halfW: (art.w * placement.scale) / 2 * 0.7,
          height: (art.h * placement.scale) * 0.9,
          alpha: 1,
        });
      }
      if (placement.kind === 'keep') this.#addPennant(board, placement.c, placement.r, placement.x, placement.footY - 78, placement.footY, 40, placement.owner);
      if (placement.kind === 'cottage') this.#addPennant(board, placement.c, placement.r, tileCenterX(placement.c) + 30, tileCenterY(placement.r) + 4, tileCenterY(placement.r) + 4, 36, null);
    }
  }

  #addPennant(board, c, r, x, baseY, depthY, height, owner) {
    const scene = this.scene;
    const R = painters.RES;
    const poleArt = this.textures.pole;
    const clothArt = this.textures.cloth;
    const scale = height / poleArt.h;
    this.#add(scene.add.image(x, baseY, poleArt.key).setOrigin(poleArt.ax / poleArt.w, poleArt.ay / poleArt.h)
      .setScale(1 / R, scale / R).setDepth(depthY + 0.2));
    const cloth = scene.add.image(x + 1, baseY - height + 2, clothArt.key)
      .setOrigin(0, 0.5).setScale(1 / R).setDepth(depthY + 0.3)
      .setTint(FACTION_COLORS[owner] ?? FACTION_COLORS.neutral);
    this.#add(cloth);
    const pennant = { cloth, phase: (c * 1.7 + r * 0.9) % 6.28 };
    this.pennants.set(`${c},${r}`, pennant);
    this.pennantList.push(pennant);
  }

  #buildWater(board, seed) {
    const rand = createRng(hashString(board.id) * 3 + seed);
    const art = this.textures.streak;
    for (const { c, r, letter } of board.tiles()) {
      const t = artFor(letter);
      if (t.ground !== 'water' || t.bridge) continue;
      for (let i = 0; i < 3; i += 1) {
        const x = tileCenterX(c) + (rand() - 0.5) * TILE_W * 0.85;
        const y = tileCenterY(r) + (rand() - 0.5) * TILE_H * 0.85;
        const image = this.scene.add.image(x, y, art.key).setScale((0.7 + rand()) / painters.RES * 1.0)
          .setDepth(DEPTH.GROUND_DECOR).setAlpha(0.1);
        this.#add(image);
        this.streaks.push({ image, x, phase: rand() * 6.28, speed: 0.8 + rand() * 0.8 });
      }
    }
  }
}
