// Headless screenshot of the running dev server with true device emulation (so a 390px-wide
// phone viewport really is 390 CSS px; plain `chrome --window-size` clamps to ~500px).
// Usage: node tools/shot.mjs <out.png> [width] [height] [query] [waitMs]
// Also prints console errors from the page.
// STEPS env var (JSON) scripts interactions after load, e.g.
//   STEPS='[["move",296,370],["click",296,370],["key","a"],["wait",400],["shot","a.png"],["eval","document.title"]]'
// "tap" x y sends a touch tap; "drag" x0 y0 x1 y1 a mouse drag. The final screenshot is still <out.png>.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const [out, w = '1280', h = '800', query = '', waitMs = '9000'] = process.argv.slice(2);
if (!out) { console.error('usage: node tools/shot.mjs <out.png> [w] [h] [query] [waitMs]'); process.exit(1); }
const width = +w, height = +h, mobile = width < height && width < 700;
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const prof = mkdtempSync(join(tmpdir(), 'shot-'));
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(chrome, [
  '--headless=new', ...(process.env.NOSANDBOX ? ['--no-sandbox'] : []), ...(process.env.SWIFTSHADER ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']), '--hide-scrollbars',
  `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=1400,1000', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.enable');
await send('Page.navigate', { url: `http://localhost:${process.env.PORT || 5173}/${query ? `?${query}` : ''}` });
await sleep(+waitMs);
const capture = async (file) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(file), Buffer.from(r.result.data, 'base64'));
};
const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', pointerType: 'mouse', ...extra });
for (const [op, ...a] of JSON.parse(process.env.STEPS || '[]')) {
  if (op === 'move') await mouse('mouseMoved', a[0], a[1], { button: 'none' });
  else if (op === 'click') { await mouse('mousePressed', a[0], a[1], { clickCount: 1 }); await mouse('mouseReleased', a[0], a[1], { clickCount: 1 }); }
  else if (op === 'drag') {
    await mouse('mousePressed', a[0], a[1], { clickCount: 1 });
    for (let i = 1; i <= 10; i++) await mouse('mouseMoved', a[0] + ((a[2] - a[0]) * i) / 10, a[1] + ((a[3] - a[1]) * i) / 10, { buttons: 1 });
    await mouse('mouseReleased', a[2], a[3], { clickCount: 1 });
  } else if (op === 'tap') {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a[0], y: a[1] }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else if (op === 'key') {
    const k = a[0], code = k.length === 1 ? `Key${k.toUpperCase()}` : k;
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, text: k.length === 1 ? k : undefined });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code });
  } else if (op === 'wait') await sleep(a[0]);
  else if (op === 'shot') await capture(a[0]);
  else if (op === 'eval') {
    const result=await send('Runtime.evaluate',{expression:a[0],returnByValue:true});
    if(result.result.exceptionDetails) errors.push(result.result.exceptionDetails.exception?.description||result.result.exceptionDetails.text);
    else console.log('eval:',JSON.stringify(result.result.result.value));
  }
  await sleep(250);
}
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(resolve(out), Buffer.from(shot.result.data, 'base64'));
console.log(`wrote ${out} (${width}x${height}${mobile ? ', mobile' : ''})`);
if (errors.length) console.log('page errors:\n  ' + errors.join('\n  '));
ws.close();
proc.kill();
await sleep(300);
try { rmSync(prof, { recursive: true, force: true }); } catch {}
process.exit(errors.length ? 1 : 0);
