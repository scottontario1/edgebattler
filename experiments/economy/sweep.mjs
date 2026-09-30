// Economy sweep: play AI-vs-AI games over a mesh grid of card-economy limits and report how decisive and how
// pressured the matches are. Cells run in parallel on worker threads, without writing game logs; one game per
// cell is replayed from its log (limits are in the header) to check determinism.
//
//   node experiments/economy/sweep.mjs --grid pop=6,10,14,18,22,28 income=1,2,3,4,6,8 [--games 24] [--map flat_open]
//        [--pair heuristic:heuristic] [--bank auto|N] [--hand 8] [--start 3] [--draw 3] [--lhs N] [--out file.csv]
//
// Grid axes (any subset; others stay at the shipped value): keepdeploy (1 = shipped, 0 = the keep tile itself cannot be deployed onto), seize (heuristic seizeRatio, the HP lead needed before it marches on the keep; both sides), dmg (strike damage multiplier), pop (population cap), income (Supply per round),
// bank (Supply cap; `auto` = max(6, 2 x income)), hand (hand size), start (opening Supply), draw (cards per round).
// --lhs N draws N Latin-hypercube points over the min..max of the listed values instead of the full mesh.
// --pair a:b plays a (blue) v b (red); when they differ every seed is also played swapped.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';


// ---------------- worker: play games for one cell ----------------
async function playCell({ limits, map, blue, red, seeds, maxRounds, verify }) {
  const { createMatch } = await import('../../src/match.js');
  const { runCommander } = await import('../../src/ai/commander.js');
  const { setCardLimits } = await import('../../src/cards.js');
  const { BATTLE_TUNING } = await import('../../src/battle.js');
  const { EXPERIMENT_RULES } = await import('../../src/match.js');
  const { setMap, DEFAULT_MAP } = await import('../../src/board.js');
  const { memoryLog, replay } = await import('../../src/log.js');
  setMap(map && map !== 'river_ford' ? (await import(pathToFileURL(resolve('experiments/maps', `${map}.js`)).href)).default : DEFAULT_MAP);
  setCardLimits(limits);
  BATTLE_TUNING.damageScale = limits.damageScale ?? 1;
  EXPERIMENT_RULES.deployOnKeep = limits.deployOnKeep ?? true;
  const params = limits.seizeRatio === undefined ? {} : { seizeRatio: limits.seizeRatio }; // heuristic tuning axis (`seize`)
  const acc = { games: 0, draws: 0, keep: 0, wipe: 0, rounds: 0, strikes: 0, deaths: 0, roundEnds: 0, atCap: 0, handFull: 0, bankFull: 0, blockedUnit: 0, units: 0, decisions: 0, replayFail: 0, replayed: 0 };
  const play = (seed, b, r, log) => {
    const m = createMatch({ seed, maxRounds, log: log?.push });
    while (!m.over) {
      runCommander(m, 'blue', b, params);
      runCommander(m, 'red', r, params);
      const before = { blue: m.sides.blue.cards, red: m.sides.red.cards };
      // capacity state at the start of the round's battle (after both plans)
      for (const f of ['blue', 'red']) {
        const c = m.sides[f].cards;
        acc.roundEnds += 1;
        if (m.population(f) >= limits.populationCap) acc.atCap += 1;
        if (c.hand.length >= limits.hand) acc.handFull += 1;
        if (c.supply >= limits.maxSupply) acc.bankFull += 1;
        // stuck: an affordable unit card is in hand but there is no population room for it
        if (c.hand.some((card) => card.type === 'unit' && card.cost <= c.supply) && m.population(f) + 1 > limits.populationCap) acc.blockedUnit += 1;
        acc.units += m.alive(f).length;
      }
      const res = m.resolveRound();
      for (const batch of res.batches) if (batch.type === 'combat') for (const e of batch.events) { if (e.type === 'strike') acc.strikes += 1; else if (e.type === 'death') acc.deaths += 1; }
    }
    acc.games += 1;
    acc.rounds += m.reason === 'round-limit' ? m.round - 1 : m.round;
    if (!m.winner) acc.draws += 1;
    if (m.reason === 'keep-captured') acc.keep += 1;
    if (m.reason === 'army-destroyed') acc.wipe += 1;
    return m;
  };
  let first = true;
  for (const seed of seeds) {
    for (const [b, r] of blue === red ? [[blue, red]] : [[blue, red], [red, blue]]) {
      if (first && verify) {
        first = false;
        const log = memoryLog();
        play(seed, b, r, log);
        const check = replay(log.entries, { create: (h, push) => { setCardLimits(h.cardLimits); BATTLE_TUNING.damageScale = h.battleTuning?.damageScale ?? 1; EXPERIMENT_RULES.deployOnKeep = h.experimentRules?.deployOnKeep ?? true; return createMatch({ seed: h.seed, maxRounds: h.maxRounds, log: push }); } });
        acc.replayed += 1;
        if (!check.ok) acc.replayFail += 1;
      } else play(seed, b, r, null);
    }
  }
  return acc;
}

if (!isMainThread) {
  parentPort.on('message', async (task) => {
    try { parentPort.postMessage({ id: task.id, acc: await playCell(task) }); } catch (e) { parentPort.postMessage({ id: task.id, error: String(e.stack || e) }); }
  });
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}

// ---------------- main: build the grid, fan out, report ----------------
async function main() {
  const argv = process.argv.slice(2);
  const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
  const gi = argv.indexOf('--grid');
  const dims = {};
  if (gi >= 0) for (let i = gi + 1; i < argv.length && !argv[i].startsWith('--'); i += 1) { const [k, v] = argv[i].split('='); dims[k] = v.split(',').map(Number); }
  if (!Object.keys(dims).length) throw new Error('give --grid, e.g. --grid pop=6,10,14 income=1,3,6');
  const games = Number(opt('games', 24));
  const map = opt('map', 'flat_open');
  const [blue, red] = opt('pair', 'heuristic:heuristic').split(':');
  const maxRounds = Number(opt('max-rounds', 30));
  const bankArg = opt('bank', 'auto');
  const fixed = { hand: Number(opt('hand', 8)), start: Number(opt('start', 3)), draw: Number(opt('draw', 3)) };

  // Mesh grid (cartesian product) or Latin hypercube over the value ranges.
  const names = Object.keys(dims);
  let points = [[]];
  const lhs = Number(opt('lhs', 0));
  if (lhs) {
    const rng = (() => { let s = 12345; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); })();
    const perm = names.map(() => Array.from({ length: lhs }, (_, i) => i).sort(() => rng() - 0.5));
    points = Array.from({ length: lhs }, (_, i) => names.map((n, d) => { const [lo, hi] = [Math.min(...dims[n]), Math.max(...dims[n])]; return Math.round(lo + ((perm[d][i] + rng()) / lhs) * (hi - lo)); }));
  } else for (const n of names) points = points.flatMap((p) => dims[n].map((v) => [...p, v]));

  const cells = points.map((p, id) => {
    const v = { hand: fixed.hand, start: fixed.start, draw: fixed.draw, ...Object.fromEntries(names.map((n, i) => [n, p[i]])) };
    if (v.income === undefined) v.income = 3;
    if (v.pop === undefined) v.pop = 10;
    if (v.bank === undefined) v.bank = bankArg === 'auto' ? Math.max(6, 2 * v.income) : Number(bankArg);
    const limits = { ...(v.keepdeploy === undefined ? {} : { deployOnKeep: !!v.keepdeploy }), ...(v.seize === undefined ? {} : { seizeRatio: v.seize }), damageScale: v.dmg ?? 1, populationCap: v.pop, supplyPerRound: v.income, maxSupply: v.bank, hand: v.hand, initialSupply: Math.min(v.start, v.bank), laterDraw: v.draw, reserveCapacity: 8 };
    return { id, v, limits };
  });

  const t0 = Date.now();
  const workers = Array.from({ length: Math.max(1, Math.min(cpus().length - 1, cells.length)) }, () => new Worker(fileURLToPath(import.meta.url), { workerData: {} }));
  const results = new Array(cells.length);
  let next = 0, done = 0;
  await new Promise((resolveAll, rejectAll) => {
    const feed = (w) => {
      if (next >= cells.length) return;
      const cell = cells[next++];
      w.postMessage({ id: cell.id, limits: cell.limits, map, blue, red, maxRounds, seeds: Array.from({ length: games }, (_, i) => i + 1), verify: true });
    };
    for (const w of workers) {
      w.on('message', (msg) => {
        if (msg.error) return rejectAll(new Error(msg.error));
        results[msg.id] = msg.acc; done += 1;
        if (done === cells.length) resolveAll(); else feed(w);
      });
      w.on('error', rejectAll);
      feed(w);
    }
  });
  await Promise.all(workers.map((w) => w.terminate()));

  const rows = cells.map((c, i) => {
    const a = results[i];
    return { ...c.v, games: a.games, drawRate: a.draws / a.games, keep: a.keep / a.games, wipe: a.wipe / a.games, rounds: a.rounds / a.games,
      strikes: a.strikes / a.rounds, deaths: a.deaths / a.rounds, units: a.units / a.roundEnds, atCap: a.atCap / a.roundEnds, handFull: a.handFull / a.roundEnds,
      bankFull: a.bankFull / a.roundEnds, blocked: a.blockedUnit / a.roundEnds, replayFail: a.replayFail, replayed: a.replayed };
  });
  const fails = rows.reduce((s, r) => s + r.replayFail, 0);
  console.log(`${cells.length} cells x ${games} seeds${blue === red ? '' : ' x 2 sides'} (${blue} v ${red}, map ${map}, ${maxRounds} rounds) in ${((Date.now() - t0) / 1000).toFixed(1)}s on ${workers.length} workers; replay checks ${rows.length - fails}/${rows.length} ok`);

  const out = opt('out', null);
  if (out) {
    const cols = Object.keys(rows[0]);
    writeFileSync(out, [cols.join(','), ...rows.map((r) => cols.map((c) => (typeof r[c] === 'number' && !Number.isInteger(r[c]) ? r[c].toFixed(4) : r[c])).join(','))].join('\n') + '\n');
  }
  // Heat tables: rows = first axis, columns = second axis (other axes averaged).
  const [ra, ca] = names.length >= 2 ? names : [names[0], null];
  const metrics = [['drawRate', 'draws', (x) => `${Math.round(100 * x)}%`], ['rounds', 'rounds / game', (x) => x.toFixed(1)], ['deaths', 'deaths / round', (x) => x.toFixed(2)],
    ['atCap', 'round ends at the population cap', (x) => `${Math.round(100 * x)}%`], ['blocked', 'round ends with an affordable unit card but no population room', (x) => `${Math.round(100 * x)}%`],
    ['units', 'units alive per side', (x) => x.toFixed(1)]];
  const rv = [...new Set(rows.map((r) => r[ra]))].sort((a, b) => a - b);
  const cv = ca ? [...new Set(rows.map((r) => r[ca]))].sort((a, b) => a - b) : [null];
  for (const [key, label, fmt] of metrics) {
    console.log(`\n${label}  (rows ${ra}, columns ${ca ?? '—'})`);
    console.log(`| ${ra} \\ ${ca ?? ''} | ${cv.map((c) => c ?? '').join(' | ')} |`);
    console.log(`|---|${cv.map(() => '---').join('|')}|`);
    for (const r of rv) {
      const cellsFor = (c) => rows.filter((x) => x[ra] === r && (ca ? x[ca] === c : true));
      console.log(`| ${r} | ${cv.map((c) => { const cs = cellsFor(c); return cs.length ? fmt(cs.reduce((s, x) => s + x[key], 0) / cs.length) : ''; }).join(' | ')} |`);
    }
  }
  if (fails) process.exit(1);
}
