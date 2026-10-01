// Placeholder entry point: the world agent replaces this with the Phaser bootstrap.
import Phaser from 'phaser';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b1222',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: { create() { this.add.text(24, 24, `Phaser ${Phaser.VERSION}`, { color: '#ffffff', fontSize: '24px' }); } },
});
