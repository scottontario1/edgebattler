import { loadMaps, playScenario } from '../combat/scenario.mjs';
import { SUITES } from './levels.mjs';
import { setMap } from '../../src/board.js';
const [lv, vi, seed, boards] = process.argv.slice(2);
const suite = SUITES[lv - 1];
await loadMaps([suite.variants[0].def.map]);
const r = playScenario(suite.variants[vi].def, +seed, { keepLog: true });
console.log(suite.variants[vi].label, r.winner, r.rounds, r.survivors);
const { LAYOUT } = await import('../../src/board.js');
const sums = r.log.entries.filter((e) => e.t === 'summary');
for (const round of (boards || '3,8,14').split(',').map(Number)) {
  const s = sums.find((x) => x.round === round); if (!s) continue;
  const g = LAYOUT.map((row) => [...row].map((t) => ({ G: '.', W: '~', F: '"', M: '^', V: 'v', C: '@', K: '$' }[t])));
  for (const f of ['blue', 'red']) for (const u of s[f].unitState) g[u.r][u.c] = f === 'blue' ? 'P' : 'p';
  console.log('round', round); console.log(g.map((row, i) => String(i).padStart(2) + ' ' + row.join(' ')).join('\n'));
}
