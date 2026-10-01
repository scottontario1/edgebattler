// The battlefield scene: composes terrain, units, overlays, camera and picking behind a small API
// that the session/HUD layers drive. It holds no rules: it draws the board and unit records it is
// given and reports what the pointer touches.
import Phaser from 'phaser';
import { createBoard } from '../../core/rules/board.js';
import { MAPS } from '../../core/content/maps/index.js';
import { TerrainLayer } from '../world/TerrainLayer.js';
import { UnitView } from '../world/UnitView.js';
import { Overlays } from '../world/Overlays.js';
import { CameraRig } from '../world/CameraRig.js';
import { Picking } from '../world/Picking.js';
import { createEmitter } from '../world/emitter.js';
import { resolveArt } from '../world/unit-art.js';
import { ensureSharedTextures } from '../world/shared-textures.js';
import { installWorldDemo } from './world-demo.js';

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
    this.board = null;
    this.views = new Map();
    this.viewList = []; // same views as an array: iterating it each frame allocates nothing
    this.occluded = [];
  }

  /**
   * Demo boot data or an initial world snapshot. The latter is plain game data at the Phaser
   * boundary; the session owns the match and sends later snapshots through `showWorld` / `syncUnits`.
   * @param {{ demo?: string|null, mapId?: string, board?: object, units?: object[], seed?: number,
   *           owners?: { c: number, r: number, faction: string|null }[],
   *           objective?: { c: number, r: number, color?: number }|null }} launch
   */
  init(launch) {
    this.launch = launch ?? {};
  }

  create() {
    ensureSharedTextures(this);
    this.cameras.main.setBackgroundColor('#0b1222');
    this.art = this.registry.get('art') ?? { classic: {}, factions: {} };
    this.paint = this.registry.get('paint') ?? {};

    // Not `events`: Phaser.Scene owns that name (its own EventEmitter).
    /** Outgoing events: tile:hover, tile:click, unit:hover, unit:click (see world/emitter.js). */
    this.worldEvents = createEmitter();
    this.terrain = new TerrainLayer(this);
    this.overlays = new Overlays(this);
    this.camera = new CameraRig(this);
    this.picking = new Picking(this, {
      rig: this.camera,
      events: this.worldEvents,
      getBoard: () => this.board,
      getViews: () => this.viewList,
    });
    this.sys.events.once('shutdown', () => this.#teardown());

    if (this.launch.demo === 'world') installWorldDemo(this, this.launch);
    else if (this.launch.board) this.showWorld(this.launch);
    this.game.events.emit('battle:ready', this);
  }

  // ---- API for the integration layer -------------------------------------------------------------

  /** Show a board (result of createBoard) and fit the camera to it. Removes all unit views. */
  setBoard(board, { seed = 1 } = {}) {
    this.clearUnits();
    this.board = board;
    this.terrain.build(board, { paint: this.paint, seed });
    this.camera.setBoard(board.width, board.height);
    this.overlays.clear();
    this.overlays.setObjective(null);
  }

  /**
   * Replace the visible world from a data snapshot. `board` is a core `createBoard()` result;
   * `units` are plain unit records with `id`, `faction`, `c`, `r`, `hp`, and `maxHp`. Art identity
   * resolves from `spriteKey`, `variantId`, `unitId`/`id`, then `cls`. This method only builds views:
   * it does not retain or modify the supplied records.
   * @param {{ board: object, units?: object[], seed?: number,
   *           owners?: { c: number, r: number, faction: string|null }[],
   *           objective?: { c: number, r: number, color?: number }|null }} snapshot
   */
  showWorld({ board, units = [], seed = 1, owners = [], objective = null }) {
    if (!board || typeof board.tiles !== 'function' || typeof board.inBounds !== 'function') {
      throw new TypeError('BattleScene.showWorld expects a board returned by createBoard()');
    }
    this.setBoard(board, { seed });
    this.syncUnits(units);
    for (const { c, r, faction } of owners) this.terrain.setOwner(c, r, faction);
    this.overlays.setObjective(objective);
  }

  /** Convenience for launches that only know a map id. */
  setBoardById(mapId) {
    this.setBoard(createBoard(MAPS[mapId] ?? MAPS.river_ford));
  }

  /**
   * Reconcile unit views with plain records: creates, updates (snapping idle views to their tile) and
   * removes views. Views that are mid-animation keep their position until the animation ends.
   */
  syncUnits(records) {
    const seen = new Set();
    for (const record of records) {
      seen.add(record.id);
      let view = this.views.get(record.id);
      if (!view) {
        view = new UnitView(this, record, resolveArt(record, this.art));
        view.speed = this.playbackSpeed ?? 1;
        this.views.set(record.id, view);
      } else {
        view.update(record);
      }
    }
    for (const [id, view] of this.views) {
      if (!seen.has(id)) { view.destroy(); this.views.delete(id); }
    }
    this.viewList = [...this.views.values()];
  }

  /** The view for a unit id (or undefined). Use it to run animations: await scene.unitView(id).moveAlong(path). */
  unitView(id) {
    return this.views.get(id);
  }

  clearUnits() {
    for (const view of this.views.values()) view.destroy();
    this.views.clear();
    this.viewList = [];
  }

  /** Set the HUD insets ({top,right,bottom,left} in screen px); the board refits into what remains. */
  setInsets(insets) {
    this.camera.setInsets(insets);
  }

  /** 1 = normal; scales every unit animation. */
  setPlaybackSpeed(speed) {
    this.playbackSpeed = speed;
    for (const view of this.views.values()) view.speed = speed;
  }

  /** Mark the selected unit's ring; pass null to clear. */
  select(id) {
    if (this.selectedId === id) return;
    this.views.get(this.selectedId)?.setSelected(false);
    this.selectedId = id ?? null;
    this.views.get(this.selectedId)?.setSelected(true);
  }

  // ---- frame loop --------------------------------------------------------------------------------

  update(time, delta) {
    this.overlays.update(time);
    // Boxes of live units (reused objects, no per-frame allocation after warm-up).
    let n = 0;
    for (let i = 0; i < this.viewList.length; i += 1) {
      const view = this.viewList[i];
      if (view.dead) continue;
      const box = this.occluded[n] ?? (this.occluded[n] = { x: 0, footY: 0, halfW: 0, height: 0 });
      box.x = view.x;
      box.footY = view.y;
      box.halfW = view.metrics.width * 0.25;
      box.height = view.metrics.height * 0.85;
      n += 1;
    }
    this.occluded.length = n;
    this.terrain.update(time, delta, this.occluded);
  }

  #teardown() {
    this.clearUnits();
    this.terrain.destroy();
    this.overlays.destroy();
    this.worldEvents.clear();
  }
}
