// Shared inline-SVG icon vocabulary for the HUD (unit card, sheet, roster) and the on-map plates.
// Pure functions returning strings. Every icon is drawn on a 16x16 grid with `currentColor`
// fills (colour it from CSS), carries `aria-hidden`, and stays legible at 12px.
// No fonts, no images. Sizing is by the `size` argument (px) or by CSS on `.ico-svg`.

const svg = (body, { cls = '', size = 0, vb = '0 0 16 16', w = 16, h = 16 } = {}) => {
  const dim = size ? ` width="${Math.round(size * (w / h))}" height="${size}"` : ` width="${w}" height="${h}"`;
  return `<svg class="ico-svg${cls ? ` ${cls}` : ''}" viewBox="${vb}"${dim} fill="currentColor" aria-hidden="true" focusable="false">${body}</svg>`;
};

// ---- Stance: three different silhouettes (forward chevrons / crenellated wall / shield) ----
const STANCE = {
  // Advance: two solid forward chevrons.
  advance: '<path d="M1.5 3 7 8l-5.5 5h3.2L10 8 4.7 3z"/><path d="M7 3l5.5 5L7 13h3.2l5.3-5-5.3-5z"/>',
  // Hold: a crenellated wall (planted in place).
  hold: '<path fill-rule="evenodd" d="M1.5 14V4.5h3v2h1.5v-2h4v2h1.5v-2h3V14zM6.2 14h3.6v-3.4a1.8 1.8 0 0 0-3.6 0z"/>',
  // Protect: a heater shield.
  protect: '<path fill-rule="evenodd" d="M8 1 14 3v5c0 3.2-2.3 5.6-6 7-3.7-1.4-6-3.8-6-7V3zM8 3.6 4 4.9V8c0 2 1.4 3.6 4 4.8z"/>',
};
export const STANCE_LABEL = { advance: 'Advance', hold: 'Hold', protect: 'Protect' };
export const STANCE_HINT = {
  advance: 'moves toward the nearest foe and attacks',
  hold: 'stays in place and attacks what comes into reach',
  protect: 'guards nearby allies and intercepts foes',
};
export function stanceIcon(stance, size = 0) {
  const key = STANCE[stance] ? stance : 'hold';
  return svg(STANCE[key], { cls: `stance-ico ${key}`, size });
}

// ---- Stars: n filled of `max` slots (empty slots are dimmed) ----
const STAR = 'M8 1.2l2 4.3 4.7.6-3.4 3.2.9 4.7L8 11.6 3.8 14l.9-4.7L1.3 6.1 6 5.5z';
export function starPips(n, max = 3, size = 12) {
  const count = Math.max(0, Math.min(max, Math.floor(Number(n) || 0)));
  const slots = Math.max(count, max);
  let body = '';
  for (let i = 0; i < slots; i++) body += `<path class="pip star${i < count ? ' on' : ' off'}" transform="translate(${i * 16} 0)" d="${STAR}"/>`;
  return `<svg class="ico-svg pips stars" viewBox="0 0 ${slots * 16} 16" width="${Math.round(size * slots)}" height="${size}" fill="currentColor" role="img" aria-label="${count} of ${max} stars">${body}</svg>`;
}

// ---- Energy: diamonds, filled = available ----
const DIAMOND = 'M5 .8 9.2 5 5 9.2.8 5z';
export function energyPips(cur, max, size = 12) {
  const total = Math.max(0, Math.floor(Number(max) || 0));
  const on = Math.max(0, Math.min(total, Math.floor(Number(cur) || 0)));
  let body = '';
  for (let i = 0; i < total; i++) {
    body += `<path class="pip en${i < on ? ' on' : ' off'}" transform="translate(${i * 11} 3)" d="${DIAMOND}"/>`;
  }
  return `<svg class="ico-svg pips energy" viewBox="0 0 ${Math.max(1, total * 11)} 16" width="${Math.round((size * total * 11) / 16)}" height="${size}" fill="currentColor" role="img" aria-label="Energy ${on} of ${total}">${body}</svg>`;
}

// ---- Status effects (generic diamond fallback) ----
const STATUS = {
  // Barrier: a faceted shield plate with a cross (flat damage reduction).
  barrier: '<path fill-rule="evenodd" d="M8 1 14 3.4v4.4c0 3.2-2.2 5.6-6 7.2-3.8-1.6-6-4-6-7.2V3.4zM7.2 4.4v2.8H4.4v1.6h2.8v2.8h1.6V8.8h2.8V7.2H8.8V4.4z"/>',
  // Ward: an eye inside a ring (halves damage).
  ward: '<path fill-rule="evenodd" d="M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zm0 2.2a4.3 4.3 0 1 0 0 8.6 4.3 4.3 0 0 0 0-8.6z"/><circle cx="8" cy="8" r="2.1"/>',
  poison: '<path d="M8 1.2c2.6 3.3 4.6 5.6 4.6 8A4.6 4.6 0 0 1 8 13.8 4.6 4.6 0 0 1 3.4 9.2c0-2.4 2-4.7 4.6-8z"/>',
  haste: '<path d="M9.4 1 3 9h4l-1 6 7-8.6H8.8z"/>',
  regen: '<path d="M8 14.2 2.2 8.4a3.4 3.4 0 0 1 5-4.6L8 4.6l.8-.8a3.4 3.4 0 0 1 5 4.6z"/>',
  generic: '<path fill-rule="evenodd" d="M8 1.5 14.5 8 8 14.5 1.5 8zM8 5 5 8l3 3 3-3z"/>',
};
export function statusIcon(name, size = 0) {
  const key = STATUS[name] ? name : 'generic';
  return svg(STATUS[key], { cls: `status-ico ${key}`, size });
}

// ---- Misc glyphs ----
export function heartIcon(size = 0) {
  return svg('<path d="M8 14.4 1.8 8.2a3.6 3.6 0 0 1 5.3-4.9L8 4.3l.9-1a3.6 3.6 0 0 1 5.3 4.9z"/>', { cls: 'heart-ico', size });
}
export function boltIcon(size = 0) {
  return svg('<path d="M9.6 .8 3 9.2h4.2L6 15.2l7-8.8H8.8z"/>', { cls: 'bolt-ico', size });
}

export const ICONS = { stanceIcon, starPips, energyPips, statusIcon, heartIcon, boltIcon };
