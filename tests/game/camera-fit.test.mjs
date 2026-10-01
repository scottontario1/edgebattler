import test from 'node:test';
import assert from 'node:assert/strict';
import { freeRect, fitZoom, zoomLimits, cameraCenterFor, clampFocus, focusAfterZoom } from '../../src/game/world/camera-fit.js';

test('free rect subtracts insets and never collapses', () => {
  const f = freeRect(1280, 800, { top: 50, right: 20, bottom: 200, left: 10 });
  assert.deepEqual([f.x, f.y, f.w, f.h], [10, 50, 1250, 550]);
  assert.equal(f.cx, 635);
  assert.equal(f.cy, 325);
  assert.equal(freeRect(100, 100, { top: 500 }).h, 1);
  assert.equal(freeRect(390, 844).w, 390);
});

test('fit zoom picks the tighter axis', () => {
  const free = freeRect(1280, 800);
  const z = fitZoom(free, 1536, 864, 0);
  assert.ok(Math.abs(z - Math.min(1280 / 1536, 800 / 864)) < 1e-9);
  const portrait = fitZoom(freeRect(390, 844), 1152, 1296, 0);
  assert.ok(Math.abs(portrait - 390 / 1152) < 1e-9);
});

test('zoom limits bracket the fit zoom', () => {
  const { min, max } = zoomLimits(0.8);
  assert.ok(min < 0.8 && max > 0.8);
  assert.equal(zoomLimits(5).max, 5);
});

test('camera centre places the focus at the free-rect middle', () => {
  const free = freeRect(1000, 800, { bottom: 200 }); // free centre (500, 300)
  const zoom = 2;
  const centre = cameraCenterFor({ x: 700, y: 400 }, zoom, free, 1000, 800);
  // Phaser maps world -> screen as (world - centre) * zoom + view/2
  const sx = (700 - centre.x) * zoom + 500;
  const sy = (400 - centre.y) * zoom + 400;
  assert.equal(sx, free.cx);
  assert.equal(sy, free.cy);
});

test('zoom about a cursor keeps the world point under it', () => {
  const free = freeRect(1000, 800, { top: 100 });
  const world = { x: 300, y: 200 };
  const cursor = { x: 640, y: 500 };
  const zoom = 1.5;
  const focus = focusAfterZoom(world, cursor, zoom, free);
  const centre = cameraCenterFor(focus, zoom, free, 1000, 800);
  assert.ok(Math.abs((world.x - centre.x) * zoom + 500 - cursor.x) < 1e-9);
  assert.ok(Math.abs((world.y - centre.y) * zoom + 400 - cursor.y) < 1e-9);
});

test('focus stays within the board plus slack', () => {
  const free = freeRect(1280, 800);
  const clamped = clampFocus({ x: 99999, y: -99999 }, 1536, 864, 1, free);
  assert.ok(clamped.x < 1536 * 2 && clamped.x >= 768);
  assert.ok(clamped.y <= 432);
  assert.deepEqual(clampFocus({ x: 700, y: 400 }, 1536, 864, 1, free), { x: 700, y: 400 });
});
