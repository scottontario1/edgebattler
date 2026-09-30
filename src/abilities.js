// Pure planning selections and fixed-phase combat abilities shared by browser and simulator.
export const ABILITY_RULES = Object.freeze({maxEnergy:4, fieldGain:1, reserveExtra:1, advanceFraction:2/3, flankDamage:4});
export const ABILITIES = Object.freeze({
 rally:{id:'rally',name:'Rally',classes:['pikeman'],cost:0,cooldown:2,phase:'recovery',description:'Heal 10 HP; gain 1 energy now and next round, when useful.'},
 brace:{id:'brace',name:'Brace',classes:['pikeman'],cost:2,cooldown:2,phase:'defense',description:'Hold this battle. Absorb 4 total damage; paid even without incoming attacks.'},
 focusedShot:{id:'focusedShot',name:'Focused Shot',classes:['archer'],cost:2,cooldown:2,phase:'enhancement',description:'A legal ranged strike gains +4 damage and +20 hit.'},
 charge:{id:'charge',name:'Charge',classes:['cavalier'],cost:2,cooldown:2,phase:'enhancement',description:'Requires Advance, automatic movement and a melee target. Strike gains +4 damage.'},
 secondWind:{id:'secondWind',name:'Second Wind',classes:['cavalier'],cost:1,cooldown:3,phase:'recovery',description:'Heal 6 HP when at or below half HP, including outside combat.'},
});
// Working set the rules read. It starts as the approved ABILITIES; experiments (experiments/candidates) register
// extra abilities here and remove them again. The game itself never registers anything.
export const ABILITY_CATALOG = {...ABILITIES};
export const registerAbilities = defs => { for(const d of defs) ABILITY_CATALOG[d.id]=d; };
export const unregisterAbilities = ids => { for(const id of ids) delete ABILITY_CATALOG[id]; };
export const resetAbilities = () => { for(const id of Object.keys(ABILITY_CATALOG)) if(!ABILITIES[id]) delete ABILITY_CATALOG[id]; };
export const DEFAULT_ABILITY_STATE = Object.freeze({energy:0,maxEnergy:4,cooldowns:{},selectedAbilities:[],stance:'advance',objective:null,energyGainNextTurn:0,statuses:{}});
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
// An ability applies to a class (`classes`) and/or to named units such as champions (`units`: ['dreg']).
// A culture ability (`culture` set) that targets shipped classes only applies to that culture's own units, so the League's Set
// Position never reaches a plain Pikeman or another culture's Pikeman. Named `units` (champions) always apply.
export const abilityApplies = (a,unit) => Boolean(a.units?.includes(unit.id)||(a.classes?.includes(unit.cls)&&(!a.culture||unit.culture===a.culture)));
export const kitFor = unit => Object.values(ABILITY_CATALOG).filter(a=>abilityApplies(a,unit));
export const selectedCost = unit => (unit.selectedAbilities||[]).reduce((n,id)=>n+(ABILITY_CATALOG[id]?.cost||0),0);
export const battleMovement = unit => unit.stance==='hold'?0:unit.stance==='advance'?Math.max(1,Math.round(unit.mov*ABILITY_RULES.advanceFraction)):unit.mov;
export const FACING = Object.freeze({north:[0,-1],east:[1,0],south:[0,1],west:[-1,0]});
export function facingFromPath(path,fallback='north') {
 if(path.length<2) return fallback;
 const a=path.at(-2),b=path.at(-1),dc=b[0]-a[0],dr=b[1]-a[1];
 return Object.keys(FACING).find(k=>FACING[k][0]===Math.sign(dc)&&FACING[k][1]===Math.sign(dr))||fallback;
}
export function flankSide(attacker,target) {
 const dc=attacker.c-target.c,dr=attacker.r-target.r;
 if(Math.abs(dc)+Math.abs(dr)!==1) return null;
 const [fc,fr]=FACING[target.facing]||FACING[target.faction==='red'?'south':'north'];
 const dot=dc*fc+dr*fr;
 return dot>0?'front':dot<0?'back':'side';
}
export function initializeAbilityState(unit,options={}) {
 const maxEnergy=options.maxEnergy??unit.maxEnergy??4;
 return {...unit,energy:clamp(options.energy??unit.energy??0,0,maxEnergy),maxEnergy,
 cooldowns:{...(unit.cooldowns||{}),...(options.cooldowns||{})},
 selectedAbilities:[...new Set(options.selectedAbilities??unit.selectedAbilities??[])],
 stance:options.stance??unit.stance??'advance',objective:options.objective??unit.objective??null,
 facing:options.facing??unit.facing??(unit.faction==='red'?'south':'north'),
 energyGainNextTurn:options.energyGainNextTurn??unit.energyGainNextTurn??0,
 statuses:{...(unit.statuses||{}),...(options.statuses||{})}};
}
export function advanceAbilityRound(unit,extra=0) {
 const next=initializeAbilityState(unit);
 next.cooldowns=Object.fromEntries(Object.entries(next.cooldowns).map(([id,n])=>[id,Math.max(0,n-1)]));
 next.energy=clamp(next.energy+1+extra+next.energyGainNextTurn,0,next.maxEnergy);
 next.energyGainNextTurn=0;
 return next;
}
// Validate the entire edit before mutating any group member. Cooldown does not prevent selecting.
export function validateAbilitySelection(unit,ids) {
 if(!Array.isArray(ids)||ids.some(id=>!(ABILITY_CATALOG[id]&&abilityApplies(ABILITY_CATALOG[id],unit)))) return {ok:false,reason:'invalid-ability'};
 if(ids.includes('charge')&&unit.stance!=='advance') return {ok:false,reason:'charge-requires-advance'};
 const cost=selectedCost({selectedAbilities:[...new Set(ids)]});
 return cost>unit.energy?{ok:false,reason:'insufficient-energy',cost,shortfall:cost-unit.energy}:{ok:true,cost};
}
// Bundle eligibility is frozen before recovery: Rally cannot rescue an unaffordable paid bundle.
export const paidBundleReady = unit => unit.energy>=selectedCost(unit);
export function activatePhase(unit,phase,{paid=true,moved=false,hasTarget=false,movedTiles=0,onControlled=false,objectCount=null}={}) {
 const next=initializeAbilityState(unit),events=[];
 for(const a of kitFor(next).filter(a=>a.phase===phase&&(next.selectedAbilities||[]).includes(a.id))) {
  let reason=null;
  if(a.cost&&!paid) reason='insufficient-energy';
  else if(next.cooldowns[a.id]>0) reason='cooldown';
  else if(a.id==='charge'&&(next.stance!=='advance'||!moved||!hasTarget)) reason='charge-trigger-unmet';
  else if(a.id==='focusedShot'&&!hasTarget) reason='no-legal-target';
  else if(a.id==='secondWind'&&next.hp>next.maxHp/2) reason='above-half-hp';
  else if(a.id==='rally'&&next.hp>=next.maxHp&&next.energy>=next.maxEnergy&&next.energy+1+next.energyGainNextTurn>=next.maxEnergy) reason='not-useful';
  // Candidate abilities (data only): triggers in `requires`, numeric statuses in `effect` (functions get {movedTiles}).
  else if(a.requires?.stance&&next.stance!==a.requires.stance) reason='stance-trigger-unmet';
  else if(a.requires?.moved&&!(movedTiles>=a.requires.moved)) reason='movement-trigger-unmet';
  else if(a.requires?.target&&!hasTarget) reason='no-legal-target';
  // Culture hooks (inert unless a registered ability sets them): HP fraction bounds and standing on an owned keep/village.
  else if(a.requires?.hpBelow!==undefined&&!(next.hp<next.maxHp*a.requires.hpBelow)) reason='hp-trigger-unmet';
  else if(a.requires?.hpAbove!==undefined&&!(next.hp>next.maxHp*a.requires.hpAbove)) reason='hp-trigger-unmet';
  else if(a.requires?.onControlled&&!onControlled) reason='location-trigger-unmet';
  // Tile objects (corpses...) within `radius` of the unit; objectCount(kind, radius) is supplied by the match.
  else if(a.requires?.objectNear&&(objectCount?objectCount(a.requires.objectNear.kind,a.requires.objectNear.radius):0)<(a.requires.objectNear.min??1)) reason='object-trigger-unmet';
  if(reason) {events.push({unitId:next.id,abilityId:a.id,name:a.name,applied:false,reason});continue;}
  next.energy-=a.cost;next.cooldowns[a.id]=a.cooldown;
  let effect={type:'status'},energyCapped=0;
  if(a.id==='rally'||a.id==='secondWind') {
   const before=next.hp;next.hp=Math.min(next.maxHp,next.hp+(a.id==='rally'?10:6));
   effect={type:'heal',amount:next.hp-before,targetId:next.id};
   if(a.id==='rally'){energyCapped=Math.max(0,next.energy+1-next.maxEnergy);next.energy=Math.min(next.maxEnergy,next.energy+1);next.energyGainNextTurn+=1;}
  } else if(a.id==='brace') next.statuses.brace=4;
  else if(a.effect) {
   for(const [k,v] of Object.entries(a.effect)) {const n=typeof v==='function'?v({movedTiles}):v;next.statuses[k]=(next.statuses[k]||0)+n;}
  }
  else if(a.spawn||a.consume) {/* effect handled by the match (tile objects) */}
  else {next.statuses.attackBonus=4;if(a.id==='focusedShot') next.statuses.hitBonus=20;}
  events.push({unitId:next.id,abilityId:a.id,name:a.name,applied:true,cost:a.cost,energyCapped,effect,cooldown:a.cooldown,...(a.spawn?{spawn:a.spawn}:{}),...(a.mark?{mark:a.mark}:{}),...(a.consume?{consume:a.consume}:{})});
 }
 return {unit:next,events};
}

export const SPELLS = Object.freeze({
  mend: Object.freeze({ id: 'mend', name: 'Mend', type: 'spell', cost: 1, target: 'friendly-unit', duration: 'instant', effect: Object.freeze({ type: 'heal', amount: 8 }) }),
  ward: Object.freeze({ id: 'ward', name: 'Ward', type: 'spell', cost: 1, target: 'friendly-unit', duration: 'upcoming-battle', effect: Object.freeze({ type: 'status', status: 'ward', duration: 'upcoming-battle' }) }),
  fireburst: Object.freeze({ id: 'fireburst', name: 'Fireburst', type: 'spell', cost: 2, target: 'enemy-area', duration: 'instant', radius: 1, effect: Object.freeze({ type: 'damage', amount: 6 }) }),
});

// Working spell set. Cultures (src/cultures.js) register extra spells here and remove them again; the game itself never does.
export const SPELL_CATALOG = {...SPELLS};
export const registerSpells = defs => { for(const d of defs) SPELL_CATALOG[d.id]=d; };
export const unregisterSpells = ids => { for(const id of ids) delete SPELL_CATALOG[id]; };
export const resetSpells = () => { for(const id of Object.keys(SPELL_CATALOG)) if(!SPELLS[id]) delete SPELL_CATALOG[id]; };

function spellTargetValid(spell, target) {
  if (!target) return false;
  if (spell.target === 'friendly-unit') return target.kind === 'unit' && target.faction === 'friendly' && Boolean(target.unitId);
  if (spell.target === 'enemy-area') return target.kind === 'area' && Number.isFinite(target.x) && Number.isFinite(target.y);
  return false;
}

/** Queueing reserves Supply immediately; cancelling refunds it. Resolution never charges again. */
export function queueSpell(state, spellId, target, options = {}) {
  const spell = (options.spells || SPELL_CATALOG)[spellId];
  if (!spell || spell.type !== 'spell') return { ok: false, reason: 'unknown-spell', state };
  if (!spellTargetValid(spell, target)) return { ok: false, reason: 'invalid-target', state };
  const supply = Number(state.supply) || 0;
  if (supply < spell.cost) return { ok: false, reason: 'unaffordable', state };
  const queuedSpells = [...(state.queuedSpells || [])];
  const queueId = options.queueId || `spell-${queuedSpells.length + 1}`;
  queuedSpells.push({ queueId, spellId, target: { ...target }, payment: spell.cost, committed: true });
  return { ok: true, state: { ...state, supply: supply - spell.cost, queuedSpells }, queued: queuedSpells.at(-1) };
}

export function cancelSpell(state, queueId) {
  const queuedSpells = [...(state.queuedSpells || [])];
  const index = queuedSpells.findIndex((cast) => cast.queueId === queueId);
  if (index < 0) return { ok: false, reason: 'not-queued', state };
  const [cast] = queuedSpells.splice(index, 1);
  return { ok: true, state: { ...state, supply: (Number(state.supply) || 0) + (cast.payment || 0), queuedSpells } };
}

export function retargetSpell(state, queueId, target, options = {}) {
  const queue = state.queuedSpells || [];
  const cast = queue.find((item) => item.queueId === queueId);
  const spell = cast && (options.spells || SPELL_CATALOG)[cast.spellId];
  if (!cast) return { ok: false, reason: 'not-queued', state };
  if (!spellTargetValid(spell, target)) return { ok: false, reason: 'invalid-target', state };
  return { ok: true, state: { ...state, queuedSpells: queue.map((item) => item.queueId === queueId ? { ...item, target: { ...target } } : item) } };
}

function resolveSpellEffect(spell, cast, units, options) {
  const target = cast.target;
  if (spell.target === 'friendly-unit') {
    const unit = units.find((item) => item.id === target.unitId && item.faction === (options.friendlyFaction || 'blue') && item.hp > 0);
    if (!unit) return { queueId: cast.queueId, spellId: cast.spellId, applied: false, reason: 'target-unavailable' };
    if (spell.effect.type === 'heal') {
      const before = unit.hp;
      unit.hp = Math.min(unit.maxHp ?? unit.hp, unit.hp + spell.effect.amount);
      return { queueId: cast.queueId, spellId: cast.spellId, applied: true, targetId: unit.id, amount: unit.hp - before };
    }
    unit.statuses = { ...(unit.statuses || {}), [spell.effect.status]: spell.effect.duration };
    return { queueId: cast.queueId, spellId: cast.spellId, applied: true, targetId: unit.id, status: spell.effect.status, duration: spell.effect.duration };
  }
  const affected = units.filter((unit) => unit.faction !== (options.friendlyFaction || 'blue') && unit.hp > 0 && Math.abs(unit.c - target.x) + Math.abs(unit.r - target.y) <= (spell.radius || 0));
  const events = affected.map((unit) => {
    const amount = Math.min(unit.hp, spell.effect.amount);
    unit.hp -= amount;
    return { targetId: unit.id, amount };
  });
  return { queueId: cast.queueId, spellId: cast.spellId, applied: true, events };
}

/** Resolve the locked battle-start queue against a copied unit list and clear it exactly once. */
export function resolveQueuedSpells(state, units, options = {}) {
  const nextUnits = units.map((unit) => ({ ...unit, statuses: { ...(unit.statuses || {}) } }));
  const events = (state.queuedSpells || []).map((cast) => {
    const spell = (options.spells || SPELL_CATALOG)[cast.spellId];
    if (!spell || !cast.committed) return { queueId: cast.queueId, spellId: cast.spellId, applied: false, reason: 'invalid-queue-entry' };
    return resolveSpellEffect(spell, cast, nextUnits, options);
  });
  return { state: { ...state, queuedSpells: [] }, units: nextUnits, events };
}

// Skill cards are persistent, transferable type-wide equipment and never enter the spell queue.
export function equipTypeSkill(loadouts, unitType, skill, options = {}) {
  if (!unitType || !skill?.id) return { ok: false, reason: 'invalid-skill', loadouts };
  const current = loadouts[unitType] || [];
  const slots = options.slots ?? 2;
  if (!current.some((item) => item.id === skill.id) && current.length >= slots) return { ok: false, reason: 'no-free-slot', loadouts };
  return { ok: true, loadouts: { ...loadouts, [unitType]: [...current.filter((item) => item.id !== skill.id), { ...skill }] } };
}

export function transferTypeSkill(loadouts, fromType, toType, skillId, options = {}) {
  const skill = (loadouts[fromType] || []).find((item) => item.id === skillId);
  if (!skill) return { ok: false, reason: 'skill-not-equipped', loadouts };
  const without = (loadouts[fromType] || []).filter((item) => item.id !== skillId);
  const removed = { ...loadouts, [fromType]: without };
  const placed = equipTypeSkill(removed, toType, skill, options);
  return placed.ok ? placed : { ok: false, reason: placed.reason, loadouts };
}

export function skillsForUnitType(loadouts, unitType) {
  return [...(loadouts[unitType] || [])].map((skill) => ({ ...skill }));
}
