// Tile highlights drawn flat on the ground from plain tile lists: selection, hover, move/attack
// range, danger zone, deployment tiles and the objective marker. No rules here; the caller decides
// which tiles belong in each set.
import { TILE_W, TILE_H, DEPTH, tileC, tileR, tileCenterX, tileCenterY } from './projection.js';

const INSET = 3;
const RADIUS = 9;

/** Draw order is the key order: later kinds paint over earlier ones. */
const STYLES = {
  danger: { fill: 0xff8a1f, fillAlpha: 0.14, line: 0xffa648, lineAlpha: 0.7, width: 1.5, hatch: true },
  deploy: { fill: 0x4ac46f, fillAlpha: 0.26, line: 0x9af0b4, lineAlpha: 0.95, width: 2, dashed: true },
  move: { fill: 0x3a7bff, fillAlpha: 0.3, line: 0x9cc2ff, lineAlpha: 0.95, width: 2 },
  attack: { fill: 0xe0453a, fillAlpha: 0.32, line: 0xff9d92, lineAlpha: 0.95, width: 2 },
  select: { fill: 0xffd34d, fillAlpha: 0.2, line: 0xffd34d, lineAlpha: 1, width: 3 },
  hover: { fill: 0xffffff, fillAlpha: 0.12, line: 0xffffff, lineAlpha: 0.9, width: 2 },
};
export const OVERLAY_KINDS = Object.freeze(Object.keys(STYLES));

export class Overlays {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.sets = new Map(OVERLAY_KINDS.map((kind) => [kind, []]));
    this.ground = scene.add.graphics().setDepth(DEPTH.OVERLAY);
    this.marker = scene.add.graphics().setDepth(DEPTH.ABOVE_UNITS);
    this.objective = null;
    this.dirty = true;
    this.listeners = new Set();
  }

  /** Replace one kind's tiles ({c,r} or [c,r]). Passing null/[] clears it. */
  set(kind, tiles) {
    if (!this.sets.has(kind)) throw new Error(`unknown overlay '${kind}'`);
    const list = [];
    for (const tile of tiles ?? []) list.push(tileC(tile), tileR(tile));
    this.sets.set(kind, list);
    this.dirty = true;
    for (const listener of this.listeners) listener(kind, list);
  }

  /** Remove one kind, or everything (except the objective marker) when no kind is given. */
  clear(kind) {
    if (kind) this.set(kind, []);
    else for (const name of OVERLAY_KINDS) this.set(name, []);
  }

  has(kind, c, r) {
    const list = this.sets.get(kind);
    for (let i = 0; i < list.length; i += 2) if (list[i] === c && list[i + 1] === r) return true;
    return false;
  }

  /** Objective or checkpoint marker: a pulsing ring and bobbing arrow. Pass null to remove. */
  setObjective(tile, { color = 0xffd34d } = {}) {
    this.objective = tile ? { c: tileC(tile), r: tileR(tile), color } : null;
    this.marker.clear();
  }

  /** Subscribe to set changes (kind, flat [c, r, c, r, ...]); the scene uses this to see through trees. */
  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  update(time) {
    if (this.dirty) { this.#redraw(); this.dirty = false; }
    if (this.objective) this.#drawObjective(time / 1000);
  }

  destroy() {
    this.ground.destroy();
    this.marker.destroy();
    this.listeners.clear();
  }

  #redraw() {
    const g = this.ground;
    g.clear();
    for (const kind of OVERLAY_KINDS) {
      const list = this.sets.get(kind);
      if (!list.length) continue;
      const style = STYLES[kind];
      for (let i = 0; i < list.length; i += 2) {
        const x = list[i] * TILE_W + INSET;
        const y = list[i + 1] * TILE_H + INSET;
        const w = TILE_W - INSET * 2;
        const h = TILE_H - INSET * 2;
        g.fillStyle(style.fill, style.fillAlpha);
        g.fillRoundedRect(x, y, w, h, RADIUS);
        if (style.hatch) hatch(g, x, y, w, h, style);
        g.lineStyle(style.width, style.line, style.lineAlpha);
        if (style.dashed) dashedRect(g, x, y, w, h);
        else g.strokeRoundedRect(x, y, w, h, RADIUS);
      }
    }
  }

  #drawObjective(t) {
    const { c, r, color } = this.objective;
    const g = this.marker;
    const x = tileCenterX(c);
    const y = tileCenterY(r);
    const pulse = (Math.sin(t * 3) + 1) / 2;
    g.clear();
    g.lineStyle(3, color, 0.9 - pulse * 0.4);
    g.strokeEllipse(x, y + 6, 70 + pulse * 14, 34 + pulse * 7);
    const bob = Math.sin(t * 4) * 4;
    const ay = y - 62 + bob;
    g.fillStyle(color, 1);
    g.fillTriangle(x - 11, ay, x + 11, ay, x, ay + 16);
    g.lineStyle(2, 0x14101c, 0.9);
    g.strokeTriangle(x - 11, ay, x + 11, ay, x, ay + 16);
  }
}

function hatch(g, x, y, w, h, style) {
  g.lineStyle(1, style.line, 0.45);
  g.beginPath();
  for (let k = 10; k < w + h - 10; k += 10) {
    // 45-degree line x + y = k clipped to the rectangle.
    const x0 = Math.min(k, w);
    const y0 = k - x0;
    const y1 = Math.min(k, h);
    const x1 = k - y1;
    g.moveTo(x + x0, y + y0);
    g.lineTo(x + x1, y + y1);
  }
  g.strokePath();
}

function dashedRect(g, x, y, w, h) {
  const dash = 9;
  const gap = 6;
  const edges = [[x + RADIUS, y, x + w - RADIUS, y], [x + w, y + RADIUS, x + w, y + h - RADIUS],
    [x + w - RADIUS, y + h, x + RADIUS, y + h], [x, y + h - RADIUS, x, y + RADIUS]];
  g.beginPath();
  for (const [x0, y0, x1, y1] of edges) {
    const length = Math.hypot(x1 - x0, y1 - y0);
    const ux = (x1 - x0) / length;
    const uy = (y1 - y0) / length;
    for (let d = 0; d < length; d += dash + gap) {
      const e = Math.min(d + dash, length);
      g.moveTo(x0 + ux * d, y0 + uy * d);
      g.lineTo(x0 + ux * e, y0 + uy * e);
    }
  }
  g.strokePath();
}

