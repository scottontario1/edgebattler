// Pointer -> tile and unit picking. Emits `tile:hover`, `unit:hover`, `tile:click`, `unit:click`
// through the shared emitter and knows nothing about rules. Units are hit-tested against their
// sprite alpha, front-most first, so clicking a transparent cape corner falls through to the tile.
import Phaser from 'phaser';
import { worldToTile } from './projection.js';

export class Picking {
  /**
   * @param {Phaser.Scene} scene
   * @param {{ rig: import('./CameraRig.js').CameraRig, events: ReturnType<import('./emitter.js').createEmitter>,
   *           getBoard: () => object|null, getViews: () => Iterable<import('./UnitView.js').UnitView> }} deps
   */
  constructor(scene, { rig, events, getBoard, getViews }) {
    this.scene = scene;
    this.rig = rig;
    this.events = events;
    this.getBoard = getBoard;
    this.getViews = getViews;
    this.hoverTile = { c: -1, r: -1 };
    this.hoverUnit = null;
    this.tile = { c: 0, r: 0 };
    this.world = new Phaser.Math.Vector2();
    scene.input.on('pointermove', this.#onMove, this);
    scene.input.on('pointerup', this.#onUp, this);
    scene.events.once('shutdown', () => this.destroy());
  }

  /** Tile under a screen point, or null when off the board. The returned object is reused. */
  tileAt(x, y) {
    const board = this.getBoard();
    if (!board) return null;
    const world = this.rig.screenToWorld(x, y);
    worldToTile(world.x, world.y, this.tile);
    return board.inBounds(this.tile.c, this.tile.r) ? this.tile : null;
  }

  /** Front-most unit view whose drawing is opaque under a screen point, or null. */
  unitAt(x, y) {
    const world = this.rig.screenToWorld(x, y);
    let best = null;
    for (const view of this.getViews()) {
      if (view.dead || !view.container.visible) continue;
      if (best && view.container.depth < best.container.depth) continue;
      if (view.hitTest(world.x, world.y)) best = view;
    }
    return best;
  }

  destroy() {
    this.scene.input.off('pointermove', this.#onMove, this);
    this.scene.input.off('pointerup', this.#onUp, this);
  }

  #onMove(pointer) {
    if (this.rig.dragging) return;
    const unit = this.unitAt(pointer.x, pointer.y);
    if ((unit?.id ?? null) !== (this.hoverUnit?.id ?? null)) {
      this.hoverUnit = unit;
      this.events.emit('unit:hover', unit ? { id: unit.id } : null);
    }
    const tile = this.tileAt(pointer.x, pointer.y);
    const c = tile ? tile.c : -1;
    const r = tile ? tile.r : -1;
    if (c !== this.hoverTile.c || r !== this.hoverTile.r) {
      this.hoverTile.c = c;
      this.hoverTile.r = r;
      this.events.emit('tile:hover', tile ? { c, r } : null);
    }
  }

  #onUp(pointer) {
    if (this.rig.dragged) return; // the press became a pan or pinch
    const point = { x: pointer.x, y: pointer.y };
    const unit = this.unitAt(pointer.x, pointer.y);
    if (unit) {
      this.events.emit('unit:click', { id: unit.id, c: unit.c, r: unit.r, pointer: point });
      return;
    }
    const tile = this.tileAt(pointer.x, pointer.y);
    if (tile) this.events.emit('tile:click', { c: tile.c, r: tile.r, pointer: point });
  }
}
