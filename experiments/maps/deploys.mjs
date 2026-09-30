import { readFileSync, readdirSync } from 'node:fs';
import { fromJSONL } from '../../src/log.js';
const dir = process.argv[2];
const keeps = { blue: [2, 10], red: [12, 1] };
let total = 0, forward = 0, byFaction = { blue: [0, 0], red: [0, 0] };
for (const f of readdirSync(dir).filter((x) => x.endsWith('.jsonl'))) {
  for (const e of fromJSONL(readFileSync(`${dir}/${f}`, 'utf8'))) {
    if (e.t !== 'action' || e.action.type !== 'deploy' || !e.ok) continue;
    const fac = e.action.faction, [kc, kr] = keeps[fac];
    const near = Math.abs(e.action.c - kc) + Math.abs(e.action.r - kr) <= 1;
    total += 1; byFaction[fac][near ? 0 : 1] += 1; if (!near) forward += 1;
  }
}
console.log(`${dir}: ${total} deployments, ${forward} (${(100 * forward / total).toFixed(0)}%) away from own keep; blue keep/forward ${byFaction.blue}, red ${byFaction.red}`);
