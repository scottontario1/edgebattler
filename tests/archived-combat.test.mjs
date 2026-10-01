import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch} from '../src/match.js';
import {createCampaignMatch,CAMPAIGN_LEVELS} from '../src/campaign.js';
import {memoryLog,replay} from '../src/log.js';
import {setMap,DEFAULT_MAP} from '../src/board.js';
import {SHARD_RULES} from '../src/shards.js';

test('normal timed combat uses Shards with skills and spells archived, including faction pools',()=>{
 for(const faction of ['classic','crown','fang','league','court']){
  const log=memoryLog(),m=createCampaignMatch(CAMPAIGN_LEVELS[0],{faction,seed:7,combat:{duration:18},log:log.push});
  assert.equal(m.abilitiesEnabled,false);assert.equal(m.spellsEnabled,false);
  assert.ok(m.sides.blue.cards.hand.every(c=>!['spell','skill'].includes(c.type)));
  assert.equal(m.sides.blue.cards.hand.filter(c=>c.type==='shard').length>=2,true);
  assert.equal(SHARD_RULES.dockSlots,12);
  const u=m.alive('blue')[0];assert.equal(m.apply({type:'abilities',faction:'blue',unitId:u.id,skillSlots:[null,null,null]}).reason,'abilities-disabled');
  assert.equal(m.apply({type:'spell',faction:'blue',cardId:'archived'}).reason,'spells-disabled');
  m.apply({type:'campaignOrder',faction:'blue'});const r=m.resolveRound();
  assert.ok(r.batches.filter(b=>b.type==='abilities').every(b=>!b.events.some(e=>e.abilityId)));
  assert.equal(replay(log.entries).ok,true);
 }
});
test('spells can be explicitly restored without enabling skills and replay exactly',()=>{
 setMap(DEFAULT_MAP);const log=memoryLog(),m=createMatch({seed:7,spells:true,abilities:false,pools:{blue:['fireburst'],red:['pikeman']},log:log.push});
 const card=m.sides.blue.cards.hand.find(c=>c.type==='spell'),enemy=m.alive('red')[0];assert.ok(card);
 assert.equal(m.apply({type:'spell',faction:'blue',cardId:card.instanceId,c:enemy.c,r:enemy.r}).ok,true);
 m.resolveRound();assert.equal(replay(log.entries).ok,true);
});
