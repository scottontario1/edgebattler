import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard } from '../../src/core/rules/board.js';
import { MAPS } from '../../src/core/content/maps/index.js';
import { buildDemoUnits, demoReach } from '../../src/game/scenes/demo-fixtures.js';

for (const id of Object.keys(MAPS)) {
  test(`demo units stand on distinct land tiles on ${id}`, () => {
    const board = createBoard(MAPS[id]);
    const units = buildDemoUnits(board);
    assert.ok(units.length >= 10, `${units.length} units`);
    const seen = new Set();
    for (const u of units) {
      assert.ok(board.inBounds(u.c, u.r));
      assert.notEqual(board.terrainAt(u.c, u.r), 'W');
      assert.ok(!seen.has(`${u.c},${u.r}`));
      seen.add(`${u.c},${u.r}`);
    }
    assert.ok(units.some((u) => u.faction === 'red') && units.some((u) => u.faction === 'blue'));
  });
}

test('reach flood skips water and builds connected paths', () => {
  const board = createBoard(MAPS['river_ford']);
  const unit = { id: 'u', c: 6, r: 5 };
  const { tiles, pathTo } = demoReach(board, unit, [unit], 4);
  assert.ok(tiles.length > 5);
  for (const [c, r] of tiles) assert.notEqual(board.terrainAt(c, r), 'W');
  const [c, r] = tiles[tiles.length - 1];
  const path = pathTo(c, r);
  assert.deepEqual(path[0], [6, 5]);
  assert.deepEqual(path.at(-1), [c, r]);
});
