import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveBattleRound} from '../src/battle.js';
const unit = (id,faction,c,r,extra={}) => ({id,faction,c,r,hp:30,maxHp:30,str:10,def:0,range:[1,1],...extra});
test('archers choose a legal ranged enemy despite a closer adjacent enemy, on either faction',()=>{
 for(const faction of ['blue','red']) {
  const other=faction==='blue'?'red':'blue';
  const units=[unit('a',faction,4,4,{range:[2,2]}),unit('close',other,4,5),unit('legal',other,4,6)];
  const result=resolveBattleRound({units,orders:Object.fromEntries(units.map(u=>[u.id,{stance:'hold'}]))});
  assert.equal(result.batches[1].events.find(e=>e.attackerId==='a')?.targetId,'legal');
 }
});
test('invalid explicit friendly target cannot cause friendly fire',()=>{
 const units=[unit('a','blue',4,4),unit('friend','blue',4,5),unit('enemy','red',5,4)];
 const result=resolveBattleRound({units,orders:{a:{stance:'hold',targetId:'friend'},friend:{stance:'hold'},enemy:{stance:'hold'}}});
 assert.equal(result.batches[1].events.find(e=>e.attackerId==='a').targetId,'enemy');
});
test('out of range units do not attack, and lethal strikes remain simultaneous',()=>{
 const units=[unit('a','blue',4,4,{hp:5}),unit('b','red',5,4,{hp:5}),unit('far','blue',12,12)];
 const result=resolveBattleRound({units,orders:Object.fromEntries(units.map(u=>[u.id,{stance:'hold'}]))});
 assert.deepEqual(result.units.map(u=>u.hp),[0,0,30]);
 assert.equal(result.batches[1].events.filter(e=>e.type==='strike').length,2);
});

import {createMatch} from '../src/match.js';
import {createRecruitUnit} from '../src/roster.js';
import {initializeAbilityState,advanceAbilityRound,activatePhase,selectedCost,paidBundleReady,battleMovement,facingFromPath,flankSide,validateAbilitySelection} from '../src/abilities.js';
import {forecast} from '../src/combat.js';
import {memoryLog,replay} from '../src/log.js';
import {runCommander} from '../src/ai/commander.js';
const recruit=(id,cls,f,c,r,extra={})=>initializeAbilityState({...createRecruitUnit(cls,id,f,c,r),...extra});
const events=result=>result.batches.flatMap(b=>b.events);
test('round-one energy, field and reserve gains clamp without resetting persistent selections',()=>{
 const m=createMatch();assert.ok(m.alive().every(u=>u.energy===1));
 const p=m.alive('blue').find(u=>u.cls==='pikeman');
 p.energy=2;p.selectedAbilities=['rally','brace'];p.cooldowns.brace=2;
 m.resolveRound();assert.equal(p.cooldowns.brace,1);assert.deepEqual(p.selectedAbilities,['rally','brace']);
 let u=initializeAbilityState({energy:1,energyGainNextTurn:1,cooldowns:{rally:2},selectedAbilities:['rally']});
 u=advanceAbilityRound(u,1);assert.equal(u.energy,4);assert.equal(u.energyGainNextTurn,0);assert.equal(u.cooldowns.rally,1);
 assert.equal(advanceAbilityRound(u).energy,4);assert.equal(advanceAbilityRound(u).cooldowns.rally,0);
});
test('planning group edits are atomic, clearing is free and Charge requires Advance',()=>{
 const m=createMatch(),ps=m.alive('blue').filter(u=>u.cls==='pikeman');ps[0].energy=3;ps[1].energy=1;
 const result=m.apply({type:'abilities',faction:'blue',unitIds:ps.map(u=>u.id),abilityIds:['rally','brace']});
 assert.equal(result.reason,'insufficient-energy');assert.ok(ps.every(u=>!u.selectedAbilities.length));
 ps[1].energy=2;assert.ok(m.apply({type:'abilities',faction:'blue',unitIds:ps.map(u=>u.id),abilityIds:['rally','brace']}).ok);
 assert.equal(ps[0].energy,3);assert.ok(m.apply({type:'abilities',faction:'blue',unitId:ps[0].id,abilityIds:[]}).ok);
 const cav=m.alive('blue').find(u=>u.cls==='cavalier');cav.energy=4;cav.stance='hold';
 assert.equal(m.apply({type:'abilities',faction:'blue',unitId:cav.id,abilityIds:['charge']}).reason,'charge-requires-advance');
 assert.equal(m.apply({type:'abilities',faction:'red',unitId:ps[0].id,abilityIds:[]}).reason,'unit-not-found');
});
test('retained unaffordable paid bundle stays suspended even if free Rally generates energy',()=>{
 let u=recruit('p','pikeman','blue',4,9,{energy:1,hp:8,selectedAbilities:['rally','brace']});
 const paid=paidBundleReady(u);assert.equal(paid,false);
 const defense=activatePhase(u,'defense',{paid});assert.equal(defense.events[0].reason,'insufficient-energy');
 const recovery=activatePhase(defense.unit,'recovery',{paid});assert.equal(recovery.unit.hp,18);assert.equal(recovery.unit.energy,2);
 assert.deepEqual(recovery.unit.selectedAbilities,['rally','brace']);assert.equal(recovery.unit.cooldowns.brace,undefined);
});
test('Rally is explicit, useful and bounded by its cooldown',()=>{
 let u=recruit('p','pikeman','blue',4,9,{energy:4});
 assert.equal(activatePhase(u,'recovery').events.length,0);
 u.selectedAbilities=['rally'];assert.equal(activatePhase(u,'recovery').events[0].reason,'not-useful');
 u.hp=10;const first=activatePhase(u,'recovery');assert.equal(first.unit.hp,20);assert.equal(first.unit.cooldowns.rally,2);
 assert.equal(activatePhase(advanceAbilityRound(first.unit),'recovery').events[0].reason,'cooldown');
 assert.ok(activatePhase(advanceAbilityRound(advanceAbilityRound(first.unit)),'recovery').events[0].applied);
});
test('Brace commits before movement even without incoming attacks, then restores the persistent stance',()=>{
 const p=recruit('p','pikeman','blue',3,9,{energy:2,selectedAbilities:['brace'],stance:'advance'});
 const foe=recruit('e','pikeman','red',13,3,{stance:'hold'});
 const m=createMatch({roster:[p,foe]});const result=m.resolveRound();
 assert.equal(events(result).find(e=>e.abilityId==='brace').cost,2);
 assert.equal(events(result).find(e=>e.unitId==='p'&&e.type==='hold').reason,'hold stance');
 assert.equal(m.byId('p').stance,'advance');assert.equal(m.byId('p').c,3);assert.equal(m.byId('p').energy,2);
 assert.equal(m.byId('p').statuses.brace,undefined);
});
test('Ward halves damage before Brace and Barrier absorb across multiple small hits',()=>{
 const target=unit('t','blue',4,4,{statuses:{ward:'upcoming-battle',brace:4,barrier:2}});
 const units=[target,unit('a','red',4,5,{str:6}),unit('b','red',5,4,{str:6}),unit('c','red',3,4,{str:6})];
 const result=resolveBattleRound({units,orders:Object.fromEntries(units.map(u=>[u.id,{stance:'hold'}]))});
 const hits=events(result).filter(e=>e.targetId==='t');
 assert.equal(hits.reduce((n,e)=>n+e.damage,0),3);
 assert.equal(hits.reduce((n,e)=>n+e.braceReduction,0),4);
 assert.equal(hits.reduce((n,e)=>n+e.barrierReduction,0),2);
 assert.deepEqual(result.units.find(u=>u.id==='t').statuses,{});
});
test('Focused Shot needs an eligible target; it enhances one basic strike and caps hit at 100',()=>{
 let a=recruit('a','archer','blue',4,4,{energy:2,selectedAbilities:['focusedShot']});
 const absent=activatePhase(a,'enhancement',{hasTarget:false});assert.equal(absent.unit.energy,2);assert.equal(absent.unit.cooldowns.focusedShot,undefined);
 a=activatePhase(a,'enhancement',{hasTarget:true}).unit;
 const t=unit('t','red',4,6);const result=resolveBattleRound({units:[{...a,range:[2,2],str:10},t],orders:{a:{stance:'hold'},t:{stance:'hold'}}});
 const hit=events(result).find(e=>e.attackerId==='a');assert.equal(hit.damage,14);assert.equal(hit.attackBonus,4);
 assert.equal(result.units[0].energy,0);assert.equal(result.units[0].statuses.attackBonus,undefined);
});
test('Charge costs nothing without movement or legal target; Advance is mandatory',()=>{
 const c=recruit('c','cavalier','blue',4,4,{energy:2,selectedAbilities:['charge']});
 for(const context of [{moved:false,hasTarget:true},{moved:true,hasTarget:false}]) {
  const result=activatePhase(c,'enhancement',context);assert.equal(result.unit.energy,2);assert.equal(result.unit.cooldowns.charge,undefined);
 }
 assert.equal(activatePhase({...c,stance:'hold'},'enhancement',{moved:true,hasTarget:true}).events[0].reason,'charge-trigger-unmet');
 const ok=activatePhase(c,'enhancement',{moved:true,hasTarget:true});assert.equal(ok.unit.energy,0);assert.equal(ok.unit.statuses.attackBonus,4);
});
test('two Cavalier picks execute once in fixed phases, without healing-derived affordability',()=>{
 const c=recruit('c','cavalier','blue',4,4,{hp:8,energy:3,selectedAbilities:['charge','secondWind']});
 const recovery=activatePhase(c,'recovery');assert.equal(recovery.unit.hp,14);assert.equal(recovery.unit.energy,2);
 const attack=activatePhase(recovery.unit,'enhancement',{moved:true,hasTarget:true});assert.equal(attack.unit.energy,0);
 assert.equal(attack.unit.cooldowns.secondWind,3);assert.equal(attack.unit.cooldowns.charge,2);
 assert.equal(activatePhase(attack.unit,'recovery').events[0].reason,'cooldown');
 assert.equal(validateAbilitySelection({...c,energy:2},c.selectedAbilities).shortfall,1);
});
test('Advance budget uses terrain movement points and final path step determines facing',()=>{
 assert.deepEqual([4,5,7].map(mov=>battleMovement({stance:'advance',mov})),[3,3,5]);
 assert.equal(battleMovement({stance:'hold',mov:7}),0);assert.equal(battleMovement({stance:'protect',mov:7}),7);
 assert.equal(facingFromPath([[2,2],[3,2],[3,3]]),'south');assert.equal(facingFromPath([[2,2]],'west'),'west');
 const m=createMatch({roster:[recruit('c','cavalier','blue',2,9),recruit('e','pikeman','red',13,3,{stance:'hold'})]});
 const result=m.resolveRound(),move=events(result).find(e=>e.type==='move'&&e.unitId==='c');
 assert.ok(move);assert.ok(move.path.length<=5);
 assert.equal(m.byId('c').facing,facingFromPath([[move.from.c,move.from.r],...move.path]));
});
test('front, side and rear flanks use locked cardinal facing for both factions, stack Charge before crit',()=>{
 for(const faction of ['blue','red']) {
  const other=faction==='blue'?'red':'blue',target=unit('t',other,4,4,{facing:'north',hp:100});
  assert.equal(flankSide({c:4,r:3},target),'front');assert.equal(flankSide({c:5,r:4},target),'side');assert.equal(flankSide({c:4,r:5},target),'back');
  const attacker=unit('a',faction,5,4,{cls:'cavalier',statuses:{attackBonus:4}});
  const result=resolveBattleRound({units:[target,attacker],orders:{a:{stance:'hold'},t:{stance:'hold'}},forecastAttack:()=>({atk:{can:true,dmg:10,hit:100,crit:100}})});
  assert.equal(events(result).find(e=>e.attackerId==='a').damage,54);
  assert.equal(result.units[0].facing,'north');
 }
});
test('withdraw preserves picks and cooldowns; reserve bonuses do not repeat after redeployment',()=>{
 const p=recruit('p','pikeman','blue',2,10,{energy:2,selectedAbilities:['rally','brace'],energyGainNextTurn:1,cooldowns:{brace:2},hp:8});
 const m=createMatch({roster:[p,recruit('e','pikeman','red',13,3,{stance:'hold'})]});
 const w=m.apply({type:'withdraw',faction:'blue',unitId:'p'});assert.ok(w.ok);
 m.resolveRound();const reserve=m.sides.blue.cards.reserves[0];assert.equal(reserve.energy,4);assert.equal(reserve.energyGainNextTurn,0);assert.equal(reserve.cooldowns.brace,1);
 const [c,r]=m.deploymentTiles('blue').find(([c,r])=>m.canDeployAt('blue',reserve.id,c,r).ok);
 const d=m.apply({type:'deploy',faction:'blue',reserveId:reserve.id,c,r});assert.ok(d.ok);
 const deployed=m.byId(d.unitId);assert.deepEqual(deployed.selectedAbilities,['rally','brace']);assert.equal(deployed.energyGainNextTurn,0);assert.equal(deployed.hp,12);
});
test('replay checks actions, facing, selected abilities and full battle events; rejects obsolete logs',()=>{
 const log=memoryLog(),m=createMatch({seed:42,maxRounds:4,log:log.push});
 const p=m.alive('blue').find(u=>u.cls==='pikeman');
 m.apply({type:'abilities',faction:'blue',unitId:p.id,abilityIds:['rally']});m.apply({type:'facing',faction:'blue',unitId:p.id,facing:'east'});
 while(!m.over){runCommander(m,'blue','heuristic');runCommander(m,'red','heuristic');m.resolveRound();}
 assert.ok(replay(log.entries).ok);
 const corrupted=structuredClone(log.entries);corrupted.find(e=>e.t==='round').batches[1].events.push({type:'fake'});assert.equal(replay(corrupted).ok,false);
 assert.equal(replay([{t:'header',schema:1}]).mismatches[0].reason,'unsupported-schema');
});

test('protection subtracts from the full incoming hit before applying the HP floor',()=>{
 const units=[unit('t','blue',4,4,{hp:3,statuses:{brace:4}}),unit('a','red',4,5)];
 const result=resolveBattleRound({units,orders:{t:{stance:'hold'},a:{stance:'hold'}}});
 assert.equal(result.units[0].hp,0);assert.equal(events(result).find(e=>e.targetId==='t').damage,6);
});
test('the integrated match commits moved Charge and legal Focused Shot for both factions',()=>{
 for(const f of ['blue','red']) {
  const other=f==='blue'?'red':'blue';
  const roster=[recruit('c','cavalier',f,3,5,{energy:2,selectedAbilities:['charge']}),recruit('a','archer',f,3,8,{energy:2,selectedAbilities:['focusedShot'],stance:'hold'}),
   recruit('e1','pikeman',other,5,5,{stance:'hold'}),recruit('e2','pikeman',other,5,8,{stance:'hold'})];
  const m=createMatch({roster});const result=m.resolveRound();
  for(const id of ['charge','focusedShot']) assert.ok(events(result).some(e=>e.abilityId===id&&e.applied));
  assert.ok(events(result).find(e=>e.attackerId==='c').attackBonus===4);
  assert.ok(events(result).find(e=>e.attackerId==='a').attackBonus===4);
 }
});
