// Run with Vite serving the game. Uses real HUD controls and the shared engine's actions.
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const dir='docs/design_overhaul/evidence';mkdirSync(dir,{recursive:true});
const e=code=>['eval',code],click=selector=>e(`(()=>{const b=document.querySelector('${selector}');if(!b||b.disabled)throw Error('Control unavailable: ${selector}');b.click()})()`);
function shot(name,w,h,steps) {
 const r=spawnSync(process.execPath,['tools/shot.mjs',dir+'/sys02-'+name+'.png',String(w),String(h),'red=passive&speed=40','3000'],{encoding:'utf8',timeout:60000,env:{...process.env,STEPS:JSON.stringify(steps)}});
 writeFileSync(dir+'/sys02-'+name+'.txt',(r.stdout+'\n'+r.stderr).trimEnd()+'\n');console.log(r.stdout);if(r.error)throw r.error;if(r.status)process.exit(r.status);
}
const setup=e(`window.__cyclingEvidence=[];const card=__ui.cardState.hand.find(c=>c.unitId==='pikeman');document.querySelector('[data-card-id="'+card.instanceId+'"]').click();`);
const benchSetup=[setup,click('[data-act=recruit]'),e(`const reserve=__ui.cardState.reserves[0];document.querySelector('[data-reserve-id="'+reserve.id+'"]').click();({supply:__ui.cardState.supply,population:__ui.match.population('blue'),cycles:__ui.cardState.cyclesRemaining})`)];
if(process.argv.includes('--mobile')) {
 for(const [name,w,h] of [['portrait',390,844],['short',900,420]])shot(name,w,h,[e(`if(__ui.state.trayCollapsed)__ui.commands.toggleTray()`),...benchSetup,e(`if(document.body.scrollWidth>innerWidth)throw Error('horizontal overflow');document.querySelector('.cycle-control').click();if(__ui.cardState.cyclesRemaining!==0||__ui.cardState.reserves.length!==0)throw Error('cycle failed');({supply:__ui.cardState.supply,hand:__ui.cardState.hand.length,cycles:__ui.cardState.cyclesRemaining})`)]);
} else shot('desktop',1280,800,[
 setup,click('[data-act=recruit]'),click('[data-upgrade-group]'),
 e(`const select=document.querySelector('[data-upgrade-survivor]');select.value=__ui.cardState.reserves[0].id;select.dispatchEvent(new Event('change',{bubbles:true}));const dest=document.querySelector('[data-upgrade-destination]');dest.value='reserve';dest.dispatchEvent(new Event('change',{bubbles:true}));`),click('[data-act=confirmUpgrade]'),
 e(`document.querySelector('[data-reserve-id]').click();__cyclingEvidence.push({stage:'paid-grade2-bench',reserve:structuredClone(__ui.cardState.reserves[0]),supply:__ui.cardState.supply,population:__ui.match.population('blue')})`),['shot',dir+'/sys02-bench-preview.png'],
 click('.cycle-control'),e(`const replacement=__ui.cardState.hand.find(c=>c.instanceId===__ui.state.selectedCardId);if(replacement.stars!==2||replacement.cost!==3||__ui.cardState.supply!==3||__ui.match.population('blue')!==3)throw Error('grade/refund mismatch');__cyclingEvidence.push({stage:'unpaid-grade2',replacement,supply:__ui.cardState.supply,population:__ui.match.population('blue')})`),['shot',dir+'/sys02-replacement.png'],
 click('[data-act=recruit]'),e(`const u=__ui.cardState.reserves[0];if(u.stars!==2||u.hp!==32||u.energy!==0||u.costPaid!==3||Object.keys(u.cooldowns).length)throw Error('repurchase not fresh');__cyclingEvidence.push({stage:'repurchased',reserve:structuredClone(u),supply:__ui.cardState.supply});__ui.commands.cancelCard();__ui.commands.resolve()`),['wait',10000],
 e(`if(__ui.state.busy||__ui.match.round!==2||__ui.cardState.cyclesRemaining!==1)throw Error('next round allowance missing');document.querySelector('[data-card-id]').click();document.querySelector('.cycle-control').click();if(__ui.cardState.cyclesRemaining!==0)throw Error('hand cycle failed');__cyclingEvidence.push({stage:'round2-cycle',hand:structuredClone(__ui.cardState.hand),supply:__ui.cardState.supply,cycles:__ui.cardState.cyclesRemaining});JSON.stringify(__cyclingEvidence)`)
]);
