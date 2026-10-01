// Shard draw check: does the shard AI buy, apply and combine shards, and does it win? Usage: node tools/sim/shards.mjs [seeds=100]
// Plays each seed with both side assignments. See docs/SHARDS_SIM.md.
import { createMatch } from '../../src/match.js';
import { runCommander } from '../../src/ai/commander.js';
const N=+process.argv[2]||100;
function play(seed,bp,rp,swap){
  const log=[];const m=createMatch({seed,maxRounds:30,log:e=>log.push(e)});
  const bl=swap?['red',rp]:['blue',bp];
  const pol={blue:bp,red:rp};if(swap){pol.blue=rp;pol.red=bp;}pol.mineFaction=swap?'red':'blue';
  const drawn={blue:0,red:0};
  while(!m.over){for(const f of ['blue','red'])if(f!=='mineFaction')runCommander(m,f,pol[f].name,pol[f].params);m.resolveRound();}
  const acts={};let maxTier=0;
  for(const e of log){if(e.t==='action'&&e.ok&&/Shard/.test(e.action.type)&&e.action.faction===(pol.mineFaction)){acts[e.action.type]=(acts[e.action.type]||0)+1;}}
  const st=m.stats?m.stats():{};
  const w=m.winner??m.result?.winner??null;
  const tiers={};for(const f of ['blue','red']){for(const l of Object.values(m.sides[f].shards||{}))for(const s of l)maxTier=Math.max(maxTier,s.tier);for(const s of m.sides[f].shardDock)maxTier=Math.max(maxTier,s.tier);}
  return {w:m.winner,acts,maxTier,rounds:m.round,pol};
}
const H=(shards)=>({name:'heuristic',params:{shards}});
const G={name:'greedy',params:{}};
for(const [label,a,b] of [['shards-AI vs greedy',H(true),G],['no-shard-AI vs greedy',H(false),G],['shards-AI vs no-shard-AI',H(true),H(false)]]){
  let win=0,loss=0,draw=0,tot={},mt=0,rounds=0,n=0;
  for(let s=1;s<=N;s++)for(const swap of [false,true]){
    const r=play(s,a,b,swap);n++;rounds+=r.rounds;mt=Math.max(mt,r.maxTier);
    for(const k in r.acts)tot[k]=(tot[k]||0)+r.acts[k];
    const mine=swap?'red':'blue';
    if(!r.w||r.w==='draw')draw++;else if(r.w===mine)win++;else loss++;
  }
  const per={};for(const k in tot)per[k]=(tot[k]/n).toFixed(2);
  console.log(label,{games:n,win,loss,draw,avgRounds:(rounds/n).toFixed(1),maxTier:mt,perGame:per});
}
