import {spawnSync} from 'node:child_process';
const expression=`(async()=>{
 const {FACTION_ART}=await import('/src/sprite-art.js');
 const {prepareFactions}=await import('/src/setup.js');
 const {createRecruitUnit}=await import('/src/roster.js');
 const {MONSTERS,createMonsterUnit}=await import('/src/monsters.js');
 prepareFactions(['crown','fang','league','court']);
 for(const u of [...__ui.units.list])__ui.units.removeUnit(u.data.id);
 let i=0;const created=[];
 for(const key of Object.keys(FACTION_ART)) {
  const id='art-'+i,c=2+(i%6),r=3+Math.floor(i/6)*3,side=i%2?'red':'blue';
  const u=MONSTERS[key]?createMonsterUnit(key,id,side,c,r):createRecruitUnit(key,id,side,c,r);
  created.push(__ui.units.addUnit(u));i++;
 }
 const end=Date.now()+20000;
 while(created.some(u=>!u.model)&&Date.now()<end)await new Promise(r=>setTimeout(r,200));
 for(const u of created)if(u.model?.spriteKey!==u.data.variantId)throw new Error('Wrong sprite '+u.data.variantId+': '+u.model?.spriteKey);
 return {loaded:created.length,keys:created.map(u=>u.model.spriteKey)};
})()`;
const r=spawnSync(process.execPath,['tools/shot.mjs','docs/campaign/evidence/assets-gallery.png','1280','800','campaign=pass&you=court','6000'],{env:{...process.env,STEPS:JSON.stringify([['eval',expression],['wait',1000]])},stdio:'inherit',timeout:90000});
process.exit(r.status??1);
