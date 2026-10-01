// Uses the real campaign match/ability/passive pipeline, not the cadence-only fixture.
// Usage: node tools/experiment-skill-timelines.mjs [seed-count] [output.json]
import {writeFileSync} from 'node:fs';
import {createCampaignMatch,CAMPAIGN_LEVELS} from '../src/campaign.js';
import {FACTIONS} from '../src/setup.js';
import {memoryLog,replay} from '../src/log.js';
const seeds=Math.max(1,Number(process.argv[2])||10),runs=[];
const type=u=>u.variantId||u.unitId||u.cls;
const profiles=[{name:'steady',acceleration:0,damageScale:0.35},{name:'accelerating',acceleration:0.3,damageScale:0.30}];
for(const profile of profiles)for(const policy of ['default','reversed','empty'])for(const level of CAMPAIGN_LEVELS)for(const faction of FACTIONS)for(let seed=1;seed<=seeds;seed++){
 const log=memoryLog(),m=createCampaignMatch(level,{faction:faction.id,seed,abilities:true,spells:true,combat:{duration:18,acceleration:profile.acceleration,damageScale:profile.damageScale},log:log.push});
 const initialTypes=new Set();
 for(const u of m.alive('blue'))if(!initialTypes.has(type(u))){initialTypes.add(type(u));const slots=policy==='empty'?[null,null,null]:policy==='reversed'?[...u.skillSlots].reverse():[...u.skillSlots];const edit=m.apply({type:'abilities',faction:'blue',unitId:u.id,skillSlots:slots});if(!edit.ok)throw Error(edit.reason);}
 const row={profile:profile.name,policy,level:level.id,faction:faction.id,seed,rounds:0,combatSeconds:0,attacks:0,damage:0,activations:0,skips:0,skipReasons:{},slots:{3:{used:0,skipped:0},9:{used:0,skipped:0},15:{used:0,skipped:0}},firstHitSeconds:null,firstDeathSeconds:null,zeroStrikeContestedPhases:0};
 while(!m.over&&row.rounds<40){
  m.apply({type:'campaignOrder',faction:'blue'});
  if(m.campaign.phase==='regroup'){m.apply({type:'campaignRally',faction:'blue'});m.apply({type:'campaignContinue',faction:'blue'});m.apply({type:'campaignOrder',faction:'blue'});}
  const contested=m.alive('blue').length>0&&m.alive('red').length>0,result=m.resolveRound();row.rounds++;
  let strikes=0;
  for(const b of result.batches)for(const e of b.events){
   if(e.type==='combatEnd')row.combatSeconds+=e.duration;
   if(e.type==='strike'){row.attacks++;strikes++;row.damage+=e.damage||0;if(e.damage>0&&row.firstHitSeconds===null)row.firstHitSeconds=b.time??0;}
   if(e.type==='death'&&row.firstDeathSeconds===null)row.firstDeathSeconds=b.time??0;
   if(b.type==='abilities'&&e.abilityId){if(e.applied){row.activations++;if(row.slots[b.time])row.slots[b.time].used++;}else {row.skips++;if(row.slots[b.time])row.slots[b.time].skipped++;row.skipReasons[e.reason]=(row.skipReasons[e.reason]||0)+1;}}
  }
  if(contested&&!strikes)row.zeroStrikeContestedPhases++;
 }
 row.winner=m.winner;row.reason=m.reason;row.survivorHp=m.alive('blue').reduce((s,u)=>s+u.hp,0);row.survivors=m.alive('blue').length;row.replay=replay(log.entries).ok;if(!row.replay)throw Error('Replay mismatch');runs.push(row);
}
const groups=[];
for(const profile of profiles)for(const policy of ['default','reversed','empty']){
 const rows=runs.filter(r=>r.profile===profile.name&&r.policy===policy),avg=k=>Number((rows.reduce((n,r)=>n+(r[k]||0),0)/rows.length).toFixed(2));
 const skips={},slots={};for(const r of rows){for(const [k,v]of Object.entries(r.skipReasons))skips[k]=(skips[k]||0)+v;for(const [k,v]of Object.entries(r.slots)){slots[k]??={used:0,skipped:0};slots[k].used+=v.used;slots[k].skipped+=v.skipped;}}
 groups.push({profile:profile.name,policy,runs:rows.length,wins:rows.filter(r=>r.winner==='blue').length,unfinished:rows.filter(r=>!r.winner).length,replayPassed:rows.filter(r=>r.replay).length,averageRounds:avg('rounds'),averageCombatSeconds:avg('combatSeconds'),averageAttacks:avg('attacks'),averageDamage:avg('damage'),averageSurvivorHp:avg('survivorHp'),activations:rows.reduce((s,r)=>s+r.activations,0),skips:rows.reduce((s,r)=>s+r.skips,0),skipReasons:skips,slots,zeroStrikeContestedPhases:rows.reduce((s,r)=>s+r.zeroStrikeContestedPhases,0)});
}
const report={scope:'Three authored campaigns, five player factions, paired seeds across profiles and blue timeline policies. Enemy uses default type timelines. No recruitment; normal march/rally policy. Accelerating profile varies both cadence and damage; not an isolated speed experiment. Results measure scripted playability, not human fun or symmetric skirmish balance.',seeds,profiles,groups,runs};
writeFileSync(process.argv[3]||'docs/experiments/SKILL_TIMELINE_RESULTS.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(groups,null,2));
