// Full-match AI games on each experiment map, plus congestion and pace measures from the game logs.
//   node experiments/maps/run-maps.mjs [--games 50] [--out logs/sim/maps] [--candidates a,b --pool]
// Per map: heuristic v heuristic (seeds 1..N) and heuristic v greedy (seeds 1..N, both side assignments). Every game
// is replayed (`run.mjs --verify` with --map). Prints markdown tables (used in docs/experiments/COMBAT_CASES.md).
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fromJSONL } from '../../src/log.js';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const games = Number(opt('games', 50));
const out = resolve(opt('out', 'logs/sim/maps'));
const candidates = opt('candidates', null);
const MAPS = (opt('maps', null) || 'river_ford,flat_open,forest_belt,choke_gap3,choke_gap1,village_center').split(',');
const mapArg = (m) => (m === 'river_ford' ? [] : ['--map', `experiments/maps/${m}.js`]);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const wilson = (k, n) => { const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - h), Math.min(1, c + h)]; };

function measure(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
  let strikeRounds = 0, roundsTotal = 0, deaths = 0, holds = 0, decisions = 0, blocked = 0, contested = 0, firstStrike = [], villages = 0, keepCaptures = 0, draws = 0;
  let popCap = 0, popRows = 0, handFull = 0, contactLate = 0, lateRows = 0;
  for (const f of files) {
    const e = fromJSONL(readFileSync(join(dir, f), 'utf8'));
    const result = e.find((x) => x.t === 'result');
    if (!result?.winner) draws += 1;
    if (result?.reason === 'keep-captured') keepCaptures += 1;
    let first = null;
    for (const rd of e.filter((x) => x.t === 'round')) {
      const evs = rd.batches.flatMap((b) => b.events);
      const strikes = evs.filter((x) => x.type === 'strike').length;
      roundsTotal += 1;
      if (strikes) { strikeRounds += 1; first ??= rd.round; }
      if (rd.round >= 15) { lateRows += 1; if (strikes) contactLate += 1; }
      deaths += evs.filter((x) => x.type === 'death').length;
      villages += evs.filter((x) => x.type === 'capture').length;
      for (const m of evs.filter((x) => x.type === 'move' || x.type === 'hold')) {
        decisions += 1;
        if (m.type === 'hold') {
          holds += 1;
          if (/no legal|occupied/.test(m.reason)) blocked += 1;
          if (/contested/.test(m.reason)) contested += 1;
        }
      }
    }
    if (first) firstStrike.push(first);
    for (const s of e.filter((x) => x.t === 'summary' && x.round > 0)) for (const side of ['blue', 'red']) { popRows += 1; if (s[side].population >= 10) popCap += 1; if (s[side].hand.length >= 8) handFull += 1; }
  }
  return { n: files.length, draws, keepCaptures, roundsPerGame: roundsTotal / files.length, strikeShare: strikeRounds / roundsTotal, deathsPerRound: deaths / roundsTotal,
    holdShare: holds / decisions, blockedShare: blocked / decisions, contestedShare: contested / decisions, firstStrike: mean(firstStrike),
    villagesPerGame: villages / files.length, atCap: popCap / popRows, handFull: handFull / popRows, lateContact: lateRows ? contactLate / lateRows : 0 };
}

const rows = [];
for (const map of MAPS) {
  for (const [a, b, swap] of [['heuristic', 'heuristic', false], ['heuristic', 'greedy', true]]) {
    const dir = join(out, `${map}-${a}-${b}`);
    execFileSync('node', ['tools/sim/run.mjs', '--games', String(games), '--blue', a, '--red', b, '--seed', '1', ...(swap ? ['--swap'] : []), '--verify', '--out', dir, ...mapArg(map), ...(candidates ? ['--candidates', candidates, '--pool'] : [])], { stdio: ['ignore', 'pipe', 'inherit'] });
    rows.push({ map, pair: `${a} v ${b}`, ...measure(dir) });
  }
}
const pct = (x) => `${Math.round(100 * x)}%`;
console.log('| map | pairing | games | draws (95%) | keep captures | rounds / game | rounds with a strike | deaths / round | first strike | holds (of movement decisions) | blocked (no legal move) | contested | village captures / game | pop at cap | hand full |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  const [lo, hi] = wilson(r.draws, r.n);
  console.log(`| ${r.map} | ${r.pair} | ${r.n} | ${pct(r.draws / r.n)} (${pct(lo)}–${pct(hi)}) | ${r.keepCaptures} | ${r.roundsPerGame.toFixed(1)} | ${pct(r.strikeShare)} | ${r.deathsPerRound.toFixed(2)} | ${r.firstStrike.toFixed(1)} | ${pct(r.holdShare)} | ${pct(r.blockedShare)} | ${pct(r.contestedShare)} | ${r.villagesPerGame.toFixed(2)} | ${pct(r.atCap)} | ${pct(r.handFull)} |`);
}
