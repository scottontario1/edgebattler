import Phaser from 'phaser';
import { parseLaunch } from './launch.js';
import { BootScene } from './scenes/BootScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { Hud } from './hud/Hud.js';
import { GameApp } from './app/session.js';

const launch=parseLaunch(window.location.search);
for(const warning of launch.warnings)console.warn('[launch] '+warning);
const game=new Phaser.Game({type:Phaser.AUTO,parent:'game',backgroundColor:'#0b1222',
 scale:{mode:Phaser.Scale.RESIZE,width:window.innerWidth,height:window.innerHeight},
 mipmapFilter:'LINEAR_MIPMAP_LINEAR',render:{antialias:true,roundPixels:false},input:{windowEvents:true},
 scene:[BootScene,BattleScene],callbacks:{preBoot:g=>g.registry.set('launch',launch)}});
window.__phaser=game;
const hud=new Hud(document.getElementById('hud'));
const app=new GameApp({hud,game,launch});
window.__gameApp=app;
