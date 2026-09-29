import { createMatch } from './src/match.js';
import { runCommander } from './src/ai/commander.js';
const log=[];
const m = createMatch({ seed: 3, maxRounds: 30, log: e=>log.push(e) });
while (!m.over) { runCommander(m, 'blue', 'heuristic'); runCommander(m, 'red', 'heuristic'); m.resolveRound(); }
for (const e of log.filter(e=>e.t==='summary')) console.log(e.round, 'B', e.blue.units, e.blue.hp, JSON.stringify(e.blue.field), '| R', e.red.units, e.red.hp, JSON.stringify(e.red.field), e.red.supply, e.red.population);
const rnd = log.filter(e=>e.t==='round');
for (const e of rnd.slice(0,6)) { const mv=e.batches.find(b=>b.type==='movement').events; const cb=e.batches.find(b=>b.type==='combat').events; console.log('r',e.round,'moves',mv.filter(x=>x.type==='move').length,'holds',mv.filter(x=>x.type==='hold').map(x=>x.unitId+':'+x.reason).slice(0,6).join('; '),'strikes',cb.filter(x=>x.type==='strike').length); }
console.log(m.alive().map(u=>u.id+'@'+u.c+','+u.r+' '+u.stance+(u.objective?JSON.stringify(u.objective):'')).join('\n'));
