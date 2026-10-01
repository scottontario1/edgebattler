import {createCampaignMatch,CAMPAIGN_LEVELS} from '../src/campaign.js';
import {FACTIONS} from '../src/setup.js';
import {memoryLog,replay} from '../src/log.js';
for(const level of CAMPAIGN_LEVELS)for(const f of FACTIONS){
 const log=memoryLog(),m=createCampaignMatch(level,{faction:f.id,seed:7,combat:{duration:18},log:log.push});
 let rounds=0,strikes=0,abilities=0;
 while(!m.over&&rounds++<40){
  m.apply({type:'campaignOrder',faction:'blue'});
  if(m.campaign.phase==='regroup'){m.apply({type:'campaignRally',faction:'blue'});m.apply({type:'campaignContinue',faction:'blue'});m.apply({type:'campaignOrder',faction:'blue'});}
  const res=m.resolveRound();
  for(const batch of res.batches)for(const e of batch.events){if(e.type==='strike')strikes++;if(batch.type==='abilities'&&e.applied)abilities++;}
 }
 const check=replay(log.entries);
 console.log(JSON.stringify({level:level.id,faction:f.id,winner:m.winner,rounds,strikes,abilities,replay:check.ok,reason:m.reason,stage:m.campaign.stage,wave:m.campaign.wave}));
 if(m.winner!=='blue')throw Error('Campaign failed '+level.id+'/'+f.id);
 if(!check.ok)throw Error(JSON.stringify(check.mismatches.slice(0,1)));
}
