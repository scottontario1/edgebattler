import {setAbilitiesEnabled} from '../src/abilities.js';
setAbilitiesEnabled(true);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch} from '../src/match.js';
import {createRecruitUnit} from '../src/roster.js';
import {memoryLog,replay} from '../src/log.js';
import {placeSkill} from '../src/skill-slots.js';
const fixture=()=>{
 const blue={...createRecruitUnit('archer','a','blue',4,5),hp:300,maxHp:300,energy:4,stance:'hold'};
 const red={...createRecruitUnit('pikeman','enemy','red',6,5),hp:300,maxHp:300,stance:'hold'};
 return [blue,red];
};
test('a slotted skill fires only at the chosen time and timeline replays exactly',()=>{
 const log=memoryLog(),roster=fixture(),m=createMatch({roster,combat:{duration:18},log:log.push});
 assert.equal(m.apply({type:'abilities',faction:'blue',unitId:'a',skillSlots:[null,null,'focusedShot']}).ok,true);
 const result=m.resolveRound();
 const shots=result.batches.flatMap(b=>b.events.filter(e=>e.unitId==='a'&&e.abilityId==='focusedShot'&&e.applied).map(e=>({time:b.time,...e})));
 assert.equal(shots.length,1);assert.equal(shots[0].time,15);
 assert.equal(replay(log.entries,{create:(h,push)=>createMatch({roster,seed:h.seed,combat:h.combat,log:push})}).ok,true);
});
test('a trigger missed in its assigned window does not retry in a later slot',()=>{
 const roster=fixture();roster[1].c=9;
 const m=createMatch({roster,combat:{duration:18}});
 m.apply({type:'abilities',faction:'blue',unitId:'a',skillSlots:['focusedShot',null,null]});
 const result=m.resolveRound();
 const shots=result.batches.filter(b=>b.type==='abilities').flatMap(b=>b.events.filter(e=>e.unitId==='a'&&e.abilityId==='focusedShot').map(e=>({time:b.time,...e})));
 assert.equal(shots.length,1);assert.equal(shots[0].time,3);assert.equal(shots[0].applied,false);
});
test('timeline edits reject duplicates and incompatible group members atomically',()=>{
 const roster=fixture();roster[1].faction='blue';const m=createMatch({roster,combat:{duration:18}}),before=structuredClone(m.byId('a').skillSlots);
 assert.equal(m.apply({type:'abilities',faction:'blue',unitId:'a',skillSlots:['focusedShot','focusedShot',null]}).reason,'duplicate-skill');
 assert.equal(m.apply({type:'abilities',faction:'blue',unitIds:['a','enemy'],skillSlots:['focusedShot',null,null]}).ok,false);
 assert.deepEqual(m.byId('a').skillSlots,before);
 assert.equal(m.apply({type:'abilities',faction:'blue',unitId:'a',skillSlots:[null,null,null]}).ok,true);
 assert.deepEqual(m.byId('a').selectedAbilities,[]);
});
test('moving a skill empties its previous slot and replaces the destination',()=>{
 assert.deepEqual(placeSkill(['brace','rally',null],'brace',1),[null,'brace',null]);
});

test('one-unit edit applies to its whole type, reserves and later recruits, but not enemy types',()=>{
 const roster=fixture();roster.push({...roster[0],id:'a2',c:3});roster[1]={...roster[0],id:'enemy',faction:'red',c:6};
 const m=createMatch({roster,combat:{duration:18}}),slots=[null,null,'focusedShot'];
 assert.equal(m.apply({type:'abilities',faction:'blue',unitId:'a',skillSlots:slots}).ok,true);
 assert.deepEqual(m.byId('a2').skillSlots,slots);assert.notDeepEqual(m.byId('enemy').skillSlots,slots);
 m.sides.blue.cards.supply=30;
 m.sides.blue.cards.hand=[{id:'unit-archer',instanceId:'test-archer',type:'unit',unitId:'archer',classId:'archer',cost:2,stars:1,rarity:'common'}];
 const bought=m.apply({type:'recruit',faction:'blue',cardId:'test-archer'});assert.equal(bought.ok,true);
 const reserve=m.sides.blue.cards.reserves.find(u=>u.id===bought.reserveId);assert.deepEqual(reserve.skillSlots,slots);
 assert.equal(m.apply({type:'abilities',faction:'blue',unitId:'a',skillSlots:[null,null,null]}).ok,true);
 assert.deepEqual(reserve.skillSlots,[null,null,null]);
 const deployed=m.apply({type:'deploy',faction:'blue',reserveId:reserve.id,c:4,r:6,free:true});assert.equal(deployed.ok,true);
 assert.deepEqual(m.alive('blue').find(u=>u.id===reserve.id)?.skillSlots||m.alive('blue').find(u=>u.c===4&&u.r===6)?.skillSlots,[null,null,null]);
});

test('legacy unit-scoped timelines keep independent choices',()=>{
 const roster=fixture();roster.push({...roster[0],id:'a2',c:3});
 const m=createMatch({roster,combat:{duration:18,timelineScope:'unit'}}),old=[...m.byId('a2').skillSlots];
 m.apply({type:'abilities',faction:'blue',unitId:'a',skillSlots:[null,null,'focusedShot']});
 assert.deepEqual(m.byId('a2').skillSlots,old);
});
