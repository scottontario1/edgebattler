import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard } from '../../src/core/rules/board.js';
import { MAPS, RIVER_FORD, CAMPAIGN_MAPS } from '../../src/core/content/maps/index.js';
import { goldenIndex, loadGolden, firstDifference } from '../parity/golden.mjs';

test('every shipped map builds a board with both keeps', () => {
  for (const map of Object.values(MAPS)) {
    const b = createBoard(map);
    assert.ok(b.findTile('C') && b.findTile('K'), map.id);
  }
  const b = createBoard(RIVER_FORD);
  assert.deepEqual([b.width, b.height], [16, 12]);
  assert.deepEqual(b.findTile('C'), [2, 10]);
  assert.equal(b.tile(3, 0).name, 'Forest');
  for (const m of CAMPAIGN_MAPS) assert.deepEqual([createBoard(m).width, createBoard(m).height], [12, 18]);
});

test('boards reject ragged rows and unknown letters', () => {
  assert.throws(() => createBoard({ id: 'x', layout: ['GG', 'G'] }), /row 1/);
  assert.throws(() => createBoard({ id: 'x', layout: ['GQ'] }), /unknown terrain 'Q'/);
});

test('golden fixtures load and the comparator accepts added fields only', () => {
  const index = goldenIndex();
  assert.equal(index.length, 50);
  const entries = loadGolden(index[0].name);
  assert.equal(entries[0].t, 'header');
  assert.equal(firstDifference({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2], extra: true }), null);
  assert.equal(firstDifference({ a: 1 }, { a: 2 }).path, '$.a');
  assert.equal(firstDifference({ b: [1] }, { b: [1, 2] }).path, '$.b.length');
});
