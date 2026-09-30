// Paired, side-swapped simulation of the Hollow Court against the baseline army and itself (docs/factions/HOLLOW_COURT.md).
//   node experiments/factions/hollow-court/sim.mjs [--seeds 200] [--max-rounds 30] [--map river_ford] [--only court:base,...]
//                                                  [--rarity gate|off] [--out docs/experiments/results/factions/hollow-court]
// A matchup "A:B" plays seeds 1..N with A on blue and again with A on red (same seed, same dice), so map asymmetry cancels. A
// mirror (A:A) has no sides to swap, so it plays 2N distinct seeds once. One game per (matchup, side assignment) is replayed
// from its log and must reproduce exactly. Matchups run on worker threads, one culture build per worker.
// Reported per matchup: A's win rate (95% Wilson), draw rate (95% Wilson), game length, how games end (keep capture / army destroyed
// / round limit), villages captured, and the Court's death-mechanic counters (corpses made, eaten, expired, Revenant returns).
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';

export const MATCHUPS = ['base:base', 'court:base', 'courtOff:base', 'courtPlain:base', 'court:court', 'courtOff:courtOff'];
// Extra arm: the same comparison with the unmodified shipped heuristic driving the Court (`--only` these; `--tag` keeps the files apart)
export const PLAIN_MATCHUPS = ['courtPlain:base', 'courtOffPlain:base', 'courtPlain:courtPlain', 'courtOffPlain:courtOffPlain'];
const wilson = (k, n) => { if (!n) return [0, 0]; const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - h), Math.min(1, c + h)]; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

async function runMatchup({ matchup, seeds, maxRounds, map, gate, dvil }) {
  const [A, B] = matchup.split(':');
  const { createMatch } = await import('../../../src/match.js');
  const { memoryLog, replay } = await import('../../../src/log.js');
  const { setMap, DEFAULT_MAP } = await import('../../../src/board.js');
  const { setRarityGate } = await import('../../../src/cards.js');
  const { setExperimentRules } = await import('../../../src/match.js');
  const { setupCulture, matchOptions, plan } = await import('./armies.mjs');
  setMap(map && map !== 'river_ford' ? (await import(pathToFileURL(resolve('experiments/maps', `${map}.js`)).href)).default : DEFAULT_MAP);
  setupCulture([A, B]);
  if (gate) setRarityGate({ uncommon: 3, rare: 6 });
  if (dvil) setExperimentRules({ deployRangeVillage: dvil });
  const play = (seed, sides, log) => {
    const m = createMatch({ seed, maxRounds, log: log?.push, ...matchOptions(sides) });
    while (!m.over) { plan(m, 'blue', sides.blue); plan(m, 'red', sides.red); m.resolveRound(); }
    return m;
  };
  const plans = [];
  if (A === B) for (let s = 1; s <= seeds * 2; s += 1) plans.push({ seed: s, sides: { blue: A, red: B } });
  else for (let s = 1; s <= seeds; s += 1) { plans.push({ seed: s, sides: { blue: A, red: B } }); plans.push({ seed: s, sides: { blue: B, red: A } }); }
  const rows = [];
  let replayed = 0, replayFail = 0;
  const seenAssign = new Set();
  for (const { seed, sides } of plans) {
    const assign = `${sides.blue}/${sides.red}`;
    const doReplay = !seenAssign.has(assign);
    seenAssign.add(assign);
    const log = memoryLog();
    const m = play(seed, sides, doReplay ? log : null);
    if (doReplay) {
      const check = replay(log.entries, { create: (h, push) => { setRarityGate(h.rarityGate || {}); setExperimentRules(h.experimentRules || {}); return createMatch({ seed: h.seed, maxRounds: h.maxRounds, log: push, ...matchOptions(sides) }); } });
      replayed += 1;
      if (!check.ok) { replayFail += 1; console.error(`REPLAY MISMATCH ${matchup} seed ${seed} ${assign}`, JSON.stringify(check.mismatches[0]).slice(0, 300)); }
    }
    const st = m.stats();
    const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
    const aSide = sides.blue === A ? 'blue' : 'red';
    const winner = m.winner ? (m.winner === aSide ? 'A' : 'B') : 'draw';
    // Court death counters come from the side(s) that are Courts; abilities are counted by id in stats.abilities.
    const courtSides = ['blue', 'red'].filter((f) => sides[f].startsWith('court'));
    const ab = (id) => courtSides.reduce((s, f) => s + (st[f].abilities[id] || 0), 0);
    rows.push({ seed, blueArmy: sides.blue, winner, reason: m.reason || 'round-limit', rounds: m.reason === 'round-limit' ? m.round - 1 : m.round,
      villagesA: st[aSide].captures, villagesB: st[aSide === 'blue' ? 'red' : 'blue'].captures,
      lostA: sum(st[aSide].lost), lostB: sum(st[aSide === 'blue' ? 'red' : 'blue'].lost),
      corpsesEaten: ab('graveRally') + ab('consumeRemains') + ab('decreeOfAttendance') + ab('ledgerOfTheDead'),
      objectsLeft: m.objects.length,
      supplySpent: st[aSide].supplySpent, blocked: st[aSide].blockedDraws,
      abilityUsesA: sum(st[aSide].abilities) });
    if (doReplay) rows.at(-1).replayed = true;
  }
  // Counters that need the logs (corpses created, Revenant returns) are computed for the replayed games only, so sample them
  // separately over the first 40 seeds of each assignment.
  const counters = { games: 0, corpsesMade: 0, corpsesEaten: 0, corpsesExpired: 0, returns: 0, deaths: 0 };
  for (const { seed, sides } of plans.filter((p) => p.seed <= 40)) {
    const log = memoryLog();
    play(seed, sides, log);
    const rounds = log.entries.filter((e) => e.t === 'round');
    const res = rounds.flatMap((r) => r.batches.filter((b) => b.type === 'results').flatMap((b) => b.events));
    const combat = rounds.flatMap((r) => r.batches.filter((b) => b.type === 'combat').flatMap((b) => b.events));
    const abil = rounds.flatMap((r) => r.batches.filter((b) => b.type === 'abilities').flatMap((b) => b.events));
    counters.games += 1;
    counters.corpsesMade += new Set(log.entries.filter((e) => e.t === 'summary').flatMap((s) => (s.objects || []).map((o) => o.id))).size;
    counters.corpsesEaten += abil.filter((e) => e.applied && e.consumed).reduce((s, e) => s + e.consumed, 0);
    counters.corpsesExpired += res.filter((e) => e.type === 'objectExpired').length;
    counters.returns += res.filter((e) => e.type === 'return').length;
    counters.deaths += combat.filter((e) => e.type === 'death').length;
  }
  return { matchup, A, B, rows, replayed, replayFail, counters };
}

function summarise(r) {
  const n = r.rows.length;
  const count = (f) => r.rows.filter(f).length;
  const wins = count((x) => x.winner === 'A'), losses = count((x) => x.winner === 'B'), draws = count((x) => x.winner === 'draw');
  const decided = r.rows.filter((x) => x.winner !== 'draw');
  const keep = count((x) => x.reason === 'keep-captured'), wipe = count((x) => x.reason === 'army-destroyed');
  const anyVillage = count((x) => x.villagesA + x.villagesB > 0);
  const bySide = (armyKey) => r.rows.filter((x) => x.blueArmy === armyKey);
  return { matchup: r.matchup, n, wins, losses, draws, winCI: wilson(wins, n), drawCI: wilson(draws, n), lossCI: wilson(losses, n),
    rounds: mean(r.rows.map((x) => x.rounds)), decidedRounds: mean(decided.map((x) => x.rounds)), keep, wipe, anyVillage,
    villages: mean(r.rows.map((x) => x.villagesA + x.villagesB)), lostA: mean(r.rows.map((x) => x.lostA)), lostB: mean(r.rows.map((x) => x.lostB)),
    winsAsBlue: r.A === r.B ? null : bySide(r.A).filter((x) => x.winner === 'A').length / Math.max(1, bySide(r.A).length),
    winsAsRed: r.A === r.B ? null : bySide(r.B).filter((x) => x.winner === 'A').length / Math.max(1, bySide(r.B).length),
    counters: r.counters, replayed: r.replayed, replayFail: r.replayFail };
}

if (!isMainThread) {
  runMatchup(workerData).then((r) => parentPort.postMessage({ ok: true, r }), (e) => parentPort.postMessage({ ok: false, error: String(e.stack || e) }));
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
  const seeds = Number(opt('seeds', 200)), maxRounds = Number(opt('max-rounds', 30)), map = opt('map', 'river_ford');
  const gate = opt('rarity', 'gate') !== 'off';
  const dvil = Number(opt('dvil', 1));
  const only = opt('only', null)?.split(',') || MATCHUPS;
  const out = resolve(opt('out', 'docs/experiments/results/factions/hollow-court'));
  const tag = opt('tag', `sim-${map}${dvil > 1 ? `-dvil${dvil}` : ''}${gate ? '' : '-nogate'}`);
  mkdirSync(out, { recursive: true });
  const t0 = Date.now();
  const results = [];
  const queue = [...only];
  await Promise.all(Array.from({ length: Math.min(cpus().length, queue.length) }, async () => {
    while (queue.length) {
      const matchup = queue.shift();
      await new Promise((ok, fail) => {
        const w = new Worker(fileURLToPath(import.meta.url), { workerData: { matchup, seeds, maxRounds, map, gate, dvil } });
        w.on('message', (msg) => { if (msg.ok) { results.push(msg.r); ok(); } else fail(new Error(msg.error)); });
        w.on('error', fail);
      });
    }
  }));
  results.sort((a, b) => only.indexOf(a.matchup) - only.indexOf(b.matchup));
  const sums = results.map(summarise);
  const pct = (x) => `${(100 * x).toFixed(1)}%`;
  const ci = (v) => `${pct(v[0])}-${pct(v[1])}`;
  const lines = [`# Hollow Court simulation: ${tag}`, '', `Map ${map}, max ${maxRounds} rounds, rarity gate ${gate ? 'uncommon 3 / rare 6' : 'off'}, village deployment radius ${dvil}, ${seeds} seeds per matchup (${seeds} x 2 sides; mirrors ${seeds * 2} seeds once). Win rate is for the first army of the matchup. ${((Date.now() - t0) / 1000).toFixed(0)}s.`, '',
    '| matchup (A:B) | games | A wins | A win rate (95%) | B wins | draws | draw rate (95%) | mean rounds | keep-captured | army-destroyed | villages/game | units lost A / B | A wins as blue | A wins as red | replay |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const s of sums) lines.push(`| ${s.matchup} | ${s.n} | ${s.wins} | ${pct(s.wins / s.n)} (${ci(s.winCI)}) | ${s.losses} | ${s.draws} | ${pct(s.draws / s.n)} (${ci(s.drawCI)}) | ${s.rounds.toFixed(1)} | ${s.keep} | ${s.wipe} | ${s.villages.toFixed(2)} | ${s.lostA.toFixed(1)} / ${s.lostB.toFixed(1)} | ${s.winsAsBlue == null ? '-' : pct(s.winsAsBlue)} | ${s.winsAsRed == null ? '-' : pct(s.winsAsRed)} | ${s.replayed - s.replayFail}/${s.replayed} ok |`);
  lines.push('', 'Death-mechanic counters (first 40 seeds of each side assignment, both armies counted):', '', '| matchup | games | corpses made | eaten | expired unused | Revenant returns | deaths |', '|---|---|---|---|---|---|---|');
  for (const s of sums) lines.push(`| ${s.matchup} | ${s.counters.games} | ${(s.counters.corpsesMade / s.counters.games).toFixed(2)} | ${(s.counters.corpsesEaten / s.counters.games).toFixed(2)} | ${(s.counters.corpsesExpired / s.counters.games).toFixed(2)} | ${(s.counters.returns / s.counters.games).toFixed(2)} | ${(s.counters.deaths / s.counters.games).toFixed(1)} |`);
  writeFileSync(join(out, `${tag}.md`), lines.join('\n') + '\n');
  writeFileSync(join(out, `${tag}.json`), JSON.stringify({ seeds, maxRounds, map, gate, dvil, summaries: sums, rows: Object.fromEntries(results.map((r) => [r.matchup, r.rows])) }));
  console.log(lines.join('\n'));
  if (sums.some((s) => s.replayFail)) process.exit(1);
}
