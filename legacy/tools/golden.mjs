// Records "golden" game logs from the legacy engine for the Phaser port's parity tests.
// Each file is the legacy JSON Lines log (header, action, round, summary, result) of one seeded game
// as it is normally played: continuous 18 s combat, skills and spells archived (off).
// Files are gzipped JSON Lines; index.json lists every game. Run from the repository root: node legacy/tools/golden.mjs [outDir]
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { CAMPAIGN_LEVELS, createCampaignMatch } from '../src/campaign.js';
import { createSkirmish } from '../src/setup.js';
import { memoryLog, replay } from '../src/log.js';
import { runCommander } from '../src/ai/commander.js';
import { setMap } from '../src/board.js';

const out = resolve(process.argv[2] || 'tests/fixtures/golden');
mkdirSync(out, { recursive: true });
const COMBAT = { duration: 18 };
const OFF = { abilities: false, spells: false };
const index = [];

function save(name, log, m, extra, create) {
  const check = replay(log.entries, { create });
  if (!check.ok) throw new Error(`${name}: legacy replay mismatch ${JSON.stringify(check.mismatches[0]).slice(0, 400)}`);
  writeFileSync(resolve(out, `${name}.jsonl.gz`), gzipSync(log.text(), { level: 9 }));
  index.push({ name, rounds: m.round, winner: m.winner, reason: m.reason, ...extra });
}

// Campaign: the player's army is driven by the heuristic commander (shop, shards, deploy) plus the
// whole-army checkpoint orders a player gives (march, rally, continue).
for (const level of CAMPAIGN_LEVELS) for (const faction of ['classic', 'crown', 'fang', 'league', 'court']) for (const seed of [7, 19]) {
  const log = memoryLog();
  const m = createCampaignMatch(level, { faction, seed, log: log.push, combat: COMBAT, ...OFF });
  while (!m.over) {
    runCommander(m, 'blue', 'heuristic');
    m.apply({ type: 'campaignOrder', faction: 'blue' });
    if (m.campaign.phase === 'regroup') {
      m.apply({ type: 'campaignRally', faction: 'blue' });
      m.apply({ type: 'campaignContinue', faction: 'blue' });
      m.apply({ type: 'campaignOrder', faction: 'blue' });
    }
    m.resolveRound();
  }
  save(`campaign-${level.id}-${faction}-${seed}`, log, m, { kind: 'campaign', level: level.id, faction, seed });
}

// Skirmish: AI against AI on River Ford.
const PAIRS = [['classic', 'classic'], ['crown', 'fang'], ['league', 'court'], ['fang', 'league'], ['court', 'crown']];
for (const [blue, red] of PAIRS) for (const seed of [3, 11]) for (const [bp, rp] of [['heuristic', 'greedy'], ['heuristic', 'heuristic']]) {
  setMap(); // River Ford: the active map is process-global in the legacy engine
  const log = memoryLog();
  const make = (push) => createSkirmish({ blue, red, seed, maxRounds: 30, log: push, combat: COMBAT, abilities: false });
  const m = make(log.push);
  while (!m.over) { runCommander(m, 'blue', bp); runCommander(m, 'red', rp); m.resolveRound(); }
  setMap();
  save(`skirmish-${blue}-${red}-${seed}-${bp}-${rp}`, log, m, { kind: 'skirmish', blue, red, seed, policies: [bp, rp] }, (h, push) => make(push));
}
writeFileSync(resolve(out, 'index.json'), JSON.stringify(index, null, 1) + '\n');
console.log(`${index.length} golden games written to ${out}`);
for (const g of index) console.log(g.name, g.rounds, g.winner, g.reason);
