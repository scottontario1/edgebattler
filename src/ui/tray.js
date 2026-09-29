// The planning tray shell: the ledger header (Supply, Population, Reserve, Locations, prompt)
// and the slots the hand, reserve and footer modules render into. ui.js owns the state;
// this module only turns it into markup and publishes the tray's measured height.
import { esc } from './util.js';

/**
 * m: { supply, population, populationCap, reserveCount, reserveCapacity, locations, prompt,
 *      phase: 'player' | 'battle', collapsed: bool,
 *      hand, reserves, detail, queued, upgrades, choice, loadouts   (HTML strings from the other modules) }
 */
export function trayHTML(m) {
  return `<div class="planning-top"><div class="supply-readout"><b>${m.supply}</b><span>Supply</span></div><div class="population-readout"><b>${m.population}/${m.populationCap}</b><span>Population</span></div><div class="bench-title">Reserve <b>${m.reserveCount}/${m.reserveCapacity}</b></div><div class="bench-title">Locations <b>${m.locations}</b></div><div class="plan-prompt">${esc(m.prompt)}</div></div>
      <div class="plan-row"><div class="hand-strip" aria-label="Hand cards">${m.hand || '<span class="empty-hand">Hand is empty</span>'}</div><div class="reserve-strip" aria-label="Paid reserves">${m.reserves}</div></div>
      <div class="plan-foot">${m.detail}<div class="queued-spells">${m.queued}</div><div class="upgrade-prompts">${m.upgrades}</div>${m.choice}${m.loadouts}</div>`;
}

/** Called by ui.js after every render with the section element: state classes and the --tray-h variable. */
export function applyTrayState(el, m) {
  el.classList.toggle('locked', m.phase !== 'player');
  el.classList.toggle('collapsed', !!m.collapsed);
  document.documentElement.style.setProperty('--tray-h', `${Math.round(el.offsetHeight)}px`);
}

/** Pixels the tray occupies above the bottom of the screen (its height plus the edge gap); used by camera.js insets. */
export function trayInset() {
  const el = document.getElementById('planning');
  return el ? Math.round(el.offsetHeight + (parseFloat(getComputedStyle(el).bottom) || 0)) : 0;
}
