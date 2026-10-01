import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN_LEVELS, createCampaignMatch } from '../src/campaign.js';
import { FACTIONS } from '../src/setup.js';
import { memoryLog, replay } from '../src/log.js';
import { kitFor, validateAbilitySelection } from '../src/abilities.js';
import { terrainAt, W, H } from '../src/board.js';

// A reproducible basic playtest plan: march as a group, use legal non-Hold kits,
// rally at each cleared village, and explicitly open the next encounter.
export function planCampaign(m) {
  m.apply({type:'campaignOrder',faction:'blue'});
  if(m.campaign.phase==='regroup') {
    m.apply({type:'campaignRally',faction:'blue'});
    m.apply({type:'campaignContinue',faction:'blue'});
    m.apply({type:'campaignOrder',faction:'blue'});
  }
  for(const u of m.alive('blue')) {
    const ids=[];
    for(const a of kitFor(u).filter(a => a.forceStance !== 'hold' && !['brace','setSpears','preparedShot','fieldWorks'].includes(a.id))) {
      if(validateAbilitySelection(u,[...ids,a.id]).ok) ids.push(a.id);
    }
    m.apply({type:'abilities',faction:'blue',unitId:u.id,abilityIds:ids});
  }
}

test('campaign maps and player factions: legal south starts, fixed enemy, faction draws', () => {
  for(const level of CAMPAIGN_LEVELS) for(const f of FACTIONS) {
    const m=createCampaignMatch(level,{faction:f.id,seed:7});
    assert.equal(W,12); assert.equal(H,18);
    assert.equal(terrainAt(5,16),'C'); assert.equal(terrainAt(5,1),'K');
    assert.ok(m.alive('blue').every(u=>u.r>=15));
    assert.ok(m.alive('red').every(u=>u.r<=12));
    assert.equal(m.sides.red.cards.hand.length,0);
    assert.equal(m.apply({type:'recruit',faction:'red',cardId:'no'}).reason,'fixed-encounter-enemy');
    assert.equal(m.champion('blue'),m.alive('blue').find(u=>u.id===m.champion('blue')).id);
    const occupants=m.alive().map(u=>`${u.c},${u.r}`);
    assert.equal(new Set(occupants).size,occupants.length);
  }
});

test('clearing patrol pauses instead of winning; rally and continue require checkpoint, one recovery only', () => {
  const m=createCampaignMatch(CAMPAIGN_LEVELS[0]);
  for(const u of m.alive('red')) u.hp=0;
  for(const u of m.alive('blue')) { u.stance='hold'; u.objective=null; }
  m.resolveRound();
  assert.equal(m.over,false); assert.equal(m.campaign.phase,'regroup');
  assert.equal(m.apply({type:'campaignContinue',faction:'blue'}).reason,'reach-rally-point');
  const u=m.alive('blue')[0]; u.c=5;u.r=11;u.hp=10;
  assert.ok(m.apply({type:'campaignRally',faction:'blue'}).ok);
  assert.equal(u.hp,14);
  assert.equal(m.apply({type:'campaignRally',faction:'blue'}).reason,'rally-unavailable');
  assert.ok(m.apply({type:'campaignContinue',faction:'blue'}).ok);
  assert.equal(m.campaign.stage,1); assert.equal(m.campaign.phase,'engage');
  assert.ok(m.alive('red').length>0);
  assert.equal(m.sides.red.cards.hand.length,0);
});

test('waves spawn safely when authored tile is occupied and final exit cannot skip encounters', () => {
  const m=createCampaignMatch(CAMPAIGN_LEVELS[1]);
  const u=m.alive('blue')[0]; u.c=5;u.r=12;u.stance='hold';u.objective=null;
  for(const enemy of m.alive('red')) enemy.hp=0;
  m.resolveRound();
  assert.equal(m.campaign.wave,1); assert.equal(m.campaign.phase,'engage');
  const alive=m.alive().map(u=>`${u.c},${u.r}`);
  assert.equal(new Set(alive).size,alive.length);
  u.c=5;u.r=1;
  m.resolveRound();
  assert.equal(m.over,false);
});

test('all factions can finish each campaign with a basic legal plan; seeded actions and waves replay exactly', () => {
  for(const level of CAMPAIGN_LEVELS) for(const f of FACTIONS) for(const seed of [7,19]) {
    const log=memoryLog();const m=createCampaignMatch(level,{faction:f.id,seed,log:log.push});
    while(!m.over) { planCampaign(m);m.resolveRound(); }
    assert.equal(m.winner,'blue',`${level.id}/${f.id}/${seed}: ${m.reason} stage ${m.campaign.stage} wave ${m.campaign.wave}`);
    assert.equal(m.reason,'campaign-complete');
    assert.equal(m.stats().red.recruited.pikeman,undefined);
    const check=replay(log.entries);
    assert.equal(check.ok,true,`${level.id}/${f.id}: ${JSON.stringify(check.mismatches.slice(0,1))}`);
  }
});
