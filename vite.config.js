import { defineConfig } from 'vite';

// The Phaser port. The legacy Three.js game has its own config in legacy/vite.config.js.
export default defineConfig({
  server: { port: Number(process.env.PORT) || 5180, strictPort: true },
  build: { chunkSizeWarningLimit: 1600 },
});
