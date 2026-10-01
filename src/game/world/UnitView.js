// A unit on the battlefield. It renders a plain unit record and never mutates it: the match owns
// state, the view owns pixels. Animation primitives return promises so the playback layer can
// sequence them (await view.moveAlong(path); await view.lunge(target); ...).
import Phaser from 'phaser';
import { DEPTH, tileFoot, tileC, tileR } from './projection.js';
import { drawMetrics } from './unit-art.js';
import { alphaMaskFor } from './alpha-mask.js';
import { FACTION_COLORS } from './terrain-art.js';

const BAR_W = 44;
const BAR_H = 6;
const STEP_MS = 190; // time to walk one tile
const RING = { w: 74, h: 36 };
const HIT_ALPHA = 40; // alpha (0..255) above which a pixel counts as part of the drawing

export class UnitView {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} record plain unit record ({ id, faction, c, r, hp, maxHp, facing?, done? })
   * @param {object|null} art result of resolveArt(); null draws a placeholder pawn
   */
  constructor(scene, record, art) {
    this.scene = scene;
    this.id = record.id;
    this.faction = record.faction;
    this.art = art;
    this.speed = 1;
    this.busy = false; // true while an animation owns the position
    this.dead = false;
    this.c = record.c;
    this.r = record.r;
    this.hp = record.hp;
    this.maxHp = record.maxHp;
    this.shownHp = record.hp;
    this.facing = record.facing ? (record.facing === 'left' ? -1 : 1) : (record.faction === 'red' ? -1 : 1);
    this.pending = new Set();
    this.bob = 0;

    const foot = tileFoot(record.c, record.r);
    const container = scene.add.container(foot.x, foot.y);
    this.container = container;
    this.metrics = art ? drawMetrics(art.info) : placeholderMetrics();

    this.ring = scene.add.graphics();
    this.#drawRing();
    this.ring.setVisible(false);
    container.add(this.ring);

    this.shadow = scene.add.image(0, 2, 'world:shadow').setDisplaySize(this.metrics.footWidth * 1.15, this.metrics.footWidth * 0.5);
    container.add(this.shadow);

    this.sprite = art ? scene.add.image(0, 0, art.textureKey) : this.#placeholder(record.faction);
    if (art) this.sprite.setScale(this.metrics.scale);
    container.add(this.sprite);
    this.#applyFacing();

    this.bar = scene.add.graphics();
    container.add(this.bar);
    this.#drawBar();

    this.mask = art ? alphaMaskFor(scene.textures, art.textureKey) : null;
    this.#applyDone(Boolean(record.done));
    container.setDepth(foot.y);
  }

  /** Foot position in world pixels. */
  get x() { return this.container.x; }
  get y() { return this.container.y; }

  /** Apply the latest record without animating: hp, side, facing, done flag, and position when idle. */
  update(record) {
    if (record.faction !== this.faction) this.faction = record.faction;
    if (!this.busy) this.moveTo(record.c, record.r);
    if (record.hp !== this.hp || record.maxHp !== this.maxHp) this.setHp(record.hp, record.maxHp);
    if (record.facing) this.setFacing(record.facing === 'left' ? -1 : 1);
    this.#applyDone(Boolean(record.done));
  }

  /** Snap to a tile (no animation). */
  moveTo(c, r) {
    this.c = c;
    this.r = r;
    const foot = tileFoot(c, r);
    this.container.setPosition(foot.x, foot.y);
    this.container.setDepth(foot.y);
  }

  setFacing(direction) {
    if (direction === this.facing) return;
    this.facing = direction;
    this.#applyFacing();
  }

  setSelected(on) {
    this.ring.setVisible(on);
    if (this.selectTween) { this.selectTween.remove(); this.selectTween = null; }
    if (on) {
      this.ring.setAlpha(1);
      this.selectTween = this.scene.tweens.add({ targets: this.ring, alpha: 0.55, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  setHp(hp, maxHp = this.maxHp, animate = true) {
    this.hp = hp;
    this.maxHp = maxHp;
    if (!animate) { this.shownHp = hp; this.#drawBar(); return; }
    this.scene.tweens.addCounter({
      from: this.shownHp,
      to: hp,
      duration: 260,
      onUpdate: (tween) => { this.shownHp = tween.getValue(); this.#drawBar(); },
      onComplete: () => { this.shownHp = hp; this.#drawBar(); },
    });
  }

  setDimmed(on) { this.#applyDone(on); }

  /** Walk along a path of tiles ({c, r} or [c, r]); the first entry may be the current tile. */
  async moveAlong(path) {
    this.busy = true;
    for (const step of path) {
      const c = tileC(step);
      const r = tileR(step);
      if (c === this.c && r === this.r) continue;
      const to = tileFoot(c, r);
      if (to.x !== this.container.x) this.setFacing(to.x > this.container.x ? 1 : -1);
      await this.#tween({
        targets: this.container,
        x: to.x,
        y: to.y,
        duration: STEP_MS / this.speed,
        ease: 'Sine.easeInOut',
        onUpdate: (tween) => {
          this.container.setDepth(this.container.y);
          // A small hop per tile so units step rather than slide.
          this.sprite.y = -Math.sin(tween.progress * Math.PI) * 5;
        },
      });
      this.sprite.y = 0;
      this.c = c;
      this.r = r;
    }
    this.busy = false;
  }

  /** Lunge toward a tile and recoil; resolves when the unit is back, `onImpact` fires at the peak. */
  async lunge(target, onImpact) {
    const to = tileFoot(tileC(target), tileR(target));
    const dx = to.x - this.container.x;
    const dy = to.y - this.container.y;
    const length = Math.hypot(dx, dy) || 1;
    const reach = Math.min(34, length * 0.45);
    if (Math.abs(dx) > 4) this.setFacing(dx > 0 ? 1 : -1);
    const home = { x: this.container.x, y: this.container.y };
    this.busy = true;
    await this.#tween({
      targets: this.container,
      x: home.x + (dx / length) * reach,
      y: home.y + (dy / length) * reach,
      duration: 110 / this.speed,
      ease: 'Quad.easeOut',
      onUpdate: () => this.container.setDepth(this.container.y),
    });
    onImpact?.();
    await this.#tween({
      targets: this.container, x: home.x, y: home.y, duration: 190 / this.speed, ease: 'Quad.easeInOut',
      onUpdate: () => this.container.setDepth(this.container.y),
    });
    this.container.setDepth(home.y);
    this.busy = false;
  }

  /** White flash plus a little shake when struck. */
  async hitFlash() {
    const sprite = this.sprite;
    if (!sprite.setTint) return;
    sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    const ox = sprite.x;
    await this.#tween({
      targets: sprite, x: ox + 4, duration: 45 / this.speed, yoyo: true, repeat: 2, ease: 'Sine.easeInOut',
    });
    sprite.x = ox;
    sprite.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
    this.#applyDone(this.done ?? false);
  }

  /** Sink and fade; the view stays (hidden) until the scene removes it. */
  async die() {
    this.dead = true;
    this.setSelected(false);
    this.scene.tweens.add({ targets: this.bar, alpha: 0, duration: 150 });
    this.scene.tweens.add({ targets: this.sprite, y: 8, duration: 520 / this.speed, ease: 'Quad.easeIn' });
    await this.#tween({ targets: [this.sprite, this.shadow], alpha: 0, duration: 520 / this.speed, ease: 'Quad.easeIn' });
    this.container.setVisible(false);
  }

  /** Rising number or word above the head. Resolves when it has faded. */
  floatText(text, colour = '#ffffff') {
    const label = this.scene.add.text(this.container.x, this.container.y - this.metrics.height * 0.75, String(text), {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: colour,
      stroke: '#14101c',
      strokeThickness: 4,
    }).setOrigin(0.5, 1).setDepth(DEPTH.FLOATING).setResolution(2);
    return this.#tween({
      targets: label,
      y: label.y - 34,
      alpha: { from: 1, to: 0 },
      duration: 900 / this.speed,
      ease: 'Cubic.easeOut',
    }).then(() => label.destroy());
  }

  /** True when a world point lands on an opaque part of the drawing (or the placeholder body). */
  hitTest(wx, wy) {
    const lx = wx - this.container.x;
    const ly = wy - this.container.y;
    const m = this.metrics;
    const flip = this.facing < 0 ? 1 : 0;
    const originX = flip ? 1 - m.anchorX : m.anchorX;
    const left = -originX * m.width;
    const top = -m.anchorY * m.height;
    if (lx < left || lx > left + m.width || ly < top || ly > top + m.height) return false;
    if (!this.mask) return true;
    const px = ((lx - left) / m.width) * this.mask.w;
    const py = ((ly - top) / m.height) * this.mask.h;
    return this.mask.alphaAt(flip ? this.mask.w - px : px, py) > HIT_ALPHA;
  }

  destroy() {
    if (this.selectTween) this.selectTween.remove();
    this.scene.tweens.killTweensOf([this.container, this.sprite, this.shadow, this.bar, this.ring]);
    for (const resolve of this.pending) resolve();
    this.pending.clear();
    this.container.destroy();
  }

  // ---- internals ---------------------------------------------------------------------------------

  #tween(config) {
    return new Promise((resolve) => {
      this.pending.add(resolve);
      const done = () => { this.pending.delete(resolve); resolve(); };
      this.scene.tweens.add({ ...config, onComplete: done });
    });
  }

  #applyFacing() {
    const flip = this.facing < 0;
    if (this.art) {
      this.sprite.setFlipX(flip);
      this.sprite.setOrigin(flip ? 1 - this.metrics.anchorX : this.metrics.anchorX, this.metrics.anchorY);
    } else {
      this.sprite.scaleX = flip ? -1 : 1;
    }
  }

  #applyDone(done) {
    this.done = done;
    if (!this.sprite.setTint) return;
    if (done) this.sprite.setTint(0x8a8a96);
    else this.sprite.clearTint();
  }

  #drawRing() {
    const g = this.ring;
    g.clear();
    g.fillStyle(0xffd34d, 0.16);
    g.fillEllipse(0, 0, RING.w, RING.h);
    g.lineStyle(3, 0xffd34d, 1);
    g.strokeEllipse(0, 0, RING.w, RING.h);
    g.lineStyle(1.5, 0x14101c, 0.7);
    g.strokeEllipse(0, 0, RING.w + 4, RING.h + 3);
  }

  #drawBar() {
    const g = this.bar;
    const y = 9;
    const x = -BAR_W / 2 + 4;
    const ratio = Phaser.Math.Clamp(this.shownHp / (this.maxHp || 1), 0, 1);
    g.clear();
    g.fillStyle(0x14101c, 0.85);
    g.fillRoundedRect(x - 1.5, y - 1.5, BAR_W + 3, BAR_H + 3, 3);
    g.fillStyle(0x3a3346, 1);
    g.fillRect(x, y, BAR_W, BAR_H);
    const colour = ratio > 0.55 ? 0x58c46a : ratio > 0.25 ? 0xe0b43c : 0xd9473c;
    g.fillStyle(colour, 1);
    g.fillRect(x, y, BAR_W * ratio, BAR_H);
    g.fillStyle(0xffffff, 0.25);
    g.fillRect(x, y, BAR_W * ratio, 2);
    // Faction pip: a small shield-shaped marker left of the bar.
    const pip = FACTION_COLORS[this.faction] ?? FACTION_COLORS.neutral;
    g.fillStyle(0x14101c, 1);
    g.fillCircle(x - 9, y + BAR_H / 2, 6);
    g.fillStyle(pip, 1);
    g.fillCircle(x - 9, y + BAR_H / 2, 4.2);
    g.lineStyle(1, 0xffffff, 0.8);
    g.strokeCircle(x - 9, y + BAR_H / 2, 4.2);
  }

  #placeholder(faction) {
    const g = this.scene.add.graphics();
    g.fillStyle(FACTION_COLORS[faction] ?? 0x888888, 1);
    g.fillRoundedRect(-14, -58, 28, 52, 8);
    g.fillStyle(0xe8c9a0, 1);
    g.fillCircle(0, -66, 10);
    g.lineStyle(2, 0x14101c, 1);
    g.strokeRoundedRect(-14, -58, 28, 52, 8);
    g.strokeCircle(0, -66, 10);
    return g;
  }
}

function placeholderMetrics() {
  const width = 36;
  const height = 78;
  return { scale: 1, anchorX: 0.5, anchorY: 1, width, height, footWidth: 40, headY: height };
}
