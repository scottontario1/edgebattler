import test from 'node:test';
import assert from 'node:assert/strict';
import { TILE_W, TILE_H, FOOT_DROP, tileToWorld, tileFoot, worldToTile, boardPixels, tileC, tileR } from '../../src/game/world/projection.js';

test('tile centres sit half a tile from the tile origin', () => {
  assert.deepEqual(tileToWorld(0, 0), { x: TILE_W / 2, y: TILE_H / 2 });
  assert.deepEqual(tileToWorld(3, 2), { x: 3.5 * TILE_W, y: 2.5 * TILE_H });
});

test('worldToTile inverts tileToWorld for every tile of a board', () => {
  for (let c = 0; c < 16; c += 1) {
    for (let r = 0; r < 12; r += 1) {
      const p = tileToWorld(c, r);
      assert.deepEqual(worldToTile(p.x, p.y), { c, r });
      const foot = tileFoot(c, r);
      assert.equal(foot.y, p.y + FOOT_DROP);
      assert.deepEqual(worldToTile(foot.x, foot.y), { c, r });
    }
  }
});

test('worldToTile floors toward negative infinity outside the board', () => {
  assert.deepEqual(worldToTile(-1, -1), { c: -1, r: -1 });
  assert.deepEqual(worldToTile(TILE_W - 0.01, TILE_H), { c: 0, r: 1 });
});

test('out parameter is reused', () => {
  const out = { x: 0, y: 0 };
  assert.equal(tileToWorld(1, 1, out), out);
});

test('board pixel size and tile accessors accept both tile shapes', () => {
  assert.deepEqual(boardPixels(16, 12), { w: 1536, h: 864 });
  assert.equal(tileC([4, 7]), 4);
  assert.equal(tileR({ c: 4, r: 7 }), 7);
});
