import {kitFor,selectedCost,FACING,battleMovement} from '../abilities.js';
import {esc} from './util.js';
export function abilityEditorHTML(u,{draft,targets,units,notice,groupOpen,lastResults=[]}) {
 const cost=selectedCost({selectedAbilities:draft});
 const group=units.filter(o=>(o.variantId||o.cls)===(u.variantId||u.cls)&&o.faction===u.faction&&o.hp>0);
 const shortfall=Math.max(0,...group.filter(o=>targets.includes(o.id)).map(o=>cost-o.energy));
 return `<section class="ability-editor" aria-label="Battle plan">
  <h3>Battle plan</h3><p>Picks repeat when ready. Movement and basic attacks are free.</p>
  <div class="plan-summary">Energy <b>${u.energy}/${u.maxEnergy}</b> · Selected cost <b>${cost}</b> · Facing <b>${esc(u.facing)}</b></div>
  ${selectedCost(u)>u.energy?'<p class="plan-warning">Paid picks suspended until energy recovers. Free abilities and basic actions remain available.</p>':''}
  <div class="ability-options">${kitFor(u).map(a=>`<button type="button" data-ability="${a.id}" aria-pressed="${draft.includes(a.id)}" class="ability-pick ${draft.includes(a.id)?'picked':''}"><b>${a.name} <small>${a.cost} energy · CD ${a.cooldown}</small></b><span>${esc(a.description)}</span><em>${u.cooldowns?.[a.id]>0?'Ready in '+u.cooldowns[a.id]+' round(s)':'Ready'}${a.id==='charge'&&u.stance!=='advance'?' · Set Advance first':''}</em></button>`).join('')||'<p>This champion has no active kit yet. Basic actions remain automatic.</p>'}</div>
  ${kitFor(u).length?`<details class="plan-group" ${groupOpen?'open':''}><summary>Apply to a group · ${targets.length} selected</summary><button type="button" data-plan-class>Select all ${esc(u.cls)}s</button><div>${group.map(o=>`<label><input type="checkbox" data-plan-unit="${esc(o.id)}" ${targets.includes(o.id)?'checked':''}>${esc(o.name)} (${o.c},${o.r}) · ${o.energy} energy</label>`).join('')}</div></details><button type="button" data-plan-apply ${shortfall||!targets.length?'disabled':''}>Apply picks · ${targets.length} unit(s)</button>${shortfall?`<p class="plan-warning">Group needs ${shortfall} more energy. No unit will be changed.</p>`:''}` : ''}
  <p role="status" class="plan-notice">${esc(notice||'Selecting or clearing picks spends no energy.')}</p>
  ${lastResults.length?`<p class="plan-last">Last battle: ${lastResults.map(e=>esc(e.name)+': '+(e.applied?'used':esc({'cooldown':'cooling down','insufficient-energy':'paid picks suspended','charge-trigger-unmet':'needs Advance, movement and a target','no-legal-target':'no legal target','above-half-hp':'above half HP','not-useful':'already recovered'}[e.reason]||e.reason))).join(' · ')}</p>`:''}
  <h4>Facing</h4><div class="plan-facing">${Object.keys(FACING).map(k=>`<button type="button" data-facing="${k}" aria-pressed="${u.facing===k}">${{north:'↑ North',east:'→ East',south:'↓ South',west:'← West'}[k]}</button>`).join('')}</div>
  <p>Base battle movement: ${battleMovement(u)} movement points.${u.selectedAbilities?.includes('brace')&&selectedCost(u)<=u.energy&&!u.cooldowns?.brace?' Ready Brace overrides this to Hold (0).':''} Final path step sets facing; stationary units keep it.</p>
  ${u.cls==='cavalier'?`<p>Passive flank: +4 damage from the side or back. Gold map tiles mark those sides now; enemies may turn when moving.</p>` : ''}
 </section>`;
}
