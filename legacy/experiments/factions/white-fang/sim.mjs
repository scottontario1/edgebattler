// Paired, side-swapped simulations of the White Fang Clans against the baseline army and against themselves.
//
//   node experiments/factions/white-fang/sim.mjs [--seeds 100] [--map river_ford|<experiments/maps name>] [--max-rounds 30]
//        [--rules dvil=5,dkeep=1] [--cells id,id,...] [--replay 5] [--out docs/experiments/results/factions/white-fang]
//
// Every cell plays seeds 1..N twice, once with the subject army on Blue and once on Red (the map is not symmetric), so a cell has 2N
// games. The rarity time gate (uncommon from round 3, rare from round 6) is on in every cell. `--replay K` rebuilds the first K games
// of each orientation from their logs (header + logged actions) and fails on any mismatch.
//
// Cells (subject v opponent; the opponent always plays the shipped heuristic):
//   fang-cmd     White Fang (clan commander, experiments/factions/white-fang/commander.mjs) v the baseline army (plain classes, Brenna)
//   fang-heur    White Fang played by the shipped heuristic v the baseline army: what the unaware AI does with the clan cards
//   mirror       White Fang (clan commander) v White Fang (clan commander, Dreg's twin as champion)
//   control      plain classes with Dreg as champion v plain classes with Brenna: what the champion swap alone does (no culture cards)
//   fang-axe     fang-cmd with the axe weapon triangle switched on (sensitivity)
//   fang-mov2    fang-cmd with Reaver Mov +2 instead of +1 (sensitivity)
//   fang-nopool  White Fang units and kits but the shared card pool (isolates the pool/spells from the units)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createMatch, setExperimentRules } from '../../../src/match.js';
import { runCommander } from '../../../src/ai/commander.js';
import { setRarityGate } from '../../../src/cards.js';
import { registerCulture, resetCultures } from '../../../src/cultures.js';
import { memoryLog, replay } from '../../../src/log.js';
import { setMap, DEFAULT_MAP } from '../../../src/board.js';
import { buildWhiteFang } from '../../../src/factions/white-fang.js';
import { matchOptions, registerMirrorChampion } from './armies.mjs';
import { runFang } from './commander.mjs';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const seeds = Number(opt('seeds', 100));
const maxRounds = Number(opt('max-rounds', 30));
const replayK = Number(opt('replay', 5));
const mapName = opt('map', 'river_ford');
const outDir = resolve(opt('out', 'docs/experiments/results/factions/white-fang'));
const only = opt('cells', '').split(',').filter(Boolean);
const GATE = { uncommon: 3, rare: 6 };
// Experiment overlay (off by default; the shipped rules are dvil=1, dkeep=1): village / keep deployment radius, see docs/experiments/DEPLOY_AND_MUSTER.md.
const RULE_KEYS = { dvil: 'deployRangeVillage', dkeep: 'deployRangeKeep' };
const rules = Object.fromEntries(opt('rules', '').split(',').filter(Boolean).map((kv) => { const [k, v] = kv.split('='); return [RULE_KEYS[k], Number(v)]; }));
const rulesTag = opt('rules', '').replace(/[,=]/g, '-');
setExperimentRules(rules);
const map = mapName === 'river_ford' ? DEFAULT_MAP : (await import(pathToFileURL(resolve('experiments/maps', `${mapName}.js`)).href)).default;
setMap(map);
const commit = (() => { try { return execFileSync('git', ['-c', `safe.directory=${process.cwd()}`, 'rev-parse', '--short', 'HEAD']).toString().trim(); } catch { return null; } })();

// A cell: army kinds for the subject and the opponent, who plays them, and the culture options.
const CELLS = {
  'fang-cmd': { title: 'White Fang (clan commander) v baseline', subject: 'fang', opponent: 'base', subjectAI: 'fang', options: {} },
  'fang-heur': { title: 'White Fang (shipped heuristic) v baseline', subject: 'fang', opponent: 'base', subjectAI: 'heuristic', options: {} },
  mirror: { title: 'White Fang mirror (clan commander both sides)', subject: 'fang', opponent: 'fang2', subjectAI: 'fang', opponentAI: 'fang', options: {}, mirror: true },
  control: { title: 'Control: plain classes + Dreg v plain classes + Brenna (no clan cards)', subject: 'baseDreg', opponent: 'base', subjectAI: 'heuristic', options: {} },
  'fang-axe': { title: 'Sensitivity: clan axes use the axe weapon triangle', subject: 'fang', opponent: 'base', subjectAI: 'fang', options: { weaponKind: 'axe' } },
  'fang-mov2': { title: 'Sensitivity: Reaver Mov +2', subject: 'fang', opponent: 'base', subjectAI: 'fang', options: { reaverMovDelta: 2 } },
  'fang-nopool': { title: 'Sensitivity: clan units and kits, shared card pool', subject: 'fang', opponent: 'base', subjectAI: 'fang', options: {}, sharedPool: true },
};

const wilson = (k, n) => { if (!n) return [0, 0]; const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - h), Math.min(1, c + h)]; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x) => `${(100 * x).toFixed(1)}%`;
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

function register(cell) {
  resetCultures();
  registerCulture(buildWhiteFang(cell.options));
  if (cell.mirror) registerMirrorChampion(buildWhiteFang(cell.options));
}
const optionsFor = (cell, kinds) => {
  const o = matchOptions(kinds.blue, kinds.red);
  if (cell.sharedPool) delete o.pools;
  return o;
};
const play = (cell, seed, subjectOn, keepLog) => {
  const kinds = subjectOn === 'blue' ? { blue: cell.subject, red: cell.opponent } : { blue: cell.opponent, red: cell.subject };
  const ai = subjectOn === 'blue' ? { blue: cell.subjectAI, red: cell.opponentAI || 'heuristic' } : { blue: cell.opponentAI || 'heuristic', red: cell.subjectAI };
  const log = memoryLog();
  const m = createMatch({ seed, maxRounds, log: log.push, meta: { source: 'fang-sim', commit, kinds, ai, cell: cell.id }, ...optionsFor(cell, kinds) });
  const run = (f) => (ai[f] === 'fang' ? runFang(m, f) : runCommander(m, f, ai[f]));
  while (!m.over) { run('blue'); run('red'); m.resolveRound(); }
  const s = m.stats();
  const other = subjectOn === 'blue' ? 'red' : 'blue';
  const rounds = log.entries.filter((e) => e.t === 'round').length;
  const won = m.winner === subjectOn ? 1 : m.winner === other ? 0 : null;
  return { seed, subjectOn, winner: m.winner, reason: m.reason, won, rounds, log: keepLog ? log : null, kinds,
    subj: s[subjectOn], opp: s[other], fin: { subject: m.summary(subjectOn), opponent: m.summary(other) } };
};

const report = [];
let replayFails = 0, replayed = 0;
for (const [id, c] of Object.entries(CELLS)) {
  if (only.length && !only.includes(id)) continue;
  const cell = { id, ...c };
  register(cell);
  const games = [];
  for (const subjectOn of ['blue', 'red']) {
    for (let seed = 1; seed <= seeds; seed += 1) {
      const g = play(cell, seed, subjectOn, seed <= replayK);
      if (g.log) {
        const check = replay(g.log.entries, { create: (h, push) => { setRarityGate(h.rarityGate || {}); setExperimentRules(h.experimentRules || {}); return createMatch({ seed: h.seed, maxRounds: h.maxRounds, log: push, ...optionsFor(cell, h.kinds) }); } });
        replayed += 1;
        if (!check.ok) { replayFails += 1; console.error(`REPLAY MISMATCH ${id} seed ${seed} ${subjectOn}`, JSON.stringify(check.mismatches[0]).slice(0, 300)); }
        g.log = null;
      }
      games.push(g);
    }
  }
  const rowFor = (gs) => {
    const n = gs.length, w = gs.filter((g) => g.won === 1).length, l = gs.filter((g) => g.won === 0).length, d = n - w - l;
    const decided = gs.filter((g) => g.winner);
    return { games: n, wins: w, losses: l, draws: d, winRate: w / n, winCI: wilson(w, n), lossRate: l / n, drawRate: d / n, drawCI: wilson(d, n),
      rounds: mean(gs.map((g) => g.rounds)), decidedRounds: mean(decided.map((g) => g.rounds)), decided: decided.length,
      keepWins: gs.filter((g) => g.won === 1 && g.reason === 'keep-captured').length, wipeWins: gs.filter((g) => g.won === 1 && g.reason === 'army-destroyed').length,
      capSubj: mean(gs.map((g) => g.subj.captures)), capOpp: mean(gs.map((g) => g.opp.captures)), anyCap: mean(gs.map((g) => (g.subj.captures + g.opp.captures > 0 ? 1 : 0))),
      lostSubj: mean(gs.map((g) => sum(g.subj.lost))), lostOpp: mean(gs.map((g) => sum(g.opp.lost))),
      hpSubj: mean(gs.map((g) => g.fin.subject.hp)), hpOpp: mean(gs.map((g) => g.fin.opponent.hp)),
      recruited: gs.reduce((o, g) => { for (const [k, v] of Object.entries(g.subj.recruited)) o[k] = (o[k] || 0) + v / gs.length; return o; }, {}),
      abilities: gs.reduce((o, g) => { for (const [k, v] of Object.entries(g.subj.abilities)) o[k] = (o[k] || 0) + v / gs.length; return o; }, {}),
      spells: gs.reduce((o, g) => { for (const [k, v] of Object.entries(g.subj.spells)) o[k] = (o[k] || 0) + v / gs.length; return o; }, {}),
      energySpent: mean(gs.map((g) => g.subj.energySpent)) };
  };
  report.push({ id, title: cell.title, seeds, map: mapName, maxRounds, all: rowFor(games), asBlue: rowFor(games.filter((g) => g.subjectOn === 'blue')), asRed: rowFor(games.filter((g) => g.subjectOn === 'red')) });
  const a = report.at(-1).all;
  console.log(`${id.padEnd(12)} n=${a.games} win ${pct(a.winRate)} (${pct(a.winCI[0])}-${pct(a.winCI[1])}) loss ${pct(a.lossRate)} draw ${pct(a.drawRate)} rounds ${a.rounds.toFixed(1)} keep-wins ${a.keepWins} cap s/o ${a.capSubj.toFixed(2)}/${a.capOpp.toFixed(2)}`);
}
resetCultures();
setRarityGate({});
setExperimentRules({});

const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2);
const lines = [`## ${mapName}${rulesTag ? ` with experiment rules ${rulesTag}` : ''}: ${seeds} seeds x 2 sides per cell, max ${maxRounds} rounds, rarity gate uncommon ${GATE.uncommon} / rare ${GATE.rare}`, '',
  'Subject win, loss and draw rates are over all 2N games (subject on Blue and on Red); the interval is a 95% Wilson interval. A draw is the round limit.', '',
  '| cell | games | subject win | 95% | opponent win | draw | 95% draw | rounds (all / decided) | subject keep wins | villages captured s / o | anyone captured a village | subject / opp units lost |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
for (const r of report) {
  const a = r.all;
  lines.push(`| ${r.id} | ${a.games} | ${pct(a.winRate)} | ${pct(a.winCI[0])}-${pct(a.winCI[1])} | ${pct(a.lossRate)} | ${pct(a.drawRate)} | ${pct(a.drawCI[0])}-${pct(a.drawCI[1])} | ${f1(a.rounds)} / ${f1(a.decidedRounds)} | ${a.keepWins} | ${f2(a.capSubj)} / ${f2(a.capOpp)} | ${pct(a.anyCap)} | ${f1(a.lostSubj)} / ${f1(a.lostOpp)} |`);
}
lines.push('', '### By orientation (subject on Blue / on Red)', '', '| cell | subject win as Blue | as Red | draw as Blue | as Red |', '|---|---|---|---|---|');
for (const r of report) lines.push(`| ${r.id} | ${pct(r.asBlue.winRate)} (${pct(r.asBlue.winCI[0])}-${pct(r.asBlue.winCI[1])}) | ${pct(r.asRed.winRate)} (${pct(r.asRed.winCI[0])}-${pct(r.asRed.winCI[1])}) | ${pct(r.asBlue.drawRate)} | ${pct(r.asRed.drawRate)} |`);
lines.push('', '### What the subject played (mean per game)', '', '| cell | recruited | ability uses | spells cast | energy spent |', '|---|---|---|---|---|');
const fmt = (o) => Object.entries(o).filter(([, v]) => v > 0.005).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ') || 'none';
for (const r of report) lines.push(`| ${r.id} | ${fmt(r.all.recruited)} | ${fmt(r.all.abilities)} | ${fmt(r.all.spells)} | ${f2(r.all.energySpent)} |`);
lines.push('', `Replay checks: ${replayed - replayFails}/${replayed} games rebuilt from their logs (header + actions) with no mismatch. Commit ${commit}.`);
mkdirSync(outDir, { recursive: true });
const stem = `sim-${mapName}${rulesTag ? `-${rulesTag}` : ''}${only.length ? `-${only.join('+')}` : ''}`;
writeFileSync(join(outDir, `${stem}.md`), lines.join('\n') + '\n');
writeFileSync(join(outDir, `${stem}.json`), JSON.stringify(report.map(({ id, title, all, asBlue, asRed }) => ({ id, title, all, asBlue, asRed })), null, 1));
console.log(`replay ${replayed - replayFails}/${replayed}`);
if (replayFails) process.exit(1);
