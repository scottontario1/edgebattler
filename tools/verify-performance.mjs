import {spawnSync} from 'node:child_process';
const expression=`(async()=>{
 const wait=ms=>new Promise(r=>setTimeout(r,ms)),stats=__game.renderStats;
 async function sample(){const f=stats.frames,c=stats.drawCalls;await wait(2200);return {frames:stats.frames-f,callsPerFrame:(stats.drawCalls-c)/Math.max(1,stats.frames-f)};}
 const on=await sample();window.dispatchEvent(new KeyboardEvent('keydown',{key:'p'}));const off=await sample();window.dispatchEvent(new KeyboardEvent('keydown',{key:'p'}));
 if(!(off.callsPerFrame<on.callsPerFrame))throw new Error('Painterly toggle did not remove draw work '+JSON.stringify({on,off}));
 const size=__game.renderer.getDrawingBufferSize(new __game.THREE.Vector2());
 if(size.x*size.y>1600000)throw new Error('Pixel budget exceeded');
 window.dispatchEvent(new KeyboardEvent('keydown',{key:'h'}));const fast=await sample();window.dispatchEvent(new KeyboardEvent('keydown',{key:'h'}));
 if(!(fast.callsPerFrame<off.callsPerFrame))throw new Error('HD toggle did not reduce work');
 return {on,off,fast,backingPixels:size.x*size.y,cssPixels:innerWidth*innerHeight,pixelRatio:stats.pixelRatio};
})()`;
const r=spawnSync(process.execPath,['tools/shot.mjs','docs/campaign/evidence/playtest-performance.png','2552','1238','campaign=road&you=crown','10000'],{env:{...process.env,STEPS:JSON.stringify([['eval',expression],['wait',500]])},stdio:'inherit',timeout:100000});
process.exit(r.status??1);
