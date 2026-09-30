// Run the combat case-study suites on the shared engine.
//   node experiments/combat/run.mjs [--suite pikes-v-cav|pike-archer-v-cav|three-v-2star|keep-assault|all]
//                                   [--seeds 200] [--replay 20] [--out docs/experiments/results] [--evidence docs/experiments/evidence]
// Each variant is played for seeds 1..N (the seed drives every die and every movement tie-break; the
// scenario itself is fixed). Prints one markdown table per suite with the outcome, survivors, duration, the
// Supply/population each side paid, and the change from the baseline variant. --replay N rebuilds the first N
// seeds of every variant from their logs (scenario header + logged actions) and fails on any mismatch.
// --evidence writes the seed-1 log of each suite's baseline and any variant flagged `evidence`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadMaps, playScenario, budget, replayScenario } from './scenario.mjs';
import { SUITES } from './suites.mjs';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const seeds = Number(opt('seeds', 200));
const replayN = Number(opt('replay', 0));
const suiteArg = opt('suite', 'all');
const outDir = opt('out', null) && resolve(opt('out'));
const evidenceDir = opt('evidence', null) && resolve(opt('evidence'));

const wilson = (k, n) => { const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - h), Math.min(1, c + h)]; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x) => `${Math.round(100 * x)}%`;
const f1 = (x) => x.toFixed(1);

function summarise(results) {
  const n = results.length;
  const rate = (w) => results.filter((r) => r.winner === w).length / n;
  const blue = rate('blue'), red = rate('red'), mutual = rate('mutual'), none = rate('none');
  const [lo, hi] = wilson(Math.round(blue * n), n);
  const decided = results.filter((r) => r.winner === 'blue' || r.winner === 'red' || r.winner === 'mutual');
  return {
    n, blue, red, mutual, none, blueCI: [lo, hi],
    rounds: mean(results.map((r) => r.rounds)),
    surv: { blue: mean(results.map((r) => r.survivors.blue)), red: mean(results.map((r) => r.survivors.red)) },
    hpLeft: { blue: mean(results.map((r) => r.hp.blue / r.startHp.blue)), red: mean(results.map((r) => r.hp.red / r.startHp.red)) },
    dealt: { blue: mean(results.map((r) => r.dealt.blue)), red: mean(results.map((r) => r.dealt.red)) },
    firstStrike: mean(results.filter((r) => r.firstStrike).map((r) => r.firstStrike)),
    flank: mean(results.map((r) => r.flankStrikes)), strikes: mean(results.map((r) => r.strikes)),
    spear: mean(results.map((r) => r.spearBonus)), guarded: mean(results.map((r) => r.guarded)),
    abilityUses: mean(results.map((r) => r.abilityUses)), energy: mean(results.map((r) => r.energySpent)),
    decidedRounds: mean(decided.map((r) => r.rounds)),
  };
}

const delta = (s, base) => {
  const d = s.blue - base.blue;
  const se = Math.sqrt(s.blue * (1 - s.blue) / s.n + base.blue * (1 - base.blue) / base.n);
  if (s === base) return '—';
  const sig = Math.abs(d) > 1.96 * se;
  return `${d >= 0 ? '+' : ''}${Math.round(100 * d)}pp${sig ? '' : ' (ns)'}`;
};

const chosen = suiteArg === 'all' ? SUITES : SUITES.filter((s) => s.id === suiteArg);
if (!chosen.length) throw new Error(`unknown suite ${suiteArg}`);
await loadMaps(new Set(SUITES.flatMap((s) => s.variants.map((v) => v.def.map))));

let replayFailures = 0, replayed = 0;
const report = [];
for (const suite of chosen) {
  const rows = [];
  let base = null;
  for (const [i, variant] of suite.variants.entries()) {
    const results = [];
    for (let seed = 1; seed <= seeds; seed += 1) {
      const keep = seed <= replayN || (seed === 1 && evidenceDir && (i === 0 || variant.evidence));
      const res = playScenario(variant.def, seed, { keepLog: keep });
      if (seed <= replayN) {
        const check = replayScenario(res.log.entries);
        replayed += 1;
        if (!check.ok) { replayFailures += 1; console.error(`REPLAY MISMATCH ${suite.id} "${variant.label}" seed ${seed}`, JSON.stringify(check.mismatches[0]).slice(0, 300)); }
      }
      if (seed === 1 && evidenceDir && (i === 0 || variant.evidence)) {
        mkdirSync(join(evidenceDir, suite.id), { recursive: true });
        writeFileSync(join(evidenceDir, suite.id, `${variant.label.split(' ')[0]}-seed1.jsonl`), res.log.text());
      }
      delete res.log;
      results.push(res);
    }
    const s = summarise(results);
    if (!base) base = s;
    rows.push({ variant, s, blueBudget: budget(variant.def, 'blue'), redBudget: budget(variant.def, 'red'), delta: delta(s, base) });
  }
  const lines = [];
  lines.push(`### ${suite.title}`, '', `_${suite.question}_`, '', `${seeds} seeds per variant. Blue win % has a 95% interval; Δ is the change in Blue win rate from A0 (ns = not significant at 95%).`, '');
  lines.push('| variant | Supply b / r | pop b / r | Blue win | Red win | mutual | none | rounds | survivors b / r | HP left b / r | Δ Blue win |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const { variant, s, blueBudget: bb, redBudget: rb, delta: d } of rows) {
    const sup = (x) => (x.equipment ? `${x.supply}+${x.equipment}` : `${x.supply}`);
    lines.push(`| ${variant.label} | ${sup(bb)} / ${sup(rb)} | ${bb.pop} / ${rb.pop} | ${pct(s.blue)} (${pct(s.blueCI[0])}–${pct(s.blueCI[1])}) | ${pct(s.red)} | ${pct(s.mutual)} | ${pct(s.none)} | ${f1(s.rounds)} | ${f1(s.surv.blue)} / ${f1(s.surv.red)} | ${pct(s.hpLeft.blue)} / ${pct(s.hpLeft.red)} | ${d} |`);
  }
  lines.push('', '| variant | first strike (round) | strikes / game | flank strikes | ability uses | energy spent | Set Spears bonus hits | bonuses ignored by Set Spears |', '|---|---|---|---|---|---|---|---|');
  for (const { variant, s } of rows) lines.push(`| ${variant.label.split(' ')[0]} | ${f1(s.firstStrike)} | ${f1(s.strikes)} | ${f1(s.flank)} | ${f1(s.abilityUses)} | ${f1(s.energy)} | ${f1(s.spear)} | ${f1(s.guarded)} |`);
  lines.push('');
  report.push({ suite: suite.id, text: lines.join('\n'), data: rows.map((r) => ({ label: r.variant.label, budget: { blue: r.blueBudget, red: r.redBudget }, ...r.s })) });
  console.log(lines.join('\n'));
}

if (outDir) {
  mkdirSync(outDir, { recursive: true });
  for (const r of report) {
    writeFileSync(join(outDir, `${r.suite}.md`), `${r.text}\n`);
    writeFileSync(join(outDir, `${r.suite}.json`), JSON.stringify(r.data, null, 1));
  }
}
if (replayN) console.log(`\nReplayed ${replayed} scenario logs from their headers: ${replayFailures} mismatches`);
if (replayFailures) process.exit(1);
