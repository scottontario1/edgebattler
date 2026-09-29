// Battle presentation: floating numbers over units, centred banners and the phase pill.
// Owned by TASK-004. ui.js calls `sync()` on every refresh with the current round state.
import { esc } from './util.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** deps: { camera, units, phaseEl, turnEl } */
export function createFeed({ camera, units, phaseEl, turnEl }) {
  // Floating text over a unit (damage numbers, MISS).
  function pop(text, id, cls = '') {
    const v = units.headPos(id).project(camera);
    const el = document.createElement('div');
    el.className = `pop ${cls}`;
    el.textContent = text;
    el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  // Big centred message; resolves after `ms` (use ms = 0 for one that stays).
  let bannerEl = null;
  async function banner(text, sub = '', ms = 1100) {
    bannerEl?.remove();
    bannerEl = document.createElement('div');
    bannerEl.className = 'banner';
    bannerEl.innerHTML = `<b>${esc(text)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}`;
    document.body.appendChild(bannerEl);
    if (!ms) return;
    await sleep(ms);
    bannerEl.remove();
    bannerEl = null;
  }

  /** s: { phase: 'player' | 'battle', turn, notice, busy, over } — called after every ui refresh. */
  function sync(s) {
    turnEl.textContent = s.turn;
    phaseEl.textContent = s.phase === 'player' ? 'Planning' : 'Battle';
    phaseEl.className = `phase ${s.phase === 'player' ? 'blue' : 'red'}`;
    phaseEl.title = s.notice || '';
  }

  return { pop, banner, sync };
}
