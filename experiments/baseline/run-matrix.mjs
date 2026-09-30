// Baseline policy matrix on the shipped rules: heuristic / greedy / passive against each other, seeds
// 1..N, every seed played with the sides swapped (the map is not symmetric), every game replayed.
//   node experiments/baseline/run-matrix.mjs [--games 50] [--out logs/sim/base]
// Prints a markdown table (the one in docs/experiments/BASELINE.md). Logs go under --out (git-ignored).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const games = Number(opt('games', 50));
const out = resolve(opt('out', 'logs/sim/base'));
const MATCHUPS = [['heuristic', 'greedy'], ['heuristic', 'heuristic'], ['greedy', 'greedy'], ['heuristic', 'passive'], ['greedy', 'passive'], ['passive', 'passive']];

const wilson = (k, n) => { const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - h), Math.min(1, c + h)]; };
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const rows = [];
for (const [a, b] of MATCHUPS) {
  const dir = join(out, `${a}-${b}`);
  const same = a === b;
  execFileSync('node', ['tools/sim/run.mjs', '--games', String(games), '--blue', a, '--red', b, '--seed', '1', ...(same ? [] : ['--swap']), '--verify', '--out', dir], { stdio: ['ignore', 'pipe', 'inherit'] });
  const [head, ...lines] = readFileSync(join(dir, 'summary.csv'), 'utf8').trim().split('\n');
  const cols = head.split(',');
  const g = lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], Number.isNaN(Number(v)) || v === '' ? v : Number(v)])));
  // Pool both side assignments and report from policy A's point of view (CSV booleans are strings).
  const sideOf = (r) => (same ? 'blue' : String(r.swapped) === 'true' ? 'red' : 'blue');
  const winsA = g.filter((r) => r.winner === sideOf(r)).length;
  const winsB = g.filter((r) => r.winner !== 'draw' && r.winner !== sideOf(r)).length;
  const draws = g.filter((r) => r.winner === 'draw').length;
  const caps = g.reduce((s, r) => s + r.blue_captures + r.red_captures, 0);
  const [lo, hi] = wilson(draws, g.length);
  rows.push(`| ${a} v ${b} | ${g.length} | ${winsA} | ${winsB} | ${draws} (${(100 * draws / g.length).toFixed(0)}%, ${(100 * lo).toFixed(0)}–${(100 * hi).toFixed(0)}%) | ${mean(g.map((r) => r.rounds)).toFixed(1)} | ${(caps / g.length).toFixed(2)} | ${mean(g.map((r) => r.blue_lost + r.red_lost)).toFixed(1)} | ${mean(g.map((r) => r.blue_blocked_draws + r.red_blocked_draws) ).toFixed(0)} |`);
}
console.log('| matchup (A v B) | games | A wins | B wins | draws (rate, 95%) | mean rounds | village captures / game | units lost / game (both) | blocked draws / game (both) |');
console.log('|---|---|---|---|---|---|---|---|---|');
console.log(rows.join('\n'));
