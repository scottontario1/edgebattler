import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const commit = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return null; } })();

// Dev only: the browser game POSTs its JSON Lines game log (src/log.js playLog) here, and each game
// is appended to logs/play/<file>.jsonl. Not part of production builds.
function gameLogPlugin() {
  const dir = resolve('logs/play');
  return {
    name: 'game-log',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__log', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          try {
            const { file, text } = JSON.parse(body);
            const safe = String(file).replace(/[^\w.-]/g, '_').slice(0, 120) || 'game';
            mkdirSync(dir, { recursive: true });
            appendFileSync(resolve(dir, `${safe}.jsonl`), text);
            res.statusCode = 204;
          } catch (e) {
            res.statusCode = 400;
          }
          res.end();
        });
      });
    },
  };
}

export default defineConfig({
  define: { __COMMIT__: JSON.stringify(commit) },
  plugins: [gameLogPlugin()],
});
