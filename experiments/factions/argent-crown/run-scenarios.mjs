// Run the Argent Crown levels: every variant of every level for seeds 1..N (the seed drives every die and movement tie-break;
// the scenario is fixed), print one markdown table per level and write results.
//   node experiments/factions/argent-crown/run-scenarios.mjs [--level crown-1] [--seeds 400] [--replay 10]
//        [--out docs/experiments/results/factions/argent-crown]
// Blue win % has a Wilson 95% interval. "vs" names the row a variant is compared with (label prefix): the change in Blue win rate
// and whether it is significant at 95% (two-proportion z), so ablations read as "how much did removing X cost".
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LEVELS } from './scenarios.mjs';
import { playScenario, replayScenario } from './scenario.mjs';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const seeds = Number(opt('seeds', 400));
const replayN = Number(opt('replay', 0));
const which = opt('level', 'all');
const outDir = opt('out', null) && resolve(opt('out'));

const wilson = (k, n) => { const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - h), Math.min(1, c + h)]; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x) => `${Math.round(100 * x)}%`;
const f1 = (x) => x.toFixed(1);

function summarise(results) {
  const n = results.length;
  const rate = (w) => results.filter((r) => r.winner === w).length / n;
  const blue = rate('blue');
  return {
    n, blue, red: rate('red'), mutual: rate('mutual'), none: rate('none'), blueCI: wilson(Math.round(blue * n), n),
    rounds: mean(results.map((r) => r.rounds)),
    surv: { blue: mean(results.map((r) => r.survivors.blue)), red: mean(results.map((r) => r.survivors.red)) },
    hpLeft: { blue: mean(results.map((r) => r.hp.blue / r.startHp.blue)), red: mean(results.map((r) => r.hp.red / r.startHp.red)) },
    dealt: { blue: mean(results.map((r) => r.dealt.blue)), red: mean(results.map((r) => r.dealt.red)) },
    lost: mean(results.map((r) => r.lost.blue)), abilityUses: mean(results.map((r) => r.abilityUses)), planFails: mean(results.map((r) => r.planFails)),
  };
}
const delta = (s, ref) => {
  if (!ref || s === ref) return '—';
  const d = s.blue - ref.blue, se = Math.sqrt(s.blue * (1 - s.blue) / s.n + ref.blue * (1 - ref.blue) / ref.n);
  return `${d >= 0 ? '+' : ''}${Math.round(100 * d)}pp${Math.abs(d) > 1.96 * se ? '' : ' (ns)'}`;
};

const chosen = which === 'all' ? LEVELS : LEVELS.filter((l) => l.id === which);
if (!chosen.length) throw new Error(`unknown level ${which}`);
let replayFailures = 0, replayed = 0;
const report = [];
for (const level of chosen) {
  const rows = [];
  for (const variant of level.variants) {
    const results = [];
    for (let seed = 1; seed <= seeds; seed += 1) {
      const res = playScenario(variant.def, seed, { keepLog: seed <= replayN });
      if (seed <= replayN) {
        const check = replayScenario(res.log.entries);
        replayed += 1;
        if (!check.ok) { replayFailures += 1; console.error(`REPLAY MISMATCH ${level.id} "${variant.label}" seed ${seed}`, JSON.stringify(check.mismatches[0]).slice(0, 300)); }
      }
      delete res.log;
      results.push(res);
    }
    const s = summarise(results);
    const ref = variant.vs ? rows.find((x) => x.variant.label.startsWith(`${variant.vs} `))?.s : null;
    rows.push({ variant, s, delta: delta(s, ref) });
  }
  const lines = [`### ${level.title}`, '', `_${level.question}_`, '', level.setup, '',
    `${seeds} seeds per variant. Blue win % has a 95% interval; Δ is the change in Blue win rate against the row named by "vs" (ns = not significant at 95%).`, '',
    '| variant | vs | Blue win | Red win | mutual | none | rounds | survivors b / r | HP left b / r | Blue units lost | damage dealt b / r | ability uses | Δ Blue win |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const { variant, s, delta: d } of rows) {
    lines.push(`| ${variant.label} | ${variant.vs || ''} | ${pct(s.blue)} (${pct(s.blueCI[0])}-${pct(s.blueCI[1])}) | ${pct(s.red)} | ${pct(s.mutual)} | ${pct(s.none)} | ${f1(s.rounds)} | ${f1(s.surv.blue)} / ${f1(s.surv.red)} | ${pct(s.hpLeft.blue)} / ${pct(s.hpLeft.red)} | ${f1(s.lost)} | ${f1(s.dealt.blue)} / ${f1(s.dealt.red)} | ${f1(s.abilityUses)} | ${d} |`);
  }
  const fails = rows.filter((r) => r.s.planFails > 0);
  if (fails.length) lines.push('', `Failed plan steps (should be 0): ${fails.map((r) => `${r.variant.label.split(' ')[0]}=${f1(r.s.planFails)}`).join(', ')}`);
  lines.push('');
  report.push({ level: level.id, text: lines.join('\n'), data: rows.map((r) => ({ label: r.variant.label, vs: r.variant.vs || null, ...r.s })) });
  console.log(lines.join('\n'));
}
if (outDir) {
  mkdirSync(outDir, { recursive: true });
  for (const r of report) {
    writeFileSync(join(outDir, `${r.level}.md`), `${r.text}\n`);
    writeFileSync(join(outDir, `${r.level}.json`), JSON.stringify(r.data, null, 1));
  }
}
if (replayN) console.log(`\nReplayed ${replayed} scenario logs from their headers: ${replayFailures} mismatches`);
if (replayFailures) process.exit(1);
