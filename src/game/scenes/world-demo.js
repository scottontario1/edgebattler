// `?demo=world`: fills the battlefield with fixture units so the world can be inspected on its own.
//   hover   tile and unit highlight          click a unit   select it and show its move range
//   click a blue tile  walk the selected unit there        drag / wheel / pinch   pan and zoom
//   1 move   2 attack   3 die   4 float text   5 refit   (acts on the selected unit)
import { createBoard } from '../../core/rules/board.js';
import { MAPS } from '../../core/content/maps/index.js';
import { buildDemoUnits, demoReach } from './demo-fixtures.js';

export function installWorldDemo(scene, launch) {
  const board = createBoard(MAPS[launch.mapId] ?? MAPS.river_ford);
  scene.setBoard(board);
  const records = buildDemoUnits(board);
  scene.syncUnits(records);
  // The village and keep pennants start neutral or in their owner's colour.
  for (const { c, r, letter } of board.tiles()) {
    if (letter === 'V') scene.terrain.setOwner(c, r, (c + r) % 2 ? 'blue' : 'red');
  }

  const find = (id) => records.find((u) => u.id === id);
  let selected = null;
  let reach = null;

  const select = (id) => {
    selected = id;
    scene.select(id);
    const record = id && find(id);
    reach = record ? demoReach(board, record, records, 5) : null;
    scene.overlays.set('move', reach?.tiles ?? []);
    scene.overlays.set('select', record ? [[record.c, record.r]] : []);
    const foes = record ? records.filter((u) => u.faction !== record.faction) : [];
    scene.overlays.set('attack', foes.filter((u) => Math.abs(u.c - record.c) + Math.abs(u.r - record.r) <= 1).map((u) => [u.c, u.r]));
  };

  scene.worldEvents.on('tile:hover', (tile) => scene.overlays.set('hover', tile ? [tile] : []));
  scene.worldEvents.on('unit:click', ({ id }) => select(id === selected ? null : id));
  scene.worldEvents.on('tile:click', ({ c, r }) => {
    if (!selected || !reach?.tiles.some(([tc, tr]) => tc === c && tr === r)) { select(null); return; }
    walk(selected, c, r);
  });

  async function walk(id, c, r) {
    const record = find(id);
    const path = reach.pathTo(c, r);
    scene.overlays.clear();
    await scene.unitView(id).moveAlong(path);
    record.c = c;
    record.r = r;
    select(id);
  }

  const nearestFoe = (record) => records.filter((u) => u.faction !== record.faction)
    .sort((a, b) => (Math.abs(a.c - record.c) + Math.abs(a.r - record.r)) - (Math.abs(b.c - record.c) + Math.abs(b.r - record.r)))[0];

  scene.input.keyboard.on('keydown', async (event) => {
    const record = selected && find(selected);
    if (event.key === '5') { scene.camera.fitToView(); return; }
    if (!record) return;
    const view = scene.unitView(record.id);
    if (event.key === '1') {
      const far = reach?.tiles.at(-1);
      if (far) await walk(record.id, far[0], far[1]);
    } else if (event.key === '2') {
      const foe = nearestFoe(record);
      const target = scene.unitView(foe.id);
      await view.lunge({ c: foe.c, r: foe.r }, () => {
        target.hitFlash();
        target.floatText('-7', '#ff6b5e');
      });
    } else if (event.key === '3') {
      await view.die();
    } else if (event.key === '4') {
      view.floatText('+5', '#7fe39a');
    }
  });

  window.__world = { scene, records, select };
}
