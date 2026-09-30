// Run against npm run dev on port 5173. Windows Chrome is the default (as in shot.mjs).
// Optional: node tools/verify-campaign.mjs pass court 960 480
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const [level='road',faction='crown',width='1280',height='800']=process.argv.slice(2);
mkdirSync('docs/campaign/evidence',{recursive:true});
const expression=`(async()=>{
  const {kitFor,validateAbilitySelection}=await import('/src/abilities.js');
  const {replay}=await import('/src/log.js');
  const m=__game.match, wait=ms=>new Promise(r=>setTimeout(r,ms));
  let regroupSeen=0, waves=new Set();
  for(let i=0;i<80&&!m.over;i++) {
    while(__ui.state.busy)await wait(100);
    waves.add(m.campaign.stage+':'+m.campaign.wave);
    document.querySelector('[data-act=campaignOrder]').click();
    if(m.campaign.phase==='regroup') {
      const rally=document.querySelector('[data-act=campaignRally]');
      const go=document.querySelector('[data-act=campaignContinue]');
      if(!go.disabled) { regroupSeen++;rally.click();document.querySelector('[data-act=campaignContinue]').click(); }
    }
    for(const u of m.alive('blue')) {
      let ids=[];
      for(const a of kitFor(u).filter(a=>!['brace','setSpears','preparedShot','fieldWorks'].includes(a.id)))
        if(validateAbilitySelection(u,[...ids,a.id]).ok)ids.push(a.id);
      m.apply({type:'abilities',faction:'blue',unitId:u.id,abilityIds:ids},'human');
    }
    document.querySelector('[data-act=resolve]').click();
    while(__ui.state.busy)await wait(100);
  }
  if(m.winner!=='blue'||regroupSeen!==2)throw new Error('Campaign playthrough failed: '+JSON.stringify({winner:m.winner,round:m.round,regroupSeen}));
  const next=document.querySelector('.campaign-controls a')?.getAttribute('href');
  const check=replay(__game.log.entries);
  if(!check.ok)throw new Error('Browser replay mismatch: '+JSON.stringify(check.mismatches.slice(0,1)));
  return {level:m.campaign.id,faction:m.campaign.faction,winner:m.winner,round:m.round,regroupSeen,waves:[...waves],next,replay:check.ok};
})()`;
const result=spawnSync(process.execPath,['tools/shot.mjs',`docs/campaign/evidence/${faction}-${level}-victory.png`,width,height,`campaign=${level}&you=${faction}&speed=80`,'4500'],{
  env:{...process.env,STEPS:JSON.stringify([['eval',expression]])},stdio:'inherit',timeout:240000,
});
process.exit(result.status??1);
