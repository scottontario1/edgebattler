import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { FACTION_ART, spriteArt } from '../src/sprite-art.js';
import { portraitSVG } from '../src/portraits.js';
import { CAMPAIGN_LEVELS, createCampaignMatch } from '../src/campaign.js';
import { FACTIONS } from '../src/setup.js';
test('character identity overrides shared combat class and generated files exist', () => {
 assert.equal(Object.keys(FACTION_ART).length,24);
 assert.deepEqual(FACTION_ART,JSON.parse(readFileSync(new URL('../public/sprites/factions-manifest.json',import.meta.url))).units);
 for(const [key,info] of Object.entries(FACTION_ART)) {
 const u={id:'recruit-42',variantId:key,cls:'pikeman',faction:'red',name:key};
 assert.equal(spriteArt(u).key,key);
 for(const path of [info.file,info.portrait]) assert.ok(existsSync(new URL('../public/'+path,import.meta.url)));
 assert.ok(portraitSVG(u).includes(`data-sprite-key="${key}"`));
 assert.equal(spriteArt(u).files.blue,spriteArt(u).files.red);
 }
 assert.equal(spriteArt({spriteKey:'monsterRat',variantId:'crownPike'}).key,'monsterRat');
});
test('campaign has monsters and rival cultures without monster cards', () => {
 const seen=new Set();
 for(const level of CAMPAIGN_LEVELS) for(const faction of FACTIONS) for(const seed of [7,19,0,1,2,3]) {
 const m=createCampaignMatch(level,{faction:faction.id,seed});
 for(const stage of m.campaign.stages) {
 assert.notEqual(stage.enemyFaction,faction.id);
 for(const wave of stage.waves) for(const u of wave) {
 if(u.monster) seen.add(u.spriteKey); else assert.equal(u.enemyFaction,stage.enemyFaction);
 }
 }
 assert.ok(m.alive('red').some(u=>u.monster));
 assert.equal(m.sides.red.cards.hand.length,0);
 assert.ok(m.sides.blue.cards.hand.every(c=>!c.unitId?.startsWith('monster')));
 }
 assert.equal(seen.size,8);
});
