// Targeted browser evidence using the existing CDP screenshot tool. Start Vite first.
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const dir='docs/design_overhaul/evidence';mkdirSync(dir,{recursive:true});
const e=code=>['eval',code],click=selector=>e(`document.querySelector('${selector}').click()`);
const steps=[
 e(`window.__abilityEvidence=[];window.__battleEvidence=[];const resolve=__ui.match.resolveRound.bind(__ui.match);__ui.match.resolveRound=()=>{const result=resolve();__battleEvidence.push(result.batches);return result;};__ui.state.selectedId='pike_b1';__ui.commands.inspect();`),
 click('[data-ability=rally]'),click('.plan-group summary'),['wait',100],click('[data-plan-class]'),click('[data-plan-apply]'),
 e(`__abilityEvidence.push({stage:'selected-group',pikes:__ui.match.alive('blue').filter(u=>u.cls==='pikeman').map(u=>({id:u.id,picks:u.selectedAbilities,energy:u.energy}))});if(!__ui.match.alive('blue').filter(u=>u.cls==='pikeman').every(u=>u.selectedAbilities.includes('rally')&&u.energy===1))throw Error('group selection failed');__ui.commands.close();__ui.commands.resolve();`),['wait',10000],
 e(`__abilityEvidence.push({stage:'round2',round:__ui.match.round,busy:__ui.state.busy,pike:structuredClone(__ui.match.byId('pike_b1'))});if(__ui.match.round!==2||__ui.state.busy)throw Error('round2 playback incomplete');__ui.state.selectedId='pike_b1';__ui.commands.inspect();`),
 click('[data-ability=brace]'),click('[data-plan-class]'),click('[data-plan-apply]'),click('[data-facing=east]'),['shot',dir+'/sys01-desktop.png'],
 e(`__ui.commands.close();__ui.commands.resolve()`),['wait',10000],
 e(`__abilityEvidence.push({stage:'round3',round:__ui.match.round,busy:__ui.state.busy,pike:structuredClone(__ui.match.byId('pike_b1'))});if(!__battleEvidence[1].flatMap(b=>b.events).some(e=>e.abilityId==='brace'&&e.applied))throw Error('Brace not cast');__ui.state.selectedId='archer_b1';__ui.commands.inspect();`),
 click('[data-ability=focusedShot]'),click('[data-plan-apply]'),['shot',dir+'/sys01-archer.png'],
 e(`__ui.commands.close();__ui.state.selectedId='cav_b1';__ui.commands.inspect();`),click('[data-ability=charge]'),click('[data-plan-apply]'),['shot',dir+'/sys01-cavalier.png'],
 e(`__ui.commands.close();__ui.commands.resolve()`),['wait',10000],
 e(`__abilityEvidence.push({stage:'round4',round:__ui.match.round,busy:__ui.state.busy,pike:structuredClone(__ui.match.byId('pike_b1')),archer:structuredClone(__ui.match.byId('archer_b1')),cavalier:structuredClone(__ui.match.byId('cav_b1')),abilities:__battleEvidence.map(bs=>bs.filter(b=>b.type==='abilities').flatMap(b=>b.events))});if(__ui.match.round!==4||__ui.state.busy)throw Error('round4 incomplete');__ui.state.selectedId='pike_b1';__ui.commands.inspect();JSON.stringify(__abilityEvidence)`)
];
function capture(name,w,h,steps,query='red=passive&speed=40') {
 const r=spawnSync(process.execPath,['tools/shot.mjs',dir+'/sys01-'+name+'.png',String(w),String(h),query,'3000'],{env:{...process.env,STEPS:JSON.stringify(steps)},encoding:'utf8',timeout:60000});
 writeFileSync(dir+'/sys01-'+name+'.txt',r.stdout+'\n'+r.stderr);console.log(r.stdout);if(r.error)throw r.error;if(r.status)process.exit(r.status);
}
if(process.argv.includes('--combat')) {
 capture('combat',1280,800,[
 e(`// Controlled presentation fixture; not a normal seeded replay log.
  for(const u of __ui.match.alive()) __ui.match.apply({type:'stance',faction:u.faction,unitId:u.id,stance:'hold'});
  for(const [id,c,r] of [['archer_b1',3,8],['pike_r1',5,8],['cav_r1',4,8],['cav_b1',10,6],['archer_r1',12,6]])__ui.units.setPosition(id,c,r);
  __ui.match.byId('archer_b1').energy=2;
  __ui.match.byId('cav_b1').energy=3;__ui.match.byId('cav_b1').hp=12;
  __ui.match.apply({type:'stance',faction:'blue',unitId:'cav_b1',stance:'advance'});
  const resolve=__ui.match.resolveRound.bind(__ui.match);__ui.match.resolveRound=()=>{const result=resolve();window.__fixtureEvidence=result;return result;};
  __ui.state.selectedId='archer_b1';__ui.commands.inspect();`),
 click('[data-ability=focusedShot]'),click('[data-plan-apply]'),e(`__ui.commands.close();__ui.state.selectedId='cav_b1';__ui.commands.inspect()`),
 click('[data-ability=charge]'),click('[data-ability=secondWind]'),click('[data-plan-apply]'),['shot',dir+'/sys01-combat-plan.png'],
 e(`__ui.commands.close();__ui.commands.resolve()`),['wait',10000],
 e(`const ev=__fixtureEvidence.batches.flatMap(b=>b.events);for(const id of ['focusedShot','charge','secondWind'])if(!ev.some(e=>e.abilityId===id&&e.applied))throw Error(id+' did not execute');if(!ev.some(e=>e.attackerId==='archer_b1'&&e.targetId==='pike_r1'))throw Error('archer targeting wrong');if(!ev.some(e=>e.attackerId==='cav_b1'&&e.flankBonus===4&&e.attackBonus===4))throw Error('Charge flank missing');__ui.state.selectedId='cav_b1';__ui.commands.inspect();JSON.stringify({fixture:true,events:ev,cavalier:__ui.match.byId('cav_b1')})`)
 ]);
} else if(process.argv.includes('--mobile')) {
 for(const [name,w,h] of [['portrait',390,844],['short',900,420]]) capture(name,w,h,[
  e(`__ui.state.selectedId='cav_b1';__ui.commands.inspect();document.querySelector('[data-ability=charge]').click();if(!document.querySelector('[data-plan-apply]').disabled)throw Error('overspend allowed');if(document.body.scrollWidth>innerWidth)throw Error('horizontal overflow');({cost:document.querySelector('.plan-summary').textContent,disabled:document.querySelector('[data-plan-apply]').disabled,bodyWidth:document.body.scrollWidth,screenWidth:innerWidth,sheetWidth:document.querySelector('#sheet').getBoundingClientRect().width})`)
 ]);
} else capture('round4',1280,800,steps);
