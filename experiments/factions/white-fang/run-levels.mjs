// Run the White Fang levels (experiments/factions/white-fang/levels.mjs) on the shared engine.
//   node experiments/factions/white-fang/run-levels.mjs [--suite level-1|...|all] [--seeds 400] [--replay 10] [--out dir]
// Each variant is played for seeds 1..N (the seed drives every die and movement tie-break; the scenario itself is fixed). Prints one
// markdown table per level: outcome with 95% Wilson intervals, survivors, HP left, the change from the baseline variant (or the variant a
// row names with `vs`), then what the Blue strikes were (share made after moving, damage per landed hit) and, for tracked levels, what
// Dreg hit. --replay N rebuilds the first N seeds of every variant from their logs (scenario header + actions) and fails on a mismatch.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { registerCulture } from '../../../src/cultures.js';
import whiteFang from '../../../src/factions/white-fang.js';
import { loadMaps, playScenario, budget, replayScenario } from './scenario.mjs';
import { SUITES } from './levels.mjs';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const seeds = Number(opt('seeds', 400));
const replayN = Number(opt('replay', 0));
const suiteArg = opt('suite', 'all');
const outDir = opt('out', null) && resolve(opt('out'));
registerCulture(whiteFang);

const wilson = (k, n) => { const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - h), Math.min(1, c + h)]; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x) => `${Math.round(100 * x)}%`;
const f1 = (x) => x.toFixed(1);
const f2 = (x) => (x == null ? '-' : x.toFixed(2));

// Mean and 95% half-width of a sample.
const ci = (xs) => { const m = mean(xs), sd = Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); return { mean: m, half: 1.96 * sd / Math.sqrt(xs.length) }; };
const pm = (c) => `${c.mean.toFixed(1)} +/- ${c.half.toFixed(1)}`;

function summarise(results, trackIds) {
  const n = results.length;
  const rate = (w) => results.filter((r) => r.winner === w).length / n;
  const blue = rate('blue');
  const has = (key) => results.map((r) => r[key]).filter((x) => x != null);
  const tracked = {};
  for (const id of trackIds) {
    const hits = results.map((r) => r.tracked?.hits[id] || 0), dmg = results.map((r) => r.tracked?.damage[id] || 0);
    tracked[id] = { hits: mean(hits), dmg: mean(dmg), perHit: hits.reduce((a, b) => a + b, 0) ? dmg.reduce((a, b) => a + b, 0) / hits.reduce((a, b) => a + b, 0) : null };
  }
  const diedBy = {};
  for (const r of results) for (const [id, round] of Object.entries(r.died)) (diedBy[id] ||= []).push(round);
  const abilityById = {};
  for (const r of results) for (const [k, v] of Object.entries(r.abilityById)) abilityById[k] = (abilityById[k] || 0) + v / n;
  return {
    n, blue, red: rate('red'), mutual: rate('mutual'), none: rate('none'), blueCI: wilson(Math.round(blue * n), n),
    rounds: mean(results.map((r) => r.rounds)),
    surv: { blue: mean(results.map((r) => r.survivors.blue)), red: mean(results.map((r) => r.survivors.red)) },
    hpLeft: { blue: mean(results.map((r) => r.hp.blue / r.startHp.blue)), red: mean(results.map((r) => r.hp.red / r.startHp.red)) },
    margin: ci(results.map((r) => r.blueDamage - r.redDamage)),
    first: { blue: mean(results.map((r) => r.first.blue)), red: mean(results.map((r) => r.first.red)), round: mean(results.filter((r) => r.first.round).map((r) => r.first.round)) },
    strikes: mean(results.map((r) => r.blueStrikes)), landed: mean(results.map((r) => r.blueLanded)), dmgBlue: mean(results.map((r) => r.blueDamage)), dmgRed: mean(results.map((r) => r.redDamage)),
    movedShare: mean(results.map((r) => (r.blueStrikes ? r.movedStrikes / r.blueStrikes : 0))),
    dmgPerHit: mean(has('dmgPerHit')), dmgPerHitMoved: has('dmgPerHitMoved').length ? mean(has('dmgPerHitMoved')) : null, dmgPerHitHeld: has('dmgPerHitHeld').length ? mean(has('dmgPerHitHeld')) : null,
    abilityUses: mean(results.map((r) => r.abilityUses)), energy: mean(results.map((r) => r.energySpent)), abilityById,
    planFails: mean(results.map((r) => r.planFails)), tracked,
    diedShare: Object.fromEntries(Object.entries(diedBy).map(([id, rs]) => [id, { share: rs.length / n, round: mean(rs) }])),
  };
}

const delta = (s, base) => {
  if (s === base) return '-';
  const d = s.blue - base.blue, se = Math.sqrt(s.blue * (1 - s.blue) / s.n + base.blue * (1 - base.blue) / base.n);
  return `${d >= 0 ? '+' : ''}${Math.round(100 * d)}pp${Math.abs(d) > 1.96 * se ? '' : ' (ns)'}`;
};

const chosen = suiteArg === 'all' ? SUITES : SUITES.filter((s) => s.id === suiteArg);
if (!chosen.length) throw new Error(`unknown suite ${suiteArg}`);
await loadMaps(new Set(SUITES.flatMap((s) => s.variants.map((v) => v.def.map))));

let replayFailures = 0, replayed = 0;
const report = [];
for (const suite of chosen) {
  const rows = [];
  let base = null;
  const trackId = suite.variants[0].def.track;
  const enemyIds = trackId ? [...new Set(suite.variants.flatMap((v) => v.def.units.filter((x) => x.faction === 'red').map((x) => x.id)))] : [];
  for (const variant of suite.variants) {
    const results = [];
    for (let seed = 1; seed <= seeds; seed += 1) {
      const res = playScenario(variant.def, seed, { keepLog: seed <= replayN });
      if (seed <= replayN) {
        const check = replayScenario(res.log.entries);
        replayed += 1;
        if (!check.ok) { replayFailures += 1; console.error(`REPLAY MISMATCH ${suite.id} "${variant.label}" seed ${seed}`, JSON.stringify(check.mismatches[0]).slice(0, 300)); }
      }
      delete res.log;
      results.push(res);
    }
    const s = summarise(results, enemyIds);
    if (!base) base = s;
    const ref = variant.vs ? rows.find((x) => x.variant.label.startsWith(`${variant.vs} `))?.s : base;
    rows.push({ variant, s, blueBudget: budget(variant.def, 'blue'), redBudget: budget(variant.def, 'red'), delta: delta(s, ref || base) });
  }
  const L = [`### ${suite.title}`, '', `_${suite.question}_`, '',
    `${seeds} seeds per variant. Blue win % has a 95% Wilson interval; the change is the Blue win-rate difference from the first variant, or from the variant a row names with vs (ns = not significant at 95%). none = round limit.`, '',
    '| variant | Supply b / r | Blue win | Red win | mutual | none | rounds | survivors b / r | HP left b / r | change in Blue win |', '|---|---|---|---|---|---|---|---|---|---|'];
  for (const { variant, s, blueBudget: bb, redBudget: rb, delta: d } of rows) L.push(`| ${variant.label} | ${bb.supply} / ${rb.supply} | ${pct(s.blue)} (${pct(s.blueCI[0])}-${pct(s.blueCI[1])}) | ${pct(s.red)} | ${pct(s.mutual)} | ${pct(s.none)} | ${f1(s.rounds)} | ${f1(s.surv.blue)} / ${f1(s.surv.red)} | ${pct(s.hpLeft.blue)} / ${pct(s.hpLeft.red)} | ${d} |`);
  L.push('', '| variant | Blue strikes | landed hits | share of strikes made after moving | damage / landed hit (all / after moving / held) | damage dealt b / r | net damage b - r (95%) | contact round: mean round, damage b / r | ability uses | energy spent |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const { variant, s } of rows) L.push(`| ${variant.label.split(' ')[0]} | ${f1(s.strikes)} | ${f1(s.landed)} | ${pct(s.movedShare)} | ${f2(s.dmgPerHit)} / ${f2(s.dmgPerHitMoved)} / ${f2(s.dmgPerHitHeld)} | ${f1(s.dmgBlue)} / ${f1(s.dmgRed)} | ${pm(s.margin)} | r${f1(s.first.round)}: ${f1(s.first.blue)} / ${f1(s.first.red)} | ${f1(s.abilityUses)} | ${f1(s.energy)} |`);
  if (trackId) {
    L.push('', `Landed hits by \`${trackId}\` per game (mean), by target, and damage per landed hit on that target:`, '', `| variant | ${enemyIds.map((id) => `${id} hits (dmg/hit)`).join(' | ')} | all (dmg/hit) |`, `|---|${enemyIds.map(() => '---').join('|')}|---|`);
    for (const { variant, s } of rows) {
      const all = s.tracked[enemyIds[0]] && enemyIds.reduce((a, id) => ({ hits: a.hits + s.tracked[id].hits, dmg: a.dmg + s.tracked[id].dmg }), { hits: 0, dmg: 0 });
      L.push(`| ${variant.label.split(' ')[0]} | ${enemyIds.map((id) => `${f2(s.tracked[id].hits)} (${f1(s.tracked[id].perHit ?? 0)})`).join(' | ')} | ${f2(all.hits)} (${all.hits ? f1(all.dmg / all.hits) : '-'}) |`);
    }
    const deaths = enemyIds.filter((id) => rows.some((r) => r.s.diedShare[id]));
    if (deaths.length) {
      L.push('', 'Share of games in which each enemy died, and the mean round it died in:', '', `| variant | ${deaths.join(' | ')} |`, `|---|${deaths.map(() => '---').join('|')}|`);
      for (const { variant, s } of rows) L.push(`| ${variant.label.split(' ')[0]} | ${deaths.map((id) => (s.diedShare[id] ? `${pct(s.diedShare[id].share)} (r${f1(s.diedShare[id].round)})` : '0%')).join(' | ')} |`);
    }
  }
  L.push('', 'Ability uses per game (Blue):', '', '| variant | uses by ability |', '|---|---|');
  for (const { variant, s } of rows) L.push(`| ${variant.label.split(' ')[0]} | ${Object.entries(s.abilityById).map(([k, v]) => `${k} ${f2(v)}`).join(', ') || 'none'} |`);
  L.push('');
  report.push({ suite: suite.id, text: L.join('\n'), data: rows.map((r) => ({ label: r.variant.label, budget: { blue: r.blueBudget, red: r.redBudget }, ...r.s })) });
  console.log(L.join('\n'));
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
