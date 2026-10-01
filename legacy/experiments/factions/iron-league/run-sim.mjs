// Paired, side-swapped League simulations on the real rules, in parallel on worker threads.
//   node experiments/factions/iron-league/run-sim.mjs [--seeds 100] [--maps river_ford,choke_gap1] [--rounds 30] [--replay 3]
//                                                     [--params '{"seizeRatio":1.2}'] [--matchups league:baseline,league-heuristic:baseline,league:league,baseline:baseline]
//                                                     [--out docs/experiments/results/factions/iron-league] [--tag name] [--logs dir]
// A matchup "a:b" plays a (blue) v b (red) for every seed; when a and b differ, every seed is also played with the sides swapped
// (so the League plays both the west and the east bank). Reports per cell: wins of each army with 95% Wilson intervals, draw rate,
// mean length (rounds), keep captures (decisive games), village captures per game and the average League ability use.
// --replay N rebuilds the first N games of every cell from their logs (header spec + logged actions) and fails on any mismatch.
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

if (!isMainThread) {
  const { loadMaps } = await import('./common.mjs');
  const { playGame, replayGame } = await import('./sim-game.mjs');
  parentPort.on('message', async (task) => {
    try {
      await loadMaps([task.spec.map]);
      const { row, log } = playGame(task.spec, { keepLog: true });
      let replay = null;
      if (task.replay) { const r = replayGame(log.entries); replay = r.ok ? 'ok' : JSON.stringify(r.mismatches[0]).slice(0, 300); }
      parentPort.postMessage({ id: task.id, row, replay, log: task.keepLog ? log.text() : null });
    } catch (e) { parentPort.postMessage({ id: task.id, error: String(e.stack || e) }); }
  });
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}

async function main() {
  const { wilson, mean, pct1, f1 } = await import('./common.mjs');
  const argv = process.argv.slice(2);
  const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
  const seeds = Number(opt('seeds', 100)), maxRounds = Number(opt('rounds', 30)), replayN = Number(opt('replay', 3));
  const maps = opt('maps', 'river_ford,choke_gap1').split(',');
  const matchups = opt('matchups', 'league:baseline,league-heuristic:baseline,league:league,baseline:baseline').split(',').map((s) => s.split(':'));
  const out = opt('out', null) && resolve(opt('out'));
  const tag = opt('tag', 'sim');
  const logsDir = opt('logs', null) && resolve(opt('logs'));
  const params = opt('params', null) ? JSON.parse(opt('params')) : undefined; // League commander overrides, e.g. '{"seizeRatio":1.2}'

  const cells = [];
  for (const map of maps) for (const [a, b] of matchups) {
    const games = [];
    for (let seed = 1; seed <= seeds; seed += 1) {
      games.push({ seed, map, blue: a, red: b, maxRounds, ...(params ? { params } : {}) });
      if (a !== b) games.push({ seed, map, blue: b, red: a, maxRounds, swapped: true, ...(params ? { params } : {}) });
    }
    cells.push({ key: `${map} ${a} v ${b}`, map, a, b, games });
  }
  const tasks = cells.flatMap((c, ci) => c.games.map((spec, gi) => ({ cell: ci, spec, replay: gi < replayN, keepLog: Boolean(logsDir) && gi < 2 })));
  tasks.forEach((t, i) => { t.id = i; });

  const t0 = Date.now();
  const workers = Array.from({ length: Math.max(1, cpus().length - 1) }, () => new Worker(fileURLToPath(import.meta.url)));
  const results = new Array(tasks.length);
  let next = 0, done = 0;
  await new Promise((resolveAll, rejectAll) => {
    const feed = (w) => { if (next < tasks.length) w.postMessage(tasks[next++]); };
    for (const w of workers) {
      w.on('message', (msg) => {
        if (msg.error) return rejectAll(new Error(msg.error));
        results[msg.id] = msg; done += 1;
        if (done === tasks.length) resolveAll(); else feed(w);
      });
      w.on('error', rejectAll);
      feed(w);
    }
  });
  await Promise.all(workers.map((w) => w.terminate()));

  const lines = [];
  const data = [];
  lines.push(`League simulations: ${seeds} seeds per matchup and map${'' /* sides swapped when the armies differ */}, ${maxRounds}-round limit, seeds 1..${seeds}, sides swapped when the armies differ. Replayed ${replayN} games per cell from their logs.`, '');
  lines.push('"League" = League starting army + League pool + League commander (experiments/factions/iron-league/commander.mjs); "League (shipped AI)" = the same army and pool driven by the shipped heuristic; "baseline" = shipped army, shared pool, shipped heuristic. Win % has a 95% Wilson interval over all games of the cell (both sides).', '');
  lines.push('| map | matchup (first army is the one whose win rate is shown) | games | first wins | second wins | draws | rounds (mean) | rounds, decided games | keep captures | villages captured / game (first / second) | first: recruits lost / kills | replay |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  let replayFails = 0, replayed = 0;
  for (const [ci, c] of cells.entries()) {
    const rows = results.filter((_, i) => tasks[i].cell === ci).map((r) => r.row);
    for (const r of results.filter((_, i) => tasks[i].cell === ci)) if (r.replay !== null) { replayed += 1; if (r.replay !== 'ok') { replayFails += 1; console.error(`REPLAY MISMATCH ${c.key}`, r.replay); } }
    const first = (r) => (r.blue === c.a && !(c.a === c.b && false) ? 'blue' : 'red');
    // With equal armies (mirror) "first" is blue.
    const firstSide = (r) => (c.a === c.b ? 'blue' : (r.blue === c.a ? 'blue' : 'red'));
    void first;
    const n = rows.length;
    const w1 = rows.filter((r) => r.winner === firstSide(r)).length;
    const w2 = rows.filter((r) => r.winner !== 'draw' && r.winner !== firstSide(r)).length;
    const dr = rows.filter((r) => r.winner === 'draw').length;
    const decided = rows.filter((r) => r.winner !== 'draw');
    const [lo, hi] = wilson(w1, n), [lo2, hi2] = wilson(w2, n), [lod, hid] = wilson(dr, n);
    const keep = rows.filter((r) => r.reason === 'keep-captured').length;
    const vil = (which) => mean(rows.map((r) => r[`${which === 'first' ? firstSide(r) : (firstSide(r) === 'blue' ? 'red' : 'blue')}_captures`]));
    const lost = mean(rows.map((r) => r[`${firstSide(r)}_lost`])), kills = mean(rows.map((r) => r[`${firstSide(r)}_killed`]));
    const ok = results.filter((_, i) => tasks[i].cell === ci && tasks[i].replay).every((r) => r.replay === 'ok');
    const name = (k) => (k === 'league-heuristic' ? 'League (shipped AI)' : k === 'league' ? 'League' : 'baseline');
    lines.push(`| ${c.map} | ${name(c.a)} v ${name(c.b)}${c.a === c.b ? ' (blue = first)' : ''} | ${n} | ${pct1(w1 / n)} (${pct1(lo)}–${pct1(hi)}) | ${pct1(w2 / n)} (${pct1(lo2)}–${pct1(hi2)}) | ${pct1(dr / n)} (${pct1(lod)}–${pct1(hid)}) | ${f1(mean(rows.map((r) => r.rounds)))} | ${decided.length ? f1(mean(decided.map((r) => r.rounds))) : '—'} | ${pct1(keep / n)} | ${vil('first').toFixed(2)} / ${vil('second').toFixed(2)} | ${f1(lost)} / ${f1(kills)} | ${ok ? 'ok' : 'FAIL'} |`);
    // League ability use per game (either side that is a League army)
    const use = {};
    let leagueGames = 0;
    for (const r of rows) for (const f of ['blue', 'red']) if (String(r[f]).startsWith('league')) {
      leagueGames += 1;
      for (const [k, v] of Object.entries(JSON.parse(r[`${f}_abilities`]))) use[k] = (use[k] || 0) + v;
    }
    data.push({ key: c.key, map: c.map, first: c.a, second: c.b, games: n, firstWins: w1, secondWins: w2, draws: dr, keep, rounds: mean(rows.map((r) => r.rounds)),
      abilityUsePerLeagueGame: Object.fromEntries(Object.entries(use).map(([k, v]) => [k, v / (leagueGames || 1)])), rows });
  }
  lines.push('', 'League ability activations per League game (all sides that field the League):', '', '| cell | ' + [...new Set(data.flatMap((d) => Object.keys(d.abilityUsePerLeagueGame)))].join(' | ') + ' |');
  const abilityCols = [...new Set(data.flatMap((d) => Object.keys(d.abilityUsePerLeagueGame)))];
  lines.push('|---|' + abilityCols.map(() => '---').join('|') + '|');
  for (const d of data.filter((x) => Object.keys(x.abilityUsePerLeagueGame).length)) lines.push(`| ${d.key} | ${abilityCols.map((k) => f1(d.abilityUsePerLeagueGame[k] || 0)).join(' | ')} |`);
  lines.push('', `${tasks.length} games in ${((Date.now() - t0) / 1000).toFixed(0)}s on ${workers.length} workers; replay checks ${replayed - replayFails}/${replayed} ok.`);
  console.log(lines.join('\n'));
  if (out) {
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, `${tag}.md`), lines.join('\n') + '\n');
    const cols = Object.keys(data[0].rows[0]);
    writeFileSync(join(out, `${tag}.csv`), [cols.join(','), ...data.flatMap((d) => d.rows.map((r) => cols.map((c) => String(r[c]).includes(',') ? JSON.stringify(r[c]).replace(/"/g, "'") : r[c]).join(',')))].join('\n') + '\n');
    writeFileSync(join(out, `${tag}.json`), JSON.stringify(data.map(({ rows, ...rest }) => rest), null, 1));
  }
  if (logsDir) {
    mkdirSync(logsDir, { recursive: true });
    results.forEach((r, i) => { if (r.log) writeFileSync(join(logsDir, `${tasks[i].spec.map}-${tasks[i].spec.blue}-v-${tasks[i].spec.red}-seed${tasks[i].spec.seed}.jsonl`), r.log); });
  }
  if (replayFails) process.exit(1);
}
