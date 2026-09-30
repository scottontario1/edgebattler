// The planning tray shell: the ledger header (Supply, Population, Reserve, Locations, prompt,
// collapse toggle) and the #planning-body that holds the slots the hand, reserve and footer
// modules render into. ui.js owns the state; this module only turns it into markup and publishes
// the tray's measured height (--tray-h, trayInset()).
//
// Hooks ui.js listens for and that must stay: [data-act="toggleTray"] (the collapse button).
// The tray root gets the state classes `collapsed` and `locked` from applyTrayState().
import { esc } from './util.js';

/**
 * m: { supply, population, populationCap, reserveCount, reserveCapacity, locations, prompt,
 *      phase: 'player' | 'battle', collapsed: bool,
 *      hand, reserves, detail, queued, upgrades, choice, loadouts   (HTML strings from the other modules) }
 */
export function trayHTML(m) {
  const cap = Math.max(1, Number(m.populationCap) || 1);
  const ratio = Math.max(0, Math.min(1, (Number(m.population) || 0) / cap));
  const popState = (Number(m.population) || 0) >= cap ? ' full' : ratio >= 0.8 ? ' warn' : '';
  const reserveFull = (Number(m.reserveCount) || 0) >= (Number(m.reserveCapacity) || Infinity) ? ' warn' : '';
  const battle = m.phase !== 'player';
  const promptText = battle ? 'Battle in progress' : String(m.prompt || '');
  const collapsed = !!m.collapsed;
  const gem = '<svg class="ledger-gem" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1 14 6 8 15 2 6Z" fill="#c9a24a"/><path d="M8 1 14 6H2Z" fill="#f2cf6b"/><path d="M8 15 5 6h6Z" fill="#e6bd55"/></svg>';
  const chevron = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m3.5 6 4.5 4.5L12.5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return `<div class="tray-ledger">
      <div class="ledger-cell supply-readout"><span class="ledger-label">Supply</span><span class="ledger-value">${gem}<b>${m.supply}<small>/${m.maxSupply ?? 30}</small></b></span></div>
      <div class="ledger-cell population-readout${popState}"><span class="ledger-label">Population</span><span class="ledger-value"><b>${m.population}/${m.populationCap}</b><span class="pop-meter" role="meter" aria-label="Population" aria-valuemin="0" aria-valuemax="${cap}" aria-valuenow="${m.population}"><i style="width:${(ratio * 100).toFixed(1)}%"></i></span></span></div>
      <div class="ledger-cell reserve-readout${reserveFull}"><span class="ledger-label">Reserve</span><span class="ledger-value"><b>${m.reserveCount}/${m.reserveCapacity}</b></span></div>
      <div class="ledger-cell locations-readout"><span class="ledger-label">Cycle</span><span class="ledger-value"><b>${m.cyclesRemaining}/1</b></span></div>
      <div class="plan-prompt${battle ? ' battle' : ''}" title="${esc(promptText)}">${esc(promptText)}</div>
      <button type="button" class="tray-toggle" data-act="toggleTray" aria-expanded="${!collapsed}" aria-controls="planning-body" aria-label="${collapsed ? 'Expand' : 'Collapse'} planning tray" title="${collapsed ? 'Expand' : 'Collapse'} planning tray"${battle ? ' disabled' : ''}>${chevron}</button>
    </div>
    <div class="planning-body" id="planning-body">
      <div class="plan-row"><div class="hand-strip" aria-label="Hand cards">${m.hand || '<span class="empty-hand">Hand is empty</span>'}</div><div class="reserve-strip" aria-label="Paid reserves">${m.reserves}</div></div>
      <div class="plan-foot">${m.detail}<div class="queued-spells">${m.queued}</div><div class="upgrade-prompts">${m.upgrades}</div>${m.choice}${m.loadouts}</div>
    </div>`;
}

let trayEl = null;
let refocusToggle = false;
let observing = false;

function publishHeight() {
  const el = trayEl || document.getElementById('planning');
  if (el) document.documentElement.style.setProperty('--tray-h', `${Math.round(el.offsetHeight)}px`);
}

/** Called by ui.js after every render with the section element: state classes and the --tray-h variable. */
export function applyTrayState(el, m) {
  trayEl = el;
  el.classList.toggle('locked', m.phase !== 'player');
  el.classList.toggle('collapsed', !!m.collapsed);
  if (!observing) {
    observing = true;
    // The tray re-renders its innerHTML on every refresh, which drops keyboard focus from the
    // toggle; remember a keyboard activation (detail 0) and give focus back after the render.
    el.addEventListener('click', (e) => {
      const t = e.target.closest?.('.tray-toggle');
      if (t && !t.disabled) refocusToggle = e.detail === 0;
    }, true);
    // ui.js has a window-level Enter shortcut (resolve battle / recruit); keep Enter and Space on the
    // focused toggle from also triggering it. The button's own click activation is unaffected.
    el.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('.tray-toggle')) e.stopPropagation();
    });
    window.addEventListener('resize', publishHeight);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(publishHeight).observe(el);
  }
  publishHeight();
  if (refocusToggle) {
    refocusToggle = false;
    el.querySelector('.tray-toggle')?.focus({ preventScroll: true });
  }
}

/** Pixels from the bottom of the screen up to the tray's top edge (its height plus the gap below it); used by camera.js insets. */
export function trayInset() {
  const el = document.getElementById('planning');
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  return Math.max(0, Math.round(window.innerHeight - r.top));
}
