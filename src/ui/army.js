import { esc, uiFlags } from './util.js';
export const unitType = u => u.variantId || u.unitId || u.cls;
export function armyGroups(field, reserves) {
 const groups=new Map();
 for(const u of [...field,...reserves]) {
  const key=unitType(u);if(!groups.has(key))groups.set(key,{key,name:u.name||key,representative:u,field:[],reserves:[]});
  groups.get(key)[u.state==='reserve'?'reserves':'field'].push(u);
 }
 return [...groups.values()];
}
export function armyHTML(groups,{portraitFor,activeType,managedType}) {
 return `<div class="army-heading">Your army <button data-army-action="stats" title="Battle statistics">Stats</button></div>`+groups.map(g=>`<div class="army-type ${activeType===g.key?'active':''}"><button class="army-select" data-army-select="${esc(g.key)}" title="Select ${esc(g.name)}"><span class="army-face">${portraitFor(g.representative)}</span><span class="army-label">${esc(g.name)}<small>${g.field.length} field${g.reserves.length?' · '+g.reserves.length+' bench':''}</small></span></button><button class="army-manage" data-army-manage="${esc(g.key)}" aria-expanded="${managedType===g.key}">Manage</button>${managedType===g.key?`<div class="army-options"><button data-army-action="next" data-type="${esc(g.key)}">Next unit</button>${uiFlags.abilities?`<button data-army-action="plan" data-type="${esc(g.key)}" ${!g.field.length?'disabled':''}>Skills & stats</button>`:''}<button data-army-action="advance" data-type="${esc(g.key)}" ${!g.field.length?'disabled':''}>Advance all</button><button data-army-action="hold" data-type="${esc(g.key)}" ${!g.field.length?'disabled':''}>Hold all</button>${g.reserves.map(u=>`<button data-army-bench="${esc(u.id)}">Deploy ${esc(u.name||g.name)}</button>`).join('')}</div>`:''}</div>`).join('');
}
