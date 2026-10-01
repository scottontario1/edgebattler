// Small generated textures shared by several world objects (contact shadows, tile glows).

export function ensureSharedTextures(scene) {
  const { textures } = scene;
  if (!textures.exists('world:shadow')) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.scale(1, 0.5);
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(8,10,20,0.85)');
    gradient.addColorStop(0.55, 'rgba(8,10,20,0.5)');
    gradient.addColorStop(1, 'rgba(8,10,20,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    textures.addCanvas('world:shadow', canvas);
  }
}
