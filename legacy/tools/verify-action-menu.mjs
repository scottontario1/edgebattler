import {spawnSync} from 'node:child_process';
for(const [w,h] of [[1280,800],[960,480],[390,844]]){
 const expression=`(()=>{
  document.querySelector('[data-army-select="coil"]').click();
  document.querySelector('[data-army-manage="coil"]').click();
  document.querySelector('[data-army-action="plan"][data-type="coil"]').click();
  const sheet=document.querySelector('#sheet'),rail=document.querySelector('.army-rail'),a=sheet.getBoundingClientRect(),b=rail.getBoundingClientRect();
  if(sheet.hidden)throw Error('Menu did not open');
  if(innerWidth>820&&a.left<b.right)throw Error('Menu overlaps army rail');
  if(a.left<0||a.right>innerWidth+1)throw Error('Menu outside viewport');
  if(+getComputedStyle(sheet).zIndex<=+getComputedStyle(rail).zIndex)throw Error('Menu below rail');
  const option=sheet.querySelector('[data-ability]')||sheet.querySelector('button:not(.close)'),o=option.getBoundingClientRect();
  if(!option.contains(document.elementFromPoint(o.x+o.width/2,o.y+o.height/2)))throw Error('Ability covered');
  const close=sheet.querySelector('[data-act=close]'),rect=close.getBoundingClientRect();
  if(!close.contains(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)))throw Error('Close button covered');
  close.click();if(!sheet.hidden)throw Error('Close failed');
  document.querySelector('[data-army-action="plan"][data-type="coil"]').click();
  return {viewport:[innerWidth,innerHeight],sheet:[a.left,a.right],railRight:b.right,menuAccessible:true};
 })()`;
 const r=spawnSync(process.execPath,['tools/shot.mjs',`docs/campaign/evidence/action-menu-${w}.png`,String(w),String(h),'campaign=road&you=league','6000'],{env:{...process.env,PORT:process.env.PORT||'5173',STEPS:JSON.stringify([['eval',expression]])},stdio:'inherit',timeout:90000});
 if(r.status)process.exit(r.status);
}
