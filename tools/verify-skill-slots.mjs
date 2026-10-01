import {spawnSync} from 'node:child_process';
const mobile=process.argv.includes('--mobile'),short=process.argv.includes('--short');
const expression=`(async()=>{
 const wait=ms=>new Promise(r=>setTimeout(r,ms));while(__ui.state.busy)await wait(100);
 const click=s=>{const n=document.querySelector(s);if(!n)throw Error('Missing '+s);n.click();};
 click('[data-army-select="crownPike"]');
 if(document.querySelector('.type-skills').hidden||document.querySelectorAll('.type-skills .skill-art').length<3||!document.querySelector('.type-unit-stats').textContent.includes('Damage dealt'))throw Error('Missing sidebar cards/stats');
 if(document.querySelectorAll('[data-skill-slot]').length!==3)throw Error('Missing 3 slots');
 const transfer=new DataTransfer();transfer.setData('text/plain','brace');
 const target=document.querySelector('[data-drop-slot="2"]');
 target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer}));
 target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
 if(__ui.state.abilityDraft.slots[2]!=='brace'||__ui.state.abilityDraft.slots[0]=== 'brace')throw Error('Drag did not move skill');

 for(const id of __ui.state.abilityTargets)if(__game.match.byId(id).skillSlots[2]!=='brace')throw Error('Group timeline save failed');
 click('[data-ability="rally"]');click('[data-skill-slot="0"]');
 if(__game.match.byId(__ui.state.selectedId).skillSlots[0]!=='rally')throw Error('Touch/keyboard select failed');
 const slots=[...__game.match.byId(__ui.state.selectedId).skillSlots];
 click('[data-skill-close]');click('[data-act=campaignOrder]');click('[data-act=resolve]');
 while(__ui.state.busy)await wait(100);
 await wait(1800);const {replay}=await import('/src/log.js');if(!replay(__game.log.entries).ok)throw Error('Timeline replay mismatch');
 click('[data-army-select="crownPike"]');
 const pane=document.querySelector('.type-skills').getBoundingClientRect(),card=document.querySelector('.type-skills .skill-slots').getBoundingClientRect();if(card.top<pane.top||card.bottom>pane.bottom)throw Error('Timeline cards clipped');
 if(innerWidth>820){const actions=document.querySelector('#actions').getBoundingClientRect();if(actions.left<pane.right&&actions.bottom>pane.top&&actions.top<pane.bottom)throw Error('Panel hides action menu');}
 return {savedSlots:slots,dragDrop:true,selectThenPlace:true,typeShared:true,unitStats:true,replay:true};
})()`;
const r=spawnSync(process.execPath,['tools/shot.mjs',`docs/campaign/evidence/skill-slots-${mobile?'portrait':short?'short':'desktop'}.png`,mobile?'390':short?'960':'1280',mobile?'844':short?'480':'800','skills=1&spells=1&campaign=road&you=crown&speed=40','5000'],{env:{...process.env,STEPS:JSON.stringify([['eval',expression]])},stdio:'inherit',timeout:90000});process.exit(r.status??1);
