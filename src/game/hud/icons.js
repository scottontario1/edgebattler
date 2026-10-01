// Inline-SVG icon vocabulary. Every icon is drawn on a 16x16 grid in `currentColor` (colour it from CSS),
// carries aria-hidden and stays legible at 12px. Pure functions returning strings.

const svg = (body, { cls = '', size = 16 } = {}) =>
  `<svg class="hud-ico${cls ? ` ${cls}` : ''}" viewBox="0 0 16 16" width="${size}" height="${size}" fill="currentColor" aria-hidden="true" focusable="false">${body}</svg>`;

const STANCE = {
  advance: '<path d="M1.5 3 7 8l-5.5 5h3.2L10 8 4.7 3z"/><path d="M7 3l5.5 5L7 13h3.2l5.3-5-5.3-5z"/>',
  hold: '<path fill-rule="evenodd" d="M1.5 14V4.5h3v2h1.5v-2h4v2h1.5v-2h3V14zM6.2 14h3.6v-3.4a1.8 1.8 0 0 0-3.6 0z"/>',
  protect: '<path fill-rule="evenodd" d="M8 1 14 3v5c0 3.2-2.3 5.6-6 7-3.7-1.4-6-3.8-6-7V3zM8 3.6 4 4.9V8c0 2 1.4 3.6 4 4.8z"/>',
};
export const STANCE_LABEL = { advance: 'Advance', hold: 'Hold', protect: 'Protect' };

export function stanceIcon(stance, size = 16) {
  const key = STANCE[stance] ? stance : 'hold';
  return svg(STANCE[key], { cls: `stance-ico ${key}`, size });
}

const STAR = 'M8 1.2l2 4.3 4.7.6-3.4 3.2.9 4.7L8 11.6 3.8 14l.9-4.7L1.3 6.1 6 5.5z';

/** `count` filled stars out of `max` slots; empty slots are dimmed. */
export function starPips(count, max = 3, size = 12) {
  const on = Math.max(0, Math.min(max, Math.floor(Number(count) || 0)));
  let body = '';
  for (let i = 0; i < max; i += 1) {
    body += `<path class="pip ${i < on ? 'on' : 'off'}" transform="translate(${i * 16} 0)" d="${STAR}"/>`;
  }
  return `<svg class="hud-ico pips" viewBox="0 0 ${max * 16} 16" width="${size * max}" height="${size}" fill="currentColor" role="img" aria-label="${on} of ${max} stars">${body}</svg>`;
}

/** Faceted gem tinted by `color` (shard types). */
export function gemIcon(color, size = 20) {
  const fill = /^#[0-9a-f]{3,8}$/i.test(color) ? color : '#2fc4b0';
  return `<svg class="hud-gem" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false"><path d="M12 2 21 9 12 22 3 9Z" fill="${fill}" stroke="rgba(0,0,0,.55)" stroke-width="1" stroke-linejoin="round"/><path d="M12 2 21 9H3Z" fill="#fff" fill-opacity=".38"/><path d="M12 22 8 9h8Z" fill="#000" fill-opacity=".22"/><path d="M6.5 8.2 9 5.6" stroke="#fff" stroke-opacity=".8" stroke-width="1.3" stroke-linecap="round"/></svg>`;
}

const GLYPHS = {
  supply: '<path d="M8 1 14 6 8 15 2 6Z" fill="#c9a24a"/><path d="M8 1 14 6H2Z" fill="#f2cf6b"/><path d="M8 15 5 6h6Z" fill="#e6bd55"/>',
  population: '<circle cx="5.5" cy="5" r="2.4"/><circle cx="11" cy="5.8" r="2"/><path d="M1 13.5c0-2.7 2-4.4 4.5-4.4s4.5 1.7 4.5 4.4zM9.6 13.5c.2-1.7 1-2.8 2.2-3.4 2 .1 3.2 1.4 3.2 3.4z"/>',
  bench: '<path d="M1.5 6h13v2.2h-1.2V13h-2V8.2H4.7V13h-2V8.2H1.5z"/><path d="M3 3h10v1.8H3z" opacity=".6"/>',
  cycle: '<path d="M8 2.2a5.8 5.8 0 0 1 5.4 3.7l1.1-1v3.4h-3.4l1.3-1.2A3.9 3.9 0 0 0 8 4.1c-1 0-1.9.4-2.6 1l-1.3-1.4A5.8 5.8 0 0 1 8 2.2zM8 13.8a5.8 5.8 0 0 1-5.4-3.7l-1.1 1V7.7h3.4L3.6 8.9A3.9 3.9 0 0 0 8 11.9c1 0 1.9-.4 2.6-1l1.3 1.4A5.8 5.8 0 0 1 8 13.8z"/>',
  close: '<path d="m4 4 8 8m0-8-8 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  chevron: '<path d="m3.5 6 4.5 4.5L12.5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  march: '<path d="M8 1.5 14 8h-3.8v6.5H5.8V8H2z"/>',
  rally: '<path d="M6 1.8h4v4.2h4.2v4H10v4.2H6V10H1.8V6H6z"/>',
  continue: '<path d="M2 3l6 5-6 5zM8 3l6 5-6 5z"/>',
  next: '<path d="M2 7h8.2L7.5 4.3 8.8 3l5.2 5-5.2 5-1.3-1.3L10.2 9H2z"/>',
  swords: '<path d="M2 2h3.2l8.8 8.8-1.6 1.6L3.6 3.6zM14 2h-3.2L9 3.8l1.7 1.7L14 2zM4.8 9.4l1.8 1.8-2.5 2.5-1.8-1.8zM11.2 9.4l-1.8 1.8 2.5 2.5 1.8-1.8z"/>',
  flag: '<path d="M3.5 1.5v13" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M4.3 2.4h8.2l-2.2 3 2.2 3H4.3z"/>',
  skull: '<path d="M8 1.5c-3.3 0-5.5 2.2-5.5 5 0 1.8.9 3 2 3.8V13h7v-2.7c1.1-.8 2-2 2-3.8 0-2.8-2.2-5-5.5-5z"/><circle cx="5.7" cy="7.2" r="1.35" fill="#0b1222"/><circle cx="10.3" cy="7.2" r="1.35" fill="#0b1222"/>',
  crown: '<path d="M2 12.5l-.7-7 3.6 3L8 3l3.1 5.5 3.6-3-.7 7z"/><rect x="2" y="13" width="12" height="1.6" rx=".6"/>',
  card: '<rect x="3.2" y="1.6" width="9.6" height="12.8" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 5h5M5.5 8h5M5.5 11h2.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" fill="none"/>',
  info: '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 7.2v4M8 4.6v.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
  eye: '<path d="M8 3.5c3.2 0 5.5 2.6 6.5 4.5-1 1.9-3.3 4.5-6.5 4.5S2.5 9.9 1.5 8c1-1.9 3.3-4.5 6.5-4.5zm0 2.2a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6z"/>',
  withdraw: '<path d="M10 2.5 3.5 8l6.5 5.5V10h3V6h-3z"/>',
  chart: '<path d="M2 13.5V2.5h1.6v9.4H14v1.6zM5 11V7h2v4zm3 0V4h2v7zm3 0V8.5h2V11z"/>',
  menu: '<path d="M2 3.5h12v1.8H2zm0 3.6h12v1.8H2zm0 3.6h12v1.8H2z"/>',
  people: '<circle cx="8" cy="5" r="2.6"/><path d="M2.5 14c0-3 2.4-4.8 5.5-4.8s5.5 1.8 5.5 4.8z"/>',
};

/** Named glyph from the vocabulary above (falls back to `info`). */
export function glyph(name, size = 16, cls = '') {
  return svg(GLYPHS[name] ?? GLYPHS.info, { cls: `glyph-${name}${cls ? ` ${cls}` : ''}`, size });
}
