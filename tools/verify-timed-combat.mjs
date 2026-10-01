import {spawnSync} from 'node:child_process';
const mobile=process.argv.includes('--mobile');
const expression=`(async()=>{
 const wait=ms=>new Promise(r=>setTimeout(r,ms)),m=__game.match;
 while(__ui.state.busy)await wait(100);
 // Durable combat fixture keeps both teams alive for all 18 seconds, exercising
 // real timer pacing rather than a fight that ends early by elimination.
 for(const u of m.alive()){u.hp=300;u.maxHp=300;}
 document.querySelector('[data-act=campaignOrder]').click();
 const startRound=m.round,startSupply=m.sides.blue.cards.supply,start=performance.now();
 document.querySelector('[data-act=resolve]').click();
 await wait(5200);
 if(!__ui.state.busy||!(__ui.state.combatElapsed>4&&__ui.state.combatElapsed<8))throw Error('Clock not progressing');
 if(document.querySelector('.combat-clock').hidden)throw Error('Clock hidden during battle');
 if(document.querySelector('#turn-no').textContent!==String(startRound))throw Error('Round advanced visually before combat ended');
 const clock=document.querySelector('.combat-clock').getBoundingClientRect();
 if(clock.left<0||clock.right>innerWidth)throw Error('Clock outside viewport');
 window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}));
 if(m.round!==startRound+1)throw Error('Double resolve leaked during combat');
 if(!document.querySelector('#planning').textContent.includes(String(startSupply)+'/30'))throw Error('Planning economy changed during playback');
 return {elapsed:__ui.state.combatElapsed,clockVisible:true,locked:true};
})()`;
const finish=`(async()=>{
 const wait=ms=>new Promise(r=>setTimeout(r,ms));while(__ui.state.busy)await wait(100);
 if(!document.querySelector('.combat-clock').hidden)throw Error('Clock stayed open');
 if(__ui.state.phase!=='player')throw Error('Planning did not resume');
 const batches=__game.log.entries.find(e=>e.t==='round').batches;
 const combat=batches.filter(b=>b.type==='combat');
 const skillTimes=[...new Set(batches.filter(b=>b.type==='abilities').map(b=>b.time))];
 if(!combat.some(b=>b.time>15)||!skillTimes.includes(15))throw Error('Late combat did not occur');
 const end=batches.find(b=>b.events.some(e=>e.type==='combatEnd'));
 if(end.time!==18)throw Error('Wrong combat duration');
 return {duration:end.time,skillTimes,strikes:combat.flatMap(b=>b.events).filter(e=>e.type==='strike').length,planningResumed:true};
})()`;
const r=spawnSync(process.execPath,['tools/shot.mjs',`docs/campaign/evidence/timed-combat-${mobile?'portrait':'planning'}.png`,mobile?'390':'1280',mobile?'844':'800','campaign=road&you=crown','5000'],{env:{...process.env,STEPS:JSON.stringify([['eval',expression],['shot',`docs/campaign/evidence/timed-combat-${mobile?'portrait-active':'active'}.png`],['eval',finish]])},stdio:'inherit',timeout:90000});
process.exit(r.status??1);
