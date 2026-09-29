// Headless match simulator: AI vs AI on the real rules (src/match.js), one JSONL log per game plus a
// summary CSV. Usage:
//   node tools/sim/run.mjs [--games 100] [--blue heuristic] [--red greedy] [--seed 1] [--max-rounds 30]
//                          [--out logs/sim/<name>] [--blue-params file.json] [--red-params file.json]
//                          [--swap] [--verify] [--no-logs]
//   --swap        also play every seed with the policies swapped (the map is not symmetric)
//   --verify      replay every game from its log and fail on any mismatch (determinism check)
//   --no-logs     write only summary.csv (faster, smaller)
// Then: node tools/sim/report.mjs <out dir>
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execSync } from 'node:child_process';
import { createMatch } from '../../src/match.js';
import { runCommander, DEFAULT_PARAMS } from '../../src/ai/commander.js';
import { memoryLog, replay } from '../../src/log.js';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const games = Number(opt('games', 100));
const firstSeed = Number(opt('seed', 1));
const maxRounds = Number(opt('max-rounds', 30));
const blue = opt('blue', 'heuristic');
const red = opt('red', 'greedy');
const readParams = (f) => (f ? JSON.parse(readFileSync(f, 'utf8')) : {});
const params = { blue: readParams(opt('blue-params')), red: readParams(opt('red-params')) };
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = resolve(opt('out', join('logs', 'sim', `${stamp}-${blue}-vs-${red}`)));
const writeLogs = !flag('no-logs');
const commit = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return null; } })();
mkdirSync(out, { recursive: true });

/** Play one game; `sides` maps faction -> { policy, params }. Returns a CSV row object and the log. */
export function playGame(seed, sides) {
  const log = memoryLog();
  const m = createMatch({ seed, maxRounds, log: log.push, meta: { source: 'sim', commit,
    blue: `ai:${sides.blue.policy}`, red: `ai:${sides.red.policy}`,
    params: { blue: { ...DEFAULT_PARAMS, ...sides.blue.params }, red: { ...DEFAULT_PARAMS, ...sides.red.params } } } });
  while (!m.over) {
    runCommander(m, 'blue', sides.blue.policy, sides.blue.params);
    runCommander(m, 'red', sides.red.policy, sides.red.params);
    m.resolveRound();
  }
  const s = m.stats();
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const fin = { blue: m.summary('blue'), red: m.summary('red') };
  return {
    log,
    row: {
      seed, blue: sides.blue.policy, red: sides.red.policy, winner: m.winner || 'draw', reason: m.reason, rounds: m.round,
      ...Object.fromEntries(['blue', 'red'].flatMap((f) => [
        [`${f}_recruited`, sum(s[f].recruited)], [`${f}_pikeman`, s[f].recruited.pikeman || 0], [`${f}_archer`, s[f].recruited.archer || 0],
        [`${f}_cavalier`, s[f].recruited.cavalier || 0], [`${f}_spells`, sum(s[f].spells)], [`${f}_skills`, s[f].skills],
        [`${f}_combined`, s[f].combined], [`${f}_withdrawn`, s[f].withdrawn], [`${f}_lost`, sum(s[f].lost)], [`${f}_killed`, sum(s[f].killed)],
        [`${f}_captures`, s[f].captures], [`${f}_respawns`, s[f].respawns], [`${f}_supply_spent`, s[f].supplySpent],
        [`${f}_blocked_draws`, s[f].blockedDraws], [`${f}_final_units`, fin[f].units], [`${f}_final_hp`, fin[f].hp],
        [`${f}_final_territory`, fin[f].territory], [`${f}_final_supply`, fin[f].supply],
      ])),
    },
  };
}

const plan = [];
for (let i = 0; i < games; i += 1) {
  const seed = firstSeed + i;
  plan.push({ seed, sides: { blue: { policy: blue, params: params.blue }, red: { policy: red, params: params.red } } });
  if (flag('swap')) plan.push({ seed, swapped: true, sides: { blue: { policy: red, params: params.red }, red: { policy: blue, params: params.blue } } });
}

const rows = [];
let failures = 0;
const t0 = Date.now();
for (const { seed, sides, swapped } of plan) {
  const { log, row } = playGame(seed, sides);
  row.swapped = !!swapped;
  rows.push(row);
  if (writeLogs) writeFileSync(join(out, `game-${String(seed).padStart(5, '0')}${swapped ? '-swap' : ''}.jsonl`), log.text());
  if (flag('verify')) {
    const r = replay(log.entries);
    if (!r.ok) { failures += 1; console.error(`seed ${seed}${swapped ? ' (swapped)' : ''}: replay mismatch`, JSON.stringify(r.mismatches[0]).slice(0, 400)); }
  }
}
const cols = Object.keys(rows[0]);
writeFileSync(join(out, 'summary.csv'), [cols.join(','), ...rows.map((r) => cols.map((c) => r[c]).join(','))].join('\n') + '\n');
writeFileSync(join(out, 'run.json'), JSON.stringify({ commit, games, firstSeed, maxRounds, blue, red, params, swap: flag('swap'), ms: Date.now() - t0 }, null, 2));
const wins = (f) => rows.filter((r) => r.winner === f).length;
console.log(`${rows.length} games in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${out}`);
console.log(`blue ${wins('blue')}  red ${wins('red')}  draw ${wins('draw')}${flag('verify') ? `  replay failures ${failures}` : ''}`);
if (failures) process.exit(1);
