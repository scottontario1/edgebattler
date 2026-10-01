import {spawnSync} from 'node:child_process';
const expression=`(async()=>{
 const m=__game.match,wait=ms=>new Promise(r=>setTimeout(r,ms));
 const card=m.sides.blue.cards.hand.find(c=>c.type==='unit'&&c.cost<=m.sides.blue.cards.supply);
 if(!card)throw new Error('No affordable unit');
 document.querySelector('[data-card-id="'+card.instanceId+'"]').click();
 __ui.commands.recruit();
 const reserve=m.sides.blue.cards.reserves.at(-1);
 const button=document.querySelector('[data-reserve-id="'+reserve.id+'"]');
 const art=button.querySelector('[data-sprite-key]')?.dataset.spriteKey;
 if(art!==card.unitId)throw new Error('Bench portrait mismatch '+art);
 button.click();
 const {toWorld,tileTop}=await import('/src/map.js');let tile;
 for(let r=0;r<18&&!tile;r++)for(let c=0;c<12;c++)if(m.canDeployAt('blue',reserve.id,c,r).ok){tile=[c,r];break;}
 const pos=toWorld(...tile),v=new __game.THREE.Vector3(pos.x,tileTop(...tile),pos.z).project(__game.camera);
 const canvas=__game.renderer.domElement,b=canvas.getBoundingClientRect(),x=b.left+(v.x+1)*b.width/2,y=b.top+(1-v.y)*b.height/2;
 canvas.dispatchEvent(new MouseEvent('click',{clientX:x,clientY:y,button:0,bubbles:true}));
 const u=m.alive('blue').find(u=>u.variantId===card.unitId&&u.c===tile[0]&&u.r===tile[1]);
 if(!u)throw new Error('Deployment failed '+__ui.state.notice);
 for(let i=0;i<80&&!__ui.units.byId.get(u.id)?.model;i++)await wait(200);
 if(__ui.units.byId.get(u.id).model.spriteKey!==card.unitId)throw new Error('Field sprite mismatch');
 return {card:card.unitId,bench:art,deployed:__ui.units.byId.get(u.id).model.spriteKey};
})()`;
const r=spawnSync(process.execPath,['tools/shot.mjs','docs/campaign/evidence/assets-recruit-portrait.png','390','844','campaign=road&you=crown','10000'],{env:{...process.env,STEPS:JSON.stringify([['eval',expression]])},stdio:'inherit',timeout:90000});
process.exit(r.status??1);
