import {spawnSync} from 'node:child_process';
const expression=`(async()=>{
 const click=s=>{const b=document.querySelector(s);if(!b)throw new Error('Missing '+s);b.click();};
 click('[data-army-select="crownPike"]');click('[data-army-manage="crownPike"]');
 click('[data-army-action="hold"][data-type="crownPike"]');
 if(__game.match.alive('blue').filter(u=>u.variantId==='crownPike').some(u=>u.stance!=='hold'))throw new Error('Type order missed unit');
 click('[data-army-action="advance"][data-type="crownPike"]');click('[data-army-action="plan"][data-type="crownPike"]');
 if(__ui.state.abilityTargets.length!==2)throw new Error('Type ability plan missed unit');
 click('#sheet [data-act="close"]');
 const a=document.querySelector('#actions').getBoundingClientRect();
 if(a.right>innerWidth-50)throw new Error('Actions stayed at far right');
 const before=__game.renderStats.frames;await new Promise(r=>setTimeout(r,3000));const idle=(__game.renderStats.frames-before)/3;
 return {armyTypes:document.querySelectorAll('.army-type').length,typeTargets:__ui.state.abilityTargets.length,actions:{x:a.x,y:a.y,width:a.width},planningFPS:idle};
})()`;
const r=spawnSync(process.execPath,['tools/shot.mjs','docs/campaign/evidence/playtest-controls.png','2048','994','campaign=road&you=crown','10000'],{env:{...process.env,STEPS:JSON.stringify([['eval',expression]])},stdio:'inherit',timeout:90000});
process.exit(r.status??1);
