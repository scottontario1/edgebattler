import { createMatch } from './src/match.js';
import { runCommander } from './src/ai/commander.js';
const pairs = [['heuristic','greedy'],['greedy','heuristic'],['passive','greedy'],['heuristic','heuristic']];
for (const [b, r] of pairs) {
  const res = {blue:0, red:0, draw:0}; let rounds = 0; const reasons = {};
  const t0 = Date.now();
  for (let seed = 1; seed <= 20; seed++) {
    const m = createMatch({ seed, maxRounds: 30 });
    while (!m.over) { runCommander(m, 'blue', b); runCommander(m, 'red', r); m.resolveRound(); }
    res[m.winner || 'draw']++; rounds += m.round; reasons[m.reason] = (reasons[m.reason]||0)+1;
  }
  console.log(b, 'vs', r, res, 'avg rounds', rounds/20, reasons, (Date.now()-t0)+'ms');
}
