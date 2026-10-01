// Golden parity probe: replays every legacy golden log through the ported core and prints the
// first difference per game. Usage: node tools/parity-probe.mjs [name-filter]
import { goldenIndex, loadGolden, replayGolden } from '../tests/parity/golden.mjs';
import { createFromSchema4Header } from '../src/core/log/adapter.js';
let ok=0;
for (const g of goldenIndex().filter((x) => x.name.includes(process.argv[2] ?? ''))) {
  try {
    const r = replayGolden(loadGolden(g.name), (h, push) => createFromSchema4Header(h, push));
    if (r.ok) ok++;
    console.log(g.name, r.ok ? 'OK' : JSON.stringify(r.mismatch).slice(0, 260));
  } catch (e) { console.log(g.name, 'THROW', String(e.message).slice(0, 200)); }
}
console.log('ok', ok);
