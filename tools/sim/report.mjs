// Summarise a simulator run: node tools/sim/report.mjs <run dir>   (reads summary.csv and game logs)
// Prints win rates with 95% Wilson intervals per policy matchup, game length, end reasons, and
// per-side averages; if game logs are present, per-class kills/losses and card plays.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fromJSONL } from '../../src/log.js';

const dir = resolve(process.argv[2] || '.');
const text = readFileSync(join(dir, 'summary.csv'), 'utf8').trim().split('\n');
const cols = text[0].split(',');
const rows = text.slice(1).map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], Number.isNaN(Number(v)) || v === '' ? v : Number(v)])));

const wilson = (k, n) => {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
};
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const count = (xs) => xs.reduce((o, x) => ((o[x] = (o[x] || 0) + 1), o), {});

console.log(`Run: ${dir}\n${rows.length} games`);
const groups = count(rows.map((r) => `${r.blue} (blue) vs ${r.red} (red)`));
for (const key of Object.keys(groups)) {
  const g = rows.filter((r) => `${r.blue} (blue) vs ${r.red} (red)` === key);
  const n = g.length;
  console.log(`\n== ${key}: ${n} games`);
  for (const f of ['blue', 'red', 'draw']) {
    const k = g.filter((r) => r.winner === f).length;
    const [lo, hi] = wilson(k, n);
    console.log(`  ${f.padEnd(5)} ${String(k).padStart(4)}  ${pct(k / n).padStart(6)}  (95% ${pct(lo)}–${pct(hi)})`);
  }
  const rounds = g.map((r) => r.rounds);
  console.log(`  rounds: mean ${mean(rounds).toFixed(1)}, median ${median(rounds)}, min ${Math.min(...rounds)}, max ${Math.max(...rounds)}`);
  console.log(`  end reasons: ${Object.entries(count(g.map((r) => `${r.winner}:${r.reason}`))).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  const stats = ['recruited', 'pikeman', 'archer', 'cavalier', 'spells', 'skills', 'combined', 'withdrawn', 'lost', 'killed', 'captures', 'respawns', 'supply_spent', 'blocked_draws', 'final_units', 'final_hp', 'final_territory', 'final_supply'];
  console.log(`  ${'per game (mean)'.padEnd(18)} ${'blue'.padStart(7)} ${'red'.padStart(7)}`);
  for (const s of stats) console.log(`  ${s.padEnd(18)} ${mean(g.map((r) => r[`blue_${s}`])).toFixed(2).padStart(7)} ${mean(g.map((r) => r[`red_${s}`])).toFixed(2).padStart(7)}`);
}

// Per-class outcomes from the game logs, if they were written.
const logs = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.jsonl')) : [];
if (logs.length) {
  const lost = {}, spells = {};
  for (const f of logs) {
    const res = fromJSONL(readFileSync(join(dir, f), 'utf8')).find((e) => e.t === 'result');
    if (!res) continue;
    for (const side of ['blue', 'red']) {
      for (const [k, v] of Object.entries(res.stats[side].lost)) lost[k] = (lost[k] || 0) + v;
      for (const [k, v] of Object.entries(res.stats[side].spells)) spells[k] = (spells[k] || 0) + v;
    }
  }
  console.log(`\n== From ${logs.length} game logs (both sides)`);
  console.log(`  deaths by class:  ${Object.entries(lost).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
  console.log(`  spells cast:      ${Object.entries(spells).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
}
