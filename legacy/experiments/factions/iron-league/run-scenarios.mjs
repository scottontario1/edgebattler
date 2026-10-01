// Run the Iron League levels (scenarios.mjs), one markdown table per level.
//   node experiments/factions/iron-league/run-scenarios.mjs [--suite bridge|gap|ridge-pass|captain|all] [--seeds 400] [--replay 10]
//                                                           [--out docs/experiments/results/factions/iron-league] [--evidence dir]
// Every variant is played for seeds 1..N (the seed drives every die and movement tie-break; the scenario itself is fixed).
// --replay N rebuilds the first N seeds of every variant from their logs (scenario header + logged actions) and fails on any mismatch.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadMaps, playScenario, budget, replayScenario } from './scenario.mjs';
import { SUITES } from './scenarios.mjs';
import { wilson, mean, pct, f1 } from './common.mjs';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const seeds = Number(opt('seeds', 400));
const replayN = Number(opt('replay', 0));
const suiteArg = opt('suite', 'all');
const outDir = opt('out', null) && resolve(opt('out'));
const evidenceDir = opt('evidence', null) && resolve(opt('evidence'));

function summarise(results) {
  const n = results.length;
  const rate = (w) => results.filter((r) => r.winner === w).length / n;
  const blue = rate('blue');
  const decided = results.filter((r) => r.winner === 'blue' || r.winner === 'red' || r.winner === 'mutual');
  const uses = {};
  for (const r of results) for (const [k, v] of Object.entries(r.usedBy)) uses[k] = (uses[k] || 0) + v / n;
  return {
    n, blue, red: rate('red'), mutual: rate('mutual'), none: rate('none'), blueCI: wilson(Math.round(blue * n), n),
    rounds: mean(results.map((r) => r.rounds)), decidedRounds: mean(decided.map((r) => r.rounds)),
    surv: { blue: mean(results.map((r) => r.survivors.blue)), red: mean(results.map((r) => r.survivors.red)) },
    startN: results[0].startN,
    hpLeft: { blue: mean(results.map((r) => r.hp.blue / r.startHp.blue)), red: mean(results.map((r) => r.hp.red / r.startHp.red)) },
    dealt: { blue: mean(results.map((r) => r.dealt.blue)), red: mean(results.map((r) => r.dealt.red)) },
    objectDamage: mean(results.map((r) => r.objectDamage.red)),
    strikes: mean(results.map((r) => r.strikes)), moves: mean(results.map((r) => r.moves)), blocked: mean(results.map((r) => r.blockedHolds)),
    planFails: mean(results.map((r) => r.planFails)), abilityUses: mean(results.map((r) => r.abilityUses)), energy: mean(results.map((r) => r.energySpent)),
    barricades: mean(results.map((r) => r.barricadesRaised)), barricadesLost: mean(results.map((r) => r.barricadesDestroyed)), uses,
  };
}
const delta = (s, ref) => {
  if (!ref || s === ref) return '—';
  const d = s.blue - ref.blue, se = Math.sqrt(s.blue * (1 - s.blue) / s.n + ref.blue * (1 - ref.blue) / ref.n);
  return `${d >= 0 ? '+' : ''}${Math.round(100 * d)}pp${Math.abs(d) > 1.96 * se ? '' : ' (ns)'}`;
};

const shortName = (label) => (label.includes(' skilled without ') ? label.split(' skilled without ')[0] : label.split(' ')[0]);
const chosen = suiteArg === 'all' ? SUITES : SUITES.filter((s) => s.id === suiteArg);
if (!chosen.length) throw new Error(`unknown suite ${suiteArg}`);
await loadMaps(new Set(SUITES.flatMap((s) => s.variants.map((v) => v.def.map))));

let replayFailures = 0, replayed = 0;
const report = [];
for (const suite of chosen) {
  const rows = [];
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
        writeFileSync(join(evidenceDir, suite.id, `${shortName(variant.label).replace(/[^A-Za-z0-9-]+/g, '_')}-seed1.jsonl`), res.log.text());
      }
      delete res.log;
      results.push(res);
    }
    const s = summarise(results);
    const ref = variant.vs ? rows.find((x) => x.variant.label.startsWith(variant.vs + ' '))?.s : null;
    rows.push({ variant, s, blueBudget: budget(variant.def, 'blue'), redBudget: budget(variant.def, 'red'), delta: delta(s, ref) });
  }
  const lines = [];
  lines.push(`### ${suite.title}`, '', `_${suite.question}_`, '',
    `${seeds} seeds per variant. Blue (the League player) wins by destroying the Red army or taking its keep; "none" = neither by the round limit. Blue win % has a 95% Wilson interval; Δ is the change in Blue win rate from the variant a row names with vs (N naive or S skilled; ns = not significant at 95%).`, '');
  lines.push('| variant | Supply b / r | units b / r | Blue win | Red win | none | rounds | survivors b / r | HP left b / r | Δ Blue win |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const { variant, s, blueBudget: bb, redBudget: rb, delta: d } of rows) {
    lines.push(`| ${variant.label} | ${bb.supply} / ${rb.supply} | ${s.startN.blue} / ${s.startN.red} | ${pct(s.blue)} (${pct(s.blueCI[0])}–${pct(s.blueCI[1])}) | ${pct(s.red)} | ${pct(s.none)} | ${f1(s.rounds)} | ${f1(s.surv.blue)} / ${f1(s.surv.red)} | ${pct(s.hpLeft.blue)} / ${pct(s.hpLeft.red)} | ${d} |`);
  }
  lines.push('', '| variant | damage dealt b / r | damage to barricades by Red | moves / game | ability uses | energy spent | barricades raised / destroyed | failed plan steps |', '|---|---|---|---|---|---|---|---|');
  for (const { variant, s } of rows) lines.push(`| ${shortName(variant.label)} | ${f1(s.dealt.blue)} / ${f1(s.dealt.red)} | ${f1(s.objectDamage)} | ${f1(s.moves)} | ${f1(s.abilityUses)} | ${f1(s.energy)} | ${f1(s.barricades)} / ${f1(s.barricadesLost)} | ${f1(s.planFails)} |`);
  lines.push('');
  report.push({ suite: suite.id, text: lines.join('\n'), data: rows.map((r) => ({ label: r.variant.label, budget: { blue: r.blueBudget, red: r.redBudget }, ...r.s })) });
  console.log(lines.join('\n'));
}

if (outDir) {
  mkdirSync(outDir, { recursive: true });
  for (const r of report) {
    writeFileSync(join(outDir, `scenario-${r.suite}.md`), `${r.text}\n`);
    writeFileSync(join(outDir, `scenario-${r.suite}.json`), JSON.stringify(r.data, null, 1));
  }
}
if (replayN) console.log(`\nReplayed ${replayed} scenario logs from their headers: ${replayFailures} mismatches`);
if (replayFailures) process.exit(1);
