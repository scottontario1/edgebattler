import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard } from '../../src/core/rules/board.js';
import { MAPS } from '../../src/core/content/maps/index.js';
import { layoutProps, VARIANTS } from '../../src/game/world/prop-layout.js';
import { TILE_W, TILE_H } from '../../src/game/world/projection.js';

for (const id of Object.keys(MAPS)) {
  test(`prop layout for ${id} is deterministic, in bounds and variant-safe`, () => {
    const board = createBoard(MAPS[id]);
    const a = layoutProps(board, 1);
    const b = layoutProps(board, 1);
    assert.deepEqual(a, b);
    assert.ok(a.length > 0);
    for (const p of a) {
      assert.ok(p.variant >= 0 && p.variant < VARIANTS[p.kind], `${p.kind} variant ${p.variant}`);
      assert.ok(p.x > -TILE_W / 2 && p.x < board.width * TILE_W + TILE_W / 2);
      assert.ok(p.footY > -TILE_H / 2 && p.footY < board.height * TILE_H + TILE_H / 2);
      assert.notEqual(board.terrainAt(p.c, p.r), 'W');
    }
    for (let i = 1; i < a.length; i += 1) assert.ok(a[i - 1].footY <= a[i].footY);
  });
}

test('every keep tile gets one keep in its owner colour', () => {
  const board = createBoard(MAPS['river_ford']);
  const keeps = layoutProps(board).filter((p) => p.kind === 'keep');
  assert.deepEqual(keeps.map((k) => k.owner).sort(), ['blue', 'red']);
});
