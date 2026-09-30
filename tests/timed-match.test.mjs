import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignMatch,CAMPAIGN_BY_ID} from '../src/campaign.js';
import {memoryLog,replay} from '../src/log.js';
test('timed campaign has repeated attacks, bounded automatic skill windows and exact replay',()=>{
 const log=memoryLog(),m=createCampaignMatch(CAMPAIGN_BY_ID.road,{faction:'crown',seed:123,combat:{duration:18},log:log.push});
 m.apply({type:'campaignOrder',faction:'blue'});
 const result=m.resolveRound(),combat=result.batches.filter(b=>b.type==='combat'),skills=result.batches.filter(b=>b.type==='abilities');
 const counts=new Map();for(const b of combat)for(const e of b.events)if(e.type==='strike')counts.set(e.attackerId,(counts.get(e.attackerId)||0)+1);
 assert.ok([...counts.values()].some(n=>n>=3));
 const fired=new Set();for(const batch of skills){assert.ok([3,9,15].includes(batch.time));for(const e of batch.events)if(e.applied){const key=e.unitId+e.abilityId;assert.ok(!fired.has(key));fired.add(key);}}
 assert.ok(fired.size>=3);assert.equal(replay(log.entries).ok,true);
 assert.ok(m.units.every(u=>u.energy>=0&&u.energy<=u.maxEnergy));
 assert.equal(m.sides.red.cards.hand.length,0);
});
test('regroup movement works with no enemies and allows the next fixed encounter',()=>{
 const m=createCampaignMatch(CAMPAIGN_BY_ID.road,{faction:'crown',seed:123,combat:{duration:18}});
 m.apply({type:'campaignOrder',faction:'blue'});m.resolveRound();
 assert.equal(m.campaign.phase,'regroup');
 m.apply({type:'campaignOrder',faction:'blue'});m.resolveRound();
 assert.equal(m.apply({type:'campaignContinue',faction:'blue'}).ok,true);
 assert.equal(m.campaign.stage,1);assert.ok(m.alive('red').length>0);
});

import {createMatch} from '../src/match.js';
import {registerAbilities,unregisterAbilities} from '../src/abilities.js';
import {createRecruitUnit} from '../src/roster.js';
test('two timed defensive spawns cannot claim the same tile in one skill window',()=>{
 registerAbilities([{id:'timedTestWall',name:'Test Wall',classes:['pikeman'],cost:0,cooldown:1,phase:'defense',spawn:{kind:'barricade',hp:10,blocks:true,at:'front'}}]);
 try{
  const a={...createRecruitUnit('pikeman','a','blue',4,5),facing:'east',stance:'hold',selectedAbilities:['timedTestWall']};
  const b={...createRecruitUnit('pikeman','b','blue',6,5),facing:'west',stance:'hold',selectedAbilities:['timedTestWall']};
  const enemy={...createRecruitUnit('archer','enemy','red',9,5),stance:'hold'};
  const m=createMatch({roster:[a,b,enemy],combat:{duration:4},abilities:true});
  const result=m.resolveRound();
  const spawns=result.batches.filter(b=>b.type==='abilities').flatMap(b=>b.events).filter(e=>e.objectSpawn);
  assert.equal(spawns.length,1);assert.equal(m.objects.length,1);
  assert.equal(result.batches.find(b=>b.events.some(e=>e.objectSpawn)).time,3);
 }finally{unregisterAbilities(['timedTestWall']);}
});
