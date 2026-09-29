// Battle presentation: floating numbers over units, banners, the phase pill and the round-results feed.
// Owned by TASK-004. ui.js calls `sync()` on every refresh with the current round state.
//
// Contract used by ui.js (unchanged):  createFeed({ camera, units, phaseEl, turnEl }) -> { pop, banner, sync }
//   pop(text, unitId, cls)            cls: '' | 'crit' | 'miss' | 'heal' | 'ward' | 'barrier'
//   banner(text, sub, ms, kind?)      kind: 'planning' | 'battle' | 'victory' | 'defeat' (inferred from text)
//   sync({ phase, turn, notice, busy, over })
// Markup created here: `.feed[role=log]` (child of `.hud`), `.pop`, `.banner[role=status]`,
// `.banner-restart[data-act=restart]` (re-dispatches a `keydown` for R on window; ui.js has no
// [data-act] listener on banners).
import { esc } from './util.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ENTRY_MS = 7000;   // life of a feed entry
const FADE_MS = 400;     // last part of that life spent fading out
const MAX_ENTRIES = 4;
const POP_STEP = 14;     // px between overlapping pops on one unit

// Feed icons: 16x16 inline SVG on currentColor, one per kind.
const ICONS = {
  flag: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 1.5v13" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M4.3 2.4h8.2l-2.2 3 2.2 3H4.3z" fill="currentColor"/></svg>',
  skull: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5c-3.3 0-5.5 2.2-5.5 5 0 1.8.9 3 2 3.8V13h7v-2.7c1.1-.8 2-2 2-3.8 0-2.8-2.2-5-5.5-5z" fill="currentColor"/><circle cx="5.7" cy="7.2" r="1.35" fill="#0b1222"/><circle cx="10.3" cy="7.2" r="1.35" fill="#0b1222"/><path d="M6.7 13v1.7M9.3 13v1.7" stroke="#0b1222" stroke-width="1" fill="none"/></svg>',
  crown: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 12.5l-.7-7 3.6 3L8 3l3.1 5.5 3.6-3-.7 7z" fill="currentColor"/><rect x="2" y="13" width="12" height="1.6" rx=".6" fill="currentColor"/></svg>',
  card: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.2" y="1.6" width="9.6" height="12.8" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 5h5M5.5 8h5M5.5 11h2.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 1.8h4v4.2h4.2v4H10v4.2H6V10H1.8V6H6z" fill="currentColor"/></svg>',
  info: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 7.2v4M8 4.6v.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

/** Pick an icon + tone for one notice fragment by keyword. */
function classify(text) {
  if (/reinforce/i.test(text)) return { icon: 'flag', tone: 'bad' };
  if (/lost village/i.test(text)) return { icon: 'flag', tone: 'bad' };
  if (/captured|village/i.test(text)) return { icon: 'flag', tone: 'good' };
  if (/fallen|slain|killed|dies|defeated/i.test(text)) return { icon: 'skull', tone: 'bad' };
  if (/return|respawn/i.test(text)) return { icon: 'crown', tone: 'gold' };
  if (/hand full|blocked|draw/i.test(text)) return { icon: 'card', tone: 'info' };
  if (/rally|heal|mend|restor/i.test(text)) return { icon: 'plus', tone: 'heal' };
  return { icon: 'info', tone: 'info' };
}

const BANNER_ICONS = {
  // crossed swords
  battle: '<svg viewBox="0 0 32 32" aria-hidden="true"><g stroke="currentColor" stroke-linecap="round" fill="none"><path d="M6 5l17 17M26 5L9 22" stroke-width="3.2"/><path d="M19 25l6-6M13 25l-6-6" stroke-width="3.6"/><path d="M23.5 25.5l3.5 3.5M8.5 25.5l-3.5 3.5" stroke-width="4"/></g></svg>',
  planning: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3l11 13-11 13L5 16z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M16 10l5 6-5 6-5-6z" fill="currentColor"/></svg>',
};

const isReduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/** deps: { camera, units, phaseEl, turnEl } */
export function createFeed({ camera, units, phaseEl, turnEl }) {
  const hud = document.querySelector('.hud') || document.body;

  // ------------------------------------------------------------------ pops
  const popCount = new Map(); // unit id -> pops still on screen (for vertical stagger)

  // Floating text over a unit (damage numbers, MISS, heals, statuses).
  function pop(text, id, cls = '') {
    let v;
    try { v = units.headPos(id).project(camera); } catch { return; }
    const kinds = String(cls).split(/\s+/).filter(Boolean);
    const label = kinds.includes('heal') && !/\+/.test(text) ? `+${text}` : String(text);
    const el = document.createElement('div');
    el.className = `pop ${kinds.join(' ')}`;
    el.textContent = label;
    el.style.visibility = 'hidden';
    document.body.appendChild(el);

    const w = el.offsetWidth, h = el.offsetHeight;
    const n = popCount.get(id) || 0;
    popCount.set(id, n + 1);
    // Clamp the resting position so the whole rise animation stays inside the viewport,
    // then stagger later pops on the same unit downwards (clamping first keeps them apart at the edges).
    const x = Math.min(Math.max((v.x * 0.5 + 0.5) * innerWidth, w / 2 + 8), innerWidth - w / 2 - 8);
    const yBase = Math.min(Math.max((-v.y * 0.5 + 0.5) * innerHeight, 12 + h * 1.4), innerHeight - h / 2 - 12);
    const y = Math.min(yBase + n * POP_STEP, innerHeight - h / 2 - 12);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.visibility = '';

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.remove();
      const left = (popCount.get(id) || 1) - 1;
      if (left > 0) popCount.set(id, left); else popCount.delete(id);
    };
    el.addEventListener('animationend', finish);
    setTimeout(finish, 1300);
  }

  // ------------------------------------------------------------------ banners
  let bannerEl = null;
  let endKind = null; // 'victory' | 'defeat' once a persistent end banner has been shown
  let lastSync = null;

  const inferKind = (text) => (/victory/i.test(text) ? 'victory'
    : /defeat/i.test(text) ? 'defeat'
      : /battle/i.test(text) ? 'battle' : 'planning');

  // Big centred message; resolves after `ms` (use ms = 0 for one that stays).
  async function banner(text, sub = '', ms = 1100, kind) {
    const k = kind || inferKind(String(text));
    bannerEl?.remove();
    const el = document.createElement('div');
    bannerEl = el;
    el.className = `banner ${k}`;
    el.setAttribute('role', 'status');
    const left = BANNER_ICONS[k] ? `<i class="b-ico" aria-hidden="true">${BANNER_ICONS[k]}</i>` : '<i class="b-orn" aria-hidden="true"></i>';
    const right = BANNER_ICONS[k] ? `<i class="b-ico r" aria-hidden="true">${BANNER_ICONS[k]}</i>` : '<i class="b-orn r" aria-hidden="true"></i>';
    el.innerHTML = `<span class="b-row">${left}<b>${esc(text)}</b>${right}</span>${sub ? `<small>${esc(sub)}</small>` : ''}`;
    if (!ms && (k === 'victory' || k === 'defeat')) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'banner-restart';
      b.dataset.act = 'restart';
      b.textContent = 'Restart (R)';
      b.addEventListener('click', () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', code: 'KeyR', bubbles: true }));
      });
      el.appendChild(b);
      endKind = k;
      if (lastSync) applyPhase(lastSync);
    }
    document.body.appendChild(el);
    if (!ms) return;
    await sleep(ms);
    el.remove();
    if (bannerEl === el) bannerEl = null;
  }

  // ------------------------------------------------------------------ feed
  const feedEl = document.createElement('div');
  feedEl.className = 'feed';
  feedEl.setAttribute('role', 'log');
  feedEl.setAttribute('aria-live', 'polite');
  feedEl.setAttribute('aria-label', 'Round results');
  const moreBtn = document.createElement('button');
  moreBtn.type = 'button';
  moreBtn.className = 'feed-more';
  moreBtn.hidden = true;
  moreBtn.setAttribute('aria-expanded', 'false');
  moreBtn.addEventListener('click', () => {
    const open = feedEl.classList.toggle('open');
    moreBtn.setAttribute('aria-expanded', String(open));
    updateMore();
  });
  feedEl.appendChild(moreBtn);
  hud.appendChild(feedEl);

  const entries = []; // { el, left }
  let hovered = false;
  let tickTimer = null;

  function updateMore() {
    const extra = entries.length - 1;
    feedEl.classList.toggle('has-entries', entries.length > 0);
    if (extra < 1) feedEl.classList.remove('open');
    const open = feedEl.classList.contains('open');
    moreBtn.hidden = extra < 1;
    moreBtn.textContent = open ? '−' : `+${extra}`;
    moreBtn.setAttribute('aria-expanded', String(open));
    moreBtn.setAttribute('aria-label', open ? 'Show only the newest result' : `Show ${extra} earlier result${extra === 1 ? '' : 's'}`);
  }

  function removeEntry(entry) {
    const i = entries.indexOf(entry);
    if (i >= 0) entries.splice(i, 1);
    entry.el.remove();
    updateMore();
  }

  let lastTickAt = 0;
  function tick() {
    const now = performance.now();
    const dt = now - lastTickAt;   // real elapsed time: browsers may throttle the interval itself
    lastTickAt = now;
    if (!entries.length) { clearInterval(tickTimer); tickTimer = null; return; }
    if (hovered) return;
    for (const entry of [...entries]) {
      if (!Number.isFinite(entry.left)) continue;
      entry.left -= dt;
      if (entry.left <= FADE_MS) entry.el.classList.add('leaving');
      if (entry.left <= 0) removeEntry(entry);
    }
  }

  function pushEntry(text) {
    const { icon, tone } = classify(text);
    const el = document.createElement('div');
    el.className = `entry ${tone}`;
    el.innerHTML = `<i class="ico">${ICONS[icon]}</i><span>${esc(text)}</span>`;
    feedEl.insertBefore(el, moreBtn);
    // With reduced motion nothing expires on its own; entries are cleared when the next battle starts.
    const entry = { el, left: isReduced() ? Infinity : ENTRY_MS };
    entries.push(entry);
    while (entries.length > MAX_ENTRIES) removeEntry(entries[0]);
    updateMore();
    if (!tickTimer) { lastTickAt = performance.now(); tickTimer = setInterval(tick, 250); }
  }

  function clearEntries() { for (const entry of [...entries]) removeEntry(entry); }

  // Pause expiry while the pointer is over the feed (the feed itself ignores pointer events).
  addEventListener('pointermove', (e) => {
    const r = feedEl.getBoundingClientRect();
    hovered = entries.length > 0 && e.clientX >= r.left - 4 && e.clientX <= r.right + 4 && e.clientY >= r.top - 4 && e.clientY <= r.bottom + 4;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { hovered = false; });

  // Anchor the feed below the turn panel (L) or the roster strip (P) so it can never overlap them,
  // however many rows the roster grows to. S positions the feed from CSS alone (roster hidden there).
  const turnPanel = turnEl.closest('.turn') || phaseEl.parentElement;
  const rosterEl = document.getElementById('roster');
  function anchorFeed() {
    const roster = rosterEl && getComputedStyle(rosterEl).position === 'fixed' ? rosterEl : null;
    const anchor = roster || turnPanel;
    const rect = anchor && anchor.getBoundingClientRect();
    if (rect && rect.height > 0) feedEl.style.setProperty('--feed-top', `${Math.ceil(rect.bottom) + (roster ? 8 : 10)}px`);
  }
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(anchorFeed);
    for (const node of [turnPanel, rosterEl]) if (node) ro.observe(node);
  }
  addEventListener('resize', anchorFeed);

  // ------------------------------------------------------------------ phase pill
  let lastNotice = '';
  let lastPhase = null;

  function applyPhase(s) {
    if (s.over && endKind) {
      phaseEl.textContent = endKind === 'victory' ? 'Victory' : 'Defeat';
      phaseEl.className = `phase ${endKind}`;
    } else {
      // A finished match keeps whatever the pill showed until the end banner has arrived.
      phaseEl.textContent = s.phase === 'player' ? 'Planning' : 'Battle';
      phaseEl.className = `phase ${s.phase === 'player' ? 'blue' : 'red'}`;
    }
    phaseEl.title = s.notice || '';
  }

  /** s: { phase: 'player' | 'battle', turn, notice, busy, over } — called after every ui refresh. */
  function sync(s) {
    lastSync = s;
    turnEl.textContent = s.turn;
    applyPhase(s);

    if (s.phase === 'battle' && lastPhase !== 'battle' && isReduced()) clearEntries();
    lastPhase = s.phase;

    const notice = typeof s.notice === 'string' ? s.notice.trim() : '';
    if (notice !== lastNotice) {
      lastNotice = notice;
      if (notice) {
        // Prompts ("Click a valid unit...", "Choose an open tile...") already live in the tray; the feed is for results.
        for (const part of notice.split(' · ')) {
          const t = part.trim().replace(/[.]$/, '');
          if (t && !/^(click|choose) /i.test(t)) pushEntry(t);
        }
      }
    }
    anchorFeed();
  }

  return { pop, banner, sync };
}
