import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard } from '../../src/core/rules/board.js';
import { MAPS } from '../../src/core/content/maps/index.js';
import { buildFields, sampleField, bridgeAxis } from '../../src/game/world/ground-fields.js';

const board = (id) => createBoard(MAPS[id]);

test('fields mark water, roads and forests per tile', () => {
  const b = board('river_ford');
  const f = buildFields(b);
  const at = (kind, c, r) => f[kind][r * b.width + c];
  assert.equal(at('water', 7, 0), 1);
  assert.equal(at('water', 8, 5), 1); // the bridge tile is water underneath
  assert.equal(at('road', 2, 5), 1);
  assert.equal(at('forest', 11, 0), 1);
  assert.equal(at('hill', 1, 2), 1);
  assert.equal(at('pave', 12, 1), 1);
});

test('sampleField is exact at tile centres, midway between, and clamps outside', () => {
  const b = board('river_ford');
  const f = buildFields(b).water;
  assert.equal(sampleField(f, b.width, b.height, 7, 0), 1);
  assert.equal(sampleField(f, b.width, b.height, 6, 0), 0);
  assert.equal(sampleField(f, b.width, b.height, 6.5, 0), 0.5);
  assert.equal(sampleField(f, b.width, b.height, 7, -3), 1); // river keeps running off the north edge
  assert.equal(sampleField(f, b.width, b.height, -4, 0), 0);
});

test('bridge axis follows the land the bridge connects', () => {
  assert.equal(bridgeAxis(board('river_ford'), 8, 5), 'ew');
  assert.equal(bridgeAxis(board('campaign-crossing'), 5, 9), 'ns');
});
