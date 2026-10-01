import {memoryLog,replay} from '../src/log.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {armyGroups} from '../src/ui/army.js';
import {createCardState,refreshRound,seededRandom,CARD_LIMITS,setCardLimits} from '../src/cards.js';
import {createCampaignMatch,CAMPAIGN_LEVELS} from '../src/campaign.js';
test('supply accumulates to 30 at unchanged income and stops at bank cap',()=>{
 assert.equal(CARD_LIMITS.maxSupply,30);assert.equal(CARD_LIMITS.supplyPerRound,3);
 let state=createCardState({supply:6});
 for(let i=0;i<10;i++)state=refreshRound(state,seededRandom(i)).state;
 assert.equal(state.supply,30);
 assert.equal(refreshRound(state,seededRandom(1)).supplyGranted,0);
});
test('army management separates variants sharing a combat class and includes paid reserves',()=>{
 const groups=armyGroups([{id:'a',cls:'pikeman',variantId:'crownPike',name:'Pike'},{id:'b',cls:'pikeman',variantId:'crownGuard',name:'Guard'}],[{id:'r',unitId:'crownPike',state:'reserve'}]);
 assert.equal(groups.length,2);assert.equal(groups[0].field.length,1);assert.equal(groups[0].reserves.length,1);assert.equal(groups[1].field[0].id,'b');
});
test('authoritative match records each round combat once including final victory',()=>{
 const m=createCampaignMatch(CAMPAIGN_LEVELS[0],{faction:'crown',seed:7});
 const attacker=m.alive('blue')[1],enemy=m.alive('red')[0];
 attacker.c=enemy.c-1;attacker.r=enemy.r;attacker.stance='hold';
 const result=m.resolveRound(),report=m.battleStats();
 const damage=result.batches.flatMap(b=>b.events||[]).filter(e=>e.type==='strike'&&e.attackerId===attacker.id).reduce((s,e)=>s+e.damage,0);
 assert.equal(report.units.find(u=>u.id===attacker.id).damageDealt,damage);
 assert.deepEqual(m.battleStats(),report,'rendering/report queries do not double count');
});

test('saved smaller supply bank replays without changing current bank settings',()=>{
 const log=memoryLog();setCardLimits({maxSupply:6});
 try {const m=createCampaignMatch(CAMPAIGN_LEVELS[0],{faction:'crown',seed:7,log:log.push});for(let i=0;i<3;i++)m.resolveRound();}finally{setCardLimits();}
 assert.equal(CARD_LIMITS.maxSupply,30);assert.equal(replay(log.entries).ok,true);assert.equal(CARD_LIMITS.maxSupply,30);
});
