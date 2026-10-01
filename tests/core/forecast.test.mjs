// Differential tests for the combat forecast and the duel resolver.
import test from 'node:test';
import assert from 'node:assert/strict';
import { forecast as legacyForecast, resolve as legacyResolve } from '../../legacy/src/combat.js';
import { setMap, DEFAULT_MAP } from '../../legacy/src/board.js';
import LEGACY_RIVER_FORD from '../../legacy/src/maps/river_ford.js';
import { CAMPAIGN_MAPS as LEGACY_CAMPAIGN_MAPS } from '../../legacy/src/maps/campaign.js';
import { seededRandom } from '../../legacy/src/cards.js';
import { MAPS } from '../../src/core/content/maps/index.js';
import { createBoard } from '../../src/core/rules/board.js';
import { forecast, resolveCombat, forecastAttackFor } from '../../src/core/rules/forecast.js';
import { FACTION_SETS, withFactions, scenarioRandom } from './legacy.mjs';
import { createContent } from '../../src/core/setup/content.js';

const LEGACY_MAPS = [LEGACY_RIVER_FORD, ...LEGACY_CAMPAIGN_MAPS];

function randomUnit(random, content, board, id) {
  const keys = [...Object.keys(content.recruitClasses), ...Object.keys(content.variants)];
  const champions = Object.keys(content.championTemplates);
  const c = random.int(board.width);
  const r = random.int(board.height);
  const unit = champions.length && random.next() < 0.15
    ? content.createChampionUnit(random.pick(champions), 'blue', c, r)
    : content.createRecruitUnit(random.pick(keys), id, 'blue', c, r);
  unit.id = id;
  // Spread the stats so doubling, clamping and zero damage all occur.
  for (const stat of ['str', 'mag', 'skl', 'spd', 'def', 'res']) {
    if (random.next() < 0.3) unit[stat] = Math.max(0, unit[stat] + random.int(25) - 8);
  }
  return unit;
}

test('forecast equals legacy for random attacker, defender, tile and terrain combinations', () => {
  let count = 0;
  let doubles = 0;
  let outOfRange = 0;
  const triangles = new Set();
  for (const [setIndex, ids] of FACTION_SETS.entries()) {
    withFactions(ids, (content) => {
      for (const [mapIndex, legacyMap] of LEGACY_MAPS.entries()) {
        setMap(legacyMap);
        const board = createBoard(MAPS[legacyMap.id]);
        const env = { board, content };
        const random = scenarioRandom(77 * setIndex + mapIndex + 5);
        for (let i = 0; i < 150; i += 1) {
          const a = randomUnit(random, content, board, 'a');
          const d = randomUnit(random, content, board, 'd');
          const from = [Math.max(0, Math.min(board.width - 1, d.c + random.int(7) - 3)), Math.max(0, Math.min(board.height - 1, d.r + random.int(7) - 3))];
          const expected = legacyForecast(a, d, from);
          const actual = forecast(a, d, from, env);
          assert.deepEqual(actual, expected, `[${ids}] ${legacyMap.id} ${a.cls} v ${d.cls} from ${from}`);
          count += 1;
          if (actual.atk.double || actual.def.double) doubles += 1;
          if (!actual.atk.can) outOfRange += 1;
          triangles.add(actual.atk.tri);
        }
      }
    });
  }
  setMap(DEFAULT_MAP);
  assert.ok(count > 3000);
  assert.ok(doubles > 50 && outOfRange > 50, 'doubling and out-of-range cases were exercised');
  assert.deepEqual([...triangles].sort(), [-1, 0, 1], 'all triangle results occurred');
});

test('resolveCombat equals legacy resolve for seeded dice', () => {
  withFactions(['league', 'court'], (content) => {
    const board = createBoard(MAPS.river_ford ?? Object.values(MAPS)[0]);
    const env = { board, content };
    const random = scenarioRandom(4242);
    for (let i = 0; i < 400; i += 1) {
      const a = randomUnit(random, content, board, 'a');
      const d = randomUnit(random, content, board, 'd');
      const from = [Math.min(board.width - 1, d.c + 1), d.r];
      const seed = 1 + random.int(100000);
      assert.deepEqual(resolveCombat(a, d, from, env, seededRandom(seed)), legacyResolve(a, d, from, seededRandom(seed)), `duel ${i}`);
    }
  });
});

test('forecast facts: triangle, terrain, magic, range, doubling', () => {
  const content = createContent();
  const board = createBoard({ id: 't', layout: ['GGGGG', 'GFMGG', 'GGGGG'] });
  const env = { board, content };
  const make = (cls, id, c, r, extra = {}) => ({ ...content.createRecruitUnit(cls, id, 'blue', c, r), ...extra });
  const pike = make('pikeman', 'p', 0, 0);
  const archer = make('archer', 'a', 2, 0);
  const axeman = make('pikeman', 'x', 1, 0, { weapon: 'Steel Axe' });
  const swordsman = make('pikeman', 's', 3, 0, { weapon: 'Iron Sword' });
  // Lance beats sword, axe beats lance.
  assert.equal(forecast(pike, swordsman, [2, 0], env).atk.tri, 1);
  assert.equal(forecast(pike, axeman, [0, 0], env).atk.tri, -1);
  // Longbow range is exactly 2.
  assert.equal(forecast(archer, pike, [1, 0], env).atk.can, false, 'archers cannot shoot adjacent targets');
  assert.equal(forecast(archer, pike, [2, 0], env).atk.can, true);
  // Terrain defence and avoid come from the defender's tile.
  const onMountain = make('pikeman', 'm', 2, 1);
  const onPlains = make('pikeman', 'g', 2, 2);
  const mountain = forecast(pike, onMountain, [2, 2], env).atk;
  const plains = forecast(pike, onPlains, [2, 1], env).atk;
  assert.equal(plains.dmg - mountain.dmg, 2, 'mountain gives +2 defence');
  assert.equal(plains.hit - mountain.hit, 30, 'mountain gives 30 avoid');
  // Magic uses Mag against Res.
  const mage = { ...pike, weapon: 'Flux', mag: 10, str: 0 };
  assert.equal(forecast(mage, pike, [1, 0], env).atk.dmg, 10 + 7 - pike.res);
  // Speed advantage of 4 doubles.
  const fast = { ...pike, spd: 10 };
  assert.equal(forecast(fast, { ...pike, spd: 6 }, [1, 0], env).atk.double, true);
  assert.equal(forecast(fast, { ...pike, spd: 7 }, [1, 0], env).atk.double, false);
  // The bound helper takes {c, r}.
  assert.deepEqual(forecastAttackFor(env)(pike, axeman, { c: 0, r: 0 }), forecast(pike, axeman, [0, 0], env));
});
