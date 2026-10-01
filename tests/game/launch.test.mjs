import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLaunch, DEFAULT_MAP_ID, DEMO_MAP_IDS } from '../../src/game/launch.js';
import { MAPS } from '../../src/core/content/maps/index.js';

test('demo=world with each map id', () => {
  for (const id of DEMO_MAP_IDS) {
    assert.deepEqual(parseLaunch(`?demo=world&map=${id}`), { demo: 'world', mapId: id, warnings: [] });
  }
});

test('every demo map id exists in the content', () => {
  for (const id of DEMO_MAP_IDS) assert.ok(MAPS[id], id);
});

test('defaults to the start menu (no demo) on River Ford', () => {
  assert.deepEqual(parseLaunch(''), { demo: null, mapId: DEFAULT_MAP_ID, warnings: [] });
  assert.equal(parseLaunch('demo=world').demo, 'world');
});

test('accepts file-style spellings', () => {
  assert.equal(parseLaunch('map=river-ford').mapId, 'river_ford');
  assert.equal(parseLaunch('map=campaign_road').mapId, 'campaign-road');
});

test('unknown map falls back with a warning', () => {
  const launch = parseLaunch('?map=nowhere');
  assert.equal(launch.mapId, DEFAULT_MAP_ID);
  assert.equal(launch.warnings.length, 1);
});
