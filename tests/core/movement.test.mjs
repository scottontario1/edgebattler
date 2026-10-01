// Differential tests for movement and range: computeRange on every map, for every movement type,
// with random units, dead units, allies, enemies and blocking objects.
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRange as legacyComputeRange, MOVE_COST as LEGACY_COST, MOVE_TYPE as LEGACY_MOVE_TYPE } from '../../legacy/src/rules.js';
import { setMap, DEFAULT_MAP } from '../../legacy/src/board.js';
import LEGACY_RIVER_FORD from '../../legacy/src/maps/river_ford.js';
import { CAMPAIGN_MAPS as LEGACY_CAMPAIGN_MAPS } from '../../legacy/src/maps/campaign.js';
import { MAPS } from '../../src/core/content/maps/index.js';
import { createBoard } from '../../src/core/rules/board.js';
import { MOVE_COST, computeRange, occupancyFromRecords } from '../../src/core/rules/movement.js';
import { FACTION_SETS, withFactions, scenarioRandom } from './legacy.mjs';

const LEGACY_MAPS = [LEGACY_RIVER_FORD, ...LEGACY_CAMPAIGN_MAPS];

test('move cost tables equal legacy', () => {
  assert.deepEqual(MOVE_COST, LEGACY_COST);
});

test('the ported maps equal the legacy layouts', () => {
  for (const legacy of LEGACY_MAPS) {
    assert.deepEqual([...MAPS[legacy.id].layout], [...legacy.layout], legacy.id);
  }
});

function buildScenario(random, board, content) {
  const keys = [...Object.keys(content.recruitClasses), ...Object.keys(content.variants)];
  const champions = Object.keys(content.championTemplates);
  const passable = [];
  for (const { c, r, letter } of board.tiles()) if (MOVE_COST.foot[letter] !== undefined) passable.push([c, r]);
  const taken = new Set();
  const freeTile = () => {
    for (;;) {
      const [c, r] = random.pick(passable);
      if (!taken.has(`${c},${r}`)) {
        taken.add(`${c},${r}`);
        return [c, r];
      }
    }
  };
  const units = [];
  const count = 6 + random.int(10);
  for (let i = 0; i < count; i += 1) {
    const [c, r] = freeTile();
    const faction = random.next() < 0.5 ? 'blue' : 'red';
    const useChampion = champions.length && random.next() < 0.15;
    const unit = useChampion
      ? content.createChampionUnit(random.pick(champions), faction, c, r)
      : content.createRecruitUnit(random.pick(keys), `u${i}`, faction, c, r);
    unit.id = `u${i}`;
    if (random.next() < 0.15) unit.hp = 0;
    units.push(unit);
  }
  const objects = [];
  for (let i = 0; i < random.int(4); i += 1) {
    const [c, r] = freeTile();
    const blocks = random.next() < 0.6;
    objects.push({ id: `o${i}`, kind: 'object', objectKind: blocks ? 'barricade' : 'corpse', blocks, faction: 'blue', c, r, hp: 10 });
  }
  return { units, objects };
}

function summarize(range, board) {
  const reachable = range.move;
  const probes = [...reachable.slice(0, 40), [0, 0], [board.width - 1, board.height - 1], [3, 3]];
  return {
    move: range.move,
    attack: range.attack,
    targets: [...range.targets.entries()],
    paths: probes.map(([c, r]) => range.pathTo(c, r)),
  };
}

test('computeRange equals legacy on every map, movement type and occupancy', () => {
  let comparisons = 0;
  let withTargets = 0;
  const kinds = new Set();
  for (const [setIndex, ids] of FACTION_SETS.entries()) {
    withFactions(ids, (content) => {
      for (const [mapIndex, legacyMap] of LEGACY_MAPS.entries()) {
        setMap(legacyMap);
        const board = createBoard(MAPS[legacyMap.id]);
        const random = scenarioRandom(1000 * setIndex + mapIndex + 1);
        for (let round = 0; round < 6; round += 1) {
          const { units, objects } = buildScenario(random, board, content);
          const occupancy = occupancyFromRecords([...units, ...objects]);
          // The legacy match board only ever contained the blocking objects.
          const legacyList = [...units, ...objects.filter((o) => o.blocks)].map((data) => ({ data }));
          const legacyBoard = {
            list: legacyList,
            unitAt: (c, r) => legacyList.find((e) => e.data.hp > 0 && e.data.c === c && e.data.r === r),
          };
          for (const unit of units.filter((u) => u.hp > 0)) {
            kinds.add(LEGACY_MOVE_TYPE[unit.cls] || 'foot');
            for (const mov of [undefined, 0, 2, unit.mov + 3, 12]) {
              for (const blockAllies of [false, true]) {
                const legacyRange = mov === undefined ? legacyComputeRange(unit, legacyBoard, unit.mov, { blockAllies }) : legacyComputeRange(unit, legacyBoard, mov, { blockAllies });
                const mine = computeRange(unit, board, occupancy, { content, ...(mov === undefined ? {} : { mov }), blockAllies });
                assert.deepEqual(summarize(mine, board), summarize(legacyRange, board), `[${ids}] ${legacyMap.id} ${unit.id} ${unit.cls} mov=${mov} block=${blockAllies}`);
                comparisons += 1;
                if (mine.targets.size) withTargets += 1;
              }
            }
          }
        }
      }
    });
  }
  assert.deepEqual([...kinds].sort(), ['armor', 'foot', 'mounted'], 'every movement type was exercised');
  assert.ok(comparisons > 5000, `compared ${comparisons} ranges`);
  assert.ok(withTargets > 300, `${withTargets} ranges had attackable targets`);
  setMap(DEFAULT_MAP);
});

test('computeRange: terrain rules, blocking and paths', () => {
  const board = createBoard({ id: 't', layout: ['GGGGG', 'GWWFG', 'GMMMG', 'GGGGG'] });
  const content = withFactions([], (c) => c);
  const pike = content.createRecruitUnit('pikeman', 'p', 'blue', 0, 0);
  const noOne = occupancyFromRecords([pike]);
  const range = computeRange(pike, board, noOne, { content });
  const has = (list, c, r) => list.some(([x, y]) => x === c && y === r);
  assert.ok(!has(range.move, 1, 1), 'river is impassable');
  assert.ok(has(range.move, 0, 1), 'plains are reachable');
  const rider = content.createRecruitUnit('cavalier', 'k', 'blue', 0, 3);
  const riderRange = computeRange(rider, board, occupancyFromRecords([rider]), { content });
  assert.ok(!has(riderRange.move, 1, 2), 'mounted units cannot enter mountains');
  assert.deepEqual(range.pathTo(0, 0), [], 'already there');
  assert.deepEqual(range.pathTo(4, 3), [], 'unreachable within Mov');
  assert.deepEqual(range.pathTo(0, 2), [[0, 1], [0, 2]]);
  const foe = content.createRecruitUnit('pikeman', 'f', 'red', 0, 1);
  const blocked = computeRange(pike, board, occupancyFromRecords([pike, foe]), { content });
  assert.ok(!has(blocked.move, 0, 1), 'enemies block movement');
  assert.deepEqual(blocked.targets.get('f'), [0, 0], 'an adjacent foe is struck from the unit\'s own tile');
  assert.throws(() => computeRange(pike, board, noOne), /needs options.content/);
});

test('occupancy: only living blocking objects stop movement; corpses are passable and never targets', () => {
  const content = withFactions([], (c) => c);
  const board = createBoard({ id: 't', layout: ['GGGGG'] });
  const pike = content.createRecruitUnit('pikeman', 'p', 'blue', 0, 0);
  const object = (id, objectKind, c, blocks, hp = 1) => ({ id, kind: 'object', objectKind, blocks, faction: 'red', c, r: 0, hp });
  const reach = (records) => computeRange(pike, board, occupancyFromRecords([pike, ...records]), { content });
  assert.equal(reach([object('c', 'corpse', 1, false)]).move.length, 5, 'a corpse does not block');
  assert.equal(reach([object('b', 'barricade', 1, true)]).move.length, 1, 'an enemy barricade blocks');
  assert.equal(reach([object('b', 'barricade', 1, true, 0)]).move.length, 5, 'a destroyed barricade does not');
  assert.equal(reach([object('b', 'barricade', 1, true)]).targets.size, 0, 'objects are never forecast targets');
  const ownBarricade = { ...object('b', 'barricade', 1, true), faction: 'blue' };
  assert.equal(reach([ownBarricade]).move.length, 5, 'allies transit a friendly barricade');
});

test('computeRange rejects a movement type without costs and units placed outside the board', () => {
  const content = withFactions([], (c) => c);
  const board = createBoard({ id: 't', layout: ['GGG'] });
  const stray = content.createRecruitUnit('pikeman', 'p', 'blue', 9, 9);
  assert.throws(() => computeRange(stray, board, occupancyFromRecords([stray]), { content }), /starts outside board/);
  const odd = { ...content.createRecruitUnit('pikeman', 'q', 'blue', 0, 0) };
  const brokenContent = { ...content, moveTypeOf: () => 'hovercraft' };
  assert.throws(() => computeRange(odd, board, occupancyFromRecords([odd]), { content: brokenContent }), /No movement costs/);
});
