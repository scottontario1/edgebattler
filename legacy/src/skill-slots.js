import {kitFor} from './abilities.js';
export function defaultSkillSlots(unit){
 if(Array.isArray(unit.skillSlots))return [...unit.skillSlots];
 const picked=unit.selectedAbilities?.length?unit.selectedAbilities:kitFor(unit).map(a=>a.id);
 const phases={defense:0,enhancement:1,recovery:2};
 const ordered=kitFor(unit).filter(a=>picked.includes(a.id)).sort((a,b)=>phases[a.phase]-phases[b.phase]);
 return Array.from({length:3},(_,i)=>ordered[i]?.id||null);
}
export function validateSkillSlots(unit,slots){
 if(!Array.isArray(slots)||slots.length!==3)return {ok:false,reason:'three-skill-slots-required'};
 const ids=slots.filter(id=>id!==null);
 if(ids.some(id=>typeof id!=='string'||!kitFor(unit).some(a=>a.id===id)))return {ok:false,reason:'invalid-ability'};
 if(new Set(ids).size!==ids.length)return {ok:false,reason:'duplicate-skill'};
 return {ok:true};
}
// Move an existing skill to its new window. A replaced skill returns to the palette.
export function placeSkill(slots,id,index){
 const next=slots.map(value=>value===id?null:value);next[index]=id;return next;
}
