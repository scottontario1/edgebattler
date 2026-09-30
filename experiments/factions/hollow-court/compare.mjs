// Do the death mechanics change the draw rate (CORE-02)? Reads the sim.mjs JSON files and prints, for each regime and driver, the draw
// rate of the Court WITH its death mechanics, the same Court WITHOUT them, and the difference (with - without) with a 95% interval
// (normal approximation for the difference of two independent proportions; the games are not paired across armies because the two
// armies play different games, so this is the conservative reading).
//   node experiments/factions/hollow-court/compare.mjs [dir]   (default docs/experiments/results/factions/hollow-court)
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dir = resolve(process.argv[2] || 'docs/experiments/results/factions/hollow-court');
const load = (name) => (existsSync(join(dir, name)) ? JSON.parse(readFileSync(join(dir, name), 'utf8')) : null);
const sets = [
  { regime: 'River Ford, shipped rules', main: 'sim-river_ford.json', plain: 'plain-river_ford.json' },
  { regime: 'village_chain, village deployment radius 5', main: 'sim-village_chain-dvil5.json', plain: 'plain-village_chain-dvil5.json' },
];
const pairs = [
  { file: 'main', label: 'Court commander v baseline', with: 'court:base', without: 'courtOff:base' },
  { file: 'main', label: 'Court commander mirror', with: 'court:court', without: 'courtOff:courtOff' },
  { file: 'plain', label: 'shipped heuristic v baseline', with: 'courtPlain:base', without: 'courtOffPlain:base' },
  { file: 'plain', label: 'shipped heuristic mirror', with: 'courtPlain:courtPlain', without: 'courtOffPlain:courtOffPlain' },
];
const pct = (x) => `${(100 * x).toFixed(1)}%`;
const pp = (x) => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(1)}`;
const rows = [];
for (const set of sets) {
  const data = { main: load(set.main), plain: load(set.plain) };
  const ref = data.main?.summaries.find((s) => s.matchup === 'base:base');
  for (const p of pairs) {
    const d = data[p.file];
    const a = d?.summaries.find((s) => s.matchup === p.with), b = d?.summaries.find((s) => s.matchup === p.without);
    if (!a || !b) continue;
    const pa = a.draws / a.n, pb = b.draws / b.n, se = Math.sqrt(pa * (1 - pa) / a.n + pb * (1 - pb) / b.n);
    const ka = a.keep / a.n, kb = b.keep / b.n;
    rows.push(`| ${set.regime} | ${p.label} | ${pct(pa)} (${a.draws}/${a.n}) | ${pct(pb)} (${b.draws}/${b.n}) | ${pp(pa - pb)} pp +-${(196 * se).toFixed(1)} | ${pct(ka)} / ${pct(kb)} | ${a.rounds.toFixed(1)} / ${b.rounds.toFixed(1)} |${ref ? ` ${pct(ref.draws / ref.n)} |` : ' |'}`);
  }
}
const out = ['| regime | driver / matchup | draws WITH death mechanics | draws WITHOUT | difference (95%) | keep-captured with / without | mean rounds with / without | baseline mirror draws |', '|---|---|---|---|---|---|---|---|', ...rows].join('\n');
// Which mechanic? Mirror under the shipped heuristic, decisive regime, larger sample; each row removes one mechanic from the full Court.
const mech = load('mirror1000-village_chain-dvil5.json');
let out2 = '';
if (mech) {
  const get = (m) => mech.summaries.find((x) => x.matchup === m);
  const off = get('courtOffPlain:courtOffPlain');
  const line = (label, m) => {
    const a = get(m);
    if (!a || !off) return null;
    const pa = a.draws / a.n, pb = off.draws / off.n, se = Math.sqrt(pa * (1 - pa) / a.n + pb * (1 - pb) / off.n);
    return `| ${label} | ${pct(pa)} (${a.draws}/${a.n}) | ${pp(pa - pb)} pp +-${(196 * se).toFixed(1)} | ${a.keep} | ${a.wipe} | ${a.rounds.toFixed(1)} |`;
  };
  out2 = ['| Court build (shipped heuristic, village_chain radius 5, mirror, ' + off.n + ' games each) | draws | difference from "no death mechanics" (95%) | keep-captured | army-destroyed | mean rounds |', '|---|---|---|---|---|---|',
    line('no death mechanics (control)', 'courtOffPlain:courtOffPlain'), line('all death mechanics', 'courtPlain:courtPlain'), line('without Revenant (corpses and passives on)', 'courtNoRevPlain:courtNoRevPlain'),
    line('without corpse-reading passives (Revenant and corpses on)', 'courtNoPassPlain:courtNoPassPlain'), line('without corpses (Revenant on; passives inert)', 'courtNoCorpsePlain:courtNoCorpsePlain')].filter(Boolean).join('\n');
}
console.log(out);
console.log(`\n${out2}`);
writeFileSync(join(dir, 'draw-rate-comparison.md'), `# Do the death mechanics change the draw rate?\n\n${out}\n\n## Which mechanic?\n\n${out2}\n`);
