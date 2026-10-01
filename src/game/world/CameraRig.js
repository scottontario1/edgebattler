// Camera control: fit the board into the screen area the HUD leaves free, drag to pan, wheel and
import Phaser from 'phaser';
// pinch to zoom, focus on a tile. The maths lives in camera-fit.js; this class only wires it to
// Phaser's camera and pointers.
import { TILE_W, TILE_H, tileCenterX, tileCenterY } from './projection.js';
import { freeRect, fitZoom, zoomLimits, cameraCenterFor, clampFocus, focusAfterZoom } from './camera-fit.js';

const DRAG_THRESHOLD = 8; // px before a press becomes a pan (so clicks stay clicks)
const SKIRT = 30; // the earthen south face under the board counts as part of what must fit

export class CameraRig {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.boardW = 0;
    this.boardH = 0;
    this.insets = { top: 0, right: 0, bottom: 0, left: 0 };
    this.focusPoint = { x: 0, y: 0 }; // world point shown at the middle of the free area
    this.zoom = 1;
    this.fit = 1;
    this.limits = { min: 0.2, max: 2.4 };
    this.userMoved = false;
    this.dragging = false;
    /** True from the moment a press turns into a pan until the next press: Picking uses it to ignore the release. */
    this.dragged = false;
    this.press = { x: 0, y: 0, lastX: 0, lastY: 0, active: false };
    this.pinch = { active: false, distance: 0, midX: 0, midY: 0 };
    this.world = { x: 0, y: 0 };
    this.free = freeRect(scene.scale.width, scene.scale.height);

    const input = scene.input;
    input.addPointer(1); // two touch pointers for pinch
    input.on('pointerdown', this.#onDown, this);
    input.on('pointermove', this.#onMove, this);
    input.on('pointerup', this.#onUp, this);
    input.on('pointerupoutside', this.#onUp, this);
    input.on('wheel', this.#onWheel, this);
    scene.scale.on('resize', this.#onResize, this);
    scene.events.once('shutdown', () => this.destroy());
  }

  /** Track a new board and fit it to the free area. */
  setBoard(cols, rows) {
    this.boardW = cols * TILE_W;
    this.boardH = rows * TILE_H;
    this.fitToView();
  }

  /** HUD insets in screen px. Re-fits unless the player has moved the camera. */
  setInsets(insets) {
    this.insets = { top: 0, right: 0, bottom: 0, left: 0, ...insets };
    this.#recompute();
    if (this.userMoved) this.#apply();
    else this.fitToView();
  }

  /** Reset to the whole board in view. */
  fitToView() {
    this.userMoved = false;
    this.#recompute();
    this.zoom = this.fit;
    this.focusPoint.x = this.boardW / 2;
    this.focusPoint.y = this.boardH / 2 + SKIRT / 2;
    this.#apply();
  }

  /** Centre the free area on a tile; resolves when the move ends. */
  focus(c, r, { duration = 0, zoom } = {}) {
    const target = { x: tileCenterX(c), y: tileCenterY(r) };
    const toZoom = zoom ? Math.min(this.limits.max, Math.max(this.limits.min, zoom)) : this.zoom;
    this.userMoved = true;
    if (!duration) {
      this.zoom = toZoom;
      this.focusPoint.x = target.x;
      this.focusPoint.y = target.y;
      this.#apply();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const from = { x: this.focusPoint.x, y: this.focusPoint.y, z: this.zoom };
      this.scene.tweens.addCounter({
        from: 0, to: 1, duration, ease: 'Sine.easeInOut',
        onUpdate: (tween) => {
          const k = tween.getValue();
          this.focusPoint.x = from.x + (target.x - from.x) * k;
          this.focusPoint.y = from.y + (target.y - from.y) * k;
          this.zoom = from.z + (toZoom - from.z) * k;
          this.#apply();
        },
        onComplete: resolve,
      });
    });
  }

  /** Screen point -> world point (reuses one object; copy it if you keep it). */
  screenToWorld(x, y) {
    return this.camera.getWorldPoint(x, y, this.#vec ??= new Phaser.Math.Vector2());
  }

  destroy() {
    const input = this.scene.input;
    input.off('pointerdown', this.#onDown, this);
    input.off('pointermove', this.#onMove, this);
    input.off('pointerup', this.#onUp, this);
    input.off('pointerupoutside', this.#onUp, this);
    input.off('wheel', this.#onWheel, this);
    this.scene.scale.off('resize', this.#onResize, this);
  }

  // ---- internals ---------------------------------------------------------------------------------

  #vec = null;

  #recompute() {
    const { width, height } = this.scene.scale;
    this.free = freeRect(width, height, this.insets);
    this.fit = fitZoom(this.free, this.boardW || 1, (this.boardH || 1) + SKIRT);
    this.limits = zoomLimits(this.fit);
  }

  #apply() {
    const { width, height } = this.scene.scale;
    this.zoom = Math.min(this.limits.max, Math.max(this.limits.min, this.zoom));
    const clamped = clampFocus(this.focusPoint, this.boardW, this.boardH, this.zoom, this.free);
    this.focusPoint.x = clamped.x;
    this.focusPoint.y = clamped.y;
    const centre = cameraCenterFor(this.focusPoint, this.zoom, this.free, width, height);
    this.camera.setZoom(this.zoom);
    this.camera.centerOn(centre.x, centre.y);
  }

  #onResize() {
    this.#recompute();
    if (this.userMoved) this.#apply();
    else this.fitToView();
  }

  #onDown(pointer) {
    this.dragged = false;
    this.press.x = this.press.lastX = pointer.x;
    this.press.y = this.press.lastY = pointer.y;
    this.press.active = true;
    this.dragging = false;
  }

  #onMove(pointer) {
    const input = this.scene.input;
    const a = input.pointer1;
    const b = input.pointer2;
    if (a.isDown && b.isDown) { this.#pinchMove(a, b); return; }
    this.pinch.active = false;
    if (!pointer.isDown || !this.press.active) return;
    if (!this.dragging) {
      if (Math.hypot(pointer.x - this.press.x, pointer.y - this.press.y) < DRAG_THRESHOLD) return;
      this.dragging = true;
      this.dragged = true;
      this.press.lastX = pointer.x;
      this.press.lastY = pointer.y;
    }
    this.focusPoint.x -= (pointer.x - this.press.lastX) / this.zoom;
    this.focusPoint.y -= (pointer.y - this.press.lastY) / this.zoom;
    this.press.lastX = pointer.x;
    this.press.lastY = pointer.y;
    this.userMoved = true;
    this.#apply();
  }

  #pinchMove(a, b) {
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    this.dragged = true;
    this.dragging = true;
    if (this.pinch.active && this.pinch.distance > 0) {
      const world = this.screenToWorld(this.pinch.midX, this.pinch.midY);
      const wx = world.x;
      const wy = world.y;
      this.zoom *= distance / this.pinch.distance;
      this.zoom = Math.min(this.limits.max, Math.max(this.limits.min, this.zoom));
      // Keep the pinched world point under the fingers as they move.
      const focus = focusAfterZoom({ x: wx, y: wy }, { x: midX, y: midY }, this.zoom, this.free);
      this.focusPoint.x = focus.x;
      this.focusPoint.y = focus.y;
      this.userMoved = true;
      this.#apply();
    }
    this.pinch.active = true;
    this.pinch.distance = distance;
    this.pinch.midX = midX;
    this.pinch.midY = midY;
  }

  #onUp(pointer) {
    this.press.active = false;
    this.dragging = false;
    if (!this.scene.input.pointer2.isDown) this.pinch.active = false;
    void pointer;
  }

  #onWheel(pointer, over, dx, dy) {
    const world = this.screenToWorld(pointer.x, pointer.y);
    const wx = world.x;
    const wy = world.y;
    this.zoom *= Math.exp(-dy * 0.0013);
    this.zoom = Math.min(this.limits.max, Math.max(this.limits.min, this.zoom));
    const focus = focusAfterZoom({ x: wx, y: wy }, { x: pointer.x, y: pointer.y }, this.zoom, this.free);
    this.focusPoint.x = focus.x;
    this.focusPoint.y = focus.y;
    this.userMoved = true;
    this.#apply();
  }
}
