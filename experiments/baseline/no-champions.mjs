// Probe: is the invulnerable champion on the keep what stops keep captures, or is it the endless replacement of
// units? Plays full AI matches with both champions removed from the starting roster (everything else unchanged),
// on the shipped map and on flat_open. ORDINARY REPLAY CANNOT RECONSTRUCT THESE GAMES (the roster is not in the log),
// so no --verify; the games are deterministic per seed and rerunning this script reproduces them.
//   node experiments/baseline/no-champions.mjs [--games 50]
import { createMatch } from '../../src/match.js';
import { runCommander } from '../../src/ai/commander.js';
import { UNITS } from '../../src/roster.js';
import { setMap, DEFAULT_MAP } from '../../src/board.js';
import flat from '../maps/flat_open.js';

const argv = process.argv.slice(2);
const games = Number(argv[argv.indexOf('--games') + 1] || 50);
const roster = UNITS.filter((u) => !['brenna', 'dreg'].includes(u.id));

function play(seed, blue, red, withChampions) {
  const m = createMatch({ seed, maxRounds: 30, roster: withChampions ? UNITS : roster });
  while (!m.over) {
    runCommander(m, 'blue', blue);
    runCommander(m, 'red', red);
    m.resolveRound();
  }
  return { winner: m.winner || 'draw', reason: m.reason, rounds: m.reason === 'round-limit' ? m.round - 1 : m.round };
}

const wilson = (k, n) => { const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - h), Math.min(1, c + h)]; };
console.log('| map | pairing | champions | games | draws (95%) | keep captures | army destroyed | mean rounds |');
console.log('|---|---|---|---|---|---|---|---|');
for (const [name, map] of [['river_ford', DEFAULT_MAP], ['flat_open', flat]]) {
  setMap(map);
  for (const [a, b, swap] of [['heuristic', 'heuristic', false], ['heuristic', 'greedy', true]]) {
    for (const withChampions of [true, false]) {
      const res = [];
      for (let seed = 1; seed <= games; seed += 1) {
        res.push(play(seed, a, b, withChampions));
        if (swap) res.push(play(seed, b, a, withChampions));
      }
      const draws = res.filter((r) => r.winner === 'draw').length;
      const [lo, hi] = wilson(draws, res.length);
      const mean = res.reduce((s, r) => s + r.rounds, 0) / res.length;
      console.log(`| ${name} | ${a} v ${b} | ${withChampions ? 'yes' : 'removed'} | ${res.length} | ${draws} (${Math.round(100 * draws / res.length)}%, ${Math.round(100 * lo)}–${Math.round(100 * hi)}%) | ${res.filter((r) => r.reason === 'keep-captured').length} | ${res.filter((r) => r.reason === 'army-destroyed').length} | ${mean.toFixed(1)} |`);
    }
  }
}
