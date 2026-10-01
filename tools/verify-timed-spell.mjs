import {spawnSync} from 'node:child_process';
const expression=`(async()=>{
 const wait=ms=>new Promise(r=>setTimeout(r,ms)),m=__game.match;
 while(__ui.state.busy)await wait(100);
 for(const u of m.alive()){u.hp=300;u.maxHp=300;}
 const target=m.alive('red')[0],sprite=__game.units.byId.get(target.id);target.hp=1;
 m.sides.blue.cards.hand.push({id:'spell-fireburst',type:'spell',name:'Fireburst',cost:2,instanceId:'timed-spell-fixture'});
 const result=m.apply({type:'spell',faction:'blue',cardId:'timed-spell-fixture',c:target.c,r:target.r});if(!result.ok)throw Error('Fixture queue failed');
 document.querySelector('[data-act=campaignOrder]').click();document.querySelector('[data-act=resolve]').click();
 await wait(1800);
 if(sprite.group.visible!==false)throw Error('Spell victim stayed visible');
 if(!__ui.state.busy)throw Error('Fixture ended before death could be checked');
 return {spellDeathAnimated:true,combatStillRunning:true};
})()`;
const r=spawnSync(process.execPath,['tools/shot.mjs','docs/campaign/evidence/timed-spell-death.png','1280','800','skills=1&spells=1&campaign=road&you=crown','5000'],{env:{...process.env,STEPS:JSON.stringify([['eval',expression]])},stdio:'inherit',timeout:90000});process.exit(r.status??1);
