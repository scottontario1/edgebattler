// Round-results feed (captures, deaths, heals, draws) and the big centred banner.
import { esc } from './util.js';
import { glyph } from './icons.js';

const BANNER_ICON = { planning: 'crown', battle: 'swords', victory: 'crown', defeat: 'skull', draw: 'flag', capture: 'flag', death: 'skull' };
const TONE_ICON = { good: 'flag', bad: 'skull', gold: 'crown', heal: 'rally', info: 'info' };

/** @param {import('./types.js').FeedVM | null} feed */
export function renderFeed(feed) {
  if (!feed || !feed.entries.length) return '';
  const entries = feed.entries.map((e) => `<li class="fd-entry ${esc(e.tone)}">${glyph(e.icon && e.icon !== 'plus' ? e.icon : e.icon === 'plus' ? 'rally' : TONE_ICON[e.tone] ?? 'info', 15)}<span>${esc(e.text)}</span></li>`).join('');
  const extra = feed.entries.length - 1;
  const more = extra > 0
    ? `<button type="button" class="fd-more" data-local-toggle="feed" aria-label="Show or hide ${extra} earlier results">+${extra}</button>` : '';
  return `<div class="fd-feed" role="log" aria-live="polite" aria-label="${esc(feed.title || 'Round results')}"><ol>${entries}</ol>${more}</div>`;
}

/** @param {import('./types.js').BannerVM | null} banner */
export function renderBanner(banner) {
  if (!banner) return '';
  const icon = glyph(BANNER_ICON[banner.kind] ?? 'crown', 28, 'bn-ico');
  return `<div class="bn-banner ${esc(banner.kind)}" role="status"><span class="bn-row">${icon}<b>${esc(banner.title)}</b>${icon}</span>${banner.sub ? `<small>${esc(banner.sub)}</small>` : ''}</div>`;
}
