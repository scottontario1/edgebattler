// Paired, side-swapped AI-vs-AI simulation of the Argent Crown on the shipped map (river_ford), modelled on tools/sim/run.mjs and
// experiments/economy/sweep.mjs. Every seed is played with the Crown on Blue and again on Red; games run on worker threads; one game per
// cell and side assignment is replayed from its log (culture, pools, rarity gate, champions and rosters come from the header) to check determinism.
//
//   node experiments/factions/argent-crown/sim.mjs [--seeds 200] [--cells crown-vs-base,...] [--max-rounds 30] [--out docs/experiments/results/factions/argent-crown]
//
// Armies (identical rules for both cultures except the culture itself):
//   base   the shipped starting units with plain classes, the shipped draw pool (RECRUITMENT_POOL), champion `paladinPlain` (Brenna's body, no kit, no passive)
//   crown  the same starting units turned into their Crown versions (same stats and weapons, plus Line Doctrine), champion `brennaCrown`, the Crown pool
// Rarity gate: uncommon from round 3, rare from round 6, for both sides (setRarityGate; the baseline pool is all common).
// AIs: `heuristic` = src/ai/commander.js as shipped; `crown` = crown-commander.mjs (the same heuristic plus Rally Banner, closing up, hold-early, reserve Knights, Oathsworn, kit picks).
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

export const CELLS = [
  { id: 'crown-vs-base', title: 'Crown (crown AI) v baseline (heuristic)', a: { culture: 'crown', ai: 'crown' }, b: { culture: 'base', ai: 'heuristic' } },
  { id: 'crownplain-vs-base', title: 'Crown (plain heuristic) v baseline (heuristic)', a: { culture: 'crown', ai: 'heuristic' }, b: { culture: 'base', ai: 'heuristic' } },
  { id: 'crown-vs-crownplain', title: 'Crown (crown AI) v Crown (plain heuristic): what the culture-aware AI adds', a: { culture: 'crown', ai: 'crown' }, b: { culture: 'crown', ai: 'heuristic' } },
  { id: 'mirror', title: 'Mirror: Crown (crown AI) v Crown (crown AI); "A" is Blue, so this is the side / map bias', a: { culture: 'crown', ai: 'crown' }, b: { culture: 'crown', ai: 'crown' }, mirror: true },
  { id: 'base-mirror', title: 'Control: baseline v baseline (heuristic); "A" is Blue', a: { culture: 'base', ai: 'heuristic' }, b: { culture: 'base', ai: 'heuristic' }, mirror: true },
];
const RARITY = { uncommon: 3, rare: 6 };

// ---------------------------------------------------------------- game construction (shared by the worker and the replay)
async function setup() {
  const M = {};
  M.match = await import('../../../src/match.js');
  M.roster = await import('../../../src/roster.js');
  M.cards = await import('../../../src/cards.js');
  M.cultures = await import('../../../src/cultures.js');
  M.board = await import('../../../src/board.js');
  M.log = await import('../../../src/log.js');
  M.commander = await import('../../../src/ai/commander.js');
  M.crownAI = await import('./crown-commander.mjs');
  const crown = await import('../../../src/factions/argent-crown.js');
  M.cultures.resetCultures();
  crown.registerArgentCrown();
  const body = { name: 'Brenna', title: 'Paladin', cls: 'paladin', stats: { hp: 28, str: 9, skl: 5, spd: 3, def: 13, res: 1, mov: 4, lv: 4 }, weapon: 'Iron Sword', look: { skin: '#f0cdb4', hair: '#c9b6e6', eyes: '#5a64c8', style: 'long' } };
  M.cultures.registerCulture({ id: 'crown-baseline', champions: { paladinPlain: { ...body, faction: 'blue' }, paladinPlainB: { ...body, faction: 'red' } } });
  M.board.setMap(M.board.DEFAULT_MAP);
  M.cards.setRarityGate(RARITY);
  M.CROWN_OF = { pikeman: 'crownPike', archer: 'crownArcher', cavalier: 'crownCavalier' };
  M.LINE = crown.LINE_DOCTRINE;
  return M;
}

/** The starting roster of `faction` for a culture: the shipped units, in their places, as plain or Crown units. */
function armyFor(M, faction, side, mirrorSecond) {
  const { UNITS, createChampionUnit } = M.roster;
  const out = [];
  let champion = null;
  for (const u of UNITS.filter((x) => x.faction === faction)) {
    if (u.cls === 'paladin' || u.cls === 'barbarian') {
      champion = side.culture === 'crown' ? (mirrorSecond ? 'brennaCrownB' : 'brennaCrown') : (faction === 'blue' ? 'paladinPlain' : 'paladinPlainB');
      out.push(createChampionUnit(champion, faction, u.c, u.r));
      continue;
    }
    const rec = structuredClone(u); // keeps the shipped weapon / level overrides, so both cultures field identical bodies
    if (side.culture === 'crown') {
      const key = M.CROWN_OF[u.cls];
      const variant = M.roster.VARIANTS[key];
      Object.assign(rec, { variantId: key, culture: 'crown', name: variant.name, title: variant.title, passives: structuredClone(variant.passives) });
    }
    out.push(rec);
  }
  return { units: out, champion };
}

function build(M, cfg, seed, maxRounds, push) {
  M.cards.setRarityGate(RARITY);
  M.board.setMap(M.board.DEFAULT_MAP);
  const secondCrown = cfg.blue.culture === 'crown' && cfg.red.culture === 'crown';
  const blue = armyFor(M, 'blue', cfg.blue, false), red = armyFor(M, 'red', cfg.red, secondCrown);
  const pool = (side) => (side.culture === 'crown' ? M.cultures.culturePool('crown') : [...M.cards.RECRUITMENT_POOL]);
  return M.match.createMatch({ seed, maxRounds, log: push, roster: [...blue.units, ...red.units], champions: { blue: blue.champion, red: red.champion },
    pools: { blue: pool(cfg.blue), red: pool(cfg.red) }, meta: { source: 'crown-sim', cfg } });
}

async function playChunk(M, task) {
  const { cell, aSide, seeds, maxRounds, verify } = task;
  const cfg = aSide === 'blue' ? { blue: cell.a, red: cell.b } : { blue: cell.b, red: cell.a };
  const rows = [];
  let replayed = 0, replayFail = 0;
  for (const [i, seed] of seeds.entries()) {
    const log = M.log.memoryLog();
    const m = build(M, cfg, seed, maxRounds, log.push);
    while (!m.over) {
      for (const f of ['blue', 'red']) {
        const side = cfg[f];
        if (side.ai === 'crown') M.crownAI.crownCommander(m, f, { act: (a) => m.apply(a, 'ai:crown'), params: {} });
        else M.commander.runCommander(m, f, 'heuristic');
      }
      m.resolveRound();
    }
    const stats = m.stats();
    const aFaction = aSide, bFaction = aSide === 'blue' ? 'red' : 'blue';
    const rounds = log.entries.filter((e) => e.t === 'round').length;
    const sum = (o) => Object.values(o).reduce((x, y) => x + y, 0);
    rows.push({ cell: cell.id, aSide, seed, winner: m.winner ? (m.winner === aFaction ? 'a' : 'b') : 'draw', reason: m.reason, rounds,
      villageCaptures: stats.blue.captures + stats.red.captures, aLost: sum(stats[aFaction].lost), bLost: sum(stats[bFaction].lost),
      aSpells: sum(stats[aFaction].spells), aAbilities: sum(stats[aFaction].abilities), bAbilities: sum(stats[bFaction].abilities), aRespawns: stats[aFaction].respawns, bRespawns: stats[bFaction].respawns });
    if (verify && i === 0) {
      const check = M.log.replay(log.entries, { create: (h, push) => { M.cards.setRarityGate(h.rarityGate || {}); return build(M, h.cfg || h.meta?.cfg, h.seed, h.maxRounds, push); } });
      replayed += 1;
      if (!check.ok) { replayFail += 1; console.error(`REPLAY MISMATCH ${cell.id} ${aSide} seed ${seed}`, JSON.stringify(check.mismatches[0]).slice(0, 400)); }
    }
  }
  return { rows, replayed, replayFail };
}

// ---------------------------------------------------------------- worker
if (!isMainThread) {
  const M = await setup();
  parentPort.on('message', async (task) => {
    try { parentPort.postMessage({ id: task.id, ...(await playChunk(M, task)) }); } catch (e) { parentPort.postMessage({ id: task.id, error: String(e.stack || e) }); }
  });
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}

// ---------------------------------------------------------------- main
const wilson = (k, n) => { if (!n) return [0, 0]; const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - h), Math.min(1, c + h)]; };
const pct = (x) => `${(100 * x).toFixed(1)}%`;
const ci = (k, n) => { const [lo, hi] = wilson(k, n); return `${pct(k / n)} (${pct(lo)}-${pct(hi)})`; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

async function main() {
  const argv = process.argv.slice(2);
  const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
  const seedsN = Number(opt('seeds', 200));
  const maxRounds = Number(opt('max-rounds', 30));
  const want = opt('cells', CELLS.map((c) => c.id).join(',')).split(',');
  const outDir = resolve(opt('out', 'docs/experiments/results/factions/argent-crown'));
  const cells = CELLS.filter((c) => want.includes(c.id));
  const CHUNK = 20;
  const tasks = [];
  for (const cell of cells) for (const aSide of cell.mirror ? ['blue'] : ['blue', 'red']) {
    for (let s = 1; s <= seedsN; s += CHUNK) tasks.push({ id: tasks.length, cell, aSide, seeds: Array.from({ length: Math.min(CHUNK, seedsN - s + 1) }, (_, i) => s + i), maxRounds, verify: s === 1 });
  }
  const t0 = Date.now();
  const nWorkers = Math.max(1, Math.min(cpus().length - 1, tasks.length));
  const workers = Array.from({ length: nWorkers }, () => new Worker(fileURLToPath(import.meta.url)));
  const results = new Array(tasks.length);
  let next = 0, done = 0;
  await new Promise((res, rej) => {
    const feed = (w) => { if (next < tasks.length) w.postMessage(tasks[next++]); };
    for (const w of workers) { w.on('message', (msg) => { if (msg.error) return rej(new Error(msg.error)); results[msg.id] = msg; done += 1; if (done === tasks.length) res(); else feed(w); }); w.on('error', rej); feed(w); }
  });
  await Promise.all(workers.map((w) => w.terminate()));
  const rows = results.flatMap((r) => r.rows);
  const replayed = results.reduce((s, r) => s + r.replayed, 0), replayFail = results.reduce((s, r) => s + r.replayFail, 0);

  const lines = [];
  lines.push('| cell | games | A win | B win | draw | mean rounds | keep captured | army destroyed | round limit | village captures / game |', '|---|---|---|---|---|---|---|---|---|---|');
  const summary = [];
  for (const cell of cells) {
    const r = rows.filter((x) => x.cell === cell.id), n = r.length;
    const k = (w) => r.filter((x) => x.winner === w).length;
    const reason = (re) => r.filter((x) => x.reason === re).length;
    const rec = { cell: cell.id, games: n, aWins: k('a'), bWins: k('b'), draws: k('draw'), meanRounds: mean(r.map((x) => x.rounds)), keep: reason('keep-captured'), wipe: reason('army-destroyed'), limit: reason('round-limit'), villages: mean(r.map((x) => x.villageCaptures)),
      bySide: ['blue', 'red'].map((s) => { const q = r.filter((x) => x.aSide === s); return { aSide: s, games: q.length, aWins: q.filter((x) => x.winner === 'a').length, bWins: q.filter((x) => x.winner === 'b').length, draws: q.filter((x) => x.winner === 'draw').length }; }) };
    summary.push(rec);
    lines.push(`| ${cell.title} | ${n} | ${ci(rec.aWins, n)} | ${ci(rec.bWins, n)} | ${ci(rec.draws, n)} | ${rec.meanRounds.toFixed(1)} | ${ci(rec.keep, n)} | ${ci(rec.wipe, n)} | ${ci(rec.limit, n)} | ${rec.villages.toFixed(2)} |`);
  }
  lines.push('', 'By side of A (A = the first-named army; in mirror cells A is always Blue):', '', '| cell | A on | games | A win | B win | draw |', '|---|---|---|---|---|---|');
  for (const rec of summary) for (const s of rec.bySide) if (s.games) lines.push(`| ${rec.cell} | ${s.aSide} | ${s.games} | ${ci(s.aWins, s.games)} | ${ci(s.bWins, s.games)} | ${ci(s.draws, s.games)} |`);
  const text = lines.join('\n');
  console.log(`${rows.length} games (${seedsN} seeds${cells.some((c) => !c.mirror) ? ' x 2 sides' : ''}) in ${((Date.now() - t0) / 1000).toFixed(1)}s on ${nWorkers} workers; replay checks ${replayed - replayFail}/${replayed} ok\n`);
  console.log(text);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'sim-summary.md'), `${text}\n\nSeeds per side assignment: ${seedsN}; max rounds ${maxRounds}; rarity gate ${JSON.stringify(RARITY)}; replay checks ${replayed - replayFail}/${replayed} ok.\n`);
  writeFileSync(join(outDir, 'sim-summary.json'), JSON.stringify({ seeds: seedsN, maxRounds, rarityGate: RARITY, replayed, replayFail, summary }, null, 1));
  writeFileSync(join(outDir, 'sim-games.csv'), ['cell,aSide,seed,winner,reason,rounds,villageCaptures,aLost,bLost,aSpells,aAbilities,bAbilities,aRespawns,bRespawns', ...rows.map((x) => [x.cell, x.aSide, x.seed, x.winner, x.reason, x.rounds, x.villageCaptures, x.aLost, x.bLost, x.aSpells, x.aAbilities, x.bAbilities, x.aRespawns, x.bRespawns].join(','))].join('\n') + '\n');
  if (replayFail) process.exit(1);
}
