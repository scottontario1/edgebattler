import test from 'node:test';
import assert from 'node:assert/strict';
import {createMonsterUnit} from '../src/monsters.js';
import {unitCardHTML,sheetHTML} from '../src/ui/unitpanels.js';
import {weaponOf} from '../src/combat.js';
import {TERRAIN} from '../src/board.js';
test('monster card and inspection expose automatic kit names and triggers',()=>{
 const u=createMonsterUnit('monsterBogGolem','golem','red',5,7);
 assert.ok(u.passives?.length);
 const card=unitCardHTML(u,{portrait:''});
 const sheet=sheetHTML(u,{portrait:'',weapon:weaponOf(u),terrain:Object.values(TERRAIN)[0],moveType:'Foot'});
 for(const p of u.passives){assert.ok(card.includes(p.name));assert.ok(sheet.includes(p.name));assert.ok(sheet.includes(p.description));}
 assert.ok(sheet.includes('Passives'));
});
