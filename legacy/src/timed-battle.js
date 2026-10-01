// Fixed simulation time; rendering, playback speed and browser frame rate never affect dice.
import {resolveBattleRound} from './battle.js';
import {facingFromPath} from './abilities.js';
export const TIMED_COMBAT_DEFAULTS = Object.freeze({duration:18,skillMode:'slots',timelineScope:'type',tick:0.25,skillTimes:[3,9,15],damageScale:0.35,moveInterval:0.8,attackBase:2.8,speedFactor:0.12,acceleration:0});
const classDelay={pikeman:0.1,archer:0,cavalier:-0.15,berserker:0.3,knight:0.3};
export function attackInterval(u,config=TIMED_COMBAT_DEFAULTS) {
  const interval=Number.isFinite(u.attackInterval)?u.attackInterval:(config.attackBase??2.8)-(config.speedFactor??0.12)*((u.spd??4)-4)+(classDelay[u.cls]||0);
  return Math.max(1.2,Math.min(3.5,interval));
}
export function timedCombatConfig(options={}) {
  const config={...TIMED_COMBAT_DEFAULTS,...options};
  if(!Number.isFinite(config.duration)||config.duration<1||config.duration>60)throw new Error('Invalid combat duration');
  if(config.tick!==0.25)throw new Error('Timed combat uses a fixed 0.25s simulation tick');
  config.skillTimes=[...config.skillTimes].filter(t=>Number.isFinite(t)&&t>=0&&t<config.duration).sort((a,b)=>a-b);
  config.skillTimes=[...new Set(config.skillTimes)];
  return config;
}
export function resolveTimedBattle({units,orders={},seed=1,forecastAttack,legalMoves,pathForMove,skillWindow=null,passives=null,config:options={}}={}) {
  const config=timedCombatConfig(options),batches=[];
  let current=structuredClone(units);
  const nextAttack=new Map(),nextMove=new Map(),movedHistory=new Map();
  const interval=u=>attackInterval(u,config);
  for(const u of current){nextAttack.set(u.id,0.75);nextMove.set(u.id,0);}
  let duration=config.duration;
  const contestedAtStart=['blue','red'].every(f=>current.some(u=>u.hp>0&&u.kind!=='object'&&u.faction===f));
  let lastMovement=0;
  const keep=batch=>{if(batch.events.length)batches.push(batch);};
  for(let step=0;step<=Math.floor(config.duration/config.tick);step++) {
    const time=Number((step*config.tick).toFixed(3));
    if(time>=config.duration)break;
    if(contestedAtStart&&!['blue','red'].every(f=>current.some(u=>u.hp>0&&u.kind!=='object'&&u.faction===f))){duration=time;break;}
    if(config.skillTimes.includes(time)) {
      const skill=skillWindow?.(current,[...movedHistory.values()],time);
      if(skill){current=skill.units;keep({type:'abilities',time,events:skill.events});}
      keep({type:'timeline',time,events:[{type:'skillWindow',time}]});
    }
    const activeOrders=typeof orders==='function'?orders(current):orders;
    const due=new Set(current.filter(u=>u.hp>0&&time+1e-6>=nextAttack.get(u.id)).map(u=>u.id));
    // Temporary passive contributions are rebuilt from the current snapshot every tick.
    const persistent=new Map(current.map(u=>[u.id,{...(u.statuses||{})}]));
    let fx=new Map();
    const result=resolveBattleRound({units:current,orders:activeOrders,seed:(seed+Math.imul(step+1,2654435761))>>>0,forecastAttack,
      legalMoves:(u,shared)=>{
        if(time+1e-6<(nextMove.get(u.id)??0))return [];
        return legalMoves?legalMoves(u,shared):[{c:u.c+1,r:u.r},{c:u.c-1,r:u.r},{c:u.c,r:u.r+1},{c:u.c,r:u.r-1}];
      },pathForMove,canAttack:u=>due.has(u.id),preserveStatuses:true,damageScale:config.damageScale,
      beforeCombat:(records,events)=>{
        for(const e of events)if(e.type==='move'){const prior=movedHistory.get(e.unitId);movedHistory.set(e.unitId,{...e,from:prior?.from||e.from,path:[...(prior?.path||[]),...(e.path||[[e.to.c,e.to.r]])]});const u=records.find(u=>u.id===e.unitId);u.facing=facingFromPath([[e.from.c,e.from.r],...(e.path||[[e.to.c,e.to.r]])],u.facing);}
        fx=passives?.(records,new Set(movedHistory.keys()))||new Map();
        for(const u of records){u.statuses={...(u.statuses||{})};for(const [k,v] of Object.entries(fx.get(u.id)||{}))u.statuses[k]=(u.statuses[k]||0)+v;}
        return records;
      }});
    const moves=result.batches[0].events.filter(e=>e.type==='move');
    const combat=result.batches[1].events;
    if(moves.length)lastMovement=time;
    if(!contestedAtStart&&time-lastMovement>=2){duration=time;break;}
    for(const e of moves)nextMove.set(e.unitId,time+config.moveInterval);
    const struck=new Set(combat.filter(e=>e.type==='strike').map(e=>e.attackerId));
    // Readiness stays armed while out of range; no lost attack just because a target is absent.
    for(const u of result.units)if(struck.has(u.id))nextAttack.set(u.id,time+interval(u)*Math.max(0.7,1-config.acceleration*time/config.duration));
    current=result.units.map(u=>{
      const statuses={...(u.statuses||{})},base=persistent.get(u.id)||{};
      for(const k of Object.keys(fx.get(u.id)||{})){if(base[k]!==undefined)statuses[k]=base[k];else delete statuses[k];}
      if(struck.has(u.id)){delete statuses.attackBonus;delete statuses.hitBonus;}
      const gain=fx.get(u.id)?.energyWhenStruck||0;
      if(gain&&combat.some(e=>e.type==='strike'&&e.targetId===u.id&&e.damage>0))u.energy=Math.min(u.maxEnergy,(u.energy||0)+gain);
      return {...u,statuses};
    });
    keep({type:'movement',time,events:moves});keep({type:'combat',time,events:combat});
  }
  // A complete timeline has a terminal clock event, including early elimination.
  batches.push({type:'timeline',time:duration,events:[{type:'combatEnd',duration}]});
  const transient=['brace','attackBonus','hitBonus','setSpears','equipStr','equipDef','damageTaken','damageDealt','ignoreDefense','offTargetPenalty','energyWhenStruck','barrier','ward','thorns'];
  for(const u of current){u.statuses={...(u.statuses||{})};for(const k of transient)delete u.statuses[k];}
  return {units:current,batches,duration};
}
