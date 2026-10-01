// The Resolve button and the round-playback clock.
import { esc, intentAttrs, stateAttrs, pct } from './util.js';
import { glyph } from './icons.js';

/** @param {import('./types.js').ResolveVM | null} resolve */
export function renderResolve(resolve) {
  if (!resolve || resolve.state === 'over') return '';
  if (resolve.state === 'playback') {
    const clock = resolve.clock;
    const elapsed = clock ? Math.min(clock.duration, Math.max(0, clock.elapsed)) : 0;
    return `<div class="hud-panel rs-playback" role="status" aria-live="polite">
        <span class="rs-title">${glyph('swords', 16)}Battle in progress</span>
        ${clock ? `<span class="rs-clock"><b>${elapsed.toFixed(0)}</b>s <small>of ${clock.duration}s</small></span>
          <span class="rs-track" role="progressbar" aria-valuemin="0" aria-valuemax="${clock.duration}" aria-valuenow="${elapsed.toFixed(1)}"><i style="width:${pct(elapsed, clock.duration)}%"></i></span>` : ''}
      </div>`;
  }
  return `<button type="button" class="hud-btn primary rs-button"${intentAttrs('resolve')}${stateAttrs(resolve)} title="${esc(resolve.reason || 'Play out the round')}">${glyph('swords', 16)}<span>${esc(resolve.label)}</span></button>`;
}
