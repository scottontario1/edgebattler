import test from 'node:test';
import assert from 'node:assert/strict';
import {CARD_LIMITS,UNIT_CARDS,SPELL_CARDS,SKILL_CARDS,createCardState,cycleCard,previewCycle,recruitUnit,refreshRound,seededRandom} from '../src/cards.js';
import {createMatch} from '../src/match.js';
import {createRecruitUnit,createGradedRecruitUnit} from '../src/roster.js';
import {combineUnits} from '../src/upgrades.js';
import {memoryLog,replay} from '../src/log.js';
import {runCommander} from '../src/ai/commander.js';
const card=(def,id='test',extra={})=>({...def,instanceId:id,...extra});
const reserve=(id='paid',extra={})=>({...createGradedRecruitUnit('pikeman',id,'blue'),unitId:'pikeman',rarity:'common',costPaid:1,state:'reserve',...extra});
test('full-hand cycling replaces one card in place at no cost and shares the bench allowance',()=>{
 const hand=Array.from({length:8},(_,i)=>card(UNIT_CARDS.pikeman,'c'+i));
 const state=createCardState({supply:3,hand,reserves:[reserve()],population:1});
 const result=cycleCard(state,{source:'hand',id:'c3'},()=>0.99);
 assert.ok(result.ok);assert.equal(result.state.hand.length,8);assert.equal(result.replacement.unitId,'cavalier');
 assert.equal(result.replacement.rarity,'common');assert.equal(result.state.supply,3);assert.equal(result.state.hand[3].instanceId,result.replacement.instanceId);
 assert.equal(result.state.cyclesRemaining,0);assert.equal(previewCycle(result.state,{source:'bench',id:'paid'}).reason,'cycle-used');
 assert.deepEqual(state.hand,hand);assert.equal(state.cyclesRemaining,1);
});
test('each card type remains in its own rarity pool; a singleton pool can return the same identity',()=>{
 for(const def of [UNIT_CARDS.archer,SPELL_CARDS.mend,SKILL_CARDS.barrier]) {
  const state=createCardState({hand:[card(def)]}),r=cycleCard(state,{source:'hand',id:'test'},()=>0.99);
  assert.ok(r.ok);assert.equal(r.replacement.type,def.type);assert.equal(r.replacement.rarity,def.rarity);
  if(def.type==='skill')assert.equal(r.replacement.id,def.id);
 }
});
test('invalid requests leave state and random stream untouched',()=>{
 for(const [state,action,reason] of [
  [createCardState({hand:[card(UNIT_CARDS.pikeman,{})]}),{source:'hand',id:'missing'},'card-not-found'],
  [createCardState({hand:[card(UNIT_CARDS.pikeman,'rare',{rarity:'rare'})]}),{source:'hand',id:'rare'},'no-matching-pool'],
  [createCardState({hand:Array.from({length:8},(_,i)=>card(UNIT_CARDS.pikeman,'c'+i)),reserves:[reserve()]}),{source:'bench',id:'paid'},'hand-full'],
  [createCardState({cyclesRemaining:0,hand:[card(UNIT_CARDS.pikeman)]}),{source:'hand',id:'test'},'cycle-used'],
 ]) {
  let calls=0;const before=structuredClone(state),r=cycleCard(state,action,()=>{calls++;return 0;});
  assert.equal(r.reason,reason);assert.equal(calls,0);assert.deepEqual(state,before);assert.equal(r.state,state);
 }
});
test('bench cycling refunds actual investment, preserves grade, frees weighted population and permits overflow',()=>{
 const state=createCardState({supply:6,population:10,reserves:[reserve('paid',{stars:3,population:3,costPaid:9,hp:1,energy:4,cooldowns:{brace:2},selectedAbilities:['brace'],statuses:{ward:'upcoming-battle'}})]});
 const r=cycleCard(state,{source:'bench',id:'paid'},()=>0.99);
 assert.ok(r.ok);assert.equal(r.state.supply,15);assert.equal(r.refund,9);assert.equal(r.state.population,7);
 assert.equal(r.state.reserves.length,0);assert.equal(r.replacement.stars,3);assert.equal(r.replacement.cost,27);assert.equal(r.replacement.population,3);
 assert.equal(r.replacement.hp,undefined);assert.equal(r.replacement.energy,undefined);assert.equal(r.replacement.cooldowns,undefined);
 const refreshed=refreshRound(r.state,seededRandom(1));assert.equal(refreshed.state.supply,15);assert.equal(refreshed.supplyGranted,0);assert.equal(refreshed.state.cyclesRemaining,1);
});
test('graded repurchase enforces Supply and population; no hand ingredient participates in optional triples',()=>{
 const state=createCardState({supply:6,population:9,hand:[card(UNIT_CARDS.pikeman,'grade',{stars:2,population:2,cost:3})]});
 assert.equal(recruitUnit(state,'grade').reason,'population-cap');
 state.population=8;const result=recruitUnit(state,'grade');assert.ok(result.ok);assert.equal(result.state.supply,3);assert.equal(result.reserve.stars,2);assert.equal(result.reserve.population,2);assert.equal(result.reserve.costPaid,3);
 assert.equal(combineUnits([state.hand[0]],['grade','grade','grade'],{}).ok,false);
});
test('match repurchase creates full-health same-grade stats with empty energy, picks, cooldowns and statuses',()=>{
 const m=createMatch();const side=m.sides.blue;
 side.cards.hand=[card(UNIT_CARDS.pikeman,'graded',{stars:3,population:3,cost:9})];side.cards.supply=9;
 const bought=m.apply({type:'recruit',faction:'blue',cardId:'graded'});assert.ok(bought.ok);
 const u=side.cards.reserves.find(u=>u.id===bought.reserveId);
 assert.equal(u.hp,40);assert.equal(u.maxHp,40);assert.equal(u.str,12);assert.equal(u.population,3);assert.equal(u.energy,0);
 assert.deepEqual(u.cooldowns,{});assert.deepEqual(u.selectedAbilities,[]);assert.deepEqual(u.statuses,{});
 const [c,r]=m.deploymentTiles('blue').find(([c,r])=>m.canDeployAt('blue',u.id,c,r).ok);
 const placed=m.apply({type:'deploy',faction:'blue',reserveId:u.id,c,r});assert.ok(placed.ok);
 assert.equal(m.byId(placed.unitId).hp,40);assert.equal(m.byId(placed.unitId).costPaid,9);
});
test('paid investment survives deployment/withdrawal; free starting units have zero refund',()=>{
 const m=createMatch();m.sides.blue.cards.hand=[card(UNIT_CARDS.pikeman)];
 const buy=m.apply({type:'recruit',faction:'blue',cardId:'test'});assert.ok(buy.ok);
 const [c,r]=m.deploymentTiles('blue').find(([c,r])=>m.canDeployAt('blue',buy.reserveId,c,r).ok);
 const deploy=m.apply({type:'deploy',faction:'blue',reserveId:buy.reserveId,c,r});assert.ok(deploy.ok);
 const withdraw=m.apply({type:'withdraw',faction:'blue',unitId:deploy.unitId});assert.ok(withdraw.ok);
 const cycled=m.apply({type:'cycle',faction:'blue',source:'bench',id:withdraw.reserveId});assert.equal(cycled.refund,1);
 const base=createRecruitUnit('pikeman','free','blue',2,10);
 const freeMatch=createMatch({roster:[base,createRecruitUnit('pikeman','foe','red',12,1)]});
 const back=freeMatch.apply({type:'withdraw',faction:'blue',unitId:'free'});assert.ok(back.ok);
 assert.equal(freeMatch.apply({type:'cycle',faction:'blue',source:'bench',id:back.reserveId}).refund,0);
});
test('combining paid reserves sums investment without forcing a triple',()=>{
 const units=[reserve('a'),reserve('b'),reserve('c')];
 const result=combineUnits(units,['a','b','c'],{survivorId:'a',destination:'reserve'});
 assert.ok(result.ok);assert.equal(result.unit.costPaid,3);assert.equal(result.unit.stars,2);assert.equal(units.length,3);
});
test('both factions share cycle rules independently; opponent reserves and field units are ineligible',()=>{
 const m=createMatch();
 const b=m.sides.blue.cards.hand[0],r=m.sides.red.cards.hand[0];
 assert.ok(m.apply({type:'cycle',faction:'blue',source:'hand',id:b.instanceId}).ok);
 assert.ok(m.apply({type:'cycle',faction:'red',source:'hand',id:r.instanceId}).ok);
 assert.equal(m.sides.blue.cards.cyclesRemaining,0);assert.equal(m.sides.red.cards.cyclesRemaining,0);
 m.resolveRound();assert.equal(m.sides.blue.cards.cyclesRemaining,1);assert.equal(m.sides.red.cards.cyclesRemaining,1);
 assert.equal(m.apply({type:'cycle',faction:'blue',source:'bench',id:'brenna'}).reason,'reserve-not-found');
});
test('seeded cycling and refreshed allowances replay exactly through AI games',()=>{
 const log=memoryLog(),m=createMatch({seed:7,maxRounds:6,log:log.push});
 const first=m.sides.blue.cards.hand[0];assert.ok(m.apply({type:'cycle',faction:'blue',source:'hand',id:first.instanceId}).ok);
 while(!m.over){runCommander(m,'blue','heuristic');runCommander(m,'red','heuristic');m.resolveRound();}
 assert.ok(replay(log.entries).ok);assert.ok(m.stats().blue.cycles.hand>0);assert.equal(log.entries[0].schema,3);
});
